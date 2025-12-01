package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"ultra-api-testing/internal/models"
	"ultra-api-testing/internal/repository"
)

// maxSSEConnections limits concurrent SSE connections to prevent resource exhaustion
const maxSSEConnections = 100

// sseConnectionCount tracks active SSE connections
var sseConnectionCount int64

// NotificationHandler handles notification endpoints
type NotificationHandler struct {
	notificationRepo *repository.NotificationRepository
}

// NewNotificationHandler creates a new notification handler
func NewNotificationHandler(notificationRepo *repository.NotificationRepository) *NotificationHandler {
	return &NotificationHandler{notificationRepo: notificationRepo}
}

// ============================================================================
// LIST & GET ENDPOINTS
// ============================================================================

// ListNotifications handles GET /api/v1/notifications
// @Summary List notifications
// @Description Returns paginated list of notifications with optional unread filter
// @Tags Notifications
// @Produce json
// @Param limit query int false "Number of results (default: 50)"
// @Param offset query int false "Pagination offset (default: 0)"
// @Param unread_only query bool false "Only return unread notifications"
// @Success 200 {object} models.NotificationListResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/notifications [get]
func (h *NotificationHandler) ListNotifications(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	// Parse pagination
	limit := parseQueryInt(r, "limit", 50)
	offset := parseQueryInt(r, "offset", 0)

	// Parse unread_only filter
	unreadOnly := r.URL.Query().Get("unread_only") == "true"

	// Enforce limits
	if limit > 100 {
		limit = 100
	}
	if limit < 1 {
		limit = 50
	}

	response, err := h.notificationRepo.ListNotifications(ctx, limit, offset, unreadOnly)
	if err != nil {
		log.Printf("Failed to list notifications: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to fetch notifications", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, response)
}

// GetNotification handles GET /api/v1/notifications/{id}
// @Summary Get a notification by ID
// @Description Returns a single notification
// @Tags Notifications
// @Produce json
// @Param id path string true "Notification ID"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /api/v1/notifications/{id} [get]
func (h *NotificationHandler) GetNotification(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid notification ID", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	notification, err := h.notificationRepo.GetNotification(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrNotificationNotFound) {
			respondError(w, http.StatusNotFound, "Notification not found", err.Error())
			return
		}
		log.Printf("Failed to get notification: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to fetch notification", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": notification,
	})
}

// GetUnreadCount handles GET /api/v1/notifications/count
// @Summary Get unread notification count
// @Description Returns the count of unread notifications
// @Tags Notifications
// @Produce json
// @Success 200 {object} models.NotificationCountResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/notifications/count [get]
func (h *NotificationHandler) GetUnreadCount(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	counts, err := h.notificationRepo.GetUnreadCount(ctx)
	if err != nil {
		log.Printf("Failed to get notification count: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to get notification count", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, counts)
}

// GetNotificationStats handles GET /api/v1/notifications/stats
// @Summary Get notification statistics
// @Description Returns aggregated notification statistics
// @Tags Notifications
// @Produce json
// @Success 200 {object} models.NotificationStats
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/notifications/stats [get]
func (h *NotificationHandler) GetNotificationStats(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	stats, err := h.notificationRepo.GetNotificationStats(ctx)
	if err != nil {
		log.Printf("Failed to get notification stats: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to get notification stats", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": stats,
	})
}

// ============================================================================
// MARK AS READ ENDPOINTS
// ============================================================================

// MarkAsRead handles POST /api/v1/notifications/{id}/read
// @Summary Mark a notification as read
// @Description Marks a single notification as read
// @Tags Notifications
// @Produce json
// @Param id path string true "Notification ID"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /api/v1/notifications/{id}/read [post]
func (h *NotificationHandler) MarkAsRead(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid notification ID", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	err = h.notificationRepo.MarkAsRead(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrNotificationNotFound) {
			respondError(w, http.StatusNotFound, "Notification not found", err.Error())
			return
		}
		log.Printf("Failed to mark notification as read: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to mark as read", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Notification marked as read",
	})
}

// MarkAllAsRead handles POST /api/v1/notifications/read-all
// @Summary Mark all notifications as read
// @Description Marks all unread notifications as read
// @Tags Notifications
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/notifications/read-all [post]
func (h *NotificationHandler) MarkAllAsRead(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	count, err := h.notificationRepo.MarkAllAsRead(ctx)
	if err != nil {
		log.Printf("Failed to mark all notifications as read: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to mark all as read", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "All notifications marked as read",
		"count":   count,
	})
}

// ============================================================================
// DELETE ENDPOINTS
// ============================================================================

// DeleteNotification handles DELETE /api/v1/notifications/{id}
// @Summary Delete a notification
// @Description Deletes a single notification
// @Tags Notifications
// @Produce json
// @Param id path string true "Notification ID"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /api/v1/notifications/{id} [delete]
func (h *NotificationHandler) DeleteNotification(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid notification ID", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	err = h.notificationRepo.DeleteNotification(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrNotificationNotFound) {
			respondError(w, http.StatusNotFound, "Notification not found", err.Error())
			return
		}
		log.Printf("Failed to delete notification: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to delete notification", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Notification deleted successfully",
	})
}

// DeleteAllRead handles DELETE /api/v1/notifications/read
// @Summary Delete all read notifications
// @Description Deletes all notifications that have been marked as read
// @Tags Notifications
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/notifications/read [delete]
func (h *NotificationHandler) DeleteAllRead(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	count, err := h.notificationRepo.DeleteAllRead(ctx)
	if err != nil {
		log.Printf("Failed to delete read notifications: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to delete read notifications", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Read notifications deleted successfully",
		"count":   count,
	})
}

// ============================================================================
// SSE STREAMING ENDPOINT
// ============================================================================

// StreamNotifications handles GET /api/v1/notifications/stream
// @Summary Stream real-time notifications via SSE
// @Description Establishes an SSE connection for real-time notification updates
// @Tags Notifications
// @Produce text/event-stream
// @Success 200 {string} string "SSE stream"
// @Failure 503 {object} ErrorResponse "Too many connections"
// @Router /api/v1/notifications/stream [get]
func (h *NotificationHandler) StreamNotifications(w http.ResponseWriter, r *http.Request) {
	// Check connection limit before accepting
	currentConns := atomic.AddInt64(&sseConnectionCount, 1)
	if currentConns > maxSSEConnections {
		atomic.AddInt64(&sseConnectionCount, -1)
		log.Printf("SSE: Connection rejected - limit reached (%d/%d)", currentConns-1, maxSSEConnections)
		respondError(w, http.StatusServiceUnavailable, "Too many connections", "Maximum SSE connection limit reached")
		return
	}
	defer atomic.AddInt64(&sseConnectionCount, -1)

	log.Printf("SSE: Client connected for notification streaming (connections: %d/%d)", currentConns, maxSSEConnections)

	// Set headers for SSE
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("X-Accel-Buffering", "no") // Disable nginx buffering

	// Create context that cancels when client disconnects
	ctx := r.Context()

	// Flush immediately to establish connection
	if flusher, ok := w.(http.Flusher); ok {
		flusher.Flush()
	}

	// Send initial unread count
	counts, err := h.notificationRepo.GetUnreadCount(ctx)
	if err == nil {
		h.sendNotificationSSE(w, models.SSEEventNotificationCount, counts)
	}

	// Track last notification timestamp for polling new notifications
	lastCheck := time.Now()

	// Send heartbeat and check for new notifications
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	heartbeatTicker := time.NewTicker(15 * time.Second)
	defer heartbeatTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			// Client disconnected
			log.Printf("SSE: Client disconnected from notification stream (connections: %d/%d)", atomic.LoadInt64(&sseConnectionCount)-1, maxSSEConnections)
			return

		case <-heartbeatTicker.C:
			// Send heartbeat to keep connection alive
			h.sendNotificationSSE(w, models.SSEEventHeartbeat, map[string]interface{}{
				"timestamp": time.Now(),
			})

		case <-ticker.C:
			// Check for new notifications since last check
			notifications, err := h.notificationRepo.GetNotificationsSince(ctx, lastCheck, 10)
			if err != nil {
				log.Printf("SSE: Failed to get new notifications: %v", err)
				continue
			}

			// Send each new notification
			for _, notification := range notifications {
				h.sendNotificationSSE(w, models.SSEEventNewNotification, notification)

				// Update last check time
				if notification.CreatedAt.After(lastCheck) {
					lastCheck = notification.CreatedAt
				}
			}

			// If there were new notifications, also send updated count
			if len(notifications) > 0 {
				counts, err := h.notificationRepo.GetUnreadCount(ctx)
				if err == nil {
					h.sendNotificationSSE(w, models.SSEEventNotificationCount, counts)
				}
			}
		}
	}
}

// sendNotificationSSE sends an SSE message for notifications
func (h *NotificationHandler) sendNotificationSSE(w http.ResponseWriter, event string, data interface{}) {
	// Marshal data to JSON
	dataJSON, err := json.Marshal(data)
	if err != nil {
		log.Printf("SSE: Failed to marshal notification data: %v", err)
		return
	}

	// Write event
	fmt.Fprintf(w, "event: %s\n", event)

	// Write data
	fmt.Fprintf(w, "data: %s\n\n", dataJSON)

	// Flush immediately
	if flusher, ok := w.(http.Flusher); ok {
		flusher.Flush()
	}
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// parseQueryInt parses an integer query parameter with a default value
func parseQueryInt(r *http.Request, param string, defaultValue int) int {
	valueStr := r.URL.Query().Get(param)
	if valueStr == "" {
		return defaultValue
	}

	value, err := strconv.Atoi(valueStr)
	if err != nil {
		return defaultValue
	}

	return value
}
