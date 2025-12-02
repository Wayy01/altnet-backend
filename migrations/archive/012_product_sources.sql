-- Migration 012: Add product_sources table and source tracking for products
-- This migration adds support for tracking where products originated from (Ultra sync, manual entry, etc.)

-- Create product_sources table
CREATE TABLE IF NOT EXISTS product_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_deletable BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for name lookup
CREATE INDEX IF NOT EXISTS idx_product_sources_name ON product_sources (name);

-- Create index for default lookup
CREATE INDEX IF NOT EXISTS idx_product_sources_is_default ON product_sources (is_default) WHERE is_default = TRUE;

-- Insert the default "Ultra" source (cannot be deleted)
INSERT INTO product_sources (name, description, is_default, is_deletable)
VALUES ('Ultra', 'Products synchronized from Ultra B2B API', TRUE, FALSE)
ON CONFLICT (name) DO NOTHING;

-- Add source_id column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES product_sources(id);

-- Create index for source_id on products
CREATE INDEX IF NOT EXISTS idx_products_source_id ON products (source_id);

-- Update existing products to have the Ultra source
-- This sets all existing products to the Ultra source since they were synced from the API
UPDATE products
SET source_id = (SELECT id FROM product_sources WHERE is_default = TRUE)
WHERE source_id IS NULL;

-- Add comment documenting the column
COMMENT ON COLUMN products.source_id IS 'Foreign key to product_sources table indicating where the product originated from';
COMMENT ON TABLE product_sources IS 'Stores available product sources (Ultra sync, manual entry, imports, etc.)';
