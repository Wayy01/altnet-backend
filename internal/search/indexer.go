package search

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/meilisearch/meilisearch-go"
	"ultra-api-testing/internal/models"
	"ultra-api-testing/internal/repository"
)

// Indexer handles syncing products from PostgreSQL to Meilisearch
type Indexer struct {
	Client *Client // Exported so handlers can access it
	repo   *repository.Repository
}

// NewIndexer creates a new product indexer
func NewIndexer(client *Client, repo *repository.Repository) *Indexer {
	return &Indexer{
		Client: client,
		repo:   repo,
	}
}

// FullReindex indexes all products from the database to Meilisearch
// This is a comprehensive operation that fetches all ~47k products with their properties
func (idx *Indexer) FullReindex(ctx context.Context) error {
	log.Println("Starting full product reindex...")
	startTime := time.Now()

	// Clear the existing index first to remove stale products
	log.Println("Clearing existing index...")
	if _, err := idx.Client.GetIndex().DeleteAllDocuments(); err != nil {
		log.Printf("Warning: failed to clear index: %v", err)
		// Continue anyway - documents will be overwritten
	}

	// First, get the count of total products
	// Pass nil filter to get all products
	totalCount, err := idx.repo.CountProducts(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to count products: %w", err)
	}

	log.Printf("Total products to index: %d", totalCount)

	// Batch size for processing - balance between memory and performance
	const batchSize = 500
	indexed := 0
	errors := 0

	// Process products in batches
	for offset := 0; offset < totalCount; offset += batchSize {
		// Fetch batch of products with brand and category
		// Pass nil filter to get all products
		products, err := idx.repo.ListProducts(ctx, nil, batchSize, offset)
		if err != nil {
			log.Printf("Warning: failed to fetch products at offset %d: %v", offset, err)
			errors++
			continue
		}

		if len(products) == 0 {
			break
		}

		// Convert products to searchable documents
		var searchableProducts []SearchableProduct
		for _, product := range products {
			// Skip products without MDL price - they shouldn't be visible to users
			if product.PriceMDL == nil || *product.PriceMDL <= 0 {
				continue
			}

			searchable, err := idx.buildSearchableProduct(ctx, product)
			if err != nil {
				log.Printf("Warning: failed to build searchable product for %s: %v", product.ID, err)
				errors++
				continue
			}
			searchableProducts = append(searchableProducts, searchable)
		}

		// Index the batch
		if len(searchableProducts) > 0 {
			if err := idx.indexBatch(ctx, searchableProducts); err != nil {
				log.Printf("Warning: failed to index batch at offset %d: %v", offset, err)
				errors++
				continue
			}
		}

		indexed += len(searchableProducts)
		log.Printf("Indexed %d/%d products (%.1f%%)", indexed, totalCount, float64(indexed)/float64(totalCount)*100)
	}

	duration := time.Since(startTime)
	log.Printf("Full reindex completed: %d products indexed, %d errors, duration: %v", indexed, errors, duration)

	return nil
}

// IndexProduct indexes a single product by ID
func (idx *Indexer) IndexProduct(ctx context.Context, productID uuid.UUID) error {
	// Fetch the product with details
	product, err := idx.repo.GetProduct(ctx, productID)
	if err != nil {
		return fmt.Errorf("failed to fetch product: %w", err)
	}

	// Build searchable document
	searchable, err := idx.buildSearchableProduct(ctx, product)
	if err != nil {
		return fmt.Errorf("failed to build searchable product: %w", err)
	}

	// Index single document
	documents := []SearchableProduct{searchable}
	_, err = idx.Client.GetIndex().AddDocuments(documents)
	if err != nil {
		return fmt.Errorf("failed to index product: %w", err)
	}

	log.Printf("Indexed product: %s (%s)", product.Name, productID)
	return nil
}

// IndexProducts indexes multiple products by IDs (batch operation)
func (idx *Indexer) IndexProducts(ctx context.Context, productIDs []uuid.UUID) error {
	if len(productIDs) == 0 {
		return nil
	}

	log.Printf("Indexing %d products...", len(productIDs))

	var searchableProducts []SearchableProduct
	errors := 0

	for _, productID := range productIDs {
		product, err := idx.repo.GetProduct(ctx, productID)
		if err != nil {
			log.Printf("Warning: failed to fetch product %s: %v", productID, err)
			errors++
			continue
		}

		searchable, err := idx.buildSearchableProduct(ctx, product)
		if err != nil {
			log.Printf("Warning: failed to build searchable product %s: %v", productID, err)
			errors++
			continue
		}

		searchableProducts = append(searchableProducts, searchable)
	}

	// Index the batch
	if len(searchableProducts) > 0 {
		if err := idx.indexBatch(ctx, searchableProducts); err != nil {
			return fmt.Errorf("failed to index batch: %w", err)
		}
	}

	log.Printf("Indexed %d products (%d errors)", len(searchableProducts), errors)
	return nil
}

// DeleteProduct removes a product from the search index
func (idx *Indexer) DeleteProduct(ctx context.Context, productID uuid.UUID) error {
	_, err := idx.Client.GetIndex().DeleteDocument(productID.String())
	if err != nil {
		return fmt.Errorf("failed to delete product from index: %w", err)
	}

	log.Printf("Deleted product from index: %s", productID)
	return nil
}

// buildSearchableProduct converts a Product model to a SearchableProduct for indexing
func (idx *Indexer) buildSearchableProduct(ctx context.Context, product *models.Product) (SearchableProduct, error) {
	searchable := SearchableProduct{
		ID:      product.ID.String(),
		UltraID: product.UltraID,
		Name:    product.Name,
		Slug:    product.Slug,
		IsActive: product.IsActive,
		IsInStock: product.IsInStock,
		TotalStock: product.TotalStock,
		CreatedAt: product.CreatedAt.Unix(),
		UpdatedAt: product.UpdatedAt.Unix(),
	}

	// Optional string fields
	if product.Code != nil {
		searchable.Code = *product.Code
	}
	if product.Article != nil {
		searchable.Article = *product.Article
	}
	if product.Description != nil {
		searchable.Description = *product.Description
	}
	if product.MainImageURL != nil {
		searchable.MainImageURL = *product.MainImageURL
	}

	// Images array (JSONB) - copy directly from product
	if product.Images != nil && len(product.Images) > 0 {
		searchable.Images = product.Images
	}

	// Translations
	if product.NameRU != nil {
		searchable.NameRU = *product.NameRU
	}
	if product.NameRO != nil {
		searchable.NameRO = *product.NameRO
	}
	if product.DescriptionRU != nil {
		searchable.DescriptionRU = *product.DescriptionRU
	}
	if product.DescriptionRO != nil {
		searchable.DescriptionRO = *product.DescriptionRO
	}

	// Brand information (denormalized)
	if product.BrandID != nil {
		searchable.BrandID = product.BrandID.String()
	}
	if product.BrandName != nil {
		searchable.BrandName = *product.BrandName
	}

	// Category information (denormalized)
	if product.CategoryID != nil {
		searchable.CategoryID = product.CategoryID.String()
	}
	if product.CategoryName != nil {
		searchable.CategoryName = *product.CategoryName
	}

	// Prices
	if product.PriceMDL != nil {
		searchable.PriceMDL = *product.PriceMDL
	}
	if product.PriceEUR != nil {
		searchable.PriceEUR = *product.PriceEUR
	}
	if product.PriceUSD != nil {
		searchable.PriceUSD = *product.PriceUSD
	}

	// Fetch and aggregate product properties
	properties, err := idx.repo.GetProductProperties(ctx, product.ID)
	if err != nil {
		log.Printf("Warning: failed to fetch properties for product %s: %v", product.ID, err)
		// Continue without properties rather than failing
	} else {
		searchable.PropertyValues, searchable.PropertySpecs = idx.aggregateProperties(properties)
	}

	// Detect product type (main product vs accessory)
	productType, typeBoost := idx.detectProductType(
		product.Name,
		searchable.NameRU,
		searchable.NameRO,
	)
	searchable.ProductType = productType
	searchable.ProductTypeBoost = typeBoost

	// Set stock boost - in-stock products rank higher
	if product.IsInStock && product.TotalStock > 0 {
		searchable.StockBoost = 100
	} else {
		searchable.StockBoost = 0
	}

	return searchable, nil
}

// aggregateProperties converts property list into searchable arrays
// Returns two arrays:
// 1. PropertyValues: ["256GB", "Blue", "6.1 inch"] - just the values
// 2. PropertySpecs: ["Storage: 256GB", "Color: Blue"] - name:value pairs
func (idx *Indexer) aggregateProperties(properties []*models.Property) ([]string, []string) {
	var values []string
	var specs []string

	seen := make(map[string]bool) // Deduplicate

	for _, prop := range properties {
		// Add value to values array
		if prop.Value != nil && *prop.Value != "" {
			value := *prop.Value
			if !seen[value] {
				values = append(values, value)
				seen[value] = true
			}

			// Add spec (name:value) to specs array
			if prop.PropertyName != "" {
				spec := fmt.Sprintf("%s: %s", prop.PropertyName, value)
				if !seen[spec] {
					specs = append(specs, spec)
					seen[spec] = true
				}
			}
		}
	}

	return values, specs
}

// detectProductType determines if a product is a main product or an accessory
// Returns product type ("main" or "accessory") and a boost score (100 for main, 0 for accessory)
// This affects ranking - main products will rank higher than accessories in search results
func (idx *Indexer) detectProductType(name, nameRU, nameRO string) (string, int) {
	// Accessory keywords in multiple languages (case-insensitive)
	accessoryKeywords := []string{
		// English
		"case", "cover", "protector", "screen guard", "film",
		"charger", "cable", "adapter", "holder", "stand",
		"bag", "pouch", "sleeve", "skin", "tempered glass",
		"earphone", "headphone", "earbuds", "headset",
		"mount", "tripod", "selfie stick", "ring light",

		// Russian
		"чехол", "кабель", "зарядка", "защита", "наушники", "подставка",

		// Romanian
		"husă", "carcasă", "cablu", "încărcător", "protecție", "căști",
	}

	// Combine all name variants for checking
	combinedText := strings.ToLower(name)
	if nameRU != "" {
		combinedText += " " + strings.ToLower(nameRU)
	}
	if nameRO != "" {
		combinedText += " " + strings.ToLower(nameRO)
	}

	// Check if any accessory keyword is present
	for _, keyword := range accessoryKeywords {
		if strings.Contains(combinedText, strings.ToLower(keyword)) {
			return "accessory", 0 // Accessory gets 0 boost
		}
	}

	// Default to main product
	return "main", 100 // Main products get 100 boost for higher ranking
}

// indexBatch indexes a batch of documents to Meilisearch
func (idx *Indexer) indexBatch(ctx context.Context, products []SearchableProduct) error {
	if len(products) == 0 {
		return nil
	}

	task, err := idx.Client.GetIndex().AddDocuments(products)
	if err != nil {
		return fmt.Errorf("failed to add documents: %w", err)
	}

	// Wait for the task to complete (with timeout)
	taskCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	// Poll task status
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-taskCtx.Done():
			return fmt.Errorf("timeout waiting for indexing task to complete")
		case <-ticker.C:
			taskInfo, err := idx.Client.GetClient().GetTask(task.TaskUID)
			if err != nil {
				return fmt.Errorf("failed to get task status: %w", err)
			}

			switch taskInfo.Status {
			case meilisearch.TaskStatusSucceeded:
				return nil
			case meilisearch.TaskStatusFailed:
				return fmt.Errorf("indexing task failed: %v", taskInfo.Error)
			case meilisearch.TaskStatusEnqueued, meilisearch.TaskStatusProcessing:
				// Continue waiting
				continue
			default:
				return fmt.Errorf("unexpected task status: %s", taskInfo.Status)
			}
		}
	}
}
