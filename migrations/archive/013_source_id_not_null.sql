-- Migration 013: Make source_id NOT NULL with default
-- This migration ensures all products have a valid source

-- First, ensure all products have a source (defensive programming)
UPDATE products
SET source_id = (SELECT id FROM product_sources WHERE is_default = TRUE)
WHERE source_id IS NULL;

-- Add NOT NULL constraint to source_id
ALTER TABLE products ALTER COLUMN source_id SET NOT NULL;

-- Set default to the Ultra source ID using DO block (subqueries not allowed in SET DEFAULT)
DO $$
DECLARE
    default_source_id UUID;
BEGIN
    SELECT id INTO default_source_id FROM product_sources WHERE is_default = TRUE;
    IF default_source_id IS NOT NULL THEN
        EXECUTE format('ALTER TABLE products ALTER COLUMN source_id SET DEFAULT %L', default_source_id);
    END IF;
END $$;

-- Add comment documenting the constraint
COMMENT ON COLUMN products.source_id IS 'Foreign key to product_sources table (NOT NULL, defaults to Ultra source)';
