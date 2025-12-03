package search

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/meilisearch/meilisearch-go"
	"ultra-api-testing/internal/config"
)

// Client wraps the Meilisearch client and provides search functionality
type Client struct {
	client    meilisearch.ServiceManager
	index     meilisearch.IndexManager
	indexName string
	cfg       config.MeilisearchConfig
}

// NewClient creates a new Meilisearch client
func NewClient(cfg config.MeilisearchConfig) (*Client, error) {
	if cfg.URL == "" {
		return nil, fmt.Errorf("meilisearch URL is required")
	}

	client := meilisearch.New(cfg.URL, meilisearch.WithAPIKey(cfg.MasterKey))

	// Check if Meilisearch is healthy
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if _, err := client.Health(); err != nil {
		return nil, fmt.Errorf("failed to connect to Meilisearch: %w", err)
	}
	_ = ctx // Used for timeout context

	// Get or create the index
	indexName := cfg.IndexName
	if indexName == "" {
		indexName = "products"
	}

	// Create index if it doesn't exist
	_, err := client.CreateIndex(&meilisearch.IndexConfig{
		Uid:        indexName,
		PrimaryKey: "id",
	})
	if err != nil {
		// Index might already exist, which is fine
		log.Printf("Index creation result: %v (may already exist)", err)
	}

	index := client.Index(indexName)

	c := &Client{
		client:    client,
		index:     index,
		indexName: indexName,
		cfg:       cfg,
	}

	// Configure index settings
	if err := c.ConfigureIndex(); err != nil {
		log.Printf("Warning: failed to configure index settings: %v", err)
	}

	log.Printf("Meilisearch client initialized for index: %s", indexName)
	return c, nil
}

// ConfigureIndex sets up the index with optimal settings for product search
func (c *Client) ConfigureIndex() error {
	// Searchable attributes - order matters for relevance!
	// Fields listed first are considered more relevant
	searchableAttrs := []string{
		"name",
		"name_ru",
		"name_ro",
		"brand_name",
		"code",
		"article",
		"category_name",
		"category_name_ru",
		"category_name_ro",
		"property_values",
		"property_specs",
		"description",
		"description_ru",
		"description_ro",
	}

	// Filterable attributes for faceted search
	filterableAttrs := []string{
		"brand_id",
		"brand_name",
		"category_id",
		"category_name",
		"is_active",
		"is_in_stock",
		"product_type",
		"price_mdl",
		"price_eur",
		"price_usd",
		"total_stock",
		"stock_boost",
	}

	// Sortable attributes
	sortableAttrs := []string{
		"name",
		"price_mdl",
		"price_eur",
		"price_usd",
		"total_stock",
		"created_at",
		"updated_at",
		"product_type_boost",
		"stock_boost",
	}

	// Custom ranking rules - in-stock main products rank highest
	// stock_boost and product_type_boost are placed early to ensure
	// in-stock main products always appear before out-of-stock/accessories
	rankingRules := []string{
		"words",                    // Exact word matches first
		"typo",                     // Typo tolerance
		"stock_boost:desc",         // In-stock products (100) rank higher than out-of-stock (0) - PRIORITY
		"product_type_boost:desc",  // Main products (100) rank higher than accessories (0) - PRIORITY
		"proximity",                // Words close together
		"attribute",                // Field priority (searchableAttrs order)
		"sort",                     // User-defined sort
		"exactness",                // Exact matches
	}

	// Apply searchable attributes
	if _, err := c.index.UpdateSearchableAttributes(&searchableAttrs); err != nil {
		return fmt.Errorf("failed to set searchable attributes: %w", err)
	}

	// Apply filterable attributes
	if _, err := c.index.UpdateFilterableAttributes(&filterableAttrs); err != nil {
		return fmt.Errorf("failed to set filterable attributes: %w", err)
	}

	// Apply sortable attributes
	if _, err := c.index.UpdateSortableAttributes(&sortableAttrs); err != nil {
		return fmt.Errorf("failed to set sortable attributes: %w", err)
	}

	// Apply ranking rules
	if _, err := c.index.UpdateRankingRules(&rankingRules); err != nil {
		return fmt.Errorf("failed to set ranking rules: %w", err)
	}

	// Configure typo tolerance
	typoTolerance := meilisearch.TypoTolerance{
		Enabled: true,
		MinWordSizeForTypos: meilisearch.MinWordSizeForTypos{
			OneTypo:  4,  // Allow 1 typo for words with 4+ characters
			TwoTypos: 8,  // Allow 2 typos for words with 8+ characters
		},
	}
	if _, err := c.index.UpdateTypoTolerance(&typoTolerance); err != nil {
		log.Printf("Warning: failed to set typo tolerance: %v", err)
	}

	// Configure pagination
	pagination := meilisearch.Pagination{
		MaxTotalHits: 10000,
	}
	if _, err := c.index.UpdatePagination(&pagination); err != nil {
		log.Printf("Warning: failed to set pagination: %v", err)
	}

	log.Printf("Meilisearch index '%s' configured successfully", c.indexName)
	return nil
}

// GetIndex returns the Meilisearch index
func (c *Client) GetIndex() meilisearch.IndexManager {
	return c.index
}

// GetClient returns the underlying Meilisearch client
func (c *Client) GetClient() meilisearch.ServiceManager {
	return c.client
}

// Health checks if Meilisearch is healthy
func (c *Client) Health() error {
	_, err := c.client.Health()
	return err
}

// GetStats returns index statistics
func (c *Client) GetStats() (*meilisearch.StatsIndex, error) {
	stats, err := c.index.GetStats()
	if err != nil {
		return nil, fmt.Errorf("failed to get stats: %w", err)
	}
	return stats, nil
}
