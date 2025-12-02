-- Migration: 007_phase4_advanced_features.sql
-- Description: Phase 4 - Rollback System, Conflict Resolution, Scheduling, Advanced Features
-- Date: 2025-11-21

-- ============================================================================
-- 1. ROLLBACK SYSTEM
-- ============================================================================

-- Sync snapshots table for rollback capability
-- Stores complete state before each sync for rollback
CREATE TABLE sync_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_log_id UUID NOT NULL REFERENCES sync_logs(id) ON DELETE CASCADE,
    snapshot_type VARCHAR(50) NOT NULL, -- 'pre_sync', 'checkpoint'
    step sync_step, -- NULL for full snapshot, specific step for partial
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP, -- For automatic cleanup
    metadata JSONB DEFAULT '{}'::JSONB, -- Additional metadata
    CONSTRAINT fk_sync_log FOREIGN KEY (sync_log_id) REFERENCES sync_logs(id)
);

-- Snapshot data table - stores actual data for rollback
-- Uses partitioning by entity_type for better performance
CREATE TABLE sync_snapshot_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_id UUID NOT NULL REFERENCES sync_snapshots(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL, -- 'brand', 'category', 'product', etc.
    entity_id UUID NOT NULL,
    entity_ultra_id VARCHAR(255),
    snapshot_data JSONB NOT NULL, -- Complete entity data at snapshot time
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
) PARTITION BY LIST (entity_type);

-- Create partitions for each entity type
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

-- Rollback operations log
CREATE TABLE sync_rollbacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_sync_log_id UUID NOT NULL REFERENCES sync_logs(id),
    snapshot_id UUID NOT NULL REFERENCES sync_snapshots(id),
    rollback_type VARCHAR(50) NOT NULL, -- 'full', 'partial', 'selective'
    rollback_scope JSONB DEFAULT '{}'::JSONB, -- Which entities/steps to rollback
    initiated_by VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'failed'
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP,
    entities_restored INT DEFAULT 0,
    errors JSONB DEFAULT '[]'::JSONB,
    metadata JSONB DEFAULT '{}'::JSONB
);

-- ============================================================================
-- 2. CONFLICT RESOLUTION
-- ============================================================================

-- Sync conflicts table
-- Tracks conflicts detected during sync (concurrent modifications)
CREATE TABLE sync_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_log_id UUID NOT NULL REFERENCES sync_logs(id) ON DELETE CASCADE,
    step sync_step NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    entity_ultra_id VARCHAR(255),
    conflict_type VARCHAR(50) NOT NULL, -- 'concurrent_modification', 'deleted_upstream', 'validation_error'
    local_data JSONB NOT NULL, -- Current database state
    remote_data JSONB NOT NULL, -- Data from Ultra API
    local_modified_at TIMESTAMP,
    remote_modified_at TIMESTAMP,
    resolution_strategy VARCHAR(50), -- 'local_wins', 'remote_wins', 'merge', 'manual'
    resolution_applied BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP,
    resolved_by VARCHAR(255),
    resolved_data JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::JSONB
);

-- Conflict resolution rules
CREATE TABLE sync_conflict_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    conflict_type VARCHAR(50) NOT NULL,
    priority INT NOT NULL DEFAULT 0, -- Higher priority rules are applied first
    conditions JSONB DEFAULT '{}'::JSONB, -- Conditions for applying this rule
    resolution_strategy VARCHAR(50) NOT NULL, -- 'local_wins', 'remote_wins', 'merge', 'skip'
    merge_strategy JSONB DEFAULT '{}'::JSONB, -- Field-level merge rules
    is_active BOOLEAN DEFAULT true,
    created_by VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. SCHEDULED SYNC
-- ============================================================================

-- Scheduled sync jobs
CREATE TABLE sync_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    configuration_id UUID REFERENCES sync_configurations(id) ON DELETE SET NULL,
    cron_expression VARCHAR(100) NOT NULL, -- Standard cron format
    timezone VARCHAR(50) DEFAULT 'UTC',
    is_active BOOLEAN DEFAULT true,
    last_run_at TIMESTAMP,
    next_run_at TIMESTAMP,
    last_status VARCHAR(50), -- 'success', 'failed', 'partial'
    run_count INT DEFAULT 0,
    failure_count INT DEFAULT 0,
    retry_config JSONB DEFAULT '{}'::JSONB, -- Retry policy configuration
    notification_config JSONB DEFAULT '{}'::JSONB, -- Email, Slack, webhook configs
    created_by VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Scheduled sync execution history
CREATE TABLE sync_schedule_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES sync_schedules(id) ON DELETE CASCADE,
    sync_log_id UUID REFERENCES sync_logs(id) ON DELETE SET NULL,
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP,
    status VARCHAR(50) NOT NULL, -- 'running', 'completed', 'failed', 'cancelled'
    retry_count INT DEFAULT 0,
    error_message TEXT,
    execution_metadata JSONB DEFAULT '{}'::JSONB
);

-- ============================================================================
-- 4. ADVANCED FILTERING
-- ============================================================================

-- Entity filters for selective sync
CREATE TABLE sync_entity_filters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    configuration_id UUID REFERENCES sync_configurations(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,
    filter_type VARCHAR(50) NOT NULL, -- 'include', 'exclude'
    filter_criteria JSONB NOT NULL, -- Complex filter conditions
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 5. INCREMENTAL SYNC TRACKING
-- ============================================================================

-- Entity modification tracking for incremental sync
-- Tracks last sync timestamp per entity for efficient incremental syncs
CREATE TABLE entity_sync_tracking (
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    entity_ultra_id VARCHAR(255) NOT NULL,
    last_synced_at TIMESTAMP NOT NULL,
    last_modified_at TIMESTAMP NOT NULL,
    sync_checksum VARCHAR(64), -- MD5/SHA256 hash for change detection
    PRIMARY KEY (entity_type, entity_id)
);

-- ============================================================================
-- 6. MONITORING & ALERTS
-- ============================================================================

-- Sync notifications/alerts
CREATE TABLE sync_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_log_id UUID REFERENCES sync_logs(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL, -- 'email', 'slack', 'webhook', 'push'
    recipient VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed'
    sent_at TIMESTAMP,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Sync performance metrics
CREATE TABLE sync_performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_log_id UUID NOT NULL REFERENCES sync_logs(id) ON DELETE CASCADE,
    step sync_step,
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC NOT NULL,
    metric_unit VARCHAR(50), -- 'seconds', 'count', 'bytes', 'percentage'
    recorded_at TIMESTAMP NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::JSONB
);

-- ============================================================================
-- 7. ENHANCED SYNC_LOGS FOR PHASE 4
-- ============================================================================

-- Add columns to sync_logs for Phase 4 features
ALTER TABLE sync_logs
    ADD COLUMN snapshot_id UUID REFERENCES sync_snapshots(id) ON DELETE SET NULL,
    ADD COLUMN conflict_count INT DEFAULT 0,
    ADD COLUMN conflicts_resolved INT DEFAULT 0,
    ADD COLUMN rollback_available BOOLEAN DEFAULT false,
    ADD COLUMN schedule_id UUID REFERENCES sync_schedules(id) ON DELETE SET NULL,
    ADD COLUMN is_incremental BOOLEAN DEFAULT false,
    ADD COLUMN entities_checked INT DEFAULT 0,
    ADD COLUMN entities_skipped_unchanged INT DEFAULT 0;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Snapshot indexes
CREATE INDEX idx_sync_snapshots_sync_log_id ON sync_snapshots(sync_log_id);
CREATE INDEX idx_sync_snapshots_created_at ON sync_snapshots(created_at DESC);
CREATE INDEX idx_sync_snapshots_expires_at ON sync_snapshots(expires_at) WHERE expires_at IS NOT NULL;

-- Indexes on partitioned table - must be created on each partition
CREATE INDEX idx_sync_snapshot_data_brands_snapshot_id ON sync_snapshot_data_brands(snapshot_id);
CREATE INDEX idx_sync_snapshot_data_brands_entity ON sync_snapshot_data_brands(entity_type, entity_id);

CREATE INDEX idx_sync_snapshot_data_categories_snapshot_id ON sync_snapshot_data_categories(snapshot_id);
CREATE INDEX idx_sync_snapshot_data_categories_entity ON sync_snapshot_data_categories(entity_type, entity_id);

CREATE INDEX idx_sync_snapshot_data_products_snapshot_id ON sync_snapshot_data_products(snapshot_id);
CREATE INDEX idx_sync_snapshot_data_products_entity ON sync_snapshot_data_products(entity_type, entity_id);

CREATE INDEX idx_sync_snapshot_data_properties_snapshot_id ON sync_snapshot_data_properties(snapshot_id);
CREATE INDEX idx_sync_snapshot_data_properties_entity ON sync_snapshot_data_properties(entity_type, entity_id);

CREATE INDEX idx_sync_snapshot_data_characteristics_snapshot_id ON sync_snapshot_data_characteristics(snapshot_id);
CREATE INDEX idx_sync_snapshot_data_characteristics_entity ON sync_snapshot_data_characteristics(entity_type, entity_id);

CREATE INDEX idx_sync_snapshot_data_other_snapshot_id ON sync_snapshot_data_other(snapshot_id);
CREATE INDEX idx_sync_snapshot_data_other_entity ON sync_snapshot_data_other(entity_type, entity_id);

-- Rollback indexes
CREATE INDEX idx_sync_rollbacks_original_sync ON sync_rollbacks(original_sync_log_id);
CREATE INDEX idx_sync_rollbacks_snapshot_id ON sync_rollbacks(snapshot_id);
CREATE INDEX idx_sync_rollbacks_status ON sync_rollbacks(status);
CREATE INDEX idx_sync_rollbacks_started_at ON sync_rollbacks(started_at DESC);

-- Conflict indexes
CREATE INDEX idx_sync_conflicts_sync_log_id ON sync_conflicts(sync_log_id);
CREATE INDEX idx_sync_conflicts_entity ON sync_conflicts(entity_type, entity_id);
CREATE INDEX idx_sync_conflicts_resolved ON sync_conflicts(resolution_applied);
CREATE INDEX idx_sync_conflicts_created_at ON sync_conflicts(created_at DESC);
CREATE INDEX idx_sync_conflict_rules_entity ON sync_conflict_rules(entity_type, conflict_type);
CREATE INDEX idx_sync_conflict_rules_priority ON sync_conflict_rules(priority DESC) WHERE is_active = true;

-- Schedule indexes
CREATE INDEX idx_sync_schedules_is_active ON sync_schedules(is_active);
CREATE INDEX idx_sync_schedules_next_run ON sync_schedules(next_run_at) WHERE is_active = true;
CREATE INDEX idx_sync_schedule_runs_schedule_id ON sync_schedule_runs(schedule_id);
CREATE INDEX idx_sync_schedule_runs_started_at ON sync_schedule_runs(started_at DESC);

-- Filter indexes
CREATE INDEX idx_sync_entity_filters_config ON sync_entity_filters(configuration_id);
CREATE INDEX idx_sync_entity_filters_entity_type ON sync_entity_filters(entity_type);

-- Tracking indexes
CREATE INDEX idx_entity_sync_tracking_last_synced ON entity_sync_tracking(last_synced_at);
CREATE INDEX idx_entity_sync_tracking_ultra_id ON entity_sync_tracking(entity_ultra_id);

-- Notification indexes
CREATE INDEX idx_sync_notifications_sync_log ON sync_notifications(sync_log_id);
CREATE INDEX idx_sync_notifications_status ON sync_notifications(status);
CREATE INDEX idx_sync_notifications_created_at ON sync_notifications(created_at DESC);

-- Performance metrics indexes
CREATE INDEX idx_sync_performance_metrics_sync_log ON sync_performance_metrics(sync_log_id);
CREATE INDEX idx_sync_performance_metrics_step ON sync_performance_metrics(step);
CREATE INDEX idx_sync_performance_metrics_recorded ON sync_performance_metrics(recorded_at DESC);

-- Composite indexes for common queries
CREATE INDEX idx_sync_conflicts_unresolved ON sync_conflicts(sync_log_id, resolution_applied) WHERE resolution_applied = false;
CREATE INDEX idx_sync_schedules_active_next_run ON sync_schedules(is_active, next_run_at) WHERE is_active = true;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE sync_snapshots IS 'Snapshots of database state before sync operations for rollback capability';
COMMENT ON TABLE sync_snapshot_data IS 'Actual entity data stored in snapshots (partitioned by entity_type)';
COMMENT ON TABLE sync_rollbacks IS 'Log of rollback operations performed';
COMMENT ON TABLE sync_conflicts IS 'Conflicts detected during sync operations requiring resolution';
COMMENT ON TABLE sync_conflict_rules IS 'Rules for automatic conflict resolution';
COMMENT ON TABLE sync_schedules IS 'Scheduled sync jobs with cron expressions';
COMMENT ON TABLE sync_schedule_runs IS 'Execution history of scheduled syncs';
COMMENT ON TABLE sync_entity_filters IS 'Advanced filtering rules for selective sync';
COMMENT ON TABLE entity_sync_tracking IS 'Tracks last sync time per entity for incremental sync optimization';
COMMENT ON TABLE sync_notifications IS 'Notifications sent for sync events';
COMMENT ON TABLE sync_performance_metrics IS 'Performance metrics collected during sync operations';

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to automatically calculate next_run_at for schedules
CREATE OR REPLACE FUNCTION calculate_next_run(cron_expr VARCHAR, last_run TIMESTAMP, tz VARCHAR DEFAULT 'UTC')
RETURNS TIMESTAMP AS $$
BEGIN
    -- This is a placeholder - actual implementation would use a cron parsing library
    -- For now, return a simple interval-based calculation
    IF last_run IS NULL THEN
        RETURN NOW();
    END IF;
    -- Simplified: assume daily run
    RETURN last_run + INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired snapshots
CREATE OR REPLACE FUNCTION cleanup_expired_snapshots()
RETURNS INT AS $$
DECLARE
    deleted_count INT;
BEGIN
    DELETE FROM sync_snapshots
    WHERE expires_at IS NOT NULL AND expires_at < NOW();

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update sync_logs.conflict_count
CREATE OR REPLACE FUNCTION update_sync_log_conflict_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE sync_logs
        SET conflict_count = conflict_count + 1
        WHERE id = NEW.sync_log_id;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' AND OLD.resolution_applied = false AND NEW.resolution_applied = true THEN
        UPDATE sync_logs
        SET conflicts_resolved = conflicts_resolved + 1
        WHERE id = NEW.sync_log_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE sync_logs
        SET conflict_count = GREATEST(0, conflict_count - 1)
        WHERE id = OLD.sync_log_id;
        RETURN OLD;  -- Return OLD for DELETE operations
    END IF;
    -- Fallback return for UPDATE without resolution change
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_conflict_count
    AFTER INSERT OR UPDATE OR DELETE ON sync_conflicts
    FOR EACH ROW EXECUTE FUNCTION update_sync_log_conflict_count();

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View for active scheduled syncs
CREATE VIEW active_sync_schedules AS
SELECT
    s.*,
    c.name as configuration_name,
    c.selected_steps,
    sr.started_at as last_run_started_at,
    sr.status as last_run_status
FROM sync_schedules s
LEFT JOIN sync_configurations c ON s.configuration_id = c.id
LEFT JOIN LATERAL (
    SELECT started_at, status
    FROM sync_schedule_runs
    WHERE schedule_id = s.id
    ORDER BY started_at DESC
    LIMIT 1
) sr ON true
WHERE s.is_active = true
ORDER BY s.next_run_at ASC;

-- View for unresolved conflicts
CREATE VIEW unresolved_sync_conflicts AS
SELECT
    c.*,
    sl.started_at as sync_started_at,
    sl.status as sync_status
FROM sync_conflicts c
JOIN sync_logs sl ON c.sync_log_id = sl.id
WHERE c.resolution_applied = false
ORDER BY c.created_at DESC;

-- View for rollback-capable syncs
CREATE VIEW rollback_capable_syncs AS
SELECT
    sl.*,
    ss.id as snapshot_id,
    ss.created_at as snapshot_created_at,
    ss.expires_at as snapshot_expires_at,
    COUNT(DISTINCT ssd.entity_id) as entities_in_snapshot
FROM sync_logs sl
JOIN sync_snapshots ss ON sl.snapshot_id = ss.id
LEFT JOIN sync_snapshot_data ssd ON ss.id = ssd.snapshot_id
WHERE sl.rollback_available = true
    AND (ss.expires_at IS NULL OR ss.expires_at > NOW())
GROUP BY sl.id, ss.id, ss.created_at, ss.expires_at
ORDER BY sl.started_at DESC;

-- View for sync performance summary
CREATE VIEW sync_performance_summary AS
SELECT
    sl.id as sync_log_id,
    sl.started_at,
    sl.duration_seconds,
    sl.status,
    COUNT(DISTINCT spm.id) as metrics_count,
    jsonb_object_agg(
        spm.metric_name,
        spm.metric_value
    ) FILTER (WHERE spm.metric_name IS NOT NULL) as metrics
FROM sync_logs sl
LEFT JOIN sync_performance_metrics spm ON sl.id = spm.sync_log_id
GROUP BY sl.id, sl.started_at, sl.duration_seconds, sl.status
ORDER BY sl.started_at DESC;

-- ============================================================================
-- INITIAL DATA (Optional)
-- ============================================================================

-- Insert default conflict resolution rules
INSERT INTO sync_conflict_rules (name, entity_type, conflict_type, priority, resolution_strategy, is_active) VALUES
    ('Remote Wins - Products', 'product', 'concurrent_modification', 10, 'remote_wins', true),
    ('Local Wins - Brands', 'brand', 'concurrent_modification', 10, 'local_wins', true),
    ('Remote Wins - Prices', 'product', 'concurrent_modification', 20, 'remote_wins', true),
    ('Skip Deleted Upstream', 'product', 'deleted_upstream', 30, 'skip', true);

-- ============================================================================
-- GRANTS (Adjust as needed for your security model)
-- ============================================================================

-- Grant permissions to application user (adjust as needed)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_app_user;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
