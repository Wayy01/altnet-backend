package ollama

import (
	"context"
	"fmt"
	"log"
	"regexp"
	"strings"
	"sync"
	"time"
)

// BaseNameExtractor extracts base product names using Ollama AI
type BaseNameExtractor struct {
	client *Client
	cache  map[string]string
	mu     sync.RWMutex
}

// NewBaseNameExtractor creates a new base name extractor
func NewBaseNameExtractor(client *Client) *BaseNameExtractor {
	return &BaseNameExtractor{
		client: client,
		cache:  make(map[string]string),
	}
}

// ExtractBaseName extracts the base product name from a full product name
// It ONLY removes explicit variant values: colors, storage capacity, and RAM size using REGEX
// It preserves ALL other information including product type, brand, model numbers, etc.
//
// Examples:
//   - "Hair Dryer Xiaomi H101 Pink" -> "Hair Dryer Xiaomi H101"
//   - "Speakers SVEN PS-235 12W Black" -> "Speakers SVEN PS-235 12W"
//   - "iPhone 16 Pro Max, 512GB Desert Titanium" -> "iPhone 16 Pro Max"
//   - "Samsung Galaxy S24 Ultra 256GB Black 12GB RAM" -> "Samsung Galaxy S24 Ultra"
func (e *BaseNameExtractor) ExtractBaseName(ctx context.Context, productName string) (string, error) {
	// Check cache first
	e.mu.RLock()
	if cached, ok := e.cache[productName]; ok {
		e.mu.RUnlock()
		return cached, nil
	}
	e.mu.RUnlock()

	// Use regex-based extraction (fast and deterministic)
	baseName := e.extractWithRegex(productName)

	// Cache the result
	e.mu.Lock()
	e.cache[productName] = baseName
	e.mu.Unlock()

	return baseName, nil
}

// ExtractBaseNamesBatch extracts base names for multiple products using regex (instant)
func (e *BaseNameExtractor) ExtractBaseNamesBatch(ctx context.Context, productNames []string) (map[string]string, error) {
	results := make(map[string]string)

	// Check cache first, then process uncached with regex
	e.mu.RLock()
	for _, name := range productNames {
		if cached, ok := e.cache[name]; ok {
			results[name] = cached
		}
	}
	e.mu.RUnlock()

	// Process uncached names with regex (instant, no batching needed)
	for _, name := range productNames {
		if _, cached := results[name]; !cached {
			baseName := e.extractWithRegex(name)
			results[name] = baseName

			// Cache the result
			e.mu.Lock()
			e.cache[name] = baseName
			e.mu.Unlock()
		}
	}

	return results, nil
}

// buildPrompt creates the prompt for single name extraction
func (e *BaseNameExtractor) buildPrompt(productName string) string {
	return fmt.Sprintf(`Task: Remove ONLY these exact patterns from the product name:
1. Colors: Black, White, Silver, Gold, Blue, Red, Green, Pink, Purple, Orange, Yellow, Gray, Grey, Brown, Beige
2. Storage: 64GB, 128GB, 256GB, 512GB, 1TB, 2TB (with or without space)
3. RAM: 4GB RAM, 8GB RAM, 12GB RAM, 16GB RAM, 32GB RAM

DO NOT remove: brands (Xiaomi, Samsung, Apple, etc.), models (H101, PS-235, etc.), product types (Hair Dryer, Speakers, etc.)

Examples:
"Hair Dryer Xiaomi H101 Pink" -> "Hair Dryer Xiaomi H101"
"Speakers SVEN PS-235 Black" -> "Speakers SVEN PS-235"
"iPhone 16 Pro Max 512GB" -> "iPhone 16 Pro Max"

Product: %s
Base name:`, productName)
}

// buildBatchPrompt creates a prompt for batch extraction
func (e *BaseNameExtractor) buildBatchPrompt(productNames []string) string {
	var sb strings.Builder
	sb.WriteString(`Remove ONLY color, storage (GB/TB), and RAM. Keep brand, model, product type.

Examples:
"Speakers SVEN PS-235 Black" -> "Speakers SVEN PS-235"
"iPhone 16 Pro Max 512GB" -> "iPhone 16 Pro Max"

Format: original|base (one per line)

Products:
`)

	for i, name := range productNames {
		sb.WriteString(fmt.Sprintf("%d. %s\n", i+1, name))
	}

	sb.WriteString("\nOutput:")
	return sb.String()
}

// parseResponse extracts the base name from Ollama's response
func (e *BaseNameExtractor) parseResponse(response, originalName string) string {
	// Clean up the response
	baseName := strings.TrimSpace(response)

	// Remove any quotes
	baseName = strings.Trim(baseName, "\"'`")

	// If response is empty or too different from original, return cleaned original
	if baseName == "" || len(baseName) > len(originalName)*2 {
		return e.cleanName(originalName)
	}

	// Remove common prefixes that Ollama might add
	prefixes := []string{"Base name:", "The base name is:", "Answer:"}
	for _, prefix := range prefixes {
		if strings.HasPrefix(strings.ToLower(baseName), strings.ToLower(prefix)) {
			baseName = strings.TrimSpace(baseName[len(prefix):])
		}
	}

	return strings.TrimSpace(baseName)
}

// parseBatchResponse parses the batch extraction response
func (e *BaseNameExtractor) parseBatchResponse(response string, originalNames []string) map[string]string {
	results := make(map[string]string)
	lines := strings.Split(response, "\n")

	// Initialize with originals as fallback
	for _, name := range originalNames {
		results[name] = e.cleanName(name)
	}

	// Parse each line looking for "original|base" format
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// Try to parse "original|base" or "number. original|base"
		parts := strings.SplitN(line, "|", 2)
		if len(parts) != 2 {
			continue
		}

		// Clean up the original part (remove leading number if present)
		original := strings.TrimSpace(parts[0])
		if idx := strings.Index(original, "."); idx != -1 && idx < 4 {
			original = strings.TrimSpace(original[idx+1:])
		}

		baseName := strings.TrimSpace(parts[1])
		baseName = strings.Trim(baseName, "\"'`")

		// Match to original names
		for _, name := range originalNames {
			if strings.Contains(strings.ToLower(name), strings.ToLower(original)) ||
				strings.Contains(strings.ToLower(original), strings.ToLower(name)) ||
				original == name {
				if baseName != "" {
					results[name] = baseName
				}
				break
			}
		}
	}

	return results
}

// cleanName performs basic cleaning of a product name
func (e *BaseNameExtractor) cleanName(name string) string {
	// Trim whitespace
	result := strings.TrimSpace(name)
	// Normalize multiple spaces
	result = strings.Join(strings.Fields(result), " ")
	return result
}

// ClearCache clears the extraction cache
func (e *BaseNameExtractor) ClearCache() {
	e.mu.Lock()
	e.cache = make(map[string]string)
	e.mu.Unlock()
}

// CacheSize returns the number of cached extractions
func (e *BaseNameExtractor) CacheSize() int {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return len(e.cache)
}

// extractWithRegex uses regex patterns to remove colors, storage, and RAM
func (e *BaseNameExtractor) extractWithRegex(productName string) string {
	result := productName

	// Remove storage patterns: 64GB, 128GB, 256GB, 512GB, 1TB, 2TB (with optional space)
	storagePattern := regexp.MustCompile(`\b\d+\s?(GB|TB)\b`)
	result = storagePattern.ReplaceAllString(result, "")

	// Remove RAM patterns: 4GB RAM, 8GB RAM, etc.
	ramPattern := regexp.MustCompile(`\b\d+\s?GB\s?RAM\b`)
	result = ramPattern.ReplaceAllString(result, "")

	// Remove common colors (case-insensitive, whole word only)
	colorPattern := regexp.MustCompile(`(?i)\b(Black|White|Silver|Gold|Rose\sGold|Space\sGray|Space\sGrey|Gray|Grey|Blue|Red|Green|Pink|Purple|Orange|Yellow|Brown|Beige|Midnight|Starlight|Sierra\sBlue|Alpine\sGreen|Graphite|Deep\sPurple|Desert\sTitanium|Natural\sTitanium|Black\sTitanium|White\sTitanium|Titanium|Midnight\sGreen|Pacific\sBlue|Product\sRed)\b`)
	result = colorPattern.ReplaceAllString(result, "")

	// Clean up: remove extra commas, spaces, and trim
	result = regexp.MustCompile(`\s*,\s*,\s*`).ReplaceAllString(result, ",")  // Multiple commas
	result = regexp.MustCompile(`\s*,\s*$`).ReplaceAllString(result, "")       // Trailing comma
	result = regexp.MustCompile(`^\s*,\s*`).ReplaceAllString(result, "")       // Leading comma
	result = regexp.MustCompile(`\s+`).ReplaceAllString(result, " ")           // Multiple spaces
	result = strings.TrimSpace(result)

	return result
}

// ExtractWithRetry extracts base name with retry on failure
func (e *BaseNameExtractor) ExtractWithRetry(ctx context.Context, productName string, maxRetries int) (string, error) {
	var lastErr error

	for attempt := 0; attempt <= maxRetries; attempt++ {
		if attempt > 0 {
			// Wait before retry with exponential backoff
			select {
			case <-ctx.Done():
				return "", ctx.Err()
			case <-time.After(time.Duration(attempt*100) * time.Millisecond):
			}
		}

		baseName, err := e.ExtractBaseName(ctx, productName)
		if err == nil {
			return baseName, nil
		}
		lastErr = err
		log.Printf("Ollama extraction attempt %d failed: %v", attempt+1, err)
	}

	// Return cleaned original on all retries failed
	return e.cleanName(productName), lastErr
}
