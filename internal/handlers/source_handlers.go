package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"ultra-api-testing/internal/repository"
)

// SourceHandler handles product source endpoints
type SourceHandler struct {
	sourceRepo *repository.SourceRepository
}

// NewSourceHandler creates a new source handler
func NewSourceHandler(sourceRepo *repository.SourceRepository) *SourceHandler {
	return &SourceHandler{sourceRepo: sourceRepo}
}

// ListSources handles GET /api/v1/sources
// @Summary List all product sources
// @Description Returns all available product sources
// @Tags Sources
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/sources [get]
func (h *SourceHandler) ListSources(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	sources, err := h.sourceRepo.ListSources(ctx)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch sources", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": sources,
	})
}

// GetSource handles GET /api/v1/sources/{id}
// @Summary Get a source by ID
// @Description Returns a single product source by ID
// @Tags Sources
// @Produce json
// @Param id path string true "Source ID"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /api/v1/sources/{id} [get]
func (h *SourceHandler) GetSource(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid source ID", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	source, err := h.sourceRepo.GetSource(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrSourceNotFound) {
			respondError(w, http.StatusNotFound, "Source not found", err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to fetch source", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": source,
	})
}

// GetDefaultSource handles GET /api/v1/sources/default
// @Summary Get the default source
// @Description Returns the default product source (Ultra)
// @Tags Sources
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/sources/default [get]
func (h *SourceHandler) GetDefaultSource(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	source, err := h.sourceRepo.GetDefaultSource(ctx)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch default source", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": source,
	})
}

// CreateSource handles POST /api/v1/sources
// @Summary Create a new source
// @Description Creates a new product source
// @Tags Sources
// @Accept json
// @Produce json
// @Param source body repository.CreateSourceRequest true "Source data"
// @Success 201 {object} map[string]interface{}
// @Failure 400 {object} ErrorResponse
// @Failure 409 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/sources [post]
func (h *SourceHandler) CreateSource(w http.ResponseWriter, r *http.Request) {
	var req repository.CreateSourceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	// Validate required fields (note: trimming is done in repository)
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "Validation failed", "name is required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	source, err := h.sourceRepo.CreateSource(ctx, &req)
	if err != nil {
		if errors.Is(err, repository.ErrDuplicateSource) {
			respondError(w, http.StatusConflict, "Duplicate source", "A source with this name already exists")
			return
		}
		respondError(w, http.StatusBadRequest, "Failed to create source", err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, map[string]interface{}{
		"data": source,
	})
}

// DeleteSource handles DELETE /api/v1/sources/{id}
// @Summary Delete a source
// @Description Deletes a product source (cannot delete default source)
// @Tags Sources
// @Produce json
// @Param id path string true "Source ID"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} ErrorResponse
// @Failure 403 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 409 {object} ErrorResponse
// @Router /api/v1/sources/{id} [delete]
func (h *SourceHandler) DeleteSource(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid source ID", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	err = h.sourceRepo.DeleteSource(ctx, id)
	if err != nil {
		// Use errors.Is() for proper sentinel error matching
		if errors.Is(err, repository.ErrSourceNotFound) {
			respondError(w, http.StatusNotFound, "Source not found", err.Error())
			return
		}
		if errors.Is(err, repository.ErrSourceIsDefault) {
			respondError(w, http.StatusForbidden, "Cannot delete default source", err.Error())
			return
		}
		if errors.Is(err, repository.ErrSourceNotDeletable) {
			respondError(w, http.StatusForbidden, "Source is not deletable", err.Error())
			return
		}
		if errors.Is(err, repository.ErrSourceInUse) {
			respondError(w, http.StatusConflict, "Source is in use", err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to delete source", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Source deleted successfully",
	})
}

