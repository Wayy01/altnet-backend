-- ============================================================================
-- REMOVE VARIANT/GROUPING COLUMNS AND INDEXES
-- This migration removes the custom variant grouping implementation
-- The parent_id column is kept as it comes from the original Ultra API schema
-- ============================================================================

-- Drop indexes first (order matters - drop dependent indexes before columns)
DROP INDEX IF EXISTS idx_products_variant_group;
DROP INDEX IF EXISTS idx_products_is_group;
DROP INDEX IF EXISTS idx_products_variant_type;

-- Drop columns that were part of our custom grouping implementation
ALTER TABLE products DROP COLUMN IF EXISTS variant_group_id;
ALTER TABLE products DROP COLUMN IF EXISTS is_group;
ALTER TABLE products DROP COLUMN IF EXISTS variant_type;
ALTER TABLE products DROP COLUMN IF EXISTS variant_value;

-- Note: parent_id column and its indexes are intentionally kept
-- as parent_id is part of the original Ultra API product schema
-- Indexes retained: idx_products_parent_id, idx_products_parent_id_active, idx_products_parent_id_price
