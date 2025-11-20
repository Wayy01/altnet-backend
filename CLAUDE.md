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

### 8 Core Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `products` | Main product catalog | ultra_id, code, article, name, brand_id, category_id, images, barcodes, price_min/max, total_stock |
| `properties` | Product specifications | product_id, property_name, value, group_name, is_filter |
| `characteristics` | Product variants/SKUs | product_id, ultra_id, name, prices (JSONB), stock_warehouse/showroom/total |
| `brands` | Brand catalog | ultra_id, name, slug, logo_url |
| `categories` | Product categories | ultra_id, name, parent_id, sort_order, product_count |
| `exchange_rates` | Currency rates | currency_code, rate |
| `sync_logs` | Sync audit trail | counts, status, duration, error_message, *_inserted, *_updated |
| `sync_step_details` | Per-step sync tracking | sync_log_id, step_number, extracted, inserted, updated, failed |

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
| `/brands` | Brands management with advanced filtering, sorting, bulk selection, and status toggles |
| `/brands/[id]` | Brand detail with statistics, products preview, admin actions |
| `/categories` | Categories management with table view, search, filters, bulk selection, and status toggles |
| `/categories/[id]` | Category detail with statistics, products preview, subcategories, admin actions |
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
- **Enhanced Brands Management Page** (Nov 2025): Comprehensive brand management with filtering, sorting, and bulk actions
  - **Advanced Filtering**:
    - Product count filter: All brands / With products / Without products
    - Status filter: All / Active / Inactive (admin CMS shows all brands by default)
    - Sort options: Name A-Z, Name Z-A, Most products, Least products
    - Search with debounced input (500ms)
    - Filter state persisted in URL query params
    - Clear all filters button
  - **Bulk Selection**: Select brands across all pages
    - Checkbox in header to select/deselect all on current page
    - Individual checkboxes for each brand row
    - "Select all X matching brands" option for filter-based bulk operations
    - Selection banner shows count: "X brands selected" or "All X matching brands selected"
    - Selection preserved during pagination when selectAllMode is active
  - **Bulk Actions Toolbar**: Appears when items are selected
    - Activate Selected (green button with Power icon)
    - Deactivate Selected (red button with PowerOff icon)
    - Clear Selection button
    - Supports both ID-based and filter-based bulk updates
  - **Stats Cards**: Updated based on filters
    - Total Brands shows filtered count with "(filtered)" indicator
    - With Logos shows count on current page
    - Displayed shows current page count of total
  - **Backend Support**: New API parameters and endpoints
    - `GET /api/v1/brands?has_products=true|false&is_active=true|false&sort_by=name_asc|name_desc|products_desc|products_asc`
    - `PATCH /api/v1/brands/bulk` supports both `{ ids: [...], is_active: true }` and `{ filter: { search, has_products, is_active }, is_active: true }`
  - **Repository Functions**:
    - `ListBrandsWithSearch(ctx, search, hasProducts, isActive, sortBy, limit, offset)`
    - `CountBrandsWithSearch(ctx, search, hasProducts, isActive)`
    - `BulkUpdateBrandsByFilter(ctx, search, hasProducts, isActiveFilter, isActive)`
- **Enhanced Categories Management Page** (Nov 2025): Comprehensive category management matching brands page functionality
  - **Table View**: Replaced hierarchical tree with table for better management
    - Checkbox column for selection
    - Image/Icon column (shows category image or FolderTree icon)
    - Name column (links to detail page)
    - Parent column (shows parent name or "Root" badge)
    - Products column (badge with product count)
    - Active column (toggle switch)
    - Actions column (dropdown menu)
  - **Advanced Filtering**:
    - Product count filter: All / With Products / No Products
    - Status filter: All / Active / Inactive
    - Sort options: Name A-Z, Name Z-A, Most Products, Least Products
    - Search by name with debounced input (500ms)
    - Filter state persisted in URL query params
    - Clear all filters button
  - **Bulk Selection**: Select categories across all pages
    - Checkbox in header to select/deselect all on current page
    - Individual checkboxes for each category row
    - "Select all X matching categories" option for filter-based bulk operations
    - Selection banner shows count with Activate/Deactivate buttons
  - **Stats Cards**: Total Categories, Root Categories, Displayed
  - **Category Detail Page** (`/categories/[id]`): Comprehensive category view
    - Header with category name, parent info, active toggle
    - Stats cards: Total/Active/In Stock/With Prices products
    - Category information card with copyable IDs and UUIDs
    - Subcategories list (if any) with links
    - Admin actions: View All Products, Activate/Deactivate All Products, Delete Category
    - Products table with pagination showing name, code, price range, stock, active status
  - **Backend Support**: New API parameters and endpoints
    - `GET /api/v1/categories?search=...&has_products=true|false&is_active=true|false&sort_by=...`
    - `PATCH /api/v1/categories/bulk` supports both ID-based and filter-based updates
    - `GET /api/v1/categories/{id}/stats` - Category with product statistics
    - `GET /api/v1/categories/{id}/products` - Paginated products in category
    - `PATCH /api/v1/categories/{id}/products/bulk` - Bulk update category products
    - `GET /api/v1/categories/{id}/subcategories` - Child categories
  - **Repository Functions**:
    - `ListCategoriesWithSearch(ctx, search, hasProducts, isActive, sortBy, limit, offset)`
    - `CountCategoriesWithSearch(ctx, search, hasProducts, isActive)`
    - `BulkUpdateCategoriesByFilter(ctx, search, hasProducts, isActiveFilter, isActive)`
    - `GetCategoryWithStats(ctx, id)` - Returns CategoryWithStats with product statistics
    - `GetProductsByCategoryID(ctx, categoryID, limit, offset)`
    - `CountProductsByCategoryID(ctx, categoryID)`
    - `BulkUpdateProductsByCategoryID(ctx, categoryID, isActive)`
    - `GetSubcategories(ctx, parentID)`
    - `CountRootCategories(ctx)`
  - **TypeScript Types**:
    - `CategoryWithStats` - Category with product statistics
    - `CategoryProduct` - Simplified product for category details
    - `CategoryFilterOptions` - Filter options interface
    - `BulkUpdateCategoriesByFilterPayload` - Bulk update by filter
    - `BulkUpdateCategoriesByIdsPayload` - Bulk update by IDs
  - **Models Update**: Added `ParentName` field to Category model
- **Enhanced Sync Status Page**: Real-time sync progress with:
  - Step-by-step progress indicators (7 steps)
  - Change deltas per step: "X extracted", "+Y added, Z updated"
  - Auto-refresh (1s when running, 30s when idle)
  - Detailed statistics with change breakdown
  - Database totals comparison
  - Sync history with pagination
- **Global Currency Selector**: Switch between MDL, EUR, USD currencies
  - Persists selection in localStorage
  - Updates all product prices across the app
  - Located in sidebar footer
- **Product Variant Display**: Enhanced two-level variant selector on product detail page
  - **Color Selector**: Shows unique colors (e.g., "Jet Black", "Blue Shadow", "Silver Shadow")
  - **Memory Selector**: Filtered by selected color (e.g., 256GB, 512GB, 1TB)
  - Parses variant info from product names (handles "12/256Gb", "16/1Tb" formats)
  - Shows stock indicators and prices per variant
  - Uses variant_group_id for grouping related products
- **Product Detail Page Enhancements**: Comprehensive data display for admin CMS
  - **JSON View Button**: Shows full raw JSON data (product, properties, characteristics, variants)
  - **All Currency Prices**: MDL, EUR, USD columns with price_min/max
  - **Technical Details**: All UUIDs, flags (is_active, is_group, is_service), timestamps
  - **Characteristics Table**: Code, Ultra ID, stock (warehouse/showroom/total), prices per currency
  - **Properties with Tabs**: Grouped by group_name with filter/modification badges
  - **Full-width Layout**: All sections displayed as single-column full-width cards
  - **Performance Optimizations**: useMemo for groupedProperties, stock calculations, currencies
- **Comprehensive Product Detail Page** (Nov 2025): Complete admin view of ALL product data
  - **All Currency Prices**: MDL, EUR, USD displayed with min/max ranges
  - **Raw JSONB Data**: Collapsible view of raw price array for debugging
  - **Technical Details Card**: All IDs (UUID, Ultra ID, Brand ID, Category ID, Parent ID, Variant Group ID)
  - **All Product Flags**: is_active, is_group, is_service, is_in_stock with badge indicators
  - **Warranty Information**: Displayed with Shield icon
  - **Full Timestamps**: Created/Updated with formatted datetime
  - **Characteristics Table**: Complete SKU data with code, Ultra ID, warehouse/showroom/total stock, per-variant prices
  - **Enhanced Properties Table**: Grouped by category with tabs, value_type badges, is_filter and is_modification flags
  - **Copyable Fields**: All IDs, codes, and barcodes have copy-to-clipboard buttons
  - **Status Indicators**: CheckCircle/XCircle icons for boolean flags
- **Brand Details Page** (Nov 2025): Full admin CMS controls for brand management
  - **Brand Information Card**: Logo, name, slug, Ultra ID, UUID (copyable), timestamps, status toggle
  - **Statistics Cards**: Total products, active products, in stock products, with prices products
  - **Products Table with Full Pagination**: Complete products management within brand page
    - Pagination controls (Previous/Next, page X of Y)
    - 10 products per page with total count display
    - Clickable product names linking to product detail
    - Code column with monospace font
    - Price MDL column with formatted currency ("No price" badge if null)
    - Stock status badges (green "X in stock" or red "Out of stock")
    - Active status toggle switch for each product
    - Actions dropdown menu per product:
      - View Details (link to /products/{id})
      - Activate/Deactivate toggle
      - Delete with confirmation dialog
  - **Admin Actions**: Activate/deactivate all brand products, delete brand
  - **Bulk Operations**: One-click activate/deactivate all products belonging to brand
  - **Confirmation Dialogs**: Confirmations for all destructive actions
  - **Toast Notifications**: Success/error feedback for all operations
- **Brands List Product Count Fix** (Nov 2025):
  - Added `product_count` field to Brand model
  - Updated `ListBrandsWithSearch()` query to include LEFT JOIN with products table
  - Counts only active products per brand
  - Displays accurate product counts in brands table
- **Shadcn Theme Migration** (Nov 2025): Brand and category detail pages now fully use shadcn theming
  - **Replaced all hardcoded colors** with semantic theme variables (text-primary, bg-accent, bg-muted, etc.)
  - **Badge components** now use proper variants (default, secondary, outline, destructive) instead of custom colors
  - **Stats cards** use text-primary for numbers instead of hardcoded green/blue/purple
  - **Bulk actions bar** uses bg-accent instead of custom blue backgrounds
  - **Table row hover** uses bg-muted/50 for consistent theme-aware hover states
  - **Pagination** uses bg-muted/50 and bg-card instead of hardcoded gray/white
  - **Complete theme consistency**: All components now respond to theme changes automatically
  - **Files updated**: `src/app/brands/[id]/page.tsx`, `src/app/categories/[id]/page.tsx`
  - **Code review score**: 9.2/10 with no critical issues, production-ready

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
| `src/components/variant-selector.tsx` | Two-level color/memory variant selector with parsing logic |
| `src/app/products/[id]/page.tsx` | Comprehensive product detail page with all data fields |
| `src/app/brands/page.tsx` | Enhanced brands table with search, filters, bulk selection |
| `src/app/brands/[id]/page.tsx` | Brand details page with stats, products preview, admin actions |
| `src/app/categories/page.tsx` | Enhanced categories table with search, filters, bulk selection |
| `src/app/categories/[id]/page.tsx` | Category details page with stats, products, subcategories, admin actions |

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
GET    /api/v1/brands                        # List brands (supports ?search=, ?has_products=true|false, ?is_active=true|false, ?sort_by=name_asc|name_desc|products_desc|products_asc)
GET    /api/v1/brands/{id}                   # Get brand details
GET    /api/v1/brands/{id}/stats             # Get brand with product statistics
GET    /api/v1/brands/{id}/products          # Get paginated products for brand
PATCH  /api/v1/brands/{id}/products/bulk     # Bulk activate/deactivate brand products
POST   /api/v1/brands                        # Create brand
PUT    /api/v1/brands/{id}                   # Update brand
DELETE /api/v1/brands/{id}                   # Soft delete brand

# Categories
GET    /api/v1/categories                    # List categories (with search/filters)
GET    /api/v1/categories/{id}               # Get category details
GET    /api/v1/categories/{id}/stats         # Get category with product statistics
GET    /api/v1/categories/{id}/products      # Get paginated products in category
GET    /api/v1/categories/{id}/subcategories # Get child categories
PATCH  /api/v1/categories/bulk               # Bulk update categories (by IDs or filter)
PATCH  /api/v1/categories/{id}/products/bulk # Bulk update all products in category
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
?search=apple                             # Brand name search (ILIKE)
?has_products=true|false                  # Brand filter: with/without products
?sort_by=name_asc|name_desc|products_desc|products_asc  # Brand sort options
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

### Dashboard Statistics Fix (Nov 2025)

The dashboard was showing incorrect "Prices" count (displaying 460 instead of the actual price count).

**Issue**: The backend `DashboardStats` struct didn't include a `total_prices` field, so the frontend was using `total_characteristics` (460) as a workaround proxy.

**Fix**: Added `total_prices` field to count products with prices in their JSONB arrays.

**Location**:
- `internal/repository/repository.go` (DashboardStats struct and query)
- `internal/handlers/handlers.go` (DashboardStats struct)
- `admin-intelect/src/lib/api.ts` (removed proxy workaround)

```go
// New query in GetDashboardStats
(SELECT COUNT(*) FROM products WHERE is_active = true AND jsonb_array_length(prices) > 0) as total_prices
```

**Result**: Dashboard now shows accurate count of products with prices (approximately 36,683) instead of the characteristics count (460).

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

3. **Variant Grouping**: Products can be grouped by base name (e.g., iPhone 256GB/512GB/1TB, Fold7 in all colors/sizes)
   ```sql
   -- GroupProductVariants uses multi-step regex for various formats
   -- Step 1: Remove RAM/Storage patterns like "12/256Gb", "16/1Tb"
   -- Step 2: Remove standalone storage like ", 512GB", " 256GB"
   -- Step 3: Remove multi-word colors (Jet Black, Blue Shadow, etc.)
   -- Step 4: Remove single-word colors (Black, White, Silver, etc.)
   -- Step 5: Replace commas with space
   -- Step 6: Clean up multiple spaces
   trim(regexp_replace(
       regexp_replace(
           regexp_replace(
               regexp_replace(
                   regexp_replace(
                       regexp_replace(name, '\d+/\d+\s*(Gb|Tb|GB|TB)', '', 'gi'),
                       ',?\s*\d+\s*(GB|TB)', '', 'gi'
                   ),
                   '\s+(Jet Black|Blue Shadow|Silver Shadow|...)\s*$', '', 'gi'  -- Multi-word colors
               ),
               '\s+(Black|White|Silver|...)\s*$', '', 'gi'  -- Single-word colors
           ),
           ',\s*', ' ', 'g'
       ),
       '\s+', ' ', 'g'
   )) as base_name
   ```

   **Stats**: 7,737 products grouped into variant groups (includes color+storage combinations)

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

### Enhanced Sync Status Page with Change Deltas (Nov 2025)

The sync status page shows accurate extraction counts and change deltas instead of misleading ratios.

**Features:**

1. **Real-Time Progress**: Updates every 1 second when sync is running
2. **Step-by-Step Tracking**: All 7 sync steps with extraction counts
3. **Change Deltas**: Shows "+X added, Y updated" for each step
4. **Accurate Counts**: Shows actual extracted counts, not misleading X/Y ratios
5. **Premium UI**: Redesigned with animations, gradients, and polished styling

**Backend Endpoint**: `GET /api/v1/sync/progress`

Returns comprehensive sync progress with change deltas:
```json
{
  "isRunning": true,
  "currentStep": 4,
  "elapsedSeconds": 1200,
  "estimatedRemainingSeconds": 900,
  "steps": [
    {"name": "Brands", "status": "completed", "extracted": 1133, "inserted": 5, "updated": 1128},
    {"name": "Categories", "status": "completed", "extracted": 297, "inserted": 3, "updated": 294},
    {"name": "Products", "status": "completed", "extracted": 48316, "inserted": 127, "updated": 48189},
    {"name": "Properties", "status": "running", "extracted": 500000, "inserted": 54, "updated": 499946}
  ],
  "brandsSynced": 1133,
  "brandsInserted": 5,
  "brandsUpdated": 1128,
  "categoriesSynced": 297,
  "categoriesInserted": 3,
  "categoriesUpdated": 294
}
```

**Migration File:** `migrations/005_sync_step_details.sql`

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
