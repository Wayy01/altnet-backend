package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"ultra-api-testing/internal/models"
	"ultra-api-testing/internal/repository"
	"ultra-api-testing/internal/translate"
)

// TranslationHandler handles translation-related API requests
type TranslationHandler struct {
	repo       *repository.TranslationRepository
	translator *translate.TranslationService
	jobManager *translate.JobManager
	executor   *translate.Executor
}

// NewTranslationHandler creates a new translation handler
// libreTranslateURL should be the URL of the LibreTranslate server (e.g., http://localhost:5000)
func NewTranslationHandler(repo *repository.TranslationRepository, libreTranslateURL string) *TranslationHandler {
	translator := translate.NewTranslationService(libreTranslateURL)
	jobManager := translate.NewJobManager()
	executor := translate.NewExecutor(repo, translator, jobManager)

	return &TranslationHandler{
		repo:       repo,
		translator: translator,
		jobManager: jobManager,
		executor:   executor,
	}
}

// StartTranslationRequest represents the request to start a translation job
type StartTranslationRequest struct {
	EntityType     string `json:"entity_type"`     // "products", "categories", "properties"
	TargetLanguage string `json:"target_language"` // "ru", "ro"
}

// StartTranslation starts a new translation job
// POST /api/v1/translate/start
func (h *TranslationHandler) StartTranslation(w http.ResponseWriter, r *http.Request) {
	var req StartTranslationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate entity type
	if req.EntityType != "products" && req.EntityType != "categories" && req.EntityType != "properties" {
		http.Error(w, "Invalid entity_type. Must be 'products', 'categories', or 'properties'", http.StatusBadRequest)
		return
	}

	// Validate target language
	if req.TargetLanguage != "ru" && req.TargetLanguage != "ro" {
		http.Error(w, "Invalid target_language. Must be 'ru' or 'ro'", http.StatusBadRequest)
		return
	}

	// Check if there's already an active job for this entity/language
	if h.jobManager.HasActiveJobForEntity(req.EntityType, req.TargetLanguage) {
		http.Error(w, "A translation job is already running for this entity type and language", http.StatusConflict)
		return
	}

	// Get count of items to translate
	var totalItems int
	var err error
	ctx := r.Context()

	switch req.EntityType {
	case "products":
		totalItems, err = h.repo.GetUntranslatedProductCount(ctx, req.TargetLanguage)
	case "categories":
		totalItems, err = h.repo.GetUntranslatedCategoryCount(ctx, req.TargetLanguage)
	case "properties":
		totalItems, err = h.repo.GetUntranslatedPropertyCount(ctx, req.TargetLanguage)
	}

	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to count items: %v", err), http.StatusInternalServerError)
		return
	}

	if totalItems == 0 {
		http.Error(w, "No items to translate", http.StatusBadRequest)
		return
	}

	// Create the job
	job := h.jobManager.CreateJob(req.EntityType, req.TargetLanguage, totalItems)

	// Start job execution in background with a new context (not the request context)
	// Using context.Background() so the job continues after the HTTP response is sent
	go func() {
		bgCtx := context.Background()
		if err := h.executor.ExecuteJob(bgCtx, job); err != nil {
			log.Printf("Translation job %s failed: %v", job.ID, err)
		}
	}()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data": job,
	})
}

// ListTranslationJobs lists all translation jobs
// GET /api/v1/translate/jobs
func (h *TranslationHandler) ListTranslationJobs(w http.ResponseWriter, r *http.Request) {
	// Parse query parameters
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if offset < 0 {
		offset = 0
	}

	entityType := r.URL.Query().Get("entity_type")
	targetLang := r.URL.Query().Get("target_language")
	status := r.URL.Query().Get("status")

	jobs, total, err := h.repo.ListTranslationJobs(r.Context(), limit, offset, entityType, targetLang, status)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to list jobs: %v", err), http.StatusInternalServerError)
		return
	}

	// Overlay real-time progress from in-memory active jobs
	// Database only updates every 10 items, so active jobs show stale progress
	activeJobs := h.jobManager.GetAllActiveJobs()
	activeJobMap := make(map[uuid.UUID]*models.TranslationJob)
	for _, aj := range activeJobs {
		activeJobMap[aj.ID] = aj
	}

	// Replace database records with real-time data for active jobs
	for i, job := range jobs {
		if activeJob, exists := activeJobMap[job.ID]; exists {
			jobs[i] = activeJob
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data": jobs,
		"meta": map[string]interface{}{
			"total":  total,
			"limit":  limit,
			"offset": offset,
		},
	})
}

// GetTranslationJob returns details of a specific job
// GET /api/v1/translate/jobs/{id}
func (h *TranslationHandler) GetTranslationJob(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		http.Error(w, "Invalid job ID", http.StatusBadRequest)
		return
	}

	// First check active jobs in memory
	if activeJob := h.jobManager.GetActiveJob(id); activeJob != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"data": activeJob,
		})
		return
	}

	// Otherwise get from database
	job, err := h.repo.GetTranslationJob(r.Context(), id)
	if err != nil {
		http.Error(w, "Job not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data": job,
	})
}

// CancelTranslationJob cancels a running job
// POST /api/v1/translate/jobs/{id}/cancel
func (h *TranslationHandler) CancelTranslationJob(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		http.Error(w, "Invalid job ID", http.StatusBadRequest)
		return
	}

	// Cancel the job
	if err := h.jobManager.CancelJob(id); err != nil {
		http.Error(w, fmt.Sprintf("Failed to cancel job: %v", err), http.StatusInternalServerError)
		return
	}

	// Update in database
	job, err := h.repo.GetTranslationJob(r.Context(), id)
	if err == nil {
		job.Status = models.TranslationStatusCancelled
		now := time.Now()
		job.CompletedAt = &now
		h.repo.UpdateTranslationJob(r.Context(), job)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Job cancelled",
		"job_id":  id,
	})
}

// GetTranslationLogs returns logs for a specific job
// GET /api/v1/translate/jobs/{id}/logs
func (h *TranslationHandler) GetTranslationLogs(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		http.Error(w, "Invalid job ID", http.StatusBadRequest)
		return
	}

	// Parse query parameters
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if offset < 0 {
		offset = 0
	}

	logs, total, err := h.repo.GetTranslationLogs(r.Context(), id, limit, offset)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get logs: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data": logs,
		"meta": map[string]interface{}{
			"total":  total,
			"limit":  limit,
			"offset": offset,
		},
	})
}

// GetTranslationStats returns translation statistics
// GET /api/v1/translate/stats
func (h *TranslationHandler) GetTranslationStats(w http.ResponseWriter, r *http.Request) {
	stats, err := h.repo.GetTranslationStats(r.Context())
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get stats: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data": stats,
	})
}

// StreamTranslationProgress streams progress updates via SSE
// GET /api/v1/translate/stream/{id}
func (h *TranslationHandler) StreamTranslationProgress(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		http.Error(w, "Invalid job ID", http.StatusBadRequest)
		return
	}

	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming not supported", http.StatusInternalServerError)
		return
	}

	// Subscribe to progress updates
	progressCh := h.executor.SubscribeToProgress(id)
	defer h.executor.UnsubscribeFromProgress(id, progressCh)

	// Also poll the database/memory for current state
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	ctx := r.Context()

	// Send initial state
	if activeJob := h.jobManager.GetActiveJob(id); activeJob != nil {
		data, _ := json.Marshal(activeJob)
		fmt.Fprintf(w, "data: %s\n\n", data)
		flusher.Flush()
	}

	for {
		select {
		case <-ctx.Done():
			return
		case update, ok := <-progressCh:
			if !ok {
				return
			}
			data, _ := json.Marshal(update)
			fmt.Fprintf(w, "data: %s\n\n", data)
			flusher.Flush()

			// Check if job is completed
			if update.Status == models.TranslationStatusCompleted ||
				update.Status == models.TranslationStatusFailed ||
				update.Status == models.TranslationStatusCancelled {
				return
			}
		case <-ticker.C:
			// Send heartbeat or current state
			if activeJob := h.jobManager.GetActiveJob(id); activeJob != nil {
				data, _ := json.Marshal(activeJob)
				fmt.Fprintf(w, "data: %s\n\n", data)
				flusher.Flush()
			} else {
				// Job might be completed, check database
				job, err := h.repo.GetTranslationJob(ctx, id)
				if err == nil {
					data, _ := json.Marshal(job)
					fmt.Fprintf(w, "data: %s\n\n", data)
					flusher.Flush()

					if job.Status == models.TranslationStatusCompleted ||
						job.Status == models.TranslationStatusFailed ||
						job.Status == models.TranslationStatusCancelled {
						return
					}
				}
			}
		}
	}
}

// Shutdown gracefully shuts down the translation handler
func (h *TranslationHandler) Shutdown() {
	h.jobManager.Shutdown()
	h.translator.Close()
}
