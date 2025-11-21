package models

import (
	"time"

	"github.com/google/uuid"
)

// SyncStep represents a step in the sync process
type SyncStep string

const (
	SyncStepBrands         SyncStep = "brands"
	SyncStepCategories     SyncStep = "categories"
	SyncStepProducts       SyncStep = "products"
	SyncStepProperties     SyncStep = "properties"
	SyncStepPrices         SyncStep = "prices"
	SyncStepStock          SyncStep = "stock"
	SyncStepExchangeRates  SyncStep = "exchange_rates"
)

// AllSyncSteps returns all available sync steps in execution order
func AllSyncSteps() []SyncStep {
	return []SyncStep{
		SyncStepBrands,
		SyncStepCategories,
		SyncStepProducts,
		SyncStepProperties,
		SyncStepPrices,
		SyncStepStock,
		SyncStepExchangeRates,
	}
}

// FieldConfig defines which fields to sync for a specific step
type FieldConfig struct {
	IncludeFields    []string `json:"include_fields,omitempty"`    // If set, only these fields are synced
	ExcludeFields    []string `json:"exclude_fields,omitempty"`    // Fields to exclude from sync
	UpdateNullValues bool     `json:"update_null_values"`          // Whether to update fields with null values
}

// SyncConfiguration represents a reusable sync configuration
type SyncConfiguration struct {
	ID            uuid.UUID              `json:"id"`
	Name          string                 `json:"name"`
	Description   string                 `json:"description,omitempty"`
	SelectedSteps []SyncStep             `json:"selected_steps"`
	FieldConfig   map[SyncStep]FieldConfig `json:"field_config"`
	IsTemplate    bool                   `json:"is_template"`
	CreatedBy     string                 `json:"created_by,omitempty"`
	CreatedAt     time.Time              `json:"created_at"`
	UpdatedAt     time.Time              `json:"updated_at"`
	LastUsedAt    *time.Time             `json:"last_used_at,omitempty"`
}

// SyncChange represents a single change made during a selective sync
type SyncChange struct {
	ID            uuid.UUID     `json:"id"`
	SyncLogID     uuid.UUID     `json:"sync_log_id"`
	Step          SyncStep      `json:"step"`
	EntityType    string        `json:"entity_type"`    // 'brand', 'category', 'product', etc.
	EntityID      uuid.UUID     `json:"entity_id"`
	EntityUltraID string        `json:"entity_ultra_id,omitempty"`
	ChangeType    string        `json:"change_type"`    // 'insert', 'update', 'skip'
	FieldsChanged []FieldChange `json:"fields_changed"`
	CreatedAt     time.Time     `json:"created_at"`
}

// FieldChange represents a change to a single field
type FieldChange struct {
	FieldName string      `json:"field_name"`
	OldValue  interface{} `json:"old_value,omitempty"`
	NewValue  interface{} `json:"new_value,omitempty"`
	WasNull   bool        `json:"was_null"`
}

// SelectiveSyncRequest represents a request to perform a selective sync
type SelectiveSyncRequest struct {
	SelectedSteps    []SyncStep               `json:"selected_steps"`
	FieldConfig      map[SyncStep]FieldConfig `json:"field_config,omitempty"`
	SaveAsTemplate   bool                     `json:"save_as_template,omitempty"`
	TemplateName     string                   `json:"template_name,omitempty"`
	TemplateDesc     string                   `json:"template_description,omitempty"`
	ConfigurationID  *uuid.UUID               `json:"configuration_id,omitempty"`
}

// SyncFieldSchema defines the schema for syncable fields
type SyncFieldSchema struct {
	Step   SyncStep          `json:"step"`
	Fields []FieldDefinition `json:"fields"`
}

// FieldDefinition describes a syncable field
type FieldDefinition struct {
	Name         string   `json:"name"`
	DisplayName  string   `json:"display_name"`
	Type         string   `json:"type"`          // 'string', 'number', 'boolean', 'jsonb', 'uuid'
	Required     bool     `json:"required"`
	Description  string   `json:"description,omitempty"`
	Group        string   `json:"group,omitempty"`    // For grouping fields in UI
	DefaultSync  bool     `json:"default_sync"`       // Whether field is synced by default
	Dependencies []string `json:"dependencies,omitempty"` // Fields that must be included with this one
}

// SyncChangeSummary provides aggregated statistics for a sync
type SyncChangeSummary struct {
	SyncLogID     uuid.UUID          `json:"sync_log_id"`
	TotalChanges  int                `json:"total_changes"`
	ByStep        map[SyncStep]int   `json:"by_step"`
	ByChangeType  map[string]int     `json:"by_change_type"`
	ByEntityType  map[string]int     `json:"by_entity_type"`
	MostChangedFields []FieldChangeStat `json:"most_changed_fields"`
}

// FieldChangeStat tracks how many times a field was changed
type FieldChangeStat struct {
	FieldName   string `json:"field_name"`
	ChangeCount int    `json:"change_count"`
	Step        SyncStep `json:"step"`
}
