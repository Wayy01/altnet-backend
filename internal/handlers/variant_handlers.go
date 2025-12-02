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
	"ultra-api-testing/internal/variants"
)

// VariantHandler handles variant-related HTTP requests
type VariantHandler struct {
	generator *variants.Generator
	repo      *variants.Repository
}

// NewVariantHandler creates a new variant handler
func NewVariantHandler(generator *variants.Generator, repo *variants.Repository) *VariantHandler {
	return &VariantHandler{
		generator: generator,
		repo:      repo,
	}
}

// ============================================================================
// GENERATION ENDPOINTS
// ============================================================================

// TriggerGeneration handles POST /api/v1/variants/generate
func (h *VariantHandler) TriggerGeneration(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	// Parse request body
	var req models.TriggerGenerationRequest
	if r.Body != nil && r.ContentLength > 0 {
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, http.StatusBadRequest, "Invalid request body", err.Error())
			return
		}
	}

	// Default to clearing existing groups
	if r.ContentLength == 0 {
		req.ClearExisting = true
	}

	// Start generation
	job, err := h.generator.StartGeneration(ctx, req.ClearExisting)
	if err != nil {
		respondError(w, http.StatusConflict, "Failed to start generation", err.Error())
		return
	}

	respondJSON(w, http.StatusAccepted, map[string]interface{}{
		"data": job,
		"meta": map[string]interface{}{
			"message": "Variant generation started",
		},
	})
}

// GetGenerationStatus handles GET /api/v1/variants/status
func (h *VariantHandler) GetGenerationStatus(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	// Check for active job
	activeJob := h.generator.GetActiveJob()
	if activeJob != nil {
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"data": activeJob,
			"meta": map[string]interface{}{
				"is_running": true,
			},
		})
		return
	}

	// Get latest job from database
	jobs, _, err := h.repo.ListJobs(ctx, 1, 0)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to get status", err.Error())
		return
	}

	if len(jobs) == 0 {
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"data": nil,
			"meta": map[string]interface{}{
				"is_running": false,
				"message":    "No generation jobs found",
			},
		})
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": jobs[0],
		"meta": map[string]interface{}{
			"is_running": false,
		},
	})
}

// ============================================================================
// JOB ENDPOINTS
// ============================================================================

// ListJobs handles GET /api/v1/variants/jobs
func (h *VariantHandler) ListJobs(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	limit := getIntParamVariantWithMax(r, "limit", 20, maxLimit)
	offset := getIntParamVariant(r, "offset", 0)

	jobs, total, err := h.repo.ListJobs(ctx, limit, offset)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to list jobs", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": jobs,
		"meta": map[string]interface{}{
			"limit":  limit,
			"offset": offset,
			"total":  total,
		},
	})
}

// GetJob handles GET /api/v1/variants/jobs/{id}
func (h *VariantHandler) GetJob(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	vars := mux.Vars(r)
	jobID, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid job ID", err.Error())
		return
	}

	job, err := h.repo.GetJob(ctx, jobID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to get job", err.Error())
		return
	}

	if job == nil {
		respondError(w, http.StatusNotFound, "Job not found", "")
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": job,
	})
}

// CancelJob handles POST /api/v1/variants/jobs/{id}/cancel
func (h *VariantHandler) CancelJob(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	jobID, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid job ID", err.Error())
		return
	}

	if err := h.generator.CancelGeneration(jobID); err != nil {
		respondError(w, http.StatusConflict, "Failed to cancel job", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": map[string]interface{}{
			"message": "Job cancellation requested",
			"job_id":  jobID,
		},
	})
}

// ============================================================================
// GROUP ENDPOINTS
// ============================================================================

// ListGroups handles GET /api/v1/variants/groups
func (h *VariantHandler) ListGroups(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	limit := getIntParamVariantWithMax(r, "limit", 20, maxLimit)
	offset := getIntParamVariant(r, "offset", 0)
	search := r.URL.Query().Get("search")

	groups, total, err := h.repo.ListGroups(ctx, limit, offset, search)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to list groups", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": groups,
		"meta": map[string]interface{}{
			"limit":  limit,
			"offset": offset,
			"total":  total,
			"search": search,
		},
	})
}

// GetGroup handles GET /api/v1/variants/groups/{id}
func (h *VariantHandler) GetGroup(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	vars := mux.Vars(r)
	groupID, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid group ID", err.Error())
		return
	}

	group, err := h.repo.GetGroup(ctx, groupID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to get group", err.Error())
		return
	}

	if group == nil {
		respondError(w, http.StatusNotFound, "Group not found", "")
		return
	}

	// Check if matrix is requested
	includeMatrix := r.URL.Query().Get("include_matrix") == "true"
	if includeMatrix {
		matrix, err := h.generator.BuildMatrixForGroup(ctx, groupID)
		if err != nil {
			log.Printf("Failed to build matrix for group %s: %v", groupID, err)
		} else {
			group.Matrix = matrix
		}
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": group,
	})
}

// DeleteGroup handles DELETE /api/v1/variants/groups/{id}
func (h *VariantHandler) DeleteGroup(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	vars := mux.Vars(r)
	groupID, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid group ID", err.Error())
		return
	}

	if err := h.repo.DeleteGroup(ctx, groupID); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to delete group", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": map[string]interface{}{
			"message":  "Group deleted successfully",
			"group_id": groupID,
		},
	})
}

// ============================================================================
// SSE STREAMING
// ============================================================================

// StreamProgress handles GET /api/v1/variants/stream/{id} (SSE)
func (h *VariantHandler) StreamProgress(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	jobID, err := uuid.Parse(vars["id"])
	if err != nil {
		http.Error(w, "Invalid job ID", http.StatusBadRequest)
		return
	}

	// Set headers for SSE
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("X-Accel-Buffering", "no")

	// Create context that cancels when client disconnects
	ctx := r.Context()

	// Flush immediately to establish connection
	if flusher, ok := w.(http.Flusher); ok {
		flusher.Flush()
	}

	// Generate unique subscriber ID for this SSE client
	subscriberID := uuid.New().String()

	log.Printf("SSE: Client %s connected for variant generation progress (job_id=%s)", subscriberID, jobID)

	// Subscribe to progress updates
	progressChan := h.generator.Subscribe(subscriberID)
	defer h.generator.Unsubscribe(subscriberID)

	// Send heartbeat and progress updates
	heartbeatTicker := time.NewTicker(15 * time.Second)
	defer heartbeatTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Printf("SSE: Client %s disconnected from variant progress streaming", subscriberID)
			return

		case <-heartbeatTicker.C:
			// Send heartbeat
			sendVariantSSEMessage(w, "heartbeat", map[string]interface{}{
				"timestamp": time.Now(),
			})

		case update, ok := <-progressChan:
			if !ok {
				// Channel closed (generator shutting down or unsubscribed)
				sendVariantSSEMessage(w, "close", map[string]interface{}{
					"message": "Progress channel closed",
				})
				return
			}

			// Only send updates for the requested job
			if update.JobID != jobID {
				continue
			}

			sendVariantSSEMessage(w, "progress", update)

			// If job is complete, send final message and close
			if update.Status == models.VariantJobStatusCompleted ||
				update.Status == models.VariantJobStatusFailed ||
				update.Status == models.VariantJobStatusCancelled {
				sendVariantSSEMessage(w, "complete", update)
				return
			}
		}
	}
}

// ============================================================================
// STATS ENDPOINT
// ============================================================================

// GetStats handles GET /api/v1/variants/stats
func (h *VariantHandler) GetStats(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	stats, err := h.repo.GetStats(ctx)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to get stats", err.Error())
		return
	}

	// Add Ollama status
	stats["ollama_available"] = h.generator.IsOllamaAvailable(ctx)
	stats["ollama_config"] = h.generator.GetOllamaInfo()

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": stats,
	})
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// maxLimit is the maximum allowed limit for pagination to prevent abuse
const maxLimit = 100

func getIntParamVariant(r *http.Request, param string, defaultValue int) int {
	return getIntParamVariantWithMax(r, param, defaultValue, 0)
}

// getIntParamVariantWithMax returns the integer parameter with an optional max bound
func getIntParamVariantWithMax(r *http.Request, param string, defaultValue, maxValue int) int {
	valueStr := r.URL.Query().Get(param)
	if valueStr == "" {
		return defaultValue
	}

	value, err := strconv.Atoi(valueStr)
	if err != nil {
		return defaultValue
	}

	// Ensure non-negative values
	if value < 0 {
		return defaultValue
	}

	// Apply max bound if specified
	if maxValue > 0 && value > maxValue {
		return maxValue
	}

	return value
}

func sendVariantSSEMessage(w http.ResponseWriter, event string, data interface{}) {
	dataJSON, err := json.Marshal(data)
	if err != nil {
		log.Printf("SSE: Failed to marshal message data: %v", err)
		return
	}

	fmt.Fprintf(w, "event: %s\n", event)
	fmt.Fprintf(w, "data: %s\n\n", dataJSON)

	if flusher, ok := w.(http.Flusher); ok {
		flusher.Flush()
	}
}
