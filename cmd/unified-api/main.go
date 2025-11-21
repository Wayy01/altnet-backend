package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
	"ultra-api-testing/internal/config"
	"ultra-api-testing/internal/database"
	"ultra-api-testing/internal/handlers"
	"ultra-api-testing/internal/repository"
	"ultra-api-testing/internal/ultra"
)

func main() {
	fmt.Println("================================================================================")
	fmt.Println("ULTRA DATA API SERVER")
	fmt.Println("================================================================================")
	fmt.Println()

	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Initialize configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Connect to database
	fmt.Println("Connecting to database...")
	ctx := context.Background()
	db, err := database.New(ctx, cfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	fmt.Println("Database connected successfully")

	// Initialize Ultra client and fetcher
	ultraClient := ultra.NewClient(cfg.Ultra)
	fetcher := ultra.NewFetcher(ultraClient)

	// Create repository and handlers
	repo := repository.New(db.Pool)
	handler := handlers.New(repo, fetcher)

	// Setup router
	router := setupRouter(handler)

	// Display statistics
	displayStatistics(repo)

	// Start server
	port := ":8080"
	if cfg.Server.Port != "" {
		port = ":" + cfg.Server.Port
	}

	fmt.Println()
	fmt.Println("================================================================================")
	fmt.Println("SERVER STARTING")
	fmt.Println("================================================================================")
	fmt.Printf("Listening on http://localhost%s\n", port)
	fmt.Println()
	fmt.Println("Available endpoints:")
	fmt.Println("  GET  /api/v1/brands                        - List all brands")
	fmt.Println("  GET  /api/v1/brands/{id}                   - Get brand details")
	fmt.Println("  GET  /api/v1/categories                    - List categories (hierarchical)")
	fmt.Println("  GET  /api/v1/categories/{id}               - Get category details")
	fmt.Println("  GET  /api/v1/products                      - List products (with filters)")
	fmt.Println("  GET  /api/v1/products/{id}                 - Get product details")
	fmt.Println("  GET  /api/v1/products/{id}/properties      - Get product properties")
	fmt.Println("  GET  /api/v1/products/{id}/characteristics - Get product variants")
	fmt.Println("  GET  /api/v1/search?q=query                - Search products")
	fmt.Println()
	fmt.Println("Query parameters:")
	fmt.Println("  limit       - Number of results per page (default: 50, max: 100)")
	fmt.Println("  offset      - Pagination offset (default: 0)")
	fmt.Println("  brand_id    - Filter by brand UUID")
	fmt.Println("  category_id - Filter by category UUID")
	fmt.Println("  parent_id   - Filter categories by parent UUID")
	fmt.Println("  in_stock    - Filter products in stock (true/false)")
	fmt.Println("  min_price   - Minimum price filter")
	fmt.Println("  max_price   - Maximum price filter")
	fmt.Println("  search      - Search query (partial match)")
	fmt.Println()
	fmt.Println("Examples:")
	fmt.Println("  http://localhost:8080/api/v1/products?limit=10&offset=0")
	fmt.Println("  http://localhost:8080/api/v1/products?in_stock=true&min_price=100")
	fmt.Println("  http://localhost:8080/api/v1/search?q=samsung&limit=20")
	fmt.Println("  http://localhost:8080/api/v1/categories?parent_id=null")
	fmt.Println("================================================================================")
	fmt.Println()

	// Create server with timeouts
	srv := &http.Server{
		Addr:         port,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	log.Fatal(srv.ListenAndServe())
}

func setupRouter(handler *handlers.Handler) *mux.Router {
	router := mux.NewRouter()

	// Add middleware FIRST (before routes)
	router.Use(corsMiddleware)
	router.Use(loggingMiddleware)

	// API v1 routes
	api := router.PathPrefix("/api/v1").Subrouter()

	// Brands (specific routes before parameterized routes)
	api.HandleFunc("/brands", handler.ListBrands).Methods("GET", "OPTIONS")
	api.HandleFunc("/brands", handler.CreateBrand).Methods("POST", "OPTIONS")
	api.HandleFunc("/brands/all", handler.GetAllBrands).Methods("GET", "OPTIONS")
	api.HandleFunc("/brands/bulk", handler.BulkUpdateBrands).Methods("PATCH", "OPTIONS")
	api.HandleFunc("/brands/{id}/stats", handler.GetBrandWithStats).Methods("GET", "OPTIONS")
	api.HandleFunc("/brands/{id}/products/bulk", handler.BulkUpdateBrandProducts).Methods("PATCH", "OPTIONS")
	api.HandleFunc("/brands/{id}/products", handler.GetBrandProducts).Methods("GET", "OPTIONS")
	api.HandleFunc("/brands/{id}", handler.GetBrand).Methods("GET", "OPTIONS")
	api.HandleFunc("/brands/{id}", handler.UpdateBrand).Methods("PUT", "OPTIONS")
	api.HandleFunc("/brands/{id}", handler.DeleteBrand).Methods("DELETE", "OPTIONS")

	// Categories (specific routes before parameterized routes)
	api.HandleFunc("/categories", handler.ListCategories).Methods("GET", "OPTIONS")
	api.HandleFunc("/categories", handler.CreateCategory).Methods("POST", "OPTIONS")
	api.HandleFunc("/categories/all", handler.GetAllCategories).Methods("GET", "OPTIONS")
	api.HandleFunc("/categories/bulk", handler.BulkUpdateCategories).Methods("PATCH", "OPTIONS")
	api.HandleFunc("/categories/{id}/stats", handler.GetCategoryWithStats).Methods("GET", "OPTIONS")
	api.HandleFunc("/categories/{id}/products/bulk", handler.BulkUpdateCategoryProducts).Methods("PATCH", "OPTIONS")
	api.HandleFunc("/categories/{id}/products", handler.GetCategoryProducts).Methods("GET", "OPTIONS")
	api.HandleFunc("/categories/{id}/subcategories", handler.GetCategorySubcategories).Methods("GET", "OPTIONS")
	api.HandleFunc("/categories/{id}", handler.GetCategory).Methods("GET", "OPTIONS")
	api.HandleFunc("/categories/{id}", handler.UpdateCategory).Methods("PUT", "OPTIONS")
	api.HandleFunc("/categories/{id}", handler.DeleteCategory).Methods("DELETE", "OPTIONS")

	// Products
	api.HandleFunc("/products", handler.ListProducts).Methods("GET", "OPTIONS")
	api.HandleFunc("/products/{id}", handler.GetProduct).Methods("GET", "OPTIONS")
	api.HandleFunc("/products/{id}/properties", handler.GetProductProperties).Methods("GET", "OPTIONS")
	api.HandleFunc("/products/{id}/characteristics", handler.GetProductCharacteristics).Methods("GET", "OPTIONS")
	api.HandleFunc("/products/{id}/variants", handler.GetProductVariants).Methods("GET", "OPTIONS")

	// Search
	api.HandleFunc("/search", handler.SearchProducts).Methods("GET", "OPTIONS")

	// Sync logs and progress
	api.HandleFunc("/sync/logs", handler.ListSyncLogs).Methods("GET", "OPTIONS")
	api.HandleFunc("/sync/logs/{id}", handler.GetSyncLog).Methods("GET", "OPTIONS")
	api.HandleFunc("/sync/status", handler.GetLatestSyncStatus).Methods("GET", "OPTIONS")
	api.HandleFunc("/sync/progress", handler.GetSyncProgress).Methods("GET", "OPTIONS")

	// Selective sync configuration management (specific routes before parameterized)
	api.HandleFunc("/sync/configs", handler.CreateSyncConfig).Methods("POST", "OPTIONS")
	api.HandleFunc("/sync/configs", handler.ListSyncConfigs).Methods("GET", "OPTIONS")
	api.HandleFunc("/sync/configs/{id}", handler.GetSyncConfig).Methods("GET", "OPTIONS")
	api.HandleFunc("/sync/configs/{id}", handler.UpdateSyncConfig).Methods("PUT", "OPTIONS")
	api.HandleFunc("/sync/configs/{id}", handler.DeleteSyncConfig).Methods("DELETE", "OPTIONS")

	// Selective sync execution and validation
	api.HandleFunc("/sync/selective", handler.ExecuteSelectiveSync).Methods("POST", "OPTIONS")
	api.HandleFunc("/sync/validate", handler.ValidateSyncConfig).Methods("POST", "OPTIONS")
	api.HandleFunc("/sync/schemas", handler.GetFieldSchemas).Methods("GET", "OPTIONS")

	// Sync change tracking (specific routes before parameterized)
	api.HandleFunc("/sync/{id}/changes", handler.GetSyncChanges).Methods("GET", "OPTIONS")
	api.HandleFunc("/sync/{id}/summary", handler.GetChangeSummary).Methods("GET", "OPTIONS")

	// CRUD operations - Products (bulk routes must come before {id} routes)
	api.HandleFunc("/products", handler.CreateProduct).Methods("POST", "OPTIONS")
	api.HandleFunc("/products/bulk", handler.BulkUpdateProducts).Methods("PATCH", "OPTIONS")
	api.HandleFunc("/products/bulk", handler.BulkDeleteProducts).Methods("DELETE", "OPTIONS")
	api.HandleFunc("/products/{id}", handler.UpdateProduct).Methods("PUT", "OPTIONS")
	api.HandleFunc("/products/{id}", handler.DeleteProduct).Methods("DELETE", "OPTIONS")


	// Export endpoints
	api.HandleFunc("/export/products", handler.ExportProducts).Methods("GET", "OPTIONS")
	api.HandleFunc("/export/brands", handler.ExportBrands).Methods("GET", "OPTIONS")
	api.HandleFunc("/export/categories", handler.ExportCategories).Methods("GET", "OPTIONS")

	// Dashboard endpoints
	api.HandleFunc("/dashboard/stats", handler.GetDashboardStats).Methods("GET", "OPTIONS")
	api.HandleFunc("/dashboard/stock-summary", handler.GetStockSummary).Methods("GET", "OPTIONS")
	api.HandleFunc("/dashboard/price-summary", handler.GetPriceSummary).Methods("GET", "OPTIONS")

	// Config endpoint
	api.HandleFunc("/config", handler.GetConfig).Methods("GET", "OPTIONS")

	// Health check
	router.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	}).Methods("GET", "OPTIONS")

	// Root endpoint
	router.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{
			"service": "Ultra Data API",
			"version": "2.0.0",
			"database": "ultra-data",
			"endpoints": {
				"brands": "/api/v1/brands",
				"categories": "/api/v1/categories",
				"products": "/api/v1/products",
				"search": "/api/v1/search?q={query}",
				"health": "/health"
			}
		}`))
	}).Methods("GET", "OPTIONS")

	return router
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
		w.Header().Set("Access-Control-Max-Age", "86400")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		// Call next handler
		next.ServeHTTP(w, r)

		// Log request
		duration := time.Since(start)
		log.Printf("%s %s %v", r.Method, r.RequestURI, duration)
	})
}

func displayStatistics(repo *repository.Repository) {
	pool := repo.Pool()
	ctx := context.Background()

	var brandCount, categoryCount, productCount int
	var productsWithPrices, productsInStock int
	var propertyCount, characteristicCount int

	pool.QueryRow(ctx, "SELECT COUNT(*) FROM brands").Scan(&brandCount)
	pool.QueryRow(ctx, "SELECT COUNT(*) FROM categories").Scan(&categoryCount)
	pool.QueryRow(ctx, "SELECT COUNT(*) FROM products").Scan(&productCount)
	pool.QueryRow(ctx, "SELECT COUNT(*) FROM products WHERE price_min IS NOT NULL").Scan(&productsWithPrices)
	pool.QueryRow(ctx, "SELECT COUNT(*) FROM products WHERE is_in_stock = true").Scan(&productsInStock)
	pool.QueryRow(ctx, "SELECT COUNT(*) FROM properties").Scan(&propertyCount)
	pool.QueryRow(ctx, "SELECT COUNT(*) FROM characteristics").Scan(&characteristicCount)

	fmt.Println()
	fmt.Println("DATABASE STATISTICS:")
	fmt.Println("--------------------------------------------------------------------------------")
	fmt.Printf("Brands:          %d\n", brandCount)
	fmt.Printf("Categories:      %d\n", categoryCount)
	fmt.Printf("Products:        %d\n", productCount)
	if productCount > 0 {
		fmt.Printf("  - With prices: %d (%.1f%%)\n", productsWithPrices, float64(productsWithPrices)/float64(productCount)*100)
		fmt.Printf("  - In stock:    %d (%.1f%%)\n", productsInStock, float64(productsInStock)/float64(productCount)*100)
	}
	fmt.Printf("Properties:      %d\n", propertyCount)
	fmt.Printf("Characteristics: %d\n", characteristicCount)
}
