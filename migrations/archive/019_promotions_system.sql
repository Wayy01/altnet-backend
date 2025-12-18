-- Migration: 019_promotions_system.sql
-- Description: Creates tables for promotions and discounts system
-- Date: 2025-12-03

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

CREATE TYPE discount_type AS ENUM ('percentage', 'fixed_amount');

-- ============================================================================
-- PROMOTIONS TABLE
-- ============================================================================
-- Stores promotion campaigns with discount rules and validity periods

CREATE TABLE promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    discount_type discount_type NOT NULL DEFAULT 'percentage',
    discount_value DECIMAL(10,2) NOT NULL,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    priority INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure percentage discounts are between 0 and 100
    CONSTRAINT chk_promotions_percentage_range CHECK (
        discount_type != 'percentage' OR (discount_value >= 0 AND discount_value <= 100)
    ),

    -- Ensure end_date is after start_date
    CONSTRAINT chk_promotions_date_range CHECK (
        end_date > start_date
    )
);

-- Index for querying active promotions
CREATE INDEX idx_promotions_is_active ON promotions(is_active) WHERE is_active = true;

-- Index for date range queries (finding current/upcoming/expired promotions)
CREATE INDEX idx_promotions_date_range ON promotions(start_date, end_date);

-- ============================================================================
-- PRODUCT PROMOTIONS JUNCTION TABLE
-- ============================================================================
-- Links products to promotions (many-to-many relationship)

CREATE TABLE product_promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Each product can only be linked to a promotion once
    CONSTRAINT unique_product_promotion UNIQUE (product_id, promotion_id)
);

-- Index for efficient lookups by product
CREATE INDEX idx_product_promotions_product_id ON product_promotions(product_id);

-- Index for efficient lookups by promotion
CREATE INDEX idx_product_promotions_promotion_id ON product_promotions(promotion_id);

-- ============================================================================
-- PRODUCTS TABLE EXTENSION
-- ============================================================================
-- Add manual discount column to products table

ALTER TABLE products
ADD COLUMN manual_discount_percent DECIMAL(5,2) DEFAULT NULL;

-- Ensure manual discount is either NULL or between 0 and 100
ALTER TABLE products
ADD CONSTRAINT chk_products_manual_discount_range CHECK (
    manual_discount_percent IS NULL OR (manual_discount_percent >= 0 AND manual_discount_percent <= 100)
);

-- ============================================================================
-- UPDATE TRIGGER FOR promotions.updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_promotions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_promotions_updated_at ON promotions;
CREATE TRIGGER trigger_update_promotions_updated_at
    BEFORE UPDATE ON promotions
    FOR EACH ROW EXECUTE FUNCTION update_promotions_updated_at();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE promotions IS 'Promotion campaigns with discount rules and validity periods';
COMMENT ON TABLE product_promotions IS 'Junction table linking products to promotions';

COMMENT ON COLUMN promotions.discount_type IS 'Type of discount: percentage or fixed_amount';
COMMENT ON COLUMN promotions.discount_value IS 'Discount value (percentage 0-100 or fixed amount)';
COMMENT ON COLUMN promotions.priority IS 'Higher priority promotions take precedence when multiple apply';
COMMENT ON COLUMN promotions.is_active IS 'Whether the promotion is enabled (independent of date range)';

COMMENT ON COLUMN products.manual_discount_percent IS 'Manual discount percentage (0-100) applied independently of promotions';
