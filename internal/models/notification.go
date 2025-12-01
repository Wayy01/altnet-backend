package models

import (
	"time"

	"github.com/google/uuid"
)

// ============================================================================
// SYNC NOTIFICATION MODELS
// ============================================================================

// NotificationType constants for different notification types
const (
	NotificationTypeSyncComplete     = "sync_complete"
	NotificationTypeSyncFailed       = "sync_failed"
	NotificationTypeSyncStarted      = "sync_started"
	NotificationTypeConflictsFound   = "conflicts_found"
	NotificationTypeScheduleExecuted = "schedule_executed"
	NotificationTypeScheduleFailed   = "schedule_failed"
	NotificationTypeRollbackComplete = "rollback_complete"
	NotificationTypeWarning          = "warning"
	NotificationTypeInfo             = "info"
)

// NotificationStatus constants
const (
	NotificationStatusPending = "pending"
	NotificationStatusSent    = "sent"
	NotificationStatusRead    = "read"
	NotificationStatusFailed  = "failed"
)

// NotificationChannel constants for delivery channels
const (
	NotificationChannelInApp   = "in_app"
	NotificationChannelEmail   = "email"
	NotificationChannelSlack   = "slack"
	NotificationChannelWebhook = "webhook"
)

// SyncNotification represents a notification in the database
// Maps to the sync_notifications table
type SyncNotification struct {
	ID               uuid.UUID              `json:"id"`
	SyncLogID        *uuid.UUID             `json:"sync_log_id,omitempty"`
	NotificationType string                 `json:"notification_type"`
	Title            string                 `json:"title"`
	Message          string                 `json:"message"`
	Recipient        string                 `json:"recipient"`
	Status           string                 `json:"status"`
	IsRead           bool                   `json:"is_read"`
	SentAt           *time.Time             `json:"sent_at,omitempty"`
	ReadAt           *time.Time             `json:"read_at,omitempty"`
	ErrorMessage     *string                `json:"error_message,omitempty"`
	Metadata         map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt        time.Time              `json:"created_at"`
}

// NotificationCreateRequest represents a request to create a notification
type NotificationCreateRequest struct {
	SyncLogID        *uuid.UUID             `json:"sync_log_id,omitempty"`
	NotificationType string                 `json:"notification_type"`
	Title            string                 `json:"title"`
	Message          string                 `json:"message"`
	Recipient        string                 `json:"recipient"`
	Metadata         map[string]interface{} `json:"metadata,omitempty"`
}

// NotificationListResponse represents a paginated list of notifications
type NotificationListResponse struct {
	Data        []*SyncNotification `json:"data"`
	Total       int                 `json:"total"`
	UnreadCount int                 `json:"unread_count"`
	Limit       int                 `json:"limit"`
	Offset      int                 `json:"offset"`
}

// NotificationCountResponse represents the count of unread notifications
type NotificationCountResponse struct {
	UnreadCount int `json:"unread_count"`
	TotalCount  int `json:"total_count"`
}

// NotificationPreferences represents user preferences for notifications
type NotificationPreferences struct {
	EnableInApp          bool     `json:"enable_in_app"`
	EnableEmail          bool     `json:"enable_email"`
	EnableSlack          bool     `json:"enable_slack"`
	EnableWebhook        bool     `json:"enable_webhook"`
	EmailAddress         string   `json:"email_address,omitempty"`
	SlackWebhookURL      string   `json:"slack_webhook_url,omitempty"`
	WebhookURL           string   `json:"webhook_url,omitempty"`
	NotifyOnSyncStart    bool     `json:"notify_on_sync_start"`
	NotifyOnSyncComplete bool     `json:"notify_on_sync_complete"`
	NotifyOnSyncFailure  bool     `json:"notify_on_sync_failure"`
	NotifyOnConflicts    bool     `json:"notify_on_conflicts"`
	NotifyOnSchedule     bool     `json:"notify_on_schedule"`
	MinimumSeverity      string   `json:"minimum_severity,omitempty"` // info, warning, error
	MutedTypes           []string `json:"muted_types,omitempty"`
}

// NotificationTrigger defines when to trigger notifications
type NotificationTrigger struct {
	Event      string                 `json:"event"`      // sync_complete, sync_failed, etc.
	Conditions map[string]interface{} `json:"conditions"` // e.g., {"min_changes": 100}
	Channels   []string               `json:"channels"`   // ["in_app", "email"]
	Template   string                 `json:"template"`   // Message template
	IsEnabled  bool                   `json:"is_enabled"`
}

// NotificationStats represents aggregated notification statistics
type NotificationStats struct {
	TotalNotifications  int            `json:"total_notifications"`
	UnreadNotifications int            `json:"unread_notifications"`
	ReadNotifications   int            `json:"read_notifications"`
	ByType              map[string]int `json:"by_type"`
	Last24Hours         int            `json:"last_24_hours"`
	Last7Days           int            `json:"last_7_days"`
}

// SSE notification event types
const (
	SSEEventNewNotification    = "new_notification"
	SSEEventNotificationUpdate = "notification_update"
	SSEEventNotificationCount  = "notification_count"
)

// NotificationSSEMessage represents a notification SSE message
type NotificationSSEMessage struct {
	Event string      `json:"event"`
	Data  interface{} `json:"data"`
	ID    string      `json:"id,omitempty"`
}

// SyncCompletionStats represents sync statistics included in notifications
type SyncCompletionStats struct {
	SyncLogID          uuid.UUID `json:"sync_log_id"`
	SyncType           string    `json:"sync_type"`
	Status             string    `json:"status"`
	DurationSeconds    int       `json:"duration_seconds"`
	BrandsInserted     int       `json:"brands_inserted"`
	BrandsUpdated      int       `json:"brands_updated"`
	CategoriesInserted int       `json:"categories_inserted"`
	CategoriesUpdated  int       `json:"categories_updated"`
	ProductsInserted   int       `json:"products_inserted"`
	ProductsUpdated    int       `json:"products_updated"`
	PropertiesInserted int       `json:"properties_inserted"`
	PropertiesUpdated  int       `json:"properties_updated"`
	TotalChanges       int       `json:"total_changes"`
	ConflictsFound     int       `json:"conflicts_found"`
}

// Validate validates a NotificationCreateRequest
func (r *NotificationCreateRequest) Validate() error {
	if r.NotificationType == "" {
		return &ValidationError{Field: "notification_type", Message: "notification type is required"}
	}
	if r.Title == "" {
		return &ValidationError{Field: "title", Message: "title is required"}
	}
	if r.Message == "" {
		return &ValidationError{Field: "message", Message: "message is required"}
	}
	if r.Recipient == "" {
		return &ValidationError{Field: "recipient", Message: "recipient is required"}
	}
	return nil
}

// ValidationError represents a validation error
type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

func (e *ValidationError) Error() string {
	return e.Field + ": " + e.Message
}
