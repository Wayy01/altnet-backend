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

// PublicOrderHandler handles public order endpoints (no auth required)
type PublicOrderHandler struct {
	orderRepo *repository.OrderRepository
	storeRepo *repository.StoreRepository
}

// NewPublicOrderHandler creates a new public order handler
func NewPublicOrderHandler(orderRepo *repository.OrderRepository, storeRepo *repository.StoreRepository) *PublicOrderHandler {
	return &PublicOrderHandler{
		orderRepo: orderRepo,
		storeRepo: storeRepo,
	}
}

// CreateOrder handles POST /api/v1/public/orders (checkout)
func (h *PublicOrderHandler) CreateOrder(w http.ResponseWriter, r *http.Request) {
	var input models.CreateOrderInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	// Validate required fields
	if input.FullName == "" {
		respondError(w, http.StatusBadRequest, "Validation failed", "full_name is required")
		return
	}
	if input.PhoneNumber == "" {
		respondError(w, http.StatusBadRequest, "Validation failed", "phone_number is required")
		return
	}
	if input.DeliveryType == "" {
		respondError(w, http.StatusBadRequest, "Validation failed", "delivery_type is required")
		return
	}
	if input.PaymentMethod == "" {
		respondError(w, http.StatusBadRequest, "Validation failed", "payment_method is required")
		return
	}
	if len(input.Items) == 0 {
		respondError(w, http.StatusBadRequest, "Validation failed", "items cannot be empty")
		return
	}

	// Validate delivery type specific fields
	if input.DeliveryType == models.DeliveryTypePickup && input.StoreID == nil {
		respondError(w, http.StatusBadRequest, "Validation failed", "store_id is required for pickup delivery type")
		return
	}
	if input.DeliveryType == models.DeliveryTypeDelivery && input.DeliveryAddress == nil {
		respondError(w, http.StatusBadRequest, "Validation failed", "delivery_address is required for delivery type")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	order, err := h.orderRepo.CreateOrder(ctx, &input)
	if err != nil {
		if errors.Is(err, repository.ErrProductNotFound) {
			respondError(w, http.StatusBadRequest, "Product not found", err.Error())
			return
		}
		if errors.Is(err, repository.ErrStoreRequiredForPickup) {
			respondError(w, http.StatusBadRequest, "Validation failed", "store_id is required for pickup")
			return
		}
		if errors.Is(err, repository.ErrAddressRequiredForDelivery) {
			respondError(w, http.StatusBadRequest, "Validation failed", "delivery_address is required for delivery")
			return
		}
		if errors.Is(err, repository.ErrInvalidOrderInput) {
			respondError(w, http.StatusBadRequest, "Invalid order input", err.Error())
			return
		}
		respondError(w, http.StatusBadRequest, "Failed to create order", err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, map[string]interface{}{
		"data": order,
	})
}

// TrackOrder handles GET /api/v1/public/orders/{order_number}
func (h *PublicOrderHandler) TrackOrder(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	orderNumber := vars["order_number"]

	if orderNumber == "" {
		respondError(w, http.StatusBadRequest, "Invalid order number", "order_number is required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	order, err := h.orderRepo.GetOrderByNumber(ctx, orderNumber)
	if err != nil {
		if errors.Is(err, repository.ErrOrderNotFound) {
			respondError(w, http.StatusNotFound, "Order not found", "No order found with this order number")
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to fetch order", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": order,
	})
}

// ListActiveStores handles GET /api/v1/public/stores
func (h *PublicOrderHandler) ListActiveStores(w http.ResponseWriter, r *http.Request) {
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

	// Only show active stores
	filters := &models.StoreFilters{
		Search:     r.URL.Query().Get("search"),
		ActiveOnly: true,
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

// GetStorePublic handles GET /api/v1/public/stores/{id}
func (h *PublicOrderHandler) GetStorePublic(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	storeID := vars["id"]

	if storeID == "" {
		respondError(w, http.StatusBadRequest, "Invalid store ID", "store_id is required")
		return
	}

	// Parse UUID
	id, err := uuid.Parse(storeID)
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

	// Only return active stores to public
	if !store.IsActive {
		respondError(w, http.StatusNotFound, "Store not found", "This store is not currently available")
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": store,
	})
}
