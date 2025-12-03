package handlers

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/meilisearch/meilisearch-go"
	"ultra-api-testing/internal/repository"
	"ultra-api-testing/internal/search"
)

// SearchHandler handles smart search endpoints
type SearchHandler struct {
	service *search.Service
	indexer *search.Indexer
	repo    *repository.Repository
}

// NewSearchHandler creates a new search handler
func NewSearchHandler(service *search.Service, indexer *search.Indexer, repo *repository.Repository) *SearchHandler {
	return &SearchHandler{
		service: service,
		indexer: indexer,
		repo:    repo,
	}
}

// SmartSearch handles GET /api/v1/smart-search
// Full-featured search with filters and sorting
func (sh *SearchHandler) SmartSearch(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	query := r.URL.Query()

	// Parse search parameters
	params := search.SearchParams{
		Query:  query.Get("q"),
		Limit:  parseIntOrDefault(query.Get("limit"), 20),
		Offset: parseIntOrDefault(query.Get("offset"), 0),
	}

	// Parse optional filters
	if brandID := query.Get("brand_id"); brandID != "" {
		params.BrandID = brandID
	}
	if categoryID := query.Get("category_id"); categoryID != "" {
		params.CategoryID = categoryID
	}
	if inStock := query.Get("in_stock"); inStock != "" {
		val := inStock == "true"
		params.InStock = &val
	}
	if productType := query.Get("product_type"); productType != "" {
		params.ProductType = productType
	}

	// Parse price filters
	if minPrice := query.Get("min_price"); minPrice != "" {
		if val, err := strconv.ParseFloat(minPrice, 64); err == nil {
			params.MinPrice = &val
		}
	}
	if maxPrice := query.Get("max_price"); maxPrice != "" {
		if val, err := strconv.ParseFloat(maxPrice, 64); err == nil {
			params.MaxPrice = &val
		}
	}

	// Parse sort parameters
	// Format: ?sort=price_mdl:asc,name:desc
	if sortStr := query.Get("sort"); sortStr != "" {
		params.Sort = []string{sortStr}
	}

	// Execute search
	result, err := sh.service.Search(ctx, params)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Search failed", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": result,
	})
}

// Autocomplete handles GET /api/v1/smart-search/autocomplete
// Fast autocomplete with minimal data for instant suggestions
func (sh *SearchHandler) Autocomplete(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	query := r.URL.Query()

	q := query.Get("q")
	limit := parseIntOrDefault(query.Get("limit"), 5)

	// Execute autocomplete
	result, err := sh.service.Autocomplete(ctx, q, limit)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Autocomplete failed", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": result,
	})
}

// CompareSearch handles GET /api/v1/smart-search/compare
// Compares old PostgreSQL search with new Meilisearch search
func (sh *SearchHandler) CompareSearch(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	query := r.URL.Query()

	q := query.Get("q")
	if q == "" {
		respondError(w, http.StatusBadRequest, "Query parameter 'q' is required", "")
		return
	}

	limit := parseIntOrDefault(query.Get("limit"), 10)

	// Execute new Meilisearch search
	newParams := search.SearchParams{
		Query:  q,
		Limit:  limit,
		Offset: 0,
	}
	newStart := time.Now()
	newResult, err := sh.service.Search(ctx, newParams)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "New search failed", err.Error())
		return
	}
	_ = time.Since(newStart) // newDuration not needed since we use ProcessingTimeMs

	// Execute old PostgreSQL search using ListProducts with search filter
	oldStart := time.Now()
	filter := &repository.ProductFilter{
		Search: q,
	}
	oldProducts, err := sh.repo.ListProducts(ctx, filter, limit, 0)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Old search failed", err.Error())
		return
	}
	oldDuration := time.Since(oldStart)

	// Convert old results to comparison format
	var oldHits []search.OldSearchHit
	for _, p := range oldProducts {
		hit := search.OldSearchHit{
			ID:   p.ID.String(),
			Name: p.Name,
		}
		if p.BrandName != nil {
			hit.BrandName = *p.BrandName
		}
		if p.CategoryName != nil {
			hit.CategoryName = *p.CategoryName
		}
		if p.MainImageURL != nil {
			hit.ImageURL = *p.MainImageURL
		}
		if p.PriceMDL != nil {
			hit.Price = *p.PriceMDL
		}
		oldHits = append(oldHits, hit)
	}

	// Build comparison result
	comparison := search.SearchComparisonResult{
		Query: q,
		OldSearch: search.OldSearchResult{
			Results: oldHits,
			Count:   len(oldHits),
			TimeMs:  oldDuration.Milliseconds(),
		},
		NewSearch: *newResult,
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": comparison,
		"performance": map[string]interface{}{
			"old_ms":     oldDuration.Milliseconds(),
			"new_ms":     newResult.ProcessingTimeMs,
			"speedup":    fmt.Sprintf("%.2fx", float64(oldDuration.Milliseconds())/float64(newResult.ProcessingTimeMs)),
		},
	})
}

// GetIndexStatus handles GET /api/v1/smart-search/status
// Returns health and statistics about the search index
func (sh *SearchHandler) GetIndexStatus(w http.ResponseWriter, r *http.Request) {
	// Get the search client through the indexer
	client := sh.indexer.Client

	// Check health
	isHealthy := client.Health() == nil

	// Get index stats
	stats, err := client.GetStats()
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to get index stats", err.Error())
		return
	}

	// Get pending tasks
	tasks, err := client.GetClient().GetTasks(&meilisearch.TasksQuery{
		Statuses: []meilisearch.TaskStatus{
			meilisearch.TaskStatusEnqueued,
			meilisearch.TaskStatusProcessing,
		},
	})
	if err != nil {
		log.Printf("Warning: failed to get pending tasks: %v", err)
	}

	pendingCount := 0
	isIndexing := false
	if tasks != nil && tasks.Results != nil {
		pendingCount = len(tasks.Results)
		// Check if any task is currently processing
		for _, task := range tasks.Results {
			if task.Status == meilisearch.TaskStatusProcessing {
				isIndexing = true
				break
			}
		}
	}

	status := search.IndexStatus{
		IsHealthy:      isHealthy,
		DocumentCount:  stats.NumberOfDocuments,
		IsIndexing:     isIndexing,
		PendingUpdates: pendingCount,
		IndexSize:      "N/A", // Meilisearch doesn't expose database size in stats
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": status,
	})
}

// TriggerReindex handles POST /api/v1/smart-search/reindex
// Triggers a full reindex of all products
func (sh *SearchHandler) TriggerReindex(w http.ResponseWriter, r *http.Request) {
	// Start reindex in background
	go func() {
		bgCtx := context.Background()
		log.Println("Starting background reindex...")
		if err := sh.indexer.FullReindex(bgCtx); err != nil {
			log.Printf("Reindex failed: %v", err)
		} else {
			log.Println("Reindex completed successfully")
		}
	}()

	respondJSON(w, http.StatusAccepted, map[string]interface{}{
		"message": "Reindex started in background",
		"status":  "processing",
	})
}

// Helper function (local to this file)

func parseIntOrDefault(s string, defaultVal int) int {
	if s == "" {
		return defaultVal
	}
	val, err := strconv.Atoi(s)
	if err != nil {
		return defaultVal
	}
	return val
}
