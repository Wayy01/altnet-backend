/**
 * Smart Search System Types
 *
 * Type definitions for Meilisearch-powered smart search functionality
 */

/**
 * Parameters for smart search API requests
 */
export interface SmartSearchParams {
  query: string;
  brandId?: string;
  categoryId?: string;
  inStock?: boolean;
  productType?: "main" | "accessory" | "all";
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
  limit?: number;
  offset?: number;
}

/**
 * Individual search result hit from Meilisearch
 */
export interface SmartSearchHit {
  id: string;
  name: string;
  name_ru?: string;
  name_ro?: string;
  brand_name?: string;
  category_name?: string;
  main_image_url?: string;
  price_mdl?: number;
  total_stock: number;
  is_in_stock: boolean;
  product_type: "main" | "accessory";
  property_values?: string[];
}

/**
 * Complete smart search response from Meilisearch
 */
export interface SmartSearchResponse {
  hits: SmartSearchHit[];
  query: string;
  processingTimeMs: number;
  estimatedTotalHits: number;
}

/**
 * Autocomplete suggestion result (optimized for dropdown)
 */
export interface AutocompleteSuggestion {
  id: string;
  name: string;
  name_ru?: string;
  name_ro?: string;
  brand_name?: string;
  category_name?: string;
  image_url?: string;
  price?: number;
  product_type?: string;
  total_stock: number;
}

/**
 * Autocomplete API response
 */
export interface AutocompleteResponse {
  suggestions: AutocompleteSuggestion[];
  query: string;
  processingTimeMs: number;
}

/**
 * Comparison response showing old vs new search results
 */
export interface SearchComparisonResponse {
  query: string;
  oldSearch: {
    results: any[];
    count: number;
    timeMs: number;
  };
  newSearch: SmartSearchResponse;
}

/**
 * Search index health and status information
 */
export interface SearchIndexStatus {
  isHealthy: boolean;
  documentCount: number;
  lastIndexedAt?: string;
  pendingUpdates: number;
  isIndexing: boolean;
}
