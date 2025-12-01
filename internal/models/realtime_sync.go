package models

import (
	"time"

	"github.com/google/uuid"
)

// ============================================================================
// REAL-TIME SYNC MONITORING MODELS
// ============================================================================

// LogLevel represents the severity level of a log entry
type LogLevel string

const (
	LogLevelDebug LogLevel = "debug"
	LogLevelInfo  LogLevel = "info"
	LogLevelWarn  LogLevel = "warn"
	LogLevelError LogLevel = "error"
	LogLevelFatal LogLevel = "fatal"
)

// SyncLogEntry represents a detailed log entry for real-time monitoring
type SyncLogEntry struct {
	ID         uuid.UUID `json:"id"`
	SyncLogID  uuid.UUID `json:"sync_log_id"`
	StepNumber *int      `json:"step_number,omitempty"`
	Level      LogLevel  `json:"level"`
	Message    string    `json:"message"`
	Details    JSONB     `json:"details,omitempty"`
	Timestamp  time.Time `json:"timestamp"`
	CreatedAt  time.Time `json:"created_at"`
}

// SyncProgressSnapshot represents a point-in-time progress snapshot
type SyncProgressSnapshot struct {
	ID                        uuid.UUID `json:"id"`
	SyncLogID                 uuid.UUID `json:"sync_log_id"`
	StepNumber                int       `json:"step_number"`
	StepName                  string    `json:"step_name"`
	ItemsProcessed            int       `json:"items_processed"`
	ItemsTotal                int       `json:"items_total"`
	ProgressPercentage        float64   `json:"progress_percentage"`
	ElapsedSeconds            int       `json:"elapsed_seconds"`
	EstimatedRemainingSeconds *int      `json:"estimated_remaining_seconds,omitempty"`
	ThroughputItemsPerSecond  *float64  `json:"throughput_items_per_second,omitempty"`
	MemoryUsageMB             *float64  `json:"memory_usage_mb,omitempty"`
	CreatedAt                 time.Time `json:"created_at"`
}

// SyncAPIRequest represents an API request/response log
type SyncAPIRequest struct {
	ID              uuid.UUID `json:"id"`
	SyncLogID       uuid.UUID `json:"sync_log_id"`
	StepNumber      *int      `json:"step_number,omitempty"`
	Method          string    `json:"method"`
	URL             string    `json:"url"`
	RequestHeaders  JSONB     `json:"request_headers,omitempty"`
	RequestBody     *string   `json:"request_body,omitempty"`
	ResponseStatus  *int      `json:"response_status,omitempty"`
	ResponseHeaders JSONB     `json:"response_headers,omitempty"`
	ResponseBody    *string   `json:"response_body,omitempty"`
	DurationMs      *int      `json:"duration_ms,omitempty"`
	ErrorMessage    *string   `json:"error_message,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
}

// RealtimeSyncProgress represents the current sync state for SSE streaming
type RealtimeSyncProgress struct {
	SyncLogID                 uuid.UUID            `json:"sync_log_id"`
	IsRunning                 bool                 `json:"is_running"`
	Status                    string               `json:"status"`
	SyncType                  string               `json:"sync_type"`
	CurrentStep               int                  `json:"current_step"`
	CurrentStepName           string               `json:"current_step_name"`
	OverallProgressPercentage float64              `json:"overall_progress_percentage"`
	ElapsedSeconds            int                  `json:"elapsed_seconds"`
	EstimatedRemainingSeconds *int                 `json:"estimated_remaining_seconds,omitempty"`
	SelectedSteps             []string             `json:"selected_steps,omitempty"`
	StartedAt                 time.Time            `json:"started_at"`
	FinishedAt                *time.Time           `json:"finished_at,omitempty"`
	ErrorMessage              *string              `json:"error_message,omitempty"`
	Steps                     []StepProgressDetail `json:"steps"`
	Statistics                SyncStatistics       `json:"statistics"`
	LastUpdated               time.Time            `json:"last_updated"`
}

// StepProgressDetail represents detailed progress for a single step
type StepProgressDetail struct {
	StepNumber               int        `json:"step_number"`
	StepName                 string     `json:"step_name"`
	Status                   string     `json:"status"`
	ItemsProcessed           int        `json:"items_processed"`
	ItemsTotal               int        `json:"items_total"`
	ProgressPercentage       float64    `json:"progress_percentage"`
	Extracted                int        `json:"extracted"`
	Inserted                 int        `json:"inserted"`
	Updated                  int        `json:"updated"`
	Failed                   int        `json:"failed"`
	ThroughputItemsPerSecond *float64   `json:"throughput_items_per_second,omitempty"`
	StartedAt                *time.Time `json:"started_at,omitempty"`
	CompletedAt              *time.Time `json:"completed_at,omitempty"`
	LastUpdatedAt            *time.Time `json:"last_updated_at,omitempty"`
}

// SyncStatistics represents aggregated sync statistics
type SyncStatistics struct {
	BrandsSynced       int `json:"brands_synced"`
	BrandsInserted     int `json:"brands_inserted"`
	BrandsUpdated      int `json:"brands_updated"`
	CategoriesSynced   int `json:"categories_synced"`
	CategoriesInserted int `json:"categories_inserted"`
	CategoriesUpdated  int `json:"categories_updated"`
	ProductsSynced     int `json:"products_synced"`
	ProductsInserted   int `json:"products_inserted"`
	ProductsUpdated    int `json:"products_updated"`
	PropertiesSynced   int `json:"properties_synced"`
	PropertiesInserted int `json:"properties_inserted"`
	PropertiesUpdated  int `json:"properties_updated"`
}

// SSEMessage represents a Server-Sent Event message
type SSEMessage struct {
	Event string      `json:"event"`
	Data  interface{} `json:"data"`
	ID    string      `json:"id,omitempty"`
}

// SSEEvent types for different message types
const (
	SSEEventProgress     = "progress"
	SSEEventLog          = "log"
	SSEEventStepStart    = "step_start"
	SSEEventStepComplete = "step_complete"
	SSEEventStepUpdate   = "step_update"
	SSEEventComplete     = "complete"
	SSEEventError        = "error"
	SSEEventHeartbeat    = "heartbeat"
)

// LogEntryFilter represents filters for querying log entries
type LogEntryFilter struct {
	SyncLogID   uuid.UUID  `json:"sync_log_id"`
	Levels      []LogLevel `json:"levels,omitempty"`
	StepNumbers []int      `json:"step_numbers,omitempty"`
	SearchQuery string     `json:"search_query,omitempty"`
	StartTime   *time.Time `json:"start_time,omitempty"`
	EndTime     *time.Time `json:"end_time,omitempty"`
	Limit       int        `json:"limit"`
	Offset      int        `json:"offset"`
}

// LogEntriesResponse represents paginated log entries response
type LogEntriesResponse struct {
	Data   []SyncLogEntry `json:"data"`
	Total  int            `json:"total"`
	Limit  int            `json:"limit"`
	Offset int            `json:"offset"`
}

// ProgressSnapshotsResponse represents paginated progress snapshots response
type ProgressSnapshotsResponse struct {
	Data   []SyncProgressSnapshot `json:"data"`
	Total  int                    `json:"total"`
	Limit  int                    `json:"limit"`
	Offset int                    `json:"offset"`
}

// APIRequestsResponse represents paginated API requests response
type APIRequestsResponse struct {
	Data   []SyncAPIRequest `json:"data"`
	Total  int              `json:"total"`
	Limit  int              `json:"limit"`
	Offset int              `json:"offset"`
}
