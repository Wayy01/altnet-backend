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

// validateSyncConfiguration validates a sync configuration before saving
func validateSyncConfiguration(config *models.SyncConfiguration) error {
	// Validate name
	if strings.TrimSpace(config.Name) == "" {
		return fmt.Errorf("configuration name cannot be empty")
	}

	// Validate selected steps
	if len(config.SelectedSteps) == 0 {
		return fmt.Errorf("at least one sync step must be selected")
	}

	// Validate each step is valid
	validSteps := make(map[models.SyncStep]bool)
	for _, step := range models.AllSyncSteps() {
		validSteps[step] = true
	}

	for _, step := range config.SelectedSteps {
		if !validSteps[step] {
			return fmt.Errorf("invalid sync step: %s", step)
		}
	}

	// Validate field config references valid steps
	if config.FieldConfig != nil {
		for step := range config.FieldConfig {
			if !validSteps[step] {
				return fmt.Errorf("field config references invalid step: %s", step)
			}
		}
	}

	return nil
}

// SyncConfigRepository handles database operations for sync configurations and changes
type SyncConfigRepository struct {
	pool *pgxpool.Pool
}

// NewSyncConfigRepository creates a new sync configuration repository
func NewSyncConfigRepository(pool *pgxpool.Pool) *SyncConfigRepository {
	return &SyncConfigRepository{
		pool: pool,
	}
}

// SaveConfiguration saves a sync configuration to the database
func (r *SyncConfigRepository) SaveConfiguration(ctx context.Context, config *models.SyncConfiguration) error {
	// Validate configuration
	if err := validateSyncConfiguration(config); err != nil {
		return fmt.Errorf("validation failed: %w", err)
	}

	// Convert field config to JSONB
	fieldConfigJSON, err := json.Marshal(config.FieldConfig)
	if err != nil {
		return fmt.Errorf("failed to marshal field config: %w", err)
	}

	// Convert selected steps to array
	steps := make([]string, len(config.SelectedSteps))
	for i, step := range config.SelectedSteps {
		steps[i] = string(step)
	}

	// Generate UUID if not set
	if config.ID == uuid.Nil {
		config.ID = uuid.New()
	}

	// Set timestamps
	now := time.Now()
	if config.CreatedAt.IsZero() {
		config.CreatedAt = now
	}
	config.UpdatedAt = now

	query := `
		INSERT INTO sync_configurations (
			id, name, description, selected_steps, field_config,
			is_template, created_by, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (id) DO UPDATE SET
			name = EXCLUDED.name,
			description = EXCLUDED.description,
			selected_steps = EXCLUDED.selected_steps,
			field_config = EXCLUDED.field_config,
			is_template = EXCLUDED.is_template,
			updated_at = EXCLUDED.updated_at
		RETURNING id, created_at, updated_at
	`

	err = r.pool.QueryRow(ctx, query,
		config.ID,
		config.Name,
		config.Description,
		steps,
		fieldConfigJSON,
		config.IsTemplate,
		config.CreatedBy,
		config.CreatedAt,
		config.UpdatedAt,
	).Scan(&config.ID, &config.CreatedAt, &config.UpdatedAt)

	if err != nil {
		return fmt.Errorf("failed to save sync configuration: %w", err)
	}

	return nil
}

// GetConfigurationByID retrieves a sync configuration by ID
func (r *SyncConfigRepository) GetConfigurationByID(ctx context.Context, id uuid.UUID) (*models.SyncConfiguration, error) {
	query := `
		SELECT
			id, name, description, selected_steps, field_config,
			is_template, created_by, created_at, updated_at, last_used_at
		FROM sync_configurations
		WHERE id = $1
	`

	var config models.SyncConfiguration
	var steps []string
	var fieldConfigJSON []byte
	var lastUsedAt *time.Time

	err := r.pool.QueryRow(ctx, query, id).Scan(
		&config.ID,
		&config.Name,
		&config.Description,
		&steps,
		&fieldConfigJSON,
		&config.IsTemplate,
		&config.CreatedBy,
		&config.CreatedAt,
		&config.UpdatedAt,
		&lastUsedAt,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("sync configuration not found: %s", id)
		}
		return nil, fmt.Errorf("failed to get sync configuration: %w", err)
	}

	// Convert steps array
	config.SelectedSteps = make([]models.SyncStep, len(steps))
	for i, step := range steps {
		config.SelectedSteps[i] = models.SyncStep(step)
	}

	// Parse field config
	if len(fieldConfigJSON) > 0 {
		if err := json.Unmarshal(fieldConfigJSON, &config.FieldConfig); err != nil {
			return nil, fmt.Errorf("failed to unmarshal field config: %w", err)
		}
	}

	config.LastUsedAt = lastUsedAt

	return &config, nil
}

// ListConfigurations retrieves all sync configurations with pagination
func (r *SyncConfigRepository) ListConfigurations(ctx context.Context, templatesOnly bool, limit, offset int) ([]models.SyncConfiguration, int, error) {
	// Build query with optional filter
	countQuery := "SELECT COUNT(*) FROM sync_configurations"
	listQuery := `
		SELECT
			id, name, description, selected_steps, field_config,
			is_template, created_by, created_at, updated_at, last_used_at
		FROM sync_configurations
	`

	if templatesOnly {
		countQuery += " WHERE is_template = true"
		listQuery += " WHERE is_template = true"
	}

	listQuery += " ORDER BY created_at DESC LIMIT $1 OFFSET $2"

	// Get total count
	var total int
	err := r.pool.QueryRow(ctx, countQuery).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count configurations: %w", err)
	}

	// Get configurations
	rows, err := r.pool.Query(ctx, listQuery, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list configurations: %w", err)
	}
	defer rows.Close()

	configs := make([]models.SyncConfiguration, 0)

	for rows.Next() {
		var config models.SyncConfiguration
		var steps []string
		var fieldConfigJSON []byte
		var lastUsedAt *time.Time

		err := rows.Scan(
			&config.ID,
			&config.Name,
			&config.Description,
			&steps,
			&fieldConfigJSON,
			&config.IsTemplate,
			&config.CreatedBy,
			&config.CreatedAt,
			&config.UpdatedAt,
			&lastUsedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan configuration: %w", err)
		}

		// Convert steps array
		config.SelectedSteps = make([]models.SyncStep, len(steps))
		for i, step := range steps {
			config.SelectedSteps[i] = models.SyncStep(step)
		}

		// Parse field config
		if len(fieldConfigJSON) > 0 {
			if err := json.Unmarshal(fieldConfigJSON, &config.FieldConfig); err != nil {
				return nil, 0, fmt.Errorf("failed to unmarshal field config: %w", err)
			}
		}

		config.LastUsedAt = lastUsedAt
		configs = append(configs, config)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("error iterating configurations: %w", err)
	}

	return configs, total, nil
}

// RecordChange records a single sync change
func (r *SyncConfigRepository) RecordChange(ctx context.Context, change *models.SyncChange) error {
	// Convert fields changed to JSONB
	fieldsJSON, err := json.Marshal(change.FieldsChanged)
	if err != nil {
		return fmt.Errorf("failed to marshal fields changed: %w", err)
	}

	// Generate UUID if not set
	if change.ID == uuid.Nil {
		change.ID = uuid.New()
	}

	// Set timestamp
	if change.CreatedAt.IsZero() {
		change.CreatedAt = time.Now()
	}

	query := `
		INSERT INTO sync_changes (
			id, sync_log_id, step, entity_type, entity_id,
			entity_ultra_id, change_type, fields_changed, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, created_at
	`

	err = r.pool.QueryRow(ctx, query,
		change.ID,
		change.SyncLogID,
		string(change.Step),
		change.EntityType,
		change.EntityID,
		change.EntityUltraID,
		change.ChangeType,
		fieldsJSON,
		change.CreatedAt,
	).Scan(&change.ID, &change.CreatedAt)

	if err != nil {
		return fmt.Errorf("failed to record sync change: %w", err)
	}

	return nil
}

// RecordChanges records multiple sync changes in a batch
func (r *SyncConfigRepository) RecordChanges(ctx context.Context, changes []models.SyncChange) error {
	if len(changes) == 0 {
		return nil
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	// Only rollback if there's an error (err will be set via named return or deferred function)
	defer func() {
		if err != nil {
			tx.Rollback(ctx)
		}
	}()

	batch := &pgx.Batch{}

	for i := range changes {
		change := &changes[i]

		// Convert fields changed to JSONB
		fieldsJSON, err := json.Marshal(change.FieldsChanged)
		if err != nil {
			return fmt.Errorf("failed to marshal fields changed: %w", err)
		}

		// Generate UUID if not set
		if change.ID == uuid.Nil {
			change.ID = uuid.New()
		}

		// Set timestamp
		if change.CreatedAt.IsZero() {
			change.CreatedAt = time.Now()
		}

		query := `
			INSERT INTO sync_changes (
				id, sync_log_id, step, entity_type, entity_id,
				entity_ultra_id, change_type, fields_changed, created_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		`

		batch.Queue(query,
			change.ID,
			change.SyncLogID,
			string(change.Step),
			change.EntityType,
			change.EntityID,
			change.EntityUltraID,
			change.ChangeType,
			fieldsJSON,
			change.CreatedAt,
		)
	}

	br := tx.SendBatch(ctx, batch)
	defer br.Close() // CRITICAL: Always close batch results to prevent resource leak

	// CRITICAL: Check each batch result for errors
	for i := 0; i < batch.Len(); i++ {
		if _, execErr := br.Exec(); execErr != nil {
			err = fmt.Errorf("failed to execute batch item %d: %w", i, execErr)
			return err
		}
	}

	if err = tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// GetChangesByLogID retrieves all changes for a sync log with pagination
func (r *SyncConfigRepository) GetChangesByLogID(ctx context.Context, syncLogID uuid.UUID, limit, offset int) ([]models.SyncChange, int, error) {
	// Get total count
	countQuery := "SELECT COUNT(*) FROM sync_changes WHERE sync_log_id = $1"
	var total int
	err := r.pool.QueryRow(ctx, countQuery, syncLogID).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count changes: %w", err)
	}

	// Get changes
	query := `
		SELECT
			id, sync_log_id, step, entity_type, entity_id,
			entity_ultra_id, change_type, fields_changed, created_at
		FROM sync_changes
		WHERE sync_log_id = $1
		ORDER BY created_at ASC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.pool.Query(ctx, query, syncLogID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get changes: %w", err)
	}
	defer rows.Close()

	changes := make([]models.SyncChange, 0)

	for rows.Next() {
		var change models.SyncChange
		var fieldsJSON []byte
		var entityUltraID *string

		err := rows.Scan(
			&change.ID,
			&change.SyncLogID,
			&change.Step,
			&change.EntityType,
			&change.EntityID,
			&entityUltraID,
			&change.ChangeType,
			&fieldsJSON,
			&change.CreatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan change: %w", err)
		}

		if entityUltraID != nil {
			change.EntityUltraID = *entityUltraID
		}

		// Parse fields changed
		if len(fieldsJSON) > 0 {
			if err := json.Unmarshal(fieldsJSON, &change.FieldsChanged); err != nil {
				return nil, 0, fmt.Errorf("failed to unmarshal fields changed: %w", err)
			}
		}

		changes = append(changes, change)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("error iterating changes: %w", err)
	}

	return changes, total, nil
}

// GetChangeSummary generates a summary of changes for a sync log
func (r *SyncConfigRepository) GetChangeSummary(ctx context.Context, syncLogID uuid.UUID) (*models.SyncChangeSummary, error) {
	summary := &models.SyncChangeSummary{
		SyncLogID:    syncLogID,
		ByStep:       make(map[models.SyncStep]int),
		ByChangeType: make(map[string]int),
		ByEntityType: make(map[string]int),
	}

	// Get total count
	err := r.pool.QueryRow(ctx,
		"SELECT COUNT(*) FROM sync_changes WHERE sync_log_id = $1",
		syncLogID,
	).Scan(&summary.TotalChanges)
	if err != nil {
		return nil, fmt.Errorf("failed to count total changes: %w", err)
	}

	// Get counts by step
	rows, err := r.pool.Query(ctx, `
		SELECT step, COUNT(*)
		FROM sync_changes
		WHERE sync_log_id = $1
		GROUP BY step
	`, syncLogID)
	if err != nil {
		return nil, fmt.Errorf("failed to get changes by step: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var step string
		var count int
		if err := rows.Scan(&step, &count); err != nil {
			return nil, fmt.Errorf("failed to scan step count: %w", err)
		}
		summary.ByStep[models.SyncStep(step)] = count
	}

	// Get counts by change type
	rows, err = r.pool.Query(ctx, `
		SELECT change_type, COUNT(*)
		FROM sync_changes
		WHERE sync_log_id = $1
		GROUP BY change_type
	`, syncLogID)
	if err != nil {
		return nil, fmt.Errorf("failed to get changes by type: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var changeType string
		var count int
		if err := rows.Scan(&changeType, &count); err != nil {
			return nil, fmt.Errorf("failed to scan change type count: %w", err)
		}
		summary.ByChangeType[changeType] = count
	}

	// Get counts by entity type
	rows, err = r.pool.Query(ctx, `
		SELECT entity_type, COUNT(*)
		FROM sync_changes
		WHERE sync_log_id = $1
		GROUP BY entity_type
	`, syncLogID)
	if err != nil {
		return nil, fmt.Errorf("failed to get changes by entity type: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var entityType string
		var count int
		if err := rows.Scan(&entityType, &count); err != nil {
			return nil, fmt.Errorf("failed to scan entity type count: %w", err)
		}
		summary.ByEntityType[entityType] = count
	}

	// Get most changed fields
	rows, err = r.pool.Query(ctx, `
		SELECT
			step,
			jsonb_array_elements(fields_changed)->>'field_name' as field_name,
			COUNT(*) as change_count
		FROM sync_changes
		WHERE sync_log_id = $1
		GROUP BY step, field_name
		ORDER BY change_count DESC
		LIMIT 10
	`, syncLogID)
	if err != nil {
		return nil, fmt.Errorf("failed to get most changed fields: %w", err)
	}
	defer rows.Close()

	mostChanged := make([]models.FieldChangeStat, 0)
	for rows.Next() {
		var stat models.FieldChangeStat
		var step string
		if err := rows.Scan(&step, &stat.FieldName, &stat.ChangeCount); err != nil {
			return nil, fmt.Errorf("failed to scan field stat: %w", err)
		}
		stat.Step = models.SyncStep(step)
		mostChanged = append(mostChanged, stat)
	}

	summary.MostChangedFields = mostChanged

	return summary, nil
}

// UpdateConfigurationLastUsed updates the last_used_at timestamp for a configuration
func (r *SyncConfigRepository) UpdateConfigurationLastUsed(ctx context.Context, id uuid.UUID) error {
	query := `
		UPDATE sync_configurations
		SET last_used_at = NOW()
		WHERE id = $1
	`

	_, err := r.pool.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to update configuration last used: %w", err)
	}

	return nil
}

// DeleteConfiguration deletes a sync configuration by ID
func (r *SyncConfigRepository) DeleteConfiguration(ctx context.Context, id uuid.UUID) error {
	query := `
		DELETE FROM sync_configurations
		WHERE id = $1
	`

	result, err := r.pool.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete sync configuration: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("sync configuration not found: %s", id)
	}

	return nil
}
