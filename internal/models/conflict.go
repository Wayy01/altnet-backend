package models

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"ultra-api-testing/internal/constants"
)

// ============================================================================
// CONFLICT RESOLUTION MODELS
// ============================================================================

// SyncConflict represents a conflict detected during sync
type SyncConflict struct {
	ID                 uuid.UUID              `json:"id"`
	SyncLogID          uuid.UUID              `json:"sync_log_id"`
	Step               SyncStep               `json:"step"`
	EntityType         string                 `json:"entity_type"`
	EntityID           uuid.UUID              `json:"entity_id"`
	EntityUltraID      string                 `json:"entity_ultra_id,omitempty"`
	ConflictType       string                 `json:"conflict_type"` // 'concurrent_modification', 'deleted_upstream', 'validation_error'
	LocalData          map[string]interface{} `json:"local_data"`
	RemoteData         map[string]interface{} `json:"remote_data"`
	LocalModifiedAt    *time.Time             `json:"local_modified_at,omitempty"`
	RemoteModifiedAt   *time.Time             `json:"remote_modified_at,omitempty"`
	ResolutionStrategy string                 `json:"resolution_strategy,omitempty"` // 'local_wins', 'remote_wins', 'merge', 'manual'
	ResolutionApplied  bool                   `json:"resolution_applied"`
	ResolvedAt         *time.Time             `json:"resolved_at,omitempty"`
	ResolvedBy         string                 `json:"resolved_by,omitempty"`
	ResolvedData       map[string]interface{} `json:"resolved_data,omitempty"`
	CreatedAt          time.Time              `json:"created_at"`
	Metadata           map[string]interface{} `json:"metadata"`
}

// SyncConflictRule represents an automatic conflict resolution rule
type SyncConflictRule struct {
	ID                 uuid.UUID              `json:"id"`
	Name               string                 `json:"name"`
	EntityType         string                 `json:"entity_type"`
	ConflictType       string                 `json:"conflict_type"`
	Priority           int                    `json:"priority"`
	Conditions         map[string]interface{} `json:"conditions"`
	ResolutionStrategy string                 `json:"resolution_strategy"` // 'local_wins', 'remote_wins', 'merge', 'skip'
	MergeStrategy      map[string]interface{} `json:"merge_strategy"`
	IsActive           bool                   `json:"is_active"`
	CreatedBy          string                 `json:"created_by,omitempty"`
	CreatedAt          time.Time              `json:"created_at"`
	UpdatedAt          time.Time              `json:"updated_at"`
}

// ConflictResolutionRequest represents a request to resolve conflicts
type ConflictResolutionRequest struct {
	ConflictIDs        []uuid.UUID            `json:"conflict_ids"`
	ResolutionStrategy string                 `json:"resolution_strategy"`
	CustomResolution   map[string]interface{} `json:"custom_resolution,omitempty"` // For manual resolution
	ApplyToSimilar     bool                   `json:"apply_to_similar"`            // Apply same strategy to similar conflicts
	ResolvedBy         string                 `json:"resolved_by,omitempty"`
}

// ============================================================================
// VALIDATION METHODS
// ============================================================================

// Validate validates a ConflictResolutionRequest
func (r *ConflictResolutionRequest) Validate() error {
	if len(r.ConflictIDs) == 0 {
		return fmt.Errorf("at least one conflict ID must be provided")
	}

	if !constants.ValidResolutionStrategies[r.ResolutionStrategy] {
		return fmt.Errorf(constants.ErrInvalidResolutionStrategy)
	}

	if r.ResolutionStrategy == "manual" && r.CustomResolution == nil {
		return fmt.Errorf("custom_resolution is required for manual strategy")
	}

	return nil
}

// Validate validates a SyncConflictRule
func (r *SyncConflictRule) Validate() error {
	if r.Name == "" {
		return fmt.Errorf("name is required")
	}

	if !constants.ValidEntityTypes[r.EntityType] {
		return fmt.Errorf(constants.ErrInvalidEntityType)
	}

	if !constants.ValidConflictTypes[r.ConflictType] {
		return fmt.Errorf(constants.ErrInvalidConflictType)
	}

	if !constants.ValidResolutionStrategies[r.ResolutionStrategy] {
		return fmt.Errorf(constants.ErrInvalidResolutionStrategy)
	}

	return nil
}
