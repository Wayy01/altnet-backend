package search

import (
	"context"
	"fmt"
	"log"

	"github.com/meilisearch/meilisearch-go"
)

// Service provides high-level search operations
type Service struct {
	client *Client
}

// NewService creates a new search service
func NewService(client *Client) *Service {
	return &Service{
		client: client,
	}
}

// Search performs a full-featured search with filters and returns results
func (svc *Service) Search(ctx context.Context, params SearchParams) (*SearchResult, error) {
	// Set defaults
	if params.Limit <= 0 {
		params.Limit = 20
	}
	if params.Limit > 100 {
		params.Limit = 100
	}
	if params.Offset < 0 {
		params.Offset = 0
	}

	// Build Meilisearch request
	searchReq := &meilisearch.SearchRequest{
		Limit:  int64(params.Limit),
		Offset: int64(params.Offset),
	}

	// Build filter string from parameters
	filterStr, err := svc.buildFilterString(params)
	if err != nil {
		return nil, fmt.Errorf("failed to build filter: %w", err)
	}
	if filterStr != "" {
		searchReq.Filter = filterStr
	}

	// Add sort parameters
	if len(params.Sort) > 0 {
		searchReq.Sort = params.Sort
	}

	// Execute search
	searchResp, err := svc.client.GetIndex().Search(params.Query, searchReq)
	if err != nil {
		return nil, fmt.Errorf("search failed: %w", err)
	}

	// Parse results
	var hits []SearchableProduct
	for _, hit := range searchResp.Hits {
		// Meilisearch returns hits as map[string]interface{}
		// We need to marshal and unmarshal to convert to our struct
		product, err := svc.convertHit(hit)
		if err != nil {
			log.Printf("Warning: failed to convert search hit: %v", err)
			continue
		}
		hits = append(hits, product)
	}

	result := &SearchResult{
		Hits:               hits,
		Query:              params.Query,
		ProcessingTimeMs:   searchResp.ProcessingTimeMs,
		EstimatedTotalHits: searchResp.EstimatedTotalHits,
		Limit:              searchResp.Limit,
		Offset:             searchResp.Offset,
	}

	return result, nil
}

// Autocomplete performs a fast autocomplete search with minimal results
// Optimized for <50ms response time with limited fields
func (svc *Service) Autocomplete(ctx context.Context, query string, limit int) (*AutocompleteResult, error) {
	if limit <= 0 {
		limit = 5
	}
	if limit > 20 {
		limit = 20 // Cap autocomplete results
	}

	// Autocomplete request with minimal attributes (including localized names)
	searchReq := &meilisearch.SearchRequest{
		Limit:              int64(limit),
		AttributesToRetrieve: []string{
			"id", "name", "name_ru", "name_ro", "brand_name", "category_name",
			"main_image_url", "price_mdl", "product_type", "total_stock",
		},
	}

	// Execute search
	searchResp, err := svc.client.GetIndex().Search(query, searchReq)
	if err != nil {
		return nil, fmt.Errorf("autocomplete search failed: %w", err)
	}

	// Convert hits to autocomplete suggestions
	var suggestions []AutocompleteSuggestion
	for _, hit := range searchResp.Hits {
		suggestion := svc.convertHitToSuggestion(hit)
		suggestions = append(suggestions, suggestion)
	}

	result := &AutocompleteResult{
		Suggestions:      suggestions,
		Query:            query,
		ProcessingTimeMs: searchResp.ProcessingTimeMs,
	}

	return result, nil
}

// buildFilterString builds a Meilisearch filter string from SearchParams
// Meilisearch filter syntax: https://docs.meilisearch.com/reference/api/search.html#filter
func (svc *Service) buildFilterString(params SearchParams) (string, error) {
	var filters []string

	// Brand filter
	if params.BrandID != "" {
		filters = append(filters, fmt.Sprintf("brand_id = '%s'", params.BrandID))
	}

	// Category filter
	if params.CategoryID != "" {
		filters = append(filters, fmt.Sprintf("category_id = '%s'", params.CategoryID))
	}

	// In stock filter
	if params.InStock != nil {
		if *params.InStock {
			filters = append(filters, "is_in_stock = true")
		} else {
			filters = append(filters, "is_in_stock = false")
		}
	}

	// Active filter
	if params.IsActive != nil {
		if *params.IsActive {
			filters = append(filters, "is_active = true")
		} else {
			filters = append(filters, "is_active = false")
		}
	}

	// Product type filter (main, accessory)
	if params.ProductType != "" {
		filters = append(filters, fmt.Sprintf("product_type = '%s'", params.ProductType))
	}

	// Price range filters (using MDL as default currency)
	if params.MinPrice != nil {
		filters = append(filters, fmt.Sprintf("price_mdl >= %f", *params.MinPrice))
	}
	if params.MaxPrice != nil {
		filters = append(filters, fmt.Sprintf("price_mdl <= %f", *params.MaxPrice))
	}

	// Combine filters with AND
	if len(filters) == 0 {
		return "", nil
	}

	// Join all filters with " AND "
	filterStr := ""
	for i, filter := range filters {
		if i > 0 {
			filterStr += " AND "
		}
		filterStr += filter
	}

	return filterStr, nil
}

// convertHit converts a Meilisearch hit (map[string]interface{}) to SearchableProduct
func (svc *Service) convertHit(hit interface{}) (SearchableProduct, error) {
	hitMap, ok := hit.(map[string]interface{})
	if !ok {
		return SearchableProduct{}, fmt.Errorf("invalid hit format")
	}

	product := SearchableProduct{}

	// Helper function to safely extract string
	getString := func(key string) string {
		if val, ok := hitMap[key]; ok && val != nil {
			if str, ok := val.(string); ok {
				return str
			}
		}
		return ""
	}

	// Helper function to safely extract float64
	getFloat := func(key string) float64 {
		if val, ok := hitMap[key]; ok && val != nil {
			if f, ok := val.(float64); ok {
				return f
			}
		}
		return 0
	}

	// Helper function to safely extract int
	getInt := func(key string) int {
		if val, ok := hitMap[key]; ok && val != nil {
			if f, ok := val.(float64); ok {
				return int(f)
			}
			if i, ok := val.(int); ok {
				return i
			}
		}
		return 0
	}

	// Helper function to safely extract int64
	getInt64 := func(key string) int64 {
		if val, ok := hitMap[key]; ok && val != nil {
			if f, ok := val.(float64); ok {
				return int64(f)
			}
			if i, ok := val.(int64); ok {
				return i
			}
		}
		return 0
	}

	// Helper function to safely extract bool
	getBool := func(key string) bool {
		if val, ok := hitMap[key]; ok && val != nil {
			if b, ok := val.(bool); ok {
				return b
			}
		}
		return false
	}

	// Helper function to safely extract string array
	getStringArray := func(key string) []string {
		if val, ok := hitMap[key]; ok && val != nil {
			if arr, ok := val.([]interface{}); ok {
				var result []string
				for _, item := range arr {
					if str, ok := item.(string); ok {
						result = append(result, str)
					}
				}
				return result
			}
		}
		return nil
	}

	// Extract fields
	product.ID = getString("id")
	product.UltraID = getString("ultra_id")
	product.Name = getString("name")
	product.NameRU = getString("name_ru")
	product.NameRO = getString("name_ro")
	product.Description = getString("description")
	product.DescriptionRU = getString("description_ru")
	product.DescriptionRO = getString("description_ro")
	product.Code = getString("code")
	product.Article = getString("article")
	product.Slug = getString("slug")
	product.BrandID = getString("brand_id")
	product.BrandName = getString("brand_name")
	product.CategoryID = getString("category_id")
	product.CategoryName = getString("category_name")
	product.CategoryNameRU = getString("category_name_ru")
	product.CategoryNameRO = getString("category_name_ro")
	product.MainImageURL = getString("main_image_url")
	product.PriceMDL = getFloat("price_mdl")
	product.PriceEUR = getFloat("price_eur")
	product.PriceUSD = getFloat("price_usd")
	product.TotalStock = getInt("total_stock")
	product.IsInStock = getBool("is_in_stock")
	product.IsActive = getBool("is_active")
	product.PropertyValues = getStringArray("property_values")
	product.PropertySpecs = getStringArray("property_specs")
	product.ProductType = getString("product_type")
	product.ProductTypeBoost = getInt("product_type_boost")
	product.CreatedAt = getInt64("created_at")
	product.UpdatedAt = getInt64("updated_at")

	return product, nil
}

// convertHitToSuggestion converts a Meilisearch hit to AutocompleteSuggestion
func (svc *Service) convertHitToSuggestion(hit interface{}) AutocompleteSuggestion {
	hitMap, ok := hit.(map[string]interface{})
	if !ok {
		return AutocompleteSuggestion{}
	}

	suggestion := AutocompleteSuggestion{}

	// Helper functions
	getString := func(key string) string {
		if val, ok := hitMap[key]; ok && val != nil {
			if str, ok := val.(string); ok {
				return str
			}
		}
		return ""
	}

	getFloat := func(key string) float64 {
		if val, ok := hitMap[key]; ok && val != nil {
			if f, ok := val.(float64); ok {
				return f
			}
		}
		return 0
	}

	getInt := func(key string) int {
		if val, ok := hitMap[key]; ok && val != nil {
			if f, ok := val.(float64); ok {
				return int(f)
			}
			if i, ok := val.(int); ok {
				return i
			}
		}
		return 0
	}

	suggestion.ID = getString("id")
	suggestion.Name = getString("name")
	suggestion.NameRU = getString("name_ru")
	suggestion.NameRO = getString("name_ro")
	suggestion.BrandName = getString("brand_name")
	suggestion.CategoryName = getString("category_name")
	suggestion.ImageURL = getString("main_image_url")
	suggestion.Price = getFloat("price_mdl")
	suggestion.ProductType = getString("product_type")
	suggestion.TotalStock = getInt("total_stock")

	return suggestion
}
