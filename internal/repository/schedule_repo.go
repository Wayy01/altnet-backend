package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"ultra-api-testing/internal/models"
)

// Sentinel errors for schedule repository operations
var (
	ErrScheduleNotFound    = errors.New("schedule not found")
	ErrScheduleRunNotFound = errors.New("schedule run not found")
)

// ScheduleRepository handles sync schedule database operations
type ScheduleRepository struct {
	pool *pgxpool.Pool
}

// NewScheduleRepository creates a new schedule repository
func NewScheduleRepository(pool *pgxpool.Pool) *ScheduleRepository {
	return &ScheduleRepository{pool: pool}
}

// CreateSchedule creates a new sync schedule
func (r *ScheduleRepository) CreateSchedule(ctx context.Context, req *models.ScheduleCreateRequest) (*models.SyncSchedule, error) {
	// Validate request
	if err := req.Validate(); err != nil {
		return nil, fmt.Errorf("validation failed: %w", err)
	}

	// Set default timezone if not provided
	timezone := req.Timezone
	if timezone == "" {
		timezone = "UTC"
	}

	// Convert configs to JSONB
	retryConfigJSON, err := json.Marshal(req.RetryConfig)
	if err != nil {
		return nil, fmt.Errorf("marshal retry config: %w", err)
	}

	notificationConfigJSON, err := json.Marshal(req.NotificationConfig)
	if err != nil {
		return nil, fmt.Errorf("marshal notification config: %w", err)
	}

	query := `
		INSERT INTO sync_schedules (
			name, description, configuration_id, cron_expression, timezone,
			is_active, retry_config, notification_config, created_by
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, name, COALESCE(description, ''), configuration_id, cron_expression, timezone,
			is_active, last_run_at, next_run_at, COALESCE(last_status, ''), run_count, failure_count,
			retry_config, notification_config, COALESCE(created_by, ''), created_at, updated_at
	`

	schedule := &models.SyncSchedule{}
	var retryConfigBytes, notificationConfigBytes []byte

	err = r.pool.QueryRow(ctx, query,
		req.Name,
		req.Description,
		req.ConfigurationID,
		req.CronExpression,
		timezone,
		true, // is_active defaults to true for new schedules
		retryConfigJSON,
		notificationConfigJSON,
		req.CreatedBy,
	).Scan(
		&schedule.ID,
		&schedule.Name,
		&schedule.Description,
		&schedule.ConfigurationID,
		&schedule.CronExpression,
		&schedule.Timezone,
		&schedule.IsActive,
		&schedule.LastRunAt,
		&schedule.NextRunAt,
		&schedule.LastStatus,
		&schedule.RunCount,
		&schedule.FailureCount,
		&retryConfigBytes,
		&notificationConfigBytes,
		&schedule.CreatedBy,
		&schedule.CreatedAt,
		&schedule.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("create schedule: %w", err)
	}

	// Parse JSONB fields
	if len(retryConfigBytes) > 0 {
		if err := json.Unmarshal(retryConfigBytes, &schedule.RetryConfig); err != nil {
			return nil, fmt.Errorf("unmarshal retry config: %w", err)
		}
	}
	if len(notificationConfigBytes) > 0 {
		if err := json.Unmarshal(notificationConfigBytes, &schedule.NotificationConfig); err != nil {
			return nil, fmt.Errorf("unmarshal notification config: %w", err)
		}
	}

	return schedule, nil
}

// GetSchedule retrieves a schedule by ID
func (r *ScheduleRepository) GetSchedule(ctx context.Context, id uuid.UUID) (*models.SyncSchedule, error) {
	query := `
		SELECT id, name, COALESCE(description, ''), configuration_id, cron_expression, timezone,
			is_active, last_run_at, next_run_at, COALESCE(last_status, ''), run_count, failure_count,
			retry_config, notification_config, COALESCE(created_by, ''), created_at, updated_at
		FROM sync_schedules
		WHERE id = $1
	`

	schedule := &models.SyncSchedule{}
	var retryConfigBytes, notificationConfigBytes []byte

	err := r.pool.QueryRow(ctx, query, id).Scan(
		&schedule.ID,
		&schedule.Name,
		&schedule.Description,
		&schedule.ConfigurationID,
		&schedule.CronExpression,
		&schedule.Timezone,
		&schedule.IsActive,
		&schedule.LastRunAt,
		&schedule.NextRunAt,
		&schedule.LastStatus,
		&schedule.RunCount,
		&schedule.FailureCount,
		&retryConfigBytes,
		&notificationConfigBytes,
		&schedule.CreatedBy,
		&schedule.CreatedAt,
		&schedule.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrScheduleNotFound
		}
		return nil, fmt.Errorf("get schedule: %w", err)
	}

	// Parse JSONB fields
	if len(retryConfigBytes) > 0 {
		if err := json.Unmarshal(retryConfigBytes, &schedule.RetryConfig); err != nil {
			return nil, fmt.Errorf("unmarshal retry config: %w", err)
		}
	}
	if len(notificationConfigBytes) > 0 {
		if err := json.Unmarshal(notificationConfigBytes, &schedule.NotificationConfig); err != nil {
			return nil, fmt.Errorf("unmarshal notification config: %w", err)
		}
	}

	return schedule, nil
}

// GetScheduleWithConfig retrieves a schedule with its associated configuration details
func (r *ScheduleRepository) GetScheduleWithConfig(ctx context.Context, id uuid.UUID) (*models.ScheduleWithConfig, error) {
	query := `
		SELECT s.id, s.name, COALESCE(s.description, ''), s.configuration_id, s.cron_expression, s.timezone,
			s.is_active, s.last_run_at, s.next_run_at, COALESCE(s.last_status, ''), s.run_count, s.failure_count,
			s.retry_config, s.notification_config, COALESCE(s.created_by, ''), s.created_at, s.updated_at,
			c.name as config_name, c.selected_steps
		FROM sync_schedules s
		LEFT JOIN sync_configurations c ON s.configuration_id = c.id
		WHERE s.id = $1
	`

	schedule := &models.SyncSchedule{}
	var retryConfigBytes, notificationConfigBytes []byte
	var configName *string
	var selectedSteps []string

	err := r.pool.QueryRow(ctx, query, id).Scan(
		&schedule.ID,
		&schedule.Name,
		&schedule.Description,
		&schedule.ConfigurationID,
		&schedule.CronExpression,
		&schedule.Timezone,
		&schedule.IsActive,
		&schedule.LastRunAt,
		&schedule.NextRunAt,
		&schedule.LastStatus,
		&schedule.RunCount,
		&schedule.FailureCount,
		&retryConfigBytes,
		&notificationConfigBytes,
		&schedule.CreatedBy,
		&schedule.CreatedAt,
		&schedule.UpdatedAt,
		&configName,
		&selectedSteps,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrScheduleNotFound
		}
		return nil, fmt.Errorf("get schedule with config: %w", err)
	}

	// Parse JSONB fields
	if len(retryConfigBytes) > 0 {
		if err := json.Unmarshal(retryConfigBytes, &schedule.RetryConfig); err != nil {
			return nil, fmt.Errorf("unmarshal retry config: %w", err)
		}
	}
	if len(notificationConfigBytes) > 0 {
		if err := json.Unmarshal(notificationConfigBytes, &schedule.NotificationConfig); err != nil {
			return nil, fmt.Errorf("unmarshal notification config: %w", err)
		}
	}

	result := &models.ScheduleWithConfig{
		SyncSchedule:       schedule,
		ConfigurationSteps: selectedSteps,
	}

	if configName != nil {
		result.ConfigurationName = *configName
	}

	return result, nil
}

// ListSchedules retrieves all schedules with pagination
func (r *ScheduleRepository) ListSchedules(ctx context.Context, limit, offset int) ([]*models.ScheduleWithConfig, int, error) {
	// Get total count
	var total int
	err := r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM sync_schedules").Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("count schedules: %w", err)
	}

	query := `
		SELECT s.id, s.name, COALESCE(s.description, ''), s.configuration_id, s.cron_expression, s.timezone,
			s.is_active, s.last_run_at, s.next_run_at, COALESCE(s.last_status, ''), s.run_count, s.failure_count,
			s.retry_config, s.notification_config, COALESCE(s.created_by, ''), s.created_at, s.updated_at,
			c.name as config_name, c.selected_steps
		FROM sync_schedules s
		LEFT JOIN sync_configurations c ON s.configuration_id = c.id
		ORDER BY s.created_at DESC
		LIMIT $1 OFFSET $2
	`

	rows, err := r.pool.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("query schedules: %w", err)
	}
	defer rows.Close()

	schedules := make([]*models.ScheduleWithConfig, 0)
	for rows.Next() {
		schedule := &models.SyncSchedule{}
		var retryConfigBytes, notificationConfigBytes []byte
		var configName *string
		var selectedSteps []string

		err := rows.Scan(
			&schedule.ID,
			&schedule.Name,
			&schedule.Description,
			&schedule.ConfigurationID,
			&schedule.CronExpression,
			&schedule.Timezone,
			&schedule.IsActive,
			&schedule.LastRunAt,
			&schedule.NextRunAt,
			&schedule.LastStatus,
			&schedule.RunCount,
			&schedule.FailureCount,
			&retryConfigBytes,
			&notificationConfigBytes,
			&schedule.CreatedBy,
			&schedule.CreatedAt,
			&schedule.UpdatedAt,
			&configName,
			&selectedSteps,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("scan schedule: %w", err)
		}

		// Parse JSONB fields
		if len(retryConfigBytes) > 0 {
			if err := json.Unmarshal(retryConfigBytes, &schedule.RetryConfig); err != nil {
				return nil, 0, fmt.Errorf("unmarshal retry config: %w", err)
			}
		}
		if len(notificationConfigBytes) > 0 {
			if err := json.Unmarshal(notificationConfigBytes, &schedule.NotificationConfig); err != nil {
				return nil, 0, fmt.Errorf("unmarshal notification config: %w", err)
			}
		}

		result := &models.ScheduleWithConfig{
			SyncSchedule:       schedule,
			ConfigurationSteps: selectedSteps,
		}
		if configName != nil {
			result.ConfigurationName = *configName
		}

		schedules = append(schedules, result)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterate schedules: %w", err)
	}

	return schedules, total, nil
}

// UpdateSchedule updates an existing schedule
func (r *ScheduleRepository) UpdateSchedule(ctx context.Context, id uuid.UUID, req *models.ScheduleUpdateRequest) (*models.SyncSchedule, error) {
	// Validate request
	if err := req.Validate(); err != nil {
		return nil, fmt.Errorf("validation failed: %w", err)
	}

	// Build dynamic update query
	query := "UPDATE sync_schedules SET updated_at = NOW()"
	args := make([]interface{}, 0)
	argNum := 1

	if req.Name != nil {
		query += fmt.Sprintf(", name = $%d", argNum)
		args = append(args, *req.Name)
		argNum++
	}

	if req.Description != nil {
		query += fmt.Sprintf(", description = $%d", argNum)
		args = append(args, *req.Description)
		argNum++
	}

	if req.ConfigurationID != nil {
		query += fmt.Sprintf(", configuration_id = $%d", argNum)
		args = append(args, *req.ConfigurationID)
		argNum++
	}

	if req.CronExpression != nil {
		query += fmt.Sprintf(", cron_expression = $%d", argNum)
		args = append(args, *req.CronExpression)
		argNum++
	}

	if req.Timezone != nil {
		query += fmt.Sprintf(", timezone = $%d", argNum)
		args = append(args, *req.Timezone)
		argNum++
	}

	if req.IsActive != nil {
		query += fmt.Sprintf(", is_active = $%d", argNum)
		args = append(args, *req.IsActive)
		argNum++
	}

	if req.RetryConfig != nil {
		retryConfigJSON, err := json.Marshal(req.RetryConfig)
		if err != nil {
			return nil, fmt.Errorf("marshal retry config: %w", err)
		}
		query += fmt.Sprintf(", retry_config = $%d", argNum)
		args = append(args, retryConfigJSON)
		argNum++
	}

	if req.NotificationConfig != nil {
		notificationConfigJSON, err := json.Marshal(req.NotificationConfig)
		if err != nil {
			return nil, fmt.Errorf("marshal notification config: %w", err)
		}
		query += fmt.Sprintf(", notification_config = $%d", argNum)
		args = append(args, notificationConfigJSON)
		argNum++
	}

	query += fmt.Sprintf(" WHERE id = $%d", argNum)
	args = append(args, id)

	query += ` RETURNING id, name, COALESCE(description, ''), configuration_id, cron_expression, timezone,
		is_active, last_run_at, next_run_at, COALESCE(last_status, ''), run_count, failure_count,
		retry_config, notification_config, COALESCE(created_by, ''), created_at, updated_at`

	schedule := &models.SyncSchedule{}
	var retryConfigBytes, notificationConfigBytes []byte

	err := r.pool.QueryRow(ctx, query, args...).Scan(
		&schedule.ID,
		&schedule.Name,
		&schedule.Description,
		&schedule.ConfigurationID,
		&schedule.CronExpression,
		&schedule.Timezone,
		&schedule.IsActive,
		&schedule.LastRunAt,
		&schedule.NextRunAt,
		&schedule.LastStatus,
		&schedule.RunCount,
		&schedule.FailureCount,
		&retryConfigBytes,
		&notificationConfigBytes,
		&schedule.CreatedBy,
		&schedule.CreatedAt,
		&schedule.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrScheduleNotFound
		}
		return nil, fmt.Errorf("update schedule: %w", err)
	}

	// Parse JSONB fields
	if len(retryConfigBytes) > 0 {
		if err := json.Unmarshal(retryConfigBytes, &schedule.RetryConfig); err != nil {
			return nil, fmt.Errorf("unmarshal retry config: %w", err)
		}
	}
	if len(notificationConfigBytes) > 0 {
		if err := json.Unmarshal(notificationConfigBytes, &schedule.NotificationConfig); err != nil {
			return nil, fmt.Errorf("unmarshal notification config: %w", err)
		}
	}

	return schedule, nil
}

// DeleteSchedule deletes a schedule by ID
func (r *ScheduleRepository) DeleteSchedule(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM sync_schedules WHERE id = $1`

	cmdTag, err := r.pool.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("delete schedule: %w", err)
	}

	if cmdTag.RowsAffected() == 0 {
		return ErrScheduleNotFound
	}

	return nil
}

// ToggleSchedule toggles the is_active status of a schedule
func (r *ScheduleRepository) ToggleSchedule(ctx context.Context, id uuid.UUID) (*models.SyncSchedule, error) {
	query := `
		UPDATE sync_schedules
		SET is_active = NOT is_active, updated_at = NOW()
		WHERE id = $1
		RETURNING id, name, COALESCE(description, ''), configuration_id, cron_expression, timezone,
			is_active, last_run_at, next_run_at, COALESCE(last_status, ''), run_count, failure_count,
			retry_config, notification_config, COALESCE(created_by, ''), created_at, updated_at
	`

	schedule := &models.SyncSchedule{}
	var retryConfigBytes, notificationConfigBytes []byte

	err := r.pool.QueryRow(ctx, query, id).Scan(
		&schedule.ID,
		&schedule.Name,
		&schedule.Description,
		&schedule.ConfigurationID,
		&schedule.CronExpression,
		&schedule.Timezone,
		&schedule.IsActive,
		&schedule.LastRunAt,
		&schedule.NextRunAt,
		&schedule.LastStatus,
		&schedule.RunCount,
		&schedule.FailureCount,
		&retryConfigBytes,
		&notificationConfigBytes,
		&schedule.CreatedBy,
		&schedule.CreatedAt,
		&schedule.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrScheduleNotFound
		}
		return nil, fmt.Errorf("toggle schedule: %w", err)
	}

	// Parse JSONB fields
	if len(retryConfigBytes) > 0 {
		if err := json.Unmarshal(retryConfigBytes, &schedule.RetryConfig); err != nil {
			return nil, fmt.Errorf("unmarshal retry config: %w", err)
		}
	}
	if len(notificationConfigBytes) > 0 {
		if err := json.Unmarshal(notificationConfigBytes, &schedule.NotificationConfig); err != nil {
			return nil, fmt.Errorf("unmarshal notification config: %w", err)
		}
	}

	return schedule, nil
}

// CreateScheduleRun creates a new schedule run record
func (r *ScheduleRepository) CreateScheduleRun(ctx context.Context, scheduleID uuid.UUID, syncLogID *uuid.UUID) (*models.SyncScheduleRun, error) {
	query := `
		INSERT INTO sync_schedule_runs (schedule_id, sync_log_id, status)
		VALUES ($1, $2, $3)
		RETURNING id, schedule_id, sync_log_id, started_at, completed_at, status,
			retry_count, error_message, execution_metadata
	`

	run := &models.SyncScheduleRun{}
	var executionMetadataBytes []byte

	err := r.pool.QueryRow(ctx, query, scheduleID, syncLogID, models.ScheduleRunStatusRunning).Scan(
		&run.ID,
		&run.ScheduleID,
		&run.SyncLogID,
		&run.StartedAt,
		&run.CompletedAt,
		&run.Status,
		&run.RetryCount,
		&run.ErrorMessage,
		&executionMetadataBytes,
	)
	if err != nil {
		return nil, fmt.Errorf("create schedule run: %w", err)
	}

	if len(executionMetadataBytes) > 0 {
		if err := json.Unmarshal(executionMetadataBytes, &run.ExecutionMetadata); err != nil {
			return nil, fmt.Errorf("unmarshal execution metadata: %w", err)
		}
	}

	return run, nil
}

// UpdateScheduleRun updates a schedule run status
func (r *ScheduleRepository) UpdateScheduleRun(ctx context.Context, runID uuid.UUID, status string, errorMessage string, metadata map[string]interface{}) error {
	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		return fmt.Errorf("marshal metadata: %w", err)
	}

	var query string
	var args []interface{}

	if status == models.ScheduleRunStatusCompleted || status == models.ScheduleRunStatusFailed || status == models.ScheduleRunStatusCancelled {
		query = `
			UPDATE sync_schedule_runs
			SET status = $1, error_message = $2, execution_metadata = $3, completed_at = NOW()
			WHERE id = $4
		`
		args = []interface{}{status, errorMessage, metadataJSON, runID}
	} else {
		query = `
			UPDATE sync_schedule_runs
			SET status = $1, error_message = $2, execution_metadata = $3
			WHERE id = $4
		`
		args = []interface{}{status, errorMessage, metadataJSON, runID}
	}

	_, err = r.pool.Exec(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("update schedule run: %w", err)
	}

	return nil
}

// ListScheduleRuns retrieves all runs for a schedule with pagination
func (r *ScheduleRepository) ListScheduleRuns(ctx context.Context, scheduleID uuid.UUID, limit, offset int) ([]*models.SyncScheduleRun, int, error) {
	// Get total count
	var total int
	err := r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM sync_schedule_runs WHERE schedule_id = $1", scheduleID).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("count schedule runs: %w", err)
	}

	query := `
		SELECT id, schedule_id, sync_log_id, started_at, completed_at, status,
			retry_count, error_message, execution_metadata
		FROM sync_schedule_runs
		WHERE schedule_id = $1
		ORDER BY started_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.pool.Query(ctx, query, scheduleID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("query schedule runs: %w", err)
	}
	defer rows.Close()

	runs := make([]*models.SyncScheduleRun, 0)
	for rows.Next() {
		run := &models.SyncScheduleRun{}
		var executionMetadataBytes []byte

		err := rows.Scan(
			&run.ID,
			&run.ScheduleID,
			&run.SyncLogID,
			&run.StartedAt,
			&run.CompletedAt,
			&run.Status,
			&run.RetryCount,
			&run.ErrorMessage,
			&executionMetadataBytes,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("scan schedule run: %w", err)
		}

		if len(executionMetadataBytes) > 0 {
			if err := json.Unmarshal(executionMetadataBytes, &run.ExecutionMetadata); err != nil {
				return nil, 0, fmt.Errorf("unmarshal execution metadata: %w", err)
			}
		}

		runs = append(runs, run)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterate schedule runs: %w", err)
	}

	return runs, total, nil
}

// GetDueSchedules retrieves all active schedules that are due to run
// A schedule is due if next_run_at <= NOW() and is_active = true
func (r *ScheduleRepository) GetDueSchedules(ctx context.Context) ([]*models.SyncSchedule, error) {
	query := `
		SELECT id, name, COALESCE(description, ''), configuration_id, cron_expression, timezone,
			is_active, last_run_at, next_run_at, COALESCE(last_status, ''), run_count, failure_count,
			retry_config, notification_config, COALESCE(created_by, ''), created_at, updated_at
		FROM sync_schedules
		WHERE is_active = true AND next_run_at IS NOT NULL AND next_run_at <= NOW()
		ORDER BY next_run_at ASC
	`

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("query due schedules: %w", err)
	}
	defer rows.Close()

	schedules := make([]*models.SyncSchedule, 0)
	for rows.Next() {
		schedule := &models.SyncSchedule{}
		var retryConfigBytes, notificationConfigBytes []byte

		err := rows.Scan(
			&schedule.ID,
			&schedule.Name,
			&schedule.Description,
			&schedule.ConfigurationID,
			&schedule.CronExpression,
			&schedule.Timezone,
			&schedule.IsActive,
			&schedule.LastRunAt,
			&schedule.NextRunAt,
			&schedule.LastStatus,
			&schedule.RunCount,
			&schedule.FailureCount,
			&retryConfigBytes,
			&notificationConfigBytes,
			&schedule.CreatedBy,
			&schedule.CreatedAt,
			&schedule.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scan schedule: %w", err)
		}

		// Parse JSONB fields
		if len(retryConfigBytes) > 0 {
			if err := json.Unmarshal(retryConfigBytes, &schedule.RetryConfig); err != nil {
				return nil, fmt.Errorf("unmarshal retry config: %w", err)
			}
		}
		if len(notificationConfigBytes) > 0 {
			if err := json.Unmarshal(notificationConfigBytes, &schedule.NotificationConfig); err != nil {
				return nil, fmt.Errorf("unmarshal notification config: %w", err)
			}
		}

		schedules = append(schedules, schedule)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate due schedules: %w", err)
	}

	return schedules, nil
}

// UpdateScheduleLastRun updates the last_run_at, run_count, and optionally next_run_at for a schedule
func (r *ScheduleRepository) UpdateScheduleLastRun(ctx context.Context, id uuid.UUID, status string, nextRunAt *time.Time) error {
	var query string
	var args []interface{}

	if nextRunAt != nil {
		query = `
			UPDATE sync_schedules
			SET last_run_at = NOW(),
				last_status = $1,
				run_count = run_count + 1,
				next_run_at = $2,
				failure_count = CASE WHEN $1 = 'failed' THEN failure_count + 1 ELSE failure_count END,
				updated_at = NOW()
			WHERE id = $3
		`
		args = []interface{}{status, *nextRunAt, id}
	} else {
		query = `
			UPDATE sync_schedules
			SET last_run_at = NOW(),
				last_status = $1,
				run_count = run_count + 1,
				failure_count = CASE WHEN $1 = 'failed' THEN failure_count + 1 ELSE failure_count END,
				updated_at = NOW()
			WHERE id = $2
		`
		args = []interface{}{status, id}
	}

	_, err := r.pool.Exec(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("update schedule last run: %w", err)
	}

	return nil
}

// SetNextRunAt updates the next_run_at for a schedule
func (r *ScheduleRepository) SetNextRunAt(ctx context.Context, id uuid.UUID, nextRunAt time.Time) error {
	query := `UPDATE sync_schedules SET next_run_at = $1, updated_at = NOW() WHERE id = $2`

	_, err := r.pool.Exec(ctx, query, nextRunAt, id)
	if err != nil {
		return fmt.Errorf("set next run at: %w", err)
	}

	return nil
}

// GetScheduleRun retrieves a schedule run by ID
func (r *ScheduleRepository) GetScheduleRun(ctx context.Context, runID uuid.UUID) (*models.SyncScheduleRun, error) {
	query := `
		SELECT id, schedule_id, sync_log_id, started_at, completed_at, status,
			retry_count, error_message, execution_metadata
		FROM sync_schedule_runs
		WHERE id = $1
	`

	run := &models.SyncScheduleRun{}
	var executionMetadataBytes []byte

	err := r.pool.QueryRow(ctx, query, runID).Scan(
		&run.ID,
		&run.ScheduleID,
		&run.SyncLogID,
		&run.StartedAt,
		&run.CompletedAt,
		&run.Status,
		&run.RetryCount,
		&run.ErrorMessage,
		&executionMetadataBytes,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrScheduleRunNotFound
		}
		return nil, fmt.Errorf("get schedule run: %w", err)
	}

	if len(executionMetadataBytes) > 0 {
		if err := json.Unmarshal(executionMetadataBytes, &run.ExecutionMetadata); err != nil {
			return nil, fmt.Errorf("unmarshal execution metadata: %w", err)
		}
	}

	return run, nil
}

// IncrementRetryCount increments the retry count for a schedule run
func (r *ScheduleRepository) IncrementRetryCount(ctx context.Context, runID uuid.UUID) error {
	query := `UPDATE sync_schedule_runs SET retry_count = retry_count + 1 WHERE id = $1`

	_, err := r.pool.Exec(ctx, query, runID)
	if err != nil {
		return fmt.Errorf("increment retry count: %w", err)
	}

	return nil
}
