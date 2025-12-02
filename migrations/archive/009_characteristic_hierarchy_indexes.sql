-- ============================================================================
-- Migration: 009_characteristic_hierarchy_indexes
-- Description: Add indexes to optimize characteristic hierarchy queries
-- Date: 2025-11-23
-- ============================================================================
--
-- Characteristic Hierarchy Indexes for Optimal Query Performance
-- These indexes support the 2-level hierarchical navigation (Names → Values)
--
-- Performance Expectations:
-- - Level 1 (Names): Aggregation queries will use idx_characteristics_name for GROUP BY
-- - Level 2 (Values): Composite index on (name, product_id) enables efficient filtering
-- - Deletion Impact: product_id index supports COUNT(DISTINCT product_id) queries
-- - All indexes include WHERE clauses to exclude NULL values for smaller index size
--
-- Query Patterns Supported:
-- 1. ListCharacteristicNames: GROUP BY name with aggregations
-- 2. GetCharacteristicNameByName: WHERE name = $1 with stats
-- 3. ListCharacteristicValues: WHERE name = $1 with product JOIN
-- 4. GetCharacteristicNameDeletionImpact: COUNT(*) and COUNT(DISTINCT product_id)
-- ============================================================================

-- Index for aggregating characteristics by name (Level 1)
-- Supports: GROUP BY name queries with COUNT, SUM, AVG aggregations
-- Used by: ListCharacteristicNames(), GetCharacteristicNameByName()
CREATE INDEX IF NOT EXISTS idx_characteristics_name
ON characteristics(name)
WHERE name IS NOT NULL;

-- Composite index for filtering characteristics by name and product (Level 2)
-- Supports: WHERE name = $1 queries with product relationships
-- Used by: ListCharacteristicValues() with LEFT JOIN products
CREATE INDEX IF NOT EXISTS idx_characteristics_name_product
ON characteristics(name, product_id)
WHERE name IS NOT NULL;

-- Index for product relationships (deletion impact queries)
-- Supports: COUNT(DISTINCT product_id) and product-based filtering
-- Used by: GetCharacteristicNameDeletionImpact() and product cascade operations
CREATE INDEX IF NOT EXISTS idx_characteristics_product_id
ON characteristics(product_id);

-- Index comments explaining usage and performance benefits
COMMENT ON INDEX idx_characteristics_name IS 'Optimizes characteristic name aggregation queries (GROUP BY name) for Level 1 hierarchy navigation. Partial index excludes NULL names.';
COMMENT ON INDEX idx_characteristics_name_product IS 'Optimizes characteristic value queries filtered by name with product joins for Level 2 hierarchy navigation. Enables index-only scans for name+product lookups.';
COMMENT ON INDEX idx_characteristics_product_id IS 'Supports deletion impact analysis (COUNT DISTINCT product_id), product relationship queries, and cascading operations. Critical for deletion preview functionality.';
