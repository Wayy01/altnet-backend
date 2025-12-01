package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"ultra-api-testing/internal/models"
	"ultra-api-testing/internal/repository"
)

// ConflictHandler contains all conflict resolution HTTP handlers
type ConflictHandler struct {
	conflictRepo *repository.ConflictRepository
}

// NewConflictHandler creates a new ConflictHandler instance
func NewConflictHandler(conflictRepo *repository.ConflictRepository) *ConflictHandler {
	return &ConflictHandler{
		conflictRepo: conflictRepo,
	}
}

// ============================================================================
// CONFLICT RESOLUTION ENDPOINTS
// ============================================================================

// ListConflicts handles GET /api/v1/sync/conflicts
func (h *ConflictHandler) ListConflicts(w http.ResponseWriter, r *http.Request) {
	limit, offset := parsePagination(r)

	// Parse filters
	var syncLogID *uuid.UUID
	if syncLogIDStr := r.URL.Query().Get("sync_log_id"); syncLogIDStr != "" {
		id, err := uuid.Parse(syncLogIDStr)
		if err != nil {
			respondError(w, http.StatusBadRequest, "Invalid sync_log_id", err.Error())
			return
		}
		syncLogID = &id
	}

	unresolvedOnly := r.URL.Query().Get("unresolved") == "true"

	conflicts, total, err := h.conflictRepo.ListConflicts(r.Context(), syncLogID, unresolvedOnly, limit, offset)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to list conflicts", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": conflicts,
		"meta": PaginationMeta{
			Limit:  limit,
			Offset: offset,
			Total:  total,
		},
	})
}

// GetConflict handles GET /api/v1/sync/conflicts/{id}
func (h *ConflictHandler) GetConflict(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	conflictID, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid conflict ID", err.Error())
		return
	}

	conflict, err := h.conflictRepo.GetConflictByID(r.Context(), conflictID)
	if err != nil {
		respondError(w, http.StatusNotFound, "Conflict not found", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": conflict,
	})
}

// ResolveConflicts handles POST /api/v1/sync/conflicts/resolve
func (h *ConflictHandler) ResolveConflicts(w http.ResponseWriter, r *http.Request) {
	var request models.ConflictResolutionRequest

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	// Validate request
	if len(request.ConflictIDs) == 0 {
		respondError(w, http.StatusBadRequest, "At least one conflict ID must be provided", "")
		return
	}

	if request.ResolutionStrategy == "" {
		respondError(w, http.StatusBadRequest, "resolution_strategy is required", "")
		return
	}

	// Validate strategy
	validStrategies := map[string]bool{
		"local_wins":  true,
		"remote_wins": true,
		"merge":       true,
		"manual":      true,
	}

	if !validStrategies[request.ResolutionStrategy] {
		respondError(w, http.StatusBadRequest, "Invalid resolution_strategy", "Must be one of: local_wins, remote_wins, merge, manual")
		return
	}

	// Resolve conflicts
	resolved, err := h.conflictRepo.ResolveConflicts(r.Context(), &request)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to resolve conflicts", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message":        fmt.Sprintf("Successfully resolved %d conflict(s)", resolved),
		"resolved_count": resolved,
	})
}

// ============================================================================
// CONFLICT RULE ENDPOINTS
// ============================================================================

// ListConflictRules handles GET /api/v1/sync/conflict-rules
func (h *ConflictHandler) ListConflictRules(w http.ResponseWriter, r *http.Request) {
	activeOnly := r.URL.Query().Get("active") == "true"

	rules, err := h.conflictRepo.ListConflictRules(r.Context(), activeOnly)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to list conflict rules", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": rules,
	})
}

// CreateConflictRule handles POST /api/v1/sync/conflict-rules
func (h *ConflictHandler) CreateConflictRule(w http.ResponseWriter, r *http.Request) {
	var rule models.SyncConflictRule

	if err := json.NewDecoder(r.Body).Decode(&rule); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	// Validate required fields
	if rule.Name == "" {
		respondError(w, http.StatusBadRequest, "name is required", "")
		return
	}

	if rule.EntityType == "" {
		respondError(w, http.StatusBadRequest, "entity_type is required", "")
		return
	}

	if rule.ConflictType == "" {
		respondError(w, http.StatusBadRequest, "conflict_type is required", "")
		return
	}

	if rule.ResolutionStrategy == "" {
		respondError(w, http.StatusBadRequest, "resolution_strategy is required", "")
		return
	}

	// Create rule
	if err := h.conflictRepo.CreateConflictRule(r.Context(), &rule); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to create conflict rule", err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, map[string]interface{}{
		"data":    rule,
		"message": "Conflict rule created successfully",
	})
}

// UpdateConflictRule handles PUT /api/v1/sync/conflict-rules/{id}
func (h *ConflictHandler) UpdateConflictRule(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	ruleID, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid rule ID", err.Error())
		return
	}

	var rule models.SyncConflictRule

	if err := json.NewDecoder(r.Body).Decode(&rule); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	rule.ID = ruleID

	// Update rule
	if err := h.conflictRepo.UpdateConflictRule(r.Context(), &rule); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to update conflict rule", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data":    rule,
		"message": "Conflict rule updated successfully",
	})
}

// DeleteConflictRule handles DELETE /api/v1/sync/conflict-rules/{id}
func (h *ConflictHandler) DeleteConflictRule(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	ruleID, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid rule ID", err.Error())
		return
	}

	if err := h.conflictRepo.DeleteConflictRule(r.Context(), ruleID); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to delete conflict rule", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Conflict rule deleted successfully",
	})
}
