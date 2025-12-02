-- ============================================================================
-- ULTRA-DATA DATABASE - INITIAL SCHEMA
-- Consolidated from migrations 001-015
-- For fresh database installations only
-- Date: 2025-12-02
-- ============================================================================

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

CREATE TYPE sync_step AS ENUM (
    'brands',
    'categories',
    'products',
    'properties',
    'prices',
    'stock',
    'exchange_rates'
);

-- ============================================================================
-- CORE DOMAIN TABLES
-- ============================================================================

-- 1. BRANDS
CREATE TABLE brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ultra_id TEXT UNIQUE NOT NULL,
    code TEXT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    logo_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_brands_slug ON brands(slug);
CREATE INDEX idx_brands_ultra_id ON brands(ultra_id);
CREATE INDEX idx_brands_name ON brands(name);
CREATE INDEX idx_brands_is_active ON brands(is_active) WHERE is_active = true;

-- 2. CATEGORIES
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ultra_id TEXT UNIQUE NOT NULL,
    code TEXT,
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    parent_ultra_id TEXT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    sort_order INT DEFAULT 0,
    image_url TEXT,
    product_count INT DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    name_ru TEXT,
    name_ro TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_slug_per_parent UNIQUE(parent_id, slug)
);

CREATE INDEX idx_categories_parent_id ON categories(parent_id);
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_ultra_id ON categories(ultra_id);
CREATE INDEX idx_categories_is_active ON categories(is_active) WHERE is_active = true;

-- 3. PRODUCT SOURCES
CREATE TABLE product_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_deletable BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default source
INSERT INTO product_sources (name, description, is_default, is_deletable)
VALUES ('Ultra', 'Products synced from Ultra B2B API', TRUE, FALSE)
ON CONFLICT (name) DO NOTHING;

-- 4. PRODUCTS
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ultra_id TEXT UNIQUE NOT NULL,
    code TEXT,
    article TEXT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    parent_id UUID REFERENCES products(id) ON DELETE SET NULL,
    brand_ultra_id TEXT,
    category_ultra_id TEXT,
    parent_ultra_id TEXT,
    main_image_url TEXT,
    images JSONB DEFAULT '[]',
    warranty TEXT,
    barcodes JSONB DEFAULT '[]',
    price_min DECIMAL(12,2),
    price_max DECIMAL(12,2),
    prices JSONB DEFAULT '[]',
    price_mdl DECIMAL(12,2),
    price_eur DECIMAL(12,2),
    price_usd DECIMAL(12,2),
    total_stock INT DEFAULT 0,
    is_in_stock BOOLEAN DEFAULT false,
    variant_group_id UUID REFERENCES products(id),
    is_group BOOLEAN DEFAULT false,
    videos JSONB DEFAULT '[]',
    source_id UUID NOT NULL REFERENCES product_sources(id),
    name_ru TEXT,
    name_ro TEXT,
    description_ru TEXT,
    description_ro TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_service BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_brand_id ON products(brand_id);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_parent_id ON products(parent_id);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_ultra_id ON products(ultra_id);
CREATE INDEX idx_products_is_active ON products(is_active) WHERE is_active = true;
CREATE INDEX idx_products_source_id ON products(source_id);
CREATE INDEX idx_products_variant_group ON products(variant_group_id) WHERE variant_group_id IS NOT NULL;
CREATE INDEX idx_products_is_group ON products(is_group) WHERE is_group = true;

-- 5. PROPERTIES
CREATE TABLE properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    property_uuid TEXT,
    property_name TEXT NOT NULL,
    property_code TEXT,
    value TEXT,
    value_type TEXT,
    group_uuid TEXT,
    group_name TEXT,
    sort_order INT DEFAULT 0,
    is_filter BOOLEAN DEFAULT false,
    is_modification BOOLEAN DEFAULT false,
    property_name_ru TEXT,
    property_name_ro TEXT,
    group_name_ru TEXT,
    group_name_ro TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(product_id, property_uuid)
);

CREATE INDEX idx_properties_product_id ON properties(product_id);
CREATE INDEX idx_properties_property_uuid ON properties(property_uuid);
CREATE INDEX idx_properties_group_uuid ON properties(group_uuid);
CREATE INDEX idx_properties_group_name ON properties(group_name);
CREATE INDEX idx_properties_property_name ON properties(property_name);
CREATE INDEX idx_properties_hierarchy ON properties(group_name, property_name, value);

-- 6. CHARACTERISTICS (VARIANTS/SKUs)
CREATE TABLE characteristics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    ultra_id TEXT NOT NULL,
    code TEXT,
    reference TEXT,
    name TEXT NOT NULL,
    prices JSONB DEFAULT '[]',
    stock_warehouse INT DEFAULT 0,
    stock_showroom INT DEFAULT 0,
    stock_total INT DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(product_id, ultra_id)
);

CREATE INDEX idx_characteristics_product_id ON characteristics(product_id);
CREATE INDEX idx_characteristics_ultra_id ON characteristics(ultra_id);
CREATE INDEX idx_characteristics_name ON characteristics(name);
CREATE INDEX idx_characteristics_hierarchy ON characteristics(name);

-- 7. EXCHANGE RATES
CREATE TABLE exchange_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    currency_uuid TEXT UNIQUE NOT NULL,
    currency_code TEXT NOT NULL,
    currency_name TEXT NOT NULL,
    rate DECIMAL(12,4) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- SYNC SYSTEM TABLES
-- ============================================================================

-- 8. SYNC LOGS
CREATE TABLE sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_type TEXT NOT NULL DEFAULT 'full',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    duration_seconds INT,
    status TEXT NOT NULL DEFAULT 'running',
    brands_synced INT DEFAULT 0,
    categories_synced INT DEFAULT 0,
    products_synced INT DEFAULT 0,
    properties_synced INT DEFAULT 0,
    characteristics_synced INT DEFAULT 0,
    prices_synced INT DEFAULT 0,
    stock_synced INT DEFAULT 0,
    brands_inserted INT DEFAULT 0,
    brands_updated INT DEFAULT 0,
    categories_inserted INT DEFAULT 0,
    categories_updated INT DEFAULT 0,
    products_inserted INT DEFAULT 0,
    products_updated INT DEFAULT 0,
    properties_inserted INT DEFAULT 0,
    properties_updated INT DEFAULT 0,
    characteristics_inserted INT DEFAULT 0,
    characteristics_updated INT DEFAULT 0,
    prices_updated INT DEFAULT 0,
    stock_updated INT DEFAULT 0,
    selected_steps sync_step[] DEFAULT NULL,
    field_config JSONB DEFAULT NULL,
    schedule_id UUID,
    is_incremental BOOLEAN DEFAULT false,
    entities_checked INT DEFAULT 0,
    entities_skipped_unchanged INT DEFAULT 0,
    error_message TEXT,
    details JSONB DEFAULT '{}'
);

CREATE INDEX idx_sync_logs_status ON sync_logs(status);
CREATE INDEX idx_sync_logs_started_at ON sync_logs(started_at DESC);

-- 9. SYNC STEP DETAILS
CREATE TABLE sync_step_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_log_id UUID NOT NULL REFERENCES sync_logs(id) ON DELETE CASCADE,
    step_number INT NOT NULL,
    step_name VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    extracted INT DEFAULT 0,
    inserted INT DEFAULT 0,
    updated INT DEFAULT 0,
    unchanged INT DEFAULT 0,
    failed INT DEFAULT 0,
    items_processed INTEGER DEFAULT 0,
    items_total INTEGER DEFAULT 0,
    progress_percentage NUMERIC(5,2) DEFAULT 0.00,
    throughput_items_per_second NUMERIC(10,2),
    last_updated_at TIMESTAMPTZ DEFAULT NOW(),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_step_per_sync UNIQUE (sync_log_id, step_number)
);

CREATE INDEX idx_sync_step_details_sync_log ON sync_step_details(sync_log_id);

-- 10. SYNC CONFIGURATIONS
CREATE TABLE sync_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    selected_steps sync_step[] NOT NULL DEFAULT '{}',
    field_config JSONB NOT NULL DEFAULT '{}',
    is_template BOOLEAN NOT NULL DEFAULT false,
    created_by VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMP
);

-- 11. SYNC CHANGES
CREATE TABLE sync_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_log_id UUID NOT NULL REFERENCES sync_logs(id) ON DELETE CASCADE,
    step sync_step NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    entity_ultra_id VARCHAR(255),
    change_type VARCHAR(20) NOT NULL,
    fields_changed JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sync_changes_sync_log ON sync_changes(sync_log_id);
CREATE INDEX idx_sync_changes_entity ON sync_changes(entity_type, entity_id);

-- 12. SYNC SCHEDULES
CREATE TABLE sync_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    configuration_id UUID REFERENCES sync_configurations(id) ON DELETE SET NULL,
    cron_expression VARCHAR(100) NOT NULL,
    timezone VARCHAR(50) DEFAULT 'UTC',
    is_active BOOLEAN DEFAULT true,
    last_run_at TIMESTAMP,
    next_run_at TIMESTAMP,
    last_status VARCHAR(50),
    run_count INT DEFAULT 0,
    failure_count INT DEFAULT 0,
    retry_config JSONB DEFAULT '{}'::JSONB,
    created_by VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sync_schedules_next_run ON sync_schedules(next_run_at) WHERE is_active = true;
CREATE INDEX idx_sync_schedules_active ON sync_schedules(is_active);

-- Add FK from sync_logs to sync_schedules
ALTER TABLE sync_logs ADD CONSTRAINT fk_sync_logs_schedule
    FOREIGN KEY (schedule_id) REFERENCES sync_schedules(id) ON DELETE SET NULL;

-- 13. SYNC SCHEDULE RUNS
CREATE TABLE sync_schedule_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES sync_schedules(id) ON DELETE CASCADE,
    sync_log_id UUID REFERENCES sync_logs(id) ON DELETE SET NULL,
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP,
    status VARCHAR(50) NOT NULL,
    retry_count INT DEFAULT 0,
    error_message TEXT,
    execution_metadata JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX idx_sync_schedule_runs_schedule ON sync_schedule_runs(schedule_id);

-- 14. SYNC ENTITY FILTERS
CREATE TABLE sync_entity_filters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    configuration_id UUID REFERENCES sync_configurations(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,
    filter_type VARCHAR(50) NOT NULL,
    filter_criteria JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sync_entity_filters_config ON sync_entity_filters(configuration_id);

-- 15. ENTITY SYNC TRACKING
CREATE TABLE entity_sync_tracking (
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    entity_ultra_id VARCHAR(255) NOT NULL,
    last_synced_at TIMESTAMP NOT NULL,
    last_modified_at TIMESTAMP NOT NULL,
    sync_checksum VARCHAR(64),
    PRIMARY KEY (entity_type, entity_id)
);

-- 16. SYNC PERFORMANCE METRICS
CREATE TABLE sync_performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_log_id UUID NOT NULL REFERENCES sync_logs(id) ON DELETE CASCADE,
    step sync_step,
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC NOT NULL,
    metric_unit VARCHAR(50),
    recorded_at TIMESTAMP NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX idx_sync_performance_sync_log ON sync_performance_metrics(sync_log_id);

-- 17. SYNC LOG ENTRIES (Real-time logging)
CREATE TABLE sync_log_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_log_id UUID NOT NULL REFERENCES sync_logs(id) ON DELETE CASCADE,
    step_number INTEGER,
    level VARCHAR(20) NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error', 'fatal')),
    message TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sync_log_entries_sync_log ON sync_log_entries(sync_log_id, timestamp DESC);
CREATE INDEX idx_sync_log_entries_level ON sync_log_entries(sync_log_id, level);

-- 18. SYNC PROGRESS SNAPSHOTS
CREATE TABLE sync_progress_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_log_id UUID NOT NULL REFERENCES sync_logs(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    step_name VARCHAR(50) NOT NULL,
    items_processed INTEGER NOT NULL DEFAULT 0,
    items_total INTEGER NOT NULL DEFAULT 0,
    progress_percentage NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    elapsed_seconds INTEGER NOT NULL DEFAULT 0,
    estimated_remaining_seconds INTEGER,
    throughput_items_per_second NUMERIC(10,2),
    memory_usage_mb NUMERIC(10,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sync_progress_snapshots_sync_log ON sync_progress_snapshots(sync_log_id, created_at DESC);

-- 19. SYNC API REQUESTS (Debug logging)
CREATE TABLE sync_api_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_log_id UUID NOT NULL REFERENCES sync_logs(id) ON DELETE CASCADE,
    step_number INTEGER,
    method VARCHAR(10) NOT NULL,
    url TEXT NOT NULL,
    request_headers JSONB,
    request_body TEXT,
    response_status INTEGER,
    response_headers JSONB,
    response_body TEXT,
    duration_ms INTEGER,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sync_api_requests_sync_log ON sync_api_requests(sync_log_id);

-- ============================================================================
-- TRANSLATION SYSTEM TABLES
-- ============================================================================

-- 20. TRANSLATION JOBS
CREATE TABLE translation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,
    target_language VARCHAR(10) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    total_items INTEGER DEFAULT 0,
    translated_items INTEGER DEFAULT 0,
    failed_items INTEGER DEFAULT 0,
    skipped_items INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_translation_jobs_status ON translation_jobs(status);

-- 21. TRANSLATION LOGS
CREATE TABLE translation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES translation_jobs(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    field_name VARCHAR(100) NOT NULL,
    original_value TEXT NOT NULL,
    source_text TEXT NOT NULL,
    translated_text TEXT,
    target_language VARCHAR(10) NOT NULL,
    status VARCHAR(20) NOT NULL,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_translation_logs_job ON translation_logs(job_id);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Active sync schedules view
CREATE VIEW active_sync_schedules AS
SELECT
    ss.*,
    sc.name as config_name,
    sc.selected_steps,
    sc.field_config
FROM sync_schedules ss
LEFT JOIN sync_configurations sc ON ss.configuration_id = sc.id
WHERE ss.is_active = true
ORDER BY ss.next_run_at;

-- Recent sync runs view
CREATE VIEW recent_sync_runs AS
SELECT
    sl.*,
    ss.name as schedule_name
FROM sync_logs sl
LEFT JOIN sync_schedules ss ON sl.schedule_id = ss.id
ORDER BY sl.started_at DESC
LIMIT 100;

-- ============================================================================
-- TABLE COMMENTS
-- ============================================================================

COMMENT ON TABLE brands IS 'Product brands synced from Ultra B2B API';
COMMENT ON TABLE categories IS 'Product categories with hierarchical structure';
COMMENT ON TABLE products IS 'Core product catalog';
COMMENT ON TABLE properties IS 'Product specifications and attributes';
COMMENT ON TABLE characteristics IS 'Product variants/SKUs with pricing and stock';
COMMENT ON TABLE product_sources IS 'Origin tracking for products (Ultra sync vs manual)';
COMMENT ON TABLE sync_logs IS 'High-level sync operation logs';
COMMENT ON TABLE sync_step_details IS 'Per-step metrics within a sync operation';
COMMENT ON TABLE sync_configurations IS 'Saved selective sync configurations';
COMMENT ON TABLE sync_changes IS 'Field-level change tracking for sync auditing';
COMMENT ON TABLE sync_schedules IS 'Scheduled sync jobs with cron expressions';
COMMENT ON TABLE translation_jobs IS 'Translation job tracking';
