package translate

import (
	"context"
	"fmt"
	"log"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	"ultra-api-testing/internal/models"
)

// Number of concurrent translation workers
// 10 workers with 50ms delay - tested and working
const NumWorkers = 10

// TranslationRepository interface for database operations
type TranslationRepository interface {
	// Translation job operations
	CreateTranslationJob(ctx context.Context, job *models.TranslationJob) error
	UpdateTranslationJob(ctx context.Context, job *models.TranslationJob) error
	GetTranslationJob(ctx context.Context, id uuid.UUID) (*models.TranslationJob, error)

	// Translation log operations
	CreateTranslationLog(ctx context.Context, log *models.TranslationLog) error
	BulkCreateTranslationLogs(ctx context.Context, logs []*models.TranslationLog) error

	// Product translation operations
	GetUntranslatedProducts(ctx context.Context, targetLang string, limit int) ([]*models.Product, error)
	UpdateProductTranslation(ctx context.Context, id uuid.UUID, nameTranslated, descTranslated *string, targetLang string) error

	// Category translation operations
	GetUntranslatedCategories(ctx context.Context, targetLang string, limit int) ([]*models.Category, error)
	UpdateCategoryTranslation(ctx context.Context, id uuid.UUID, nameTranslated *string, targetLang string) error

	// Property translation operations (unique values)
	GetUntranslatedPropertyGroups(ctx context.Context, targetLang string, limit int) ([]string, error)
	GetUntranslatedPropertyNames(ctx context.Context, targetLang string, limit int) ([]string, error)
	UpdatePropertyGroupTranslation(ctx context.Context, groupName string, translated *string, targetLang string) error
	UpdatePropertyNameTranslation(ctx context.Context, propertyName string, translated *string, targetLang string) error
}

// Executor handles the execution of translation jobs
type Executor struct {
	repo        TranslationRepository
	translator  *TranslationService
	jobManager  *JobManager
	progressMu  sync.RWMutex
	progressSub map[uuid.UUID][]chan ProgressUpdate
}

// NewExecutor creates a new translation executor
func NewExecutor(repo TranslationRepository, translator *TranslationService, jobManager *JobManager) *Executor {
	return &Executor{
		repo:        repo,
		translator:  translator,
		jobManager:  jobManager,
		progressSub: make(map[uuid.UUID][]chan ProgressUpdate),
	}
}

// SubscribeToProgress subscribes to progress updates for a job
func (e *Executor) SubscribeToProgress(jobID uuid.UUID) chan ProgressUpdate {
	e.progressMu.Lock()
	defer e.progressMu.Unlock()

	ch := make(chan ProgressUpdate, 100)
	e.progressSub[jobID] = append(e.progressSub[jobID], ch)
	return ch
}

// UnsubscribeFromProgress unsubscribes from progress updates
func (e *Executor) UnsubscribeFromProgress(jobID uuid.UUID, ch chan ProgressUpdate) {
	e.progressMu.Lock()
	defer e.progressMu.Unlock()

	subs := e.progressSub[jobID]
	for i, sub := range subs {
		if sub == ch {
			e.progressSub[jobID] = append(subs[:i], subs[i+1:]...)
			close(ch)
			break
		}
	}
}

// broadcastProgress sends progress update to all subscribers
func (e *Executor) broadcastProgress(update ProgressUpdate) {
	e.progressMu.RLock()
	defer e.progressMu.RUnlock()

	for _, ch := range e.progressSub[update.JobID] {
		select {
		case ch <- update:
		default:
			// Channel full, skip update
		}
	}
}

// ExecuteJob executes a translation job based on entity type
func (e *Executor) ExecuteJob(ctx context.Context, job *models.TranslationJob) error {
	// Save job to database
	if err := e.repo.CreateTranslationJob(ctx, job); err != nil {
		return fmt.Errorf("failed to create job: %w", err)
	}

	// Start the job
	jobCtx, _ := e.jobManager.StartJob(job)

	// Update job in database
	if err := e.repo.UpdateTranslationJob(ctx, job); err != nil {
		log.Printf("Failed to update job status: %v", err)
	}

	// Execute based on entity type
	var err error
	switch job.EntityType {
	case "products":
		err = e.executeProductTranslation(jobCtx, job)
	case "categories":
		err = e.executeCategoryTranslation(jobCtx, job)
	case "properties":
		err = e.executePropertyTranslation(jobCtx, job)
	default:
		err = fmt.Errorf("unknown entity type: %s", job.EntityType)
	}

	// Complete the job
	status := models.TranslationStatusCompleted
	var errorMessage *string
	if err != nil {
		if ctx.Err() != nil || jobCtx.Err() != nil {
			status = models.TranslationStatusCancelled
		} else {
			status = models.TranslationStatusFailed
			errMsg := err.Error()
			errorMessage = &errMsg
		}
	}

	e.jobManager.CompleteJob(job.ID, status, errorMessage)
	job.Status = status
	job.ErrorMessage = errorMessage
	now := time.Now()
	job.CompletedAt = &now

	// Final database update
	if err := e.repo.UpdateTranslationJob(context.Background(), job); err != nil {
		log.Printf("Failed to update completed job: %v", err)
	}

	// Send final progress update
	e.broadcastProgress(ProgressUpdate{
		JobID:           job.ID,
		Status:          job.Status,
		TotalItems:      job.TotalItems,
		TranslatedItems: job.TranslatedItems,
		FailedItems:     job.FailedItems,
		SkippedItems:    job.SkippedItems,
		Message:         fmt.Sprintf("Job %s", job.Status),
		Timestamp:       time.Now(),
	})

	return err
}

// executeProductTranslation handles product translation with concurrent workers
func (e *Executor) executeProductTranslation(ctx context.Context, job *models.TranslationJob) error {
	batchSize := 100
	var translated, failed, skipped int64

	// Create work channel and result channel
	type productWork struct {
		product *models.Product
	}
	type productResult struct {
		translated bool
		failed     bool
		skipped    bool
		name       string
	}

	workCh := make(chan productWork, NumWorkers*2)
	resultCh := make(chan productResult, NumWorkers*2)

	// Start worker goroutines
	var wg sync.WaitGroup
	for i := 0; i < NumWorkers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for work := range workCh {
				select {
				case <-ctx.Done():
					return
				default:
				}

				product := work.product
				result := productResult{name: product.Name}

				// Translate name
				var nameTranslated *string
				if product.Name != "" {
					res, err := e.translator.TranslateWithRetry(ctx, product.Name, job.TargetLanguage, 2)
					if err != nil {
						result.failed = true
						e.logTranslation(job.ID, "products", &product.ID, "name", product.Name, nil, job.TargetLanguage, models.TranslationLogFailed, err.Error())
					} else {
						nameTranslated = &res.TranslatedText
						e.logTranslation(job.ID, "products", &product.ID, "name", product.Name, nameTranslated, job.TargetLanguage, models.TranslationLogSuccess, "")
					}
				}

				// Translate description
				var descTranslated *string
				if product.Description != nil && *product.Description != "" {
					res, err := e.translator.TranslateWithRetry(ctx, *product.Description, job.TargetLanguage, 2)
					if err != nil {
						// Don't mark as failed for description, name is primary
						e.logTranslation(job.ID, "products", &product.ID, "description", *product.Description, nil, job.TargetLanguage, models.TranslationLogFailed, err.Error())
					} else {
						descTranslated = &res.TranslatedText
						e.logTranslation(job.ID, "products", &product.ID, "description", *product.Description, descTranslated, job.TargetLanguage, models.TranslationLogSuccess, "")
					}
				}

				// Update product in database
				if nameTranslated != nil || descTranslated != nil {
					if err := e.repo.UpdateProductTranslation(ctx, product.ID, nameTranslated, descTranslated, job.TargetLanguage); err != nil {
						log.Printf("Failed to update product translation: %v", err)
						result.failed = true
						result.translated = false
					} else {
						result.translated = true
					}
				} else if !result.failed {
					result.skipped = true
				}

				resultCh <- result
			}
		}()
	}

	// Start result collector goroutine
	done := make(chan struct{})
	go func() {
		for result := range resultCh {
			if result.translated {
				atomic.AddInt64(&translated, 1)
			}
			if result.failed {
				atomic.AddInt64(&failed, 1)
			}
			if result.skipped {
				atomic.AddInt64(&skipped, 1)
			}

			t := int(atomic.LoadInt64(&translated))
			f := int(atomic.LoadInt64(&failed))
			s := int(atomic.LoadInt64(&skipped))

			// Update job progress
			job.TranslatedItems = t
			job.FailedItems = f
			job.SkippedItems = s
			e.jobManager.UpdateJob(job.ID, t, f, s)

			// Broadcast progress
			e.broadcastProgress(ProgressUpdate{
				JobID:           job.ID,
				Status:          job.Status,
				TotalItems:      job.TotalItems,
				TranslatedItems: t,
				FailedItems:     f,
				SkippedItems:    s,
				CurrentItem:     result.name,
				Timestamp:       time.Now(),
			})

			// Update database periodically (every 50 items)
			if (t+f+s)%50 == 0 {
				if err := e.repo.UpdateTranslationJob(ctx, job); err != nil {
					log.Printf("Failed to update job progress: %v", err)
				}
			}
		}
		close(done)
	}()

	// Feed work to workers
	for {
		select {
		case <-ctx.Done():
			close(workCh)
			wg.Wait()
			close(resultCh)
			<-done
			return ctx.Err()
		default:
		}

		// Get batch of untranslated products
		products, err := e.repo.GetUntranslatedProducts(ctx, job.TargetLanguage, batchSize)
		if err != nil {
			close(workCh)
			wg.Wait()
			close(resultCh)
			<-done
			return fmt.Errorf("failed to get untranslated products: %w", err)
		}

		if len(products) == 0 {
			break
		}

		for _, product := range products {
			select {
			case <-ctx.Done():
				close(workCh)
				wg.Wait()
				close(resultCh)
				<-done
				return ctx.Err()
			case workCh <- productWork{product: product}:
			}
		}
	}

	// Close work channel and wait for workers to finish
	close(workCh)
	wg.Wait()
	close(resultCh)
	<-done

	return nil
}

// executeCategoryTranslation handles category translation with concurrent workers
func (e *Executor) executeCategoryTranslation(ctx context.Context, job *models.TranslationJob) error {
	batchSize := 100
	var translated, failed, skipped int64

	// Create work channel and result channel
	type categoryWork struct {
		category *models.Category
	}
	type categoryResult struct {
		translated bool
		failed     bool
		skipped    bool
		name       string
	}

	workCh := make(chan categoryWork, NumWorkers*2)
	resultCh := make(chan categoryResult, NumWorkers*2)

	// Start worker goroutines
	var wg sync.WaitGroup
	for i := 0; i < NumWorkers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for work := range workCh {
				select {
				case <-ctx.Done():
					return
				default:
				}

				category := work.category
				result := categoryResult{name: category.Name}

				// Translate name
				var nameTranslated *string
				if category.Name != "" {
					res, err := e.translator.TranslateWithRetry(ctx, category.Name, job.TargetLanguage, 2)
					if err != nil {
						result.failed = true
						e.logTranslation(job.ID, "categories", &category.ID, "name", category.Name, nil, job.TargetLanguage, models.TranslationLogFailed, err.Error())
					} else {
						nameTranslated = &res.TranslatedText
						e.logTranslation(job.ID, "categories", &category.ID, "name", category.Name, nameTranslated, job.TargetLanguage, models.TranslationLogSuccess, "")
					}
				}

				// Update category in database
				if nameTranslated != nil {
					if err := e.repo.UpdateCategoryTranslation(ctx, category.ID, nameTranslated, job.TargetLanguage); err != nil {
						log.Printf("Failed to update category translation: %v", err)
						result.failed = true
					} else {
						result.translated = true
					}
				} else if !result.failed {
					result.skipped = true
				}

				resultCh <- result
			}
		}()
	}

	// Start result collector goroutine
	done := make(chan struct{})
	go func() {
		for result := range resultCh {
			if result.translated {
				atomic.AddInt64(&translated, 1)
			}
			if result.failed {
				atomic.AddInt64(&failed, 1)
			}
			if result.skipped {
				atomic.AddInt64(&skipped, 1)
			}

			t := int(atomic.LoadInt64(&translated))
			f := int(atomic.LoadInt64(&failed))
			s := int(atomic.LoadInt64(&skipped))

			// Update job progress
			job.TranslatedItems = t
			job.FailedItems = f
			job.SkippedItems = s
			e.jobManager.UpdateJob(job.ID, t, f, s)

			// Broadcast progress
			e.broadcastProgress(ProgressUpdate{
				JobID:           job.ID,
				Status:          job.Status,
				TotalItems:      job.TotalItems,
				TranslatedItems: t,
				FailedItems:     f,
				SkippedItems:    s,
				CurrentItem:     result.name,
				Timestamp:       time.Now(),
			})
		}
		close(done)
	}()

	// Feed work to workers
	for {
		select {
		case <-ctx.Done():
			close(workCh)
			wg.Wait()
			close(resultCh)
			<-done
			return ctx.Err()
		default:
		}

		// Get batch of untranslated categories
		categories, err := e.repo.GetUntranslatedCategories(ctx, job.TargetLanguage, batchSize)
		if err != nil {
			close(workCh)
			wg.Wait()
			close(resultCh)
			<-done
			return fmt.Errorf("failed to get untranslated categories: %w", err)
		}

		if len(categories) == 0 {
			break
		}

		for _, category := range categories {
			select {
			case <-ctx.Done():
				close(workCh)
				wg.Wait()
				close(resultCh)
				<-done
				return ctx.Err()
			case workCh <- categoryWork{category: category}:
			}
		}
	}

	// Close work channel and wait for workers to finish
	close(workCh)
	wg.Wait()
	close(resultCh)
	<-done

	return nil
}

// executePropertyTranslation handles property translation with concurrent workers
func (e *Executor) executePropertyTranslation(ctx context.Context, job *models.TranslationJob) error {
	var translated, failed, skipped int64

	// Worker helper for processing property items
	type propWork struct {
		name     string
		isGroup  bool
	}
	type propResult struct {
		translated bool
		failed     bool
		skipped    bool
		name       string
		isGroup    bool
	}

	processItems := func(isGroup bool, getItems func() ([]string, error), updateItem func(string, *string) error, fieldName string) error {
		workCh := make(chan propWork, NumWorkers*2)
		resultCh := make(chan propResult, NumWorkers*2)

		var wg sync.WaitGroup
		for i := 0; i < NumWorkers; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				for work := range workCh {
					select {
					case <-ctx.Done():
						return
					default:
					}

					result := propResult{name: work.name, isGroup: work.isGroup}

					if work.name == "" {
						result.skipped = true
						resultCh <- result
						continue
					}

					res, err := e.translator.TranslateWithRetry(ctx, work.name, job.TargetLanguage, 2)
					if err != nil {
						result.failed = true
						e.logTranslation(job.ID, "properties", nil, fieldName, work.name, nil, job.TargetLanguage, models.TranslationLogFailed, err.Error())
						resultCh <- result
						continue
					}

					if err := updateItem(work.name, &res.TranslatedText); err != nil {
						log.Printf("Failed to update %s translation: %v", fieldName, err)
						result.failed = true
					} else {
						result.translated = true
						e.logTranslation(job.ID, "properties", nil, fieldName, work.name, &res.TranslatedText, job.TargetLanguage, models.TranslationLogSuccess, "")
					}

					resultCh <- result
				}
			}()
		}

		done := make(chan struct{})
		go func() {
			for result := range resultCh {
				if result.translated {
					atomic.AddInt64(&translated, 1)
				}
				if result.failed {
					atomic.AddInt64(&failed, 1)
				}
				if result.skipped {
					atomic.AddInt64(&skipped, 1)
				}

				t := int(atomic.LoadInt64(&translated))
				f := int(atomic.LoadInt64(&failed))
				s := int(atomic.LoadInt64(&skipped))

				job.TranslatedItems = t
				job.FailedItems = f
				job.SkippedItems = s
				e.jobManager.UpdateJob(job.ID, t, f, s)

				prefix := "Property"
				if result.isGroup {
					prefix = "Group"
				}
				e.broadcastProgress(ProgressUpdate{
					JobID:           job.ID,
					Status:          job.Status,
					TotalItems:      job.TotalItems,
					TranslatedItems: t,
					FailedItems:     f,
					SkippedItems:    s,
					CurrentItem:     fmt.Sprintf("%s: %s", prefix, result.name),
					Timestamp:       time.Now(),
				})
			}
			close(done)
		}()

		for {
			select {
			case <-ctx.Done():
				close(workCh)
				wg.Wait()
				close(resultCh)
				<-done
				return ctx.Err()
			default:
			}

			items, err := getItems()
			if err != nil {
				close(workCh)
				wg.Wait()
				close(resultCh)
				<-done
				return err
			}

			if len(items) == 0 {
				break
			}

			for _, item := range items {
				select {
				case <-ctx.Done():
					close(workCh)
					wg.Wait()
					close(resultCh)
					<-done
					return ctx.Err()
				case workCh <- propWork{name: item, isGroup: isGroup}:
				}
			}
		}

		close(workCh)
		wg.Wait()
		close(resultCh)
		<-done
		return nil
	}

	// Phase 1: Translate unique group names
	log.Printf("Starting property group translation with %d workers...", NumWorkers)
	if err := processItems(
		true,
		func() ([]string, error) { return e.repo.GetUntranslatedPropertyGroups(ctx, job.TargetLanguage, 100) },
		func(name string, translated *string) error {
			return e.repo.UpdatePropertyGroupTranslation(ctx, name, translated, job.TargetLanguage)
		},
		"group_name",
	); err != nil {
		return err
	}

	// Phase 2: Translate unique property names
	log.Printf("Starting property name translation with %d workers...", NumWorkers)
	if err := processItems(
		false,
		func() ([]string, error) { return e.repo.GetUntranslatedPropertyNames(ctx, job.TargetLanguage, 100) },
		func(name string, translated *string) error {
			return e.repo.UpdatePropertyNameTranslation(ctx, name, translated, job.TargetLanguage)
		},
		"property_name",
	); err != nil {
		return err
	}

	return nil
}

// logTranslation creates a translation log entry
func (e *Executor) logTranslation(jobID uuid.UUID, entityType string, entityID *uuid.UUID, fieldName, sourceText string, translatedText *string, targetLang, status, errorMsg string) {
	logEntry := &models.TranslationLog{
		ID:             uuid.New(),
		JobID:          jobID,
		EntityType:     entityType,
		EntityID:       entityID,
		FieldName:      fieldName,
		OriginalValue:  sourceText,
		SourceText:     sourceText,
		TranslatedText: translatedText,
		TargetLanguage: targetLang,
		Status:         status,
		CreatedAt:      time.Now(),
	}
	if errorMsg != "" {
		logEntry.ErrorMessage = &errorMsg
	}

	// Fire and forget - don't block on log creation
	go func() {
		if err := e.repo.CreateTranslationLog(context.Background(), logEntry); err != nil {
			log.Printf("Failed to create translation log: %v", err)
		}
	}()
}
