package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

// Constants for characteristic hierarchy handlers
const (
	MaxCharacteristicNameLimit  = 100
	MaxCharacteristicValueLimit = 100
)

// ============================================================================
// CHARACTERISTIC NAME HANDLERS (Level 1)
// ============================================================================

// ListCharacteristicNames lists all characteristic names
func (h *Handler) ListCharacteristicNames(w http.ResponseWriter, r *http.Request) {
	// Create context with timeout
	ctx, cancel := context.WithTimeout(r.Context(), QueryTimeout)
	defer cancel()

	// Parse query parameters
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	search := r.URL.Query().Get("search")

	// Set defaults
	if limit <= 0 || limit > MaxCharacteristicNameLimit {
		limit = DefaultLimit
	}

	// Get names from repository
	names, total, err := h.repo.ListCharacteristicNames(ctx, limit, offset, search)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to list characteristic names", err.Error())
		return
	}

	// Respond with paginated result
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data":   names,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// GetCharacteristicName returns a single characteristic name
func (h *Handler) GetCharacteristicName(w http.ResponseWriter, r *http.Request) {
	// Create context with timeout
	ctx, cancel := context.WithTimeout(r.Context(), QueryTimeout)
	defer cancel()

	characteristicName := mux.Vars(r)["name"]

	name, err := h.repo.GetCharacteristicNameByName(ctx, characteristicName)
	if err != nil {
		respondError(w, http.StatusNotFound, "Characteristic name not found", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, name)
}

// DeleteCharacteristicName deletes a characteristic name
func (h *Handler) DeleteCharacteristicName(w http.ResponseWriter, r *http.Request) {
	// Create context with timeout
	ctx, cancel := context.WithTimeout(r.Context(), QueryTimeout)
	defer cancel()

	characteristicName := mux.Vars(r)["name"]

	err := h.repo.DeleteCharacteristicName(ctx, characteristicName)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to delete characteristic name", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{
		"message": "Characteristic name deleted successfully",
	})
}

// GetCharacteristicNameDeletionImpact returns the impact of deleting a characteristic name
func (h *Handler) GetCharacteristicNameDeletionImpact(w http.ResponseWriter, r *http.Request) {
	// Create context with timeout
	ctx, cancel := context.WithTimeout(r.Context(), QueryTimeout)
	defer cancel()

	characteristicName := mux.Vars(r)["name"]

	impact, err := h.repo.GetCharacteristicNameDeletionImpact(ctx, characteristicName)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to calculate deletion impact", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, impact)
}

// ============================================================================
// CHARACTERISTIC VALUE HANDLERS (Level 2)
// ============================================================================

// ListCharacteristicValues lists all values for a characteristic name
func (h *Handler) ListCharacteristicValues(w http.ResponseWriter, r *http.Request) {
	// Create context with timeout
	ctx, cancel := context.WithTimeout(r.Context(), QueryTimeout)
	defer cancel()

	characteristicName := mux.Vars(r)["name"]

	// Parse query parameters
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	search := r.URL.Query().Get("search")

	// Set defaults (consistent with other handlers)
	if limit <= 0 || limit > MaxCharacteristicValueLimit {
		limit = DefaultLimit
	}

	// Get characteristic values from repository
	values, total, err := h.repo.ListCharacteristicValues(ctx, characteristicName, limit, offset, search)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to list characteristic values", err.Error())
		return
	}

	// Respond with paginated result
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data":   values,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// UpdateCharacteristicValue updates a single characteristic value
func (h *Handler) UpdateCharacteristicValue(w http.ResponseWriter, r *http.Request) {
	// Create context with timeout
	ctx, cancel := context.WithTimeout(r.Context(), QueryTimeout)
	defer cancel()

	vars := mux.Vars(r)
	idStr := vars["id"]

	// Parse UUID
	id, err := uuid.Parse(idStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid characteristic value ID", err.Error())
		return
	}

	// Parse request body
	var updates map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	// Update characteristic value
	err = h.repo.UpdateCharacteristicValue(ctx, id, updates)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to update characteristic value", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{
		"message": "Characteristic value updated successfully",
	})
}

// DeleteCharacteristicValue deletes a single characteristic value
func (h *Handler) DeleteCharacteristicValue(w http.ResponseWriter, r *http.Request) {
	// Create context with timeout
	ctx, cancel := context.WithTimeout(r.Context(), QueryTimeout)
	defer cancel()

	vars := mux.Vars(r)
	idStr := vars["id"]

	// Parse UUID
	id, err := uuid.Parse(idStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid characteristic value ID", err.Error())
		return
	}

	// Delete characteristic value
	err = h.repo.DeleteCharacteristicValue(ctx, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to delete characteristic value", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{
		"message": "Characteristic value deleted successfully",
	})
}

// BulkDeleteCharacteristicValues deletes multiple characteristic values
func (h *Handler) BulkDeleteCharacteristicValues(w http.ResponseWriter, r *http.Request) {
	// Create context with timeout
	ctx, cancel := context.WithTimeout(r.Context(), QueryTimeout)
	defer cancel()

	// Parse request body
	var request struct {
		IDs []string `json:"ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	// Validate IDs
	if len(request.IDs) == 0 {
		respondError(w, http.StatusBadRequest, "No IDs provided", "")
		return
	}

	// Parse UUIDs
	ids := make([]uuid.UUID, len(request.IDs))
	for i, idStr := range request.IDs {
		id, err := uuid.Parse(idStr)
		if err != nil {
			respondError(w, http.StatusBadRequest, "Invalid characteristic value ID", err.Error())
			return
		}
		ids[i] = id
	}

	// Bulk delete
	err := h.repo.BulkDeleteCharacteristicValues(ctx, ids)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to bulk delete characteristic values", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Characteristic values deleted successfully",
		"count":   len(ids),
	})
}

// BulkUpdateCharacteristicValues updates multiple characteristic values
func (h *Handler) BulkUpdateCharacteristicValues(w http.ResponseWriter, r *http.Request) {
	// Create context with timeout
	ctx, cancel := context.WithTimeout(r.Context(), QueryTimeout)
	defer cancel()

	// Parse request body
	var request struct {
		IDs     []string               `json:"ids"`
		Updates map[string]interface{} `json:"updates"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	// Validate input
	if len(request.IDs) == 0 {
		respondError(w, http.StatusBadRequest, "No IDs provided", "")
		return
	}
	if len(request.Updates) == 0 {
		respondError(w, http.StatusBadRequest, "No updates provided", "")
		return
	}

	// Parse UUIDs
	ids := make([]uuid.UUID, len(request.IDs))
	for i, idStr := range request.IDs {
		id, err := uuid.Parse(idStr)
		if err != nil {
			respondError(w, http.StatusBadRequest, "Invalid characteristic value ID", err.Error())
			return
		}
		ids[i] = id
	}

	// Bulk update
	err := h.repo.BulkUpdateCharacteristicValues(ctx, ids, request.Updates)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to bulk update characteristic values", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Characteristic values updated successfully",
		"count":   len(ids),
	})
}
