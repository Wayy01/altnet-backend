package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"ultra-api-testing/internal/models"
	"ultra-api-testing/internal/repository"
)

const maxBodySize = 1 << 20 // 1MB

// CatalogHandler handles catalog endpoints
type CatalogHandler struct {
	catalogRepo *repository.CatalogRepository
}

// NewCatalogHandler creates a new catalog handler
func NewCatalogHandler(catalogRepo *repository.CatalogRepository) *CatalogHandler {
	return &CatalogHandler{
		catalogRepo: catalogRepo,
	}
}

// ============================================================================
// SECTION HANDLERS (Admin - protected)
// ============================================================================

// ListSections handles GET /api/v1/admin/catalog/sections
func (h *CatalogHandler) ListSections(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	// Parse active_only filter
	activeOnly := r.URL.Query().Get("active_only") == "true"

	sections, err := h.catalogRepo.ListSections(ctx, activeOnly)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch catalog sections", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": sections,
	})
}

// CreateSection handles POST /api/v1/admin/catalog/sections
func (h *CatalogHandler) CreateSection(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodySize)

	var input models.CatalogSectionInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		if err.Error() == "http: request body too large" {
			respondError(w, http.StatusRequestEntityTooLarge, "Request body too large", "Maximum size is 1MB")
			return
		}
		respondError(w, http.StatusBadRequest, "Invalid request body", "Malformed JSON")
		return
	}

	// Validate required fields
	if input.NameRo == "" {
		respondError(w, http.StatusBadRequest, "Validation failed", "name_ro is required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	section, err := h.catalogRepo.CreateSection(ctx, &input)
	if err != nil {
		if errors.Is(err, repository.ErrDuplicateSectionSlug) {
			respondError(w, http.StatusConflict, "Duplicate section slug", "A catalog section with this slug already exists")
			return
		}
		log.Printf("Failed to create catalog section: %v", err)
		respondError(w, http.StatusBadRequest, "Failed to create catalog section", "An internal error occurred")
		return
	}

	respondJSON(w, http.StatusCreated, map[string]interface{}{
		"data": section,
	})
}

// GetSection handles GET /api/v1/admin/catalog/sections/{id}
func (h *CatalogHandler) GetSection(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid section ID", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	section, err := h.catalogRepo.GetSection(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrCatalogSectionNotFound) {
			respondError(w, http.StatusNotFound, "Section not found", err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to fetch catalog section", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": section,
	})
}

// UpdateSection handles PUT /api/v1/admin/catalog/sections/{id}
func (h *CatalogHandler) UpdateSection(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid section ID", "ID must be a valid UUID")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxBodySize)

	var input models.CatalogSectionInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		if err.Error() == "http: request body too large" {
			respondError(w, http.StatusRequestEntityTooLarge, "Request body too large", "Maximum size is 1MB")
			return
		}
		respondError(w, http.StatusBadRequest, "Invalid request body", "Malformed JSON")
		return
	}

	// Validate required fields
	if input.NameRo == "" {
		respondError(w, http.StatusBadRequest, "Validation failed", "name_ro is required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	section, err := h.catalogRepo.UpdateSection(ctx, id, &input)
	if err != nil {
		if errors.Is(err, repository.ErrCatalogSectionNotFound) {
			respondError(w, http.StatusNotFound, "Section not found", "The requested section does not exist")
			return
		}
		if errors.Is(err, repository.ErrDuplicateSectionSlug) {
			respondError(w, http.StatusConflict, "Duplicate section slug", "A catalog section with this slug already exists")
			return
		}
		log.Printf("Failed to update catalog section: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to update catalog section", "An internal error occurred")
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": section,
	})
}

// DeleteSection handles DELETE /api/v1/admin/catalog/sections/{id}
func (h *CatalogHandler) DeleteSection(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid section ID", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	err = h.catalogRepo.DeleteSection(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrCatalogSectionNotFound) {
			respondError(w, http.StatusNotFound, "Section not found", err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to delete catalog section", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Catalog section deleted successfully",
	})
}

// ReorderSections handles PATCH /api/v1/admin/catalog/sections/reorder
func (h *CatalogHandler) ReorderSections(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodySize)

	var input models.CatalogBulkReorderRequest
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		if err.Error() == "http: request body too large" {
			respondError(w, http.StatusRequestEntityTooLarge, "Request body too large", "Maximum size is 1MB")
			return
		}
		respondError(w, http.StatusBadRequest, "Invalid request body", "Malformed JSON")
		return
	}

	// Validate that items are provided
	if len(input.Items) == 0 {
		respondError(w, http.StatusBadRequest, "Validation failed", "items is required and must not be empty")
		return
	}

	// Validate each item has valid UUID
	for _, item := range input.Items {
		if item.ID == uuid.Nil {
			respondError(w, http.StatusBadRequest, "Validation failed", "each item must have a valid id")
			return
		}
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	err := h.catalogRepo.ReorderSections(ctx, input.Items)
	if err != nil {
		log.Printf("Failed to reorder catalog sections: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to reorder catalog sections", "An internal error occurred")
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Catalog sections reordered successfully",
	})
}

// CloneSection handles POST /api/v1/admin/catalog/sections/{id}/clone
func (h *CatalogHandler) CloneSection(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid section ID", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 60*time.Second) // Longer timeout for clone operation
	defer cancel()

	clonedSection, err := h.catalogRepo.CloneSection(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrCatalogSectionNotFound) {
			respondError(w, http.StatusNotFound, "Section not found", err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to clone catalog section", err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, map[string]interface{}{
		"data":    clonedSection,
		"message": "Catalog section cloned successfully",
	})
}

// ListGroupsBySection handles GET /api/v1/admin/catalog/sections/{id}/groups
func (h *CatalogHandler) ListGroupsBySection(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid section ID", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	// First check if section exists
	_, err = h.catalogRepo.GetSection(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrCatalogSectionNotFound) {
			respondError(w, http.StatusNotFound, "Section not found", err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to fetch catalog section", err.Error())
		return
	}

	groups, err := h.catalogRepo.ListGroupsBySection(ctx, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch catalog groups", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": groups,
	})
}

// ============================================================================
// GROUP HANDLERS (Admin - protected)
// ============================================================================

// CreateGroup handles POST /api/v1/admin/catalog/groups
func (h *CatalogHandler) CreateGroup(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodySize)

	var input models.CatalogGroupInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		if err.Error() == "http: request body too large" {
			respondError(w, http.StatusRequestEntityTooLarge, "Request body too large", "Maximum size is 1MB")
			return
		}
		respondError(w, http.StatusBadRequest, "Invalid request body", "Malformed JSON")
		return
	}

	// Validate required fields
	if input.SectionID == uuid.Nil {
		respondError(w, http.StatusBadRequest, "Validation failed", "section_id is required")
		return
	}
	if input.NameRo == "" {
		respondError(w, http.StatusBadRequest, "Validation failed", "name_ro is required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	group, err := h.catalogRepo.CreateGroup(ctx, &input)
	if err != nil {
		if errors.Is(err, repository.ErrInvalidColumnPosition) {
			respondError(w, http.StatusBadRequest, "Invalid column position", "column_position must be between 1 and 4")
			return
		}
		if errors.Is(err, repository.ErrCatalogSectionNotFound) {
			respondError(w, http.StatusNotFound, "Section not found", "The specified section does not exist")
			return
		}
		log.Printf("Failed to create catalog group: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to create catalog group", "An internal error occurred")
		return
	}

	respondJSON(w, http.StatusCreated, map[string]interface{}{
		"data": group,
	})
}

// GetGroup handles GET /api/v1/admin/catalog/groups/{id}
func (h *CatalogHandler) GetGroup(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid group ID", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	group, err := h.catalogRepo.GetGroup(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrCatalogGroupNotFound) {
			respondError(w, http.StatusNotFound, "Group not found", err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to fetch catalog group", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": group,
	})
}

// UpdateGroup handles PUT /api/v1/admin/catalog/groups/{id}
func (h *CatalogHandler) UpdateGroup(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid group ID", "ID must be a valid UUID")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxBodySize)

	var input models.CatalogGroupInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		if err.Error() == "http: request body too large" {
			respondError(w, http.StatusRequestEntityTooLarge, "Request body too large", "Maximum size is 1MB")
			return
		}
		respondError(w, http.StatusBadRequest, "Invalid request body", "Malformed JSON")
		return
	}

	// Validate required fields
	if input.SectionID == uuid.Nil {
		respondError(w, http.StatusBadRequest, "Validation failed", "section_id is required")
		return
	}
	if input.NameRo == "" {
		respondError(w, http.StatusBadRequest, "Validation failed", "name_ro is required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	group, err := h.catalogRepo.UpdateGroup(ctx, id, &input)
	if err != nil {
		if errors.Is(err, repository.ErrCatalogGroupNotFound) {
			respondError(w, http.StatusNotFound, "Group not found", "The requested group does not exist")
			return
		}
		if errors.Is(err, repository.ErrInvalidColumnPosition) {
			respondError(w, http.StatusBadRequest, "Invalid column position", "column_position must be between 1 and 4")
			return
		}
		log.Printf("Failed to update catalog group: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to update catalog group", "An internal error occurred")
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": group,
	})
}

// DeleteGroup handles DELETE /api/v1/admin/catalog/groups/{id}
func (h *CatalogHandler) DeleteGroup(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid group ID", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	err = h.catalogRepo.DeleteGroup(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrCatalogGroupNotFound) {
			respondError(w, http.StatusNotFound, "Group not found", err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to delete catalog group", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Catalog group deleted successfully",
	})
}

// ReorderGroups handles PATCH /api/v1/admin/catalog/groups/reorder
func (h *CatalogHandler) ReorderGroups(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodySize)

	var input models.CatalogBulkReorderRequest
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		if err.Error() == "http: request body too large" {
			respondError(w, http.StatusRequestEntityTooLarge, "Request body too large", "Maximum size is 1MB")
			return
		}
		respondError(w, http.StatusBadRequest, "Invalid request body", "Malformed JSON")
		return
	}

	// Validate that items are provided
	if len(input.Items) == 0 {
		respondError(w, http.StatusBadRequest, "Validation failed", "items is required and must not be empty")
		return
	}

	// Validate each item has valid UUID
	for _, item := range input.Items {
		if item.ID == uuid.Nil {
			respondError(w, http.StatusBadRequest, "Validation failed", "each item must have a valid id")
			return
		}
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	err := h.catalogRepo.ReorderGroups(ctx, input.Items)
	if err != nil {
		log.Printf("Failed to reorder catalog groups: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to reorder catalog groups", "An internal error occurred")
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Catalog groups reordered successfully",
	})
}

// ListItemsByGroup handles GET /api/v1/admin/catalog/groups/{id}/items
func (h *CatalogHandler) ListItemsByGroup(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid group ID", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	// First check if group exists
	_, err = h.catalogRepo.GetGroup(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrCatalogGroupNotFound) {
			respondError(w, http.StatusNotFound, "Group not found", err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to fetch catalog group", err.Error())
		return
	}

	items, err := h.catalogRepo.ListItemsByGroup(ctx, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch catalog items", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": items,
	})
}

// ============================================================================
// ITEM HANDLERS (Admin - protected)
// ============================================================================

// CreateItem handles POST /api/v1/admin/catalog/items
func (h *CatalogHandler) CreateItem(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodySize)

	var input models.CatalogItemInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		if err.Error() == "http: request body too large" {
			respondError(w, http.StatusRequestEntityTooLarge, "Request body too large", "Maximum size is 1MB")
			return
		}
		respondError(w, http.StatusBadRequest, "Invalid request body", "Malformed JSON")
		return
	}

	// Validate required fields
	if input.GroupID == uuid.Nil {
		respondError(w, http.StatusBadRequest, "Validation failed", "group_id is required")
		return
	}
	if input.NameRo == "" {
		respondError(w, http.StatusBadRequest, "Validation failed", "name_ro is required")
		return
	}
	if input.ItemType == "" {
		respondError(w, http.StatusBadRequest, "Validation failed", "item_type is required")
		return
	}
	// Validate item_type value
	if input.ItemType != models.ItemTypeCategoryLink && input.ItemType != models.ItemTypeCustomFilter {
		respondError(w, http.StatusBadRequest, "Invalid item type", "item_type must be 'category_link' or 'custom_filter'")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	item, err := h.catalogRepo.CreateItem(ctx, &input)
	if err != nil {
		if errors.Is(err, repository.ErrInvalidItemType) {
			respondError(w, http.StatusBadRequest, "Invalid item type", "item_type must be 'category_link' or 'custom_filter'")
			return
		}
		if errors.Is(err, repository.ErrMissingCategoryID) {
			respondError(w, http.StatusBadRequest, "Missing category ID", "category_id is required for category_link items")
			return
		}
		if errors.Is(err, repository.ErrMissingFilterConfig) {
			respondError(w, http.StatusBadRequest, "Missing filter config", "filter_config is required for custom_filter items")
			return
		}
		if errors.Is(err, repository.ErrCatalogGroupNotFound) {
			respondError(w, http.StatusNotFound, "Group not found", "The specified group does not exist")
			return
		}
		if err.Error() == "category not found" {
			respondError(w, http.StatusNotFound, "Category not found", "The specified category does not exist")
			return
		}
		log.Printf("Failed to create catalog item: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to create catalog item", "An internal error occurred")
		return
	}

	respondJSON(w, http.StatusCreated, map[string]interface{}{
		"data": item,
	})
}

// GetItem handles GET /api/v1/admin/catalog/items/{id}
func (h *CatalogHandler) GetItem(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid item ID", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	item, err := h.catalogRepo.GetItem(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrCatalogItemNotFound) {
			respondError(w, http.StatusNotFound, "Item not found", err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to fetch catalog item", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": item,
	})
}

// UpdateItem handles PUT /api/v1/admin/catalog/items/{id}
func (h *CatalogHandler) UpdateItem(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid item ID", "ID must be a valid UUID")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxBodySize)

	var input models.CatalogItemInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		if err.Error() == "http: request body too large" {
			respondError(w, http.StatusRequestEntityTooLarge, "Request body too large", "Maximum size is 1MB")
			return
		}
		respondError(w, http.StatusBadRequest, "Invalid request body", "Malformed JSON")
		return
	}

	// Validate required fields
	if input.GroupID == uuid.Nil {
		respondError(w, http.StatusBadRequest, "Validation failed", "group_id is required")
		return
	}
	if input.NameRo == "" {
		respondError(w, http.StatusBadRequest, "Validation failed", "name_ro is required")
		return
	}
	if input.ItemType == "" {
		respondError(w, http.StatusBadRequest, "Validation failed", "item_type is required")
		return
	}
	// Validate item_type value
	if input.ItemType != models.ItemTypeCategoryLink && input.ItemType != models.ItemTypeCustomFilter {
		respondError(w, http.StatusBadRequest, "Invalid item type", "item_type must be 'category_link' or 'custom_filter'")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	item, err := h.catalogRepo.UpdateItem(ctx, id, &input)
	if err != nil {
		if errors.Is(err, repository.ErrCatalogItemNotFound) {
			respondError(w, http.StatusNotFound, "Item not found", "The requested item does not exist")
			return
		}
		if errors.Is(err, repository.ErrInvalidItemType) {
			respondError(w, http.StatusBadRequest, "Invalid item type", "item_type must be 'category_link' or 'custom_filter'")
			return
		}
		if errors.Is(err, repository.ErrMissingCategoryID) {
			respondError(w, http.StatusBadRequest, "Missing category ID", "category_id is required for category_link items")
			return
		}
		if errors.Is(err, repository.ErrMissingFilterConfig) {
			respondError(w, http.StatusBadRequest, "Missing filter config", "filter_config is required for custom_filter items")
			return
		}
		log.Printf("Failed to update catalog item: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to update catalog item", "An internal error occurred")
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": item,
	})
}

// DeleteItem handles DELETE /api/v1/admin/catalog/items/{id}
func (h *CatalogHandler) DeleteItem(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid item ID", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	err = h.catalogRepo.DeleteItem(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrCatalogItemNotFound) {
			respondError(w, http.StatusNotFound, "Item not found", err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to delete catalog item", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Catalog item deleted successfully",
	})
}

// ReorderItems handles PATCH /api/v1/admin/catalog/items/reorder
func (h *CatalogHandler) ReorderItems(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodySize)

	var input models.CatalogBulkReorderRequest
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		if err.Error() == "http: request body too large" {
			respondError(w, http.StatusRequestEntityTooLarge, "Request body too large", "Maximum size is 1MB")
			return
		}
		respondError(w, http.StatusBadRequest, "Invalid request body", "Malformed JSON")
		return
	}

	// Validate that items are provided
	if len(input.Items) == 0 {
		respondError(w, http.StatusBadRequest, "Validation failed", "items is required and must not be empty")
		return
	}

	// Validate each item has valid UUID
	for _, item := range input.Items {
		if item.ID == uuid.Nil {
			respondError(w, http.StatusBadRequest, "Validation failed", "each item must have a valid id")
			return
		}
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	err := h.catalogRepo.ReorderItems(ctx, input.Items)
	if err != nil {
		log.Printf("Failed to reorder catalog items: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to reorder catalog items", "An internal error occurred")
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Catalog items reordered successfully",
	})
}

// ============================================================================
// PUBLIC HANDLERS (No auth)
// ============================================================================

// GetFullCatalog handles GET /api/v1/catalog
func (h *CatalogHandler) GetFullCatalog(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	catalog, err := h.catalogRepo.GetFullCatalog(ctx)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch catalog", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": catalog,
	})
}

// GetCatalogBySlug handles GET /api/v1/catalog/{slug}
func (h *CatalogHandler) GetCatalogBySlug(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	slug := vars["slug"]

	if slug == "" {
		respondError(w, http.StatusBadRequest, "Invalid slug", "slug parameter is required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	section, err := h.catalogRepo.GetSectionWithChildren(ctx, slug)
	if err != nil {
		if errors.Is(err, repository.ErrCatalogSectionNotFound) {
			respondError(w, http.StatusNotFound, "Catalog section not found", "No catalog section found with the given slug")
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to fetch catalog section", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": section,
	})
}

// GetItemProducts handles GET /api/v1/catalog/items/{id}/products
func (h *CatalogHandler) GetItemProducts(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid item ID", "ID must be a valid UUID")
		return
	}

	// Parse pagination parameters with defaults
	limit := 50
	offset := 0

	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if parsedLimit, err := parsePositiveInt(limitStr); err == nil && parsedLimit > 0 {
			limit = parsedLimit
			// Cap at 100 for performance
			if limit > 100 {
				limit = 100
			}
		}
	}

	if offsetStr := r.URL.Query().Get("offset"); offsetStr != "" {
		if parsedOffset, err := parsePositiveInt(offsetStr); err == nil && parsedOffset >= 0 {
			offset = parsedOffset
		}
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	products, totalCount, err := h.catalogRepo.GetItemProducts(ctx, id, limit, offset)
	if err != nil {
		if errors.Is(err, repository.ErrCatalogItemNotFound) {
			respondError(w, http.StatusNotFound, "Catalog item not found", "The requested catalog item does not exist")
			return
		}
		if err.Error() == "catalog item is not of type custom_filter" {
			respondError(w, http.StatusBadRequest, "Invalid item type", "This endpoint only supports custom_filter catalog items")
			return
		}
		log.Printf("Failed to get catalog item products: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to fetch products", "An internal error occurred")
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": products,
		"pagination": map[string]interface{}{
			"total":  totalCount,
			"limit":  limit,
			"offset": offset,
		},
	})
}

// parsePositiveInt parses a string to a positive integer
func parsePositiveInt(s string) (int, error) {
	var i int
	_, err := fmt.Sscanf(s, "%d", &i)
	if err != nil {
		return 0, err
	}
	if i < 0 {
		return 0, fmt.Errorf("value must be non-negative")
	}
	return i, nil
}
