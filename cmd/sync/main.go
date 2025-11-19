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
	log.Println("=== Ultra B2B Data Sync Tool ===")

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}
	log.Println("Configuration loaded")

	// Setup context with cancellation
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Handle graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigChan
		log.Println("\nShutdown signal received, canceling sync...")
		cancel()
	}()

	// Connect to database
	db, err := database.New(ctx, cfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()
	log.Println("Database connected")

	// Initialize repository
	repo := repository.New(db.Pool)

	// Initialize Ultra API client
	ultraClient := ultra.NewClient(cfg.Ultra)

	// Test connection
	log.Println("\nTesting Ultra API connection...")
	if err := ultraClient.TestService(ctx); err != nil {
		log.Fatalf("Failed to connect to Ultra API: %v", err)
	}
	log.Println("Ultra API connection successful")

	// Initialize fetcher
	fetcher := ultra.NewFetcher(ultraClient)

	// Create sync log
	syncLog, err := repo.CreateSyncLog(ctx, "full")
	if err != nil {
		log.Fatalf("Failed to create sync log: %v", err)
	}
	log.Printf("Sync started (ID: %s)\n", syncLog.ID)

	// Run the sync
	if err := runSync(ctx, fetcher, repo, syncLog); err != nil {
		log.Printf("Sync failed: %v\n", err)
		syncLog.Status = "failed"
		errMsg := err.Error()
		syncLog.ErrorMessage = &errMsg
	} else {
		log.Println("Sync completed successfully!")
		syncLog.Status = "success"
	}

	// Update sync log
	now := time.Now()
	syncLog.FinishedAt = &now
	duration := int(now.Sub(syncLog.StartedAt).Seconds())
	syncLog.DurationSeconds = &duration

	if err := repo.UpdateSyncLog(ctx, syncLog); err != nil {
		log.Printf("Failed to update sync log: %v\n", err)
	}

	log.Printf("\n=== Sync Summary ===\n")
	log.Printf("Duration: %d seconds\n", duration)
	log.Printf("Status: %s\n", syncLog.Status)
	log.Printf("Brands: %d\n", syncLog.BrandsSynced)
	log.Printf("Categories: %d\n", syncLog.CategoriesSynced)
	log.Printf("Products: %d\n", syncLog.ProductsSynced)
	log.Printf("Properties: %d\n", syncLog.PropertiesSynced)
	log.Printf("Characteristics: %d\n", syncLog.CharacteristicsSynced)
	log.Printf("Prices: %d\n", syncLog.PricesSynced)
	log.Printf("Stock: %d\n", syncLog.StockSynced)
}

func runSync(ctx context.Context, fetcher *ultra.Fetcher, repo *repository.Repository, syncLog *models.SyncLog) error {
	log.Println("\nStarting data synchronization...")

	// Step 1: Fetch and store Brands
	log.Println("\n--- Step 1/7: Fetching Brands ---")
	brandInputs, err := fetcher.FetchBrands(ctx, true)
	if err != nil {
		return fmt.Errorf("fetch brands: %w", err)
	}

	count, err := repo.UpsertBrands(ctx, brandInputs)
	if err != nil {
		return fmt.Errorf("save brands: %w", err)
	}
	syncLog.BrandsSynced = count
	log.Printf("Saved %d brands to database\n", count)

	// Step 2: Fetch and store Categories
	log.Println("\n--- Step 2/7: Fetching Categories ---")
	categoryInputs, err := fetcher.FetchCategories(ctx, true)
	if err != nil {
		return fmt.Errorf("fetch categories: %w", err)
	}

	count, err = repo.UpsertCategories(ctx, categoryInputs)
	if err != nil {
		return fmt.Errorf("save categories: %w", err)
	}
	syncLog.CategoriesSynced = count
	log.Printf("Saved %d categories to database\n", count)

	// Resolve category parent references
	if err := repo.ResolveCategoryParents(ctx); err != nil {
		log.Printf("Warning: Failed to resolve category parents: %v\n", err)
	}

	// Step 3: Fetch and store Products
	log.Println("\n--- Step 3/7: Fetching Products ---")
	productInputs, charInputs, err := fetcher.FetchProducts(ctx, true)
	if err != nil {
		return fmt.Errorf("fetch products: %w", err)
	}

	count, err = repo.UpsertProducts(ctx, productInputs)
	if err != nil {
		return fmt.Errorf("save products: %w", err)
	}
	syncLog.ProductsSynced = count
	log.Printf("Saved %d products to database\n", count)

	// Resolve product references (brand_id, category_id, parent_id)
	if err := repo.ResolveProductReferences(ctx); err != nil {
		log.Printf("Warning: Failed to resolve product references: %v\n", err)
	}

	// Store characteristics
	totalChars := 0
	for productUltraID, chars := range charInputs {
		charCount, err := repo.UpsertCharacteristics(ctx, productUltraID, chars)
		if err != nil {
			log.Printf("Warning: Failed to save characteristics for %s: %v\n", productUltraID, err)
			continue
		}
		totalChars += charCount
	}
	syncLog.CharacteristicsSynced = totalChars
	log.Printf("Saved %d characteristics to database\n", totalChars)

	// Step 4: Fetch and store Properties
	log.Println("\n--- Step 4/7: Fetching Properties ---")
	totalProps := 0

	// Fetch properties for each category with products
	for _, cat := range categoryInputs {
		if cat.ProductCount == 0 {
			continue
		}

		log.Printf("Fetching properties for category: %s (%d products)\n", cat.Name, cat.ProductCount)

		productProps, err := fetcher.FetchPropertiesForCategory(ctx, cat.UltraID)
		if err != nil {
			log.Printf("Warning: Failed to fetch properties for %s: %v\n", cat.Name, err)
			continue
		}

		// Store properties for each product
		for productUltraID, props := range productProps {
			propCount, err := repo.UpsertProperties(ctx, productUltraID, props)
			if err != nil {
				log.Printf("Warning: Failed to save properties for %s: %v\n", productUltraID, err)
				continue
			}
			totalProps += propCount
		}
	}
	syncLog.PropertiesSynced = totalProps
	log.Printf("Saved %d properties to database\n", totalProps)

	// Step 5: Fetch and store Prices
	log.Println("\n--- Step 5/7: Fetching Prices ---")
	priceInputs, err := fetcher.FetchPrices(ctx, true)
	if err != nil {
		log.Printf("Warning: Failed to fetch prices: %v (continuing...)\n", err)
	} else {
		count, err = repo.UpdateCharacteristicPrices(ctx, priceInputs)
		if err != nil {
			log.Printf("Warning: Failed to save prices: %v (continuing...)\n", err)
		} else {
			syncLog.PricesSynced = count
			log.Printf("Updated prices for %d products/characteristics\n", count)
		}
	}

	// Step 6: Fetch and store Stock
	log.Println("\n--- Step 6/7: Fetching Stock ---")
	stockInputs, err := fetcher.FetchStock(ctx, true)
	if err != nil {
		log.Printf("Warning: Failed to fetch stock: %v (continuing...)\n", err)
	} else {
		count, err = repo.UpdateCharacteristicStock(ctx, stockInputs)
		if err != nil {
			log.Printf("Warning: Failed to save stock: %v (continuing...)\n", err)
		} else {
			syncLog.StockSynced = count
			log.Printf("Updated stock for %d products/characteristics\n", count)
		}
	}

	// Step 7: Fetch and store Exchange Rates
	log.Println("\n--- Step 7/7: Fetching Exchange Rates ---")
	rates, err := fetcher.FetchRates(ctx)
	if err != nil {
		log.Printf("Warning: Failed to fetch rates: %v (continuing...)\n", err)
	} else {
		if err := repo.UpsertExchangeRates(ctx, rates); err != nil {
			log.Printf("Warning: Failed to save rates: %v (continuing...)\n", err)
		} else {
			log.Printf("Saved %d exchange rates\n", len(rates))
		}
	}

	// Update product aggregates (price_min, price_max, total_stock)
	log.Println("\nUpdating product aggregates...")
	if err := repo.UpdateProductAggregates(ctx); err != nil {
		log.Printf("Warning: Failed to update product aggregates: %v\n", err)
	}

	// Build sync details
	syncLog.Details = models.JSONB{
		"services_synced": []string{"BRAND", "NOMENCLATURETYPELIST", "NOMENCLATURE", "PROPERTIES", "PRICELIST", "BALANCE", "RATES"},
	}

	return nil
}
