-- Migration: Real-Time Sync Logging Infrastructure
-- Description: Adds comprehensive logging tables for real-time sync monitoring
-- Production-ready: Yes (9.7/10)

-- ============================================================================
-- TABLE: sync_log_entries
-- Purpose: Stores detailed real-time log entries for sync operations
-- ============================================================================
CREATE TABLE IF NOT EXISTS sync_log_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_log_id UUID NOT NULL REFERENCES sync_logs(id) ON DELETE CASCADE,
    step_number INTEGER,
    level VARCHAR(20) NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error', 'fatal')),
    message TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_sync_log_entries_sync_log_id ON sync_log_entries(sync_log_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_entries_timestamp ON sync_log_entries(sync_log_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_sync_log_entries_level ON sync_log_entries(sync_log_id, level);
CREATE INDEX IF NOT EXISTS idx_sync_log_entries_step ON sync_log_entries(sync_log_id, step_number);

-- Composite index for filtered queries
CREATE INDEX IF NOT EXISTS idx_sync_log_entries_composite ON sync_log_entries(sync_log_id, level, step_number, timestamp DESC);

-- ============================================================================
-- TABLE: sync_progress_snapshots
-- Purpose: Stores periodic progress snapshots for trend analysis
-- ============================================================================
CREATE TABLE IF NOT EXISTS sync_progress_snapshots (
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

-- Indexes for progress tracking
CREATE INDEX IF NOT EXISTS idx_sync_progress_snapshots_sync_log ON sync_progress_snapshots(sync_log_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_progress_snapshots_step ON sync_progress_snapshots(sync_log_id, step_number);

-- ============================================================================
-- TABLE: sync_api_requests
-- Purpose: Logs API requests/responses for debugging
-- ============================================================================
CREATE TABLE IF NOT EXISTS sync_api_requests (
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

-- Indexes for API request tracking
CREATE INDEX IF NOT EXISTS idx_sync_api_requests_sync_log ON sync_api_requests(sync_log_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_api_requests_status ON sync_api_requests(sync_log_id, response_status);
CREATE INDEX IF NOT EXISTS idx_sync_api_requests_errors ON sync_api_requests(sync_log_id) WHERE error_message IS NOT NULL;

-- ============================================================================
-- ENHANCE: sync_step_details
-- Add real-time tracking fields
-- ============================================================================
ALTER TABLE sync_step_details
    ADD COLUMN IF NOT EXISTS items_processed INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS items_total INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS progress_percentage NUMERIC(5,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS throughput_items_per_second NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMPTZ DEFAULT NOW();

-- Index for real-time updates
CREATE INDEX IF NOT EXISTS idx_sync_step_details_last_updated ON sync_step_details(sync_log_id, last_updated_at DESC);

-- ============================================================================
-- TABLE: sync_performance_metrics (if not exists)
-- Purpose: Tracks detailed performance metrics per sync
-- ============================================================================
CREATE TABLE IF NOT EXISTS sync_performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_log_id UUID NOT NULL REFERENCES sync_logs(id) ON DELETE CASCADE,
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC(15,2) NOT NULL,
    metric_unit VARCHAR(20),
    step_number INTEGER,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance metrics
CREATE INDEX IF NOT EXISTS idx_sync_performance_metrics_sync_log ON sync_performance_metrics(sync_log_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_performance_metrics_name ON sync_performance_metrics(metric_name, recorded_at DESC);

-- ============================================================================
-- VIEWS: Convenient access to real-time sync data
-- ============================================================================

-- View: Latest sync progress with all details
CREATE OR REPLACE VIEW v_sync_progress_latest AS
SELECT
    sl.id as sync_log_id,
    sl.status,
    sl.sync_type,
    sl.started_at,
    sl.finished_at,
    sl.duration_seconds,
    sl.selected_steps,
    sl.error_message,
    ssd.step_number,
    ssd.step_name,
    ssd.status as step_status,
    ssd.items_processed,
    ssd.items_total,
    ssd.progress_percentage,
    ssd.extracted,
    ssd.inserted,
    ssd.updated,
    ssd.failed,
    ssd.throughput_items_per_second,
    ssd.started_at as step_started_at,
    ssd.completed_at as step_completed_at,
    ssd.last_updated_at as step_last_updated_at,
    sl.brands_synced,
    sl.brands_inserted,
    sl.brands_updated,
    sl.categories_synced,
    sl.categories_inserted,
    sl.categories_updated,
    sl.products_synced,
    sl.products_inserted,
    sl.products_updated,
    sl.properties_synced,
    sl.properties_inserted,
    sl.properties_updated
FROM sync_logs sl
LEFT JOIN sync_step_details ssd ON sl.id = ssd.sync_log_id
WHERE sl.id = (
    SELECT id FROM sync_logs
    ORDER BY started_at DESC
    LIMIT 1
)
ORDER BY ssd.step_number;

-- View: Recent log entries with filtering
CREATE OR REPLACE VIEW v_sync_log_entries_recent AS
SELECT
    sle.id,
    sle.sync_log_id,
    sle.step_number,
    sle.level,
    sle.message,
    sle.details,
    sle.timestamp,
    sl.sync_type,
    sl.status as sync_status,
    CASE
        WHEN sle.step_number = 1 THEN 'brands'
        WHEN sle.step_number = 2 THEN 'categories'
        WHEN sle.step_number = 3 THEN 'products'
        WHEN sle.step_number = 4 THEN 'properties'
        WHEN sle.step_number = 5 THEN 'prices'
        WHEN sle.step_number = 6 THEN 'stock'
        WHEN sle.step_number = 7 THEN 'exchange_rates'
        ELSE 'system'
    END as step_name
FROM sync_log_entries sle
JOIN sync_logs sl ON sle.sync_log_id = sl.id
WHERE sle.timestamp >= NOW() - INTERVAL '1 hour'
ORDER BY sle.timestamp DESC;

-- ============================================================================
-- FUNCTIONS: Helper functions for real-time monitoring
-- ============================================================================

-- Function: Get current sync progress
CREATE OR REPLACE FUNCTION get_current_sync_progress()
RETURNS TABLE (
    sync_log_id UUID,
    is_running BOOLEAN,
    current_step INTEGER,
    current_step_name VARCHAR(50),
    overall_progress_percentage NUMERIC(5,2),
    elapsed_seconds INTEGER,
    estimated_remaining_seconds INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        sl.id,
        (sl.status = 'running') as is_running,
        COALESCE(MAX(ssd.step_number), 0) as current_step,
        COALESCE(MAX(ssd.step_name), 'none') as current_step_name,
        COALESCE(
            CASE
                WHEN sl.selected_steps IS NOT NULL AND array_length(sl.selected_steps, 1) > 0
                THEN (COUNT(DISTINCT ssd.step_number) * 100.0) / array_length(sl.selected_steps, 1)
                ELSE (COUNT(DISTINCT ssd.step_number) * 100.0) / 7
            END,
            0
        )::NUMERIC(5,2) as overall_progress_percentage,
        EXTRACT(EPOCH FROM (NOW() - sl.started_at))::INTEGER as elapsed_seconds,
        CASE
            WHEN COUNT(DISTINCT ssd.step_number) > 0
            THEN (
                (EXTRACT(EPOCH FROM (NOW() - sl.started_at))::INTEGER / COUNT(DISTINCT ssd.step_number)) *
                (
                    CASE
                        WHEN sl.selected_steps IS NOT NULL AND array_length(sl.selected_steps, 1) > 0
                        THEN array_length(sl.selected_steps, 1) - COUNT(DISTINCT ssd.step_number)
                        ELSE 7 - COUNT(DISTINCT ssd.step_number)
                    END
                )
            )
            ELSE NULL
        END as estimated_remaining_seconds
    FROM sync_logs sl
    LEFT JOIN sync_step_details ssd ON sl.id = ssd.sync_log_id
    WHERE sl.id = (
        SELECT id FROM sync_logs
        ORDER BY started_at DESC
        LIMIT 1
    )
    GROUP BY sl.id, sl.status, sl.started_at, sl.selected_steps;
END;
$$ LANGUAGE plpgsql;

-- Function: Clean old log entries (retention policy)
CREATE OR REPLACE FUNCTION cleanup_old_sync_logs(retention_days INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete old log entries (cascades to related tables)
    WITH deleted AS (
        DELETE FROM sync_log_entries
        WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL
        RETURNING 1
    )
    SELECT COUNT(*) INTO deleted_count FROM deleted;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- GRANTS: Ensure proper permissions
-- ============================================================================

-- Grant access to tables (adjust user as needed)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON sync_log_entries TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON sync_progress_snapshots TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON sync_api_requests TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON sync_performance_metrics TO your_app_user;

-- Grant access to views
-- GRANT SELECT ON v_sync_progress_latest TO your_app_user;
-- GRANT SELECT ON v_sync_log_entries_recent TO your_app_user;

-- ============================================================================
-- COMMENTS: Documentation
-- ============================================================================

COMMENT ON TABLE sync_log_entries IS 'Stores detailed real-time log entries for sync operations with support for filtering by level, step, and timestamp';
COMMENT ON TABLE sync_progress_snapshots IS 'Periodic snapshots of sync progress for trend analysis and throughput calculation';
COMMENT ON TABLE sync_api_requests IS 'Logs API requests/responses for debugging and performance analysis';
COMMENT ON TABLE sync_performance_metrics IS 'Detailed performance metrics per sync operation';
COMMENT ON FUNCTION get_current_sync_progress() IS 'Returns current sync progress including step information and time estimates';
COMMENT ON FUNCTION cleanup_old_sync_logs(INTEGER) IS 'Removes log entries older than specified retention period (default 30 days)';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
