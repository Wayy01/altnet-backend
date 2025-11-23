package models

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"ultra-api-testing/internal/constants"
)

// ============================================================================
// ROLLBACK SYSTEM MODELS
// ============================================================================

// SyncSnapshot represents a database snapshot for rollback
type SyncSnapshot struct {
	ID           uuid.UUID              `json:"id"`
	SyncLogID    uuid.UUID              `json:"sync_log_id"`
	SnapshotType string                 `json:"snapshot_type"` // 'pre_sync', 'checkpoint'
	Step         *SyncStep              `json:"step,omitempty"`
	CreatedAt    time.Time              `json:"created_at"`
	ExpiresAt    *time.Time             `json:"expires_at,omitempty"`
	Metadata     map[string]interface{} `json:"metadata"`
}

// SyncSnapshotData represents entity data stored in a snapshot
type SyncSnapshotData struct {
	ID             uuid.UUID              `json:"id"`
	SnapshotID     uuid.UUID              `json:"snapshot_id"`
	EntityType     string                 `json:"entity_type"`
	EntityID       uuid.UUID              `json:"entity_id"`
	EntityUltraID  string                 `json:"entity_ultra_id,omitempty"`
	SnapshotData   map[string]interface{} `json:"snapshot_data"`
	CreatedAt      time.Time              `json:"created_at"`
}

// SyncRollback represents a rollback operation
type SyncRollback struct {
	ID                 uuid.UUID              `json:"id"`
	OriginalSyncLogID  uuid.UUID              `json:"original_sync_log_id"`
	SnapshotID         uuid.UUID              `json:"snapshot_id"`
	RollbackType       string                 `json:"rollback_type"` // 'full', 'partial', 'selective'
	RollbackScope      map[string]interface{} `json:"rollback_scope"`
	InitiatedBy        string                 `json:"initiated_by,omitempty"`
	Status             string                 `json:"status"` // 'pending', 'in_progress', 'completed', 'failed'
	StartedAt          time.Time              `json:"started_at"`
	CompletedAt        *time.Time             `json:"completed_at,omitempty"`
	EntitiesRestored   int                    `json:"entities_restored"`
	Errors             []string               `json:"errors"`
	Metadata           map[string]interface{} `json:"metadata"`
}

// RollbackRequest represents a request to rollback a sync
type RollbackRequest struct {
	SyncLogID     uuid.UUID `json:"sync_log_id"`
	RollbackType  string    `json:"rollback_type"` // 'full', 'partial', 'selective'
	EntityTypes   []string  `json:"entity_types,omitempty"` // For selective rollback
	EntityIDs     []uuid.UUID `json:"entity_ids,omitempty"` // For selective rollback
	ConfirmHash   string    `json:"confirm_hash"` // Security confirmation
	InitiatedBy   string    `json:"initiated_by,omitempty"`
}

// RollbackPreview represents a preview of what will be rolled back
type RollbackPreview struct {
	SnapshotID       uuid.UUID              `json:"snapshot_id"`
	SnapshotAge      time.Duration          `json:"snapshot_age"`
	TotalEntities    int                    `json:"total_entities"`
	EntitiesByType   map[string]int         `json:"entities_by_type"`
	AffectedRecords  int                    `json:"affected_records"`
	EstimatedTime    time.Duration          `json:"estimated_time"`
	Warnings         []string               `json:"warnings"`
	ConfirmHash      string                 `json:"confirm_hash"`
}

// ============================================================================
// VALIDATION METHODS
// ============================================================================

// Validate validates a RollbackRequest
func (r *RollbackRequest) Validate() error {
	if r.SyncLogID == uuid.Nil {
		return fmt.Errorf("sync_log_id is required")
	}

	if !constants.ValidRollbackTypes[r.RollbackType] {
		return fmt.Errorf(constants.ErrInvalidRollbackType)
	}

	if r.ConfirmHash == "" {
		return fmt.Errorf("confirm_hash is required for security")
	}

	if r.RollbackType == "selective" {
		if len(r.EntityTypes) == 0 && len(r.EntityIDs) == 0 {
			return fmt.Errorf("selective rollback requires entity_types or entity_ids")
		}

		// Validate entity types
		for _, entityType := range r.EntityTypes {
			if !constants.ValidEntityTypes[entityType] {
				return fmt.Errorf(constants.ErrInvalidEntityType)
			}
		}
	}

	return nil
}
