-- Migration: 018_variant_generation_system.sql
-- Description: Creates tables for AI-powered variant generation system using Ollama
-- Date: 2024-12-02

-- ============================================================================
-- VARIANT GENERATION JOBS
-- ============================================================================
-- Tracks the status and progress of variant generation jobs

CREATE TABLE IF NOT EXISTS variant_generation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    total_products INTEGER NOT NULL DEFAULT 0,
    processed_products INTEGER NOT NULL DEFAULT 0,
    groups_created INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for listing jobs by status and creation time
CREATE INDEX IF NOT EXISTS idx_variant_generation_jobs_status ON variant_generation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_variant_generation_jobs_created_at ON variant_generation_jobs(created_at DESC);

-- ============================================================================
-- PRODUCT VARIANT GROUPS
-- ============================================================================
-- Groups products by their base name (extracted via Ollama AI)
-- Example: "iPhone 16 Pro Max" groups all storage/color variants

CREATE TABLE IF NOT EXISTS product_variant_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    base_name VARCHAR(500) NOT NULL,
    base_name_normalized VARCHAR(500) NOT NULL,
    member_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for searching groups by base name
CREATE INDEX IF NOT EXISTS idx_product_variant_groups_base_name ON product_variant_groups(base_name);
CREATE INDEX IF NOT EXISTS idx_product_variant_groups_base_name_normalized ON product_variant_groups(base_name_normalized);
CREATE INDEX IF NOT EXISTS idx_product_variant_groups_created_at ON product_variant_groups(created_at DESC);

-- ============================================================================
-- PRODUCT VARIANT GROUP MEMBERS
-- ============================================================================
-- Links products to their variant group

CREATE TABLE IF NOT EXISTS product_variant_group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES product_variant_groups(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Each product can only belong to one group
    CONSTRAINT unique_product_in_group UNIQUE (product_id)
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_product_variant_group_members_group_id ON product_variant_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_product_variant_group_members_product_id ON product_variant_group_members(product_id);

-- ============================================================================
-- VARIANT PROPERTIES
-- ============================================================================
-- Stores detected variant properties for each group
-- A property is a "variant property" if it has multiple values within a parent scope
--
-- Example for iPhone 16 Pro Max group:
-- - Storage: 256GB, 512GB, 1TB (varies across all products - global variant)
-- - RAM for 512GB: 16GB, 8GB (varies within 512GB storage - scoped variant)
-- - RAM for 256GB: 16GB only (does NOT vary - not a variant for 256GB)

CREATE TABLE IF NOT EXISTS variant_properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES product_variant_groups(id) ON DELETE CASCADE,
    property_name VARCHAR(255) NOT NULL,
    property_values JSONB NOT NULL DEFAULT '[]',  -- Array of distinct values
    parent_property VARCHAR(255),                  -- NULL means global variant (varies across entire group)
    parent_value VARCHAR(255),                     -- The specific parent value this applies to
    product_count INTEGER NOT NULL DEFAULT 0,      -- Number of products with this variant combo
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_variant_properties_group_id ON variant_properties(group_id);
CREATE INDEX IF NOT EXISTS idx_variant_properties_property_name ON variant_properties(property_name);
CREATE INDEX IF NOT EXISTS idx_variant_properties_parent ON variant_properties(parent_property, parent_value);

-- ============================================================================
-- UPDATE TRIGGER FOR product_variant_groups.member_count
-- ============================================================================

CREATE OR REPLACE FUNCTION update_variant_group_member_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE product_variant_groups
        SET member_count = member_count + 1, updated_at = NOW()
        WHERE id = NEW.group_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE product_variant_groups
        SET member_count = member_count - 1, updated_at = NOW()
        WHERE id = OLD.group_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_variant_group_member_count ON product_variant_group_members;
CREATE TRIGGER trigger_update_variant_group_member_count
    AFTER INSERT OR DELETE ON product_variant_group_members
    FOR EACH ROW EXECUTE FUNCTION update_variant_group_member_count();

-- ============================================================================
-- UPDATE TRIGGER FOR variant_generation_jobs.updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_variant_job_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_variant_job_updated_at ON variant_generation_jobs;
CREATE TRIGGER trigger_update_variant_job_updated_at
    BEFORE UPDATE ON variant_generation_jobs
    FOR EACH ROW EXECUTE FUNCTION update_variant_job_updated_at();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE variant_generation_jobs IS 'Tracks AI-powered variant generation job progress';
COMMENT ON TABLE product_variant_groups IS 'Groups products by base name extracted via Ollama AI';
COMMENT ON TABLE product_variant_group_members IS 'Links products to their variant group';
COMMENT ON TABLE variant_properties IS 'Detected variant properties within a group (properties with multiple values)';

COMMENT ON COLUMN variant_properties.parent_property IS 'NULL means this property varies globally across the entire group';
COMMENT ON COLUMN variant_properties.parent_value IS 'The specific value of parent_property this variant applies to';
COMMENT ON COLUMN variant_properties.property_values IS 'JSON array of distinct values this property has within the scope';
