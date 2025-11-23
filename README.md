# Ultra B2B Data Sync

A Go application for fetching and storing the complete Ultra B2B product catalog with properties and characteristics (variants).

## Features

- **Complete Ultra API Integration**: Fetches ALL services (Products, Brands, Categories, Prices, Stock, Rates)
- **Malformed XML Handling**: Automatically fixes broken XML from the API
- **Normalized Database**: Products, Properties, and Characteristics in separate tables
- **Full REST API**: CRUD operations, bulk actions, CSV export, dashboard stats
- **Property Hierarchy Management**: 3-level drill-down (Groups → Names → Values) for 876k+ properties with deletion impact preview
- **Multi-Currency Support**: MDL (primary), EUR, USD pricing with automatic extraction
- **Product Variant Grouping**: Auto-links related products (e.g., storage variants)
- **Complete Audit Trail**: Tracks every sync with detailed metrics
- **CMS Dashboard**: Next.js admin panel with global currency selector (see `admin-intelect/`)

## Quick Start

### Prerequisites

- Go 1.21+
- PostgreSQL 14+
- Ultra B2B API credentials

### Setup

```bash
# Create database
createdb ultra-data

# Run migration
psql -d ultra-data -f migrations/003_ultra_data_schema.sql

# Configure
cp .env.example .env
# Edit .env with your credentials
```

Required in `.env`:
```bash
DB_NAME=ultra-data
DB_PASSWORD=your_postgres_password

ULTRA_API_URL=https://portal.it-ultra.com/b2b/ws/b2b.1cws
ULTRA_API_USERNAME=your_username
ULTRA_API_PASSWORD=your_password
```

### Run

```bash
# Install dependencies
go mod download

# Run sync (fetches all data from Ultra API)
go run cmd/sync/main.go

# Start REST API server
go run cmd/unified-api/main.go
```

## Sync Process

The sync performs 7 steps:

1. **Brands** - Downloads all brands with logos (1,133)
2. **Categories** - Downloads category hierarchy (418)
3. **Products** - Downloads products with images, barcodes, and characteristics (48,316)
4. **Properties** - Fetches properties per category (876,081 total, ~35 min)
5. **Prices** - Updates prices for characteristics (36,682)
6. **Stock** - Updates stock levels (15,488)
7. **Exchange Rates** - Current rates

**Post-Processing (Automatic):**
- Extract multi-currency prices (MDL, EUR, USD) from JSONB
- Group product variants by name similarity

### Expected Output

```
=== Ultra B2B Data Sync Tool ===
Configuration loaded
Database connected

Testing Ultra API connection...
Ultra API connection successful
Sync started (ID: xxx)

Starting data synchronization...

--- Step 1/7: Fetching Brands ---
Fetched 1133 brands
Saved 1133 brands to database

--- Step 2/7: Fetching Categories ---
Fetched 418 categories
Saved 418 categories to database

--- Step 3/7: Fetching Products ---
Fetched 48316 products
Saved 48316 products to database
Saved 460 characteristics to database

--- Step 4/7: Fetching Properties ---
Fetching properties for category: Smartphones (500 products)
...

=== Sync Summary ===
Duration: 2715 seconds
Status: success
Brands: 1133
Categories: 418
Products: 48316
Properties: 876081
Characteristics: 460
Prices: 36682
Stock: 15488
```

## Database Schema

### Tables

| Table | Records | Purpose |
|-------|---------|---------|
| `products` | 48,316 | Main product catalog |
| `properties` | 876,081 | Product specifications (linked to products) |
| `characteristics` | 460 | Product variants/SKUs with prices and stock |
| `brands` | 1,133 | Brand catalog |
| `categories` | 418 | Product categories |
| `exchange_rates` | 3 | Currency rates |
| `sync_logs` | - | Audit trail |

### Key Relationships

```
brands ──┐
         ├── products ── properties
categories┘      │
                 └── characteristics (with prices & stock)
```

### Properties vs Characteristics

- **Properties**: Technical specifications (e.g., "Storage: 32GB", "Weight: 3g")
- **Characteristics**: Product variants with their own prices and stock (e.g., "Black 256GB", "White 128GB")

## REST API

Server runs on `http://localhost:8080`

### Core Endpoints

```bash
# Products
GET    /api/v1/products                      # List products
GET    /api/v1/products/{id}                 # Get product details
GET    /api/v1/products/{id}/properties      # Get product specifications
GET    /api/v1/products/{id}/characteristics # Get product variants
GET    /api/v1/products/{id}/variants        # Get related variants (same product group)
POST   /api/v1/products                      # Create product
PUT    /api/v1/products/{id}                 # Update product
DELETE /api/v1/products/{id}                 # Soft delete product

# Brands
GET    /api/v1/brands                        # List brands (supports ?search=)
GET    /api/v1/brands/{id}                   # Get brand details
POST   /api/v1/brands                        # Create brand
PUT    /api/v1/brands/{id}                   # Update brand
DELETE /api/v1/brands/{id}                   # Soft delete brand

# Categories
GET    /api/v1/categories                    # List categories
GET    /api/v1/categories/{id}               # Get category with children
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
GET /api/v1/dashboard/stock-summary          # Stock by category
GET /api/v1/dashboard/price-summary          # Price distribution

# Sync Management
GET /api/v1/sync/logs                        # List sync logs (paginated)
GET /api/v1/sync/logs/{id}                   # Get sync log details
GET /api/v1/sync/status                      # Latest sync status

# Bulk Operations
PATCH  /api/v1/products/bulk                 # Bulk update products
DELETE /api/v1/products/bulk                 # Bulk delete products
PATCH  /api/v1/brands/bulk                   # Bulk update brands
PATCH  /api/v1/categories/bulk               # Bulk update categories

# Export
GET /api/v1/export/products?format=csv       # Export products
GET /api/v1/export/brands?format=csv         # Export brands
GET /api/v1/export/categories?format=csv     # Export categories

# Config & Health
GET /api/v1/config                           # Application configuration
GET /api/v1/health                           # Health check
```

### Query Parameters

- `limit` - Results per page (default: 50, max: 100)
- `offset` - Pagination offset
- `brand_id` - Filter by brand UUID
- `category_id` - Filter by category UUID
- `in_stock` - Filter in-stock products (true/false)
- `min_price` / `max_price` - Price range filter
- `search` - Brand name search (case-insensitive ILIKE)

### Examples

```bash
# Get 10 products
curl "http://localhost:8080/api/v1/products?limit=10"

# Get product properties
curl "http://localhost:8080/api/v1/products/{id}/properties"

# Search for products
curl "http://localhost:8080/api/v1/search?q=iphone"

# Filter in-stock products with price range
curl "http://localhost:8080/api/v1/products?in_stock=true&min_price=100&max_price=500"
```

## Project Structure

```
ultra-api-testing/
├── cmd/
│   ├── sync/main.go           # Main sync application
│   └── unified-api/main.go    # REST API server
├── internal/
│   ├── config/config.go       # Configuration management
│   ├── database/db.go         # Database connection pool
│   ├── models/models.go       # Data models
│   ├── repository/repository.go # Database operations
│   ├── handlers/handlers.go   # HTTP request handlers
│   └── ultra/
│       ├── client.go          # SOAP API client
│       ├── parser.go          # XML parser (fixes malformed XML)
│       └── fetcher.go         # Service fetchers
├── migrations/
│   └── 003_ultra_data_schema.sql  # Database schema
├── .env.example               # Example environment file
└── README.md
```

## Querying Data

### SQL Examples

```sql
-- Connect
psql -d ultra-data

-- Product with properties
SELECT p.name, pr.property_name, pr.value, pr.group_name
FROM products p
JOIN properties pr ON pr.product_id = p.id
WHERE p.code = '62949'
LIMIT 10;

-- Product variants with prices
SELECT p.name, c.name as variant, c.prices, c.stock_total
FROM products p
JOIN characteristics c ON c.product_id = p.id
LIMIT 10;

-- Products with most properties
SELECT p.name, count(pr.id) as prop_count
FROM products p
JOIN properties pr ON pr.product_id = p.id
GROUP BY p.id, p.name
ORDER BY prop_count DESC
LIMIT 10;

-- Count all tables
SELECT 'brands' as tbl, count(*) FROM brands
UNION SELECT 'categories', count(*) FROM categories
UNION SELECT 'products', count(*) FROM products
UNION SELECT 'properties', count(*) FROM properties
UNION SELECT 'characteristics', count(*) FROM characteristics;
```

## Troubleshooting

### Database Connection Failed

```
Failed to connect to database: connection refused
```

Ensure PostgreSQL is running:
```bash
pg_ctl status
pg_ctl start
```

### Ultra API Authentication Failed

```
SOAP fault: Server.Unauthorized
```

Verify credentials in `.env`:
- `ULTRA_API_USERNAME`
- `ULTRA_API_PASSWORD`

### Slow Sync

Properties fetch takes ~35 minutes (418 categories, ~5 sec each). This is expected due to API rate limits.

## Development

```bash
# Run tests
go test ./...

# Build binary
go build -o bin/ultra-sync cmd/sync/main.go

# Run binary
./bin/ultra-sync
```

## License

MIT
