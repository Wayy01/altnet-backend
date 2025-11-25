package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"ultra-api-testing/internal/models"
	"ultra-api-testing/internal/repository"
	internalSync "ultra-api-testing/internal/sync"
)

// SyncControlHandlers handles sync cancellation and status management endpoints
type SyncControlHandlers struct {
	repo             *repository.Repository
	realtimeRepo     *repository.RealtimeSyncRepository
	syncManager      *internalSync.SyncManager // Manages active syncs for cancellation
}

// NewSyncControlHandlers creates a new sync control handlers instance
func NewSyncControlHandlers(repo *repository.Repository, realtimeRepo *repository.RealtimeSyncRepository, syncManager *internalSync.SyncManager) *SyncControlHandlers {
	return &SyncControlHandlers{
		repo:         repo,
		realtimeRepo: realtimeRepo,
		syncManager:  syncManager,
	}
}

// ============================================================================
// CANCEL RUNNING SYNC
// ============================================================================

// CancelSyncRequest represents a cancel sync request
type CancelSyncRequest struct {
	Reason string `json:"reason,omitempty"`
}

// CancelSyncResponse represents a cancel sync response
type CancelSyncResponse struct {
	SyncLogID   uuid.UUID `json:"sync_log_id"`
	Status      string    `json:"status"`
	Message     string    `json:"message"`
	CancelledAt time.Time `json:"cancelled_at"`
}

// CancelRunningSync cancels a running sync operation
// POST /api/v1/sync/{id}/cancel
func (h *SyncControlHandlers) CancelRunningSync(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	// Get sync log ID from path
	vars := mux.Vars(r)
	syncLogIDStr := vars["id"]
	if syncLogIDStr == "" {
		respondWithError(w, http.StatusBadRequest, "sync_log_id parameter is required")
		return
	}

	syncLogID, err := uuid.Parse(syncLogIDStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid sync_log_id parameter")
		return
	}

	// Parse request body (reason is optional)
	var req CancelSyncRequest
	if r.Body != nil {
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			// Ignore parse errors - reason is optional
			req.Reason = "Cancelled by user"
		}
	}
	if req.Reason == "" {
		req.Reason = "Cancelled by user"
	}

	// Get sync log from database to check status
	syncLog, err := h.getSyncLog(ctx, syncLogID)
	if err != nil {
		log.Printf("Failed to get sync log %s: %v", syncLogID, err)
		respondWithError(w, http.StatusNotFound, fmt.Sprintf("Sync log not found: %s", syncLogID))
		return
	}

	// Validate that sync is actually running
	if syncLog.Status != "running" {
		respondWithError(w, http.StatusBadRequest, fmt.Sprintf("Cannot cancel sync with status '%s'. Only running syncs can be cancelled.", syncLog.Status))
		return
	}

	// Cancel the sync via SyncManager
	if err := h.syncManager.CancelSync(syncLogID, req.Reason); err != nil {
		log.Printf("Failed to cancel sync %s: %v", syncLogID, err)

		// Check if sync is not found in manager (maybe already completed)
		if err.Error() == "sync not found" {
			// Try to get fresh status from DB
			syncLog, dbErr := h.getSyncLog(ctx, syncLogID)
			if dbErr == nil && syncLog.Status != "running" {
				respondWithError(w, http.StatusConflict, fmt.Sprintf("Sync already completed with status: %s", syncLog.Status))
				return
			}
			respondWithError(w, http.StatusNotFound, "Sync is not currently running or has already completed")
			return
		}

		respondWithError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to cancel sync: %v", err))
		return
	}

	// Log cancellation event
	stepNumber := 0 // Use 0 for sync-level events
	h.logEntry(ctx, syncLogID, &stepNumber, models.LogLevelInfo,
		fmt.Sprintf("Sync cancellation requested: %s", req.Reason),
		map[string]interface{}{
			"reason":        req.Reason,
			"cancelled_by":  "user",
			"cancelled_via": "api",
		})

	log.Printf("Sync %s cancellation requested: %s", syncLogID, req.Reason)

	// Return success response
	// Note: The actual status update will happen in the sync goroutine when it detects cancellation
	response := CancelSyncResponse{
		SyncLogID:   syncLogID,
		Status:      "cancelling",
		Message:     "Cancellation signal sent. Sync will stop gracefully at the next checkpoint.",
		CancelledAt: time.Now(),
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted) // 202 Accepted - async operation
	json.NewEncoder(w).Encode(response)
}

// ============================================================================
// MANUAL STATUS UPDATE (for stuck syncs)
// ============================================================================

// UpdateSyncStatusRequest represents a manual status update request
type UpdateSyncStatusRequest struct {
	Status       string  `json:"status"`
	ErrorMessage *string `json:"error_message,omitempty"`
	Reason       string  `json:"reason,omitempty"`
}

// UpdateSyncStatusResponse represents a status update response
type UpdateSyncStatusResponse struct {
	SyncLogID   uuid.UUID `json:"sync_log_id"`
	OldStatus   string    `json:"old_status"`
	NewStatus   string    `json:"new_status"`
	Message     string    `json:"message"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// UpdateSyncStatus manually updates the status of a sync log
// PATCH /api/v1/sync/{id}/status
//
// Use cases:
// - Mark stuck "running" syncs as "failed" or "cancelled"
// - Fix orphaned sync logs that weren't properly finalized
//
// Security: Only allows transitions to terminal states (failed, cancelled)
func (h *SyncControlHandlers) UpdateSyncStatus(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	// Get sync log ID from path
	vars := mux.Vars(r)
	syncLogIDStr := vars["id"]
	if syncLogIDStr == "" {
		respondWithError(w, http.StatusBadRequest, "sync_log_id parameter is required")
		return
	}

	syncLogID, err := uuid.Parse(syncLogIDStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid sync_log_id parameter")
		return
	}

	// Parse request body
	var req UpdateSyncStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Validate required fields
	if req.Status == "" {
		respondWithError(w, http.StatusBadRequest, "status field is required")
		return
	}
	if req.Reason == "" {
		req.Reason = "Manual status update by user"
	}

	// Validate allowed status values (security: only allow terminal states)
	allowedStatuses := map[string]bool{
		"failed":    true,
		"cancelled": true,
	}
	if !allowedStatuses[req.Status] {
		respondWithError(w, http.StatusBadRequest, fmt.Sprintf("Invalid status. Allowed values: failed, cancelled. Got: %s", req.Status))
		return
	}

	// Get current sync log from database
	syncLog, err := h.getSyncLog(ctx, syncLogID)
	if err != nil {
		log.Printf("Failed to get sync log %s: %v", syncLogID, err)
		respondWithError(w, http.StatusNotFound, fmt.Sprintf("Sync log not found: %s", syncLogID))
		return
	}

	// Store old status for response
	oldStatus := syncLog.Status

	// Check if sync is currently running (warn user but allow override)
	if syncLog.Status == "running" {
		log.Printf("WARNING: Manually updating status of running sync %s from '%s' to '%s'. Reason: %s",
			syncLogID, oldStatus, req.Status, req.Reason)
	}

	// Prevent no-op updates
	if syncLog.Status == req.Status {
		respondWithError(w, http.StatusBadRequest, fmt.Sprintf("Sync already has status '%s'", req.Status))
		return
	}

	// Build error message for the update
	errorMessage := req.ErrorMessage
	if errorMessage == nil && req.Status == "failed" {
		msg := fmt.Sprintf("Manually marked as failed: %s", req.Reason)
		errorMessage = &msg
	} else if errorMessage == nil && req.Status == "cancelled" {
		msg := fmt.Sprintf("Manually cancelled: %s", req.Reason)
		errorMessage = &msg
	}

	// Update sync log status in database
	if err := h.updateSyncLogStatus(ctx, syncLogID, req.Status, errorMessage); err != nil {
		log.Printf("Failed to update sync log status %s: %v", syncLogID, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to update sync status")
		return
	}

	// Log the manual status change
	stepNumber := 0 // Use 0 for sync-level events
	h.logEntry(ctx, syncLogID, &stepNumber, models.LogLevelWarn,
		fmt.Sprintf("Manual status update: %s → %s. Reason: %s", oldStatus, req.Status, req.Reason),
		map[string]interface{}{
			"old_status":   oldStatus,
			"new_status":   req.Status,
			"reason":       req.Reason,
			"updated_by":   "user",
			"updated_via":  "api",
			"manual_override": true,
		})

	log.Printf("Sync %s status manually updated: %s → %s. Reason: %s", syncLogID, oldStatus, req.Status, req.Reason)

	// Return success response
	response := UpdateSyncStatusResponse{
		SyncLogID: syncLogID,
		OldStatus: oldStatus,
		NewStatus: req.Status,
		Message:   fmt.Sprintf("Sync status updated from '%s' to '%s'", oldStatus, req.Status),
		UpdatedAt: time.Now(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// getSyncLog retrieves a sync log by ID
func (h *SyncControlHandlers) getSyncLog(ctx context.Context, syncLogID uuid.UUID) (*models.SyncLog, error) {
	query := `
		SELECT id, sync_type, started_at, finished_at, duration_seconds, status, error_message
		FROM sync_logs
		WHERE id = $1
	`

	var log models.SyncLog
	err := h.repo.Pool().QueryRow(ctx, query, syncLogID).Scan(
		&log.ID,
		&log.SyncType,
		&log.StartedAt,
		&log.FinishedAt,
		&log.DurationSeconds,
		&log.Status,
		&log.ErrorMessage,
	)

	if err != nil {
		return nil, err
	}

	return &log, nil
}

// updateSyncLogStatus updates a sync log's status and error message
func (h *SyncControlHandlers) updateSyncLogStatus(ctx context.Context, syncLogID uuid.UUID, status string, errorMessage *string) error {
	// First get the started_at time to calculate duration
	var startedAt time.Time
	err := h.repo.Pool().QueryRow(ctx, "SELECT started_at FROM sync_logs WHERE id = $1", syncLogID).Scan(&startedAt)
	if err != nil {
		return fmt.Errorf("failed to get sync start time: %w", err)
	}

	// Calculate duration
	finishedAt := time.Now()
	durationSeconds := int(finishedAt.Sub(startedAt).Seconds())

	query := `
		UPDATE sync_logs
		SET
			status = $2,
			finished_at = $3,
			duration_seconds = $4,
			error_message = $5
		WHERE id = $1
	`

	_, err = h.repo.Pool().Exec(ctx, query, syncLogID, status, finishedAt, durationSeconds, errorMessage)
	return err
}

// logEntry creates a log entry for real-time monitoring
func (h *SyncControlHandlers) logEntry(ctx context.Context, syncLogID uuid.UUID, stepNumber *int, level models.LogLevel, message string, details map[string]interface{}) {
	entry := &models.SyncLogEntry{
		SyncLogID:  syncLogID,
		StepNumber: stepNumber,
		Level:      level,
		Message:    message,
		Details:    details,
	}

	// Use background context to ensure logging completes even if main context is cancelled
	logCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := h.realtimeRepo.CreateLogEntry(logCtx, entry); err != nil {
		// Log error but don't fail the operation
		log.Printf("WARNING: Failed to create log entry: %v", err)
	}
}

// respondWithError sends an error response
func respondWithError(w http.ResponseWriter, code int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{
		"error": message,
	})
}
