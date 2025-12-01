package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"ultra-api-testing/internal/models"
)

// Sentinel errors for notification repository operations
var (
	ErrNotificationNotFound = errors.New("notification not found")
)

// NotificationRepository handles notification database operations
type NotificationRepository struct {
	pool *pgxpool.Pool
}

// NewNotificationRepository creates a new notification repository
func NewNotificationRepository(pool *pgxpool.Pool) *NotificationRepository {
	return &NotificationRepository{pool: pool}
}

// CreateNotification creates a new notification in the database
func (r *NotificationRepository) CreateNotification(ctx context.Context, req *models.NotificationCreateRequest) (*models.SyncNotification, error) {
	// Generate UUID
	id := uuid.New()
	now := time.Now()

	// Marshal metadata
	metadataJSON, err := json.Marshal(req.Metadata)
	if err != nil {
		return nil, fmt.Errorf("marshal metadata: %w", err)
	}

	// Build title and message from request, storing in metadata since the table structure
	// uses recipient and metadata fields
	enrichedMetadata := req.Metadata
	if enrichedMetadata == nil {
		enrichedMetadata = make(map[string]interface{})
	}
	enrichedMetadata["title"] = req.Title
	enrichedMetadata["message"] = req.Message
	enrichedMetadata["is_read"] = false

	metadataJSON, err = json.Marshal(enrichedMetadata)
	if err != nil {
		return nil, fmt.Errorf("marshal enriched metadata: %w", err)
	}

	query := `
		INSERT INTO sync_notifications (
			id, sync_log_id, notification_type, recipient, status, metadata, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, sync_log_id, notification_type, recipient, status, sent_at, error_message, metadata, created_at
	`

	notification := &models.SyncNotification{}
	var metadataBytes []byte
	var syncLogID *uuid.UUID
	var sentAt *time.Time
	var errorMessage *string

	err = r.pool.QueryRow(ctx, query,
		id,
		req.SyncLogID,
		req.NotificationType,
		req.Recipient,
		models.NotificationStatusPending,
		metadataJSON,
		now,
	).Scan(
		&notification.ID,
		&syncLogID,
		&notification.NotificationType,
		&notification.Recipient,
		&notification.Status,
		&sentAt,
		&errorMessage,
		&metadataBytes,
		&notification.CreatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("create notification: %w", err)
	}

	notification.SyncLogID = syncLogID
	notification.SentAt = sentAt
	notification.ErrorMessage = errorMessage

	// Parse metadata and extract title/message
	if len(metadataBytes) > 0 {
		if err := json.Unmarshal(metadataBytes, &notification.Metadata); err != nil {
			return nil, fmt.Errorf("unmarshal metadata: %w", err)
		}
	}

	// Extract title and message from metadata
	if title, ok := notification.Metadata["title"].(string); ok {
		notification.Title = title
	}
	if message, ok := notification.Metadata["message"].(string); ok {
		notification.Message = message
	}
	if isRead, ok := notification.Metadata["is_read"].(bool); ok {
		notification.IsRead = isRead
	}

	return notification, nil
}

// ListNotifications retrieves notifications with optional filtering
func (r *NotificationRepository) ListNotifications(ctx context.Context, limit, offset int, unreadOnly bool) (*models.NotificationListResponse, error) {
	// Build WHERE clause
	whereClauses := []string{"1=1"}
	args := []interface{}{}
	argCounter := 1

	if unreadOnly {
		whereClauses = append(whereClauses, fmt.Sprintf("(metadata->>'is_read')::boolean = false OR metadata->>'is_read' IS NULL"))
	}

	whereClause := strings.Join(whereClauses, " AND ")

	// Get total count
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM sync_notifications WHERE %s", whereClause)
	var total int
	err := r.pool.QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, fmt.Errorf("count notifications: %w", err)
	}

	// Get unread count
	unreadQuery := "SELECT COUNT(*) FROM sync_notifications WHERE (metadata->>'is_read')::boolean = false OR metadata->>'is_read' IS NULL"
	var unreadCount int
	err = r.pool.QueryRow(ctx, unreadQuery).Scan(&unreadCount)
	if err != nil {
		return nil, fmt.Errorf("count unread notifications: %w", err)
	}

	// Get notifications
	listQuery := fmt.Sprintf(`
		SELECT
			id, sync_log_id, notification_type, recipient, status,
			sent_at, error_message, metadata, created_at
		FROM sync_notifications
		WHERE %s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argCounter, argCounter+1)

	args = append(args, limit, offset)

	rows, err := r.pool.Query(ctx, listQuery, args...)
	if err != nil {
		return nil, fmt.Errorf("list notifications: %w", err)
	}
	defer rows.Close()

	notifications := make([]*models.SyncNotification, 0)

	for rows.Next() {
		notification, err := r.scanNotification(rows)
		if err != nil {
			return nil, fmt.Errorf("scan notification: %w", err)
		}
		notifications = append(notifications, notification)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate notifications: %w", err)
	}

	return &models.NotificationListResponse{
		Data:        notifications,
		Total:       total,
		UnreadCount: unreadCount,
		Limit:       limit,
		Offset:      offset,
	}, nil
}

// GetNotification retrieves a single notification by ID
func (r *NotificationRepository) GetNotification(ctx context.Context, id uuid.UUID) (*models.SyncNotification, error) {
	query := `
		SELECT
			id, sync_log_id, notification_type, recipient, status,
			sent_at, error_message, metadata, created_at
		FROM sync_notifications
		WHERE id = $1
	`

	row := r.pool.QueryRow(ctx, query, id)
	notification, err := r.scanNotificationRow(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotificationNotFound
		}
		return nil, fmt.Errorf("get notification: %w", err)
	}

	return notification, nil
}

// MarkAsRead marks a notification as read
func (r *NotificationRepository) MarkAsRead(ctx context.Context, id uuid.UUID) error {
	// First get the current metadata
	notification, err := r.GetNotification(ctx, id)
	if err != nil {
		return err
	}

	// Update metadata with is_read and read_at
	if notification.Metadata == nil {
		notification.Metadata = make(map[string]interface{})
	}
	notification.Metadata["is_read"] = true
	notification.Metadata["read_at"] = time.Now().Format(time.RFC3339)

	metadataJSON, err := json.Marshal(notification.Metadata)
	if err != nil {
		return fmt.Errorf("marshal metadata: %w", err)
	}

	query := `
		UPDATE sync_notifications
		SET metadata = $2, status = $3
		WHERE id = $1
	`

	cmdTag, err := r.pool.Exec(ctx, query, id, metadataJSON, models.NotificationStatusRead)
	if err != nil {
		return fmt.Errorf("mark as read: %w", err)
	}

	if cmdTag.RowsAffected() == 0 {
		return ErrNotificationNotFound
	}

	return nil
}

// MarkAllAsRead marks all notifications as read
func (r *NotificationRepository) MarkAllAsRead(ctx context.Context) (int64, error) {
	// Update all unread notifications
	query := `
		UPDATE sync_notifications
		SET
			metadata = jsonb_set(
				jsonb_set(
					COALESCE(metadata, '{}'::jsonb),
					'{is_read}',
					'true'::jsonb
				),
				'{read_at}',
				to_jsonb($1::text)
			),
			status = $2
		WHERE (metadata->>'is_read')::boolean = false OR metadata->>'is_read' IS NULL
	`

	cmdTag, err := r.pool.Exec(ctx, query, time.Now().Format(time.RFC3339), models.NotificationStatusRead)
	if err != nil {
		return 0, fmt.Errorf("mark all as read: %w", err)
	}

	return cmdTag.RowsAffected(), nil
}

// DeleteNotification deletes a notification by ID
func (r *NotificationRepository) DeleteNotification(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM sync_notifications WHERE id = $1`

	cmdTag, err := r.pool.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("delete notification: %w", err)
	}

	if cmdTag.RowsAffected() == 0 {
		return ErrNotificationNotFound
	}

	return nil
}

// DeleteAllRead deletes all read notifications
func (r *NotificationRepository) DeleteAllRead(ctx context.Context) (int64, error) {
	query := `DELETE FROM sync_notifications WHERE (metadata->>'is_read')::boolean = true`

	cmdTag, err := r.pool.Exec(ctx, query)
	if err != nil {
		return 0, fmt.Errorf("delete all read: %w", err)
	}

	return cmdTag.RowsAffected(), nil
}

// GetUnreadCount returns the count of unread notifications
func (r *NotificationRepository) GetUnreadCount(ctx context.Context) (*models.NotificationCountResponse, error) {
	// Get unread count
	unreadQuery := "SELECT COUNT(*) FROM sync_notifications WHERE (metadata->>'is_read')::boolean = false OR metadata->>'is_read' IS NULL"
	var unreadCount int
	err := r.pool.QueryRow(ctx, unreadQuery).Scan(&unreadCount)
	if err != nil {
		return nil, fmt.Errorf("count unread: %w", err)
	}

	// Get total count
	totalQuery := "SELECT COUNT(*) FROM sync_notifications"
	var totalCount int
	err = r.pool.QueryRow(ctx, totalQuery).Scan(&totalCount)
	if err != nil {
		return nil, fmt.Errorf("count total: %w", err)
	}

	return &models.NotificationCountResponse{
		UnreadCount: unreadCount,
		TotalCount:  totalCount,
	}, nil
}

// GetNotificationStats returns aggregated notification statistics
func (r *NotificationRepository) GetNotificationStats(ctx context.Context) (*models.NotificationStats, error) {
	stats := &models.NotificationStats{
		ByType: make(map[string]int),
	}

	// Get total count
	err := r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM sync_notifications").Scan(&stats.TotalNotifications)
	if err != nil {
		return nil, fmt.Errorf("count total: %w", err)
	}

	// Get unread count
	err = r.pool.QueryRow(ctx,
		"SELECT COUNT(*) FROM sync_notifications WHERE (metadata->>'is_read')::boolean = false OR metadata->>'is_read' IS NULL",
	).Scan(&stats.UnreadNotifications)
	if err != nil {
		return nil, fmt.Errorf("count unread: %w", err)
	}

	stats.ReadNotifications = stats.TotalNotifications - stats.UnreadNotifications

	// Get count by type
	typeQuery := `
		SELECT notification_type, COUNT(*)
		FROM sync_notifications
		GROUP BY notification_type
	`
	rows, err := r.pool.Query(ctx, typeQuery)
	if err != nil {
		return nil, fmt.Errorf("count by type: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var notificationType string
		var count int
		if err := rows.Scan(&notificationType, &count); err != nil {
			return nil, fmt.Errorf("scan type count: %w", err)
		}
		stats.ByType[notificationType] = count
	}

	// Get last 24 hours count
	err = r.pool.QueryRow(ctx,
		"SELECT COUNT(*) FROM sync_notifications WHERE created_at >= NOW() - INTERVAL '24 hours'",
	).Scan(&stats.Last24Hours)
	if err != nil {
		return nil, fmt.Errorf("count last 24h: %w", err)
	}

	// Get last 7 days count
	err = r.pool.QueryRow(ctx,
		"SELECT COUNT(*) FROM sync_notifications WHERE created_at >= NOW() - INTERVAL '7 days'",
	).Scan(&stats.Last7Days)
	if err != nil {
		return nil, fmt.Errorf("count last 7d: %w", err)
	}

	return stats, nil
}

// GetRecentNotifications returns the most recent notifications (for SSE initial load)
func (r *NotificationRepository) GetRecentNotifications(ctx context.Context, limit int) ([]*models.SyncNotification, error) {
	query := `
		SELECT
			id, sync_log_id, notification_type, recipient, status,
			sent_at, error_message, metadata, created_at
		FROM sync_notifications
		ORDER BY created_at DESC
		LIMIT $1
	`

	rows, err := r.pool.Query(ctx, query, limit)
	if err != nil {
		return nil, fmt.Errorf("list recent notifications: %w", err)
	}
	defer rows.Close()

	notifications := make([]*models.SyncNotification, 0)

	for rows.Next() {
		notification, err := r.scanNotification(rows)
		if err != nil {
			return nil, fmt.Errorf("scan notification: %w", err)
		}
		notifications = append(notifications, notification)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate notifications: %w", err)
	}

	return notifications, nil
}

// GetNotificationsSince returns notifications created after the given timestamp
func (r *NotificationRepository) GetNotificationsSince(ctx context.Context, since time.Time, limit int) ([]*models.SyncNotification, error) {
	query := `
		SELECT
			id, sync_log_id, notification_type, recipient, status,
			sent_at, error_message, metadata, created_at
		FROM sync_notifications
		WHERE created_at > $1
		ORDER BY created_at ASC
		LIMIT $2
	`

	rows, err := r.pool.Query(ctx, query, since, limit)
	if err != nil {
		return nil, fmt.Errorf("list notifications since: %w", err)
	}
	defer rows.Close()

	notifications := make([]*models.SyncNotification, 0)

	for rows.Next() {
		notification, err := r.scanNotification(rows)
		if err != nil {
			return nil, fmt.Errorf("scan notification: %w", err)
		}
		notifications = append(notifications, notification)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate notifications: %w", err)
	}

	return notifications, nil
}

// scanNotification scans a notification from a rows object
func (r *NotificationRepository) scanNotification(rows pgx.Rows) (*models.SyncNotification, error) {
	notification := &models.SyncNotification{}
	var metadataBytes []byte
	var syncLogID *uuid.UUID
	var sentAt *time.Time
	var errorMessage *string

	err := rows.Scan(
		&notification.ID,
		&syncLogID,
		&notification.NotificationType,
		&notification.Recipient,
		&notification.Status,
		&sentAt,
		&errorMessage,
		&metadataBytes,
		&notification.CreatedAt,
	)
	if err != nil {
		return nil, err
	}

	notification.SyncLogID = syncLogID
	notification.SentAt = sentAt
	notification.ErrorMessage = errorMessage

	// Parse metadata
	if len(metadataBytes) > 0 {
		if err := json.Unmarshal(metadataBytes, &notification.Metadata); err != nil {
			return nil, fmt.Errorf("unmarshal metadata: %w", err)
		}
	}

	// Extract title, message, is_read, and read_at from metadata
	if notification.Metadata != nil {
		if title, ok := notification.Metadata["title"].(string); ok {
			notification.Title = title
		}
		if message, ok := notification.Metadata["message"].(string); ok {
			notification.Message = message
		}
		if isRead, ok := notification.Metadata["is_read"].(bool); ok {
			notification.IsRead = isRead
		}
		if readAtStr, ok := notification.Metadata["read_at"].(string); ok {
			if readAt, err := time.Parse(time.RFC3339, readAtStr); err == nil {
				notification.ReadAt = &readAt
			}
		}
	}

	return notification, nil
}

// scanNotificationRow scans a notification from a single row
func (r *NotificationRepository) scanNotificationRow(row pgx.Row) (*models.SyncNotification, error) {
	notification := &models.SyncNotification{}
	var metadataBytes []byte
	var syncLogID *uuid.UUID
	var sentAt *time.Time
	var errorMessage *string

	err := row.Scan(
		&notification.ID,
		&syncLogID,
		&notification.NotificationType,
		&notification.Recipient,
		&notification.Status,
		&sentAt,
		&errorMessage,
		&metadataBytes,
		&notification.CreatedAt,
	)
	if err != nil {
		return nil, err
	}

	notification.SyncLogID = syncLogID
	notification.SentAt = sentAt
	notification.ErrorMessage = errorMessage

	// Parse metadata
	if len(metadataBytes) > 0 {
		if err := json.Unmarshal(metadataBytes, &notification.Metadata); err != nil {
			return nil, fmt.Errorf("unmarshal metadata: %w", err)
		}
	}

	// Extract title, message, is_read, and read_at from metadata
	if notification.Metadata != nil {
		if title, ok := notification.Metadata["title"].(string); ok {
			notification.Title = title
		}
		if message, ok := notification.Metadata["message"].(string); ok {
			notification.Message = message
		}
		if isRead, ok := notification.Metadata["is_read"].(bool); ok {
			notification.IsRead = isRead
		}
		if readAtStr, ok := notification.Metadata["read_at"].(string); ok {
			if readAt, err := time.Parse(time.RFC3339, readAtStr); err == nil {
				notification.ReadAt = &readAt
			}
		}
	}

	return notification, nil
}
