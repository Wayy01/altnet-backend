package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"ultra-api-testing/internal/models"
	"ultra-api-testing/internal/repository"
)

// FilterHandler handles sync entity filter endpoints
type FilterHandler struct {
	filterRepo *repository.FilterRepository
}

// NewFilterHandler creates a new filter handler
func NewFilterHandler(filterRepo *repository.FilterRepository) *FilterHandler {
	return &FilterHandler{
		filterRepo: filterRepo,
	}
}

// ListFilters handles GET /api/v1/sync/filters
// @Summary List all sync entity filters
// @Description Returns all sync entity filters with pagination
// @Tags Filters
// @Produce json
// @Param limit query int false "Number of results per page (default: 50, max: 100)"
// @Param offset query int false "Pagination offset (default: 0)"
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/sync/filters [get]
func (h *FilterHandler) ListFilters(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	limit, offset := parsePagination(r)

	filters, total, err := h.filterRepo.ListFilters(ctx, limit, offset)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch filters", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": filters,
		"meta": PaginationMeta{
			Total:  total,
			Limit:  limit,
			Offset: offset,
		},
	})
}

// GetFilter handles GET /api/v1/sync/filters/{id}
// @Summary Get a filter by ID
// @Description Returns a single sync entity filter by ID
// @Tags Filters
// @Produce json
// @Param id path string true "Filter ID"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /api/v1/sync/filters/{id} [get]
func (h *FilterHandler) GetFilter(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid filter ID", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	filter, err := h.filterRepo.GetFilter(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrFilterNotFound) {
			respondError(w, http.StatusNotFound, "Filter not found", err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to fetch filter", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": filter,
	})
}

// CreateFilter handles POST /api/v1/sync/filters
// @Summary Create a new filter
// @Description Creates a new sync entity filter
// @Tags Filters
// @Accept json
// @Produce json
// @Param filter body models.FilterCreateRequest true "Filter data"
// @Success 201 {object} map[string]interface{}
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/sync/filters [post]
func (h *FilterHandler) CreateFilter(w http.ResponseWriter, r *http.Request) {
	// Limit request body size to 1MB to prevent resource exhaustion
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)

	var req models.FilterCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	// Validate request
	if err := req.Validate(); err != nil {
		respondError(w, http.StatusBadRequest, "Validation failed", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	filter, err := h.filterRepo.CreateFilter(ctx, &req)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to create filter", err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, map[string]interface{}{
		"data":    filter,
		"message": "Filter created successfully",
	})
}

// UpdateFilter handles PUT /api/v1/sync/filters/{id}
// @Summary Update a filter
// @Description Updates an existing sync entity filter
// @Tags Filters
// @Accept json
// @Produce json
// @Param id path string true "Filter ID"
// @Param filter body models.FilterUpdateRequest true "Filter data"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/sync/filters/{id} [put]
func (h *FilterHandler) UpdateFilter(w http.ResponseWriter, r *http.Request) {
	// Limit request body size to 1MB to prevent resource exhaustion
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)

	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid filter ID", err.Error())
		return
	}

	var req models.FilterUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	// Validate request
	if err := req.Validate(); err != nil {
		respondError(w, http.StatusBadRequest, "Validation failed", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	filter, err := h.filterRepo.UpdateFilter(ctx, id, &req)
	if err != nil {
		if errors.Is(err, repository.ErrFilterNotFound) {
			respondError(w, http.StatusNotFound, "Filter not found", err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to update filter", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data":    filter,
		"message": "Filter updated successfully",
	})
}

// DeleteFilter handles DELETE /api/v1/sync/filters/{id}
// @Summary Delete a filter
// @Description Deletes a sync entity filter
// @Tags Filters
// @Produce json
// @Param id path string true "Filter ID"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/sync/filters/{id} [delete]
func (h *FilterHandler) DeleteFilter(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid filter ID", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	err = h.filterRepo.DeleteFilter(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrFilterNotFound) {
			respondError(w, http.StatusNotFound, "Filter not found", err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to delete filter", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Filter deleted successfully",
	})
}

// ToggleFilter handles POST /api/v1/sync/filters/{id}/toggle
// @Summary Toggle filter active status
// @Description Enables or disables a sync entity filter
// @Tags Filters
// @Produce json
// @Param id path string true "Filter ID"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/sync/filters/{id}/toggle [post]
func (h *FilterHandler) ToggleFilter(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid filter ID", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	filter, err := h.filterRepo.ToggleFilter(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrFilterNotFound) {
			respondError(w, http.StatusNotFound, "Filter not found", err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to toggle filter", err.Error())
		return
	}

	status := "disabled"
	if filter.IsActive {
		status = "enabled"
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data":    filter,
		"message": "Filter " + status + " successfully",
	})
}

// TestFilter handles POST /api/v1/sync/filters/{id}/test
// @Summary Test a filter
// @Description Tests a filter and returns matching entity count
// @Tags Filters
// @Produce json
// @Param id path string true "Filter ID"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/sync/filters/{id}/test [post]
func (h *FilterHandler) TestFilter(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid filter ID", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 60*time.Second)
	defer cancel()

	result, err := h.filterRepo.TestFilter(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrFilterNotFound) {
			respondError(w, http.StatusNotFound, "Filter not found", err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to test filter", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": result,
	})
}

// GetEntityTypes handles GET /api/v1/sync/filters/entity-types
// @Summary Get available entity types
// @Description Returns all available entity types for filtering with their available fields
// @Tags Filters
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/sync/filters/entity-types [get]
func (h *FilterHandler) GetEntityTypes(w http.ResponseWriter, r *http.Request) {
	entityTypes := models.GetEntityTypeInfos()

	// Also include available operators
	operators := []map[string]interface{}{
		{"value": string(models.OpEquals), "label": "Equals", "description": "Field equals the specified value"},
		{"value": string(models.OpNotEquals), "label": "Not Equals", "description": "Field does not equal the specified value"},
		{"value": string(models.OpContains), "label": "Contains", "description": "Field contains the specified substring (case-insensitive)"},
		{"value": string(models.OpNotContains), "label": "Not Contains", "description": "Field does not contain the specified substring"},
		{"value": string(models.OpGreaterThan), "label": "Greater Than", "description": "Field is greater than the specified value"},
		{"value": string(models.OpLessThan), "label": "Less Than", "description": "Field is less than the specified value"},
		{"value": string(models.OpIn), "label": "In", "description": "Field value is in the specified list"},
		{"value": string(models.OpNotIn), "label": "Not In", "description": "Field value is not in the specified list"},
		{"value": string(models.OpIsNull), "label": "Is Null", "description": "Field value is NULL"},
		{"value": string(models.OpIsNotNull), "label": "Is Not Null", "description": "Field value is not NULL"},
	}

	filterTypes := []map[string]interface{}{
		{"value": string(models.FilterTypeInclude), "label": "Include", "description": "Only include entities matching the filter"},
		{"value": string(models.FilterTypeExclude), "label": "Exclude", "description": "Exclude entities matching the filter"},
	}

	logicOptions := []map[string]interface{}{
		{"value": string(models.LogicAND), "label": "AND", "description": "All conditions must match"},
		{"value": string(models.LogicOR), "label": "OR", "description": "Any condition can match"},
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"entity_types":  entityTypes,
		"operators":     operators,
		"filter_types":  filterTypes,
		"logic_options": logicOptions,
	})
}

// GetFiltersByEntityType handles GET /api/v1/sync/filters/by-entity/{entity_type}
// @Summary Get filters by entity type
// @Description Returns all filters for a specific entity type
// @Tags Filters
// @Produce json
// @Param entity_type path string true "Entity type (products, brands, categories)"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/sync/filters/by-entity/{entity_type} [get]
func (h *FilterHandler) GetFiltersByEntityType(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	entityTypeStr := vars["entity_type"]

	entityType := models.FilterEntityType(entityTypeStr)
	if !entityType.IsValid() {
		respondError(w, http.StatusBadRequest, "Invalid entity type", "Must be one of: products, brands, categories")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	filters, err := h.filterRepo.GetFiltersByEntityType(ctx, entityType)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch filters", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data":        filters,
		"entity_type": entityTypeStr,
		"total":       len(filters),
	})
}

// GetActiveFilters handles GET /api/v1/sync/filters/active
// @Summary Get all active filters
// @Description Returns all active (enabled) sync entity filters
// @Tags Filters
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/sync/filters/active [get]
func (h *FilterHandler) GetActiveFilters(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	filters, err := h.filterRepo.GetActiveFilters(ctx)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch active filters", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data":  filters,
		"total": len(filters),
	})
}
