# CLAUDE.md

## Project
Go 1.23 Ultra B2B product data management. SOAP API → PostgreSQL → REST API.
Database: `ultra-data`

## Development Workflow
**When user says "New task"** (unless specified otherwise), execute this workflow automatically:
1. Use `@agent-full-stack-architect` for feature implementation
2. Use `@senior-code-reviewer` for initial code review
3. If rating < 9.5 → use `@agent-architecture-refactorer` to fix issues
4. Re-review with `@senior-code-reviewer`
5. Update docs (CLAUDE.md max 10 lines concise, README.md feature bullet)
6. Create git commits only if rating ≥ 9.5

## Commands
```bash
make install        # Complete setup
make run           # Run sync
make dev           # Clean/build/run
make db-reset      # Reset database
go run cmd/sync/main.go         # Main sync
go run cmd/unified-api/main.go  # API server :8080
cd admin-intelect && bun dev    # Dashboard :3000
```

## Database Schema
```
brands (1,133) → products (48,316) ← categories (418)
                     ↓
            properties (876,081)
            characteristics (460)
```

**Tables**: products, properties, characteristics, brands, categories, exchange_rates, sync_logs, sync_step_details, sync_configurations, sync_changes, sync_snapshots, sync_snapshot_data, sync_rollbacks, sync_conflicts, sync_conflict_rules, sync_schedules, sync_filters, sync_notifications

## API Endpoints

### Products
- GET/POST/PUT/DELETE `/api/v1/products[/{id}]`
- GET `/api/v1/products/{id}/properties|characteristics|variants`
- PATCH `/api/v1/products/bulk`

### Brands
- GET/POST/PUT/DELETE `/api/v1/brands[/{id}]`
- GET `/api/v1/brands/{id}/stats|products`
- PATCH `/api/v1/brands[/{id}/products]/bulk`

### Categories
- GET/POST/PUT/DELETE `/api/v1/categories[/{id}]`
- GET `/api/v1/categories/{id}/stats|products|subcategories`
- PATCH `/api/v1/categories[/{id}/products]/bulk`

### Sync
- GET `/api/v1/sync/logs|status|progress|schemas`
- GET/POST/PUT/DELETE `/api/v1/sync/configs[/{id}]`
- POST `/api/v1/sync/selective|validate|selective-enhanced`
- GET `/api/v1/sync/{id}/changes|summary`
- GET `/api/v1/sync/rollback/preview/{sync_log_id}`
- POST `/api/v1/sync/rollback`
- GET `/api/v1/sync/rollback/{id}`
- GET `/api/v1/sync/rollbacks`
- POST `/api/v1/sync/compare`
- GET `/api/v1/sync/conflicts[/{id}]`
- POST `/api/v1/sync/conflicts/resolve`
- GET/POST/PUT/DELETE `/api/v1/sync/conflict-rules[/{id}]`

### Other
- GET `/api/v1/search?q=`
- GET `/api/v1/dashboard/stats|stock-summary|price-summary`
- GET `/api/v1/export/{products|brands|categories}?format=csv`
- GET `/api/v1/config|health`

**Query Params**: limit, offset, brand_id, category_id, in_stock, min_price, max_price, search, has_products, is_active, sort_by

## Packages
- `internal/config` - Environment config
- `internal/database` - PostgreSQL (pgx)
- `internal/models` - Data structures (including Phase 4 models)
- `internal/repository` - CRUD operations (rollback, comparison, conflict repos)
- `internal/ultra` - SOAP client/parser
- `internal/handlers` - REST handlers (including Phase 4 handlers)
- `internal/sync` - Selective sync engine
- `internal/constants` - Constants for Phase 4 (batch sizes, timeouts, error messages)

## Dashboard Pages
- `/` - Statistics, alerts
- `/products[/{id}]` - Product management
- `/brands[/{id}]` - Brand management
- `/categories[/{id}]` - Category management
- `/properties` - 3-level hierarchy: Groups (111) → Names (~1,925) → Values (876k+)
- `/sync[/selective|/configs|/changes]` - Sync operations
- `/settings` - Configuration

## Property Hierarchy (9.6/10 - Production Ready)
3-level navigation for 876k+ properties. Level 1: Groups → Level 2: Names → Level 3: Values. Features: SQL injection prevention via field whitelisting, ACID transactions for bulk operations, 30s context timeouts on all handlers, row count validation, deletion impact preview. Backend: Go with pgx, 5 custom PostgreSQL indexes, MODE() aggregates. Frontend: Next.js 14, TypeScript type-safe, shadcn/ui components. API: `/api/v1/properties/hierarchy/*`. All critical security and reliability issues resolved.

## Selective Sync System

### Phases Complete
1. **Phase 1** (9.5/10): Foundation, security, field whitelists
2. **Phase 2** (9.5/10): REST API, field schemas, execution engine
3. **Phase 3** (9.8/10): Frontend UI (configs, selective, changes pages)
4. **Phase 4** (9.6/10): Advanced features - rollback, comparison, conflict resolution

### Key Tables
- `sync_configurations` - Reusable templates
- `sync_changes` - Field-level change tracking
- `sync_logs` - Enhanced with selected_steps, field_config
- `sync_snapshots` - Pre-sync backups for rollback
- `sync_snapshot_data` - Partitioned entity snapshots (by type)
- `sync_rollbacks` - Rollback execution tracking
- `sync_conflicts` - Conflict detection and resolution
- `sync_conflict_rules` - Auto-resolution rules with priority
- `sync_schedules` - Scheduled sync jobs (cron)
- `sync_filters` - Advanced entity-level filtering
- `sync_notifications` - Alert configuration

### Sync Steps
brands, categories, products, properties, prices, stock, exchange_rates

### Field Control
- Include/exclude field lists per step
- Field whitelists prevent SQL injection
- Change tracking with before/after values

### Phase 4 Features (Production-Ready)
- **Rollback System**: One-click rollback to any snapshot with confirmation hash
- **Sync Comparison**: Field-level diff between local DB and Ultra API
- **Conflict Resolution**: Auto-detect conflicts with rule-based resolution
- **Thread-Safe Caching**: 5-min TTL cache with invalidation on updates
- **Transaction Safety**: REPEATABLE READ isolation for consistent snapshots
- **Batch Processing**: 1000-item chunks prevent memory exhaustion
- **Security**: HMAC-SHA256 hashing, SQL injection prevention, input validation

## Configuration (.env)
```
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
ROLLBACK_SECRET_KEY=your-secret-key-min-32-chars  # Required for Phase 4 rollback security
DB_PASSWORD=password
DB_NAME=ultra-data
DB_SSLMODE=disable
ULTRA_API_URL=https://portal.it-ultra.com/b2b/ws/b2b.1cws
ULTRA_API_USERNAME=username
ULTRA_API_PASSWORD=password
```

## Key Fixes
- **is_active**: Defaults true unless explicitly false
- **Multi-currency**: Prices array order [EUR, USD, MDL]
- **Route order**: Bulk routes before parameterized
- **CORS**: Applied before routes
- **N+1 queries**: Fixed with batch queries

## Sync Process
1. Brands → 2. Categories → 3. Products → 4. Properties → 5. Prices → 6. Stock → 7. Exchange Rates
Post: Extract multi-currency prices, Group product variants

## Frontend Components
- `step-selector.tsx` - Step selection UI
- `field-config-modal.tsx` - Field configuration
- `change-log-viewer.tsx` - Change history
- `sync-utils.ts` - Validation utilities

## Build Requirements
- Go 1.23
- PostgreSQL
- Node.js/bun
- Next.js 14+
- shadcn/ui