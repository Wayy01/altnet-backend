package variants

import (
	"context"
	"log"
	"strings"
	"sync"

	"ultra-api-testing/internal/models"
)

// ProductGrouper groups products by their base name using Ollama AI
type ProductGrouper struct {
	ollamaClient *OllamaClient
}

// NewProductGrouper creates a new ProductGrouper
func NewProductGrouper(ollamaClient *OllamaClient) *ProductGrouper {
	return &ProductGrouper{
		ollamaClient: ollamaClient,
	}
}

// GroupResult contains the result of grouping products
type GroupResult struct {
	BaseName           string
	BaseNameNormalized string
	Products           []*models.Product
}

// GroupProductsByBaseName groups products by their base name extracted via Ollama
// Returns a map of normalized base name -> products
func (g *ProductGrouper) GroupProductsByBaseName(
	ctx context.Context,
	products []*models.Product,
) (map[string]*GroupResult, error) {
	if len(products) == 0 {
		return nil, nil
	}

	// Extract titles
	titles := make([]string, len(products))
	titleToProduct := make(map[string][]*models.Product)

	for i, product := range products {
		titles[i] = product.Name
		titleToProduct[product.Name] = append(titleToProduct[product.Name], product)
	}

	// Get unique titles to reduce API calls
	uniqueTitles := make([]string, 0, len(titleToProduct))
	for title := range titleToProduct {
		uniqueTitles = append(uniqueTitles, title)
	}

	log.Printf("Grouper: Extracting base names for %d unique product titles", len(uniqueTitles))

	// Extract base names using Ollama
	baseNames, err := g.ollamaClient.ExtractBaseNameBatch(ctx, uniqueTitles)
	if err != nil {
		return nil, err
	}

	// Group products by normalized base name
	groups := make(map[string]*GroupResult)
	var mu sync.Mutex

	for title, baseName := range baseNames {
		normalizedBase := NormalizeBaseName(baseName)
		if normalizedBase == "" {
			continue
		}

		mu.Lock()
		if existing, ok := groups[normalizedBase]; ok {
			// Add products with this title to existing group
			existing.Products = append(existing.Products, titleToProduct[title]...)
		} else {
			// Create new group
			groups[normalizedBase] = &GroupResult{
				BaseName:           baseName,
				BaseNameNormalized: normalizedBase,
				Products:           titleToProduct[title],
			}
		}
		mu.Unlock()
	}

	// Filter out single-product groups (no variants if only 1 product)
	filtered := make(map[string]*GroupResult)
	for key, group := range groups {
		if len(group.Products) >= 2 {
			filtered[key] = group
		}
	}

	log.Printf("Grouper: Created %d variant groups (filtered from %d)", len(filtered), len(groups))

	return filtered, nil
}

// GroupProductsByBaseNameWithFallback groups products using Ollama with fallback to simple normalization
func (g *ProductGrouper) GroupProductsByBaseNameWithFallback(
	ctx context.Context,
	products []*models.Product,
) (map[string]*GroupResult, error) {
	// Check if Ollama is available
	if !g.ollamaClient.IsAvailable(ctx) {
		log.Printf("Grouper: Ollama not available, using fallback grouping")
		return g.groupBySimpleNormalization(products), nil
	}

	return g.GroupProductsByBaseName(ctx, products)
}

// groupBySimpleNormalization is a fallback when Ollama is not available
// It uses simple string matching to group products
func (g *ProductGrouper) groupBySimpleNormalization(products []*models.Product) map[string]*GroupResult {
	groups := make(map[string]*GroupResult)

	for _, product := range products {
		// Simple base name extraction: take first few words before common variant markers
		baseName := extractSimpleBaseName(product.Name)
		normalizedBase := NormalizeBaseName(baseName)

		if normalizedBase == "" {
			continue
		}

		if existing, ok := groups[normalizedBase]; ok {
			existing.Products = append(existing.Products, product)
		} else {
			groups[normalizedBase] = &GroupResult{
				BaseName:           baseName,
				BaseNameNormalized: normalizedBase,
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

	return filtered
}

// extractSimpleBaseName extracts a base name using simple string matching
// This is a fallback when Ollama is not available
func extractSimpleBaseName(name string) string {
	// Common variant markers that indicate the end of base name
	variantMarkers := []string{
		// Storage sizes
		"1tb", "512gb", "256gb", "128gb", "64gb", "32gb", "16gb", "8gb", "4gb", "2gb", "1gb",
		// Memory
		"ddr4", "ddr5",
		// Colors (common ones)
		"black", "white", "blue", "red", "green", "gold", "silver", "gray", "grey",
		"midnight", "starlight", "purple", "pink", "yellow", "orange",
		// Sizes
		"small", "medium", "large", "xl", "xxl", "xs", "s/m", "m/l",
		// Other common variant indicators
		"wifi", "cellular", "5g", "4g", "lte",
	}

	// Convert to lowercase for comparison
	lowerName := strings.ToLower(name)

	// Find the earliest marker position
	earliestPos := len(name)
	for _, marker := range variantMarkers {
		if pos := strings.Index(lowerName, marker); pos != -1 && pos < earliestPos {
			earliestPos = pos
		}
	}

	// If we found a marker, take everything before it
	if earliestPos < len(name) && earliestPos > 0 {
		return strings.TrimSpace(name[:earliestPos])
	}

	// If no marker found, return the whole name
	return name
}

// GroupProductsBatch processes products in batches for memory efficiency
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

		// Process batch
		batchGroups, err := g.GroupProductsByBaseNameWithFallback(ctx, batch)
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
