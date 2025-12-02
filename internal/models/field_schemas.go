package models

// GetAllFieldSchemas returns field schemas for all sync steps
func GetAllFieldSchemas() []SyncFieldSchema {
	return []SyncFieldSchema{
		getBrandFieldSchema(),
		getCategoryFieldSchema(),
		getProductFieldSchema(),
		getPropertiesFieldSchema(),
		getPricesFieldSchema(),
		getStockFieldSchema(),
		getExchangeRatesFieldSchema(),
	}
}

// GetFieldSchemaByStep returns field schema for a specific sync step
func GetFieldSchemaByStep(step SyncStep) *SyncFieldSchema {
	schemas := GetAllFieldSchemas()
	for _, schema := range schemas {
		if schema.Step == step {
			return &schema
		}
	}
	return nil
}

// GetAllowedFieldsForStep generates the allowed fields whitelist from field schema
// This ensures single source of truth for allowed fields (prevents SQL injection)
func GetAllowedFieldsForStep(step SyncStep) map[string]bool {
	schema := GetFieldSchemaByStep(step)
	if schema == nil {
		return make(map[string]bool)
	}

	allowedFields := make(map[string]bool)
	for _, field := range schema.Fields {
		allowedFields[field.Name] = true
	}
	// Always allow updated_at
	allowedFields["updated_at"] = true

	return allowedFields
}

// getBrandFieldSchema returns field schema for brands
func getBrandFieldSchema() SyncFieldSchema {
	return SyncFieldSchema{
		Step: SyncStepBrands,
		Fields: []FieldDefinition{
			{
				Name:        "name",
				DisplayName: "Brand Name",
				Type:        "string",
				Required:    true,
				Description: "Name of the brand",
				Group:       "basic",
				DefaultSync: true,
			},
			{
				Name:        "slug",
				DisplayName: "URL Slug",
				Type:        "string",
				Required:    true,
				Description: "URL-friendly slug generated from brand name",
				Group:       "basic",
				DefaultSync: true,
			},
			{
				Name:        "logo_url",
				DisplayName: "Logo URL",
				Type:        "string",
				Required:    false,
				Description: "URL to brand logo image",
				Group:       "media",
				DefaultSync: true,
			},
			{
				Name:        "is_active",
				DisplayName: "Active Status",
				Type:        "boolean",
				Required:    false,
				Description: "Whether the brand is active",
				Group:       "status",
				DefaultSync: true,
			},
		},
	}
}

// getCategoryFieldSchema returns field schema for categories
func getCategoryFieldSchema() SyncFieldSchema {
	return SyncFieldSchema{
		Step: SyncStepCategories,
		Fields: []FieldDefinition{
			{
				Name:        "name",
				DisplayName: "Category Name",
				Type:        "string",
				Required:    true,
				Description: "Name of the category",
				Group:       "basic",
				DefaultSync: true,
			},
			{
				Name:        "slug",
				DisplayName: "URL Slug",
				Type:        "string",
				Required:    true,
				Description: "URL-friendly slug generated from category name",
				Group:       "basic",
				DefaultSync: true,
			},
			{
				Name:        "parent_id",
				DisplayName: "Parent Category",
				Type:        "string",
				Required:    false,
				Description: "ID of parent category (for hierarchical structure)",
				Group:       "relationships",
				DefaultSync: true,
			},
			{
				Name:        "sort_order",
				DisplayName: "Sort Order",
				Type:        "number",
				Required:    false,
				Description: "Display order of category",
				Group:       "display",
				DefaultSync: true,
			},
			{
				Name:        "image_url",
				DisplayName: "Image URL",
				Type:        "string",
				Required:    false,
				Description: "URL to category image",
				Group:       "media",
				DefaultSync: true,
			},
			{
				Name:        "is_active",
				DisplayName: "Active Status",
				Type:        "boolean",
				Required:    false,
				Description: "Whether the category is active",
				Group:       "status",
				DefaultSync: true,
			},
		},
	}
}

// getProductFieldSchema returns field schema for products
func getProductFieldSchema() SyncFieldSchema {
	return SyncFieldSchema{
		Step: SyncStepProducts,
		Fields: []FieldDefinition{
			{
				Name:        "name",
				DisplayName: "Product Name",
				Type:        "string",
				Required:    true,
				Description: "Name of the product",
				Group:       "basic",
				DefaultSync: true,
			},
			{
				Name:        "slug",
				DisplayName: "URL Slug",
				Type:        "string",
				Required:    true,
				Description: "URL-friendly slug generated from product name",
				Group:       "basic",
				DefaultSync: true,
			},
			{
				Name:        "code",
				DisplayName: "Product Code",
				Type:        "string",
				Required:    false,
				Description: "Internal product code",
				Group:       "basic",
				DefaultSync: true,
			},
			{
				Name:        "article",
				DisplayName: "Article Number",
				Type:        "string",
				Required:    false,
				Description: "Article number or SKU",
				Group:       "basic",
				DefaultSync: true,
			},
			{
				Name:        "description",
				DisplayName: "Description",
				Type:        "string",
				Required:    false,
				Description: "Product description",
				Group:       "content",
				DefaultSync: true,
			},
			{
				Name:        "brand_id",
				DisplayName: "Brand",
				Type:        "string",
				Required:    false,
				Description: "ID of the brand",
				Group:       "relationships",
				DefaultSync: true,
			},
			{
				Name:        "category_id",
				DisplayName: "Category",
				Type:        "string",
				Required:    false,
				Description: "ID of the category",
				Group:       "relationships",
				DefaultSync: true,
			},
			{
				Name:        "parent_id",
				DisplayName: "Parent Product",
				Type:        "string",
				Required:    false,
				Description: "ID of parent product (for variants)",
				Group:       "relationships",
				DefaultSync: true,
			},
			{
				Name:        "main_image_url",
				DisplayName: "Main Image",
				Type:        "string",
				Required:    false,
				Description: "URL to main product image",
				Group:       "media",
				DefaultSync: true,
			},
			{
				Name:        "images",
				DisplayName: "All Images",
				Type:        "jsonb",
				Required:    false,
				Description: "Array of all product images with metadata",
				Group:       "media",
				DefaultSync: true,
			},
			{
				Name:        "warranty",
				DisplayName: "Warranty",
				Type:        "string",
				Required:    false,
				Description: "Warranty information",
				Group:       "content",
				DefaultSync: true,
			},
			{
				Name:        "barcodes",
				DisplayName: "Barcodes",
				Type:        "jsonb",
				Required:    false,
				Description: "Array of barcodes for the product",
				Group:       "identification",
				DefaultSync: true,
			},
			{
				Name:        "prices",
				DisplayName: "Prices",
				Type:        "jsonb",
				Required:    false,
				Description: "Array of prices in multiple currencies",
				Group:       "pricing",
				DefaultSync: true,
			},
			{
				Name:        "is_active",
				DisplayName: "Active Status",
				Type:        "boolean",
				Required:    false,
				Description: "Whether the product is active",
				Group:       "status",
				DefaultSync: true,
			},
			{
				Name:        "is_service",
				DisplayName: "Is Service",
				Type:        "boolean",
				Required:    false,
				Description: "Whether this is a service product",
				Group:       "flags",
				DefaultSync: true,
			},
		},
	}
}

// getPropertiesFieldSchema returns field schema for properties
func getPropertiesFieldSchema() SyncFieldSchema {
	return SyncFieldSchema{
		Step: SyncStepProperties,
		Fields: []FieldDefinition{
			{
				Name:        "property_name",
				DisplayName: "Property Name",
				Type:        "string",
				Required:    true,
				Description: "Name of the property (e.g., 'Color', 'Storage')",
				Group:       "basic",
				DefaultSync: true,
			},
			{
				Name:        "value",
				DisplayName: "Value",
				Type:        "string",
				Required:    false,
				Description: "Value of the property",
				Group:       "basic",
				DefaultSync: true,
			},
			{
				Name:        "group_name",
				DisplayName: "Group Name",
				Type:        "string",
				Required:    false,
				Description: "Name of the property group for categorization",
				Group:       "organization",
				DefaultSync: true,
			},
			{
				Name:        "value_type",
				DisplayName: "Value Type",
				Type:        "string",
				Required:    false,
				Description: "Type of the value (e.g., 'string', 'number', 'reference')",
				Group:       "metadata",
				DefaultSync: true,
			},
			{
				Name:        "sort_order",
				DisplayName: "Sort Order",
				Type:        "number",
				Required:    false,
				Description: "Display order of property",
				Group:       "display",
				DefaultSync: true,
			},
			{
				Name:        "is_filter",
				DisplayName: "Is Filter",
				Type:        "boolean",
				Required:    false,
				Description: "Whether this property can be used for filtering",
				Group:       "flags",
				DefaultSync: true,
			},
			{
				Name:        "is_modification",
				DisplayName: "Is Modification",
				Type:        "boolean",
				Required:    false,
				Description: "Whether this property represents a product modification",
				Group:       "flags",
				DefaultSync: true,
			},
		},
	}
}

// getPricesFieldSchema returns field schema for prices
func getPricesFieldSchema() SyncFieldSchema {
	return SyncFieldSchema{
		Step: SyncStepPrices,
		Fields: []FieldDefinition{
			{
				Name:        "prices",
				DisplayName: "Prices Array",
				Type:        "jsonb",
				Required:    true,
				Description: "Array of prices with currency, price type, and amount",
				Group:       "pricing",
				DefaultSync: true,
			},
			{
				Name:         "price_mdl",
				DisplayName:  "Price (MDL)",
				Type:         "number",
				Required:     false,
				Description:  "Price in Moldovan Leu (primary currency)",
				Group:        "pricing",
				DefaultSync:  true,
				Dependencies: []string{"prices"},
			},
			{
				Name:         "price_eur",
				DisplayName:  "Price (EUR)",
				Type:         "number",
				Required:     false,
				Description:  "Price in Euro",
				Group:        "pricing",
				DefaultSync:  true,
				Dependencies: []string{"prices"},
			},
			{
				Name:         "price_usd",
				DisplayName:  "Price (USD)",
				Type:         "number",
				Required:     false,
				Description:  "Price in US Dollar",
				Group:        "pricing",
				DefaultSync:  true,
				Dependencies: []string{"prices"},
			},
			{
				Name:         "price_min",
				DisplayName:  "Minimum Price",
				Type:         "number",
				Required:     false,
				Description:  "Minimum price across all variants (MDL)",
				Group:        "pricing",
				DefaultSync:  true,
				Dependencies: []string{"prices", "price_mdl"},
			},
			{
				Name:         "price_max",
				DisplayName:  "Maximum Price",
				Type:         "number",
				Required:     false,
				Description:  "Maximum price across all variants (MDL)",
				Group:        "pricing",
				DefaultSync:  true,
				Dependencies: []string{"prices", "price_mdl"},
			},
		},
	}
}

// getStockFieldSchema returns field schema for stock
func getStockFieldSchema() SyncFieldSchema {
	return SyncFieldSchema{
		Step: SyncStepStock,
		Fields: []FieldDefinition{
			{
				Name:        "stock_warehouse",
				DisplayName: "Warehouse Stock",
				Type:        "number",
				Required:    false,
				Description: "Stock quantity in warehouse",
				Group:       "stock",
				DefaultSync: true,
			},
			{
				Name:        "stock_showroom",
				DisplayName: "Showroom Stock",
				Type:        "number",
				Required:    false,
				Description: "Stock quantity in showroom",
				Group:       "stock",
				DefaultSync: true,
			},
			{
				Name:         "stock_total",
				DisplayName:  "Total Stock",
				Type:         "number",
				Required:     false,
				Description:  "Total stock quantity (warehouse + showroom)",
				Group:        "stock",
				DefaultSync:  true,
				Dependencies: []string{"stock_warehouse", "stock_showroom"},
			},
			{
				Name:        "total_stock",
				DisplayName: "Product Total Stock",
				Type:        "number",
				Required:    false,
				Description: "Total stock for product (aggregated from characteristics)",
				Group:       "stock",
				DefaultSync: true,
			},
			{
				Name:         "is_in_stock",
				DisplayName:  "In Stock",
				Type:         "boolean",
				Required:     false,
				Description:  "Whether the product has stock available",
				Group:        "status",
				DefaultSync:  true,
				Dependencies: []string{"total_stock"},
			},
		},
	}
}

// getExchangeRatesFieldSchema returns field schema for exchange rates
func getExchangeRatesFieldSchema() SyncFieldSchema {
	return SyncFieldSchema{
		Step: SyncStepExchangeRates,
		Fields: []FieldDefinition{
			{
				Name:        "currency_code",
				DisplayName: "Currency Code",
				Type:        "string",
				Required:    true,
				Description: "ISO currency code (e.g., 'EUR', 'USD', 'MDL')",
				Group:       "basic",
				DefaultSync: true,
			},
			{
				Name:        "currency_name",
				DisplayName: "Currency Name",
				Type:        "string",
				Required:    false,
				Description: "Full name of the currency",
				Group:       "basic",
				DefaultSync: true,
			},
			{
				Name:        "rate",
				DisplayName: "Exchange Rate",
				Type:        "number",
				Required:    true,
				Description: "Exchange rate relative to MDL",
				Group:       "rate",
				DefaultSync: true,
			},
		},
	}
}
