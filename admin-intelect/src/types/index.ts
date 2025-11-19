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
  name: string;
  parent_id: string | null;
  sort_order: number;
  product_count: number;
  children?: Category[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Image entry in products
export interface ImageEntry {
  uuid: string;
  url: string;
  description: string;
  path_global: string;
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
  name: string;
  prices: PriceEntry[];
  stock_warehouse: number;
  stock_showroom: number;
  stock_total: number;
  created_at: string;
  updated_at: string;
}

// Property (product specification)
export interface Property {
  id: string;
  product_id: string;
  property_name: string;
  value: string;
  group_name: string | null;
  is_filter: boolean;
  created_at: string;
}

// Product types
export interface Product {
  id: string;
  ultra_id: string;
  code: string;
  article: string;
  name: string;
  description: string | null;
  brand_id: string | null;
  brand_name?: string;
  category_id: string | null;
  category_name?: string;
  parent_id: string | null;
  images: ImageEntry[];
  barcodes: string[];
  price_min: number | null;
  price_max: number | null;
  total_stock: number;
  is_group: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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
  brand_id?: string;
  category_id?: string;
  in_stock?: boolean;
  min_price?: number;
  max_price?: number;
  search?: string;
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
  ids: string[];
  is_active?: boolean;
}

export interface BulkDeletePayload {
  ids: string[];
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
export interface SyncLogExtended extends SyncLog {
  started_at?: string;
  completed_at?: string;
  details?: Record<string, unknown>;
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
