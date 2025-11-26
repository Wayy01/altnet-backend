# Ultra B2B Data Sync

Go application for syncing Ultra B2B product catalog to PostgreSQL with a Next.js admin dashboard.

## Features

- **SOAP API Integration** - Syncs products, brands, categories, prices, stock, exchange rates
- **REST API** - Full CRUD, bulk operations, CSV export, dashboard stats
- **Property Hierarchy** - 3-level drill-down for 876k+ properties (Groups → Names → Values)
- **Product Groupings** - 2-level hierarchy for variants (Parent Products → Variants)
- **Selective Sync** - Choose steps/fields, real-time monitoring with SSE streaming
- **Rollback System** - Point-in-time recovery with snapshots
- **Multi-Currency** - MDL, EUR, USD pricing with automatic extraction
- **CMS Dashboard** - Next.js 14 admin panel (see `admin-intelect/`)

## Quick Start

```bash
# Prerequisites: Go 1.23+, PostgreSQL 14+, Node.js/Bun

# Database setup
createdb ultra-data
psql -d ultra-data -f migrations/003_ultra_data_schema.sql

# Configure
cp .env.example .env
# Edit .env with credentials

# Run sync
go run cmd/sync/main.go

# Start API (port 8080)
go run cmd/unified-api/main.go

# Start dashboard (port 3000)
cd admin-intelect && bun install && bun dev
```

## Configuration (.env)

```bash
DB_NAME=ultra-data
DB_PASSWORD=your_password
ULTRA_API_URL=https://portal.it-ultra.com/b2b/ws/b2b.1cws
ULTRA_API_USERNAME=your_username
ULTRA_API_PASSWORD=your_password
ROLLBACK_SECRET_KEY=your-secret-key-min-32-chars
```

## Database Schema

| Table | Records | Description |
|-------|---------|-------------|
| products | 48,316 | Product catalog |
| properties | 876,081 | Product specifications |
| brands | 1,133 | Brand catalog |
| categories | 418 | Category hierarchy |
| sync_* | - | Sync management tables |

## API Endpoints

### Core Resources
```
GET/POST/PUT/DELETE /api/v1/products[/{id}]
GET/POST/PUT/DELETE /api/v1/brands[/{id}]
GET/POST/PUT/DELETE /api/v1/categories[/{id}]
```

### Product Details
```
GET /api/v1/products/{id}/properties
GET /api/v1/products/{id}/characteristics
GET /api/v1/products/{id}/variants
```

### Sync Operations
```
GET  /api/v1/sync/logs|status|progress|schemas
POST /api/v1/sync/selective
POST /api/v1/sync/rollback
GET  /api/v1/sync/stream/progress|logs (SSE)
```

### Other
```
GET   /api/v1/search?q=query
GET   /api/v1/dashboard/stats
GET   /api/v1/export/{products|brands|categories}?format=csv
PATCH /api/v1/{products|brands|categories}/bulk
```

### Query Parameters
- `limit`, `offset` - Pagination
- `brand_id`, `category_id` - Filters
- `in_stock`, `min_price`, `max_price` - Product filters
- `search` - Text search

## Project Structure

```
├── cmd/
│   ├── sync/main.go          # Sync application
│   └── unified-api/main.go   # REST API server
├── internal/
│   ├── config/               # Environment config
│   ├── database/             # PostgreSQL (pgx)
│   ├── models/               # Data structures
│   ├── repository/           # Database operations
│   ├── handlers/             # REST handlers
│   ├── sync/                 # Selective sync engine
│   └── ultra/                # SOAP client/parser
├── admin-intelect/           # Next.js dashboard
└── migrations/               # SQL schemas
```

## License

MIT
