// Brand types
export interface Brand {
  id: string;
  ultra_id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  product_count?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Category types
export interface Category {
  id: string;
  ultra_id: string;
  code: string | null;
  name: string;
  slug: string;
  parent_id: string | null;
  parent_name?: string;
  image_url: string | null;
  sort_order: number;
  product_count: number;
  children?: Category[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Category with statistics for category details page
export interface CategoryWithStats extends Category {
  total_products: number;
  active_products: number;
  in_stock_products: number;
  with_prices_products: number;
  child_count: number;
}

// Category product (simplified product for category details page)
export interface CategoryProduct {
  id: string;
  name: string;
  code: string;
  price_min: number | null;
  price_max: number | null;
  price_mdl: number | null;
  price_eur: number | null;
  price_usd: number | null;
  prices: ProductPriceEntry[];
  total_stock: number;
  is_active: boolean;
}

// Category filter options for advanced filtering
export interface CategoryFilterOptions {
  search?: string;
  has_products?: string; // "true" | "false" | ""
  is_active?: string; // "true" | "false" | "" for all
  sort_by?: string; // "name_asc" | "name_desc" | "products_desc" | "products_asc"
}

// Bulk update categories by filter
export interface BulkUpdateCategoriesByFilterPayload {
  filter: {
    search?: string;
    has_products?: string;
    is_active?: string; // Filter by current active status
  };
  is_active: boolean; // New value to set
}

// Bulk update categories by IDs
export interface BulkUpdateCategoriesByIdsPayload {
  ids: string[];
  is_active: boolean;
}

// Image entry in products
export interface ImageEntry {
  uuid: string;
  url: string;
  description: string | null;
  path_global: string | null;
}

// Video entry in products
export interface VideoEntry {
  uuid: string;
  url: string;
  title: string | null;
  description: string | null;
  thumbnail_url: string | null;
}

// Price entry in characteristics
export interface PriceEntry {
  currency: string;
  price: number;
  price_type: string;
}

// Characteristic (product variant/SKU)
export interface Characteristic {
  id: string;
  product_id: string;
  ultra_id: string;
  code: string | null;
  reference: string | null;
  name: string;
  prices: PriceEntry[];
  stock_warehouse: number;
  stock_showroom: number;
  stock_total: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Property (product specification)
export interface Property {
  id: string;
  product_id: string;
  property_uuid: string | null;
  property_name: string;
  property_code: string | null;
  value: string;
  value_type: string | null;
  group_uuid: string | null;
  group_name: string | null;
  sort_order: number;
  is_filter: boolean;
  is_modification: boolean;
  created_at: string;
  updated_at: string;
}

// Property management types
export interface PropertyFilters {
  search?: string;
  product_id?: string;
  property_name?: string;
  group_name?: string;
  value_type?: string;
  is_filter?: string; // "true" | "false"
  is_modification?: string; // "true" | "false"
  sort_by?: string;
  created_after?: string;
  created_before?: string;
}

export interface PropertyStats {
  total_properties: number;
  unique_groups: number;
  filter_properties: number;
  modification_properties: number;
  by_type: Record<string, number>;
  unique_products_count: number;
}

export interface CreatePropertyPayload {
  product_id: string;
  property_uuid?: string | null;
  property_name: string;
  property_code?: string | null;
  value?: string | null;
  value_type?: string | null;
  group_uuid?: string | null;
  group_name?: string | null;
  sort_order?: number;
  is_filter?: boolean;
  is_modification?: boolean;
}

export interface UpdatePropertyPayload {
  property_uuid?: string | null;
  property_name?: string;
  property_code?: string | null;
  value?: string | null;
  value_type?: string | null;
  group_uuid?: string | null;
  group_name?: string | null;
  sort_order?: number;
  is_filter?: boolean;
  is_modification?: boolean;
}

export interface BulkUpdatePropertiesPayload {
  ids: string[];
  is_filter?: boolean;
  is_modification?: boolean;
  sort_order?: number;
  group_name?: string;
}

export interface BulkDeletePropertiesPayload {
  ids: string[];
}

// Product-level price entry
export interface ProductPriceEntry {
  price: number;
  currency: string;
  type: string;
  type_uuid?: string;
}

// Product types
export interface Product {
  id: string;
  ultra_id: string;
  code: string;
  article: string;
  name: string;
  slug: string;
  description: string | null;
  brand_id: string | null;
  brand_name?: string;
  category_id: string | null;
  category_name?: string;
  parent_id: string | null;
  main_image_url: string | null;
  images: ImageEntry[];
  videos: VideoEntry[];
  warranty: string | null;
  barcodes: string[];
  prices: ProductPriceEntry[];
  price_min: number | null;
  price_max: number | null;
  price_mdl: number | null;
  price_eur: number | null;
  price_usd: number | null;
  total_stock: number;
  is_in_stock: boolean;
  is_group: boolean;
  is_active: boolean;
  is_service: boolean;
  variant_group_id: string | null;
  created_at: string;
  updated_at: string;
}

// Currency types
export type CurrencyCode = 'MDL' | 'EUR' | 'USD';

export interface CurrencyOption {
  code: CurrencyCode;
  label: string;
  symbol: string;
}

// Product with relations
export interface ProductDetail extends Product {
  brand?: Brand;
  category?: Category;
  properties?: Property[];
  characteristics?: Characteristic[];
}

// API Response types
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ProductsResponse extends PaginatedResponse<Product> {}

export interface BrandsResponse extends PaginatedResponse<Brand> {}

export interface CategoriesResponse {
  data: Category[];
  total: number;
}

// Filter types
export interface ProductFilters {
  search?: string;
  brand_id?: string;
  category_id?: string;
  price_filter?: string; // "all", "with_price", "no_price"
  stock_filter?: string; // "all", "in_stock", "out_stock"
  status_filter?: string; // "all", "active", "inactive"
  sort_by?: string; // "name_asc", "name_desc", "price_high", "price_low", "stock_high", "stock_low"
  // Legacy filters (for backward compatibility)
  in_stock?: boolean;
  min_price?: number;
  max_price?: number;
}

// Dashboard stats
export interface DashboardStats {
  total_products: number;
  total_brands: number;
  total_categories: number;
  total_properties: number;
  total_characteristics: number;
  total_prices: number;
  total_stock: number;
  in_stock_products: number;
}

// Sync log entry
export interface SyncLog {
  id: string;
  sync_type: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | null;
  brands_synced: number;
  categories_synced: number;
  products_synced: number;
  properties_synced: number;
  characteristics_synced: number;
  prices_synced: number;
  stock_synced: number;
  error_message: string | null;
  details: Record<string, unknown> | null;

  // Change deltas
  brands_inserted: number;
  brands_updated: number;
  categories_inserted: number;
  categories_updated: number;
  products_inserted: number;
  products_updated: number;
  properties_inserted: number;
  properties_updated: number;
  characteristics_inserted: number;
  characteristics_updated: number;
  prices_updated: number;
  stock_updated: number;
}

// Exchange rate
export interface ExchangeRate {
  id: string;
  currency_code: string;
  rate: number;
  updated_at: string;
}

// Extended Dashboard stats with more details
export interface DashboardStatsExtended extends DashboardStats {
  low_stock_count: number;
  out_of_stock_count: number;
  last_sync_at: string | null;
  last_sync_status: string | null;
}

// Low stock product alert
export interface LowStockAlert {
  id: string;
  name: string;
  code: string;
  total_stock: number;
  brand_name?: string;
}

// API mutation payloads
export interface UpdateProductPayload {
  is_active?: boolean;
  name?: string;
  description?: string;
}

export interface UpdateBrandPayload {
  is_active?: boolean;
  name?: string;
}

export interface UpdateCategoryPayload {
  is_active?: boolean;
  name?: string;
}

export interface BulkUpdatePayload {
  ids?: string[];
  filter?: {
    search?: string;
    brand_id?: string;
    category_id?: string;
    price_filter?: string;
    stock_filter?: string;
    status_filter?: string;
  };
  is_active: boolean;
}

export interface BulkDeletePayload {
  ids: string[];
}

// Brand filter for advanced filtering
export interface BrandFilterOptions {
  search?: string;
  has_products?: string; // "true" | "false" | ""
  is_active?: string; // "true" | "false" | "" for all
  sort_by?: string; // "name_asc" | "name_desc" | "products_desc" | "products_asc"
}

// Bulk update brands by filter
export interface BulkUpdateBrandsByFilterPayload {
  filter: {
    search?: string;
    has_products?: string;
    is_active?: string; // Filter by current active status
  };
  is_active: boolean; // New value to set
}

// Bulk update brands by IDs
export interface BulkUpdateBrandsByIdsPayload {
  ids: string[];
  is_active: boolean;
}

// API response wrappers
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiListResponse<T> {
  data: T[];
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface ApiErrorResponse {
  error: string;
  message: string;
  status: number;
}

// Export filters
export interface ExportFilters extends ProductFilters {
  format?: 'csv' | 'json';
}

// Sync log with additional metadata
export interface SyncLogExtended extends Omit<SyncLog, 'started_at' | 'details'> {
  started_at?: string;
  completed_at?: string;
  details?: Record<string, unknown>;
}

// Sync step information
export interface SyncStep {
  number: number;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  count: number;
  total: number;
  startedAt?: string;
  completedAt?: string;

  // Change deltas
  extracted: number;
  inserted: number;
  updated: number;
}

// Enhanced sync progress response
export interface SyncProgress {
  isRunning: boolean;
  currentStep: number;
  totalSteps: number;
  steps: SyncStep[];
  syncLogId?: string;
  startedAt?: string;
  elapsedSeconds: number;
  estimatedRemainingSeconds?: number;
  lastUpdated: string;
  selectedSteps?: string[];

  // Detailed counts
  brandsSynced: number;
  categoriesSynced: number;
  productsSynced: number;
  characteristicsSynced: number;
  propertiesSynced: number;
  pricesSynced: number;
  stockSynced: number;

  // Change deltas
  brandsInserted: number;
  brandsUpdated: number;
  categoriesInserted: number;
  categoriesUpdated: number;
  productsInserted: number;
  productsUpdated: number;
  propertiesInserted: number;
  propertiesUpdated: number;
  characteristicsInserted: number;
  characteristicsUpdated: number;
  pricesUpdated: number;
  stockUpdatedCount: number;

  // Category progress for properties step
  categoriesProcessed: number;
  totalCategories: number;

  // Database totals for comparison
  dbTotals: {
    brands: number;
    categories: number;
    products: number;
    characteristics: number;
    properties: number;
  };
}

// Note: Product already includes is_active field

// Brand with is_active field
export interface BrandWithStatus extends Brand {
  is_active: boolean;
}

// Category with is_active field
export interface CategoryWithStatus extends Category {
  is_active: boolean;
}

// Brand with statistics for brand details page
export interface BrandWithStats extends Brand {
  total_products: number;
  active_products: number;
  in_stock_products: number;
  with_prices_products: number;
}

// Brand product (simplified product for brand details page)
export interface BrandProduct {
  id: string;
  name: string;
  code: string;
  price_min: number | null;
  price_max: number | null;
  price_mdl: number | null;
  price_eur: number | null;
  price_usd: number | null;
  prices: ProductPriceEntry[];
  total_stock: number;
  is_active: boolean;
}

// Stock summary by category
export interface StockSummaryItem {
  id: string;
  name: string;
  product_count: number;
  total_stock: number;
  avg_price: number;
}

// Price distribution
export interface PriceSummary {
  min_price: number | null;
  max_price: number | null;
  avg_price: number | null;
  median_price: number | null;
  distribution: {
    under_100: number;
    "100_to_500": number;
    "500_to_1000": number;
    over_1000: number;
  };
}

// ============================================================================
// PROPERTY HIERARCHY TYPES
// ============================================================================

// Property Group (Level 1)
export interface PropertyGroup {
  group_name: string;
  property_count: number;
  value_count: number;
  products_using: number;
  common_is_filter: boolean;
  common_is_modification: boolean;
}

// Property Name (Level 2)
export interface PropertyName {
  group_name: string;
  property_name: string;
  property_code: string | null;
  value_count: number;
  unique_value_count: number;
  products_using: number;
  common_value_type: string | null;
  common_is_filter: boolean;
  common_is_modification: boolean;
}

// Property Value (Level 3)
export interface PropertyValue {
  id: string;
  product_id: string;
  product_name?: string;
  product_code?: string;
  group_name: string | null;
  property_name: string;
  property_code: string | null;
  value: string | null;
  value_type: string | null;
  sort_order: number;
  is_filter: boolean;
  is_modification: boolean;
}

// Deletion Impact
export interface DeletionImpact {
  records_to_delete: number;
  products_affected: number;
}

// Property hierarchy API responses
export interface PropertyGroupsResponse {
  data: PropertyGroup[];
  total: number;
  limit: number;
  offset: number;
}

export interface PropertyNamesResponse {
  data: PropertyName[];
  total: number;
  limit: number;
  offset: number;
}

export interface PropertyValuesResponse {
  data: PropertyValue[];
  total: number;
  limit: number;
  offset: number;
}

// ============================================================================
// CHARACTERISTIC HIERARCHY TYPES
// ============================================================================

// Characteristic Price Entry (matches Go CharacteristicPrice struct)
export interface CharacteristicPriceEntry {
  price: number;
  currency: string;
  type?: string;
  type_uuid?: string;
}

// Characteristic Name (Level 1)
export interface CharacteristicName {
  name: string;
  characteristic_count: number;
  products_using: number;
  total_stock: number;
  avg_price: number | null;
  common_currency: string | null;
}

// Characteristic Value (Level 2)
export interface CharacteristicValue {
  id: string;
  product_id: string;
  product_name?: string;
  product_code?: string;
  ultra_id: string;
  code: string | null;
  reference: string | null;
  name: string;
  prices: CharacteristicPriceEntry[]; // Use specific type instead of generic PriceEntry
  stock_warehouse: number;
  stock_showroom: number;
  stock_total: number;
  is_active: boolean;
}

// Characteristic hierarchy API responses
export interface CharacteristicNamesResponse {
  data: CharacteristicName[];
  total: number;
  limit: number;
  offset: number;
}

export interface CharacteristicValuesResponse {
  data: CharacteristicValue[];
  total: number;
  limit: number;
  offset: number;
}

// ============================================================================
// PRODUCT GROUPING HIERARCHY TYPES
// ============================================================================

// Product Grouping (Level 1 - Parent product)
export interface ProductGrouping {
  id: string;
  name: string;
  code: string | null;
  article: string | null;
  brand_name: string | null;
  category_name: string | null;
  variant_count: number;
  price_min: number | null;
  price_max: number | null;
  total_stock: number;
  is_in_stock: boolean;
  is_active: boolean;
}

// Product Variant (Level 2 - Child product)
export interface ProductVariant {
  id: string;
  parent_id: string;
  name: string;
  code: string | null;
  article: string | null;
  prices: ProductPriceEntry[]; // Typed price array matching Product interface
  price_mdl: number | null;
  price_eur: number | null;
  price_usd: number | null;
  total_stock: number;
  is_in_stock: boolean;
  is_active: boolean;
  main_image_url: string | null;
}

// Product grouping API responses
export interface ProductGroupsResponse {
  data: ProductGrouping[];
  total: number;
  limit: number;
  offset: number;
}

export interface ProductVariantsResponse {
  data: ProductVariant[];
  total: number;
  limit: number;
  offset: number;
}

// ============================================================================
// UPLOAD TYPES
// ============================================================================

// Response from image/video upload
export interface UploadResponse {
  uuid: string;
  url: string;
  filename: string;
  size: number;
  content_type: string;
}

// Multiple upload response
export interface MultiUploadResponse {
  files: UploadResponse[];
  failed: Array<{
    filename: string;
    error: string;
  }>;
}

// ============================================================================
// PRODUCT CREATION TYPES
// ============================================================================

// Image data for product creation
export interface CreateImageData {
  uuid: string;
  url: string;
  description?: string | null;
  path_global?: string | null;
}

// Video data for product creation
export interface CreateVideoData {
  uuid: string;
  url: string;
  title?: string | null;
  description?: string | null;
  thumbnail_url?: string | null;
}

// Price data for product creation
export interface CreatePriceData {
  price: number;
  currency: string;
  type?: string;
  type_uuid?: string;
}

// Property data for product creation
export interface CreatePropertyData {
  property_name: string;
  property_code?: string | null;
  value: string;
  value_type?: string | null;
  group_uuid?: string | null;
  group_name?: string | null;
  sort_order?: number;
  is_filter?: boolean;
  is_modification?: boolean;
}

// Characteristic/SKU data for product creation
export interface CreateCharacteristicData {
  name: string;
  code?: string | null;
  reference?: string | null;
  prices: CreatePriceData[];
  stock_warehouse?: number;
  stock_showroom?: number;
  is_active?: boolean;
}

// Full product creation payload
export interface CreateProductPayload {
  // Basic info
  name: string;
  code?: string | null;
  article?: string | null;
  description?: string | null;

  // Relationships
  brand_id?: string | null;
  category_id?: string | null;
  parent_id?: string | null;

  // Media
  main_image_url?: string | null;
  images?: CreateImageData[];
  videos?: CreateVideoData[];

  // Additional info
  warranty?: string | null;
  barcodes?: string[];

  // Prices (product-level)
  prices?: CreatePriceData[];
  price_mdl?: number | null;
  price_eur?: number | null;
  price_usd?: number | null;

  // Stock
  total_stock?: number;
  is_in_stock?: boolean;

  // Flags
  is_group?: boolean;
  is_active?: boolean;
  is_service?: boolean;

  // Nested entities
  properties?: CreatePropertyData[];
}

// Update product payload (partial)
export interface UpdateProductFullPayload {
  name?: string;
  code?: string | null;
  article?: string | null;
  description?: string | null;
  brand_id?: string | null;
  category_id?: string | null;
  parent_id?: string | null;
  main_image_url?: string | null;
  images?: CreateImageData[];
  videos?: CreateVideoData[];
  warranty?: string | null;
  barcodes?: string[];
  prices?: CreatePriceData[];
  is_group?: boolean;
  is_active?: boolean;
  is_service?: boolean;
}

// Form state for multi-tab product creation
export interface ProductFormState {
  // Tab 1: Basic Info (including pricing)
  basicInfo: {
    name: string;
    code: string;
    article: string;
    description: string;
    brand_id: string;
    category_id: string;
    warranty: string;
    barcodes: string[];
    is_active: boolean;
    is_service: boolean;
    // Product-level pricing
    price_mdl: number | null;
    price_eur: number | null;
    price_usd: number | null;
    total_stock: number;
    is_in_stock: boolean;
  };

  // Tab 2: Media
  media: {
    main_image_url: string;
    images: CreateImageData[];
    videos: CreateVideoData[];
  };

  // Tab 3: Properties
  properties: CreatePropertyData[];

  // Tab 4: Variants
  variants: {
    parent_id: string | null;
    is_group: boolean;
  };
}
