package variants

import (
	"sort"
	"strings"

	"github.com/google/uuid"
	"ultra-api-testing/internal/models"
)

// PropertyAnalyzer analyzes product properties to detect which ones are variant properties
type PropertyAnalyzer struct{}

// NewPropertyAnalyzer creates a new PropertyAnalyzer
func NewPropertyAnalyzer() *PropertyAnalyzer {
	return &PropertyAnalyzer{}
}

// AnalyzeVariantProperties analyzes properties of products in a group to determine variant properties
//
// THE KEY RULE:
// A property is a variant ONLY if it has multiple distinct values within the same parent scope.
//
// Example: iPhone 16 Pro Max group
// - 512GB has RAM: {16GB, 8GB} -> RAM is variant for 512GB (2 values)
// - 256GB has RAM: {16GB} -> RAM is NOT variant for 256GB (1 value only)
//
// This returns variant properties with their parent scope (if any) and distinct values.
func (a *PropertyAnalyzer) AnalyzeVariantProperties(
	products []*models.Product,
	properties map[uuid.UUID][]*models.Property,
) []*models.VariantPropertyResult {
	if len(products) < 2 {
		return nil
	}

	results := make([]*models.VariantPropertyResult, 0)

	// Get all unique property names across all products
	allPropertyNames := a.getUniquePropertyNames(products, properties)

	// Track which property combinations we've already recorded
	seen := make(map[string]bool)

	for _, propName := range allPropertyNames {
		// First, check if this property varies globally (across entire group)
		globalValues := a.getDistinctValues(products, properties, propName)

		if len(globalValues) > 1 {
			// This property varies globally - record it as a global variant
			key := propName + "::" // No parent
			if !seen[key] {
				results = append(results, &models.VariantPropertyResult{
					PropertyName:   propName,
					ParentProperty: nil,
					ParentValue:    nil,
					Values:         globalValues,
					ProductCount:   len(products),
				})
				seen[key] = true
			}
		}

		// Now check if this property varies within parent scopes
		// Group products by each other property to find parent relationships
		for _, otherPropName := range allPropertyNames {
			if otherPropName == propName {
				continue
			}

			// Group products by the value of otherPropName
			grouped := a.groupByPropertyValue(products, properties, otherPropName)

			for parentValue, productsInGroup := range grouped {
				if len(productsInGroup) < 2 {
					// Need at least 2 products to have variation
					continue
				}

				// Check if propName varies within this parent group
				valuesInParent := a.getDistinctValues(productsInGroup, properties, propName)

				if len(valuesInParent) > 1 {
					// This property varies within this parent scope
					key := propName + "::" + otherPropName + "::" + parentValue
					if !seen[key] {
						parentProp := otherPropName
						parentVal := parentValue
						results = append(results, &models.VariantPropertyResult{
							PropertyName:   propName,
							ParentProperty: &parentProp,
							ParentValue:    &parentVal,
							Values:         valuesInParent,
							ProductCount:   len(productsInGroup),
						})
						seen[key] = true
					}
				}
			}
		}
	}

	// Sort results by property name for consistent output
	sort.Slice(results, func(i, j int) bool {
		if results[i].PropertyName != results[j].PropertyName {
			return results[i].PropertyName < results[j].PropertyName
		}
		// If same property name, global variants come first
		if results[i].ParentProperty == nil && results[j].ParentProperty != nil {
			return true
		}
		if results[i].ParentProperty != nil && results[j].ParentProperty == nil {
			return false
		}
		// Both have parent properties, sort by parent property name
		if results[i].ParentProperty != nil && results[j].ParentProperty != nil {
			if *results[i].ParentProperty != *results[j].ParentProperty {
				return *results[i].ParentProperty < *results[j].ParentProperty
			}
			// Same parent property, sort by parent value
			if results[i].ParentValue != nil && results[j].ParentValue != nil {
				return *results[i].ParentValue < *results[j].ParentValue
			}
		}
		return false
	})

	return results
}

// getUniquePropertyNames returns all unique property names across products
func (a *PropertyAnalyzer) getUniquePropertyNames(
	products []*models.Product,
	properties map[uuid.UUID][]*models.Property,
) []string {
	nameSet := make(map[string]bool)

	for _, product := range products {
		if props, ok := properties[product.ID]; ok {
			for _, prop := range props {
				nameSet[prop.PropertyName] = true
			}
		}
	}

	names := make([]string, 0, len(nameSet))
	for name := range nameSet {
		names = append(names, name)
	}

	sort.Strings(names)
	return names
}

// getDistinctValues returns distinct values for a property across products
func (a *PropertyAnalyzer) getDistinctValues(
	products []*models.Product,
	properties map[uuid.UUID][]*models.Property,
	propertyName string,
) []string {
	valueSet := make(map[string]bool)

	for _, product := range products {
		if props, ok := properties[product.ID]; ok {
			for _, prop := range props {
				if prop.PropertyName == propertyName && prop.Value != nil {
					value := normalizePropertyValue(*prop.Value)
					if value != "" {
						valueSet[value] = true
					}
				}
			}
		}
	}

	values := make([]string, 0, len(valueSet))
	for value := range valueSet {
		values = append(values, value)
	}

	sort.Strings(values)
	return values
}

// groupByPropertyValue groups products by the value of a specific property
func (a *PropertyAnalyzer) groupByPropertyValue(
	products []*models.Product,
	properties map[uuid.UUID][]*models.Property,
	propertyName string,
) map[string][]*models.Product {
	grouped := make(map[string][]*models.Product)

	for _, product := range products {
		if props, ok := properties[product.ID]; ok {
			for _, prop := range props {
				if prop.PropertyName == propertyName && prop.Value != nil {
					value := normalizePropertyValue(*prop.Value)
					if value != "" {
						grouped[value] = append(grouped[value], product)
					}
				}
			}
		}
	}

	return grouped
}

// BuildVariantMatrix builds a variant matrix for display in the UI
func (a *PropertyAnalyzer) BuildVariantMatrix(
	products []*models.Product,
	properties map[uuid.UUID][]*models.Property,
	variantProps []*models.VariantPropertyResult,
) *models.VariantMatrix {
	if len(products) == 0 {
		return nil
	}

	// Collect all property names that appear in variant results (global only for columns)
	variantPropNames := make(map[string]bool)
	for _, vp := range variantProps {
		if vp.ParentProperty == nil {
			// Only include global variants as columns
			variantPropNames[vp.PropertyName] = true
		}
	}

	// Get all unique property names for the matrix
	allPropNames := a.getUniquePropertyNames(products, properties)

	// Build columns
	columns := make([]models.VariantMatrixColumn, 0)
	for _, propName := range allPropNames {
		values := a.getDistinctValues(products, properties, propName)
		isVariant := variantPropNames[propName]

		columns = append(columns, models.VariantMatrixColumn{
			PropertyName:  propName,
			DistinctCount: len(values),
			Values:        values,
			IsVariant:     isVariant,
		})
	}

	// Sort columns: variants first, then by property name
	sort.Slice(columns, func(i, j int) bool {
		if columns[i].IsVariant != columns[j].IsVariant {
			return columns[i].IsVariant // true comes before false
		}
		return columns[i].PropertyName < columns[j].PropertyName
	})

	// Build rows
	rows := make([]models.VariantMatrixRow, 0, len(products))
	for _, product := range products {
		values := make(map[string]string)

		if props, ok := properties[product.ID]; ok {
			for _, prop := range props {
				if prop.Value != nil {
					values[prop.PropertyName] = *prop.Value
				}
			}
		}

		rows = append(rows, models.VariantMatrixRow{
			ProductID:    product.ID,
			ProductName:  product.Name,
			MainImageURL: product.MainImageURL,
			PriceMin:     product.PriceMin,
			IsInStock:    product.IsInStock,
			Values:       values,
		})
	}

	return &models.VariantMatrix{
		Columns: columns,
		Rows:    rows,
	}
}

// normalizePropertyValue normalizes a property value for comparison
func normalizePropertyValue(value string) string {
	// Trim whitespace
	result := strings.TrimSpace(value)

	// Could add more normalization here if needed
	return result
}
