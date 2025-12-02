package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"ultra-api-testing/internal/models"
)

// Field whitelists are now generated from field schemas (single source of truth)
// This prevents SQL injection and ensures consistency between schemas and updates

// validateFieldName checks if a field name is in the allowed whitelist
func validateFieldName(fieldName string, allowedFields map[string]bool) error {
	if !allowedFields[fieldName] {
		return fmt.Errorf("field '%s' is not allowed for update", fieldName)
	}
	return nil
}

// UpdateBrandSelective updates only the specified fields of a brand
func (r *Repository) UpdateBrandSelective(ctx context.Context, ultraID string, updates map[string]interface{}, config models.FieldConfig) ([]models.FieldChange, error) {
	if len(updates) == 0 {
		return nil, fmt.Errorf("no fields to update")
	}

	// Get existing brand to track changes
	existingBrand, err := r.GetBrandByUltraID(ctx, ultraID)
	if err != nil {
		return nil, fmt.Errorf("failed to get existing brand: %w", err)
	}

	// Generate whitelist from field schema (single source of truth)
	brandAllowedFields := models.GetAllowedFieldsForStep(models.SyncStepBrands)

	// Build dynamic UPDATE query
	setClauses := make([]string, 0)
	args := make([]interface{}, 0)
	argIndex := 1
	fieldChanges := make([]models.FieldChange, 0)

	for fieldName, newValue := range updates {
		// Validate field name against whitelist (SQL injection prevention)
		if err := validateFieldName(fieldName, brandAllowedFields); err != nil {
			return nil, err
		}

		// Skip excluded fields
		if isFieldExcluded(fieldName, config) {
			continue
		}

		// Skip if only updating included fields and this isn't one
		if len(config.IncludeFields) > 0 && !isFieldIncluded(fieldName, config) {
			continue
		}

		// Skip null values if configured
		if !config.UpdateNullValues && newValue == nil {
			continue
		}

		// Track the change
		var oldValue interface{}
		wasNull := true

		switch fieldName {
		case "name":
			oldValue = existingBrand.Name
			wasNull = existingBrand.Name == ""
		case "slug":
			oldValue = existingBrand.Slug
			wasNull = existingBrand.Slug == ""
		case "logo_url":
			if existingBrand.LogoURL != nil {
				oldValue = *existingBrand.LogoURL
				wasNull = false
			}
		case "is_active":
			oldValue = existingBrand.IsActive
			wasNull = false
		}

		// Only record if value actually changed
		if oldValue != newValue {
			fieldChanges = append(fieldChanges, models.FieldChange{
				FieldName: fieldName,
				OldValue:  oldValue,
				NewValue:  newValue,
				WasNull:   wasNull,
			})

			setClauses = append(setClauses, fmt.Sprintf("%s = $%d", fieldName, argIndex))
			args = append(args, newValue)
			argIndex++
		}
	}

	// If no fields changed, return empty
	if len(setClauses) == 0 {
		return fieldChanges, nil
	}

	// Always update updated_at
	setClauses = append(setClauses, fmt.Sprintf("updated_at = $%d", argIndex))
	args = append(args, time.Now())
	argIndex++

	// Add WHERE clause
	args = append(args, ultraID)

	query := fmt.Sprintf(
		"UPDATE brands SET %s WHERE ultra_id = $%d",
		strings.Join(setClauses, ", "),
		argIndex,
	)

	_, err = r.pool.Exec(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to update brand: %w", err)
	}

	return fieldChanges, nil
}

// UpdateCategorySelective updates only the specified fields of a category
func (r *Repository) UpdateCategorySelective(ctx context.Context, ultraID string, updates map[string]interface{}, config models.FieldConfig) ([]models.FieldChange, error) {
	if len(updates) == 0 {
		return nil, fmt.Errorf("no fields to update")
	}

	// Get existing category to track changes
	existingCategory, err := r.GetCategoryByUltraID(ctx, ultraID)
	if err != nil {
		return nil, fmt.Errorf("failed to get existing category: %w", err)
	}

	// Generate whitelist from field schema (single source of truth)
	categoryAllowedFields := models.GetAllowedFieldsForStep(models.SyncStepCategories)

	// Build dynamic UPDATE query
	setClauses := make([]string, 0)
	args := make([]interface{}, 0)
	argIndex := 1
	fieldChanges := make([]models.FieldChange, 0)

	for fieldName, newValue := range updates {
		// Validate field name against whitelist (SQL injection prevention)
		if err := validateFieldName(fieldName, categoryAllowedFields); err != nil {
			return nil, err
		}

		// Skip excluded fields
		if isFieldExcluded(fieldName, config) {
			continue
		}

		// Skip if only updating included fields and this isn't one
		if len(config.IncludeFields) > 0 && !isFieldIncluded(fieldName, config) {
			continue
		}

		// Skip null values if configured
		if !config.UpdateNullValues && newValue == nil {
			continue
		}

		// Track the change
		var oldValue interface{}
		wasNull := true

		switch fieldName {
		case "name":
			oldValue = existingCategory.Name
			wasNull = existingCategory.Name == ""
		case "parent_ultra_id":
			if existingCategory.ParentUltraID != nil {
				oldValue = *existingCategory.ParentUltraID
				wasNull = false
			}
		case "sort_order":
			oldValue = existingCategory.SortOrder
			wasNull = false
		case "image_url":
			if existingCategory.ImageURL != nil {
				oldValue = *existingCategory.ImageURL
				wasNull = false
			}
		case "is_active":
			oldValue = existingCategory.IsActive
			wasNull = false
		}

		// Only record if value actually changed
		if oldValue != newValue {
			fieldChanges = append(fieldChanges, models.FieldChange{
				FieldName: fieldName,
				OldValue:  oldValue,
				NewValue:  newValue,
				WasNull:   wasNull,
			})

			setClauses = append(setClauses, fmt.Sprintf("%s = $%d", fieldName, argIndex))
			args = append(args, newValue)
			argIndex++
		}
	}

	// If no fields changed, return empty
	if len(setClauses) == 0 {
		return fieldChanges, nil
	}

	// Always update updated_at
	setClauses = append(setClauses, fmt.Sprintf("updated_at = $%d", argIndex))
	args = append(args, time.Now())
	argIndex++

	// Add WHERE clause
	args = append(args, ultraID)

	query := fmt.Sprintf(
		"UPDATE categories SET %s WHERE ultra_id = $%d",
		strings.Join(setClauses, ", "),
		argIndex,
	)

	_, err = r.pool.Exec(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to update category: %w", err)
	}

	return fieldChanges, nil
}

// UpdateProductSelective updates only the specified fields of a product
func (r *Repository) UpdateProductSelective(ctx context.Context, ultraID string, updates map[string]interface{}, config models.FieldConfig) ([]models.FieldChange, error) {
	if len(updates) == 0 {
		return nil, fmt.Errorf("no fields to update")
	}

	// Get existing product to track changes
	existingProduct, err := r.GetProductByUltraID(ctx, ultraID)
	if err != nil {
		return nil, fmt.Errorf("failed to get existing product: %w", err)
	}

	// Generate whitelist from field schema (single source of truth)
	productAllowedFields := models.GetAllowedFieldsForStep(models.SyncStepProducts)

	// Build dynamic UPDATE query
	setClauses := make([]string, 0)
	args := make([]interface{}, 0)
	argIndex := 1
	fieldChanges := make([]models.FieldChange, 0)

	for fieldName, newValue := range updates {
		// Validate field name against whitelist (SQL injection prevention)
		if err := validateFieldName(fieldName, productAllowedFields); err != nil {
			return nil, err
		}

		// Skip excluded fields
		if isFieldExcluded(fieldName, config) {
			continue
		}

		// Skip if only updating included fields and this isn't one
		if len(config.IncludeFields) > 0 && !isFieldIncluded(fieldName, config) {
			continue
		}

		// Skip null values if configured
		if !config.UpdateNullValues && newValue == nil {
			continue
		}

		// Track the change
		var oldValue interface{}
		wasNull := true

		switch fieldName {
		case "name":
			oldValue = existingProduct.Name
			wasNull = existingProduct.Name == ""
		case "code":
			if existingProduct.Code != nil {
				oldValue = *existingProduct.Code
				wasNull = false
			}
		case "article":
			if existingProduct.Article != nil {
				oldValue = *existingProduct.Article
				wasNull = false
			}
		case "brand_id":
			if existingProduct.BrandID != nil {
				oldValue = existingProduct.BrandID.String()
				wasNull = false
			}
		case "category_id":
			if existingProduct.CategoryID != nil {
				oldValue = existingProduct.CategoryID.String()
				wasNull = false
			}
		case "parent_id":
			if existingProduct.ParentID != nil {
				oldValue = existingProduct.ParentID.String()
				wasNull = false
			}
		case "warranty":
			if existingProduct.Warranty != nil {
				oldValue = *existingProduct.Warranty
				wasNull = false
			}
		case "is_active":
			oldValue = existingProduct.IsActive
			wasNull = false
		case "is_service":
			oldValue = existingProduct.IsService
			wasNull = false
		case "images", "barcodes", "prices":
			// Handle JSONB fields specially
			var oldJSON []byte
			var marshalErr error

			switch fieldName {
			case "images":
				oldJSON, marshalErr = json.Marshal(existingProduct.Images)
			case "barcodes":
				oldJSON, marshalErr = json.Marshal(existingProduct.Barcodes)
			case "prices":
				oldJSON, marshalErr = json.Marshal(existingProduct.Prices)
			}

			if marshalErr != nil {
				return nil, fmt.Errorf("failed to marshal existing %s for comparison: %w", fieldName, marshalErr)
			}

			oldValue = string(oldJSON)
			wasNull = oldValue == nil || oldValue == "[]" || oldValue == "null"
		}

		// Only record if value actually changed
		if shouldRecordChange(oldValue, newValue) {
			fieldChanges = append(fieldChanges, models.FieldChange{
				FieldName: fieldName,
				OldValue:  oldValue,
				NewValue:  newValue,
				WasNull:   wasNull,
			})

			// Handle JSONB fields
			if fieldName == "images" || fieldName == "barcodes" || fieldName == "prices" {
				jsonValue, err := json.Marshal(newValue)
				if err != nil {
					return nil, fmt.Errorf("failed to marshal %s: %w", fieldName, err)
				}
				setClauses = append(setClauses, fmt.Sprintf("%s = $%d", fieldName, argIndex))
				args = append(args, jsonValue)
			} else {
				setClauses = append(setClauses, fmt.Sprintf("%s = $%d", fieldName, argIndex))
				args = append(args, newValue)
			}
			argIndex++
		}
	}

	// If no fields changed, return empty
	if len(setClauses) == 0 {
		return fieldChanges, nil
	}

	// Always update updated_at
	setClauses = append(setClauses, fmt.Sprintf("updated_at = $%d", argIndex))
	args = append(args, time.Now())
	argIndex++

	// Add WHERE clause
	args = append(args, ultraID)

	query := fmt.Sprintf(
		"UPDATE products SET %s WHERE ultra_id = $%d",
		strings.Join(setClauses, ", "),
		argIndex,
	)

	_, err = r.pool.Exec(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to update product: %w", err)
	}

	return fieldChanges, nil
}

// Helper functions

// isFieldExcluded checks if a field is in the exclude list
func isFieldExcluded(fieldName string, config models.FieldConfig) bool {
	for _, excluded := range config.ExcludeFields {
		if excluded == fieldName {
			return true
		}
	}
	return false
}

// isFieldIncluded checks if a field is in the include list
func isFieldIncluded(fieldName string, config models.FieldConfig) bool {
	for _, included := range config.IncludeFields {
		if included == fieldName {
			return true
		}
	}
	return false
}

// shouldRecordChange determines if a change should be recorded
func shouldRecordChange(oldValue, newValue interface{}) bool {
	// Handle nil cases
	if oldValue == nil && newValue == nil {
		return false
	}
	if oldValue == nil || newValue == nil {
		return true
	}

	// Simple equality check for most types
	return oldValue != newValue
}
