-- ============================================================================
-- Migration: Product Grouping Hierarchy Indexes
-- Description: Add indexes for efficient product grouping queries
-- Date: 2025-11-24
-- ============================================================================

-- Index on parent_id for efficient variant lookups
-- Uses CONCURRENTLY for zero-downtime deployment
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_parent_id
ON products(parent_id)
WHERE parent_id IS NOT NULL;

-- Composite index on (parent_id, is_active) for filtered variant queries
-- Useful for queries that filter both by parent and active status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_parent_id_active
ON products(parent_id, is_active)
WHERE parent_id IS NOT NULL;

-- Composite index on (parent_id, price_mdl) for price range queries on variants
-- Supports efficient MIN/MAX price calculations for product groups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_parent_id_price
ON products(parent_id, price_mdl)
WHERE parent_id IS NOT NULL AND price_mdl IS NOT NULL;

-- Comments for documentation
COMMENT ON INDEX idx_products_parent_id IS 'Efficient variant lookup by parent product (product grouping hierarchy Level 2)';
COMMENT ON INDEX idx_products_parent_id_active IS 'Efficient variant lookup by parent and active status (filtered queries)';
COMMENT ON INDEX idx_products_parent_id_price IS 'Efficient price range calculations for product groups (MIN/MAX aggregates)';
