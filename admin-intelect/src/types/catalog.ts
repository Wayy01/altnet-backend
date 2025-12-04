/**
 * Catalog Builder Type Definitions
 *
 * This file contains all TypeScript interfaces for the 3-level catalog builder system:
 * - Level 1: CatalogSection (main navigation sections with icons)
 * - Level 2: CatalogGroup (column groups within sections)
 * - Level 3: CatalogItem (clickable menu items)
 */

import { Category } from './index';

/**
 * Filter configuration for catalog groups and items (JSONB)
 */
export interface CatalogFilterConfig {
  category_ids?: string[];
  brand_ids?: string[];
  price_min?: number;
  price_max?: number;
  in_stock_only?: boolean;
}

/**
 * Item type for catalog items
 */
export type CatalogItemType = 'category_link' | 'custom_filter';

// ============================================================================
// LEVEL 1: CATALOG SECTION
// ============================================================================

/**
 * Main catalog section entity (Level 1)
 */
export interface CatalogSection {
  id: string;
  name_ro: string;
  name_ru: string | null;
  name_en: string | null;
  icon: string | null;
  slug: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Input for creating a new catalog section
 */
export interface CatalogSectionInput {
  name_ro: string;
  name_ru?: string;
  name_en?: string;
  icon?: string;
  slug?: string; // Auto-generated from name_ro if not provided
  sort_order?: number;
  is_active?: boolean;
}

/**
 * Input for updating an existing catalog section
 */
export interface CatalogSectionUpdateInput {
  name_ro?: string;
  name_ru?: string;
  name_en?: string;
  icon?: string;
  slug?: string;
  sort_order?: number;
  is_active?: boolean;
}

// ============================================================================
// LEVEL 2: CATALOG GROUP
// ============================================================================

/**
 * Catalog group entity (Level 2 - column groups)
 */
export interface CatalogGroup {
  id: string;
  section_id: string;
  name_ro: string;
  name_ru: string | null;
  name_en: string | null;
  column_position: number;
  sort_order: number;
  filter_config: CatalogFilterConfig | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Input for creating a new catalog group
 */
export interface CatalogGroupInput {
  section_id: string;
  name_ro: string;
  name_ru?: string;
  name_en?: string;
  column_position?: number;
  sort_order?: number;
  filter_config?: CatalogFilterConfig;
  is_active?: boolean;
}

/**
 * Input for updating an existing catalog group
 */
export interface CatalogGroupUpdateInput {
  section_id?: string;
  name_ro?: string;
  name_ru?: string;
  name_en?: string;
  column_position?: number;
  sort_order?: number;
  filter_config?: CatalogFilterConfig;
  is_active?: boolean;
}

// ============================================================================
// LEVEL 3: CATALOG ITEM
// ============================================================================

/**
 * Catalog item entity (Level 3 - clickable menu items)
 */
export interface CatalogItem {
  id: string;
  group_id: string;
  name_ro: string;
  name_ru: string | null;
  name_en: string | null;
  sort_order: number;
  item_type: CatalogItemType;
  category_id: string | null;
  filter_config: CatalogFilterConfig | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Input for creating a new catalog item
 */
export interface CatalogItemInput {
  group_id: string;
  name_ro: string;
  name_ru?: string;
  name_en?: string;
  sort_order?: number;
  item_type: CatalogItemType;
  category_id?: string;
  filter_config?: CatalogFilterConfig;
  is_active?: boolean;
}

/**
 * Input for updating an existing catalog item
 */
export interface CatalogItemUpdateInput {
  group_id?: string;
  name_ro?: string;
  name_ru?: string;
  name_en?: string;
  sort_order?: number;
  item_type?: CatalogItemType;
  category_id?: string;
  filter_config?: CatalogFilterConfig;
  is_active?: boolean;
}

// ============================================================================
// NESTED RESPONSE TYPES
// ============================================================================

/**
 * Catalog item with category details (when item_type is category_link)
 */
export interface CatalogItemWithCategory extends CatalogItem {
  category?: Category;
}

/**
 * Catalog group with its items
 */
export interface CatalogGroupWithItems extends CatalogGroup {
  items: CatalogItemWithCategory[];
}

/**
 * Catalog section with groups and items (full hierarchy)
 */
export interface CatalogSectionWithGroups extends CatalogSection {
  groups: CatalogGroupWithItems[];
}

// ============================================================================
// BULK OPERATIONS & REORDERING
// ============================================================================

/**
 * Single item reorder request
 */
export interface CatalogReorderRequest {
  id: string;
  sort_order: number;
}

/**
 * Bulk reorder request
 */
export interface CatalogBulkReorderRequest {
  items: CatalogReorderRequest[];
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/**
 * Response for listing catalog sections
 */
export interface CatalogSectionsResponse {
  data: CatalogSection[];
  meta?: {
    total: number;
  };
}

/**
 * Response for listing catalog sections with full hierarchy
 */
export interface CatalogSectionsWithGroupsResponse {
  data: CatalogSectionWithGroups[];
  meta?: {
    total: number;
  };
}

/**
 * Response for getting a single catalog section
 */
export interface CatalogSectionResponse {
  data: CatalogSection;
}

/**
 * Response for getting a catalog section with groups
 */
export interface CatalogSectionWithGroupsResponse {
  data: CatalogSectionWithGroups;
}

/**
 * Response for listing catalog groups
 */
export interface CatalogGroupsResponse {
  data: CatalogGroup[];
  meta?: {
    total: number;
  };
}

/**
 * Response for listing catalog groups with items
 */
export interface CatalogGroupsWithItemsResponse {
  data: CatalogGroupWithItems[];
  meta?: {
    total: number;
  };
}

/**
 * Response for getting a single catalog group
 */
export interface CatalogGroupResponse {
  data: CatalogGroup;
}

/**
 * Response for getting a catalog group with items
 */
export interface CatalogGroupWithItemsResponse {
  data: CatalogGroupWithItems;
}

/**
 * Response for listing catalog items
 */
export interface CatalogItemsResponse {
  data: CatalogItem[];
  meta?: {
    total: number;
  };
}

/**
 * Response for listing catalog items with categories
 */
export interface CatalogItemsWithCategoriesResponse {
  data: CatalogItemWithCategory[];
  meta?: {
    total: number;
  };
}

/**
 * Response for getting a single catalog item
 */
export interface CatalogItemResponse {
  data: CatalogItem;
}

/**
 * Response for getting a catalog item with category
 */
export interface CatalogItemWithCategoryResponse {
  data: CatalogItemWithCategory;
}

// ============================================================================
// FILTER & QUERY TYPES
// ============================================================================

/**
 * Filters for listing catalog sections
 */
export interface CatalogSectionFilters {
  search?: string;
  is_active?: boolean;
  sort_by?: 'sort_order' | 'name_ro' | 'created_at';
  order?: 'asc' | 'desc';
}

/**
 * Filters for listing catalog groups
 */
export interface CatalogGroupFilters {
  section_id?: string;
  search?: string;
  is_active?: boolean;
  column_position?: number;
  sort_by?: 'sort_order' | 'name_ro' | 'column_position' | 'created_at';
  order?: 'asc' | 'desc';
}

/**
 * Filters for listing catalog items
 */
export interface CatalogItemFilters {
  group_id?: string;
  section_id?: string;
  search?: string;
  is_active?: boolean;
  item_type?: CatalogItemType;
  sort_by?: 'sort_order' | 'name_ro' | 'created_at';
  order?: 'asc' | 'desc';
}

// ============================================================================
// VALIDATION & UTILITY TYPES
// ============================================================================

/**
 * Validation result for catalog item configuration
 */
export interface CatalogItemValidation {
  is_valid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Statistics for catalog overview
 */
export interface CatalogStats {
  total_sections: number;
  active_sections: number;
  total_groups: number;
  active_groups: number;
  total_items: number;
  active_items: number;
  items_by_type: {
    category_link: number;
    custom_filter: number;
  };
}

/**
 * Response for getting the full catalog structure
 */
export interface FullCatalogResponse {
  data: CatalogSectionWithGroups[];
  meta?: {
    total: number;
  };
}
