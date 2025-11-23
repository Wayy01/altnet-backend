package repository

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// ============================================================================
// PRODUCT GROUPING TYPES
// ============================================================================

// ProductGroup represents a parent product with its variants
type ProductGroup struct {
	ID           uuid.UUID `json:"id"`
	Name         string    `json:"name"`
	Code         *string   `json:"code"`
	Article      *string   `json:"article"`
	BrandName    *string   `json:"brand_name"`
	CategoryName *string   `json:"category_name"`
	VariantCount int       `json:"variant_count"`
	PriceMin     *float64  `json:"price_min"`
	PriceMax     *float64  `json:"price_max"`
	TotalStock   int       `json:"total_stock"`
	IsInStock    bool      `json:"is_in_stock"`
	IsActive     bool      `json:"is_active"`
}

// ProductVariant represents a variant within a product group
type ProductVariant struct {
	ID           uuid.UUID   `json:"id"`
	ParentID     uuid.UUID   `json:"parent_id"`
	Name         string      `json:"name"`
	Code         *string     `json:"code"`
	Article      *string     `json:"article"`
	Prices       interface{} `json:"prices"` // JSONB
	PriceMDL     *float64    `json:"price_mdl"`
	PriceEUR     *float64    `json:"price_eur"`
	PriceUSD     *float64    `json:"price_usd"`
	TotalStock   int         `json:"total_stock"`
	IsInStock    bool        `json:"is_in_stock"`
	IsActive     bool        `json:"is_active"`
	MainImageURL *string     `json:"main_image_url"`
}

// ============================================================================
// PRODUCT GROUP METHODS (Level 1)
// ============================================================================

// ListProductGroups returns all parent products with variant statistics
func (r *Repository) ListProductGroups(ctx context.Context, limit, offset int, search string) ([]ProductGroup, int, error) {
	var groups []ProductGroup
	var total int

	// Build search condition
	searchCondition := ""
	searchArgs := []interface{}{}
	argIndex := 1

	if search != "" {
		searchCondition = fmt.Sprintf("AND (p.name ILIKE $%d OR p.code ILIKE $%d OR p.article ILIKE $%d)", argIndex, argIndex, argIndex)
		searchArgs = append(searchArgs, "%"+search+"%")
		argIndex++
	}

	// Get total count
	countQuery := fmt.Sprintf(`
		SELECT COUNT(DISTINCT p.id)
		FROM products p
		WHERE p.id IN (
			SELECT DISTINCT parent_id
			FROM products
			WHERE parent_id IS NOT NULL
		)
		%s
	`, searchCondition)

	err := r.pool.QueryRow(ctx, countQuery, searchArgs...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count product groups: %w", err)
	}

	// Get groups with statistics
	query := fmt.Sprintf(`
		SELECT
			p.id,
			p.name,
			p.code,
			p.article,
			b.name as brand_name,
			c.name as category_name,
			COUNT(v.id) as variant_count,
			MIN(v.price_mdl) as price_min,
			MAX(v.price_mdl) as price_max,
			SUM(v.total_stock) as total_stock,
			BOOL_OR(v.is_in_stock) as is_in_stock,
			p.is_active
		FROM products p
		LEFT JOIN brands b ON p.brand_id = b.id
		LEFT JOIN categories c ON p.category_id = c.id
		LEFT JOIN products v ON v.parent_id = p.id
		WHERE p.id IN (
			SELECT DISTINCT parent_id
			FROM products
			WHERE parent_id IS NOT NULL
		)
		%s
		GROUP BY p.id, p.name, p.code, p.article, b.name, c.name, p.is_active
		ORDER BY p.name
		LIMIT $%d OFFSET $%d
	`, searchCondition, argIndex, argIndex+1)

	queryArgs := append(searchArgs, limit, offset)
	rows, err := r.pool.Query(ctx, query, queryArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list product groups: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		// Check context cancellation
		if err := ctx.Err(); err != nil {
			return nil, 0, fmt.Errorf("context cancelled while scanning product groups: %w", err)
		}

		var group ProductGroup
		err := rows.Scan(
			&group.ID,
			&group.Name,
			&group.Code,
			&group.Article,
			&group.BrandName,
			&group.CategoryName,
			&group.VariantCount,
			&group.PriceMin,
			&group.PriceMax,
			&group.TotalStock,
			&group.IsInStock,
			&group.IsActive,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan product group: %w", err)
		}
		groups = append(groups, group)
	}

	return groups, total, nil
}

// GetProductGroupByID returns a single product group by ID
func (r *Repository) GetProductGroupByID(ctx context.Context, id uuid.UUID) (ProductGroup, error) {
	query := `
		SELECT
			p.id,
			p.name,
			p.code,
			p.article,
			b.name as brand_name,
			c.name as category_name,
			COUNT(v.id) as variant_count,
			MIN(v.price_mdl) as price_min,
			MAX(v.price_mdl) as price_max,
			SUM(v.total_stock) as total_stock,
			BOOL_OR(v.is_in_stock) as is_in_stock,
			p.is_active
		FROM products p
		LEFT JOIN brands b ON p.brand_id = b.id
		LEFT JOIN categories c ON p.category_id = c.id
		LEFT JOIN products v ON v.parent_id = p.id
		WHERE p.id = $1
		GROUP BY p.id, p.name, p.code, p.article, b.name, c.name, p.is_active
	`

	var group ProductGroup
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&group.ID,
		&group.Name,
		&group.Code,
		&group.Article,
		&group.BrandName,
		&group.CategoryName,
		&group.VariantCount,
		&group.PriceMin,
		&group.PriceMax,
		&group.TotalStock,
		&group.IsInStock,
		&group.IsActive,
	)
	if err != nil {
		return ProductGroup{}, fmt.Errorf("product group not found (ID: %s): %w", id.String(), err)
	}

	return group, nil
}

// DeleteProductGroup deletes a product group and unlinks its variants
func (r *Repository) DeleteProductGroup(ctx context.Context, id uuid.UUID) error {
	// Start transaction with REPEATABLE READ isolation for consistent read-modify-write
	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{
		IsoLevel: pgx.RepeatableRead,
	})
	if err != nil {
		return fmt.Errorf("failed to begin transaction (ID: %s): %w", id.String(), err)
	}
	defer tx.Rollback(ctx)

	// Unlink variants (set parent_id to NULL)
	unlinkQuery := `UPDATE products SET parent_id = NULL WHERE parent_id = $1`
	_, err = tx.Exec(ctx, unlinkQuery, id)
	if err != nil {
		return fmt.Errorf("failed to unlink variants (ID: %s): %w", id.String(), err)
	}

	// Delete the parent product
	deleteQuery := `DELETE FROM products WHERE id = $1`
	result, err := tx.Exec(ctx, deleteQuery, id)
	if err != nil {
		return fmt.Errorf("failed to delete product group (ID: %s): %w", id.String(), err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("product group not found (ID: %s)", id.String())
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction (ID: %s): %w", id.String(), err)
	}

	return nil
}

// GetProductGroupDeletionImpact calculates the impact of deleting a product group
func (r *Repository) GetProductGroupDeletionImpact(ctx context.Context, id uuid.UUID) (*DeletionImpact, error) {
	query := `
		SELECT
			1 + COUNT(*) as records_to_delete,
			COUNT(*) as products_affected
		FROM products
		WHERE parent_id = $1
	`

	var impact DeletionImpact
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&impact.RecordsToDelete,
		&impact.ProductsAffected,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate deletion impact (ID: %s): %w", id.String(), err)
	}

	return &impact, nil
}

// ============================================================================
// PRODUCT VARIANT METHODS (Level 2)
// ============================================================================

// ListProductVariants returns all variants for a parent product
func (r *Repository) ListProductVariants(ctx context.Context, parentID uuid.UUID, limit, offset int, search string) ([]ProductVariant, int, error) {
	var variants []ProductVariant
	var total int

	// Build search condition
	searchCondition := ""
	searchArgs := []interface{}{parentID}
	argIndex := 2

	if search != "" {
		searchCondition = fmt.Sprintf("AND (p.name ILIKE $%d OR p.code ILIKE $%d OR p.article ILIKE $%d)", argIndex, argIndex, argIndex)
		searchArgs = append(searchArgs, "%"+search+"%")
		argIndex++
	}

	// Get total count
	countQuery := fmt.Sprintf(`
		SELECT COUNT(*)
		FROM products p
		WHERE p.parent_id = $1 %s
	`, searchCondition)

	err := r.pool.QueryRow(ctx, countQuery, searchArgs...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count product variants: %w", err)
	}

	// Get variants
	query := fmt.Sprintf(`
		SELECT
			p.id,
			p.parent_id,
			p.name,
			p.code,
			p.article,
			p.prices,
			p.price_mdl,
			p.price_eur,
			p.price_usd,
			p.total_stock,
			p.is_in_stock,
			p.is_active,
			p.main_image_url
		FROM products p
		WHERE p.parent_id = $1 %s
		ORDER BY p.name
		LIMIT $%d OFFSET $%d
	`, searchCondition, argIndex, argIndex+1)

	queryArgs := append(searchArgs, limit, offset)
	rows, err := r.pool.Query(ctx, query, queryArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list product variants: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		// Check context cancellation
		if err := ctx.Err(); err != nil {
			return nil, 0, fmt.Errorf("context cancelled while scanning product variants: %w", err)
		}

		var variant ProductVariant
		err := rows.Scan(
			&variant.ID,
			&variant.ParentID,
			&variant.Name,
			&variant.Code,
			&variant.Article,
			&variant.Prices,
			&variant.PriceMDL,
			&variant.PriceEUR,
			&variant.PriceUSD,
			&variant.TotalStock,
			&variant.IsInStock,
			&variant.IsActive,
			&variant.MainImageURL,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan product variant: %w", err)
		}
		variants = append(variants, variant)
	}

	return variants, total, nil
}

// DeleteProductVariant unlinks a variant from its parent (or deletes it)
func (r *Repository) DeleteProductVariant(ctx context.Context, id uuid.UUID) error {
	// Unlink the variant (set parent_id to NULL)
	query := `UPDATE products SET parent_id = NULL WHERE id = $1`
	result, err := r.pool.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to unlink product variant (ID: %s): %w", id.String(), err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("product variant not found (ID: %s)", id.String())
	}

	return nil
}

// BulkDeleteProductVariants unlinks multiple variants
func (r *Repository) BulkDeleteProductVariants(ctx context.Context, ids []uuid.UUID) error {
	if len(ids) == 0 {
		return nil
	}

	// Start transaction with REPEATABLE READ isolation for consistent read-modify-write
	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{
		IsoLevel: pgx.RepeatableRead,
	})
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	query := `UPDATE products SET parent_id = NULL WHERE id = ANY($1)`
	result, err := tx.Exec(ctx, query, ids)
	if err != nil {
		return fmt.Errorf("failed to bulk unlink product variants: %w", err)
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("no product variants found for unlinking")
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// BulkUpdateProductVariants updates multiple variants
func (r *Repository) BulkUpdateProductVariants(ctx context.Context, ids []uuid.UUID, updates map[string]interface{}) error {
	if len(ids) == 0 {
		return nil
	}

	// Build dynamic UPDATE query
	setClauses := []string{}
	args := []interface{}{}
	argIndex := 1

	// Whitelist map for SQL injection prevention
	allowedFields := map[string]string{
		"is_active": "is_active",
		"parent_id": "parent_id",
	}

	for field, value := range updates {
		sanitizedField, ok := allowedFields[field]
		if !ok {
			return fmt.Errorf("field %s is not allowed for bulk update", field)
		}
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", sanitizedField, argIndex))
		args = append(args, value)
		argIndex++
	}

	if len(setClauses) == 0 {
		return fmt.Errorf("no fields to update")
	}

	// Start transaction with REPEATABLE READ isolation for consistent read-modify-write
	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{
		IsoLevel: pgx.RepeatableRead,
	})
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	args = append(args, ids)
	query := fmt.Sprintf(`
		UPDATE products
		SET %s, updated_at = NOW()
		WHERE id = ANY($%d)
	`, strings.Join(setClauses, ", "), argIndex)

	result, err := tx.Exec(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("failed to bulk update product variants: %w", err)
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("no product variants found for update")
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}
