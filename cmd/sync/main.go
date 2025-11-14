package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"ultra-api-testing/internal/config"
	"ultra-api-testing/internal/database"
	"ultra-api-testing/internal/models"
	"ultra-api-testing/internal/repository"
	"ultra-api-testing/internal/ultra"
)

func main() {
	// Setup logging
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Println("=== Ultra B2B API Testing Tool ===")

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}
	log.Println("✓ Configuration loaded")

	// Setup context with cancellation
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Handle graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigChan
		log.Println("\n🛑 Shutdown signal received, canceling sync...")
		cancel()
	}()

	// Connect to database
	db, err := database.New(ctx, cfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()
	log.Println("✓ Database connected")

	// Initialize repository
	repo := repository.New(db.Pool)

	// Get Ultra source from database
	source, err := repo.GetSourceByCode(ctx, "ultra")
	if err != nil {
		log.Fatalf("Failed to get Ultra source: %v\nMake sure you ran the migration!", err)
	}
	log.Printf("✓ Ultra source found (ID: %s, Priority: %d)\n", source.ID, source.Priority)

	// Initialize Ultra API client
	ultraClient := ultra.NewClient(cfg.Ultra)

	// Test connection
	log.Println("\n📡 Testing Ultra API connection...")
	if err := ultraClient.TestService(ctx); err != nil {
		log.Fatalf("Failed to connect to Ultra API: %v", err)
	}
	log.Println("✓ Ultra API connection successful")

	// Initialize fetcher
	fetcher := ultra.NewFetcher(ultraClient, source.ID)

	// Create sync run
	syncRun, err := repo.CreateSyncRun(ctx, source.ID, "full")
	if err != nil {
		log.Fatalf("Failed to create sync run: %v", err)
	}
	log.Printf("✓ Sync run created (ID: %s)\n", syncRun.ID)

	// Run the sync
	if err := runSync(ctx, fetcher, repo, syncRun); err != nil {
		log.Printf("❌ Sync failed: %v\n", err)
		syncRun.Status = "failed"
		errMsg := err.Error()
		syncRun.ErrorMessage = &errMsg
	} else {
		log.Println("✅ Sync completed successfully!")
		syncRun.Status = "success"
	}

	// Update sync run
	now := time.Now()
	syncRun.FinishedAt = &now
	duration := int(now.Sub(syncRun.StartedAt).Seconds())
	syncRun.DurationSeconds = &duration

	if err := repo.UpdateSyncRun(ctx, syncRun); err != nil {
		log.Printf("Failed to update sync run: %v\n", err)
	}

	log.Printf("\n=== Sync Summary ===\n")
	log.Printf("Duration: %d seconds\n", duration)
	log.Printf("Status: %s\n", syncRun.Status)
	log.Printf("Brands: %d\n", syncRun.BrandsWithData)
	log.Printf("Categories: %d\n", syncRun.CategoriesWithData)
	log.Printf("Products: %d\n", syncRun.ProductsWithData)
	log.Printf("  - With Prices: %d\n", syncRun.ProductsWithPrices)
	log.Printf("  - With Stock: %d\n", syncRun.ProductsWithStock)
	log.Printf("  - With Images: %d\n", syncRun.ProductsWithImages)
}

func runSync(ctx context.Context, fetcher *ultra.Fetcher, repo *repository.Repository, syncRun *models.SyncRun) error {
	log.Println("\n🚀 Starting data synchronization...")

	// Step 1: Fetch Brands
	log.Println("\n--- Step 1/6: Fetching Brands ---")
	brands, err := fetcher.FetchBrands(ctx, true)
	if err != nil {
		return fmt.Errorf("fetch brands: %w", err)
	}

	if err := repo.UpsertBrandSources(ctx, brands); err != nil {
		return fmt.Errorf("save brands: %w", err)
	}
	syncRun.BrandsWithData = len(brands)
	log.Printf("✓ Saved %d brands to database\n", len(brands))

	// Step 2: Fetch Categories
	log.Println("\n--- Step 2/6: Fetching Categories ---")
	categories, err := fetcher.FetchCategories(ctx, true)
	if err != nil {
		return fmt.Errorf("fetch categories: %w", err)
	}

	if err := repo.UpsertCategorySources(ctx, categories); err != nil {
		return fmt.Errorf("save categories: %w", err)
	}
	syncRun.CategoriesWithData = len(categories)
	log.Printf("✓ Saved %d categories to database\n", len(categories))

	// Step 3: Fetch Products
	log.Println("\n--- Step 3/6: Fetching Products ---")
	products, err := fetcher.FetchProducts(ctx, true)
	if err != nil {
		return fmt.Errorf("fetch products: %w", err)
	}

	if err := repo.UpsertProductSources(ctx, products); err != nil {
		return fmt.Errorf("save products: %w", err)
	}
	syncRun.ProductsWithData = len(products)

	// Count products with images
	imagesCount := 0
	for _, p := range products {
		if p.Images != nil {
			if images, ok := p.Images["images"]; ok {
				if imageArray, ok := images.([]map[string]string); ok && len(imageArray) > 0 {
					imagesCount++
				}
			}
		}
	}
	syncRun.ProductsWithImages = imagesCount
	log.Printf("✓ Saved %d products to database (%d with images)\n", len(products), imagesCount)

	// Step 4: Fetch Prices
	log.Println("\n--- Step 4/6: Fetching Prices ---")
	priceMap, err := fetcher.FetchPrices(ctx, true)
	if err != nil {
		log.Printf("⚠️  Warning: Failed to fetch prices: %v (continuing...)\n", err)
	} else {
		if err := repo.UpdateProductPrices(ctx, syncRun.SourceID, priceMap); err != nil {
			log.Printf("⚠️  Warning: Failed to save prices: %v (continuing...)\n", err)
		} else {
			syncRun.ProductsWithPrices = len(priceMap)
			log.Printf("✓ Updated prices for %d products\n", len(priceMap))
		}
	}

	// Step 5: Fetch Stock
	log.Println("\n--- Step 5/6: Fetching Stock ---")
	stockMap, err := fetcher.FetchStock(ctx, true)
	if err != nil {
		log.Printf("⚠️  Warning: Failed to fetch stock: %v (continuing...)\n", err)
	} else {
		if err := repo.UpdateProductStock(ctx, syncRun.SourceID, stockMap); err != nil {
			log.Printf("⚠️  Warning: Failed to save stock: %v (continuing...)\n", err)
		} else {
			syncRun.ProductsWithStock = len(stockMap)
			log.Printf("✓ Updated stock for %d products\n", len(stockMap))
		}
	}

	// Step 6: Fetch Exchange Rates
	log.Println("\n--- Step 6/6: Fetching Exchange Rates ---")
	rates, err := fetcher.FetchRates(ctx)
	if err != nil {
		log.Printf("⚠️  Warning: Failed to fetch rates: %v (continuing...)\n", err)
	} else {
		log.Printf("✓ Fetched %d exchange rates\n", len(rates))
		// TODO: Save rates to database (create rates table or store in JSONB)
	}

	// Build sync details
	syncDetails := models.JSONB{
		"services_synced": []string{"BRAND", "NOMENCLATURETYPELIST", "NOMENCLATURE", "PRICELIST", "BALANCE", "RATES"},
		"total_brands":    len(brands),
		"total_categories": len(categories),
		"total_products":  len(products),
		"products_with_prices": len(priceMap),
		"products_with_stock": len(stockMap),
		"exchange_rates":  len(rates),
	}
	syncRun.SyncDetails = syncDetails

	return nil
}
