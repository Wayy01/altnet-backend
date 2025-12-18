-- ============================================================================
-- VARIANT TYPES MIGRATION
-- Adds variant_type and variant_value columns to track how products differ
-- ============================================================================

-- Add variant type columns to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS variant_type VARCHAR(50);
ALTER TABLE products ADD COLUMN IF NOT EXISTS variant_value TEXT;

-- Create index for variant queries
CREATE INDEX IF NOT EXISTS idx_products_variant_type ON products(variant_type) WHERE variant_type IS NOT NULL;

-- Add comments
COMMENT ON COLUMN products.variant_type IS 'Type of variant: color, storage, size, ram, etc.';
COMMENT ON COLUMN products.variant_value IS 'The specific value for this variant (e.g., "Black", "256GB")';
