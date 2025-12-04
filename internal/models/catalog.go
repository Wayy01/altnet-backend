package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// ============================================================================
// CATALOG BUILDER - JSONB TYPES
// ============================================================================

// CatalogFilterConfig represents JSONB filter configuration for groups and items
type CatalogFilterConfig struct {
	CategoryIDs []uuid.UUID `json:"category_ids,omitempty"`
	BrandIDs    []uuid.UUID `json:"brand_ids,omitempty"`
	PriceMin    *float64    `json:"price_min,omitempty"`
	PriceMax    *float64    `json:"price_max,omitempty"`
	InStockOnly bool        `json:"in_stock_only,omitempty"`
}

// Value implements the driver.Valuer interface for database storage
func (c CatalogFilterConfig) Value() (driver.Value, error) {
	return json.Marshal(c)
}

// Scan implements the sql.Scanner interface for database retrieval
func (c *CatalogFilterConfig) Scan(value interface{}) error {
	if value == nil {
		return nil
	}

	var bytes []byte
	switch v := value.(type) {
	case []byte:
		bytes = v
	case string:
		bytes = []byte(v)
	default:
		return fmt.Errorf("failed to unmarshal CatalogFilterConfig value: unsupported type %T: %v", value, value)
	}

	return json.Unmarshal(bytes, c)
}

// ============================================================================
// CATALOG SECTION (Level 1)
// ============================================================================

// CatalogSection represents the top-level navigation sections in the catalog
type CatalogSection struct {
	ID        uuid.UUID `json:"id"`
	NameRo    string    `json:"name_ro"`
	NameRu    *string   `json:"name_ru,omitempty"`
	NameEn    *string   `json:"name_en,omitempty"`
	Icon      *string   `json:"icon,omitempty"`
	Slug      string    `json:"slug"`
	SortOrder int       `json:"sort_order"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// CatalogSectionInput represents input for creating/updating catalog sections
type CatalogSectionInput struct {
	NameRo    string  `json:"name_ro" validate:"required"`
	NameRu    *string `json:"name_ru"`
	NameEn    *string `json:"name_en"`
	Icon      *string `json:"icon"`
	Slug      *string `json:"slug"` // Auto-generated from name_ro if not provided
	SortOrder *int    `json:"sort_order"`
	IsActive  *bool   `json:"is_active"`
}

// ============================================================================
// CATALOG GROUP (Level 2)
// ============================================================================

// CatalogGroup represents column groups within catalog sections
type CatalogGroup struct {
	ID             uuid.UUID            `json:"id"`
	SectionID      uuid.UUID            `json:"section_id"`
	NameRo         string               `json:"name_ro"`
	NameRu         *string              `json:"name_ru,omitempty"`
	NameEn         *string              `json:"name_en,omitempty"`
	ColumnPosition int                  `json:"column_position"`
	SortOrder      int                  `json:"sort_order"`
	FilterConfig   *CatalogFilterConfig `json:"filter_config,omitempty"`
	IsActive       bool                 `json:"is_active"`
	CreatedAt      time.Time            `json:"created_at"`
	UpdatedAt      time.Time            `json:"updated_at"`
}

// CatalogGroupInput represents input for creating/updating catalog groups
type CatalogGroupInput struct {
	SectionID      uuid.UUID            `json:"section_id" validate:"required"`
	NameRo         string               `json:"name_ro" validate:"required"`
	NameRu         *string              `json:"name_ru"`
	NameEn         *string              `json:"name_en"`
	ColumnPosition *int                 `json:"column_position"`
	SortOrder      *int                 `json:"sort_order"`
	FilterConfig   *CatalogFilterConfig `json:"filter_config"`
	IsActive       *bool                `json:"is_active"`
}

// ============================================================================
// CATALOG ITEM (Level 3)
// ============================================================================

// CatalogItem represents clickable menu items within catalog groups
type CatalogItem struct {
	ID           uuid.UUID            `json:"id"`
	GroupID      uuid.UUID            `json:"group_id"`
	NameRo       string               `json:"name_ro"`
	NameRu       *string              `json:"name_ru,omitempty"`
	NameEn       *string              `json:"name_en,omitempty"`
	SortOrder    int                  `json:"sort_order"`
	ItemType     string               `json:"item_type"` // "category_link" or "custom_filter"
	CategoryID   *uuid.UUID           `json:"category_id,omitempty"`
	FilterConfig *CatalogFilterConfig `json:"filter_config,omitempty"`
	IsActive     bool                 `json:"is_active"`
	CreatedAt    time.Time            `json:"created_at"`
	UpdatedAt    time.Time            `json:"updated_at"`
}

// CatalogItemInput represents input for creating/updating catalog items
type CatalogItemInput struct {
	GroupID      uuid.UUID            `json:"group_id" validate:"required"`
	NameRo       string               `json:"name_ro" validate:"required"`
	NameRu       *string              `json:"name_ru"`
	NameEn       *string              `json:"name_en"`
	SortOrder    *int                 `json:"sort_order"`
	ItemType     string               `json:"item_type" validate:"required,oneof=category_link custom_filter"`
	CategoryID   *uuid.UUID           `json:"category_id"`
	FilterConfig *CatalogFilterConfig `json:"filter_config"`
	IsActive     *bool                `json:"is_active"`
}

// ItemType constants
const (
	ItemTypeCategoryLink = "category_link"
	ItemTypeCustomFilter = "custom_filter"
)

// ============================================================================
// NESTED RESPONSE TYPES
// ============================================================================

// CatalogItemWithCategory includes category details when item_type is category_link
type CatalogItemWithCategory struct {
	CatalogItem
	Category *Category `json:"category,omitempty"`
}

// CatalogGroupWithItems includes all items within the group
type CatalogGroupWithItems struct {
	CatalogGroup
	Items []CatalogItemWithCategory `json:"items"`
}

// CatalogSectionWithGroups includes all groups and their items
type CatalogSectionWithGroups struct {
	CatalogSection
	Groups []CatalogGroupWithItems `json:"groups"`
}

// ============================================================================
// BULK OPERATIONS
// ============================================================================

// CatalogReorderRequest represents a request to reorder catalog entities
type CatalogReorderRequest struct {
	ID        uuid.UUID `json:"id" validate:"required"`
	SortOrder int       `json:"sort_order" validate:"required,min=0"`
}

// CatalogBulkReorderRequest represents a batch reorder request
type CatalogBulkReorderRequest struct {
	Items []CatalogReorderRequest `json:"items" validate:"required,min=1,dive"`
}
