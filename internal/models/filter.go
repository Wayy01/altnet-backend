package models

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

// ============================================================================
// FILTER OPERATORS
// ============================================================================

// FilterOperator represents supported filter operators
type FilterOperator string

const (
	OpEquals      FilterOperator = "equals"
	OpNotEquals   FilterOperator = "not_equals"
	OpContains    FilterOperator = "contains"
	OpNotContains FilterOperator = "not_contains"
	OpGreaterThan FilterOperator = "greater_than"
	OpLessThan    FilterOperator = "less_than"
	OpIn          FilterOperator = "in"
	OpNotIn       FilterOperator = "not_in"
	OpIsNull      FilterOperator = "is_null"
	OpIsNotNull   FilterOperator = "is_not_null"
)

// ValidFilterOperators contains all valid filter operators
var ValidFilterOperators = map[FilterOperator]bool{
	OpEquals:      true,
	OpNotEquals:   true,
	OpContains:    true,
	OpNotContains: true,
	OpGreaterThan: true,
	OpLessThan:    true,
	OpIn:          true,
	OpNotIn:       true,
	OpIsNull:      true,
	OpIsNotNull:   true,
}

// IsValid checks if the operator is valid
func (o FilterOperator) IsValid() bool {
	return ValidFilterOperators[o]
}

// ============================================================================
// FILTER LOGIC
// ============================================================================

// FilterLogic represents how conditions are combined
type FilterLogic string

const (
	LogicAND FilterLogic = "AND"
	LogicOR  FilterLogic = "OR"
)

// IsValid checks if the logic operator is valid
func (l FilterLogic) IsValid() bool {
	return l == LogicAND || l == LogicOR
}

// ============================================================================
// ENTITY TYPES FOR FILTERING
// ============================================================================

// FilterEntityType represents entity types that can be filtered
type FilterEntityType string

const (
	FilterEntityProducts   FilterEntityType = "products"
	FilterEntityBrands     FilterEntityType = "brands"
	FilterEntityCategories FilterEntityType = "categories"
)

// ValidFilterEntityTypes contains all valid filter entity types
var ValidFilterEntityTypes = map[FilterEntityType]bool{
	FilterEntityProducts:   true,
	FilterEntityBrands:     true,
	FilterEntityCategories: true,
}

// IsValid checks if the entity type is valid
func (e FilterEntityType) IsValid() bool {
	return ValidFilterEntityTypes[e]
}

// ============================================================================
// FILTER TYPE (INCLUDE/EXCLUDE)
// ============================================================================

// FilterType represents whether filter includes or excludes entities
type FilterType string

const (
	FilterTypeInclude FilterType = "include"
	FilterTypeExclude FilterType = "exclude"
)

// IsValid checks if the filter type is valid
func (t FilterType) IsValid() bool {
	return t == FilterTypeInclude || t == FilterTypeExclude
}

// ============================================================================
// FILTER CONDITION
// ============================================================================

// FilterCondition represents a single filter condition
type FilterCondition struct {
	Field    string         `json:"field"`
	Operator FilterOperator `json:"operator"`
	Value    interface{}    `json:"value,omitempty"`
}

// Validate validates the filter condition
func (c *FilterCondition) Validate() error {
	if c.Field == "" {
		return fmt.Errorf("field is required")
	}

	if !c.Operator.IsValid() {
		return fmt.Errorf("invalid operator: %s", c.Operator)
	}

	// Value is not required for is_null and is_not_null operators
	if c.Operator != OpIsNull && c.Operator != OpIsNotNull && c.Value == nil {
		return fmt.Errorf("value is required for operator: %s", c.Operator)
	}

	return nil
}

// ============================================================================
// SYNC ENTITY FILTER (ENHANCED)
// ============================================================================

// SyncEntityFilterEnhanced represents an enhanced sync entity filter with conditions
type SyncEntityFilterEnhanced struct {
	ID              uuid.UUID          `json:"id"`
	Name            string             `json:"name"`
	Description     string             `json:"description,omitempty"`
	ConfigurationID *uuid.UUID         `json:"configuration_id,omitempty"`
	EntityType      FilterEntityType   `json:"entity_type"`
	FilterType      FilterType         `json:"filter_type"`
	Conditions      []FilterCondition  `json:"conditions"`
	Logic           FilterLogic        `json:"logic"`
	IsActive        bool               `json:"is_active"`
	Priority        int                `json:"priority"`
	CreatedAt       time.Time          `json:"created_at"`
	UpdatedAt       time.Time          `json:"updated_at"`
}

// ============================================================================
// REQUEST TYPES
// ============================================================================

// FilterCreateRequest represents a request to create a filter
type FilterCreateRequest struct {
	Name            string            `json:"name"`
	Description     string            `json:"description,omitempty"`
	ConfigurationID *uuid.UUID        `json:"configuration_id,omitempty"`
	EntityType      FilterEntityType  `json:"entity_type"`
	FilterType      FilterType        `json:"filter_type"`
	Conditions      []FilterCondition `json:"conditions"`
	Logic           FilterLogic       `json:"logic"`
	Priority        int               `json:"priority"`
}

// Validate validates the filter create request
func (r *FilterCreateRequest) Validate() error {
	if r.Name == "" {
		return fmt.Errorf("name is required")
	}

	if !r.EntityType.IsValid() {
		return fmt.Errorf("invalid entity_type: %s", r.EntityType)
	}

	// Default filter_type to "include" if not specified
	if r.FilterType == "" {
		r.FilterType = FilterTypeInclude
	}

	if !r.FilterType.IsValid() {
		return fmt.Errorf("invalid filter_type: %s", r.FilterType)
	}

	if len(r.Conditions) == 0 {
		return fmt.Errorf("at least one condition is required")
	}

	// Default logic to AND if not specified
	if r.Logic == "" {
		r.Logic = LogicAND
	}

	if !r.Logic.IsValid() {
		return fmt.Errorf("invalid logic: %s", r.Logic)
	}

	// Validate each condition
	for i, cond := range r.Conditions {
		if err := cond.Validate(); err != nil {
			return fmt.Errorf("condition %d: %w", i, err)
		}
	}

	return nil
}

// FilterUpdateRequest represents a request to update a filter
type FilterUpdateRequest struct {
	Name            *string           `json:"name,omitempty"`
	Description     *string           `json:"description,omitempty"`
	ConfigurationID *uuid.UUID        `json:"configuration_id,omitempty"`
	EntityType      *FilterEntityType `json:"entity_type,omitempty"`
	FilterType      *FilterType       `json:"filter_type,omitempty"`
	Conditions      []FilterCondition `json:"conditions,omitempty"`
	Logic           *FilterLogic      `json:"logic,omitempty"`
	IsActive        *bool             `json:"is_active,omitempty"`
	Priority        *int              `json:"priority,omitempty"`
}

// Validate validates the filter update request
func (r *FilterUpdateRequest) Validate() error {
	if r.Name != nil && *r.Name == "" {
		return fmt.Errorf("name cannot be empty")
	}

	if r.EntityType != nil && !r.EntityType.IsValid() {
		return fmt.Errorf("invalid entity_type: %s", *r.EntityType)
	}

	if r.FilterType != nil && !r.FilterType.IsValid() {
		return fmt.Errorf("invalid filter_type: %s", *r.FilterType)
	}

	if r.Logic != nil && !r.Logic.IsValid() {
		return fmt.Errorf("invalid logic: %s", *r.Logic)
	}

	// Validate conditions if provided
	if r.Conditions != nil {
		if len(r.Conditions) == 0 {
			return fmt.Errorf("at least one condition is required")
		}
		for i, cond := range r.Conditions {
			if err := cond.Validate(); err != nil {
				return fmt.Errorf("condition %d: %w", i, err)
			}
		}
	}

	return nil
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

// FilterTestResult represents the result of testing a filter
type FilterTestResult struct {
	FilterID         uuid.UUID `json:"filter_id"`
	EntityType       string    `json:"entity_type"`
	FilterType       string    `json:"filter_type"`
	MatchingCount    int       `json:"matching_count"`
	TotalCount       int       `json:"total_count"`
	MatchPercentage  float64   `json:"match_percentage"`
	SampleEntityIDs  []string  `json:"sample_entity_ids,omitempty"`
	ExecutionTimeMs  int64     `json:"execution_time_ms"`
	QueryGenerated   string    `json:"query_generated,omitempty"`
}

// EntityTypeInfo provides information about available entity types
type EntityTypeInfo struct {
	Type            string   `json:"type"`
	DisplayName     string   `json:"display_name"`
	AvailableFields []string `json:"available_fields"`
}

// GetEntityTypeInfos returns information about all available entity types for filtering
func GetEntityTypeInfos() []EntityTypeInfo {
	return []EntityTypeInfo{
		{
			Type:        string(FilterEntityProducts),
			DisplayName: "Products",
			AvailableFields: []string{
				"id", "ultra_id", "code", "article", "name", "slug",
				"brand_id", "category_id", "parent_id", "source_id",
				"price_min", "price_max", "price_mdl", "price_eur", "price_usd",
				"total_stock", "is_in_stock", "is_active", "is_service",
				"created_at", "updated_at",
			},
		},
		{
			Type:        string(FilterEntityBrands),
			DisplayName: "Brands",
			AvailableFields: []string{
				"id", "ultra_id", "code", "name", "slug",
				"is_active", "product_count",
				"created_at", "updated_at",
			},
		},
		{
			Type:        string(FilterEntityCategories),
			DisplayName: "Categories",
			AvailableFields: []string{
				"id", "ultra_id", "code", "name", "slug",
				"parent_id", "sort_order", "is_active", "product_count",
				"created_at", "updated_at",
			},
		},
	}
}
