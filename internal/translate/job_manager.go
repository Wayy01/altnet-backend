package translate

import (
	"context"
	"sync"
	"time"

	"github.com/google/uuid"
	"ultra-api-testing/internal/models"
)

// JobManager manages active translation jobs and their cancellation
type JobManager struct {
	mu         sync.RWMutex
	activeJobs map[uuid.UUID]*ActiveJob
}

// ActiveJob represents an in-progress translation job
type ActiveJob struct {
	Job       *models.TranslationJob
	Cancel    context.CancelFunc
	StartedAt time.Time
}

// ProgressUpdate represents a progress update for SSE streaming
type ProgressUpdate struct {
	JobID           uuid.UUID `json:"job_id"`
	Status          string    `json:"status"`
	TotalItems      int       `json:"total_items"`
	TranslatedItems int       `json:"translated_items"`
	FailedItems     int       `json:"failed_items"`
	SkippedItems    int       `json:"skipped_items"`
	CurrentItem     string    `json:"current_item,omitempty"`
	Message         string    `json:"message,omitempty"`
	Timestamp       time.Time `json:"timestamp"`
}

// NewJobManager creates a new job manager
func NewJobManager() *JobManager {
	return &JobManager{
		activeJobs: make(map[uuid.UUID]*ActiveJob),
	}
}

// CreateJob creates a new translation job and registers it as active
func (jm *JobManager) CreateJob(entityType, targetLang string, totalItems int) *models.TranslationJob {
	now := time.Now()
	job := &models.TranslationJob{
		ID:              uuid.New(),
		EntityType:      entityType,
		TargetLanguage:  targetLang,
		Status:          models.TranslationStatusPending,
		TotalItems:      totalItems,
		TranslatedItems: 0,
		FailedItems:     0,
		SkippedItems:    0,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	return job
}

// StartJob marks a job as running and creates a cancellation context
func (jm *JobManager) StartJob(job *models.TranslationJob) (context.Context, context.CancelFunc) {
	ctx, cancel := context.WithCancel(context.Background())
	now := time.Now()
	job.Status = models.TranslationStatusRunning
	job.StartedAt = &now
	job.UpdatedAt = now

	jm.mu.Lock()
	jm.activeJobs[job.ID] = &ActiveJob{
		Job:       job,
		Cancel:    cancel,
		StartedAt: now,
	}
	jm.mu.Unlock()

	return ctx, cancel
}

// UpdateJob updates the progress of an active job
func (jm *JobManager) UpdateJob(jobID uuid.UUID, translatedItems, failedItems, skippedItems int) {
	jm.mu.Lock()
	defer jm.mu.Unlock()

	if activeJob, exists := jm.activeJobs[jobID]; exists {
		activeJob.Job.TranslatedItems = translatedItems
		activeJob.Job.FailedItems = failedItems
		activeJob.Job.SkippedItems = skippedItems
		activeJob.Job.UpdatedAt = time.Now()
	}
}

// CompleteJob marks a job as completed and removes it from active jobs
func (jm *JobManager) CompleteJob(jobID uuid.UUID, status string, errorMessage *string) {
	jm.mu.Lock()
	defer jm.mu.Unlock()

	if activeJob, exists := jm.activeJobs[jobID]; exists {
		now := time.Now()
		activeJob.Job.Status = status
		activeJob.Job.CompletedAt = &now
		activeJob.Job.UpdatedAt = now
		activeJob.Job.ErrorMessage = errorMessage
		delete(jm.activeJobs, jobID)
	}
}

// CancelJob cancels a running job
func (jm *JobManager) CancelJob(jobID uuid.UUID) error {
	jm.mu.Lock()
	defer jm.mu.Unlock()

	if activeJob, exists := jm.activeJobs[jobID]; exists {
		activeJob.Cancel()
		now := time.Now()
		activeJob.Job.Status = models.TranslationStatusCancelled
		activeJob.Job.CompletedAt = &now
		activeJob.Job.UpdatedAt = now
		delete(jm.activeJobs, jobID)
		return nil
	}
	return nil // Job might already be completed
}

// GetActiveJob returns an active job by ID
func (jm *JobManager) GetActiveJob(jobID uuid.UUID) *models.TranslationJob {
	jm.mu.RLock()
	defer jm.mu.RUnlock()

	if activeJob, exists := jm.activeJobs[jobID]; exists {
		return activeJob.Job
	}
	return nil
}

// GetAllActiveJobs returns all active jobs
func (jm *JobManager) GetAllActiveJobs() []*models.TranslationJob {
	jm.mu.RLock()
	defer jm.mu.RUnlock()

	jobs := make([]*models.TranslationJob, 0, len(jm.activeJobs))
	for _, activeJob := range jm.activeJobs {
		jobs = append(jobs, activeJob.Job)
	}
	return jobs
}

// HasActiveJobForEntity checks if there's an active job for the given entity type and language
func (jm *JobManager) HasActiveJobForEntity(entityType, targetLang string) bool {
	jm.mu.RLock()
	defer jm.mu.RUnlock()

	for _, activeJob := range jm.activeJobs {
		if activeJob.Job.EntityType == entityType && activeJob.Job.TargetLanguage == targetLang {
			return true
		}
	}
	return false
}

// Shutdown cancels all active jobs
func (jm *JobManager) Shutdown() {
	jm.mu.Lock()
	defer jm.mu.Unlock()

	for _, activeJob := range jm.activeJobs {
		activeJob.Cancel()
	}
	jm.activeJobs = make(map[uuid.UUID]*ActiveJob)
}
