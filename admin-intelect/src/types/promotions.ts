/**
 * Promotions and Discounts Type Definitions
 *
 * This file contains all TypeScript interfaces for the promotions system,
 * including promotion entities, filters, and API request/response types.
 */

/**
 * Main promotion entity
 */
export interface Promotion {
  id: string;
  name: string;
  description: string | null;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  priority: number;
  product_count?: number; // Number of products in this promotion (from detail API)
  created_at: string;
  updated_at: string;
}

/**
 * Input for creating a new promotion
 */
export interface PromotionInput {
  name: string;
  description?: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  start_date: string;
  end_date: string;
  is_active?: boolean;
  priority?: number;
}

/**
 * Input for updating an existing promotion
 */
export interface PromotionUpdateInput {
  name?: string;
  description?: string;
  discount_type?: 'percentage' | 'fixed_amount';
  discount_value?: number;
  start_date?: string;
  end_date?: string;
  is_active?: boolean;
  priority?: number;
}

/**
 * Filters for listing promotions
 */
export interface PromotionFilters {
  search?: string;
  is_active?: boolean;
}

/**
 * Response for listing promotions
 */
export interface PromotionsListResponse {
  data: Promotion[];
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
}

/**
 * Response for getting a single promotion
 */
export interface PromotionDetailResponse {
  data: Promotion;
}

/**
 * Product in promotion (simplified for product list in promotion detail)
 */
export interface PromotionProduct {
  id: string;
  name: string;
  code: string;
  article: string;
  brand_name?: string;
  category_name?: string;
  price_mdl: number | null;
  price_eur: number | null;
  price_usd: number | null;
  discounted_price_mdl: number | null;
  discounted_price_eur: number | null;
  discounted_price_usd: number | null;
  effective_discount_percent: number | null;
  is_active: boolean;
}

/**
 * Response for getting products in a promotion
 */
export interface PromotionProductsResponse {
  data: PromotionProduct[];
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
}

/**
 * Payload for adding products to promotion by IDs
 */
export interface AddProductsToPromotionPayload {
  product_ids: string[];
}

/**
 * Payload for removing products from promotion
 */
export interface RemoveProductsFromPromotionPayload {
  product_ids: string[];
}

/**
 * Payload for bulk adding products to promotion by filter
 */
export interface BulkAddProductsToPromotionPayload {
  brand_id?: string;
  category_id?: string;
  min_price?: number;
  max_price?: number;
  in_stock?: boolean;
}

/**
 * Statistics for promotions overview
 */
export interface PromotionStats {
  total_promotions: number;
  active_promotions: number;
  total_products_on_promotion: number;
  average_discount: number;
}
