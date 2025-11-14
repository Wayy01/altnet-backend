# Ultra B2B API Testing Tool

A comprehensive Go application for fetching and testing data from the IT-Ultra B2B SOAP API with a flexible multi-source database architecture.

## Features

- ✅ **Complete Ultra API Integration**: Fetches ALL services (NOMENCLATURE, BRAND, PRICELIST, BALANCE, RATES)
- ✅ **Malformed XML Handling**: Automatically fixes broken XML from the API
- ✅ **Multi-Source Architecture**: Database designed to handle multiple data sources (Ultra, Intelect, etc.)
- ✅ **Automatic Unification**: Smart matching and deduplication across sources
- ✅ **Complete Audit Trail**: Tracks every sync with detailed metrics
- ✅ **Graceful Degradation**: Continues even if optional services fail
- ✅ **SOAP Client**: Full implementation of all 7 Ultra API functions

## Quick Start

### 1. Prerequisites

- Go 1.21+
- PostgreSQL 14+
- Ultra B2B API credentials

### 2. Setup Database

```bash
# Create database
createdb api-testing

# Run migration
psql api-testing < migrations/001_multi_source_architecture.sql
```

### 3. Configure

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your credentials
nano .env
```

Required environment variables:
```bash
# Database
DB_PASSWORD=your_postgres_password
DB_NAME=api-testing

# Ultra API
ULTRA_API_URL=https://portal.it-ultra.com/b2b/ru/ws/b2b.1cws?wsdl
ULTRA_API_USERNAME=your_ultra_username
ULTRA_API_PASSWORD=your_ultra_password
```

### 4. Run

```bash
# Install dependencies
go mod download

# Run the sync
go run cmd/sync/main.go
```

## What It Does

The tool performs a complete synchronization of the Ultra B2B catalog:

### Step-by-Step Process

1. **Test Connection** - Verifies Ultra API is reachable
2. **Fetch Brands** - Downloads all brands with logos
3. **Fetch Categories** - Downloads hierarchical category tree
4. **Fetch Products** - Downloads complete product catalog with:
   - Product details (name, code, article)
   - Characteristics (variants)
   - Properties (attributes)
   - Images (auto-constructs CDN URLs)
   - Barcodes
5. **Fetch Prices** - Multi-currency pricing data
6. **Fetch Stock** - Warehouse + showroom stock levels
7. **Fetch Rates** - Current exchange rates

### Expected Output

```
=== Ultra B2B API Testing Tool ===
✓ Configuration loaded
✓ Database connected
✓ Ultra source found (ID: xxx, Priority: 80)

📡 Testing Ultra API connection...
✓ Ultra API connection successful
✓ Sync run created (ID: xxx)

🚀 Starting data synchronization...

--- Step 1/6: Fetching Brands ---
Fetching BRAND service...
✓ Fetched 250 brands
✓ Saved 250 brands to database

--- Step 2/6: Fetching Categories ---
Fetching NOMENCLATURETYPELIST service...
✓ Fetched 450 categories
✓ Saved 450 categories to database

--- Step 3/6: Fetching Products ---
Fetching NOMENCLATURE service...
✓ Fetched 5420 products
✓ Saved 5420 products to database (4890 with images)

--- Step 4/6: Fetching Prices ---
Fetching PRICELIST service...
✓ Fetched prices for 5200 products
✓ Updated prices for 5200 products

--- Step 5/6: Fetching Stock ---
Fetching BALANCE service...
✓ Fetched stock for 5100 products
✓ Updated stock for 5100 products

--- Step 6/6: Fetching Exchange Rates ---
Fetching RATES service...
✓ Fetched 3 exchange rates

✅ Sync completed successfully!

=== Sync Summary ===
Duration: 180 seconds
Status: success
Brands: 250
Categories: 450
Products: 5420
  - With Prices: 5200
  - With Stock: 5100
  - With Images: 4890
```

## Database Architecture

### Design Philosophy

The database uses a **source-agnostic architecture** where adding new data sources requires **ZERO schema changes**.

### Key Tables

| Table | Purpose |
|-------|---------|
| `data_sources` | Registry of all sources (Ultra, Intelect, etc.) |
| `brand_sources` | Original brand data from each source |
| `brands` | Unified brands across all sources |
| `category_sources` | Original category data from each source |
| `categories` | Unified categories with LTREE hierarchy |
| `product_sources` | Original product data from each source |
| `products` | Unified products with merged prices/stock |
| `entity_matches` | Tracks how entities are matched across sources |
| `sync_runs` | Complete audit trail of all syncs |

### Adding a New Source

Simply INSERT into `data_sources` table:

```sql
INSERT INTO data_sources (
    source_code, source_name, source_type, priority
) VALUES (
    'amazon', 'Amazon MWS API', 'api', 70
);
```

The system automatically:
- Creates `brand_sources`, `category_sources`, `product_sources` entries
- Matches entities to unified tables
- Resolves conflicts using priority

See [`DATABASE_ARCHITECTURE.md`](DATABASE_ARCHITECTURE.md) for complete documentation.

## Project Structure

```
ultra-api-testing/
├── cmd/
│   └── sync/
│       └── main.go              # Main application entry point
├── internal/
│   ├── config/
│   │   └── config.go            # Configuration management
│   ├── database/
│   │   └── db.go                # Database connection pool
│   ├── models/
│   │   └── models.go            # Data models (Brand, Product, etc.)
│   ├── repository/
│   │   └── repository.go        # Database operations
│   └── ultra/
│       ├── client.go            # SOAP API client
│       ├── parser.go            # XML parser (handles malformed XML)
│       └── fetcher.go           # Service fetchers
├── migrations/
│   └── 001_multi_source_architecture.sql  # Database schema
├── .env.example                 # Example environment file
├── go.mod                       # Go module definition
├── DATABASE_ARCHITECTURE.md     # Database design docs
└── README.md                    # This file
```

## API Services

The tool supports **ALL** Ultra B2B API services:

| Service | API Name | Implemented | Notes |
|---------|----------|-------------|-------|
| Products | `NOMENCLATURE` | ✅ | Complete with variants, images, properties |
| Brands | `BRAND` | ✅ | Includes logos |
| Categories | `NOMENCLATURETYPELIST` | ✅ | Hierarchical structure |
| Prices | `PRICELIST` | ✅ | Multi-currency support |
| Stock | `BALANCE` | ✅ | Warehouse + showroom |
| Exchange Rates | `RATES` | ✅ | Current rates |
| Properties | `PROPERTIES` | ⏸️ | Skipped (30min fetch, mostly empty) |
| Parent List | `PARENTLIST` | ⏸️ | Not yet needed |
| Order Status | `ORDERSSTAT` | ⏸️ | Future enhancement |

## Querying the Data

### Get All Products from Ultra

```sql
SELECT
    ps.name,
    ps.code,
    ps.prices,
    ps.stock,
    ps.images
FROM product_sources ps
JOIN data_sources ds ON ds.id = ps.source_id
WHERE ds.source_code = 'ultra'
  AND ps.is_active = true
LIMIT 10;
```

### Get Products with Prices and Stock

```sql
SELECT
    ps.name,
    ps.code,
    ps.prices->>'prices' as prices,
    ps.stock->>'total' as total_stock
FROM product_sources ps
WHERE ps.prices IS NOT NULL
  AND ps.stock IS NOT NULL
ORDER BY ps.name
LIMIT 20;
```

### Get Sync History

```sql
SELECT
    ds.source_name,
    sr.started_at,
    sr.status,
    sr.duration_seconds,
    sr.products_with_data,
    sr.products_with_prices,
    sr.products_with_stock
FROM sync_runs sr
JOIN data_sources ds ON ds.id = sr.source_id
ORDER BY sr.started_at DESC
LIMIT 10;
```

## Troubleshooting

### Database Connection Failed

```
Failed to connect to database: connection refused
```

**Solution**: Ensure PostgreSQL is running and credentials in `.env` are correct.

```bash
# Check PostgreSQL status
pg_ctl status

# Start PostgreSQL
pg_ctl start
```

### Ultra API Authentication Failed

```
SOAP fault: Server.Unauthorized - Invalid credentials
```

**Solution**: Verify `ULTRA_API_USERNAME` and `ULTRA_API_PASSWORD` in `.env`.

### XML Parsing Errors

```
failed to parse XML: invalid character entity
```

**Solution**: The parser should automatically fix malformed XML. If you see this error, the API returned unusually broken XML. Check `internal/ultra/parser.go` for additional patterns to fix.

### Slow Sync (>10 minutes)

The sync should complete in 2-5 minutes for a typical catalog. If slower:

- Check network connection to Ultra API
- Verify `ULTRA_API_POLL_INTERVAL` is set to 5s (not 1s)
- Ensure PostgreSQL has adequate resources

## Development

### Run Tests

```bash
go test ./...
```

### Build Binary

```bash
go build -o bin/ultra-sync cmd/sync/main.go
```

### Run Binary

```bash
./bin/ultra-sync
```

## Future Enhancements

- [ ] Automatic entity matching/unification
- [ ] Incremental sync (fetch only changed data)
- [ ] Web dashboard for viewing synced data
- [ ] REST API for querying unified catalog
- [ ] Real-time webhooks from Ultra
- [ ] ML-based product matching across sources
- [ ] Parallel fetching of services
- [ ] Export to CSV/JSON

## License

MIT

## Support

For issues or questions:
1. Check existing GitHub issues
2. Review `DATABASE_ARCHITECTURE.md` for schema questions
3. Verify `.env` configuration
4. Check PostgreSQL logs: `tail -f /var/log/postgresql/postgresql-XX-main.log`
