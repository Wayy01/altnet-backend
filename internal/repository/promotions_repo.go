package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"ultra-api-testing/internal/models"
)

// Sentinel errors for promotion repository operations
var (
	ErrPromotionNotFound      = errors.New("promotion not found")
	ErrInvalidDiscountType    = errors.New("invalid discount type")
	ErrInvalidDateRange       = errors.New("start date must be before end date")
	ErrInvalidDiscountValue   = errors.New("discount value must be positive")
	ErrDuplicatePromotionName = errors.New("promotion with this name already exists")
)

// PromotionRepository handles promotion database operations
type PromotionRepository struct {
	pool *pgxpool.Pool
}

// NewPromotionRepository creates a new promotion repository
func NewPromotionRepository(pool *pgxpool.Pool) *PromotionRepository {
	return &PromotionRepository{pool: pool}
}

// CreatePromotion creates a new promotion
func (r *PromotionRepository) CreatePromotion(ctx context.Context, input *models.PromotionInput) (*models.Promotion, error) {
	// Validate input
	if err := r.validatePromotionInput(input); err != nil {
		return nil, err
	}

	query := `
		INSERT INTO promotions (name, description, discount_type, discount_value, start_date, end_date, is_active, priority)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, name, description, discount_type, discount_value, start_date, end_date, is_active, priority, created_at, updated_at
	`

	promotion := &models.Promotion{}
	err := r.pool.QueryRow(ctx, query,
		strings.TrimSpace(input.Name),
		input.Description,
		input.DiscountType,
		input.DiscountValue,
		input.StartDate,
		input.EndDate,
		input.IsActive,
		input.Priority,
	).Scan(
		&promotion.ID,
		&promotion.Name,
		&promotion.Description,
		&promotion.DiscountType,
		&promotion.DiscountValue,
		&promotion.StartDate,
		&promotion.EndDate,
		&promotion.IsActive,
		&promotion.Priority,
		&promotion.CreatedAt,
		&promotion.UpdatedAt,
	)
	if err != nil {
		// Check for unique constraint violation (duplicate name)
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return nil, ErrDuplicatePromotionName
		}
		return nil, fmt.Errorf("create promotion: %w", err)
	}

	return promotion, nil
}

// GetPromotion returns a promotion by ID
func (r *PromotionRepository) GetPromotion(ctx context.Context, id uuid.UUID) (*models.Promotion, error) {
	query := `
		SELECT
			p.id, p.name, p.description, p.discount_type, p.discount_value,
			p.start_date, p.end_date, p.is_active, p.priority, p.created_at, p.updated_at,
			COUNT(pp.id) as product_count
		FROM promotions p
		LEFT JOIN product_promotions pp ON pp.promotion_id = p.id
		WHERE p.id = $1
		GROUP BY p.id
	`

	promotion := &models.Promotion{}
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&promotion.ID,
		&promotion.Name,
		&promotion.Description,
		&promotion.DiscountType,
		&promotion.DiscountValue,
		&promotion.StartDate,
		&promotion.EndDate,
		&promotion.IsActive,
		&promotion.Priority,
		&promotion.CreatedAt,
		&promotion.UpdatedAt,
		&promotion.ProductCount,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrPromotionNotFound
		}
		return nil, fmt.Errorf("get promotion: %w", err)
	}

	return promotion, nil
}

// UpdatePromotion updates an existing promotion
func (r *PromotionRepository) UpdatePromotion(ctx context.Context, id uuid.UUID, input *models.PromotionInput) (*models.Promotion, error) {
	// Validate input
	if err := r.validatePromotionInput(input); err != nil {
		return nil, err
	}

	query := `
		UPDATE promotions
		SET name = $1, description = $2, discount_type = $3, discount_value = $4,
		    start_date = $5, end_date = $6, is_active = $7, priority = $8, updated_at = NOW()
		WHERE id = $9
		RETURNING id, name, description, discount_type, discount_value, start_date, end_date, is_active, priority, created_at, updated_at
	`

	promotion := &models.Promotion{}
	err := r.pool.QueryRow(ctx, query,
		strings.TrimSpace(input.Name),
		input.Description,
		input.DiscountType,
		input.DiscountValue,
		input.StartDate,
		input.EndDate,
		input.IsActive,
		input.Priority,
		id,
	).Scan(
		&promotion.ID,
		&promotion.Name,
		&promotion.Description,
		&promotion.DiscountType,
		&promotion.DiscountValue,
		&promotion.StartDate,
		&promotion.EndDate,
		&promotion.IsActive,
		&promotion.Priority,
		&promotion.CreatedAt,
		&promotion.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrPromotionNotFound
		}
		// Check for unique constraint violation
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return nil, ErrDuplicatePromotionName
		}
		return nil, fmt.Errorf("update promotion: %w", err)
	}

	return promotion, nil
}

// DeletePromotion deletes a promotion by ID
func (r *PromotionRepository) DeletePromotion(ctx context.Context, id uuid.UUID) error {
	// The CASCADE in the schema will automatically delete product_promotions entries
	query := `DELETE FROM promotions WHERE id = $1`

	cmdTag, err := r.pool.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("delete promotion: %w", err)
	}

	if cmdTag.RowsAffected() == 0 {
		return ErrPromotionNotFound
	}

	return nil
}

// ListPromotions returns promotions with optional filters
func (r *PromotionRepository) ListPromotions(ctx context.Context, filters *models.PromotionFilters, limit, offset int) ([]*models.Promotion, error) {
	query := `
		SELECT
			p.id, p.name, p.description, p.discount_type, p.discount_value,
			p.start_date, p.end_date, p.is_active, p.priority, p.created_at, p.updated_at,
			COUNT(pp.id) as product_count
		FROM promotions p
		LEFT JOIN product_promotions pp ON pp.promotion_id = p.id
	`

	var conditions []string
	var args []interface{}
	argNum := 1

	if filters != nil {
		if filters.Search != "" {
			conditions = append(conditions, fmt.Sprintf("(p.name ILIKE $%d OR p.description ILIKE $%d)", argNum, argNum))
			args = append(args, "%"+filters.Search+"%")
			argNum++
		}
		if filters.IsActive != nil {
			conditions = append(conditions, fmt.Sprintf("p.is_active = $%d", argNum))
			args = append(args, *filters.IsActive)
			argNum++
		}
	}

	if len(conditions) > 0 {
		query += " WHERE " + strings.Join(conditions, " AND ")
	}

	query += " GROUP BY p.id ORDER BY p.priority DESC, p.created_at DESC"

	// Add pagination
	query += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argNum, argNum+1)
	args = append(args, limit, offset)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query promotions: %w", err)
	}
	defer rows.Close()

	var promotions []*models.Promotion
	for rows.Next() {
		promotion := &models.Promotion{}
		if err := rows.Scan(
			&promotion.ID,
			&promotion.Name,
			&promotion.Description,
			&promotion.DiscountType,
			&promotion.DiscountValue,
			&promotion.StartDate,
			&promotion.EndDate,
			&promotion.IsActive,
			&promotion.Priority,
			&promotion.CreatedAt,
			&promotion.UpdatedAt,
			&promotion.ProductCount,
		); err != nil {
			return nil, fmt.Errorf("scan promotion: %w", err)
		}
		promotions = append(promotions, promotion)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate promotions: %w", err)
	}

	return promotions, nil
}

// CountPromotions returns the total count of promotions with filters
func (r *PromotionRepository) CountPromotions(ctx context.Context, filters *models.PromotionFilters) (int, error) {
	query := `SELECT COUNT(*) FROM promotions p`

	var conditions []string
	var args []interface{}
	argNum := 1

	if filters != nil {
		if filters.Search != "" {
			conditions = append(conditions, fmt.Sprintf("(p.name ILIKE $%d OR p.description ILIKE $%d)", argNum, argNum))
			args = append(args, "%"+filters.Search+"%")
			argNum++
		}
		if filters.IsActive != nil {
			conditions = append(conditions, fmt.Sprintf("p.is_active = $%d", argNum))
			args = append(args, *filters.IsActive)
			argNum++
		}
	}

	if len(conditions) > 0 {
		query += " WHERE " + strings.Join(conditions, " AND ")
	}

	var count int
	err := r.pool.QueryRow(ctx, query, args...).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("count promotions: %w", err)
	}

	return count, nil
}

// TogglePromotionActive toggles the is_active flag of a promotion
func (r *PromotionRepository) TogglePromotionActive(ctx context.Context, id uuid.UUID) (*models.Promotion, error) {
	query := `
		UPDATE promotions
		SET is_active = NOT is_active, updated_at = NOW()
		WHERE id = $1
		RETURNING id, name, description, discount_type, discount_value, start_date, end_date, is_active, priority, created_at, updated_at
	`

	promotion := &models.Promotion{}
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&promotion.ID,
		&promotion.Name,
		&promotion.Description,
		&promotion.DiscountType,
		&promotion.DiscountValue,
		&promotion.StartDate,
		&promotion.EndDate,
		&promotion.IsActive,
		&promotion.Priority,
		&promotion.CreatedAt,
		&promotion.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrPromotionNotFound
		}
		return nil, fmt.Errorf("toggle promotion active: %w", err)
	}

	return promotion, nil
}

// AddProductsToPromotion adds products to a promotion
func (r *PromotionRepository) AddProductsToPromotion(ctx context.Context, promotionID uuid.UUID, productIDs []uuid.UUID) error {
	if len(productIDs) == 0 {
		return nil
	}

	// Check if promotion exists
	var exists bool
	err := r.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM promotions WHERE id = $1)`, promotionID).Scan(&exists)
	if err != nil {
		return fmt.Errorf("check promotion exists: %w", err)
	}
	if !exists {
		return ErrPromotionNotFound
	}

	// Use INSERT ... ON CONFLICT DO NOTHING to avoid duplicate errors
	query := `
		INSERT INTO product_promotions (product_id, promotion_id)
		VALUES ($1, $2)
		ON CONFLICT (product_id, promotion_id) DO NOTHING
	`

	batch := &pgx.Batch{}
	for _, productID := range productIDs {
		batch.Queue(query, productID, promotionID)
	}

	br := r.pool.SendBatch(ctx, batch)
	defer br.Close()

	// Execute all inserts
	for range productIDs {
		if _, err := br.Exec(); err != nil {
			return fmt.Errorf("add product to promotion: %w", err)
		}
	}

	return nil
}

// RemoveProductsFromPromotion removes products from a promotion
func (r *PromotionRepository) RemoveProductsFromPromotion(ctx context.Context, promotionID uuid.UUID, productIDs []uuid.UUID) error {
	if len(productIDs) == 0 {
		return nil
	}

	// Check if promotion exists
	var exists bool
	err := r.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM promotions WHERE id = $1)`, promotionID).Scan(&exists)
	if err != nil {
		return fmt.Errorf("check promotion exists: %w", err)
	}
	if !exists {
		return ErrPromotionNotFound
	}

	query := `
		DELETE FROM product_promotions
		WHERE promotion_id = $1 AND product_id = ANY($2)
	`

	_, err = r.pool.Exec(ctx, query, promotionID, productIDs)
	if err != nil {
		return fmt.Errorf("remove products from promotion: %w", err)
	}

	return nil
}

// GetProductsByPromotion returns products in a promotion with pagination
func (r *PromotionRepository) GetProductsByPromotion(ctx context.Context, promotionID uuid.UUID, limit, offset int) ([]*models.Product, error) {
	query := `
		SELECT
			p.id, p.ultra_id, p.code, p.article, p.name, p.slug, p.description,
			p.brand_id, p.category_id, p.parent_id, p.source_id,
			p.main_image_url, p.images, p.videos, p.warranty, p.barcodes,
			p.price_min, p.price_max, p.total_stock, p.is_in_stock,
			p.is_active, p.is_service, p.created_at, p.updated_at,
			p.prices, p.price_mdl, p.price_eur, p.price_usd,
			p.manual_discount_percent,
			b.name as brand_name,
			c.name as category_name,
			ps.name as source_name
		FROM products p
		INNER JOIN product_promotions pp ON pp.product_id = p.id
		LEFT JOIN brands b ON b.id = p.brand_id
		LEFT JOIN categories c ON c.id = p.category_id
		LEFT JOIN product_sources ps ON ps.id = p.source_id
		WHERE pp.promotion_id = $1
		ORDER BY p.name
		LIMIT $2 OFFSET $3
	`

	rows, err := r.pool.Query(ctx, query, promotionID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("query products by promotion: %w", err)
	}
	defer rows.Close()

	var products []*models.Product
	for rows.Next() {
		product := &models.Product{}
		if err := rows.Scan(
			&product.ID,
			&product.UltraID,
			&product.Code,
			&product.Article,
			&product.Name,
			&product.Slug,
			&product.Description,
			&product.BrandID,
			&product.CategoryID,
			&product.ParentID,
			&product.SourceID,
			&product.MainImageURL,
			&product.Images,
			&product.Videos,
			&product.Warranty,
			&product.Barcodes,
			&product.PriceMin,
			&product.PriceMax,
			&product.TotalStock,
			&product.IsInStock,
			&product.IsActive,
			&product.IsService,
			&product.CreatedAt,
			&product.UpdatedAt,
			&product.Prices,
			&product.PriceMDL,
			&product.PriceEUR,
			&product.PriceUSD,
			&product.ManualDiscountPercent,
			&product.BrandName,
			&product.CategoryName,
			&product.SourceName,
		); err != nil {
			return nil, fmt.Errorf("scan product: %w", err)
		}
		products = append(products, product)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate products: %w", err)
	}

	return products, nil
}

// CountProductsByPromotion returns the count of products in a promotion
func (r *PromotionRepository) CountProductsByPromotion(ctx context.Context, promotionID uuid.UUID) (int, error) {
	var count int
	query := `SELECT COUNT(*) FROM product_promotions WHERE promotion_id = $1`
	err := r.pool.QueryRow(ctx, query, promotionID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("count products by promotion: %w", err)
	}
	return count, nil
}

// GetPromotionsByProduct returns all promotions for a product
func (r *PromotionRepository) GetPromotionsByProduct(ctx context.Context, productID uuid.UUID) ([]*models.Promotion, error) {
	query := `
		SELECT
			p.id, p.name, p.description, p.discount_type, p.discount_value,
			p.start_date, p.end_date, p.is_active, p.priority, p.created_at, p.updated_at
		FROM promotions p
		INNER JOIN product_promotions pp ON pp.promotion_id = p.id
		WHERE pp.product_id = $1
		ORDER BY p.priority DESC, p.created_at DESC
	`

	rows, err := r.pool.Query(ctx, query, productID)
	if err != nil {
		return nil, fmt.Errorf("query promotions by product: %w", err)
	}
	defer rows.Close()

	var promotions []*models.Promotion
	for rows.Next() {
		promotion := &models.Promotion{}
		if err := rows.Scan(
			&promotion.ID,
			&promotion.Name,
			&promotion.Description,
			&promotion.DiscountType,
			&promotion.DiscountValue,
			&promotion.StartDate,
			&promotion.EndDate,
			&promotion.IsActive,
			&promotion.Priority,
			&promotion.CreatedAt,
			&promotion.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan promotion: %w", err)
		}
		promotions = append(promotions, promotion)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate promotions: %w", err)
	}

	return promotions, nil
}

// GetActivePromotionsByProduct returns only active promotions that are currently valid (within date range)
func (r *PromotionRepository) GetActivePromotionsByProduct(ctx context.Context, productID uuid.UUID) ([]*models.Promotion, error) {
	query := `
		SELECT
			p.id, p.name, p.description, p.discount_type, p.discount_value,
			p.start_date, p.end_date, p.is_active, p.priority, p.created_at, p.updated_at
		FROM promotions p
		INNER JOIN product_promotions pp ON pp.promotion_id = p.id
		WHERE pp.product_id = $1
		  AND p.is_active = TRUE
		  AND NOW() BETWEEN p.start_date AND p.end_date
		ORDER BY p.priority DESC, p.created_at DESC
	`

	rows, err := r.pool.Query(ctx, query, productID)
	if err != nil {
		return nil, fmt.Errorf("query active promotions by product: %w", err)
	}
	defer rows.Close()

	var promotions []*models.Promotion
	for rows.Next() {
		promotion := &models.Promotion{}
		if err := rows.Scan(
			&promotion.ID,
			&promotion.Name,
			&promotion.Description,
			&promotion.DiscountType,
			&promotion.DiscountValue,
			&promotion.StartDate,
			&promotion.EndDate,
			&promotion.IsActive,
			&promotion.Priority,
			&promotion.CreatedAt,
			&promotion.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan promotion: %w", err)
		}
		promotions = append(promotions, promotion)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate promotions: %w", err)
	}

	return promotions, nil
}

// BulkAddProductsByFilter adds products matching filter criteria to a promotion
func (r *PromotionRepository) BulkAddProductsByFilter(ctx context.Context, promotionID uuid.UUID, filters *models.BulkAddProductsRequest) (int, error) {
	// Check if promotion exists
	var exists bool
	err := r.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM promotions WHERE id = $1)`, promotionID).Scan(&exists)
	if err != nil {
		return 0, fmt.Errorf("check promotion exists: %w", err)
	}
	if !exists {
		return 0, ErrPromotionNotFound
	}

	// Build query to find matching products
	query := `SELECT id FROM products WHERE 1=1`
	var conditions []string
	var args []interface{}
	argNum := 1

	if filters.BrandID != nil {
		conditions = append(conditions, fmt.Sprintf("brand_id = $%d", argNum))
		args = append(args, *filters.BrandID)
		argNum++
	}
	if filters.CategoryID != nil {
		conditions = append(conditions, fmt.Sprintf("category_id = $%d", argNum))
		args = append(args, *filters.CategoryID)
		argNum++
	}
	if filters.MinPrice != nil {
		conditions = append(conditions, fmt.Sprintf("price_mdl >= $%d", argNum))
		args = append(args, *filters.MinPrice)
		argNum++
	}
	if filters.MaxPrice != nil {
		conditions = append(conditions, fmt.Sprintf("price_mdl <= $%d", argNum))
		args = append(args, *filters.MaxPrice)
		argNum++
	}
	if filters.InStock != nil {
		conditions = append(conditions, fmt.Sprintf("is_in_stock = $%d", argNum))
		args = append(args, *filters.InStock)
		argNum++
	}

	if len(conditions) > 0 {
		query += " AND " + strings.Join(conditions, " AND ")
	}

	// Get matching product IDs
	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return 0, fmt.Errorf("query products by filter: %w", err)
	}
	defer rows.Close()

	var productIDs []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return 0, fmt.Errorf("scan product id: %w", err)
		}
		productIDs = append(productIDs, id)
	}

	if err := rows.Err(); err != nil {
		return 0, fmt.Errorf("iterate products: %w", err)
	}

	// Add products to promotion
	if len(productIDs) > 0 {
		if err := r.AddProductsToPromotion(ctx, promotionID, productIDs); err != nil {
			return 0, err
		}
	}

	return len(productIDs), nil
}

// validatePromotionInput validates promotion input data
func (r *PromotionRepository) validatePromotionInput(input *models.PromotionInput) error {
	// Validate name
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return fmt.Errorf("promotion name cannot be empty")
	}
	if len(name) > 255 {
		return fmt.Errorf("promotion name cannot exceed 255 characters")
	}

	// Validate discount type
	if input.DiscountType != models.DiscountTypePercentage && input.DiscountType != models.DiscountTypeFixedAmount {
		return ErrInvalidDiscountType
	}

	// Validate discount value
	if input.DiscountValue <= 0 {
		return ErrInvalidDiscountValue
	}
	if input.DiscountType == models.DiscountTypePercentage && input.DiscountValue > 100 {
		return fmt.Errorf("percentage discount cannot exceed 100")
	}

	// Validate date range
	if input.StartDate.After(input.EndDate) || input.StartDate.Equal(input.EndDate) {
		return ErrInvalidDateRange
	}

	return nil
}
