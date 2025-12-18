package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
	"ultra-api-testing/internal/auth"
	"ultra-api-testing/internal/config"
	"ultra-api-testing/internal/database"
	"ultra-api-testing/internal/handlers"
	"ultra-api-testing/internal/middleware"
	"ultra-api-testing/internal/models"
	"ultra-api-testing/internal/repository"
	"ultra-api-testing/internal/search"
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
	adminUserRepo := repository.NewAdminUserRepository(db.Pool)
	storeRepo := repository.NewStoreRepository(db.Pool)
	orderRepo := repository.NewOrderRepository(db.Pool)
	catalogRepo := repository.NewCatalogRepository(db.Pool)
	servicePackageTypeRepo := repository.NewServicePackageTypeRepository(db.Pool)
	servicePackageRepo := repository.NewServicePackageRepository(db.Pool)
	serviceOrderRepo := repository.NewServiceOrderRepository(db.Pool)

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
	authHandler := handlers.NewAuthHandler(adminUserRepo, cfg.JWT.Secret, cfg.JWT.Expiration)
	storeHandler := handlers.NewStoreHandler(storeRepo)
	orderHandler := handlers.NewOrderHandler(orderRepo)
	publicOrderHandler := handlers.NewPublicOrderHandler(orderRepo, storeRepo)
	publicHandler := handlers.NewPublicHandler(repo, promotionRepo, servicePackageTypeRepo, servicePackageRepo)
	catalogHandler := handlers.NewCatalogHandler(catalogRepo)
	servicePackageTypeHandler := handlers.NewServicePackageTypeHandler(servicePackageTypeRepo)
	servicePackageHandler := handlers.NewServicePackageHandler(servicePackageRepo)
	serviceOrderHandler := handlers.NewServiceOrderHandler(serviceOrderRepo)

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

	// Initialize Meilisearch smart search
	var searchHandler *handlers.SearchHandler
	searchClient, err := search.NewClient(cfg.Meilisearch)
	if err != nil {
		log.Printf("Warning: Meilisearch not available: %v", err)
		log.Println("Smart search endpoints will not be available")
	} else {
		fmt.Printf("Meilisearch connected: %s (index: %s)\n", cfg.Meilisearch.URL, cfg.Meilisearch.IndexName)
		searchIndexer := search.NewIndexer(searchClient, repo)
		searchService := search.NewService(searchClient)
		searchHandler = handlers.NewSearchHandler(searchService, searchIndexer, repo)
	}

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
	router := setupRouter(handler, realtimeSyncHandler, syncControlHandler, sourceHandler, translationHandler, scheduleHandler, performanceHandler, filterHandler, variantHandler, promotionHandler, searchHandler, authHandler, storeHandler, orderHandler, publicOrderHandler, publicHandler, catalogHandler, servicePackageTypeHandler, servicePackageHandler, serviceOrderHandler, cfg)

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

func setupRouter(handler *handlers.Handler, realtimeSyncHandler *handlers.RealtimeSyncHandlers, syncControlHandler *handlers.SyncControlHandlers, sourceHandler *handlers.SourceHandler, translationHandler *handlers.TranslationHandler, scheduleHandler *handlers.ScheduleHandler, performanceHandler *handlers.PerformanceHandler, filterHandler *handlers.FilterHandler, variantHandler *handlers.VariantHandler, promotionHandler *handlers.PromotionHandler, searchHandler *handlers.SearchHandler, authHandler *handlers.AuthHandler, storeHandler *handlers.StoreHandler, orderHandler *handlers.OrderHandler, publicOrderHandler *handlers.PublicOrderHandler, publicHandler *handlers.PublicHandler, catalogHandler *handlers.CatalogHandler, servicePackageTypeHandler *handlers.ServicePackageTypeHandler, servicePackageHandler *handlers.ServicePackageHandler, serviceOrderHandler *handlers.ServiceOrderHandler, cfg *config.Config) *mux.Router {
	router := mux.NewRouter()

	// Add middleware FIRST (before routes)
	// SECURITY: Use secure CORS with origin validation instead of wildcard
	router.Use(middleware.SecureCORS)
	// SECURITY: Add security headers to all responses
	router.Use(middleware.SecurityHeaders)
	router.Use(loggingMiddleware)

	// Create rate limiters
	loginLimiter := middleware.LoginRateLimiter()
	apiLimiter := middleware.APIRateLimiter()
	uploadLimiter := middleware.UploadRateLimiter()

	// API v1 routes
	api := router.PathPrefix("/api/v1").Subrouter()
	// Apply general API rate limiting
	api.Use(apiLimiter.Middleware)

	// ============================================================================
	// PUBLIC ROUTES - No Authentication Required
	// ============================================================================

	// Auth endpoints (public for login)
	// SECURITY: Apply strict rate limiting to login endpoint (5 attempts per 15 min)
	loginRouter := api.PathPrefix("/auth/login").Subrouter()
	loginRouter.Use(loginLimiter.Middleware)
	loginRouter.HandleFunc("", authHandler.Login).Methods("POST", "OPTIONS")
	api.HandleFunc("/auth/logout", authHandler.Logout).Methods("POST", "OPTIONS")

	// Create protected subrouter for /auth/me endpoint
	authProtected := api.PathPrefix("/auth").Subrouter()
	authProtected.Use(auth.RequireAuth(cfg.JWT.Secret))
	authProtected.HandleFunc("/me", authHandler.GetCurrentUser).Methods("GET", "OPTIONS")

	// Public GET routes - Product Sources
	api.HandleFunc("/sources", sourceHandler.ListSources).Methods("GET", "OPTIONS")
	api.HandleFunc("/sources/default", sourceHandler.GetDefaultSource).Methods("GET", "OPTIONS")
	api.HandleFunc("/sources/{id}", sourceHandler.GetSource).Methods("GET", "OPTIONS")

	// Protected routes - Product Sources (require auth)
	sourcesProtected := api.PathPrefix("/sources").Subrouter()
	sourcesProtected.Use(auth.RequireAuth(cfg.JWT.Secret))
	sourcesProtected.HandleFunc("", sourceHandler.CreateSource).Methods("POST", "OPTIONS")
	sourcesProtected.HandleFunc("/{id}", sourceHandler.DeleteSource).Methods("DELETE", "OPTIONS")

	// Public GET routes - Brands
	api.HandleFunc("/brands", handler.ListBrands).Methods("GET", "OPTIONS")
	api.HandleFunc("/brands/all", handler.GetAllBrands).Methods("GET", "OPTIONS")
	api.HandleFunc("/brands/{id}/stats", handler.GetBrandWithStats).Methods("GET", "OPTIONS")
	api.HandleFunc("/brands/{id}/products", handler.GetBrandProducts).Methods("GET", "OPTIONS")
	api.HandleFunc("/brands/{id}", handler.GetBrand).Methods("GET", "OPTIONS")

	// Protected routes - Brands (require auth)
	brandsProtected := api.PathPrefix("/brands").Subrouter()
	brandsProtected.Use(auth.RequireAuth(cfg.JWT.Secret))
	brandsProtected.HandleFunc("", handler.CreateBrand).Methods("POST", "OPTIONS")
	brandsProtected.HandleFunc("/bulk", handler.BulkUpdateBrands).Methods("PATCH", "OPTIONS")
	brandsProtected.HandleFunc("/{id}/products/bulk", handler.BulkUpdateBrandProducts).Methods("PATCH", "OPTIONS")
	brandsProtected.HandleFunc("/{id}", handler.UpdateBrand).Methods("PUT", "OPTIONS")
	brandsProtected.HandleFunc("/{id}", handler.DeleteBrand).Methods("DELETE", "OPTIONS")

	// Public GET routes - Categories
	api.HandleFunc("/categories", handler.ListCategories).Methods("GET", "OPTIONS")
	api.HandleFunc("/categories/all", handler.GetAllCategories).Methods("GET", "OPTIONS")
	api.HandleFunc("/categories/{id}/stats", handler.GetCategoryWithStats).Methods("GET", "OPTIONS")
	api.HandleFunc("/categories/{id}/products", handler.GetCategoryProducts).Methods("GET", "OPTIONS")
	api.HandleFunc("/categories/{id}/subcategories", handler.GetCategorySubcategories).Methods("GET", "OPTIONS")
	api.HandleFunc("/categories/{id}", handler.GetCategory).Methods("GET", "OPTIONS")

	// Protected routes - Categories (require auth)
	categoriesProtected := api.PathPrefix("/categories").Subrouter()
	categoriesProtected.Use(auth.RequireAuth(cfg.JWT.Secret))
	categoriesProtected.HandleFunc("", handler.CreateCategory).Methods("POST", "OPTIONS")
	categoriesProtected.HandleFunc("/bulk", handler.BulkUpdateCategories).Methods("PATCH", "OPTIONS")
	categoriesProtected.HandleFunc("/{id}/products/bulk", handler.BulkUpdateCategoryProducts).Methods("PATCH", "OPTIONS")
	categoriesProtected.HandleFunc("/{id}", handler.UpdateCategory).Methods("PUT", "OPTIONS")
	categoriesProtected.HandleFunc("/{id}", handler.DeleteCategory).Methods("DELETE", "OPTIONS")

	// Public GET routes - Products
	api.HandleFunc("/products", handler.ListProducts).Methods("GET", "OPTIONS")
	api.HandleFunc("/products/{id}", handler.GetProduct).Methods("GET", "OPTIONS")
	api.HandleFunc("/products/{id}/properties", handler.GetProductProperties).Methods("GET", "OPTIONS")
	api.HandleFunc("/products/{id}/variants", variantHandler.GetProductVariants).Methods("GET", "OPTIONS")

	// Public GET routes - Properties
	api.HandleFunc("/properties/stats", handler.GetPropertyStats).Methods("GET", "OPTIONS")
	api.HandleFunc("/properties/groups", handler.GetPropertyGroups).Methods("GET", "OPTIONS")
	api.HandleFunc("/properties", handler.ListProperties).Methods("GET", "OPTIONS")
	api.HandleFunc("/properties/{id}", handler.GetProperty).Methods("GET", "OPTIONS")

	// Protected routes - Properties (require auth)
	propertiesProtected := api.PathPrefix("/properties").Subrouter()
	propertiesProtected.Use(auth.RequireAuth(cfg.JWT.Secret))
	propertiesProtected.HandleFunc("/bulk", handler.BulkUpdateProperties).Methods("PATCH", "OPTIONS")
	propertiesProtected.HandleFunc("/bulk", handler.BulkDeleteProperties).Methods("DELETE", "OPTIONS")
	propertiesProtected.HandleFunc("", handler.CreateProperty).Methods("POST", "OPTIONS")
	propertiesProtected.HandleFunc("/{id}", handler.UpdateProperty).Methods("PUT", "OPTIONS")
	propertiesProtected.HandleFunc("/{id}", handler.DeleteProperty).Methods("DELETE", "OPTIONS")

	// Public GET routes - Property Hierarchy
	api.HandleFunc("/properties/hierarchy/groups", handler.ListPropertyGroups).Methods("GET", "OPTIONS")
	api.HandleFunc("/properties/hierarchy/groups/{group_name}", handler.GetPropertyGroup).Methods("GET", "OPTIONS")
	api.HandleFunc("/properties/hierarchy/groups/{group_name}/impact", handler.GetGroupDeletionImpact).Methods("GET", "OPTIONS")
	api.HandleFunc("/properties/hierarchy/groups/{group_name}/properties", handler.ListPropertyNames).Methods("GET", "OPTIONS")
	api.HandleFunc("/properties/hierarchy/groups/{group_name}/properties/{property_name}", handler.GetPropertyName).Methods("GET", "OPTIONS")
	api.HandleFunc("/properties/hierarchy/groups/{group_name}/properties/{property_name}/impact", handler.GetPropertyNameDeletionImpact).Methods("GET", "OPTIONS")
	api.HandleFunc("/properties/hierarchy/groups/{group_name}/properties/{property_name}/values", handler.ListPropertyValues).Methods("GET", "OPTIONS")

	// Protected routes - Property Hierarchy (require auth)
	propsHierarchyProtected := api.PathPrefix("/properties/hierarchy").Subrouter()
	propsHierarchyProtected.Use(auth.RequireAuth(cfg.JWT.Secret))
	propsHierarchyProtected.HandleFunc("/groups/{group_name}", handler.DeletePropertyGroup).Methods("DELETE", "OPTIONS")
	propsHierarchyProtected.HandleFunc("/groups/{group_name}/properties/{property_name}", handler.DeletePropertyName).Methods("DELETE", "OPTIONS")
	propsHierarchyProtected.HandleFunc("/groups/{group_name}/properties/{property_name}/values/bulk", handler.BulkUpdatePropertyValues).Methods("PATCH", "OPTIONS")
	propsHierarchyProtected.HandleFunc("/groups/{group_name}/properties/{property_name}/values/bulk", handler.BulkDeletePropertyValues).Methods("DELETE", "OPTIONS")
	propsHierarchyProtected.HandleFunc("/values/{value_id}", handler.UpdatePropertyValue).Methods("PUT", "OPTIONS")
	propsHierarchyProtected.HandleFunc("/values/{value_id}", handler.DeletePropertyValue).Methods("DELETE", "OPTIONS")

	// Public GET routes - Search
	api.HandleFunc("/search", handler.SearchProducts).Methods("GET", "OPTIONS")

	// Public GET routes - Catalog
	api.HandleFunc("/catalog", catalogHandler.GetFullCatalog).Methods("GET", "OPTIONS")
	api.HandleFunc("/catalog/{slug}", catalogHandler.GetCatalogBySlug).Methods("GET", "OPTIONS")
	api.HandleFunc("/catalog/items/{id}/products", catalogHandler.GetItemProducts).Methods("GET", "OPTIONS")

	// ============================================================================
	// PROTECTED ROUTES - ALL /sync/* endpoints require authentication
	// ============================================================================
	syncProtected := api.PathPrefix("/sync").Subrouter()
	syncProtected.Use(auth.RequireAuth(cfg.JWT.Secret))

	// Sync logs and progress
	syncProtected.HandleFunc("/logs", handler.ListSyncLogs).Methods("GET", "OPTIONS")
	syncProtected.HandleFunc("/logs/{id}", handler.GetSyncLog).Methods("GET", "OPTIONS")
	syncProtected.HandleFunc("/status", handler.GetLatestSyncStatus).Methods("GET", "OPTIONS")
	syncProtected.HandleFunc("/progress", handler.GetSyncProgress).Methods("GET", "OPTIONS")

	// Real-time sync monitoring (SSE streams)
	syncProtected.HandleFunc("/stream/progress", realtimeSyncHandler.StreamSyncProgress).Methods("GET", "OPTIONS")
	syncProtected.HandleFunc("/stream/logs", realtimeSyncHandler.StreamSyncLogs).Methods("GET", "OPTIONS")

	// Real-time sync data endpoints
	syncProtected.HandleFunc("/realtime/progress", realtimeSyncHandler.GetRealtimeProgress).Methods("GET", "OPTIONS")
	syncProtected.HandleFunc("/realtime/progress/{sync_log_id}", realtimeSyncHandler.GetRealtimeProgress).Methods("GET", "OPTIONS")
	syncProtected.HandleFunc("/realtime/logs", realtimeSyncHandler.GetLogEntries).Methods("GET", "OPTIONS")
	syncProtected.HandleFunc("/realtime/logs/export", realtimeSyncHandler.ExportLogEntries).Methods("GET", "OPTIONS")
	syncProtected.HandleFunc("/realtime/snapshots", realtimeSyncHandler.GetProgressSnapshots).Methods("GET", "OPTIONS")
	syncProtected.HandleFunc("/realtime/api-requests", realtimeSyncHandler.GetAPIRequests).Methods("GET", "OPTIONS")

	// Selective sync configuration management
	syncProtected.HandleFunc("/configs", handler.CreateSyncConfig).Methods("POST", "OPTIONS")
	syncProtected.HandleFunc("/configs", handler.ListSyncConfigs).Methods("GET", "OPTIONS")
	syncProtected.HandleFunc("/configs/{id}", handler.GetSyncConfig).Methods("GET", "OPTIONS")
	syncProtected.HandleFunc("/configs/{id}", handler.UpdateSyncConfig).Methods("PUT", "OPTIONS")
	syncProtected.HandleFunc("/configs/{id}", handler.DeleteSyncConfig).Methods("DELETE", "OPTIONS")

	// Selective sync execution and validation
	syncProtected.HandleFunc("/selective", handler.ExecuteSelectiveSync).Methods("POST", "OPTIONS")
	syncProtected.HandleFunc("/validate", handler.ValidateSyncConfig).Methods("POST", "OPTIONS")
	syncProtected.HandleFunc("/schemas", handler.GetFieldSchemas).Methods("GET", "OPTIONS")

	// Sync change tracking
	syncProtected.HandleFunc("/{id}/changes", handler.GetSyncChanges).Methods("GET", "OPTIONS")
	syncProtected.HandleFunc("/{id}/summary", handler.GetChangeSummary).Methods("GET", "OPTIONS")

	// Sync control endpoints (cancel and status management)
	syncProtected.HandleFunc("/{id}/cancel", syncControlHandler.CancelRunningSync).Methods("POST", "OPTIONS")
	syncProtected.HandleFunc("/{id}/status", syncControlHandler.UpdateSyncStatus).Methods("PATCH", "OPTIONS")

	// Sync schedules
	syncProtected.HandleFunc("/schedules", scheduleHandler.ListSchedules).Methods("GET", "OPTIONS")
	syncProtected.HandleFunc("/schedules", scheduleHandler.CreateSchedule).Methods("POST", "OPTIONS")
	syncProtected.HandleFunc("/schedules/{id}", scheduleHandler.GetSchedule).Methods("GET", "OPTIONS")
	syncProtected.HandleFunc("/schedules/{id}", scheduleHandler.UpdateSchedule).Methods("PUT", "OPTIONS")
	syncProtected.HandleFunc("/schedules/{id}", scheduleHandler.DeleteSchedule).Methods("DELETE", "OPTIONS")
	syncProtected.HandleFunc("/schedules/{id}/toggle", scheduleHandler.ToggleSchedule).Methods("POST", "OPTIONS")
	syncProtected.HandleFunc("/schedules/{id}/runs", scheduleHandler.ListScheduleRuns).Methods("GET", "OPTIONS")
	syncProtected.HandleFunc("/schedules/{id}/test", scheduleHandler.TestSchedule).Methods("POST", "OPTIONS")
	syncProtected.HandleFunc("/scheduler/status", scheduleHandler.GetSchedulerStatus).Methods("GET", "OPTIONS")

	// Sync entity filters
	syncProtected.HandleFunc("/filters", filterHandler.ListFilters).Methods("GET", "OPTIONS")
	syncProtected.HandleFunc("/filters", filterHandler.CreateFilter).Methods("POST", "OPTIONS")
	syncProtected.HandleFunc("/filters/entity-types", filterHandler.GetEntityTypes).Methods("GET", "OPTIONS")
	syncProtected.HandleFunc("/filters/active", filterHandler.GetActiveFilters).Methods("GET", "OPTIONS")
	syncProtected.HandleFunc("/filters/by-entity/{entity_type}", filterHandler.GetFiltersByEntityType).Methods("GET", "OPTIONS")
	syncProtected.HandleFunc("/filters/{id}", filterHandler.GetFilter).Methods("GET", "OPTIONS")
	syncProtected.HandleFunc("/filters/{id}", filterHandler.UpdateFilter).Methods("PUT", "OPTIONS")
	syncProtected.HandleFunc("/filters/{id}", filterHandler.DeleteFilter).Methods("DELETE", "OPTIONS")
	syncProtected.HandleFunc("/filters/{id}/toggle", filterHandler.ToggleFilter).Methods("POST", "OPTIONS")
	syncProtected.HandleFunc("/filters/{id}/test", filterHandler.TestFilter).Methods("POST", "OPTIONS")

	// Sync analytics (performance metrics)
	syncProtected.HandleFunc("/analytics", performanceHandler.GetAnalyticsSummary).Methods("GET", "OPTIONS")
	syncProtected.HandleFunc("/analytics/metrics", performanceHandler.GetMetrics).Methods("GET", "OPTIONS")
	syncProtected.HandleFunc("/analytics/metrics/{sync_log_id}", performanceHandler.GetMetricsBySyncLog).Methods("GET", "OPTIONS")
	syncProtected.HandleFunc("/analytics/trends", performanceHandler.GetTrends).Methods("GET", "OPTIONS")
	syncProtected.HandleFunc("/analytics/bottlenecks", performanceHandler.GetBottlenecks).Methods("GET", "OPTIONS")
	syncProtected.HandleFunc("/analytics/by-step", performanceHandler.GetStatsByStep).Methods("GET", "OPTIONS")
	syncProtected.HandleFunc("/analytics/throughput", performanceHandler.GetThroughputStats).Methods("GET", "OPTIONS")
	syncProtected.HandleFunc("/analytics/aggregations", performanceHandler.GetAggregations).Methods("GET", "OPTIONS")
	syncProtected.HandleFunc("/analytics/export", performanceHandler.ExportMetrics).Methods("GET", "OPTIONS")

	// ============================================================================
	// PROTECTED ROUTES - Product CRUD operations (require auth)
	// ============================================================================
	productsProtected := api.PathPrefix("/products").Subrouter()
	productsProtected.Use(auth.RequireAuth(cfg.JWT.Secret))
	productsProtected.HandleFunc("", handler.CreateProduct).Methods("POST", "OPTIONS")
	productsProtected.HandleFunc("/bulk", handler.BulkUpdateProducts).Methods("PATCH", "OPTIONS")
	productsProtected.HandleFunc("/bulk", handler.BulkDeleteProducts).Methods("DELETE", "OPTIONS")
	productsProtected.HandleFunc("/{id}/full", handler.UpdateProductFull).Methods("PUT", "OPTIONS")
	productsProtected.HandleFunc("/{id}", handler.UpdateProduct).Methods("PUT", "OPTIONS")
	productsProtected.HandleFunc("/{id}", handler.DeleteProduct).Methods("DELETE", "OPTIONS")

	// ============================================================================
	// PROTECTED ROUTES - ALL /upload/* endpoints require authentication
	// ============================================================================
	uploadProtected := api.PathPrefix("/upload").Subrouter()
	uploadProtected.Use(auth.RequireAuth(cfg.JWT.Secret))
	// SECURITY: Apply upload rate limiting (20 uploads per minute)
	uploadProtected.Use(uploadLimiter.Middleware)
	uploadProtected.HandleFunc("/image", handler.UploadImage).Methods("POST", "OPTIONS")
	uploadProtected.HandleFunc("/video", handler.UploadVideo).Methods("POST", "OPTIONS")
	uploadProtected.HandleFunc("/images", handler.UploadMultipleImages).Methods("POST", "OPTIONS")
	uploadProtected.HandleFunc("/image/{uuid}", handler.DeleteUploadedImage).Methods("DELETE", "OPTIONS")
	uploadProtected.HandleFunc("/video/{uuid}", handler.DeleteUploadedVideo).Methods("DELETE", "OPTIONS")
	uploadProtected.HandleFunc("/info/{type}/{uuid}", handler.GetUploadedFile).Methods("GET", "OPTIONS")

	// Public routes - Export endpoints (no auth required for data exports)
	api.HandleFunc("/export/products", handler.ExportProducts).Methods("GET", "OPTIONS")
	api.HandleFunc("/export/brands", handler.ExportBrands).Methods("GET", "OPTIONS")
	api.HandleFunc("/export/categories", handler.ExportCategories).Methods("GET", "OPTIONS")

	// ============================================================================
	// PROTECTED ROUTES - ALL /dashboard/* endpoints require authentication
	// ============================================================================
	dashboardProtected := api.PathPrefix("/dashboard").Subrouter()
	dashboardProtected.Use(auth.RequireAuth(cfg.JWT.Secret))
	dashboardProtected.HandleFunc("/stats", handler.GetDashboardStats).Methods("GET", "OPTIONS")
	dashboardProtected.HandleFunc("/stock-summary", handler.GetStockSummary).Methods("GET", "OPTIONS")
	dashboardProtected.HandleFunc("/price-summary", handler.GetPriceSummary).Methods("GET", "OPTIONS")

	// Public route - Config endpoint
	api.HandleFunc("/config", handler.GetConfig).Methods("GET", "OPTIONS")

	// ============================================================================
	// PROTECTED ROUTES - ALL /translate/* endpoints require authentication
	// ============================================================================
	translateProtected := api.PathPrefix("/translate").Subrouter()
	translateProtected.Use(auth.RequireAuth(cfg.JWT.Secret))
	translateProtected.HandleFunc("/start", translationHandler.StartTranslation).Methods("POST", "OPTIONS")
	translateProtected.HandleFunc("/jobs", translationHandler.ListTranslationJobs).Methods("GET", "OPTIONS")
	translateProtected.HandleFunc("/jobs/{id}", translationHandler.GetTranslationJob).Methods("GET", "OPTIONS")
	translateProtected.HandleFunc("/jobs/{id}/cancel", translationHandler.CancelTranslationJob).Methods("POST", "OPTIONS")
	translateProtected.HandleFunc("/jobs/{id}/logs", translationHandler.GetTranslationLogs).Methods("GET", "OPTIONS")
	translateProtected.HandleFunc("/stats", translationHandler.GetTranslationStats).Methods("GET", "OPTIONS")
	translateProtected.HandleFunc("/stream/{id}", translationHandler.StreamTranslationProgress).Methods("GET", "OPTIONS")

	// Public GET routes - Variants
	api.HandleFunc("/variants/status", variantHandler.GetGenerationStatus).Methods("GET", "OPTIONS")
	api.HandleFunc("/variants/stats", variantHandler.GetStats).Methods("GET", "OPTIONS")
	api.HandleFunc("/variants/jobs", variantHandler.ListJobs).Methods("GET", "OPTIONS")
	api.HandleFunc("/variants/jobs/{id}", variantHandler.GetJob).Methods("GET", "OPTIONS")
	api.HandleFunc("/variants/groups", variantHandler.ListGroups).Methods("GET", "OPTIONS")
	api.HandleFunc("/variants/groups/{id}", variantHandler.GetGroup).Methods("GET", "OPTIONS")
	api.HandleFunc("/variants/stream/{id}", variantHandler.StreamProgress).Methods("GET", "OPTIONS")

	// Protected routes - Variants (require auth)
	variantsProtected := api.PathPrefix("/variants").Subrouter()
	variantsProtected.Use(auth.RequireAuth(cfg.JWT.Secret))
	variantsProtected.HandleFunc("/generate", variantHandler.TriggerGeneration).Methods("POST", "OPTIONS")
	variantsProtected.HandleFunc("/jobs/{id}/cancel", variantHandler.CancelJob).Methods("POST", "OPTIONS")
	variantsProtected.HandleFunc("/groups/{id}", variantHandler.DeleteGroup).Methods("DELETE", "OPTIONS")

	// Public GET routes - Promotions
	api.HandleFunc("/promotions", promotionHandler.ListPromotions).Methods("GET", "OPTIONS")
	api.HandleFunc("/promotions/{id}", promotionHandler.GetPromotion).Methods("GET", "OPTIONS")
	api.HandleFunc("/promotions/{id}/products", promotionHandler.GetPromotionProducts).Methods("GET", "OPTIONS")

	// Protected routes - Promotions (require auth)
	promotionsProtected := api.PathPrefix("/promotions").Subrouter()
	promotionsProtected.Use(auth.RequireAuth(cfg.JWT.Secret))
	promotionsProtected.HandleFunc("", promotionHandler.CreatePromotion).Methods("POST", "OPTIONS")
	promotionsProtected.HandleFunc("/{id}", promotionHandler.UpdatePromotion).Methods("PUT", "OPTIONS")
	promotionsProtected.HandleFunc("/{id}", promotionHandler.DeletePromotion).Methods("DELETE", "OPTIONS")
	promotionsProtected.HandleFunc("/{id}/toggle", promotionHandler.TogglePromotion).Methods("POST", "OPTIONS")
	promotionsProtected.HandleFunc("/{id}/products", promotionHandler.AddProductsToPromotion).Methods("POST", "OPTIONS")
	promotionsProtected.HandleFunc("/{id}/products", promotionHandler.RemoveProductsFromPromotion).Methods("DELETE", "OPTIONS")
	promotionsProtected.HandleFunc("/{id}/products/bulk", promotionHandler.BulkAddProductsByFilter).Methods("POST", "OPTIONS")

	// ============================================================================
	// PUBLIC ROUTES - Order Management (No Authentication)
	// ============================================================================
	publicAPI := api.PathPrefix("/public").Subrouter()

	// Public order endpoints
	publicAPI.HandleFunc("/orders", publicOrderHandler.CreateOrder).Methods("POST", "OPTIONS")
	publicAPI.HandleFunc("/orders/{order_number}", publicOrderHandler.TrackOrder).Methods("GET", "OPTIONS")

	// Public store endpoints
	publicAPI.HandleFunc("/stores", publicOrderHandler.ListActiveStores).Methods("GET", "OPTIONS")
	publicAPI.HandleFunc("/stores/{id}", publicOrderHandler.GetStorePublic).Methods("GET", "OPTIONS")

	// Public product endpoints (slug-based with promotions)
	publicAPI.HandleFunc("/products", publicHandler.ListProducts).Methods("GET", "OPTIONS")
	publicAPI.HandleFunc("/products/{identifier}", publicHandler.GetProduct).Methods("GET", "OPTIONS")

	// Public brand endpoints (slug-based)
	publicAPI.HandleFunc("/brands", publicHandler.ListBrands).Methods("GET", "OPTIONS")
	publicAPI.HandleFunc("/brands/{identifier}", publicHandler.GetBrand).Methods("GET", "OPTIONS")
	publicAPI.HandleFunc("/brands/{identifier}/products", publicHandler.GetBrandProducts).Methods("GET", "OPTIONS")

	// Public category endpoints (slug-based)
	publicAPI.HandleFunc("/categories", publicHandler.ListCategories).Methods("GET", "OPTIONS")
	publicAPI.HandleFunc("/categories/{identifier}", publicHandler.GetCategory).Methods("GET", "OPTIONS")
	publicAPI.HandleFunc("/categories/{identifier}/products", publicHandler.GetCategoryProducts).Methods("GET", "OPTIONS")

	// Public filterable properties endpoint
	publicAPI.HandleFunc("/properties/filters", publicHandler.GetFilterableProperties).Methods("GET", "OPTIONS")

	// Public service types endpoints (slug-based)
	publicAPI.HandleFunc("/service-types", publicHandler.ListServiceTypes).Methods("GET", "OPTIONS")
	publicAPI.HandleFunc("/service-types/{identifier}", publicHandler.GetServiceType).Methods("GET", "OPTIONS")
	publicAPI.HandleFunc("/service-types/{identifier}/packages", publicHandler.ListPackagesByType).Methods("GET", "OPTIONS")

	// Public service packages endpoints
	publicAPI.HandleFunc("/service-packages", publicHandler.ListServicePackages).Methods("GET", "OPTIONS")
	publicAPI.HandleFunc("/service-packages/{id}", publicHandler.GetServicePackage).Methods("GET", "OPTIONS")

	// ============================================================================
	// PROTECTED ROUTES - Store Management (Admin Only)
	// ============================================================================
	storesProtected := api.PathPrefix("/stores").Subrouter()
	storesProtected.Use(auth.RequireAuth(cfg.JWT.Secret))
	storesProtected.HandleFunc("", storeHandler.ListStores).Methods("GET", "OPTIONS")
	storesProtected.HandleFunc("", storeHandler.CreateStore).Methods("POST", "OPTIONS")
	storesProtected.HandleFunc("/{id}", storeHandler.GetStore).Methods("GET", "OPTIONS")
	storesProtected.HandleFunc("/{id}", storeHandler.UpdateStore).Methods("PUT", "OPTIONS")
	storesProtected.HandleFunc("/{id}", storeHandler.DeleteStore).Methods("DELETE", "OPTIONS")
	storesProtected.HandleFunc("/{id}/toggle", storeHandler.ToggleStore).Methods("PATCH", "OPTIONS")

	// ============================================================================
	// PROTECTED ROUTES - Order Management (Admin Only)
	// ============================================================================
	ordersProtected := api.PathPrefix("/orders").Subrouter()
	ordersProtected.Use(auth.RequireAuth(cfg.JWT.Secret))
	ordersProtected.HandleFunc("", orderHandler.ListOrders).Methods("GET", "OPTIONS")
	ordersProtected.HandleFunc("/stats", orderHandler.GetOrderStats).Methods("GET", "OPTIONS")
	ordersProtected.HandleFunc("/export", orderHandler.ExportOrders).Methods("GET", "OPTIONS")
	ordersProtected.HandleFunc("/{id}", orderHandler.GetOrder).Methods("GET", "OPTIONS")
	ordersProtected.HandleFunc("/{id}", orderHandler.UpdateOrder).Methods("PUT", "OPTIONS")
	ordersProtected.HandleFunc("/{id}/status", orderHandler.UpdateOrderStatus).Methods("PATCH", "OPTIONS")
	ordersProtected.HandleFunc("/{id}", orderHandler.DeleteOrder).Methods("DELETE", "OPTIONS")
	ordersProtected.HandleFunc("/{id}/comments", orderHandler.GetOrderComments).Methods("GET", "OPTIONS")
	ordersProtected.HandleFunc("/{id}/comments", orderHandler.CreateOrderComment).Methods("POST", "OPTIONS")

	// ============================================================================
	// PROTECTED ROUTES - Catalog Builder (Admin Only)
	// ============================================================================
	catalogProtected := api.PathPrefix("/admin/catalog").Subrouter()
	catalogProtected.Use(auth.RequireAuth(cfg.JWT.Secret))

	// Sections
	catalogProtected.HandleFunc("/sections", catalogHandler.ListSections).Methods("GET", "OPTIONS")
	catalogProtected.HandleFunc("/sections", catalogHandler.CreateSection).Methods("POST", "OPTIONS")
	catalogProtected.HandleFunc("/sections/{id}", catalogHandler.GetSection).Methods("GET", "OPTIONS")
	catalogProtected.HandleFunc("/sections/{id}", catalogHandler.UpdateSection).Methods("PUT", "OPTIONS")
	catalogProtected.HandleFunc("/sections/{id}", catalogHandler.DeleteSection).Methods("DELETE", "OPTIONS")
	catalogProtected.HandleFunc("/sections/reorder", catalogHandler.ReorderSections).Methods("PATCH", "OPTIONS")
	catalogProtected.HandleFunc("/sections/{id}/clone", catalogHandler.CloneSection).Methods("POST", "OPTIONS")
	catalogProtected.HandleFunc("/sections/{id}/groups", catalogHandler.ListGroupsBySection).Methods("GET", "OPTIONS")

	// Groups
	catalogProtected.HandleFunc("/groups", catalogHandler.CreateGroup).Methods("POST", "OPTIONS")
	catalogProtected.HandleFunc("/groups/{id}", catalogHandler.GetGroup).Methods("GET", "OPTIONS")
	catalogProtected.HandleFunc("/groups/{id}", catalogHandler.UpdateGroup).Methods("PUT", "OPTIONS")
	catalogProtected.HandleFunc("/groups/{id}", catalogHandler.DeleteGroup).Methods("DELETE", "OPTIONS")
	catalogProtected.HandleFunc("/groups/reorder", catalogHandler.ReorderGroups).Methods("PATCH", "OPTIONS")
	catalogProtected.HandleFunc("/groups/{id}/items", catalogHandler.ListItemsByGroup).Methods("GET", "OPTIONS")

	// Items
	catalogProtected.HandleFunc("/items", catalogHandler.CreateItem).Methods("POST", "OPTIONS")
	catalogProtected.HandleFunc("/items/{id}", catalogHandler.GetItem).Methods("GET", "OPTIONS")
	catalogProtected.HandleFunc("/items/{id}", catalogHandler.UpdateItem).Methods("PUT", "OPTIONS")
	catalogProtected.HandleFunc("/items/{id}", catalogHandler.DeleteItem).Methods("DELETE", "OPTIONS")
	catalogProtected.HandleFunc("/items/reorder", catalogHandler.ReorderItems).Methods("PATCH", "OPTIONS")

	// ============================================================================
	// PUBLIC ROUTES - Service Packages (No Authentication for GET)
	// ============================================================================

	// Public GET routes - Service Package Types
	api.HandleFunc("/service-types", servicePackageTypeHandler.ListTypes).Methods("GET", "OPTIONS")
	api.HandleFunc("/service-types/{id}", servicePackageTypeHandler.GetType).Methods("GET", "OPTIONS")

	// Protected routes - Service Package Types (require auth)
	serviceTypesProtected := api.PathPrefix("/service-types").Subrouter()
	serviceTypesProtected.Use(auth.RequireAuth(cfg.JWT.Secret))
	serviceTypesProtected.HandleFunc("", servicePackageTypeHandler.CreateType).Methods("POST", "OPTIONS")
	serviceTypesProtected.HandleFunc("/{id}", servicePackageTypeHandler.UpdateType).Methods("PUT", "OPTIONS")
	serviceTypesProtected.HandleFunc("/{id}", servicePackageTypeHandler.DeleteType).Methods("DELETE", "OPTIONS")

	// Public GET routes - Service Packages
	api.HandleFunc("/service-packages", servicePackageHandler.ListPackages).Methods("GET", "OPTIONS")
	api.HandleFunc("/service-packages/{id}", servicePackageHandler.GetPackage).Methods("GET", "OPTIONS")

	// Protected routes - Service Packages (require auth)
	servicePackagesProtected := api.PathPrefix("/service-packages").Subrouter()
	servicePackagesProtected.Use(auth.RequireAuth(cfg.JWT.Secret))
	servicePackagesProtected.HandleFunc("", servicePackageHandler.CreatePackage).Methods("POST", "OPTIONS")
	servicePackagesProtected.HandleFunc("/{id}", servicePackageHandler.UpdatePackage).Methods("PUT", "OPTIONS")
	servicePackagesProtected.HandleFunc("/{id}", servicePackageHandler.DeletePackage).Methods("DELETE", "OPTIONS")

	// ============================================================================
	// SERVICE ORDERS - Mixed Public/Protected
	// ============================================================================

	// PUBLIC route - Create service order (no auth required)
	api.HandleFunc("/service-orders", serviceOrderHandler.CreateOrder).Methods("POST", "OPTIONS")

	// Protected routes - Service Orders (admin only)
	serviceOrdersProtected := api.PathPrefix("/service-orders").Subrouter()
	serviceOrdersProtected.Use(auth.RequireAuth(cfg.JWT.Secret))
	serviceOrdersProtected.HandleFunc("", serviceOrderHandler.ListOrders).Methods("GET", "OPTIONS")
	serviceOrdersProtected.HandleFunc("/stats", serviceOrderHandler.GetOrderStats).Methods("GET", "OPTIONS")
	serviceOrdersProtected.HandleFunc("/{id}", serviceOrderHandler.GetOrder).Methods("GET", "OPTIONS")
	serviceOrdersProtected.HandleFunc("/{id}", serviceOrderHandler.UpdateOrder).Methods("PUT", "OPTIONS")
	serviceOrdersProtected.HandleFunc("/{id}", serviceOrderHandler.DeleteOrder).Methods("DELETE", "OPTIONS")

	// Smart Search endpoints (Meilisearch)
	if searchHandler != nil {
		// Public GET routes - Smart Search
		api.HandleFunc("/smart-search", searchHandler.SmartSearch).Methods("GET", "OPTIONS")
		api.HandleFunc("/smart-search/autocomplete", searchHandler.Autocomplete).Methods("GET", "OPTIONS")
		api.HandleFunc("/smart-search/compare", searchHandler.CompareSearch).Methods("GET", "OPTIONS")
		api.HandleFunc("/smart-search/status", searchHandler.GetIndexStatus).Methods("GET", "OPTIONS")

		// Protected routes - Smart Search reindex (require auth)
		smartSearchProtected := api.PathPrefix("/smart-search").Subrouter()
		smartSearchProtected.Use(auth.RequireAuth(cfg.JWT.Secret))
		smartSearchProtected.HandleFunc("/reindex", searchHandler.TriggerReindex).Methods("POST", "OPTIONS")
	}

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
	// SECURITY: Wrap with UUID validation to prevent directory traversal
	router.PathPrefix("/uploads/").Handler(
		secureFileServer(http.StripPrefix("/uploads/", http.FileServer(http.Dir("./uploads")))))

	return router
}

// secureFileServer wraps the file server with security validation
func secureFileServer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// SECURITY: Validate that the path looks like a valid UUID-based filename
		// This prevents directory traversal attacks
		path := r.URL.Path

		// Block any path containing ".." or starting with "/"
		if strings.Contains(path, "..") || strings.HasPrefix(path, "/") {
			http.Error(w, "Invalid path", http.StatusBadRequest)
			return
		}

		// Only allow paths that match expected patterns (images/uuid.ext or videos/uuid.ext)
		validPattern := regexp.MustCompile(`^(images|videos)/[a-f0-9-]{36}\.[a-zA-Z0-9]+$`)
		if !validPattern.MatchString(path) {
			http.Error(w, "Invalid file path", http.StatusBadRequest)
			return
		}

		// Disable directory listing
		if strings.HasSuffix(path, "/") {
			http.Error(w, "Directory listing not allowed", http.StatusForbidden)
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
