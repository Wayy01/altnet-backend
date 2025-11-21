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
// CONFLICT RESOLUTION MODELS
// ============================================================================

// SyncConflict represents a conflict detected during sync
type SyncConflict struct {
	ID                   uuid.UUID              `json:"id"`
	SyncLogID            uuid.UUID              `json:"sync_log_id"`
	Step                 SyncStep               `json:"step"`
	EntityType           string                 `json:"entity_type"`
	EntityID             uuid.UUID              `json:"entity_id"`
	EntityUltraID        string                 `json:"entity_ultra_id,omitempty"`
	ConflictType         string                 `json:"conflict_type"` // 'concurrent_modification', 'deleted_upstream', 'validation_error'
	LocalData            map[string]interface{} `json:"local_data"`
	RemoteData           map[string]interface{} `json:"remote_data"`
	LocalModifiedAt      *time.Time             `json:"local_modified_at,omitempty"`
	RemoteModifiedAt     *time.Time             `json:"remote_modified_at,omitempty"`
	ResolutionStrategy   string                 `json:"resolution_strategy,omitempty"` // 'local_wins', 'remote_wins', 'merge', 'manual'
	ResolutionApplied    bool                   `json:"resolution_applied"`
	ResolvedAt           *time.Time             `json:"resolved_at,omitempty"`
	ResolvedBy           string                 `json:"resolved_by,omitempty"`
	ResolvedData         map[string]interface{} `json:"resolved_data,omitempty"`
	CreatedAt            time.Time              `json:"created_at"`
	Metadata             map[string]interface{} `json:"metadata"`
}

// SyncConflictRule represents an automatic conflict resolution rule
type SyncConflictRule struct {
	ID                uuid.UUID              `json:"id"`
	Name              string                 `json:"name"`
	EntityType        string                 `json:"entity_type"`
	ConflictType      string                 `json:"conflict_type"`
	Priority          int                    `json:"priority"`
	Conditions        map[string]interface{} `json:"conditions"`
	ResolutionStrategy string                `json:"resolution_strategy"` // 'local_wins', 'remote_wins', 'merge', 'skip'
	MergeStrategy     map[string]interface{} `json:"merge_strategy"`
	IsActive          bool                   `json:"is_active"`
	CreatedBy         string                 `json:"created_by,omitempty"`
	CreatedAt         time.Time              `json:"created_at"`
	UpdatedAt         time.Time              `json:"updated_at"`
}

// ConflictResolutionRequest represents a request to resolve conflicts
type ConflictResolutionRequest struct {
	ConflictIDs         []uuid.UUID            `json:"conflict_ids"`
	ResolutionStrategy  string                 `json:"resolution_strategy"`
	CustomResolution    map[string]interface{} `json:"custom_resolution,omitempty"` // For manual resolution
	ApplyToSimilar      bool                   `json:"apply_to_similar"` // Apply same strategy to similar conflicts
	ResolvedBy          string                 `json:"resolved_by,omitempty"`
}

// ============================================================================
// SCHEDULED SYNC MODELS
// ============================================================================

// SyncSchedule represents a scheduled sync job
type SyncSchedule struct {
	ID                 uuid.UUID              `json:"id"`
	Name               string                 `json:"name"`
	Description        string                 `json:"description,omitempty"`
	ConfigurationID    *uuid.UUID             `json:"configuration_id,omitempty"`
	CronExpression     string                 `json:"cron_expression"`
	Timezone           string                 `json:"timezone"`
	IsActive           bool                   `json:"is_active"`
	LastRunAt          *time.Time             `json:"last_run_at,omitempty"`
	NextRunAt          *time.Time             `json:"next_run_at,omitempty"`
	LastStatus         string                 `json:"last_status,omitempty"`
	RunCount           int                    `json:"run_count"`
	FailureCount       int                    `json:"failure_count"`
	RetryConfig        map[string]interface{} `json:"retry_config"`
	NotificationConfig map[string]interface{} `json:"notification_config"`
	CreatedBy          string                 `json:"created_by,omitempty"`
	CreatedAt          time.Time              `json:"created_at"`
	UpdatedAt          time.Time              `json:"updated_at"`
}

// SyncScheduleRun represents a single execution of a scheduled sync
type SyncScheduleRun struct {
	ID                uuid.UUID              `json:"id"`
	ScheduleID        uuid.UUID              `json:"schedule_id"`
	SyncLogID         *uuid.UUID             `json:"sync_log_id,omitempty"`
	StartedAt         time.Time              `json:"started_at"`
	CompletedAt       *time.Time             `json:"completed_at,omitempty"`
	Status            string                 `json:"status"` // 'running', 'completed', 'failed', 'cancelled'
	RetryCount        int                    `json:"retry_count"`
	ErrorMessage      string                 `json:"error_message,omitempty"`
	ExecutionMetadata map[string]interface{} `json:"execution_metadata"`
}

// ScheduleCreateRequest represents a request to create a schedule
type ScheduleCreateRequest struct {
	Name               string                 `json:"name"`
	Description        string                 `json:"description,omitempty"`
	ConfigurationID    *uuid.UUID             `json:"configuration_id,omitempty"`
	CronExpression     string                 `json:"cron_expression"`
	Timezone           string                 `json:"timezone"`
	RetryConfig        map[string]interface{} `json:"retry_config,omitempty"`
	NotificationConfig map[string]interface{} `json:"notification_config,omitempty"`
	CreatedBy          string                 `json:"created_by,omitempty"`
}

// ============================================================================
// ADVANCED FILTERING MODELS
// ============================================================================

// SyncEntityFilter represents advanced entity-level filters
type SyncEntityFilter struct {
	ID              uuid.UUID              `json:"id"`
	ConfigurationID *uuid.UUID             `json:"configuration_id,omitempty"`
	EntityType      string                 `json:"entity_type"`
	FilterType      string                 `json:"filter_type"` // 'include', 'exclude'
	FilterCriteria  map[string]interface{} `json:"filter_criteria"`
	CreatedAt       time.Time              `json:"created_at"`
}

// FilterCriteria represents filter conditions
type FilterCriteria struct {
	// Brand filters
	BrandIDs       []uuid.UUID `json:"brand_ids,omitempty"`
	BrandUltraIDs  []string    `json:"brand_ultra_ids,omitempty"`
	BrandNames     []string    `json:"brand_names,omitempty"`

	// Category filters
	CategoryIDs      []uuid.UUID `json:"category_ids,omitempty"`
	CategoryUltraIDs []string    `json:"category_ultra_ids,omitempty"`
	CategoryNames    []string    `json:"category_names,omitempty"`

	// Product filters
	ProductIDs       []uuid.UUID `json:"product_ids,omitempty"`
	ProductUltraIDs  []string    `json:"product_ultra_ids,omitempty"`
	ProductNames     []string    `json:"product_names,omitempty"`

	// Price range filters
	MinPrice         *float64    `json:"min_price,omitempty"`
	MaxPrice         *float64    `json:"max_price,omitempty"`
	Currency         string      `json:"currency,omitempty"`

	// Stock filters
	InStock          *bool       `json:"in_stock,omitempty"`
	MinStock         *int        `json:"min_stock,omitempty"`
	MaxStock         *int        `json:"max_stock,omitempty"`

	// Status filters
	IsActive         *bool       `json:"is_active,omitempty"`
	IsService        *bool       `json:"is_service,omitempty"`

	// Date filters
	CreatedAfter     *time.Time  `json:"created_after,omitempty"`
	CreatedBefore    *time.Time  `json:"created_before,omitempty"`
	UpdatedAfter     *time.Time  `json:"updated_after,omitempty"`
	UpdatedBefore    *time.Time  `json:"updated_before,omitempty"`

	// Pattern matching
	NamePattern      string      `json:"name_pattern,omitempty"` // SQL LIKE pattern
	CodePattern      string      `json:"code_pattern,omitempty"`

	// Logical operators
	Operator         string      `json:"operator,omitempty"` // 'AND', 'OR'
	SubFilters       []FilterCriteria `json:"sub_filters,omitempty"` // For nested conditions
}

// ============================================================================
// INCREMENTAL SYNC MODELS
// ============================================================================

// EntitySyncTracking tracks last sync state for incremental sync
type EntitySyncTracking struct {
	EntityType      string    `json:"entity_type"`
	EntityID        uuid.UUID `json:"entity_id"`
	EntityUltraID   string    `json:"entity_ultra_id"`
	LastSyncedAt    time.Time `json:"last_synced_at"`
	LastModifiedAt  time.Time `json:"last_modified_at"`
	SyncChecksum    string    `json:"sync_checksum,omitempty"`
}

// ============================================================================
// MONITORING & ALERTS MODELS
// ============================================================================

// SyncNotification represents a notification to be sent
type SyncNotification struct {
	ID               uuid.UUID              `json:"id"`
	SyncLogID        *uuid.UUID             `json:"sync_log_id,omitempty"`
	NotificationType string                 `json:"notification_type"` // 'email', 'slack', 'webhook', 'push'
	Recipient        string                 `json:"recipient"`
	Status           string                 `json:"status"` // 'pending', 'sent', 'failed'
	SentAt           *time.Time             `json:"sent_at,omitempty"`
	ErrorMessage     string                 `json:"error_message,omitempty"`
	Metadata         map[string]interface{} `json:"metadata"`
	CreatedAt        time.Time              `json:"created_at"`
}

// SyncPerformanceMetric represents a performance metric
type SyncPerformanceMetric struct {
	ID          uuid.UUID              `json:"id"`
	SyncLogID   uuid.UUID              `json:"sync_log_id"`
	Step        *SyncStep              `json:"step,omitempty"`
	MetricName  string                 `json:"metric_name"`
	MetricValue float64                `json:"metric_value"`
	MetricUnit  string                 `json:"metric_unit,omitempty"`
	RecordedAt  time.Time              `json:"recorded_at"`
	Metadata    map[string]interface{} `json:"metadata"`
}

// SyncAnalytics represents aggregated sync analytics
type SyncAnalytics struct {
	Period            string              `json:"period"` // 'day', 'week', 'month'
	TotalSyncs        int                 `json:"total_syncs"`
	SuccessfulSyncs   int                 `json:"successful_syncs"`
	FailedSyncs       int                 `json:"failed_syncs"`
	AverageDuration   float64             `json:"average_duration"`
	TotalEntitiesSynced int               `json:"total_entities_synced"`
	ByStep            map[SyncStep]int    `json:"by_step"`
	TotalConflicts    int                 `json:"total_conflicts"`
	TotalRollbacks    int                 `json:"total_rollbacks"`
	PerformanceTrend  []PerformancePoint  `json:"performance_trend"`
}

// PerformancePoint represents a single data point in performance trend
type PerformancePoint struct {
	Timestamp time.Time `json:"timestamp"`
	Value     float64   `json:"value"`
	Label     string    `json:"label,omitempty"`
}

// NotificationRequest represents a request to send notifications
type NotificationRequest struct {
	SyncLogID        *uuid.UUID             `json:"sync_log_id,omitempty"`
	NotificationType string                 `json:"notification_type"`
	Recipients       []string               `json:"recipients"`
	Message          string                 `json:"message,omitempty"`
	Metadata         map[string]interface{} `json:"metadata,omitempty"`
}

// WebSocketMessage represents a real-time sync update message
type WebSocketMessage struct {
	Type      string                 `json:"type"` // 'sync_start', 'sync_progress', 'sync_complete', 'sync_error'
	SyncLogID uuid.UUID              `json:"sync_log_id"`
	Step      *SyncStep              `json:"step,omitempty"`
	Progress  *SyncProgress          `json:"progress,omitempty"`
	Data      map[string]interface{} `json:"data,omitempty"`
	Timestamp time.Time              `json:"timestamp"`
}

// SyncProgress represents current sync progress
type SyncProgress struct {
	CurrentStep     SyncStep `json:"current_step"`
	TotalSteps      int      `json:"total_steps"`
	CompletedSteps  int      `json:"completed_steps"`
	CurrentProgress int      `json:"current_progress"` // Percentage 0-100
	TotalEntities   int      `json:"total_entities"`
	ProcessedCount  int      `json:"processed_count"`
	InsertedCount   int      `json:"inserted_count"`
	UpdatedCount    int      `json:"updated_count"`
	SkippedCount    int      `json:"skipped_count"`
	FailedCount     int      `json:"failed_count"`
	EstimatedTimeRemaining time.Duration `json:"estimated_time_remaining,omitempty"`
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

// Validate validates a ScheduleCreateRequest
func (r *ScheduleCreateRequest) Validate() error {
	if r.Name == "" {
		return fmt.Errorf("name is required")
	}

	if r.CronExpression == "" {
		return fmt.Errorf("cron_expression is required")
	}

	// Basic cron expression validation (5 or 6 fields)
	// Full validation would require a cron parsing library
	// This is a basic check to prevent obviously invalid input
	if len(r.CronExpression) < 9 { // Minimum: "* * * * *"
		return fmt.Errorf("invalid cron expression format")
	}

	return nil
}
