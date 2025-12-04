-- Migration: 023_catalog_builder_system.sql
-- Description: Creates tables for the catalog builder mega menu system
-- This implements a 3-level hierarchy: Sections -> Groups -> Items
-- Date: 2025-12-04

-- ============================================================================
-- CATALOG SECTIONS (Level 1 - Main navigation sections)
-- ============================================================================
-- Sections are the top-level entries in the mega menu navigation bar
-- Each section can contain multiple column groups

CREATE TABLE catalog_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_ro VARCHAR(255) NOT NULL,              -- Romanian (primary language)
    name_ru VARCHAR(255),                       -- Russian
    name_en VARCHAR(255),                       -- English
    icon VARCHAR(255),                          -- Icon URL or icon name (e.g., 'laptop', 'phone')
    slug VARCHAR(255) UNIQUE NOT NULL,          -- URL-friendly identifier
    sort_order INT NOT NULL DEFAULT 0,          -- Display order in navigation
    is_active BOOLEAN NOT NULL DEFAULT true,    -- Visibility toggle
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for catalog_sections
CREATE INDEX idx_catalog_sections_slug ON catalog_sections(slug);
CREATE INDEX idx_catalog_sections_sort_order ON catalog_sections(sort_order);
CREATE INDEX idx_catalog_sections_is_active ON catalog_sections(is_active) WHERE is_active = true;

-- ============================================================================
-- CATALOG GROUPS (Level 2 - Column groups within sections)
-- ============================================================================
-- Groups organize items into columns within a mega menu dropdown
-- Each section can have multiple groups distributed across 1-4 columns

CREATE TABLE catalog_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES catalog_sections(id) ON DELETE CASCADE,
    name_ro VARCHAR(255) NOT NULL,              -- Romanian (primary language)
    name_ru VARCHAR(255),                       -- Russian
    name_en VARCHAR(255),                       -- English
    column_position INT NOT NULL DEFAULT 1      -- Which column (1-4) in the mega menu
        CHECK (column_position >= 1 AND column_position <= 4),
    sort_order INT NOT NULL DEFAULT 0,          -- Order within the column
    filter_config JSONB,                        -- Optional filter configuration for the group header
    is_active BOOLEAN NOT NULL DEFAULT true,    -- Visibility toggle
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for catalog_groups
CREATE INDEX idx_catalog_groups_section_id ON catalog_groups(section_id);
CREATE INDEX idx_catalog_groups_column_position ON catalog_groups(column_position);
CREATE INDEX idx_catalog_groups_sort_order ON catalog_groups(sort_order);
CREATE INDEX idx_catalog_groups_is_active ON catalog_groups(is_active) WHERE is_active = true;

-- Composite index for efficient ordering within sections
CREATE INDEX idx_catalog_groups_section_order ON catalog_groups(section_id, column_position, sort_order);

-- ============================================================================
-- CATALOG ITEMS (Level 3 - Clickable menu items)
-- ============================================================================
-- Items are the actual clickable links in the mega menu
-- They can link to a category or define a custom filter

CREATE TABLE catalog_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES catalog_groups(id) ON DELETE CASCADE,
    name_ro VARCHAR(255) NOT NULL,              -- Romanian (primary language)
    name_ru VARCHAR(255),                       -- Russian
    name_en VARCHAR(255),                       -- English
    sort_order INT NOT NULL DEFAULT 0,          -- Order within the group
    item_type VARCHAR(20) NOT NULL              -- Type of menu item
        CHECK (item_type IN ('category_link', 'custom_filter')),
    category_id UUID REFERENCES categories(id) ON DELETE RESTRICT,  -- For category_link type
    filter_config JSONB,                        -- For custom_filter type
    is_active BOOLEAN NOT NULL DEFAULT true,    -- Visibility toggle
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraint: category_link items must have a category_id
    -- custom_filter items must have a filter_config
    CONSTRAINT chk_catalog_items_type_config CHECK (
        (item_type = 'category_link' AND category_id IS NOT NULL) OR
        (item_type = 'custom_filter' AND filter_config IS NOT NULL)
    )
);

-- Indexes for catalog_items
CREATE INDEX idx_catalog_items_group_id ON catalog_items(group_id);
CREATE INDEX idx_catalog_items_category_id ON catalog_items(category_id) WHERE category_id IS NOT NULL;
CREATE INDEX idx_catalog_items_sort_order ON catalog_items(sort_order);
CREATE INDEX idx_catalog_items_is_active ON catalog_items(is_active) WHERE is_active = true;
CREATE INDEX idx_catalog_items_item_type ON catalog_items(item_type);

-- Composite index for efficient ordering within groups
CREATE INDEX idx_catalog_items_group_order ON catalog_items(group_id, sort_order);

-- GIN index for filter_config JSONB queries
CREATE INDEX idx_catalog_items_filter_config ON catalog_items USING GIN (filter_config) WHERE filter_config IS NOT NULL;

-- ============================================================================
-- UPDATE TRIGGERS FOR updated_at
-- ============================================================================

-- catalog_sections updated_at trigger
CREATE OR REPLACE FUNCTION update_catalog_sections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_catalog_sections_updated_at ON catalog_sections;
CREATE TRIGGER trigger_update_catalog_sections_updated_at
    BEFORE UPDATE ON catalog_sections
    FOR EACH ROW EXECUTE FUNCTION update_catalog_sections_updated_at();

-- catalog_groups updated_at trigger
CREATE OR REPLACE FUNCTION update_catalog_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_catalog_groups_updated_at ON catalog_groups;
CREATE TRIGGER trigger_update_catalog_groups_updated_at
    BEFORE UPDATE ON catalog_groups
    FOR EACH ROW EXECUTE FUNCTION update_catalog_groups_updated_at();

-- catalog_items updated_at trigger
CREATE OR REPLACE FUNCTION update_catalog_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_catalog_items_updated_at ON catalog_items;
CREATE TRIGGER trigger_update_catalog_items_updated_at
    BEFORE UPDATE ON catalog_items
    FOR EACH ROW EXECUTE FUNCTION update_catalog_items_updated_at();

-- ============================================================================
-- TABLE AND COLUMN COMMENTS
-- ============================================================================

-- Table comments
COMMENT ON TABLE catalog_sections IS 'Level 1 - Main navigation sections in the mega menu. Each section appears as a top-level nav item.';
COMMENT ON TABLE catalog_groups IS 'Level 2 - Column groups within sections. Organizes items into columns (1-4) within a mega menu dropdown.';
COMMENT ON TABLE catalog_items IS 'Level 3 - Clickable menu items. Can link to categories or define custom product filters.';

-- catalog_sections column comments
COMMENT ON COLUMN catalog_sections.name_ro IS 'Section name in Romanian (primary language)';
COMMENT ON COLUMN catalog_sections.name_ru IS 'Section name in Russian';
COMMENT ON COLUMN catalog_sections.name_en IS 'Section name in English';
COMMENT ON COLUMN catalog_sections.icon IS 'Icon identifier - can be an icon name (e.g., laptop) or URL';
COMMENT ON COLUMN catalog_sections.slug IS 'URL-friendly unique identifier for the section';
COMMENT ON COLUMN catalog_sections.sort_order IS 'Display order in the navigation bar (lower = first)';
COMMENT ON COLUMN catalog_sections.is_active IS 'Whether the section is visible in the menu';

-- catalog_groups column comments
COMMENT ON COLUMN catalog_groups.section_id IS 'Parent section this group belongs to';
COMMENT ON COLUMN catalog_groups.name_ro IS 'Group name in Romanian (primary language)';
COMMENT ON COLUMN catalog_groups.name_ru IS 'Group name in Russian';
COMMENT ON COLUMN catalog_groups.name_en IS 'Group name in English';
COMMENT ON COLUMN catalog_groups.column_position IS 'Which column (1-4) this group appears in within the mega menu';
COMMENT ON COLUMN catalog_groups.sort_order IS 'Display order within the column (lower = first)';
COMMENT ON COLUMN catalog_groups.filter_config IS 'Optional JSONB filter config: {category_ids, brand_ids, price_min, price_max, in_stock_only}';
COMMENT ON COLUMN catalog_groups.is_active IS 'Whether the group is visible in the menu';

-- catalog_items column comments
COMMENT ON COLUMN catalog_items.group_id IS 'Parent group this item belongs to';
COMMENT ON COLUMN catalog_items.name_ro IS 'Item name in Romanian (primary language)';
COMMENT ON COLUMN catalog_items.name_ru IS 'Item name in Russian';
COMMENT ON COLUMN catalog_items.name_en IS 'Item name in English';
COMMENT ON COLUMN catalog_items.sort_order IS 'Display order within the group (lower = first)';
COMMENT ON COLUMN catalog_items.item_type IS 'Type of item: category_link (links to category) or custom_filter (custom product filter)';
COMMENT ON COLUMN catalog_items.category_id IS 'Referenced category ID (required for category_link type, uses RESTRICT to prevent deletion)';
COMMENT ON COLUMN catalog_items.filter_config IS 'JSONB filter config for custom_filter type: {category_ids, brand_ids, price_min, price_max, in_stock_only}';
COMMENT ON COLUMN catalog_items.is_active IS 'Whether the item is visible in the menu';

-- ============================================================================
-- DOWN MIGRATION (Rollback)
-- ============================================================================
-- To rollback this migration, run the following commands:
--
-- DROP TRIGGER IF EXISTS trigger_update_catalog_items_updated_at ON catalog_items;
-- DROP TRIGGER IF EXISTS trigger_update_catalog_groups_updated_at ON catalog_groups;
-- DROP TRIGGER IF EXISTS trigger_update_catalog_sections_updated_at ON catalog_sections;
-- DROP FUNCTION IF EXISTS update_catalog_items_updated_at();
-- DROP FUNCTION IF EXISTS update_catalog_groups_updated_at();
-- DROP FUNCTION IF EXISTS update_catalog_sections_updated_at();
-- DROP TABLE IF EXISTS catalog_items;
-- DROP TABLE IF EXISTS catalog_groups;
-- DROP TABLE IF EXISTS catalog_sections;
