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

// ============================================================================
// SERVICE PACKAGE TYPE HANDLER
// ============================================================================

// ServicePackageTypeHandler handles service package type endpoints
type ServicePackageTypeHandler struct {
	typeRepo *repository.ServicePackageTypeRepository
}

// NewServicePackageTypeHandler creates a new service package type handler
func NewServicePackageTypeHandler(typeRepo *repository.ServicePackageTypeRepository) *ServicePackageTypeHandler {
	return &ServicePackageTypeHandler{
		typeRepo: typeRepo,
	}
}

// ListTypes handles GET /api/v1/service-types
func (h *ServicePackageTypeHandler) ListTypes(w http.ResponseWriter, r *http.Request) {
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
	filters := &models.ServicePackageTypeFilters{
		Search:     r.URL.Query().Get("search"),
		ActiveOnly: r.URL.Query().Get("active_only") == "true",
	}

	types, err := h.typeRepo.List(ctx, filters, limit, offset)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch service package types", err.Error())
		return
	}

	total, err := h.typeRepo.Count(ctx, filters)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to count service package types", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": types,
		"meta": map[string]interface{}{
			"limit":  limit,
			"offset": offset,
			"total":  total,
		},
	})
}

// GetType handles GET /api/v1/service-types/{id}
func (h *ServicePackageTypeHandler) GetType(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid service type ID", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	packageType, err := h.typeRepo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrServicePackageTypeNotFound) {
			respondError(w, http.StatusNotFound, "Service package type not found", err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to fetch service package type", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": packageType,
	})
}

// CreateType handles POST /api/v1/service-types
func (h *ServicePackageTypeHandler) CreateType(w http.ResponseWriter, r *http.Request) {
	var input models.ServicePackageTypeInput
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

	packageType, err := h.typeRepo.Create(ctx, &input)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Failed to create service package type", err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, map[string]interface{}{
		"data": packageType,
	})
}

// UpdateType handles PUT /api/v1/service-types/{id}
func (h *ServicePackageTypeHandler) UpdateType(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid service type ID", err.Error())
		return
	}

	var input models.ServicePackageTypeInput
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

	packageType, err := h.typeRepo.Update(ctx, id, &input)
	if err != nil {
		if errors.Is(err, repository.ErrServicePackageTypeNotFound) {
			respondError(w, http.StatusNotFound, "Service package type not found", err.Error())
			return
		}
		respondError(w, http.StatusBadRequest, "Failed to update service package type", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": packageType,
	})
}

// DeleteType handles DELETE /api/v1/service-types/{id}
func (h *ServicePackageTypeHandler) DeleteType(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid service type ID", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	err = h.typeRepo.Delete(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrServicePackageTypeNotFound) {
			respondError(w, http.StatusNotFound, "Service package type not found", err.Error())
			return
		}
		if errors.Is(err, repository.ErrServicePackageTypeHasPackages) {
			respondError(w, http.StatusConflict, "Cannot delete service package type", err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to delete service package type", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Service package type deleted successfully",
	})
}

// ============================================================================
// SERVICE PACKAGE HANDLER
// ============================================================================

// ServicePackageHandler handles service package endpoints
type ServicePackageHandler struct {
	packageRepo *repository.ServicePackageRepository
}

// NewServicePackageHandler creates a new service package handler
func NewServicePackageHandler(packageRepo *repository.ServicePackageRepository) *ServicePackageHandler {
	return &ServicePackageHandler{
		packageRepo: packageRepo,
	}
}

// ListPackages handles GET /api/v1/service-packages
func (h *ServicePackageHandler) ListPackages(w http.ResponseWriter, r *http.Request) {
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
	filters := &models.ServicePackageFilters{
		Search:     r.URL.Query().Get("search"),
		ActiveOnly: r.URL.Query().Get("active_only") == "true",
	}

	if typeIDStr := r.URL.Query().Get("type_id"); typeIDStr != "" {
		if typeID, err := uuid.Parse(typeIDStr); err == nil {
			filters.TypeID = &typeID
		}
	}

	packages, err := h.packageRepo.List(ctx, filters, limit, offset)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch service packages", err.Error())
		return
	}

	total, err := h.packageRepo.Count(ctx, filters)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to count service packages", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": packages,
		"meta": map[string]interface{}{
			"limit":  limit,
			"offset": offset,
			"total":  total,
		},
	})
}

// GetPackage handles GET /api/v1/service-packages/{id}
func (h *ServicePackageHandler) GetPackage(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid service package ID", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	pkg, err := h.packageRepo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrServicePackageNotFound) {
			respondError(w, http.StatusNotFound, "Service package not found", err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to fetch service package", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": pkg,
	})
}

// CreatePackage handles POST /api/v1/service-packages
func (h *ServicePackageHandler) CreatePackage(w http.ResponseWriter, r *http.Request) {
	var input models.ServicePackageInput
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

	pkg, err := h.packageRepo.Create(ctx, &input)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Failed to create service package", err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, map[string]interface{}{
		"data": pkg,
	})
}

// UpdatePackage handles PUT /api/v1/service-packages/{id}
func (h *ServicePackageHandler) UpdatePackage(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid service package ID", err.Error())
		return
	}

	var input models.ServicePackageInput
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

	pkg, err := h.packageRepo.Update(ctx, id, &input)
	if err != nil {
		if errors.Is(err, repository.ErrServicePackageNotFound) {
			respondError(w, http.StatusNotFound, "Service package not found", err.Error())
			return
		}
		respondError(w, http.StatusBadRequest, "Failed to update service package", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": pkg,
	})
}

// DeletePackage handles DELETE /api/v1/service-packages/{id}
func (h *ServicePackageHandler) DeletePackage(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid service package ID", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	err = h.packageRepo.Delete(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrServicePackageNotFound) {
			respondError(w, http.StatusNotFound, "Service package not found", err.Error())
			return
		}
		if errors.Is(err, repository.ErrServicePackageHasOrders) {
			respondError(w, http.StatusConflict, "Cannot delete service package", err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to delete service package", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Service package deleted successfully",
	})
}

// ============================================================================
// SERVICE ORDER HANDLER
// ============================================================================

// ServiceOrderHandler handles service order endpoints
type ServiceOrderHandler struct {
	orderRepo *repository.ServiceOrderRepository
}

// NewServiceOrderHandler creates a new service order handler
func NewServiceOrderHandler(orderRepo *repository.ServiceOrderRepository) *ServiceOrderHandler {
	return &ServiceOrderHandler{
		orderRepo: orderRepo,
	}
}

// ListOrders handles GET /api/v1/service-orders
func (h *ServiceOrderHandler) ListOrders(w http.ResponseWriter, r *http.Request) {
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
	filters := &models.ServiceOrderFilters{
		Search: r.URL.Query().Get("search"),
	}

	if packageIDStr := r.URL.Query().Get("package_id"); packageIDStr != "" {
		if packageID, err := uuid.Parse(packageIDStr); err == nil {
			filters.PackageID = &packageID
		}
	}

	if statusStr := r.URL.Query().Get("status"); statusStr != "" {
		status := models.ServiceOrderStatus(statusStr)
		filters.Status = &status
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

	orders, err := h.orderRepo.List(ctx, filters, limit, offset)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch service orders", err.Error())
		return
	}

	total, err := h.orderRepo.Count(ctx, filters)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to count service orders", err.Error())
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

// GetOrder handles GET /api/v1/service-orders/{id}
func (h *ServiceOrderHandler) GetOrder(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid service order ID", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	order, err := h.orderRepo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrServiceOrderNotFound) {
			respondError(w, http.StatusNotFound, "Service order not found", err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to fetch service order", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": order,
	})
}

// CreateOrder handles POST /api/v1/service-orders (PUBLIC - no auth required)
func (h *ServiceOrderHandler) CreateOrder(w http.ResponseWriter, r *http.Request) {
	var input models.CreateServiceOrderInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	// Validate required fields
	if input.CustomerName == "" {
		respondError(w, http.StatusBadRequest, "Validation failed", "customer_name is required")
		return
	}
	if input.CustomerPhone == "" {
		respondError(w, http.StatusBadRequest, "Validation failed", "customer_phone is required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	order, err := h.orderRepo.Create(ctx, &input)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Failed to create service order", err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, map[string]interface{}{
		"data": order,
	})
}

// UpdateOrder handles PUT /api/v1/service-orders/{id}
func (h *ServiceOrderHandler) UpdateOrder(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid service order ID", err.Error())
		return
	}

	var input models.UpdateServiceOrderInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	order, err := h.orderRepo.Update(ctx, id, &input)
	if err != nil {
		if errors.Is(err, repository.ErrServiceOrderNotFound) {
			respondError(w, http.StatusNotFound, "Service order not found", err.Error())
			return
		}
		respondError(w, http.StatusBadRequest, "Failed to update service order", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": order,
	})
}

// DeleteOrder handles DELETE /api/v1/service-orders/{id}
func (h *ServiceOrderHandler) DeleteOrder(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid service order ID", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	err = h.orderRepo.Delete(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrServiceOrderNotFound) {
			respondError(w, http.StatusNotFound, "Service order not found", err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to delete service order", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Service order deleted successfully",
	})
}

// GetOrderStats handles GET /api/v1/service-orders/stats
func (h *ServiceOrderHandler) GetOrderStats(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	stats, err := h.orderRepo.GetStats(ctx)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch service order stats", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": stats,
	})
}
