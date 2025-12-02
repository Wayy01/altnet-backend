package variants

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"ultra-api-testing/internal/config"
)

// lruCache is a simple LRU cache with a maximum size
type lruCache struct {
	mu      sync.RWMutex
	cache   map[string]string
	order   []string // tracks insertion order for LRU eviction
	maxSize int
}

// newLRUCache creates a new LRU cache with the specified max size
func newLRUCache(maxSize int) *lruCache {
	return &lruCache{
		cache:   make(map[string]string),
		order:   make([]string, 0, maxSize),
		maxSize: maxSize,
	}
}

// Get retrieves a value from the cache
func (c *lruCache) Get(key string) (string, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	val, ok := c.cache[key]
	return val, ok
}

// Set stores a value in the cache, evicting oldest if at capacity
func (c *lruCache) Set(key, value string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	// If key already exists, just update value (no order change for simplicity)
	if _, exists := c.cache[key]; exists {
		c.cache[key] = value
		return
	}

	// Evict oldest entry if at capacity
	if len(c.cache) >= c.maxSize && c.maxSize > 0 {
		// Remove oldest entry
		if len(c.order) > 0 {
			oldest := c.order[0]
			c.order = c.order[1:]
			delete(c.cache, oldest)
		}
	}

	// Add new entry
	c.cache[key] = value
	c.order = append(c.order, key)
}

// Clear removes all entries from the cache
func (c *lruCache) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.cache = make(map[string]string)
	c.order = make([]string, 0, c.maxSize)
}

// Maximum number of entries in the base name cache
const maxCacheSize = 10000

// OllamaClient provides an interface to the Ollama AI API for base name extraction
type OllamaClient struct {
	httpClient *http.Client
	config     *config.OllamaConfig
	cache      *lruCache // LRU cache for extracted base names
}

// GenerateRequest represents the request body for Ollama's generate API
type GenerateRequest struct {
	Model  string `json:"model"`
	Prompt string `json:"prompt"`
	Stream bool   `json:"stream"`
}

// GenerateResponse represents the response from Ollama's generate API
type GenerateResponse struct {
	Model     string `json:"model"`
	Response  string `json:"response"`
	Done      bool   `json:"done"`
	CreatedAt string `json:"created_at"`
}

// NewOllamaClient creates a new Ollama API client
func NewOllamaClient(cfg *config.OllamaConfig) *OllamaClient {
	return &OllamaClient{
		httpClient: &http.Client{
			Timeout: cfg.Timeout,
		},
		config: cfg,
		cache:  newLRUCache(maxCacheSize),
	}
}

// baseNamePrompt returns the prompt template for extracting base product names
func baseNamePrompt(productTitle string) string {
	return fmt.Sprintf(`Extract ONLY the base product name from this product title.
Remove all variant-specific details (storage, color, size, capacity, RAM, memory variants).
Keep the full model name (e.g., Pro Max, Plus, Ultra, SE, Mini).
Return ONLY the base name on a single line, no explanation, no quotes.

Product: %s
Base name:`, productTitle)
}

// ExtractBaseName extracts the base product name from a product title using Ollama
func (c *OllamaClient) ExtractBaseName(ctx context.Context, productTitle string) (string, error) {
	// Check cache first
	if cached, ok := c.cache.Get(productTitle); ok {
		return cached, nil
	}

	// Prepare request
	reqBody := GenerateRequest{
		Model:  c.config.Model,
		Prompt: baseNamePrompt(productTitle),
		Stream: false,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("marshaling request: %w", err)
	}

	// Make request with retries
	var resp *http.Response
	var lastErr error
	maxRetries := 3

	for attempt := 0; attempt < maxRetries; attempt++ {
		if attempt > 0 {
			// Exponential backoff: 1s, 2s, 4s
			backoff := time.Duration(1<<uint(attempt-1)) * time.Second
			select {
			case <-ctx.Done():
				return "", ctx.Err()
			case <-time.After(backoff):
			}
		}

		req, err := http.NewRequestWithContext(ctx, "POST", c.config.URL+"/api/generate", bytes.NewReader(jsonBody))
		if err != nil {
			lastErr = fmt.Errorf("creating request: %w", err)
			continue
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err = c.httpClient.Do(req)
		if err != nil {
			lastErr = fmt.Errorf("sending request: %w", err)
			continue
		}

		if resp.StatusCode == http.StatusOK {
			break
		}

		resp.Body.Close()
		lastErr = fmt.Errorf("ollama returned status %d", resp.StatusCode)
	}

	if resp == nil {
		return "", fmt.Errorf("failed after %d retries: %w", maxRetries, lastErr)
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("reading response: %w", err)
	}

	var genResp GenerateResponse
	if err := json.Unmarshal(body, &genResp); err != nil {
		return "", fmt.Errorf("unmarshaling response: %w", err)
	}

	// Clean and normalize the response
	baseName := cleanBaseName(genResp.Response)

	// Cache the result
	c.cache.Set(productTitle, baseName)

	return baseName, nil
}

// ExtractBaseNameBatch extracts base names for multiple product titles
// Returns a map of original title -> base name
func (c *OllamaClient) ExtractBaseNameBatch(ctx context.Context, titles []string) (map[string]string, error) {
	results := make(map[string]string)
	var mu sync.Mutex
	var wg sync.WaitGroup

	// Use a semaphore to limit concurrent requests
	semaphore := make(chan struct{}, 10) // Max 10 concurrent requests

	errChan := make(chan error, len(titles))

	for _, title := range titles {
		// Check cache first
		if cached, ok := c.cache.Get(title); ok {
			mu.Lock()
			results[title] = cached
			mu.Unlock()
			continue
		}

		wg.Add(1)
		go func(t string) {
			defer wg.Done()

			select {
			case semaphore <- struct{}{}:
				defer func() { <-semaphore }()
			case <-ctx.Done():
				errChan <- ctx.Err()
				return
			}

			baseName, err := c.ExtractBaseName(ctx, t)
			if err != nil {
				log.Printf("Warning: failed to extract base name for %q: %v", t, err)
				// Use original title as fallback, normalized
				baseName = normalizeBaseName(t)
			}

			mu.Lock()
			results[t] = baseName
			mu.Unlock()
		}(title)
	}

	wg.Wait()
	close(errChan)

	// Check if context was cancelled
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}

	return results, nil
}

// IsAvailable checks if the Ollama service is available
func (c *OllamaClient) IsAvailable(ctx context.Context) bool {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "GET", c.config.URL+"/api/tags", nil)
	if err != nil {
		return false
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	return resp.StatusCode == http.StatusOK
}

// GetModelInfo returns information about the configured model
func (c *OllamaClient) GetModelInfo() map[string]string {
	return map[string]string{
		"url":   c.config.URL,
		"model": c.config.Model,
	}
}

// ClearCache clears the base name cache
func (c *OllamaClient) ClearCache() {
	c.cache.Clear()
}

// cleanBaseName cleans and normalizes the base name from Ollama response
func cleanBaseName(response string) string {
	// Remove any leading/trailing whitespace
	result := strings.TrimSpace(response)

	// Remove quotes if present
	result = strings.Trim(result, "\"'`")

	// Take only the first line if multiple lines
	if idx := strings.Index(result, "\n"); idx != -1 {
		result = result[:idx]
	}

	// Remove common prefixes that Ollama might add
	prefixes := []string{"Base name:", "The base name is:", "Answer:", "Result:"}
	for _, prefix := range prefixes {
		if strings.HasPrefix(strings.ToLower(result), strings.ToLower(prefix)) {
			result = strings.TrimSpace(result[len(prefix):])
		}
	}

	// Final trim and normalize
	return strings.TrimSpace(result)
}

// normalizeBaseName normalizes a base name for comparison and grouping
func normalizeBaseName(name string) string {
	// Convert to lowercase
	result := strings.ToLower(name)

	// Remove extra whitespace
	result = strings.Join(strings.Fields(result), " ")

	// Trim
	return strings.TrimSpace(result)
}

// NormalizeBaseName is the exported version for use in other packages
func NormalizeBaseName(name string) string {
	return normalizeBaseName(name)
}
