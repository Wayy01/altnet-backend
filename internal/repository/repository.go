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
	query := `
		SELECT id, ultra_id, code, name, slug, logo_url, is_active, created_at, updated_at
		FROM brands
		WHERE is_active = true
		ORDER BY name ASC
		LIMIT $1 OFFSET $2
	`

	rows, err := r.pool.Query(ctx, query, limit, offset)
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

// CountBrands returns the total count of active brands
func (r *Repository) CountBrands(ctx context.Context) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM brands WHERE is_active = true").Scan(&count)
	return count, err
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
			SELECT id, ultra_id, code, parent_id, parent_ultra_id, name, slug, sort_order,
			       image_url, product_count, is_active, created_at, updated_at
			FROM categories
			WHERE parent_id IS NULL AND is_active = true
			ORDER BY sort_order ASC, name ASC
			LIMIT $1 OFFSET $2
		`
		args = []interface{}{limit, offset}
	} else {
		query = `
			SELECT id, ultra_id, code, parent_id, parent_ultra_id, name, slug, sort_order,
			       image_url, product_count, is_active, created_at, updated_at
			FROM categories
			WHERE parent_id = $1 AND is_active = true
			ORDER BY sort_order ASC, name ASC
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
		err = r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM categories WHERE parent_id IS NULL AND is_active = true").Scan(&count)
	} else {
		err = r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM categories WHERE parent_id = $1 AND is_active = true", parentID).Scan(&count)
	}

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
		       is_active, is_service, created_at, updated_at
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
		       is_active, is_service, created_at, updated_at
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
	)
	if err != nil {
		return nil, err
	}

	return &product, nil
}

// ProductFilter holds filter parameters for product queries
type ProductFilter struct {
	BrandID    *uuid.UUID
	CategoryID *uuid.UUID
	InStock    *bool
	MinPrice   *float64
	MaxPrice   *float64
	Search     string
	IsActive   bool
}

func (r *Repository) ListProducts(ctx context.Context, filter *ProductFilter, limit, offset int) ([]*models.Product, error) {
	query := `
		SELECT id, ultra_id, code, article, name, slug, description, brand_id, category_id,
		       parent_id, brand_ultra_id, category_ultra_id, parent_ultra_id, main_image_url,
		       images, warranty, barcodes, price_min, price_max, total_stock, is_in_stock,
		       is_active, is_service, created_at, updated_at
		FROM products
		WHERE 1=1
	`

	args := make([]interface{}, 0)
	argPos := 1

	if filter != nil {
		if filter.BrandID != nil {
			query += fmt.Sprintf(" AND brand_id = $%d", argPos)
			args = append(args, filter.BrandID)
			argPos++
		}

		if filter.CategoryID != nil {
			query += fmt.Sprintf(" AND category_id = $%d", argPos)
			args = append(args, filter.CategoryID)
			argPos++
		}

		if filter.InStock != nil && *filter.InStock {
			query += " AND is_in_stock = true"
		}

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

		if filter.Search != "" {
			query += fmt.Sprintf(" AND (name ILIKE $%d OR description ILIKE $%d OR code ILIKE $%d)", argPos, argPos, argPos)
			searchPattern := "%" + filter.Search + "%"
			args = append(args, searchPattern)
			argPos++
		}

		query += fmt.Sprintf(" AND is_active = $%d", argPos)
		args = append(args, filter.IsActive)
		argPos++
	}

	query += fmt.Sprintf(" ORDER BY name ASC LIMIT $%d OFFSET $%d", argPos, argPos+1)
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
		if filter.BrandID != nil {
			query += fmt.Sprintf(" AND brand_id = $%d", argPos)
			args = append(args, filter.BrandID)
			argPos++
		}

		if filter.CategoryID != nil {
			query += fmt.Sprintf(" AND category_id = $%d", argPos)
			args = append(args, filter.CategoryID)
			argPos++
		}

		if filter.InStock != nil && *filter.InStock {
			query += " AND is_in_stock = true"
		}

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

		if filter.Search != "" {
			query += fmt.Sprintf(" AND (name ILIKE $%d OR description ILIKE $%d OR code ILIKE $%d)", argPos, argPos, argPos)
			searchPattern := "%" + filter.Search + "%"
			args = append(args, searchPattern)
			argPos++
		}

		query += fmt.Sprintf(" AND is_active = $%d", argPos)
		args = append(args, filter.IsActive)
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
			// Product-level price - update product directly
			_, err = tx.Exec(ctx, `
				UPDATE products
				SET price_min = $1, price_max = $1, updated_at = NOW()
				WHERE ultra_id = $2
			`, pricesForChar[0].Price, productUltraID)
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
func (r *Repository) UpdateProductAggregates(ctx context.Context) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE products p
		SET
			price_min = agg.min_price,
			price_max = agg.max_price,
			total_stock = agg.total_stock,
			is_in_stock = agg.total_stock > 0,
			updated_at = NOW()
		FROM (
			SELECT
				c.product_id,
				MIN((price_item->>'price')::DECIMAL) as min_price,
				MAX((price_item->>'price')::DECIMAL) as max_price,
				COALESCE(SUM(c.stock_total), 0) as total_stock
			FROM characteristics c,
			LATERAL jsonb_array_elements(c.prices) AS price_item
			WHERE c.is_active = true
			GROUP BY c.product_id
		) agg
		WHERE p.id = agg.product_id
	`)
	return err
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
		       characteristics_synced, prices_synced, stock_synced, error_message, details
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
		       characteristics_synced, prices_synced, stock_synced, error_message, details
		FROM sync_logs
		WHERE id = $1
	`

	var log models.SyncLog
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&log.ID, &log.SyncType, &log.StartedAt, &log.FinishedAt, &log.DurationSeconds,
		&log.Status, &log.BrandsSynced, &log.CategoriesSynced, &log.ProductsSynced,
		&log.PropertiesSynced, &log.CharacteristicsSynced, &log.PricesSynced,
		&log.StockSynced, &log.ErrorMessage, &log.Details,
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
		       characteristics_synced, prices_synced, stock_synced, error_message, details
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
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	return &log, nil
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
		          is_active, is_service, created_at, updated_at
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
		          is_active, is_service, created_at, updated_at
	`, strings.Join(updates, ", "), argPos)

	var product models.Product
	err := r.pool.QueryRow(ctx, query, args...).Scan(
		&product.ID, &product.UltraID, &product.Code, &product.Article, &product.Name,
		&product.Slug, &product.Description, &product.BrandID, &product.CategoryID,
		&product.ParentID, &product.BrandUltraID, &product.CategoryUltraID, &product.ParentUltraID,
		&product.MainImageURL, &product.Images, &product.Warranty, &product.Barcodes,
		&product.PriceMin, &product.PriceMax, &product.TotalStock, &product.IsInStock,
		&product.IsActive, &product.IsService, &product.CreatedAt, &product.UpdatedAt,
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
		SELECT id, ultra_id, code, parent_id, parent_ultra_id, name, slug, sort_order,
		       image_url, product_count, is_active, created_at, updated_at
		FROM categories
		WHERE is_active = true
		ORDER BY sort_order ASC, name ASC
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
