package models

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"ultra-api-testing/internal/constants"
)

// ============================================================================
// SYNC COMPARISON & DIFF MODELS
// ============================================================================

// SyncComparison represents a comparison between local and remote data
type SyncComparison struct {
	ID              uuid.UUID              `json:"id"`
	SyncRequestID   uuid.UUID              `json:"sync_request_id,omitempty"`
	Step            SyncStep               `json:"step"`
	TotalLocal      int                    `json:"total_local"`
	TotalRemote     int                    `json:"total_remote"`
	ToInsert        int                    `json:"to_insert"`
	ToUpdate        int                    `json:"to_update"`
	ToDelete        int                    `json:"to_delete"` // If deletions are enabled
	Unchanged       int                    `json:"unchanged"`
	Conflicts       int                    `json:"conflicts"`
	ComparedAt      time.Time              `json:"compared_at"`
	DiffDetails     []EntityDiff           `json:"diff_details,omitempty"`
}

// EntityDiff represents differences for a single entity
type EntityDiff struct {
	EntityType     string                 `json:"entity_type"`
	EntityID       *uuid.UUID             `json:"entity_id,omitempty"`
	EntityUltraID  string                 `json:"entity_ultra_id"`
	DiffType       string                 `json:"diff_type"` // 'insert', 'update', 'delete', 'conflict', 'unchanged'
	FieldDiffs     []FieldDiff            `json:"field_diffs,omitempty"`
	LocalData      map[string]interface{} `json:"local_data,omitempty"`
	RemoteData     map[string]interface{} `json:"remote_data,omitempty"`
	ConflictReason string                 `json:"conflict_reason,omitempty"`
}

// FieldDiff represents a difference in a single field
type FieldDiff struct {
	FieldName   string      `json:"field_name"`
	LocalValue  interface{} `json:"local_value"`
	RemoteValue interface{} `json:"remote_value"`
	DiffType    string      `json:"diff_type"` // 'added', 'removed', 'modified', 'conflict'
}

// ComparisonRequest represents a request to compare local and remote data
type ComparisonRequest struct {
	SelectedSteps []SyncStep               `json:"selected_steps"`
	FieldConfig   map[SyncStep]FieldConfig `json:"field_config,omitempty"`
	IncludeDetails bool                    `json:"include_details"` // Include field-level diffs
	DetailLimit    int                     `json:"detail_limit,omitempty"` // Limit diff details returned
}

// ============================================================================
// VALIDATION METHODS
// ============================================================================

// Validate validates a ComparisonRequest
func (r *ComparisonRequest) Validate() error {
	if len(r.SelectedSteps) == 0 {
		return fmt.Errorf("at least one step must be selected")
	}

	// Validate detail limit
	if r.DetailLimit > constants.MaxDetailLimit {
		return fmt.Errorf("detail_limit cannot exceed %d", constants.MaxDetailLimit)
	}

	return nil
}
