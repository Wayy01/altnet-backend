package search

import (
	"time"
)

// SearchableProduct represents a product document in Meilisearch
// Contains denormalized data for fast searching and filtering
type SearchableProduct struct {
	// Primary identifiers
	ID      string `json:"id"`
	UltraID string `json:"ultra_id,omitempty"`

	// Core product information
	Name        string `json:"name"`
	NameRU      string `json:"name_ru,omitempty"`
	NameRO      string `json:"name_ro,omitempty"`
	Description string `json:"description,omitempty"`
	DescriptionRU string `json:"description_ru,omitempty"`
	DescriptionRO string `json:"description_ro,omitempty"`
	Code        string `json:"code,omitempty"`
	Article     string `json:"article,omitempty"`
	Slug        string `json:"slug,omitempty"`

	// Brand information (denormalized)
	BrandID   string `json:"brand_id,omitempty"`
	BrandName string `json:"brand_name,omitempty"`

	// Category information (denormalized)
	CategoryID     string `json:"category_id,omitempty"`
	CategoryName   string `json:"category_name,omitempty"`
	CategoryNameRU string `json:"category_name_ru,omitempty"`
	CategoryNameRO string `json:"category_name_ro,omitempty"`

	// Media
	MainImageURL string `json:"main_image_url,omitempty"`

	// Pricing (multi-currency)
	PriceMDL float64 `json:"price_mdl"`
	PriceEUR float64 `json:"price_eur"`
	PriceUSD float64 `json:"price_usd"`

	// Stock information
	TotalStock int  `json:"total_stock"`
	IsInStock  bool `json:"is_in_stock"`
	IsActive   bool `json:"is_active"`

	// Properties (searchable arrays)
	PropertyValues []string `json:"property_values,omitempty"` // ["256GB", "Blue", "6.1 inch"]
	PropertySpecs  []string `json:"property_specs,omitempty"`  // ["Storage: 256GB", "Color: Blue"]

	// Smart ranking fields
	ProductType      string `json:"product_type"`       // "main" or "accessory"
	ProductTypeBoost int    `json:"product_type_boost"` // 100 for main, 0 for accessory
	StockBoost       int    `json:"stock_boost"`        // 100 for in-stock, 0 for out-of-stock

	// Timestamps
	CreatedAt int64 `json:"created_at"`
	UpdatedAt int64 `json:"updated_at"`
}

// SearchParams represents parameters for a search query
type SearchParams struct {
	Query       string   `json:"query"`
	BrandID     string   `json:"brand_id,omitempty"`
	CategoryID  string   `json:"category_id,omitempty"`
	InStock     *bool    `json:"in_stock,omitempty"`
	IsActive    *bool    `json:"is_active,omitempty"`
	ProductType string   `json:"product_type,omitempty"` // "main", "accessory", or empty for all
	MinPrice    *float64 `json:"min_price,omitempty"`
	MaxPrice    *float64 `json:"max_price,omitempty"`
	Sort        []string `json:"sort,omitempty"` // ["price_mdl:asc", "name:desc"]
	Limit       int      `json:"limit,omitempty"`
	Offset      int      `json:"offset,omitempty"`
}

// SearchResult represents the response from a search query
type SearchResult struct {
	Hits               []SearchableProduct `json:"hits"`
	Query              string              `json:"query"`
	ProcessingTimeMs   int64               `json:"processingTimeMs"`
	EstimatedTotalHits int64               `json:"estimatedTotalHits"`
	Limit              int64               `json:"limit"`
	Offset             int64               `json:"offset"`
}

// AutocompleteSuggestion represents a single autocomplete suggestion
type AutocompleteSuggestion struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	NameRU       string  `json:"name_ru,omitempty"`
	NameRO       string  `json:"name_ro,omitempty"`
	BrandName    string  `json:"brand_name,omitempty"`
	CategoryName string  `json:"category_name,omitempty"`
	ImageURL     string  `json:"image_url,omitempty"`
	Price        float64 `json:"price,omitempty"`
	ProductType  string  `json:"product_type,omitempty"`
	TotalStock   int     `json:"total_stock"`
}

// AutocompleteResult represents the response from an autocomplete query
type AutocompleteResult struct {
	Suggestions      []AutocompleteSuggestion `json:"suggestions"`
	Query            string                   `json:"query"`
	ProcessingTimeMs int64                    `json:"processingTimeMs"`
}

// SearchComparisonResult represents a comparison between old and new search
type SearchComparisonResult struct {
	Query     string             `json:"query"`
	OldSearch OldSearchResult    `json:"oldSearch"`
	NewSearch SearchResult       `json:"newSearch"`
}

// OldSearchResult represents results from the legacy PostgreSQL search
type OldSearchResult struct {
	Results []OldSearchHit `json:"results"`
	Count   int            `json:"count"`
	TimeMs  int64          `json:"timeMs"`
}

// OldSearchHit represents a single result from legacy search
type OldSearchHit struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	BrandName    string  `json:"brand_name,omitempty"`
	CategoryName string  `json:"category_name,omitempty"`
	ImageURL     string  `json:"image_url,omitempty"`
	Price        float64 `json:"price,omitempty"`
}

// IndexStatus represents the status of the search index
type IndexStatus struct {
	IsHealthy        bool      `json:"isHealthy"`
	DocumentCount    int64     `json:"documentCount"`
	LastIndexedAt    time.Time `json:"lastIndexedAt,omitempty"`
	IndexSize        string    `json:"indexSize,omitempty"`
	PendingUpdates   int       `json:"pendingUpdates"`
	IsIndexing       bool      `json:"isIndexing"`
}

// IndexTask represents an indexing task status
type IndexTask struct {
	TaskUID    int64     `json:"taskUid"`
	Status     string    `json:"status"` // "enqueued", "processing", "succeeded", "failed"
	Type       string    `json:"type"`   // "documentAdditionOrUpdate", "documentDeletion"
	StartedAt  time.Time `json:"startedAt,omitempty"`
	FinishedAt time.Time `json:"finishedAt,omitempty"`
	Error      string    `json:"error,omitempty"`
}
