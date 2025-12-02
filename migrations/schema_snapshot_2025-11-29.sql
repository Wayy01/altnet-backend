-- ============================================================================
-- ULTRA-DATA DATABASE SCHEMA SNAPSHOT
-- Consolidated structure from migrations 003–014 (ultra-data only)
-- Snapshot timestamp: 2025-11-29T00:00:00Z
-- NOTE: Documentation only – not intended to be run as a migration.
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

-- 1. BRANDS ------------------------------------------------------------------

CREATE TABLE brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identity from Ultra
    ultra_id TEXT UNIQUE NOT NULL,              -- UUID from Ultra API
    code TEXT,

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

-- 2. CATEGORIES --------------------------------------------------------------

CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identity from Ultra
    ultra_id TEXT UNIQUE NOT NULL,
    code TEXT,

    -- Hierarchy
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    parent_ultra_id TEXT,

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

    -- Translations
    name_ru TEXT,
    name_ro TEXT,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_slug_per_parent UNIQUE(parent_id, slug)
);

-- 3. PRODUCT SOURCES (ORIGIN OF PRODUCTS) ------------------------------------

CREATE TABLE product_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_deletable BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. PRODUCTS -----------------------------------------------------------------

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identity from Ultra
    ultra_id TEXT UNIQUE NOT NULL,
    code TEXT,
    article TEXT,

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
    images JSONB DEFAULT '[]',

    -- Product metadata
    warranty TEXT,
    barcodes JSONB DEFAULT '[]',

    -- Aggregated pricing (from characteristics)
    price_min DECIMAL(12,2),
    price_max DECIMAL(12,2),

    -- Multi-currency prices
    prices JSONB DEFAULT '[]',
    price_mdl DECIMAL(12,2),
    price_eur DECIMAL(12,2),
    price_usd DECIMAL(12,2),

    -- Aggregated stock (from characteristics)
    total_stock INT DEFAULT 0,
    is_in_stock BOOLEAN DEFAULT false,

    -- Variant grouping
    variant_group_id UUID REFERENCES products(id),
    is_group BOOLEAN DEFAULT false,

    -- Videos
    videos JSONB DEFAULT '[]',

    -- Source tracking
    source_id UUID NOT NULL REFERENCES product_sources(id),

    -- Translations
    name_ru TEXT,
    name_ro TEXT,
    description_ru TEXT,
    description_ro TEXT,

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_service BOOLEAN DEFAULT false,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. PROPERTIES (PRODUCT SPECIFICATIONS) -------------------------------------

CREATE TABLE properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Links
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

    -- Property definition
    property_uuid TEXT,
    property_name TEXT NOT NULL,
    property_code TEXT,

    -- Property value
    value TEXT,
    value_type TEXT,

    -- Property grouping
    group_uuid TEXT,
    group_name TEXT,

    -- Display
    sort_order INT DEFAULT 0,

    -- Filtering
    is_filter BOOLEAN DEFAULT false,
    is_modification BOOLEAN DEFAULT false,

    -- Translations (names/groups only)
    property_name_ru TEXT,
    property_name_ro TEXT,
    group_name_ru TEXT,
    group_name_ro TEXT,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(product_id, property_uuid)
);

-- 6. CHARACTERISTICS (VARIANTS / SKUs) ---------------------------------------

CREATE TABLE characteristics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Links
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

    -- Characteristic identity from Ultra
    ultra_id TEXT NOT NULL,
    code TEXT,
    reference TEXT,

    -- Characteristic info
    name TEXT NOT NULL,

    -- Pricing (multi-currency)
    prices JSONB DEFAULT '[]',

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

-- 7. EXCHANGE RATES ----------------------------------------------------------

CREATE TABLE exchange_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    currency_uuid TEXT UNIQUE NOT NULL,
    currency_code TEXT NOT NULL,
    currency_name TEXT NOT NULL,

    rate DECIMAL(12,4) NOT NULL,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- SYNC LOGGING & AUDIT TABLES
-- ============================================================================

-- 8. SYNC LOGS (HIGH-LEVEL RUNS) --------------------------------------------

CREATE TABLE sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Sync info
    sync_type TEXT NOT NULL DEFAULT 'full',   -- 'full', 'incremental'
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    duration_seconds INT,

    -- Status
    status TEXT NOT NULL DEFAULT 'running',   -- 'running', 'success', 'failed'

    -- Counts
    brands_synced INT DEFAULT 0,
    categories_synced INT DEFAULT 0,
    products_synced INT DEFAULT 0,
    properties_synced INT DEFAULT 0,
    characteristics_synced INT DEFAULT 0,
    prices_synced INT DEFAULT 0,
    stock_synced INT DEFAULT 0,

    -- Change deltas (005)
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

    -- Selective sync config (006)
    selected_steps sync_step[] DEFAULT NULL,
    field_config JSONB DEFAULT NULL,

    -- Phase 4 fields (007)
    snapshot_id UUID REFERENCES sync_snapshots(id) ON DELETE SET NULL,
    conflict_count INT DEFAULT 0,
    conflicts_resolved INT DEFAULT 0,
    rollback_available BOOLEAN DEFAULT false,
    schedule_id UUID REFERENCES sync_schedules(id) ON DELETE SET NULL,
    is_incremental BOOLEAN DEFAULT false,
    entities_checked INT DEFAULT 0,
    entities_skipped_unchanged INT DEFAULT 0,

    -- Errors & details
    error_message TEXT,
    details JSONB DEFAULT '{}'
);

-- 9. SYNC STEP DETAILS (PER-STEP METRICS) -----------------------------------

CREATE TABLE sync_step_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_log_id UUID NOT NULL REFERENCES sync_logs(id) ON DELETE CASCADE,
    step_number INT NOT NULL,
    step_name VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Extraction counts
    extracted INT DEFAULT 0,

    -- Change deltas
    inserted INT DEFAULT 0,
    updated INT DEFAULT 0,
    unchanged INT DEFAULT 0,
    failed INT DEFAULT 0,

    -- Real-time progress (009_real_time_sync_logging)
    items_processed INTEGER DEFAULT 0,
    items_total INTEGER DEFAULT 0,
    progress_percentage NUMERIC(5,2) DEFAULT 0.00,
    throughput_items_per_second NUMERIC(10,2),
    last_updated_at TIMESTAMPTZ DEFAULT NOW(),

    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_step_per_sync UNIQUE (sync_log_id, step_number)
);

-- 10. SYNC CONFIGURATIONS (SELECTIVE SYNC) ----------------------------------

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

-- 11. SYNC CHANGES (FIELD-LEVEL CHANGE LOG) ---------------------------------

CREATE TABLE sync_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_log_id UUID NOT NULL REFERENCES sync_logs(id) ON DELETE CASCADE,
    step sync_step NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    entity_ultra_id VARCHAR(255),
    change_type VARCHAR(20) NOT NULL,           -- 'insert', 'update', 'skip'
    fields_changed JSONB NOT NULL DEFAULT '[]', -- Array of field-change objects
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 12. SYNC SNAPSHOTS (ROLLBACK SYSTEM) --------------------------------------

CREATE TABLE sync_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_log_id UUID NOT NULL REFERENCES sync_logs(id) ON DELETE CASCADE,
    snapshot_type VARCHAR(50) NOT NULL, -- 'pre_sync', 'checkpoint'
    step sync_step,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP,
    metadata JSONB DEFAULT '{}'::JSONB
);

CREATE TABLE sync_snapshot_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_id UUID NOT NULL REFERENCES sync_snapshots(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    entity_ultra_id VARCHAR(255),
    snapshot_data JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
) PARTITION BY LIST (entity_type);

CREATE TABLE sync_snapshot_data_brands PARTITION OF sync_snapshot_data
    FOR VALUES IN ('brand');

CREATE TABLE sync_snapshot_data_categories PARTITION OF sync_snapshot_data
    FOR VALUES IN ('category');

CREATE TABLE sync_snapshot_data_products PARTITION OF sync_snapshot_data
    FOR VALUES IN ('product');

CREATE TABLE sync_snapshot_data_properties PARTITION OF sync_snapshot_data
    FOR VALUES IN ('property');

CREATE TABLE sync_snapshot_data_characteristics PARTITION OF sync_snapshot_data
    FOR VALUES IN ('characteristic');

CREATE TABLE sync_snapshot_data_other PARTITION OF sync_snapshot_data
    DEFAULT;

-- 13. SYNC ROLLBACKS ---------------------------------------------------------

CREATE TABLE sync_rollbacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_sync_log_id UUID NOT NULL REFERENCES sync_logs(id),
    snapshot_id UUID NOT NULL REFERENCES sync_snapshots(id),
    rollback_type VARCHAR(50) NOT NULL, -- 'full', 'partial', 'selective'
    rollback_scope JSONB DEFAULT '{}'::JSONB,
    initiated_by VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP,
    entities_restored INT DEFAULT 0,
    errors JSONB DEFAULT '[]'::JSONB,
    metadata JSONB DEFAULT '{}'::JSONB
);

-- 14. SYNC CONFLICTS & RULES -------------------------------------------------

CREATE TABLE sync_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_log_id UUID NOT NULL REFERENCES sync_logs(id) ON DELETE CASCADE,
    step sync_step NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    entity_ultra_id VARCHAR(255),
    conflict_type VARCHAR(50) NOT NULL,
    local_data JSONB NOT NULL,
    remote_data JSONB NOT NULL,
    local_modified_at TIMESTAMP,
    remote_modified_at TIMESTAMP,
    resolution_strategy VARCHAR(50),
    resolution_applied BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP,
    resolved_by VARCHAR(255),
    resolved_data JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::JSONB
);

CREATE TABLE sync_conflict_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    conflict_type VARCHAR(50) NOT NULL,
    priority INT NOT NULL DEFAULT 0,
    conditions JSONB DEFAULT '{}'::JSONB,
    resolution_strategy VARCHAR(50) NOT NULL,
    merge_strategy JSONB DEFAULT '{}'::JSONB,
    is_active BOOLEAN DEFAULT true,
    created_by VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 15. SYNC SCHEDULING --------------------------------------------------------

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
    notification_config JSONB DEFAULT '{}'::JSONB,
    created_by VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

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

-- 16. SYNC ENTITY FILTERS ----------------------------------------------------

CREATE TABLE sync_entity_filters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    configuration_id UUID REFERENCES sync_configurations(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,
    filter_type VARCHAR(50) NOT NULL, -- 'include', 'exclude'
    filter_criteria JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 17. INCREMENTAL SYNC TRACKING ----------------------------------------------

CREATE TABLE entity_sync_tracking (
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    entity_ultra_id VARCHAR(255) NOT NULL,
    last_synced_at TIMESTAMP NOT NULL,
    last_modified_at TIMESTAMP NOT NULL,
    sync_checksum VARCHAR(64),
    PRIMARY KEY (entity_type, entity_id)
);

-- 18. SYNC NOTIFICATIONS -----------------------------------------------------

CREATE TABLE sync_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_log_id UUID REFERENCES sync_logs(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    sent_at TIMESTAMP,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 19. SYNC PERFORMANCE METRICS -----------------------------------------------

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

-- 20. REAL-TIME SYNC LOGGING TABLES (009_real_time_sync_logging) ------------

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

-- ============================================================================
-- TRANSLATION SYSTEM TABLES
-- ============================================================================

CREATE TABLE translation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,            -- 'products', 'categories', 'properties'
    target_language VARCHAR(10) NOT NULL,        -- 'ru', 'ro'
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

-- ============================================================================
-- NOTE
-- ============================================================================
-- This snapshot is meant for documentation/inspection of the current
-- ultra-data schema. Runtime-populated defaults (e.g. specific UUID defaults
-- set via DO blocks) are not encoded here.
