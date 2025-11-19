-- ============================================================================
-- ULTRA-DATA DATABASE SCHEMA
-- Database: ultra-data
-- ============================================================================
-- Simple, direct storage for Ultra B2B data
-- No multi-source complexity - just store the data as it comes from Ultra
-- ============================================================================

-- ============================================================================
-- 1. BRANDS
-- ============================================================================
CREATE TABLE IF NOT EXISTS brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identity from Ultra
    ultra_id TEXT UNIQUE NOT NULL,              -- UUID from Ultra API
    code TEXT,                                   -- Brand code

    -- Brand info
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    logo_url TEXT,

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_brands_ultra_id ON brands(ultra_id);
CREATE INDEX idx_brands_slug ON brands(slug);
CREATE INDEX idx_brands_name ON brands(name);
CREATE INDEX idx_brands_active ON brands(is_active) WHERE is_active = true;

COMMENT ON TABLE brands IS 'Brand catalog from Ultra B2B API';
COMMENT ON COLUMN brands.ultra_id IS 'UUID from Ultra API - unique identifier';

-- ============================================================================
-- 2. CATEGORIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identity from Ultra
    ultra_id TEXT UNIQUE NOT NULL,
    code TEXT,

    -- Hierarchy
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    parent_ultra_id TEXT,                       -- For resolving parent during sync

    -- Category info
    name TEXT NOT NULL,
    slug TEXT NOT NULL,

    -- Display
    sort_order INT DEFAULT 0,
    image_url TEXT,

    -- Statistics
    product_count INT DEFAULT 0,

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_slug_per_parent UNIQUE(parent_id, slug)
);

CREATE INDEX idx_categories_ultra_id ON categories(ultra_id);
CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_active ON categories(is_active) WHERE is_active = true;
CREATE INDEX idx_categories_sort ON categories(sort_order);

COMMENT ON TABLE categories IS 'Category hierarchy from Ultra B2B API';
COMMENT ON COLUMN categories.parent_ultra_id IS 'Used during sync to resolve parent_id FK';

-- ============================================================================
-- 3. PRODUCTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identity from Ultra
    ultra_id TEXT UNIQUE NOT NULL,
    code TEXT,
    article TEXT,                               -- Product article/SKU

    -- Product info
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,

    -- Relationships
    brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    parent_id UUID REFERENCES products(id) ON DELETE SET NULL,

    -- Ultra references (for sync resolution)
    brand_ultra_id TEXT,
    category_ultra_id TEXT,
    parent_ultra_id TEXT,

    -- Images
    main_image_url TEXT,
    images JSONB DEFAULT '[]',                  -- Array of {uuid, url, description, path_global}

    -- Product metadata
    warranty TEXT,
    barcodes JSONB DEFAULT '[]',                -- Array of {code, type}

    -- Aggregated pricing (calculated from characteristics)
    price_min DECIMAL(12,2),
    price_max DECIMAL(12,2),

    -- Aggregated stock (calculated from characteristics)
    total_stock INT DEFAULT 0,
    is_in_stock BOOLEAN DEFAULT false,

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_service BOOLEAN DEFAULT false,           -- Service vs physical product

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_ultra_id ON products(ultra_id);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_brand ON products(brand_id);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_parent ON products(parent_id);
CREATE INDEX idx_products_active ON products(is_active) WHERE is_active = true;
CREATE INDEX idx_products_in_stock ON products(is_in_stock) WHERE is_in_stock = true;
CREATE INDEX idx_products_price ON products(price_min, price_max);
CREATE INDEX idx_products_code ON products(code);
CREATE INDEX idx_products_article ON products(article);

COMMENT ON TABLE products IS 'Product catalog from Ultra B2B API';
COMMENT ON COLUMN products.parent_ultra_id IS 'Used during sync to resolve parent_id FK';
COMMENT ON COLUMN products.brand_ultra_id IS 'Used during sync to resolve brand_id FK';
COMMENT ON COLUMN products.category_ultra_id IS 'Used during sync to resolve category_id FK';

-- ============================================================================
-- 4. PROPERTIES (Product specifications/attributes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Links
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

    -- Property definition
    property_uuid TEXT,                         -- UUID from Ultra
    property_name TEXT NOT NULL,
    property_code TEXT,

    -- Property value
    value TEXT,
    value_type TEXT,                            -- 'string', 'number', 'boolean', 'reference'

    -- Property grouping
    group_uuid TEXT,
    group_name TEXT,

    -- Display
    sort_order INT DEFAULT 0,

    -- Filtering
    is_filter BOOLEAN DEFAULT false,            -- Can be used for filtering
    is_modification BOOLEAN DEFAULT false,       -- Is a product modification

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Prevent duplicate properties per product
    UNIQUE(product_id, property_uuid)
);

CREATE INDEX idx_properties_product ON properties(product_id);
CREATE INDEX idx_properties_name ON properties(property_name);
CREATE INDEX idx_properties_group ON properties(group_name);
CREATE INDEX idx_properties_filter ON properties(is_filter) WHERE is_filter = true;
CREATE INDEX idx_properties_value ON properties(value);

COMMENT ON TABLE properties IS 'Product properties/specifications from Ultra';
COMMENT ON COLUMN properties.is_filter IS 'If true, this property can be used for product filtering';
COMMENT ON COLUMN properties.is_modification IS 'If true, this property represents a product modification';

-- ============================================================================
-- 5. CHARACTERISTICS (Product variants/SKUs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS characteristics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Links
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

    -- Characteristic identity from Ultra
    ultra_id TEXT NOT NULL,                     -- UUID from Ultra
    code TEXT,
    reference TEXT,                             -- Reference code

    -- Characteristic info
    name TEXT NOT NULL,

    -- Pricing (multi-currency support)
    prices JSONB DEFAULT '[]',                  -- Array of {price, currency, type, type_uuid}

    -- Stock
    stock_warehouse INT DEFAULT 0,
    stock_showroom INT DEFAULT 0,
    stock_total INT DEFAULT 0,

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(product_id, ultra_id)
);

CREATE INDEX idx_characteristics_product ON characteristics(product_id);
CREATE INDEX idx_characteristics_ultra_id ON characteristics(ultra_id);
CREATE INDEX idx_characteristics_code ON characteristics(code);
CREATE INDEX idx_characteristics_stock ON characteristics(stock_total) WHERE stock_total > 0;
CREATE INDEX idx_characteristics_active ON characteristics(is_active) WHERE is_active = true;

COMMENT ON TABLE characteristics IS 'Product variants (SKUs) with their own prices and stock';
COMMENT ON COLUMN characteristics.prices IS 'JSON array: [{price, currency, type, type_uuid}]';

-- ============================================================================
-- 6. SYNC LOG (Simple audit trail)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Sync info
    sync_type TEXT NOT NULL DEFAULT 'full',     -- 'full', 'incremental'
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    duration_seconds INT,

    -- Status
    status TEXT NOT NULL DEFAULT 'running',     -- 'running', 'success', 'failed'

    -- Counts
    brands_synced INT DEFAULT 0,
    categories_synced INT DEFAULT 0,
    products_synced INT DEFAULT 0,
    properties_synced INT DEFAULT 0,
    characteristics_synced INT DEFAULT 0,
    prices_synced INT DEFAULT 0,
    stock_synced INT DEFAULT 0,

    -- Errors
    error_message TEXT,

    -- Details
    details JSONB DEFAULT '{}'
);

CREATE INDEX idx_sync_logs_started ON sync_logs(started_at DESC);
CREATE INDEX idx_sync_logs_status ON sync_logs(status);

COMMENT ON TABLE sync_logs IS 'Audit log of sync operations';

-- ============================================================================
-- 7. EXCHANGE RATES
-- ============================================================================
CREATE TABLE IF NOT EXISTS exchange_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Currency info
    currency_uuid TEXT UNIQUE NOT NULL,
    currency_code TEXT NOT NULL,
    currency_name TEXT NOT NULL,

    -- Rate
    rate DECIMAL(12,4) NOT NULL,

    -- Metadata
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_exchange_rates_code ON exchange_rates(currency_code);

COMMENT ON TABLE exchange_rates IS 'Exchange rates from Ultra API';

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to all tables
CREATE TRIGGER update_brands_updated_at BEFORE UPDATE ON brands
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON properties
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_characteristics_updated_at BEFORE UPDATE ON characteristics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exchange_rates_updated_at BEFORE UPDATE ON exchange_rates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Enriched products view
CREATE OR REPLACE VIEW v_products_enriched AS
SELECT
    p.*,
    b.name as brand_name,
    b.slug as brand_slug,
    b.logo_url as brand_logo_url,
    c.name as category_name,
    c.slug as category_slug,
    (SELECT COUNT(*) FROM characteristics ch WHERE ch.product_id = p.id) as variant_count,
    (SELECT COUNT(*) FROM properties pr WHERE pr.product_id = p.id) as property_count
FROM products p
LEFT JOIN brands b ON b.id = p.brand_id
LEFT JOIN categories c ON c.id = p.category_id;

COMMENT ON VIEW v_products_enriched IS 'Products with brand, category, and counts';

-- Category tree view
CREATE OR REPLACE VIEW v_category_tree AS
WITH RECURSIVE category_tree AS (
    -- Base case: root categories
    SELECT
        id,
        ultra_id,
        parent_id,
        name,
        slug,
        sort_order,
        product_count,
        is_active,
        0 as level,
        ARRAY[id] as path,
        name as full_path
    FROM categories
    WHERE parent_id IS NULL

    UNION ALL

    -- Recursive case: child categories
    SELECT
        c.id,
        c.ultra_id,
        c.parent_id,
        c.name,
        c.slug,
        c.sort_order,
        c.product_count,
        c.is_active,
        ct.level + 1,
        ct.path || c.id,
        ct.full_path || ' > ' || c.name
    FROM categories c
    INNER JOIN category_tree ct ON c.parent_id = ct.id
)
SELECT * FROM category_tree
ORDER BY path;

COMMENT ON VIEW v_category_tree IS 'Hierarchical category tree with path';

-- Product with full details view
CREATE OR REPLACE VIEW v_products_full AS
SELECT
    p.id,
    p.ultra_id,
    p.code,
    p.article,
    p.name,
    p.slug,
    p.description,
    p.main_image_url,
    p.images,
    p.warranty,
    p.barcodes,
    p.price_min,
    p.price_max,
    p.total_stock,
    p.is_in_stock,
    p.is_active,
    p.is_service,
    p.created_at,
    p.updated_at,
    -- Brand info
    json_build_object(
        'id', b.id,
        'name', b.name,
        'slug', b.slug,
        'logo_url', b.logo_url
    ) as brand,
    -- Category info
    json_build_object(
        'id', c.id,
        'name', c.name,
        'slug', c.slug
    ) as category,
    -- Properties
    (
        SELECT json_agg(json_build_object(
            'name', pr.property_name,
            'value', pr.value,
            'group', pr.group_name,
            'order', pr.sort_order
        ) ORDER BY pr.group_name, pr.sort_order)
        FROM properties pr
        WHERE pr.product_id = p.id
    ) as properties,
    -- Characteristics
    (
        SELECT json_agg(json_build_object(
            'id', ch.id,
            'ultra_id', ch.ultra_id,
            'name', ch.name,
            'code', ch.code,
            'prices', ch.prices,
            'stock_total', ch.stock_total,
            'stock_warehouse', ch.stock_warehouse,
            'stock_showroom', ch.stock_showroom
        ))
        FROM characteristics ch
        WHERE ch.product_id = p.id
    ) as characteristics
FROM products p
LEFT JOIN brands b ON b.id = p.brand_id
LEFT JOIN categories c ON c.id = p.category_id;

COMMENT ON VIEW v_products_full IS 'Complete product details with properties and characteristics';

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to update product aggregates from characteristics
CREATE OR REPLACE FUNCTION update_product_aggregates(p_product_id UUID)
RETURNS VOID AS $$
DECLARE
    v_min_price DECIMAL(12,2);
    v_max_price DECIMAL(12,2);
    v_total_stock INT;
BEGIN
    -- Calculate min/max prices from characteristics
    SELECT
        MIN((price_item->>'price')::DECIMAL),
        MAX((price_item->>'price')::DECIMAL)
    INTO v_min_price, v_max_price
    FROM characteristics c,
    LATERAL jsonb_array_elements(c.prices) AS price_item
    WHERE c.product_id = p_product_id
    AND c.is_active = true;

    -- Calculate total stock
    SELECT COALESCE(SUM(stock_total), 0)
    INTO v_total_stock
    FROM characteristics
    WHERE product_id = p_product_id
    AND is_active = true;

    -- Update product
    UPDATE products
    SET
        price_min = v_min_price,
        price_max = v_max_price,
        total_stock = v_total_stock,
        is_in_stock = v_total_stock > 0
    WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_product_aggregates IS 'Updates product price/stock from its characteristics';

-- ============================================================================
-- DONE
-- ============================================================================
