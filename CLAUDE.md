# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Go 1.23 application for Ultra B2B product data management. Fetches complete product catalog from Ultra B2B SOAP API, stores in PostgreSQL with normalized tables for products, properties, and characteristics (variants), and exposes via REST API.

**Database**: `ultra-data`

## Important: After Code Changes

After every code change, you MUST:

1. **Update this CLAUDE.md file** with the latest context for the codebase (new tables, endpoints, models, etc.)
2. **Call the senior-code-reviewer agent** to review the code changes
3. The reviewer should also update CLAUDE.md if needed
4. **Create git commits** if everything passes review

This ensures documentation stays current and code quality is maintained.

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
| `admin-intelect/` | Next.js CMS dashboard |

## Admin Intelect Dashboard

Next.js 14+ CMS dashboard for managing the Ultra B2B backend.

**Location**: `admin-intelect/`

### Running the Dashboard

```bash
cd admin-intelect
bun install
bun dev          # Starts on http://localhost:3000
```

### Dashboard Pages

| Route | Purpose |
|-------|---------|
| `/` | Dashboard with real-time statistics, low stock alerts, recent sync activity |
| `/products` | Products table with bulk actions, export, status toggles |
| `/products/[id]` | Product detail with properties & characteristics |
| `/brands` | Brands management with status toggles and delete actions |
| `/categories` | Hierarchical category tree with status toggles |
| `/sync` | Sync logs with pagination, refresh, and status history |
| `/settings` | Configuration info |

### Dashboard Features (Nov 2025)

- **Real-time Statistics**: Product/brand/category counts from backend API
- **Low Stock Alerts**: Products with stock <= 5 displayed on dashboard
- **Bulk Operations**: Select multiple products to activate/deactivate/delete
- **CSV Export**: Export filtered product data to CSV
- **Toast Notifications**: Success/error feedback using Sonner
- **Confirmation Dialogs**: Destructive action confirmations
- **Status Toggles**: Enable/disable products, brands, categories inline

### Tech Stack

- Next.js 14+ (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui components
- bun package manager

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/api.ts` | API client for Go backend (all endpoints) |
| `src/types/index.ts` | TypeScript type definitions |
| `src/components/app-sidebar.tsx` | Navigation sidebar |
| `src/components/products/products-table.tsx` | Products table with bulk actions |
| `src/components/confirm-dialog.tsx` | Reusable confirmation dialog |
| `src/components/ui/switch.tsx` | Toggle switch component |
| `src/components/ui/sonner.tsx` | Toast notifications |

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

### Core Endpoints

```bash
# Products
GET    /api/v1/products                      # List products (with filters)
GET    /api/v1/products/{id}                 # Get product details
GET    /api/v1/products/{id}/properties      # Get product properties
GET    /api/v1/products/{id}/characteristics # Get product variants
POST   /api/v1/products                      # Create product
PUT    /api/v1/products/{id}                 # Update product
DELETE /api/v1/products/{id}                 # Soft delete product

# Brands
GET    /api/v1/brands                        # List brands
GET    /api/v1/brands/{id}                   # Get brand details
POST   /api/v1/brands                        # Create brand
PUT    /api/v1/brands/{id}                   # Update brand
DELETE /api/v1/brands/{id}                   # Soft delete brand

# Categories
GET    /api/v1/categories                    # List categories
GET    /api/v1/categories/{id}               # Get category details
POST   /api/v1/categories                    # Create category
PUT    /api/v1/categories/{id}               # Update category
DELETE /api/v1/categories/{id}               # Soft delete category

# Search
GET    /api/v1/search?q=query                # Search products
```

### Dashboard & Management Endpoints

```bash
# Dashboard Statistics
GET /api/v1/dashboard/stats                  # Aggregate counts, stock summaries
GET /api/v1/dashboard/stock-summary          # Stock by category (top 20)
GET /api/v1/dashboard/price-summary          # Price distribution and ranges

# Sync Management
GET /api/v1/sync/logs                        # List sync logs (paginated, filterable)
GET /api/v1/sync/logs/{id}                   # Get sync log details
GET /api/v1/sync/status                      # Latest sync status

# Bulk Operations
PATCH  /api/v1/products/bulk                 # Bulk update products (enable/disable)
DELETE /api/v1/products/bulk                 # Bulk soft delete products
PATCH  /api/v1/brands/bulk                   # Bulk update brands
PATCH  /api/v1/categories/bulk               # Bulk update categories

# Export
GET /api/v1/export/products?format=csv       # Export products (JSON or CSV)
GET /api/v1/export/brands?format=csv         # Export brands
GET /api/v1/export/categories?format=csv     # Export categories

# Config & Health
GET /api/v1/config                           # Application configuration
GET /api/v1/health                           # Health check with DB status
```

### Query Parameters

```bash
?limit=50&offset=0                        # Pagination (max 100)
?brand_id=uuid                            # Filter by brand
?category_id=uuid                         # Filter by category
?in_stock=true                            # Filter in-stock only
?min_price=100&max_price=500              # Price range
?status=completed&sync_type=full          # Sync log filters
?format=json|csv                          # Export format
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

## Important Bug Fixes

### is_active Flag (Nov 2025)

The Ultra API returns inconsistent values for the `Active` field (empty string, undefined, etc.). The sync now defaults to `is_active = true` unless explicitly marked inactive.

**Location**: `internal/ultra/fetcher.go`

```go
// Helper function handles case-insensitive falsy values
func isActiveFromString(value string) bool {
    v := strings.ToLower(strings.TrimSpace(value))
    return v != "false" && v != "0" && v != "no" && v != "n"
}

// Usage for brands, categories, products
IsActive: isActiveFromString(b.Active)
```

This fix applies to brands, categories, and products with robust handling for case variations and whitespace.

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
