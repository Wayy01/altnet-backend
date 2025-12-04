/**
 * Stores Type Definitions
 *
 * This file contains all TypeScript interfaces for the stores/pickup locations system.
 */

/**
 * Main store entity
 */
export interface Store {
  id: string;
  name: string;
  address: string;
  google_maps_url: string | null;
  images: string[];
  videos: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Input for creating or updating a store
 */
export interface StoreInput {
  name: string;
  address: string;
  google_maps_url?: string | null;
  images?: string[];
  videos?: string[];
  is_active?: boolean;
}

/**
 * Response for listing stores
 */
export interface StoresListResponse {
  data: Store[];
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
}

/**
 * Response for getting a single store
 */
export interface StoreDetailResponse {
  data: Store;
}
