package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
	"ultra-api-testing/internal/config"
	"ultra-api-testing/internal/database"
	"ultra-api-testing/internal/handlers"
	"ultra-api-testing/internal/models"
	"ultra-api-testing/internal/repository"
	internalSync "ultra-api-testing/internal/sync"
	"ultra-api-testing/internal/ollama"
	"ultra-api-testing/internal/ultra"
	"ultra-api-testing/internal/variants"
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

	// Create sync manager (for cancellation support)
	syncManager := internalSync.NewSyncManager()
	defer syncManager.Shutdown()

	// Create repositories and handlers
	repo := repository.New(db.Pool)
	syncConfigRepo := repository.NewSyncConfigRepository(db.Pool)
	realtimeSyncRepo := repository.NewRealtimeSyncRepository(db.Pool)
	sourceRepo := repository.NewSourceRepository(db.Pool)
	translationRepo := repository.NewTranslationRepository(db.Pool)
	scheduleRepo := repository.NewScheduleRepository(db.Pool)
	performanceRepo := repository.NewPerformanceRepository(db.Pool)
	filterRepo := repository.NewFilterRepository(db.Pool)
	promotionRepo := repository.NewPromotionRepository(db.Pool)

	// Create variant repository early so it can be passed to main handler
	variantRepo := variants.NewRepository(db.Pool)

	handler := handlers.New(repo, promotionRepo, syncConfigRepo, fetcher, syncManager, variantRepo)
	realtimeSyncHandler := handlers.NewRealtimeSyncHandlers(realtimeSyncRepo, repo)
	syncControlHandler := handlers.NewSyncControlHandlers(repo, realtimeSyncRepo, syncManager)
	sourceHandler := handlers.NewSourceHandler(sourceRepo)
	translationHandler := handlers.NewTranslationHandler(translationRepo, cfg.LibreTranslate.URL)
	performanceHandler := handlers.NewPerformanceHandler(performanceRepo)
	filterHandler := handlers.NewFilterHandler(filterRepo)
	promotionHandler := handlers.NewPromotionHandler(promotionRepo, repo)

	// Initialize Ollama client for AI-powered variant grouping
	ollamaClient := ollama.NewClient(ollama.Config{
		URL:     cfg.Ollama.URL,
		Model:   cfg.Ollama.Model,
		Timeout: cfg.Ollama.Timeout,
	})

	// Check Ollama availability
	ollamaCtx, ollamaCancel := context.WithTimeout(ctx, 5*time.Second)
	if ollamaClient.IsAvailable(ollamaCtx) {
		fmt.Printf("Ollama AI connected: %s (model: %s)\n", cfg.Ollama.URL, cfg.Ollama.Model)
	} else {
		fmt.Printf("Warning: Ollama AI not available at %s - variant grouping will use exact name matching\n", cfg.Ollama.URL)
	}
	ollamaCancel()

	// Initialize variant generation components with Ollama AI support
	variantGenerator := variants.NewGenerator(variantRepo, ollamaClient)
	variantHandler := handlers.NewVariantHandler(variantGenerator, variantRepo)
	defer variantGenerator.Shutdown()

	// Create selective sync for scheduler
	selectiveSync := internalSync.NewSelectiveSync(repo, syncConfigRepo, fetcher, syncManager)

	// Create scheduler with execute callback that triggers actual syncs
	schedulerConfig := &internalSync.SchedulerConfig{
		ExecuteCallback: func(ctx context.Context, schedule *models.SyncSchedule, config *models.SyncConfiguration) error {
			// Convert SyncConfiguration to SelectiveSyncRequest
			request := &models.SelectiveSyncRequest{
				SelectedSteps:   config.SelectedSteps,
				FieldConfig:     config.FieldConfig,
				ConfigurationID: &config.ID,
			}

			log.Printf("Scheduler: Executing sync for schedule %s with config %s (steps: %v)",
				schedule.Name, config.Name, config.SelectedSteps)

			// Execute the selective sync
			result, err := selectiveSync.ExecuteSelectiveSync(ctx, request)
			if err != nil {
				return fmt.Errorf("scheduled sync failed: %w", err)
			}

			log.Printf("Scheduler: Sync completed for schedule %s - %d total changes in %v",
				schedule.Name, result.TotalChanges, result.Duration)

			return nil
		},
	}
	scheduler := internalSync.NewScheduler(scheduleRepo, syncConfigRepo, schedulerConfig)

	// Start scheduler if ENABLE_SCHEDULER env var is set
	if os.Getenv("ENABLE_SCHEDULER") == "true" {
		scheduler.Start()
		defer scheduler.Stop()

		// Recalculate next run times for all active schedules on startup
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			if count, err := scheduler.RecalculateNextRuns(ctx); err != nil {
				log.Printf("Warning: Failed to recalculate schedule next runs: %v", err)
			} else {
				log.Printf("Recalculated next run times for %d schedules", count)
			}
		}()
	}

	scheduleHandler := handlers.NewScheduleHandler(scheduleRepo, syncConfigRepo, scheduler)

	// Setup router
	router := setupRouter(handler, realtimeSyncHandler, syncControlHandler, sourceHandler, translationHandler, scheduleHandler, performanceHandler, filterHandler, variantHandler, promotionHandler)

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
	// NOTE: WriteTimeout set to 0 (infinite) to support very long-running sync operations (properties can take 40+ minutes)
	// ReadTimeout also disabled to allow long request bodies if needed
	srv := &http.Server{
		Addr:         port,
		Handler:      router,
		ReadTimeout:  0, // Disabled for long operations
		WriteTimeout: 0, // Disabled - some syncs take 40+ minutes
		IdleTimeout:  120 * time.Second,
	}

	log.Fatal(srv.ListenAndServe())
}

func setupRouter(handler *handlers.Handler, realtimeSyncHandler *handlers.RealtimeSyncHandlers, syncControlHandler *handlers.SyncControlHandlers, sourceHandler *handlers.SourceHandler, translationHandler *handlers.TranslationHandler, scheduleHandler *handlers.ScheduleHandler, performanceHandler *handlers.PerformanceHandler, filterHandler *handlers.FilterHandler, variantHandler *handlers.VariantHandler, promotionHandler *handlers.PromotionHandler) *mux.Router {
	router := mux.NewRouter()

	// Add middleware FIRST (before routes)
	router.Use(corsMiddleware)
	router.Use(loggingMiddleware)

	// API v1 routes
	api := router.PathPrefix("/api/v1").Subrouter()

	// Product Sources (specific routes before parameterized routes)
	api.HandleFunc("/sources", sourceHandler.ListSources).Methods("GET", "OPTIONS")
	api.HandleFunc("/sources", sourceHandler.CreateSource).Methods("POST", "OPTIONS")
	api.HandleFunc("/sources/default", sourceHandler.GetDefaultSource).Methods("GET", "OPTIONS")
	api.HandleFunc("/sources/{id}", sourceHandler.GetSource).Methods("GET", "OPTIONS")
	api.HandleFunc("/sources/{id}", sourceHandler.DeleteSource).Methods("DELETE", "OPTIONS")

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
	api.HandleFunc("/products/{id}/variants", variantHandler.GetProductVariants).Methods("GET", "OPTIONS")

	// Properties (specific routes before parameterized routes)
	api.HandleFunc("/properties/bulk", handler.BulkUpdateProperties).Methods("PATCH", "OPTIONS")
	api.HandleFunc("/properties/bulk", handler.BulkDeleteProperties).Methods("DELETE", "OPTIONS")
	api.HandleFunc("/properties/stats", handler.GetPropertyStats).Methods("GET", "OPTIONS")
	api.HandleFunc("/properties/groups", handler.GetPropertyGroups).Methods("GET", "OPTIONS")
	api.HandleFunc("/properties", handler.ListProperties).Methods("GET", "OPTIONS")
	api.HandleFunc("/properties", handler.CreateProperty).Methods("POST", "OPTIONS")
	api.HandleFunc("/properties/{id}", handler.GetProperty).Methods("GET", "OPTIONS")
	api.HandleFunc("/properties/{id}", handler.UpdateProperty).Methods("PUT", "OPTIONS")
	api.HandleFunc("/properties/{id}", handler.DeleteProperty).Methods("DELETE", "OPTIONS")

	// Property Hierarchy (Level 1: Groups)
	api.HandleFunc("/properties/hierarchy/groups", handler.ListPropertyGroups).Methods("GET", "OPTIONS")
	api.HandleFunc("/properties/hierarchy/groups/{group_name}", handler.GetPropertyGroup).Methods("GET", "OPTIONS")
	api.HandleFunc("/properties/hierarchy/groups/{group_name}", handler.DeletePropertyGroup).Methods("DELETE", "OPTIONS")
	api.HandleFunc("/properties/hierarchy/groups/{group_name}/impact", handler.GetGroupDeletionImpact).Methods("GET", "OPTIONS")

	// Property Hierarchy (Level 2: Property Names)
	api.HandleFunc("/properties/hierarchy/groups/{group_name}/properties", handler.ListPropertyNames).Methods("GET", "OPTIONS")
	api.HandleFunc("/properties/hierarchy/groups/{group_name}/properties/{property_name}", handler.GetPropertyName).Methods("GET", "OPTIONS")
	api.HandleFunc("/properties/hierarchy/groups/{group_name}/properties/{property_name}", handler.DeletePropertyName).Methods("DELETE", "OPTIONS")
	api.HandleFunc("/properties/hierarchy/groups/{group_name}/properties/{property_name}/impact", handler.GetPropertyNameDeletionImpact).Methods("GET", "OPTIONS")

	// Property Hierarchy (Level 3: Values)
	api.HandleFunc("/properties/hierarchy/groups/{group_name}/properties/{property_name}/values", handler.ListPropertyValues).Methods("GET", "OPTIONS")
	api.HandleFunc("/properties/hierarchy/groups/{group_name}/properties/{property_name}/values/bulk", handler.BulkUpdatePropertyValues).Methods("PATCH", "OPTIONS")
	api.HandleFunc("/properties/hierarchy/groups/{group_name}/properties/{property_name}/values/bulk", handler.BulkDeletePropertyValues).Methods("DELETE", "OPTIONS")
	api.HandleFunc("/properties/hierarchy/values/{value_id}", handler.UpdatePropertyValue).Methods("PUT", "OPTIONS")
	api.HandleFunc("/properties/hierarchy/values/{value_id}", handler.DeletePropertyValue).Methods("DELETE", "OPTIONS")

	// Search
	api.HandleFunc("/search", handler.SearchProducts).Methods("GET", "OPTIONS")

	// Sync logs and progress
	api.HandleFunc("/sync/logs", handler.ListSyncLogs).Methods("GET", "OPTIONS")
	api.HandleFunc("/sync/logs/{id}", handler.GetSyncLog).Methods("GET", "OPTIONS")
	api.HandleFunc("/sync/status", handler.GetLatestSyncStatus).Methods("GET", "OPTIONS")
	api.HandleFunc("/sync/progress", handler.GetSyncProgress).Methods("GET", "OPTIONS")

	// Real-time sync monitoring (SSE streams)
	api.HandleFunc("/sync/stream/progress", realtimeSyncHandler.StreamSyncProgress).Methods("GET", "OPTIONS")
	api.HandleFunc("/sync/stream/logs", realtimeSyncHandler.StreamSyncLogs).Methods("GET", "OPTIONS")

	// Real-time sync data endpoints
	api.HandleFunc("/sync/realtime/progress", realtimeSyncHandler.GetRealtimeProgress).Methods("GET", "OPTIONS")
	api.HandleFunc("/sync/realtime/progress/{sync_log_id}", realtimeSyncHandler.GetRealtimeProgress).Methods("GET", "OPTIONS")
	api.HandleFunc("/sync/realtime/logs", realtimeSyncHandler.GetLogEntries).Methods("GET", "OPTIONS")
	api.HandleFunc("/sync/realtime/logs/export", realtimeSyncHandler.ExportLogEntries).Methods("GET", "OPTIONS")
	api.HandleFunc("/sync/realtime/snapshots", realtimeSyncHandler.GetProgressSnapshots).Methods("GET", "OPTIONS")
	api.HandleFunc("/sync/realtime/api-requests", realtimeSyncHandler.GetAPIRequests).Methods("GET", "OPTIONS")

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

	// Sync control endpoints (cancel and status management)
	api.HandleFunc("/sync/{id}/cancel", syncControlHandler.CancelRunningSync).Methods("POST", "OPTIONS")
	api.HandleFunc("/sync/{id}/status", syncControlHandler.UpdateSyncStatus).Methods("PATCH", "OPTIONS")

	// Sync schedules (specific routes before parameterized routes)
	api.HandleFunc("/sync/schedules", scheduleHandler.ListSchedules).Methods("GET", "OPTIONS")
	api.HandleFunc("/sync/schedules", scheduleHandler.CreateSchedule).Methods("POST", "OPTIONS")
	api.HandleFunc("/sync/schedules/{id}", scheduleHandler.GetSchedule).Methods("GET", "OPTIONS")
	api.HandleFunc("/sync/schedules/{id}", scheduleHandler.UpdateSchedule).Methods("PUT", "OPTIONS")
	api.HandleFunc("/sync/schedules/{id}", scheduleHandler.DeleteSchedule).Methods("DELETE", "OPTIONS")
	api.HandleFunc("/sync/schedules/{id}/toggle", scheduleHandler.ToggleSchedule).Methods("POST", "OPTIONS")
	api.HandleFunc("/sync/schedules/{id}/runs", scheduleHandler.ListScheduleRuns).Methods("GET", "OPTIONS")
	api.HandleFunc("/sync/schedules/{id}/test", scheduleHandler.TestSchedule).Methods("POST", "OPTIONS")
	api.HandleFunc("/sync/scheduler/status", scheduleHandler.GetSchedulerStatus).Methods("GET", "OPTIONS")

	// Sync entity filters (specific routes before parameterized routes)
	api.HandleFunc("/sync/filters", filterHandler.ListFilters).Methods("GET", "OPTIONS")
	api.HandleFunc("/sync/filters", filterHandler.CreateFilter).Methods("POST", "OPTIONS")
	api.HandleFunc("/sync/filters/entity-types", filterHandler.GetEntityTypes).Methods("GET", "OPTIONS")
	api.HandleFunc("/sync/filters/active", filterHandler.GetActiveFilters).Methods("GET", "OPTIONS")
	api.HandleFunc("/sync/filters/by-entity/{entity_type}", filterHandler.GetFiltersByEntityType).Methods("GET", "OPTIONS")
	api.HandleFunc("/sync/filters/{id}", filterHandler.GetFilter).Methods("GET", "OPTIONS")
	api.HandleFunc("/sync/filters/{id}", filterHandler.UpdateFilter).Methods("PUT", "OPTIONS")
	api.HandleFunc("/sync/filters/{id}", filterHandler.DeleteFilter).Methods("DELETE", "OPTIONS")
	api.HandleFunc("/sync/filters/{id}/toggle", filterHandler.ToggleFilter).Methods("POST", "OPTIONS")
	api.HandleFunc("/sync/filters/{id}/test", filterHandler.TestFilter).Methods("POST", "OPTIONS")

	// Sync analytics (performance metrics)
	api.HandleFunc("/sync/analytics", performanceHandler.GetAnalyticsSummary).Methods("GET", "OPTIONS")
	api.HandleFunc("/sync/analytics/metrics", performanceHandler.GetMetrics).Methods("GET", "OPTIONS")
	api.HandleFunc("/sync/analytics/metrics/{sync_log_id}", performanceHandler.GetMetricsBySyncLog).Methods("GET", "OPTIONS")
	api.HandleFunc("/sync/analytics/trends", performanceHandler.GetTrends).Methods("GET", "OPTIONS")
	api.HandleFunc("/sync/analytics/bottlenecks", performanceHandler.GetBottlenecks).Methods("GET", "OPTIONS")
	api.HandleFunc("/sync/analytics/by-step", performanceHandler.GetStatsByStep).Methods("GET", "OPTIONS")
	api.HandleFunc("/sync/analytics/throughput", performanceHandler.GetThroughputStats).Methods("GET", "OPTIONS")
	api.HandleFunc("/sync/analytics/aggregations", performanceHandler.GetAggregations).Methods("GET", "OPTIONS")
	api.HandleFunc("/sync/analytics/export", performanceHandler.ExportMetrics).Methods("GET", "OPTIONS")

	// CRUD operations - Products (bulk routes and /full routes must come before {id} routes)
	api.HandleFunc("/products", handler.CreateProduct).Methods("POST", "OPTIONS")
	api.HandleFunc("/products/bulk", handler.BulkUpdateProducts).Methods("PATCH", "OPTIONS")
	api.HandleFunc("/products/bulk", handler.BulkDeleteProducts).Methods("DELETE", "OPTIONS")
	api.HandleFunc("/products/{id}/full", handler.UpdateProductFull).Methods("PUT", "OPTIONS")
	api.HandleFunc("/products/{id}", handler.UpdateProduct).Methods("PUT", "OPTIONS")
	api.HandleFunc("/products/{id}", handler.DeleteProduct).Methods("DELETE", "OPTIONS")

	// File upload endpoints
	api.HandleFunc("/upload/image", handler.UploadImage).Methods("POST", "OPTIONS")
	api.HandleFunc("/upload/video", handler.UploadVideo).Methods("POST", "OPTIONS")
	api.HandleFunc("/upload/images", handler.UploadMultipleImages).Methods("POST", "OPTIONS")
	api.HandleFunc("/upload/image/{uuid}", handler.DeleteUploadedImage).Methods("DELETE", "OPTIONS")
	api.HandleFunc("/upload/video/{uuid}", handler.DeleteUploadedVideo).Methods("DELETE", "OPTIONS")
	api.HandleFunc("/upload/info/{type}/{uuid}", handler.GetUploadedFile).Methods("GET", "OPTIONS")

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

	// Translation endpoints
	api.HandleFunc("/translate/start", translationHandler.StartTranslation).Methods("POST", "OPTIONS")
	api.HandleFunc("/translate/jobs", translationHandler.ListTranslationJobs).Methods("GET", "OPTIONS")
	api.HandleFunc("/translate/jobs/{id}", translationHandler.GetTranslationJob).Methods("GET", "OPTIONS")
	api.HandleFunc("/translate/jobs/{id}/cancel", translationHandler.CancelTranslationJob).Methods("POST", "OPTIONS")
	api.HandleFunc("/translate/jobs/{id}/logs", translationHandler.GetTranslationLogs).Methods("GET", "OPTIONS")
	api.HandleFunc("/translate/stats", translationHandler.GetTranslationStats).Methods("GET", "OPTIONS")
	api.HandleFunc("/translate/stream/{id}", translationHandler.StreamTranslationProgress).Methods("GET", "OPTIONS")

	// Variant generation endpoints
	api.HandleFunc("/variants/generate", variantHandler.TriggerGeneration).Methods("POST", "OPTIONS")
	api.HandleFunc("/variants/status", variantHandler.GetGenerationStatus).Methods("GET", "OPTIONS")
	api.HandleFunc("/variants/stats", variantHandler.GetStats).Methods("GET", "OPTIONS")
	api.HandleFunc("/variants/jobs", variantHandler.ListJobs).Methods("GET", "OPTIONS")
	api.HandleFunc("/variants/jobs/{id}", variantHandler.GetJob).Methods("GET", "OPTIONS")
	api.HandleFunc("/variants/jobs/{id}/cancel", variantHandler.CancelJob).Methods("POST", "OPTIONS")
	api.HandleFunc("/variants/groups", variantHandler.ListGroups).Methods("GET", "OPTIONS")
	api.HandleFunc("/variants/groups/{id}", variantHandler.GetGroup).Methods("GET", "OPTIONS")
	api.HandleFunc("/variants/groups/{id}", variantHandler.DeleteGroup).Methods("DELETE", "OPTIONS")
	api.HandleFunc("/variants/stream/{id}", variantHandler.StreamProgress).Methods("GET", "OPTIONS")

	// Promotion endpoints
	api.HandleFunc("/promotions", promotionHandler.ListPromotions).Methods("GET", "OPTIONS")
	api.HandleFunc("/promotions", promotionHandler.CreatePromotion).Methods("POST", "OPTIONS")
	api.HandleFunc("/promotions/{id}", promotionHandler.GetPromotion).Methods("GET", "OPTIONS")
	api.HandleFunc("/promotions/{id}", promotionHandler.UpdatePromotion).Methods("PUT", "OPTIONS")
	api.HandleFunc("/promotions/{id}", promotionHandler.DeletePromotion).Methods("DELETE", "OPTIONS")
	api.HandleFunc("/promotions/{id}/toggle", promotionHandler.TogglePromotion).Methods("POST", "OPTIONS")
	api.HandleFunc("/promotions/{id}/products", promotionHandler.GetPromotionProducts).Methods("GET", "OPTIONS")
	api.HandleFunc("/promotions/{id}/products", promotionHandler.AddProductsToPromotion).Methods("POST", "OPTIONS")
	api.HandleFunc("/promotions/{id}/products", promotionHandler.RemoveProductsFromPromotion).Methods("DELETE", "OPTIONS")
	api.HandleFunc("/promotions/{id}/products/bulk", promotionHandler.BulkAddProductsByFilter).Methods("POST", "OPTIONS")

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

	// Serve static files from /uploads directory
	router.PathPrefix("/uploads/").Handler(
		http.StripPrefix("/uploads/", http.FileServer(http.Dir("./uploads"))))

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
	var propertyCount int

	pool.QueryRow(ctx, "SELECT COUNT(*) FROM brands").Scan(&brandCount)
	pool.QueryRow(ctx, "SELECT COUNT(*) FROM categories").Scan(&categoryCount)
	pool.QueryRow(ctx, "SELECT COUNT(*) FROM products").Scan(&productCount)
	pool.QueryRow(ctx, "SELECT COUNT(*) FROM products WHERE price_min IS NOT NULL").Scan(&productsWithPrices)
	pool.QueryRow(ctx, "SELECT COUNT(*) FROM products WHERE is_in_stock = true").Scan(&productsInStock)
	pool.QueryRow(ctx, "SELECT COUNT(*) FROM properties").Scan(&propertyCount)

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
}
