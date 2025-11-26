import {
  Brand,
  BrandWithStats,
  BrandProduct,
  Category,
  CategoryWithStats,
  CategoryProduct,
  CategoryFilterOptions,
  BulkUpdateCategoriesByFilterPayload,
  BulkUpdateCategoriesByIdsPayload,
  Product,
  ProductDetail,
  Property,
  PropertyFilters,
  PropertyStats,
  CreatePropertyPayload,
  UpdatePropertyPayload,
  BulkUpdatePropertiesPayload,
  BulkDeletePropertiesPayload,
  Characteristic,
  ProductFilters,
  DashboardStats,
  SyncLog,
  SyncProgress,
  UpdateProductPayload,
  UpdateBrandPayload,
  UpdateCategoryPayload,
  BulkUpdatePayload,
  BulkDeletePayload,
  LowStockAlert,
  ExportFilters,
  BrandFilterOptions,
  BulkUpdateBrandsByFilterPayload,
  BulkUpdateBrandsByIdsPayload,
  StockSummaryItem,
  PriceSummary,
  CharacteristicName,
  CharacteristicValue,
  CharacteristicNamesResponse,
  CharacteristicValuesResponse,
  DeletionImpact,
  PropertyGroup,
  PropertyName,
  PropertyValue,
  PropertyGroupsResponse,
  PropertyNamesResponse,
  PropertyValuesResponse,
  ProductGrouping,
  ProductVariant,
  ProductGroupsResponse,
  ProductVariantsResponse,
  UploadResponse,
  MultiUploadResponse,
  CreateProductPayload,
} from "@/types";
import {
  SelectiveSyncRequest,
  SyncFieldSchema,
  SyncConfiguration,
  SyncChange,
  SyncChangeSummary,
  ListConfigurationsResponse,
  ListChangesResponse,
  ExecuteSyncResponse,
} from "@/types/selective-sync";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      let errorBody = '';
      try {
        const errorData = await response.json();
        errorBody = errorData.message || JSON.stringify(errorData);
      } catch {
        errorBody = await response.text();
      }
      throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    return response.json();
  }

  // Products
  async getProducts(
    filters?: ProductFilters,
    limit = 50,
    offset = 0
  ): Promise<{ data: Product[]; total: number }> {
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());

    // New filters
    if (filters?.search) params.append("search", filters.search);
    if (filters?.brand_id) params.append("brand_id", filters.brand_id);
    if (filters?.category_id) params.append("category_id", filters.category_id);
    if (filters?.price_filter) params.append("price_filter", filters.price_filter);
    if (filters?.stock_filter) params.append("stock_filter", filters.stock_filter);
    if (filters?.status_filter) params.append("status_filter", filters.status_filter);
    if (filters?.sort_by) params.append("sort_by", filters.sort_by);

    // Legacy filters (for backward compatibility)
    if (filters?.in_stock !== undefined)
      params.append("in_stock", filters.in_stock.toString());
    if (filters?.min_price !== undefined)
      params.append("min_price", filters.min_price.toString());
    if (filters?.max_price !== undefined)
      params.append("max_price", filters.max_price.toString());

    const response = await this.fetch<{ data: Product[]; meta: { total: number } }>(
      `/api/v1/products?${params.toString()}`
    );
    return { data: response.data, total: response.meta.total };
  }

  async getProduct(id: string): Promise<ProductDetail> {
    const response = await this.fetch<{ data: ProductDetail }>(`/api/v1/products/${id}`);
    return response.data;
  }

  async getProductProperties(id: string): Promise<Property[]> {
    const response = await this.fetch<{ data: Property[] }>(`/api/v1/products/${id}/properties`);
    return response.data;
  }

  async getProductCharacteristics(id: string): Promise<Characteristic[]> {
    const response = await this.fetch<{ data: Characteristic[] }>(
      `/api/v1/products/${id}/characteristics`
    );
    return response.data;
  }

  /**
   * Get product variants based on parent_id grouping.
   * If the product has a parent_id, fetch siblings (products with same parent).
   * If the product is a parent (has children), fetch its children.
   * Falls back to variant_group_id if no parent_id grouping exists.
   */
  async getProductVariantsForDetail(productId: string, product: Product): Promise<Product[]> {
    // Helper to deduplicate variants by id
    const deduplicateById = (variants: Product[]): Product[] => {
      const seen = new Set<string>();
      return variants.filter(v => {
        if (seen.has(v.id)) return false;
        seen.add(v.id);
        return true;
      });
    };

    // Check if this product is part of a parent_id-based group
    if (product.parent_id) {
      // This is a child product, fetch all siblings (same parent) including itself
      try {
        const response = await this.getGroupingVariants(product.parent_id);
        // Also include the parent in the list for navigation
        const parent = await this.getProduct(product.parent_id);
        const allVariants = [parent as Product, ...response.data.map(v => this.variantToProduct(v))];
        return deduplicateById(allVariants);
      } catch {
        // Fall back to old variant_group_id method
      }
    }

    // Check if this product is a parent (is_group flag or has children)
    if (product.is_group) {
      try {
        const response = await this.getGroupingVariants(productId);
        if (response.data.length > 0) {
          // Include the parent (current product) and all children
          const allVariants = [product, ...response.data.map(v => this.variantToProduct(v))];
          return deduplicateById(allVariants);
        }
      } catch {
        // Fall back to old variant_group_id method
      }
    }

    // Fall back to variant_group_id-based variants (old method)
    try {
      const response = await this.fetch<{ data: Product[] }>(
        `/api/v1/products/${productId}/variants`
      );
      return deduplicateById(response.data);
    } catch {
      return [];
    }
  }

  /**
   * Convert ProductVariant to Product format for compatibility with VariantSelector
   */
  private variantToProduct(variant: ProductVariant): Product {
    return {
      id: variant.id,
      ultra_id: '',
      code: variant.code || '',
      article: variant.article || '',
      name: variant.name,
      slug: '',
      description: null,
      brand_id: null,
      category_id: null,
      parent_id: variant.parent_id,
      main_image_url: variant.main_image_url || null,
      images: [],
      videos: [],
      warranty: null,
      barcodes: [],
      prices: variant.prices || [],
      price_min: null,
      price_max: null,
      price_mdl: variant.price_mdl,
      price_eur: variant.price_eur,
      price_usd: variant.price_usd,
      total_stock: variant.total_stock,
      is_in_stock: variant.is_in_stock ?? variant.total_stock > 0,
      is_group: false,
      is_active: variant.is_active,
      is_service: false,
      variant_group_id: null,
      created_at: '',
      updated_at: '',
    };
  }

  async searchProducts(
    query: string,
    limit = 50,
    offset = 0
  ): Promise<{ data: Product[]; total: number }> {
    const params = new URLSearchParams();
    params.append("q", query);
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());

    const response = await this.fetch<{ data: Product[]; meta: { total: number } }>(
      `/api/v1/search?${params.toString()}`
    );
    return { data: response.data, total: response.meta.total };
  }

  // Brands
  async getBrands(
    limit = 100,
    offset = 0,
    filters?: BrandFilterOptions
  ): Promise<{ data: Brand[]; total: number }> {
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());
    if (filters?.search) {
      params.append("search", filters.search);
    }
    if (filters?.has_products) {
      params.append("has_products", filters.has_products);
    }
    if (filters?.is_active) {
      params.append("is_active", filters.is_active);
    }
    if (filters?.sort_by) {
      params.append("sort_by", filters.sort_by);
    }

    const response = await this.fetch<{ data: Brand[]; meta: { total: number } }>(
      `/api/v1/brands?${params.toString()}`
    );
    return { data: response.data, total: response.meta.total };
  }

  async getBrand(id: string): Promise<Brand> {
    const response = await this.fetch<{ data: Brand }>(`/api/v1/brands/${id}`);
    return response.data;
  }

  async getAllBrands(): Promise<Brand[]> {
    const response = await this.fetch<{ data: Brand[] }>(`/api/v1/brands/all`);
    return response.data;
  }

  async getBrandWithStats(id: string): Promise<BrandWithStats> {
    const response = await this.fetch<{ data: BrandWithStats }>(`/api/v1/brands/${id}/stats`);
    return response.data;
  }

  async getBrandProducts(
    id: string,
    limit = 10,
    offset = 0,
    filters?: {
      search?: string;
      price_filter?: string;
      stock_filter?: string;
      status_filter?: string;
    }
  ): Promise<{ data: BrandProduct[]; total: number }> {
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());

    if (filters?.search) params.append("search", filters.search);
    if (filters?.price_filter) params.append("price_filter", filters.price_filter);
    if (filters?.stock_filter) params.append("stock_filter", filters.stock_filter);
    if (filters?.status_filter) params.append("status_filter", filters.status_filter);

    const response = await this.fetch<{ data: BrandProduct[]; meta: { total: number } }>(
      `/api/v1/brands/${id}/products?${params.toString()}`
    );
    return { data: response.data, total: response.meta.total };
  }

  async bulkUpdateBrandProducts(
    brandId: string,
    payload: {
      is_active: boolean;
      ids?: string[];
      filter?: {
        search?: string;
        price_filter?: string;
        stock_filter?: string;
        status_filter?: string;
      };
    }
  ): Promise<{ updated: number }> {
    return this.fetch<{ updated: number }>(`/api/v1/brands/${brandId}/products/bulk`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  // Categories
  async getCategories(
    limit = 100,
    offset = 0,
    filters?: CategoryFilterOptions
  ): Promise<{ data: Category[]; total: number }> {
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());
    if (filters?.search) {
      params.append("search", filters.search);
    }
    if (filters?.has_products) {
      params.append("has_products", filters.has_products);
    }
    if (filters?.is_active) {
      params.append("is_active", filters.is_active);
    }
    if (filters?.sort_by) {
      params.append("sort_by", filters.sort_by);
    }

    const response = await this.fetch<{ data: Category[]; meta: { total: number } }>(
      `/api/v1/categories?${params.toString()}`
    );
    return { data: response.data, total: response.meta.total };
  }

  async getCategory(id: string): Promise<Category> {
    const response = await this.fetch<{ data: Category }>(`/api/v1/categories/${id}`);
    return response.data;
  }

  async getAllCategories(): Promise<Category[]> {
    const response = await this.fetch<{ data: Category[] }>(`/api/v1/categories/all`);
    return response.data;
  }

  async getCategoryWithStats(id: string): Promise<CategoryWithStats> {
    const response = await this.fetch<{ data: CategoryWithStats }>(`/api/v1/categories/${id}/stats`);
    return response.data;
  }

  async getCategoryProducts(
    id: string,
    limit = 10,
    offset = 0,
    filters?: {
      search?: string;
      price_filter?: string;
      stock_filter?: string;
      status_filter?: string;
    }
  ): Promise<{ data: CategoryProduct[]; total: number }> {
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());

    if (filters?.search) params.append("search", filters.search);
    if (filters?.price_filter) params.append("price_filter", filters.price_filter);
    if (filters?.stock_filter) params.append("stock_filter", filters.stock_filter);
    if (filters?.status_filter) params.append("status_filter", filters.status_filter);

    const response = await this.fetch<{ data: CategoryProduct[]; meta: { total: number } }>(
      `/api/v1/categories/${id}/products?${params.toString()}`
    );
    return { data: response.data, total: response.meta.total };
  }

  async getCategorySubcategories(id: string): Promise<Category[]> {
    const response = await this.fetch<{ data: Category[] }>(`/api/v1/categories/${id}/subcategories`);
    return response.data;
  }

  async bulkUpdateCategoryProducts(
    categoryId: string,
    payload: {
      is_active: boolean;
      ids?: string[];
      filter?: {
        search?: string;
        price_filter?: string;
        stock_filter?: string;
        status_filter?: string;
      };
    }
  ): Promise<{ updated: number }> {
    return this.fetch<{ updated: number }>(`/api/v1/categories/${categoryId}/products/bulk`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  // Bulk update categories by IDs
  async bulkUpdateCategories(payload: BulkUpdateCategoriesByIdsPayload): Promise<{ updated: number; message: string }> {
    return this.fetch<{ updated: number; message: string }>(`/api/v1/categories/bulk`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  // Bulk update categories by filter (for "select all matching" feature)
  async bulkUpdateCategoriesByFilter(payload: BulkUpdateCategoriesByFilterPayload): Promise<{ updated: number; message: string }> {
    return this.fetch<{ updated: number; message: string }>(`/api/v1/categories/bulk`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  // Dashboard stats - use the dedicated backend endpoint
  async getDashboardStats(): Promise<DashboardStats> {
    const response = await this.fetch<{
      data: {
        total_products: number;
        total_brands: number;
        total_categories: number;
        total_properties: number;
        total_characteristics: number;
        total_prices: number;
        products_in_stock: number;
        products_out_of_stock: number;
        total_stock_value: number;
        last_sync_at: string | null;
        last_sync_status: string;
        recent_activity: unknown[];
      }
    }>(`/api/v1/dashboard/stats`);

    return {
      total_products: response.data.total_products,
      total_brands: response.data.total_brands,
      total_categories: response.data.total_categories,
      total_properties: response.data.total_properties,
      total_characteristics: response.data.total_characteristics,
      total_prices: response.data.total_prices,
      total_stock: response.data.products_in_stock + response.data.products_out_of_stock,
      in_stock_products: response.data.products_in_stock,
    };
  }

  // Stock summary by category
  async getStockSummary(): Promise<StockSummaryItem[]> {
    const response = await this.fetch<{ data: StockSummaryItem[] }>(
      `/api/v1/dashboard/stock-summary`
    );
    return response.data;
  }

  // Price distribution
  async getPriceSummary(): Promise<PriceSummary> {
    const response = await this.fetch<{ data: PriceSummary }>(
      `/api/v1/dashboard/price-summary`
    );
    return response.data;
  }

  // ============================================================================
  // PROPERTIES
  // ============================================================================

  // List properties with filtering and pagination
  async getProperties(
    filters?: PropertyFilters,
    limit = 50,
    offset = 0
  ): Promise<{ data: Property[]; pagination: { total: number; limit: number; offset: number } }> {
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());

    if (filters?.search) params.append("search", filters.search);
    if (filters?.product_id) params.append("product_id", filters.product_id);
    if (filters?.property_name) params.append("property_name", filters.property_name);
    if (filters?.group_name) params.append("group_name", filters.group_name);
    if (filters?.value_type) params.append("value_type", filters.value_type);
    if (filters?.is_filter) params.append("is_filter", filters.is_filter);
    if (filters?.is_modification) params.append("is_modification", filters.is_modification);
    if (filters?.sort_by) params.append("sort_by", filters.sort_by);
    if (filters?.created_after) params.append("created_after", filters.created_after);
    if (filters?.created_before) params.append("created_before", filters.created_before);

    return this.fetch(`/api/v1/properties?${params.toString()}`);
  }

  // Get single property by ID
  async getProperty(id: string): Promise<Property> {
    const response = await this.fetch<{ data: Property }>(
      `/api/v1/properties/${id}`
    );
    return response.data;
  }

  // Create a new property
  async createProperty(payload: CreatePropertyPayload): Promise<Property> {
    const response = await this.fetch<{ data: Property }>(
      `/api/v1/properties`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
    return response.data;
  }

  // Update a property
  async updateProperty(
    id: string,
    payload: UpdatePropertyPayload
  ): Promise<Property> {
    const response = await this.fetch<{ data: Property }>(
      `/api/v1/properties/${id}`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      }
    );
    return response.data;
  }

  // Delete a property
  async deleteProperty(id: string): Promise<void> {
    await this.fetch(`/api/v1/properties/${id}`, {
      method: "DELETE",
    });
  }

  // Bulk update properties
  async bulkUpdateProperties(
    payload: BulkUpdatePropertiesPayload
  ): Promise<{ message: string; count: number }> {
    return this.fetch(`/api/v1/properties/bulk`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  // Bulk delete properties
  async bulkDeleteProperties(
    payload: BulkDeletePropertiesPayload
  ): Promise<{ message: string; count: number }> {
    return this.fetch(`/api/v1/properties/bulk`, {
      method: "DELETE",
      body: JSON.stringify(payload),
    });
  }

  // Get property statistics
  async getPropertyStats(): Promise<PropertyStats> {
    const response = await this.fetch<{ data: PropertyStats }>(
      `/api/v1/properties/stats`
    );
    return response.data;
  }

  // Get unique property groups (legacy endpoint)
  async getPropertyGroupsList(): Promise<string[]> {
    const response = await this.fetch<{ data: string[] }>(
      `/api/v1/properties/groups`
    );
    return response.data;
  }

  // Sync logs
  async getSyncLogs(
    limit = 50,
    offset = 0
  ): Promise<{ data: SyncLog[]; total: number }> {
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());

    const response = await this.fetch<{ data: SyncLog[]; meta: { total: number } }>(
      `/api/v1/sync/logs?${params.toString()}`
    );
    return { data: response.data, total: response.meta.total };
  }

  async getLatestSyncLog(): Promise<SyncLog | null> {
    try {
      const response = await this.getSyncLogs(1, 0);
      return response.data[0] || null;
    } catch {
      return null;
    }
  }

  // Get detailed sync progress
  async getSyncProgress(): Promise<SyncProgress> {
    const response = await this.fetch<{ data: SyncProgress }>(
      `/api/v1/sync/progress`
    );
    return response.data;
  }

  // Cancel running sync
  async cancelSync(syncLogId: string, reason?: string): Promise<{
    sync_log_id: string;
    status: string;
    message: string;
    cancelled_at: string;
  }> {
    return this.fetch(`/api/v1/sync/${syncLogId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason: reason || "Cancelled by user" }),
    });
  }

  // Update sync status (for stuck syncs)
  async updateSyncStatus(
    syncLogId: string,
    status: "failed" | "cancelled",
    reason?: string,
    errorMessage?: string
  ): Promise<{
    sync_log_id: string;
    old_status: string;
    new_status: string;
    message: string;
    updated_at: string;
  }> {
    return this.fetch(`/api/v1/sync/${syncLogId}/status`, {
      method: "PATCH",
      body: JSON.stringify({
        status,
        reason: reason || "Manual status update by user",
        error_message: errorMessage,
      }),
    });
  }

  // Low stock alerts
  async getLowStockProducts(limit = 10): Promise<LowStockAlert[]> {
    const params = new URLSearchParams();
    params.append("stock_filter", "low_stock"); // Use backend's stock_filter parameter
    params.append("sort_by", "stock_low"); // Sort by lowest stock first
    params.append("limit", limit.toString());

    const response = await this.fetch<{ data: Product[]; meta: { total: number } }>(
      `/api/v1/products?${params.toString()}`
    );

    return response.data.map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code,
      total_stock: p.total_stock,
      brand_name: p.brand_name,
    }));
  }

  // Product mutations
  async updateProduct(
    id: string,
    payload: UpdateProductPayload
  ): Promise<Product> {
    const response = await this.fetch<{ data: Product }>(`/api/v1/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return response.data;
  }

  async deleteProduct(id: string): Promise<void> {
    await this.fetch<void>(`/api/v1/products/${id}`, {
      method: "DELETE",
    });
  }

  async bulkUpdateProducts(payload: BulkUpdatePayload): Promise<{ updated: number }> {
    return this.fetch<{ updated: number }>(`/api/v1/products/bulk`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async bulkDeleteProducts(payload: BulkDeletePayload): Promise<{ deleted: number }> {
    return this.fetch<{ deleted: number }>(`/api/v1/products/bulk`, {
      method: "DELETE",
      body: JSON.stringify(payload),
    });
  }

  // Export products
  async exportProducts(filters?: ExportFilters): Promise<Blob> {
    const params = new URLSearchParams();

    if (filters?.brand_id) params.append("brand_id", filters.brand_id);
    if (filters?.category_id) params.append("category_id", filters.category_id);
    if (filters?.in_stock !== undefined)
      params.append("in_stock", filters.in_stock.toString());
    if (filters?.format) params.append("format", filters.format);

    const url = `${this.baseUrl}/api/v1/export/products?${params.toString()}`;
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Export failed: ${response.statusText}`);
    }

    return response.blob();
  }

  // Brand mutations
  async updateBrand(
    id: string,
    payload: UpdateBrandPayload
  ): Promise<Brand> {
    const response = await this.fetch<{ data: Brand }>(`/api/v1/brands/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return response.data;
  }

  async deleteBrand(id: string): Promise<void> {
    await this.fetch<void>(`/api/v1/brands/${id}`, {
      method: "DELETE",
    });
  }

  // Bulk update brands by IDs
  async bulkUpdateBrands(payload: BulkUpdateBrandsByIdsPayload): Promise<{ updated: number; message: string }> {
    return this.fetch<{ updated: number; message: string }>(`/api/v1/brands/bulk`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  // Bulk update brands by filter (for "select all matching" feature)
  async bulkUpdateBrandsByFilter(payload: BulkUpdateBrandsByFilterPayload): Promise<{ updated: number; message: string }> {
    return this.fetch<{ updated: number; message: string }>(`/api/v1/brands/bulk`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  // Category mutations
  async updateCategory(
    id: string,
    payload: UpdateCategoryPayload
  ): Promise<Category> {
    const response = await this.fetch<{ data: Category }>(`/api/v1/categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return response.data;
  }

  async deleteCategory(id: string): Promise<void> {
    await this.fetch<void>(`/api/v1/categories/${id}`, {
      method: "DELETE",
    });
  }

  // Selective Sync
  async executeSelectiveSync(request: SelectiveSyncRequest): Promise<ExecuteSyncResponse> {
    // NOTE: No timeout - some syncs (properties) can take 40+ minutes
    // Backend has infinite WriteTimeout to support this
    const response = await this.fetch<ExecuteSyncResponse>(`/api/v1/sync/selective`, {
      method: "POST",
      body: JSON.stringify(request),
    });
    return response;
  }

  async getFieldSchemas(): Promise<SyncFieldSchema[]> {
    const response = await this.fetch<{ data: SyncFieldSchema[] }>(`/api/v1/sync/schemas`);
    return response.data;
  }

  async saveSyncConfiguration(config: Omit<SyncConfiguration, "id" | "created_at" | "updated_at">): Promise<SyncConfiguration> {
    const response = await this.fetch<{ data: SyncConfiguration }>(`/api/v1/sync/configs`, {
      method: "POST",
      body: JSON.stringify(config),
    });
    return response.data;
  }

  async listSyncConfigurations(
    templatesOnly = false,
    limit = 50,
    offset = 0
  ): Promise<ListConfigurationsResponse> {
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());
    if (templatesOnly) {
      params.append("templates_only", "true");
    }

    const response = await this.fetch<{ data: SyncConfiguration[]; meta: { total: number } }>(
      `/api/v1/sync/configs?${params.toString()}`
    );
    return { configurations: response.data, total: response.meta.total };
  }

  async getSyncConfiguration(id: string): Promise<SyncConfiguration> {
    const response = await this.fetch<{ data: SyncConfiguration }>(`/api/v1/sync/configs/${id}`);
    return response.data;
  }

  async getSyncChanges(
    syncLogId: string,
    limit = 50,
    offset = 0
  ): Promise<ListChangesResponse> {
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());

    const response = await this.fetch<{ data: SyncChange[]; meta: { total: number } }>(
      `/api/v1/sync/${syncLogId}/changes?${params.toString()}`
    );
    return { changes: response.data, total: response.meta.total };
  }

  async getSyncChangeSummary(syncLogId: string): Promise<SyncChangeSummary> {
    const response = await this.fetch<{ data: SyncChangeSummary }>(
      `/api/v1/sync/${syncLogId}/summary`
    );
    return response.data;
  }

  async updateSyncConfiguration(id: string, config: Partial<SyncConfiguration>): Promise<SyncConfiguration> {
    const response = await this.fetch<{ data: SyncConfiguration }>(`/api/v1/sync/configs/${id}`, {
      method: "PUT",
      body: JSON.stringify(config),
    });
    return response.data;
  }

  async deleteSyncConfiguration(id: string): Promise<void> {
    await this.fetch<void>(`/api/v1/sync/configs/${id}`, {
      method: "DELETE",
    });
  }

  getExportChangesUrl(syncLogId: string, format: "json" | "csv" = "csv"): string {
    return `${this.baseUrl}/api/v1/sync/${syncLogId}/changes/export?format=${format}`;
  }

  // Property Hierarchy - Groups (Level 1)
  async getPropertyGroups(
    limit = 50,
    offset = 0,
    search?: string
  ): Promise<PropertyGroupsResponse> {
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());
    if (search) params.append("search", search);

    return await this.fetch<PropertyGroupsResponse>(
      `/api/v1/properties/hierarchy/groups?${params.toString()}`
    );
  }

  async getPropertyGroup(groupName: string): Promise<PropertyGroup> {
    const encodedName = encodeURIComponent(groupName);
    return await this.fetch<PropertyGroup>(
      `/api/v1/properties/hierarchy/groups/${encodedName}`
    );
  }

  async deletePropertyGroup(groupName: string): Promise<void> {
    const encodedName = encodeURIComponent(groupName);
    await this.fetch<void>(`/api/v1/properties/hierarchy/groups/${encodedName}`, {
      method: "DELETE",
    });
  }

  async getGroupDeletionImpact(groupName: string): Promise<DeletionImpact> {
    const encodedName = encodeURIComponent(groupName);
    return await this.fetch<DeletionImpact>(
      `/api/v1/properties/hierarchy/groups/${encodedName}/impact`
    );
  }

  // Property Hierarchy - Names (Level 2)
  async getPropertyNames(
    groupName: string,
    limit = 50,
    offset = 0,
    search?: string
  ): Promise<PropertyNamesResponse> {
    const encodedGroup = encodeURIComponent(groupName);
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());
    if (search) params.append("search", search);

    return await this.fetch<PropertyNamesResponse>(
      `/api/v1/properties/hierarchy/groups/${encodedGroup}/properties?${params.toString()}`
    );
  }

  async getPropertyName(groupName: string, propertyName: string): Promise<PropertyName> {
    const encodedGroup = encodeURIComponent(groupName);
    const encodedProperty = encodeURIComponent(propertyName);
    return await this.fetch<PropertyName>(
      `/api/v1/properties/hierarchy/groups/${encodedGroup}/properties/${encodedProperty}`
    );
  }

  async deletePropertyName(groupName: string, propertyName: string): Promise<void> {
    const encodedGroup = encodeURIComponent(groupName);
    const encodedProperty = encodeURIComponent(propertyName);
    await this.fetch<void>(
      `/api/v1/properties/hierarchy/groups/${encodedGroup}/properties/${encodedProperty}`,
      { method: "DELETE" }
    );
  }

  async getPropertyNameDeletionImpact(groupName: string, propertyName: string): Promise<DeletionImpact> {
    const encodedGroup = encodeURIComponent(groupName);
    const encodedProperty = encodeURIComponent(propertyName);
    return await this.fetch<DeletionImpact>(
      `/api/v1/properties/hierarchy/groups/${encodedGroup}/properties/${encodedProperty}/impact`
    );
  }

  // Property Hierarchy - Values (Level 3)
  async getPropertyValues(
    groupName: string,
    propertyName: string,
    limit = 100,
    offset = 0,
    search?: string
  ): Promise<PropertyValuesResponse> {
    const encodedGroup = encodeURIComponent(groupName);
    const encodedProperty = encodeURIComponent(propertyName);
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());
    if (search) params.append("search", search);

    return await this.fetch<PropertyValuesResponse>(
      `/api/v1/properties/hierarchy/groups/${encodedGroup}/properties/${encodedProperty}/values?${params.toString()}`
    );
  }

  async updatePropertyValue(
    valueId: string,
    updates: {
      value?: string;
      value_type?: string;
      sort_order?: number;
      is_filter?: boolean;
      is_modification?: boolean;
    }
  ): Promise<void> {
    await this.fetch<void>(
      `/api/v1/properties/hierarchy/values/${valueId}`,
      {
        method: "PUT",
        body: JSON.stringify(updates),
      }
    );
  }

  async deletePropertyValue(valueId: string): Promise<void> {
    await this.fetch<void>(`/api/v1/properties/hierarchy/values/${valueId}`, {
      method: "DELETE",
    });
  }

  async bulkUpdatePropertyValues(
    groupName: string,
    propertyName: string,
    ids: string[],
    updates: {
      is_filter?: boolean;
      is_modification?: boolean;
      value_type?: string;
    }
  ): Promise<void> {
    const encodedGroup = encodeURIComponent(groupName);
    const encodedProperty = encodeURIComponent(propertyName);
    await this.fetch<void>(
      `/api/v1/properties/hierarchy/groups/${encodedGroup}/properties/${encodedProperty}/values/bulk`,
      {
        method: "PATCH",
        body: JSON.stringify({ ids, ...updates }),
      }
    );
  }

  async bulkDeletePropertyValues(
    groupName: string,
    propertyName: string,
    ids: string[]
  ): Promise<void> {
    const encodedGroup = encodeURIComponent(groupName);
    const encodedProperty = encodeURIComponent(propertyName);
    await this.fetch<void>(
      `/api/v1/properties/hierarchy/groups/${encodedGroup}/properties/${encodedProperty}/values/bulk`,
      {
        method: "DELETE",
        body: JSON.stringify({ ids }),
      }
    );
  }

  // Characteristic Hierarchy - Names (Level 1)
  async getCharacteristicNames(
    limit = 50,
    offset = 0,
    search?: string
  ): Promise<CharacteristicNamesResponse> {
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());
    if (search) params.append("search", search);

    return await this.fetch<CharacteristicNamesResponse>(
      `/api/v1/characteristics/hierarchy/names?${params.toString()}`
    );
  }

  async getCharacteristicName(name: string): Promise<CharacteristicName> {
    const encodedName = encodeURIComponent(name);
    return await this.fetch<CharacteristicName>(
      `/api/v1/characteristics/hierarchy/names/${encodedName}`
    );
  }

  async deleteCharacteristicName(name: string): Promise<void> {
    const encodedName = encodeURIComponent(name);
    await this.fetch<void>(`/api/v1/characteristics/hierarchy/names/${encodedName}`, {
      method: "DELETE",
    });
  }

  async getCharacteristicNameDeletionImpact(name: string): Promise<DeletionImpact> {
    const encodedName = encodeURIComponent(name);
    return await this.fetch<DeletionImpact>(
      `/api/v1/characteristics/hierarchy/names/${encodedName}/impact`
    );
  }

  // Characteristic Hierarchy - Values (Level 2)
  async getCharacteristicValues(
    name: string,
    limit = 100,
    offset = 0,
    search?: string
  ): Promise<CharacteristicValuesResponse> {
    const encodedName = encodeURIComponent(name);
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());
    if (search) params.append("search", search);

    return await this.fetch<CharacteristicValuesResponse>(
      `/api/v1/characteristics/hierarchy/names/${encodedName}/values?${params.toString()}`
    );
  }

  async updateCharacteristicValue(
    id: string,
    updates: {
      code?: string;
      reference?: string;
      stock_warehouse?: number;
      stock_showroom?: number;
      stock_total?: number;
      is_active?: boolean;
    }
  ): Promise<void> {
    await this.fetch<void>(`/api/v1/characteristics/hierarchy/values/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  }

  async deleteCharacteristicValue(id: string): Promise<void> {
    await this.fetch<void>(`/api/v1/characteristics/hierarchy/values/${id}`, {
      method: "DELETE",
    });
  }

  async bulkUpdateCharacteristicValues(
    ids: string[],
    updates: {
      stock_warehouse?: number;
      stock_showroom?: number;
      stock_total?: number;
      is_active?: boolean;
    }
  ): Promise<{ count: number }> {
    const response = await this.fetch<{ count: number }>(
      `/api/v1/characteristics/hierarchy/values/bulk-update`,
      {
        method: "POST",
        body: JSON.stringify({ ids, updates }),
      }
    );
    return response;
  }

  async bulkDeleteCharacteristicValues(ids: string[]): Promise<{ count: number }> {
    const response = await this.fetch<{ count: number }>(
      `/api/v1/characteristics/hierarchy/values/bulk-delete`,
      {
        method: "POST",
        body: JSON.stringify({ ids }),
      }
    );
    return response;
  }

  // Product Grouping Hierarchy - Groups (Level 1)
  async getProductGroupings(
    limit = 50,
    offset = 0,
    search?: string
  ): Promise<ProductGroupsResponse> {
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());
    if (search) params.append("search", search);

    return await this.fetch<ProductGroupsResponse>(
      `/api/v1/products/groupings/hierarchy/groups?${params.toString()}`
    );
  }

  async getProductGrouping(id: string): Promise<ProductGrouping> {
    const response = await this.fetch<{ data: ProductGrouping }>(
      `/api/v1/products/groupings/hierarchy/groups/${id}`
    );
    return response.data;
  }

  async deleteProductGrouping(id: string): Promise<void> {
    await this.fetch<void>(
      `/api/v1/products/groupings/hierarchy/groups/${id}`,
      { method: "DELETE" }
    );
  }

  async getProductGroupingDeletionImpact(id: string): Promise<DeletionImpact> {
    return await this.fetch<DeletionImpact>(
      `/api/v1/products/groupings/hierarchy/groups/${id}/deletion-impact`
    );
  }

  // Product Grouping Hierarchy - Variants (Level 2)
  async getGroupingVariants(
    parentId: string,
    limit = 50,
    offset = 0,
    search?: string
  ): Promise<ProductVariantsResponse> {
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());
    if (search) params.append("search", search);

    return await this.fetch<ProductVariantsResponse>(
      `/api/v1/products/groupings/hierarchy/groups/${parentId}/variants?${params.toString()}`
    );
  }

  async deleteProductVariant(id: string): Promise<void> {
    await this.fetch<void>(
      `/api/v1/products/groupings/hierarchy/variants/${id}`,
      { method: "DELETE" }
    );
  }

  async bulkUpdateProductVariants(
    ids: string[],
    updates: {
      is_active?: boolean;
      parent_id?: string | null;
    }
  ): Promise<{ count: number }> {
    return await this.fetch<{ count: number }>(
      `/api/v1/products/groupings/hierarchy/variants/bulk`,
      {
        method: "PATCH",
        body: JSON.stringify({ ids, updates }),
      }
    );
  }

  async bulkDeleteProductVariants(ids: string[]): Promise<{ count: number }> {
    return await this.fetch<{ count: number }>(
      `/api/v1/products/groupings/hierarchy/variants/bulk`,
      {
        method: "DELETE",
        body: JSON.stringify({ ids }),
      }
    );
  }

  // Product Grouping Post-Processing
  async triggerProductGrouping(): Promise<{
    message: string;
    total_groups: number;
    total_variants: number;
  }> {
    return await this.fetch<{
      message: string;
      total_groups: number;
      total_variants: number;
    }>(`/api/v1/products/groupings/trigger`, {
      method: "POST",
    });
  }

  // ============================================================================
  // UPLOAD METHODS
  // ============================================================================

  /**
   * Upload a single image file
   */
  async uploadImage(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append("file", file);

    const url = `${this.baseUrl}/api/v1/upload/image`;
    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Upload a single video file
   */
  async uploadVideo(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append("file", file);

    const url = `${this.baseUrl}/api/v1/upload/video`;
    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Upload multiple images at once
   */
  async uploadMultipleImages(files: File[]): Promise<MultiUploadResponse> {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append("files", file);
    });

    const url = `${this.baseUrl}/api/v1/upload/images`;
    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Delete an uploaded image by UUID
   */
  async deleteUploadedImage(uuid: string): Promise<void> {
    await this.fetch<void>(`/api/v1/upload/image/${uuid}`, {
      method: "DELETE",
    });
  }

  /**
   * Delete an uploaded video by UUID
   */
  async deleteUploadedVideo(uuid: string): Promise<void> {
    await this.fetch<void>(`/api/v1/upload/video/${uuid}`, {
      method: "DELETE",
    });
  }

  // ============================================================================
  // PRODUCT CREATION METHODS
  // ============================================================================

  /**
   * Create a new product with all nested entities (properties, characteristics)
   */
  async createProduct(payload: CreateProductPayload): Promise<Product> {
    const response = await this.fetch<{ data: Product }>(`/api/v1/products`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return response.data;
  }

  /**
   * Search for products to link as variants (for variant tab)
   */
  async searchProductsForVariants(
    query: string,
    excludeIds: string[] = [],
    limit = 20
  ): Promise<Product[]> {
    const params = new URLSearchParams();
    params.append("search", query);
    params.append("limit", limit.toString());
    // Only get products that are not already groups or have parent
    params.append("status_filter", "active");

    const response = await this.fetch<{ data: Product[]; meta: { total: number } }>(
      `/api/v1/products?${params.toString()}`
    );

    // Filter out excluded IDs client-side
    return response.data.filter((p) => !excludeIds.includes(p.id));
  }

  /**
   * Get all property groups for property creation dropdown
   */
  async getPropertyGroupOptions(): Promise<string[]> {
    try {
      const response = await this.getPropertyGroups(1000, 0);
      return response.data.map((g) => g.group_name);
    } catch {
      return [];
    }
  }

  /**
   * Get property names for a group (for cascading dropdown)
   */
  async getPropertyNameOptions(groupName: string): Promise<string[]> {
    try {
      const response = await this.getPropertyNames(groupName, 1000, 0);
      return response.data.map((n) => n.property_name);
    } catch {
      return [];
    }
  }

  /**
   * Get characteristic names for SKU creation dropdown
   */
  async getCharacteristicNameOptions(): Promise<string[]> {
    try {
      const response = await this.getCharacteristicNames(1000, 0);
      return response.data.map((c) => c.name);
    } catch {
      return [];
    }
  }
}

export const api = new ApiClient(API_BASE_URL);
export default api;
