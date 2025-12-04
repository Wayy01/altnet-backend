package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"ultra-api-testing/internal/models"
	"ultra-api-testing/internal/repository"
)

// StoreHandler handles store endpoints
type StoreHandler struct {
	storeRepo *repository.StoreRepository
}

// NewStoreHandler creates a new store handler
func NewStoreHandler(storeRepo *repository.StoreRepository) *StoreHandler {
	return &StoreHandler{
		storeRepo: storeRepo,
	}
}

// ListStores handles GET /api/v1/stores
func (h *StoreHandler) ListStores(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	// Parse pagination
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	// Parse filters
	filters := &models.StoreFilters{
		Search:     r.URL.Query().Get("search"),
		ActiveOnly: r.URL.Query().Get("active_only") == "true",
	}

	stores, err := h.storeRepo.ListStores(ctx, filters, limit, offset)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch stores", err.Error())
		return
	}

	total, err := h.storeRepo.CountStores(ctx, filters)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to count stores", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": stores,
		"meta": map[string]interface{}{
			"limit":  limit,
			"offset": offset,
			"total":  total,
		},
	})
}

// GetStore handles GET /api/v1/stores/{id}
func (h *StoreHandler) GetStore(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid store ID", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	store, err := h.storeRepo.GetStore(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrStoreNotFound) {
			respondError(w, http.StatusNotFound, "Store not found", err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to fetch store", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": store,
	})
}

// CreateStore handles POST /api/v1/stores (admin only)
func (h *StoreHandler) CreateStore(w http.ResponseWriter, r *http.Request) {
	var input models.StoreInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	// Validate required fields
	if input.Name == "" {
		respondError(w, http.StatusBadRequest, "Validation failed", "name is required")
		return
	}
	if input.Address == "" {
		respondError(w, http.StatusBadRequest, "Validation failed", "address is required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	store, err := h.storeRepo.CreateStore(ctx, &input)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Failed to create store", err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, map[string]interface{}{
		"data": store,
	})
}

// UpdateStore handles PUT /api/v1/stores/{id} (admin only)
func (h *StoreHandler) UpdateStore(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid store ID", err.Error())
		return
	}

	var input models.StoreInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	// Validate required fields
	if input.Name == "" {
		respondError(w, http.StatusBadRequest, "Validation failed", "name is required")
		return
	}
	if input.Address == "" {
		respondError(w, http.StatusBadRequest, "Validation failed", "address is required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	store, err := h.storeRepo.UpdateStore(ctx, id, &input)
	if err != nil {
		if errors.Is(err, repository.ErrStoreNotFound) {
			respondError(w, http.StatusNotFound, "Store not found", err.Error())
			return
		}
		respondError(w, http.StatusBadRequest, "Failed to update store", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": store,
	})
}

// DeleteStore handles DELETE /api/v1/stores/{id} (admin only)
func (h *StoreHandler) DeleteStore(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid store ID", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	err = h.storeRepo.DeleteStore(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrStoreNotFound) {
			respondError(w, http.StatusNotFound, "Store not found", err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to delete store", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Store deleted successfully",
	})
}

// ToggleStore handles PATCH /api/v1/stores/{id}/toggle (admin only)
func (h *StoreHandler) ToggleStore(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid store ID", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	store, err := h.storeRepo.ToggleStoreActive(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrStoreNotFound) {
			respondError(w, http.StatusNotFound, "Store not found", err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to toggle store", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": store,
	})
}
