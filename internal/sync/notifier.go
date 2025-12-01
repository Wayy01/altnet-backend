package sync

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"ultra-api-testing/internal/models"
	"ultra-api-testing/internal/repository"
)

// Notifier handles creating notifications for sync events
type Notifier struct {
	notificationRepo *repository.NotificationRepository
	defaultRecipient string
}

// NewNotifier creates a new sync notifier
func NewNotifier(notificationRepo *repository.NotificationRepository) *Notifier {
	return &Notifier{
		notificationRepo: notificationRepo,
		defaultRecipient: "system", // Default recipient for all notifications
	}
}

// SetDefaultRecipient sets the default recipient for notifications
func (n *Notifier) SetDefaultRecipient(recipient string) {
	n.defaultRecipient = recipient
}

// NotifySyncStarted creates a notification when a sync starts
func (n *Notifier) NotifySyncStarted(ctx context.Context, syncLogID uuid.UUID, syncType string, selectedSteps []string) (*models.SyncNotification, error) {
	title := "Sync Started"
	message := fmt.Sprintf("A %s sync operation has started", syncType)

	if len(selectedSteps) > 0 {
		message = fmt.Sprintf("A selective sync has started with steps: %v", selectedSteps)
	}

	req := &models.NotificationCreateRequest{
		SyncLogID:        &syncLogID,
		NotificationType: models.NotificationTypeSyncStarted,
		Title:            title,
		Message:          message,
		Recipient:        n.defaultRecipient,
		Metadata: map[string]interface{}{
			"sync_type":      syncType,
			"selected_steps": selectedSteps,
			"started_at":     time.Now().Format(time.RFC3339),
		},
	}

	return n.notificationRepo.CreateNotification(ctx, req)
}

// NotifySyncComplete creates a notification when a sync completes successfully
func (n *Notifier) NotifySyncComplete(ctx context.Context, syncLogID uuid.UUID, stats *models.SyncCompletionStats) (*models.SyncNotification, error) {
	title := "Sync Completed"

	// Build a summary message
	totalChanges := stats.BrandsInserted + stats.BrandsUpdated +
		stats.CategoriesInserted + stats.CategoriesUpdated +
		stats.ProductsInserted + stats.ProductsUpdated +
		stats.PropertiesInserted + stats.PropertiesUpdated

	var message string
	if totalChanges == 0 {
		message = fmt.Sprintf("Sync completed in %d seconds with no changes", stats.DurationSeconds)
	} else {
		message = fmt.Sprintf("Sync completed in %d seconds with %d total changes", stats.DurationSeconds, totalChanges)
	}

	// Build detailed metadata
	metadata := map[string]interface{}{
		"sync_log_id":         stats.SyncLogID.String(),
		"sync_type":           stats.SyncType,
		"status":              stats.Status,
		"duration_seconds":    stats.DurationSeconds,
		"brands_inserted":     stats.BrandsInserted,
		"brands_updated":      stats.BrandsUpdated,
		"categories_inserted": stats.CategoriesInserted,
		"categories_updated":  stats.CategoriesUpdated,
		"products_inserted":   stats.ProductsInserted,
		"products_updated":    stats.ProductsUpdated,
		"properties_inserted": stats.PropertiesInserted,
		"properties_updated":  stats.PropertiesUpdated,
		"total_changes":       totalChanges,
		"conflicts_found":     stats.ConflictsFound,
		"completed_at":        time.Now().Format(time.RFC3339),
	}

	req := &models.NotificationCreateRequest{
		SyncLogID:        &syncLogID,
		NotificationType: models.NotificationTypeSyncComplete,
		Title:            title,
		Message:          message,
		Recipient:        n.defaultRecipient,
		Metadata:         metadata,
	}

	return n.notificationRepo.CreateNotification(ctx, req)
}

// NotifySyncFailed creates a notification when a sync fails
func (n *Notifier) NotifySyncFailed(ctx context.Context, syncLogID uuid.UUID, errorMsg string, durationSeconds int) (*models.SyncNotification, error) {
	title := "Sync Failed"
	message := fmt.Sprintf("Sync failed after %d seconds: %s", durationSeconds, truncateString(errorMsg, 200))

	req := &models.NotificationCreateRequest{
		SyncLogID:        &syncLogID,
		NotificationType: models.NotificationTypeSyncFailed,
		Title:            title,
		Message:          message,
		Recipient:        n.defaultRecipient,
		Metadata: map[string]interface{}{
			"sync_log_id":      syncLogID.String(),
			"error_message":    errorMsg,
			"duration_seconds": durationSeconds,
			"failed_at":        time.Now().Format(time.RFC3339),
		},
	}

	return n.notificationRepo.CreateNotification(ctx, req)
}

// NotifyConflictsDetected creates a notification when conflicts are found during sync
func (n *Notifier) NotifyConflictsDetected(ctx context.Context, syncLogID uuid.UUID, conflictCount int, conflictDetails map[string]int) (*models.SyncNotification, error) {
	title := "Sync Conflicts Detected"
	message := fmt.Sprintf("%d conflicts were detected during sync and require attention", conflictCount)

	metadata := map[string]interface{}{
		"sync_log_id":      syncLogID.String(),
		"conflict_count":   conflictCount,
		"conflict_details": conflictDetails,
		"detected_at":      time.Now().Format(time.RFC3339),
	}

	req := &models.NotificationCreateRequest{
		SyncLogID:        &syncLogID,
		NotificationType: models.NotificationTypeConflictsFound,
		Title:            title,
		Message:          message,
		Recipient:        n.defaultRecipient,
		Metadata:         metadata,
	}

	return n.notificationRepo.CreateNotification(ctx, req)
}

// NotifyScheduleExecuted creates a notification when a scheduled sync executes
func (n *Notifier) NotifyScheduleExecuted(ctx context.Context, scheduleID uuid.UUID, scheduleName string, syncLogID uuid.UUID, status string) (*models.SyncNotification, error) {
	var title, message string
	var notificationType string

	if status == "success" || status == "completed" {
		title = "Scheduled Sync Completed"
		message = fmt.Sprintf("Scheduled sync '%s' completed successfully", scheduleName)
		notificationType = models.NotificationTypeScheduleExecuted
	} else {
		title = "Scheduled Sync Failed"
		message = fmt.Sprintf("Scheduled sync '%s' failed with status: %s", scheduleName, status)
		notificationType = models.NotificationTypeScheduleFailed
	}

	req := &models.NotificationCreateRequest{
		SyncLogID:        &syncLogID,
		NotificationType: notificationType,
		Title:            title,
		Message:          message,
		Recipient:        n.defaultRecipient,
		Metadata: map[string]interface{}{
			"schedule_id":   scheduleID.String(),
			"schedule_name": scheduleName,
			"sync_log_id":   syncLogID.String(),
			"status":        status,
			"executed_at":   time.Now().Format(time.RFC3339),
		},
	}

	return n.notificationRepo.CreateNotification(ctx, req)
}

// NotifyRollbackComplete creates a notification when a rollback completes
func (n *Notifier) NotifyRollbackComplete(ctx context.Context, syncLogID uuid.UUID, rollbackID uuid.UUID, entitiesRestored int) (*models.SyncNotification, error) {
	title := "Rollback Completed"
	message := fmt.Sprintf("Rollback completed successfully, %d entities restored", entitiesRestored)

	req := &models.NotificationCreateRequest{
		SyncLogID:        &syncLogID,
		NotificationType: models.NotificationTypeRollbackComplete,
		Title:            title,
		Message:          message,
		Recipient:        n.defaultRecipient,
		Metadata: map[string]interface{}{
			"sync_log_id":       syncLogID.String(),
			"rollback_id":       rollbackID.String(),
			"entities_restored": entitiesRestored,
			"completed_at":      time.Now().Format(time.RFC3339),
		},
	}

	return n.notificationRepo.CreateNotification(ctx, req)
}

// NotifyWarning creates a warning notification
func (n *Notifier) NotifyWarning(ctx context.Context, syncLogID *uuid.UUID, title, message string, metadata map[string]interface{}) (*models.SyncNotification, error) {
	if metadata == nil {
		metadata = make(map[string]interface{})
	}
	metadata["created_at"] = time.Now().Format(time.RFC3339)

	req := &models.NotificationCreateRequest{
		SyncLogID:        syncLogID,
		NotificationType: models.NotificationTypeWarning,
		Title:            title,
		Message:          message,
		Recipient:        n.defaultRecipient,
		Metadata:         metadata,
	}

	return n.notificationRepo.CreateNotification(ctx, req)
}

// NotifyInfo creates an informational notification
func (n *Notifier) NotifyInfo(ctx context.Context, syncLogID *uuid.UUID, title, message string, metadata map[string]interface{}) (*models.SyncNotification, error) {
	if metadata == nil {
		metadata = make(map[string]interface{})
	}
	metadata["created_at"] = time.Now().Format(time.RFC3339)

	req := &models.NotificationCreateRequest{
		SyncLogID:        syncLogID,
		NotificationType: models.NotificationTypeInfo,
		Title:            title,
		Message:          message,
		Recipient:        n.defaultRecipient,
		Metadata:         metadata,
	}

	return n.notificationRepo.CreateNotification(ctx, req)
}

// BuildSyncCompletionStats builds SyncCompletionStats from a sync log
func BuildSyncCompletionStats(syncLog *models.SyncLog) *models.SyncCompletionStats {
	durationSeconds := 0
	if syncLog.DurationSeconds != nil {
		durationSeconds = *syncLog.DurationSeconds
	}

	return &models.SyncCompletionStats{
		SyncLogID:          syncLog.ID,
		SyncType:           syncLog.SyncType,
		Status:             syncLog.Status,
		DurationSeconds:    durationSeconds,
		BrandsInserted:     syncLog.BrandsInserted,
		BrandsUpdated:      syncLog.BrandsUpdated,
		CategoriesInserted: syncLog.CategoriesInserted,
		CategoriesUpdated:  syncLog.CategoriesUpdated,
		ProductsInserted:   syncLog.ProductsInserted,
		ProductsUpdated:    syncLog.ProductsUpdated,
		PropertiesInserted: syncLog.PropertiesInserted,
		PropertiesUpdated:  syncLog.PropertiesUpdated,
		TotalChanges: syncLog.BrandsInserted + syncLog.BrandsUpdated +
			syncLog.CategoriesInserted + syncLog.CategoriesUpdated +
			syncLog.ProductsInserted + syncLog.ProductsUpdated +
			syncLog.PropertiesInserted + syncLog.PropertiesUpdated,
		ConflictsFound: 0, // This would be populated from conflict tracking
	}
}

// FormatSyncDuration formats duration in a human-readable format
func FormatSyncDuration(seconds int) string {
	if seconds < 60 {
		return fmt.Sprintf("%d seconds", seconds)
	} else if seconds < 3600 {
		minutes := seconds / 60
		secs := seconds % 60
		if secs == 0 {
			return fmt.Sprintf("%d minutes", minutes)
		}
		return fmt.Sprintf("%d minutes %d seconds", minutes, secs)
	} else {
		hours := seconds / 3600
		minutes := (seconds % 3600) / 60
		if minutes == 0 {
			return fmt.Sprintf("%d hours", hours)
		}
		return fmt.Sprintf("%d hours %d minutes", hours, minutes)
	}
}

// truncateString truncates a string to a maximum length
func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}
