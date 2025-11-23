package repository

import (
	"context"
	"fmt"
	"net/url"
	"strings"

	"github.com/google/uuid"
)

// ============================================================================
// PROPERTY HIERARCHY TYPES
// ============================================================================

// PropertyGroup represents a group in the property hierarchy
type PropertyGroup struct {
	GroupName          string `json:"group_name"`
	PropertyCount      int    `json:"property_count"`       // Number of unique property names
	ValueCount         int    `json:"value_count"`          // Total property records
	ProductsUsing      int    `json:"products_using"`       // Number of products using this group
	CommonIsFilter     bool   `json:"common_is_filter"`     // Most common is_filter value
	CommonIsModification bool `json:"common_is_modification"` // Most common is_modification value
}

// PropertyName represents a property name within a group
type PropertyName struct {
	GroupName            string  `json:"group_name"`
	PropertyName         string  `json:"property_name"`
	PropertyCode         *string `json:"property_code"`
	ValueCount           int     `json:"value_count"`            // Total property records
	UniqueValueCount     int     `json:"unique_value_count"`     // Number of unique values
	ProductsUsing        int     `json:"products_using"`         // Number of products using this property
	CommonValueType      *string `json:"common_value_type"`      // Most common value_type
	CommonIsFilter       bool    `json:"common_is_filter"`       // Most common is_filter value
	CommonIsModification bool    `json:"common_is_modification"` // Most common is_modification value
}

// PropertyValue represents a value for a property name
type PropertyValue struct {
	ID                 uuid.UUID  `json:"id"`
	ProductID          uuid.UUID  `json:"product_id"`
	ProductName        *string    `json:"product_name,omitempty"`
	ProductCode        *string    `json:"product_code,omitempty"`
	GroupName          *string    `json:"group_name"`
	PropertyName       string     `json:"property_name"`
	PropertyCode       *string    `json:"property_code"`
	Value              *string    `json:"value"`
	ValueType          *string    `json:"value_type"`
	SortOrder          int        `json:"sort_order"`
	IsFilter           bool       `json:"is_filter"`
	IsModification     bool       `json:"is_modification"`
}

// DeletionImpact represents the impact of deleting a group/property
type DeletionImpact struct {
	RecordsToDelete int `json:"records_to_delete"`
	ProductsAffected int `json:"products_affected"`
}

// ============================================================================
// PROPERTY GROUP METHODS (Level 1)
// ============================================================================

// ListPropertyGroups returns all property groups with statistics
func (r *Repository) ListPropertyGroups(ctx context.Context, limit, offset int, search string) ([]PropertyGroup, int, error) {
	var groups []PropertyGroup
	var total int

	// Build search condition
	searchCondition := ""
	searchArgs := []interface{}{}
	argIndex := 1

	if search != "" {
		searchCondition = fmt.Sprintf("WHERE group_name ILIKE $%d", argIndex)
		searchArgs = append(searchArgs, "%"+search+"%")
		argIndex++
	}

	// Get total count
	countQuery := fmt.Sprintf(`
		SELECT COUNT(DISTINCT group_name)
		FROM properties
		%s
	`, searchCondition)

	err := r.pool.QueryRow(ctx, countQuery, searchArgs...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count property groups: %w", err)
	}

	// Get groups with statistics
	query := fmt.Sprintf(`
		SELECT
			group_name,
			COUNT(DISTINCT property_name) as property_count,
			COUNT(*) as value_count,
			COUNT(DISTINCT product_id) as products_using,
			MODE() WITHIN GROUP (ORDER BY is_filter) as common_is_filter,
			MODE() WITHIN GROUP (ORDER BY is_modification) as common_is_modification
		FROM properties
		%s
		GROUP BY group_name
		ORDER BY group_name
		LIMIT $%d OFFSET $%d
	`, searchCondition, argIndex, argIndex+1)

	queryArgs := append(searchArgs, limit, offset)
	rows, err := r.pool.Query(ctx, query, queryArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list property groups: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var group PropertyGroup
		err := rows.Scan(
			&group.GroupName,
			&group.PropertyCount,
			&group.ValueCount,
			&group.ProductsUsing,
			&group.CommonIsFilter,
			&group.CommonIsModification,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan property group: %w", err)
		}
		groups = append(groups, group)
	}

	return groups, total, nil
}

// GetPropertyGroupByName returns a single property group by name
func (r *Repository) GetPropertyGroupByName(ctx context.Context, groupName string) (*PropertyGroup, error) {
	// Decode URL-encoded group name
	decodedName, err := url.QueryUnescape(groupName)
	if err != nil {
		return nil, fmt.Errorf("invalid group name encoding: %w", err)
	}

	query := `
		SELECT
			group_name,
			COUNT(DISTINCT property_name) as property_count,
			COUNT(*) as value_count,
			COUNT(DISTINCT product_id) as products_using,
			MODE() WITHIN GROUP (ORDER BY is_filter) as common_is_filter,
			MODE() WITHIN GROUP (ORDER BY is_modification) as common_is_modification
		FROM properties
		WHERE group_name = $1
		GROUP BY group_name
	`

	var group PropertyGroup
	err = r.pool.QueryRow(ctx, query, decodedName).Scan(
		&group.GroupName,
		&group.PropertyCount,
		&group.ValueCount,
		&group.ProductsUsing,
		&group.CommonIsFilter,
		&group.CommonIsModification,
	)
	if err != nil {
		return nil, fmt.Errorf("property group not found: %w", err)
	}

	return &group, nil
}

// DeletePropertyGroup deletes all properties in a group
func (r *Repository) DeletePropertyGroup(ctx context.Context, groupName string) error {
	decodedName, err := url.QueryUnescape(groupName)
	if err != nil {
		return fmt.Errorf("invalid group name encoding: %w", err)
	}

	query := `DELETE FROM properties WHERE group_name = $1`
	_, err = r.pool.Exec(ctx, query, decodedName)
	if err != nil {
		return fmt.Errorf("failed to delete property group: %w", err)
	}

	return nil
}

// GetGroupDeletionImpact calculates the impact of deleting a group
func (r *Repository) GetGroupDeletionImpact(ctx context.Context, groupName string) (*DeletionImpact, error) {
	decodedName, err := url.QueryUnescape(groupName)
	if err != nil {
		return nil, fmt.Errorf("invalid group name encoding: %w", err)
	}

	query := `
		SELECT
			COUNT(*) as records_to_delete,
			COUNT(DISTINCT product_id) as products_affected
		FROM properties
		WHERE group_name = $1
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
// PROPERTY NAME METHODS (Level 2)
// ============================================================================

// ListPropertyNames returns all property names within a group
func (r *Repository) ListPropertyNames(ctx context.Context, groupName string, limit, offset int, search string) ([]PropertyName, int, error) {
	decodedGroupName, err := url.QueryUnescape(groupName)
	if err != nil {
		return nil, 0, fmt.Errorf("invalid group name encoding: %w", err)
	}

	var names []PropertyName
	var total int

	// Build search condition
	searchCondition := ""
	searchArgs := []interface{}{decodedGroupName}
	argIndex := 2

	if search != "" {
		searchCondition = fmt.Sprintf("AND property_name ILIKE $%d", argIndex)
		searchArgs = append(searchArgs, "%"+search+"%")
		argIndex++
	}

	// Get total count
	countQuery := fmt.Sprintf(`
		SELECT COUNT(DISTINCT property_name)
		FROM properties
		WHERE group_name = $1 %s
	`, searchCondition)

	err = r.pool.QueryRow(ctx, countQuery, searchArgs...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count property names: %w", err)
	}

	// Get property names with statistics
	query := fmt.Sprintf(`
		SELECT
			group_name,
			property_name,
			MODE() WITHIN GROUP (ORDER BY property_code) as property_code,
			COUNT(*) as value_count,
			COUNT(DISTINCT value) as unique_value_count,
			COUNT(DISTINCT product_id) as products_using,
			MODE() WITHIN GROUP (ORDER BY value_type) as common_value_type,
			MODE() WITHIN GROUP (ORDER BY is_filter) as common_is_filter,
			MODE() WITHIN GROUP (ORDER BY is_modification) as common_is_modification
		FROM properties
		WHERE group_name = $1 %s
		GROUP BY group_name, property_name
		ORDER BY property_name
		LIMIT $%d OFFSET $%d
	`, searchCondition, argIndex, argIndex+1)

	queryArgs := append(searchArgs, limit, offset)
	rows, err := r.pool.Query(ctx, query, queryArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list property names: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var name PropertyName
		err := rows.Scan(
			&name.GroupName,
			&name.PropertyName,
			&name.PropertyCode,
			&name.ValueCount,
			&name.UniqueValueCount,
			&name.ProductsUsing,
			&name.CommonValueType,
			&name.CommonIsFilter,
			&name.CommonIsModification,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan property name: %w", err)
		}
		names = append(names, name)
	}

	return names, total, nil
}

// GetPropertyNameByName returns a single property name by group and name
func (r *Repository) GetPropertyNameByName(ctx context.Context, groupName, propertyName string) (*PropertyName, error) {
	decodedGroupName, err := url.QueryUnescape(groupName)
	if err != nil {
		return nil, fmt.Errorf("invalid group name encoding: %w", err)
	}

	decodedPropertyName, err := url.QueryUnescape(propertyName)
	if err != nil {
		return nil, fmt.Errorf("invalid property name encoding: %w", err)
	}

	query := `
		SELECT
			group_name,
			property_name,
			MODE() WITHIN GROUP (ORDER BY property_code) as property_code,
			COUNT(*) as value_count,
			COUNT(DISTINCT value) as unique_value_count,
			COUNT(DISTINCT product_id) as products_using,
			MODE() WITHIN GROUP (ORDER BY value_type) as common_value_type,
			MODE() WITHIN GROUP (ORDER BY is_filter) as common_is_filter,
			MODE() WITHIN GROUP (ORDER BY is_modification) as common_is_modification
		FROM properties
		WHERE group_name = $1 AND property_name = $2
		GROUP BY group_name, property_name
	`

	var name PropertyName
	err = r.pool.QueryRow(ctx, query, decodedGroupName, decodedPropertyName).Scan(
		&name.GroupName,
		&name.PropertyName,
		&name.PropertyCode,
		&name.ValueCount,
		&name.UniqueValueCount,
		&name.ProductsUsing,
		&name.CommonValueType,
		&name.CommonIsFilter,
		&name.CommonIsModification,
	)
	if err != nil {
		return nil, fmt.Errorf("property name not found: %w", err)
	}

	return &name, nil
}

// DeletePropertyName deletes all properties with a specific name in a group
func (r *Repository) DeletePropertyName(ctx context.Context, groupName, propertyName string) error {
	decodedGroupName, err := url.QueryUnescape(groupName)
	if err != nil {
		return fmt.Errorf("invalid group name encoding: %w", err)
	}

	decodedPropertyName, err := url.QueryUnescape(propertyName)
	if err != nil {
		return fmt.Errorf("invalid property name encoding: %w", err)
	}

	query := `DELETE FROM properties WHERE group_name = $1 AND property_name = $2`
	_, err = r.pool.Exec(ctx, query, decodedGroupName, decodedPropertyName)
	if err != nil {
		return fmt.Errorf("failed to delete property name: %w", err)
	}

	return nil
}

// GetPropertyNameDeletionImpact calculates the impact of deleting a property name
func (r *Repository) GetPropertyNameDeletionImpact(ctx context.Context, groupName, propertyName string) (*DeletionImpact, error) {
	decodedGroupName, err := url.QueryUnescape(groupName)
	if err != nil {
		return nil, fmt.Errorf("invalid group name encoding: %w", err)
	}

	decodedPropertyName, err := url.QueryUnescape(propertyName)
	if err != nil {
		return nil, fmt.Errorf("invalid property name encoding: %w", err)
	}

	query := `
		SELECT
			COUNT(*) as records_to_delete,
			COUNT(DISTINCT product_id) as products_affected
		FROM properties
		WHERE group_name = $1 AND property_name = $2
	`

	var impact DeletionImpact
	err = r.pool.QueryRow(ctx, query, decodedGroupName, decodedPropertyName).Scan(
		&impact.RecordsToDelete,
		&impact.ProductsAffected,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate deletion impact: %w", err)
	}

	return &impact, nil
}

// ============================================================================
// PROPERTY VALUE METHODS (Level 3)
// ============================================================================

// ListPropertyValues returns all values for a property name
func (r *Repository) ListPropertyValues(ctx context.Context, groupName, propertyName string, limit, offset int, search string) ([]PropertyValue, int, error) {
	decodedGroupName, err := url.QueryUnescape(groupName)
	if err != nil {
		return nil, 0, fmt.Errorf("invalid group name encoding: %w", err)
	}

	decodedPropertyName, err := url.QueryUnescape(propertyName)
	if err != nil {
		return nil, 0, fmt.Errorf("invalid property name encoding: %w", err)
	}

	var values []PropertyValue
	var total int

	// Build search condition
	searchCondition := ""
	searchArgs := []interface{}{decodedGroupName, decodedPropertyName}
	argIndex := 3

	if search != "" {
		searchCondition = fmt.Sprintf("AND (p.value ILIKE $%d OR prod.name ILIKE $%d)", argIndex, argIndex)
		searchArgs = append(searchArgs, "%"+search+"%")
		argIndex++
	}

	// Get total count
	countQuery := fmt.Sprintf(`
		SELECT COUNT(*)
		FROM properties p
		WHERE p.group_name = $1 AND p.property_name = $2 %s
	`, searchCondition)

	err = r.pool.QueryRow(ctx, countQuery, searchArgs...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count property values: %w", err)
	}

	// Get property values with product information
	query := fmt.Sprintf(`
		SELECT
			p.id,
			p.product_id,
			prod.name as product_name,
			prod.code as product_code,
			p.group_name,
			p.property_name,
			p.property_code,
			p.value,
			p.value_type,
			p.sort_order,
			p.is_filter,
			p.is_modification
		FROM properties p
		LEFT JOIN products prod ON p.product_id = prod.id
		WHERE p.group_name = $1 AND p.property_name = $2 %s
		ORDER BY p.value, prod.name
		LIMIT $%d OFFSET $%d
	`, searchCondition, argIndex, argIndex+1)

	queryArgs := append(searchArgs, limit, offset)
	rows, err := r.pool.Query(ctx, query, queryArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list property values: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var value PropertyValue
		err := rows.Scan(
			&value.ID,
			&value.ProductID,
			&value.ProductName,
			&value.ProductCode,
			&value.GroupName,
			&value.PropertyName,
			&value.PropertyCode,
			&value.Value,
			&value.ValueType,
			&value.SortOrder,
			&value.IsFilter,
			&value.IsModification,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan property value: %w", err)
		}
		values = append(values, value)
	}

	return values, total, nil
}

// UpdatePropertyValue updates a single property value
func (r *Repository) UpdatePropertyValue(ctx context.Context, id uuid.UUID, updates map[string]interface{}) error {
	// Build dynamic UPDATE query
	setClauses := []string{}
	args := []interface{}{}
	argIndex := 1

	// Whitelist map for SQL injection prevention
	allowedFields := map[string]string{
		"value":           "value",
		"value_type":      "value_type",
		"sort_order":      "sort_order",
		"is_filter":       "is_filter",
		"is_modification": "is_modification",
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
		UPDATE properties
		SET %s, updated_at = NOW()
		WHERE id = $%d
	`, strings.Join(setClauses, ", "), argIndex)

	result, err := r.pool.Exec(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("failed to update property value: %w", err)
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("property value not found")
	}

	return nil
}

// DeletePropertyValue deletes a single property value by ID
func (r *Repository) DeletePropertyValue(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM properties WHERE id = $1`
	result, err := r.pool.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete property value: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("property value not found")
	}

	return nil
}

// BulkDeletePropertyValues deletes multiple property values by IDs
func (r *Repository) BulkDeletePropertyValues(ctx context.Context, ids []uuid.UUID) error {
	if len(ids) == 0 {
		return nil
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	query := `DELETE FROM properties WHERE id = ANY($1)`
	result, err := tx.Exec(ctx, query, ids)
	if err != nil {
		return fmt.Errorf("failed to bulk delete property values: %w", err)
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("no property values found for deletion")
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// BulkUpdatePropertyValues updates multiple property values
func (r *Repository) BulkUpdatePropertyValues(ctx context.Context, ids []uuid.UUID, updates map[string]interface{}) error {
	if len(ids) == 0 {
		return nil
	}

	// Build dynamic UPDATE query
	setClauses := []string{}
	args := []interface{}{}
	argIndex := 1

	// Whitelist map for SQL injection prevention
	allowedFields := map[string]string{
		"value_type":      "value_type",
		"is_filter":       "is_filter",
		"is_modification": "is_modification",
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

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	args = append(args, ids)
	query := fmt.Sprintf(`
		UPDATE properties
		SET %s, updated_at = NOW()
		WHERE id = ANY($%d)
	`, strings.Join(setClauses, ", "), argIndex)

	result, err := tx.Exec(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("failed to bulk update property values: %w", err)
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("no property values found for update")
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}
