# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Go 1.23 application for Ultra B2B product data management. Fetches complete product catalog from Ultra B2B SOAP API, stores in PostgreSQL with normalized tables for products, properties, and characteristics (variants), and exposes via REST API.

**Database**: `ultra-data`

## Important: After Code Changes

After every code change, you MUST:

1. **Update this CLAUDE.md file** with the latest context for the codebase (new tables, endpoints, models, etc.)
2. **Call the senior-code-reviewer agent** to review the code changes
3. Fix any critical issues identified by the reviewer
4. **Update README.md files** with new features and API endpoints:
   - `/README.md` - Main project README with API endpoints and features
   - `/admin-intelect/README.md` - Dashboard README with frontend features
5. **Create git commits** if everything passes review

This ensures documentation stays current and code quality is maintained.

### Documentation Checklist

- [ ] CLAUDE.md updated with new endpoints, tables, or features
- [ ] README.md (root) updated with API changes
- [ ] admin-intelect/README.md updated with dashboard features
- [ ] Code reviewed by senior-code-reviewer agent
- [ ] Critical issues from review fixed
- [ ] Git commit created with descriptive message

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
| `/sync` | Real-time sync progress with step-by-step tracking, auto-refresh, and history |
| `/settings` | Configuration info |

### Dashboard Features (Nov 2025)

- **Real-time Statistics**: Product/brand/category counts from backend API
- **Low Stock Alerts**: Products with stock <= 5 displayed on dashboard
- **Bulk Operations**: Select multiple products to activate/deactivate/delete
- **CSV Export**: Export filtered product data to CSV
- **Toast Notifications**: Success/error feedback using Sonner
- **Confirmation Dialogs**: Destructive action confirmations
- **Status Toggles**: Enable/disable products, brands, categories inline
- **Enhanced Sync Status Page**: Real-time sync progress with:
  - Step-by-step progress indicators (7 steps)
  - Visual progress bars per step
  - Auto-refresh (3s when running, 30s when idle)
  - Detailed statistics (brands, categories, products, variants, properties, prices, stock)
  - Database totals comparison
  - Sync history with pagination
- **Global Currency Selector**: Switch between MDL, EUR, USD currencies
  - Persists selection in localStorage
  - Updates all product prices across the app
  - Located in sidebar footer
- **Product Variant Display**: Related products shown on detail page
  - Variant selector buttons (e.g., 256GB, 512GB, 1TB)
  - Links to other variants in same product group
  - Uses variant_group_id for grouping

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
| `src/components/ui/progress.tsx` | Progress bar component |
| `src/app/sync/page.tsx` | Enhanced sync status page with real-time progress |
| `src/components/ui/switch.tsx` | Toggle switch component |
| `src/components/ui/sonner.tsx` | Toast notifications |
| `src/contexts/currency-context.tsx` | Global currency state with localStorage persistence |

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

## Sync Process (7 Steps + Post-Processing)

1. **Brands** - Fetch all brands with logos
2. **Categories** - Fetch hierarchical category tree
3. **Products** - Fetch products with images, barcodes (also extracts characteristics)
4. **Properties** - Fetch properties per category (slow: ~35 min for 418 categories)
5. **Prices** - Update characteristic prices (multi-currency)
6. **Stock** - Update characteristic stock levels
7. **Exchange Rates** - Fetch current rates

**Post-Processing (Automatic):**
- **Extract Multi-Currency Prices** - Populates price_mdl, price_eur, price_usd from JSONB
- **Group Product Variants** - Links related products (e.g., iPhone 256GB/512GB/1TB) by name similarity

## API Endpoints

Server runs on `http://localhost:8080`

### Core Endpoints

```bash
# Products
GET    /api/v1/products                      # List products (with filters)
GET    /api/v1/products/{id}                 # Get product details
GET    /api/v1/products/{id}/properties      # Get product properties
GET    /api/v1/products/{id}/characteristics # Get product variants
GET    /api/v1/products/{id}/variants        # Get related variants (same product group)
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
GET /api/v1/sync/progress                    # Detailed sync progress with step-by-step status

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

### Multi-Currency Price Extraction (Nov 2025)

The Ultra API returns prices as JSONB arrays without currency identifiers. The array order is consistent: `[EUR, USD, MDL]`.

**Issue**: The `products.prices` JSONB field has empty `currency` fields:
```json
[{"type": "", "price": 224, "currency": ""}, {"type": "", "price": 217, "currency": ""}, {"type": "", "price": 4149, "currency": ""}]
```

**Fix**: Extract prices by array position instead of filtering by currency:

**Location**: `internal/repository/repository.go`

```go
// UpdateProductPricesFromJSONB extracts currency-specific prices by array position
// Array order: [0]=EUR, [1]=USD, [2]=MDL
_, err := r.pool.Exec(ctx, `
    UPDATE products p
    SET
        price_min = COALESCE(NULLIF(p.prices->2->>'price', '')::DECIMAL, p.price_min),
        price_max = COALESCE(NULLIF(p.prices->2->>'price', '')::DECIMAL, p.price_max),
        price_eur = NULLIF(p.prices->0->>'price', '')::DECIMAL,
        price_usd = NULLIF(p.prices->1->>'price', '')::DECIMAL,
        price_mdl = NULLIF(p.prices->2->>'price', '')::DECIMAL,
        updated_at = NOW()
    WHERE jsonb_array_length(p.prices) > 0
`)
```

This fix enables multi-currency support with MDL as the primary display currency. About 95.6% of products (35,062/36,683) have MDL prices; the remaining 4.4% have only EUR/USD.

### Comprehensive Bug Audit (Nov 2025)

A comprehensive audit of the codebase identified and fixed 15 bugs:

**Backend Issues Fixed:**
- 33 API endpoints registered in router (`cmd/unified-api/main.go`)
- Route order fixed: bulk routes before parameterized routes to prevent gorilla/mux conflicts
- CORS middleware moved before routes for proper application
- N+1 query problem fixed with batch queries (`GetProductsWithDetails`, `GetBrandsByIDs`, `GetCategoriesByIDs`)

**Frontend Issues Fixed:**
- Type mismatches: `ImageEntry`, `SyncLog`, `is_active` fields aligned with backend
- API response unwrapping: All endpoints now properly extract `response.data`
- Endpoint paths corrected: `/api/v1/sync/logs`, `/api/v1/export/products`
- Pagination null checks: `total > 0` check before calling `toLocaleString()`
- Switch states: Use `product.is_active` instead of hardcoded `true`

**Key Pattern:**
```go
// Route registration order - specific routes before parameterized
api.HandleFunc("/products/bulk", handler.BulkUpdateProducts).Methods("PATCH", "OPTIONS")
api.HandleFunc("/products/{id}", handler.UpdateProduct).Methods("PUT", "OPTIONS")
```

### Code Quality Improvements (Nov 2025)

Product detail page (`admin-intelect/src/app/products/[id]/page.tsx`) improvements:

1. **Clipboard Error Handling**: Try-catch wrapper for clipboard API
   ```typescript
   const handleCopy = async () => {
     try {
       await navigator.clipboard.writeText(text);
       setCopied(true);
       setTimeout(() => setCopied(false), 2000);
     } catch (err) {
       console.error("Failed to copy to clipboard:", err);
     }
   };
   ```

2. **Race Condition Prevention**: Cancellation pattern in useEffect for async data fetching
   ```typescript
   useEffect(() => {
     let cancelled = false;
     async function fetchData() {
       const { id } = await params;
       if (cancelled) return;
       // ... fetch data
       if (cancelled) return;
       // ... set state
     }
     fetchData();
     return () => { cancelled = true; };
   }, [params]);
   ```

3. **Empty Array Guards**: Check array length before Math.min/max
   ```typescript
   if (pricesForCurrency.length === 0) return null;
   const minPrice = Math.min(...pricesForCurrency);
   ```

4. **Select Performance**: max-h-[300px] on SelectContent for large lists (1000+ items)

### Multi-Currency Product Pricing (Nov 2025)

Products now support multiple currencies with MDL (Moldovan Leu) as the primary display currency.

**New Product Columns:**
```sql
prices JSONB DEFAULT '[]'    -- All currency prices [{price, currency, type, type_uuid}]
price_mdl DECIMAL(12,2)      -- Price in Moldovan Leu (primary)
price_eur DECIMAL(12,2)      -- Price in Euro
price_usd DECIMAL(12,2)      -- Price in US Dollar
variant_group_id UUID        -- Reference to parent product in variant group
is_group BOOLEAN             -- True if this is a variant group parent
```

**Key Implementation Details:**

1. **MDL as Primary Currency**: `price_min` and `price_max` always use MDL prices
   ```go
   // UpdateProductAggregates filters by MDL
   MIN(CASE WHEN price_item->>'currency' = 'MDL' THEN (price_item->>'price')::DECIMAL END)
   ```

2. **All Currencies Stored**: The `prices` JSONB stores all currencies from PRICELIST
   ```go
   // Product-level prices store ALL currencies
   _, err = tx.Exec(ctx, `
       UPDATE products SET prices = $1 WHERE ultra_id = $2
   `, pricesJSON, productUltraID)
   ```

3. **Variant Grouping**: Products can be grouped by base name (e.g., iPhone 256GB/512GB/1TB)
   ```go
   // GroupProductVariants groups by base name
   regexp_replace(name, '\s+\d+(GB|TB)(\s|$)', '', 'g') as base_name
   ```

**API Response Format:**
```json
{
  "price_min": 31999.00,     // MDL price
  "price_max": 31999.00,     // MDL price
  "price_mdl": 31999.00,
  "price_eur": 1757.00,
  "price_usd": 1850.00,
  "prices": [
    {"price": 31999, "currency": "MDL", "type": "retail"},
    {"price": 1757, "currency": "EUR", "type": "retail"}
  ]
}
```

**Migration File:** `migrations/004_multi_currency_variants.sql`

### Enhanced Sync Status Page (Nov 2025)

The sync status page has been completely redesigned with real-time progress tracking and premium UI.

**Features:**

1. **Real-Time Progress**: Updates every 1 second when sync is running
2. **Step-by-Step Tracking**: All 7 sync steps with individual progress bars
3. **Accurate Database Counts**: Shows actual synced counts from database, not estimates
4. **Premium UI**: Redesigned with animations, gradients, and polished styling

**Backend Endpoint**: `GET /api/v1/sync/progress`

Returns comprehensive sync progress:
```json
{
  "isRunning": true,
  "currentStep": 4,
  "overallProgress": 57,
  "elapsedSeconds": 1200,
  "estimatedRemainingSeconds": 900,
  "steps": [
    {"name": "Brands", "status": "completed", "synced": 1133, "total": 1133},
    {"name": "Categories", "status": "completed", "synced": 418, "total": 418},
    {"name": "Products", "status": "completed", "synced": 48316, "total": 48316},
    {"name": "Properties", "status": "running", "synced": 500000, "total": 876081}
  ]
}
```

**Key Implementation Details:**

- Uses actual database counts (not sync log values) for real-time accuracy
- Determines current step based on database state during active sync
- CTEs separate stock and price aggregation for correct calculations
- LEFT JOIN LATERAL handles empty price arrays correctly

**Files:**
- Frontend: `admin-intelect/src/app/sync/page.tsx`
- Backend: `internal/handlers/handlers.go` (GetSyncProgress handler)
- Types: `admin-intelect/src/types/index.ts` (SyncProgress, SyncStep)

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
