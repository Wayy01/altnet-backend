# CLAUDE.md

Go 1.23 Ultra B2B product data management system. Syncs product catalog from Ultra SOAP API to PostgreSQL, exposes REST API, with Next.js admin dashboard.

## Commands
```bash
go run cmd/sync/main.go         # Full sync from Ultra API
go run cmd/unified-api/main.go  # API server :8080
cd admin-intelect && bun dev    # Dashboard :3000
```

## Database Schema

### Core Tables
| Table | Description | Key Columns |
|-------|-------------|-------------|
| `brands` | Brand catalog | `ultra_id`, `name`, `slug`, `logo_url`, `is_active` |
| `categories` | Hierarchical categories | `ultra_id`, `parent_id`, `name`, `slug`, `sort_order`, `name_ru`, `name_ro` |
| `products` | Product catalog | `ultra_id`, `brand_id`, `category_id`, `source_id`, `prices` (JSONB), `price_mdl/eur/usd`, `total_stock`, `variant_group_id`, `name_ru/ro`, `description_ru/ro` |
| `properties` | Product specs | `product_id`, `property_name`, `value`, `group_name`, `is_filter`, `property_name_ru/ro`, `group_name_ru/ro` |
| `characteristics` | SKU variants | `product_id`, `ultra_id`, `name`, `prices` (JSONB), `stock_warehouse/showroom/total` |
| `product_sources` | Origin tracking | `name`, `is_default`, `is_deletable` - default "Ultra" source cannot be deleted |
| `exchange_rates` | Currency rates | `currency_code`, `rate` |

### Sync System Tables
| Table | Description |
|-------|-------------|
| `sync_logs` | High-level sync run records with counts and deltas |
| `sync_step_details` | Per-step metrics (extracted/inserted/updated/failed) with real-time progress |
| `sync_configurations` | Saved selective sync configs (steps + field config) |
| `sync_changes` | Field-level change tracking per entity |
| `sync_schedules` | Cron-based scheduled syncs with timezone support |
| `sync_schedule_runs` | Execution history per schedule |
| `sync_entity_filters` | Include/exclude filters for sync (by brand/category/price/stock) |
| `sync_performance_metrics` | Per-step timing and throughput metrics |
| `sync_log_entries` | Real-time log stream (debug/info/warn/error) |
| `sync_progress_snapshots` | Progress snapshots for monitoring |
| `sync_api_requests` | Logged Ultra API requests/responses |

### Translation Tables
| Table | Description |
|-------|-------------|
| `translation_jobs` | Batch translation jobs (products/categories/properties to ru/ro) |
| `translation_logs` | Per-field translation results |

### Relationships
```
brands (1) --> (*) products <-- (1) categories
                    |
                    +--> (*) properties
                    +--> (*) characteristics
                    +--> (1) product_sources
                    +--> (?) variant_group_id (self-ref for groupings)
```

## API Endpoints

### Products `/api/v1/products`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List with filters: `brand_id`, `category_id`, `source_id`, `in_stock`, `min_price`, `max_price`, `search` |
| GET | `/{id}` | Get with brand/category/properties/characteristics |
| POST | `/` | Create product |
| PUT | `/{id}` | Update product |
| DELETE | `/{id}` | Delete product |
| PATCH | `/bulk` | Bulk update by IDs or filters |
| DELETE | `/bulk` | Bulk delete |
| GET | `/{id}/properties` | Product properties |
| GET | `/{id}/characteristics` | Product variants/SKUs |
| GET | `/{id}/variants` | Product variants |
| GET | `/groupings/hierarchy/groups` | List variant groups |
| GET | `/groupings/hierarchy/groups/{id}` | Get group with variants |
| DELETE | `/groupings/hierarchy/groups/{id}` | Delete group (unlinks variants) |
| POST | `/groupings/trigger` | Trigger auto-grouping by article |

### Brands `/api/v1/brands`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List with `search`, `has_products`, `is_active`, `sort_by` |
| GET | `/all` | All brands (for dropdowns) |
| GET | `/{id}` | Get brand |
| GET | `/{id}/stats` | Brand with product counts |
| GET | `/{id}/products` | Brand's products with filters |
| POST | `/` | Create brand |
| PUT | `/{id}` | Update brand |
| DELETE | `/{id}` | Delete brand |
| PATCH | `/bulk` | Bulk update |
| PATCH | `/{id}/products/bulk` | Bulk update brand's products |

### Categories `/api/v1/categories`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List hierarchical with `parent_id`, `search` |
| GET | `/all` | All categories (for dropdowns) |
| GET | `/{id}` | Get category |
| GET | `/{id}/stats` | Category with product counts |
| GET | `/{id}/products` | Category's products |
| GET | `/{id}/subcategories` | Child categories |
| POST | `/` | Create category |
| PUT | `/{id}` | Update category |
| DELETE | `/{id}` | Delete category |
| PATCH | `/bulk` | Bulk update |
| PATCH | `/{id}/products/bulk` | Bulk update category's products |

### Properties `/api/v1/properties`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List with `product_id`, `group_name`, `property_name`, `search` |
| GET | `/stats` | Property statistics |
| GET | `/groups` | Distinct property groups |
| GET | `/{id}` | Get property |
| POST | `/` | Create property |
| PUT | `/{id}` | Update property |
| DELETE | `/{id}` | Delete property |
| PATCH | `/bulk` | Bulk update |
| DELETE | `/bulk` | Bulk delete |
| **Hierarchy** | | |
| GET | `/hierarchy/groups` | Level 1: List groups |
| GET | `/hierarchy/groups/{group_name}` | Get group details |
| DELETE | `/hierarchy/groups/{group_name}` | Delete group (all properties) |
| GET | `/hierarchy/groups/{group_name}/properties` | Level 2: Properties in group |
| DELETE | `/hierarchy/groups/{group_name}/properties/{property_name}` | Delete property name |
| GET | `/hierarchy/groups/{group_name}/properties/{property_name}/values` | Level 3: Values |
| PATCH | `/hierarchy/groups/{group_name}/properties/{property_name}/values/bulk` | Bulk update values |

### Characteristics `/api/v1/characteristics`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/hierarchy/names` | Level 1: Distinct characteristic names |
| GET | `/hierarchy/names/{name}` | Get name details |
| DELETE | `/hierarchy/names/{name}` | Delete all with name |
| GET | `/hierarchy/names/{name}/values` | Level 2: Values for name |
| PUT | `/hierarchy/values/{id}` | Update characteristic |
| DELETE | `/hierarchy/values/{id}` | Delete characteristic |

### Sources `/api/v1/sources`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List sources |
| GET | `/default` | Get default source (Ultra) |
| GET | `/{id}` | Get source |
| POST | `/` | Create source |
| DELETE | `/{id}` | Delete source (not default) |

### Sync `/api/v1/sync`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/logs` | List sync logs |
| GET | `/logs/{id}` | Get sync log details |
| GET | `/status` | Latest sync status |
| GET | `/progress` | Current sync progress |
| GET | `/schemas` | Field schemas for all steps |
| POST | `/selective` | Execute selective sync |
| POST | `/validate` | Validate sync config |
| POST | `/{id}/cancel` | Cancel running sync |
| GET | `/{id}/changes` | Field-level changes |
| GET | `/{id}/summary` | Change summary |
| **Configs** | | |
| GET | `/configs` | List saved configs |
| POST | `/configs` | Create config |
| GET | `/configs/{id}` | Get config |
| PUT | `/configs/{id}` | Update config |
| DELETE | `/configs/{id}` | Delete config |
| **Schedules** | | |
| GET | `/schedules` | List schedules |
| POST | `/schedules` | Create schedule (cron + config) |
| GET | `/schedules/{id}` | Get schedule |
| PUT | `/schedules/{id}` | Update schedule |
| DELETE | `/schedules/{id}` | Delete schedule |
| POST | `/schedules/{id}/toggle` | Enable/disable schedule |
| GET | `/schedules/{id}/runs` | Schedule run history |
| POST | `/schedules/{id}/test` | Test schedule execution |
| GET | `/scheduler/status` | Scheduler status |
| **Filters** | | |
| GET | `/filters` | List sync filters |
| POST | `/filters` | Create filter (include/exclude criteria) |
| GET | `/filters/{id}` | Get filter |
| PUT | `/filters/{id}` | Update filter |
| DELETE | `/filters/{id}` | Delete filter |
| POST | `/filters/{id}/toggle` | Enable/disable filter |
| POST | `/filters/{id}/test` | Test filter (show matching count) |
| GET | `/filters/entity-types` | Available entity types & fields |
| GET | `/filters/active` | Active filters |
| **Analytics** | | |
| GET | `/analytics` | Performance summary |
| GET | `/analytics/metrics` | Performance metrics |
| GET | `/analytics/trends` | Historical trends |
| GET | `/analytics/bottlenecks` | Slow steps |
| GET | `/analytics/by-step` | Stats per step |
| GET | `/analytics/throughput` | Throughput stats |
| **Real-time (SSE)** | | |
| GET | `/stream/progress` | SSE sync progress stream |
| GET | `/stream/logs` | SSE log stream |
| GET | `/realtime/progress` | Current progress data |
| GET | `/realtime/logs` | Log entries |

### Translation `/api/v1/translate`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/stats` | Translation coverage stats |
| GET | `/jobs` | List translation jobs |
| GET | `/jobs/{id}` | Get job details |
| POST | `/start` | Start translation job (entity_type, target_language) |
| POST | `/jobs/{id}/cancel` | Cancel running job |
| GET | `/jobs/{id}/logs` | Job translation logs |
| GET | `/stream/{id}` | SSE translation progress |

### Other
| Method | Path | Description |
|--------|------|-------------|
| GET | `/search?q=` | Full-text product search |
| GET | `/dashboard/stats` | Dashboard statistics |
| GET | `/dashboard/stock-summary` | Stock summary by brand |
| GET | `/dashboard/price-summary` | Price distribution stats |
| GET | `/export/{products\|brands\|categories}?format=csv` | CSV export |
| POST | `/upload/image` | Upload single image |
| POST | `/upload/images` | Upload multiple images |
| POST | `/upload/video` | Upload video |
| GET | `/config` | Server configuration |

## Internal Packages

| Package | Description |
|---------|-------------|
| `config` | Environment config loading (DB, Ultra API, LibreTranslate) |
| `database` | PostgreSQL connection pool (pgx) |
| `models` | Data structures, JSONB types, field schemas, sync step enum |
| `repository` | CRUD operations, bulk operations, hierarchy queries, filtering |
| `ultra` | SOAP client (requestData/isReady/getDataByID), XML parser, data fetcher |
| `handlers` | REST handlers for all endpoints |
| `sync` | Selective sync engine, scheduler, filter applier, metrics recorder |
| `translate` | LibreTranslate integration, job manager, batch translation executor |
| `constants` | Sync step constants |

## Dashboard Pages

| Path | Description |
|------|-------------|
| `/` | Dashboard with stats, recent syncs, low stock alerts |
| `/products` | Product list with filters, bulk actions |
| `/products/new` | Create product (tabs: basic info, properties, media, variants) |
| `/products/{id}` | Product detail view |
| `/products/{id}/edit` | Edit product |
| `/brands` | Brand list with bulk actions |
| `/brands/{id}` | Brand detail with products |
| `/categories` | Category tree with bulk actions |
| `/categories/{id}` | Category detail with products |
| `/properties` | Property hierarchy browser (groups -> names -> values) |
| `/characteristics` | Characteristic hierarchy (names -> values) |
| `/groupings` | Product variant groupings |
| `/sync` | Sync overview and history |
| `/sync/selective` | Run selective sync (step/field selection) |
| `/sync/configs` | Manage saved sync configurations |
| `/sync/changes` | Browse sync changes |
| `/sync/monitor` | Real-time sync monitoring |
| `/sync/schedules` | Manage scheduled syncs |
| `/sync/filters` | Manage sync entity filters |
| `/sync/analytics` | Sync performance analytics |
| `/translate` | Translation management |
| `/translate/jobs` | Translation job list |
| `/translate/jobs/{id}` | Job details |
| `/settings` | Application settings |

## Key Patterns

1. **UUID everywhere**: All entities use UUID primary keys, Ultra API IDs stored in `ultra_id`
2. **Source tracking**: All products have `source_id` FK to `product_sources`; selective sync auto-sets to "Ultra" source
3. **Field schemas**: `models/field_schemas.go` defines allowed sync fields per step (SQL injection prevention)
4. **Sync steps**: `brands`, `categories`, `products`, `properties`, `prices`, `stock`, `exchange_rates`
5. **JSONB arrays**: `images`, `videos`, `barcodes`, `prices` stored as JSONB arrays
6. **Multi-currency**: Products have `price_mdl`, `price_eur`, `price_usd` + `prices` JSONB
7. **Translations**: `name_ru`, `name_ro`, `description_ru`, `description_ro` columns on translatable entities
8. **Variant grouping**: `parent_id` self-reference + `variant_group_id` for product variants
9. **Real-time monitoring**: SSE endpoints for sync progress and log streaming
10. **Cancellation support**: `SyncManager` allows cancelling running syncs

## Configuration (.env)
```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=password
DB_NAME=ultra-data
DB_SSLMODE=disable

# Ultra SOAP API
ULTRA_API_URL=https://portal.it-ultra.com/b2b/ws/b2b.1cws
ULTRA_API_USERNAME=username
ULTRA_API_PASSWORD=password
ULTRA_API_TIMEOUT=60s
ULTRA_API_POLL_INTERVAL=5s
ULTRA_API_POLL_TIMEOUT=5m

# Server
SERVER_PORT=8080
LOG_LEVEL=info

# Translation
LIBRETRANSLATE_URL=http://localhost:5000

# Scheduler (optional)
ENABLE_SCHEDULER=true
```

## Sync Steps
| Step | Data | Notes |
|------|------|-------|
| `brands` | Brand catalog | ~1,100 brands |
| `categories` | Category tree | ~420 categories, hierarchical |
| `products` | Product catalog | ~47,000 products |
| `properties` | Product specs | ~850,000 properties (slow, ~40min) |
| `prices` | Multi-currency prices | Updates characteristics.prices |
| `stock` | Inventory levels | Updates warehouse/showroom/total stock |
| `exchange_rates` | Currency rates | MDL, EUR, USD rates |

## Filter System
Filters support operators: `equals`, `not_equals`, `contains`, `not_contains`, `greater_than`, `less_than`, `in`, `not_in`, `is_null`, `is_not_null`
Entity types: `products`, `brands`, `categories`
Logic: `AND`, `OR` combination of conditions
