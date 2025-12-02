-- ============================================================================
-- Migration: 015_cleanup_removed_features.sql
-- Description: Remove unused tables from removed features (notifications,
--              rollback, conflicts)
-- Date: 2025-12-02
-- ============================================================================

-- Drop views first (they depend on tables)
DROP VIEW IF EXISTS unresolved_sync_conflicts CASCADE;
DROP VIEW IF EXISTS rollback_capable_syncs CASCADE;

-- Drop triggers
DROP TRIGGER IF EXISTS trigger_sync_conflict_count ON sync_conflicts;

-- Drop functions
DROP FUNCTION IF EXISTS update_sync_log_conflict_count() CASCADE;
DROP FUNCTION IF EXISTS cleanup_expired_snapshots() CASCADE;

-- Drop columns from sync_logs (must drop FK constraint first)
ALTER TABLE sync_logs DROP COLUMN IF EXISTS snapshot_id;
ALTER TABLE sync_logs DROP COLUMN IF EXISTS conflict_count;
ALTER TABLE sync_logs DROP COLUMN IF EXISTS conflicts_resolved;
ALTER TABLE sync_logs DROP COLUMN IF EXISTS rollback_available;

-- Drop notification_config from sync_schedules (keeping table, removing unused column)
ALTER TABLE sync_schedules DROP COLUMN IF EXISTS notification_config;

-- Drop rollback tables (order matters due to FK constraints)
DROP TABLE IF EXISTS sync_rollbacks CASCADE;
DROP TABLE IF EXISTS sync_snapshot_data_brands CASCADE;
DROP TABLE IF EXISTS sync_snapshot_data_categories CASCADE;
DROP TABLE IF EXISTS sync_snapshot_data_products CASCADE;
DROP TABLE IF EXISTS sync_snapshot_data_properties CASCADE;
DROP TABLE IF EXISTS sync_snapshot_data_characteristics CASCADE;
DROP TABLE IF EXISTS sync_snapshot_data_other CASCADE;
DROP TABLE IF EXISTS sync_snapshot_data CASCADE;
DROP TABLE IF EXISTS sync_snapshots CASCADE;

-- Drop conflict tables
DROP TABLE IF EXISTS sync_conflict_rules CASCADE;
DROP TABLE IF EXISTS sync_conflicts CASCADE;

-- Drop notification table
DROP TABLE IF EXISTS sync_notifications CASCADE;

-- Clean up any orphaned indexes (they should be dropped with tables, but just in case)
DROP INDEX IF EXISTS idx_sync_snapshots_sync_log_id;
DROP INDEX IF EXISTS idx_sync_snapshots_created_at;
DROP INDEX IF EXISTS idx_sync_snapshots_expires_at;
DROP INDEX IF EXISTS idx_sync_snapshot_data_brands_snapshot_id;
DROP INDEX IF EXISTS idx_sync_snapshot_data_brands_entity;
DROP INDEX IF EXISTS idx_sync_snapshot_data_categories_snapshot_id;
DROP INDEX IF EXISTS idx_sync_snapshot_data_categories_entity;
DROP INDEX IF EXISTS idx_sync_snapshot_data_products_snapshot_id;
DROP INDEX IF EXISTS idx_sync_snapshot_data_products_entity;
DROP INDEX IF EXISTS idx_sync_snapshot_data_properties_snapshot_id;
DROP INDEX IF EXISTS idx_sync_snapshot_data_properties_entity;
DROP INDEX IF EXISTS idx_sync_snapshot_data_characteristics_snapshot_id;
DROP INDEX IF EXISTS idx_sync_snapshot_data_characteristics_entity;
DROP INDEX IF EXISTS idx_sync_snapshot_data_other_snapshot_id;
DROP INDEX IF EXISTS idx_sync_snapshot_data_other_entity;
DROP INDEX IF EXISTS idx_sync_rollbacks_original_sync;
DROP INDEX IF EXISTS idx_sync_rollbacks_snapshot_id;
DROP INDEX IF EXISTS idx_sync_rollbacks_status;
DROP INDEX IF EXISTS idx_sync_rollbacks_started_at;
DROP INDEX IF EXISTS idx_sync_conflicts_sync_log_id;
DROP INDEX IF EXISTS idx_sync_conflicts_entity;
DROP INDEX IF EXISTS idx_sync_conflicts_resolved;
DROP INDEX IF EXISTS idx_sync_conflicts_created_at;
DROP INDEX IF EXISTS idx_sync_conflict_rules_entity;
DROP INDEX IF EXISTS idx_sync_conflict_rules_priority;
DROP INDEX IF EXISTS idx_sync_conflicts_unresolved;
DROP INDEX IF EXISTS idx_sync_notifications_sync_log;
DROP INDEX IF EXISTS idx_sync_notifications_status;
DROP INDEX IF EXISTS idx_sync_notifications_created_at;
