package handlers

import (
	"encoding/json"
	"net/http"

	"ultra-api-testing/internal/models"
	"ultra-api-testing/internal/repository"
)

// ComparisonHandler contains all comparison-related HTTP handlers
type ComparisonHandler struct {
	comparisonRepo *repository.ComparisonRepository
}

// NewComparisonHandler creates a new ComparisonHandler instance
func NewComparisonHandler(comparisonRepo *repository.ComparisonRepository) *ComparisonHandler {
	return &ComparisonHandler{
		comparisonRepo: comparisonRepo,
	}
}

// ============================================================================
// COMPARISON & DIFF ENDPOINTS
// ============================================================================

// CompareSync handles POST /api/v1/sync/compare
func (h *ComparisonHandler) CompareSync(w http.ResponseWriter, r *http.Request) {
	var request models.ComparisonRequest

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	// Validate request
	if len(request.SelectedSteps) == 0 {
		respondError(w, http.StatusBadRequest, "At least one step must be selected", "")
		return
	}

	// Execute comparison
	comparisons, err := h.comparisonRepo.CompareSync(r.Context(), &request)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to compare sync", err.Error())
		return
	}

	// Calculate totals
	totalToInsert := 0
	totalToUpdate := 0
	totalUnchanged := 0
	totalConflicts := 0

	for _, comp := range comparisons {
		totalToInsert += comp.ToInsert
		totalToUpdate += comp.ToUpdate
		totalUnchanged += comp.Unchanged
		totalConflicts += comp.Conflicts
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": comparisons,
		"summary": map[string]interface{}{
			"total_to_insert":   totalToInsert,
			"total_to_update":   totalToUpdate,
			"total_unchanged":   totalUnchanged,
			"total_conflicts":   totalConflicts,
			"estimated_changes": totalToInsert + totalToUpdate,
		},
	})
}
