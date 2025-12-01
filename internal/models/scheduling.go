package models

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

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

// ScheduleUpdateRequest represents a request to update a schedule
type ScheduleUpdateRequest struct {
	Name               *string                `json:"name,omitempty"`
	Description        *string                `json:"description,omitempty"`
	ConfigurationID    *uuid.UUID             `json:"configuration_id,omitempty"`
	CronExpression     *string                `json:"cron_expression,omitempty"`
	Timezone           *string                `json:"timezone,omitempty"`
	IsActive           *bool                  `json:"is_active,omitempty"`
	RetryConfig        map[string]interface{} `json:"retry_config,omitempty"`
	NotificationConfig map[string]interface{} `json:"notification_config,omitempty"`
}

// ScheduleWithConfig represents a schedule with its associated configuration
type ScheduleWithConfig struct {
	*SyncSchedule
	ConfigurationName  string   `json:"configuration_name,omitempty"`
	ConfigurationSteps []string `json:"configuration_steps,omitempty"`
}

// ScheduleRunStatus constants
const (
	ScheduleRunStatusRunning   = "running"
	ScheduleRunStatusCompleted = "completed"
	ScheduleRunStatusFailed    = "failed"
	ScheduleRunStatusCancelled = "cancelled"
)

// Schedule status constants
const (
	ScheduleStatusSuccess = "success"
	ScheduleStatusFailed  = "failed"
	ScheduleStatusPartial = "partial"
)

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
	BrandIDs      []uuid.UUID `json:"brand_ids,omitempty"`
	BrandUltraIDs []string    `json:"brand_ultra_ids,omitempty"`
	BrandNames    []string    `json:"brand_names,omitempty"`

	// Category filters
	CategoryIDs      []uuid.UUID `json:"category_ids,omitempty"`
	CategoryUltraIDs []string    `json:"category_ultra_ids,omitempty"`
	CategoryNames    []string    `json:"category_names,omitempty"`

	// Product filters
	ProductIDs      []uuid.UUID `json:"product_ids,omitempty"`
	ProductUltraIDs []string    `json:"product_ultra_ids,omitempty"`
	ProductNames    []string    `json:"product_names,omitempty"`

	// Price range filters
	MinPrice *float64 `json:"min_price,omitempty"`
	MaxPrice *float64 `json:"max_price,omitempty"`
	Currency string   `json:"currency,omitempty"`

	// Stock filters
	InStock  *bool `json:"in_stock,omitempty"`
	MinStock *int  `json:"min_stock,omitempty"`
	MaxStock *int  `json:"max_stock,omitempty"`

	// Status filters
	IsActive  *bool `json:"is_active,omitempty"`
	IsService *bool `json:"is_service,omitempty"`

	// Date filters
	CreatedAfter  *time.Time `json:"created_after,omitempty"`
	CreatedBefore *time.Time `json:"created_before,omitempty"`
	UpdatedAfter  *time.Time `json:"updated_after,omitempty"`
	UpdatedBefore *time.Time `json:"updated_before,omitempty"`

	// Pattern matching
	NamePattern string `json:"name_pattern,omitempty"` // SQL LIKE pattern
	CodePattern string `json:"code_pattern,omitempty"`

	// Logical operators
	Operator   string           `json:"operator,omitempty"`    // 'AND', 'OR'
	SubFilters []FilterCriteria `json:"sub_filters,omitempty"` // For nested conditions
}

// ============================================================================
// INCREMENTAL SYNC MODELS
// ============================================================================

// EntitySyncTracking tracks last sync state for incremental sync
type EntitySyncTracking struct {
	EntityType     string    `json:"entity_type"`
	EntityID       uuid.UUID `json:"entity_id"`
	EntityUltraID  string    `json:"entity_ultra_id"`
	LastSyncedAt   time.Time `json:"last_synced_at"`
	LastModifiedAt time.Time `json:"last_modified_at"`
	SyncChecksum   string    `json:"sync_checksum,omitempty"`
}

// ============================================================================
// MONITORING & ALERTS MODELS
// ============================================================================

// NOTE: SyncNotification has been moved to notification.go with extended fields

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
	Period              string             `json:"period"` // 'day', 'week', 'month'
	TotalSyncs          int                `json:"total_syncs"`
	SuccessfulSyncs     int                `json:"successful_syncs"`
	FailedSyncs         int                `json:"failed_syncs"`
	AverageDuration     float64            `json:"average_duration"`
	TotalEntitiesSynced int                `json:"total_entities_synced"`
	ByStep              map[SyncStep]int   `json:"by_step"`
	TotalConflicts      int                `json:"total_conflicts"`
	TotalRollbacks      int                `json:"total_rollbacks"`
	PerformanceTrend    []PerformancePoint `json:"performance_trend"`
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
	CurrentStep            SyncStep      `json:"current_step"`
	TotalSteps             int           `json:"total_steps"`
	CompletedSteps         int           `json:"completed_steps"`
	CurrentProgress        int           `json:"current_progress"` // Percentage 0-100
	TotalEntities          int           `json:"total_entities"`
	ProcessedCount         int           `json:"processed_count"`
	InsertedCount          int           `json:"inserted_count"`
	UpdatedCount           int           `json:"updated_count"`
	SkippedCount           int           `json:"skipped_count"`
	FailedCount            int           `json:"failed_count"`
	SelectedSteps          []string      `json:"selected_steps,omitempty"`
	EstimatedTimeRemaining time.Duration `json:"estimated_time_remaining,omitempty"`
}

// ============================================================================
// VALIDATION METHODS
// ============================================================================

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

// Validate validates a ScheduleUpdateRequest
func (r *ScheduleUpdateRequest) Validate() error {
	// If name is provided, it cannot be empty
	if r.Name != nil && *r.Name == "" {
		return fmt.Errorf("name cannot be empty")
	}

	// If cron expression is provided, validate it
	if r.CronExpression != nil {
		if len(*r.CronExpression) < 9 { // Minimum: "* * * * *"
			return fmt.Errorf("invalid cron expression format")
		}
	}

	return nil
}
