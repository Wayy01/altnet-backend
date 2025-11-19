package handlers

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

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
	search := r.URL.Query().Get("search")
	hasProducts := r.URL.Query().Get("has_products")
	isActive := r.URL.Query().Get("is_active")
	sortBy := r.URL.Query().Get("sort_by")

	brands, err := h.repo.ListBrandsWithSearch(r.Context(), search, hasProducts, isActive, sortBy, limit, offset)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to fetch brands", err.Error())
		return
	}

	total, err := h.repo.CountBrandsWithSearch(r.Context(), search, hasProducts, isActive)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to count brands", err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": brands,
		"meta": PaginationMeta{
			Limit:  limit,
			Offset: offset,
			Total:  total,
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

// GetBrandWithStats handles GET /api/v1/brands/{id}/stats
// @Summary Get brand with statistics
// @Description Returns brand details with product counts (total, active, in stock, with prices)
// @Tags Brands
// @Produce json
// @Param id path string true "Brand ID"
// @Success 200 {object} repository.BrandWithStats
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /api/v1/brands/{id}/stats [get]
func (h *Handler) GetBrandWithStats(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid brand ID", err.Error())
		return
	}

	brand, err := h.repo.GetBrandWithStats(r.Context(), id)
	if err != nil {
		h.respondError(w, http.StatusNotFound, "Brand not found", err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": brand,
	})
}

// GetBrandProducts handles GET /api/v1/brands/{id}/products
// @Summary Get products for a brand
// @Description Returns paginated list of products for a specific brand
// @Tags Brands
// @Produce json
// @Param id path string true "Brand ID"
// @Param limit query int false "Number of records to return" default(10)
// @Param offset query int false "Number of records to skip" default(0)
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/brands/{id}/products [get]
func (h *Handler) GetBrandProducts(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid brand ID", err.Error())
		return
	}

	limit, offset := h.parsePagination(r)

	products, err := h.repo.GetProductsByBrandID(r.Context(), id, limit, offset)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to fetch brand products", err.Error())
		return
	}

	total, err := h.repo.CountProductsByBrandID(r.Context(), id)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to count brand products", err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": products,
		"meta": PaginationMeta{
			Limit:  limit,
			Offset: offset,
			Total:  total,
		},
	})
}

// BulkUpdateBrandProductsRequest represents the request body for bulk updating brand products
type BulkUpdateBrandProductsRequest struct {
	IsActive bool `json:"is_active"`
}

// BulkUpdateBrandProducts handles PATCH /api/v1/brands/{id}/products/bulk
// @Summary Bulk update all products for a brand
// @Description Activates or deactivates all products belonging to a brand
// @Tags Brands
// @Accept json
// @Produce json
// @Param id path string true "Brand ID"
// @Param request body BulkUpdateBrandProductsRequest true "Update data"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/brands/{id}/products/bulk [patch]
func (h *Handler) BulkUpdateBrandProducts(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid brand ID", err.Error())
		return
	}

	var req BulkUpdateBrandProductsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	updated, err := h.repo.BulkUpdateProductsByBrandID(r.Context(), id, req.IsActive)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to bulk update products", err.Error())
		return
	}

	action := "deactivated"
	if req.IsActive {
		action = "activated"
	}

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": fmt.Sprintf("Successfully %s %d products", action, updated),
		"updated": updated,
	})
}

// ============================================================================
// CATEGORY ENDPOINTS
// ============================================================================

// ListCategories handles GET /api/v1/categories
func (h *Handler) ListCategories(w http.ResponseWriter, r *http.Request) {
	limit, offset := h.parsePagination(r)

	// Check if parent_id filter is provided
	parentIDStr := r.URL.Query().Get("parent_id")

	// If no parent_id filter, return all categories for the dashboard
	if parentIDStr == "" {
		categories, err := h.repo.ListAllCategories(r.Context())
		if err != nil {
			h.respondError(w, http.StatusInternalServerError, "Failed to fetch categories", err.Error())
			return
		}

		h.respondJSON(w, http.StatusOK, map[string]interface{}{
			"data": categories,
			"meta": PaginationMeta{
				Limit:  len(categories),
				Offset: 0,
				Total:  len(categories),
			},
		})
		return
	}

	// Filter by parent_id
	var parentID *uuid.UUID
	if parentIDStr != "null" {
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

	total, err := h.repo.CountCategories(r.Context(), parentID)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to count categories", err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": categories,
		"meta": PaginationMeta{
			Limit:  limit,
			Offset: offset,
			Total:  total,
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

	// Get total count with same filters
	total, err := h.repo.CountProducts(r.Context(), filter)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to count products", err.Error())
		return
	}

	// Get products with brand and category data in single query (avoids N+1)
	enriched, err := h.repo.GetProductsWithDetails(r.Context(), products)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to enrich products", err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": enriched,
		"meta": PaginationMeta{
			Limit:  limit,
			Offset: offset,
			Total:  total,
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

// GetProductVariants handles GET /api/v1/products/{id}/variants
func (h *Handler) GetProductVariants(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid product ID", err.Error())
		return
	}

	variants, err := h.repo.GetProductVariants(r.Context(), id)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to fetch variants", err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": variants,
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

	// Get total count with same filters
	total, err := h.repo.CountProducts(r.Context(), filter)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to count search results", err.Error())
		return
	}

	// Get products with brand and category data in single query (avoids N+1)
	enriched, err := h.repo.GetProductsWithDetails(r.Context(), products)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to enrich search results", err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": enriched,
		"meta": PaginationMeta{
			Limit:  limit,
			Offset: offset,
			Total:  total,
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

// ============================================================================
// DASHBOARD STATISTICS ENDPOINTS
// ============================================================================

// DashboardStats response structure
type DashboardStats struct {
	TotalProducts        int                      `json:"total_products"`
	TotalBrands          int                      `json:"total_brands"`
	TotalCategories      int                      `json:"total_categories"`
	TotalProperties      int                      `json:"total_properties"`
	TotalCharacteristics int                      `json:"total_characteristics"`
	TotalPrices          int                      `json:"total_prices"`
	ProductsInStock      int                      `json:"products_in_stock"`
	ProductsOutOfStock   int                      `json:"products_out_of_stock"`
	TotalStockValue      float64                  `json:"total_stock_value"`
	LastSyncAt           *time.Time               `json:"last_sync_at"`
	LastSyncStatus       string                   `json:"last_sync_status"`
	RecentActivity       []map[string]interface{} `json:"recent_activity"`
}

// GetDashboardStats handles GET /api/v1/dashboard/stats
// @Summary Get dashboard statistics
// @Description Returns aggregate counts, stock summaries, and recent activity for the CMS dashboard
// @Tags Dashboard
// @Produce json
// @Success 200 {object} DashboardStats
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/dashboard/stats [get]
func (h *Handler) GetDashboardStats(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	stats, err := h.repo.GetDashboardStats(ctx)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to fetch dashboard stats", err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": stats,
	})
}

// GetStockSummary handles GET /api/v1/dashboard/stock-summary
// @Summary Get stock summary by category
// @Description Returns stock levels grouped by category
// @Tags Dashboard
// @Produce json
// @Success 200 {array} map[string]interface{}
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/dashboard/stock-summary [get]
func (h *Handler) GetStockSummary(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	summary, err := h.repo.GetStockSummaryByCategory(ctx)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to fetch stock summary", err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": summary,
	})
}

// GetPriceSummary handles GET /api/v1/dashboard/price-summary
// @Summary Get price distribution summary
// @Description Returns price range distribution across products
// @Tags Dashboard
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/dashboard/price-summary [get]
func (h *Handler) GetPriceSummary(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	summary, err := h.repo.GetPriceSummary(ctx)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to fetch price summary", err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": summary,
	})
}

// ============================================================================
// SYNC MANAGEMENT ENDPOINTS
// ============================================================================

// ListSyncLogs handles GET /api/v1/sync/logs
// @Summary List sync operation logs
// @Description Returns paginated list of sync operation logs with filtering
// @Tags Sync
// @Produce json
// @Param limit query int false "Number of records to return" default(50)
// @Param offset query int false "Number of records to skip" default(0)
// @Param status query string false "Filter by status (running, completed, failed)"
// @Param sync_type query string false "Filter by sync type"
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/sync/logs [get]
func (h *Handler) ListSyncLogs(w http.ResponseWriter, r *http.Request) {
	limit, offset := h.parsePagination(r)
	status := r.URL.Query().Get("status")
	syncType := r.URL.Query().Get("sync_type")

	logs, err := h.repo.ListSyncLogs(r.Context(), limit, offset, status, syncType)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to fetch sync logs", err.Error())
		return
	}

	total, err := h.repo.CountSyncLogs(r.Context(), status, syncType)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to count sync logs", err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": logs,
		"meta": PaginationMeta{
			Limit:  limit,
			Offset: offset,
			Total:  total,
		},
	})
}

// GetSyncLog handles GET /api/v1/sync/logs/{id}
// @Summary Get sync log details
// @Description Returns detailed information about a specific sync operation
// @Tags Sync
// @Produce json
// @Param id path string true "Sync log ID"
// @Success 200 {object} models.SyncLog
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /api/v1/sync/logs/{id} [get]
func (h *Handler) GetSyncLog(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid sync log ID", err.Error())
		return
	}

	syncLog, err := h.repo.GetSyncLog(r.Context(), id)
	if err != nil {
		h.respondError(w, http.StatusNotFound, "Sync log not found", err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": syncLog,
	})
}

// GetLatestSyncStatus handles GET /api/v1/sync/status
// @Summary Get latest sync status
// @Description Returns the status of the most recent sync operation
// @Tags Sync
// @Produce json
// @Success 200 {object} models.SyncLog
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/sync/status [get]
func (h *Handler) GetLatestSyncStatus(w http.ResponseWriter, r *http.Request) {
	syncLog, err := h.repo.GetLatestSyncLog(r.Context())
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to fetch sync status", err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": syncLog,
	})
}

// SyncStep represents a single sync step with progress info
type SyncStep struct {
	Number      int    `json:"number"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Status      string `json:"status"` // pending, running, completed, failed
	Count       int    `json:"count"`
	Total       int    `json:"total"`
	StartedAt   string `json:"startedAt,omitempty"`
	CompletedAt string `json:"completedAt,omitempty"`

	// Change deltas
	Extracted int `json:"extracted"`
	Inserted  int `json:"inserted"`
	Updated   int `json:"updated"`
}

// SyncProgressResponse represents detailed sync progress
type SyncProgressResponse struct {
	IsRunning                 bool       `json:"isRunning"`
	CurrentStep               int        `json:"currentStep"`
	TotalSteps                int        `json:"totalSteps"`
	Steps                     []SyncStep `json:"steps"`
	SyncLogID                 string     `json:"syncLogId,omitempty"`
	StartedAt                 string     `json:"startedAt,omitempty"`
	ElapsedSeconds            int        `json:"elapsedSeconds"`
	EstimatedRemainingSeconds *int       `json:"estimatedRemainingSeconds,omitempty"`
	LastUpdated               string     `json:"lastUpdated"`

	// Detailed counts
	BrandsSynced          int `json:"brandsSynced"`
	CategoriesSynced      int `json:"categoriesSynced"`
	ProductsSynced        int `json:"productsSynced"`
	CharacteristicsSynced int `json:"characteristicsSynced"`
	PropertiesSynced      int `json:"propertiesSynced"`
	PricesSynced          int `json:"pricesSynced"`
	StockSynced           int `json:"stockSynced"`

	// Change deltas
	BrandsInserted          int `json:"brandsInserted"`
	BrandsUpdated           int `json:"brandsUpdated"`
	CategoriesInserted      int `json:"categoriesInserted"`
	CategoriesUpdated       int `json:"categoriesUpdated"`
	ProductsInserted        int `json:"productsInserted"`
	ProductsUpdated         int `json:"productsUpdated"`
	PropertiesInserted      int `json:"propertiesInserted"`
	PropertiesUpdated       int `json:"propertiesUpdated"`
	CharacteristicsInserted int `json:"characteristicsInserted"`
	CharacteristicsUpdated  int `json:"characteristicsUpdated"`
	PricesUpdated           int `json:"pricesUpdated"`
	StockUpdatedCount       int `json:"stockUpdatedCount"`

	// Category progress for properties step
	CategoriesProcessed int `json:"categoriesProcessed"`
	TotalCategories     int `json:"totalCategories"`

	// Database totals
	DbTotals DbTotals `json:"dbTotals"`
}

// DbTotals holds database count totals
type DbTotals struct {
	Brands          int `json:"brands"`
	Categories      int `json:"categories"`
	Products        int `json:"products"`
	Characteristics int `json:"characteristics"`
	Properties      int `json:"properties"`
}

// GetSyncProgress handles GET /api/v1/sync/progress
// @Summary Get detailed sync progress
// @Description Returns comprehensive sync progress with step-by-step status
// @Tags Sync
// @Produce json
// @Success 200 {object} SyncProgressResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/sync/progress [get]
func (h *Handler) GetSyncProgress(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get the latest sync log
	syncLog, err := h.repo.GetLatestSyncLog(ctx)
	if err != nil && syncLog == nil {
		// No sync logs exist yet
		h.respondJSON(w, http.StatusOK, map[string]interface{}{
			"data": h.buildEmptySyncProgress(ctx),
		})
		return
	}

	// Get database totals
	dbTotals := h.getDbTotals(ctx)

	// Determine if sync is currently running
	isRunning := syncLog != nil && syncLog.Status == "running"

	// Build step progress
	steps := h.buildSyncSteps(syncLog, dbTotals)

	// Calculate elapsed time
	elapsedSeconds := 0
	if syncLog != nil {
		if isRunning {
			elapsedSeconds = int(time.Since(syncLog.StartedAt).Seconds())
		} else if syncLog.DurationSeconds != nil {
			elapsedSeconds = *syncLog.DurationSeconds
		}
	}

	// Determine current step based on what has data
	currentStep := h.determineCurrentStep(syncLog, isRunning, dbTotals)

	// Estimate remaining time (rough estimate based on historical data)
	var estimatedRemaining *int
	if isRunning && currentStep > 0 {
		// Properties step (step 4) typically takes ~35 minutes
		// Simple estimation: if on step 4, estimate based on progress
		if currentStep == 4 {
			expectedProperties := 876081
			if dbTotals.Properties > 0 && dbTotals.Properties < expectedProperties {
				// Estimate based on current progress rate
				progress := float64(dbTotals.Properties) / float64(expectedProperties)
				if progress > 0.01 && elapsedSeconds > 60 {
					// Extrapolate total time based on current rate
					totalEstimated := float64(elapsedSeconds) / progress
					remaining := int(totalEstimated) - elapsedSeconds
					if remaining > 0 {
						estimatedRemaining = &remaining
					}
				}
			}
		}
	}

	// Get categories with products count
	totalCategoriesWithProducts, _ := h.repo.CountCategoriesWithProducts(ctx)

	// Use actual database counts as synced values for real-time accuracy
	// For prices and stock, use sync log since they update in place
	brandsSynced := dbTotals.Brands
	categoriesSynced := dbTotals.Categories
	productsSynced := dbTotals.Products
	characteristicsSynced := dbTotals.Characteristics
	propertiesSynced := dbTotals.Properties
	pricesSynced := 0
	stockSynced := 0

	if syncLog != nil {
		pricesSynced = syncLog.PricesSynced
		stockSynced = syncLog.StockSynced
	}

	// Get change deltas from sync log
	var brandsInserted, brandsUpdated int
	var categoriesInserted, categoriesUpdated int
	var productsInserted, productsUpdated int
	var propertiesInserted, propertiesUpdated int
	var characteristicsInserted, characteristicsUpdated int
	var pricesUpdatedCount, stockUpdatedCount int

	if syncLog != nil {
		brandsInserted = syncLog.BrandsInserted
		brandsUpdated = syncLog.BrandsUpdated
		categoriesInserted = syncLog.CategoriesInserted
		categoriesUpdated = syncLog.CategoriesUpdated
		productsInserted = syncLog.ProductsInserted
		productsUpdated = syncLog.ProductsUpdated
		propertiesInserted = syncLog.PropertiesInserted
		propertiesUpdated = syncLog.PropertiesUpdated
		characteristicsInserted = syncLog.CharacteristicsInserted
		characteristicsUpdated = syncLog.CharacteristicsUpdated
		pricesUpdatedCount = syncLog.PricesUpdated
		stockUpdatedCount = syncLog.StockUpdated
	}

	response := SyncProgressResponse{
		IsRunning:                 isRunning,
		CurrentStep:               currentStep,
		TotalSteps:                7,
		Steps:                     steps,
		SyncLogID:                 "",
		StartedAt:                 "",
		ElapsedSeconds:            elapsedSeconds,
		EstimatedRemainingSeconds: estimatedRemaining,
		LastUpdated:               time.Now().UTC().Format(time.RFC3339),
		BrandsSynced:              brandsSynced,
		CategoriesSynced:          categoriesSynced,
		ProductsSynced:            productsSynced,
		CharacteristicsSynced:     characteristicsSynced,
		PropertiesSynced:          propertiesSynced,
		PricesSynced:              pricesSynced,
		StockSynced:               stockSynced,
		BrandsInserted:            brandsInserted,
		BrandsUpdated:             brandsUpdated,
		CategoriesInserted:        categoriesInserted,
		CategoriesUpdated:         categoriesUpdated,
		ProductsInserted:          productsInserted,
		ProductsUpdated:           productsUpdated,
		PropertiesInserted:        propertiesInserted,
		PropertiesUpdated:         propertiesUpdated,
		CharacteristicsInserted:   characteristicsInserted,
		CharacteristicsUpdated:    characteristicsUpdated,
		PricesUpdated:             pricesUpdatedCount,
		StockUpdatedCount:         stockUpdatedCount,
		CategoriesProcessed:       0,
		TotalCategories:           totalCategoriesWithProducts,
		DbTotals:                  dbTotals,
	}

	if syncLog != nil {
		response.SyncLogID = syncLog.ID.String()
		response.StartedAt = syncLog.StartedAt.Format(time.RFC3339)

		// Estimate categories processed based on properties count
		if totalCategoriesWithProducts > 0 && propertiesSynced > 0 {
			// Expected properties count
			expectedProperties := 876081
			// Rough estimate based on progress percentage
			progress := float64(propertiesSynced) / float64(expectedProperties)
			response.CategoriesProcessed = int(float64(totalCategoriesWithProducts) * progress)
			if response.CategoriesProcessed > totalCategoriesWithProducts {
				response.CategoriesProcessed = totalCategoriesWithProducts
			}
		}
	}

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": response,
	})
}

func (h *Handler) buildEmptySyncProgress(ctx context.Context) SyncProgressResponse {
	dbTotals := h.getDbTotals(ctx)
	return SyncProgressResponse{
		IsRunning:   false,
		CurrentStep: 0,
		TotalSteps:  7,
		Steps:       h.buildSyncSteps(nil, dbTotals),
		LastUpdated: time.Now().UTC().Format(time.RFC3339),
		DbTotals:    dbTotals,
	}
}

func (h *Handler) getDbTotals(ctx context.Context) DbTotals {
	brands, _ := h.repo.CountBrands(ctx)
	categories, _ := h.repo.CountCategories(ctx, nil)
	products, _ := h.repo.CountAllProducts(ctx)
	characteristics, _ := h.repo.CountCharacteristics(ctx)
	properties, _ := h.repo.CountProperties(ctx)

	return DbTotals{
		Brands:          brands,
		Categories:      categories,
		Products:        products,
		Characteristics: characteristics,
		Properties:      properties,
	}
}

func (h *Handler) buildSyncSteps(syncLog *models.SyncLog, dbTotals DbTotals) []SyncStep {
	// Expected totals for a full sync (estimates based on known data)
	expectedBrands := 1133
	expectedCategories := 418
	expectedProducts := 48316
	expectedCharacteristics := 460
	expectedProperties := 876081

	// Use actual DB counts as expected if they're higher (data has grown)
	if dbTotals.Brands > expectedBrands {
		expectedBrands = dbTotals.Brands
	}
	if dbTotals.Categories > expectedCategories {
		expectedCategories = dbTotals.Categories
	}
	if dbTotals.Products > expectedProducts {
		expectedProducts = dbTotals.Products
	}
	if dbTotals.Characteristics > expectedCharacteristics {
		expectedCharacteristics = dbTotals.Characteristics
	}
	if dbTotals.Properties > expectedProperties {
		expectedProperties = dbTotals.Properties
	}

	steps := []SyncStep{
		{
			Number:      1,
			Name:        "Brands",
			Description: "Fetch all brands with logos",
			Status:      "pending",
			Count:       0,
			Total:       expectedBrands,
		},
		{
			Number:      2,
			Name:        "Categories",
			Description: "Fetch hierarchical category tree",
			Status:      "pending",
			Count:       0,
			Total:       expectedCategories,
		},
		{
			Number:      3,
			Name:        "Products",
			Description: "Fetch products with images, barcodes, and characteristics",
			Status:      "pending",
			Count:       0,
			Total:       expectedProducts,
		},
		{
			Number:      4,
			Name:        "Properties",
			Description: "Fetch properties per category (slowest step, ~35 min)",
			Status:      "pending",
			Count:       0,
			Total:       expectedProperties,
		},
		{
			Number:      5,
			Name:        "Prices",
			Description: "Update characteristic prices (multi-currency)",
			Status:      "pending",
			Count:       0,
			Total:       expectedCharacteristics,
		},
		{
			Number:      6,
			Name:        "Stock",
			Description: "Update characteristic stock levels",
			Status:      "pending",
			Count:       0,
			Total:       expectedCharacteristics,
		},
		{
			Number:      7,
			Name:        "Exchange Rates",
			Description: "Fetch current currency rates",
			Status:      "pending",
			Count:       0,
			Total:       3, // MDL, EUR, USD
		},
	}

	if syncLog == nil {
		return steps
	}

	// Update step statuses and counts based on actual database counts
	// This ensures we show real-time progress even if sync log isn't updated yet
	isRunning := syncLog.Status == "running"
	isFailed := syncLog.Status == "failed"
	isCompleted := syncLog.Status == "completed"

	// Determine current step based on what data exists in the database
	// During a running sync, use actual DB counts to show progress

	// Step 1: Brands - use actual DB count
	if dbTotals.Brands > 0 {
		steps[0].Status = "completed"
		steps[0].Count = dbTotals.Brands
		steps[0].Extracted = syncLog.BrandsSynced
		steps[0].Inserted = syncLog.BrandsInserted
		steps[0].Updated = syncLog.BrandsUpdated
	}

	// Step 2: Categories - use actual DB count
	if dbTotals.Categories > 0 {
		steps[1].Status = "completed"
		steps[1].Count = dbTotals.Categories
		steps[1].Extracted = syncLog.CategoriesSynced
		steps[1].Inserted = syncLog.CategoriesInserted
		steps[1].Updated = syncLog.CategoriesUpdated
	}

	// Step 3: Products - use actual DB count (also implies characteristics are synced)
	if dbTotals.Products > 0 {
		steps[2].Status = "completed"
		steps[2].Count = dbTotals.Products
		steps[2].Extracted = syncLog.ProductsSynced
		steps[2].Inserted = syncLog.ProductsInserted
		steps[2].Updated = syncLog.ProductsUpdated
	}

	// Step 4: Properties - use actual DB count
	// This step takes longest, so during running sync, show current progress
	if dbTotals.Properties > 0 {
		// If sync is running and we have some properties but not at expected level,
		// this step is likely still in progress
		if isRunning && dbTotals.Properties < expectedProperties*9/10 {
			steps[3].Status = "running"
		} else {
			steps[3].Status = "completed"
		}
		steps[3].Count = dbTotals.Properties
		steps[3].Extracted = syncLog.PropertiesSynced
		steps[3].Inserted = syncLog.PropertiesInserted
		steps[3].Updated = syncLog.PropertiesUpdated
	}

	// Step 5: Prices - check sync log since prices update characteristics in place
	if syncLog.PricesSynced > 0 {
		steps[4].Status = "completed"
		steps[4].Count = syncLog.PricesSynced
		steps[4].Extracted = syncLog.PricesSynced
		steps[4].Updated = syncLog.PricesUpdated
	}

	// Step 6: Stock - check sync log since stock updates characteristics in place
	if syncLog.StockSynced > 0 {
		steps[5].Status = "completed"
		steps[5].Count = syncLog.StockSynced
		steps[5].Extracted = syncLog.StockSynced
		steps[5].Updated = syncLog.StockUpdated
	}

	// Step 7: Exchange Rates - check sync log details or if sync is completed
	// Note: Exchange rates are always 3 (MDL, EUR, USD) and always updated in place
	if syncLog.Details != nil {
		if _, ok := syncLog.Details["services_synced"]; ok {
			steps[6].Status = "completed"
			steps[6].Count = 3
			steps[6].Extracted = 3
			// Don't show insert/update for exchange rates - they're always updated
		}
	}
	if isCompleted {
		steps[6].Status = "completed"
		steps[6].Count = 3
		steps[6].Extracted = 3
	}

	// If running, determine which step is actually running based on data state
	if isRunning {
		foundRunning := false
		for i := range steps {
			if steps[i].Status == "running" {
				foundRunning = true
				break
			}
		}
		// If no step is marked running yet, find the first pending one
		if !foundRunning {
			for i := range steps {
				if steps[i].Status == "pending" {
					steps[i].Status = "running"
					break
				}
			}
		}
	}

	// If failed, mark the failed step
	if isFailed {
		for i := range steps {
			if steps[i].Status == "running" {
				steps[i].Status = "failed"
				break
			} else if steps[i].Status == "pending" {
				steps[i].Status = "failed"
				break
			}
		}
	}

	return steps
}

func (h *Handler) determineCurrentStep(syncLog *models.SyncLog, isRunning bool, dbTotals DbTotals) int {
	if syncLog == nil {
		return 0
	}

	if !isRunning {
		return 7 // Completed
	}

	// Expected totals for determining if a step is complete
	expectedProperties := 876081
	if dbTotals.Properties > expectedProperties {
		expectedProperties = dbTotals.Properties
	}

	// Determine current step based on actual database state and sync log
	// For steps 5-7, use sync log since they update in place
	if syncLog.StockSynced > 0 {
		return 7
	}
	if syncLog.PricesSynced > 0 {
		return 6
	}

	// For properties, check if we're still syncing (less than 90% complete)
	if dbTotals.Properties > 0 && dbTotals.Properties < expectedProperties*9/10 {
		return 4 // Still on properties step
	}
	if dbTotals.Properties >= expectedProperties*9/10 {
		return 5 // Properties done, moving to prices
	}

	// For earlier steps, use database counts
	if dbTotals.Products > 0 {
		return 4 // Products done, on properties
	}
	if dbTotals.Categories > 0 {
		return 3 // Categories done, on products
	}
	if dbTotals.Brands > 0 {
		return 2 // Brands done, on categories
	}

	return 1 // On brands
}

// ============================================================================
// ENHANCED CRUD OPERATIONS - PRODUCTS
// ============================================================================

// CreateProduct handles POST /api/v1/products
// @Summary Create a new product
// @Description Creates a new product in the database
// @Tags Products
// @Accept json
// @Produce json
// @Param product body CreateProductRequest true "Product data"
// @Success 201 {object} models.Product
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/products [post]
func (h *Handler) CreateProduct(w http.ResponseWriter, r *http.Request) {
	var req repository.CreateProductRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	// Validate required fields
	if req.Name == "" {
		h.respondError(w, http.StatusBadRequest, "Validation failed", "name is required")
		return
	}

	product, err := h.repo.CreateProduct(r.Context(), &req)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to create product", err.Error())
		return
	}

	h.respondJSON(w, http.StatusCreated, map[string]interface{}{
		"data": product,
	})
}

// UpdateProduct handles PUT /api/v1/products/{id}
// @Summary Update a product
// @Description Updates an existing product by ID
// @Tags Products
// @Accept json
// @Produce json
// @Param id path string true "Product ID"
// @Param product body UpdateProductRequest true "Product data"
// @Success 200 {object} models.Product
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/products/{id} [put]
func (h *Handler) UpdateProduct(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid product ID", err.Error())
		return
	}

	var req repository.UpdateProductRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	product, err := h.repo.UpdateProduct(r.Context(), id, &req)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			h.respondError(w, http.StatusNotFound, "Product not found", err.Error())
			return
		}
		h.respondError(w, http.StatusInternalServerError, "Failed to update product", err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": product,
	})
}

// DeleteProduct handles DELETE /api/v1/products/{id}
// @Summary Delete a product
// @Description Soft deletes a product by setting is_active to false
// @Tags Products
// @Produce json
// @Param id path string true "Product ID"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/products/{id} [delete]
func (h *Handler) DeleteProduct(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid product ID", err.Error())
		return
	}

	err = h.repo.DeleteProduct(r.Context(), id)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			h.respondError(w, http.StatusNotFound, "Product not found", err.Error())
			return
		}
		h.respondError(w, http.StatusInternalServerError, "Failed to delete product", err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Product deleted successfully",
	})
}

// ============================================================================
// ENHANCED CRUD OPERATIONS - BRANDS
// ============================================================================

// CreateBrand handles POST /api/v1/brands
// @Summary Create a new brand
// @Description Creates a new brand in the database
// @Tags Brands
// @Accept json
// @Produce json
// @Param brand body CreateBrandRequest true "Brand data"
// @Success 201 {object} models.Brand
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/brands [post]
func (h *Handler) CreateBrand(w http.ResponseWriter, r *http.Request) {
	var req repository.CreateBrandRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	// Validate required fields
	if req.Name == "" {
		h.respondError(w, http.StatusBadRequest, "Validation failed", "name is required")
		return
	}

	brand, err := h.repo.CreateBrand(r.Context(), &req)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to create brand", err.Error())
		return
	}

	h.respondJSON(w, http.StatusCreated, map[string]interface{}{
		"data": brand,
	})
}

// UpdateBrand handles PUT /api/v1/brands/{id}
// @Summary Update a brand
// @Description Updates an existing brand by ID
// @Tags Brands
// @Accept json
// @Produce json
// @Param id path string true "Brand ID"
// @Param brand body UpdateBrandRequest true "Brand data"
// @Success 200 {object} models.Brand
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/brands/{id} [put]
func (h *Handler) UpdateBrand(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid brand ID", err.Error())
		return
	}

	var req repository.UpdateBrandRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	brand, err := h.repo.UpdateBrand(r.Context(), id, &req)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			h.respondError(w, http.StatusNotFound, "Brand not found", err.Error())
			return
		}
		h.respondError(w, http.StatusInternalServerError, "Failed to update brand", err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": brand,
	})
}

// DeleteBrand handles DELETE /api/v1/brands/{id}
// @Summary Delete a brand
// @Description Soft deletes a brand by setting is_active to false
// @Tags Brands
// @Produce json
// @Param id path string true "Brand ID"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/brands/{id} [delete]
func (h *Handler) DeleteBrand(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid brand ID", err.Error())
		return
	}

	err = h.repo.DeleteBrand(r.Context(), id)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			h.respondError(w, http.StatusNotFound, "Brand not found", err.Error())
			return
		}
		h.respondError(w, http.StatusInternalServerError, "Failed to delete brand", err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Brand deleted successfully",
	})
}

// ============================================================================
// ENHANCED CRUD OPERATIONS - CATEGORIES
// ============================================================================

// CreateCategory handles POST /api/v1/categories
// @Summary Create a new category
// @Description Creates a new category in the database
// @Tags Categories
// @Accept json
// @Produce json
// @Param category body CreateCategoryRequest true "Category data"
// @Success 201 {object} models.Category
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/categories [post]
func (h *Handler) CreateCategory(w http.ResponseWriter, r *http.Request) {
	var req repository.CreateCategoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	// Validate required fields
	if req.Name == "" {
		h.respondError(w, http.StatusBadRequest, "Validation failed", "name is required")
		return
	}

	category, err := h.repo.CreateCategory(r.Context(), &req)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to create category", err.Error())
		return
	}

	h.respondJSON(w, http.StatusCreated, map[string]interface{}{
		"data": category,
	})
}

// UpdateCategory handles PUT /api/v1/categories/{id}
// @Summary Update a category
// @Description Updates an existing category by ID
// @Tags Categories
// @Accept json
// @Produce json
// @Param id path string true "Category ID"
// @Param category body UpdateCategoryRequest true "Category data"
// @Success 200 {object} models.Category
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/categories/{id} [put]
func (h *Handler) UpdateCategory(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid category ID", err.Error())
		return
	}

	var req repository.UpdateCategoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	category, err := h.repo.UpdateCategory(r.Context(), id, &req)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			h.respondError(w, http.StatusNotFound, "Category not found", err.Error())
			return
		}
		h.respondError(w, http.StatusInternalServerError, "Failed to update category", err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": category,
	})
}

// DeleteCategory handles DELETE /api/v1/categories/{id}
// @Summary Delete a category
// @Description Soft deletes a category by setting is_active to false
// @Tags Categories
// @Produce json
// @Param id path string true "Category ID"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/categories/{id} [delete]
func (h *Handler) DeleteCategory(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid category ID", err.Error())
		return
	}

	err = h.repo.DeleteCategory(r.Context(), id)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			h.respondError(w, http.StatusNotFound, "Category not found", err.Error())
			return
		}
		h.respondError(w, http.StatusInternalServerError, "Failed to delete category", err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Category deleted successfully",
	})
}

// ============================================================================
// BULK OPERATIONS ENDPOINTS
// ============================================================================

// BulkUpdateRequest represents a bulk update operation request
type BulkUpdateRequest struct {
	IDs      []uuid.UUID `json:"ids"`
	IsActive *bool       `json:"is_active"`
}

// BulkDeleteRequest represents a bulk delete operation request
type BulkDeleteRequest struct {
	IDs []uuid.UUID `json:"ids"`
}

// BulkUpdateProducts handles PATCH /api/v1/products/bulk
// @Summary Bulk update products
// @Description Updates multiple products at once (e.g., enable/disable)
// @Tags Products
// @Accept json
// @Produce json
// @Param request body BulkUpdateRequest true "Bulk update data"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/products/bulk [patch]
func (h *Handler) BulkUpdateProducts(w http.ResponseWriter, r *http.Request) {
	var req BulkUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	if len(req.IDs) == 0 {
		h.respondError(w, http.StatusBadRequest, "Validation failed", "ids array is required")
		return
	}

	if len(req.IDs) > 100 {
		h.respondError(w, http.StatusBadRequest, "Validation failed", "maximum 100 items per bulk operation")
		return
	}

	updated, err := h.repo.BulkUpdateProducts(r.Context(), req.IDs, req.IsActive)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to bulk update products", err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": fmt.Sprintf("Successfully updated %d products", updated),
		"updated": updated,
	})
}

// BulkDeleteProducts handles DELETE /api/v1/products/bulk
// @Summary Bulk delete products
// @Description Soft deletes multiple products at once
// @Tags Products
// @Accept json
// @Produce json
// @Param request body BulkDeleteRequest true "Bulk delete data"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/products/bulk [delete]
func (h *Handler) BulkDeleteProducts(w http.ResponseWriter, r *http.Request) {
	var req BulkDeleteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	if len(req.IDs) == 0 {
		h.respondError(w, http.StatusBadRequest, "Validation failed", "ids array is required")
		return
	}

	if len(req.IDs) > 100 {
		h.respondError(w, http.StatusBadRequest, "Validation failed", "maximum 100 items per bulk operation")
		return
	}

	deleted, err := h.repo.BulkDeleteProducts(r.Context(), req.IDs)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to bulk delete products", err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": fmt.Sprintf("Successfully deleted %d products", deleted),
		"deleted": deleted,
	})
}

// BulkUpdateBrandsRequest represents a bulk update operation request for brands
// Supports both specific IDs and filter-based updates
type BulkUpdateBrandsRequest struct {
	IDs      []uuid.UUID `json:"ids,omitempty"`
	Filter   *struct {
		Search      string `json:"search"`
		HasProducts string `json:"has_products"`
		IsActive    string `json:"is_active"` // Filter by current active status: "true", "false", or "" for all
	} `json:"filter,omitempty"`
	IsActive *bool `json:"is_active"` // New value to set
}

// BulkUpdateBrands handles PATCH /api/v1/brands/bulk
// @Summary Bulk update brands
// @Description Updates multiple brands at once (e.g., enable/disable). Supports both specific IDs and filter-based updates.
// @Tags Brands
// @Accept json
// @Produce json
// @Param request body BulkUpdateBrandsRequest true "Bulk update data"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/brands/bulk [patch]
func (h *Handler) BulkUpdateBrands(w http.ResponseWriter, r *http.Request) {
	var req BulkUpdateBrandsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	if req.IsActive == nil {
		h.respondError(w, http.StatusBadRequest, "Validation failed", "is_active is required")
		return
	}

	var updated int
	var err error

	// Check if this is a filter-based update or ID-based update
	if req.Filter != nil {
		// Filter-based update - update all matching brands
		updated, err = h.repo.BulkUpdateBrandsByFilter(
			r.Context(),
			req.Filter.Search,
			req.Filter.HasProducts,
			req.Filter.IsActive,
			*req.IsActive,
		)
		if err != nil {
			h.respondError(w, http.StatusInternalServerError, "Failed to bulk update brands by filter", err.Error())
			return
		}
	} else if len(req.IDs) > 0 {
		// ID-based update
		if len(req.IDs) > 100 {
			h.respondError(w, http.StatusBadRequest, "Validation failed", "maximum 100 items per bulk operation")
			return
		}
		updated, err = h.repo.BulkUpdateBrands(r.Context(), req.IDs, req.IsActive)
		if err != nil {
			h.respondError(w, http.StatusInternalServerError, "Failed to bulk update brands", err.Error())
			return
		}
	} else {
		h.respondError(w, http.StatusBadRequest, "Validation failed", "either ids array or filter is required")
		return
	}

	action := "deactivated"
	if *req.IsActive {
		action = "activated"
	}

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": fmt.Sprintf("Successfully %s %d brands", action, updated),
		"updated": updated,
	})
}

// BulkUpdateCategories handles PATCH /api/v1/categories/bulk
// @Summary Bulk update categories
// @Description Updates multiple categories at once (e.g., enable/disable)
// @Tags Categories
// @Accept json
// @Produce json
// @Param request body BulkUpdateRequest true "Bulk update data"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/categories/bulk [patch]
func (h *Handler) BulkUpdateCategories(w http.ResponseWriter, r *http.Request) {
	var req BulkUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	if len(req.IDs) == 0 {
		h.respondError(w, http.StatusBadRequest, "Validation failed", "ids array is required")
		return
	}

	if len(req.IDs) > 100 {
		h.respondError(w, http.StatusBadRequest, "Validation failed", "maximum 100 items per bulk operation")
		return
	}

	updated, err := h.repo.BulkUpdateCategories(r.Context(), req.IDs, req.IsActive)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to bulk update categories", err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": fmt.Sprintf("Successfully updated %d categories", updated),
		"updated": updated,
	})
}

// ============================================================================
// EXPORT ENDPOINTS
// ============================================================================

// ExportProducts handles GET /api/v1/export/products
// @Summary Export products
// @Description Exports products data in CSV or JSON format
// @Tags Export
// @Produce json,text/csv
// @Param format query string false "Export format (json or csv)" default(json)
// @Param brand_id query string false "Filter by brand ID"
// @Param category_id query string false "Filter by category ID"
// @Param in_stock query bool false "Filter by stock availability"
// @Success 200 {array} models.Product
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/export/products [get]
func (h *Handler) ExportProducts(w http.ResponseWriter, r *http.Request) {
	format := r.URL.Query().Get("format")
	if format == "" {
		format = "json"
	}

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

	// Get all products matching filter (no pagination for export)
	products, err := h.repo.ListProducts(r.Context(), filter, 10000, 0)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to export products", err.Error())
		return
	}

	switch format {
	case "csv":
		h.exportProductsCSV(w, products)
	default:
		h.respondJSON(w, http.StatusOK, map[string]interface{}{
			"data":  products,
			"count": len(products),
		})
	}
}

func (h *Handler) exportProductsCSV(w http.ResponseWriter, products []*models.Product) {
	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", "attachment; filename=products.csv")

	writer := csv.NewWriter(w)
	defer writer.Flush()

	// Write header
	header := []string{"ID", "Code", "Article", "Name", "Description", "Price Min", "Price Max", "Price MDL", "Price EUR", "Price USD", "Total Stock", "Is Active", "Created At"}
	writer.Write(header)

	// Write data
	for _, p := range products {
		code := ""
		if p.Code != nil {
			code = *p.Code
		}
		article := ""
		if p.Article != nil {
			article = *p.Article
		}
		description := ""
		if p.Description != nil {
			description = *p.Description
		}
		priceMin := ""
		if p.PriceMin != nil {
			priceMin = fmt.Sprintf("%.2f", *p.PriceMin)
		}
		priceMax := ""
		if p.PriceMax != nil {
			priceMax = fmt.Sprintf("%.2f", *p.PriceMax)
		}
		priceMDL := ""
		if p.PriceMDL != nil {
			priceMDL = fmt.Sprintf("%.2f", *p.PriceMDL)
		}
		priceEUR := ""
		if p.PriceEUR != nil {
			priceEUR = fmt.Sprintf("%.2f", *p.PriceEUR)
		}
		priceUSD := ""
		if p.PriceUSD != nil {
			priceUSD = fmt.Sprintf("%.2f", *p.PriceUSD)
		}

		row := []string{
			p.ID.String(),
			code,
			article,
			p.Name,
			description,
			priceMin,
			priceMax,
			priceMDL,
			priceEUR,
			priceUSD,
			strconv.Itoa(p.TotalStock),
			strconv.FormatBool(p.IsActive),
			p.CreatedAt.Format(time.RFC3339),
		}
		writer.Write(row)
	}
}

// ExportBrands handles GET /api/v1/export/brands
// @Summary Export brands
// @Description Exports brands data in CSV or JSON format
// @Tags Export
// @Produce json,text/csv
// @Param format query string false "Export format (json or csv)" default(json)
// @Success 200 {array} models.Brand
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/export/brands [get]
func (h *Handler) ExportBrands(w http.ResponseWriter, r *http.Request) {
	format := r.URL.Query().Get("format")
	if format == "" {
		format = "json"
	}

	brands, err := h.repo.ListBrands(r.Context(), 10000, 0)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to export brands", err.Error())
		return
	}

	switch format {
	case "csv":
		h.exportBrandsCSV(w, brands)
	default:
		h.respondJSON(w, http.StatusOK, map[string]interface{}{
			"data":  brands,
			"count": len(brands),
		})
	}
}

func (h *Handler) exportBrandsCSV(w http.ResponseWriter, brands []*models.Brand) {
	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", "attachment; filename=brands.csv")

	writer := csv.NewWriter(w)
	defer writer.Flush()

	// Write header
	header := []string{"ID", "Code", "Name", "Slug", "Logo URL", "Is Active", "Created At"}
	writer.Write(header)

	// Write data
	for _, b := range brands {
		code := ""
		if b.Code != nil {
			code = *b.Code
		}
		logoURL := ""
		if b.LogoURL != nil {
			logoURL = *b.LogoURL
		}

		row := []string{
			b.ID.String(),
			code,
			b.Name,
			b.Slug,
			logoURL,
			strconv.FormatBool(b.IsActive),
			b.CreatedAt.Format(time.RFC3339),
		}
		writer.Write(row)
	}
}

// ExportCategories handles GET /api/v1/export/categories
// @Summary Export categories
// @Description Exports categories data in CSV or JSON format
// @Tags Export
// @Produce json,text/csv
// @Param format query string false "Export format (json or csv)" default(json)
// @Success 200 {array} models.Category
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/export/categories [get]
func (h *Handler) ExportCategories(w http.ResponseWriter, r *http.Request) {
	format := r.URL.Query().Get("format")
	if format == "" {
		format = "json"
	}

	categories, err := h.repo.ListAllCategories(r.Context())
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "Failed to export categories", err.Error())
		return
	}

	switch format {
	case "csv":
		h.exportCategoriesCSV(w, categories)
	default:
		h.respondJSON(w, http.StatusOK, map[string]interface{}{
			"data":  categories,
			"count": len(categories),
		})
	}
}

func (h *Handler) exportCategoriesCSV(w http.ResponseWriter, categories []*models.Category) {
	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", "attachment; filename=categories.csv")

	writer := csv.NewWriter(w)
	defer writer.Flush()

	// Write header
	header := []string{"ID", "Code", "Name", "Slug", "Parent ID", "Sort Order", "Product Count", "Is Active", "Created At"}
	writer.Write(header)

	// Write data
	for _, c := range categories {
		code := ""
		if c.Code != nil {
			code = *c.Code
		}
		parentID := ""
		if c.ParentID != nil {
			parentID = c.ParentID.String()
		}

		row := []string{
			c.ID.String(),
			code,
			c.Name,
			c.Slug,
			parentID,
			strconv.Itoa(c.SortOrder),
			strconv.Itoa(c.ProductCount),
			strconv.FormatBool(c.IsActive),
			c.CreatedAt.Format(time.RFC3339),
		}
		writer.Write(row)
	}
}

// ============================================================================
// SETTINGS/CONFIG ENDPOINTS
// ============================================================================

// ConfigInfo represents application configuration info
type ConfigInfo struct {
	DatabaseName    string            `json:"database_name"`
	DatabaseHost    string            `json:"database_host"`
	APIVersion      string            `json:"api_version"`
	Environment     string            `json:"environment"`
	Features        map[string]bool   `json:"features"`
	Limits          map[string]int    `json:"limits"`
	ExchangeRates   []*models.ExchangeRate `json:"exchange_rates"`
}

// GetConfig handles GET /api/v1/config
// @Summary Get application configuration
// @Description Returns current application configuration and settings
// @Tags Config
// @Produce json
// @Success 200 {object} ConfigInfo
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/config [get]
func (h *Handler) GetConfig(w http.ResponseWriter, r *http.Request) {
	rates, err := h.repo.GetExchangeRates(r.Context())
	if err != nil {
		rates = []*models.ExchangeRate{}
	}

	config := ConfigInfo{
		DatabaseName: "ultra-data",
		DatabaseHost: "localhost",
		APIVersion:   "v1",
		Environment:  "production",
		Features: map[string]bool{
			"bulk_operations": true,
			"csv_export":      true,
			"json_export":     true,
			"sync_management": true,
		},
		Limits: map[string]int{
			"pagination_max":    100,
			"bulk_operation_max": 100,
			"export_max":        10000,
		},
		ExchangeRates: rates,
	}

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": config,
	})
}

// GetHealth handles GET /api/v1/health
// @Summary Health check endpoint
// @Description Returns the health status of the API and database connection
// @Tags Health
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/health [get]
func (h *Handler) GetHealth(w http.ResponseWriter, r *http.Request) {
	// Check database connection
	err := h.repo.Pool().Ping(r.Context())
	dbStatus := "healthy"
	if err != nil {
		dbStatus = "unhealthy"
	}

	health := map[string]interface{}{
		"status":    "ok",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"database":  dbStatus,
		"version":   "1.0.0",
	}

	if err != nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		health["status"] = "degraded"
	}

	h.respondJSON(w, http.StatusOK, health)
}
