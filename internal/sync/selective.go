package sync

import (
	"context"
	"fmt"
	"log"
	"runtime"
	"strings"
	"time"

	"github.com/google/uuid"
	"ultra-api-testing/internal/models"
	"ultra-api-testing/internal/repository"
	"ultra-api-testing/internal/ultra"
)

// SelectiveSync handles selective sync operations
type SelectiveSync struct {
	repo           *repository.Repository
	syncConfigRepo *repository.SyncConfigRepository
	realtimeRepo   *repository.RealtimeSyncRepository
	sourceRepo     *repository.SourceRepository
	fetcher        *ultra.Fetcher
	syncManager    *SyncManager // Manages active syncs for cancellation
}

// NewSelectiveSync creates a new selective sync instance
func NewSelectiveSync(repo *repository.Repository, syncConfigRepo *repository.SyncConfigRepository, fetcher *ultra.Fetcher, syncManager *SyncManager) *SelectiveSync {
	return &SelectiveSync{
		repo:           repo,
		syncConfigRepo: syncConfigRepo,
		realtimeRepo:   repository.NewRealtimeSyncRepository(repo.Pool()),
		sourceRepo:     repository.NewSourceRepository(repo.Pool()),
		fetcher:        fetcher,
		syncManager:    syncManager,
	}
}

// SyncResult holds the results of a selective sync
type SyncResult struct {
	SyncLogID     uuid.UUID
	Duration      time.Duration
	TotalChanges  int
	StepResults   map[models.SyncStep]*StepResult
	Errors        []string
}

// StepResult holds results for a single sync step
type StepResult struct {
	Step      models.SyncStep
	Extracted int
	Inserted  int
	Updated   int
	Skipped   int
	Failed    int
	Duration  time.Duration
	Error     error
}

// ExecuteSelectiveSync orchestrates a selective sync operation
func (s *SelectiveSync) ExecuteSelectiveSync(ctx context.Context, request *models.SelectiveSyncRequest) (*SyncResult, error) {
	log.Printf("Starting selective sync with %d steps", len(request.SelectedSteps))

	// Validate configuration
	if err := s.validateConfiguration(request); err != nil {
		return nil, fmt.Errorf("invalid configuration: %w", err)
	}

	startTime := time.Now()

	// Use pre-set sync ID if provided (for async execution), otherwise generate new one
	var syncLogID uuid.UUID
	if request.SyncLogID != nil {
		syncLogID = *request.SyncLogID
	} else {
		syncLogID = uuid.New()
	}

	result := &SyncResult{
		SyncLogID:   syncLogID,
		StepResults: make(map[models.SyncStep]*StepResult),
		Errors:      make([]string, 0),
	}

	// Create sync log
	syncLog, err := s.createSyncLog(ctx, result.SyncLogID, request)
	if err != nil {
		return nil, fmt.Errorf("failed to create sync log: %w", err)
	}
	result.SyncLogID = syncLog.ID

	// Register sync with manager for cancellation support
	// This creates a new cancellable context
	syncCtx, syncCancel := s.syncManager.RegisterSync(result.SyncLogID, "selective")
	defer syncCancel() // Ensure cleanup when sync completes

	// Merge with original context to respect both parent cancellation and sync-specific cancellation
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	// Monitor both contexts
	go func() {
		select {
		case <-syncCtx.Done():
			log.Printf("Sync %s: Cancellation requested via SyncManager", result.SyncLogID)
			cancel() // Cancel the main context
		case <-ctx.Done():
			// Original context cancelled, nothing to do
		}
	}()

	// Log sync start
	stepNames := make([]string, len(request.SelectedSteps))
	for i, step := range request.SelectedSteps {
		stepNames[i] = string(step)
	}
	s.logEntry(ctx, result.SyncLogID, nil, models.LogLevelInfo,
		fmt.Sprintf("Starting selective sync with steps: [%s]", strings.Join(stepNames, ", ")),
		map[string]interface{}{
			"selected_steps": stepNames,
			"sync_type":      "selective",
		})

	// Update configuration last used timestamp if configuration ID provided
	if request.ConfigurationID != nil {
		if err := s.syncConfigRepo.UpdateConfigurationLastUsed(ctx, *request.ConfigurationID); err != nil {
			log.Printf("Warning: failed to update configuration last used: %v", err)
		}
	}

	// Save as template if requested
	if request.SaveAsTemplate {
		if err := s.saveAsTemplate(ctx, request); err != nil {
			log.Printf("Warning: failed to save as template: %v", err)
		}
	}

	// Execute each selected step in order
	for _, step := range request.SelectedSteps {
		stepNumber := getStepNumber(step)
		stepNumberPtr := &stepNumber

		log.Printf("Executing step: %s", step)

		// Log step start
		s.logEntry(ctx, result.SyncLogID, stepNumberPtr, models.LogLevelInfo,
			fmt.Sprintf("Executing step: %s", step),
			map[string]interface{}{
				"step_name":   string(step),
				"step_number": stepNumber,
			})

		stepResult := &StepResult{
			Step: step,
		}
		stepStartTime := time.Now()

		var err error
		switch step {
		case models.SyncStepBrands:
			err = s.processBrandsSelective(ctx, result.SyncLogID, request, stepResult)
		case models.SyncStepCategories:
			err = s.processCategoriesSelective(ctx, result.SyncLogID, request, stepResult)
		case models.SyncStepProducts:
			err = s.processProductsSelective(ctx, result.SyncLogID, request, stepResult)
		case models.SyncStepProperties:
			err = s.processPropertiesSelective(ctx, result.SyncLogID, request, stepResult)
		case models.SyncStepPrices:
			err = s.processPricesSelective(ctx, result.SyncLogID, request, stepResult)
		case models.SyncStepStock:
			err = s.processStockSelective(ctx, result.SyncLogID, request, stepResult)
		case models.SyncStepExchangeRates:
			err = s.processExchangeRatesSelective(ctx, result.SyncLogID, request, stepResult)
		default:
			err = fmt.Errorf("unknown sync step: %s", step)
		}

		stepResult.Duration = time.Since(stepStartTime)
		stepResult.Error = err
		result.StepResults[step] = stepResult

		if err != nil {
			errMsg := fmt.Sprintf("Step %s failed: %v", step, err)
			log.Printf("ERROR: %s", errMsg)
			result.Errors = append(result.Errors, errMsg)
			stepResult.Failed++

			// Log step error
			s.logEntry(ctx, result.SyncLogID, stepNumberPtr, models.LogLevelError,
				errMsg,
				map[string]interface{}{
					"step_name":   string(step),
					"step_number": stepNumber,
					"error":       err.Error(),
					"duration_ms": stepResult.Duration.Milliseconds(),
				})
		} else {
			// Log step completion
			s.logEntry(ctx, result.SyncLogID, stepNumberPtr, models.LogLevelInfo,
				fmt.Sprintf("Step %s completed: %d extracted, %d inserted, %d updated, %d failed",
					step, stepResult.Extracted, stepResult.Inserted, stepResult.Updated, stepResult.Failed),
				map[string]interface{}{
					"step_name":   string(step),
					"step_number": stepNumber,
					"extracted":   stepResult.Extracted,
					"inserted":    stepResult.Inserted,
					"updated":     stepResult.Updated,
					"failed":      stepResult.Failed,
					"duration_ms": stepResult.Duration.Milliseconds(),
				})

			// Create final progress snapshot for step
			elapsedSec := int(stepResult.Duration.Seconds())
			throughput := calculateThroughput(stepResult.Extracted, elapsedSec)
			s.createProgressSnapshot(ctx, result.SyncLogID, stepNumber, string(step),
				stepResult.Extracted, stepResult.Extracted, elapsedSec, throughput)
		}

		// Update sync log with step progress
		if err := s.updateSyncProgress(ctx, result.SyncLogID, step, stepResult); err != nil {
			log.Printf("Warning: failed to update sync progress: %v", err)
		}

		result.TotalChanges += stepResult.Inserted + stepResult.Updated
	}

	result.Duration = time.Since(startTime)

	// Determine final sync log status
	status := "completed"

	// Check if sync was cancelled
	select {
	case <-ctx.Done():
		if ctx.Err() == context.Canceled {
			status = "cancelled"

			// Check if it was user-initiated cancellation via SyncManager
			if activeSync, exists := s.syncManager.GetActiveSync(result.SyncLogID); exists && activeSync.IsCancelled {
				cancelReason := activeSync.Reason
				if cancelReason == "" {
					cancelReason = "Sync cancelled by user"
				}
				result.Errors = append(result.Errors, cancelReason)
				log.Printf("Sync %s was cancelled: %s", result.SyncLogID, cancelReason)
			} else {
				result.Errors = append(result.Errors, "Sync cancelled")
			}
		}
	default:
		// Not cancelled, determine status based on errors
		if len(result.Errors) > 0 {
			status = "failed"
		}
	}

	// CRITICAL: Use retry logic to ensure sync status is updated
	// This prevents stuck syncs in "running" state
	if err := s.finalizeSyncLogWithRetry(ctx, result.SyncLogID, status, result); err != nil {
		log.Printf("ERROR: failed to finalize sync log after retries: %v", err)

		// Log fatal error
		s.logEntry(ctx, result.SyncLogID, nil, models.LogLevelFatal,
			fmt.Sprintf("Failed to finalize sync log: %v", err),
			map[string]interface{}{
				"error": err.Error(),
			})

		// Mark this as a fatal error - if we can't update the status, the sync is incomplete
		return nil, fmt.Errorf("sync completed but failed to update status: %w", err)
	}

	// Log sync completion
	if status == "completed" {
		s.logEntry(ctx, result.SyncLogID, nil, models.LogLevelInfo,
			fmt.Sprintf("Sync completed in %.2fs with %d total changes", result.Duration.Seconds(), result.TotalChanges),
			map[string]interface{}{
				"duration_seconds": result.Duration.Seconds(),
				"total_changes":    result.TotalChanges,
				"status":           status,
			})
	} else {
		s.logEntry(ctx, result.SyncLogID, nil, models.LogLevelError,
			fmt.Sprintf("Sync failed after %.2fs with %d errors", result.Duration.Seconds(), len(result.Errors)),
			map[string]interface{}{
				"duration_seconds": result.Duration.Seconds(),
				"total_errors":     len(result.Errors),
				"errors":           result.Errors,
				"status":           status,
			})
	}

	log.Printf("Selective sync completed in %v with %d total changes", result.Duration, result.TotalChanges)
	return result, nil
}

// validateConfiguration validates a sync configuration before execution
func (s *SelectiveSync) validateConfiguration(request *models.SelectiveSyncRequest) error {
	if len(request.SelectedSteps) == 0 {
		return fmt.Errorf("at least one sync step must be selected")
	}

	// Validate each step is valid
	validSteps := make(map[models.SyncStep]bool)
	for _, step := range models.AllSyncSteps() {
		validSteps[step] = true
	}

	for _, step := range request.SelectedSteps {
		if !validSteps[step] {
			return fmt.Errorf("invalid sync step: %s", step)
		}
	}

	// Validate field config references valid steps
	if request.FieldConfig != nil {
		for step, config := range request.FieldConfig {
			if !validSteps[step] {
				return fmt.Errorf("field config references invalid step: %s", step)
			}

			// Validate field names against schema
			schema := models.GetFieldSchemaByStep(step)
			if schema == nil {
				return fmt.Errorf("no field schema found for step: %s", step)
			}

			// Validate IncludeFields
			if err := validateFieldNamesAgainstSchema(config.IncludeFields, schema, "include"); err != nil {
				return fmt.Errorf("step %s: %w", step, err)
			}

			// Validate ExcludeFields
			if err := validateFieldNamesAgainstSchema(config.ExcludeFields, schema, "exclude"); err != nil {
				return fmt.Errorf("step %s: %w", step, err)
			}

			// Validate field dependencies
			if err := validateFieldDependencies(config, schema); err != nil {
				return fmt.Errorf("step %s: %w", step, err)
			}
		}
	}

	return nil
}

// validateFieldNamesAgainstSchema validates field names against the schema
func validateFieldNamesAgainstSchema(fieldNames []string, schema *models.SyncFieldSchema, configType string) error {
	if len(fieldNames) == 0 {
		return nil
	}

	// Build set of valid field names from schema
	validFields := make(map[string]bool)
	for _, field := range schema.Fields {
		validFields[field.Name] = true
	}

	// Check each field name
	for _, fieldName := range fieldNames {
		if !validFields[fieldName] {
			return fmt.Errorf("invalid field '%s' in %s fields (not found in schema)", fieldName, configType)
		}
	}

	return nil
}

// validateFieldDependencies validates that field dependencies are satisfied
func validateFieldDependencies(config models.FieldConfig, schema *models.SyncFieldSchema) error {
	// Build set of included fields
	includedFields := make(map[string]bool)
	if len(config.IncludeFields) > 0 {
		for _, f := range config.IncludeFields {
			includedFields[f] = true
		}
	} else {
		// If no include fields, all fields except excluded are included
		for _, field := range schema.Fields {
			if !isFieldExcluded(field.Name, config) {
				includedFields[field.Name] = true
			}
		}
	}

	// Check dependencies for each included field
	for _, field := range schema.Fields {
		if includedFields[field.Name] && len(field.Dependencies) > 0 {
			for _, dep := range field.Dependencies {
				if !includedFields[dep] {
					return fmt.Errorf("field '%s' requires dependency '%s' to be included", field.Name, dep)
				}
			}
		}
	}

	return nil
}

// isFieldExcluded checks if a field is in the exclude list
func isFieldExcluded(fieldName string, config models.FieldConfig) bool {
	for _, f := range config.ExcludeFields {
		if f == fieldName {
			return true
		}
	}
	return false
}

// createSyncLog creates a new sync log entry
func (s *SelectiveSync) createSyncLog(ctx context.Context, syncLogID uuid.UUID, request *models.SelectiveSyncRequest) (*models.SyncLog, error) {
	// Convert selected steps to string array
	steps := make([]string, len(request.SelectedSteps))
	for i, step := range request.SelectedSteps {
		steps[i] = string(step)
	}

	syncLog := &models.SyncLog{
		ID:        syncLogID,
		Status:    "running",
		SyncType:  "selective",
		StartedAt: time.Now(),
	}

	query := `
		INSERT INTO sync_logs (
			id, status, sync_type, started_at, selected_steps, field_config
		) VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id
	`

	err := s.repo.Pool().QueryRow(ctx, query,
		syncLog.ID,
		syncLog.Status,
		syncLog.SyncType,
		syncLog.StartedAt,
		steps,
		request.FieldConfig,
	).Scan(&syncLog.ID)

	if err != nil {
		return nil, fmt.Errorf("failed to create sync log: %w", err)
	}

	return syncLog, nil
}

// updateSyncProgress updates sync progress for a step
func (s *SelectiveSync) updateSyncProgress(ctx context.Context, syncLogID uuid.UUID, step models.SyncStep, stepResult *StepResult) error {
	// Update sync_step_details table with completed status and 100% progress
	query := `
		INSERT INTO sync_step_details (
			sync_log_id, step_number, step_name, status, progress_percentage,
			items_total, items_processed, extracted, inserted, updated, failed, completed_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
		ON CONFLICT (sync_log_id, step_number)
		DO UPDATE SET
			status = EXCLUDED.status,
			progress_percentage = EXCLUDED.progress_percentage,
			items_total = EXCLUDED.items_total,
			items_processed = EXCLUDED.items_processed,
			extracted = EXCLUDED.extracted,
			inserted = EXCLUDED.inserted,
			updated = EXCLUDED.updated,
			failed = EXCLUDED.failed,
			completed_at = EXCLUDED.completed_at,
			last_updated_at = NOW()
	`

	stepNumber := getStepNumber(step)
	totalItems := stepResult.Extracted
	_, err := s.repo.Pool().Exec(ctx, query,
		syncLogID,
		stepNumber,
		string(step),
		"completed",         // status
		100.0,              // progress_percentage
		totalItems,         // items_total
		totalItems,         // items_processed (all items are processed when step completes)
		stepResult.Extracted,
		stepResult.Inserted,
		stepResult.Updated,
		stepResult.Failed,
	)

	return err
}

// finalizeSyncLogWithRetry wraps finalizeSyncLog with retry logic to handle transient failures
// This is critical to prevent sync logs from being stuck in "running" state
func (s *SelectiveSync) finalizeSyncLogWithRetry(ctx context.Context, syncLogID uuid.UUID, status string, result *SyncResult) error {
	maxRetries := 3
	for attempt := 0; attempt < maxRetries; attempt++ {
		err := s.finalizeSyncLog(ctx, syncLogID, status, result)
		if err == nil {
			return nil
		}

		log.Printf("Attempt %d/%d to finalize sync log failed: %v", attempt+1, maxRetries, err)

		// Don't sleep on the last attempt
		if attempt < maxRetries-1 {
			// Exponential backoff: 1s, 2s
			time.Sleep(time.Duration(1<<attempt) * time.Second)
		}
	}

	return fmt.Errorf("failed to finalize sync log after %d attempts", maxRetries)
}

// finalizeSyncLog finalizes the sync log with completion status
func (s *SelectiveSync) finalizeSyncLog(ctx context.Context, syncLogID uuid.UUID, status string, result *SyncResult) error {
	// Calculate totals
	totalExtracted := 0
	totalInserted := 0
	totalUpdated := 0
	totalFailed := 0

	for _, stepResult := range result.StepResults {
		totalExtracted += stepResult.Extracted
		totalInserted += stepResult.Inserted
		totalUpdated += stepResult.Updated
		totalFailed += stepResult.Failed
	}

	// Build error message
	var errorMsg *string
	if len(result.Errors) > 0 {
		msg := fmt.Sprintf("Errors: %d steps failed", len(result.Errors))
		errorMsg = &msg
	}

	query := `
		UPDATE sync_logs
		SET
			status = $2,
			finished_at = $3,
			duration_seconds = $4,
			brands_synced = $5,
			brands_inserted = $6,
			brands_updated = $7,
			categories_synced = $8,
			categories_inserted = $9,
			categories_updated = $10,
			products_synced = $11,
			products_inserted = $12,
			products_updated = $13,
			error_message = $14
		WHERE id = $1
	`

	// Extract counts by step
	var brandsExtracted, brandsInserted, brandsUpdated int
	var categoriesExtracted, categoriesInserted, categoriesUpdated int
	var productsExtracted, productsInserted, productsUpdated int

	if stepResult, ok := result.StepResults[models.SyncStepBrands]; ok {
		brandsExtracted = stepResult.Extracted
		brandsInserted = stepResult.Inserted
		brandsUpdated = stepResult.Updated
	}
	if stepResult, ok := result.StepResults[models.SyncStepCategories]; ok {
		categoriesExtracted = stepResult.Extracted
		categoriesInserted = stepResult.Inserted
		categoriesUpdated = stepResult.Updated
	}
	if stepResult, ok := result.StepResults[models.SyncStepProducts]; ok {
		productsExtracted = stepResult.Extracted
		productsInserted = stepResult.Inserted
		productsUpdated = stepResult.Updated
	}

	_, err := s.repo.Pool().Exec(ctx, query,
		syncLogID,
		status,
		time.Now(),
		result.Duration.Seconds(),
		brandsExtracted,
		brandsInserted,
		brandsUpdated,
		categoriesExtracted,
		categoriesInserted,
		categoriesUpdated,
		productsExtracted,
		productsInserted,
		productsUpdated,
		errorMsg,
	)

	return err
}

// saveAsTemplate saves the request as a reusable template
func (s *SelectiveSync) saveAsTemplate(ctx context.Context, request *models.SelectiveSyncRequest) error {
	config := &models.SyncConfiguration{
		ID:            uuid.New(),
		Name:          request.TemplateName,
		Description:   request.TemplateDesc,
		SelectedSteps: request.SelectedSteps,
		FieldConfig:   request.FieldConfig,
		IsTemplate:    true,
	}

	return s.syncConfigRepo.SaveConfiguration(ctx, config)
}

// stepNumbers maps sync steps to their order numbers (O(1) lookup)
var stepNumbers = map[models.SyncStep]int{
	models.SyncStepBrands:        1,
	models.SyncStepCategories:    2,
	models.SyncStepProducts:      3,
	models.SyncStepProperties:    4,
	models.SyncStepPrices:        5,
	models.SyncStepStock:         6,
	models.SyncStepExchangeRates: 7,
}

// getStepNumber returns the step number for ordering (O(1) lookup)
func getStepNumber(step models.SyncStep) int {
	if num, ok := stepNumbers[step]; ok {
		return num
	}
	return 0
}

// processBrandsSelective processes brands with selective field syncing
func (s *SelectiveSync) processBrandsSelective(ctx context.Context, syncLogID uuid.UUID, request *models.SelectiveSyncRequest, result *StepResult) error {
	stepNumber := getStepNumber(models.SyncStepBrands)
	stepNumberPtr := &stepNumber
	stepStartTime := time.Now()

	// Fetch brands from Ultra API
	brands, err := s.fetcher.FetchBrands(ctx, true)
	if err != nil {
		return fmt.Errorf("failed to fetch brands: %w", err)
	}

	result.Extracted = len(brands)
	log.Printf("Fetched %d brands from Ultra API", len(brands))

	// Log fetch completion
	s.logEntry(ctx, syncLogID, stepNumberPtr, models.LogLevelInfo,
		fmt.Sprintf("Fetched %d brands from Ultra API", len(brands)),
		map[string]interface{}{
			"count": len(brands),
		})

	// Get field config for this step
	fieldConfig := models.FieldConfig{}
	if request.FieldConfig != nil {
		if config, ok := request.FieldConfig[models.SyncStepBrands]; ok {
			fieldConfig = config
		}
	}

	// Track all changes
	changes := make([]models.SyncChange, 0)

	// Process each brand
	for i, brand := range brands {
		// Check for context cancellation and log progress every 100 items
		if i%100 == 0 {
			select {
			case <-ctx.Done():
				return fmt.Errorf("sync cancelled: %w", ctx.Err())
			default:
				// Log progress
				if i > 0 {
					elapsedSec := int(time.Since(stepStartTime).Seconds())
					throughput := calculateThroughput(i, elapsedSec)
					s.logEntry(ctx, syncLogID, stepNumberPtr, models.LogLevelDebug,
						fmt.Sprintf("Processing brands: %d/%d (%.1f%%)", i, len(brands), float64(i)/float64(len(brands))*100),
						map[string]interface{}{
							"processed": i,
							"total":     len(brands),
						})
					s.createProgressSnapshot(ctx, syncLogID, stepNumber, string(models.SyncStepBrands),
						i, len(brands), elapsedSec, throughput)
				}
			}
		}

		// Check if brand exists
		existing, err := s.repo.GetBrandByUltraID(ctx, brand.UltraID)

		if err != nil || existing == nil {
			// Insert new brand (full insert, no selective fields)
			inserted, err := s.repo.UpsertBrands(ctx, []*models.BrandInput{brand})
			if err != nil {
				log.Printf("Failed to insert brand %s: %v", brand.UltraID, err)
				result.Failed++
				continue
			}

			if inserted > 0 {
				result.Inserted++

				// Get the newly inserted brand
				newBrand, err := s.repo.GetBrandByUltraID(ctx, brand.UltraID)
				if err == nil {
					// Record as insert change
					changes = append(changes, models.SyncChange{
						SyncLogID:     syncLogID,
						Step:          models.SyncStepBrands,
						EntityType:    "brand",
						EntityID:      newBrand.ID,
						EntityUltraID: brand.UltraID,
						ChangeType:    "insert",
						FieldsChanged: []models.FieldChange{
							{FieldName: "name", NewValue: brand.Name, WasNull: true},
						},
					})
				}
			}
		} else {
			// Update existing brand with selective fields
			updates := s.buildBrandUpdates(brand, fieldConfig)

			if len(updates) == 0 {
				result.Skipped++
				continue
			}

			fieldChanges, err := s.repo.UpdateBrandSelective(ctx, brand.UltraID, updates, fieldConfig)
			if err != nil {
				log.Printf("Failed to update brand %s: %v", brand.UltraID, err)
				result.Failed++
				continue
			}

			if len(fieldChanges) > 0 {
				result.Updated++

				// Record change
				changes = append(changes, models.SyncChange{
					SyncLogID:     syncLogID,
					Step:          models.SyncStepBrands,
					EntityType:    "brand",
					EntityID:      existing.ID,
					EntityUltraID: brand.UltraID,
					ChangeType:    "update",
					FieldsChanged: fieldChanges,
				})
			} else {
				result.Skipped++
			}
		}
	}

	// Batch record all changes (required for audit trail)
	if len(changes) > 0 {
		if err := s.syncConfigRepo.RecordChanges(ctx, changes); err != nil {
			return fmt.Errorf("failed to record brand changes for audit trail: %w", err)
		}
	}

	return nil
}

// buildBrandUpdates builds update map for brand based on field config
func (s *SelectiveSync) buildBrandUpdates(brand *models.BrandInput, config models.FieldConfig) map[string]interface{} {
	updates := make(map[string]interface{})

	// Helper to check if field should be included
	shouldInclude := func(fieldName string) bool {
		if len(config.IncludeFields) > 0 {
			for _, f := range config.IncludeFields {
				if f == fieldName {
					return true
				}
			}
			return false
		}

		for _, f := range config.ExcludeFields {
			if f == fieldName {
				return false
			}
		}
		return true
	}

	if shouldInclude("name") {
		updates["name"] = brand.Name
	}
	if shouldInclude("logo_url") && brand.LogoURL != nil {
		updates["logo_url"] = *brand.LogoURL
	}
	if shouldInclude("is_active") {
		updates["is_active"] = brand.IsActive
	}

	return updates
}

// processCategoriesSelective processes categories with selective field syncing
func (s *SelectiveSync) processCategoriesSelective(ctx context.Context, syncLogID uuid.UUID, request *models.SelectiveSyncRequest, result *StepResult) error {
	// Fetch categories from Ultra API
	categories, err := s.fetcher.FetchCategories(ctx, true)
	if err != nil {
		return fmt.Errorf("failed to fetch categories: %w", err)
	}

	result.Extracted = len(categories)
	log.Printf("Fetched %d categories from Ultra API", len(categories))

	// Get field config for this step
	fieldConfig := models.FieldConfig{}
	if request.FieldConfig != nil {
		if config, ok := request.FieldConfig[models.SyncStepCategories]; ok {
			fieldConfig = config
		}
	}

	// Track all changes
	changes := make([]models.SyncChange, 0)

	// Process each category
	for i, category := range categories {
		// Check for context cancellation
		if i%100 == 0 {
			select {
			case <-ctx.Done():
				return fmt.Errorf("sync cancelled: %w", ctx.Err())
			default:
				// Continue processing
			}
		}

		// Check if category exists
		existing, err := s.repo.GetCategoryByUltraID(ctx, category.UltraID)

		if err != nil || existing == nil {
			// Insert new category
			inserted, err := s.repo.UpsertCategories(ctx, []*models.CategoryInput{category})
			if err != nil {
				log.Printf("Failed to insert category %s: %v", category.UltraID, err)
				result.Failed++
				continue
			}

			if inserted > 0 {
				result.Inserted++

				// Get the newly inserted category
				newCategory, err := s.repo.GetCategoryByUltraID(ctx, category.UltraID)
				if err == nil {
					changes = append(changes, models.SyncChange{
						SyncLogID:     syncLogID,
						Step:          models.SyncStepCategories,
						EntityType:    "category",
						EntityID:      newCategory.ID,
						EntityUltraID: category.UltraID,
						ChangeType:    "insert",
						FieldsChanged: []models.FieldChange{
							{FieldName: "name", NewValue: category.Name, WasNull: true},
						},
					})
				}
			}
		} else {
			// Update existing category with selective fields
			updates := s.buildCategoryUpdates(category, fieldConfig)

			if len(updates) == 0 {
				result.Skipped++
				continue
			}

			fieldChanges, err := s.repo.UpdateCategorySelective(ctx, category.UltraID, updates, fieldConfig)
			if err != nil {
				log.Printf("Failed to update category %s: %v", category.UltraID, err)
				result.Failed++
				continue
			}

			if len(fieldChanges) > 0 {
				result.Updated++

				changes = append(changes, models.SyncChange{
					SyncLogID:     syncLogID,
					Step:          models.SyncStepCategories,
					EntityType:    "category",
					EntityID:      existing.ID,
					EntityUltraID: category.UltraID,
					ChangeType:    "update",
					FieldsChanged: fieldChanges,
				})
			} else {
				result.Skipped++
			}
		}
	}

	// Batch record all changes (required for audit trail)
	if len(changes) > 0 {
		if err := s.syncConfigRepo.RecordChanges(ctx, changes); err != nil {
			return fmt.Errorf("failed to record category changes for audit trail: %w", err)
		}
	}

	return nil
}

// buildCategoryUpdates builds update map for category based on field config
func (s *SelectiveSync) buildCategoryUpdates(category *models.CategoryInput, config models.FieldConfig) map[string]interface{} {
	updates := make(map[string]interface{})

	shouldInclude := func(fieldName string) bool {
		if len(config.IncludeFields) > 0 {
			for _, f := range config.IncludeFields {
				if f == fieldName {
					return true
				}
			}
			return false
		}

		for _, f := range config.ExcludeFields {
			if f == fieldName {
				return false
			}
		}
		return true
	}

	if shouldInclude("name") {
		updates["name"] = category.Name
	}
	if shouldInclude("parent_ultra_id") && category.ParentUltraID != nil {
		updates["parent_ultra_id"] = *category.ParentUltraID
	}
	if shouldInclude("sort_order") {
		updates["sort_order"] = category.SortOrder
	}
	if shouldInclude("image_url") && category.ImageURL != nil {
		updates["image_url"] = *category.ImageURL
	}
	if shouldInclude("is_active") {
		updates["is_active"] = category.IsActive
	}

	return updates
}

// processProductsSelective processes products with selective field syncing
func (s *SelectiveSync) processProductsSelective(ctx context.Context, syncLogID uuid.UUID, request *models.SelectiveSyncRequest, result *StepResult) error {
	stepNumber := getStepNumber(models.SyncStepProducts)
	stepNumberPtr := &stepNumber
	stepStartTime := time.Now()

	// Get the default source ID (Ultra) for synced products
	ultraSource, err := s.sourceRepo.GetDefaultSource(ctx)
	if err != nil {
		log.Printf("Warning: Could not get Ultra source ID: %v. Products will be synced without source.", err)
	}
	var ultraSourceID *uuid.UUID
	if ultraSource != nil {
		ultraSourceID = &ultraSource.ID
	}

	// Fetch products from Ultra API
	products, characteristics, err := s.fetcher.FetchProducts(ctx, true)
	if err != nil {
		return fmt.Errorf("failed to fetch products: %w", err)
	}

	// Set source_id for all products being synced
	for _, product := range products {
		product.SourceID = ultraSourceID
	}

	result.Extracted = len(products)
	log.Printf("Fetched %d products from Ultra API", len(products))

	// Log fetch completion
	s.logEntry(ctx, syncLogID, stepNumberPtr, models.LogLevelInfo,
		fmt.Sprintf("Fetched %d products from Ultra API", len(products)),
		map[string]interface{}{
			"count": len(products),
		})

	// Get field config for this step
	fieldConfig := models.FieldConfig{}
	if request.FieldConfig != nil {
		if config, ok := request.FieldConfig[models.SyncStepProducts]; ok {
			fieldConfig = config
		}
	}

	// Track all changes
	changes := make([]models.SyncChange, 0)

	// Process each product
	for i, product := range products {
		// Check for context cancellation and log progress every 100 products
		if i%100 == 0 {
			select {
			case <-ctx.Done():
				return fmt.Errorf("sync cancelled: %w", ctx.Err())
			default:
				// Log progress
				if i > 0 {
					elapsedSec := int(time.Since(stepStartTime).Seconds())
					throughput := calculateThroughput(i, elapsedSec)
					s.logEntry(ctx, syncLogID, stepNumberPtr, models.LogLevelDebug,
						fmt.Sprintf("Processing products: %d/%d (%.1f%%)", i, len(products), float64(i)/float64(len(products))*100),
						map[string]interface{}{
							"processed": i,
							"total":     len(products),
						})
					s.createProgressSnapshot(ctx, syncLogID, stepNumber, string(models.SyncStepProducts),
						i, len(products), elapsedSec, throughput)
				}
			}
		}

		// Check if product exists
		existing, err := s.repo.GetProductByUltraID(ctx, product.UltraID)

		if err != nil || existing == nil {
			// Insert new product
			inserted, err := s.repo.UpsertProducts(ctx, []*models.ProductInput{product})
			if err != nil {
				log.Printf("Failed to insert product %s: %v", product.UltraID, err)
				result.Failed++
				continue
			}

			if inserted > 0 {
				result.Inserted++

				// Get the newly inserted product
				newProduct, err := s.repo.GetProductByUltraID(ctx, product.UltraID)
				if err == nil {
					changes = append(changes, models.SyncChange{
						SyncLogID:     syncLogID,
						Step:          models.SyncStepProducts,
						EntityType:    "product",
						EntityID:      newProduct.ID,
						EntityUltraID: product.UltraID,
						ChangeType:    "insert",
						FieldsChanged: []models.FieldChange{
							{FieldName: "name", NewValue: product.Name, WasNull: true},
						},
					})
				}

				// Insert characteristics if they exist
				if chars, ok := characteristics[product.UltraID]; ok && len(chars) > 0 {
					if _, err := s.repo.UpsertCharacteristics(ctx, product.UltraID, chars); err != nil {
						log.Printf("Failed to insert characteristics for product %s: %v", product.UltraID, err)
					}
				}
			}
		} else {
			// Update existing product with selective fields
			updates := s.buildProductUpdates(product, fieldConfig)

			if len(updates) == 0 {
				result.Skipped++
				continue
			}

			fieldChanges, err := s.repo.UpdateProductSelective(ctx, product.UltraID, updates, fieldConfig)
			if err != nil {
				log.Printf("Failed to update product %s: %v", product.UltraID, err)
				result.Failed++
				continue
			}

			if len(fieldChanges) > 0 {
				result.Updated++

				changes = append(changes, models.SyncChange{
					SyncLogID:     syncLogID,
					Step:          models.SyncStepProducts,
					EntityType:    "product",
					EntityID:      existing.ID,
					EntityUltraID: product.UltraID,
					ChangeType:    "update",
					FieldsChanged: fieldChanges,
				})
			} else {
				result.Skipped++
			}
		}
	}

	// Batch record all changes (required for audit trail)
	if len(changes) > 0 {
		if err := s.syncConfigRepo.RecordChanges(ctx, changes); err != nil {
			return fmt.Errorf("failed to record product changes for audit trail: %w", err)
		}
	}

	// Resolve brand_id, category_id, parent_id from ultra_id references
	if err := s.repo.ResolveProductReferences(ctx); err != nil {
		log.Printf("Warning: failed to resolve product references: %v", err)
		// Don't fail the sync, just log the warning
	}

	return nil
}

// buildProductUpdates builds update map for product based on field config
func (s *SelectiveSync) buildProductUpdates(product *models.ProductInput, config models.FieldConfig) map[string]interface{} {
	updates := make(map[string]interface{})

	shouldInclude := func(fieldName string) bool {
		if len(config.IncludeFields) > 0 {
			for _, f := range config.IncludeFields {
				if f == fieldName {
					return true
				}
			}
			return false
		}

		for _, f := range config.ExcludeFields {
			if f == fieldName {
				return false
			}
		}
		return true
	}

	if shouldInclude("name") {
		updates["name"] = product.Name
	}
	if shouldInclude("code") && product.Code != nil {
		updates["code"] = *product.Code
	}
	if shouldInclude("article") && product.Article != nil {
		updates["article"] = *product.Article
	}
	if shouldInclude("description") && product.Description != nil {
		updates["description"] = *product.Description
	}
	if shouldInclude("brand_ultra_id") && product.BrandUltraID != nil {
		updates["brand_ultra_id"] = *product.BrandUltraID
	}
	if shouldInclude("category_ultra_id") && product.CategoryUltraID != nil {
		updates["category_ultra_id"] = *product.CategoryUltraID
	}
	if shouldInclude("parent_ultra_id") && product.ParentUltraID != nil {
		updates["parent_ultra_id"] = *product.ParentUltraID
	}
	if shouldInclude("main_image_url") && product.MainImageURL != nil {
		updates["main_image_url"] = *product.MainImageURL
	}
	if shouldInclude("images") && len(product.Images) > 0 {
		updates["images"] = product.Images
	}
	if shouldInclude("warranty") && product.Warranty != nil {
		updates["warranty"] = *product.Warranty
	}
	if shouldInclude("barcodes") && len(product.Barcodes) > 0 {
		updates["barcodes"] = product.Barcodes
	}
	if shouldInclude("is_active") {
		updates["is_active"] = product.IsActive
	}
	if shouldInclude("is_service") {
		updates["is_service"] = product.IsService
	}

	return updates
}

// processPropertiesSelective processes properties with selective field syncing
func (s *SelectiveSync) processPropertiesSelective(ctx context.Context, syncLogID uuid.UUID, request *models.SelectiveSyncRequest, result *StepResult) error {
	stepNumber := getStepNumber(models.SyncStepProperties)
	stepNumberPtr := &stepNumber
	stepStartTime := time.Now()

	// Properties are fetched per category
	// Get all active categories
	categories, err := s.repo.GetAllCategories(ctx)
	if err != nil {
		return fmt.Errorf("failed to get categories: %w", err)
	}

	log.Printf("Fetching properties for %d categories", len(categories))

	// Log start
	s.logEntry(ctx, syncLogID, stepNumberPtr, models.LogLevelInfo,
		fmt.Sprintf("Fetching properties for %d categories", len(categories)),
		map[string]interface{}{
			"category_count": len(categories),
		})

	totalExtracted := 0
	totalInserted := 0
	totalUpdated := 0
	failedCategories := make([]string, 0)

	// Process each category
	for i, category := range categories {
		// Check for context cancellation (critical for long-running operations)
		select {
		case <-ctx.Done():
			return fmt.Errorf("sync cancelled: %w", ctx.Err())
		default:
			// Continue processing
		}

		if i%10 == 0 {
			log.Printf("Processing properties for category %d/%d", i+1, len(categories))

			// Log progress
			if i > 0 {
				elapsedSec := int(time.Since(stepStartTime).Seconds())
				throughput := calculateThroughput(i, elapsedSec)
				s.logEntry(ctx, syncLogID, stepNumberPtr, models.LogLevelDebug,
					fmt.Sprintf("Processing properties for category %d/%d (%.1f%%)", i+1, len(categories), float64(i)/float64(len(categories))*100),
					map[string]interface{}{
						"processed": i,
						"total":     len(categories),
					})
				s.createProgressSnapshot(ctx, syncLogID, stepNumber, string(models.SyncStepProperties),
					i, len(categories), elapsedSec, throughput)
			}
		}

		// Fetch properties for this category (returns map[productUltraID][]*PropertyInput)
		productProperties, err := s.fetcher.FetchPropertiesForCategory(ctx, category.UltraID)
		if err != nil {
			log.Printf("Failed to fetch properties for category %s: %v", category.UltraID, err)
			failedCategories = append(failedCategories, category.UltraID)
			result.Failed++
			continue
		}

		// Process properties per product
		for productUltraID, props := range productProperties {
			totalExtracted += len(props)

			if len(props) > 0 {
				// Upsert properties (full insert/update for now)
				inserted, err := s.repo.UpsertProperties(ctx, productUltraID, props)
				if err != nil {
					log.Printf("Failed to upsert properties for product %s: %v", productUltraID, err)
					result.Failed++
					continue
				}
				totalInserted += inserted
				// Note: UpsertProperties returns (int, error) not (int, int, error)
				// The int is the number of properties inserted/updated
			}
		}
	}

	result.Extracted = totalExtracted
	result.Inserted = totalInserted
	result.Updated = totalUpdated

	if len(failedCategories) > 0 {
		log.Printf("WARNING: %d categories failed to sync properties: %v", len(failedCategories), failedCategories)
	}

	log.Printf("Properties sync: %d extracted, %d inserted, %d updated", totalExtracted, totalInserted, totalUpdated)

	return nil
}

// processPricesSelective processes prices with selective field syncing
func (s *SelectiveSync) processPricesSelective(ctx context.Context, syncLogID uuid.UUID, request *models.SelectiveSyncRequest, result *StepResult) error {
	// Fetch prices from Ultra API
	prices, err := s.fetcher.FetchPrices(ctx, true)
	if err != nil {
		return fmt.Errorf("failed to fetch prices: %w", err)
	}

	result.Extracted = len(prices)
	log.Printf("Fetched %d prices from Ultra API", len(prices))

	// Update characteristic prices
	updated, err := s.repo.UpdateCharacteristicPrices(ctx, prices)
	if err != nil {
		return fmt.Errorf("failed to update characteristic prices: %w", err)
	}

	result.Updated = updated

	// Extract multi-currency prices to product-level columns
	if err := s.repo.UpdateProductPricesFromJSONB(ctx); err != nil {
		log.Printf("Warning: failed to extract multi-currency prices: %v", err)
	}

	// Update product aggregates
	if err := s.repo.UpdateProductAggregates(ctx); err != nil {
		log.Printf("Warning: failed to update product aggregates: %v", err)
	}

	log.Printf("Prices sync: %d updated", updated)

	return nil
}

// processStockSelective processes stock with selective field syncing
func (s *SelectiveSync) processStockSelective(ctx context.Context, syncLogID uuid.UUID, request *models.SelectiveSyncRequest, result *StepResult) error {
	// Fetch stock from Ultra API
	stocks, err := s.fetcher.FetchStock(ctx, true)
	if err != nil {
		return fmt.Errorf("failed to fetch stock: %w", err)
	}

	result.Extracted = len(stocks)
	log.Printf("Fetched %d stock records from Ultra API", len(stocks))

	// Update characteristic stock
	updated, err := s.repo.UpdateCharacteristicStock(ctx, stocks)
	if err != nil {
		return fmt.Errorf("failed to update characteristic stock: %w", err)
	}

	result.Updated = updated

	// Update product aggregates (includes stock aggregation)
	if err := s.repo.UpdateProductAggregates(ctx); err != nil {
		log.Printf("Warning: failed to update product aggregates: %v", err)
	}

	log.Printf("Stock sync: %d updated", updated)

	return nil
}

// processExchangeRatesSelective processes exchange rates
func (s *SelectiveSync) processExchangeRatesSelective(ctx context.Context, syncLogID uuid.UUID, request *models.SelectiveSyncRequest, result *StepResult) error {
	// Fetch exchange rates from Ultra API
	rates, err := s.fetcher.FetchRates(ctx)
	if err != nil {
		return fmt.Errorf("failed to fetch exchange rates: %w", err)
	}

	result.Extracted = len(rates)
	log.Printf("Fetched %d exchange rates from Ultra API", len(rates))

	// Upsert exchange rates
	err = s.repo.UpsertExchangeRates(ctx, rates)
	if err != nil {
		return fmt.Errorf("failed to upsert exchange rates: %w", err)
	}

	result.Inserted = len(rates)

	log.Printf("Exchange rates sync: %d upserted", len(rates))

	return nil
}

// ============================================================================
// REAL-TIME LOGGING HELPERS
// ============================================================================

// logEntry creates a log entry for real-time monitoring
// Gracefully handles errors to prevent logging failures from disrupting sync
func (s *SelectiveSync) logEntry(ctx context.Context, syncLogID uuid.UUID, stepNumber *int, level models.LogLevel, message string, details map[string]interface{}) {
	entry := &models.SyncLogEntry{
		SyncLogID:  syncLogID,
		StepNumber: stepNumber,
		Level:      level,
		Message:    message,
		Details:    details,
	}

	// Use background context to ensure logging completes even if main context is cancelled
	logCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := s.realtimeRepo.CreateLogEntry(logCtx, entry); err != nil {
		// Log error but don't fail the sync
		log.Printf("WARNING: Failed to create log entry: %v", err)
	}
}

// createProgressSnapshot creates a progress snapshot for a step
func (s *SelectiveSync) createProgressSnapshot(ctx context.Context, syncLogID uuid.UUID, stepNumber int, stepName string, itemsProcessed, itemsTotal int, elapsedSeconds int, throughputItemsPerSec *float64) {
	progressPercentage := 0.0
	if itemsTotal > 0 {
		progressPercentage = (float64(itemsProcessed) / float64(itemsTotal)) * 100.0
	}

	// Calculate estimated remaining time
	var estimatedRemaining *int
	if itemsProcessed > 0 && itemsTotal > 0 && itemsProcessed < itemsTotal {
		if throughputItemsPerSec != nil && *throughputItemsPerSec > 0 {
			remaining := int((float64(itemsTotal-itemsProcessed) / *throughputItemsPerSec))
			estimatedRemaining = &remaining
		}
	}

	// Get memory usage
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)
	memoryUsageMB := float64(memStats.Alloc) / 1024 / 1024

	snapshot := &models.SyncProgressSnapshot{
		SyncLogID:                 syncLogID,
		StepNumber:                stepNumber,
		StepName:                  stepName,
		ItemsProcessed:            itemsProcessed,
		ItemsTotal:                itemsTotal,
		ProgressPercentage:        progressPercentage,
		ElapsedSeconds:            elapsedSeconds,
		EstimatedRemainingSeconds: estimatedRemaining,
		ThroughputItemsPerSecond:  throughputItemsPerSec,
		MemoryUsageMB:             &memoryUsageMB,
	}

	// Use background context to ensure logging completes even if main context is cancelled
	logCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := s.realtimeRepo.CreateProgressSnapshot(logCtx, snapshot); err != nil {
		// Log error but don't fail the sync
		log.Printf("WARNING: Failed to create progress snapshot: %v", err)
	}
}

// calculateThroughput calculates items per second throughput
func calculateThroughput(itemsProcessed int, elapsedSeconds int) *float64 {
	if elapsedSeconds > 0 && itemsProcessed > 0 {
		throughput := float64(itemsProcessed) / float64(elapsedSeconds)
		return &throughput
	}
	return nil
}
