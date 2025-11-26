package repository

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"ultra-api-testing/internal/constants"
	"ultra-api-testing/internal/models"
	"ultra-api-testing/internal/ultra"
)

// ComparisonRepository handles sync comparison operations
type ComparisonRepository struct {
	repo    *Repository
	fetcher *ultra.Fetcher
}

// NewComparisonRepository creates a new comparison repository
func NewComparisonRepository(repo *Repository, fetcher *ultra.Fetcher) *ComparisonRepository {
	return &ComparisonRepository{
		repo:    repo,
		fetcher: fetcher,
	}
}

// ============================================================================
// COMPARISON OPERATIONS
// ============================================================================

// CompareSync compares local database with remote Ultra API data
func (r *ComparisonRepository) CompareSync(ctx context.Context, request *models.ComparisonRequest) ([]*models.SyncComparison, error) {
	if len(request.SelectedSteps) == 0 {
		return nil, fmt.Errorf("no steps selected for comparison")
	}

	comparisons := make([]*models.SyncComparison, 0)

	for _, step := range request.SelectedSteps {
		log.Printf("Comparing step: %s", step)

		comparison, err := r.compareStep(ctx, step, request)
		if err != nil {
			log.Printf("Error comparing step %s: %v", step, err)
			comparison = &models.SyncComparison{
				ID:          uuid.New(),
				Step:        step,
				ComparedAt:  time.Now(),
				DiffDetails: make([]models.EntityDiff, 0),
			}
		}

		comparisons = append(comparisons, comparison)
	}

	return comparisons, nil
}

// compareStep compares a single sync step
func (r *ComparisonRepository) compareStep(ctx context.Context, step models.SyncStep, request *models.ComparisonRequest) (*models.SyncComparison, error) {
	comparison := &models.SyncComparison{
		ID:          uuid.New(),
		Step:        step,
		ComparedAt:  time.Now(),
		DiffDetails: make([]models.EntityDiff, 0),
	}

	switch step {
	case models.SyncStepBrands:
		return r.compareBrands(ctx, comparison, request)
	case models.SyncStepCategories:
		return r.compareCategories(ctx, comparison, request)
	case models.SyncStepProducts:
		return r.compareProducts(ctx, comparison, request)
	case models.SyncStepPrices:
		return r.comparePrices(ctx, comparison, request)
	case models.SyncStepStock:
		return r.compareStock(ctx, comparison, request)
	default:
		return comparison, fmt.Errorf("unsupported step for comparison: %s", step)
	}
}

// compareBrands compares brands between local and remote
func (r *ComparisonRepository) compareBrands(ctx context.Context, comparison *models.SyncComparison, request *models.ComparisonRequest) (*models.SyncComparison, error) {
	// Fetch local brands
	localBrands, err := r.repo.GetAllBrands(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch local brands: %w", err)
	}

	// Fetch remote brands
	remoteBrands, err := r.fetcher.FetchBrands(ctx, true)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch remote brands: %w", err)
	}

	comparison.TotalLocal = len(localBrands)
	comparison.TotalRemote = len(remoteBrands)

	// Create maps for efficient lookup
	localMap := make(map[string]*models.Brand)
	for _, brand := range localBrands {
		localMap[brand.UltraID] = brand
	}

	remoteMap := make(map[string]*models.BrandInput)
	for _, brand := range remoteBrands {
		remoteMap[brand.UltraID] = brand
	}

	// Get field config
	fieldConfig := models.FieldConfig{}
	if request.FieldConfig != nil {
		if config, ok := request.FieldConfig[models.SyncStepBrands]; ok {
			fieldConfig = config
		}
	}

	// Compare entities
	for ultraID, remoteBrand := range remoteMap {
		localBrand, exists := localMap[ultraID]

		if !exists {
			// New brand to insert
			comparison.ToInsert++

			if request.IncludeDetails && len(comparison.DiffDetails) < getDetailLimit(request) {
				comparison.DiffDetails = append(comparison.DiffDetails, models.EntityDiff{
					EntityType:    "brand",
					EntityUltraID: ultraID,
					DiffType:      "insert",
					RemoteData:    brandInputToMap(remoteBrand),
				})
			}
		} else {
			// Compare existing brand
			diffs := r.compareBrandFields(localBrand, remoteBrand, fieldConfig)

			if len(diffs) > 0 {
				comparison.ToUpdate++

				if request.IncludeDetails && len(comparison.DiffDetails) < getDetailLimit(request) {
					entityID := localBrand.ID
					comparison.DiffDetails = append(comparison.DiffDetails, models.EntityDiff{
						EntityType:    "brand",
						EntityID:      &entityID,
						EntityUltraID: ultraID,
						DiffType:      "update",
						FieldDiffs:    diffs,
						LocalData:     brandToMap(localBrand),
						RemoteData:    brandInputToMap(remoteBrand),
					})
				}
			} else {
				comparison.Unchanged++
			}
		}
	}

	return comparison, nil
}

// compareCategories compares categories between local and remote
func (r *ComparisonRepository) compareCategories(ctx context.Context, comparison *models.SyncComparison, request *models.ComparisonRequest) (*models.SyncComparison, error) {
	// Fetch local categories
	localCategories, err := r.repo.GetAllCategories(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch local categories: %w", err)
	}

	// Fetch remote categories
	remoteCategories, err := r.fetcher.FetchCategories(ctx, true)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch remote categories: %w", err)
	}

	comparison.TotalLocal = len(localCategories)
	comparison.TotalRemote = len(remoteCategories)

	// Create maps for efficient lookup
	localMap := make(map[string]*models.Category)
	for _, category := range localCategories {
		localMap[category.UltraID] = category
	}

	remoteMap := make(map[string]*models.CategoryInput)
	for _, category := range remoteCategories {
		remoteMap[category.UltraID] = category
	}

	// Get field config
	fieldConfig := models.FieldConfig{}
	if request.FieldConfig != nil {
		if config, ok := request.FieldConfig[models.SyncStepCategories]; ok {
			fieldConfig = config
		}
	}

	// Compare entities
	for ultraID, remoteCategory := range remoteMap {
		localCategory, exists := localMap[ultraID]

		if !exists {
			comparison.ToInsert++

			if request.IncludeDetails && len(comparison.DiffDetails) < getDetailLimit(request) {
				comparison.DiffDetails = append(comparison.DiffDetails, models.EntityDiff{
					EntityType:    "category",
					EntityUltraID: ultraID,
					DiffType:      "insert",
					RemoteData:    categoryInputToMap(remoteCategory),
				})
			}
		} else {
			diffs := r.compareCategoryFields(localCategory, remoteCategory, fieldConfig)

			if len(diffs) > 0 {
				comparison.ToUpdate++

				if request.IncludeDetails && len(comparison.DiffDetails) < getDetailLimit(request) {
					entityID := localCategory.ID
					comparison.DiffDetails = append(comparison.DiffDetails, models.EntityDiff{
						EntityType:    "category",
						EntityID:      &entityID,
						EntityUltraID: ultraID,
						DiffType:      "update",
						FieldDiffs:    diffs,
						LocalData:     categoryToMap(localCategory),
						RemoteData:    categoryInputToMap(remoteCategory),
					})
				}
			} else {
				comparison.Unchanged++
			}
		}
	}

	return comparison, nil
}

// compareProducts compares products between local and remote
func (r *ComparisonRepository) compareProducts(ctx context.Context, comparison *models.SyncComparison, request *models.ComparisonRequest) (*models.SyncComparison, error) {
	// Note: For large datasets, this should be paginated or processed in batches
	// For now, we'll implement a simplified version

	// Fetch remote products
	remoteProducts, _, err := r.fetcher.FetchProducts(ctx, true)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch remote products: %w", err)
	}

	comparison.TotalRemote = len(remoteProducts)

	// Get local product count
	countQuery := "SELECT COUNT(*) FROM products"
	err = r.repo.Pool().QueryRow(ctx, countQuery).Scan(&comparison.TotalLocal)
	if err != nil {
		return nil, fmt.Errorf("failed to count local products: %w", err)
	}

	// For products, we'll compare a sample or use a more efficient approach
	// Sample first N products for comparison (configurable)
	sampleSize := constants.ComparisonSampleSize
	if len(remoteProducts) < sampleSize {
		sampleSize = len(remoteProducts)
	}

	// Get field config
	fieldConfig := models.FieldConfig{}
	if request.FieldConfig != nil {
		if config, ok := request.FieldConfig[models.SyncStepProducts]; ok {
			fieldConfig = config
		}
	}

	// Batch fetch all local products to prevent N+1 query problem
	ultraIDs := make([]string, sampleSize)
	for i := 0; i < sampleSize; i++ {
		ultraIDs[i] = remoteProducts[i].UltraID
	}

	localProducts, err := r.repo.GetProductsByUltraIDs(ctx, ultraIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch local products: %w", err)
	}

	// Create map for O(1) lookup by UltraID
	localMap := make(map[string]*models.Product)
	for i := range localProducts {
		localMap[localProducts[i].UltraID] = &localProducts[i]
	}

	// Compare using map lookup (single query instead of N queries)
	for i := 0; i < sampleSize; i++ {
		remoteProduct := remoteProducts[i]
		localProduct, exists := localMap[remoteProduct.UltraID]

		if !exists {
			comparison.ToInsert++

			if request.IncludeDetails && len(comparison.DiffDetails) < getDetailLimit(request) {
				comparison.DiffDetails = append(comparison.DiffDetails, models.EntityDiff{
					EntityType:    "product",
					EntityUltraID: remoteProduct.UltraID,
					DiffType:      "insert",
					RemoteData:    productInputToMap(remoteProduct),
				})
			}
		} else {
			diffs := r.compareProductFields(localProduct, remoteProduct, fieldConfig)

			if len(diffs) > 0 {
				comparison.ToUpdate++

				if request.IncludeDetails && len(comparison.DiffDetails) < getDetailLimit(request) {
					entityID := localProduct.ID
					comparison.DiffDetails = append(comparison.DiffDetails, models.EntityDiff{
						EntityType:    "product",
						EntityID:      &entityID,
						EntityUltraID: remoteProduct.UltraID,
						DiffType:      "update",
						FieldDiffs:    diffs,
						LocalData:     productToMap(localProduct),
						RemoteData:    productInputToMap(remoteProduct),
					})
				}
			} else {
				comparison.Unchanged++
			}
		}
	}

	// Add estimation metadata if sample was used (don't overwrite actual counts)
	if sampleSize < len(remoteProducts) {
		// Calculate estimated totals but store separately in metadata
		updateRatio := float64(comparison.ToUpdate) / float64(sampleSize)
		insertRatio := float64(comparison.ToInsert) / float64(sampleSize)
		unchangedRatio := float64(comparison.Unchanged) / float64(sampleSize)

		estimatedUpdates := int(updateRatio * float64(len(remoteProducts)))
		estimatedInserts := int(insertRatio * float64(len(remoteProducts)))
		estimatedUnchanged := int(unchangedRatio * float64(len(remoteProducts)))

		// Store estimation details in metadata instead of overwriting
		if comparison.DiffDetails == nil {
			comparison.DiffDetails = make([]models.EntityDiff, 0)
		}

		// Add estimation notice as first diff detail
		comparison.DiffDetails = append([]models.EntityDiff{{
			EntityType: "estimation_note",
			DiffType:   "unchanged",
			RemoteData: map[string]interface{}{
				"note":                fmt.Sprintf("Sampled %d of %d products", sampleSize, len(remoteProducts)),
				"sampled_to_update":   comparison.ToUpdate,
				"sampled_to_insert":   comparison.ToInsert,
				"sampled_unchanged":   comparison.Unchanged,
				"estimated_to_update": estimatedUpdates,
				"estimated_to_insert": estimatedInserts,
				"estimated_unchanged": estimatedUnchanged,
			},
		}}, comparison.DiffDetails...)
	}

	return comparison, nil
}

// comparePrices compares prices (simplified - checks characteristics)
func (r *ComparisonRepository) comparePrices(ctx context.Context, comparison *models.SyncComparison, request *models.ComparisonRequest) (*models.SyncComparison, error) {
	// Fetch remote prices
	remotePrices, err := r.fetcher.FetchPrices(ctx, true)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch remote prices: %w", err)
	}

	comparison.TotalRemote = len(remotePrices)

	// Get local characteristics count
	countQuery := "SELECT COUNT(*) FROM characteristics WHERE prices IS NOT NULL"
	err = r.repo.Pool().QueryRow(ctx, countQuery).Scan(&comparison.TotalLocal)
	if err != nil {
		return nil, fmt.Errorf("failed to count local prices: %w", err)
	}

	// Estimate updates (simplified - assume all remote prices will update)
	comparison.ToUpdate = len(remotePrices)

	return comparison, nil
}

// compareStock compares stock levels
func (r *ComparisonRepository) compareStock(ctx context.Context, comparison *models.SyncComparison, request *models.ComparisonRequest) (*models.SyncComparison, error) {
	// Fetch remote stock
	remoteStock, err := r.fetcher.FetchStock(ctx, true)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch remote stock: %w", err)
	}

	comparison.TotalRemote = len(remoteStock)

	// Get local characteristics count
	countQuery := "SELECT COUNT(*) FROM characteristics WHERE stock_quantity IS NOT NULL"
	err = r.repo.Pool().QueryRow(ctx, countQuery).Scan(&comparison.TotalLocal)
	if err != nil {
		return nil, fmt.Errorf("failed to count local stock: %w", err)
	}

	// Estimate updates
	comparison.ToUpdate = len(remoteStock)

	return comparison, nil
}

// ============================================================================
// FIELD COMPARISON HELPERS
// ============================================================================

// compareBrandFields compares fields between local and remote brand
func (r *ComparisonRepository) compareBrandFields(local *models.Brand, remote *models.BrandInput, config models.FieldConfig) []models.FieldDiff {
	diffs := make([]models.FieldDiff, 0)

	if shouldCompareField("name", config) && local.Name != remote.Name {
		diffs = append(diffs, models.FieldDiff{
			FieldName:   "name",
			LocalValue:  local.Name,
			RemoteValue: remote.Name,
			DiffType:    "modified",
		})
	}

	if shouldCompareField("logo_url", config) {
		localLogo := ""
		if local.LogoURL != nil {
			localLogo = *local.LogoURL
		}
		remoteLogo := ""
		if remote.LogoURL != nil {
			remoteLogo = *remote.LogoURL
		}

		if localLogo != remoteLogo {
			diffs = append(diffs, models.FieldDiff{
				FieldName:   "logo_url",
				LocalValue:  localLogo,
				RemoteValue: remoteLogo,
				DiffType:    "modified",
			})
		}
	}

	if shouldCompareField("is_active", config) && local.IsActive != remote.IsActive {
		diffs = append(diffs, models.FieldDiff{
			FieldName:   "is_active",
			LocalValue:  local.IsActive,
			RemoteValue: remote.IsActive,
			DiffType:    "modified",
		})
	}

	return diffs
}

// compareCategoryFields compares fields between local and remote category
func (r *ComparisonRepository) compareCategoryFields(local *models.Category, remote *models.CategoryInput, config models.FieldConfig) []models.FieldDiff {
	diffs := make([]models.FieldDiff, 0)

	if shouldCompareField("name", config) && local.Name != remote.Name {
		diffs = append(diffs, models.FieldDiff{
			FieldName:   "name",
			LocalValue:  local.Name,
			RemoteValue: remote.Name,
			DiffType:    "modified",
		})
	}

	if shouldCompareField("sort_order", config) && local.SortOrder != remote.SortOrder {
		diffs = append(diffs, models.FieldDiff{
			FieldName:   "sort_order",
			LocalValue:  local.SortOrder,
			RemoteValue: remote.SortOrder,
			DiffType:    "modified",
		})
	}

	if shouldCompareField("is_active", config) && local.IsActive != remote.IsActive {
		diffs = append(diffs, models.FieldDiff{
			FieldName:   "is_active",
			LocalValue:  local.IsActive,
			RemoteValue: remote.IsActive,
			DiffType:    "modified",
		})
	}

	return diffs
}

// compareProductFields compares fields between local and remote product
func (r *ComparisonRepository) compareProductFields(local *models.Product, remote *models.ProductInput, config models.FieldConfig) []models.FieldDiff {
	diffs := make([]models.FieldDiff, 0)

	if shouldCompareField("name", config) && local.Name != remote.Name {
		diffs = append(diffs, models.FieldDiff{
			FieldName:   "name",
			LocalValue:  local.Name,
			RemoteValue: remote.Name,
			DiffType:    "modified",
		})
	}

	if shouldCompareField("description", config) {
		localDesc := ""
		if local.Description != nil {
			localDesc = *local.Description
		}
		remoteDesc := ""
		if remote.Description != nil {
			remoteDesc = *remote.Description
		}

		if localDesc != remoteDesc {
			diffs = append(diffs, models.FieldDiff{
				FieldName:   "description",
				LocalValue:  localDesc,
				RemoteValue: remoteDesc,
				DiffType:    "modified",
			})
		}
	}

	if shouldCompareField("is_active", config) && local.IsActive != remote.IsActive {
		diffs = append(diffs, models.FieldDiff{
			FieldName:   "is_active",
			LocalValue:  local.IsActive,
			RemoteValue: remote.IsActive,
			DiffType:    "modified",
		})
	}

	return diffs
}

// shouldCompareField checks if a field should be compared based on config
func shouldCompareField(fieldName string, config models.FieldConfig) bool {
	// If include fields is specified, only compare those fields
	if len(config.IncludeFields) > 0 {
		for _, f := range config.IncludeFields {
			if f == fieldName {
				return true
			}
		}
		return false
	}

	// If exclude fields is specified, compare all except those
	for _, f := range config.ExcludeFields {
		if f == fieldName {
			return false
		}
	}

	return true
}

// getDetailLimit gets the detail limit from request
func getDetailLimit(request *models.ComparisonRequest) int {
	if request.DetailLimit > 0 {
		if request.DetailLimit > constants.MaxDetailLimit {
			return constants.MaxDetailLimit
		}
		return request.DetailLimit
	}
	return constants.DefaultDetailLimit
}

// ============================================================================
// CONVERSION HELPERS
// ============================================================================

func brandToMap(brand *models.Brand) map[string]interface{} {
	return map[string]interface{}{
		"id":        brand.ID,
		"ultra_id":  brand.UltraID,
		"name":      brand.Name,
		"logo_url":  brand.LogoURL,
		"is_active": brand.IsActive,
	}
}

func brandInputToMap(brand *models.BrandInput) map[string]interface{} {
	return map[string]interface{}{
		"ultra_id":  brand.UltraID,
		"name":      brand.Name,
		"logo_url":  brand.LogoURL,
		"is_active": brand.IsActive,
	}
}

func categoryToMap(category *models.Category) map[string]interface{} {
	return map[string]interface{}{
		"id":         category.ID,
		"ultra_id":   category.UltraID,
		"name":       category.Name,
		"parent_id":  category.ParentID,
		"sort_order": category.SortOrder,
		"image_url":  category.ImageURL,
		"is_active":  category.IsActive,
	}
}

func categoryInputToMap(category *models.CategoryInput) map[string]interface{} {
	return map[string]interface{}{
		"ultra_id":        category.UltraID,
		"name":            category.Name,
		"parent_ultra_id": category.ParentUltraID,
		"sort_order":      category.SortOrder,
		"image_url":       category.ImageURL,
		"is_active":       category.IsActive,
	}
}

func productToMap(product *models.Product) map[string]interface{} {
	if product == nil {
		return make(map[string]interface{})
	}

	return map[string]interface{}{
		"id":             product.ID,
		"ultra_id":       product.UltraID,
		"name":           product.Name,
		"code":           product.Code,
		"article":        product.Article,
		"description":    product.Description,
		"brand_id":       product.BrandID,
		"category_id":    product.CategoryID,
		"parent_id":      product.ParentID,
		"main_image_url": product.MainImageURL,
		"is_active":      product.IsActive,
		"is_service":     product.IsService,
	}
}

func productInputToMap(product *models.ProductInput) map[string]interface{} {
	return map[string]interface{}{
		"ultra_id":          product.UltraID,
		"name":              product.Name,
		"code":              product.Code,
		"article":           product.Article,
		"description":       product.Description,
		"brand_id":          product.BrandID,
		"category_id":       product.CategoryID,
		"parent_id":         product.ParentID,
		"brand_ultra_id":    product.BrandUltraID,    // Temporary field for comparison
		"category_ultra_id": product.CategoryUltraID, // Temporary field for comparison
		"parent_ultra_id":   product.ParentUltraID,   // Temporary field for comparison
		"main_image_url":    product.MainImageURL,
		"is_active":         product.IsActive,
		"is_service":        product.IsService,
	}
}
