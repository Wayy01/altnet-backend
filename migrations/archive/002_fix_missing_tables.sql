-- Fix missing tables from initial migration

-- ============================================================================
-- CATEGORIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    path LTREE,
    level INT NOT NULL DEFAULT 0,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    icon TEXT,
    sort_order INT DEFAULT 0,
    is_visible BOOLEAN NOT NULL DEFAULT true,
    is_featured BOOLEAN NOT NULL DEFAULT false,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    master_category_id UUID REFERENCES categories(id),
    product_count INT DEFAULT 0,
    active_product_count INT DEFAULT 0,
    quality_score INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_quality_score CHECK (quality_score >= 0 AND quality_score <= 100),
    CONSTRAINT unique_slug_per_parent UNIQUE(parent_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_path ON categories USING GIST(path);
CREATE INDEX IF NOT EXISTS idx_categories_level ON categories(level);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_visible ON categories(is_visible) WHERE is_visible = true;
CREATE INDEX IF NOT EXISTS idx_categories_featured ON categories(is_featured) WHERE is_featured = true;

-- ============================================================================
-- CATEGORY SOURCES
-- ============================================================================

CREATE TABLE IF NOT EXISTS category_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
    external_id TEXT NOT NULL,
    parent_external_id TEXT,
    source_data JSONB NOT NULL DEFAULT '{}',
    name TEXT NOT NULL,
    code TEXT,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    product_count INT DEFAULT 0,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sync_version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(source_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_category_sources_category ON category_sources(category_id);
CREATE INDEX IF NOT EXISTS idx_category_sources_source ON category_sources(source_id);
CREATE INDEX IF NOT EXISTS idx_category_sources_external_id ON category_sources(external_id);

-- ============================================================================
-- PRODUCTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    brand_id UUID REFERENCES brands(id),
    category_id UUID REFERENCES categories(id),
    description TEXT,
    code TEXT,
    is_variant BOOLEAN NOT NULL DEFAULT false,
    parent_product_id UUID REFERENCES products(id),
    main_image_url TEXT,
    images JSONB DEFAULT '[]',
    price_min DECIMAL(12,2),
    price_max DECIMAL(12,2),
    price_currency TEXT DEFAULT 'USD',
    stock_quantity INT DEFAULT 0,
    is_in_stock BOOLEAN DEFAULT false,
    attributes JSONB DEFAULT '{}',
    quality_score INT DEFAULT 0,
    source_count INT DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_featured BOOLEAN NOT NULL DEFAULT false,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    meta_title TEXT,
    meta_description TEXT,
    view_count INT DEFAULT 0,
    favorite_count INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_quality_score CHECK (quality_score >= 0 AND quality_score <= 100),
    CONSTRAINT valid_price_range CHECK (price_min <= price_max OR price_max IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_parent ON products(parent_product_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_products_in_stock ON products(is_in_stock) WHERE is_in_stock = true;
CREATE INDEX IF NOT EXISTS idx_products_price_range ON products(price_min, price_max);

-- ============================================================================
-- PRODUCT SOURCES
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
    external_id TEXT NOT NULL,
    brand_external_id TEXT,
    category_external_id TEXT,
    parent_external_id TEXT,
    source_data JSONB NOT NULL DEFAULT '{}',
    name TEXT NOT NULL,
    code TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    prices JSONB DEFAULT '[]',
    stock JSONB DEFAULT '{}',
    images JSONB DEFAULT '[]',
    characteristics JSONB DEFAULT '[]',
    properties JSONB DEFAULT '{}',
    barcodes JSONB DEFAULT '[]',
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sync_version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(source_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_product_sources_product ON product_sources(product_id);
CREATE INDEX IF NOT EXISTS idx_product_sources_source ON product_sources(source_id);
CREATE INDEX IF NOT EXISTS idx_product_sources_external_id ON product_sources(external_id);
CREATE INDEX IF NOT EXISTS idx_product_sources_active ON product_sources(is_active) WHERE is_active = true;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_category_sources_updated_at BEFORE UPDATE ON category_sources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_sources_updated_at BEFORE UPDATE ON product_sources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEW
-- ============================================================================

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
