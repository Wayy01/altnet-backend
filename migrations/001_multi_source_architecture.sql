-- ============================================================================
-- MULTI-SOURCE E-COMMERCE DATABASE SCHEMA
-- Database: api-testing
-- ============================================================================
-- Design Philosophy:
-- 1. Source-agnostic: Adding new sources requires ZERO migrations
-- 2. Metadata-driven: Source configuration stored in data, not code
-- 3. Automatic unification: Smart matching and deduplication
-- 4. Audit trail: Full history of data lineage and transformations
-- ============================================================================

-- ============================================================================
-- 1. SOURCE REGISTRY (Dynamic Source Management)
-- ============================================================================
-- Purpose: Central registry of all data sources (Ultra, Intelect, etc.)
-- Adding a new source: Just INSERT a row - no schema changes needed
-- ============================================================================

CREATE TABLE IF NOT EXISTS data_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Source identification
    source_code TEXT UNIQUE NOT NULL,           -- 'ultra', 'intelect', 'amazon', etc.
    source_name TEXT NOT NULL,                  -- 'IT-Ultra B2B', 'Intelect FTP', etc.
    source_type TEXT NOT NULL,                  -- 'api', 'ftp', 'csv', 'manual'

    -- Source configuration (flexible JSONB for any source type)
    config JSONB NOT NULL DEFAULT '{}',         -- API endpoints, credentials, etc.
    /*
    Example config structures:

    API Source:
    {
      "endpoint": "https://portal.it-ultra.com/b2b/ws/b2b.1cws?wsdl",
      "auth_type": "basic",
      "timeout": 60,
      "rate_limit": "1req/s"
    }

    FTP Source:
    {
      "host": "ftp.example.com",
      "port": 21,
      "path": "/products",
      "file_pattern": "*.xml"
    }

    CSV Source:
    {
      "file_path": "/imports/products.csv",
      "delimiter": ",",
      "encoding": "utf-8"
    }
    */

    -- Field mappings (how this source maps to unified schema)
    field_mappings JSONB NOT NULL DEFAULT '{}', -- Maps source fields to unified fields
    /*
    Example field_mappings:
    {
      "products": {
        "name": "nomenclature.name",           -- JSON path in source data
        "code": "nomenclature.code",
        "price": "pricelist.price",
        "stock": "balance.quantity"
      },
      "brands": {
        "name": "brand.name",
        "code": "brand.code"
      }
    }
    */

    -- Source capabilities
    capabilities JSONB NOT NULL DEFAULT '{}',   -- What this source can provide
    /*
    Example capabilities:
    {
      "supports_incremental_sync": true,
      "supports_images": true,
      "supports_variants": true,
      "supports_stock": true,
      "supports_prices": true,
      "price_currencies": ["USD", "MDL", "EUR"],
      "update_frequency": "realtime"
    }
    */

    -- Source priority (for conflict resolution)
    priority INT NOT NULL DEFAULT 50,           -- Higher = more trusted (0-100)

    -- Source status
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_primary BOOLEAN NOT NULL DEFAULT false,  -- Primary source for new products

    -- Sync metadata
    last_sync_at TIMESTAMPTZ,
    last_sync_status TEXT,                      -- 'success', 'failed', 'degraded'
    sync_interval_minutes INT DEFAULT 60,       -- How often to sync

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT DEFAULT 'system',

    -- Constraints
    CONSTRAINT valid_priority CHECK (priority >= 0 AND priority <= 100),
    CONSTRAINT valid_source_type CHECK (source_type IN ('api', 'ftp', 'csv', 'manual', 'webhook'))
);

CREATE INDEX idx_data_sources_code ON data_sources(source_code);
CREATE INDEX idx_data_sources_active ON data_sources(is_active) WHERE is_active = true;
CREATE INDEX idx_data_sources_primary ON data_sources(is_primary) WHERE is_primary = true;

COMMENT ON TABLE data_sources IS 'Central registry of all data sources - add new sources by inserting rows';
COMMENT ON COLUMN data_sources.source_code IS 'Unique identifier for source (lowercase, no spaces)';
COMMENT ON COLUMN data_sources.priority IS 'Conflict resolution priority: 100=highest trust, 0=lowest trust';
COMMENT ON COLUMN data_sources.config IS 'Source-specific configuration (flexible JSONB)';
COMMENT ON COLUMN data_sources.field_mappings IS 'Maps source fields to unified schema fields';
COMMENT ON COLUMN data_sources.capabilities IS 'Declares what data this source can provide';

-- ============================================================================
-- 2. UNIFIED BRANDS (All Sources)
-- ============================================================================
-- Purpose: Single source of truth for all brands across all sources
-- Strategy: Each source contributes brand data, smart matching unifies them
-- ============================================================================

CREATE TABLE IF NOT EXISTS brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Unified brand identity
    name TEXT NOT NULL,                         -- Canonical brand name
    slug TEXT UNIQUE NOT NULL,                  -- URL-friendly identifier

    -- Brand details (merged from all sources)
    description TEXT,
    logo_url TEXT,
    website_url TEXT,
    country TEXT,

    -- Unification metadata
    is_verified BOOLEAN NOT NULL DEFAULT false, -- Manually verified/curated
    master_brand_id UUID REFERENCES brands(id), -- If this is a duplicate, points to master

    -- Quality score (0-100, based on data completeness)
    quality_score INT DEFAULT 0,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_quality_score CHECK (quality_score >= 0 AND quality_score <= 100)
);

CREATE INDEX idx_brands_slug ON brands(slug);
CREATE INDEX idx_brands_name ON brands(name);
CREATE INDEX idx_brands_verified ON brands(is_verified) WHERE is_verified = true;
CREATE INDEX idx_brands_master ON brands(master_brand_id);

COMMENT ON TABLE brands IS 'Unified brand catalog - merged from all sources';
COMMENT ON COLUMN brands.master_brand_id IS 'Points to canonical brand if this is a duplicate';
COMMENT ON COLUMN brands.quality_score IS 'Data completeness: 100=all fields filled, 0=minimal';

-- ============================================================================
-- 3. BRAND SOURCE DATA (Per-Source Brand Information)
-- ============================================================================
-- Purpose: Store original brand data from each source before unification
-- Strategy: Each source has its own brand records, mapped to unified brands
-- ============================================================================

CREATE TABLE IF NOT EXISTS brand_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Links
    brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
    source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,

    -- Source-specific identity
    external_id TEXT NOT NULL,                  -- Brand ID in source system

    -- Source data (original, unmodified)
    source_data JSONB NOT NULL DEFAULT '{}',    -- Raw brand object from source
    /*
    Example source_data (Ultra API):
    {
      "UUID": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Samsung",
      "code": "SAMSUNG",
      "active": "true",
      "image": {
        "UUID": "image-uuid",
        "pathGlobal": "https://cdn.example.com/logos/samsung.png"
      }
    }
    */

    -- Extracted/normalized fields (for fast queries)
    name TEXT NOT NULL,
    code TEXT,
    logo_url TEXT,
    is_active BOOLEAN DEFAULT true,

    -- Sync metadata
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sync_version INT NOT NULL DEFAULT 1,        -- Increments on each update

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    UNIQUE(source_id, external_id)              -- Each source has unique external IDs
);

CREATE INDEX idx_brand_sources_brand ON brand_sources(brand_id);
CREATE INDEX idx_brand_sources_source ON brand_sources(source_id);
CREATE INDEX idx_brand_sources_external_id ON brand_sources(external_id);
CREATE INDEX idx_brand_sources_active ON brand_sources(is_active) WHERE is_active = true;

COMMENT ON TABLE brand_sources IS 'Original brand data from each source before unification';
COMMENT ON COLUMN brand_sources.external_id IS 'Brand identifier in source system';
COMMENT ON COLUMN brand_sources.source_data IS 'Complete raw brand object from source API/feed';
COMMENT ON COLUMN brand_sources.sync_version IS 'Increments when source updates this brand';

-- ============================================================================
-- 4. UNIFIED CATEGORIES (Hierarchical, Multi-Source)
-- ============================================================================
-- Purpose: Unified category tree merged from all sources
-- Strategy: Each source has its own category tree, smart algorithm merges them
-- ============================================================================

CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Hierarchy
    parent_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    path LTREE,                                 -- Materialized path (e.g., 'electronics.phones.smartphones')
    level INT NOT NULL DEFAULT 0,               -- Tree depth (0=root, 1=first level, etc.)

    -- Category identity
    name TEXT NOT NULL,
    slug TEXT NOT NULL,                         -- URL-friendly, unique within level

    -- Category details
    description TEXT,
    image_url TEXT,
    icon TEXT,                                  -- Icon identifier or emoji

    -- Display metadata
    sort_order INT DEFAULT 0,                   -- Manual sort order
    is_visible BOOLEAN NOT NULL DEFAULT true,
    is_featured BOOLEAN NOT NULL DEFAULT false,

    -- Unification metadata
    is_verified BOOLEAN NOT NULL DEFAULT false,
    master_category_id UUID REFERENCES categories(id),

    -- Statistics (updated periodically)
    product_count INT DEFAULT 0,                -- Total products in this category
    active_product_count INT DEFAULT 0,         -- Active products only

    -- Quality score
    quality_score INT DEFAULT 0,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_quality_score CHECK (quality_score >= 0 AND quality_score <= 100),
    CONSTRAINT unique_slug_per_parent UNIQUE(parent_id, slug)
);

CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_path ON categories USING GIST(path);
CREATE INDEX idx_categories_level ON categories(level);
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_visible ON categories(is_visible) WHERE is_visible = true;
CREATE INDEX idx_categories_featured ON categories(is_featured) WHERE is_featured = true;

COMMENT ON TABLE categories IS 'Unified category hierarchy merged from all sources';
COMMENT ON COLUMN categories.path IS 'LTREE path for efficient ancestor/descendant queries';
COMMENT ON COLUMN categories.master_category_id IS 'Points to canonical category if duplicate';

-- ============================================================================
-- 5. CATEGORY SOURCE DATA (Per-Source Category Trees)
-- ============================================================================

CREATE TABLE IF NOT EXISTS category_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Links
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,

    -- Source-specific identity
    external_id TEXT NOT NULL,
    parent_external_id TEXT,                    -- Parent ID in source system

    -- Source data
    source_data JSONB NOT NULL DEFAULT '{}',

    -- Extracted fields
    name TEXT NOT NULL,
    code TEXT,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    product_count INT DEFAULT 0,                -- Count from source

    -- Sync metadata
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sync_version INT NOT NULL DEFAULT 1,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(source_id, external_id)
);

CREATE INDEX idx_category_sources_category ON category_sources(category_id);
CREATE INDEX idx_category_sources_source ON category_sources(source_id);
CREATE INDEX idx_category_sources_external_id ON category_sources(external_id);

COMMENT ON TABLE category_sources IS 'Original category data from each source';

-- ============================================================================
-- 6. UNIFIED PRODUCTS (All Sources)
-- ============================================================================

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Product identity
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,

    -- Classification
    brand_id UUID REFERENCES brands(id),
    category_id UUID REFERENCES categories(id),

    -- Basic info
    description TEXT,
    code TEXT,                                  -- SKU/product code (merged from sources)

    -- Product type
    is_variant BOOLEAN NOT NULL DEFAULT false,  -- Is this a variant of parent product
    parent_product_id UUID REFERENCES products(id),

    -- Aggregated data (merged from sources)
    main_image_url TEXT,
    images JSONB DEFAULT '[]',                  -- Array of image URLs

    -- Pricing (merged from all sources - best price wins)
    price_min DECIMAL(12,2),                    -- Lowest price across sources
    price_max DECIMAL(12,2),                    -- Highest price across sources
    price_currency TEXT DEFAULT 'USD',

    -- Stock (aggregated from all sources)
    stock_quantity INT DEFAULT 0,               -- Total stock across sources
    is_in_stock BOOLEAN DEFAULT false,

    -- Product attributes (flexible JSONB)
    attributes JSONB DEFAULT '{}',              -- Merged attributes from all sources
    /*
    Example attributes:
    {
      "screen_size": "6.8 inches",
      "storage": "256GB",
      "color": "Black",
      "warranty": "24 months",
      "weight": "228g"
    }
    */

    -- Quality & trust
    quality_score INT DEFAULT 0,
    source_count INT DEFAULT 0,                 -- How many sources have this product

    -- Display settings
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_featured BOOLEAN NOT NULL DEFAULT false,
    is_verified BOOLEAN NOT NULL DEFAULT false,

    -- SEO
    meta_title TEXT,
    meta_description TEXT,

    -- Statistics
    view_count INT DEFAULT 0,
    favorite_count INT DEFAULT 0,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_quality_score CHECK (quality_score >= 0 AND quality_score <= 100),
    CONSTRAINT valid_price_range CHECK (price_min <= price_max OR price_max IS NULL)
);

CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_brand ON products(brand_id);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_parent ON products(parent_product_id);
CREATE INDEX idx_products_active ON products(is_active) WHERE is_active = true;
CREATE INDEX idx_products_in_stock ON products(is_in_stock) WHERE is_in_stock = true;
CREATE INDEX idx_products_price_range ON products(price_min, price_max);

COMMENT ON TABLE products IS 'Unified product catalog merged from all sources';
COMMENT ON COLUMN products.source_count IS 'Number of sources offering this product';
COMMENT ON COLUMN products.quality_score IS 'Data completeness and quality metric';

-- ============================================================================
-- 7. PRODUCT SOURCE DATA (Per-Source Product Information)
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Links
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,

    -- Source identity
    external_id TEXT NOT NULL,

    -- Source relationships
    brand_external_id TEXT,
    category_external_id TEXT,
    parent_external_id TEXT,

    -- Source data (complete original)
    source_data JSONB NOT NULL DEFAULT '{}',

    -- Extracted/normalized fields
    name TEXT NOT NULL,
    code TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT true,

    -- Pricing from this source
    prices JSONB DEFAULT '[]',                  -- Array of price objects
    /*
    Example prices:
    [
      {
        "price": 1299.99,
        "currency": "USD",
        "price_type": "retail",
        "effective_date": "2025-01-14T10:00:00Z"
      },
      {
        "price": 1199.99,
        "currency": "USD",
        "price_type": "wholesale",
        "effective_date": "2025-01-14T10:00:00Z"
      }
    ]
    */

    -- Stock from this source
    stock JSONB DEFAULT '{}',
    /*
    Example stock:
    {
      "warehouse": 50,
      "showroom": 5,
      "reserved": 3,
      "total": 55,
      "last_updated": "2025-01-14T10:00:00Z"
    }
    */

    -- Images from this source
    images JSONB DEFAULT '[]',

    -- Characteristics/variants from this source
    characteristics JSONB DEFAULT '[]',

    -- Properties/attributes from this source
    properties JSONB DEFAULT '{}',

    -- Barcodes from this source
    barcodes JSONB DEFAULT '[]',

    -- Sync metadata
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sync_version INT NOT NULL DEFAULT 1,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(source_id, external_id)
);

CREATE INDEX idx_product_sources_product ON product_sources(product_id);
CREATE INDEX idx_product_sources_source ON product_sources(source_id);
CREATE INDEX idx_product_sources_external_id ON product_sources(external_id);
CREATE INDEX idx_product_sources_active ON product_sources(is_active) WHERE is_active = true;

COMMENT ON TABLE product_sources IS 'Original product data from each source before unification';
COMMENT ON COLUMN product_sources.source_data IS 'Complete unmodified product object from source';

-- ============================================================================
-- 8. ENTITY MATCHING (Automatic Deduplication & Unification)
-- ============================================================================
-- Purpose: Track how entities from different sources are matched/unified
-- Strategy: ML/rule-based matching creates links between source entities
-- ============================================================================

CREATE TABLE IF NOT EXISTS entity_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- What type of entity
    entity_type TEXT NOT NULL,                  -- 'brand', 'category', 'product'

    -- Unified entity
    unified_entity_id UUID NOT NULL,            -- Points to brands.id, categories.id, or products.id

    -- Source entities that matched
    source_matches JSONB NOT NULL DEFAULT '[]', -- Array of {source_id, external_id, confidence}
    /*
    Example source_matches:
    [
      {
        "source_id": "uuid-ultra",
        "external_id": "550e8400-e29b-41d4-a716-446655440000",
        "confidence": 0.95,
        "matched_at": "2025-01-14T10:00:00Z"
      },
      {
        "source_id": "uuid-intelect",
        "external_id": "PROD-12345",
        "confidence": 0.92,
        "matched_at": "2025-01-14T10:05:00Z"
      }
    ]
    */

    -- Matching metadata
    match_method TEXT NOT NULL,                 -- 'exact', 'fuzzy', 'ml', 'manual'
    confidence_score DECIMAL(3,2),              -- 0.00 to 1.00

    -- Match rules applied
    match_criteria JSONB DEFAULT '{}',
    /*
    Example match_criteria:
    {
      "name_similarity": 0.95,
      "code_match": true,
      "brand_match": true,
      "category_match": true,
      "price_similarity": 0.88
    }
    */

    -- Status
    is_verified BOOLEAN NOT NULL DEFAULT false, -- Manually verified match
    is_rejected BOOLEAN NOT NULL DEFAULT false, -- Manually rejected (false positive)

    -- Audit
    matched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verified_at TIMESTAMPTZ,
    verified_by TEXT,

    CONSTRAINT valid_entity_type CHECK (entity_type IN ('brand', 'category', 'product')),
    CONSTRAINT valid_match_method CHECK (match_method IN ('exact', 'fuzzy', 'ml', 'manual', 'barcode')),
    CONSTRAINT valid_confidence CHECK (confidence_score >= 0 AND confidence_score <= 1)
);

CREATE INDEX idx_entity_matches_type ON entity_matches(entity_type);
CREATE INDEX idx_entity_matches_unified ON entity_matches(unified_entity_id);
CREATE INDEX idx_entity_matches_verified ON entity_matches(is_verified) WHERE is_verified = true;
CREATE INDEX idx_entity_matches_confidence ON entity_matches(confidence_score DESC);

COMMENT ON TABLE entity_matches IS 'Tracks how entities from different sources are matched together';
COMMENT ON COLUMN entity_matches.match_method IS 'Algorithm used: exact, fuzzy name match, ML model, manual';
COMMENT ON COLUMN entity_matches.confidence_score IS '0=no confidence, 1=perfect match';

-- ============================================================================
-- 9. SYNC RUNS (Audit Trail for Data Synchronization)
-- ============================================================================

CREATE TABLE IF NOT EXISTS sync_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- What was synced
    source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
    sync_type TEXT NOT NULL,                    -- 'full', 'incremental', 'manual'

    -- Sync timing
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    duration_seconds INT,

    -- Sync results
    status TEXT NOT NULL DEFAULT 'running',     -- 'running', 'success', 'failed', 'degraded'

    -- Metrics
    records_fetched INT DEFAULT 0,
    records_created INT DEFAULT 0,
    records_updated INT DEFAULT 0,
    records_failed INT DEFAULT 0,

    -- Quality metrics
    brands_with_data INT DEFAULT 0,
    categories_with_data INT DEFAULT 0,
    products_with_data INT DEFAULT 0,
    products_with_prices INT DEFAULT 0,
    products_with_stock INT DEFAULT 0,
    products_with_images INT DEFAULT 0,

    -- Sync details
    sync_details JSONB DEFAULT '{}',
    /*
    Example sync_details:
    {
      "services_synced": ["NOMENCLATURE", "BRAND", "PRICELIST", "BALANCE"],
      "services_failed": ["PROPERTIES"],
      "warnings": ["Price fetch took 30s (slow)"],
      "data_sources": {
        "brands": 250,
        "categories": 450,
        "products": 5420,
        "prices": 8100,
        "stock": 5420
      }
    }
    */

    -- Errors
    error_message TEXT,
    error_details JSONB DEFAULT '{}',

    -- Audit
    triggered_by TEXT DEFAULT 'system',         -- 'system', 'manual', 'webhook', 'cron'

    CONSTRAINT valid_sync_type CHECK (sync_type IN ('full', 'incremental', 'manual')),
    CONSTRAINT valid_status CHECK (status IN ('running', 'success', 'failed', 'degraded', 'cancelled'))
);

CREATE INDEX idx_sync_runs_source ON sync_runs(source_id);
CREATE INDEX idx_sync_runs_started ON sync_runs(started_at DESC);
CREATE INDEX idx_sync_runs_status ON sync_runs(status);

COMMENT ON TABLE sync_runs IS 'Audit log of all synchronization operations';
COMMENT ON COLUMN sync_runs.sync_type IS 'Full sync fetches all data, incremental fetches changes only';
COMMENT ON COLUMN sync_runs.status IS 'degraded = completed but some services failed';

-- ============================================================================
-- 10. FUNCTIONS & TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to all tables
CREATE TRIGGER update_brands_updated_at BEFORE UPDATE ON brands
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_brand_sources_updated_at BEFORE UPDATE ON brand_sources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_category_sources_updated_at BEFORE UPDATE ON category_sources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_sources_updated_at BEFORE UPDATE ON product_sources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_data_sources_updated_at BEFORE UPDATE ON data_sources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 11. INITIAL DATA - Register Ultra Source
-- ============================================================================

INSERT INTO data_sources (
    source_code,
    source_name,
    source_type,
    config,
    field_mappings,
    capabilities,
    priority,
    is_active,
    is_primary
) VALUES (
    'ultra',
    'IT-Ultra B2B API',
    'api',
    '{
        "endpoint": "https://portal.it-ultra.com/b2b/ru/ws/b2b.1cws?wsdl",
        "auth_type": "basic",
        "timeout_seconds": 60,
        "poll_interval_seconds": 5,
        "poll_timeout_minutes": 5,
        "rate_limit": "1req/s",
        "max_retries": 3
    }'::jsonb,
    '{
        "brands": {
            "external_id": "UUID",
            "name": "name",
            "code": "code",
            "logo_url": "image.pathGlobal",
            "is_active": "active"
        },
        "categories": {
            "external_id": "UUID",
            "name": "name",
            "code": "code",
            "parent_external_id": "parent",
            "sort_order": "orderBy",
            "is_active": "active"
        },
        "products": {
            "external_id": "UUID",
            "name": "name",
            "code": "code",
            "brand_external_id": "brand",
            "category_external_id": "nomenclatureType",
            "is_active": "active"
        }
    }'::jsonb,
    '{
        "supports_incremental_sync": true,
        "supports_images": true,
        "supports_variants": true,
        "supports_stock": true,
        "supports_prices": true,
        "supports_barcodes": true,
        "price_currencies": ["USD", "MDL", "EUR"],
        "update_frequency": "on_demand",
        "services": ["NOMENCLATURE", "BRAND", "NOMENCLATURETYPELIST", "PRICELIST", "BALANCE", "RATES"]
    }'::jsonb,
    80,
    true,
    true
) ON CONFLICT (source_code) DO NOTHING;

-- ============================================================================
-- VIEWS FOR EASY QUERYING
-- ============================================================================

-- View: All products with their source count and best price
CREATE OR REPLACE VIEW v_products_enriched AS
SELECT
    p.*,
    b.name as brand_name,
    b.slug as brand_slug,
    c.name as category_name,
    c.path as category_path,
    (
        SELECT COUNT(DISTINCT ps.source_id)
        FROM product_sources ps
        WHERE ps.product_id = p.id AND ps.is_active = true
    ) as active_source_count,
    (
        SELECT jsonb_agg(DISTINCT ds.source_code)
        FROM product_sources ps
        JOIN data_sources ds ON ds.id = ps.source_id
        WHERE ps.product_id = p.id AND ps.is_active = true
    ) as available_sources
FROM products p
LEFT JOIN brands b ON b.id = p.brand_id
LEFT JOIN categories c ON c.id = p.category_id;

COMMENT ON VIEW v_products_enriched IS 'Products with brand, category, and source information';

-- ============================================================================
-- DONE
-- ============================================================================

COMMENT ON DATABASE "api-testing" IS 'Multi-source e-commerce database - designed for automatic source integration';
