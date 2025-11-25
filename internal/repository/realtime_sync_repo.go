package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"ultra-api-testing/internal/models"
)

// RealtimeSyncRepository handles database operations for real-time sync monitoring
type RealtimeSyncRepository struct {
	pool *pgxpool.Pool
}

// NewRealtimeSyncRepository creates a new real-time sync repository
func NewRealtimeSyncRepository(pool *pgxpool.Pool) *RealtimeSyncRepository {
	return &RealtimeSyncRepository{
		pool: pool,
	}
}

// ============================================================================
// LOG ENTRIES
// ============================================================================

// CreateLogEntry creates a new sync log entry
func (r *RealtimeSyncRepository) CreateLogEntry(ctx context.Context, entry *models.SyncLogEntry) error {
	// Generate UUID if not set
	if entry.ID == uuid.Nil {
		entry.ID = uuid.New()
	}

	// Set timestamps
	now := time.Now()
	if entry.Timestamp.IsZero() {
		entry.Timestamp = now
	}
	if entry.CreatedAt.IsZero() {
		entry.CreatedAt = now
	}

	// Marshal details
	detailsJSON, err := json.Marshal(entry.Details)
	if err != nil {
		return fmt.Errorf("failed to marshal details: %w", err)
	}

	query := `
		INSERT INTO sync_log_entries (
			id, sync_log_id, step_number, level, message, details, timestamp, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, timestamp, created_at
	`

	err = r.pool.QueryRow(ctx, query,
		entry.ID,
		entry.SyncLogID,
		entry.StepNumber,
		string(entry.Level),
		entry.Message,
		detailsJSON,
		entry.Timestamp,
		entry.CreatedAt,
	).Scan(&entry.ID, &entry.Timestamp, &entry.CreatedAt)

	if err != nil {
		return fmt.Errorf("failed to create log entry: %w", err)
	}

	return nil
}

// GetLogEntries retrieves log entries with filtering and pagination
func (r *RealtimeSyncRepository) GetLogEntries(ctx context.Context, filter *models.LogEntryFilter) (*models.LogEntriesResponse, error) {
	// Build WHERE clause
	whereClauses := []string{"sync_log_id = $1"}
	args := []interface{}{filter.SyncLogID}
	argCounter := 2

	// Filter by levels
	if len(filter.Levels) > 0 {
		levels := make([]string, len(filter.Levels))
		for i, level := range filter.Levels {
			levels[i] = string(level)
		}
		whereClauses = append(whereClauses, fmt.Sprintf("level = ANY($%d)", argCounter))
		args = append(args, levels)
		argCounter++
	}

	// Filter by step numbers
	if len(filter.StepNumbers) > 0 {
		whereClauses = append(whereClauses, fmt.Sprintf("step_number = ANY($%d)", argCounter))
		args = append(args, filter.StepNumbers)
		argCounter++
	}

	// Filter by search query
	if filter.SearchQuery != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("message ILIKE $%d", argCounter))
		args = append(args, "%"+filter.SearchQuery+"%")
		argCounter++
	}

	// Filter by time range
	if filter.StartTime != nil {
		whereClauses = append(whereClauses, fmt.Sprintf("timestamp >= $%d", argCounter))
		args = append(args, *filter.StartTime)
		argCounter++
	}
	if filter.EndTime != nil {
		whereClauses = append(whereClauses, fmt.Sprintf("timestamp <= $%d", argCounter))
		args = append(args, *filter.EndTime)
		argCounter++
	}

	whereClause := strings.Join(whereClauses, " AND ")

	// Get total count
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM sync_log_entries WHERE %s", whereClause)
	var total int
	err := r.pool.QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, fmt.Errorf("failed to count log entries: %w", err)
	}

	// Get log entries
	listQuery := fmt.Sprintf(`
		SELECT
			id, sync_log_id, step_number, level, message, details, timestamp, created_at
		FROM sync_log_entries
		WHERE %s
		ORDER BY timestamp DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argCounter, argCounter+1)

	args = append(args, filter.Limit, filter.Offset)

	rows, err := r.pool.Query(ctx, listQuery, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to get log entries: %w", err)
	}
	defer rows.Close()

	entries := make([]models.SyncLogEntry, 0)

	for rows.Next() {
		var entry models.SyncLogEntry
		var detailsJSON []byte
		var level string
		var stepNumber *int

		err := rows.Scan(
			&entry.ID,
			&entry.SyncLogID,
			&stepNumber,
			&level,
			&entry.Message,
			&detailsJSON,
			&entry.Timestamp,
			&entry.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan log entry: %w", err)
		}

		entry.Level = models.LogLevel(level)
		entry.StepNumber = stepNumber

		// Parse details
		if len(detailsJSON) > 0 {
			if err := json.Unmarshal(detailsJSON, &entry.Details); err != nil {
				return nil, fmt.Errorf("failed to unmarshal details: %w", err)
			}
		}

		entries = append(entries, entry)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating log entries: %w", err)
	}

	return &models.LogEntriesResponse{
		Data:   entries,
		Total:  total,
		Limit:  filter.Limit,
		Offset: filter.Offset,
	}, nil
}

// ============================================================================
// PROGRESS SNAPSHOTS
// ============================================================================

// CreateProgressSnapshot creates a progress snapshot
func (r *RealtimeSyncRepository) CreateProgressSnapshot(ctx context.Context, snapshot *models.SyncProgressSnapshot) error {
	// Generate UUID if not set
	if snapshot.ID == uuid.Nil {
		snapshot.ID = uuid.New()
	}

	if snapshot.CreatedAt.IsZero() {
		snapshot.CreatedAt = time.Now()
	}

	query := `
		INSERT INTO sync_progress_snapshots (
			id, sync_log_id, step_number, step_name, items_processed, items_total,
			progress_percentage, elapsed_seconds, estimated_remaining_seconds,
			throughput_items_per_second, memory_usage_mb, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING id, created_at
	`

	err := r.pool.QueryRow(ctx, query,
		snapshot.ID,
		snapshot.SyncLogID,
		snapshot.StepNumber,
		snapshot.StepName,
		snapshot.ItemsProcessed,
		snapshot.ItemsTotal,
		snapshot.ProgressPercentage,
		snapshot.ElapsedSeconds,
		snapshot.EstimatedRemainingSeconds,
		snapshot.ThroughputItemsPerSecond,
		snapshot.MemoryUsageMB,
		snapshot.CreatedAt,
	).Scan(&snapshot.ID, &snapshot.CreatedAt)

	if err != nil {
		return fmt.Errorf("failed to create progress snapshot: %w", err)
	}

	return nil
}

// GetProgressSnapshots retrieves progress snapshots for a sync log
func (r *RealtimeSyncRepository) GetProgressSnapshots(ctx context.Context, syncLogID uuid.UUID, limit, offset int) (*models.ProgressSnapshotsResponse, error) {
	// Get total count
	countQuery := "SELECT COUNT(*) FROM sync_progress_snapshots WHERE sync_log_id = $1"
	var total int
	err := r.pool.QueryRow(ctx, countQuery, syncLogID).Scan(&total)
	if err != nil {
		return nil, fmt.Errorf("failed to count progress snapshots: %w", err)
	}

	// Get snapshots
	query := `
		SELECT
			id, sync_log_id, step_number, step_name, items_processed, items_total,
			progress_percentage, elapsed_seconds, estimated_remaining_seconds,
			throughput_items_per_second, memory_usage_mb, created_at
		FROM sync_progress_snapshots
		WHERE sync_log_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.pool.Query(ctx, query, syncLogID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get progress snapshots: %w", err)
	}
	defer rows.Close()

	snapshots := make([]models.SyncProgressSnapshot, 0)

	for rows.Next() {
		var snapshot models.SyncProgressSnapshot

		err := rows.Scan(
			&snapshot.ID,
			&snapshot.SyncLogID,
			&snapshot.StepNumber,
			&snapshot.StepName,
			&snapshot.ItemsProcessed,
			&snapshot.ItemsTotal,
			&snapshot.ProgressPercentage,
			&snapshot.ElapsedSeconds,
			&snapshot.EstimatedRemainingSeconds,
			&snapshot.ThroughputItemsPerSecond,
			&snapshot.MemoryUsageMB,
			&snapshot.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan progress snapshot: %w", err)
		}

		snapshots = append(snapshots, snapshot)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating progress snapshots: %w", err)
	}

	return &models.ProgressSnapshotsResponse{
		Data:   snapshots,
		Total:  total,
		Limit:  limit,
		Offset: offset,
	}, nil
}

// ============================================================================
// API REQUESTS
// ============================================================================

// CreateAPIRequest logs an API request/response
func (r *RealtimeSyncRepository) CreateAPIRequest(ctx context.Context, request *models.SyncAPIRequest) error {
	// Generate UUID if not set
	if request.ID == uuid.Nil {
		request.ID = uuid.New()
	}

	if request.CreatedAt.IsZero() {
		request.CreatedAt = time.Now()
	}

	// Marshal headers
	requestHeadersJSON, err := json.Marshal(request.RequestHeaders)
	if err != nil {
		return fmt.Errorf("failed to marshal request headers: %w", err)
	}

	responseHeadersJSON, err := json.Marshal(request.ResponseHeaders)
	if err != nil {
		return fmt.Errorf("failed to marshal response headers: %w", err)
	}

	query := `
		INSERT INTO sync_api_requests (
			id, sync_log_id, step_number, method, url, request_headers, request_body,
			response_status, response_headers, response_body, duration_ms, error_message, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		RETURNING id, created_at
	`

	err = r.pool.QueryRow(ctx, query,
		request.ID,
		request.SyncLogID,
		request.StepNumber,
		request.Method,
		request.URL,
		requestHeadersJSON,
		request.RequestBody,
		request.ResponseStatus,
		responseHeadersJSON,
		request.ResponseBody,
		request.DurationMs,
		request.ErrorMessage,
		request.CreatedAt,
	).Scan(&request.ID, &request.CreatedAt)

	if err != nil {
		return fmt.Errorf("failed to create API request log: %w", err)
	}

	return nil
}

// GetAPIRequests retrieves API request logs for a sync log
func (r *RealtimeSyncRepository) GetAPIRequests(ctx context.Context, syncLogID uuid.UUID, limit, offset int) (*models.APIRequestsResponse, error) {
	// Get total count
	countQuery := "SELECT COUNT(*) FROM sync_api_requests WHERE sync_log_id = $1"
	var total int
	err := r.pool.QueryRow(ctx, countQuery, syncLogID).Scan(&total)
	if err != nil {
		return nil, fmt.Errorf("failed to count API requests: %w", err)
	}

	// Get requests
	query := `
		SELECT
			id, sync_log_id, step_number, method, url, request_headers, request_body,
			response_status, response_headers, response_body, duration_ms, error_message, created_at
		FROM sync_api_requests
		WHERE sync_log_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.pool.Query(ctx, query, syncLogID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get API requests: %w", err)
	}
	defer rows.Close()

	requests := make([]models.SyncAPIRequest, 0)

	for rows.Next() {
		var request models.SyncAPIRequest
		var requestHeadersJSON, responseHeadersJSON []byte

		err := rows.Scan(
			&request.ID,
			&request.SyncLogID,
			&request.StepNumber,
			&request.Method,
			&request.URL,
			&requestHeadersJSON,
			&request.RequestBody,
			&request.ResponseStatus,
			&responseHeadersJSON,
			&request.ResponseBody,
			&request.DurationMs,
			&request.ErrorMessage,
			&request.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan API request: %w", err)
		}

		// Parse headers
		if len(requestHeadersJSON) > 0 {
			if err := json.Unmarshal(requestHeadersJSON, &request.RequestHeaders); err != nil {
				return nil, fmt.Errorf("failed to unmarshal request headers: %w", err)
			}
		}
		if len(responseHeadersJSON) > 0 {
			if err := json.Unmarshal(responseHeadersJSON, &request.ResponseHeaders); err != nil {
				return nil, fmt.Errorf("failed to unmarshal response headers: %w", err)
			}
		}

		requests = append(requests, request)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating API requests: %w", err)
	}

	return &models.APIRequestsResponse{
		Data:   requests,
		Total:  total,
		Limit:  limit,
		Offset: offset,
	}, nil
}

// ============================================================================
// STEP UPDATES
// ============================================================================

// UpdateStepProgress updates real-time progress for a sync step
func (r *RealtimeSyncRepository) UpdateStepProgress(ctx context.Context, syncLogID uuid.UUID, stepNumber int, itemsProcessed, itemsTotal int) error {
	// Calculate progress percentage
	progressPercentage := 0.0
	if itemsTotal > 0 {
		progressPercentage = (float64(itemsProcessed) / float64(itemsTotal)) * 100.0
	}

	query := `
		UPDATE sync_step_details
		SET
			items_processed = $3,
			items_total = $4,
			progress_percentage = $5,
			last_updated_at = NOW()
		WHERE sync_log_id = $1 AND step_number = $2
	`

	_, err := r.pool.Exec(ctx, query,
		syncLogID,
		stepNumber,
		itemsProcessed,
		itemsTotal,
		progressPercentage,
	)

	if err != nil {
		return fmt.Errorf("failed to update step progress: %w", err)
	}

	return nil
}

// ============================================================================
// REALTIME PROGRESS
// ============================================================================

// GetRealtimeProgress retrieves the current sync progress for SSE streaming
func (r *RealtimeSyncRepository) GetRealtimeProgress(ctx context.Context, syncLogID uuid.UUID) (*models.RealtimeSyncProgress, error) {
	// Get sync log
	syncLogQuery := `
		SELECT
			id, status, sync_type, started_at, finished_at, duration_seconds,
			selected_steps, error_message,
			brands_synced, brands_inserted, brands_updated,
			categories_synced, categories_inserted, categories_updated,
			products_synced, products_inserted, products_updated,
			properties_synced, properties_inserted, properties_updated
		FROM sync_logs
		WHERE id = $1
	`

	var progress models.RealtimeSyncProgress
	var selectedSteps []string
	var finishedAt *time.Time
	var errorMessage *string
	var durationSeconds *int

	err := r.pool.QueryRow(ctx, syncLogQuery, syncLogID).Scan(
		&progress.SyncLogID,
		&progress.Status,
		&progress.SyncType,
		&progress.StartedAt,
		&finishedAt,
		&durationSeconds,
		&selectedSteps,
		&errorMessage,
		&progress.Statistics.BrandsSynced,
		&progress.Statistics.BrandsInserted,
		&progress.Statistics.BrandsUpdated,
		&progress.Statistics.CategoriesSynced,
		&progress.Statistics.CategoriesInserted,
		&progress.Statistics.CategoriesUpdated,
		&progress.Statistics.ProductsSynced,
		&progress.Statistics.ProductsInserted,
		&progress.Statistics.ProductsUpdated,
		&progress.Statistics.PropertiesSynced,
		&progress.Statistics.PropertiesInserted,
		&progress.Statistics.PropertiesUpdated,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("sync log not found: %s", syncLogID)
		}
		return nil, fmt.Errorf("failed to get sync log: %w", err)
	}

	progress.IsRunning = progress.Status == "running"
	progress.FinishedAt = finishedAt
	progress.ErrorMessage = errorMessage
	progress.SelectedSteps = selectedSteps

	// Calculate elapsed time - use duration_seconds if sync is finished, otherwise calculate from start time
	var elapsed int
	if !progress.IsRunning && durationSeconds != nil {
		elapsed = *durationSeconds
	} else {
		elapsed = int(time.Since(progress.StartedAt).Seconds())
	}
	progress.ElapsedSeconds = elapsed

	// Get step details
	stepsQuery := `
		SELECT
			step_number, step_name, status, items_processed, items_total,
			progress_percentage, extracted, inserted, updated, failed,
			throughput_items_per_second, started_at, completed_at, last_updated_at
		FROM sync_step_details
		WHERE sync_log_id = $1
		ORDER BY step_number
	`

	rows, err := r.pool.Query(ctx, stepsQuery, syncLogID)
	if err != nil {
		return nil, fmt.Errorf("failed to get step details: %w", err)
	}
	defer rows.Close()

	steps := make([]models.StepProgressDetail, 0)
	currentStep := 0
	currentStepName := ""

	for rows.Next() {
		var step models.StepProgressDetail

		err := rows.Scan(
			&step.StepNumber,
			&step.StepName,
			&step.Status,
			&step.ItemsProcessed,
			&step.ItemsTotal,
			&step.ProgressPercentage,
			&step.Extracted,
			&step.Inserted,
			&step.Updated,
			&step.Failed,
			&step.ThroughputItemsPerSecond,
			&step.StartedAt,
			&step.CompletedAt,
			&step.LastUpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan step detail: %w", err)
		}

		steps = append(steps, step)

		// Track current step
		if step.Status == "running" {
			currentStep = step.StepNumber
			currentStepName = step.StepName
		} else if step.Status == "completed" && currentStep == 0 {
			currentStep = step.StepNumber
			currentStepName = step.StepName
		}
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating step details: %w", err)
	}

	progress.Steps = steps
	progress.CurrentStep = currentStep
	progress.CurrentStepName = currentStepName

	// Calculate overall progress percentage
	totalSteps := len(selectedSteps)
	if totalSteps == 0 {
		totalSteps = 7 // Full sync
	}

	// Sum up progress from all steps
	totalProgress := 0.0
	completedSteps := 0
	for _, step := range steps {
		if step.Status == "completed" {
			totalProgress += 100.0
			completedSteps++
		} else if step.Status == "running" {
			totalProgress += step.ProgressPercentage
		}
		// pending/failed steps contribute 0
	}

	progress.OverallProgressPercentage = totalProgress / float64(totalSteps)

	// Estimate remaining time
	if completedSteps > 0 && completedSteps < totalSteps {
		avgTimePerStep := elapsed / completedSteps
		remainingSteps := totalSteps - completedSteps
		estimatedRemaining := avgTimePerStep * remainingSteps
		progress.EstimatedRemainingSeconds = &estimatedRemaining
	}

	progress.LastUpdated = time.Now()

	return &progress, nil
}
