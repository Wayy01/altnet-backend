package repository

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"ultra-api-testing/internal/constants"
	"ultra-api-testing/internal/models"
)

// RollbackRepository handles rollback operations
type RollbackRepository struct {
	pool *pgxpool.Pool
}

// NewRollbackRepository creates a new rollback repository
func NewRollbackRepository(pool *pgxpool.Pool) *RollbackRepository {
	return &RollbackRepository{
		pool: pool,
	}
}

// ============================================================================
// SNAPSHOT OPERATIONS
// ============================================================================

// CreateSnapshot creates a snapshot of current database state
func (r *RollbackRepository) CreateSnapshot(ctx context.Context, syncLogID uuid.UUID, snapshotType string, step *models.SyncStep, expiresIn *time.Duration) (*models.SyncSnapshot, error) {
	snapshot := &models.SyncSnapshot{
		ID:           uuid.New(),
		SyncLogID:    syncLogID,
		SnapshotType: snapshotType,
		Step:         step,
		CreatedAt:    time.Now(),
		Metadata:     make(map[string]interface{}),
	}

	if expiresIn != nil {
		expiresAt := time.Now().Add(*expiresIn)
		snapshot.ExpiresAt = &expiresAt
	}

	metadataJSON, err := json.Marshal(snapshot.Metadata)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal metadata: %w", err)
	}

	var stepStr *string
	if step != nil {
		s := string(*step)
		stepStr = &s
	}

	query := `
		INSERT INTO sync_snapshots (
			id, sync_log_id, snapshot_type, step, created_at, expires_at, metadata
		) VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at
	`

	err = r.pool.QueryRow(ctx, query,
		snapshot.ID,
		snapshot.SyncLogID,
		snapshot.SnapshotType,
		stepStr,
		snapshot.CreatedAt,
		snapshot.ExpiresAt,
		metadataJSON,
	).Scan(&snapshot.ID, &snapshot.CreatedAt)

	if err != nil {
		return nil, fmt.Errorf("failed to create snapshot: %w", err)
	}

	// Update sync_logs to mark snapshot as available
	_, err = r.pool.Exec(ctx, `
		UPDATE sync_logs
		SET snapshot_id = $1, rollback_available = true
		WHERE id = $2
	`, snapshot.ID, syncLogID)

	if err != nil {
		log.Printf("Warning: failed to update sync_logs with snapshot_id: %v", err)
	}

	return snapshot, nil
}

// CaptureEntitySnapshot captures entity data into snapshot
func (r *RollbackRepository) CaptureEntitySnapshot(ctx context.Context, snapshotID uuid.UUID, entityType string, entityIDs []uuid.UUID) error {
	if len(entityIDs) == 0 {
		return nil
	}

	// Validate entity type against whitelist (SECURITY: prevent SQL injection)
	if !constants.ValidEntityTypes[entityType] {
		return fmt.Errorf(constants.ErrInvalidEntityType)
	}

	// Fetch entity data based on entity type
	var query string
	switch entityType {
	case "brand":
		query = `
			SELECT id, ultra_id, name, logo_url, is_active, created_at, updated_at
			FROM brands
			WHERE id = ANY($1)
		`
	case "category":
		query = `
			SELECT id, ultra_id, name, parent_ultra_id, sort_order, image_url, is_active, created_at, updated_at
			FROM categories
			WHERE id = ANY($1)
		`
	case "product":
		query = `
			SELECT id, ultra_id, name, code, article, description, brand_ultra_id, category_ultra_id,
				   parent_ultra_id, main_image_url, images, warranty, barcodes, is_active, is_service,
				   price_eur, price_usd, price_mdl, in_stock, stock_quantity, created_at, updated_at
			FROM products
			WHERE id = ANY($1)
		`
	default:
		return fmt.Errorf(constants.ErrInvalidEntityType)
	}

	rows, err := r.pool.Query(ctx, query, entityIDs)
	if err != nil {
		return fmt.Errorf("failed to fetch entities: %w", err)
	}
	defer rows.Close()

	batch := &pgx.Batch{}
	batchCount := 0

	for rows.Next() {
		// Get column descriptions
		fieldDescriptions := rows.FieldDescriptions()
		values, err := rows.Values()
		if err != nil {
			return fmt.Errorf("failed to scan row: %w", err)
		}

		// Build entity data map
		entityData := make(map[string]interface{})
		var entityID uuid.UUID
		var entityUltraID string

		for i, fieldDesc := range fieldDescriptions {
			fieldName := string(fieldDesc.Name)
			entityData[fieldName] = values[i]

			if fieldName == "id" {
				if id, ok := values[i].(uuid.UUID); ok {
					entityID = id
				}
			}
			if fieldName == "ultra_id" {
				if ultraID, ok := values[i].(string); ok {
					entityUltraID = ultraID
				}
			}
		}

		// Marshal entity data
		entityDataJSON, err := json.Marshal(entityData)
		if err != nil {
			return fmt.Errorf("failed to marshal entity data: %w", err)
		}

		// Add to batch
		insertQuery := `
			INSERT INTO sync_snapshot_data (
				id, snapshot_id, entity_type, entity_id, entity_ultra_id, snapshot_data, created_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7)
		`

		batch.Queue(insertQuery,
			uuid.New(),
			snapshotID,
			entityType,
			entityID,
			entityUltraID,
			entityDataJSON,
			time.Now(),
		)
		batchCount++

		// Execute batch when reaching max size to prevent memory issues
		if batchCount >= constants.MaxBatchSize {
			if err := r.executeBatch(ctx, batch); err != nil {
				return err
			}
			batch = &pgx.Batch{}
			batchCount = 0
		}
	}

	if err := rows.Err(); err != nil {
		return fmt.Errorf("error iterating rows: %w", err)
	}

	// Execute remaining batch items
	if batch.Len() > 0 {
		if err := r.executeBatch(ctx, batch); err != nil {
			return err
		}
	}

	return nil
}

// executeBatch is a helper to execute a batch and handle errors
func (r *RollbackRepository) executeBatch(ctx context.Context, batch *pgx.Batch) error {
	br := r.pool.SendBatch(ctx, batch)
	defer br.Close()

	for i := 0; i < batch.Len(); i++ {
		if _, err := br.Exec(); err != nil {
			return fmt.Errorf("failed to execute batch item %d: %w", i, err)
		}
	}
	return nil
}

// GetSnapshotByID retrieves a snapshot by ID
func (r *RollbackRepository) GetSnapshotByID(ctx context.Context, snapshotID uuid.UUID) (*models.SyncSnapshot, error) {
	query := `
		SELECT id, sync_log_id, snapshot_type, step, created_at, expires_at, metadata
		FROM sync_snapshots
		WHERE id = $1
	`

	var snapshot models.SyncSnapshot
	var stepStr *string
	var metadataJSON []byte

	err := r.pool.QueryRow(ctx, query, snapshotID).Scan(
		&snapshot.ID,
		&snapshot.SyncLogID,
		&snapshot.SnapshotType,
		&stepStr,
		&snapshot.CreatedAt,
		&snapshot.ExpiresAt,
		&metadataJSON,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("snapshot not found: %s", snapshotID)
		}
		return nil, fmt.Errorf("failed to get snapshot: %w", err)
	}

	if stepStr != nil {
		step := models.SyncStep(*stepStr)
		snapshot.Step = &step
	}

	if len(metadataJSON) > 0 {
		if err := json.Unmarshal(metadataJSON, &snapshot.Metadata); err != nil {
			return nil, fmt.Errorf("failed to unmarshal metadata: %w", err)
		}
	}

	return &snapshot, nil
}

// GetSnapshotBySyncLogID retrieves a snapshot by sync log ID
func (r *RollbackRepository) GetSnapshotBySyncLogID(ctx context.Context, syncLogID uuid.UUID) (*models.SyncSnapshot, error) {
	query := `
		SELECT id, sync_log_id, snapshot_type, step, created_at, expires_at, metadata
		FROM sync_snapshots
		WHERE sync_log_id = $1
		ORDER BY created_at DESC
		LIMIT 1
	`

	var snapshot models.SyncSnapshot
	var stepStr *string
	var metadataJSON []byte

	err := r.pool.QueryRow(ctx, query, syncLogID).Scan(
		&snapshot.ID,
		&snapshot.SyncLogID,
		&snapshot.SnapshotType,
		&stepStr,
		&snapshot.CreatedAt,
		&snapshot.ExpiresAt,
		&metadataJSON,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("no snapshot found for sync log: %s", syncLogID)
		}
		return nil, fmt.Errorf("failed to get snapshot: %w", err)
	}

	if stepStr != nil {
		step := models.SyncStep(*stepStr)
		snapshot.Step = &step
	}

	if len(metadataJSON) > 0 {
		if err := json.Unmarshal(metadataJSON, &snapshot.Metadata); err != nil {
			return nil, fmt.Errorf("failed to unmarshal metadata: %w", err)
		}
	}

	return &snapshot, nil
}

// ============================================================================
// ROLLBACK PREVIEW
// ============================================================================

// GenerateRollbackPreview generates a preview of what will be rolled back
func (r *RollbackRepository) GenerateRollbackPreview(ctx context.Context, snapshotID uuid.UUID) (*models.RollbackPreview, error) {
	snapshot, err := r.GetSnapshotByID(ctx, snapshotID)
	if err != nil {
		return nil, err
	}

	// Check if snapshot has expired
	if snapshot.ExpiresAt != nil && snapshot.ExpiresAt.Before(time.Now()) {
		return nil, fmt.Errorf("snapshot has expired")
	}

	// Count entities by type
	countQuery := `
		SELECT entity_type, COUNT(*) as count
		FROM sync_snapshot_data
		WHERE snapshot_id = $1
		GROUP BY entity_type
	`

	rows, err := r.pool.Query(ctx, countQuery, snapshotID)
	if err != nil {
		return nil, fmt.Errorf("failed to count snapshot entities: %w", err)
	}
	defer rows.Close()

	entitiesByType := make(map[string]int)
	totalEntities := 0

	for rows.Next() {
		var entityType string
		var count int
		if err := rows.Scan(&entityType, &count); err != nil {
			return nil, fmt.Errorf("failed to scan count: %w", err)
		}
		entitiesByType[entityType] = count
		totalEntities += count
	}

	// Calculate estimated time using configured constant
	estimatedTime := time.Duration(totalEntities) * constants.EstimatedTimePerEntity

	// Generate warnings
	warnings := make([]string, 0)
	if snapshot.ExpiresAt != nil {
		timeUntilExpiry := time.Until(*snapshot.ExpiresAt)
		if timeUntilExpiry < constants.SnapshotExpiryWarningThreshold {
			warnings = append(warnings, fmt.Sprintf("Snapshot will expire in %v", timeUntilExpiry.Round(time.Minute)))
		}
	}

	snapshotAge := time.Since(snapshot.CreatedAt)
	if snapshotAge > constants.SnapshotAgeWarningThreshold {
		warnings = append(warnings, fmt.Sprintf("Snapshot is %v old - data may be significantly outdated", snapshotAge.Round(time.Hour)))
	}

	if totalEntities > constants.LargeRollbackThreshold {
		warnings = append(warnings, "Large rollback - this may take several minutes")
	}

	// Generate confirmation hash with HMAC
	confirmHash, err := generateConfirmHash(snapshotID, totalEntities)
	if err != nil {
		return nil, fmt.Errorf("failed to generate confirmation hash: %w", err)
	}

	preview := &models.RollbackPreview{
		SnapshotID:      snapshotID,
		SnapshotAge:     snapshotAge,
		TotalEntities:   totalEntities,
		EntitiesByType:  entitiesByType,
		AffectedRecords: totalEntities,
		EstimatedTime:   estimatedTime,
		Warnings:        warnings,
		ConfirmHash:     confirmHash,
	}

	return preview, nil
}

// generateConfirmHash generates a secure confirmation hash using HMAC-SHA256
func generateConfirmHash(snapshotID uuid.UUID, totalEntities int) (string, error) {
	// Get secret key from environment
	secretKey := os.Getenv(constants.EnvRollbackSecretKey)
	if secretKey == "" {
		return "", fmt.Errorf(constants.ErrMissingSecretKey)
	}

	// Create HMAC with current hour for time-based validation
	currentHour := time.Now().Unix() / 3600
	data := fmt.Sprintf("%s-%d-%d", snapshotID.String(), totalEntities, currentHour)

	h := hmac.New(sha256.New, []byte(secretKey))
	h.Write([]byte(data))
	hash := hex.EncodeToString(h.Sum(nil))

	// Return first 16 characters (64 bits) for security
	if len(hash) < constants.HashLength {
		return "", fmt.Errorf("generated hash is too short")
	}
	return hash[:constants.HashLength], nil
}

// ValidateConfirmHash validates a confirmation hash using HMAC
func (r *RollbackRepository) ValidateConfirmHash(ctx context.Context, snapshotID uuid.UUID, providedHash string) error {
	preview, err := r.GenerateRollbackPreview(ctx, snapshotID)
	if err != nil {
		return err
	}

	// Get secret key from environment
	secretKey := os.Getenv(constants.EnvRollbackSecretKey)
	if secretKey == "" {
		return fmt.Errorf(constants.ErrMissingSecretKey)
	}

	// Check current hour and previous hour (to account for timing issues)
	currentHour := time.Now().Unix() / 3600

	// Validate against current hour
	currentData := fmt.Sprintf("%s-%d-%d", snapshotID.String(), preview.TotalEntities, currentHour)
	h := hmac.New(sha256.New, []byte(secretKey))
	h.Write([]byte(currentData))
	currentHash := hex.EncodeToString(h.Sum(nil))[:constants.HashLength]

	if providedHash == currentHash {
		return nil
	}

	// Validate against previous hour (timing tolerance)
	previousData := fmt.Sprintf("%s-%d-%d", snapshotID.String(), preview.TotalEntities, currentHour-1)
	h = hmac.New(sha256.New, []byte(secretKey))
	h.Write([]byte(previousData))
	previousHash := hex.EncodeToString(h.Sum(nil))[:constants.HashLength]

	if providedHash == previousHash {
		return nil
	}

	return fmt.Errorf("invalid confirmation hash")
}

// ============================================================================
// ROLLBACK EXECUTION
// ============================================================================

// ExecuteRollback performs a rollback operation
func (r *RollbackRepository) ExecuteRollback(ctx context.Context, request *models.RollbackRequest) (*models.SyncRollback, error) {
	// Get snapshot
	snapshot, err := r.GetSnapshotBySyncLogID(ctx, request.SyncLogID)
	if err != nil {
		return nil, fmt.Errorf("failed to get snapshot: %w", err)
	}

	// Validate confirmation hash
	if err := r.ValidateConfirmHash(ctx, snapshot.ID, request.ConfirmHash); err != nil {
		return nil, fmt.Errorf("rollback validation failed: %w", err)
	}

	// Create rollback record
	rollback := &models.SyncRollback{
		ID:                uuid.New(),
		OriginalSyncLogID: request.SyncLogID,
		SnapshotID:        snapshot.ID,
		RollbackType:      request.RollbackType,
		RollbackScope:     make(map[string]interface{}),
		InitiatedBy:       request.InitiatedBy,
		Status:            "pending",
		StartedAt:         time.Now(),
		EntitiesRestored:  0,
		Errors:            make([]string, 0),
		Metadata:          make(map[string]interface{}),
	}

	// Build rollback scope
	if request.RollbackType == "selective" {
		rollback.RollbackScope["entity_types"] = request.EntityTypes
		rollback.RollbackScope["entity_ids"] = request.EntityIDs
	}

	scopeJSON, err := json.Marshal(rollback.RollbackScope)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal rollback scope: %w", err)
	}

	errorsJSON, err := json.Marshal(rollback.Errors)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal errors: %w", err)
	}

	metadataJSON, err := json.Marshal(rollback.Metadata)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal metadata: %w", err)
	}

	// Insert rollback record
	insertQuery := `
		INSERT INTO sync_rollbacks (
			id, original_sync_log_id, snapshot_id, rollback_type, rollback_scope,
			initiated_by, status, started_at, entities_restored, errors, metadata
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id, started_at
	`

	err = r.pool.QueryRow(ctx, insertQuery,
		rollback.ID,
		rollback.OriginalSyncLogID,
		rollback.SnapshotID,
		rollback.RollbackType,
		scopeJSON,
		rollback.InitiatedBy,
		rollback.Status,
		rollback.StartedAt,
		rollback.EntitiesRestored,
		errorsJSON,
		metadataJSON,
	).Scan(&rollback.ID, &rollback.StartedAt)

	if err != nil {
		return nil, fmt.Errorf("failed to create rollback record: %w", err)
	}

	// BEGIN TRANSACTION with REPEATABLE READ isolation level
	// This prevents phantom reads and ensures consistent snapshot during rollback operation
	// REPEATABLE READ is appropriate because we need to restore entities to a consistent state
	// without seeing new changes from concurrent transactions during the rollback process
	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{
		IsoLevel: pgx.RepeatableRead,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx) // Rollback if not committed

	// Update status to in_progress within transaction
	rollback.Status = "in_progress"
	_, err = tx.Exec(ctx, `UPDATE sync_rollbacks SET status = $2 WHERE id = $1`, rollback.ID, "in_progress")
	if err != nil {
		return nil, fmt.Errorf("failed to update rollback status: %w", err)
	}

	// Perform the actual rollback within transaction
	entitiesRestored, errors := r.performRollbackTx(ctx, tx, snapshot.ID, request)
	rollback.EntitiesRestored = entitiesRestored
	rollback.Errors = errors

	// Update rollback record with results
	completedAt := time.Now()
	rollback.CompletedAt = &completedAt
	rollback.Status = "completed"
	if len(errors) > 0 {
		rollback.Status = "failed"
		// Rollback transaction if there were errors
		return rollback, fmt.Errorf("rollback failed with %d error(s)", len(errors))
	}

	// Update completion status
	errorsJSON, _ = json.Marshal(rollback.Errors)
	metadataJSON, _ = json.Marshal(rollback.Metadata)
	_, err = tx.Exec(ctx, `
		UPDATE sync_rollbacks
		SET status = $2, completed_at = $3, entities_restored = $4, errors = $5, metadata = $6
		WHERE id = $1
	`, rollback.ID, rollback.Status, rollback.CompletedAt, rollback.EntitiesRestored, errorsJSON, metadataJSON)
	if err != nil {
		return nil, fmt.Errorf("failed to update rollback completion: %w", err)
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit rollback transaction: %w", err)
	}

	return rollback, nil
}

// performRollbackTx performs the actual rollback operation within a transaction
func (r *RollbackRepository) performRollbackTx(ctx context.Context, tx pgx.Tx, snapshotID uuid.UUID, request *models.RollbackRequest) (int, []string) {
	errors := make([]string, 0)
	entitiesRestored := 0

	// Validate rollback type
	if !constants.ValidRollbackTypes[request.RollbackType] {
		errors = append(errors, constants.ErrInvalidRollbackType)
		return entitiesRestored, errors
	}

	// Build query to get snapshot data
	query := `
		SELECT entity_type, entity_id, snapshot_data
		FROM sync_snapshot_data
		WHERE snapshot_id = $1
	`

	args := []interface{}{snapshotID}

	// Add filters for selective rollback
	if request.RollbackType == "selective" {
		if len(request.EntityTypes) > 0 {
			query += ` AND entity_type = ANY($2)`
			args = append(args, request.EntityTypes)
		}
		if len(request.EntityIDs) > 0 {
			nextArg := 2
			if len(request.EntityTypes) > 0 {
				nextArg = 3
			}
			query += fmt.Sprintf(` AND entity_id = ANY($%d)`, nextArg)
			args = append(args, request.EntityIDs)
		}
	}

	rows, err := tx.Query(ctx, query, args...)
	if err != nil {
		errors = append(errors, fmt.Sprintf("Failed to fetch snapshot data: %v", err))
		return entitiesRestored, errors
	}
	defer rows.Close()

	// Process each entity
	for rows.Next() {
		var entityType string
		var entityID uuid.UUID
		var snapshotDataJSON []byte

		if err := rows.Scan(&entityType, &entityID, &snapshotDataJSON); err != nil {
			errors = append(errors, fmt.Sprintf("Failed to scan snapshot data: %v", err))
			continue
		}

		// Parse snapshot data
		var snapshotData map[string]interface{}
		if err := json.Unmarshal(snapshotDataJSON, &snapshotData); err != nil {
			errors = append(errors, fmt.Sprintf("Failed to unmarshal snapshot data for %s/%s: %v", entityType, entityID, err))
			continue
		}

		// Restore entity within transaction
		if err := r.restoreEntityTx(ctx, tx, entityType, entityID, snapshotData); err != nil {
			errors = append(errors, fmt.Sprintf("Failed to restore %s/%s: %v", entityType, entityID, err))
			continue
		}

		entitiesRestored++
	}

	if err := rows.Err(); err != nil {
		errors = append(errors, fmt.Sprintf("Error iterating snapshot data: %v", err))
	}

	return entitiesRestored, errors
}

// restoreEntityTx restores a single entity from snapshot data within a transaction
func (r *RollbackRepository) restoreEntityTx(ctx context.Context, tx pgx.Tx, entityType string, entityID uuid.UUID, snapshotData map[string]interface{}) error {
	// Validate entity type
	if !constants.ValidEntityTypes[entityType] {
		return fmt.Errorf(constants.ErrInvalidEntityType)
	}

	var query string

	switch entityType {
	case "brand":
		query = `
			UPDATE brands
			SET name = $2, logo_url = $3, is_active = $4, updated_at = $5
			WHERE id = $1
		`
		_, err := tx.Exec(ctx, query,
			entityID,
			snapshotData["name"],
			snapshotData["logo_url"],
			snapshotData["is_active"],
			time.Now(),
		)
		return err

	case "category":
		query = `
			UPDATE categories
			SET name = $2, parent_ultra_id = $3, sort_order = $4, image_url = $5, is_active = $6, updated_at = $7
			WHERE id = $1
		`
		_, err := tx.Exec(ctx, query,
			entityID,
			snapshotData["name"],
			snapshotData["parent_ultra_id"],
			snapshotData["sort_order"],
			snapshotData["image_url"],
			snapshotData["is_active"],
			time.Now(),
		)
		return err

	case "product":
		query = `
			UPDATE products
			SET name = $2, code = $3, article = $4, description = $5,
				brand_ultra_id = $6, category_ultra_id = $7, parent_ultra_id = $8,
				main_image_url = $9, images = $10, warranty = $11, barcodes = $12,
				is_active = $13, is_service = $14, updated_at = $15
			WHERE id = $1
		`

		// Convert images and barcodes back to JSON
		imagesJSON, _ := json.Marshal(snapshotData["images"])
		barcodesJSON, _ := json.Marshal(snapshotData["barcodes"])

		_, err := tx.Exec(ctx, query,
			entityID,
			snapshotData["name"],
			snapshotData["code"],
			snapshotData["article"],
			snapshotData["description"],
			snapshotData["brand_ultra_id"],
			snapshotData["category_ultra_id"],
			snapshotData["parent_ultra_id"],
			snapshotData["main_image_url"],
			imagesJSON,
			snapshotData["warranty"],
			barcodesJSON,
			snapshotData["is_active"],
			snapshotData["is_service"],
			time.Now(),
		)
		return err

	default:
		return fmt.Errorf(constants.ErrInvalidEntityType)
	}
}

// UpdateRollbackStatus updates the status of a rollback
func (r *RollbackRepository) UpdateRollbackStatus(ctx context.Context, rollbackID uuid.UUID, status string) error {
	query := `
		UPDATE sync_rollbacks
		SET status = $2
		WHERE id = $1
	`

	_, err := r.pool.Exec(ctx, query, rollbackID, status)
	return err
}

// UpdateRollbackCompletion updates a rollback with completion data
func (r *RollbackRepository) UpdateRollbackCompletion(ctx context.Context, rollback *models.SyncRollback) error {
	errorsJSON, err := json.Marshal(rollback.Errors)
	if err != nil {
		return fmt.Errorf("failed to marshal errors: %w", err)
	}

	metadataJSON, err := json.Marshal(rollback.Metadata)
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}

	query := `
		UPDATE sync_rollbacks
		SET status = $2, completed_at = $3, entities_restored = $4, errors = $5, metadata = $6
		WHERE id = $1
	`

	_, err = r.pool.Exec(ctx, query,
		rollback.ID,
		rollback.Status,
		rollback.CompletedAt,
		rollback.EntitiesRestored,
		errorsJSON,
		metadataJSON,
	)

	return err
}

// GetRollbackByID retrieves a rollback by ID
func (r *RollbackRepository) GetRollbackByID(ctx context.Context, rollbackID uuid.UUID) (*models.SyncRollback, error) {
	query := `
		SELECT id, original_sync_log_id, snapshot_id, rollback_type, rollback_scope,
			   initiated_by, status, started_at, completed_at, entities_restored, errors, metadata
		FROM sync_rollbacks
		WHERE id = $1
	`

	var rollback models.SyncRollback
	var scopeJSON, errorsJSON, metadataJSON []byte

	err := r.pool.QueryRow(ctx, query, rollbackID).Scan(
		&rollback.ID,
		&rollback.OriginalSyncLogID,
		&rollback.SnapshotID,
		&rollback.RollbackType,
		&scopeJSON,
		&rollback.InitiatedBy,
		&rollback.Status,
		&rollback.StartedAt,
		&rollback.CompletedAt,
		&rollback.EntitiesRestored,
		&errorsJSON,
		&metadataJSON,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("rollback not found: %s", rollbackID)
		}
		return nil, fmt.Errorf("failed to get rollback: %w", err)
	}

	if err := json.Unmarshal(scopeJSON, &rollback.RollbackScope); err != nil {
		return nil, fmt.Errorf("failed to unmarshal rollback scope: %w", err)
	}

	if err := json.Unmarshal(errorsJSON, &rollback.Errors); err != nil {
		return nil, fmt.Errorf("failed to unmarshal errors: %w", err)
	}

	if err := json.Unmarshal(metadataJSON, &rollback.Metadata); err != nil {
		return nil, fmt.Errorf("failed to unmarshal metadata: %w", err)
	}

	return &rollback, nil
}

// ListRollbacks lists all rollbacks with pagination
func (r *RollbackRepository) ListRollbacks(ctx context.Context, limit, offset int) ([]models.SyncRollback, int, error) {
	// Get total count
	var total int
	err := r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM sync_rollbacks").Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count rollbacks: %w", err)
	}

	// Get rollbacks
	query := `
		SELECT id, original_sync_log_id, snapshot_id, rollback_type, rollback_scope,
			   initiated_by, status, started_at, completed_at, entities_restored, errors, metadata
		FROM sync_rollbacks
		ORDER BY started_at DESC
		LIMIT $1 OFFSET $2
	`

	rows, err := r.pool.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list rollbacks: %w", err)
	}
	defer rows.Close()

	rollbacks := make([]models.SyncRollback, 0)

	for rows.Next() {
		var rollback models.SyncRollback
		var scopeJSON, errorsJSON, metadataJSON []byte

		err := rows.Scan(
			&rollback.ID,
			&rollback.OriginalSyncLogID,
			&rollback.SnapshotID,
			&rollback.RollbackType,
			&scopeJSON,
			&rollback.InitiatedBy,
			&rollback.Status,
			&rollback.StartedAt,
			&rollback.CompletedAt,
			&rollback.EntitiesRestored,
			&errorsJSON,
			&metadataJSON,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan rollback: %w", err)
		}

		if err := json.Unmarshal(scopeJSON, &rollback.RollbackScope); err != nil {
			return nil, 0, fmt.Errorf("failed to unmarshal rollback scope: %w", err)
		}

		if err := json.Unmarshal(errorsJSON, &rollback.Errors); err != nil {
			return nil, 0, fmt.Errorf("failed to unmarshal errors: %w", err)
		}

		if err := json.Unmarshal(metadataJSON, &rollback.Metadata); err != nil {
			return nil, 0, fmt.Errorf("failed to unmarshal metadata: %w", err)
		}

		rollbacks = append(rollbacks, rollback)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("error iterating rollbacks: %w", err)
	}

	return rollbacks, total, nil
}

// CleanupExpiredSnapshots removes expired snapshots
func (r *RollbackRepository) CleanupExpiredSnapshots(ctx context.Context) (int, error) {
	query := `
		DELETE FROM sync_snapshots
		WHERE expires_at IS NOT NULL AND expires_at < NOW()
	`

	result, err := r.pool.Exec(ctx, query)
	if err != nil {
		return 0, fmt.Errorf("failed to cleanup expired snapshots: %w", err)
	}

	return int(result.RowsAffected()), nil
}
