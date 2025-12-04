package handlers

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"ultra-api-testing/internal/auth"
	"ultra-api-testing/internal/models"
	"ultra-api-testing/internal/repository"
)

// OrderHandler handles order endpoints (admin)
type OrderHandler struct {
	orderRepo *repository.OrderRepository
}

// NewOrderHandler creates a new order handler
func NewOrderHandler(orderRepo *repository.OrderRepository) *OrderHandler {
	return &OrderHandler{
		orderRepo: orderRepo,
	}
}

// ListOrders handles GET /api/v1/orders (admin)
func (h *OrderHandler) ListOrders(w http.ResponseWriter, r *http.Request) {
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
	filters := &models.OrderFilters{
		Search: r.URL.Query().Get("search"),
	}

	if status := r.URL.Query().Get("status"); status != "" {
		filters.Status = &status
	}
	if paymentMethod := r.URL.Query().Get("payment_method"); paymentMethod != "" {
		filters.PaymentMethod = &paymentMethod
	}
	if deliveryType := r.URL.Query().Get("delivery_type"); deliveryType != "" {
		filters.DeliveryType = &deliveryType
	}
	if storeIDStr := r.URL.Query().Get("store_id"); storeIDStr != "" {
		if storeID, err := uuid.Parse(storeIDStr); err == nil {
			filters.StoreID = &storeID
		}
	}
	if userID := r.URL.Query().Get("user_id"); userID != "" {
		filters.UserID = &userID
	}

	// Parse date filters
	if dateFromStr := r.URL.Query().Get("date_from"); dateFromStr != "" {
		if dateFrom, err := time.Parse(time.RFC3339, dateFromStr); err == nil {
			filters.DateFrom = &dateFrom
		}
	}
	if dateToStr := r.URL.Query().Get("date_to"); dateToStr != "" {
		if dateTo, err := time.Parse(time.RFC3339, dateToStr); err == nil {
			filters.DateTo = &dateTo
		}
	}

	orders, err := h.orderRepo.ListOrders(ctx, filters, limit, offset)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch orders", err.Error())
		return
	}

	total, err := h.orderRepo.CountOrders(ctx, filters)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to count orders", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": orders,
		"meta": map[string]interface{}{
			"limit":  limit,
			"offset": offset,
			"total":  total,
		},
	})
}

// GetOrder handles GET /api/v1/orders/{id} (admin)
func (h *OrderHandler) GetOrder(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid order ID", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	order, err := h.orderRepo.GetOrder(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrOrderNotFound) {
			respondError(w, http.StatusNotFound, "Order not found", err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to fetch order", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": order,
	})
}

// UpdateOrder handles PUT /api/v1/orders/{id} (admin)
func (h *OrderHandler) UpdateOrder(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid order ID", err.Error())
		return
	}

	var input models.UpdateOrderInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	order, err := h.orderRepo.UpdateOrder(ctx, id, &input)
	if err != nil {
		if errors.Is(err, repository.ErrOrderNotFound) {
			respondError(w, http.StatusNotFound, "Order not found", err.Error())
			return
		}
		respondError(w, http.StatusBadRequest, "Failed to update order", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": order,
	})
}

// UpdateOrderStatus handles PATCH /api/v1/orders/{id}/status (admin)
func (h *OrderHandler) UpdateOrderStatus(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid order ID", err.Error())
		return
	}

	var input models.UpdateOrderStatusInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	if input.Status == "" {
		respondError(w, http.StatusBadRequest, "Validation failed", "status is required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	order, err := h.orderRepo.UpdateOrderStatus(ctx, id, input.Status)
	if err != nil {
		if errors.Is(err, repository.ErrOrderNotFound) {
			respondError(w, http.StatusNotFound, "Order not found", err.Error())
			return
		}
		if errors.Is(err, repository.ErrInvalidStatusTransition) {
			respondError(w, http.StatusBadRequest, "Invalid status transition", err.Error())
			return
		}
		respondError(w, http.StatusBadRequest, "Failed to update order status", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": order,
	})
}

// DeleteOrder handles DELETE /api/v1/orders/{id} (admin)
func (h *OrderHandler) DeleteOrder(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid order ID", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	err = h.orderRepo.DeleteOrder(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrOrderNotFound) {
			respondError(w, http.StatusNotFound, "Order not found", err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to delete order", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Order deleted successfully",
	})
}

// GetOrderStats handles GET /api/v1/orders/stats (admin)
func (h *OrderHandler) GetOrderStats(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	stats, err := h.orderRepo.GetOrderStats(ctx)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch order stats", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": stats,
	})
}

// ExportOrders handles GET /api/v1/orders/export (admin)
func (h *OrderHandler) ExportOrders(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 60*time.Second)
	defer cancel()

	// Parse filters (same as ListOrders)
	filters := &models.OrderFilters{
		Search: r.URL.Query().Get("search"),
	}

	if status := r.URL.Query().Get("status"); status != "" {
		filters.Status = &status
	}
	if paymentMethod := r.URL.Query().Get("payment_method"); paymentMethod != "" {
		filters.PaymentMethod = &paymentMethod
	}
	if deliveryType := r.URL.Query().Get("delivery_type"); deliveryType != "" {
		filters.DeliveryType = &deliveryType
	}
	if storeIDStr := r.URL.Query().Get("store_id"); storeIDStr != "" {
		if storeID, err := uuid.Parse(storeIDStr); err == nil {
			filters.StoreID = &storeID
		}
	}
	if userID := r.URL.Query().Get("user_id"); userID != "" {
		filters.UserID = &userID
	}

	// Parse date filters
	if dateFromStr := r.URL.Query().Get("date_from"); dateFromStr != "" {
		if dateFrom, err := time.Parse(time.RFC3339, dateFromStr); err == nil {
			filters.DateFrom = &dateFrom
		}
	}
	if dateToStr := r.URL.Query().Get("date_to"); dateToStr != "" {
		if dateTo, err := time.Parse(time.RFC3339, dateToStr); err == nil {
			filters.DateTo = &dateTo
		}
	}

	orders, err := h.orderRepo.ExportOrders(ctx, filters)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to export orders", err.Error())
		return
	}

	// Set CSV headers
	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=orders_%s.csv", time.Now().Format("20060102_150405")))

	writer := csv.NewWriter(w)
	defer writer.Flush()

	// Write CSV header
	header := []string{
		"Order Number", "Customer Name", "Phone", "Email", "Status",
		"Delivery Type", "Store Name", "Payment Method", "Total Amount",
		"Currency", "Created At", "Updated At",
	}
	if err := writer.Write(header); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to write CSV header", err.Error())
		return
	}

	// Write data rows
	for _, order := range orders {
		storeName := ""
		if order.StoreName != nil {
			storeName = *order.StoreName
		}
		email := ""
		if order.Email != nil {
			email = *order.Email
		}

		row := []string{
			order.OrderNumber,
			order.FullName,
			order.PhoneNumber,
			email,
			order.Status,
			order.DeliveryType,
			storeName,
			order.PaymentMethod,
			fmt.Sprintf("%.2f", order.TotalAmount),
			order.Currency,
			order.CreatedAt.Format(time.RFC3339),
			order.UpdatedAt.Format(time.RFC3339),
		}
		if err := writer.Write(row); err != nil {
			respondError(w, http.StatusInternalServerError, "Failed to write CSV row", err.Error())
			return
		}
	}
}

// GetOrderComments returns all comments for an order
func (h *OrderHandler) GetOrderComments(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	orderID, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid order ID", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	comments, err := h.orderRepo.GetCommentsByOrderID(ctx, orderID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch comments", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": comments,
	})
}

// CreateOrderComment adds a comment to an order
func (h *OrderHandler) CreateOrderComment(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	orderID, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid order ID", err.Error())
		return
	}

	// Get admin info from context (set by auth middleware)
	var adminID string
	var adminName string

	if userID, ok := r.Context().Value(auth.UserIDKey).(uuid.UUID); ok {
		adminID = userID.String()
	} else {
		adminID = "unknown"
	}

	if username, ok := r.Context().Value(auth.UsernameKey).(string); ok && username != "" {
		adminName = username
	} else {
		adminName = "Admin"
	}

	var input models.CreateOrderCommentInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	if strings.TrimSpace(input.Content) == "" {
		respondError(w, http.StatusBadRequest, "Validation failed", "comment content is required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	comment, err := h.orderRepo.CreateComment(ctx, orderID, adminID, adminName, input.Content)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to create comment", err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, map[string]interface{}{
		"data": comment,
	})
}
