package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

// Constants for property hierarchy handlers
const (
	DefaultLimit  = 50
	MaxGroupLimit = 100
	MaxNameLimit  = 100
	MaxValueLimit = 100
	QueryTimeout  = 30 * time.Second
)

// ============================================================================
// PROPERTY GROUP HANDLERS (Level 1)
// ============================================================================

// ListPropertyGroups lists all property groups
func (h *Handler) ListPropertyGroups(w http.ResponseWriter, r *http.Request) {
	// Create context with timeout
	ctx, cancel := context.WithTimeout(r.Context(), QueryTimeout)
	defer cancel()

	// Parse query parameters
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	search := r.URL.Query().Get("search")

	// Set defaults
	if limit <= 0 || limit > MaxGroupLimit {
		limit = DefaultLimit
	}

	// Get groups from repository
	groups, total, err := h.repo.ListPropertyGroups(ctx, limit, offset, search)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to list property groups", err.Error())
		return
	}

	// Respond with paginated result
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data":   groups,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// GetPropertyGroup returns a single property group
func (h *Handler) GetPropertyGroup(w http.ResponseWriter, r *http.Request) {
	// Create context with timeout
	ctx, cancel := context.WithTimeout(r.Context(), QueryTimeout)
	defer cancel()

	groupName := mux.Vars(r)["group_name"]

	group, err := h.repo.GetPropertyGroupByName(ctx, groupName)
	if err != nil {
		respondError(w, http.StatusNotFound, "Property group not found", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, group)
}

// DeletePropertyGroup deletes a property group
func (h *Handler) DeletePropertyGroup(w http.ResponseWriter, r *http.Request) {
	// Create context with timeout
	ctx, cancel := context.WithTimeout(r.Context(), QueryTimeout)
	defer cancel()

	groupName := mux.Vars(r)["group_name"]

	err := h.repo.DeletePropertyGroup(ctx, groupName)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to delete property group", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{
		"message": "Property group deleted successfully",
	})
}

// GetGroupDeletionImpact returns the impact of deleting a group
func (h *Handler) GetGroupDeletionImpact(w http.ResponseWriter, r *http.Request) {
	// Create context with timeout
	ctx, cancel := context.WithTimeout(r.Context(), QueryTimeout)
	defer cancel()

	groupName := mux.Vars(r)["group_name"]

	impact, err := h.repo.GetGroupDeletionImpact(ctx, groupName)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to calculate deletion impact", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, impact)
}

// ============================================================================
// PROPERTY NAME HANDLERS (Level 2)
// ============================================================================

// ListPropertyNames lists all property names within a group
func (h *Handler) ListPropertyNames(w http.ResponseWriter, r *http.Request) {
	// Create context with timeout
	ctx, cancel := context.WithTimeout(r.Context(), QueryTimeout)
	defer cancel()

	groupName := mux.Vars(r)["group_name"]

	// Parse query parameters
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	search := r.URL.Query().Get("search")

	// Set defaults
	if limit <= 0 || limit > MaxNameLimit {
		limit = DefaultLimit
	}

	// Get property names from repository
	names, total, err := h.repo.ListPropertyNames(ctx, groupName, limit, offset, search)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to list property names", err.Error())
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

// GetPropertyName returns a single property name
func (h *Handler) GetPropertyName(w http.ResponseWriter, r *http.Request) {
	// Create context with timeout
	ctx, cancel := context.WithTimeout(r.Context(), QueryTimeout)
	defer cancel()

	vars := mux.Vars(r)
	groupName := vars["group_name"]
	propertyName := vars["property_name"]

	name, err := h.repo.GetPropertyNameByName(ctx, groupName, propertyName)
	if err != nil {
		respondError(w, http.StatusNotFound, "Property name not found", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, name)
}

// DeletePropertyName deletes a property name
func (h *Handler) DeletePropertyName(w http.ResponseWriter, r *http.Request) {
	// Create context with timeout
	ctx, cancel := context.WithTimeout(r.Context(), QueryTimeout)
	defer cancel()

	vars := mux.Vars(r)
	groupName := vars["group_name"]
	propertyName := vars["property_name"]

	err := h.repo.DeletePropertyName(ctx, groupName, propertyName)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to delete property name", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{
		"message": "Property name deleted successfully",
	})
}

// GetPropertyNameDeletionImpact returns the impact of deleting a property name
func (h *Handler) GetPropertyNameDeletionImpact(w http.ResponseWriter, r *http.Request) {
	// Create context with timeout
	ctx, cancel := context.WithTimeout(r.Context(), QueryTimeout)
	defer cancel()

	vars := mux.Vars(r)
	groupName := vars["group_name"]
	propertyName := vars["property_name"]

	impact, err := h.repo.GetPropertyNameDeletionImpact(ctx, groupName, propertyName)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to calculate deletion impact", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, impact)
}

// ============================================================================
// PROPERTY VALUE HANDLERS (Level 3)
// ============================================================================

// ListPropertyValues lists all values for a property name
func (h *Handler) ListPropertyValues(w http.ResponseWriter, r *http.Request) {
	// Create context with timeout
	ctx, cancel := context.WithTimeout(r.Context(), QueryTimeout)
	defer cancel()

	vars := mux.Vars(r)
	groupName := vars["group_name"]
	propertyName := vars["property_name"]

	// Parse query parameters
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	search := r.URL.Query().Get("search")

	// Set defaults
	if limit <= 0 || limit > MaxValueLimit {
		limit = MaxValueLimit
	}

	// Get property values from repository
	values, total, err := h.repo.ListPropertyValues(ctx, groupName, propertyName, limit, offset, search)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to list property values", err.Error())
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

// UpdatePropertyValue updates a single property value
func (h *Handler) UpdatePropertyValue(w http.ResponseWriter, r *http.Request) {
	// Create context with timeout
	ctx, cancel := context.WithTimeout(r.Context(), QueryTimeout)
	defer cancel()

	vars := mux.Vars(r)
	idStr := vars["value_id"]

	// Parse UUID
	id, err := uuid.Parse(idStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid property value ID", err.Error())
		return
	}

	// Parse request body
	var updates map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	// Update property value
	err = h.repo.UpdatePropertyValue(ctx, id, updates)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to update property value", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{
		"message": "Property value updated successfully",
	})
}

// DeletePropertyValue deletes a single property value
func (h *Handler) DeletePropertyValue(w http.ResponseWriter, r *http.Request) {
	// Create context with timeout
	ctx, cancel := context.WithTimeout(r.Context(), QueryTimeout)
	defer cancel()

	vars := mux.Vars(r)
	idStr := vars["value_id"]

	// Parse UUID
	id, err := uuid.Parse(idStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid property value ID", err.Error())
		return
	}

	// Delete property value
	err = h.repo.DeletePropertyValue(ctx, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to delete property value", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{
		"message": "Property value deleted successfully",
	})
}

// BulkDeletePropertyValues deletes multiple property values
func (h *Handler) BulkDeletePropertyValues(w http.ResponseWriter, r *http.Request) {
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
			respondError(w, http.StatusBadRequest, "Invalid property value ID", err.Error())
			return
		}
		ids[i] = id
	}

	// Bulk delete
	err := h.repo.BulkDeletePropertyValues(ctx, ids)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to bulk delete property values", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Property values deleted successfully",
		"count":   len(ids),
	})
}

// BulkUpdatePropertyValues updates multiple property values
func (h *Handler) BulkUpdatePropertyValues(w http.ResponseWriter, r *http.Request) {
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
			respondError(w, http.StatusBadRequest, "Invalid property value ID", err.Error())
			return
		}
		ids[i] = id
	}

	// Bulk update
	err := h.repo.BulkUpdatePropertyValues(ctx, ids, request.Updates)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to bulk update property values", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Property values updated successfully",
		"count":   len(ids),
	})
}
