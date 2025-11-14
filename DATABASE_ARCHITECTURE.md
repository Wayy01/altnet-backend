# Multi-Source Database Architecture

## Philosophy

This database is designed for **automatic multi-source integration** with **zero schema changes** when adding new data sources.

### Core Principles

1. **Source Agnostic**: Adding Ultra, Intelect, Amazon, or any future source requires zero migrations
2. **Metadata Driven**: Source configuration lives in data (JSONB), not code
3. **Automatic Unification**: Smart matching algorithms deduplicate entities across sources
4. **Complete Audit Trail**: Every sync tracked, every transformation logged
5. **Conflict Resolution**: Priority-based system handles conflicting data

---

## How It Works

### Adding a New Source (Zero Code Changes)

```sql
-- Example: Adding Amazon as a new source
INSERT INTO data_sources (
    source_code, source_name, source_type, priority,
    config, field_mappings, capabilities
) VALUES (
    'amazon',
    'Amazon MWS API',
    'api',
    70,  -- Priority for conflict resolution
    '{"endpoint": "https://mws.amazonservices.com", "marketplace": "US"}'::jsonb,
    '{"products": {"name": "title", "code": "asin"}}'::jsonb,
    '{"supports_stock": true, "supports_prices": true}'::jsonb
);
```

**That's it!** The system automatically:
- Creates product_sources entries for Amazon products
- Matches Amazon products to existing unified products
- Resolves conflicts using priority (Ultra=80, Amazon=70)
- Tracks sync history

---

## Table Structure

### 1. Source Registry

```
data_sources
├── source_code (ultra, intelect, amazon...)
├── config (JSONB) - API endpoints, credentials
├── field_mappings (JSONB) - How to map source fields
├── capabilities (JSONB) - What data source provides
└── priority (0-100) - Conflict resolution priority
```

**Purpose**: Central registry of all data sources. Add new sources by inserting rows.

**Example Query**:
```sql
-- Get all active sources
SELECT source_code, priority, last_sync_at
FROM data_sources
WHERE is_active = true
ORDER BY priority DESC;
```

---

### 2. Unified Entities (Single Source of Truth)

```
brands
├── id (UUID) - Unified brand ID
├── name - Canonical brand name
├── quality_score - Data completeness (0-100)
└── master_brand_id - Points to master if duplicate

categories
├── id (UUID) - Unified category ID
├── parent_id - Hierarchical structure
├── path (LTREE) - Materialized path for fast queries
└── master_category_id - Points to master if duplicate

products
├── id (UUID) - Unified product ID
├── brand_id → brands(id)
├── category_id → categories(id)
├── price_min/max - Best price across sources
├── stock_quantity - Total stock across sources
├── source_count - How many sources have this product
└── quality_score - Data completeness
```

**Purpose**: Single unified view of all entities, regardless of source.

**Example Query**:
```sql
-- Get products available from multiple sources
SELECT name, source_count, price_min, stock_quantity
FROM products
WHERE source_count >= 2
ORDER BY source_count DESC;
```

---

### 3. Source Data (Original, Unmodified)

```
brand_sources
├── brand_id → brands(id)
├── source_id → data_sources(id)
├── external_id - ID in source system
├── source_data (JSONB) - Complete original data
└── UNIQUE(source_id, external_id)

category_sources
├── category_id → categories(id)
├── source_id → data_sources(id)
├── external_id - ID in source system
└── source_data (JSONB)

product_sources
├── product_id → products(id)
├── source_id → data_sources(id)
├── external_id - ID in source system
├── source_data (JSONB) - Raw product object
├── prices (JSONB) - Source-specific prices
├── stock (JSONB) - Source-specific stock
├── images (JSONB) - Source-specific images
└── UNIQUE(source_id, external_id)
```

**Purpose**: Preserve original source data for debugging, audit, and re-processing.

**Example Query**:
```sql
-- Get all sources for a specific product
SELECT ds.source_name, ps.external_id, ps.prices, ps.stock
FROM product_sources ps
JOIN data_sources ds ON ds.id = ps.source_id
WHERE ps.product_id = 'some-uuid'
ORDER BY ds.priority DESC;
```

---

### 4. Automatic Matching & Deduplication

```
entity_matches
├── entity_type (brand, category, product)
├── unified_entity_id - Points to unified entity
├── source_matches (JSONB) - Array of matched sources
├── match_method (exact, fuzzy, ml, manual)
├── confidence_score (0.00 to 1.00)
└── is_verified - Manually verified match
```

**Purpose**: Track how entities from different sources are matched together.

**Matching Algorithm**:
1. **Exact Match** (confidence=1.00): Same code/SKU
2. **Fuzzy Match** (confidence=0.80-0.99): Similar name + brand + category
3. **ML Match** (confidence=0.70-0.95): Machine learning model
4. **Manual Match**: Human verification

**Example**:
```json
{
  "source_matches": [
    {
      "source_id": "ultra-uuid",
      "external_id": "550e8400-e29b-41d4-a716-446655440000",
      "confidence": 0.95,
      "matched_fields": ["name", "brand", "code"]
    },
    {
      "source_id": "intelect-uuid",
      "external_id": "PROD-12345",
      "confidence": 0.92,
      "matched_fields": ["name", "brand"]
    }
  ]
}
```

**Example Query**:
```sql
-- Find potential duplicate products (not yet unified)
SELECT p1.name, p2.name, similarity(p1.name, p2.name) as sim
FROM products p1
CROSS JOIN products p2
WHERE p1.id < p2.id
  AND similarity(p1.name, p2.name) > 0.8
  AND p1.brand_id = p2.brand_id
  AND NOT EXISTS (
      SELECT 1 FROM entity_matches
      WHERE unified_entity_id IN (p1.id, p2.id)
  );
```

---

### 5. Sync Audit Trail

```
sync_runs
├── source_id → data_sources(id)
├── sync_type (full, incremental)
├── status (running, success, failed, degraded)
├── records_fetched/created/updated/failed
├── products_with_prices/stock/images (quality metrics)
└── sync_details (JSONB) - Complete sync metadata
```

**Purpose**: Complete audit trail of all synchronization operations.

**Example Query**:
```sql
-- Get sync health over last 7 days
SELECT
    ds.source_name,
    COUNT(*) as total_syncs,
    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
    AVG(duration_seconds) as avg_duration,
    AVG(products_with_prices::float / NULLIF(products_with_data, 0) * 100) as avg_price_coverage
FROM sync_runs sr
JOIN data_sources ds ON ds.id = sr.source_id
WHERE sr.started_at > NOW() - INTERVAL '7 days'
GROUP BY ds.source_name;
```

---

## Data Flow

### Step 1: Fetch from Source

```
Ultra API → Go Server → product_sources table
                      ↓
                   source_data (JSONB) - Store raw data
```

### Step 2: Extract & Normalize

```
source_data (JSONB) → field_mappings → Normalized fields
{                                    ↓
  "UUID": "...",                     external_id
  "name": "Samsung...",              name
  "code": "SM-S918B",                code
  "brand": "brand-uuid"              brand_external_id
}
```

### Step 3: Match & Unify

```
Matching Algorithm:
1. Exact match by code/SKU
2. Fuzzy match by name + brand + category
3. Create entity_matches entry
4. Update unified products table
```

### Step 4: Conflict Resolution

When multiple sources have same product:

```
Priority System (highest wins):
- Ultra: 80
- Intelect: 75
- Amazon: 70
- Manual: 100

Price Strategy: Use minimum price
Stock Strategy: Sum all sources
Images: Merge all unique images
```

---

## Query Patterns

### Get All Products from Ultra

```sql
SELECT p.*, ps.source_data
FROM products p
JOIN product_sources ps ON ps.product_id = p.id
JOIN data_sources ds ON ds.id = ps.source_id
WHERE ds.source_code = 'ultra'
  AND ps.is_active = true;
```

### Get Products Available from Multiple Sources

```sql
SELECT
    p.name,
    p.source_count,
    jsonb_agg(jsonb_build_object(
        'source', ds.source_name,
        'price', (ps.prices->0->>'price')::decimal,
        'stock', (ps.stock->>'total')::int
    )) as sources
FROM products p
JOIN product_sources ps ON ps.product_id = p.id
JOIN data_sources ds ON ds.id = ps.source_id
WHERE p.source_count >= 2
GROUP BY p.id, p.name, p.source_count
ORDER BY p.source_count DESC;
```

### Find Unmatched Products (Potential Duplicates)

```sql
-- Products from different sources that look similar but aren't unified yet
SELECT
    ps1.name as ultra_name,
    ps2.name as intelect_name,
    similarity(ps1.name, ps2.name) as name_similarity
FROM product_sources ps1
JOIN product_sources ps2 ON ps1.id < ps2.id
WHERE ps1.source_id != ps2.source_id
  AND ps1.product_id IS NULL
  AND ps2.product_id IS NULL
  AND similarity(ps1.name, ps2.name) > 0.85
ORDER BY name_similarity DESC;
```

### Get Sync History

```sql
SELECT
    ds.source_name,
    sr.started_at,
    sr.status,
    sr.duration_seconds,
    sr.records_created,
    sr.products_with_prices || '/' || sr.products_with_data as price_coverage
FROM sync_runs sr
JOIN data_sources ds ON ds.id = sr.source_id
ORDER BY sr.started_at DESC
LIMIT 20;
```

---

## Advantages of This Architecture

### 1. Zero Migrations for New Sources

**Traditional Approach** (requires migrations):
```sql
-- Add Intelect
CREATE TABLE products_intelect (...);
CREATE TABLE brands_intelect (...);

-- Add Amazon
CREATE TABLE products_amazon (...);
CREATE TABLE brands_amazon (...);
```

**Our Approach** (zero migrations):
```sql
-- Just insert source config
INSERT INTO data_sources (source_code, ...) VALUES ('amazon', ...);
-- System handles the rest automatically
```

### 2. Automatic Deduplication

System automatically detects when:
- Ultra has "Samsung Galaxy S23"
- Intelect has "Samsung Galaxy S23 Ultra"
- Amazon has "Samsung S23 Ultra"

Creates `entity_matches` with confidence scores, suggests unification.

### 3. Complete Data Lineage

Every product knows:
- Which sources it came from
- When it was first seen
- How many times it was updated
- Original source data (for debugging)

### 4. Flexible Schema

Source data stored in JSONB means:
- Ultra can have `characteristics` array
- Intelect can have `variants` array
- Amazon can have `variations` array

All stored without schema changes.

### 5. Conflict Resolution

When Ultra says price=1299 and Intelect says price=1199:
- Show minimum price (1199) to customers
- Track both prices in `product_sources`
- Let admin decide which source to trust (priority)

---

## Unification Strategies

### Brand Unification

```sql
-- Step 1: Insert from Ultra
INSERT INTO brand_sources (source_id, external_id, name, source_data)
VALUES (ultra_id, 'brand-uuid', 'Samsung', {...});

-- Step 2: Check if brand exists
SELECT id FROM brands WHERE LOWER(name) = LOWER('Samsung');

-- Step 3a: If exists, link to existing
UPDATE brand_sources SET brand_id = existing_brand_id WHERE ...;

-- Step 3b: If not exists, create unified brand
INSERT INTO brands (name, slug) VALUES ('Samsung', 'samsung')
RETURNING id INTO new_brand_id;

UPDATE brand_sources SET brand_id = new_brand_id WHERE ...;

-- Step 4: Create match entry
INSERT INTO entity_matches (
    entity_type, unified_entity_id, source_matches,
    match_method, confidence_score
) VALUES (
    'brand', new_brand_id,
    '[{"source_id": "ultra-uuid", "external_id": "brand-uuid", "confidence": 1.0}]',
    'exact', 1.0
);
```

### Category Unification (Hierarchical)

```sql
-- Categories are trickier due to hierarchy
-- Algorithm:
1. Build complete category tree from source
2. For each category:
   - Try exact name match at same level
   - Try fuzzy match (0.9+ confidence)
   - Create new if no match
3. Build LTREE paths after unification
4. Update product_sources.category_external_id → products.category_id
```

### Product Unification

```sql
-- Multi-stage matching:

-- Stage 1: Exact code match (confidence=1.0)
SELECT id FROM products WHERE code = source_code AND brand_id = source_brand_id;

-- Stage 2: Exact name + brand match (confidence=0.95)
SELECT id FROM products WHERE name = source_name AND brand_id = source_brand_id;

-- Stage 3: Fuzzy name + brand match (confidence=0.80-0.94)
SELECT id, similarity(name, source_name) as sim
FROM products
WHERE brand_id = source_brand_id
  AND similarity(name, source_name) > 0.85;

-- Stage 4: Manual review for 0.70-0.85 confidence
-- Stage 5: Create new product if no match found
```

---

## Next Steps

1. **Create Database**: `createdb api-testing`
2. **Run Migration**: `psql api-testing < migrations/001_multi_source_architecture.sql`
3. **Verify**: Check that Ultra source is registered
4. **Build Go Server**: Implement Ultra API fetcher
5. **Test Sync**: Fetch data and watch automatic unification happen

---

## Future Enhancements

1. **ML-Based Matching**: Train model on verified matches
2. **Real-time Webhooks**: Sources push updates instead of polling
3. **Price History**: Track price changes over time
4. **Stock Alerts**: Notify when stock low across all sources
5. **Smart Routing**: Order from cheapest available source
6. **Vendor Performance**: Track which sources are most reliable
