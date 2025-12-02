-- Migration: 006_selective_sync_system.sql
-- Description: Adds selective sync capabilities with field-level tracking
-- Date: 2025-11-21

-- Create enum type for sync steps
CREATE TYPE sync_step AS ENUM (
    'brands',
    'categories',
    'products',
    'properties',
    'prices',
    'stock',
    'exchange_rates'
);

-- Sync configurations table
-- Stores reusable sync configurations with field-level selections
CREATE TABLE sync_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    selected_steps sync_step[] NOT NULL DEFAULT '{}',
    field_config JSONB NOT NULL DEFAULT '{}', -- Map of step -> FieldConfig
    is_template BOOLEAN NOT NULL DEFAULT false,
    created_by VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMP
);

-- Sync changes table
-- Tracks all changes made during a selective sync
CREATE TABLE sync_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_log_id UUID NOT NULL REFERENCES sync_logs(id) ON DELETE CASCADE,
    step sync_step NOT NULL,
    entity_type VARCHAR(50) NOT NULL, -- 'brand', 'category', 'product', etc.
    entity_id UUID NOT NULL, -- ID of the affected entity
    entity_ultra_id VARCHAR(255), -- Ultra ID for reference
    change_type VARCHAR(20) NOT NULL, -- 'insert', 'update', 'skip'
    fields_changed JSONB NOT NULL DEFAULT '[]', -- Array of FieldChange objects
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Alter sync_logs to support selective sync
ALTER TABLE sync_logs
    ADD COLUMN selected_steps sync_step[] DEFAULT NULL,
    ADD COLUMN field_config JSONB DEFAULT NULL;

-- Add comments for documentation
COMMENT ON TABLE sync_configurations IS 'Reusable sync configurations with field-level selections';
COMMENT ON TABLE sync_changes IS 'Detailed change tracking for selective syncs';
COMMENT ON COLUMN sync_configurations.selected_steps IS 'Array of sync steps to execute';
COMMENT ON COLUMN sync_configurations.field_config IS 'JSON map of step name to FieldConfig with include_fields, exclude_fields, update_null_values';
COMMENT ON COLUMN sync_configurations.is_template IS 'Whether this is a reusable template';
COMMENT ON COLUMN sync_logs.selected_steps IS 'Steps that were executed in this sync (null for full sync)';
COMMENT ON COLUMN sync_logs.field_config IS 'Field configuration used for this sync (null for full sync)';
COMMENT ON COLUMN sync_changes.fields_changed IS 'Array of {field_name, old_value, new_value, was_null} objects';

-- Indexes for performance
CREATE INDEX idx_sync_configurations_name ON sync_configurations(name);
CREATE INDEX idx_sync_configurations_is_template ON sync_configurations(is_template);
CREATE INDEX idx_sync_configurations_created_at ON sync_configurations(created_at DESC);
CREATE INDEX idx_sync_configurations_last_used_at ON sync_configurations(last_used_at DESC);

CREATE INDEX idx_sync_changes_sync_log_id ON sync_changes(sync_log_id);
CREATE INDEX idx_sync_changes_step ON sync_changes(step);
CREATE INDEX idx_sync_changes_entity_type ON sync_changes(entity_type);
CREATE INDEX idx_sync_changes_entity_id ON sync_changes(entity_id);
CREATE INDEX idx_sync_changes_change_type ON sync_changes(change_type);
CREATE INDEX idx_sync_changes_created_at ON sync_changes(created_at DESC);
CREATE INDEX idx_sync_changes_composite ON sync_changes(sync_log_id, step, change_type);

CREATE INDEX idx_sync_logs_selected_steps ON sync_logs USING GIN(selected_steps);
CREATE INDEX idx_sync_logs_field_config ON sync_logs USING GIN(field_config);
CREATE INDEX idx_sync_configurations_field_config ON sync_configurations USING GIN(field_config);

-- Create composite index for common queries
CREATE INDEX idx_sync_changes_lookup ON sync_changes(sync_log_id, entity_type, entity_id);
