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

	// Property translation propagation (from lookup tables to main properties table)
	PropagatePropertyTranslations(ctx context.Context, targetLang string) (int64, int64, error)
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

// NumWorkers for concurrent translation
// With 3 load-balanced LibreTranslate instances (each LT_THREADS=8), total capacity = 24 threads
// Optimal: 12 workers = 6/sec (tested: 18=0.87, 14=3.4, 10=4.2)
const NumWorkers = 12

// executeProductTranslation handles product translation with concurrent workers
// IMPORTANT: Fetches one batch at a time and waits for all workers to finish
// before fetching the next batch to avoid duplicate processing due to race conditions
func (e *Executor) executeProductTranslation(ctx context.Context, job *models.TranslationJob) error {
	const batchSize = 500 // Fetch larger batches since we wait between batches
	var translated, failed, skipped int64

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		// Fetch batch of products
		products, err := e.repo.GetUntranslatedProducts(ctx, job.TargetLanguage, batchSize)
		if err != nil {
			return fmt.Errorf("failed to get untranslated products: %w", err)
		}

		if len(products) == 0 {
			break // No more products to process
		}

		// Create channel for this batch only
		productCh := make(chan *models.Product, len(products))

		// Send all products to channel first
		for _, product := range products {
			productCh <- product
		}
		close(productCh) // Close channel since all items are sent

		// Start workers to process this batch
		var wg sync.WaitGroup
		for i := 0; i < NumWorkers; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				for product := range productCh {
					select {
					case <-ctx.Done():
						return
					default:
					}

					// Translate product name
					var nameTranslated, descTranslated *string
					var productFailed bool

					if product.Name != "" {
						result, err := e.translator.TranslateWithRetry(ctx, product.Name, job.TargetLanguage, 3)
						if err != nil {
							productFailed = true
							e.logTranslation(job.ID, "products", &product.ID, "name", product.Name, nil, job.TargetLanguage, models.TranslationLogFailed, err.Error())
						} else {
							nameTranslated = &result.TranslatedText
							e.logTranslation(job.ID, "products", &product.ID, "name", product.Name, nameTranslated, job.TargetLanguage, models.TranslationLogSuccess, "")
						}
					}

					// Translate description if exists
					if product.Description != nil && *product.Description != "" && !productFailed {
						result, err := e.translator.TranslateWithRetry(ctx, *product.Description, job.TargetLanguage, 3)
						if err != nil {
							e.logTranslation(job.ID, "products", &product.ID, "description", *product.Description, nil, job.TargetLanguage, models.TranslationLogFailed, err.Error())
						} else {
							descTranslated = &result.TranslatedText
							e.logTranslation(job.ID, "products", &product.ID, "description", *product.Description, descTranslated, job.TargetLanguage, models.TranslationLogSuccess, "")
						}
					}

					// Update database
					if nameTranslated != nil || descTranslated != nil {
						if err := e.repo.UpdateProductTranslation(ctx, product.ID, nameTranslated, descTranslated, job.TargetLanguage); err != nil {
							log.Printf("Failed to update product translation: %v", err)
							atomic.AddInt64(&failed, 1)
						} else {
							atomic.AddInt64(&translated, 1)
						}
					} else if productFailed {
						atomic.AddInt64(&failed, 1)
					} else {
						atomic.AddInt64(&skipped, 1)
					}

					// Update progress
					t := int(atomic.LoadInt64(&translated))
					f := int(atomic.LoadInt64(&failed))
					s := int(atomic.LoadInt64(&skipped))

					job.TranslatedItems = t
					job.FailedItems = f
					job.SkippedItems = s
					e.jobManager.UpdateJob(job.ID, t, f, s)

					e.broadcastProgress(ProgressUpdate{
						JobID:           job.ID,
						Status:          job.Status,
						TotalItems:      job.TotalItems,
						TranslatedItems: t,
						FailedItems:     f,
						SkippedItems:    s,
						CurrentItem:     product.Name,
						Timestamp:       time.Now(),
					})
				}
			}()
		}

		// Wait for all workers to finish this batch before fetching next
		wg.Wait()
	}

	return nil
}

// executeCategoryTranslation handles category translation with concurrent workers
// IMPORTANT: Fetches one batch at a time and waits for all workers to finish
// before fetching the next batch to avoid duplicate processing due to race conditions
func (e *Executor) executeCategoryTranslation(ctx context.Context, job *models.TranslationJob) error {
	const batchSize = 500 // Fetch larger batches since we wait between batches
	var translated, failed, skipped int64

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		// Fetch batch of categories
		categories, err := e.repo.GetUntranslatedCategories(ctx, job.TargetLanguage, batchSize)
		if err != nil {
			return fmt.Errorf("failed to get untranslated categories: %w", err)
		}

		if len(categories) == 0 {
			break // No more categories to process
		}

		// Create channel for this batch only
		categoryCh := make(chan *models.Category, len(categories))

		// Send all categories to channel first
		for _, category := range categories {
			categoryCh <- category
		}
		close(categoryCh) // Close channel since all items are sent

		// Start workers to process this batch
		var wg sync.WaitGroup
		for i := 0; i < NumWorkers; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				for category := range categoryCh {
					select {
					case <-ctx.Done():
						return
					default:
					}

					if category.Name == "" {
						atomic.AddInt64(&skipped, 1)
					} else {
						result, err := e.translator.TranslateWithRetry(ctx, category.Name, job.TargetLanguage, 3)
						if err != nil {
							atomic.AddInt64(&failed, 1)
							e.logTranslation(job.ID, "categories", &category.ID, "name", category.Name, nil, job.TargetLanguage, models.TranslationLogFailed, err.Error())
						} else {
							if err := e.repo.UpdateCategoryTranslation(ctx, category.ID, &result.TranslatedText, job.TargetLanguage); err != nil {
								log.Printf("Failed to update category: %v", err)
								atomic.AddInt64(&failed, 1)
							} else {
								atomic.AddInt64(&translated, 1)
								e.logTranslation(job.ID, "categories", &category.ID, "name", category.Name, &result.TranslatedText, job.TargetLanguage, models.TranslationLogSuccess, "")
							}
						}
					}

					t := int(atomic.LoadInt64(&translated))
					f := int(atomic.LoadInt64(&failed))
					s := int(atomic.LoadInt64(&skipped))
					job.TranslatedItems = t
					job.FailedItems = f
					job.SkippedItems = s
					e.jobManager.UpdateJob(job.ID, t, f, s)

					e.broadcastProgress(ProgressUpdate{
						JobID:           job.ID,
						Status:          job.Status,
						TotalItems:      job.TotalItems,
						TranslatedItems: t,
						FailedItems:     f,
						SkippedItems:    s,
						CurrentItem:     category.Name,
						Timestamp:       time.Now(),
					})
				}
			}()
		}

		// Wait for all workers to finish this batch before fetching next
		wg.Wait()
	}

	return nil
}

// executePropertyTranslation handles property translation with concurrent workers
func (e *Executor) executePropertyTranslation(ctx context.Context, job *models.TranslationJob) error {
	var translated, failed, skipped int64
	const batchSize = 500 // Fetch larger batches since we now wait between batches

	// Helper to process items with workers
	// IMPORTANT: Fetches one batch at a time and waits for all workers to finish
	// before fetching the next batch to avoid duplicate processing due to race conditions
	processItems := func(isGroup bool, getItems func() ([]string, error), updateItem func(string, *string) error, fieldName string) error {
		for {
			select {
			case <-ctx.Done():
				return ctx.Err()
			default:
			}

			// Fetch batch of items
			items, err := getItems()
			if err != nil {
				return err
			}

			if len(items) == 0 {
				break // No more items to process
			}

			// Create channel for this batch only
			itemCh := make(chan string, len(items))

			// Send all items to channel first
			for _, item := range items {
				itemCh <- item
			}
			close(itemCh) // Close channel since all items are sent

			// Start workers to process this batch
			var wg sync.WaitGroup
			for i := 0; i < NumWorkers; i++ {
				wg.Add(1)
				go func() {
					defer wg.Done()
					for item := range itemCh {
						select {
						case <-ctx.Done():
							return
						default:
						}

						if item == "" {
							atomic.AddInt64(&skipped, 1)
						} else {
							result, err := e.translator.TranslateWithRetry(ctx, item, job.TargetLanguage, 3)
							if err != nil {
								atomic.AddInt64(&failed, 1)
								e.logTranslation(job.ID, "properties", nil, fieldName, item, nil, job.TargetLanguage, models.TranslationLogFailed, err.Error())
							} else {
								if err := updateItem(item, &result.TranslatedText); err != nil {
									log.Printf("Failed to update %s: %v", fieldName, err)
									atomic.AddInt64(&failed, 1)
								} else {
									atomic.AddInt64(&translated, 1)
									e.logTranslation(job.ID, "properties", nil, fieldName, item, &result.TranslatedText, job.TargetLanguage, models.TranslationLogSuccess, "")
								}
							}
						}

						t := int(atomic.LoadInt64(&translated))
						f := int(atomic.LoadInt64(&failed))
						s := int(atomic.LoadInt64(&skipped))
						job.TranslatedItems = t
						job.FailedItems = f
						job.SkippedItems = s
						e.jobManager.UpdateJob(job.ID, t, f, s)

						prefix := "Property"
						if isGroup {
							prefix = "Group"
						}
						e.broadcastProgress(ProgressUpdate{
							JobID:           job.ID,
							Status:          job.Status,
							TotalItems:      job.TotalItems,
							TranslatedItems: t,
							FailedItems:     f,
							SkippedItems:    s,
							CurrentItem:     fmt.Sprintf("%s: %s", prefix, item),
							Timestamp:       time.Now(),
						})
					}
				}()
			}

			// Wait for all workers to finish this batch before fetching next
			wg.Wait()
		}

		return nil
	}

	// Phase 1: Translate unique group names
	log.Printf("Starting property group translation...")
	if err := processItems(
		true,
		func() ([]string, error) { return e.repo.GetUntranslatedPropertyGroups(ctx, job.TargetLanguage, batchSize) },
		func(name string, translated *string) error {
			return e.repo.UpdatePropertyGroupTranslation(ctx, name, translated, job.TargetLanguage)
		},
		"group_name",
	); err != nil {
		return err
	}

	// Phase 2: Translate unique property names
	log.Printf("Starting property name translation...")
	if err := processItems(
		false,
		func() ([]string, error) { return e.repo.GetUntranslatedPropertyNames(ctx, job.TargetLanguage, batchSize) },
		func(name string, translated *string) error {
			return e.repo.UpdatePropertyNameTranslation(ctx, name, translated, job.TargetLanguage)
		},
		"property_name",
	); err != nil {
		return err
	}

	// Phase 3: Propagate translations from lookup tables to main properties table
	log.Printf("Propagating translations to main properties table...")
	e.broadcastProgress(ProgressUpdate{
		JobID:           job.ID,
		Status:          job.Status,
		TotalItems:      job.TotalItems,
		TranslatedItems: int(translated),
		FailedItems:     int(failed),
		SkippedItems:    int(skipped),
		Message:         "Propagating translations to properties table...",
		Timestamp:       time.Now(),
	})

	namesUpdated, groupsUpdated, err := e.repo.PropagatePropertyTranslations(ctx, job.TargetLanguage)
	if err != nil {
		log.Printf("Warning: Failed to propagate property translations: %v", err)
		// Don't fail the job, just log the warning
	} else {
		log.Printf("Propagated translations: %d property names, %d group names", namesUpdated, groupsUpdated)
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
