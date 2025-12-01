package repository

import (
	"context"
	"fmt"
	"net/url"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// ============================================================================
// CHARACTERISTIC HIERARCHY TYPES
// ============================================================================

// CharacteristicPrice represents a price entry in characteristics
type CharacteristicPrice struct {
	Price    float64 `json:"price"`
	Currency string  `json:"currency"`
	Type     string  `json:"type,omitempty"`
	TypeUUID string  `json:"type_uuid,omitempty"`
}

// CharacteristicName represents a characteristic name in the hierarchy
type CharacteristicName struct {
	Name                string   `json:"name"`
	CharacteristicCount int      `json:"characteristic_count"` // Total characteristic records with this name
	ProductsUsing       int      `json:"products_using"`       // Number of products using this characteristic
	TotalStock          int      `json:"total_stock"`          // Sum of all stock for this name
	AvgPrice            *float64 `json:"avg_price"`            // Average price across all characteristics
	CommonCurrency      *string  `json:"common_currency"`      // Most common currency
}

// CharacteristicValue represents an individual characteristic record
type CharacteristicValue struct {
	ID             uuid.UUID             `json:"id"`
	ProductID      uuid.UUID             `json:"product_id"`
	ProductName    *string               `json:"product_name,omitempty"`
	ProductCode    *string               `json:"product_code,omitempty"`
	UltraID        string                `json:"ultra_id"`
	Code           *string               `json:"code"`
	Reference      *string               `json:"reference"`
	Name           string                `json:"name"`
	Prices         []CharacteristicPrice `json:"prices"` // Typed price array
	StockWarehouse int                   `json:"stock_warehouse"`
	StockShowroom  int                   `json:"stock_showroom"`
	StockTotal     int                   `json:"stock_total"`
	IsActive       bool                  `json:"is_active"`
}

// ============================================================================
// CHARACTERISTIC NAME METHODS (Level 1)
// ============================================================================

// ListCharacteristicNames returns all characteristic names with statistics
func (r *Repository) ListCharacteristicNames(ctx context.Context, limit, offset int, search string) ([]CharacteristicName, int, error) {
	var names []CharacteristicName
	var total int

	// Build search condition
	searchCondition := ""
	searchArgs := []interface{}{}
	argIndex := 1

	if search != "" {
		searchCondition = fmt.Sprintf("WHERE name ILIKE $%d", argIndex)
		searchArgs = append(searchArgs, "%"+search+"%")
		argIndex++
	}

	// Get total count
	countQuery := fmt.Sprintf(`
		SELECT COUNT(DISTINCT name)
		FROM characteristics
		%s
	`, searchCondition)

	err := r.pool.QueryRow(ctx, countQuery, searchArgs...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count characteristic names: %w", err)
	}

	// Get names with statistics
	query := fmt.Sprintf(`
		SELECT
			name,
			COUNT(*) as characteristic_count,
			COUNT(DISTINCT product_id) as products_using,
			SUM(stock_total) as total_stock,
			AVG(CASE
				WHEN jsonb_array_length(prices) > 0
				THEN (prices->0->>'price')::NUMERIC
				ELSE NULL
			END) as avg_price,
			MODE() WITHIN GROUP (ORDER BY
				CASE
					WHEN jsonb_array_length(prices) > 0
					THEN prices->0->>'currency'
					ELSE NULL
				END
			) as common_currency
		FROM characteristics
		%s
		GROUP BY name
		ORDER BY name
		LIMIT $%d OFFSET $%d
	`, searchCondition, argIndex, argIndex+1)

	queryArgs := append(searchArgs, limit, offset)
	rows, err := r.pool.Query(ctx, query, queryArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list characteristic names: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var name CharacteristicName
		err := rows.Scan(
			&name.Name,
			&name.CharacteristicCount,
			&name.ProductsUsing,
			&name.TotalStock,
			&name.AvgPrice,
			&name.CommonCurrency,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan characteristic name: %w", err)
		}
		names = append(names, name)
	}

	return names, total, nil
}

// GetCharacteristicNameByName returns a single characteristic name by name
func (r *Repository) GetCharacteristicNameByName(ctx context.Context, characteristicName string) (*CharacteristicName, error) {
	// Decode URL-encoded name
	decodedName, err := url.QueryUnescape(characteristicName)
	if err != nil {
		return nil, fmt.Errorf("invalid characteristic name encoding: %w", err)
	}

	query := `
		SELECT
			name,
			COUNT(*) as characteristic_count,
			COUNT(DISTINCT product_id) as products_using,
			SUM(stock_total) as total_stock,
			AVG(CASE
				WHEN jsonb_array_length(prices) > 0
				THEN (prices->0->>'price')::NUMERIC
				ELSE NULL
			END) as avg_price,
			MODE() WITHIN GROUP (ORDER BY
				CASE
					WHEN jsonb_array_length(prices) > 0
					THEN prices->0->>'currency'
					ELSE NULL
				END
			) as common_currency
		FROM characteristics
		WHERE name = $1
		GROUP BY name
	`

	var name CharacteristicName
	err = r.pool.QueryRow(ctx, query, decodedName).Scan(
		&name.Name,
		&name.CharacteristicCount,
		&name.ProductsUsing,
		&name.TotalStock,
		&name.AvgPrice,
		&name.CommonCurrency,
	)
	if err != nil {
		return nil, fmt.Errorf("characteristic name not found: %w", err)
	}

	return &name, nil
}

// DeleteCharacteristicName deletes all characteristics with a specific name
func (r *Repository) DeleteCharacteristicName(ctx context.Context, characteristicName string) error {
	decodedName, err := url.QueryUnescape(characteristicName)
	if err != nil {
		return fmt.Errorf("invalid characteristic name encoding: %w", err)
	}

	query := `DELETE FROM characteristics WHERE name = $1`
	_, err = r.pool.Exec(ctx, query, decodedName)
	if err != nil {
		return fmt.Errorf("failed to delete characteristic name: %w", err)
	}

	return nil
}

// GetCharacteristicNameDeletionImpact calculates the impact of deleting a characteristic name
func (r *Repository) GetCharacteristicNameDeletionImpact(ctx context.Context, characteristicName string) (*DeletionImpact, error) {
	decodedName, err := url.QueryUnescape(characteristicName)
	if err != nil {
		return nil, fmt.Errorf("invalid characteristic name encoding: %w", err)
	}

	query := `
		SELECT
			COUNT(*) as records_to_delete,
			COUNT(DISTINCT product_id) as products_affected
		FROM characteristics
		WHERE name = $1
	`

	var impact DeletionImpact
	err = r.pool.QueryRow(ctx, query, decodedName).Scan(
		&impact.RecordsToDelete,
		&impact.ProductsAffected,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate deletion impact: %w", err)
	}

	return &impact, nil
}

// ============================================================================
// CHARACTERISTIC VALUE METHODS (Level 2)
// ============================================================================

// ListCharacteristicValues returns all characteristics with a specific name
func (r *Repository) ListCharacteristicValues(ctx context.Context, characteristicName string, limit, offset int, search string) ([]CharacteristicValue, int, error) {
	decodedName, err := url.QueryUnescape(characteristicName)
	if err != nil {
		return nil, 0, fmt.Errorf("invalid characteristic name encoding: %w", err)
	}

	var values []CharacteristicValue
	var total int

	// Build search condition
	searchCondition := ""
	searchArgs := []interface{}{decodedName}
	argIndex := 2

	if search != "" {
		searchCondition = fmt.Sprintf("AND (c.code ILIKE $%d OR c.reference ILIKE $%d OR prod.name ILIKE $%d)", argIndex, argIndex, argIndex)
		searchArgs = append(searchArgs, "%"+search+"%")
		argIndex++
	}

	// Get total count
	countQuery := fmt.Sprintf(`
		SELECT COUNT(*)
		FROM characteristics c
		WHERE c.name = $1 %s
	`, searchCondition)

	err = r.pool.QueryRow(ctx, countQuery, searchArgs...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count characteristic values: %w", err)
	}

	// Get characteristic values with product information
	query := fmt.Sprintf(`
		SELECT
			c.id,
			c.product_id,
			prod.name as product_name,
			prod.code as product_code,
			c.ultra_id,
			c.code,
			c.reference,
			c.name,
			c.prices,
			c.stock_warehouse,
			c.stock_showroom,
			c.stock_total,
			c.is_active
		FROM characteristics c
		LEFT JOIN products prod ON c.product_id = prod.id
		WHERE c.name = $1 %s
		ORDER BY prod.name, c.code
		LIMIT $%d OFFSET $%d
	`, searchCondition, argIndex, argIndex+1)

	queryArgs := append(searchArgs, limit, offset)
	rows, err := r.pool.Query(ctx, query, queryArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list characteristic values: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var value CharacteristicValue
		err := rows.Scan(
			&value.ID,
			&value.ProductID,
			&value.ProductName,
			&value.ProductCode,
			&value.UltraID,
			&value.Code,
			&value.Reference,
			&value.Name,
			&value.Prices,
			&value.StockWarehouse,
			&value.StockShowroom,
			&value.StockTotal,
			&value.IsActive,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan characteristic value: %w", err)
		}
		values = append(values, value)
	}

	return values, total, nil
}

// UpdateCharacteristicValue updates a single characteristic value
func (r *Repository) UpdateCharacteristicValue(ctx context.Context, id uuid.UUID, updates map[string]interface{}) error {
	// Build dynamic UPDATE query
	setClauses := []string{}
	args := []interface{}{}
	argIndex := 1

	// Whitelist map for SQL injection prevention
	allowedFields := map[string]string{
		"code":            "code",
		"reference":       "reference",
		"stock_warehouse": "stock_warehouse",
		"stock_showroom":  "stock_showroom",
		"stock_total":     "stock_total",
		"is_active":       "is_active",
	}

	for field, value := range updates {
		sanitizedField, ok := allowedFields[field]
		if !ok {
			return fmt.Errorf("field %s is not allowed for update", field)
		}
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", sanitizedField, argIndex))
		args = append(args, value)
		argIndex++
	}

	if len(setClauses) == 0 {
		return fmt.Errorf("no fields to update")
	}

	args = append(args, id)
	query := fmt.Sprintf(`
		UPDATE characteristics
		SET %s, updated_at = NOW()
		WHERE id = $%d
	`, strings.Join(setClauses, ", "), argIndex)

	result, err := r.pool.Exec(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("failed to update characteristic value: %w", err)
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("characteristic value not found")
	}

	return nil
}

// DeleteCharacteristicValue deletes a single characteristic value by ID
func (r *Repository) DeleteCharacteristicValue(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM characteristics WHERE id = $1`
	result, err := r.pool.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete characteristic value: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("characteristic value not found")
	}

	return nil
}

// BulkDeleteCharacteristicValues deletes multiple characteristic values by IDs
func (r *Repository) BulkDeleteCharacteristicValues(ctx context.Context, ids []uuid.UUID) error {
	if len(ids) == 0 {
		return nil
	}

	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{
		IsoLevel: pgx.RepeatableRead,
	})
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	query := `DELETE FROM characteristics WHERE id = ANY($1)`
	result, err := tx.Exec(ctx, query, ids)
	if err != nil {
		return fmt.Errorf("failed to bulk delete characteristic values: %w", err)
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("no characteristic values found for deletion")
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// BulkUpdateCharacteristicValues updates multiple characteristic values
func (r *Repository) BulkUpdateCharacteristicValues(ctx context.Context, ids []uuid.UUID, updates map[string]interface{}) error {
	if len(ids) == 0 {
		return nil
	}

	// Build dynamic UPDATE query
	setClauses := []string{}
	args := []interface{}{}
	argIndex := 1

	// Whitelist map for SQL injection prevention
	allowedFields := map[string]string{
		"stock_warehouse": "stock_warehouse",
		"stock_showroom":  "stock_showroom",
		"stock_total":     "stock_total",
		"is_active":       "is_active",
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

	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{
		IsoLevel: pgx.RepeatableRead,
	})
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	args = append(args, ids)
	query := fmt.Sprintf(`
		UPDATE characteristics
		SET %s, updated_at = NOW()
		WHERE id = ANY($%d)
	`, strings.Join(setClauses, ", "), argIndex)

	result, err := tx.Exec(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("failed to bulk update characteristic values: %w", err)
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("no characteristic values found for update")
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}
