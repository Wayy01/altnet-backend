# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Go 1.23 application for Ultra B2B product data management. Fetches complete product catalog from Ultra B2B SOAP API, stores in PostgreSQL with normalized tables for products, properties, and characteristics (variants), and exposes via REST API.

**Database**: `ultra-data`

## Build & Development Commands

```bash
# Setup and installation
make setup          # Download Go dependencies
make db-create      # Create PostgreSQL database (ultra-data)
make db-migrate     # Run migrations
make install        # Complete setup (setup + db + verify)

# Development
make run            # Run main sync application
make build          # Compile to bin/ultra-sync
make test           # Run test suite (go test -v ./...)
make dev            # Clean, build, run cycle

# Database
make db-reset       # Drop and recreate database
make status         # Check last sync runs
make stats          # View database statistics

# Direct commands
go run cmd/sync/main.go         # Main sync (fetches all Ultra data)
go run cmd/unified-api/main.go  # REST API server on :8080
```

## Architecture

### Database Schema

```
brands (1,133)
   ↓
products (48,316) ← categories (418)
   ↓
   ├── properties (876,081) - Product specifications
   └── characteristics (460) - Product variants/SKUs
```

### 7 Core Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `products` | Main product catalog | ultra_id, code, article, name, brand_id, category_id, images, barcodes, price_min/max, total_stock |
| `properties` | Product specifications | product_id, property_name, value, group_name, is_filter |
| `characteristics` | Product variants/SKUs | product_id, ultra_id, name, prices (JSONB), stock_warehouse/showroom/total |
| `brands` | Brand catalog | ultra_id, name, slug, logo_url |
| `categories` | Product categories | ultra_id, name, parent_id, sort_order, product_count |
| `exchange_rates` | Currency rates | currency_code, rate |
| `sync_logs` | Sync audit trail | counts, status, duration, error_message |

### Package Structure

| Package | Purpose |
|---------|---------|
| `internal/config` | Environment configuration (.env loading) |
| `internal/database` | PostgreSQL connection pool (pgx) |
| `internal/models` | Data structures (Brand, Product, Category, Property, Characteristic) |
| `internal/repository` | Database CRUD operations |
| `internal/ultra` | SOAP client, XML parser, fetcher services |
| `internal/handlers` | REST API HTTP handlers |
| `cmd/sync` | Main sync application |
| `cmd/unified-api` | REST API server |

### Key Dependencies

- **jackc/pgx/v5** - PostgreSQL driver
- **gorilla/mux** - HTTP routing
- **joho/godotenv** - Environment loading
- **gosimple/slug** - URL slug generation

## Configuration

Required environment variables in `.env`:

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=ultra-data
DB_SSLMODE=disable

# Ultra API
ULTRA_API_URL=https://portal.it-ultra.com/b2b/ws/b2b.1cws
ULTRA_API_USERNAME=your_username
ULTRA_API_PASSWORD=your_password
ULTRA_API_TIMEOUT=60s
ULTRA_API_MAX_RETRIES=3
```

## Sync Process (7 Steps)

1. **Brands** - Fetch all brands with logos
2. **Categories** - Fetch hierarchical category tree
3. **Products** - Fetch products with images, barcodes (also extracts characteristics)
4. **Properties** - Fetch properties per category (slow: ~35 min for 418 categories)
5. **Prices** - Update characteristic prices (multi-currency)
6. **Stock** - Update characteristic stock levels
7. **Exchange Rates** - Fetch current rates

## API Endpoints

Server runs on `http://localhost:8080`

```bash
# Products
GET /api/v1/products                      # List products (with filters)
GET /api/v1/products/{id}                 # Get product details
GET /api/v1/products/{id}/properties      # Get product properties
GET /api/v1/products/{id}/characteristics # Get product variants

# Other
GET /api/v1/brands                        # List brands
GET /api/v1/categories                    # List categories
GET /api/v1/search?q=query                # Search products

# Query parameters
?limit=50&offset=0                        # Pagination
?brand_id=uuid                            # Filter by brand
?category_id=uuid                         # Filter by category
?in_stock=true                            # Filter in-stock only
?min_price=100&max_price=500              # Price range
```

## Data Model Notes

### Properties vs Characteristics

- **Properties**: Technical specifications (e.g., "Storage Capacity: 32GB", "Weight: 3g")
- **Characteristics**: Product variants/SKUs with their own prices and stock (e.g., "Black 256GB", "White 128GB")

### JSONB Fields

- `products.images` - Array of image UUIDs/URLs
- `products.barcodes` - Array of barcodes
- `characteristics.prices` - Array of {currency, price, price_type}

### Foreign Key Resolution

Products store `brand_ultra_id`, `category_ultra_id`, `parent_ultra_id` from API, then resolve to actual `brand_id`, `category_id`, `parent_id` foreign keys after sync.

## XML Parsing

The Ultra API returns malformed XML. Parser in `internal/ultra/parser.go` automatically fixes:
- Tags starting with digits
- Single letter tags
- Bare left angle brackets
- Known typos

## Database Queries

```sql
-- Connect
psql -d ultra-data

-- Product with properties
SELECT p.name, pr.property_name, pr.value, pr.group_name
FROM products p
JOIN properties pr ON pr.product_id = p.id
WHERE p.code = '62949';

-- Products with most properties
SELECT p.name, count(pr.id) as prop_count
FROM products p
JOIN properties pr ON pr.product_id = p.id
GROUP BY p.id ORDER BY prop_count DESC LIMIT 10;

-- Characteristics with prices
SELECT p.name, c.name as variant, c.prices, c.stock_total
FROM products p
JOIN characteristics c ON c.product_id = p.id;

-- Table counts
SELECT 'brands', count(*) FROM brands
UNION SELECT 'products', count(*) FROM products
UNION SELECT 'properties', count(*) FROM properties;
```
