// Brand types
export interface Brand {
  id: string;
  ultra_id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  product_count?: number;
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
  created_at: string;
  updated_at: string;
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
  images: string[];
  barcodes: string[];
  price_min: number | null;
  price_max: number | null;
  total_stock: number;
  is_group: boolean;
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
  items_synced: number;
  duration_ms: number;
  error_message: string | null;
  created_at: string;
}

// Exchange rate
export interface ExchangeRate {
  id: string;
  currency_code: string;
  rate: number;
  updated_at: string;
}
