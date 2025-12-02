// ============================================================================
// VARIANT GENERATION TYPES
// ============================================================================

import { Product } from "@/types";

/**
 * Job status enum for variant generation
 */
export type VariantJobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

/**
 * Variant generation job
 * Represents a background job that analyzes products and creates variant groups
 */
export interface VariantGenerationJob {
  id: string;
  status: VariantJobStatus;
  total_products: number;
  processed_products: number;
  groups_created: number;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
  created_at: string;
}

/**
 * Product variant group
 * Groups products that are variants of each other (e.g., same product in different colors)
 */
export interface ProductVariantGroup {
  id: string;
  base_name: string;
  base_name_normalized: string;
  member_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * Group member (product in a variant group)
 */
export interface ProductVariantGroupMember {
  id: string;
  group_id: string;
  product_id: string;
  product?: Product; // optional populated product
  created_at: string;
}

/**
 * Variant property (detected variant characteristic)
 * Identifies which properties differentiate products in a group
 */
export interface VariantProperty {
  id: string;
  group_id: string;
  property_name: string;
  property_values: string[];
  parent_property: string | null;
  parent_value: string | null;
  created_at: string;
}

/**
 * Matrix column for display
 * Represents a property column in the variant matrix
 */
export interface VariantMatrixColumn {
  property_name: string;
  is_variant: boolean;
  values: string[];
}

/**
 * Matrix row (one product)
 * Represents a product row in the variant matrix
 */
export interface VariantMatrixRow {
  product_id: string;
  product_name: string;
  values: Record<string, string>; // property_name -> value
}

/**
 * Full matrix for display
 * Complete matrix structure for the variant editor
 */
export interface VariantMatrix {
  columns: VariantMatrixColumn[];
  rows: VariantMatrixRow[];
}

/**
 * Group with full details
 * Complete variant group with all related data
 */
export interface VariantGroupWithDetails {
  group: ProductVariantGroup;
  members: ProductVariantGroupMember[];
  variant_properties: VariantProperty[];
  matrix?: VariantMatrix;
}

/**
 * Stats response from /api/v1/variants/stats
 */
export interface VariantStats {
  total_groups: number;
  total_products_in_groups: number;
  ollama_available: boolean;
  active_job: VariantGenerationJob | null;
}

/**
 * Status response from /api/v1/variants/status
 */
export interface VariantStatusResponse {
  active_job: VariantGenerationJob | null;
}

/**
 * Progress update from SSE stream
 */
export interface VariantProgressUpdate {
  job_id: string;
  status: VariantJobStatus;
  processed: number;
  total: number;
  groups_created: number;
  percent: number;
  message: string;
}

/**
 * Pagination metadata
 */
export interface VariantPaginationMeta {
  total: number;
  limit: number;
  offset: number;
}

/**
 * Response for listing variant groups
 */
export interface VariantGroupsResponse {
  data: ProductVariantGroup[];
  meta: VariantPaginationMeta;
}

/**
 * Response for listing generation jobs
 */
export interface VariantJobsResponse {
  data: VariantGenerationJob[];
  meta: VariantPaginationMeta;
}
