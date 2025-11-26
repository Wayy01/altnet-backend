# CLAUDE.md

## Project
Go 1.23 Ultra B2B product data management. SOAP API to PostgreSQL to REST API.
Database: `ultra-data`

## Commands
```bash
go run cmd/sync/main.go         # Main sync from Ultra API
go run cmd/unified-api/main.go  # API server :8080
cd admin-intelect && bun dev    # Dashboard :3000
```

## Database Schema
```
brands (1,112) --> products (47,227) <-- categories (418)
                        |
                   properties (852,343)
                   groupings (parent_id self-ref)
```

**Core Tables**: products, properties, brands, categories, product_sources, exchange_rates
**Sync Tables**: sync_logs, sync_configurations, sync_changes, sync_snapshots, sync_rollbacks

## API Endpoints

### Products
- GET/POST/PUT/DELETE `/api/v1/products[/{id}]`
- GET `/api/v1/products/{id}/properties|variants`
- PATCH `/api/v1/products/bulk`
- GET `/api/v1/products/groupings/hierarchy/*`

### Brands & Categories
- GET/POST/PUT/DELETE `/api/v1/brands[/{id}]`
- GET/POST/PUT/DELETE `/api/v1/categories[/{id}]`
- PATCH `/api/v1/{brands|categories}/bulk`

### Sync
- GET `/api/v1/sync/logs|status|schemas`
- POST `/api/v1/sync/selective`
- GET/POST `/api/v1/sync/configs`
- POST `/api/v1/sync/rollback`

### Sources
- GET/POST/DELETE `/api/v1/sources[/{id}]`
- GET `/api/v1/sources/default`

### Other
- GET `/api/v1/search?q=`
- GET `/api/v1/dashboard/stats`
- GET `/api/v1/export/{products|brands|categories}?format=csv`

## Packages
- `internal/config` - Environment config
- `internal/database` - PostgreSQL (pgx)
- `internal/models` - Data structures, field schemas
- `internal/repository` - CRUD operations
- `internal/ultra` - SOAP client/parser
- `internal/handlers` - REST handlers
- `internal/sync` - Selective sync engine

## Dashboard Pages
- `/` - Dashboard statistics
- `/products[/{id}]` - Product management with create/edit/duplicate
- `/brands[/{id}]` - Brand management
- `/categories[/{id}]` - Category management
- `/properties` - 3-level hierarchy: Groups to Names to Values
- `/groupings` - Product variant groupings (parent_id relationships)
- `/sync[/selective|/configs|/changes]` - Sync operations
- `/settings` - Configuration

## Key Features
- Products use direct `brand_id`/`category_id`/`source_id` UUID foreign keys
- Product sources track origin (Ultra sync vs manual entry); default "Ultra" cannot be deleted
- Field schemas define allowed fields per sync step (SQL injection prevention)
- Selective sync with field-level change tracking, auto-sets source to Ultra
- Rollback system with snapshots
- Real-time sync monitoring via SSE

## Configuration (.env)
```
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=password
DB_NAME=ultra-data
ULTRA_API_URL=https://portal.it-ultra.com/b2b/ws/b2b.1cws
ULTRA_API_USERNAME=username
ULTRA_API_PASSWORD=password
ROLLBACK_SECRET_KEY=your-secret-key-min-32-chars
```

## Build Requirements
- Go 1.23
- PostgreSQL
- Node.js/bun
- Next.js 14+
