-- Property Hierarchy Indexes for Optimal Query Performance
-- These indexes support the 3-level hierarchical navigation (Groups → Names → Values)

-- Index for listing property groups (Level 1)
CREATE INDEX IF NOT EXISTS idx_properties_group_name
ON properties(group_name)
WHERE group_name IS NOT NULL;

-- Composite index for property names within a group (Level 2)
CREATE INDEX IF NOT EXISTS idx_properties_group_name_property_name
ON properties(group_name, property_name)
WHERE group_name IS NOT NULL AND property_name IS NOT NULL;

-- Index for all property names (for global search)
CREATE INDEX IF NOT EXISTS idx_properties_property_name
ON properties(property_name)
WHERE property_name IS NOT NULL;

-- Index for product relationships (deletion impact queries)
CREATE INDEX IF NOT EXISTS idx_properties_product_id
ON properties(product_id);

-- Composite index for value-level queries (Level 3)
CREATE INDEX IF NOT EXISTS idx_properties_group_property_value
ON properties(group_name, property_name, value)
WHERE group_name IS NOT NULL AND property_name IS NOT NULL;

-- Comment explaining the index strategy
COMMENT ON INDEX idx_properties_group_name IS 'Supports property group listing and aggregation queries';
COMMENT ON INDEX idx_properties_group_name_property_name IS 'Supports property name listing within a group';
COMMENT ON INDEX idx_properties_property_name IS 'Supports global property name search';
COMMENT ON INDEX idx_properties_product_id IS 'Supports deletion impact analysis and product relationship queries';
COMMENT ON INDEX idx_properties_group_property_value IS 'Supports value-level filtering and search queries';
