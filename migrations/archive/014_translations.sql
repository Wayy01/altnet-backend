-- ============================================================================
-- Translation System Migration
-- Adds translation columns and job tracking tables
-- ============================================================================

-- Add translation columns to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS name_ru TEXT,
ADD COLUMN IF NOT EXISTS name_ro TEXT,
ADD COLUMN IF NOT EXISTS description_ru TEXT,
ADD COLUMN IF NOT EXISTS description_ro TEXT;

-- Add translation columns to categories table
ALTER TABLE categories
ADD COLUMN IF NOT EXISTS name_ru TEXT,
ADD COLUMN IF NOT EXISTS name_ro TEXT;

-- Add translation columns to properties table
-- Note: We translate group_name and property_name, NOT values (values are technical specs)
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS property_name_ru TEXT,
ADD COLUMN IF NOT EXISTS property_name_ro TEXT,
ADD COLUMN IF NOT EXISTS group_name_ru TEXT,
ADD COLUMN IF NOT EXISTS group_name_ro TEXT;

-- Create translation_jobs table for tracking translation progress
CREATE TABLE IF NOT EXISTS translation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL, -- 'products', 'categories', 'properties'
    target_language VARCHAR(10) NOT NULL, -- 'ru', 'ro'
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed', 'cancelled'
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

-- Create translation_logs table for detailed logging
CREATE TABLE IF NOT EXISTS translation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES translation_jobs(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID, -- Can be NULL for property group/name translations
    field_name VARCHAR(100) NOT NULL,
    original_value TEXT NOT NULL, -- The original text that was translated
    source_text TEXT NOT NULL, -- The text sent to Google Translate
    translated_text TEXT,
    target_language VARCHAR(10) NOT NULL,
    status VARCHAR(20) NOT NULL, -- 'success', 'failed', 'skipped'
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_translation_jobs_status ON translation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_translation_jobs_entity_type ON translation_jobs(entity_type);
CREATE INDEX IF NOT EXISTS idx_translation_jobs_target_language ON translation_jobs(target_language);
CREATE INDEX IF NOT EXISTS idx_translation_jobs_created_at ON translation_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_translation_logs_job_id ON translation_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_translation_logs_entity ON translation_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_translation_logs_status ON translation_logs(status);
CREATE INDEX IF NOT EXISTS idx_translation_logs_created_at ON translation_logs(created_at DESC);

-- Add indexes for searching translated content
CREATE INDEX IF NOT EXISTS idx_products_name_ru ON products(name_ru) WHERE name_ru IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_name_ro ON products(name_ro) WHERE name_ro IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_categories_name_ru ON categories(name_ru) WHERE name_ru IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_categories_name_ro ON categories(name_ro) WHERE name_ro IS NOT NULL;

-- Add indexes for finding untranslated items
CREATE INDEX IF NOT EXISTS idx_products_untranslated_ru ON products(id) WHERE name_ru IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_untranslated_ro ON products(id) WHERE name_ro IS NULL;
CREATE INDEX IF NOT EXISTS idx_categories_untranslated_ru ON categories(id) WHERE name_ru IS NULL;
CREATE INDEX IF NOT EXISTS idx_categories_untranslated_ro ON categories(id) WHERE name_ro IS NULL;
CREATE INDEX IF NOT EXISTS idx_properties_untranslated_ru ON properties(id) WHERE property_name_ru IS NULL;
CREATE INDEX IF NOT EXISTS idx_properties_untranslated_ro ON properties(id) WHERE property_name_ro IS NULL;

-- Add index for distinct group_name and property_name queries (for deduplication)
CREATE INDEX IF NOT EXISTS idx_properties_group_name ON properties(group_name) WHERE group_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_property_name ON properties(property_name);

-- Add comment for documentation
COMMENT ON TABLE translation_jobs IS 'Tracks translation job progress for products, categories, and properties';
COMMENT ON TABLE translation_logs IS 'Detailed log of individual translation operations';
COMMENT ON COLUMN translation_logs.original_value IS 'The original text value from the database';
COMMENT ON COLUMN translation_logs.source_text IS 'The text actually sent to Google Translate (may be cleaned/normalized)';
