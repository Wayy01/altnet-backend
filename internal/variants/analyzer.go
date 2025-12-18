package variants

import (
	"sort"
	"strings"

	"github.com/google/uuid"
	"ultra-api-testing/internal/models"
)

// VariantPropertyConfig defines the allowed variant properties
// Properties are matched by property name only - group name is ignored because
// the same property can appear in multiple groups (e.g., "Internal Storage {GB}"
// can be in "Essential Characteristics", "Memory", "Features", etc.)
type VariantPropertyConfig struct {
	PropertyName string // The property name to match (group-agnostic)
	DisplayName  string // User-friendly name for the variant type
}

// AllowedVariantProperties defines the ONLY properties that can be used for variants
// These are matched by property_name only from the properties table (group is ignored)
var AllowedVariantProperties = []VariantPropertyConfig{
	// English/Russian properties
	{
		PropertyName: "Colour Name | Название Расцветки",
		DisplayName:  "Color",
	},
	{
		PropertyName: "Internal Storage {GB}",
		DisplayName:  "Storage",
	},
	{
		PropertyName: "RAM Size",
		DisplayName:  "RAM",
	},
	// Romanian properties
	{
		PropertyName: "Culoare",
		DisplayName:  "Color",
	},
	{
		PropertyName: "Stocare",
		DisplayName:  "Storage",
	},
	{
		PropertyName: "Memorie RAM",
		DisplayName:  "RAM",
	},
}

// PropertyAnalyzer analyzes product properties to detect which ones are variant properties
type PropertyAnalyzer struct {
	// Map for quick lookup of allowed properties (key: property name)
	allowedProperties map[string]VariantPropertyConfig
}

// NewPropertyAnalyzer creates a new PropertyAnalyzer
func NewPropertyAnalyzer() *PropertyAnalyzer {
	allowed := make(map[string]VariantPropertyConfig)
	for _, config := range AllowedVariantProperties {
		// Key by property name only - group is ignored
		allowed[config.PropertyName] = config
	}
	return &PropertyAnalyzer{
		allowedProperties: allowed,
	}
}

// isAllowedVariantProperty checks if a property is in the allowed list by property name only
func (a *PropertyAnalyzer) isAllowedVariantProperty(propertyName string) (VariantPropertyConfig, bool) {
	config, ok := a.allowedProperties[propertyName]
	return config, ok
}

// AnalyzeVariantProperties analyzes properties of products in a group to determine variant properties
//
// ONLY the following 3 properties are considered for variants (matched by property name only):
// 1. Property: "Colour Name | Название Расцветки" (Color)
// 2. Property: "Internal Storage {GB}" (Storage)
// 3. Property: "RAM Size" (RAM)
//
// Group name is ignored because the same property can appear in multiple groups.
//
// A property is a variant ONLY if:
// 1. It is in the allowed list above
// 2. It has multiple distinct values within the product group
func (a *PropertyAnalyzer) AnalyzeVariantProperties(
	products []*models.Product,
	properties map[uuid.UUID][]*models.Property,
) []*models.VariantPropertyResult {
	if len(products) < 2 {
		return nil
	}

	results := make([]*models.VariantPropertyResult, 0)
	seen := make(map[string]bool)

	// Only analyze the allowed variant properties
	for _, config := range AllowedVariantProperties {
		// Get distinct values for this property across all products in the group
		// Match by property name only - group is ignored
		values := a.getDistinctValuesForProperty(products, properties, config.PropertyName)

		// Only include if there are multiple distinct values (i.e., it varies)
		if len(values) > 1 {
			if !seen[config.PropertyName] {
				results = append(results, &models.VariantPropertyResult{
					PropertyName:   config.DisplayName, // Use display name for cleaner UI
					ParentProperty: nil,                // We no longer do scoped variants
					ParentValue:    nil,
					Values:         values,
					ProductCount:   len(products),
				})
				seen[config.PropertyName] = true
			}
		}
	}

	// Sort results by display name for consistent output (Color, RAM, Storage)
	sort.Slice(results, func(i, j int) bool {
		return results[i].PropertyName < results[j].PropertyName
	})

	return results
}

// getDistinctValuesForProperty returns distinct values for a property name
// Group name is ignored - property is matched by name only
func (a *PropertyAnalyzer) getDistinctValuesForProperty(
	products []*models.Product,
	properties map[uuid.UUID][]*models.Property,
	propertyName string,
) []string {
	valueSet := make(map[string]bool)

	for _, product := range products {
		if props, ok := properties[product.ID]; ok {
			for _, prop := range props {
				// Match by property name only - group is ignored
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

// BuildVariantMatrix builds a variant matrix for display in the UI
// Only includes the 3 allowed variant properties as columns
func (a *PropertyAnalyzer) BuildVariantMatrix(
	products []*models.Product,
	properties map[uuid.UUID][]*models.Property,
	variantProps []*models.VariantPropertyResult,
) *models.VariantMatrix {
	if len(products) == 0 {
		return nil
	}

	// Build a map of display name -> values from variant results
	variantPropNames := make(map[string]bool)
	for _, vp := range variantProps {
		variantPropNames[vp.PropertyName] = true
	}

	// Build columns only for allowed variant properties - deduplicate by display name
	// Multiple properties can map to the same display name (e.g., "RAM Size" and "Memorie RAM" both → "RAM")
	columnsByDisplayName := make(map[string]*models.VariantMatrixColumn)
	for _, config := range AllowedVariantProperties {
		// Match by property name only - group is ignored
		values := a.getDistinctValuesForProperty(products, properties, config.PropertyName)

		if existing, ok := columnsByDisplayName[config.DisplayName]; ok {
			// Merge values into existing column (avoid duplicates)
			for _, v := range values {
				if !stringSliceContains(existing.Values, v) {
					existing.Values = append(existing.Values, v)
				}
			}
			existing.DistinctCount = len(existing.Values)
			existing.IsVariant = existing.DistinctCount > 1
		} else {
			columnsByDisplayName[config.DisplayName] = &models.VariantMatrixColumn{
				PropertyName:  config.DisplayName,
				DistinctCount: len(values),
				Values:        values,
				IsVariant:     len(values) > 1,
			}
		}
	}

	// Convert map to slice
	columns := make([]models.VariantMatrixColumn, 0, len(columnsByDisplayName))
	for _, col := range columnsByDisplayName {
		columns = append(columns, *col)
	}

	// Sort columns: variants first, then by property name
	sort.Slice(columns, func(i, j int) bool {
		if columns[i].IsVariant != columns[j].IsVariant {
			return columns[i].IsVariant // true comes before false
		}
		return columns[i].PropertyName < columns[j].PropertyName
	})

	// Build rows with values for only the allowed variant properties
	rows := make([]models.VariantMatrixRow, 0, len(products))
	for _, product := range products {
		values := make(map[string]string)

		if props, ok := properties[product.ID]; ok {
			for _, prop := range props {
				if prop.Value != nil {
					// Check if this is an allowed variant property by name only
					if config, ok := a.isAllowedVariantProperty(prop.PropertyName); ok {
						values[config.DisplayName] = *prop.Value
					}
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

// stringSliceContains checks if a string slice contains a specific value
func stringSliceContains(slice []string, value string) bool {
	for _, v := range slice {
		if v == value {
			return true
		}
	}
	return false
}
