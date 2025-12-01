package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

// Constants for product grouping handlers
const (
	MaxGroupingLimit  = 100
	MaxVariantLimit   = 100
	MaxBulkVariantIDs = 1000
)

// ============================================================================
// PRODUCT GROUP HANDLERS (Level 1)
// ============================================================================

// ListProductGroups lists all product groups (parent products with variants)
func (h *Handler) ListProductGroups(w http.ResponseWriter, r *http.Request) {
	// Create context with timeout
	ctx, cancel := context.WithTimeout(r.Context(), QueryTimeout)
	defer cancel()

	// Parse query parameters
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	search := r.URL.Query().Get("search")

	// Set defaults
	if limit <= 0 || limit > MaxGroupingLimit {
		limit = DefaultLimit
	}

	// Get groups from repository
	groups, total, err := h.repo.ListProductGroups(ctx, limit, offset, search)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to list product groups", err.Error())
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

// GetProductGroup returns a single product group
func (h *Handler) GetProductGroup(w http.ResponseWriter, r *http.Request) {
	// Create context with timeout
	ctx, cancel := context.WithTimeout(r.Context(), QueryTimeout)
	defer cancel()

	vars := mux.Vars(r)
	idStr := vars["id"]

	// Parse UUID
	id, err := uuid.Parse(idStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid product group ID", err.Error())
		return
	}

	group, err := h.repo.GetProductGroupByID(ctx, id)
	if err != nil {
		respondError(w, http.StatusNotFound, "Product group not found", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": group,
	})
}

// DeleteProductGroup deletes a product group and unlinks its variants
func (h *Handler) DeleteProductGroup(w http.ResponseWriter, r *http.Request) {
	// Create context with timeout
	ctx, cancel := context.WithTimeout(r.Context(), QueryTimeout)
	defer cancel()

	vars := mux.Vars(r)
	idStr := vars["id"]

	// Parse UUID
	id, err := uuid.Parse(idStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid product group ID", err.Error())
		return
	}

	err = h.repo.DeleteProductGroup(ctx, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to delete product group", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{
		"message": "Product group deleted successfully",
	})
}

// GetProductGroupDeletionImpact returns the impact of deleting a product group
func (h *Handler) GetProductGroupDeletionImpact(w http.ResponseWriter, r *http.Request) {
	// Create context with timeout
	ctx, cancel := context.WithTimeout(r.Context(), QueryTimeout)
	defer cancel()

	vars := mux.Vars(r)
	idStr := vars["id"]

	// Parse UUID
	id, err := uuid.Parse(idStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid product group ID", err.Error())
		return
	}

	impact, err := h.repo.GetProductGroupDeletionImpact(ctx, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to calculate deletion impact", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, impact)
}

// ============================================================================
// PRODUCT VARIANT HANDLERS (Level 2)
// ============================================================================

// ListProductVariants lists all variants for a parent product
func (h *Handler) ListProductVariants(w http.ResponseWriter, r *http.Request) {
	// Create context with timeout
	ctx, cancel := context.WithTimeout(r.Context(), QueryTimeout)
	defer cancel()

	vars := mux.Vars(r)
	parentIDStr := vars["id"]

	// Parse UUID
	parentID, err := uuid.Parse(parentIDStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid parent product ID", err.Error())
		return
	}

	// Parse query parameters
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	search := r.URL.Query().Get("search")

	// Set defaults
	if limit <= 0 || limit > MaxVariantLimit {
		limit = DefaultLimit
	}

	// Get variants from repository
	variants, total, err := h.repo.ListProductVariants(ctx, parentID, limit, offset, search)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to list product variants", err.Error())
		return
	}

	// Respond with paginated result
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data":   variants,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// DeleteProductVariant unlinks a variant from its parent
func (h *Handler) DeleteProductVariant(w http.ResponseWriter, r *http.Request) {
	// Create context with timeout
	ctx, cancel := context.WithTimeout(r.Context(), QueryTimeout)
	defer cancel()

	vars := mux.Vars(r)
	idStr := vars["id"]

	// Parse UUID
	id, err := uuid.Parse(idStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid product variant ID", err.Error())
		return
	}

	// Delete variant
	err = h.repo.DeleteProductVariant(ctx, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to unlink product variant", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{
		"message": "Product variant unlinked successfully",
	})
}

// BulkDeleteProductVariants unlinks multiple variants
func (h *Handler) BulkDeleteProductVariants(w http.ResponseWriter, r *http.Request) {
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
	if len(request.IDs) > MaxBulkVariantIDs {
		respondError(w, http.StatusBadRequest, fmt.Sprintf("Too many IDs (max %d)", MaxBulkVariantIDs), "")
		return
	}

	// Parse UUIDs
	ids := make([]uuid.UUID, len(request.IDs))
	for i, idStr := range request.IDs {
		id, err := uuid.Parse(idStr)
		if err != nil {
			respondError(w, http.StatusBadRequest, "Invalid product variant ID", err.Error())
			return
		}
		ids[i] = id
	}

	// Bulk delete
	err := h.repo.BulkDeleteProductVariants(ctx, ids)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to bulk unlink product variants", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Product variants unlinked successfully",
		"count":   len(ids),
	})
}

// BulkUpdateProductVariants updates multiple variants
func (h *Handler) BulkUpdateProductVariants(w http.ResponseWriter, r *http.Request) {
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
	if len(request.IDs) > MaxBulkVariantIDs {
		respondError(w, http.StatusBadRequest, fmt.Sprintf("Too many IDs (max %d)", MaxBulkVariantIDs), "")
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
			respondError(w, http.StatusBadRequest, "Invalid product variant ID", err.Error())
			return
		}
		ids[i] = id
	}

	// Bulk update
	err := h.repo.BulkUpdateProductVariants(ctx, ids, request.Updates)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to bulk update product variants", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Product variants updated successfully",
		"count":   len(ids),
	})
}

// ============================================================================
// POST-PROCESSING HANDLERS
// ============================================================================

// TriggerProductGrouping triggers the product variant grouping algorithm
func (h *Handler) TriggerProductGrouping(w http.ResponseWriter, r *http.Request) {
	// Create context with a longer timeout for the grouping process
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Minute)
	defer cancel()

	// Run the grouping algorithm
	err := h.repo.GroupProductVariants(ctx)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to group product variants", err.Error())
		return
	}

	// Get grouping statistics
	totalGroups, totalVariants, err := h.repo.GetGroupingStatistics(ctx)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to get grouping statistics", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message":        "Product variant grouping completed successfully",
		"total_groups":   totalGroups,
		"total_variants": totalVariants,
	})
}
