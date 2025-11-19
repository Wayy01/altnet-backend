-- Migration 004: Multi-currency support and variant grouping
-- This migration adds support for multiple currencies (MDL, EUR, USD) and product variant grouping

-- Add multi-currency price columns to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS prices JSONB DEFAULT '[]';
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_mdl DECIMAL(12,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_eur DECIMAL(12,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_usd DECIMAL(12,2);

-- Add variant grouping columns to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS variant_group_id UUID REFERENCES products(id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT false;

-- Create index for variant grouping queries
CREATE INDEX IF NOT EXISTS idx_products_variant_group_id ON products(variant_group_id) WHERE variant_group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_is_group ON products(is_group) WHERE is_group = true;

-- Create index for currency-specific price queries
CREATE INDEX IF NOT EXISTS idx_products_price_mdl ON products(price_mdl) WHERE price_mdl IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_prices ON products USING GIN (prices);

-- Comment on new columns
COMMENT ON COLUMN products.prices IS 'JSONB array of all currency prices [{price, currency, type}]';
COMMENT ON COLUMN products.price_mdl IS 'Price in Moldovan Leu (primary display currency)';
COMMENT ON COLUMN products.price_eur IS 'Price in Euro';
COMMENT ON COLUMN products.price_usd IS 'Price in US Dollar';
COMMENT ON COLUMN products.variant_group_id IS 'UUID of the parent product in variant group';
COMMENT ON COLUMN products.is_group IS 'True if this product is the parent of a variant group';
