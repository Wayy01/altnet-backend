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

// PromotionHandler handles promotion endpoints
type PromotionHandler struct {
	promotionRepo *repository.PromotionRepository
	productRepo   *repository.Repository
}

// NewPromotionHandler creates a new promotion handler
func NewPromotionHandler(promotionRepo *repository.PromotionRepository, productRepo *repository.Repository) *PromotionHandler {
	return &PromotionHandler{
		promotionRepo: promotionRepo,
		productRepo:   productRepo,
	}
}

// ListPromotions handles GET /api/v1/promotions
func (h *PromotionHandler) ListPromotions(w http.ResponseWriter, r *http.Request) {
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
	filters := &models.PromotionFilters{
		Search: r.URL.Query().Get("search"),
	}

	if isActiveStr := r.URL.Query().Get("is_active"); isActiveStr != "" {
		isActive := isActiveStr == "true"
		filters.IsActive = &isActive
	}

	promotions, err := h.promotionRepo.ListPromotions(ctx, filters, limit, offset)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch promotions", err.Error())
		return
	}

	total, err := h.promotionRepo.CountPromotions(ctx, filters)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to count promotions", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": promotions,
		"meta": map[string]interface{}{
			"limit":  limit,
			"offset": offset,
			"total":  total,
		},
	})
}

// GetPromotion handles GET /api/v1/promotions/{id}
func (h *PromotionHandler) GetPromotion(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid promotion ID", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	promotion, err := h.promotionRepo.GetPromotion(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrPromotionNotFound) {
			respondError(w, http.StatusNotFound, "Promotion not found", err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to fetch promotion", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": promotion,
	})
}

// CreatePromotion handles POST /api/v1/promotions
func (h *PromotionHandler) CreatePromotion(w http.ResponseWriter, r *http.Request) {
	var input models.PromotionInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	// Validate required fields
	if input.Name == "" {
		respondError(w, http.StatusBadRequest, "Validation failed", "name is required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	promotion, err := h.promotionRepo.CreatePromotion(ctx, &input)
	if err != nil {
		if errors.Is(err, repository.ErrInvalidDiscountType) {
			respondError(w, http.StatusBadRequest, "Invalid discount type", "discount_type must be 'percentage' or 'fixed_amount'")
			return
		}
		if errors.Is(err, repository.ErrInvalidDateRange) {
			respondError(w, http.StatusBadRequest, "Invalid date range", "start_date must be before end_date")
			return
		}
		if errors.Is(err, repository.ErrInvalidDiscountValue) {
			respondError(w, http.StatusBadRequest, "Invalid discount value", "discount_value must be positive")
			return
		}
		if errors.Is(err, repository.ErrDuplicatePromotionName) {
			respondError(w, http.StatusConflict, "Duplicate promotion", "A promotion with this name already exists")
			return
		}
		respondError(w, http.StatusBadRequest, "Failed to create promotion", err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, map[string]interface{}{
		"data": promotion,
	})
}

// UpdatePromotion handles PUT /api/v1/promotions/{id}
func (h *PromotionHandler) UpdatePromotion(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid promotion ID", err.Error())
		return
	}

	var input models.PromotionInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	// Validate required fields
	if input.Name == "" {
		respondError(w, http.StatusBadRequest, "Validation failed", "name is required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	promotion, err := h.promotionRepo.UpdatePromotion(ctx, id, &input)
	if err != nil {
		if errors.Is(err, repository.ErrPromotionNotFound) {
			respondError(w, http.StatusNotFound, "Promotion not found", err.Error())
			return
		}
		if errors.Is(err, repository.ErrInvalidDiscountType) {
			respondError(w, http.StatusBadRequest, "Invalid discount type", "discount_type must be 'percentage' or 'fixed_amount'")
			return
		}
		if errors.Is(err, repository.ErrInvalidDateRange) {
			respondError(w, http.StatusBadRequest, "Invalid date range", "start_date must be before end_date")
			return
		}
		if errors.Is(err, repository.ErrInvalidDiscountValue) {
			respondError(w, http.StatusBadRequest, "Invalid discount value", "discount_value must be positive")
			return
		}
		if errors.Is(err, repository.ErrDuplicatePromotionName) {
			respondError(w, http.StatusConflict, "Duplicate promotion", "A promotion with this name already exists")
			return
		}
		respondError(w, http.StatusBadRequest, "Failed to update promotion", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": promotion,
	})
}

// DeletePromotion handles DELETE /api/v1/promotions/{id}
func (h *PromotionHandler) DeletePromotion(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid promotion ID", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	err = h.promotionRepo.DeletePromotion(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrPromotionNotFound) {
			respondError(w, http.StatusNotFound, "Promotion not found", err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to delete promotion", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Promotion deleted successfully",
	})
}

// TogglePromotion handles POST /api/v1/promotions/{id}/toggle
func (h *PromotionHandler) TogglePromotion(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid promotion ID", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	promotion, err := h.promotionRepo.TogglePromotionActive(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrPromotionNotFound) {
			respondError(w, http.StatusNotFound, "Promotion not found", err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to toggle promotion", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": promotion,
	})
}

// GetPromotionProducts handles GET /api/v1/promotions/{id}/products
func (h *PromotionHandler) GetPromotionProducts(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid promotion ID", err.Error())
		return
	}

	// Parse pagination
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	products, err := h.promotionRepo.GetProductsByPromotion(ctx, id, limit, offset)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch promotion products", err.Error())
		return
	}

	// Calculate discounts for all products
	if len(products) > 0 {
		h.productRepo.CalculateProductsDiscounts(ctx, products, h.promotionRepo)
	}

	total, err := h.promotionRepo.CountProductsByPromotion(ctx, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to count promotion products", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": products,
		"meta": map[string]interface{}{
			"limit":  limit,
			"offset": offset,
			"total":  total,
		},
	})
}

// AddProductsToPromotion handles POST /api/v1/promotions/{id}/products
func (h *PromotionHandler) AddProductsToPromotion(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid promotion ID", err.Error())
		return
	}

	var req models.AddProductsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	if len(req.ProductIDs) == 0 {
		respondError(w, http.StatusBadRequest, "Validation failed", "product_ids is required and must not be empty")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	err = h.promotionRepo.AddProductsToPromotion(ctx, id, req.ProductIDs)
	if err != nil {
		if errors.Is(err, repository.ErrPromotionNotFound) {
			respondError(w, http.StatusNotFound, "Promotion not found", err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to add products to promotion", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Products added to promotion successfully",
		"count":   len(req.ProductIDs),
	})
}

// RemoveProductsFromPromotion handles DELETE /api/v1/promotions/{id}/products
func (h *PromotionHandler) RemoveProductsFromPromotion(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid promotion ID", err.Error())
		return
	}

	var req models.RemoveProductsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	if len(req.ProductIDs) == 0 {
		respondError(w, http.StatusBadRequest, "Validation failed", "product_ids is required and must not be empty")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	err = h.promotionRepo.RemoveProductsFromPromotion(ctx, id, req.ProductIDs)
	if err != nil {
		if errors.Is(err, repository.ErrPromotionNotFound) {
			respondError(w, http.StatusNotFound, "Promotion not found", err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to remove products from promotion", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Products removed from promotion successfully",
		"count":   len(req.ProductIDs),
	})
}

// BulkAddProductsByFilter handles POST /api/v1/promotions/{id}/products/bulk
func (h *PromotionHandler) BulkAddProductsByFilter(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid promotion ID", err.Error())
		return
	}

	var req models.BulkAddProductsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	// Validate that at least one filter is provided
	if req.BrandID == nil && req.CategoryID == nil && req.MinPrice == nil && req.MaxPrice == nil && req.InStock == nil {
		respondError(w, http.StatusBadRequest, "Validation failed", "at least one filter parameter is required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 60*time.Second)
	defer cancel()

	count, err := h.promotionRepo.BulkAddProductsByFilter(ctx, id, &req)
	if err != nil {
		if errors.Is(err, repository.ErrPromotionNotFound) {
			respondError(w, http.StatusNotFound, "Promotion not found", err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to bulk add products", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Products added to promotion successfully",
		"count":   count,
	})
}
