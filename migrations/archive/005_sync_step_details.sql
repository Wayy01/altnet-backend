-- Migration: 005_sync_step_details.sql
-- Description: Add detailed step tracking for sync operations with change deltas

-- Create sync_step_details table to track per-step metrics
CREATE TABLE IF NOT EXISTS sync_step_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_log_id UUID NOT NULL REFERENCES sync_logs(id) ON DELETE CASCADE,
    step_number INT NOT NULL,
    step_name VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,

    -- Extraction counts
    extracted INT DEFAULT 0,           -- Total items processed from API

    -- Change deltas
    inserted INT DEFAULT 0,            -- New items added to DB
    updated INT DEFAULT 0,             -- Existing items modified
    unchanged INT DEFAULT 0,           -- Items with no changes
    failed INT DEFAULT 0,              -- Items that failed to sync

    -- Additional metadata
    error_message TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure unique step per sync log
    CONSTRAINT unique_step_per_sync UNIQUE (sync_log_id, step_number)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_sync_step_details_sync_log_id ON sync_step_details(sync_log_id);
CREATE INDEX IF NOT EXISTS idx_sync_step_details_step_number ON sync_step_details(step_number);

-- Add change delta columns to sync_logs for quick access
ALTER TABLE sync_logs
ADD COLUMN IF NOT EXISTS brands_inserted INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS brands_updated INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS categories_inserted INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS categories_updated INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS products_inserted INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS products_updated INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS properties_inserted INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS properties_updated INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS characteristics_inserted INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS characteristics_updated INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS prices_updated INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS stock_updated INT DEFAULT 0;

-- Comment on table
COMMENT ON TABLE sync_step_details IS 'Tracks detailed progress and change deltas for each sync step';
COMMENT ON COLUMN sync_step_details.extracted IS 'Total items fetched from API';
COMMENT ON COLUMN sync_step_details.inserted IS 'New items added to database';
COMMENT ON COLUMN sync_step_details.updated IS 'Existing items that were modified';
COMMENT ON COLUMN sync_step_details.unchanged IS 'Items that had no changes';
COMMENT ON COLUMN sync_step_details.failed IS 'Items that failed to sync';
