package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// JSONB is a custom type for PostgreSQL JSONB columns
type JSONB map[string]interface{}

func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

func (j *JSONB) Scan(value interface{}) error {
	if value == nil {
		*j = make(JSONB)
		return nil
	}

	bytes, ok := value.([]byte)
	if !ok {
		return fmt.Errorf("failed to unmarshal JSONB value: %v", value)
	}

	return json.Unmarshal(bytes, j)
}

// DataSource represents a data source registry entry
type DataSource struct {
	ID            uuid.UUID  `json:"id"`
	SourceCode    string     `json:"source_code"`
	SourceName    string     `json:"source_name"`
	SourceType    string     `json:"source_type"`
	Config        JSONB      `json:"config"`
	FieldMappings JSONB      `json:"field_mappings"`
	Capabilities  JSONB      `json:"capabilities"`
	Priority      int        `json:"priority"`
	IsActive      bool       `json:"is_active"`
	IsPrimary     bool       `json:"is_primary"`
	LastSyncAt          *time.Time `json:"last_sync_at"`
	LastSyncStatus      *string    `json:"last_sync_status"`
	SyncIntervalMinutes int        `json:"sync_interval_minutes"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
	CreatedBy     string     `json:"created_by"`
}

// Brand represents a unified brand
type Brand struct {
	ID              uuid.UUID  `json:"id"`
	Name            string     `json:"name"`
	Slug            string     `json:"slug"`
	Description     *string    `json:"description"`
	LogoURL         *string    `json:"logo_url"`
	WebsiteURL      *string    `json:"website_url"`
	Country         *string    `json:"country"`
	IsVerified      bool       `json:"is_verified"`
	MasterBrandID   *uuid.UUID `json:"master_brand_id"`
	QualityScore    int        `json:"quality_score"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

// BrandSource represents brand data from a specific source
type BrandSource struct {
	ID           uuid.UUID  `json:"id"`
	BrandID      *uuid.UUID `json:"brand_id"`
	SourceID     uuid.UUID  `json:"source_id"`
	ExternalID   string     `json:"external_id"`
	SourceData   JSONB      `json:"source_data"`
	Name         string     `json:"name"`
	Code         *string    `json:"code"`
	LogoURL      *string    `json:"logo_url"`
	IsActive     bool       `json:"is_active"`
	FirstSeenAt  time.Time  `json:"first_seen_at"`
	LastSeenAt   time.Time  `json:"last_seen_at"`
	SyncVersion  int        `json:"sync_version"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

// Category represents a unified category
type Category struct {
	ID                 uuid.UUID  `json:"id"`
	ParentID           *uuid.UUID `json:"parent_id"`
	Path               *string    `json:"path"` // LTREE
	Level              int        `json:"level"`
	Name               string     `json:"name"`
	Slug               string     `json:"slug"`
	Description        *string    `json:"description"`
	ImageURL           *string    `json:"image_url"`
	Icon               *string    `json:"icon"`
	SortOrder          int        `json:"sort_order"`
	IsVisible          bool       `json:"is_visible"`
	IsFeatured         bool       `json:"is_featured"`
	IsVerified         bool       `json:"is_verified"`
	MasterCategoryID   *uuid.UUID `json:"master_category_id"`
	ProductCount       int        `json:"product_count"`
	ActiveProductCount int        `json:"active_product_count"`
	QualityScore       int        `json:"quality_score"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

// CategorySource represents category data from a specific source
type CategorySource struct {
	ID               uuid.UUID  `json:"id"`
	CategoryID       *uuid.UUID `json:"category_id"`
	SourceID         uuid.UUID  `json:"source_id"`
	ExternalID       string     `json:"external_id"`
	ParentExternalID *string    `json:"parent_external_id"`
	SourceData       JSONB      `json:"source_data"`
	Name             string     `json:"name"`
	Code             *string    `json:"code"`
	SortOrder        int        `json:"sort_order"`
	IsActive         bool       `json:"is_active"`
	ProductCount     int        `json:"product_count"`
	FirstSeenAt      time.Time  `json:"first_seen_at"`
	LastSeenAt       time.Time  `json:"last_seen_at"`
	SyncVersion      int        `json:"sync_version"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

// Product represents a unified product
type Product struct {
	ID              uuid.UUID  `json:"id"`
	Name            string     `json:"name"`
	Slug            string     `json:"slug"`
	BrandID         *uuid.UUID `json:"brand_id"`
	CategoryID      *uuid.UUID `json:"category_id"`
	Description     *string    `json:"description"`
	Code            *string    `json:"code"`
	IsVariant       bool       `json:"is_variant"`
	ParentProductID *uuid.UUID `json:"parent_product_id"`
	MainImageURL    *string    `json:"main_image_url"`
	Images          JSONB      `json:"images"`
	PriceMin        *float64   `json:"price_min"`
	PriceMax        *float64   `json:"price_max"`
	PriceCurrency   string     `json:"price_currency"`
	StockQuantity   int        `json:"stock_quantity"`
	IsInStock       bool       `json:"is_in_stock"`
	Attributes      JSONB      `json:"attributes"`
	QualityScore    int        `json:"quality_score"`
	SourceCount     int        `json:"source_count"`
	IsActive        bool       `json:"is_active"`
	IsFeatured      bool       `json:"is_featured"`
	IsVerified      bool       `json:"is_verified"`
	MetaTitle       *string    `json:"meta_title"`
	MetaDescription *string    `json:"meta_description"`
	ViewCount       int        `json:"view_count"`
	FavoriteCount   int        `json:"favorite_count"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

// ProductSource represents product data from a specific source
type ProductSource struct {
	ID                   uuid.UUID  `json:"id"`
	ProductID            *uuid.UUID `json:"product_id"`
	SourceID             uuid.UUID  `json:"source_id"`
	ExternalID           string     `json:"external_id"`
	BrandExternalID      *string    `json:"brand_external_id"`
	CategoryExternalID   *string    `json:"category_external_id"`
	ParentExternalID     *string    `json:"parent_external_id"`
	SourceData           JSONB      `json:"source_data"`
	Name                 string     `json:"name"`
	Code                 *string    `json:"code"`
	Description          *string    `json:"description"`
	IsActive             bool       `json:"is_active"`
	Prices               JSONB      `json:"prices"`
	Stock                JSONB      `json:"stock"`
	Images               JSONB      `json:"images"`
	Characteristics      JSONB      `json:"characteristics"`
	Properties           JSONB      `json:"properties"`
	Barcodes             JSONB      `json:"barcodes"`
	FirstSeenAt          time.Time  `json:"first_seen_at"`
	LastSeenAt           time.Time  `json:"last_seen_at"`
	SyncVersion          int        `json:"sync_version"`
	CreatedAt            time.Time  `json:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at"`
}

// EntityMatch represents a match between entities from different sources
type EntityMatch struct {
	ID               uuid.UUID  `json:"id"`
	EntityType       string     `json:"entity_type"` // 'brand', 'category', 'product'
	UnifiedEntityID  uuid.UUID  `json:"unified_entity_id"`
	SourceMatches    JSONB      `json:"source_matches"`
	MatchMethod      string     `json:"match_method"` // 'exact', 'fuzzy', 'ml', 'manual'
	ConfidenceScore  float64    `json:"confidence_score"`
	MatchCriteria    JSONB      `json:"match_criteria"`
	IsVerified       bool       `json:"is_verified"`
	IsRejected       bool       `json:"is_rejected"`
	MatchedAt        time.Time  `json:"matched_at"`
	VerifiedAt       *time.Time `json:"verified_at"`
	VerifiedBy       *string    `json:"verified_by"`
}

// SyncRun represents a synchronization operation
type SyncRun struct {
	ID                  uuid.UUID  `json:"id"`
	SourceID            uuid.UUID  `json:"source_id"`
	SyncType            string     `json:"sync_type"` // 'full', 'incremental', 'manual'
	StartedAt           time.Time  `json:"started_at"`
	FinishedAt          *time.Time `json:"finished_at"`
	DurationSeconds     *int       `json:"duration_seconds"`
	Status              string     `json:"status"` // 'running', 'success', 'failed', 'degraded'
	RecordsFetched      int        `json:"records_fetched"`
	RecordsCreated      int        `json:"records_created"`
	RecordsUpdated      int        `json:"records_updated"`
	RecordsFailed       int        `json:"records_failed"`
	BrandsWithData      int        `json:"brands_with_data"`
	CategoriesWithData  int        `json:"categories_with_data"`
	ProductsWithData    int        `json:"products_with_data"`
	ProductsWithPrices  int        `json:"products_with_prices"`
	ProductsWithStock   int        `json:"products_with_stock"`
	ProductsWithImages  int        `json:"products_with_images"`
	SyncDetails         JSONB      `json:"sync_details"`
	ErrorMessage        *string    `json:"error_message"`
	ErrorDetails        JSONB      `json:"error_details"`
	TriggeredBy         string     `json:"triggered_by"` // 'system', 'manual', 'webhook', 'cron'
}
