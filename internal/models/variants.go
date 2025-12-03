package models

import (
	"time"

	"github.com/google/uuid"
)

// ============================================================================
// VARIANT GENERATION JOB
// ============================================================================

// VariantGenerationJob represents a job for AI-powered variant grouping
type VariantGenerationJob struct {
	ID                uuid.UUID  `json:"id"`
	Status            string     `json:"status"`
	TotalProducts     int        `json:"total_products"`
	ProcessedProducts int        `json:"processed_products"`
	GroupsCreated     int        `json:"groups_created"`
	StartedAt         *time.Time `json:"started_at,omitempty"`
	CompletedAt       *time.Time `json:"completed_at,omitempty"`
	Error             *string    `json:"error,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

// Job status constants
const (
	VariantJobStatusPending   = "pending"
	VariantJobStatusRunning   = "running"
	VariantJobStatusCompleted = "completed"
	VariantJobStatusFailed    = "failed"
	VariantJobStatusCancelled = "cancelled"
)

// ============================================================================
// PRODUCT VARIANT GROUP
// ============================================================================

// ProductVariantGroup represents a group of products with the same base name
type ProductVariantGroup struct {
	ID                 uuid.UUID `json:"id"`
	BaseName           string    `json:"base_name"`
	BaseNameNormalized string    `json:"base_name_normalized"`
	MemberCount        int       `json:"member_count"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

// ProductVariantGroupMember represents a product that belongs to a variant group
type ProductVariantGroupMember struct {
	ID        uuid.UUID `json:"id"`
	GroupID   uuid.UUID `json:"group_id"`
	ProductID uuid.UUID `json:"product_id"`
	CreatedAt time.Time `json:"created_at"`
}

// ============================================================================
// VARIANT PROPERTY
// ============================================================================

// VariantProperty represents a property that varies within a product group
type VariantProperty struct {
	ID             uuid.UUID `json:"id"`
	GroupID        uuid.UUID `json:"group_id"`
	PropertyName   string    `json:"property_name"`
	PropertyValues []string  `json:"property_values"`           // Distinct values
	ParentProperty *string   `json:"parent_property,omitempty"` // NULL = global variant
	ParentValue    *string   `json:"parent_value,omitempty"`
	ProductCount   int       `json:"product_count"`
	CreatedAt      time.Time `json:"created_at"`
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

// ProductMemberInfo contains product info for group member display
type ProductMemberInfo struct {
	ID           uuid.UUID `json:"id"`
	Name         string    `json:"name"`
	Article      *string   `json:"article,omitempty"`
	MainImageURL *string   `json:"main_image_url,omitempty"`
	PriceMin     *float64  `json:"price_min,omitempty"`
	IsInStock    bool      `json:"is_in_stock"`
	BrandName    *string   `json:"brand_name,omitempty"`
	CategoryName *string   `json:"category_name,omitempty"`
}

// VariantGroupWithDetails contains full group info with members and properties
type VariantGroupWithDetails struct {
	*ProductVariantGroup
	Members    []*ProductMemberInfo `json:"members"`
	Properties []*VariantProperty   `json:"properties"`
	Matrix     *VariantMatrix       `json:"matrix,omitempty"`
}

// VariantMatrix represents the variant matrix for UI display
type VariantMatrix struct {
	// Columns are the variant property names that vary globally
	Columns []VariantMatrixColumn `json:"columns"`
	// Rows are products with their property values
	Rows []VariantMatrixRow `json:"rows"`
}

// VariantMatrixColumn represents a column header in the variant matrix
type VariantMatrixColumn struct {
	PropertyName  string   `json:"property_name"`
	DistinctCount int      `json:"distinct_count"`
	Values        []string `json:"values"`
	IsVariant     bool     `json:"is_variant"` // Has multiple values across products
}

// VariantMatrixRow represents a product row in the variant matrix
type VariantMatrixRow struct {
	ProductID    uuid.UUID         `json:"product_id"`
	ProductName  string            `json:"product_name"`
	MainImageURL *string           `json:"main_image_url,omitempty"`
	PriceMin     *float64          `json:"price_min,omitempty"`
	IsInStock    bool              `json:"is_in_stock"`
	Values       map[string]string `json:"values"` // PropertyName -> Value
}

// ============================================================================
// PROGRESS UPDATE FOR SSE STREAMING
// ============================================================================

// VariantProgressUpdate represents a progress update for SSE streaming
type VariantProgressUpdate struct {
	JobID         uuid.UUID `json:"job_id"`
	Status        string    `json:"status"`
	Processed     int       `json:"processed"`      // Number of products processed
	Total         int       `json:"total"`          // Total number of products
	GroupsCreated int       `json:"groups_created"` // Number of variant groups created
	Percent       float64   `json:"percent"`        // Percentage complete (0-100)
	Message       string    `json:"message,omitempty"`
	Error         *string   `json:"error,omitempty"`
	Timestamp     time.Time `json:"timestamp"`
}

// ============================================================================
// VARIANT PROPERTY ANALYSIS RESULT
// ============================================================================

// VariantPropertyResult represents the analysis result for a property
type VariantPropertyResult struct {
	PropertyName   string   `json:"property_name"`
	ParentProperty *string  `json:"parent_property,omitempty"`
	ParentValue    *string  `json:"parent_value,omitempty"`
	Values         []string `json:"values"`
	ProductCount   int      `json:"product_count"`
}

// ============================================================================
// REQUEST TYPES
// ============================================================================

// TriggerGenerationRequest represents the request to start variant generation
type TriggerGenerationRequest struct {
	ClearExisting bool `json:"clear_existing"` // If true, clears all existing groups first
}

// ListVariantGroupsRequest represents query parameters for listing groups
type ListVariantGroupsRequest struct {
	Search string `json:"search"`
	Limit  int    `json:"limit"`
	Offset int    `json:"offset"`
}

// ============================================================================
// PRODUCT VARIANT RESPONSE TYPES
// ============================================================================

// VariantPropertiesInfo represents the variant property values for a product
// Contains the 3 key variant properties: Color, Storage, and RAM
type VariantPropertiesInfo struct {
	Color   *string `json:"color,omitempty"`
	Storage *string `json:"storage,omitempty"`
	RAM     *string `json:"ram,omitempty"`
}

// ProductWithVariantProperties extends Product with variant property info
// Used in the GET /api/v1/products/{id}/variants response
type ProductWithVariantProperties struct {
	*Product
	VariantProperties *VariantPropertiesInfo `json:"variant_properties,omitempty"`
}
