package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"ultra-api-testing/internal/config"
	"ultra-api-testing/internal/database"
	"ultra-api-testing/internal/repository"
)

func main() {
	fmt.Println("=== Product Variant Grouping Utility ===")
	fmt.Println()

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}
	fmt.Println("Configuration loaded")

	// Connect to database
	db, err := database.New(ctx, cfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()
	fmt.Println("Database connected successfully")
	fmt.Println()

	// Create repository
	repo := repository.New(db.Pool)

	// Run product variant grouping
	fmt.Println("Starting product variant grouping...")
	fmt.Println("This will group products with similar names (e.g., different storage variants)")
	fmt.Println()

	startTime := time.Now()
	if err := repo.GroupProductVariants(ctx); err != nil {
		log.Fatalf("Failed to group product variants: %v", err)
	}
	duration := time.Since(startTime)

	fmt.Println()
	fmt.Printf("✓ Product variant grouping completed successfully in %v\n", duration)
	fmt.Println()

	// Show results
	var totalGroups, totalVariants int
	query := `
		SELECT
			COUNT(DISTINCT parent_id) as total_groups,
			COUNT(*) as total_variants
		FROM products
		WHERE parent_id IS NOT NULL
	`
	if err := db.Pool.QueryRow(ctx, query).Scan(&totalGroups, &totalVariants); err != nil {
		log.Printf("Warning: Failed to get grouping stats: %v", err)
	} else {
		fmt.Println("=== Grouping Results ===")
		fmt.Printf("Product Groups Created: %d\n", totalGroups)
		fmt.Printf("Products Grouped: %d\n", totalVariants)
		fmt.Printf("Average Variants per Group: %.1f\n", float64(totalVariants)/float64(totalGroups))
	}
}
