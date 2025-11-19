package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"ultra-api-testing/internal/models"
	"ultra-api-testing/internal/repository"
)

// Handler contains all HTTP handlers
type Handler struct {
	repo *repository.Repository
}

// New creates a new Handler instance
func New(repo *repository.Repository) *Handler {
	return &Handler{repo: repo}
}

// Response structures
type ErrorResponse struct {
	Error   string `json:"error"`
	Code    string `json:"code,omitempty"`
	Details string `json:"details,omitempty"`
}

type PaginationMeta struct {
	Limit  int `json:"limit"`
	Offset int `json:"offset"`
	Total  int `json:"total,omitempty"`
}

// ============================================================================
// BRAND ENDPOINTS
// ============================================================================

// ListBrands handles GET /api/v1/brands
func (h *Handler) ListBrands(w http.ResponseWriter, r *http.Request) {
	limit, offset := h.parsePagination(r)

	brands, err := h.repo.ListBrands(r.Context(), limit, offset)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to fetch brands", err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": brands,
		"meta": PaginationMeta{
			Limit:  limit,
			Offset: offset,
		},
	})
}

// GetBrand handles GET /api/v1/brands/{id}
func (h *Handler) GetBrand(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid brand ID", err.Error())
		return
	}

	brand, err := h.repo.GetBrand(r.Context(), id)
	if err != nil {
		h.respondError(w, http.StatusNotFound, "Brand not found", err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": brand,
	})
}

// ============================================================================
// CATEGORY ENDPOINTS
// ============================================================================

// ListCategories handles GET /api/v1/categories
func (h *Handler) ListCategories(w http.ResponseWriter, r *http.Request) {
	limit, offset := h.parsePagination(r)

	var parentID *uuid.UUID
	if parentIDStr := r.URL.Query().Get("parent_id"); parentIDStr != "" && parentIDStr != "null" {
		id, err := uuid.Parse(parentIDStr)
		if err == nil {
			parentID = &id
		}
	}

	categories, err := h.repo.ListCategories(r.Context(), parentID, limit, offset)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to fetch categories", err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": categories,
		"meta": PaginationMeta{
			Limit:  limit,
			Offset: offset,
		},
	})
}

// GetCategory handles GET /api/v1/categories/{id}
func (h *Handler) GetCategory(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid category ID", err.Error())
		return
	}

	category, err := h.repo.GetCategory(r.Context(), id)
	if err != nil {
		h.respondError(w, http.StatusNotFound, "Category not found", err.Error())
		return
	}

	// Fetch children
	children, _ := h.repo.ListCategories(r.Context(), &category.ID, 100, 0)

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": &models.CategoryWithChildren{
			Category: category,
			Children: children,
		},
	})
}

// ============================================================================
// PRODUCT ENDPOINTS
// ============================================================================

// ListProducts handles GET /api/v1/products
func (h *Handler) ListProducts(w http.ResponseWriter, r *http.Request) {
	limit, offset := h.parsePagination(r)

	filter := &repository.ProductFilter{
		IsActive: true,
	}

	if brandIDStr := r.URL.Query().Get("brand_id"); brandIDStr != "" {
		if id, err := uuid.Parse(brandIDStr); err == nil {
			filter.BrandID = &id
		}
	}

	if categoryIDStr := r.URL.Query().Get("category_id"); categoryIDStr != "" {
		if id, err := uuid.Parse(categoryIDStr); err == nil {
			filter.CategoryID = &id
		}
	}

	if inStockStr := r.URL.Query().Get("in_stock"); inStockStr == "true" {
		inStock := true
		filter.InStock = &inStock
	}

	if minPriceStr := r.URL.Query().Get("min_price"); minPriceStr != "" {
		if price, err := strconv.ParseFloat(minPriceStr, 64); err == nil {
			filter.MinPrice = &price
		}
	}

	if maxPriceStr := r.URL.Query().Get("max_price"); maxPriceStr != "" {
		if price, err := strconv.ParseFloat(maxPriceStr, 64); err == nil {
			filter.MaxPrice = &price
		}
	}

	if search := r.URL.Query().Get("search"); search != "" {
		filter.Search = search
	}

	products, err := h.repo.ListProducts(r.Context(), filter, limit, offset)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to fetch products", err.Error())
		return
	}

	// Enrich with brand and category
	enriched := make([]*models.ProductWithDetails, len(products))
	for i, product := range products {
		response := &models.ProductWithDetails{Product: product}

		if product.BrandID != nil {
			brand, _ := h.repo.GetBrand(r.Context(), *product.BrandID)
			response.Brand = brand
		}

		if product.CategoryID != nil {
			category, _ := h.repo.GetCategory(r.Context(), *product.CategoryID)
			response.Category = category
		}

		enriched[i] = response
	}

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": enriched,
		"meta": PaginationMeta{
			Limit:  limit,
			Offset: offset,
		},
	})
}

// GetProduct handles GET /api/v1/products/{id}
func (h *Handler) GetProduct(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid product ID", err.Error())
		return
	}

	product, err := h.repo.GetProduct(r.Context(), id)
	if err != nil {
		h.respondError(w, http.StatusNotFound, "Product not found", err.Error())
		return
	}

	response := &models.ProductWithDetails{Product: product}

	// Fetch brand
	if product.BrandID != nil {
		brand, _ := h.repo.GetBrand(r.Context(), *product.BrandID)
		response.Brand = brand
	}

	// Fetch category
	if product.CategoryID != nil {
		category, _ := h.repo.GetCategory(r.Context(), *product.CategoryID)
		response.Category = category
	}

	// Fetch properties
	properties, _ := h.repo.GetProductProperties(r.Context(), id)
	response.Properties = properties
	response.PropertyCount = len(properties)

	// Fetch characteristics
	characteristics, _ := h.repo.GetProductCharacteristics(r.Context(), id)
	response.Characteristics = characteristics
	response.VariantCount = len(characteristics)

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": response,
	})
}

// GetProductProperties handles GET /api/v1/products/{id}/properties
func (h *Handler) GetProductProperties(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid product ID", err.Error())
		return
	}

	properties, err := h.repo.GetProductProperties(r.Context(), id)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to fetch properties", err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": properties,
	})
}

// GetProductCharacteristics handles GET /api/v1/products/{id}/characteristics
func (h *Handler) GetProductCharacteristics(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid product ID", err.Error())
		return
	}

	characteristics, err := h.repo.GetProductCharacteristics(r.Context(), id)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to fetch characteristics", err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": characteristics,
	})
}

// SearchProducts handles GET /api/v1/search
func (h *Handler) SearchProducts(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		h.respondError(w, http.StatusBadRequest, "Search query is required", "")
		return
	}

	limit, offset := h.parsePagination(r)

	filter := &repository.ProductFilter{
		Search:   query,
		IsActive: true,
	}

	products, err := h.repo.ListProducts(r.Context(), filter, limit, offset)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Search failed", err.Error())
		return
	}

	// Enrich with brand and category
	enriched := make([]*models.ProductWithDetails, len(products))
	for i, product := range products {
		response := &models.ProductWithDetails{Product: product}

		if product.BrandID != nil {
			brand, _ := h.repo.GetBrand(r.Context(), *product.BrandID)
			response.Brand = brand
		}

		if product.CategoryID != nil {
			category, _ := h.repo.GetCategory(r.Context(), *product.CategoryID)
			response.Category = category
		}

		enriched[i] = response
	}

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": enriched,
		"meta": PaginationMeta{
			Limit:  limit,
			Offset: offset,
		},
		"query": query,
	})
}

// ============================================================================
// HELPER METHODS
// ============================================================================

func (h *Handler) parsePagination(r *http.Request) (limit, offset int) {
	limit = 50
	offset = 0

	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}

	if offsetStr := r.URL.Query().Get("offset"); offsetStr != "" {
		if o, err := strconv.Atoi(offsetStr); err == nil && o >= 0 {
			offset = o
		}
	}

	return limit, offset
}

func (h *Handler) respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func (h *Handler) respondError(w http.ResponseWriter, status int, message, details string) {
	h.respondJSON(w, status, map[string]interface{}{
		"error": ErrorResponse{
			Error:   message,
			Details: details,
		},
	})
}
