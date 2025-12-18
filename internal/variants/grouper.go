package variants

import (
	"context"
	"fmt"
	"log"
	"strings"

	"github.com/google/uuid"
	"ultra-api-testing/internal/models"
	"ultra-api-testing/internal/ollama"
)

// ProductGrouper groups products by AI-extracted base name + category + brand
type ProductGrouper struct {
	extractor *ollama.BaseNameExtractor
}

// NewProductGrouper creates a new ProductGrouper with Ollama-based name extraction
func NewProductGrouper(ollamaClient *ollama.Client) *ProductGrouper {
	var extractor *ollama.BaseNameExtractor
	if ollamaClient != nil {
		extractor = ollama.NewBaseNameExtractor(ollamaClient)
	}
	return &ProductGrouper{
		extractor: extractor,
	}
}

// GroupResult contains the result of grouping products
type GroupResult struct {
	BaseName           string
	BaseNameNormalized string
	BrandID            *uuid.UUID
	CategoryID         *uuid.UUID
	Products           []*models.Product
}

// GroupKey represents the unique key for grouping products
// Products are grouped by AI-extracted base name, category_id, and brand_id
type GroupKey struct {
	BaseName   string
	BrandID    string // string representation of UUID (empty string for nil)
	CategoryID string // string representation of UUID (empty string for nil)
}

// String returns a string representation of the group key for use as map key
func (k GroupKey) String() string {
	return fmt.Sprintf("%s|%s|%s", k.BaseName, k.BrandID, k.CategoryID)
}

// GroupProductsByAIExtractedName groups products by AI-extracted base name + category + brand
// Uses Ollama to extract base product names by removing color, storage, and RAM info
// Returns a map of group key -> products
func (g *ProductGrouper) GroupProductsByAIExtractedName(
	ctx context.Context,
	products []*models.Product,
) (map[string]*GroupResult, error) {
	if len(products) == 0 {
		return nil, nil
	}

	// Check if Ollama extractor is available
	if g.extractor == nil {
		log.Println("Grouper: Ollama extractor not configured, falling back to exact match")
		return g.groupByExactName(ctx, products)
	}

	// Collect all product names for batch extraction
	productNames := make([]string, len(products))
	for i, product := range products {
		productNames[i] = product.Name
	}

	// Extract base names using Ollama (with caching and batching)
	log.Printf("Grouper: Extracting base names for %d products using Ollama AI...", len(products))
	baseNames, err := g.extractor.ExtractBaseNamesBatch(ctx, productNames)
	if err != nil {
		log.Printf("Grouper: Ollama batch extraction failed: %v, falling back to individual extraction", err)
		// Try individual extraction as fallback
		baseNames = make(map[string]string)
		for _, name := range productNames {
			baseName, err := g.extractor.ExtractWithRetry(ctx, name, 2)
			if err != nil {
				log.Printf("Grouper: Failed to extract base name for '%s': %v", name, err)
				baseName = NormalizeBaseName(name) // Use original as fallback
			}
			baseNames[name] = baseName
		}
	}

	log.Printf("Grouper: Extracted %d base names from %d product names", len(baseNames), len(productNames))

	// Group products by article code (if available) or extracted base name + brand_id + category_id
	// Article code takes priority as it's a reliable indicator of product variants
	groups := make(map[string]*GroupResult)

	for _, product := range products {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}

		// Use article code for grouping if available (more reliable than AI extraction)
		// Otherwise fall back to AI-extracted base name
		var baseName string
		if product.Article != nil && strings.TrimSpace(*product.Article) != "" {
			baseName = strings.TrimSpace(*product.Article)
		} else {
			// Get extracted base name or fall back to original
			extractedName, ok := baseNames[product.Name]
			if !ok || extractedName == "" {
				baseName = NormalizeBaseName(product.Name)
			} else {
				baseName = extractedName
			}
		}

		// Create group key from article/base name + brand_id + category_id
		key := GroupKey{
			BaseName:   baseName,
			BrandID:    uuidToString(product.BrandID),
			CategoryID: uuidToString(product.CategoryID),
		}

		keyStr := key.String()

		if existing, ok := groups[keyStr]; ok {
			existing.Products = append(existing.Products, product)
		} else {
			groups[keyStr] = &GroupResult{
				BaseName:           baseName,
				BaseNameNormalized: NormalizeBaseName(baseName),
				BrandID:            product.BrandID,
				CategoryID:         product.CategoryID,
				Products:           []*models.Product{product},
			}
		}
	}

	// Filter out single-product groups (no variants if only 1 product)
	filtered := make(map[string]*GroupResult)
	for key, group := range groups {
		if len(group.Products) >= 2 {
			filtered[key] = group
		}
	}

	log.Printf("Grouper: Created %d variant groups from %d products (AI-extracted base name+brand+category)",
		len(filtered), len(products))

	return filtered, nil
}

// groupByExactName groups products by article code or exact name match (fallback when Ollama unavailable)
// Products with the same article code are grouped together for variant detection
func (g *ProductGrouper) groupByExactName(
	ctx context.Context,
	products []*models.Product,
) (map[string]*GroupResult, error) {
	groups := make(map[string]*GroupResult)

	for _, product := range products {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}

		// Use article code for grouping if available, otherwise fall back to exact name
		var baseName string
		if product.Article != nil && strings.TrimSpace(*product.Article) != "" {
			baseName = strings.TrimSpace(*product.Article)
		} else {
			baseName = strings.TrimSpace(product.Name)
		}

		// Create group key from article/name + brand_id + category_id
		key := GroupKey{
			BaseName:   baseName,
			BrandID:    uuidToString(product.BrandID),
			CategoryID: uuidToString(product.CategoryID),
		}

		keyStr := key.String()

		if existing, ok := groups[keyStr]; ok {
			existing.Products = append(existing.Products, product)
		} else {
			groups[keyStr] = &GroupResult{
				BaseName:           baseName,
				BaseNameNormalized: NormalizeBaseName(baseName),
				BrandID:            product.BrandID,
				CategoryID:         product.CategoryID,
				Products:           []*models.Product{product},
			}
		}
	}

	// Filter out single-product groups
	filtered := make(map[string]*GroupResult)
	for key, group := range groups {
		if len(group.Products) >= 2 {
			filtered[key] = group
		}
	}

	log.Printf("Grouper: Created %d variant groups from %d products (article/name match - Ollama unavailable)",
		len(filtered), len(products))

	return filtered, nil
}

// GroupProductsBatch processes products in batches for memory efficiency
// Uses AI-extracted base name + brand + category matching
func (g *ProductGrouper) GroupProductsBatch(
	ctx context.Context,
	products []*models.Product,
	batchSize int,
	progressFn func(processed, total int),
) (map[string]*GroupResult, error) {
	allGroups := make(map[string]*GroupResult)
	total := len(products)

	for i := 0; i < total; i += batchSize {
		end := i + batchSize
		if end > total {
			end = total
		}

		batch := products[i:end]

		// Check context cancellation
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}

		// Process batch using AI extraction
		batchGroups, err := g.GroupProductsByAIExtractedName(ctx, batch)
		if err != nil {
			return nil, err
		}

		// Merge batch results into all groups
		for key, group := range batchGroups {
			if existing, ok := allGroups[key]; ok {
				existing.Products = append(existing.Products, group.Products...)
			} else {
				allGroups[key] = group
			}
		}

		// Report progress
		if progressFn != nil {
			progressFn(end, total)
		}
	}

	// Final filter: remove single-product groups
	filtered := make(map[string]*GroupResult)
	for key, group := range allGroups {
		if len(group.Products) >= 2 {
			filtered[key] = group
		}
	}

	return filtered, nil
}

// uuidToString converts a UUID pointer to string, returning empty string for nil
func uuidToString(id *uuid.UUID) string {
	if id == nil {
		return ""
	}
	return id.String()
}

// NormalizeBaseName normalizes a product name for display
func NormalizeBaseName(name string) string {
	// Trim whitespace
	result := strings.TrimSpace(name)
	// Normalize multiple spaces to single space
	result = strings.Join(strings.Fields(result), " ")
	return result
}

// ClearCache clears the Ollama extraction cache (useful for testing or memory management)
func (g *ProductGrouper) ClearCache() {
	if g.extractor != nil {
		g.extractor.ClearCache()
	}
}

// GetCacheSize returns the number of cached base name extractions
func (g *ProductGrouper) GetCacheSize() int {
	if g.extractor != nil {
		return g.extractor.CacheSize()
	}
	return 0
}
