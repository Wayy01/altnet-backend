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

	var bytes []byte
	switch v := value.(type) {
	case []byte:
		bytes = v
	case string:
		bytes = []byte(v)
	default:
		return fmt.Errorf("failed to unmarshal JSONB value: unsupported type %T: %v", value, value)
	}

	return json.Unmarshal(bytes, j)
}

// JSONBArray is a custom type for PostgreSQL JSONB array columns
type JSONBArray []interface{}

func (j JSONBArray) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

func (j *JSONBArray) Scan(value interface{}) error {
	if value == nil {
		*j = make(JSONBArray, 0)
		return nil
	}

	var bytes []byte
	switch v := value.(type) {
	case []byte:
		bytes = v
	case string:
		bytes = []byte(v)
	default:
		return fmt.Errorf("failed to unmarshal JSONBArray value: unsupported type %T: %v", value, value)
	}

	return json.Unmarshal(bytes, j)
}

// ============================================================================
// BRANDS
// ============================================================================

// Brand represents a brand in the database
type Brand struct {
	ID           uuid.UUID `json:"id"`
	UltraID      string    `json:"ultra_id"`
	Code         *string   `json:"code"`
	Name         string    `json:"name"`
	Slug         string    `json:"slug"`
	LogoURL      *string   `json:"logo_url"`
	IsActive     bool      `json:"is_active"`
	ProductCount int       `json:"product_count"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// ============================================================================
// CATEGORIES
// ============================================================================

// Category represents a category in the database
type Category struct {
	ID            uuid.UUID  `json:"id"`
	UltraID       string     `json:"ultra_id"`
	Code          *string    `json:"code"`
	ParentID      *uuid.UUID `json:"parent_id"`
	ParentUltraID *string    `json:"parent_ultra_id,omitempty"`
	ParentName    string     `json:"parent_name,omitempty"`
	Name          string     `json:"name"`
	Slug          string     `json:"slug"`
	SortOrder     int        `json:"sort_order"`
	ImageURL      *string    `json:"image_url"`
	ProductCount  int        `json:"product_count"`
	IsActive      bool       `json:"is_active"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`

	// Translation fields
	NameRU *string `json:"name_ru,omitempty"`
	NameRO *string `json:"name_ro,omitempty"`
}

// ============================================================================
// PRODUCTS
// ============================================================================

// Product represents a product in the database
type Product struct {
	ID           uuid.UUID  `json:"id"`
	UltraID      string     `json:"ultra_id"`
	Code         *string    `json:"code"`
	Article      *string    `json:"article"`
	Name         string     `json:"name"`
	Slug         string     `json:"slug"`
	Description  *string    `json:"description"`
	BrandID      *uuid.UUID `json:"brand_id"`
	CategoryID   *uuid.UUID `json:"category_id"`
	ParentID     *uuid.UUID `json:"parent_id"`
	SourceID     *uuid.UUID `json:"source_id"`
	MainImageURL *string    `json:"main_image_url"`
	Images       JSONBArray `json:"images"`
	Videos       JSONBArray `json:"videos"`
	Warranty     *string    `json:"warranty"`
	Barcodes     JSONBArray `json:"barcodes"`
	PriceMin     *float64   `json:"price_min"`
	PriceMax     *float64   `json:"price_max"`
	TotalStock   int        `json:"total_stock"`
	IsInStock    bool       `json:"is_in_stock"`
	IsActive     bool       `json:"is_active"`
	IsService    bool       `json:"is_service"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`

	// Multi-currency prices
	Prices   JSONBArray `json:"prices"`
	PriceMDL *float64   `json:"price_mdl"`
	PriceEUR *float64   `json:"price_eur"`
	PriceUSD *float64   `json:"price_usd"`

	// Translation fields
	NameRU        *string `json:"name_ru,omitempty"`
	NameRO        *string `json:"name_ro,omitempty"`
	DescriptionRU *string `json:"description_ru,omitempty"`
	DescriptionRO *string `json:"description_ro,omitempty"`

	// Denormalized fields for efficient listing (populated via JOIN)
	BrandName    *string `json:"brand_name,omitempty"`
	CategoryName *string `json:"category_name,omitempty"`
	SourceName   *string `json:"source_name,omitempty"`

	// Discount fields (computed)
	ManualDiscountPercent    *float64    `json:"manual_discount_percent,omitempty"`
	EffectiveDiscountPercent *float64    `json:"effective_discount_percent,omitempty"` // Max of manual or promotion discount
	DiscountedPriceMDL       *float64    `json:"discounted_price_mdl,omitempty"`
	DiscountedPriceEUR       *float64    `json:"discounted_price_eur,omitempty"`
	DiscountedPriceUSD       *float64    `json:"discounted_price_usd,omitempty"`
	ActivePromotions         []Promotion `json:"active_promotions,omitempty"` // Active promotions for this product
}

// ============================================================================
// PROPERTIES
// ============================================================================

// Property represents a product property/specification
type Property struct {
	ID             uuid.UUID `json:"id"`
	ProductID      uuid.UUID `json:"product_id"`
	PropertyUUID   *string   `json:"property_uuid"`
	PropertyName   string    `json:"property_name"`
	PropertyCode   *string   `json:"property_code"`
	Value          *string   `json:"value"`
	ValueType      *string   `json:"value_type"`
	GroupUUID      *string   `json:"group_uuid"`
	GroupName      *string   `json:"group_name"`
	SortOrder      int       `json:"sort_order"`
	IsFilter       bool      `json:"is_filter"`
	IsModification bool      `json:"is_modification"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`

	// Translation fields (for group_name and property_name, NOT values)
	PropertyNameRU *string `json:"property_name_ru,omitempty"`
	PropertyNameRO *string `json:"property_name_ro,omitempty"`
	GroupNameRU    *string `json:"group_name_ru,omitempty"`
	GroupNameRO    *string `json:"group_name_ro,omitempty"`
}

// ============================================================================
// SYNC LOG
// ============================================================================

// SyncLog represents a sync operation record
type SyncLog struct {
	ID              uuid.UUID  `json:"id"`
	SyncType        string     `json:"sync_type"`
	StartedAt       time.Time  `json:"started_at"`
	FinishedAt      *time.Time `json:"finished_at"`
	DurationSeconds *int       `json:"duration_seconds"`
	Status          string     `json:"status"`
	BrandsSynced    int        `json:"brands_synced"`
	CategoriesSynced int       `json:"categories_synced"`
	ProductsSynced  int        `json:"products_synced"`
	PropertiesSynced int       `json:"properties_synced"`
	PricesSynced    int        `json:"prices_synced"`
	StockSynced     int        `json:"stock_synced"`
	ErrorMessage    *string    `json:"error_message"`
	Details         JSONB      `json:"details"`
	SelectedSteps   []string   `json:"selected_steps,omitempty"`

	// Change deltas
	BrandsInserted     int `json:"brands_inserted"`
	BrandsUpdated      int `json:"brands_updated"`
	CategoriesInserted int `json:"categories_inserted"`
	CategoriesUpdated  int `json:"categories_updated"`
	ProductsInserted   int `json:"products_inserted"`
	ProductsUpdated    int `json:"products_updated"`
	PropertiesInserted int `json:"properties_inserted"`
	PropertiesUpdated  int `json:"properties_updated"`
	PricesUpdated      int `json:"prices_updated"`
	StockUpdated       int `json:"stock_updated"`
}

// SyncStepDetail represents detailed progress for a single sync step
type SyncStepDetail struct {
	ID           uuid.UUID  `json:"id"`
	SyncLogID    uuid.UUID  `json:"sync_log_id"`
	StepNumber   int        `json:"step_number"`
	StepName     string     `json:"step_name"`
	Status       string     `json:"status"`
	StartedAt    *time.Time `json:"started_at"`
	CompletedAt  *time.Time `json:"completed_at"`
	Extracted    int        `json:"extracted"`
	Inserted     int        `json:"inserted"`
	Updated      int        `json:"updated"`
	Unchanged    int        `json:"unchanged"`
	Failed       int        `json:"failed"`
	ErrorMessage *string    `json:"error_message"`
	CreatedAt    time.Time  `json:"created_at"`
}

// UpsertResult tracks the result of an upsert operation
type UpsertResult struct {
	Extracted int `json:"extracted"`
	Inserted  int `json:"inserted"`
	Updated   int `json:"updated"`
	Unchanged int `json:"unchanged"`
	Failed    int `json:"failed"`
}

// ============================================================================
// EXCHANGE RATES
// ============================================================================

// ExchangeRate represents a currency exchange rate
type ExchangeRate struct {
	ID           uuid.UUID `json:"id"`
	CurrencyUUID string    `json:"currency_uuid"`
	CurrencyCode string    `json:"currency_code"`
	CurrencyName string    `json:"currency_name"`
	Rate         float64   `json:"rate"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

// ProductWithDetails includes related brand and category info
type ProductWithDetails struct {
	*Product
	Brand             *Brand                 `json:"brand,omitempty"`
	Category          *Category              `json:"category,omitempty"`
	Properties        []*Property            `json:"properties,omitempty"`
	VariantProperties *VariantPropertiesInfo `json:"variant_properties,omitempty"`
	VariantCount      int                    `json:"variant_count"`
	PropertyCount     int                    `json:"property_count"`
}

// CategoryWithChildren includes child categories
type CategoryWithChildren struct {
	*Category
	Children []*Category `json:"children,omitempty"`
	Level    int         `json:"level"`
}

// ============================================================================
// INPUT TYPES (for sync operations)
// ============================================================================

// BrandInput is used when inserting/updating brands from Ultra API
type BrandInput struct {
	UltraID  string
	Code     *string
	Name     string
	LogoURL  *string
	IsActive bool
}

// CategoryInput is used when inserting/updating categories from Ultra API
type CategoryInput struct {
	UltraID       string
	Code          *string
	ParentUltraID *string
	Name          string
	SortOrder     int
	ImageURL      *string
	ProductCount  int
	IsActive      bool
}

// ProductInput is used when inserting/updating products from Ultra API
type ProductInput struct {
	UltraID      string
	Code         *string
	Article      *string
	Name         string
	Description  *string
	BrandID      *uuid.UUID // Resolved from Ultra API brand_ultra_id
	CategoryID   *uuid.UUID // Resolved from Ultra API category_ultra_id
	ParentID     *uuid.UUID // Resolved from Ultra API parent_ultra_id
	SourceID     *uuid.UUID // Product source (Ultra, Manual, etc.)
	MainImageURL *string
	Images       []map[string]string
	Warranty     *string
	Barcodes     []map[string]string
	IsActive     bool
	IsService    bool

	// Temporary fields used during sync (Ultra API returns string UUIDs)
	// These are resolved to brand_id/category_id/parent_id by ResolveProductReferences()
	BrandUltraID    *string
	CategoryUltraID *string
	ParentUltraID   *string
}

// PropertyInput is used when inserting/updating properties
type PropertyInput struct {
	ProductUltraID string
	PropertyUUID   *string
	PropertyName   string
	PropertyCode   *string
	Value          *string
	ValueType      *string
	GroupUUID      *string
	GroupName      *string
	SortOrder      int
	IsFilter       bool
	IsModification bool
}

// PriceInput is used when updating prices for products
type PriceInput struct {
	ProductUltraID string
	Price          float64
	Currency       string
	PriceType      string
	PriceTypeUUID  string
}

// StockInput is used when updating stock for products
type StockInput struct {
	ProductUltraID string
	Warehouse      int
	Showroom       int
}

// ============================================================================
// PRODUCT SOURCES
// ============================================================================

// ProductSource represents a source where products can originate from
type ProductSource struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	Description *string   `json:"description"`
	IsDefault   bool      `json:"is_default"`
	IsDeletable bool      `json:"is_deletable"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// ============================================================================
// TRANSLATION SYSTEM
// ============================================================================

// TranslationJob represents a translation job for tracking progress
type TranslationJob struct {
	ID              uuid.UUID  `json:"id"`
	EntityType      string     `json:"entity_type"`     // 'products', 'categories', 'properties'
	TargetLanguage  string     `json:"target_language"` // 'ru', 'ro'
	Status          string     `json:"status"`          // 'pending', 'running', 'completed', 'failed', 'cancelled'
	TotalItems      int        `json:"total_items"`
	TranslatedItems int        `json:"translated_items"`
	FailedItems     int        `json:"failed_items"`
	SkippedItems    int        `json:"skipped_items"`
	ErrorMessage    *string    `json:"error_message,omitempty"`
	StartedAt       *time.Time `json:"started_at,omitempty"`
	CompletedAt     *time.Time `json:"completed_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

// TranslationLog represents a detailed log entry for a translation operation
type TranslationLog struct {
	ID             uuid.UUID  `json:"id"`
	JobID          uuid.UUID  `json:"job_id"`
	EntityType     string     `json:"entity_type"`
	EntityID       *uuid.UUID `json:"entity_id,omitempty"` // Can be NULL for property group/name translations
	FieldName      string     `json:"field_name"`
	OriginalValue  string     `json:"original_value"`
	SourceText     string     `json:"source_text"`
	TranslatedText *string    `json:"translated_text,omitempty"`
	TargetLanguage string     `json:"target_language"`
	Status         string     `json:"status"` // 'success', 'failed', 'skipped'
	ErrorMessage   *string    `json:"error_message,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
}

// TranslationStats represents translation statistics for the dashboard
type TranslationStats struct {
	Products   TranslationEntityStats   `json:"products"`
	Categories TranslationEntityStats   `json:"categories"`
	Properties TranslationPropertyStats `json:"properties"`
}

// TranslationEntityStats represents translation stats for a single entity type
type TranslationEntityStats struct {
	Total        int `json:"total"`
	TranslatedRU int `json:"translated_ru"`
	TranslatedRO int `json:"translated_ro"`
	PendingRU    int `json:"pending_ru"`
	PendingRO    int `json:"pending_ro"`
}

// TranslationPropertyStats represents translation stats for properties
type TranslationPropertyStats struct {
	TotalGroups        int `json:"total_groups"`
	TotalNames         int `json:"total_names"`
	GroupsTranslatedRU int `json:"groups_translated_ru"`
	GroupsTranslatedRO int `json:"groups_translated_ro"`
	NamesTranslatedRU  int `json:"names_translated_ru"`
	NamesTranslatedRO  int `json:"names_translated_ro"`
	GroupsPendingRU    int `json:"groups_pending_ru"`
	GroupsPendingRO    int `json:"groups_pending_ro"`
	NamesPendingRU     int `json:"names_pending_ru"`
	NamesPendingRO     int `json:"names_pending_ro"`
}

// TranslationJobStatus constants
const (
	TranslationStatusPending   = "pending"
	TranslationStatusRunning   = "running"
	TranslationStatusCompleted = "completed"
	TranslationStatusFailed    = "failed"
	TranslationStatusCancelled = "cancelled"
)

// TranslationLogStatus constants
const (
	TranslationLogSuccess = "success"
	TranslationLogFailed  = "failed"
	TranslationLogSkipped = "skipped"
)

// Target language constants
const (
	LangRussian  = "ru"
	LangRomanian = "ro"
)
