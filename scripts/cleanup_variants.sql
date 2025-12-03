-- Cleanup Script for Variant System
-- Run this BEFORE triggering new variant generation
-- This clears all existing variant data to start fresh with the new grouping logic
--
-- New Grouping Logic:
--   Products are grouped ONLY if they have:
--     1. Exact same name
--     2. Same category_id
--     3. Same brand_id
--
-- New Variant Properties (only these 3):
--   1. Color: Group "Essential Characteristics", Property "Colour Name | Название Расцветки"
--   2. Storage: Group "Memory", Property "Internal Storage {GB}"
--   3. RAM: Group "Memory", Property "RAM Size"

-- ============================================================================
-- STEP 1: Delete all variant properties (depends on groups)
-- ============================================================================
DELETE FROM variant_properties;

-- ============================================================================
-- STEP 2: Delete all group members (depends on groups)
-- ============================================================================
DELETE FROM product_variant_group_members;

-- ============================================================================
-- STEP 3: Delete all variant groups
-- ============================================================================
DELETE FROM product_variant_groups;

-- ============================================================================
-- STEP 4: Delete all completed/failed generation jobs (optional)
-- Keep running jobs if any
-- ============================================================================
DELETE FROM variant_generation_jobs WHERE status IN ('completed', 'failed', 'cancelled');

-- ============================================================================
-- Verification queries (run these to confirm cleanup)
-- ============================================================================
-- SELECT COUNT(*) AS remaining_groups FROM product_variant_groups;
-- SELECT COUNT(*) AS remaining_members FROM product_variant_group_members;
-- SELECT COUNT(*) AS remaining_properties FROM variant_properties;
-- SELECT COUNT(*) AS remaining_jobs FROM variant_generation_jobs;

-- ============================================================================
-- NOTE: After running this script, trigger new variant generation via:
--   curl -X POST http://localhost:8080/api/v1/variants/generate
--
-- Or from the admin dashboard:
--   Navigate to /variants and click "Generate Variants"
-- ============================================================================
