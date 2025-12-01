// ============================================================================
// SYNC ENTITY FILTER TYPES
// ============================================================================

/**
 * Filter entity types - the types of entities that can be filtered during sync
 */
export type FilterEntityType = 'products' | 'brands' | 'categories' | 'properties';

/**
 * Filter operators for building conditions
 * Matches Go backend FilterOperator in internal/models/filter.go
 * Supported: equals, not_equals, contains, not_contains, greater_than, less_than, in, not_in, is_null, is_not_null
 */
export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'in'
  | 'not_in'
  | 'is_null'
  | 'is_not_null';

/**
 * Filter logic for combining conditions
 */
export type FilterLogic = 'AND' | 'OR';

/**
 * A single filter condition
 */
export interface FilterCondition {
  id?: string;
  field: string;
  operator: FilterOperator;
  value: string | number | boolean | string[] | null;
}

/**
 * Sync entity filter - main filter structure
 */
export interface SyncEntityFilter {
  id: string;
  name: string;
  description: string | null;
  entity_type: FilterEntityType;
  logic: FilterLogic;
  conditions: FilterCondition[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Request to create a new filter
 */
export interface FilterCreateRequest {
  name: string;
  description?: string | null;
  entity_type: FilterEntityType;
  logic: FilterLogic;
  conditions: Omit<FilterCondition, 'id'>[];
  is_active?: boolean;
}

/**
 * Request to update an existing filter
 */
export interface FilterUpdateRequest {
  name?: string;
  description?: string | null;
  entity_type?: FilterEntityType;
  logic?: FilterLogic;
  conditions?: Omit<FilterCondition, 'id'>[];
  is_active?: boolean;
}

/**
 * Result from testing a filter
 */
export interface FilterTestResult {
  filter_id: string;
  entity_type: FilterEntityType;
  matching_count: number;
  total_count: number;
  sample_ids?: string[];
  executed_at: string;
}

/**
 * Available field definition for filter builder
 */
export interface FilterFieldDefinition {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array';
  operators: FilterOperator[];
}

/**
 * Entity type configuration from backend
 */
export interface EntityTypeConfig {
  entity_type: FilterEntityType;
  label: string;
  fields: FilterFieldDefinition[];
}

/**
 * Response for listing filters
 */
export interface FiltersListResponse {
  data: SyncEntityFilter[];
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
}

/**
 * Response for getting entity types configuration
 */
export interface EntityTypesResponse {
  data: EntityTypeConfig[];
}

/**
 * Filter toggle response
 */
export interface FilterToggleResponse {
  filter: SyncEntityFilter;
  message: string;
}

/**
 * Operator display configuration
 */
export interface OperatorConfig {
  value: FilterOperator;
  label: string;
  requiresValue: boolean;
  valueType: 'single' | 'multiple' | 'none';
}

/**
 * All available operators with their configurations
 * Matches Go backend supported operators
 * Note: Labels should be translated in components using i18n
 */
export const OPERATOR_CONFIGS: OperatorConfig[] = [
  { value: 'equals', label: 'Equals', requiresValue: true, valueType: 'single' },
  { value: 'not_equals', label: 'Not Equals', requiresValue: true, valueType: 'single' },
  { value: 'contains', label: 'Contains', requiresValue: true, valueType: 'single' },
  { value: 'not_contains', label: 'Does Not Contain', requiresValue: true, valueType: 'single' },
  { value: 'greater_than', label: 'Greater Than', requiresValue: true, valueType: 'single' },
  { value: 'less_than', label: 'Less Than', requiresValue: true, valueType: 'single' },
  { value: 'in', label: 'In List', requiresValue: true, valueType: 'multiple' },
  { value: 'not_in', label: 'Not In List', requiresValue: true, valueType: 'multiple' },
  { value: 'is_null', label: 'Is Empty', requiresValue: false, valueType: 'none' },
  { value: 'is_not_null', label: 'Is Not Empty', requiresValue: false, valueType: 'none' },
];

/**
 * Get operator config by value
 */
export function getOperatorConfig(operator: FilterOperator): OperatorConfig | undefined {
  return OPERATOR_CONFIGS.find(op => op.value === operator);
}

/**
 * Default fields for each entity type (fallback when backend is unavailable)
 * Note: Only includes operators supported by the backend
 */
export const DEFAULT_ENTITY_FIELDS: Record<FilterEntityType, FilterFieldDefinition[]> = {
  products: [
    { name: 'name', label: 'Name', type: 'string', operators: ['equals', 'not_equals', 'contains', 'not_contains', 'is_null', 'is_not_null'] },
    { name: 'code', label: 'Code', type: 'string', operators: ['equals', 'not_equals', 'contains', 'is_null', 'is_not_null'] },
    { name: 'article', label: 'Article', type: 'string', operators: ['equals', 'not_equals', 'contains', 'is_null', 'is_not_null'] },
    { name: 'brand_name', label: 'Brand Name', type: 'string', operators: ['equals', 'not_equals', 'contains', 'is_null', 'is_not_null'] },
    { name: 'category_name', label: 'Category Name', type: 'string', operators: ['equals', 'not_equals', 'contains', 'is_null', 'is_not_null'] },
    { name: 'price_mdl', label: 'Price (MDL)', type: 'number', operators: ['equals', 'not_equals', 'greater_than', 'less_than', 'is_null', 'is_not_null'] },
    { name: 'total_stock', label: 'Total Stock', type: 'number', operators: ['equals', 'not_equals', 'greater_than', 'less_than'] },
    { name: 'is_active', label: 'Is Active', type: 'boolean', operators: ['equals', 'not_equals'] },
    { name: 'is_in_stock', label: 'Is In Stock', type: 'boolean', operators: ['equals', 'not_equals'] },
    { name: 'is_group', label: 'Is Group', type: 'boolean', operators: ['equals', 'not_equals'] },
  ],
  brands: [
    { name: 'name', label: 'Name', type: 'string', operators: ['equals', 'not_equals', 'contains', 'not_contains', 'is_null', 'is_not_null'] },
    { name: 'code', label: 'Code', type: 'string', operators: ['equals', 'not_equals', 'contains', 'is_null', 'is_not_null'] },
    { name: 'product_count', label: 'Product Count', type: 'number', operators: ['equals', 'not_equals', 'greater_than', 'less_than'] },
    { name: 'is_active', label: 'Is Active', type: 'boolean', operators: ['equals', 'not_equals'] },
  ],
  categories: [
    { name: 'name', label: 'Name', type: 'string', operators: ['equals', 'not_equals', 'contains', 'not_contains', 'is_null', 'is_not_null'] },
    { name: 'code', label: 'Code', type: 'string', operators: ['equals', 'not_equals', 'contains', 'is_null', 'is_not_null'] },
    { name: 'product_count', label: 'Product Count', type: 'number', operators: ['equals', 'not_equals', 'greater_than', 'less_than'] },
    { name: 'sort_order', label: 'Sort Order', type: 'number', operators: ['equals', 'not_equals', 'greater_than', 'less_than'] },
    { name: 'is_active', label: 'Is Active', type: 'boolean', operators: ['equals', 'not_equals'] },
    { name: 'parent_id', label: 'Has Parent', type: 'string', operators: ['is_null', 'is_not_null'] },
  ],
  properties: [
    { name: 'property_name', label: 'Property Name', type: 'string', operators: ['equals', 'not_equals', 'contains', 'not_contains', 'is_null', 'is_not_null'] },
    { name: 'group_name', label: 'Group Name', type: 'string', operators: ['equals', 'not_equals', 'contains', 'is_null', 'is_not_null'] },
    { name: 'value', label: 'Value', type: 'string', operators: ['equals', 'not_equals', 'contains', 'is_null', 'is_not_null'] },
    { name: 'value_type', label: 'Value Type', type: 'string', operators: ['equals', 'not_equals', 'is_null', 'is_not_null'] },
    { name: 'is_filter', label: 'Is Filter', type: 'boolean', operators: ['equals', 'not_equals'] },
    { name: 'is_modification', label: 'Is Modification', type: 'boolean', operators: ['equals', 'not_equals'] },
  ],
};
