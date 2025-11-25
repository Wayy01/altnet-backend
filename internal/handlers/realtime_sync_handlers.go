package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"ultra-api-testing/internal/models"
	"ultra-api-testing/internal/repository"
)

// RealtimeSyncHandlers handles real-time sync monitoring endpoints
type RealtimeSyncHandlers struct {
	realtimeRepo *repository.RealtimeSyncRepository
	repo         *repository.Repository
}

// NewRealtimeSyncHandlers creates a new real-time sync handlers instance
func NewRealtimeSyncHandlers(realtimeRepo *repository.RealtimeSyncRepository, repo *repository.Repository) *RealtimeSyncHandlers {
	return &RealtimeSyncHandlers{
		realtimeRepo: realtimeRepo,
		repo:         repo,
	}
}

// ============================================================================
// SSE STREAMING
// ============================================================================

// StreamSyncProgress streams real-time sync progress via Server-Sent Events (SSE)
func (h *RealtimeSyncHandlers) StreamSyncProgress(w http.ResponseWriter, r *http.Request) {
	// Set headers for SSE
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("X-Accel-Buffering", "no") // Disable nginx buffering

	// Get sync log ID from query params (optional - if not provided, stream latest)
	syncLogIDStr := r.URL.Query().Get("sync_log_id")
	var syncLogID uuid.UUID
	var err error

	if syncLogIDStr != "" {
		syncLogID, err = uuid.Parse(syncLogIDStr)
		if err != nil {
			sendSSEError(w, "Invalid sync_log_id parameter")
			return
		}
	}

	// Create context that cancels when client disconnects
	ctx := r.Context()

	// Flush immediately to establish connection
	if flusher, ok := w.(http.Flusher); ok {
		flusher.Flush()
	}

	log.Printf("SSE: Client connected for sync progress streaming")

	// Send heartbeat and progress updates
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	heartbeatTicker := time.NewTicker(15 * time.Second)
	defer heartbeatTicker.Stop()

	lastProgressJSON := ""

	for {
		select {
		case <-ctx.Done():
			// Client disconnected
			log.Printf("SSE: Client disconnected")
			return

		case <-heartbeatTicker.C:
			// Send heartbeat to keep connection alive
			sendSSEMessage(w, models.SSEMessage{
				Event: models.SSEEventHeartbeat,
				Data:  map[string]interface{}{"timestamp": time.Now()},
			})

		case <-ticker.C:
			// Get latest sync log ID if not provided
			if syncLogID == uuid.Nil {
				latestLog, err := h.getLatestSyncLog(ctx)
				if err != nil {
					log.Printf("SSE: Failed to get latest sync log: %v", err)
					continue
				}
				if latestLog != nil {
					syncLogID = latestLog.ID
				} else {
					// No sync logs yet
					continue
				}
			}

			// Get realtime progress
			progress, err := h.realtimeRepo.GetRealtimeProgress(ctx, syncLogID)
			if err != nil {
				log.Printf("SSE: Failed to get realtime progress: %v", err)
				// If sync log not found, reset and try to get latest
				syncLogID = uuid.Nil
				continue
			}

			// Convert progress to JSON to check if it changed
			progressJSON, err := json.Marshal(progress)
			if err != nil {
				log.Printf("SSE: Failed to marshal progress: %v", err)
				continue
			}

			// Only send if progress changed (reduces network traffic)
			if string(progressJSON) != lastProgressJSON {
				sendSSEMessage(w, models.SSEMessage{
					Event: models.SSEEventProgress,
					Data:  progress,
					ID:    progress.SyncLogID.String(),
				})
				lastProgressJSON = string(progressJSON)

				// If sync is complete and not running, send complete event
				if !progress.IsRunning && progress.Status == "completed" {
					sendSSEMessage(w, models.SSEMessage{
						Event: models.SSEEventComplete,
						Data:  progress,
					})
				}

				// If sync failed, send error event
				if progress.Status == "failed" && progress.ErrorMessage != nil {
					sendSSEMessage(w, models.SSEMessage{
						Event: models.SSEEventError,
						Data: map[string]interface{}{
							"error":   *progress.ErrorMessage,
							"sync_id": progress.SyncLogID,
						},
					})
				}
			}
		}
	}
}

// StreamSyncLogs streams real-time log entries via SSE
func (h *RealtimeSyncHandlers) StreamSyncLogs(w http.ResponseWriter, r *http.Request) {
	// Set headers for SSE
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("X-Accel-Buffering", "no")

	// Get sync log ID from query params
	syncLogIDStr := r.URL.Query().Get("sync_log_id")
	if syncLogIDStr == "" {
		sendSSEError(w, "sync_log_id parameter is required")
		return
	}

	syncLogID, err := uuid.Parse(syncLogIDStr)
	if err != nil {
		sendSSEError(w, "Invalid sync_log_id parameter")
		return
	}

	// Create context that cancels when client disconnects
	ctx := r.Context()

	// Flush immediately to establish connection
	if flusher, ok := w.(http.Flusher); ok {
		flusher.Flush()
	}

	log.Printf("SSE: Client connected for log streaming (sync_log_id=%s)", syncLogID)

	// Track last seen log entry timestamp
	lastTimestamp := time.Now().Add(-1 * time.Hour) // Start from 1 hour ago

	ticker := time.NewTicker(500 * time.Millisecond) // Check every 500ms for new logs
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Printf("SSE: Client disconnected from log streaming")
			return

		case <-ticker.C:
			// Get new log entries since last timestamp
			filter := &models.LogEntryFilter{
				SyncLogID: syncLogID,
				StartTime: &lastTimestamp,
				Limit:     100,
				Offset:    0,
			}

			response, err := h.realtimeRepo.GetLogEntries(ctx, filter)
			if err != nil {
				log.Printf("SSE: Failed to get log entries: %v", err)
				continue
			}

			// Send each new log entry
			for i := len(response.Data) - 1; i >= 0; i-- {
				entry := response.Data[i]
				sendSSEMessage(w, models.SSEMessage{
					Event: models.SSEEventLog,
					Data:  entry,
					ID:    entry.ID.String(),
				})

				// Update last timestamp
				if entry.Timestamp.After(lastTimestamp) {
					lastTimestamp = entry.Timestamp
				}
			}
		}
	}
}

// ============================================================================
// LOG ENTRIES
// ============================================================================

// GetLogEntries retrieves log entries with filtering
func (h *RealtimeSyncHandlers) GetLogEntries(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	// Get sync log ID from query params
	syncLogIDStr := r.URL.Query().Get("sync_log_id")
	if syncLogIDStr == "" {
		http.Error(w, "sync_log_id parameter is required", http.StatusBadRequest)
		return
	}

	syncLogID, err := uuid.Parse(syncLogIDStr)
	if err != nil {
		http.Error(w, "Invalid sync_log_id parameter", http.StatusBadRequest)
		return
	}

	// Parse filters
	filter := &models.LogEntryFilter{
		SyncLogID: syncLogID,
		Limit:     getIntParam(r, "limit", 100),
		Offset:    getIntParam(r, "offset", 0),
	}

	// Parse level filter
	if levelsStr := r.URL.Query().Get("levels"); levelsStr != "" {
		levels := make([]models.LogLevel, 0)
		for _, level := range splitAndTrim(levelsStr, ",") {
			levels = append(levels, models.LogLevel(level))
		}
		filter.Levels = levels
	}

	// Parse step filter
	if stepsStr := r.URL.Query().Get("steps"); stepsStr != "" {
		steps := make([]int, 0)
		for _, stepStr := range splitAndTrim(stepsStr, ",") {
			step, err := strconv.Atoi(stepStr)
			if err == nil {
				steps = append(steps, step)
			}
		}
		filter.StepNumbers = steps
	}

	// Parse search query
	if searchQuery := r.URL.Query().Get("search"); searchQuery != "" {
		filter.SearchQuery = searchQuery
	}

	// Get log entries
	response, err := h.realtimeRepo.GetLogEntries(ctx, filter)
	if err != nil {
		log.Printf("Failed to get log entries: %v", err)
		http.Error(w, "Failed to retrieve log entries", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// ExportLogEntries exports log entries to CSV or JSON
func (h *RealtimeSyncHandlers) ExportLogEntries(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 60*time.Second)
	defer cancel()

	// Get sync log ID from query params
	syncLogIDStr := r.URL.Query().Get("sync_log_id")
	if syncLogIDStr == "" {
		http.Error(w, "sync_log_id parameter is required", http.StatusBadRequest)
		return
	}

	syncLogID, err := uuid.Parse(syncLogIDStr)
	if err != nil {
		http.Error(w, "Invalid sync_log_id parameter", http.StatusBadRequest)
		return
	}

	// Get export format (default: json)
	format := r.URL.Query().Get("format")
	if format == "" {
		format = "json"
	}

	// Get all log entries (no pagination for export)
	filter := &models.LogEntryFilter{
		SyncLogID: syncLogID,
		Limit:     10000, // Max export limit
		Offset:    0,
	}

	response, err := h.realtimeRepo.GetLogEntries(ctx, filter)
	if err != nil {
		log.Printf("Failed to get log entries for export: %v", err)
		http.Error(w, "Failed to retrieve log entries", http.StatusInternalServerError)
		return
	}

	// Export based on format
	switch format {
	case "json":
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=sync_logs_%s.json", syncLogID))
		json.NewEncoder(w).Encode(response.Data)

	case "csv":
		w.Header().Set("Content-Type", "text/csv")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=sync_logs_%s.csv", syncLogID))

		// Write CSV header
		fmt.Fprintf(w, "Timestamp,Level,Step,Message\n")

		// Write CSV rows
		for _, entry := range response.Data {
			stepStr := ""
			if entry.StepNumber != nil {
				stepStr = strconv.Itoa(*entry.StepNumber)
			}
			// Escape message for CSV
			message := escapeCSV(entry.Message)
			fmt.Fprintf(w, "%s,%s,%s,%s\n", entry.Timestamp.Format(time.RFC3339), entry.Level, stepStr, message)
		}

	default:
		http.Error(w, "Invalid format parameter. Use 'json' or 'csv'", http.StatusBadRequest)
	}
}

// ============================================================================
// PROGRESS SNAPSHOTS
// ============================================================================

// GetProgressSnapshots retrieves progress snapshots
func (h *RealtimeSyncHandlers) GetProgressSnapshots(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	// Get sync log ID from query params
	syncLogIDStr := r.URL.Query().Get("sync_log_id")
	if syncLogIDStr == "" {
		http.Error(w, "sync_log_id parameter is required", http.StatusBadRequest)
		return
	}

	syncLogID, err := uuid.Parse(syncLogIDStr)
	if err != nil {
		http.Error(w, "Invalid sync_log_id parameter", http.StatusBadRequest)
		return
	}

	limit := getIntParam(r, "limit", 100)
	offset := getIntParam(r, "offset", 0)

	response, err := h.realtimeRepo.GetProgressSnapshots(ctx, syncLogID, limit, offset)
	if err != nil {
		log.Printf("Failed to get progress snapshots: %v", err)
		http.Error(w, "Failed to retrieve progress snapshots", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// ============================================================================
// API REQUESTS
// ============================================================================

// GetAPIRequests retrieves API request logs
func (h *RealtimeSyncHandlers) GetAPIRequests(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	// Get sync log ID from query params
	syncLogIDStr := r.URL.Query().Get("sync_log_id")
	if syncLogIDStr == "" {
		http.Error(w, "sync_log_id parameter is required", http.StatusBadRequest)
		return
	}

	syncLogID, err := uuid.Parse(syncLogIDStr)
	if err != nil {
		http.Error(w, "Invalid sync_log_id parameter", http.StatusBadRequest)
		return
	}

	limit := getIntParam(r, "limit", 50)
	offset := getIntParam(r, "offset", 0)

	response, err := h.realtimeRepo.GetAPIRequests(ctx, syncLogID, limit, offset)
	if err != nil {
		log.Printf("Failed to get API requests: %v", err)
		http.Error(w, "Failed to retrieve API requests", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// ============================================================================
// REALTIME PROGRESS
// ============================================================================

// GetRealtimeProgress retrieves current sync progress
func (h *RealtimeSyncHandlers) GetRealtimeProgress(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	// Get sync log ID from path or query
	vars := mux.Vars(r)
	syncLogIDStr := vars["sync_log_id"]
	if syncLogIDStr == "" {
		syncLogIDStr = r.URL.Query().Get("sync_log_id")
	}

	// If no sync log ID provided, get latest
	if syncLogIDStr == "" {
		latestLog, err := h.getLatestSyncLog(ctx)
		if err != nil {
			http.Error(w, "Failed to get latest sync log", http.StatusInternalServerError)
			return
		}
		if latestLog == nil {
			http.Error(w, "No sync logs found", http.StatusNotFound)
			return
		}
		syncLogIDStr = latestLog.ID.String()
	}

	syncLogID, err := uuid.Parse(syncLogIDStr)
	if err != nil {
		http.Error(w, "Invalid sync_log_id parameter", http.StatusBadRequest)
		return
	}

	progress, err := h.realtimeRepo.GetRealtimeProgress(ctx, syncLogID)
	if err != nil {
		log.Printf("Failed to get realtime progress: %v", err)
		http.Error(w, "Failed to retrieve progress", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(progress)
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// sendSSEMessage sends an SSE message to the client
func sendSSEMessage(w http.ResponseWriter, msg models.SSEMessage) {
	// Marshal data to JSON
	dataJSON, err := json.Marshal(msg.Data)
	if err != nil {
		log.Printf("SSE: Failed to marshal message data: %v", err)
		return
	}

	// Write event
	if msg.Event != "" {
		fmt.Fprintf(w, "event: %s\n", msg.Event)
	}

	// Write ID
	if msg.ID != "" {
		fmt.Fprintf(w, "id: %s\n", msg.ID)
	}

	// Write data
	fmt.Fprintf(w, "data: %s\n\n", dataJSON)

	// Flush immediately
	if flusher, ok := w.(http.Flusher); ok {
		flusher.Flush()
	}
}

// sendSSEError sends an error message via SSE
func sendSSEError(w http.ResponseWriter, errorMsg string) {
	sendSSEMessage(w, models.SSEMessage{
		Event: models.SSEEventError,
		Data:  map[string]string{"error": errorMsg},
	})
}

// getLatestSyncLog retrieves the latest sync log
func (h *RealtimeSyncHandlers) getLatestSyncLog(ctx context.Context) (*models.SyncLog, error) {
	query := `
		SELECT id, sync_type, started_at, finished_at, duration_seconds, status
		FROM sync_logs
		ORDER BY started_at DESC
		LIMIT 1
	`

	var log models.SyncLog
	err := h.repo.Pool().QueryRow(ctx, query).Scan(
		&log.ID,
		&log.SyncType,
		&log.StartedAt,
		&log.FinishedAt,
		&log.DurationSeconds,
		&log.Status,
	)

	if err != nil {
		return nil, err
	}

	return &log, nil
}

// escapeCSV escapes a string for CSV output
func escapeCSV(s string) string {
	// If string contains comma, quote, or newline, wrap in quotes and escape internal quotes
	needsQuoting := false
	for _, c := range s {
		if c == ',' || c == '"' || c == '\n' || c == '\r' {
			needsQuoting = true
			break
		}
	}

	if !needsQuoting {
		return s
	}

	// Escape quotes by doubling them
	escaped := ""
	for _, c := range s {
		if c == '"' {
			escaped += "\"\""
		} else {
			escaped += string(c)
		}
	}

	return "\"" + escaped + "\""
}

// splitAndTrim splits a string by delimiter and trims each part
func splitAndTrim(s, delimiter string) []string {
	parts := make([]string, 0)
	for _, part := range splitString(s, delimiter) {
		trimmed := trimSpace(part)
		if trimmed != "" {
			parts = append(parts, trimmed)
		}
	}
	return parts
}

func splitString(s, delimiter string) []string {
	result := make([]string, 0)
	current := ""
	for i := 0; i < len(s); i++ {
		if i+len(delimiter) <= len(s) && s[i:i+len(delimiter)] == delimiter {
			result = append(result, current)
			current = ""
			i += len(delimiter) - 1
		} else {
			current += string(s[i])
		}
	}
	result = append(result, current)
	return result
}

func trimSpace(s string) string {
	start := 0
	end := len(s)

	for start < end && (s[start] == ' ' || s[start] == '\t' || s[start] == '\n' || s[start] == '\r') {
		start++
	}

	for end > start && (s[end-1] == ' ' || s[end-1] == '\t' || s[end-1] == '\n' || s[end-1] == '\r') {
		end--
	}

	return s[start:end]
}

// getIntParam parses an integer query parameter with a default value
func getIntParam(r *http.Request, param string, defaultValue int) int {
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
