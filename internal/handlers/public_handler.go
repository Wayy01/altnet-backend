package handlers

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"ultra-api-testing/internal/models"
	"ultra-api-testing/internal/repository"
)

// PublicHandler handles public API requests with slug support and promotions
type PublicHandler struct {
	repo              *repository.Repository
	promotionRepo     *repository.PromotionRepository
	serviceTypeRepo   *repository.ServicePackageTypeRepository
	servicePackageRepo *repository.ServicePackageRepository
}

// NewPublicHandler creates a new public API handler
func NewPublicHandler(
	repo *repository.Repository,
	promotionRepo *repository.PromotionRepository,
	serviceTypeRepo *repository.ServicePackageTypeRepository,
	servicePackageRepo *repository.ServicePackageRepository,
) *PublicHandler {
	return &PublicHandler{
		repo:              repo,
		promotionRepo:     promotionRepo,
		serviceTypeRepo:   serviceTypeRepo,
		servicePackageRepo: servicePackageRepo,
	}
}

// isUUID checks if a string is a valid UUID
func isUUID(s string) bool {
	_, err := uuid.Parse(s)
	return err == nil
}

// ============================================================================
// PRODUCTS
// ============================================================================

// GetProduct handles GET /api/v1/public/products/{identifier}
// Accepts both UUID and slug as identifier
func (h *PublicHandler) GetProduct(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	identifier := vars["identifier"]

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	var product *models.Product
	var err error

	if isUUID(identifier) {
		id, _ := uuid.Parse(identifier)
		product, err = h.repo.GetProduct(ctx, id)
		// Verify product is active for public API
		if product != nil && !product.IsActive {
			respondError(w, http.StatusNotFound, "Product not found", "Product is not available")
			return
		}
	} else {
		product, err = h.repo.GetProductBySlug(ctx, identifier)
	}

	if err != nil {
		respondError(w, http.StatusNotFound, "Product not found", err.Error())
		return
	}

	// Calculate discounts and include promotions
	if h.promotionRepo != nil {
		h.repo.CalculateProductDiscounts(ctx, product, h.promotionRepo)
	}

	// Fetch brand if present
	var brand *models.Brand
	if product.BrandID != nil {
		brand, _ = h.repo.GetBrand(ctx, *product.BrandID)
	}

	// Fetch category if present
	var category *models.Category
	if product.CategoryID != nil {
		category, _ = h.repo.GetCategory(ctx, *product.CategoryID)
	}

	// Fetch properties
	properties, _ := h.repo.GetProductProperties(ctx, product.ID)

	// Build response
	response := map[string]interface{}{
		"id":                        product.ID,
		"ultra_id":                  product.UltraID,
		"code":                      product.Code,
		"article":                   product.Article,
		"name":                      product.Name,
		"slug":                      product.Slug,
		"description":               product.Description,
		"brand_id":                  product.BrandID,
		"brand_name":                product.BrandName,
		"category_id":               product.CategoryID,
		"category_name":             product.CategoryName,
		"main_image_url":            product.MainImageURL,
		"images":                    product.Images,
		"warranty":                  product.Warranty,
		"barcodes":                  product.Barcodes,
		"price_mdl":                 product.PriceMDL,
		"price_eur":                 product.PriceEUR,
		"price_usd":                 product.PriceUSD,
		"total_stock":               product.TotalStock,
		"is_in_stock":               product.IsInStock,
		"is_active":                 product.IsActive,
		"name_ru":                   product.NameRU,
		"name_ro":                   product.NameRO,
		"description_ru":            product.DescriptionRU,
		"description_ro":            product.DescriptionRO,
		"manual_discount_percent":   product.ManualDiscountPercent,
		"effective_discount_percent": product.EffectiveDiscountPercent,
		"discounted_price_mdl":      product.DiscountedPriceMDL,
		"discounted_price_eur":      product.DiscountedPriceEUR,
		"discounted_price_usd":      product.DiscountedPriceUSD,
		"active_promotions":         product.ActivePromotions,
		"created_at":                product.CreatedAt,
		"updated_at":                product.UpdatedAt,
	}

	// Add brand details if present
	if brand != nil {
		response["brand"] = map[string]interface{}{
			"id":       brand.ID,
			"name":     brand.Name,
			"slug":     brand.Slug,
			"logo_url": brand.LogoURL,
		}
	}

	// Add category details if present
	if category != nil {
		response["category"] = map[string]interface{}{
			"id":        category.ID,
			"name":      category.Name,
			"slug":      category.Slug,
			"parent_id": category.ParentID,
			"name_ru":   category.NameRU,
			"name_ro":   category.NameRO,
		}
	}

	// Add properties
	response["properties"] = properties
	response["property_count"] = len(properties)

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": response,
	})
}

// ListProducts handles GET /api/v1/public/products
// Supports slug-based filtering for brand and category
func (h *PublicHandler) ListProducts(w http.ResponseWriter, r *http.Request) {
	limit, offset := parsePagination(r)

	filter := &repository.ProductFilter{
		StatusFilter: "active", // Public API always shows only active products
	}

	// Search filter
	if search := r.URL.Query().Get("search"); search != "" {
		filter.Search = search
	}

	// Brand filter - supports both UUID and slug
	if brandParam := r.URL.Query().Get("brand"); brandParam != "" {
		if isUUID(brandParam) {
			id, _ := uuid.Parse(brandParam)
			filter.BrandID = &id
		} else {
			filter.BrandSlug = brandParam
		}
	}
	// Also support brand_id for backward compatibility
	if brandIDStr := r.URL.Query().Get("brand_id"); brandIDStr != "" {
		if id, err := uuid.Parse(brandIDStr); err == nil {
			filter.BrandID = &id
		}
	}

	// Category filter - supports both UUID and slug
	if categoryParam := r.URL.Query().Get("category"); categoryParam != "" {
		if isUUID(categoryParam) {
			id, _ := uuid.Parse(categoryParam)
			filter.CategoryID = &id
		} else {
			filter.CategorySlug = categoryParam
		}
	}
	// Also support category_id for backward compatibility
	if categoryIDStr := r.URL.Query().Get("category_id"); categoryIDStr != "" {
		if id, err := uuid.Parse(categoryIDStr); err == nil {
			filter.CategoryID = &id
		}
	}

	// Price filters
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

	// Stock filter
	if inStockStr := r.URL.Query().Get("in_stock"); inStockStr == "true" {
		filter.StockFilter = "in_stock"
	}

	// Sort filter
	if sortBy := r.URL.Query().Get("sort_by"); sortBy != "" {
		filter.SortBy = sortBy
	}

	// Property filters - format: properties[PropertyName]=Value
	filter.Properties = parsePropertyFilters(r)

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	products, err := h.repo.ListProducts(ctx, filter, limit, offset)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch products", err.Error())
		return
	}

	// Calculate discounts for all products (batch operation - no N+1)
	if h.promotionRepo != nil && len(products) > 0 {
		h.repo.CalculateProductsDiscounts(ctx, products, h.promotionRepo)
	}

	total, _ := h.repo.CountProducts(ctx, filter)

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": products,
		"meta": map[string]interface{}{
			"total":  total,
			"limit":  limit,
			"offset": offset,
		},
	})
}

// ============================================================================
// BRANDS
// ============================================================================

// GetBrand handles GET /api/v1/public/brands/{identifier}
// Accepts both UUID and slug as identifier
func (h *PublicHandler) GetBrand(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	identifier := vars["identifier"]

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	var brand *models.Brand
	var err error

	if isUUID(identifier) {
		id, _ := uuid.Parse(identifier)
		brand, err = h.repo.GetBrand(ctx, id)
		// Verify brand is active for public API
		if brand != nil && !brand.IsActive {
			respondError(w, http.StatusNotFound, "Brand not found", "Brand is not available")
			return
		}
	} else {
		brand, err = h.repo.GetBrandBySlug(ctx, identifier)
	}

	if err != nil {
		respondError(w, http.StatusNotFound, "Brand not found", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": brand,
	})
}

// ListBrands handles GET /api/v1/public/brands
func (h *PublicHandler) ListBrands(w http.ResponseWriter, r *http.Request) {
	limit, offset := parsePagination(r)

	search := r.URL.Query().Get("search")
	hasProducts := r.URL.Query().Get("has_products")
	sortBy := r.URL.Query().Get("sort_by")

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	// Always filter to active brands only for public API
	brands, err := h.repo.ListBrandsWithSearch(ctx, search, hasProducts, "true", sortBy, limit, offset)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch brands", err.Error())
		return
	}

	total, _ := h.repo.CountBrandsWithSearch(ctx, search, hasProducts, "true")

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": brands,
		"meta": map[string]interface{}{
			"total":  total,
			"limit":  limit,
			"offset": offset,
		},
	})
}

// GetBrandProducts handles GET /api/v1/public/brands/{identifier}/products
func (h *PublicHandler) GetBrandProducts(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	identifier := vars["identifier"]

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	// Resolve identifier to brand
	var brandID *uuid.UUID
	if isUUID(identifier) {
		id, _ := uuid.Parse(identifier)
		// Verify brand exists and is active
		brand, err := h.repo.GetBrand(ctx, id)
		if err != nil || !brand.IsActive {
			respondError(w, http.StatusNotFound, "Brand not found", "Brand is not available")
			return
		}
		brandID = &id
	} else {
		id, err := h.repo.GetBrandIDBySlug(ctx, identifier)
		if err != nil {
			respondError(w, http.StatusNotFound, "Brand not found", "Brand is not available")
			return
		}
		brandID = id
	}

	limit, offset := parsePagination(r)

	filter := &repository.ProductFilter{
		BrandID:      brandID,
		StatusFilter: "active",
	}

	// Additional filters
	if search := r.URL.Query().Get("search"); search != "" {
		filter.Search = search
	}
	if inStockStr := r.URL.Query().Get("in_stock"); inStockStr == "true" {
		filter.StockFilter = "in_stock"
	}
	if sortBy := r.URL.Query().Get("sort_by"); sortBy != "" {
		filter.SortBy = sortBy
	}
	// Property filters
	filter.Properties = parsePropertyFilters(r)

	products, err := h.repo.ListProducts(ctx, filter, limit, offset)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch products", err.Error())
		return
	}

	// Calculate discounts for all products
	if h.promotionRepo != nil && len(products) > 0 {
		h.repo.CalculateProductsDiscounts(ctx, products, h.promotionRepo)
	}

	total, _ := h.repo.CountProducts(ctx, filter)

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": products,
		"meta": map[string]interface{}{
			"total":  total,
			"limit":  limit,
			"offset": offset,
		},
	})
}

// ============================================================================
// CATEGORIES
// ============================================================================

// GetCategory handles GET /api/v1/public/categories/{identifier}
// Accepts both UUID and slug as identifier
func (h *PublicHandler) GetCategory(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	identifier := vars["identifier"]

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	var category *models.Category
	var err error

	if isUUID(identifier) {
		id, _ := uuid.Parse(identifier)
		category, err = h.repo.GetCategory(ctx, id)
		// Verify category is active for public API
		if category != nil && !category.IsActive {
			respondError(w, http.StatusNotFound, "Category not found", "Category is not available")
			return
		}
	} else {
		category, err = h.repo.GetCategoryBySlug(ctx, identifier)
	}

	if err != nil {
		respondError(w, http.StatusNotFound, "Category not found", err.Error())
		return
	}

	// Also fetch subcategories
	subcategories, _ := h.repo.ListCategories(ctx, &category.ID, 100, 0)

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": map[string]interface{}{
			"id":            category.ID,
			"name":          category.Name,
			"slug":          category.Slug,
			"parent_id":     category.ParentID,
			"sort_order":    category.SortOrder,
			"image_url":     category.ImageURL,
			"product_count": category.ProductCount,
			"name_ru":       category.NameRU,
			"name_ro":       category.NameRO,
			"subcategories": subcategories,
		},
	})
}

// ListCategories handles GET /api/v1/public/categories
// Returns hierarchical category tree (root categories by default)
func (h *PublicHandler) ListCategories(w http.ResponseWriter, r *http.Request) {
	limit, offset := parsePagination(r)

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	// Check for parent_id filter
	var parentID *uuid.UUID
	if parentIDStr := r.URL.Query().Get("parent_id"); parentIDStr != "" {
		if id, err := uuid.Parse(parentIDStr); err == nil {
			parentID = &id
		}
	}

	categories, err := h.repo.ListCategories(ctx, parentID, limit, offset)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch categories", err.Error())
		return
	}

	total, _ := h.repo.CountCategories(ctx, parentID)

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": categories,
		"meta": map[string]interface{}{
			"total":  total,
			"limit":  limit,
			"offset": offset,
		},
	})
}

// GetCategoryProducts handles GET /api/v1/public/categories/{identifier}/products
func (h *PublicHandler) GetCategoryProducts(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	identifier := vars["identifier"]

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	// Resolve identifier to category
	var categoryID *uuid.UUID
	if isUUID(identifier) {
		id, _ := uuid.Parse(identifier)
		// Verify category exists and is active
		category, err := h.repo.GetCategory(ctx, id)
		if err != nil || !category.IsActive {
			respondError(w, http.StatusNotFound, "Category not found", "Category is not available")
			return
		}
		categoryID = &id
	} else {
		id, err := h.repo.GetCategoryIDBySlug(ctx, identifier)
		if err != nil {
			respondError(w, http.StatusNotFound, "Category not found", "Category is not available")
			return
		}
		categoryID = id
	}

	limit, offset := parsePagination(r)

	filter := &repository.ProductFilter{
		CategoryID:   categoryID,
		StatusFilter: "active",
	}

	// Additional filters
	if search := r.URL.Query().Get("search"); search != "" {
		filter.Search = search
	}
	if inStockStr := r.URL.Query().Get("in_stock"); inStockStr == "true" {
		filter.StockFilter = "in_stock"
	}
	if sortBy := r.URL.Query().Get("sort_by"); sortBy != "" {
		filter.SortBy = sortBy
	}
	// Brand filter for category products
	if brandParam := r.URL.Query().Get("brand"); brandParam != "" {
		if isUUID(brandParam) {
			id, _ := uuid.Parse(brandParam)
			filter.BrandID = &id
		} else {
			filter.BrandSlug = brandParam
		}
	}
	// Property filters
	filter.Properties = parsePropertyFilters(r)

	products, err := h.repo.ListProducts(ctx, filter, limit, offset)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch products", err.Error())
		return
	}

	// Calculate discounts for all products
	if h.promotionRepo != nil && len(products) > 0 {
		h.repo.CalculateProductsDiscounts(ctx, products, h.promotionRepo)
	}

	total, _ := h.repo.CountProducts(ctx, filter)

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": products,
		"meta": map[string]interface{}{
			"total":  total,
			"limit":  limit,
			"offset": offset,
		},
	})
}

// ============================================================================
// FILTERABLE PROPERTIES
// ============================================================================

// GetFilterableProperties handles GET /api/v1/public/properties/filters
// Returns properties that can be used for filtering with their possible values
func (h *PublicHandler) GetFilterableProperties(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	// Optional category filter (UUID or slug)
	var categoryID *uuid.UUID
	if categoryParam := r.URL.Query().Get("category"); categoryParam != "" {
		if isUUID(categoryParam) {
			id, _ := uuid.Parse(categoryParam)
			categoryID = &id
		} else {
			id, err := h.repo.GetCategoryIDBySlug(ctx, categoryParam)
			if err == nil {
				categoryID = id
			}
		}
	}

	filters, err := h.repo.GetFilterableProperties(ctx, categoryID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch filterable properties", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": filters,
		"meta": map[string]interface{}{
			"total": len(filters),
		},
	})
}

// parsePropertyFilters extracts property filters from query string
// Format: properties[PropertyName]=Value
func parsePropertyFilters(r *http.Request) map[string]string {
	properties := make(map[string]string)

	for key, values := range r.URL.Query() {
		if strings.HasPrefix(key, "properties[") && strings.HasSuffix(key, "]") {
			// Extract property name from properties[Name]
			propName := key[11 : len(key)-1]
			if propName != "" && len(values) > 0 && values[0] != "" {
				properties[propName] = values[0]
			}
		}
	}

	return properties
}

// ============================================================================
// SERVICE TYPES & PACKAGES
// ============================================================================

// ListServiceTypes handles GET /api/v1/public/service-types
// Returns all active service types
func (h *PublicHandler) ListServiceTypes(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	if h.serviceTypeRepo == nil {
		respondError(w, http.StatusServiceUnavailable, "Service types not available", "Service type repository not configured")
		return
	}

	limit, offset := parsePagination(r)
	search := r.URL.Query().Get("search")

	filters := &models.ServicePackageTypeFilters{
		Search:     search,
		ActiveOnly: true, // Public API only shows active types
	}

	types, err := h.serviceTypeRepo.List(ctx, filters, limit, offset)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch service types", err.Error())
		return
	}

	total, _ := h.serviceTypeRepo.Count(ctx, filters)

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": types,
		"meta": map[string]interface{}{
			"total":  total,
			"limit":  limit,
			"offset": offset,
		},
	})
}

// GetServiceType handles GET /api/v1/public/service-types/{identifier}
// Accepts both UUID and slug as identifier
func (h *PublicHandler) GetServiceType(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	identifier := vars["identifier"]

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	if h.serviceTypeRepo == nil {
		respondError(w, http.StatusServiceUnavailable, "Service types not available", "Service type repository not configured")
		return
	}

	var serviceType *models.ServicePackageType
	var err error

	if isUUID(identifier) {
		id, _ := uuid.Parse(identifier)
		serviceType, err = h.serviceTypeRepo.GetByID(ctx, id)
		// Check if active for public API
		if serviceType != nil && !serviceType.IsActive {
			respondError(w, http.StatusNotFound, "Service type not found", "Service type is not available")
			return
		}
	} else {
		serviceType, err = h.serviceTypeRepo.GetBySlug(ctx, identifier)
	}

	if err != nil {
		respondError(w, http.StatusNotFound, "Service type not found", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": serviceType,
	})
}

// ListPackagesByType handles GET /api/v1/public/service-types/{identifier}/packages
// Returns packages for a specific service type (by UUID or slug)
func (h *PublicHandler) ListPackagesByType(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	identifier := vars["identifier"]

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	if h.serviceTypeRepo == nil || h.servicePackageRepo == nil {
		respondError(w, http.StatusServiceUnavailable, "Service packages not available", "Service repositories not configured")
		return
	}

	// Resolve identifier to type ID
	var typeID *uuid.UUID
	if isUUID(identifier) {
		id, _ := uuid.Parse(identifier)
		// Verify type exists and is active
		serviceType, err := h.serviceTypeRepo.GetByID(ctx, id)
		if err != nil || !serviceType.IsActive {
			respondError(w, http.StatusNotFound, "Service type not found", "Service type is not available")
			return
		}
		typeID = &id
	} else {
		id, err := h.serviceTypeRepo.GetIDBySlug(ctx, identifier)
		if err != nil {
			respondError(w, http.StatusNotFound, "Service type not found", "Service type is not available")
			return
		}
		typeID = id
	}

	limit, offset := parsePagination(r)

	filters := &models.ServicePackageFilters{
		TypeID:     typeID,
		ActiveOnly: true, // Public API only shows active packages
	}

	packages, err := h.servicePackageRepo.List(ctx, filters, limit, offset)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch packages", err.Error())
		return
	}

	total, _ := h.servicePackageRepo.Count(ctx, filters)

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": packages,
		"meta": map[string]interface{}{
			"total":  total,
			"limit":  limit,
			"offset": offset,
		},
	})
}

// ListServicePackages handles GET /api/v1/public/service-packages
// Returns all active service packages
func (h *PublicHandler) ListServicePackages(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	if h.servicePackageRepo == nil {
		respondError(w, http.StatusServiceUnavailable, "Service packages not available", "Service package repository not configured")
		return
	}

	limit, offset := parsePagination(r)
	search := r.URL.Query().Get("search")

	// Optional type filter (by UUID or slug)
	var typeID *uuid.UUID
	if typeParam := r.URL.Query().Get("type"); typeParam != "" {
		if isUUID(typeParam) {
			id, _ := uuid.Parse(typeParam)
			typeID = &id
		} else if h.serviceTypeRepo != nil {
			id, err := h.serviceTypeRepo.GetIDBySlug(r.Context(), typeParam)
			if err == nil {
				typeID = id
			}
		}
	}

	filters := &models.ServicePackageFilters{
		TypeID:     typeID,
		Search:     search,
		ActiveOnly: true, // Public API only shows active packages
	}

	packages, err := h.servicePackageRepo.List(ctx, filters, limit, offset)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch service packages", err.Error())
		return
	}

	total, _ := h.servicePackageRepo.Count(ctx, filters)

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": packages,
		"meta": map[string]interface{}{
			"total":  total,
			"limit":  limit,
			"offset": offset,
		},
	})
}

// GetServicePackage handles GET /api/v1/public/service-packages/{id}
// Returns a single service package by ID
func (h *PublicHandler) GetServicePackage(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	idStr := vars["id"]

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	if h.servicePackageRepo == nil {
		respondError(w, http.StatusServiceUnavailable, "Service packages not available", "Service package repository not configured")
		return
	}

	id, err := uuid.Parse(idStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid package ID", "Package ID must be a valid UUID")
		return
	}

	pkg, err := h.servicePackageRepo.GetByID(ctx, id)
	if err != nil {
		respondError(w, http.StatusNotFound, "Service package not found", err.Error())
		return
	}

	// Check if active for public API
	if !pkg.IsActive {
		respondError(w, http.StatusNotFound, "Service package not found", "Service package is not available")
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": pkg,
	})
}
