package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/gosimple/slug"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"ultra-api-testing/internal/models"
)

// ============================================================================
// REQUEST TYPES FOR CRUD OPERATIONS
// ============================================================================

// CreateProductRequest represents the request body for creating a product
type CreateProductRequest struct {
	Name        string     `json:"name"`
	Code        *string    `json:"code"`
	Article     *string    `json:"article"`
	Description *string    `json:"description"`
	BrandID     *uuid.UUID `json:"brand_id"`
	CategoryID  *uuid.UUID `json:"category_id"`
	IsActive    bool       `json:"is_active"`
	IsService   bool       `json:"is_service"`
}

// UpdateProductRequest represents the request body for updating a product
type UpdateProductRequest struct {
	Name        *string    `json:"name"`
	Code        *string    `json:"code"`
	Article     *string    `json:"article"`
	Description *string    `json:"description"`
	BrandID     *uuid.UUID `json:"brand_id"`
	CategoryID  *uuid.UUID `json:"category_id"`
	IsActive    *bool      `json:"is_active"`
	IsService   *bool      `json:"is_service"`
}

// CreateBrandRequest represents the request body for creating a brand
type CreateBrandRequest struct {
	Name     string  `json:"name"`
	Code     *string `json:"code"`
	LogoURL  *string `json:"logo_url"`
	IsActive bool    `json:"is_active"`
}

// UpdateBrandRequest represents the request body for updating a brand
type UpdateBrandRequest struct {
	Name     *string `json:"name"`
	Code     *string `json:"code"`
	LogoURL  *string `json:"logo_url"`
	IsActive *bool   `json:"is_active"`
}

// CreateCategoryRequest represents the request body for creating a category
type CreateCategoryRequest struct {
	Name         string     `json:"name"`
	Code         *string    `json:"code"`
	ParentID     *uuid.UUID `json:"parent_id"`
	SortOrder    int        `json:"sort_order"`
	ImageURL     *string    `json:"image_url"`
	ProductCount int        `json:"product_count"`
	IsActive     bool       `json:"is_active"`
}

// UpdateCategoryRequest represents the request body for updating a category
type UpdateCategoryRequest struct {
	Name         *string    `json:"name"`
	Code         *string    `json:"code"`
	ParentID     *uuid.UUID `json:"parent_id"`
	SortOrder    *int       `json:"sort_order"`
	ImageURL     *string    `json:"image_url"`
	ProductCount *int       `json:"product_count"`
	IsActive     *bool      `json:"is_active"`
}

type Repository struct {
	pool *pgxpool.Pool
}

func New(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

// Pool returns the underlying connection pool
func (r *Repository) Pool() *pgxpool.Pool {
	return r.pool
}

// ============================================================================
// BRANDS
// ============================================================================

func (r *Repository) UpsertBrands(ctx context.Context, brands []*models.BrandInput) (int, error) {
	if len(brands) == 0 {
		return 0, nil
	}

	query := `
		INSERT INTO brands (
			ultra_id, code, name, slug, logo_url, is_active
		) VALUES (
			$1, $2, $3, $4, $5, $6
		)
		ON CONFLICT (ultra_id) DO UPDATE SET
			code = EXCLUDED.code,
			name = EXCLUDED.name,
			slug = EXCLUDED.slug,
			logo_url = EXCLUDED.logo_url,
			is_active = EXCLUDED.is_active,
			updated_at = NOW()
	`

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	count := 0
	slugCounts := make(map[string]int)

	for _, brand := range brands {
		brandSlug := slug.Make(brand.Name)
		if brandSlug == "" {
			brandSlug = "brand"
		}

		// Handle duplicate slugs by appending counter
		if cnt, exists := slugCounts[brandSlug]; exists {
			slugCounts[brandSlug] = cnt + 1
			brandSlug = fmt.Sprintf("%s-%d", brandSlug, cnt+1)
		} else {
			slugCounts[brandSlug] = 1
		}

		_, err := tx.Exec(ctx, query,
			brand.UltraID,
			brand.Code,
			brand.Name,
			brandSlug,
			brand.LogoURL,
			brand.IsActive,
		)
		if err != nil {
			return count, fmt.Errorf("insert brand %s: %w", brand.UltraID, err)
		}
		count++
	}

	if err := tx.Commit(ctx); err != nil {
		return count, fmt.Errorf("commit transaction: %w", err)
	}

	return count, nil
}

func (r *Repository) GetBrand(ctx context.Context, id uuid.UUID) (*models.Brand, error) {
	query := `
		SELECT id, ultra_id, code, name, slug, logo_url, is_active, created_at, updated_at
		FROM brands
		WHERE id = $1
	`

	var brand models.Brand
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&brand.ID, &brand.UltraID, &brand.Code, &brand.Name, &brand.Slug,
		&brand.LogoURL, &brand.IsActive, &brand.CreatedAt, &brand.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	return &brand, nil
}

func (r *Repository) GetBrandByUltraID(ctx context.Context, ultraID string) (*models.Brand, error) {
	query := `
		SELECT id, ultra_id, code, name, slug, logo_url, is_active, created_at, updated_at
		FROM brands
		WHERE ultra_id = $1
	`

	var brand models.Brand
	err := r.pool.QueryRow(ctx, query, ultraID).Scan(
		&brand.ID, &brand.UltraID, &brand.Code, &brand.Name, &brand.Slug,
		&brand.LogoURL, &brand.IsActive, &brand.CreatedAt, &brand.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	return &brand, nil
}

func (r *Repository) ListBrands(ctx context.Context, limit, offset int) ([]*models.Brand, error) {
	return r.ListBrandsWithSearch(ctx, "", "", "", "", limit, offset)
}

// BrandFilter holds filter options for brand queries
type BrandFilter struct {
	Search      string // Search by name
	HasProducts string // "true" = with products, "false" = no products, "" = all
	SortBy      string // "name_asc", "name_desc", "products_desc", "products_asc"
}

// ListBrandsWithSearch returns brands with optional search, hasProducts filter, isActive filter, and sorting
func (r *Repository) ListBrandsWithSearch(ctx context.Context, search string, hasProducts string, isActive string, sortBy string, limit, offset int) ([]*models.Brand, error) {
	// Build WHERE clause - start empty for admin view (show all by default)
	whereClauses := []string{}
	args := make([]interface{}, 0)
	argPos := 1

	// Apply is_active filter only if specified
	if isActive == "true" {
		whereClauses = append(whereClauses, "b.is_active = true")
	} else if isActive == "false" {
		whereClauses = append(whereClauses, "b.is_active = false")
	}
	// If isActive is "" or any other value, don't filter by active status

	if search != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("b.name ILIKE $%d", argPos))
		args = append(args, "%"+search+"%")
		argPos++
	}

	// Build HAVING clause for product count filter
	havingClause := ""
	if hasProducts == "true" {
		havingClause = "HAVING COUNT(p.id) > 0"
	} else if hasProducts == "false" {
		havingClause = "HAVING COUNT(p.id) = 0"
	}

	// Build ORDER BY clause using allowlist map for security
	brandSortOptions := map[string]string{
		"name_asc":      "b.name ASC",
		"name_desc":     "b.name DESC",
		"products_desc": "product_count DESC, b.name ASC",
		"products_asc":  "product_count ASC, b.name ASC",
	}
	orderBy := brandSortOptions["name_asc"] // default
	if sortSQL, ok := brandSortOptions[sortBy]; ok {
		orderBy = sortSQL
	}

	// Add limit and offset to args
	args = append(args, limit, offset)

	// Build WHERE clause string
	whereClause := "TRUE" // Default to no filtering
	if len(whereClauses) > 0 {
		whereClause = strings.Join(whereClauses, " AND ")
	}

	query := fmt.Sprintf(`
		SELECT b.id, b.ultra_id, b.code, b.name, b.slug, b.logo_url, b.is_active,
			   COALESCE(COUNT(p.id), 0) as product_count, b.created_at, b.updated_at
		FROM brands b
		LEFT JOIN products p ON p.brand_id = b.id AND p.is_active = true
		WHERE %s
		GROUP BY b.id
		%s
		ORDER BY %s
		LIMIT $%d OFFSET $%d
	`, whereClause, havingClause, orderBy, argPos, argPos+1)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	brands := make([]*models.Brand, 0)
	for rows.Next() {
		var brand models.Brand
		err := rows.Scan(
			&brand.ID, &brand.UltraID, &brand.Code, &brand.Name, &brand.Slug,
			&brand.LogoURL, &brand.IsActive, &brand.ProductCount, &brand.CreatedAt, &brand.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		brands = append(brands, &brand)
	}

	return brands, nil
}

// CountBrands returns the total count of all brands
func (r *Repository) CountBrands(ctx context.Context) (int, error) {
	return r.CountBrandsWithSearch(ctx, "", "", "")
}

// CountBrandsWithSearch returns the total count of brands with optional search, hasProducts, and isActive filters
func (r *Repository) CountBrandsWithSearch(ctx context.Context, search string, hasProducts string, isActive string) (int, error) {
	// Build WHERE clause - start empty for admin view (show all by default)
	whereClauses := []string{}
	args := make([]interface{}, 0)
	argPos := 1

	// Apply is_active filter only if specified
	if isActive == "true" {
		whereClauses = append(whereClauses, "b.is_active = true")
	} else if isActive == "false" {
		whereClauses = append(whereClauses, "b.is_active = false")
	}
	// If isActive is "" or any other value, don't filter by active status

	if search != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("b.name ILIKE $%d", argPos))
		args = append(args, "%"+search+"%")
		argPos++
	}

	// Build HAVING clause for product count filter
	havingClause := ""
	if hasProducts == "true" {
		havingClause = "HAVING COUNT(p.id) > 0"
	} else if hasProducts == "false" {
		havingClause = "HAVING COUNT(p.id) = 0"
	}

	// Build WHERE clause string
	whereClause := "TRUE" // Default to no filtering
	if len(whereClauses) > 0 {
		whereClause = strings.Join(whereClauses, " AND ")
	}

	query := fmt.Sprintf(`
		SELECT COUNT(*) FROM (
			SELECT b.id
			FROM brands b
			LEFT JOIN products p ON p.brand_id = b.id AND p.is_active = true
			WHERE %s
			GROUP BY b.id
			%s
		) AS filtered_brands
	`, whereClause, havingClause)

	var count int
	err := r.pool.QueryRow(ctx, query, args...).Scan(&count)
	return count, err
}

// GetAllBrands returns all brands without pagination (for dropdown filters)
func (r *Repository) GetAllBrands(ctx context.Context) ([]*models.Brand, error) {
	query := `
		SELECT b.id, b.ultra_id, b.code, b.name, b.slug, b.logo_url, b.is_active,
			   COALESCE(COUNT(p.id), 0) as product_count, b.created_at, b.updated_at
		FROM brands b
		LEFT JOIN products p ON p.brand_id = b.id AND p.is_active = true
		GROUP BY b.id
		ORDER BY b.name ASC
	`

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	brands := make([]*models.Brand, 0)
	for rows.Next() {
		var brand models.Brand
		err := rows.Scan(
			&brand.ID, &brand.UltraID, &brand.Code, &brand.Name, &brand.Slug,
			&brand.LogoURL, &brand.IsActive, &brand.ProductCount, &brand.CreatedAt, &brand.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		brands = append(brands, &brand)
	}

	return brands, nil
}

// BulkUpdateBrandsByFilter updates all brands matching the given filter criteria
// isActiveFilter is the filter for current status ("true", "false", or "" for all)
// isActive is the new value to set
func (r *Repository) BulkUpdateBrandsByFilter(ctx context.Context, search string, hasProducts string, isActiveFilter string, isActive bool) (int, error) {
	// Build WHERE clause for the subquery - start empty for admin view (show all by default)
	whereClauses := []string{}
	args := make([]interface{}, 0)
	argPos := 1

	// First arg is the isActive value (new value to set)
	args = append(args, isActive)
	argPos++

	// Apply is_active filter only if specified
	if isActiveFilter == "true" {
		whereClauses = append(whereClauses, "b.is_active = true")
	} else if isActiveFilter == "false" {
		whereClauses = append(whereClauses, "b.is_active = false")
	}
	// If isActiveFilter is "" or any other value, don't filter by active status

	if search != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("b.name ILIKE $%d", argPos))
		args = append(args, "%"+search+"%")
		argPos++
	}

	// Build HAVING clause for product count filter
	havingClause := ""
	if hasProducts == "true" {
		havingClause = "HAVING COUNT(p.id) > 0"
	} else if hasProducts == "false" {
		havingClause = "HAVING COUNT(p.id) = 0"
	}

	// Build WHERE clause string
	whereClause := "TRUE" // Default to no filtering
	if len(whereClauses) > 0 {
		whereClause = strings.Join(whereClauses, " AND ")
	}

	query := fmt.Sprintf(`
		UPDATE brands
		SET is_active = $1, updated_at = NOW()
		WHERE id IN (
			SELECT b.id
			FROM brands b
			LEFT JOIN products p ON p.brand_id = b.id AND p.is_active = true
			WHERE %s
			GROUP BY b.id
			%s
		)
	`, whereClause, havingClause)

	result, err := r.pool.Exec(ctx, query, args...)
	if err != nil {
		return 0, fmt.Errorf("bulk update brands by filter: %w", err)
	}

	return int(result.RowsAffected()), nil
}

// ============================================================================
// CATEGORIES
// ============================================================================

func (r *Repository) UpsertCategories(ctx context.Context, categories []*models.CategoryInput) (int, error) {
	if len(categories) == 0 {
		return 0, nil
	}

	query := `
		INSERT INTO categories (
			ultra_id, code, parent_ultra_id, name, slug, sort_order, image_url, product_count, is_active
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9
		)
		ON CONFLICT (ultra_id) DO UPDATE SET
			code = EXCLUDED.code,
			parent_ultra_id = EXCLUDED.parent_ultra_id,
			name = EXCLUDED.name,
			slug = EXCLUDED.slug,
			sort_order = EXCLUDED.sort_order,
			image_url = EXCLUDED.image_url,
			product_count = EXCLUDED.product_count,
			is_active = EXCLUDED.is_active,
			updated_at = NOW()
	`

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	count := 0
	slugCounts := make(map[string]int)

	for _, category := range categories {
		categorySlug := slug.Make(category.Name)
		if categorySlug == "" {
			categorySlug = "category"
		}

		// Handle duplicate slugs by appending counter
		if cnt, exists := slugCounts[categorySlug]; exists {
			slugCounts[categorySlug] = cnt + 1
			categorySlug = fmt.Sprintf("%s-%d", categorySlug, cnt+1)
		} else {
			slugCounts[categorySlug] = 1
		}

		_, err := tx.Exec(ctx, query,
			category.UltraID,
			category.Code,
			category.ParentUltraID,
			category.Name,
			categorySlug,
			category.SortOrder,
			category.ImageURL,
			category.ProductCount,
			category.IsActive,
		)
		if err != nil {
			return count, fmt.Errorf("insert category %s: %w", category.UltraID, err)
		}
		count++
	}

	if err := tx.Commit(ctx); err != nil {
		return count, fmt.Errorf("commit transaction: %w", err)
	}

	return count, nil
}

// ResolveCategoryParents resolves parent_id foreign keys from parent_ultra_id
func (r *Repository) ResolveCategoryParents(ctx context.Context) error {
	query := `
		UPDATE categories c
		SET parent_id = p.id
		FROM categories p
		WHERE c.parent_ultra_id = p.ultra_id
		AND c.parent_id IS NULL
		AND c.parent_ultra_id IS NOT NULL
	`

	_, err := r.pool.Exec(ctx, query)
	return err
}

func (r *Repository) GetCategory(ctx context.Context, id uuid.UUID) (*models.Category, error) {
	query := `
		SELECT id, ultra_id, code, parent_id, parent_ultra_id, name, slug, sort_order,
		       image_url, product_count, is_active, created_at, updated_at
		FROM categories
		WHERE id = $1
	`

	var category models.Category
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&category.ID, &category.UltraID, &category.Code, &category.ParentID,
		&category.ParentUltraID, &category.Name, &category.Slug, &category.SortOrder,
		&category.ImageURL, &category.ProductCount, &category.IsActive,
		&category.CreatedAt, &category.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	return &category, nil
}

func (r *Repository) GetCategoryByUltraID(ctx context.Context, ultraID string) (*models.Category, error) {
	query := `
		SELECT id, ultra_id, code, parent_id, parent_ultra_id, name, slug, sort_order,
		       image_url, product_count, is_active, created_at, updated_at
		FROM categories
		WHERE ultra_id = $1
	`

	var category models.Category
	err := r.pool.QueryRow(ctx, query, ultraID).Scan(
		&category.ID, &category.UltraID, &category.Code, &category.ParentID,
		&category.ParentUltraID, &category.Name, &category.Slug, &category.SortOrder,
		&category.ImageURL, &category.ProductCount, &category.IsActive,
		&category.CreatedAt, &category.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	return &category, nil
}

func (r *Repository) ListCategories(ctx context.Context, parentID *uuid.UUID, limit, offset int) ([]*models.Category, error) {
	var query string
	var args []interface{}

	if parentID == nil {
		query = `
			SELECT c.id, c.ultra_id, c.code, c.parent_id, c.parent_ultra_id, c.name, c.slug, c.sort_order,
			       c.image_url, COUNT(pr.id) as actual_product_count, c.is_active, c.created_at, c.updated_at
			FROM categories c
			LEFT JOIN products pr ON pr.category_id = c.id
			WHERE c.parent_id IS NULL AND c.is_active = true
			GROUP BY c.id, c.ultra_id, c.code, c.parent_id, c.parent_ultra_id, c.name, c.slug, c.sort_order,
			         c.image_url, c.is_active, c.created_at, c.updated_at
			ORDER BY c.sort_order ASC, c.name ASC
			LIMIT $1 OFFSET $2
		`
		args = []interface{}{limit, offset}
	} else {
		query = `
			SELECT c.id, c.ultra_id, c.code, c.parent_id, c.parent_ultra_id, c.name, c.slug, c.sort_order,
			       c.image_url, COUNT(pr.id) as actual_product_count, c.is_active, c.created_at, c.updated_at
			FROM categories c
			LEFT JOIN products pr ON pr.category_id = c.id
			WHERE c.parent_id = $1 AND c.is_active = true
			GROUP BY c.id, c.ultra_id, c.code, c.parent_id, c.parent_ultra_id, c.name, c.slug, c.sort_order,
			         c.image_url, c.is_active, c.created_at, c.updated_at
			ORDER BY c.sort_order ASC, c.name ASC
			LIMIT $2 OFFSET $3
		`
		args = []interface{}{parentID, limit, offset}
	}

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	categories := make([]*models.Category, 0)
	for rows.Next() {
		var category models.Category
		err := rows.Scan(
			&category.ID, &category.UltraID, &category.Code, &category.ParentID,
			&category.ParentUltraID, &category.Name, &category.Slug, &category.SortOrder,
			&category.ImageURL, &category.ProductCount, &category.IsActive,
			&category.CreatedAt, &category.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		categories = append(categories, &category)
	}

	return categories, nil
}

// CountCategories returns the total count of active categories, optionally filtered by parent
func (r *Repository) CountCategories(ctx context.Context, parentID *uuid.UUID) (int, error) {
	var count int
	var err error

	if parentID == nil {
		err = r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM categories WHERE is_active = true").Scan(&count)
	} else {
		err = r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM categories WHERE parent_id = $1 AND is_active = true", parentID).Scan(&count)
	}

	return count, err
}

// CountCategoriesWithProducts returns the count of categories that have products
func (r *Repository) CountCategoriesWithProducts(ctx context.Context) (int, error) {
	var count int
	query := `
		SELECT COUNT(*) FROM (
			SELECT c.id
			FROM categories c
			LEFT JOIN products pr ON pr.category_id = c.id
			WHERE c.is_active = true
			GROUP BY c.id
			HAVING COUNT(pr.id) > 0
		) AS categories_with_products
	`
	err := r.pool.QueryRow(ctx, query).Scan(&count)
	return count, err
}

// ListCategoriesWithSearch returns categories with optional search, filters, and sorting
func (r *Repository) ListCategoriesWithSearch(ctx context.Context, search string, hasProducts string, isActive string, sortBy string, limit, offset int) ([]*models.Category, error) {
	// Build WHERE clause - start empty for admin view (show all by default)
	whereClauses := []string{}
	args := make([]interface{}, 0)
	argPos := 1

	// Apply is_active filter only if specified
	if isActive == "true" {
		whereClauses = append(whereClauses, "c.is_active = true")
	} else if isActive == "false" {
		whereClauses = append(whereClauses, "c.is_active = false")
	}
	// If isActive is "" or any other value, don't filter by active status

	if search != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("c.name ILIKE $%d", argPos))
		args = append(args, "%"+search+"%")
		argPos++
	}

	// Build ORDER BY clause using allowlist map for security
	// Note: actual_product_count is the calculated count from products table
	categorySortOptions := map[string]string{
		"name_asc":      "c.name ASC",
		"name_desc":     "c.name DESC",
		"products_desc": "actual_product_count DESC, c.name ASC",
		"products_asc":  "actual_product_count ASC, c.name ASC",
	}
	orderBy := categorySortOptions["name_asc"] // default
	if sortSQL, ok := categorySortOptions[sortBy]; ok {
		orderBy = sortSQL
	}

	// Add limit and offset to args
	args = append(args, limit, offset)

	// Build WHERE clause string
	whereClause := "TRUE" // Default to no filtering
	if len(whereClauses) > 0 {
		whereClause = strings.Join(whereClauses, " AND ")
	}

	// Build HAVING clause for product count filter using actual count
	havingClause := ""
	if hasProducts == "true" {
		havingClause = "HAVING COUNT(pr.id) > 0"
	} else if hasProducts == "false" {
		havingClause = "HAVING COUNT(pr.id) = 0"
	}

	query := fmt.Sprintf(`
		SELECT c.id, c.ultra_id, c.code, c.parent_id, c.parent_ultra_id, c.name, c.slug, c.sort_order,
		       c.image_url, COUNT(pr.id) as actual_product_count, c.is_active, c.created_at, c.updated_at,
		       COALESCE(p.name, '') as parent_name
		FROM categories c
		LEFT JOIN categories p ON p.id = c.parent_id
		LEFT JOIN products pr ON pr.category_id = c.id
		WHERE %s
		GROUP BY c.id, c.ultra_id, c.code, c.parent_id, c.parent_ultra_id, c.name, c.slug, c.sort_order,
		         c.image_url, c.is_active, c.created_at, c.updated_at, p.name
		%s
		ORDER BY %s
		LIMIT $%d OFFSET $%d
	`, whereClause, havingClause, orderBy, argPos, argPos+1)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	categories := make([]*models.Category, 0)
	for rows.Next() {
		var category models.Category
		var parentName string
		err := rows.Scan(
			&category.ID, &category.UltraID, &category.Code, &category.ParentID,
			&category.ParentUltraID, &category.Name, &category.Slug, &category.SortOrder,
			&category.ImageURL, &category.ProductCount, &category.IsActive,
			&category.CreatedAt, &category.UpdatedAt, &parentName,
		)
		if err != nil {
			return nil, err
		}
		category.ParentName = parentName
		categories = append(categories, &category)
	}

	return categories, nil
}

// CountCategoriesWithSearch returns the total count of categories with optional search, hasProducts, and isActive filters
func (r *Repository) CountCategoriesWithSearch(ctx context.Context, search string, hasProducts string, isActive string) (int, error) {
	// Build WHERE clause - start empty for admin view (show all by default)
	whereClauses := []string{}
	args := make([]interface{}, 0)
	argPos := 1

	// Apply is_active filter only if specified
	if isActive == "true" {
		whereClauses = append(whereClauses, "c.is_active = true")
	} else if isActive == "false" {
		whereClauses = append(whereClauses, "c.is_active = false")
	}
	// If isActive is "" or any other value, don't filter by active status

	if search != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("c.name ILIKE $%d", argPos))
		args = append(args, "%"+search+"%")
		argPos++
	}

	// Build HAVING clause for product count filter using actual count
	havingClause := ""
	if hasProducts == "true" {
		havingClause = "HAVING COUNT(pr.id) > 0"
	} else if hasProducts == "false" {
		havingClause = "HAVING COUNT(pr.id) = 0"
	}

	// Build WHERE clause string
	whereClause := "TRUE" // Default to no filtering
	if len(whereClauses) > 0 {
		whereClause = strings.Join(whereClauses, " AND ")
	}

	query := fmt.Sprintf(`
		SELECT COUNT(*) FROM (
			SELECT c.id
			FROM categories c
			LEFT JOIN products pr ON pr.category_id = c.id
			WHERE %s
			GROUP BY c.id
			%s
		) AS filtered_categories
	`, whereClause, havingClause)

	var count int
	err := r.pool.QueryRow(ctx, query, args...).Scan(&count)
	return count, err
}

// GetAllCategories returns all categories without pagination (for dropdown filters)
func (r *Repository) GetAllCategories(ctx context.Context) ([]*models.Category, error) {
	query := `
		SELECT c.id, c.ultra_id, c.code, c.name, c.slug, c.image_url,
		       c.parent_id, COALESCE(parent.name, '') as parent_name,
		       c.sort_order, c.is_active, c.created_at, c.updated_at
		FROM categories c
		LEFT JOIN categories parent ON parent.id = c.parent_id
		ORDER BY c.name ASC
	`

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	categories := make([]*models.Category, 0)
	for rows.Next() {
		var category models.Category
		err := rows.Scan(
			&category.ID, &category.UltraID, &category.Code, &category.Name, &category.Slug,
			&category.ImageURL, &category.ParentID, &category.ParentName, &category.SortOrder,
			&category.IsActive, &category.CreatedAt, &category.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		categories = append(categories, &category)
	}

	return categories, nil
}

// BulkUpdateCategoriesByFilter updates all categories matching the given filter criteria
func (r *Repository) BulkUpdateCategoriesByFilter(ctx context.Context, search string, hasProducts string, isActiveFilter string, isActive bool) (int, error) {
	// Build WHERE clause for the subquery - start empty for admin view (show all by default)
	whereClauses := []string{}
	args := make([]interface{}, 0)
	argPos := 1

	// First arg is the isActive value (new value to set)
	args = append(args, isActive)
	argPos++

	// Apply is_active filter only if specified
	if isActiveFilter == "true" {
		whereClauses = append(whereClauses, "c.is_active = true")
	} else if isActiveFilter == "false" {
		whereClauses = append(whereClauses, "c.is_active = false")
	}
	// If isActiveFilter is "" or any other value, don't filter by active status

	if search != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("c.name ILIKE $%d", argPos))
		args = append(args, "%"+search+"%")
		argPos++
	}

	// Build HAVING clause for product count filter using actual count
	havingClause := ""
	if hasProducts == "true" {
		havingClause = "HAVING COUNT(pr.id) > 0"
	} else if hasProducts == "false" {
		havingClause = "HAVING COUNT(pr.id) = 0"
	}

	// Build WHERE clause string
	whereClause := "TRUE" // Default to no filtering
	if len(whereClauses) > 0 {
		whereClause = strings.Join(whereClauses, " AND ")
	}

	query := fmt.Sprintf(`
		UPDATE categories
		SET is_active = $1, updated_at = NOW()
		WHERE id IN (
			SELECT c.id
			FROM categories c
			LEFT JOIN products pr ON pr.category_id = c.id
			WHERE %s
			GROUP BY c.id
			%s
		)
	`, whereClause, havingClause)

	result, err := r.pool.Exec(ctx, query, args...)
	if err != nil {
		return 0, fmt.Errorf("bulk update categories by filter: %w", err)
	}

	return int(result.RowsAffected()), nil
}

// CategoryWithStats represents a category with product statistics
type CategoryWithStats struct {
	models.Category
	ParentName         string `json:"parent_name"`
	TotalProducts      int    `json:"total_products"`
	ActiveProducts     int    `json:"active_products"`
	InStockProducts    int    `json:"in_stock_products"`
	WithPricesProducts int    `json:"with_prices_products"`
	ChildCount         int    `json:"child_count"`
}

// GetCategoryWithStats returns a category with product statistics
func (r *Repository) GetCategoryWithStats(ctx context.Context, id uuid.UUID) (*CategoryWithStats, error) {
	query := `
		SELECT
			c.id, c.ultra_id, c.code, c.parent_id, c.parent_ultra_id, c.name, c.slug, c.sort_order,
			c.image_url, c.product_count, c.is_active, c.created_at, c.updated_at,
			COALESCE(p.name, '') as parent_name,
			COUNT(pr.id) as total_products,
			COUNT(CASE WHEN pr.is_active = true THEN 1 END) as active_products,
			COUNT(CASE WHEN pr.is_active = true AND pr.total_stock > 0 THEN 1 END) as in_stock_products,
			COUNT(CASE WHEN pr.is_active = true AND jsonb_array_length(pr.prices) > 0 THEN 1 END) as with_prices_products,
			(SELECT COUNT(*) FROM categories WHERE parent_id = c.id) as child_count
		FROM categories c
		LEFT JOIN categories p ON p.id = c.parent_id
		LEFT JOIN products pr ON pr.category_id = c.id
		WHERE c.id = $1
		GROUP BY c.id, c.ultra_id, c.code, c.parent_id, c.parent_ultra_id, c.name, c.slug, c.sort_order,
		         c.image_url, c.product_count, c.is_active, c.created_at, c.updated_at, p.name
	`

	var category CategoryWithStats
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&category.ID, &category.UltraID, &category.Code, &category.ParentID,
		&category.ParentUltraID, &category.Name, &category.Slug, &category.SortOrder,
		&category.ImageURL, &category.ProductCount, &category.IsActive,
		&category.CreatedAt, &category.UpdatedAt, &category.ParentName,
		&category.TotalProducts, &category.ActiveProducts, &category.InStockProducts,
		&category.WithPricesProducts, &category.ChildCount,
	)
	if err != nil {
		return nil, err
	}

	return &category, nil
}

// CategoryProduct represents a simplified product for category details page
type CategoryProduct struct {
	ID         uuid.UUID `json:"id"`
	Name       string    `json:"name"`
	Code       string    `json:"code"`
	PriceMin   *float64  `json:"price_min"`
	PriceMax   *float64  `json:"price_max"`
	PriceMDL   *float64  `json:"price_mdl"`
	PriceEUR   *float64  `json:"price_eur"`
	PriceUSD   *float64  `json:"price_usd"`
	TotalStock int       `json:"total_stock"`
	IsActive   bool      `json:"is_active"`
}

// GetProductsByCategoryID returns paginated products for a specific category
func (r *Repository) GetProductsByCategoryID(ctx context.Context, categoryID uuid.UUID, limit, offset int) ([]*CategoryProduct, error) {
	query := `
		SELECT id, name, COALESCE(code, ''), price_min, price_max, price_mdl, price_eur, price_usd, total_stock, is_active
		FROM products
		WHERE category_id = $1
		ORDER BY name ASC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.pool.Query(ctx, query, categoryID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	products := make([]*CategoryProduct, 0)
	for rows.Next() {
		var product CategoryProduct
		err := rows.Scan(
			&product.ID, &product.Name, &product.Code, &product.PriceMin,
			&product.PriceMax, &product.PriceMDL, &product.PriceEUR, &product.PriceUSD, &product.TotalStock, &product.IsActive,
		)
		if err != nil {
			return nil, err
		}
		products = append(products, &product)
	}

	return products, nil
}

// CountProductsByCategoryID returns the total count of products for a category
func (r *Repository) CountProductsByCategoryID(ctx context.Context, categoryID uuid.UUID) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM products WHERE category_id = $1", categoryID).Scan(&count)
	return count, err
}

// BulkUpdateProductsByCategoryID updates all products for a category
func (r *Repository) BulkUpdateProductsByCategoryID(ctx context.Context, categoryID uuid.UUID, isActive bool) (int, error) {
	result, err := r.pool.Exec(ctx, `
		UPDATE products SET is_active = $1, updated_at = NOW() WHERE category_id = $2
	`, isActive, categoryID)
	if err != nil {
		return 0, err
	}
	return int(result.RowsAffected()), nil
}

// GetProductsByCategoryIDWithFilters returns filtered and paginated products for a specific category
func (r *Repository) GetProductsByCategoryIDWithFilters(ctx context.Context, categoryID uuid.UUID, filters ProductFilters, limit, offset int) ([]*CategoryProduct, error) {
	query := `
		SELECT id, name, COALESCE(code, ''), price_min, price_max, price_mdl, price_eur, price_usd, total_stock, is_active
		FROM products
		WHERE category_id = $1
	`

	args := []interface{}{categoryID}
	paramIndex := 2

	// Price filters
	if filters.PriceFilter == "no_price" {
		query += " AND price_mdl IS NULL AND price_eur IS NULL AND price_usd IS NULL"
	} else if filters.PriceFilter == "no_mdl" {
		query += " AND price_mdl IS NULL"
	} else if filters.PriceFilter == "no_eur" {
		query += " AND price_eur IS NULL"
	} else if filters.PriceFilter == "no_usd" {
		query += " AND price_usd IS NULL"
	} else if filters.PriceFilter == "with_price" {
		query += " AND (price_mdl IS NOT NULL OR price_eur IS NOT NULL OR price_usd IS NOT NULL)"
	}

	// Stock filters
	if filters.StockFilter == "in_stock" {
		query += " AND total_stock > 0"
	} else if filters.StockFilter == "out_of_stock" {
		query += " AND (total_stock = 0 OR total_stock IS NULL)"
	} else if filters.StockFilter == "low_stock" {
		query += " AND total_stock > 0 AND total_stock <= 5"
	}

	// Status filters
	if filters.StatusFilter == "active" {
		query += " AND is_active = true"
	} else if filters.StatusFilter == "inactive" {
		query += " AND is_active = false"
	}

	query += fmt.Sprintf(" ORDER BY name ASC LIMIT $%d OFFSET $%d", paramIndex, paramIndex+1)
	args = append(args, limit, offset)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	products := make([]*CategoryProduct, 0)
	for rows.Next() {
		var product CategoryProduct
		err := rows.Scan(
			&product.ID, &product.Name, &product.Code, &product.PriceMin,
			&product.PriceMax, &product.PriceMDL, &product.PriceEUR, &product.PriceUSD, &product.TotalStock, &product.IsActive,
		)
		if err != nil {
			return nil, err
		}
		products = append(products, &product)
	}

	return products, nil
}

// CountProductsByCategoryIDWithFilters returns the total count of filtered products for a category
func (r *Repository) CountProductsByCategoryIDWithFilters(ctx context.Context, categoryID uuid.UUID, filters ProductFilters) (int, error) {
	query := "SELECT COUNT(*) FROM products WHERE category_id = $1"
	args := []interface{}{categoryID}

	// Price filters
	if filters.PriceFilter == "no_price" {
		query += " AND price_mdl IS NULL AND price_eur IS NULL AND price_usd IS NULL"
	} else if filters.PriceFilter == "no_mdl" {
		query += " AND price_mdl IS NULL"
	} else if filters.PriceFilter == "no_eur" {
		query += " AND price_eur IS NULL"
	} else if filters.PriceFilter == "no_usd" {
		query += " AND price_usd IS NULL"
	} else if filters.PriceFilter == "with_price" {
		query += " AND (price_mdl IS NOT NULL OR price_eur IS NOT NULL OR price_usd IS NOT NULL)"
	}

	// Stock filters
	if filters.StockFilter == "in_stock" {
		query += " AND total_stock > 0"
	} else if filters.StockFilter == "out_of_stock" {
		query += " AND (total_stock = 0 OR total_stock IS NULL)"
	} else if filters.StockFilter == "low_stock" {
		query += " AND total_stock > 0 AND total_stock <= 5"
	}

	// Status filters
	if filters.StatusFilter == "active" {
		query += " AND is_active = true"
	} else if filters.StatusFilter == "inactive" {
		query += " AND is_active = false"
	}

	var count int
	err := r.pool.QueryRow(ctx, query, args...).Scan(&count)
	return count, err
}

// BulkUpdateProductsByCategoryIDWithFilters updates products for a category matching filters
func (r *Repository) BulkUpdateProductsByCategoryIDWithFilters(ctx context.Context, categoryID uuid.UUID, filters ProductFilters, isActive bool) (int, error) {
	query := "UPDATE products SET is_active = $1, updated_at = NOW() WHERE category_id = $2"
	args := []interface{}{isActive, categoryID}

	// Price filters
	if filters.PriceFilter == "no_price" {
		query += " AND price_mdl IS NULL AND price_eur IS NULL AND price_usd IS NULL"
	} else if filters.PriceFilter == "no_mdl" {
		query += " AND price_mdl IS NULL"
	} else if filters.PriceFilter == "no_eur" {
		query += " AND price_eur IS NULL"
	} else if filters.PriceFilter == "no_usd" {
		query += " AND price_usd IS NULL"
	} else if filters.PriceFilter == "with_price" {
		query += " AND (price_mdl IS NOT NULL OR price_eur IS NOT NULL OR price_usd IS NOT NULL)"
	}

	// Stock filters
	if filters.StockFilter == "in_stock" {
		query += " AND total_stock > 0"
	} else if filters.StockFilter == "out_of_stock" {
		query += " AND (total_stock = 0 OR total_stock IS NULL)"
	} else if filters.StockFilter == "low_stock" {
		query += " AND total_stock > 0 AND total_stock <= 5"
	}

	// Status filters
	if filters.StatusFilter == "active" {
		query += " AND is_active = true"
	} else if filters.StatusFilter == "inactive" {
		query += " AND is_active = false"
	}

	result, err := r.pool.Exec(ctx, query, args...)
	if err != nil {
		return 0, err
	}
	return int(result.RowsAffected()), nil
}

// GetSubcategories returns child categories for a parent category
func (r *Repository) GetSubcategories(ctx context.Context, parentID uuid.UUID) ([]*models.Category, error) {
	query := `
		SELECT id, ultra_id, code, parent_id, parent_ultra_id, name, slug, sort_order,
		       image_url, product_count, is_active, created_at, updated_at
		FROM categories
		WHERE parent_id = $1
		ORDER BY sort_order ASC, name ASC
	`

	rows, err := r.pool.Query(ctx, query, parentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	categories := make([]*models.Category, 0)
	for rows.Next() {
		var category models.Category
		err := rows.Scan(
			&category.ID, &category.UltraID, &category.Code, &category.ParentID,
			&category.ParentUltraID, &category.Name, &category.Slug, &category.SortOrder,
			&category.ImageURL, &category.ProductCount, &category.IsActive,
			&category.CreatedAt, &category.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		categories = append(categories, &category)
	}

	return categories, nil
}

// CountRootCategories returns the count of categories with no parent
func (r *Repository) CountRootCategories(ctx context.Context) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM categories WHERE parent_id IS NULL").Scan(&count)
	return count, err
}

// ============================================================================
// PRODUCTS
// ============================================================================

func (r *Repository) UpsertProducts(ctx context.Context, products []*models.ProductInput) (int, error) {
	if len(products) == 0 {
		return 0, nil
	}

	query := `
		INSERT INTO products (
			ultra_id, code, article, name, slug, description, brand_ultra_id, category_ultra_id,
			parent_ultra_id, main_image_url, images, warranty, barcodes, is_active, is_service
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
		)
		ON CONFLICT (ultra_id) DO UPDATE SET
			code = EXCLUDED.code,
			article = EXCLUDED.article,
			name = EXCLUDED.name,
			slug = EXCLUDED.slug,
			description = EXCLUDED.description,
			brand_ultra_id = EXCLUDED.brand_ultra_id,
			category_ultra_id = EXCLUDED.category_ultra_id,
			parent_ultra_id = EXCLUDED.parent_ultra_id,
			main_image_url = EXCLUDED.main_image_url,
			images = EXCLUDED.images,
			warranty = EXCLUDED.warranty,
			barcodes = EXCLUDED.barcodes,
			is_active = EXCLUDED.is_active,
			is_service = EXCLUDED.is_service,
			updated_at = NOW()
	`

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	count := 0
	slugCounts := make(map[string]int)

	for _, product := range products {
		productSlug := slug.Make(product.Name)
		if productSlug == "" {
			productSlug = "product"
		}

		// Handle duplicate slugs by appending counter
		if cnt, exists := slugCounts[productSlug]; exists {
			slugCounts[productSlug] = cnt + 1
			productSlug = fmt.Sprintf("%s-%d", productSlug, cnt+1)
		} else {
			slugCounts[productSlug] = 1
		}

		// Convert images and barcodes to JSONB
		imagesJSON, _ := models.JSONBArray(toInterfaceSlice(product.Images)).Value()
		barcodesJSON, _ := models.JSONBArray(toInterfaceSlice(product.Barcodes)).Value()

		_, err := tx.Exec(ctx, query,
			product.UltraID,
			product.Code,
			product.Article,
			product.Name,
			productSlug,
			product.Description,
			product.BrandUltraID,
			product.CategoryUltraID,
			product.ParentUltraID,
			product.MainImageURL,
			imagesJSON,
			product.Warranty,
			barcodesJSON,
			product.IsActive,
			product.IsService,
		)
		if err != nil {
			return count, fmt.Errorf("insert product %s: %w", product.UltraID, err)
		}
		count++
	}

	if err := tx.Commit(ctx); err != nil {
		return count, fmt.Errorf("commit transaction: %w", err)
	}

	return count, nil
}

// ResolveProductReferences resolves brand_id, category_id, parent_id from ultra_id references
func (r *Repository) ResolveProductReferences(ctx context.Context) error {
	// Resolve brand_id
	_, err := r.pool.Exec(ctx, `
		UPDATE products p
		SET brand_id = b.id
		FROM brands b
		WHERE p.brand_ultra_id = b.ultra_id
		AND p.brand_id IS NULL
		AND p.brand_ultra_id IS NOT NULL
	`)
	if err != nil {
		return fmt.Errorf("resolve brand_id: %w", err)
	}

	// Resolve category_id
	_, err = r.pool.Exec(ctx, `
		UPDATE products p
		SET category_id = c.id
		FROM categories c
		WHERE p.category_ultra_id = c.ultra_id
		AND p.category_id IS NULL
		AND p.category_ultra_id IS NOT NULL
	`)
	if err != nil {
		return fmt.Errorf("resolve category_id: %w", err)
	}

	// Resolve parent_id
	_, err = r.pool.Exec(ctx, `
		UPDATE products p
		SET parent_id = pp.id
		FROM products pp
		WHERE p.parent_ultra_id = pp.ultra_id
		AND p.parent_id IS NULL
		AND p.parent_ultra_id IS NOT NULL
	`)
	if err != nil {
		return fmt.Errorf("resolve parent_id: %w", err)
	}

	return nil
}

func (r *Repository) GetProduct(ctx context.Context, id uuid.UUID) (*models.Product, error) {
	query := `
		SELECT id, ultra_id, code, article, name, slug, description, brand_id, category_id,
		       parent_id, brand_ultra_id, category_ultra_id, parent_ultra_id, main_image_url,
		       images, warranty, barcodes, price_min, price_max, total_stock, is_in_stock,
		       is_active, is_service, created_at, updated_at,
		       prices, price_mdl, price_eur, price_usd, variant_group_id, is_group
		FROM products
		WHERE id = $1
	`

	var product models.Product
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&product.ID, &product.UltraID, &product.Code, &product.Article, &product.Name,
		&product.Slug, &product.Description, &product.BrandID, &product.CategoryID,
		&product.ParentID, &product.BrandUltraID, &product.CategoryUltraID, &product.ParentUltraID,
		&product.MainImageURL, &product.Images, &product.Warranty, &product.Barcodes,
		&product.PriceMin, &product.PriceMax, &product.TotalStock, &product.IsInStock,
		&product.IsActive, &product.IsService, &product.CreatedAt, &product.UpdatedAt,
		&product.Prices, &product.PriceMDL, &product.PriceEUR, &product.PriceUSD,
		&product.VariantGroupID, &product.IsGroup,
	)
	if err != nil {
		return nil, err
	}

	return &product, nil
}

func (r *Repository) GetProductByUltraID(ctx context.Context, ultraID string) (*models.Product, error) {
	query := `
		SELECT id, ultra_id, code, article, name, slug, description, brand_id, category_id,
		       parent_id, brand_ultra_id, category_ultra_id, parent_ultra_id, main_image_url,
		       images, warranty, barcodes, price_min, price_max, total_stock, is_in_stock,
		       is_active, is_service, created_at, updated_at,
		       prices, price_mdl, price_eur, price_usd, variant_group_id, is_group
		FROM products
		WHERE ultra_id = $1
	`

	var product models.Product
	err := r.pool.QueryRow(ctx, query, ultraID).Scan(
		&product.ID, &product.UltraID, &product.Code, &product.Article, &product.Name,
		&product.Slug, &product.Description, &product.BrandID, &product.CategoryID,
		&product.ParentID, &product.BrandUltraID, &product.CategoryUltraID, &product.ParentUltraID,
		&product.MainImageURL, &product.Images, &product.Warranty, &product.Barcodes,
		&product.PriceMin, &product.PriceMax, &product.TotalStock, &product.IsInStock,
		&product.IsActive, &product.IsService, &product.CreatedAt, &product.UpdatedAt,
		&product.Prices, &product.PriceMDL, &product.PriceEUR, &product.PriceUSD,
		&product.VariantGroupID, &product.IsGroup,
	)
	if err != nil {
		return nil, err
	}

	return &product, nil
}

// GetProductsByUltraIDs retrieves multiple products by their Ultra IDs in a single batch query
// This method prevents N+1 query problems by fetching all products at once
func (r *Repository) GetProductsByUltraIDs(ctx context.Context, ultraIDs []string) ([]models.Product, error) {
	if len(ultraIDs) == 0 {
		return []models.Product{}, nil
	}

	query := `
		SELECT id, ultra_id, code, article, name, slug, description, brand_id, category_id,
		       parent_id, brand_ultra_id, category_ultra_id, parent_ultra_id, main_image_url,
		       images, warranty, barcodes, price_min, price_max, total_stock, is_in_stock,
		       is_active, is_service, created_at, updated_at,
		       prices, price_mdl, price_eur, price_usd, variant_group_id, is_group
		FROM products
		WHERE ultra_id = ANY($1)
	`

	rows, err := r.pool.Query(ctx, query, ultraIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	products := make([]models.Product, 0, len(ultraIDs))
	for rows.Next() {
		var product models.Product
		err := rows.Scan(
			&product.ID, &product.UltraID, &product.Code, &product.Article, &product.Name,
			&product.Slug, &product.Description, &product.BrandID, &product.CategoryID,
			&product.ParentID, &product.BrandUltraID, &product.CategoryUltraID, &product.ParentUltraID,
			&product.MainImageURL, &product.Images, &product.Warranty, &product.Barcodes,
			&product.PriceMin, &product.PriceMax, &product.TotalStock, &product.IsInStock,
			&product.IsActive, &product.IsService, &product.CreatedAt, &product.UpdatedAt,
			&product.Prices, &product.PriceMDL, &product.PriceEUR, &product.PriceUSD,
			&product.VariantGroupID, &product.IsGroup,
		)
		if err != nil {
			return nil, err
		}
		products = append(products, product)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return products, nil
}

// ProductFilter holds filter parameters for product queries
type ProductFilter struct {
	BrandID      *uuid.UUID
	CategoryID   *uuid.UUID
	InStock      *bool
	MinPrice     *float64
	MaxPrice     *float64
	Search       string
	IsActive     bool
	PriceFilter  string // "all", "with_price", "no_price"
	StockFilter  string // "all", "in_stock", "out_stock", "low_stock"
	StatusFilter string // "all", "active", "inactive"
	SortBy       string // "name_asc", "name_desc", "price_high", "price_low", "stock_high", "stock_low"
}

func (r *Repository) ListProducts(ctx context.Context, filter *ProductFilter, limit, offset int) ([]*models.Product, error) {
	query := `
		SELECT p.id, p.ultra_id, p.code, p.article, p.name, p.slug, p.description, p.brand_id, p.category_id,
		       p.parent_id, p.brand_ultra_id, p.category_ultra_id, p.parent_ultra_id, p.main_image_url,
		       p.images, p.warranty, p.barcodes, p.price_min, p.price_max, p.total_stock, p.is_in_stock,
		       p.is_active, p.is_service, p.created_at, p.updated_at,
		       p.prices, p.price_mdl, p.price_eur, p.price_usd, p.variant_group_id, p.is_group,
		       b.name as brand_name, c.name as category_name
		FROM products p
		LEFT JOIN brands b ON p.brand_id = b.id
		LEFT JOIN categories c ON p.category_id = c.id
		WHERE 1=1
	`

	args := make([]interface{}, 0)
	argPos := 1

	if filter != nil {
		// Search filter
		if filter.Search != "" {
			query += fmt.Sprintf(" AND (p.name ILIKE $%d OR p.description ILIKE $%d OR p.code ILIKE $%d)", argPos, argPos, argPos)
			searchPattern := "%" + filter.Search + "%"
			args = append(args, searchPattern)
			argPos++
		}

		// Brand filter
		if filter.BrandID != nil {
			query += fmt.Sprintf(" AND p.brand_id = $%d", argPos)
			args = append(args, filter.BrandID)
			argPos++
		}

		// Category filter
		if filter.CategoryID != nil {
			query += fmt.Sprintf(" AND p.category_id = $%d", argPos)
			args = append(args, filter.CategoryID)
			argPos++
		}

		// Price filters
		if filter.PriceFilter == "with_price" {
			query += " AND (p.price_mdl IS NOT NULL OR p.price_eur IS NOT NULL OR p.price_usd IS NOT NULL)"
		} else if filter.PriceFilter == "no_price" {
			query += " AND p.price_mdl IS NULL AND p.price_eur IS NULL AND p.price_usd IS NULL"
		}

		// Legacy price range filters (for backward compatibility)
		if filter.MinPrice != nil {
			query += fmt.Sprintf(" AND p.price_min >= $%d", argPos)
			args = append(args, filter.MinPrice)
			argPos++
		}
		if filter.MaxPrice != nil {
			query += fmt.Sprintf(" AND p.price_max <= $%d", argPos)
			args = append(args, filter.MaxPrice)
			argPos++
		}

		// Stock filters
		if filter.StockFilter == "in_stock" {
			query += " AND p.total_stock > 0"
		} else if filter.StockFilter == "out_stock" {
			query += " AND (p.total_stock = 0 OR p.total_stock IS NULL)"
		} else if filter.InStock != nil && *filter.InStock {
			// Legacy filter (for backward compatibility)
			query += " AND p.is_in_stock = true"
		}

		// Status filters
		if filter.StatusFilter == "active" {
			query += " AND p.is_active = true"
		} else if filter.StatusFilter == "inactive" {
			query += " AND p.is_active = false"
		} else if filter.StatusFilter == "" || filter.StatusFilter == "all" {
			// Admin CMS: show all products by default (no filter)
		} else {
			// Legacy filter (for backward compatibility)
			query += fmt.Sprintf(" AND p.is_active = $%d", argPos)
			args = append(args, filter.IsActive)
			argPos++
		}
	}

	// Sort options
	sortMap := map[string]string{
		"name_asc":   "p.name ASC",
		"name_desc":  "p.name DESC",
		"price_high": "p.price_mdl DESC NULLS LAST",
		"price_low":  "p.price_mdl ASC NULLS LAST",
		"stock_high": "p.total_stock DESC NULLS LAST",
		"stock_low":  "p.total_stock ASC NULLS LAST",
	}
	orderBy := "p.name ASC" // default
	if filter != nil && filter.SortBy != "" {
		if sortSQL, ok := sortMap[filter.SortBy]; ok {
			orderBy = sortSQL
		}
	}

	query += fmt.Sprintf(" ORDER BY %s LIMIT $%d OFFSET $%d", orderBy, argPos, argPos+1)
	args = append(args, limit, offset)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	products := make([]*models.Product, 0)
	for rows.Next() {
		var product models.Product
		err := rows.Scan(
			&product.ID, &product.UltraID, &product.Code, &product.Article, &product.Name,
			&product.Slug, &product.Description, &product.BrandID, &product.CategoryID,
			&product.ParentID, &product.BrandUltraID, &product.CategoryUltraID, &product.ParentUltraID,
			&product.MainImageURL, &product.Images, &product.Warranty, &product.Barcodes,
			&product.PriceMin, &product.PriceMax, &product.TotalStock, &product.IsInStock,
			&product.IsActive, &product.IsService, &product.CreatedAt, &product.UpdatedAt,
			&product.Prices, &product.PriceMDL, &product.PriceEUR, &product.PriceUSD,
			&product.VariantGroupID, &product.IsGroup,
			&product.BrandName, &product.CategoryName,
		)
		if err != nil {
			return nil, err
		}
		products = append(products, &product)
	}

	return products, nil
}

// CountProducts returns the total count of products matching the filter
func (r *Repository) CountProducts(ctx context.Context, filter *ProductFilter) (int, error) {
	query := `SELECT COUNT(*) FROM products WHERE 1=1`

	args := make([]interface{}, 0)
	argPos := 1

	if filter != nil {
		// Search filter
		if filter.Search != "" {
			query += fmt.Sprintf(" AND (name ILIKE $%d OR description ILIKE $%d OR code ILIKE $%d)", argPos, argPos, argPos)
			searchPattern := "%" + filter.Search + "%"
			args = append(args, searchPattern)
			argPos++
		}

		// Brand filter
		if filter.BrandID != nil {
			query += fmt.Sprintf(" AND brand_id = $%d", argPos)
			args = append(args, filter.BrandID)
			argPos++
		}

		// Category filter
		if filter.CategoryID != nil {
			query += fmt.Sprintf(" AND category_id = $%d", argPos)
			args = append(args, filter.CategoryID)
			argPos++
		}

		// Price filters
		if filter.PriceFilter == "with_price" {
			query += " AND (price_mdl IS NOT NULL OR price_eur IS NOT NULL OR price_usd IS NOT NULL)"
		} else if filter.PriceFilter == "no_price" {
			query += " AND price_mdl IS NULL AND price_eur IS NULL AND price_usd IS NULL"
		}

		// Legacy price range filters (for backward compatibility)
		if filter.MinPrice != nil {
			query += fmt.Sprintf(" AND price_min >= $%d", argPos)
			args = append(args, filter.MinPrice)
			argPos++
		}
		if filter.MaxPrice != nil {
			query += fmt.Sprintf(" AND price_max <= $%d", argPos)
			args = append(args, filter.MaxPrice)
			argPos++
		}

		// Stock filters
		if filter.StockFilter == "in_stock" {
			query += " AND total_stock > 0"
		} else if filter.StockFilter == "out_stock" {
			query += " AND (total_stock = 0 OR total_stock IS NULL)"
		} else if filter.InStock != nil && *filter.InStock {
			// Legacy filter (for backward compatibility)
			query += " AND is_in_stock = true"
		}

		// Status filters
		if filter.StatusFilter == "active" {
			query += " AND is_active = true"
		} else if filter.StatusFilter == "inactive" {
			query += " AND is_active = false"
		} else if filter.StatusFilter == "" || filter.StatusFilter == "all" {
			// Admin CMS: show all products by default (no filter)
		} else {
			// Legacy filter (for backward compatibility)
			query += fmt.Sprintf(" AND is_active = $%d", argPos)
			args = append(args, filter.IsActive)
			argPos++
		}
	}

	var count int
	err := r.pool.QueryRow(ctx, query, args...).Scan(&count)
	return count, err
}

// CountAllProducts returns the total count of all active products (for stats)
func (r *Repository) CountAllProducts(ctx context.Context) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM products WHERE is_active = true").Scan(&count)
	return count, err
}

// GetProductsWithDetails enriches products with brand and category data using batch queries
func (r *Repository) GetProductsWithDetails(ctx context.Context, products []*models.Product) ([]*models.ProductWithDetails, error) {
	if len(products) == 0 {
		return []*models.ProductWithDetails{}, nil
	}

	// Collect unique brand and category IDs
	brandIDs := make([]uuid.UUID, 0)
	categoryIDs := make([]uuid.UUID, 0)
	brandIDSet := make(map[uuid.UUID]bool)
	categoryIDSet := make(map[uuid.UUID]bool)

	for _, p := range products {
		if p.BrandID != nil && !brandIDSet[*p.BrandID] {
			brandIDs = append(brandIDs, *p.BrandID)
			brandIDSet[*p.BrandID] = true
		}
		if p.CategoryID != nil && !categoryIDSet[*p.CategoryID] {
			categoryIDs = append(categoryIDs, *p.CategoryID)
			categoryIDSet[*p.CategoryID] = true
		}
	}

	// Batch fetch brands
	brandMap := make(map[uuid.UUID]*models.Brand)
	if len(brandIDs) > 0 {
		brands, err := r.GetBrandsByIDs(ctx, brandIDs)
		if err != nil {
			return nil, fmt.Errorf("fetch brands: %w", err)
		}
		for _, b := range brands {
			brandMap[b.ID] = b
		}
	}

	// Batch fetch categories
	categoryMap := make(map[uuid.UUID]*models.Category)
	if len(categoryIDs) > 0 {
		categories, err := r.GetCategoriesByIDs(ctx, categoryIDs)
		if err != nil {
			return nil, fmt.Errorf("fetch categories: %w", err)
		}
		for _, c := range categories {
			categoryMap[c.ID] = c
		}
	}

	// Build enriched results
	enriched := make([]*models.ProductWithDetails, len(products))
	for i, product := range products {
		response := &models.ProductWithDetails{Product: product}

		if product.BrandID != nil {
			response.Brand = brandMap[*product.BrandID]
		}
		if product.CategoryID != nil {
			response.Category = categoryMap[*product.CategoryID]
		}

		enriched[i] = response
	}

	return enriched, nil
}

// GetBrandsByIDs fetches multiple brands by their IDs
func (r *Repository) GetBrandsByIDs(ctx context.Context, ids []uuid.UUID) ([]*models.Brand, error) {
	if len(ids) == 0 {
		return []*models.Brand{}, nil
	}

	// Build IN clause
	args := make([]interface{}, len(ids))
	placeholders := make([]string, len(ids))
	for i, id := range ids {
		placeholders[i] = fmt.Sprintf("$%d", i+1)
		args[i] = id
	}

	query := fmt.Sprintf(`
		SELECT id, ultra_id, code, name, slug, logo_url, is_active, created_at, updated_at
		FROM brands
		WHERE id IN (%s)
	`, strings.Join(placeholders, ", "))

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	brands := make([]*models.Brand, 0)
	for rows.Next() {
		var brand models.Brand
		err := rows.Scan(
			&brand.ID, &brand.UltraID, &brand.Code, &brand.Name, &brand.Slug,
			&brand.LogoURL, &brand.IsActive, &brand.CreatedAt, &brand.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		brands = append(brands, &brand)
	}

	return brands, nil
}

// BrandWithStats represents a brand with product statistics
type BrandWithStats struct {
	models.Brand
	TotalProducts      int `json:"total_products"`
	ActiveProducts     int `json:"active_products"`
	InStockProducts    int `json:"in_stock_products"`
	WithPricesProducts int `json:"with_prices_products"`
}

// GetBrandWithStats returns a brand with product statistics
func (r *Repository) GetBrandWithStats(ctx context.Context, id uuid.UUID) (*BrandWithStats, error) {
	query := `
		SELECT
			b.id, b.ultra_id, b.code, b.name, b.slug, b.logo_url, b.is_active, b.created_at, b.updated_at,
			COUNT(p.id) as total_products,
			COUNT(CASE WHEN p.is_active = true THEN 1 END) as active_products,
			COUNT(CASE WHEN p.is_active = true AND p.total_stock > 0 THEN 1 END) as in_stock_products,
			COUNT(CASE WHEN p.is_active = true AND jsonb_array_length(p.prices) > 0 THEN 1 END) as with_prices_products
		FROM brands b
		LEFT JOIN products p ON p.brand_id = b.id
		WHERE b.id = $1
		GROUP BY b.id, b.ultra_id, b.code, b.name, b.slug, b.logo_url, b.is_active, b.created_at, b.updated_at
	`

	var brand BrandWithStats
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&brand.ID, &brand.UltraID, &brand.Code, &brand.Name, &brand.Slug,
		&brand.LogoURL, &brand.IsActive, &brand.CreatedAt, &brand.UpdatedAt,
		&brand.TotalProducts, &brand.ActiveProducts, &brand.InStockProducts, &brand.WithPricesProducts,
	)
	if err != nil {
		return nil, err
	}

	return &brand, nil
}

// BrandProduct represents a simplified product for brand details page
type BrandProduct struct {
	ID         uuid.UUID `json:"id"`
	Name       string    `json:"name"`
	Code       string    `json:"code"`
	PriceMin   *float64  `json:"price_min"`
	PriceMax   *float64  `json:"price_max"`
	PriceMDL   *float64  `json:"price_mdl"`
	PriceEUR   *float64  `json:"price_eur"`
	PriceUSD   *float64  `json:"price_usd"`
	TotalStock int       `json:"total_stock"`
	IsActive   bool      `json:"is_active"`
}

// GetProductsByBrandID returns paginated products for a specific brand
func (r *Repository) GetProductsByBrandID(ctx context.Context, brandID uuid.UUID, limit, offset int) ([]*BrandProduct, error) {
	query := `
		SELECT id, name, COALESCE(code, ''), price_min, price_max, price_mdl, price_eur, price_usd, total_stock, is_active
		FROM products
		WHERE brand_id = $1
		ORDER BY name ASC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.pool.Query(ctx, query, brandID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	products := make([]*BrandProduct, 0)
	for rows.Next() {
		var product BrandProduct
		err := rows.Scan(
			&product.ID, &product.Name, &product.Code, &product.PriceMin,
			&product.PriceMax, &product.PriceMDL, &product.PriceEUR, &product.PriceUSD, &product.TotalStock, &product.IsActive,
		)
		if err != nil {
			return nil, err
		}
		products = append(products, &product)
	}

	return products, nil
}

// CountProductsByBrandID returns the total count of products for a brand
func (r *Repository) CountProductsByBrandID(ctx context.Context, brandID uuid.UUID) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM products WHERE brand_id = $1", brandID).Scan(&count)
	return count, err
}

// BulkUpdateProductsByBrandID updates all products for a brand
func (r *Repository) BulkUpdateProductsByBrandID(ctx context.Context, brandID uuid.UUID, isActive bool) (int, error) {
	result, err := r.pool.Exec(ctx, `
		UPDATE products SET is_active = $1, updated_at = NOW() WHERE brand_id = $2
	`, isActive, brandID)
	if err != nil {
		return 0, err
	}
	return int(result.RowsAffected()), nil
}

// ProductFilters represents filter options for brand/category products
type ProductFilters struct {
	PriceFilter  string // "all", "no_price", "no_mdl", "no_eur", "no_usd", "with_price"
	StockFilter  string // "all", "in_stock", "out_of_stock", "low_stock"
	StatusFilter string // "all", "active", "inactive"
}

// GetProductsByBrandIDWithFilters returns filtered and paginated products for a specific brand
func (r *Repository) GetProductsByBrandIDWithFilters(ctx context.Context, brandID uuid.UUID, filters ProductFilters, limit, offset int) ([]*BrandProduct, error) {
	query := `
		SELECT id, name, COALESCE(code, ''), price_min, price_max, price_mdl, price_eur, price_usd, total_stock, is_active
		FROM products
		WHERE brand_id = $1
	`

	args := []interface{}{brandID}
	paramIndex := 2

	// Price filters
	if filters.PriceFilter == "no_price" {
		query += " AND price_mdl IS NULL AND price_eur IS NULL AND price_usd IS NULL"
	} else if filters.PriceFilter == "no_mdl" {
		query += " AND price_mdl IS NULL"
	} else if filters.PriceFilter == "no_eur" {
		query += " AND price_eur IS NULL"
	} else if filters.PriceFilter == "no_usd" {
		query += " AND price_usd IS NULL"
	} else if filters.PriceFilter == "with_price" {
		query += " AND (price_mdl IS NOT NULL OR price_eur IS NOT NULL OR price_usd IS NOT NULL)"
	}

	// Stock filters
	if filters.StockFilter == "in_stock" {
		query += " AND total_stock > 0"
	} else if filters.StockFilter == "out_of_stock" {
		query += " AND (total_stock = 0 OR total_stock IS NULL)"
	} else if filters.StockFilter == "low_stock" {
		query += " AND total_stock > 0 AND total_stock <= 5"
	}

	// Status filters
	if filters.StatusFilter == "active" {
		query += " AND is_active = true"
	} else if filters.StatusFilter == "inactive" {
		query += " AND is_active = false"
	}

	query += fmt.Sprintf(" ORDER BY name ASC LIMIT $%d OFFSET $%d", paramIndex, paramIndex+1)
	args = append(args, limit, offset)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	products := make([]*BrandProduct, 0)
	for rows.Next() {
		var product BrandProduct
		err := rows.Scan(
			&product.ID, &product.Name, &product.Code, &product.PriceMin,
			&product.PriceMax, &product.PriceMDL, &product.PriceEUR, &product.PriceUSD, &product.TotalStock, &product.IsActive,
		)
		if err != nil {
			return nil, err
		}
		products = append(products, &product)
	}

	return products, nil
}

// CountProductsByBrandIDWithFilters returns the total count of filtered products for a brand
func (r *Repository) CountProductsByBrandIDWithFilters(ctx context.Context, brandID uuid.UUID, filters ProductFilters) (int, error) {
	query := "SELECT COUNT(*) FROM products WHERE brand_id = $1"
	args := []interface{}{brandID}

	// Price filters
	if filters.PriceFilter == "no_price" {
		query += " AND price_mdl IS NULL AND price_eur IS NULL AND price_usd IS NULL"
	} else if filters.PriceFilter == "no_mdl" {
		query += " AND price_mdl IS NULL"
	} else if filters.PriceFilter == "no_eur" {
		query += " AND price_eur IS NULL"
	} else if filters.PriceFilter == "no_usd" {
		query += " AND price_usd IS NULL"
	} else if filters.PriceFilter == "with_price" {
		query += " AND (price_mdl IS NOT NULL OR price_eur IS NOT NULL OR price_usd IS NOT NULL)"
	}

	// Stock filters
	if filters.StockFilter == "in_stock" {
		query += " AND total_stock > 0"
	} else if filters.StockFilter == "out_of_stock" {
		query += " AND (total_stock = 0 OR total_stock IS NULL)"
	} else if filters.StockFilter == "low_stock" {
		query += " AND total_stock > 0 AND total_stock <= 5"
	}

	// Status filters
	if filters.StatusFilter == "active" {
		query += " AND is_active = true"
	} else if filters.StatusFilter == "inactive" {
		query += " AND is_active = false"
	}

	var count int
	err := r.pool.QueryRow(ctx, query, args...).Scan(&count)
	return count, err
}

// BulkUpdateProductsByBrandIDWithFilters updates products for a brand matching filters
func (r *Repository) BulkUpdateProductsByBrandIDWithFilters(ctx context.Context, brandID uuid.UUID, filters ProductFilters, isActive bool) (int, error) {
	query := "UPDATE products SET is_active = $1, updated_at = NOW() WHERE brand_id = $2"
	args := []interface{}{isActive, brandID}

	// Price filters
	if filters.PriceFilter == "no_price" {
		query += " AND price_mdl IS NULL AND price_eur IS NULL AND price_usd IS NULL"
	} else if filters.PriceFilter == "no_mdl" {
		query += " AND price_mdl IS NULL"
	} else if filters.PriceFilter == "no_eur" {
		query += " AND price_eur IS NULL"
	} else if filters.PriceFilter == "no_usd" {
		query += " AND price_usd IS NULL"
	} else if filters.PriceFilter == "with_price" {
		query += " AND (price_mdl IS NOT NULL OR price_eur IS NOT NULL OR price_usd IS NOT NULL)"
	}

	// Stock filters
	if filters.StockFilter == "in_stock" {
		query += " AND total_stock > 0"
	} else if filters.StockFilter == "out_of_stock" {
		query += " AND (total_stock = 0 OR total_stock IS NULL)"
	} else if filters.StockFilter == "low_stock" {
		query += " AND total_stock > 0 AND total_stock <= 5"
	}

	// Status filters
	if filters.StatusFilter == "active" {
		query += " AND is_active = true"
	} else if filters.StatusFilter == "inactive" {
		query += " AND is_active = false"
	}

	result, err := r.pool.Exec(ctx, query, args...)
	if err != nil {
		return 0, err
	}
	return int(result.RowsAffected()), nil
}

// GetCategoriesByIDs fetches multiple categories by their IDs
func (r *Repository) GetCategoriesByIDs(ctx context.Context, ids []uuid.UUID) ([]*models.Category, error) {
	if len(ids) == 0 {
		return []*models.Category{}, nil
	}

	// Build IN clause
	args := make([]interface{}, len(ids))
	placeholders := make([]string, len(ids))
	for i, id := range ids {
		placeholders[i] = fmt.Sprintf("$%d", i+1)
		args[i] = id
	}

	query := fmt.Sprintf(`
		SELECT id, ultra_id, code, parent_id, parent_ultra_id, name, slug, sort_order,
		       image_url, product_count, is_active, created_at, updated_at
		FROM categories
		WHERE id IN (%s)
	`, strings.Join(placeholders, ", "))

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	categories := make([]*models.Category, 0)
	for rows.Next() {
		var category models.Category
		err := rows.Scan(
			&category.ID, &category.UltraID, &category.Code, &category.ParentID,
			&category.ParentUltraID, &category.Name, &category.Slug, &category.SortOrder,
			&category.ImageURL, &category.ProductCount, &category.IsActive,
			&category.CreatedAt, &category.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		categories = append(categories, &category)
	}

	return categories, nil
}

// CountProperties returns the total count of all properties
func (r *Repository) CountProperties(ctx context.Context) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM properties").Scan(&count)
	return count, err
}

// CountCharacteristics returns the total count of all characteristics
func (r *Repository) CountCharacteristics(ctx context.Context) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM characteristics WHERE is_active = true").Scan(&count)
	return count, err
}

// ============================================================================
// PROPERTIES
// ============================================================================

func (r *Repository) UpsertProperties(ctx context.Context, productUltraID string, properties []*models.PropertyInput) (int, error) {
	if len(properties) == 0 {
		return 0, nil
	}

	// Get product ID from ultra_id
	var productID uuid.UUID
	err := r.pool.QueryRow(ctx, "SELECT id FROM products WHERE ultra_id = $1", productUltraID).Scan(&productID)
	if err != nil {
		return 0, fmt.Errorf("product not found: %s", productUltraID)
	}

	query := `
		INSERT INTO properties (
			product_id, property_uuid, property_name, property_code, value, value_type,
			group_uuid, group_name, sort_order, is_filter, is_modification
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
		)
		ON CONFLICT (product_id, property_uuid) DO UPDATE SET
			property_name = EXCLUDED.property_name,
			property_code = EXCLUDED.property_code,
			value = EXCLUDED.value,
			value_type = EXCLUDED.value_type,
			group_uuid = EXCLUDED.group_uuid,
			group_name = EXCLUDED.group_name,
			sort_order = EXCLUDED.sort_order,
			is_filter = EXCLUDED.is_filter,
			is_modification = EXCLUDED.is_modification,
			updated_at = NOW()
	`

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	count := 0
	for _, prop := range properties {
		_, err := tx.Exec(ctx, query,
			productID,
			prop.PropertyUUID,
			prop.PropertyName,
			prop.PropertyCode,
			prop.Value,
			prop.ValueType,
			prop.GroupUUID,
			prop.GroupName,
			prop.SortOrder,
			prop.IsFilter,
			prop.IsModification,
		)
		if err != nil {
			return count, fmt.Errorf("insert property %s: %w", prop.PropertyName, err)
		}
		count++
	}

	if err := tx.Commit(ctx); err != nil {
		return count, fmt.Errorf("commit transaction: %w", err)
	}

	return count, nil
}

func (r *Repository) GetProductProperties(ctx context.Context, productID uuid.UUID) ([]*models.Property, error) {
	query := `
		SELECT id, product_id, property_uuid, property_name, property_code, value, value_type,
		       group_uuid, group_name, sort_order, is_filter, is_modification, created_at, updated_at
		FROM properties
		WHERE product_id = $1
		ORDER BY group_name, sort_order, property_name
	`

	rows, err := r.pool.Query(ctx, query, productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	properties := make([]*models.Property, 0)
	for rows.Next() {
		var prop models.Property
		err := rows.Scan(
			&prop.ID, &prop.ProductID, &prop.PropertyUUID, &prop.PropertyName, &prop.PropertyCode,
			&prop.Value, &prop.ValueType, &prop.GroupUUID, &prop.GroupName, &prop.SortOrder,
			&prop.IsFilter, &prop.IsModification, &prop.CreatedAt, &prop.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		properties = append(properties, &prop)
	}

	return properties, nil
}

// PropertyFilter represents filtering options for properties
type PropertyFilter struct {
	ProductID       *uuid.UUID
	PropertyName    string
	GroupName       string
	ValueType       string
	IsFilter        *bool
	IsModification  *bool
	Search          string
	CreatedAfter    *time.Time
	CreatedBefore   *time.Time
	SortBy          string // "name_asc", "name_desc", "sort_order_asc", "created_desc", "updated_desc"
}

// ListProperties returns a paginated list of properties with optional filtering
func (r *Repository) ListProperties(ctx context.Context, filter *PropertyFilter, limit, offset int) ([]*models.Property, error) {
	query := `
		SELECT p.id, p.product_id, p.property_uuid, p.property_name, p.property_code, p.value, p.value_type,
		       p.group_uuid, p.group_name, p.sort_order, p.is_filter, p.is_modification, p.created_at, p.updated_at,
		       prod.name as product_name, prod.code as product_code
		FROM properties p
		LEFT JOIN products prod ON p.product_id = prod.id
		WHERE 1=1
	`

	args := make([]interface{}, 0)
	argPos := 1

	if filter != nil {
		// Search filter (searches across property_name, property_code, value)
		if filter.Search != "" {
			query += fmt.Sprintf(" AND (p.property_name ILIKE $%d OR p.property_code ILIKE $%d OR p.value ILIKE $%d)", argPos, argPos, argPos)
			searchPattern := "%" + filter.Search + "%"
			args = append(args, searchPattern)
			argPos++
		}

		// Product ID filter
		if filter.ProductID != nil {
			query += fmt.Sprintf(" AND p.product_id = $%d", argPos)
			args = append(args, filter.ProductID)
			argPos++
		}

		// Property name filter (exact match)
		if filter.PropertyName != "" {
			query += fmt.Sprintf(" AND p.property_name = $%d", argPos)
			args = append(args, filter.PropertyName)
			argPos++
		}

		// Group name filter
		if filter.GroupName != "" {
			query += fmt.Sprintf(" AND p.group_name = $%d", argPos)
			args = append(args, filter.GroupName)
			argPos++
		}

		// Value type filter
		if filter.ValueType != "" {
			query += fmt.Sprintf(" AND p.value_type = $%d", argPos)
			args = append(args, filter.ValueType)
			argPos++
		}

		// Is filter flag
		if filter.IsFilter != nil {
			query += fmt.Sprintf(" AND p.is_filter = $%d", argPos)
			args = append(args, *filter.IsFilter)
			argPos++
		}

		// Is modification flag
		if filter.IsModification != nil {
			query += fmt.Sprintf(" AND p.is_modification = $%d", argPos)
			args = append(args, *filter.IsModification)
			argPos++
		}

		// Date range filters
		if filter.CreatedAfter != nil {
			query += fmt.Sprintf(" AND p.created_at >= $%d", argPos)
			args = append(args, filter.CreatedAfter)
			argPos++
		}

		if filter.CreatedBefore != nil {
			query += fmt.Sprintf(" AND p.created_at <= $%d", argPos)
			args = append(args, filter.CreatedBefore)
			argPos++
		}

		// Sorting
		switch filter.SortBy {
		case "name_asc":
			query += " ORDER BY p.property_name ASC"
		case "name_desc":
			query += " ORDER BY p.property_name DESC"
		case "sort_order_asc":
			query += " ORDER BY p.sort_order ASC"
		case "created_desc":
			query += " ORDER BY p.created_at DESC"
		case "updated_desc":
			query += " ORDER BY p.updated_at DESC"
		default:
			query += " ORDER BY p.created_at DESC"
		}
	} else {
		query += " ORDER BY p.created_at DESC"
	}

	// Add pagination
	query += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argPos, argPos+1)
	args = append(args, limit, offset)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query properties: %w", err)
	}
	defer rows.Close()

	properties := make([]*models.Property, 0)
	for rows.Next() {
		var prop models.Property
		var productName, productCode *string

		err := rows.Scan(
			&prop.ID, &prop.ProductID, &prop.PropertyUUID, &prop.PropertyName, &prop.PropertyCode,
			&prop.Value, &prop.ValueType, &prop.GroupUUID, &prop.GroupName, &prop.SortOrder,
			&prop.IsFilter, &prop.IsModification, &prop.CreatedAt, &prop.UpdatedAt,
			&productName, &productCode,
		)
		if err != nil {
			return nil, fmt.Errorf("scan property: %w", err)
		}

		// Note: product_name and product_code are not in the Property model
		// but we'll add them in a PropertyWithProduct model for the handler
		properties = append(properties, &prop)
	}

	return properties, nil
}

// CountPropertiesFiltered returns the total count of properties matching the filter
func (r *Repository) CountPropertiesFiltered(ctx context.Context, filter *PropertyFilter) (int, error) {
	query := `
		SELECT COUNT(*)
		FROM properties p
		WHERE 1=1
	`

	args := make([]interface{}, 0)
	argPos := 1

	if filter != nil {
		if filter.Search != "" {
			query += fmt.Sprintf(" AND (p.property_name ILIKE $%d OR p.property_code ILIKE $%d OR p.value ILIKE $%d)", argPos, argPos, argPos)
			searchPattern := "%" + filter.Search + "%"
			args = append(args, searchPattern)
			argPos++
		}

		if filter.ProductID != nil {
			query += fmt.Sprintf(" AND p.product_id = $%d", argPos)
			args = append(args, filter.ProductID)
			argPos++
		}

		if filter.PropertyName != "" {
			query += fmt.Sprintf(" AND p.property_name = $%d", argPos)
			args = append(args, filter.PropertyName)
			argPos++
		}

		if filter.GroupName != "" {
			query += fmt.Sprintf(" AND p.group_name = $%d", argPos)
			args = append(args, filter.GroupName)
			argPos++
		}

		if filter.ValueType != "" {
			query += fmt.Sprintf(" AND p.value_type = $%d", argPos)
			args = append(args, filter.ValueType)
			argPos++
		}

		if filter.IsFilter != nil {
			query += fmt.Sprintf(" AND p.is_filter = $%d", argPos)
			args = append(args, *filter.IsFilter)
			argPos++
		}

		if filter.IsModification != nil {
			query += fmt.Sprintf(" AND p.is_modification = $%d", argPos)
			args = append(args, *filter.IsModification)
			argPos++
		}

		if filter.CreatedAfter != nil {
			query += fmt.Sprintf(" AND p.created_at >= $%d", argPos)
			args = append(args, filter.CreatedAfter)
			argPos++
		}

		if filter.CreatedBefore != nil {
			query += fmt.Sprintf(" AND p.created_at <= $%d", argPos)
			args = append(args, filter.CreatedBefore)
			argPos++
		}
	}

	var count int
	err := r.pool.QueryRow(ctx, query, args...).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("count properties: %w", err)
	}

	return count, nil
}

// GetProperty retrieves a single property by ID with product details
func (r *Repository) GetProperty(ctx context.Context, id uuid.UUID) (*models.Property, error) {
	query := `
		SELECT p.id, p.product_id, p.property_uuid, p.property_name, p.property_code, p.value, p.value_type,
		       p.group_uuid, p.group_name, p.sort_order, p.is_filter, p.is_modification, p.created_at, p.updated_at
		FROM properties p
		WHERE p.id = $1
	`

	var prop models.Property
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&prop.ID, &prop.ProductID, &prop.PropertyUUID, &prop.PropertyName, &prop.PropertyCode,
		&prop.Value, &prop.ValueType, &prop.GroupUUID, &prop.GroupName, &prop.SortOrder,
		&prop.IsFilter, &prop.IsModification, &prop.CreatedAt, &prop.UpdatedAt,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("property not found")
		}
		return nil, fmt.Errorf("get property: %w", err)
	}

	return &prop, nil
}

// CreatePropertyRequest represents the request body for creating a property
type CreatePropertyRequest struct {
	ProductID      uuid.UUID `json:"product_id"`
	PropertyUUID   *string   `json:"property_uuid"`
	PropertyName   string    `json:"property_name"`
	PropertyCode   *string   `json:"property_code"`
	Value          *string   `json:"value"`
	ValueType      *string   `json:"value_type"`
	GroupUUID      *string   `json:"group_uuid"`
	GroupName      *string   `json:"group_name"`
	SortOrder      int       `json:"sort_order"`
	IsFilter       bool      `json:"is_filter"`
	IsModification bool      `json:"is_modification"`
}

// CreateProperty creates a new property
func (r *Repository) CreateProperty(ctx context.Context, req *CreatePropertyRequest) (*models.Property, error) {
	query := `
		INSERT INTO properties (
			product_id, property_uuid, property_name, property_code, value, value_type,
			group_uuid, group_name, sort_order, is_filter, is_modification
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id, product_id, property_uuid, property_name, property_code, value, value_type,
		          group_uuid, group_name, sort_order, is_filter, is_modification, created_at, updated_at
	`

	var prop models.Property
	err := r.pool.QueryRow(ctx, query,
		req.ProductID, req.PropertyUUID, req.PropertyName, req.PropertyCode, req.Value, req.ValueType,
		req.GroupUUID, req.GroupName, req.SortOrder, req.IsFilter, req.IsModification,
	).Scan(
		&prop.ID, &prop.ProductID, &prop.PropertyUUID, &prop.PropertyName, &prop.PropertyCode,
		&prop.Value, &prop.ValueType, &prop.GroupUUID, &prop.GroupName, &prop.SortOrder,
		&prop.IsFilter, &prop.IsModification, &prop.CreatedAt, &prop.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("create property: %w", err)
	}

	return &prop, nil
}

// UpdatePropertyRequest represents the request body for updating a property
type UpdatePropertyRequest struct {
	PropertyUUID   *string `json:"property_uuid"`
	PropertyName   *string `json:"property_name"`
	PropertyCode   *string `json:"property_code"`
	Value          *string `json:"value"`
	ValueType      *string `json:"value_type"`
	GroupUUID      *string `json:"group_uuid"`
	GroupName      *string `json:"group_name"`
	SortOrder      *int    `json:"sort_order"`
	IsFilter       *bool   `json:"is_filter"`
	IsModification *bool   `json:"is_modification"`
}

// UpdateProperty updates an existing property
func (r *Repository) UpdateProperty(ctx context.Context, id uuid.UUID, req *UpdatePropertyRequest) (*models.Property, error) {
	// Build dynamic update query
	updates := make([]string, 0)
	args := make([]interface{}, 0)
	argPos := 1

	if req.PropertyUUID != nil {
		updates = append(updates, fmt.Sprintf("property_uuid = $%d", argPos))
		args = append(args, req.PropertyUUID)
		argPos++
	}

	if req.PropertyName != nil {
		updates = append(updates, fmt.Sprintf("property_name = $%d", argPos))
		args = append(args, *req.PropertyName)
		argPos++
	}

	if req.PropertyCode != nil {
		updates = append(updates, fmt.Sprintf("property_code = $%d", argPos))
		args = append(args, req.PropertyCode)
		argPos++
	}

	if req.Value != nil {
		updates = append(updates, fmt.Sprintf("value = $%d", argPos))
		args = append(args, req.Value)
		argPos++
	}

	if req.ValueType != nil {
		updates = append(updates, fmt.Sprintf("value_type = $%d", argPos))
		args = append(args, req.ValueType)
		argPos++
	}

	if req.GroupUUID != nil {
		updates = append(updates, fmt.Sprintf("group_uuid = $%d", argPos))
		args = append(args, req.GroupUUID)
		argPos++
	}

	if req.GroupName != nil {
		updates = append(updates, fmt.Sprintf("group_name = $%d", argPos))
		args = append(args, req.GroupName)
		argPos++
	}

	if req.SortOrder != nil {
		updates = append(updates, fmt.Sprintf("sort_order = $%d", argPos))
		args = append(args, *req.SortOrder)
		argPos++
	}

	if req.IsFilter != nil {
		updates = append(updates, fmt.Sprintf("is_filter = $%d", argPos))
		args = append(args, *req.IsFilter)
		argPos++
	}

	if req.IsModification != nil {
		updates = append(updates, fmt.Sprintf("is_modification = $%d", argPos))
		args = append(args, *req.IsModification)
		argPos++
	}

	if len(updates) == 0 {
		return nil, fmt.Errorf("no fields to update")
	}

	updates = append(updates, fmt.Sprintf("updated_at = NOW()"))

	query := fmt.Sprintf(`
		UPDATE properties
		SET %s
		WHERE id = $%d
		RETURNING id, product_id, property_uuid, property_name, property_code, value, value_type,
		          group_uuid, group_name, sort_order, is_filter, is_modification, created_at, updated_at
	`, strings.Join(updates, ", "), argPos)

	args = append(args, id)

	var prop models.Property
	err := r.pool.QueryRow(ctx, query, args...).Scan(
		&prop.ID, &prop.ProductID, &prop.PropertyUUID, &prop.PropertyName, &prop.PropertyCode,
		&prop.Value, &prop.ValueType, &prop.GroupUUID, &prop.GroupName, &prop.SortOrder,
		&prop.IsFilter, &prop.IsModification, &prop.CreatedAt, &prop.UpdatedAt,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("property not found")
		}
		return nil, fmt.Errorf("update property: %w", err)
	}

	return &prop, nil
}

// DeleteProperty deletes a property by ID
func (r *Repository) DeleteProperty(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM properties WHERE id = $1`

	result, err := r.pool.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("delete property: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("property not found")
	}

	return nil
}

// BulkUpdatePropertiesRequest represents bulk update request
type BulkUpdatePropertiesRequest struct {
	IDs            []uuid.UUID `json:"ids"`
	IsFilter       *bool       `json:"is_filter"`
	IsModification *bool       `json:"is_modification"`
	SortOrder      *int        `json:"sort_order"`
	GroupName      *string     `json:"group_name"`
}

// BulkUpdateProperties updates multiple properties at once
func (r *Repository) BulkUpdateProperties(ctx context.Context, req *BulkUpdatePropertiesRequest) (int, error) {
	if len(req.IDs) == 0 {
		return 0, fmt.Errorf("no property IDs provided")
	}

	updates := make([]string, 0)
	args := make([]interface{}, 0)
	argPos := 1

	if req.IsFilter != nil {
		updates = append(updates, fmt.Sprintf("is_filter = $%d", argPos))
		args = append(args, *req.IsFilter)
		argPos++
	}

	if req.IsModification != nil {
		updates = append(updates, fmt.Sprintf("is_modification = $%d", argPos))
		args = append(args, *req.IsModification)
		argPos++
	}

	if req.SortOrder != nil {
		updates = append(updates, fmt.Sprintf("sort_order = $%d", argPos))
		args = append(args, *req.SortOrder)
		argPos++
	}

	if req.GroupName != nil {
		updates = append(updates, fmt.Sprintf("group_name = $%d", argPos))
		args = append(args, req.GroupName)
		argPos++
	}

	if len(updates) == 0 {
		return 0, fmt.Errorf("no fields to update")
	}

	updates = append(updates, "updated_at = NOW()")

	// Build IN clause for IDs
	idPlaceholders := make([]string, len(req.IDs))
	for i, id := range req.IDs {
		idPlaceholders[i] = fmt.Sprintf("$%d", argPos)
		args = append(args, id)
		argPos++
	}

	query := fmt.Sprintf(`
		UPDATE properties
		SET %s
		WHERE id IN (%s)
	`, strings.Join(updates, ", "), strings.Join(idPlaceholders, ", "))

	result, err := r.pool.Exec(ctx, query, args...)
	if err != nil {
		return 0, fmt.Errorf("bulk update properties: %w", err)
	}

	return int(result.RowsAffected()), nil
}

// BulkDeleteProperties deletes multiple properties by IDs
func (r *Repository) BulkDeleteProperties(ctx context.Context, ids []uuid.UUID) (int, error) {
	if len(ids) == 0 {
		return 0, fmt.Errorf("no property IDs provided")
	}

	// Build IN clause
	placeholders := make([]string, len(ids))
	args := make([]interface{}, len(ids))
	for i, id := range ids {
		placeholders[i] = fmt.Sprintf("$%d", i+1)
		args[i] = id
	}

	query := fmt.Sprintf(`DELETE FROM properties WHERE id IN (%s)`, strings.Join(placeholders, ", "))

	result, err := r.pool.Exec(ctx, query, args...)
	if err != nil {
		return 0, fmt.Errorf("bulk delete properties: %w", err)
	}

	return int(result.RowsAffected()), nil
}

// PropertyStats represents property statistics
type PropertyStats struct {
	TotalProperties        int                `json:"total_properties"`
	UniqueGroups           int                `json:"unique_groups"`
	FilterProperties       int                `json:"filter_properties"`
	ModificationProperties int                `json:"modification_properties"`
	ByType                 map[string]int     `json:"by_type"`
	UniqueProductsCount    int                `json:"unique_products_count"`
}

// GetPropertyStats returns statistics about properties
func (r *Repository) GetPropertyStats(ctx context.Context) (*PropertyStats, error) {
	stats := &PropertyStats{
		ByType: make(map[string]int),
	}

	// Total properties
	err := r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM properties").Scan(&stats.TotalProperties)
	if err != nil {
		return nil, fmt.Errorf("count total properties: %w", err)
	}

	// Unique groups
	err = r.pool.QueryRow(ctx, "SELECT COUNT(DISTINCT group_name) FROM properties WHERE group_name IS NOT NULL").Scan(&stats.UniqueGroups)
	if err != nil {
		return nil, fmt.Errorf("count unique groups: %w", err)
	}

	// Filter properties
	err = r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM properties WHERE is_filter = true").Scan(&stats.FilterProperties)
	if err != nil {
		return nil, fmt.Errorf("count filter properties: %w", err)
	}

	// Modification properties
	err = r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM properties WHERE is_modification = true").Scan(&stats.ModificationProperties)
	if err != nil {
		return nil, fmt.Errorf("count modification properties: %w", err)
	}

	// Unique products with properties
	err = r.pool.QueryRow(ctx, "SELECT COUNT(DISTINCT product_id) FROM properties").Scan(&stats.UniqueProductsCount)
	if err != nil {
		return nil, fmt.Errorf("count unique products: %w", err)
	}

	// Properties by type
	rows, err := r.pool.Query(ctx, "SELECT value_type, COUNT(*) FROM properties WHERE value_type IS NOT NULL GROUP BY value_type")
	if err != nil {
		return nil, fmt.Errorf("query properties by type: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var valueType string
		var count int
		if err := rows.Scan(&valueType, &count); err != nil {
			return nil, fmt.Errorf("scan type count: %w", err)
		}
		stats.ByType[valueType] = count
	}

	return stats, nil
}

// GetPropertyGroups returns all unique property group names
func (r *Repository) GetPropertyGroups(ctx context.Context) ([]string, error) {
	query := `
		SELECT DISTINCT group_name
		FROM properties
		WHERE group_name IS NOT NULL AND group_name != ''
		ORDER BY group_name
	`

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("query property groups: %w", err)
	}
	defer rows.Close()

	groups := make([]string, 0)
	for rows.Next() {
		var groupName string
		if err := rows.Scan(&groupName); err != nil {
			return nil, fmt.Errorf("scan group name: %w", err)
		}
		groups = append(groups, groupName)
	}

	return groups, nil
}

// ============================================================================
// CHARACTERISTICS
// ============================================================================

func (r *Repository) UpsertCharacteristics(ctx context.Context, productUltraID string, characteristics []*models.CharacteristicInput) (int, error) {
	if len(characteristics) == 0 {
		return 0, nil
	}

	// Get product ID from ultra_id
	var productID uuid.UUID
	err := r.pool.QueryRow(ctx, "SELECT id FROM products WHERE ultra_id = $1", productUltraID).Scan(&productID)
	if err != nil {
		return 0, fmt.Errorf("product not found: %s", productUltraID)
	}

	query := `
		INSERT INTO characteristics (
			product_id, ultra_id, code, reference, name
		) VALUES (
			$1, $2, $3, $4, $5
		)
		ON CONFLICT (product_id, ultra_id) DO UPDATE SET
			code = EXCLUDED.code,
			reference = EXCLUDED.reference,
			name = EXCLUDED.name,
			updated_at = NOW()
	`

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	count := 0
	for _, char := range characteristics {
		_, err := tx.Exec(ctx, query,
			productID,
			char.UltraID,
			char.Code,
			char.Reference,
			char.Name,
		)
		if err != nil {
			return count, fmt.Errorf("insert characteristic %s: %w", char.UltraID, err)
		}
		count++
	}

	if err := tx.Commit(ctx); err != nil {
		return count, fmt.Errorf("commit transaction: %w", err)
	}

	return count, nil
}

func (r *Repository) GetProductCharacteristics(ctx context.Context, productID uuid.UUID) ([]*models.Characteristic, error) {
	query := `
		SELECT id, product_id, ultra_id, code, reference, name, prices,
		       stock_warehouse, stock_showroom, stock_total, is_active, created_at, updated_at
		FROM characteristics
		WHERE product_id = $1
		ORDER BY name
	`

	rows, err := r.pool.Query(ctx, query, productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	characteristics := make([]*models.Characteristic, 0)
	for rows.Next() {
		var char models.Characteristic
		err := rows.Scan(
			&char.ID, &char.ProductID, &char.UltraID, &char.Code, &char.Reference, &char.Name,
			&char.Prices, &char.StockWarehouse, &char.StockShowroom, &char.StockTotal,
			&char.IsActive, &char.CreatedAt, &char.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		characteristics = append(characteristics, &char)
	}

	return characteristics, nil
}

// GetProductVariants returns all products that share the same variant_group_id as the given product
func (r *Repository) GetProductVariants(ctx context.Context, productID uuid.UUID) ([]*models.Product, error) {
	// First, get the variant_group_id of the product
	var variantGroupID *uuid.UUID
	err := r.pool.QueryRow(ctx, "SELECT variant_group_id FROM products WHERE id = $1", productID).Scan(&variantGroupID)
	if err != nil {
		return nil, fmt.Errorf("product not found: %w", err)
	}

	// If product has no variant group, return just itself
	if variantGroupID == nil {
		product, err := r.GetProduct(ctx, productID)
		if err != nil {
			return nil, err
		}
		return []*models.Product{product}, nil
	}

	// Get all products with the same variant_group_id
	query := `
		SELECT id, ultra_id, code, article, name, slug, description, brand_id, category_id,
		       parent_id, brand_ultra_id, category_ultra_id, parent_ultra_id, main_image_url,
		       images, warranty, barcodes, price_min, price_max, total_stock, is_in_stock,
		       is_active, is_service, created_at, updated_at,
		       prices, price_mdl, price_eur, price_usd, variant_group_id, is_group
		FROM products
		WHERE variant_group_id = $1
		ORDER BY name ASC
	`

	rows, err := r.pool.Query(ctx, query, variantGroupID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	products := make([]*models.Product, 0)
	for rows.Next() {
		var product models.Product
		err := rows.Scan(
			&product.ID, &product.UltraID, &product.Code, &product.Article, &product.Name,
			&product.Slug, &product.Description, &product.BrandID, &product.CategoryID,
			&product.ParentID, &product.BrandUltraID, &product.CategoryUltraID, &product.ParentUltraID,
			&product.MainImageURL, &product.Images, &product.Warranty, &product.Barcodes,
			&product.PriceMin, &product.PriceMax, &product.TotalStock, &product.IsInStock,
			&product.IsActive, &product.IsService, &product.CreatedAt, &product.UpdatedAt,
			&product.Prices, &product.PriceMDL, &product.PriceEUR, &product.PriceUSD,
			&product.VariantGroupID, &product.IsGroup,
		)
		if err != nil {
			return nil, err
		}
		products = append(products, &product)
	}

	return products, nil
}

// UpdateCharacteristicPrices updates prices for characteristics
func (r *Repository) UpdateCharacteristicPrices(ctx context.Context, prices []*models.PriceInput) (int, error) {
	if len(prices) == 0 {
		return 0, nil
	}

	// Group prices by product+characteristic
	priceMap := make(map[string][]models.CharacteristicPrice)
	productCharMap := make(map[string]struct{})

	for _, p := range prices {
		key := p.ProductUltraID + "|" + p.CharacteristicUUID
		productCharMap[key] = struct{}{}
		priceMap[key] = append(priceMap[key], models.CharacteristicPrice{
			Price:    p.Price,
			Currency: p.Currency,
			Type:     p.PriceType,
			TypeUUID: p.PriceTypeUUID,
		})
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	count := 0
	for key := range productCharMap {
		parts := strings.SplitN(key, "|", 2)
		productUltraID := parts[0]
		charUltraID := parts[1]
		pricesForChar := priceMap[key]

		// Convert to JSONB
		pricesJSON, err := models.JSONBArray(toInterfaceSlicePrices(pricesForChar)).Value()
		if err != nil {
			return count, fmt.Errorf("marshal prices: %w", err)
		}

		if charUltraID == "" || charUltraID == "00000000-0000-0000-0000-000000000000" {
			// Product-level price - store ALL currencies in prices JSONB
			_, err = tx.Exec(ctx, `
				UPDATE products
				SET prices = $1, updated_at = NOW()
				WHERE ultra_id = $2
			`, pricesJSON, productUltraID)
		} else {
			// Characteristic-level price
			_, err = tx.Exec(ctx, `
				UPDATE characteristics c
				SET prices = $1, updated_at = NOW()
				FROM products p
				WHERE c.product_id = p.id
				AND p.ultra_id = $2
				AND c.ultra_id = $3
			`, pricesJSON, productUltraID, charUltraID)
		}

		if err != nil {
			return count, fmt.Errorf("update price for %s: %w", key, err)
		}
		count++
	}

	if err := tx.Commit(ctx); err != nil {
		return count, fmt.Errorf("commit transaction: %w", err)
	}

	return count, nil
}

// UpdateCharacteristicStock updates stock for characteristics
func (r *Repository) UpdateCharacteristicStock(ctx context.Context, stocks []*models.StockInput) (int, error) {
	if len(stocks) == 0 {
		return 0, nil
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	count := 0
	for _, s := range stocks {
		total := s.Warehouse + s.Showroom

		if s.CharacteristicUUID == "" || s.CharacteristicUUID == "00000000-0000-0000-0000-000000000000" {
			// Product-level stock
			_, err = tx.Exec(ctx, `
				UPDATE products
				SET total_stock = $1, is_in_stock = $2, updated_at = NOW()
				WHERE ultra_id = $3
			`, total, total > 0, s.ProductUltraID)
		} else {
			// Characteristic-level stock
			_, err = tx.Exec(ctx, `
				UPDATE characteristics c
				SET stock_warehouse = $1, stock_showroom = $2, stock_total = $3, updated_at = NOW()
				FROM products p
				WHERE c.product_id = p.id
				AND p.ultra_id = $4
				AND c.ultra_id = $5
			`, s.Warehouse, s.Showroom, total, s.ProductUltraID, s.CharacteristicUUID)
		}

		if err != nil {
			return count, fmt.Errorf("update stock for %s: %w", s.ProductUltraID, err)
		}
		count++
	}

	if err := tx.Commit(ctx); err != nil {
		return count, fmt.Errorf("commit transaction: %w", err)
	}

	return count, nil
}

// UpdateProductAggregates recalculates product price/stock from characteristics
// Uses MDL as the primary currency for price_min/price_max
func (r *Repository) UpdateProductAggregates(ctx context.Context) error {
	_, err := r.pool.Exec(ctx, `
		WITH stock_agg AS (
			-- Calculate stock separately to avoid duplication from price expansion
			SELECT product_id, COALESCE(SUM(stock_total), 0) as total_stock
			FROM characteristics
			WHERE is_active = true
			GROUP BY product_id
		),
		price_agg AS (
			-- Extract prices from characteristics using LEFT JOIN LATERAL to handle empty arrays
			SELECT
				c.product_id,
				MIN(CASE WHEN price_item->>'currency' = 'MDL' THEN NULLIF(price_item->>'price', '')::DECIMAL END) as min_price,
				MAX(CASE WHEN price_item->>'currency' = 'MDL' THEN NULLIF(price_item->>'price', '')::DECIMAL END) as max_price,
				MAX(CASE WHEN price_item->>'currency' = 'MDL' THEN NULLIF(price_item->>'price', '')::DECIMAL END) as price_mdl,
				MAX(CASE WHEN price_item->>'currency' = 'EUR' THEN NULLIF(price_item->>'price', '')::DECIMAL END) as price_eur,
				MAX(CASE WHEN price_item->>'currency' = 'USD' THEN NULLIF(price_item->>'price', '')::DECIMAL END) as price_usd
			FROM characteristics c
			LEFT JOIN LATERAL jsonb_array_elements(c.prices) AS price_item ON true
			WHERE c.is_active = true
			GROUP BY c.product_id
		)
		UPDATE products p
		SET
			price_min = COALESCE(pa.min_price, p.price_min),
			price_max = COALESCE(pa.max_price, p.price_max),
			price_mdl = pa.price_mdl,
			price_eur = pa.price_eur,
			price_usd = pa.price_usd,
			total_stock = sa.total_stock,
			is_in_stock = sa.total_stock > 0,
			updated_at = NOW()
		FROM stock_agg sa
		LEFT JOIN price_agg pa ON pa.product_id = sa.product_id
		WHERE p.id = sa.product_id
	`)
	return err
}

// UpdateProductPricesFromJSONB extracts currency-specific prices from the products.prices JSONB field
// This is called after UpdateCharacteristicPrices for products without characteristics
// The Ultra API typically returns prices in order [EUR, USD, MDL] but this is not guaranteed
// We use heuristics: MDL is always the largest value (1 EUR ≈ 18 MDL)
// Note: Products with fewer than 3 prices will have NULL for missing currencies
func (r *Repository) UpdateProductPricesFromJSONB(ctx context.Context) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE products p
		SET
			-- Use heuristics to assign currencies:
			-- MDL = GREATEST (largest value, since 1 EUR ≈ 18 MDL)
			-- EUR = LEAST (smallest value)
			-- USD = middle value (sum - max - min)
			price_mdl = COALESCE(
				GREATEST(
					NULLIF(p.prices->0->>'price', '')::DECIMAL,
					NULLIF(p.prices->1->>'price', '')::DECIMAL,
					NULLIF(p.prices->2->>'price', '')::DECIMAL
				),
				p.price_mdl
			),
			price_eur = COALESCE(
				LEAST(
					NULLIF(p.prices->0->>'price', '')::DECIMAL,
					NULLIF(p.prices->1->>'price', '')::DECIMAL,
					NULLIF(p.prices->2->>'price', '')::DECIMAL
				),
				p.price_eur
			),
			price_usd = COALESCE(
				(NULLIF(p.prices->0->>'price', '')::DECIMAL +
				 NULLIF(p.prices->1->>'price', '')::DECIMAL +
				 NULLIF(p.prices->2->>'price', '')::DECIMAL) -
				GREATEST(
					NULLIF(p.prices->0->>'price', '')::DECIMAL,
					NULLIF(p.prices->1->>'price', '')::DECIMAL,
					NULLIF(p.prices->2->>'price', '')::DECIMAL
				) -
				LEAST(
					NULLIF(p.prices->0->>'price', '')::DECIMAL,
					NULLIF(p.prices->1->>'price', '')::DECIMAL,
					NULLIF(p.prices->2->>'price', '')::DECIMAL
				),
				p.price_usd
			),
			-- price_min/max use MDL as primary currency
			price_min = COALESCE(
				GREATEST(
					NULLIF(p.prices->0->>'price', '')::DECIMAL,
					NULLIF(p.prices->1->>'price', '')::DECIMAL,
					NULLIF(p.prices->2->>'price', '')::DECIMAL
				),
				p.price_min
			),
			price_max = COALESCE(
				GREATEST(
					NULLIF(p.prices->0->>'price', '')::DECIMAL,
					NULLIF(p.prices->1->>'price', '')::DECIMAL,
					NULLIF(p.prices->2->>'price', '')::DECIMAL
				),
				p.price_max
			),
			updated_at = NOW()
		WHERE jsonb_array_length(p.prices) >= 3
	`)
	return err
}

// GroupProductVariants groups product variants by base name
// Products with similar names (e.g., "iPhone 16 128GB" and "iPhone 16 256GB") are grouped together
// Handles multiple naming patterns:
// - Standard: "iPhone 16 Pro Max, 512GB Desert Titanium MD"
// - Samsung RAM/Storage: "Fold7 12/256Gb Jet Black"
func (r *Repository) GroupProductVariants(ctx context.Context) error {
	_, err := r.pool.Exec(ctx, `
		WITH variant_groups AS (
			SELECT
				brand_id,
				category_id,
				-- Extract base name by removing storage patterns and colors
				-- Step 1: Remove RAM/Storage patterns like "12/256Gb", "16/1Tb"
				-- Step 2: Remove standalone storage like ", 512GB", " 256GB"
				-- Step 3: Remove multi-word colors (Jet Black, Blue Shadow, etc.)
				-- Step 4: Remove single-word colors (Black, White, Silver, etc.)
				-- Step 5: Replace remaining commas with space
				-- Step 6: Clean up multiple spaces
				trim(regexp_replace(
					regexp_replace(
						regexp_replace(
							regexp_replace(
								regexp_replace(
									regexp_replace(name, '\d+/\d+\s*(Gb|Tb|GB|TB)', '', 'gi'),
									',?\s*\d+\s*(GB|TB)', '', 'gi'
								),
								'\s+(Jet Black|Blue Shadow|Silver Shadow|Natural Titanium|Blue Titanium|White Titanium|Black Titanium|Desert Titanium|Space Gray|Space Grey|Rose Gold|Midnight Blue|Midnight Green|Pacific Blue|Sierra Blue|Alpine Green|Deep Purple|Phantom Black|Phantom White|Mystic Bronze|Cosmic Gray|Cosmic Black|Prism White|Prism Black|Cloud Blue|Cloud Pink|Cloud White|Mineral Grey|Mineral Gray|Starlight Blue|Ultramarine Blue|Coral Orange|Ocean Blue)\s*$', '', 'gi'
							),
							'\s+(Black|White|Silver|Gold|Blue|Red|Green|Pink|Purple|Yellow|Orange|Gray|Grey|Bronze|Coral|Graphite|Titanium|Cream|Lavender|Mint|Burgundy|Navy|Teal|Brown|Beige|Champagne|Violet|Starlight|Midnight|Product)\s*$', '', 'gi'
						),
						',\s*', ' ', 'g'
					),
					'\s+', ' ', 'g'
				)) as base_name,
				array_agg(id ORDER BY name) as product_ids,
				count(*) as variant_count
			FROM products
			WHERE is_active = true
			GROUP BY brand_id, category_id,
			         trim(regexp_replace(
						regexp_replace(
							regexp_replace(
								regexp_replace(
									regexp_replace(
										regexp_replace(name, '\d+/\d+\s*(Gb|Tb|GB|TB)', '', 'gi'),
										',?\s*\d+\s*(GB|TB)', '', 'gi'
									),
									'\s+(Jet Black|Blue Shadow|Silver Shadow|Natural Titanium|Blue Titanium|White Titanium|Black Titanium|Desert Titanium|Space Gray|Space Grey|Rose Gold|Midnight Blue|Midnight Green|Pacific Blue|Sierra Blue|Alpine Green|Deep Purple|Phantom Black|Phantom White|Mystic Bronze|Cosmic Gray|Cosmic Black|Prism White|Prism Black|Cloud Blue|Cloud Pink|Cloud White|Mineral Grey|Mineral Gray|Starlight Blue|Ultramarine Blue|Coral Orange|Ocean Blue)\s*$', '', 'gi'
								),
								'\s+(Black|White|Silver|Gold|Blue|Red|Green|Pink|Purple|Yellow|Orange|Gray|Grey|Bronze|Coral|Graphite|Titanium|Cream|Lavender|Mint|Burgundy|Navy|Teal|Brown|Beige|Champagne|Violet|Starlight|Midnight|Product)\s*$', '', 'gi'
							),
							',\s*', ' ', 'g'
						),
						'\s+', ' ', 'g'
					))
			HAVING count(*) > 1
		)
		UPDATE products p
		SET
			variant_group_id = vg.product_ids[1],
			is_group = (p.id = vg.product_ids[1])
		FROM variant_groups vg
		WHERE p.id = ANY(vg.product_ids)
	`)
	return err
}

// GetGroupingStatistics returns statistics about product variant grouping
func (r *Repository) GetGroupingStatistics(ctx context.Context) (int, int, error) {
	query := `
		SELECT
			COUNT(DISTINCT variant_group_id) as total_groups,
			COUNT(*) as total_variants
		FROM products
		WHERE variant_group_id IS NOT NULL
	`

	var totalGroups, totalVariants int
	err := r.pool.QueryRow(ctx, query).Scan(&totalGroups, &totalVariants)
	if err != nil {
		return 0, 0, err
	}

	return totalGroups, totalVariants, nil
}

// ============================================================================
// SYNC LOG
// ============================================================================

func (r *Repository) CreateSyncLog(ctx context.Context, syncType string) (*models.SyncLog, error) {
	query := `
		INSERT INTO sync_logs (sync_type, started_at, status)
		VALUES ($1, $2, 'running')
		RETURNING id, started_at
	`

	var syncLog models.SyncLog
	syncLog.SyncType = syncType
	syncLog.Status = "running"

	err := r.pool.QueryRow(ctx, query, syncType, time.Now()).Scan(
		&syncLog.ID,
		&syncLog.StartedAt,
	)
	if err != nil {
		return nil, err
	}

	return &syncLog, nil
}

func (r *Repository) UpdateSyncLog(ctx context.Context, syncLog *models.SyncLog) error {
	query := `
		UPDATE sync_logs SET
			finished_at = $2,
			duration_seconds = $3,
			status = $4,
			brands_synced = $5,
			categories_synced = $6,
			products_synced = $7,
			properties_synced = $8,
			characteristics_synced = $9,
			prices_synced = $10,
			stock_synced = $11,
			error_message = $12,
			details = $13
		WHERE id = $1
	`

	_, err := r.pool.Exec(ctx, query,
		syncLog.ID,
		syncLog.FinishedAt,
		syncLog.DurationSeconds,
		syncLog.Status,
		syncLog.BrandsSynced,
		syncLog.CategoriesSynced,
		syncLog.ProductsSynced,
		syncLog.PropertiesSynced,
		syncLog.CharacteristicsSynced,
		syncLog.PricesSynced,
		syncLog.StockSynced,
		syncLog.ErrorMessage,
		syncLog.Details,
	)

	return err
}

// ============================================================================
// EXCHANGE RATES
// ============================================================================

func (r *Repository) UpsertExchangeRates(ctx context.Context, rates []*models.ExchangeRate) error {
	if len(rates) == 0 {
		return nil
	}

	query := `
		INSERT INTO exchange_rates (currency_uuid, currency_code, currency_name, rate, updated_at)
		VALUES ($1, $2, $3, $4, NOW())
		ON CONFLICT (currency_uuid) DO UPDATE SET
			currency_code = EXCLUDED.currency_code,
			currency_name = EXCLUDED.currency_name,
			rate = EXCLUDED.rate,
			updated_at = NOW()
	`

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	for _, rate := range rates {
		_, err := tx.Exec(ctx, query,
			rate.CurrencyUUID,
			rate.CurrencyCode,
			rate.CurrencyName,
			rate.Rate,
		)
		if err != nil {
			return fmt.Errorf("insert rate %s: %w", rate.CurrencyCode, err)
		}
	}

	return tx.Commit(ctx)
}

// ============================================================================
// HELPERS
// ============================================================================

func toInterfaceSlice(input []map[string]string) []interface{} {
	result := make([]interface{}, len(input))
	for i, v := range input {
		result[i] = v
	}
	return result
}

func toInterfaceSlicePrices(input []models.CharacteristicPrice) []interface{} {
	result := make([]interface{}, len(input))
	for i, v := range input {
		result[i] = v
	}
	return result
}

// ============================================================================
// DASHBOARD STATISTICS
// ============================================================================

// DashboardStats holds aggregate statistics for the dashboard
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

// GetDashboardStats retrieves aggregate statistics for the CMS dashboard
func (r *Repository) GetDashboardStats(ctx context.Context) (*DashboardStats, error) {
	stats := &DashboardStats{}

	// Get counts in parallel using a single query
	query := `
		SELECT
			(SELECT COUNT(*) FROM products WHERE is_active = true) as total_products,
			(SELECT COUNT(*) FROM brands WHERE is_active = true) as total_brands,
			(SELECT COUNT(*) FROM categories WHERE is_active = true) as total_categories,
			(SELECT COUNT(*) FROM properties) as total_properties,
			(SELECT COUNT(*) FROM characteristics WHERE is_active = true) as total_characteristics,
			(SELECT COUNT(*) FROM products WHERE is_active = true AND jsonb_array_length(prices) > 0) as total_prices,
			(SELECT COUNT(*) FROM products WHERE is_active = true AND is_in_stock = true) as products_in_stock,
			(SELECT COUNT(*) FROM products WHERE is_active = true AND is_in_stock = false) as products_out_of_stock,
			(SELECT COALESCE(SUM(total_stock * COALESCE(price_min, 0)), 0) FROM products WHERE is_active = true) as total_stock_value
	`

	err := r.pool.QueryRow(ctx, query).Scan(
		&stats.TotalProducts,
		&stats.TotalBrands,
		&stats.TotalCategories,
		&stats.TotalProperties,
		&stats.TotalCharacteristics,
		&stats.TotalPrices,
		&stats.ProductsInStock,
		&stats.ProductsOutOfStock,
		&stats.TotalStockValue,
	)
	if err != nil {
		return nil, fmt.Errorf("get dashboard stats: %w", err)
	}

	// Get latest sync info
	syncLog, err := r.GetLatestSyncLog(ctx)
	if err == nil && syncLog != nil {
		stats.LastSyncAt = &syncLog.StartedAt
		stats.LastSyncStatus = syncLog.Status
	}

	// Get recent activity (last 10 sync logs)
	logs, err := r.ListSyncLogs(ctx, 10, 0, "", "")
	if err == nil {
		stats.RecentActivity = make([]map[string]interface{}, len(logs))
		for i, log := range logs {
			stats.RecentActivity[i] = map[string]interface{}{
				"id":         log.ID,
				"type":       log.SyncType,
				"status":     log.Status,
				"started_at": log.StartedAt,
				"duration":   log.DurationSeconds,
			}
		}
	}

	return stats, nil
}

// GetStockSummaryByCategory returns stock levels grouped by category
func (r *Repository) GetStockSummaryByCategory(ctx context.Context) ([]map[string]interface{}, error) {
	query := `
		SELECT
			c.id,
			c.name,
			COUNT(p.id) as product_count,
			COALESCE(SUM(p.total_stock), 0) as total_stock,
			COALESCE(AVG(p.price_min), 0) as avg_price
		FROM categories c
		LEFT JOIN products p ON p.category_id = c.id AND p.is_active = true
		WHERE c.is_active = true
		GROUP BY c.id, c.name
		ORDER BY total_stock DESC
		LIMIT 20
	`

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := make([]map[string]interface{}, 0)
	for rows.Next() {
		var id uuid.UUID
		var name string
		var productCount int
		var totalStock int
		var avgPrice float64

		err := rows.Scan(&id, &name, &productCount, &totalStock, &avgPrice)
		if err != nil {
			return nil, err
		}

		results = append(results, map[string]interface{}{
			"id":            id,
			"name":          name,
			"product_count": productCount,
			"total_stock":   totalStock,
			"avg_price":     avgPrice,
		})
	}

	return results, nil
}

// GetPriceSummary returns price distribution summary
func (r *Repository) GetPriceSummary(ctx context.Context) (map[string]interface{}, error) {
	query := `
		SELECT
			MIN(price_min) as min_price,
			MAX(price_max) as max_price,
			AVG(price_min) as avg_price,
			PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_min) as median_price,
			COUNT(*) FILTER (WHERE price_min < 100) as under_100,
			COUNT(*) FILTER (WHERE price_min >= 100 AND price_min < 500) as range_100_500,
			COUNT(*) FILTER (WHERE price_min >= 500 AND price_min < 1000) as range_500_1000,
			COUNT(*) FILTER (WHERE price_min >= 1000) as over_1000
		FROM products
		WHERE is_active = true AND price_min IS NOT NULL
	`

	var minPrice, maxPrice, avgPrice, medianPrice *float64
	var under100, range100_500, range500_1000, over1000 int

	err := r.pool.QueryRow(ctx, query).Scan(
		&minPrice, &maxPrice, &avgPrice, &medianPrice,
		&under100, &range100_500, &range500_1000, &over1000,
	)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"min_price":      minPrice,
		"max_price":      maxPrice,
		"avg_price":      avgPrice,
		"median_price":   medianPrice,
		"distribution": map[string]int{
			"under_100":      under100,
			"100_to_500":     range100_500,
			"500_to_1000":    range500_1000,
			"over_1000":      over1000,
		},
	}, nil
}

// ============================================================================
// SYNC LOG QUERIES
// ============================================================================

// ListSyncLogs returns paginated sync logs with optional filtering
func (r *Repository) ListSyncLogs(ctx context.Context, limit, offset int, status, syncType string) ([]*models.SyncLog, error) {
	query := `
		SELECT id, sync_type, started_at, finished_at, duration_seconds, status,
		       brands_synced, categories_synced, products_synced, properties_synced,
		       characteristics_synced, prices_synced, stock_synced, error_message, details,
		       selected_steps
		FROM sync_logs
		WHERE 1=1
	`

	args := make([]interface{}, 0)
	argPos := 1

	if status != "" {
		query += fmt.Sprintf(" AND status = $%d", argPos)
		args = append(args, status)
		argPos++
	}

	if syncType != "" {
		query += fmt.Sprintf(" AND sync_type = $%d", argPos)
		args = append(args, syncType)
		argPos++
	}

	query += fmt.Sprintf(" ORDER BY started_at DESC LIMIT $%d OFFSET $%d", argPos, argPos+1)
	args = append(args, limit, offset)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	logs := make([]*models.SyncLog, 0)
	for rows.Next() {
		var log models.SyncLog
		err := rows.Scan(
			&log.ID, &log.SyncType, &log.StartedAt, &log.FinishedAt, &log.DurationSeconds,
			&log.Status, &log.BrandsSynced, &log.CategoriesSynced, &log.ProductsSynced,
			&log.PropertiesSynced, &log.CharacteristicsSynced, &log.PricesSynced,
			&log.StockSynced, &log.ErrorMessage, &log.Details,
			&log.SelectedSteps,
		)
		if err != nil {
			return nil, err
		}
		logs = append(logs, &log)
	}

	return logs, nil
}

// CountSyncLogs returns the total count of sync logs with optional filtering
func (r *Repository) CountSyncLogs(ctx context.Context, status, syncType string) (int, error) {
	query := `SELECT COUNT(*) FROM sync_logs WHERE 1=1`

	args := make([]interface{}, 0)
	argPos := 1

	if status != "" {
		query += fmt.Sprintf(" AND status = $%d", argPos)
		args = append(args, status)
		argPos++
	}

	if syncType != "" {
		query += fmt.Sprintf(" AND sync_type = $%d", argPos)
		args = append(args, syncType)
	}

	var count int
	err := r.pool.QueryRow(ctx, query, args...).Scan(&count)
	return count, err
}

// GetSyncLog returns a specific sync log by ID
func (r *Repository) GetSyncLog(ctx context.Context, id uuid.UUID) (*models.SyncLog, error) {
	query := `
		SELECT id, sync_type, started_at, finished_at, duration_seconds, status,
		       brands_synced, categories_synced, products_synced, properties_synced,
		       characteristics_synced, prices_synced, stock_synced, error_message, details,
		       selected_steps
		FROM sync_logs
		WHERE id = $1
	`

	var log models.SyncLog
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&log.ID, &log.SyncType, &log.StartedAt, &log.FinishedAt, &log.DurationSeconds,
		&log.Status, &log.BrandsSynced, &log.CategoriesSynced, &log.ProductsSynced,
		&log.PropertiesSynced, &log.CharacteristicsSynced, &log.PricesSynced,
		&log.StockSynced, &log.ErrorMessage, &log.Details,
		&log.SelectedSteps,
	)
	if err != nil {
		return nil, err
	}

	return &log, nil
}

// GetLatestSyncLog returns the most recent sync log
func (r *Repository) GetLatestSyncLog(ctx context.Context) (*models.SyncLog, error) {
	query := `
		SELECT id, sync_type, started_at, finished_at, duration_seconds, status,
		       brands_synced, categories_synced, products_synced, properties_synced,
		       characteristics_synced, prices_synced, stock_synced, error_message, details,
		       COALESCE(brands_inserted, 0), COALESCE(brands_updated, 0),
		       COALESCE(categories_inserted, 0), COALESCE(categories_updated, 0),
		       COALESCE(products_inserted, 0), COALESCE(products_updated, 0),
		       COALESCE(properties_inserted, 0), COALESCE(properties_updated, 0),
		       COALESCE(characteristics_inserted, 0), COALESCE(characteristics_updated, 0),
		       COALESCE(prices_updated, 0), COALESCE(stock_updated, 0),
		       selected_steps
		FROM sync_logs
		ORDER BY started_at DESC
		LIMIT 1
	`

	var log models.SyncLog
	err := r.pool.QueryRow(ctx, query).Scan(
		&log.ID, &log.SyncType, &log.StartedAt, &log.FinishedAt, &log.DurationSeconds,
		&log.Status, &log.BrandsSynced, &log.CategoriesSynced, &log.ProductsSynced,
		&log.PropertiesSynced, &log.CharacteristicsSynced, &log.PricesSynced,
		&log.StockSynced, &log.ErrorMessage, &log.Details,
		&log.BrandsInserted, &log.BrandsUpdated,
		&log.CategoriesInserted, &log.CategoriesUpdated,
		&log.ProductsInserted, &log.ProductsUpdated,
		&log.PropertiesInserted, &log.PropertiesUpdated,
		&log.CharacteristicsInserted, &log.CharacteristicsUpdated,
		&log.PricesUpdated, &log.StockUpdated,
		&log.SelectedSteps,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	return &log, nil
}

// GetSyncStepDetails returns all step details for a sync log
func (r *Repository) GetSyncStepDetails(ctx context.Context, syncLogID uuid.UUID) ([]*models.SyncStepDetail, error) {
	query := `
		SELECT id, sync_log_id, step_number, step_name, status, started_at, completed_at,
		       extracted, inserted, updated, unchanged, failed, error_message, created_at
		FROM sync_step_details
		WHERE sync_log_id = $1
		ORDER BY step_number
	`

	rows, err := r.pool.Query(ctx, query, syncLogID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var details []*models.SyncStepDetail
	for rows.Next() {
		var d models.SyncStepDetail
		err := rows.Scan(
			&d.ID, &d.SyncLogID, &d.StepNumber, &d.StepName, &d.Status,
			&d.StartedAt, &d.CompletedAt, &d.Extracted, &d.Inserted,
			&d.Updated, &d.Unchanged, &d.Failed, &d.ErrorMessage, &d.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		details = append(details, &d)
	}

	return details, rows.Err()
}

// ============================================================================
// CRUD OPERATIONS - PRODUCTS
// ============================================================================

// CreateProduct creates a new product in the database
func (r *Repository) CreateProduct(ctx context.Context, req *CreateProductRequest) (*models.Product, error) {
	productSlug := slug.Make(req.Name)
	if productSlug == "" {
		productSlug = "product"
	}

	// Generate a unique ultra_id for manually created products
	ultraID := fmt.Sprintf("manual-%s", uuid.New().String())

	query := `
		INSERT INTO products (
			ultra_id, code, article, name, slug, description, brand_id, category_id,
			is_active, is_service
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10
		)
		RETURNING id, ultra_id, code, article, name, slug, description, brand_id, category_id,
		          parent_id, brand_ultra_id, category_ultra_id, parent_ultra_id, main_image_url,
		          images, warranty, barcodes, price_min, price_max, total_stock, is_in_stock,
		          is_active, is_service, created_at, updated_at,
		          prices, price_mdl, price_eur, price_usd, variant_group_id, is_group
	`

	var product models.Product
	err := r.pool.QueryRow(ctx, query,
		ultraID, req.Code, req.Article, req.Name, productSlug, req.Description,
		req.BrandID, req.CategoryID, req.IsActive, req.IsService,
	).Scan(
		&product.ID, &product.UltraID, &product.Code, &product.Article, &product.Name,
		&product.Slug, &product.Description, &product.BrandID, &product.CategoryID,
		&product.ParentID, &product.BrandUltraID, &product.CategoryUltraID, &product.ParentUltraID,
		&product.MainImageURL, &product.Images, &product.Warranty, &product.Barcodes,
		&product.PriceMin, &product.PriceMax, &product.TotalStock, &product.IsInStock,
		&product.IsActive, &product.IsService, &product.CreatedAt, &product.UpdatedAt,
		&product.Prices, &product.PriceMDL, &product.PriceEUR, &product.PriceUSD,
		&product.VariantGroupID, &product.IsGroup,
	)
	if err != nil {
		return nil, fmt.Errorf("create product: %w", err)
	}

	return &product, nil
}

// UpdateProduct updates an existing product
func (r *Repository) UpdateProduct(ctx context.Context, id uuid.UUID, req *UpdateProductRequest) (*models.Product, error) {
	// Build dynamic update query
	updates := make([]string, 0)
	args := make([]interface{}, 0)
	argPos := 1

	if req.Name != nil {
		updates = append(updates, fmt.Sprintf("name = $%d", argPos))
		args = append(args, *req.Name)
		argPos++

		// Also update slug
		updates = append(updates, fmt.Sprintf("slug = $%d", argPos))
		args = append(args, slug.Make(*req.Name))
		argPos++
	}

	if req.Code != nil {
		updates = append(updates, fmt.Sprintf("code = $%d", argPos))
		args = append(args, *req.Code)
		argPos++
	}

	if req.Article != nil {
		updates = append(updates, fmt.Sprintf("article = $%d", argPos))
		args = append(args, *req.Article)
		argPos++
	}

	if req.Description != nil {
		updates = append(updates, fmt.Sprintf("description = $%d", argPos))
		args = append(args, *req.Description)
		argPos++
	}

	if req.BrandID != nil {
		updates = append(updates, fmt.Sprintf("brand_id = $%d", argPos))
		args = append(args, *req.BrandID)
		argPos++
	}

	if req.CategoryID != nil {
		updates = append(updates, fmt.Sprintf("category_id = $%d", argPos))
		args = append(args, *req.CategoryID)
		argPos++
	}

	if req.IsActive != nil {
		updates = append(updates, fmt.Sprintf("is_active = $%d", argPos))
		args = append(args, *req.IsActive)
		argPos++
	}

	if req.IsService != nil {
		updates = append(updates, fmt.Sprintf("is_service = $%d", argPos))
		args = append(args, *req.IsService)
		argPos++
	}

	if len(updates) == 0 {
		return r.GetProduct(ctx, id)
	}

	updates = append(updates, "updated_at = NOW()")
	args = append(args, id)

	query := fmt.Sprintf(`
		UPDATE products SET %s
		WHERE id = $%d
		RETURNING id, ultra_id, code, article, name, slug, description, brand_id, category_id,
		          parent_id, brand_ultra_id, category_ultra_id, parent_ultra_id, main_image_url,
		          images, warranty, barcodes, price_min, price_max, total_stock, is_in_stock,
		          is_active, is_service, created_at, updated_at,
		          prices, price_mdl, price_eur, price_usd, variant_group_id, is_group
	`, strings.Join(updates, ", "), argPos)

	var product models.Product
	err := r.pool.QueryRow(ctx, query, args...).Scan(
		&product.ID, &product.UltraID, &product.Code, &product.Article, &product.Name,
		&product.Slug, &product.Description, &product.BrandID, &product.CategoryID,
		&product.ParentID, &product.BrandUltraID, &product.CategoryUltraID, &product.ParentUltraID,
		&product.MainImageURL, &product.Images, &product.Warranty, &product.Barcodes,
		&product.PriceMin, &product.PriceMax, &product.TotalStock, &product.IsInStock,
		&product.IsActive, &product.IsService, &product.CreatedAt, &product.UpdatedAt,
		&product.Prices, &product.PriceMDL, &product.PriceEUR, &product.PriceUSD,
		&product.VariantGroupID, &product.IsGroup,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("product not found")
		}
		return nil, fmt.Errorf("update product: %w", err)
	}

	return &product, nil
}

// DeleteProduct soft deletes a product by setting is_active to false
func (r *Repository) DeleteProduct(ctx context.Context, id uuid.UUID) error {
	result, err := r.pool.Exec(ctx, `
		UPDATE products SET is_active = false, updated_at = NOW()
		WHERE id = $1
	`, id)
	if err != nil {
		return fmt.Errorf("delete product: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("product not found")
	}

	return nil
}

// ============================================================================
// CRUD OPERATIONS - BRANDS
// ============================================================================

// CreateBrand creates a new brand in the database
func (r *Repository) CreateBrand(ctx context.Context, req *CreateBrandRequest) (*models.Brand, error) {
	brandSlug := slug.Make(req.Name)
	if brandSlug == "" {
		brandSlug = "brand"
	}

	// Generate a unique ultra_id for manually created brands
	ultraID := fmt.Sprintf("manual-%s", uuid.New().String())

	query := `
		INSERT INTO brands (ultra_id, code, name, slug, logo_url, is_active)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, ultra_id, code, name, slug, logo_url, is_active, created_at, updated_at
	`

	var brand models.Brand
	err := r.pool.QueryRow(ctx, query,
		ultraID, req.Code, req.Name, brandSlug, req.LogoURL, req.IsActive,
	).Scan(
		&brand.ID, &brand.UltraID, &brand.Code, &brand.Name, &brand.Slug,
		&brand.LogoURL, &brand.IsActive, &brand.CreatedAt, &brand.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("create brand: %w", err)
	}

	return &brand, nil
}

// UpdateBrand updates an existing brand
func (r *Repository) UpdateBrand(ctx context.Context, id uuid.UUID, req *UpdateBrandRequest) (*models.Brand, error) {
	// Build dynamic update query
	updates := make([]string, 0)
	args := make([]interface{}, 0)
	argPos := 1

	if req.Name != nil {
		updates = append(updates, fmt.Sprintf("name = $%d", argPos))
		args = append(args, *req.Name)
		argPos++

		// Also update slug
		updates = append(updates, fmt.Sprintf("slug = $%d", argPos))
		args = append(args, slug.Make(*req.Name))
		argPos++
	}

	if req.Code != nil {
		updates = append(updates, fmt.Sprintf("code = $%d", argPos))
		args = append(args, *req.Code)
		argPos++
	}

	if req.LogoURL != nil {
		updates = append(updates, fmt.Sprintf("logo_url = $%d", argPos))
		args = append(args, *req.LogoURL)
		argPos++
	}

	if req.IsActive != nil {
		updates = append(updates, fmt.Sprintf("is_active = $%d", argPos))
		args = append(args, *req.IsActive)
		argPos++
	}

	if len(updates) == 0 {
		return r.GetBrand(ctx, id)
	}

	updates = append(updates, "updated_at = NOW()")
	args = append(args, id)

	query := fmt.Sprintf(`
		UPDATE brands SET %s
		WHERE id = $%d
		RETURNING id, ultra_id, code, name, slug, logo_url, is_active, created_at, updated_at
	`, strings.Join(updates, ", "), argPos)

	var brand models.Brand
	err := r.pool.QueryRow(ctx, query, args...).Scan(
		&brand.ID, &brand.UltraID, &brand.Code, &brand.Name, &brand.Slug,
		&brand.LogoURL, &brand.IsActive, &brand.CreatedAt, &brand.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("brand not found")
		}
		return nil, fmt.Errorf("update brand: %w", err)
	}

	return &brand, nil
}

// DeleteBrand soft deletes a brand by setting is_active to false
func (r *Repository) DeleteBrand(ctx context.Context, id uuid.UUID) error {
	result, err := r.pool.Exec(ctx, `
		UPDATE brands SET is_active = false, updated_at = NOW()
		WHERE id = $1
	`, id)
	if err != nil {
		return fmt.Errorf("delete brand: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("brand not found")
	}

	return nil
}

// ============================================================================
// CRUD OPERATIONS - CATEGORIES
// ============================================================================

// CreateCategory creates a new category in the database
func (r *Repository) CreateCategory(ctx context.Context, req *CreateCategoryRequest) (*models.Category, error) {
	categorySlug := slug.Make(req.Name)
	if categorySlug == "" {
		categorySlug = "category"
	}

	// Generate a unique ultra_id for manually created categories
	ultraID := fmt.Sprintf("manual-%s", uuid.New().String())

	query := `
		INSERT INTO categories (ultra_id, code, parent_id, name, slug, sort_order, image_url, product_count, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, ultra_id, code, parent_id, parent_ultra_id, name, slug, sort_order,
		          image_url, product_count, is_active, created_at, updated_at
	`

	var category models.Category
	err := r.pool.QueryRow(ctx, query,
		ultraID, req.Code, req.ParentID, req.Name, categorySlug, req.SortOrder,
		req.ImageURL, req.ProductCount, req.IsActive,
	).Scan(
		&category.ID, &category.UltraID, &category.Code, &category.ParentID,
		&category.ParentUltraID, &category.Name, &category.Slug, &category.SortOrder,
		&category.ImageURL, &category.ProductCount, &category.IsActive,
		&category.CreatedAt, &category.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("create category: %w", err)
	}

	return &category, nil
}

// UpdateCategory updates an existing category
func (r *Repository) UpdateCategory(ctx context.Context, id uuid.UUID, req *UpdateCategoryRequest) (*models.Category, error) {
	// Build dynamic update query
	updates := make([]string, 0)
	args := make([]interface{}, 0)
	argPos := 1

	if req.Name != nil {
		updates = append(updates, fmt.Sprintf("name = $%d", argPos))
		args = append(args, *req.Name)
		argPos++

		// Also update slug
		updates = append(updates, fmt.Sprintf("slug = $%d", argPos))
		args = append(args, slug.Make(*req.Name))
		argPos++
	}

	if req.Code != nil {
		updates = append(updates, fmt.Sprintf("code = $%d", argPos))
		args = append(args, *req.Code)
		argPos++
	}

	if req.ParentID != nil {
		updates = append(updates, fmt.Sprintf("parent_id = $%d", argPos))
		args = append(args, *req.ParentID)
		argPos++
	}

	if req.SortOrder != nil {
		updates = append(updates, fmt.Sprintf("sort_order = $%d", argPos))
		args = append(args, *req.SortOrder)
		argPos++
	}

	if req.ImageURL != nil {
		updates = append(updates, fmt.Sprintf("image_url = $%d", argPos))
		args = append(args, *req.ImageURL)
		argPos++
	}

	if req.ProductCount != nil {
		updates = append(updates, fmt.Sprintf("product_count = $%d", argPos))
		args = append(args, *req.ProductCount)
		argPos++
	}

	if req.IsActive != nil {
		updates = append(updates, fmt.Sprintf("is_active = $%d", argPos))
		args = append(args, *req.IsActive)
		argPos++
	}

	if len(updates) == 0 {
		return r.GetCategory(ctx, id)
	}

	updates = append(updates, "updated_at = NOW()")
	args = append(args, id)

	query := fmt.Sprintf(`
		UPDATE categories SET %s
		WHERE id = $%d
		RETURNING id, ultra_id, code, parent_id, parent_ultra_id, name, slug, sort_order,
		          image_url, product_count, is_active, created_at, updated_at
	`, strings.Join(updates, ", "), argPos)

	var category models.Category
	err := r.pool.QueryRow(ctx, query, args...).Scan(
		&category.ID, &category.UltraID, &category.Code, &category.ParentID,
		&category.ParentUltraID, &category.Name, &category.Slug, &category.SortOrder,
		&category.ImageURL, &category.ProductCount, &category.IsActive,
		&category.CreatedAt, &category.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("category not found")
		}
		return nil, fmt.Errorf("update category: %w", err)
	}

	return &category, nil
}

// DeleteCategory soft deletes a category by setting is_active to false
func (r *Repository) DeleteCategory(ctx context.Context, id uuid.UUID) error {
	result, err := r.pool.Exec(ctx, `
		UPDATE categories SET is_active = false, updated_at = NOW()
		WHERE id = $1
	`, id)
	if err != nil {
		return fmt.Errorf("delete category: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("category not found")
	}

	return nil
}

// ============================================================================
// BULK OPERATIONS
// ============================================================================

// BulkUpdateProducts updates multiple products at once
func (r *Repository) BulkUpdateProducts(ctx context.Context, ids []uuid.UUID, isActive *bool) (int, error) {
	if len(ids) == 0 {
		return 0, nil
	}

	updates := make([]string, 0)
	args := make([]interface{}, 0)
	argPos := 1

	if isActive != nil {
		updates = append(updates, fmt.Sprintf("is_active = $%d", argPos))
		args = append(args, *isActive)
		argPos++
	}

	if len(updates) == 0 {
		return 0, nil
	}

	updates = append(updates, "updated_at = NOW()")

	// Build IN clause for IDs
	idStrings := make([]string, len(ids))
	for i, id := range ids {
		idStrings[i] = fmt.Sprintf("$%d", argPos)
		args = append(args, id)
		argPos++
	}

	query := fmt.Sprintf(`
		UPDATE products SET %s
		WHERE id IN (%s)
	`, strings.Join(updates, ", "), strings.Join(idStrings, ", "))

	result, err := r.pool.Exec(ctx, query, args...)
	if err != nil {
		return 0, fmt.Errorf("bulk update products: %w", err)
	}

	return int(result.RowsAffected()), nil
}

// BulkDeleteProducts soft deletes multiple products at once
func (r *Repository) BulkDeleteProducts(ctx context.Context, ids []uuid.UUID) (int, error) {
	if len(ids) == 0 {
		return 0, nil
	}

	// Build IN clause for IDs
	args := make([]interface{}, len(ids))
	idStrings := make([]string, len(ids))
	for i, id := range ids {
		idStrings[i] = fmt.Sprintf("$%d", i+1)
		args[i] = id
	}

	query := fmt.Sprintf(`
		UPDATE products SET is_active = false, updated_at = NOW()
		WHERE id IN (%s)
	`, strings.Join(idStrings, ", "))

	result, err := r.pool.Exec(ctx, query, args...)
	if err != nil {
		return 0, fmt.Errorf("bulk delete products: %w", err)
	}

	return int(result.RowsAffected()), nil
}

// BulkUpdateProductsByFilter updates all products matching the given filter criteria
// Note: SortBy is intentionally ignored for bulk updates (ORDER BY doesn't affect UPDATE results)
func (r *Repository) BulkUpdateProductsByFilter(ctx context.Context, filter *ProductFilter, isActive bool) (int, error) {
	query := "UPDATE products SET is_active = $1, updated_at = NOW() WHERE 1=1"
	args := []interface{}{isActive}
	argPos := 2

	if filter != nil {
		// Search filter
		if filter.Search != "" {
			// Note: Reusing $%d for all three columns (PostgreSQL allows parameter reuse)
			query += fmt.Sprintf(" AND (name ILIKE $%d OR description ILIKE $%d OR code ILIKE $%d)", argPos, argPos, argPos)
			searchPattern := "%" + filter.Search + "%"
			args = append(args, searchPattern)
			argPos++
		}

		// Brand filter
		if filter.BrandID != nil {
			query += fmt.Sprintf(" AND brand_id = $%d", argPos)
			args = append(args, filter.BrandID)
			argPos++
		}

		// Category filter
		if filter.CategoryID != nil {
			query += fmt.Sprintf(" AND category_id = $%d", argPos)
			args = append(args, filter.CategoryID)
			argPos++
		}

		// Price filters
		if filter.PriceFilter == "with_price" {
			query += " AND (price_mdl IS NOT NULL OR price_eur IS NOT NULL OR price_usd IS NOT NULL)"
		} else if filter.PriceFilter == "no_price" {
			query += " AND price_mdl IS NULL AND price_eur IS NULL AND price_usd IS NULL"
		}

		// Stock filters
		if filter.StockFilter == "in_stock" {
			query += " AND total_stock > 0"
		} else if filter.StockFilter == "out_of_stock" {
			query += " AND (total_stock = 0 OR total_stock IS NULL)"
		} else if filter.StockFilter == "low_stock" {
			query += " AND total_stock > 0 AND total_stock <= 5"
		}

		// Status filter (for filtering which products to update)
		if filter.StatusFilter == "active" {
			query += " AND is_active = true"
		} else if filter.StatusFilter == "inactive" {
			query += " AND is_active = false"
		}
	}

	result, err := r.pool.Exec(ctx, query, args...)
	if err != nil {
		return 0, fmt.Errorf("bulk update products by filter: %w", err)
	}

	return int(result.RowsAffected()), nil
}

// BulkUpdateBrands updates multiple brands at once
func (r *Repository) BulkUpdateBrands(ctx context.Context, ids []uuid.UUID, isActive *bool) (int, error) {
	if len(ids) == 0 {
		return 0, nil
	}

	updates := make([]string, 0)
	args := make([]interface{}, 0)
	argPos := 1

	if isActive != nil {
		updates = append(updates, fmt.Sprintf("is_active = $%d", argPos))
		args = append(args, *isActive)
		argPos++
	}

	if len(updates) == 0 {
		return 0, nil
	}

	updates = append(updates, "updated_at = NOW()")

	// Build IN clause for IDs
	idStrings := make([]string, len(ids))
	for i, id := range ids {
		idStrings[i] = fmt.Sprintf("$%d", argPos)
		args = append(args, id)
		argPos++
	}

	query := fmt.Sprintf(`
		UPDATE brands SET %s
		WHERE id IN (%s)
	`, strings.Join(updates, ", "), strings.Join(idStrings, ", "))

	result, err := r.pool.Exec(ctx, query, args...)
	if err != nil {
		return 0, fmt.Errorf("bulk update brands: %w", err)
	}

	return int(result.RowsAffected()), nil
}

// BulkUpdateCategories updates multiple categories at once
func (r *Repository) BulkUpdateCategories(ctx context.Context, ids []uuid.UUID, isActive *bool) (int, error) {
	if len(ids) == 0 {
		return 0, nil
	}

	updates := make([]string, 0)
	args := make([]interface{}, 0)
	argPos := 1

	if isActive != nil {
		updates = append(updates, fmt.Sprintf("is_active = $%d", argPos))
		args = append(args, *isActive)
		argPos++
	}

	if len(updates) == 0 {
		return 0, nil
	}

	updates = append(updates, "updated_at = NOW()")

	// Build IN clause for IDs
	idStrings := make([]string, len(ids))
	for i, id := range ids {
		idStrings[i] = fmt.Sprintf("$%d", argPos)
		args = append(args, id)
		argPos++
	}

	query := fmt.Sprintf(`
		UPDATE categories SET %s
		WHERE id IN (%s)
	`, strings.Join(updates, ", "), strings.Join(idStrings, ", "))

	result, err := r.pool.Exec(ctx, query, args...)
	if err != nil {
		return 0, fmt.Errorf("bulk update categories: %w", err)
	}

	return int(result.RowsAffected()), nil
}

// ============================================================================
// EXPORT HELPERS
// ============================================================================

// ListAllCategories returns all active categories without pagination (for export)
func (r *Repository) ListAllCategories(ctx context.Context) ([]*models.Category, error) {
	query := `
		SELECT c.id, c.ultra_id, c.code, c.parent_id, c.parent_ultra_id, c.name, c.slug, c.sort_order,
		       c.image_url, COUNT(pr.id) as actual_product_count, c.is_active, c.created_at, c.updated_at
		FROM categories c
		LEFT JOIN products pr ON pr.category_id = c.id
		WHERE c.is_active = true
		GROUP BY c.id, c.ultra_id, c.code, c.parent_id, c.parent_ultra_id, c.name, c.slug, c.sort_order,
		         c.image_url, c.is_active, c.created_at, c.updated_at
		ORDER BY c.sort_order ASC, c.name ASC
	`

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	categories := make([]*models.Category, 0)
	for rows.Next() {
		var category models.Category
		err := rows.Scan(
			&category.ID, &category.UltraID, &category.Code, &category.ParentID,
			&category.ParentUltraID, &category.Name, &category.Slug, &category.SortOrder,
			&category.ImageURL, &category.ProductCount, &category.IsActive,
			&category.CreatedAt, &category.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		categories = append(categories, &category)
	}

	return categories, nil
}

// GetExchangeRates returns all exchange rates
func (r *Repository) GetExchangeRates(ctx context.Context) ([]*models.ExchangeRate, error) {
	query := `
		SELECT id, currency_uuid, currency_code, currency_name, rate, updated_at
		FROM exchange_rates
		ORDER BY currency_code
	`

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	rates := make([]*models.ExchangeRate, 0)
	for rows.Next() {
		var rate models.ExchangeRate
		err := rows.Scan(
			&rate.ID, &rate.CurrencyUUID, &rate.CurrencyCode,
			&rate.CurrencyName, &rate.Rate, &rate.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		rates = append(rates, &rate)
	}

	return rates, nil
}
