# Ultra Data API

<div align="center">

![Go Version](https://img.shields.io/badge/Go-1.23+-00ADD8?style=for-the-badge&logo=go&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-336791?style=for-the-badge&logo=postgresql&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=next.js&logoColor=white)
![License](https://img.shields.io/badge/License-Private-red?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Production-success?style=for-the-badge)

**Enterprise B2B Product Data Management System**

*SOAP API to PostgreSQL to REST API Pipeline with Admin Dashboard*

---

[Features](#-features) | [Quick Start](#-quick-start) | [API Reference](#-api-endpoints) | [Dashboard](#-admin-dashboard) | [Architecture](#-architecture)

</div>

---

## Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Quick Start](#-quick-start)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Database Schema](#-database-schema)
- [API Endpoints](#-api-endpoints)
- [Admin Dashboard](#-admin-dashboard)
- [Sync Engine](#-sync-engine)
- [Translation Service](#-translation-service)
- [Scheduler](#-scheduler)
- [Project Structure](#-project-structure)
- [Commands Reference](#-commands-reference)
- [Contributing](#-contributing)

---

## Overview

Ultra Data API is a comprehensive Go-based backend system designed for B2B e-commerce product data management. It synchronizes product catalogs from an external Ultra B2B SOAP API into a PostgreSQL database and exposes the data through a modern REST API. The system includes a full-featured Next.js admin dashboard for data management and monitoring.

**Key Capabilities:**
- Real-time product catalog synchronization from Ultra B2B SOAP API
- Selective sync with field-level change tracking and audit trails
- Multi-currency pricing support (MDL, EUR, USD)
- Product variant grouping and hierarchy management
- Automated translation via LibreTranslate integration
- Scheduled sync operations with cron-style expressions
- Real-time sync monitoring via Server-Sent Events (SSE)
- Comprehensive admin dashboard with dark mode support

---

## Features

### Data Synchronization
- **Full Sync**: Complete catalog synchronization (Brands, Categories, Products, Properties, Prices, Stock, Exchange Rates)
- **Selective Sync**: Choose specific steps and fields to sync
- **Field-Level Tracking**: Audit trail for every field change
- **Cancellation Support**: Graceful sync cancellation with state preservation
- **Retry Logic**: Automatic retry with exponential backoff

### Product Management
- **Hierarchical Categories**: Parent-child category relationships
- **Product Variants**: SKU/characteristic management with grouping
- **Multi-Currency Pricing**: MDL, EUR, USD price tracking
- **Stock Management**: Warehouse and showroom inventory tracking
- **Property System**: 3-level hierarchy (Groups > Names > Values)

### API Features
- **RESTful Design**: Clean, consistent API structure
- **Pagination**: Offset-based pagination with configurable limits
- **Filtering**: Filter by brand, category, stock status, price range
- **Search**: Full-text product search
- **Bulk Operations**: Batch update/delete support
- **Export**: CSV export for products, brands, categories

### Admin Dashboard
- **Real-time Monitoring**: SSE-powered sync progress tracking
- **CRUD Operations**: Full management for all entities
- **Visual Analytics**: Sync performance charts and metrics
- **Dark Mode**: System-aware theme switching
- **Responsive Design**: Mobile-friendly interface

---

## Tech Stack

### Backend
| Technology | Purpose | Version |
|------------|---------|---------|
| **Go** | Primary backend language | 1.23+ |
| **Gorilla Mux** | HTTP router | 1.8.1 |
| **pgx/v5** | PostgreSQL driver | 5.5.1 |
| **godotenv** | Environment configuration | 1.5.1 |
| **google/uuid** | UUID generation | 1.5.0 |
| **gosimple/slug** | URL slug generation | 1.15.0 |

### Database
| Technology | Purpose | Version |
|------------|---------|---------|
| **PostgreSQL** | Primary database | 16+ |
| **JSONB** | Flexible data storage | - |
| **Table Partitioning** | Snapshot data optimization | - |

### Frontend (Admin Dashboard)
| Technology | Purpose | Version |
|------------|---------|---------|
| **Next.js** | React framework | 16.0.3 |
| **React** | UI library | 19.2.0 |
| **TypeScript** | Type safety | 5.x |
| **Tailwind CSS** | Styling | 3.4.17 |
| **Radix UI** | Component primitives | Various |
| **Recharts** | Data visualization | 2.15.4 |
| **Lucide React** | Icons | 0.555.0 |
| **Sonner** | Toast notifications | 2.0.7 |

### External Services
| Service | Purpose |
|---------|---------|
| **Ultra B2B SOAP API** | Product data source |
| **LibreTranslate** | Translation service |

---

## Quick Start

### Prerequisites
- Go 1.23 or higher
- PostgreSQL 16 or higher
- Node.js 20+ with Bun
- Docker (optional, for LibreTranslate)

### 1. Clone and Setup
```bash
git clone <repository-url>
cd testing-ground

# Copy environment file
cp .env.example .env
```

### 2. Configure Environment
Edit `.env` with your credentials:
```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=ultra-data

ULTRA_API_URL=https://portal.it-ultra.com/b2b/ws/b2b.1cws
ULTRA_API_USERNAME=your_username
ULTRA_API_PASSWORD=your_password
```

### 3. Setup Database
```bash
# Create database
createdb ultra-data

# Run migrations (in order)
psql -d ultra-data -f migrations/001_multi_source_architecture.sql
# ... continue with remaining migrations
```

### 4. Start Services

**Backend API Server:**
```bash
go run cmd/unified-api/main.go
# Server starts at http://localhost:8080
```

**Admin Dashboard:**
```bash
cd admin-intelect
bun install
bun dev
# Dashboard available at http://localhost:3000
```

---

## Installation

### Detailed Setup

#### 1. Install Go Dependencies
```bash
go mod download
```

#### 2. Build Binaries
```bash
# Build API server
go build -o bin/unified-api cmd/unified-api/main.go

# Build sync tool
go build -o bin/sync cmd/sync/main.go
```

#### 3. Database Migrations
Run migrations in sequence:
```bash
# Core schema
psql -d ultra-data -f migrations/003_ultra_data_schema.sql

# Multi-currency support
psql -d ultra-data -f migrations/004_multi_currency_variants.sql

# Sync system
psql -d ultra-data -f migrations/005_sync_step_details.sql
psql -d ultra-data -f migrations/006_selective_sync_system.sql

# Advanced features
psql -d ultra-data -f migrations/007_phase4_advanced_features.sql

# Indexes
psql -d ultra-data -f migrations/008_property_hierarchy_indexes.sql
psql -d ultra-data -f migrations/009_characteristic_hierarchy_indexes.sql

# Real-time logging
psql -d ultra-data -f migrations/009_real_time_sync_logging.sql

# Additional features
psql -d ultra-data -f migrations/010_product_grouping_indexes.sql
psql -d ultra-data -f migrations/011_product_videos_column.sql
psql -d ultra-data -f migrations/012_product_sources.sql
psql -d ultra-data -f migrations/013_source_id_not_null.sql
psql -d ultra-data -f migrations/014_translations.sql
```

#### 4. Frontend Setup
```bash
cd admin-intelect
bun install
```

---

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| **Database** | | |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_USER` | Database user | `postgres` |
| `DB_PASSWORD` | Database password | - |
| `DB_NAME` | Database name | `ultra-data` |
| `DB_SSLMODE` | SSL mode | `disable` |
| **Ultra API** | | |
| `ULTRA_API_URL` | SOAP API endpoint | - |
| `ULTRA_API_USERNAME` | API username | - |
| `ULTRA_API_PASSWORD` | API password | - |
| `ULTRA_API_TIMEOUT` | Request timeout | `60s` |
| `ULTRA_API_MAX_RETRIES` | Max retry attempts | `3` |
| **Server** | | |
| `SERVER_PORT` | HTTP server port | `8080` |
| `ENABLE_SCHEDULER` | Enable background scheduler | `false` |
| **Translation** | | |
| `LIBRETRANSLATE_URL` | LibreTranslate endpoint | `http://localhost:5555` |
| **Logging** | | |
| `LOG_LEVEL` | Log verbosity | `info` |
| `LOG_FORMAT` | Log format | `json` |

### Example .env File
```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password_here
DB_NAME=ultra-data
DB_SSLMODE=disable

# Ultra B2B API Configuration
ULTRA_API_URL=https://portal.it-ultra.com/b2b/ru/ws/b2b.1cws?wsdl
ULTRA_API_USERNAME=your_username_here
ULTRA_API_PASSWORD=your_password_here

# Ultra API Timeouts & Retry
ULTRA_API_TIMEOUT=60s
ULTRA_API_REQUEST_INTERVAL=1s
ULTRA_API_MAX_RETRIES=3
ULTRA_API_POLL_INTERVAL=5s
ULTRA_API_POLL_TIMEOUT=5m

# Server
SERVER_PORT=8080
ENABLE_SCHEDULER=true

# LibreTranslate
LIBRETRANSLATE_URL=http://localhost:5555

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
```

---

## Database Schema

### Entity Relationship Diagram

```
                                    +------------------+
                                    |     brands       |
                                    |------------------|
                                    | id (UUID, PK)    |
                                    | ultra_id (UNIQUE)|
                                    | name             |
                                    | slug (UNIQUE)    |
                                    | logo_url         |
                                    | is_active        |
                                    +--------+---------+
                                             |
                                             | 1:N
                                             v
+------------------+              +----------------------+              +------------------+
|   categories     |              |      products        |              | product_sources  |
|------------------|              |----------------------|              |------------------|
| id (UUID, PK)    |<------------>| id (UUID, PK)        |<------------>| id (UUID, PK)    |
| ultra_id (UNIQUE)|     N:1      | ultra_id (UNIQUE)    |     N:1      | name (UNIQUE)    |
| parent_id (FK)   |              | brand_id (FK)        |              | is_default       |
| name             |              | category_id (FK)     |              | is_deletable     |
| slug             |              | source_id (FK, REQ)  |              +------------------+
| is_active        |              | parent_id (FK)       |
| name_ru, name_ro |              | name, slug           |
+------------------+              | description          |
        |                         | price_min, price_max |
        | self-ref                | price_mdl/eur/usd    |
        v                         | total_stock          |
   (parent_id)                    | is_in_stock          |
                                  | name_ru, name_ro     |
                                  +----------+-----------+
                                             |
                         +-------------------+-------------------+
                         |                                       |
                         v 1:N                                   v 1:N
              +---------------------+                 +---------------------+
              |     properties      |                 |   characteristics   |
              |---------------------|                 |---------------------|
              | id (UUID, PK)       |                 | id (UUID, PK)       |
              | product_id (FK)     |                 | product_id (FK)     |
              | property_name       |                 | ultra_id            |
              | value               |                 | name                |
              | group_name          |                 | prices (JSONB)      |
              | is_filter           |                 | stock_warehouse     |
              | property_name_ru/ro |                 | stock_showroom      |
              | group_name_ru/ro    |                 | stock_total         |
              +---------------------+                 +---------------------+
```

### Core Tables

| Table | Records | Description |
|-------|---------|-------------|
| `brands` | ~1,112 | Product brands |
| `categories` | ~418 | Hierarchical product categories |
| `products` | ~47,227 | Product catalog |
| `properties` | ~852,343 | Product specifications (3-level hierarchy) |
| `characteristics` | Variable | Product variants/SKUs |
| `product_sources` | Few | Origin tracking (Ultra, Manual, etc.) |
| `exchange_rates` | Few | Currency conversion rates |

### Sync & Audit Tables

| Table | Description |
|-------|-------------|
| `sync_logs` | High-level sync operation records |
| `sync_step_details` | Per-step metrics and progress |
| `sync_configurations` | Saved sync presets/templates |
| `sync_changes` | Field-level change audit log |
| `sync_snapshots` | Pre-sync state for rollback |
| `sync_snapshot_data` | Partitioned snapshot storage |
| `sync_schedules` | Scheduled sync definitions |
| `sync_schedule_runs` | Schedule execution history |

### Translation Tables

| Table | Description |
|-------|-------------|
| `translation_jobs` | Translation job tracking |
| `translation_logs` | Per-item translation results |

---

## API Endpoints

Base URL: `http://localhost:8080/api/v1`

### Products

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/products` | List products with filtering |
| `GET` | `/products/{id}` | Get product details |
| `POST` | `/products` | Create new product |
| `PUT` | `/products/{id}` | Update product |
| `DELETE` | `/products/{id}` | Delete product |
| `PATCH` | `/products/bulk` | Bulk update products |
| `DELETE` | `/products/bulk` | Bulk delete products |
| `GET` | `/products/{id}/properties` | Get product properties |
| `GET` | `/products/{id}/characteristics` | Get product variants |
| `GET` | `/products/{id}/variants` | Get product variants |

**Query Parameters for `/products`:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | int | Results per page (default: 50, max: 100) |
| `offset` | int | Pagination offset |
| `brand_id` | UUID | Filter by brand |
| `category_id` | UUID | Filter by category |
| `in_stock` | bool | Filter by stock status |
| `min_price` | float | Minimum price filter |
| `max_price` | float | Maximum price filter |
| `search` | string | Search query |

### Brands

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/brands` | List brands (paginated) |
| `GET` | `/brands/all` | Get all brands |
| `GET` | `/brands/{id}` | Get brand details |
| `GET` | `/brands/{id}/stats` | Get brand with statistics |
| `GET` | `/brands/{id}/products` | Get brand's products |
| `POST` | `/brands` | Create brand |
| `PUT` | `/brands/{id}` | Update brand |
| `DELETE` | `/brands/{id}` | Delete brand |
| `PATCH` | `/brands/bulk` | Bulk update brands |
| `PATCH` | `/brands/{id}/products/bulk` | Bulk update brand products |

### Categories

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/categories` | List categories (hierarchical) |
| `GET` | `/categories/all` | Get all categories |
| `GET` | `/categories/{id}` | Get category details |
| `GET` | `/categories/{id}/stats` | Get category with statistics |
| `GET` | `/categories/{id}/products` | Get category products |
| `GET` | `/categories/{id}/subcategories` | Get subcategories |
| `POST` | `/categories` | Create category |
| `PUT` | `/categories/{id}` | Update category |
| `DELETE` | `/categories/{id}` | Delete category |
| `PATCH` | `/categories/bulk` | Bulk update categories |

### Properties

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/properties` | List properties |
| `GET` | `/properties/stats` | Property statistics |
| `GET` | `/properties/groups` | List property groups |
| `GET` | `/properties/{id}` | Get property |
| `POST` | `/properties` | Create property |
| `PUT` | `/properties/{id}` | Update property |
| `DELETE` | `/properties/{id}` | Delete property |
| `PATCH` | `/properties/bulk` | Bulk update |
| `DELETE` | `/properties/bulk` | Bulk delete |

#### Property Hierarchy (3-Level)

**Level 1 - Groups:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/properties/hierarchy/groups` | List all groups |
| `GET` | `/properties/hierarchy/groups/{group_name}` | Get group details |
| `DELETE` | `/properties/hierarchy/groups/{group_name}` | Delete group |
| `GET` | `/properties/hierarchy/groups/{group_name}/impact` | Deletion impact |

**Level 2 - Property Names:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/properties/hierarchy/groups/{group}/properties` | List properties in group |
| `GET` | `/properties/hierarchy/groups/{group}/properties/{name}` | Get property |
| `DELETE` | `/properties/hierarchy/groups/{group}/properties/{name}` | Delete property |

**Level 3 - Values:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/properties/hierarchy/groups/{group}/properties/{name}/values` | List values |
| `PATCH` | `/properties/hierarchy/groups/{group}/properties/{name}/values/bulk` | Bulk update |
| `DELETE` | `/properties/hierarchy/groups/{group}/properties/{name}/values/bulk` | Bulk delete |
| `PUT` | `/properties/hierarchy/values/{value_id}` | Update value |
| `DELETE` | `/properties/hierarchy/values/{value_id}` | Delete value |

### Product Groupings

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/products/groupings/hierarchy/groups` | List product groups |
| `GET` | `/products/groupings/hierarchy/groups/{id}` | Get group |
| `DELETE` | `/products/groupings/hierarchy/groups/{id}` | Delete group |
| `GET` | `/products/groupings/hierarchy/groups/{id}/variants` | List variants |
| `DELETE` | `/products/groupings/hierarchy/variants/{id}` | Remove variant |
| `PATCH` | `/products/groupings/hierarchy/variants/bulk` | Bulk update |
| `POST` | `/products/groupings/trigger` | Trigger auto-grouping |

### Sync Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/sync/logs` | List sync logs |
| `GET` | `/sync/logs/{id}` | Get sync log details |
| `GET` | `/sync/status` | Latest sync status |
| `GET` | `/sync/progress` | Current sync progress |
| `GET` | `/sync/schemas` | Get field schemas |
| `POST` | `/sync/selective` | Execute selective sync |
| `POST` | `/sync/validate` | Validate sync config |
| `GET` | `/sync/{id}/changes` | Get sync changes |
| `GET` | `/sync/{id}/summary` | Get change summary |
| `POST` | `/sync/{id}/cancel` | Cancel running sync |

#### Sync Configurations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/sync/configs` | List configurations |
| `GET` | `/sync/configs/{id}` | Get configuration |
| `POST` | `/sync/configs` | Create configuration |
| `PUT` | `/sync/configs/{id}` | Update configuration |
| `DELETE` | `/sync/configs/{id}` | Delete configuration |

#### Sync Schedules

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/sync/schedules` | List schedules |
| `GET` | `/sync/schedules/{id}` | Get schedule |
| `POST` | `/sync/schedules` | Create schedule |
| `PUT` | `/sync/schedules/{id}` | Update schedule |
| `DELETE` | `/sync/schedules/{id}` | Delete schedule |
| `POST` | `/sync/schedules/{id}/toggle` | Enable/disable |
| `GET` | `/sync/schedules/{id}/runs` | List runs |
| `POST` | `/sync/schedules/{id}/test` | Test schedule |
| `GET` | `/sync/scheduler/status` | Scheduler status |

#### Sync Filters

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/sync/filters` | List filters |
| `POST` | `/sync/filters` | Create filter |
| `GET` | `/sync/filters/entity-types` | Get entity types |
| `GET` | `/sync/filters/active` | Get active filters |
| `GET` | `/sync/filters/{id}` | Get filter |
| `PUT` | `/sync/filters/{id}` | Update filter |
| `DELETE` | `/sync/filters/{id}` | Delete filter |
| `POST` | `/sync/filters/{id}/toggle` | Toggle filter |
| `POST` | `/sync/filters/{id}/test` | Test filter |

#### Real-time Sync (SSE)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/sync/stream/progress` | SSE progress stream |
| `GET` | `/sync/stream/logs` | SSE log stream |
| `GET` | `/sync/realtime/progress` | Current progress |
| `GET` | `/sync/realtime/logs` | Recent logs |
| `GET` | `/sync/realtime/logs/export` | Export logs |
| `GET` | `/sync/realtime/snapshots` | Progress snapshots |
| `GET` | `/sync/realtime/api-requests` | API request logs |

#### Sync Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/sync/analytics` | Analytics summary |
| `GET` | `/sync/analytics/metrics` | Performance metrics |
| `GET` | `/sync/analytics/trends` | Trend analysis |
| `GET` | `/sync/analytics/bottlenecks` | Bottleneck detection |
| `GET` | `/sync/analytics/by-step` | Stats by step |
| `GET` | `/sync/analytics/throughput` | Throughput stats |
| `GET` | `/sync/analytics/export` | Export metrics |

### Sources

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/sources` | List sources |
| `GET` | `/sources/default` | Get default source |
| `GET` | `/sources/{id}` | Get source |
| `POST` | `/sources` | Create source |
| `DELETE` | `/sources/{id}` | Delete source |

### Translation

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/translate/stats` | Translation statistics |
| `GET` | `/translate/jobs` | List jobs |
| `GET` | `/translate/jobs/{id}` | Get job details |
| `POST` | `/translate/start` | Start translation job |
| `POST` | `/translate/jobs/{id}/cancel` | Cancel job |
| `GET` | `/translate/jobs/{id}/logs` | Get job logs |
| `GET` | `/translate/stream/{id}` | SSE progress stream |

### Search & Export

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/search?q={query}` | Search products |
| `GET` | `/export/products` | Export products (CSV) |
| `GET` | `/export/brands` | Export brands (CSV) |
| `GET` | `/export/categories` | Export categories (CSV) |

### Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/dashboard/stats` | Dashboard statistics |
| `GET` | `/dashboard/stock-summary` | Stock summary |
| `GET` | `/dashboard/price-summary` | Price summary |

### File Upload

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/upload/image` | Upload single image |
| `POST` | `/upload/images` | Upload multiple images |
| `POST` | `/upload/video` | Upload video |
| `DELETE` | `/upload/image/{uuid}` | Delete image |
| `DELETE` | `/upload/video/{uuid}` | Delete video |
| `GET` | `/upload/info/{type}/{uuid}` | Get upload info |

### Utility

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/config` | API configuration |

---

## Admin Dashboard

The admin dashboard is a Next.js application located in `admin-intelect/`.

### Dashboard Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard home with statistics and charts |
| `/products` | Product list with filtering and search |
| `/products/new` | Create new product |
| `/products/{id}` | View product details |
| `/products/{id}/edit` | Edit product |
| `/brands` | Brand management |
| `/brands/new` | Create new brand |
| `/brands/{id}` | Brand details |
| `/categories` | Category hierarchy management |
| `/categories/new` | Create new category |
| `/categories/{id}` | Category details |
| `/properties` | Property hierarchy (Groups > Names > Values) |
| `/properties/groups/{group_name}` | Property group details |
| `/properties/groups/{group}/properties/{name}` | Property name values |
| `/characteristics` | Characteristic management |
| `/characteristics/names/{name}` | Characteristic values |
| `/groupings` | Product variant groupings |
| `/groupings/{id}` | Group details |
| `/sync` | Sync overview and monitoring |
| `/sync/selective` | Selective sync execution |
| `/sync/configs` | Sync configuration management |
| `/sync/changes` | Change tracking and audit |
| `/sync/schedules` | Schedule management |
| `/sync/analytics` | Sync performance analytics |
| `/sync/filters` | Sync entity filters |
| `/sync/monitor` | Real-time sync monitoring |
| `/translate` | Translation dashboard |
| `/translate/jobs` | Translation job list |
| `/translate/jobs/{id}` | Job details |
| `/settings` | Application settings |

### Running the Dashboard

```bash
cd admin-intelect

# Install dependencies
bun install

# Development mode
bun dev

# Production build
bun build
bun start
```

### Frontend Environment

Create `admin-intelect/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8080
```

---

## Sync Engine

The sync engine is the core of the data pipeline, responsible for fetching data from the Ultra B2B SOAP API and storing it in PostgreSQL.

### Sync Steps

| Step | Description | Table(s) Affected |
|------|-------------|-------------------|
| `brands` | Sync brand catalog | `brands` |
| `categories` | Sync category hierarchy | `categories` |
| `products` | Sync product catalog | `products`, `characteristics` |
| `properties` | Sync product specifications | `properties` |
| `prices` | Update pricing data | `characteristics`, `products` |
| `stock` | Update inventory levels | `characteristics`, `products` |
| `exchange_rates` | Sync currency rates | `exchange_rates` |

### Full Sync

Run a complete synchronization:
```bash
go run cmd/sync/main.go
```

This executes all 7 steps in order:
1. Brands
2. Categories
3. Products (with characteristics)
4. Properties (per category)
5. Prices
6. Stock
7. Exchange Rates

### Selective Sync

Execute specific steps with field configuration via API:

```bash
curl -X POST http://localhost:8080/api/v1/sync/selective \
  -H "Content-Type: application/json" \
  -d '{
    "selected_steps": ["prices", "stock"],
    "field_config": {
      "prices": {
        "include_fields": ["price", "currency"]
      }
    }
  }'
```

### Sync Features

- **Field-Level Control**: Include or exclude specific fields per step
- **Change Tracking**: Every change is recorded for audit
- **Cancellation**: Syncs can be cancelled gracefully
- **Progress Monitoring**: Real-time progress via SSE
- **Retry Logic**: Automatic retry with exponential backoff
- **Source Tracking**: Products synced from Ultra are tagged with source

---

## Translation Service

The translation system integrates with LibreTranslate for multi-language support.

### Supported Languages
- Russian (ru)
- Romanian (ro)

### Translatable Entities
- Product names and descriptions
- Category names
- Property group names
- Property names

### Starting LibreTranslate

Using Docker:
```bash
docker run -d \
  --name libretranslate \
  -p 5555:5000 \
  -e LT_LOAD_ONLY=en,ru,ro \
  -e LT_CHAR_LIMIT=5000 \
  libretranslate/libretranslate
```

### Starting a Translation Job

```bash
curl -X POST http://localhost:8080/api/v1/translate/start \
  -H "Content-Type: application/json" \
  -d '{
    "entity_type": "products",
    "target_language": "ru"
  }'
```

### Translation Features
- Batch processing for efficiency
- Automatic language detection
- Cyrillic text detection (skips already-Russian text)
- Progress tracking via SSE
- Job cancellation support

---

## Scheduler

The scheduler enables automated sync operations using cron expressions.

### Enabling the Scheduler

Set environment variable:
```env
ENABLE_SCHEDULER=true
```

### Cron Expression Format

Standard 5-field cron format:
```
* * * * *
| | | | |
| | | | +-- Day of week (0-6, Sunday=0)
| | | +---- Month (1-12)
| | +------ Day of month (1-31)
| +-------- Hour (0-23)
+---------- Minute (0-59)
```

### Examples
| Expression | Description |
|------------|-------------|
| `0 2 * * *` | Daily at 2:00 AM |
| `0 */6 * * *` | Every 6 hours |
| `30 1 * * 1` | Mondays at 1:30 AM |
| `0 3 1 * *` | First of month at 3:00 AM |

### Creating a Schedule

```bash
curl -X POST http://localhost:8080/api/v1/sync/schedules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Nightly Full Sync",
    "cron_expression": "0 2 * * *",
    "timezone": "Europe/Chisinau",
    "configuration_id": "<sync-config-uuid>",
    "is_active": true
  }'
```

### Schedule Features
- Timezone-aware scheduling
- Automatic next-run calculation
- Run history tracking
- Manual trigger option
- Enable/disable toggle

---

## Project Structure

```
testing-ground/
|
|-- cmd/                          # Application entry points
|   |-- sync/                     # Full sync CLI tool
|   |   +-- main.go
|   |-- unified-api/              # REST API server
|   |   +-- main.go
|   +-- group-variants/           # Variant grouping utility
|       +-- main.go
|
|-- internal/                     # Private application code
|   |-- config/                   # Configuration loading
|   |   +-- config.go
|   |-- constants/                # Application constants
|   |   +-- advanced_sync.go
|   |-- database/                 # Database connection
|   |   +-- db.go
|   |-- handlers/                 # HTTP handlers
|   |   |-- handlers.go           # Main product/brand/category handlers
|   |   |-- helpers.go            # Utility functions
|   |   |-- property_hierarchy_handlers.go
|   |   |-- characteristic_hierarchy_handlers.go
|   |   |-- product_grouping_hierarchy_handlers.go
|   |   |-- realtime_sync_handlers.go
|   |   |-- sync_control_handlers.go
|   |   |-- source_handlers.go
|   |   |-- translation_handlers.go
|   |   |-- schedule_handlers.go
|   |   |-- performance_handlers.go
|   |   |-- filter_handlers.go
|   |   |-- upload_handlers.go
|   |   +-- comparison_handlers.go
|   |-- models/                   # Data structures
|   |   |-- models.go             # Core domain models
|   |   |-- field_schemas.go      # Sync field definitions
|   |   |-- sync_config.go        # Sync configuration models
|   |   |-- realtime_sync.go      # Real-time sync models
|   |   |-- scheduling.go         # Schedule models
|   |   |-- filter.go             # Filter models
|   |   |-- comparison.go         # Comparison models
|   |   +-- performance.go        # Performance metrics
|   |-- repository/               # Database operations
|   |   |-- repository.go         # Main repository
|   |   |-- sync_config_repo.go
|   |   |-- realtime_sync_repo.go
|   |   |-- source_repo.go
|   |   |-- translation_repository.go
|   |   |-- schedule_repo.go
|   |   |-- performance_repo.go
|   |   |-- filter_repo.go
|   |   |-- property_hierarchy.go
|   |   |-- characteristic_hierarchy.go
|   |   |-- product_grouping_hierarchy.go
|   |   |-- selective_updates.go
|   |   +-- comparison_repo.go
|   |-- sync/                     # Sync engine
|   |   |-- selective.go          # Selective sync implementation
|   |   |-- sync_manager.go       # Sync lifecycle management
|   |   |-- scheduler.go          # Background scheduler
|   |   |-- filter_applier.go     # Entity filtering
|   |   +-- metrics_recorder.go   # Performance recording
|   |-- translate/                # Translation service
|   |   |-- translator.go         # LibreTranslate client
|   |   |-- executor.go           # Translation job execution
|   |   +-- job_manager.go        # Job lifecycle
|   +-- ultra/                    # Ultra B2B SOAP client
|       |-- client.go             # SOAP client
|       |-- fetcher.go            # Data fetching
|       +-- parser.go             # XML parsing
|
|-- migrations/                   # Database migrations
|   |-- 001_multi_source_architecture.sql
|   |-- 002_fix_missing_tables.sql
|   |-- 003_ultra_data_schema.sql
|   |-- ...
|   +-- schema_snapshot_2025-11-29.sql
|
|-- admin-intelect/               # Next.js admin dashboard
|   |-- src/
|   |   |-- app/                  # Next.js App Router pages
|   |   |   |-- page.tsx          # Dashboard home
|   |   |   |-- products/         # Product pages
|   |   |   |-- brands/           # Brand pages
|   |   |   |-- categories/       # Category pages
|   |   |   |-- properties/       # Property pages
|   |   |   |-- characteristics/  # Characteristic pages
|   |   |   |-- groupings/        # Grouping pages
|   |   |   |-- sync/             # Sync pages
|   |   |   |-- translate/        # Translation pages
|   |   |   +-- settings/         # Settings page
|   |   |-- components/           # React components
|   |   |   |-- ui/               # Shadcn/ui components
|   |   |   |-- sync/             # Sync-related components
|   |   |   |-- properties/       # Property components
|   |   |   |-- products/         # Product components
|   |   |   +-- ...
|   |   |-- lib/                  # Utilities
|   |   |-- hooks/                # Custom React hooks
|   |   |-- contexts/             # React contexts
|   |   |-- types/                # TypeScript types
|   |   +-- locales/              # Internationalization
|   |-- public/                   # Static assets
|   |-- package.json
|   +-- tailwind.config.ts
|
|-- uploads/                      # Uploaded files (images, videos)
|-- bin/                          # Compiled binaries
|-- scripts/                      # Utility scripts
|
|-- .env                          # Environment variables (not in git)
|-- .env.example                  # Example environment file
|-- go.mod                        # Go module definition
|-- go.sum                        # Go dependencies checksum
|-- Makefile                      # Build commands
|-- CLAUDE.md                     # Project documentation
+-- README.md                     # This file
```

---

## Commands Reference

### Backend Commands

| Command | Description |
|---------|-------------|
| `go run cmd/unified-api/main.go` | Start API server on :8080 |
| `go run cmd/sync/main.go` | Run full sync from Ultra API |
| `go run cmd/group-variants/main.go` | Run variant grouping |
| `go build -o bin/unified-api cmd/unified-api/main.go` | Build API binary |
| `go build -o bin/sync cmd/sync/main.go` | Build sync binary |
| `go mod download` | Download dependencies |
| `go mod tidy` | Clean up dependencies |

### Frontend Commands

| Command | Description |
|---------|-------------|
| `cd admin-intelect && bun dev` | Start dev server on :3000 |
| `cd admin-intelect && bun build` | Production build |
| `cd admin-intelect && bun start` | Start production server |
| `cd admin-intelect && bun install` | Install dependencies |
| `cd admin-intelect && bun lint` | Run ESLint |

### Database Commands

| Command | Description |
|---------|-------------|
| `createdb ultra-data` | Create database |
| `dropdb ultra-data` | Drop database |
| `psql -d ultra-data -f <migration>` | Run migration |
| `psql -d ultra-data` | Connect to database |

### Docker Commands (LibreTranslate)

```bash
# Start LibreTranslate
docker run -d \
  --name libretranslate \
  -p 5555:5000 \
  -e LT_LOAD_ONLY=en,ru,ro \
  -e LT_CHAR_LIMIT=5000 \
  libretranslate/libretranslate

# Stop LibreTranslate
docker stop libretranslate

# View logs
docker logs -f libretranslate
```

---

## Contributing

### Development Workflow

1. Create a feature branch
2. Make changes
3. Test thoroughly
4. Submit pull request

### Code Style

- Go: Follow standard Go formatting (`go fmt`)
- TypeScript: ESLint with Next.js config
- Commits: Use conventional commit messages

### Testing

```bash
# Run Go tests
go test ./...

# Run frontend linting
cd admin-intelect && bun lint
```

---

## License

Private - All rights reserved.

---

## Changelog

### v2.0.0 (December 2025)
- Added sync scheduler with cron support
- Implemented sync entity filters
- Added sync analytics and performance metrics
- Enhanced real-time monitoring with SSE
- Added translation service with LibreTranslate
- Improved product variant grouping
- Added multi-currency price support
- Dashboard improvements with charts

### v1.0.0 (November 2025)
- Initial release
- Core sync engine
- REST API
- Admin dashboard
- Selective sync support

---

<div align="center">

**Documentation Last Updated:** December 2, 2025

---

*Built with Go, PostgreSQL, and Next.js*

</div>
