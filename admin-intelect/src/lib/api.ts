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
  ProductFilters,
  DashboardStats,
  SyncLog,
  SyncProgress,
  UpdateProductPayload,
  UpdateProductFullPayload,
  CreateBrandPayload,
  UpdateBrandPayload,
  CreateCategoryPayload,
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
  DeletionImpact,
  PropertyGroup,
  PropertyName,
  PropertyValue,
  PropertyGroupsResponse,
  PropertyNamesResponse,
  PropertyValuesResponse,
  UploadResponse,
  MultiUploadResponse,
  CreateProductPayload,
  ProductSource,
  CreateSourceRequest,
  TranslationJob,
  TranslationLog,
  TranslationStats,
  TranslationJobsResponse,
  TranslationLogsResponse,
  TranslationEntityType,
  TargetLanguage,
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
import {
  SyncSchedule,
  SyncScheduleRun,
  ScheduleCreateRequest,
  ScheduleUpdateRequest,
  SchedulesListResponse,
  ScheduleRunsListResponse,
  ScheduleToggleResponse,
  ScheduleTestResponse,
} from "@/types/schedule";
import {
  AnalyticsSummary,
  AnalyticsSummaryResponse,
  PerformanceMetric,
  PerformanceMetricsResponse,
  PerformanceMetricsParams,
  PerformanceTrend,
  PerformanceTrendsResponse,
  BottleneckInfo,
  BottlenecksResponse,
  StepAverages,
  StepAveragesResponse,
  ThroughputStats,
  ThroughputStatsResponse,
  normalizePerformanceTrend,
  normalizeStepAverages,
  normalizeBottleneckInfo,
} from "@/types/analytics";
import {
  SyncEntityFilter,
  FilterCreateRequest,
  FilterUpdateRequest,
  FilterTestResult,
  FiltersListResponse,
  EntityTypesResponse,
  FilterToggleResponse,
} from "@/types/filter";
import {
  VariantGenerationJob,
  VariantStats,
  VariantStatusResponse,
  ProductVariantGroup,
  VariantGroupWithDetails,
  VariantProgressUpdate,
  VariantJobsResponse,
  VariantGroupsResponse,
} from "@/types/variants";
import {
  Promotion,
  PromotionInput,
  PromotionUpdateInput,
  PromotionFilters,
  PromotionsListResponse,
  PromotionProduct,
  PromotionProductsResponse,
  AddProductsToPromotionPayload,
  RemoveProductsFromPromotionPayload,
  BulkAddProductsToPromotionPayload,
} from "@/types/promotions";
import {
  SmartSearchParams,
  SmartSearchResponse,
  AutocompleteResponse,
  SearchComparisonResponse,
  SearchIndexStatus,
} from "@/types/search";
import {
  AdminUser,
  LoginRequest,
  LoginResponse,
} from "@/types/auth";
import {
  Store,
  StoreInput,
  StoresListResponse,
} from "@/types/stores";
import {
  Order,
  OrderWithItems,
  OrderStatus,
  OrderFilters,
  OrdersListResponse,
  OrderStats,
  UpdateOrderInput,
  OrderComment,
} from "@/types/orders";
import {
  ServicePackageType,
  ServicePackage,
  ServiceOrder,
  ServicePackageTypeInput,
  ServicePackageInput,
  UpdateServiceOrderInput,
  ServicePackageFilters,
  ServiceOrderFilters,
  ServicePackageTypesResponse,
  ServicePackagesResponse,
  ServiceOrdersResponse,
  ServiceOrderStats,
  ServicePackageTypeFilters,
} from "@/types/services";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
const TOKEN_KEY = "auth_token";

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN_KEY);
  }

  private setToken(token: string): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(TOKEN_KEY, token);
    // Also set as cookie for middleware
    document.cookie = `${TOKEN_KEY}=${token}; path=/; max-age=${60 * 60 * 24 * 7}`; // 7 days
  }

  private removeToken(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(TOKEN_KEY);
    // Remove cookie
    document.cookie = `${TOKEN_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT`;
  }

  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const token = this.getToken();

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options?.headers,
    };

    // Add Authorization header if token exists
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle 401 Unauthorized - clear auth and redirect to login
    if (response.status === 401) {
      this.removeToken();
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
      throw new Error("Unauthorized - please login again");
    }

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

  // ============================================================================
  // AUTHENTICATION METHODS
  // ============================================================================

  /**
   * Login with username and password
   */
  async login(username: string, password: string): Promise<LoginResponse> {
    const payload: LoginRequest = { username, password };
    const response = await this.fetch<LoginResponse>(
      "/api/v1/auth/login",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );

    // Store token
    this.setToken(response.token);

    return response;
  }

  /**
   * Logout - clear token
   */
  logout(): void {
    this.removeToken();
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<AdminUser> {
    const response = await this.fetch<{ data: AdminUser }>(
      "/api/v1/auth/me"
    );
    return response.data;
  }

  /**
   * Check if user is authenticated (has valid token)
   */
  isAuthenticated(): boolean {
    return this.getToken() !== null;
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
    return { data: response.data ?? [], total: response.meta?.total ?? 0 };
  }

  async getProduct(id: string): Promise<ProductDetail> {
    const response = await this.fetch<{ data: ProductDetail }>(`/api/v1/products/${id}`);
    return response.data;
  }

  async getProductProperties(id: string): Promise<Property[]> {
    const response = await this.fetch<{ data: Property[] }>(`/api/v1/products/${id}/properties`);
    return response.data;
  }

  /**
   * Get product variants based on parent_id relationship.
   * If the product has a parent_id, fetch siblings (products with same parent).
   * If the product is a parent, fetch its children.
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

    // Fetch variants via the variants endpoint
    try {
      const response = await this.fetch<{ data: Product[] }>(
        `/api/v1/products/${productId}/variants`
      );
      return deduplicateById(response.data);
    } catch {
      return [];
    }
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
    return { data: response.data ?? [], total: response.meta?.total ?? 0 };
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
    return { data: response.data ?? [], total: response.meta?.total ?? 0 };
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
      source_id?: string;
    }
  ): Promise<{ data: BrandProduct[]; total: number }> {
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());

    if (filters?.search) params.append("search", filters.search);
    if (filters?.price_filter) params.append("price_filter", filters.price_filter);
    if (filters?.stock_filter) params.append("stock_filter", filters.stock_filter);
    if (filters?.status_filter) params.append("status_filter", filters.status_filter);
    if (filters?.source_id) params.append("source_id", filters.source_id);

    const response = await this.fetch<{ data: BrandProduct[]; meta: { total: number } }>(
      `/api/v1/brands/${id}/products?${params.toString()}`
    );
    return { data: response.data ?? [], total: response.meta?.total ?? 0 };
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
    return { data: response.data ?? [], total: response.meta?.total ?? 0 };
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
      source_id?: string;
    }
  ): Promise<{ data: CategoryProduct[]; total: number }> {
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());

    if (filters?.search) params.append("search", filters.search);
    if (filters?.price_filter) params.append("price_filter", filters.price_filter);
    if (filters?.stock_filter) params.append("stock_filter", filters.stock_filter);
    if (filters?.status_filter) params.append("status_filter", filters.status_filter);
    if (filters?.source_id) params.append("source_id", filters.source_id);

    const response = await this.fetch<{ data: CategoryProduct[]; meta: { total: number } }>(
      `/api/v1/categories/${id}/products?${params.toString()}`
    );
    return { data: response.data ?? [], total: response.meta?.total ?? 0 };
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
    return { data: response.data ?? [], total: response.meta?.total ?? 0 };
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

  /**
   * Update a product with full data including properties replacement
   * Uses the /full endpoint which handles nested entities in a transaction
   */
  async updateProductFull(
    id: string,
    payload: UpdateProductFullPayload
  ): Promise<Product> {
    const response = await this.fetch<{ data: Product }>(`/api/v1/products/${id}/full`, {
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

  // Export brands
  async exportBrands(filters?: BrandFilterOptions): Promise<Blob> {
    const params = new URLSearchParams();

    if (filters?.search) params.append("search", filters.search);
    if (filters?.has_products) params.append("has_products", filters.has_products);
    if (filters?.is_active) params.append("is_active", filters.is_active);

    const url = `${this.baseUrl}/api/v1/export/brands?${params.toString()}`;
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

  // Export categories
  async exportCategories(filters?: CategoryFilterOptions): Promise<Blob> {
    const params = new URLSearchParams();

    if (filters?.search) params.append("search", filters.search);
    if (filters?.has_products) params.append("has_products", filters.has_products);
    if (filters?.is_active) params.append("is_active", filters.is_active);

    const url = `${this.baseUrl}/api/v1/export/categories?${params.toString()}`;
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
  async createBrand(payload: CreateBrandPayload): Promise<Brand> {
    const response = await this.fetch<{ data: Brand }>(`/api/v1/brands`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return response.data;
  }

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
  async createCategory(payload: CreateCategoryPayload): Promise<Category> {
    const response = await this.fetch<{ data: Category }>(`/api/v1/categories`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return response.data;
  }

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
    return { configurations: response.data ?? [], total: response.meta?.total ?? 0 };
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
    return { changes: response.data ?? [], total: response.meta?.total ?? 0 };
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
    const token = this.getToken();
    const response = await fetch(url, {
      method: "POST",
      body: formData,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const data = result.data as UploadResponse;
    // Prepend base URL to relative path
    if (data.url && data.url.startsWith("/")) {
      data.url = `${this.baseUrl}${data.url}`;
    }
    return data;
  }

  /**
   * Upload a single video file
   */
  async uploadVideo(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append("file", file);

    const url = `${this.baseUrl}/api/v1/upload/video`;
    const token = this.getToken();
    const response = await fetch(url, {
      method: "POST",
      body: formData,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const data = result.data as UploadResponse;
    // Prepend base URL to relative path
    if (data.url && data.url.startsWith("/")) {
      data.url = `${this.baseUrl}${data.url}`;
    }
    return data;
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
    const token = this.getToken();
    const response = await fetch(url, {
      method: "POST",
      body: formData,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    // Prepend base URL to relative paths
    const data = result.data as UploadResponse[];
    data.forEach((item) => {
      if (item.url && item.url.startsWith("/")) {
        item.url = `${this.baseUrl}${item.url}`;
      }
    });
    return { files: data, failed: result.errors || [] };
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
   * Returns full PropertyGroup objects with localized names
   */
  async getPropertyGroupOptionsWithLocalization(): Promise<PropertyGroup[]> {
    try {
      const response = await this.getPropertyGroups(1000, 0);
      return response.data ?? [];
    } catch {
      return [];
    }
  }

  /**
   * Get all property groups for property creation dropdown (legacy - returns strings)
   * @deprecated Use getPropertyGroupOptionsWithLocalization instead
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
   * Returns full PropertyName objects with localized names
   */
  async getPropertyNameOptionsWithLocalization(groupName: string): Promise<PropertyName[]> {
    try {
      const response = await this.getPropertyNames(groupName, 1000, 0);
      return response.data;
    } catch {
      return [];
    }
  }

  /**
   * Get property names for a group (for cascading dropdown) (legacy - returns strings)
   * @deprecated Use getPropertyNameOptionsWithLocalization instead
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
   * Get property values for a group/property combination (for value autocomplete)
   * Returns unique values as strings for the dropdown
   */
  async getPropertyValueOptions(groupName: string, propertyName: string): Promise<string[]> {
    try {
      const response = await this.getPropertyValues(groupName, propertyName, 1000, 0);
      // Extract unique non-null values
      const uniqueValues = new Set(
        response.data
          .map((v) => v.value)
          .filter((v): v is string => v !== null && v !== "")
      );
      return Array.from(uniqueValues).sort();
    } catch {
      return [];
    }
  }

  // ============================================================================
  // PRODUCT SOURCES
  // ============================================================================

  /**
   * Get all product sources
   */
  async getSources(): Promise<ProductSource[]> {
    const response = await this.fetch<{ data: ProductSource[] }>("/api/v1/sources");
    return response.data || [];
  }

  /**
   * Get a single source by ID
   */
  async getSource(id: string): Promise<ProductSource> {
    const response = await this.fetch<{ data: ProductSource }>(`/api/v1/sources/${id}`);
    return response.data;
  }

  /**
   * Get the default source (Ultra)
   */
  async getDefaultSource(): Promise<ProductSource> {
    const response = await this.fetch<{ data: ProductSource }>("/api/v1/sources/default");
    return response.data;
  }

  /**
   * Create a new source
   */
  async createSource(payload: CreateSourceRequest): Promise<ProductSource> {
    const response = await this.fetch<{ data: ProductSource }>("/api/v1/sources", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return response.data;
  }

  /**
   * Delete a source by ID (cannot delete default source)
   */
  async deleteSource(id: string): Promise<void> {
    await this.fetch<void>(`/api/v1/sources/${id}`, {
      method: "DELETE",
    });
  }

  // ============================================================================
  // TRANSLATION METHODS
  // ============================================================================

  /**
   * Start a translation job
   */
  async startTranslation(
    entityType: TranslationEntityType,
    targetLanguage: TargetLanguage
  ): Promise<TranslationJob> {
    const response = await this.fetch<{ data: TranslationJob }>("/api/v1/translate/start", {
      method: "POST",
      body: JSON.stringify({
        entity_type: entityType,
        target_language: targetLanguage,
      }),
    });
    return response.data;
  }

  /**
   * List translation jobs with optional filters
   */
  async getTranslationJobs(
    limit = 50,
    offset = 0,
    filters?: {
      entity_type?: TranslationEntityType;
      target_language?: TargetLanguage;
      status?: string;
    }
  ): Promise<{ data: TranslationJob[]; total: number }> {
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());

    if (filters?.entity_type) params.append("entity_type", filters.entity_type);
    if (filters?.target_language) params.append("target_language", filters.target_language);
    if (filters?.status) params.append("status", filters.status);

    const response = await this.fetch<TranslationJobsResponse>(
      `/api/v1/translate/jobs?${params.toString()}`
    );
    return { data: response.data ?? [], total: response.meta?.total ?? 0 };
  }

  /**
   * Get a single translation job by ID
   */
  async getTranslationJob(id: string): Promise<TranslationJob> {
    const response = await this.fetch<{ data: TranslationJob }>(`/api/v1/translate/jobs/${id}`);
    return response.data;
  }

  /**
   * Cancel a running translation job
   */
  async cancelTranslationJob(id: string): Promise<void> {
    await this.fetch<void>(`/api/v1/translate/jobs/${id}/cancel`, {
      method: "POST",
    });
  }

  /**
   * Get logs for a translation job
   */
  async getTranslationLogs(
    jobId: string,
    limit = 50,
    offset = 0
  ): Promise<{ data: TranslationLog[]; total: number }> {
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());

    const response = await this.fetch<TranslationLogsResponse>(
      `/api/v1/translate/jobs/${jobId}/logs?${params.toString()}`
    );
    return { data: response.data ?? [], total: response.meta?.total ?? 0 };
  }

  /**
   * Get translation statistics
   */
  async getTranslationStats(): Promise<TranslationStats> {
    const response = await this.fetch<{ data: TranslationStats }>("/api/v1/translate/stats");
    return response.data;
  }

  /**
   * Create an EventSource for real-time translation progress
   */
  createTranslationProgressStream(jobId: string): EventSource {
    return new EventSource(`${this.baseUrl}/api/v1/translate/stream/${jobId}`);
  }

  /**
   * Get the SSE URL for translation progress
   */
  getTranslationStreamUrl(jobId: string): string {
    return `${this.baseUrl}/api/v1/translate/stream/${jobId}`;
  }

  // ============================================================================
  // SYNC SCHEDULE METHODS
  // ============================================================================

  /**
   * List all sync schedules
   */
  async listSchedules(
    limit = 50,
    offset = 0
  ): Promise<{ schedules: SyncSchedule[]; total: number }> {
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());

    const response = await this.fetch<SchedulesListResponse & { data?: SyncSchedule[] }>(
      `/api/v1/sync/schedules?${params.toString()}`
    );
    // Backend returns 'data', normalize to 'schedules'
    return { schedules: response.data ?? response.schedules ?? [], total: response.total ?? 0 };
  }

  /**
   * Get a single schedule by ID
   */
  async getSchedule(id: string): Promise<SyncSchedule> {
    const response = await this.fetch<{ data: SyncSchedule }>(
      `/api/v1/sync/schedules/${id}`
    );
    return response.data;
  }

  /**
   * Create a new schedule
   */
  async createSchedule(request: ScheduleCreateRequest): Promise<SyncSchedule> {
    const response = await this.fetch<{ data: SyncSchedule }>(
      `/api/v1/sync/schedules`,
      {
        method: "POST",
        body: JSON.stringify(request),
      }
    );
    return response.data;
  }

  /**
   * Update an existing schedule
   */
  async updateSchedule(id: string, request: ScheduleUpdateRequest): Promise<SyncSchedule> {
    const response = await this.fetch<{ data: SyncSchedule }>(
      `/api/v1/sync/schedules/${id}`,
      {
        method: "PUT",
        body: JSON.stringify(request),
      }
    );
    return response.data;
  }

  /**
   * Delete a schedule
   */
  async deleteSchedule(id: string): Promise<void> {
    await this.fetch<{ message: string }>(
      `/api/v1/sync/schedules/${id}`,
      {
        method: "DELETE",
      }
    );
  }

  /**
   * Toggle schedule active status (enable/disable)
   */
  async toggleSchedule(id: string): Promise<SyncSchedule> {
    const response = await this.fetch<ScheduleToggleResponse>(
      `/api/v1/sync/schedules/${id}/toggle`,
      {
        method: "POST",
      }
    );
    return response.schedule;
  }

  /**
   * List runs for a specific schedule
   */
  async listScheduleRuns(
    scheduleId: string,
    limit = 50,
    offset = 0
  ): Promise<{ runs: SyncScheduleRun[]; total: number }> {
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());

    const response = await this.fetch<{ data: SyncScheduleRun[]; total: number }>(
      `/api/v1/sync/schedules/${scheduleId}/runs?${params.toString()}`
    );
    return { runs: response.data, total: response.total };
  }

  /**
   * Test/dry run a schedule to validate configuration
   */
  async testSchedule(id: string): Promise<ScheduleTestResponse> {
    return this.fetch<ScheduleTestResponse>(
      `/api/v1/sync/schedules/${id}/test`,
      {
        method: "POST",
      }
    );
  }

  // ============================================================================
  // SYNC ANALYTICS METHODS
  // ============================================================================

  /**
   * Get analytics summary (overall stats)
   */
  async getAnalyticsSummary(): Promise<AnalyticsSummary> {
    const response = await this.fetch<AnalyticsSummaryResponse>(
      `/api/v1/sync/analytics`
    );
    return response.data;
  }

  /**
   * Get performance metrics with optional filtering
   */
  async getPerformanceMetrics(
    params?: PerformanceMetricsParams
  ): Promise<{ data: PerformanceMetric[]; total: number }> {
    const searchParams = new URLSearchParams();

    if (params?.start_date) searchParams.append("start_date", params.start_date);
    if (params?.end_date) searchParams.append("end_date", params.end_date);
    if (params?.step) searchParams.append("step", params.step);
    if (params?.limit) searchParams.append("limit", params.limit.toString());
    if (params?.offset) searchParams.append("offset", params.offset.toString());

    const response = await this.fetch<PerformanceMetricsResponse>(
      `/api/v1/sync/analytics/metrics?${searchParams.toString()}`
    );
    return { data: response.data ?? [], total: response.meta?.total ?? 0 };
  }

  /**
   * Get performance metrics for a specific sync log
   */
  async getPerformanceMetricsForSync(syncLogId: string): Promise<PerformanceMetric[]> {
    const response = await this.fetch<{ data: PerformanceMetric[] }>(
      `/api/v1/sync/analytics/metrics/${syncLogId}`
    );
    return response.data;
  }

  /**
   * Get performance trends over time (for charts)
   */
  async getPerformanceTrends(days: number = 30): Promise<PerformanceTrend[]> {
    const response = await this.fetch<PerformanceTrendsResponse>(
      `/api/v1/sync/analytics/trends?days=${days}`
    );
    // Normalize the data to ensure all fields are present
    return (response.data || []).map(normalizePerformanceTrend);
  }

  /**
   * Get slowest operations (bottlenecks)
   */
  async getBottlenecks(limit: number = 10): Promise<BottleneckInfo[]> {
    const response = await this.fetch<BottlenecksResponse>(
      `/api/v1/sync/analytics/bottlenecks?limit=${limit}`
    );
    // Normalize the data to ensure all fields are present
    return (response.data || []).map(normalizeBottleneckInfo);
  }

  /**
   * Get statistics grouped by sync step
   */
  async getStepAverages(days: number = 30): Promise<StepAverages[]> {
    const response = await this.fetch<StepAveragesResponse>(
      `/api/v1/sync/analytics/by-step?days=${days}`
    );
    // Normalize the data to ensure all fields are present
    return (response.data || []).map(normalizeStepAverages);
  }

  /**
   * Get throughput statistics
   */
  async getThroughputStats(days: number = 30): Promise<ThroughputStats> {
    const response = await this.fetch<ThroughputStatsResponse>(
      `/api/v1/sync/analytics/throughput?days=${days}`
    );
    return response.data;
  }

  /**
   * Export analytics data as CSV
   */
  async exportAnalytics(startDate?: string, endDate?: string): Promise<Blob> {
    const params = new URLSearchParams();
    if (startDate) params.append("start_date", startDate);
    if (endDate) params.append("end_date", endDate);

    const url = `${this.baseUrl}/api/v1/sync/analytics/export?${params.toString()}`;
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

  /**
   * Get the URL for analytics CSV export
   */
  getAnalyticsExportUrl(startDate?: string, endDate?: string): string {
    const params = new URLSearchParams();
    if (startDate) params.append("start_date", startDate);
    if (endDate) params.append("end_date", endDate);
    return `${this.baseUrl}/api/v1/sync/analytics/export?${params.toString()}`;
  }

  // ============================================================================
  // SYNC ENTITY FILTER METHODS
  // ============================================================================

  /**
   * List all sync entity filters with pagination
   */
  async listFilters(
    limit = 50,
    offset = 0
  ): Promise<{ data: SyncEntityFilter[]; total: number }> {
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());

    const response = await this.fetch<FiltersListResponse>(
      `/api/v1/sync/filters?${params.toString()}`
    );
    return { data: response.data ?? [], total: response.meta?.total ?? 0 };
  }

  /**
   * Get a single filter by ID
   */
  async getFilter(id: string): Promise<SyncEntityFilter> {
    const response = await this.fetch<{ data: SyncEntityFilter }>(
      `/api/v1/sync/filters/${id}`
    );
    return response.data;
  }

  /**
   * Create a new sync entity filter
   */
  async createFilter(request: FilterCreateRequest): Promise<SyncEntityFilter> {
    const response = await this.fetch<{ data: SyncEntityFilter }>(
      `/api/v1/sync/filters`,
      {
        method: "POST",
        body: JSON.stringify(request),
      }
    );
    return response.data;
  }

  /**
   * Update an existing filter
   */
  async updateFilter(id: string, request: FilterUpdateRequest): Promise<SyncEntityFilter> {
    const response = await this.fetch<{ data: SyncEntityFilter }>(
      `/api/v1/sync/filters/${id}`,
      {
        method: "PUT",
        body: JSON.stringify(request),
      }
    );
    return response.data;
  }

  /**
   * Delete a filter
   */
  async deleteFilter(id: string): Promise<void> {
    await this.fetch<{ message: string }>(
      `/api/v1/sync/filters/${id}`,
      {
        method: "DELETE",
      }
    );
  }

  /**
   * Toggle filter active status (enable/disable)
   */
  async toggleFilter(id: string): Promise<SyncEntityFilter> {
    const response = await this.fetch<FilterToggleResponse>(
      `/api/v1/sync/filters/${id}/toggle`,
      {
        method: "POST",
      }
    );
    return response.filter;
  }

  /**
   * Test a filter and get matching count
   */
  async testFilter(id: string): Promise<FilterTestResult> {
    const response = await this.fetch<{ data: FilterTestResult }>(
      `/api/v1/sync/filters/${id}/test`,
      {
        method: "POST",
      }
    );
    return response.data;
  }

  /**
   * Get available entity types and their field configurations
   */
  async getEntityTypes(): Promise<EntityTypesResponse> {
    return this.fetch<EntityTypesResponse>(
      `/api/v1/sync/filters/entity-types`
    );
  }

  // ============================================================================
  // VARIANT GENERATION METHODS
  // ============================================================================

  /**
   * Trigger variant generation job
   * Starts a background job that analyzes products and creates variant groups
   */
  async triggerVariantGeneration(): Promise<VariantGenerationJob> {
    const response = await this.fetch<{ data: VariantGenerationJob }>(
      "/api/v1/variants/generate",
      {
        method: "POST",
      }
    );
    return response.data;
  }

  /**
   * Get current variant generation status
   * Returns the active job if one is running
   */
  async getVariantStatus(): Promise<VariantStatusResponse> {
    const response = await this.fetch<{ data: VariantStatusResponse }>(
      "/api/v1/variants/status"
    );
    return response.data;
  }

  /**
   * Get variant statistics
   * Returns counts and status information
   */
  async getVariantStats(): Promise<VariantStats> {
    const response = await this.fetch<{ data: VariantStats }>(
      "/api/v1/variants/stats"
    );
    return response.data;
  }

  /**
   * List variant generation jobs with pagination
   */
  async getVariantJobs(
    limit = 50,
    offset = 0
  ): Promise<{ data: VariantGenerationJob[]; total: number }> {
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());

    const response = await this.fetch<VariantJobsResponse>(
      `/api/v1/variants/jobs?${params.toString()}`
    );
    return { data: response.data ?? [], total: response.meta?.total ?? 0 };
  }

  /**
   * Get a single variant generation job by ID
   */
  async getVariantJob(id: string): Promise<VariantGenerationJob> {
    const response = await this.fetch<{ data: VariantGenerationJob }>(
      `/api/v1/variants/jobs/${id}`
    );
    return response.data;
  }

  /**
   * Cancel a running variant generation job
   */
  async cancelVariantJob(id: string): Promise<void> {
    await this.fetch<void>(`/api/v1/variants/jobs/${id}/cancel`, {
      method: "POST",
    });
  }

  /**
   * List variant groups with search and pagination
   */
  async getVariantGroups(
    params?: {
      search?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ data: ProductVariantGroup[]; total: number }> {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.append("search", params.search);
    searchParams.append("limit", (params?.limit ?? 50).toString());
    searchParams.append("offset", (params?.offset ?? 0).toString());

    const response = await this.fetch<VariantGroupsResponse>(
      `/api/v1/variants/groups?${searchParams.toString()}`
    );
    return { data: response.data ?? [], total: response.meta?.total ?? 0 };
  }

  /**
   * Get a variant group with full details
   * Optionally include the variant matrix for the editor
   */
  async getVariantGroup(
    id: string,
    includeMatrix = false
  ): Promise<VariantGroupWithDetails> {
    const params = new URLSearchParams();
    if (includeMatrix) {
      params.append("include_matrix", "true");
    }

    const response = await this.fetch<{ data: VariantGroupWithDetails }>(
      `/api/v1/variants/groups/${id}?${params.toString()}`
    );
    return response.data;
  }

  /**
   * Delete a variant group
   * This unlinks the products from the group but does not delete the products
   */
  async deleteVariantGroup(id: string): Promise<void> {
    await this.fetch<void>(`/api/v1/variants/groups/${id}`, {
      method: "DELETE",
    });
  }

  /**
   * Create an EventSource for real-time variant generation progress
   * Returns an unsubscribe function
   */
  subscribeToVariantProgress(
    jobId: string,
    onProgress: (update: VariantProgressUpdate) => void
  ): () => void {
    const eventSource = new EventSource(
      `${this.baseUrl}/api/v1/variants/stream/${jobId}`
    );

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as VariantProgressUpdate;
        onProgress(data);
      } catch (e) {
        console.error("Error parsing variant progress update:", e);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    // Return unsubscribe function
    return () => {
      eventSource.close();
    };
  }

  /**
   * Get the SSE URL for variant generation progress
   */
  getVariantStreamUrl(jobId: string): string {
    return `${this.baseUrl}/api/v1/variants/stream/${jobId}`;
  }

  // ============================================================================
  // STORES METHODS
  // ============================================================================

  /**
   * List all stores with pagination
   */
  async getStores(
    activeOnly = false,
    limit = 50,
    offset = 0
  ): Promise<{ data: Store[]; total: number }> {
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());
    if (activeOnly) {
      params.append("active_only", "true");
    }

    const response = await this.fetch<StoresListResponse>(
      `/api/v1/stores?${params.toString()}`
    );
    return { data: response.data ?? [], total: response.meta?.total ?? 0 };
  }

  /**
   * Get a single store by ID
   */
  async getStore(id: string): Promise<Store> {
    const response = await this.fetch<{ data: Store }>(
      `/api/v1/stores/${id}`
    );
    return response.data;
  }

  /**
   * Create a new store
   */
  async createStore(input: StoreInput): Promise<Store> {
    const response = await this.fetch<{ data: Store }>(
      `/api/v1/stores`,
      {
        method: "POST",
        body: JSON.stringify(input),
      }
    );
    return response.data;
  }

  /**
   * Update an existing store
   */
  async updateStore(id: string, input: StoreInput): Promise<Store> {
    const response = await this.fetch<{ data: Store }>(
      `/api/v1/stores/${id}`,
      {
        method: "PUT",
        body: JSON.stringify(input),
      }
    );
    return response.data;
  }

  /**
   * Delete a store
   */
  async deleteStore(id: string): Promise<void> {
    await this.fetch<{ message: string }>(
      `/api/v1/stores/${id}`,
      {
        method: "DELETE",
      }
    );
  }

  /**
   * Toggle store active status
   */
  async toggleStore(id: string): Promise<Store> {
    const response = await this.fetch<{ data: Store }>(
      `/api/v1/stores/${id}/toggle`,
      {
        method: "PATCH",
      }
    );
    return response.data;
  }

  // ============================================================================
  // ORDERS METHODS
  // ============================================================================

  /**
   * List all orders with filters and pagination
   */
  async getOrders(
    filters?: OrderFilters,
    limit = 50,
    offset = 0
  ): Promise<{ data: Order[]; total: number }> {
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());

    if (filters?.search) params.append("search", filters.search);
    if (filters?.status) params.append("status", filters.status);
    if (filters?.payment_method) params.append("payment_method", filters.payment_method);
    if (filters?.delivery_type) params.append("delivery_type", filters.delivery_type);
    if (filters?.store_id) params.append("store_id", filters.store_id);
    if (filters?.date_from) params.append("date_from", filters.date_from);
    if (filters?.date_to) params.append("date_to", filters.date_to);

    const response = await this.fetch<OrdersListResponse>(
      `/api/v1/orders?${params.toString()}`
    );
    return { data: response.data ?? [], total: response.meta?.total ?? 0 };
  }

  /**
   * Get a single order by ID with items
   */
  async getOrder(id: string): Promise<OrderWithItems> {
    const response = await this.fetch<{ data: OrderWithItems }>(
      `/api/v1/orders/${id}`
    );
    return response.data;
  }

  /**
   * Update an existing order
   */
  async updateOrder(id: string, input: UpdateOrderInput): Promise<Order> {
    const response = await this.fetch<{ data: Order }>(
      `/api/v1/orders/${id}`,
      {
        method: "PUT",
        body: JSON.stringify(input),
      }
    );
    return response.data;
  }

  /**
   * Update order status only
   */
  async updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
    const response = await this.fetch<{ data: Order }>(
      `/api/v1/orders/${id}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }
    );
    return response.data;
  }

  /**
   * Delete an order
   */
  async deleteOrder(id: string): Promise<void> {
    await this.fetch<{ message: string }>(
      `/api/v1/orders/${id}`,
      {
        method: "DELETE",
      }
    );
  }

  /**
   * Get order statistics
   */
  async getOrderStats(): Promise<OrderStats> {
    const response = await this.fetch<{ data: OrderStats }>(
      `/api/v1/orders/stats`
    );
    return response.data;
  }

  /**
   * Export orders to CSV
   */
  async exportOrders(filters?: OrderFilters): Promise<Blob> {
    const params = new URLSearchParams();

    if (filters?.search) params.append("search", filters.search);
    if (filters?.status) params.append("status", filters.status);
    if (filters?.payment_method) params.append("payment_method", filters.payment_method);
    if (filters?.delivery_type) params.append("delivery_type", filters.delivery_type);
    if (filters?.store_id) params.append("store_id", filters.store_id);
    if (filters?.date_from) params.append("date_from", filters.date_from);
    if (filters?.date_to) params.append("date_to", filters.date_to);

    const url = `${this.baseUrl}/api/v1/orders/export?${params.toString()}`;
    const token = this.getToken();

    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...(token && { "Authorization": `Bearer ${token}` }),
      },
    });

    if (!response.ok) {
      throw new Error(`Export failed: ${response.statusText}`);
    }

    return response.blob();
  }

  /**
   * Get order comments
   */
  async getOrderComments(orderId: string): Promise<OrderComment[]> {
    const response = await this.fetch<{ data: OrderComment[] }>(
      `/api/v1/orders/${orderId}/comments`
    );
    return response.data || [];
  }

  /**
   * Create order comment
   */
  async createOrderComment(orderId: string, content: string): Promise<OrderComment> {
    const response = await this.fetch<{ data: OrderComment }>(
      `/api/v1/orders/${orderId}/comments`,
      {
        method: "POST",
        body: JSON.stringify({ content }),
      }
    );
    return response.data;
  }

  // ============================================================================
  // SERVICE PACKAGES METHODS
  // ============================================================================

  /**
   * Get service package types (alias for getServiceTypes)
   */
  async getServicePackageTypes(activeOnly = false): Promise<ServicePackageType[]> {
    const params = new URLSearchParams();
    if (activeOnly) params.append("active_only", "true");

    const response = await this.fetch<ServicePackageTypesResponse>(
      `/api/v1/service-types?${params.toString()}`
    );
    return response.data ?? [];
  }

  /**
   * Get single service package type (alias for getServiceType)
   */
  async getServicePackageType(id: string): Promise<ServicePackageType> {
    const response = await this.fetch<{ data: ServicePackageType }>(
      `/api/v1/service-types/${id}`
    );
    return response.data;
  }

  /**
   * Create service package type (alias for createServiceType)
   */
  async createServicePackageType(input: ServicePackageTypeInput): Promise<ServicePackageType> {
    const response = await this.fetch<{ data: ServicePackageType }>(
      `/api/v1/service-types`,
      {
        method: "POST",
        body: JSON.stringify(input),
      }
    );
    return response.data;
  }

  /**
   * Update service package type (alias for updateServiceType)
   */
  async updateServicePackageType(id: string, input: ServicePackageTypeInput): Promise<ServicePackageType> {
    const response = await this.fetch<{ data: ServicePackageType }>(
      `/api/v1/service-types/${id}`,
      {
        method: "PUT",
        body: JSON.stringify(input),
      }
    );
    return response.data;
  }

  /**
   * Delete service package type (alias for deleteServiceType)
   */
  async deleteServicePackageType(id: string): Promise<void> {
    await this.fetch<{ message: string }>(
      `/api/v1/service-types/${id}`,
      {
        method: "DELETE",
      }
    );
  }

  /**
   * Get service order statistics
   */
  async getServiceOrderStats(): Promise<ServiceOrderStats> {
    const response = await this.fetch<{ data: ServiceOrderStats }>(
      `/api/v1/service-orders/stats`
    );
    return response.data;
  }

  // ============================================================================
  // PROMOTIONS AND DISCOUNTS METHODS
  // ============================================================================

  /**
   * List all promotions with optional filters and pagination
   */
  async getPromotions(
    filters?: PromotionFilters,
    limit = 50,
    offset = 0
  ): Promise<{ data: Promotion[]; total: number }> {
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());

    if (filters?.search) params.append("search", filters.search);
    if (filters?.is_active !== undefined)
      params.append("is_active", filters.is_active.toString());

    const response = await this.fetch<PromotionsListResponse>(
      `/api/v1/promotions?${params.toString()}`
    );
    return { data: response.data ?? [], total: response.meta?.total ?? 0 };
  }

  /**
   * Get a single promotion by ID with product count
   */
  async getPromotion(id: string): Promise<Promotion> {
    const response = await this.fetch<{ data: Promotion }>(
      `/api/v1/promotions/${id}`
    );
    return response.data;
  }

  /**
   * Create a new promotion
   */
  async createPromotion(data: PromotionInput): Promise<Promotion> {
    const response = await this.fetch<{ data: Promotion }>(
      `/api/v1/promotions`,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
    return response.data;
  }

  /**
   * Update an existing promotion
   */
  async updatePromotion(
    id: string,
    data: PromotionUpdateInput
  ): Promise<Promotion> {
    const response = await this.fetch<{ data: Promotion }>(
      `/api/v1/promotions/${id}`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      }
    );
    return response.data;
  }

  /**
   * Delete a promotion
   */
  async deletePromotion(id: string): Promise<void> {
    await this.fetch<{ message: string }>(`/api/v1/promotions/${id}`, {
      method: "DELETE",
    });
  }

  /**
   * Toggle promotion active status
   */
  async togglePromotion(id: string): Promise<Promotion> {
    const response = await this.fetch<{ data: Promotion }>(
      `/api/v1/promotions/${id}/toggle`,
      {
        method: "POST",
      }
    );
    return response.data;
  }

  /**
   * Get products in a promotion
   */
  async getPromotionProducts(
    id: string,
    limit = 50,
    offset = 0
  ): Promise<{ data: PromotionProduct[]; total: number }> {
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());

    const response = await this.fetch<PromotionProductsResponse>(
      `/api/v1/promotions/${id}/products?${params.toString()}`
    );
    return { data: response.data ?? [], total: response.meta?.total ?? 0 };
  }

  /**
   * Add products to a promotion by IDs
   */
  async addProductsToPromotion(
    id: string,
    productIds: string[]
  ): Promise<{ added: number; message: string }> {
    const payload: AddProductsToPromotionPayload = { product_ids: productIds };
    return this.fetch<{ added: number; message: string }>(
      `/api/v1/promotions/${id}/products`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
  }

  /**
   * Remove products from a promotion
   */
  async removeProductsFromPromotion(
    id: string,
    productIds: string[]
  ): Promise<{ removed: number; message: string }> {
    const payload: RemoveProductsFromPromotionPayload = {
      product_ids: productIds,
    };
    return this.fetch<{ removed: number; message: string }>(
      `/api/v1/promotions/${id}/products`,
      {
        method: "DELETE",
        body: JSON.stringify(payload),
      }
    );
  }

  /**
   * Bulk add products to a promotion by filter criteria
   */
  async bulkAddProductsToPromotion(
    id: string,
    filters: BulkAddProductsToPromotionPayload
  ): Promise<{ added: number; message: string }> {
    return this.fetch<{ added: number; message: string }>(
      `/api/v1/promotions/${id}/products/bulk`,
      {
        method: "POST",
        body: JSON.stringify(filters),
      }
    );
  }

  // ============================================================================
  // SMART SEARCH METHODS (Meilisearch)
  // ============================================================================

  /**
   * Execute smart search query with Meilisearch
   * Returns ranked, typo-tolerant search results
   */
  async smartSearch(params: SmartSearchParams): Promise<SmartSearchResponse> {
    const searchParams = new URLSearchParams();
    searchParams.append("q", params.query);

    if (params.brandId) searchParams.append("brand_id", params.brandId);
    if (params.categoryId) searchParams.append("category_id", params.categoryId);
    if (params.inStock !== undefined) searchParams.append("in_stock", params.inStock.toString());
    if (params.productType && params.productType !== "all") searchParams.append("product_type", params.productType);
    if (params.minPrice !== undefined) searchParams.append("min_price", params.minPrice.toString());
    if (params.maxPrice !== undefined) searchParams.append("max_price", params.maxPrice.toString());
    if (params.sort) searchParams.append("sort", params.sort);
    if (params.limit) searchParams.append("limit", params.limit.toString());
    if (params.offset) searchParams.append("offset", params.offset.toString());

    const response = await this.fetch<{ data: SmartSearchResponse }>(
      `/api/v1/smart-search?${searchParams.toString()}`
    );
    return response.data;
  }

  /**
   * Get fast autocomplete suggestions (optimized for dropdown)
   * Returns top matches with minimal data for fast rendering
   */
  async autocomplete(query: string, limit = 10): Promise<AutocompleteResponse> {
    const params = new URLSearchParams();
    params.append("q", query);
    params.append("limit", limit.toString());

    const response = await this.fetch<{ data: AutocompleteResponse }>(
      `/api/v1/smart-search/autocomplete?${params.toString()}`
    );
    return response.data;
  }

  /**
   * Compare old PostgreSQL search vs new Meilisearch side-by-side
   * Used for quality evaluation in search test page
   */
  async compareSearch(query: string): Promise<SearchComparisonResponse> {
    const params = new URLSearchParams();
    params.append("q", query);

    const response = await this.fetch<{ data: SearchComparisonResponse }>(
      `/api/v1/smart-search/compare?${params.toString()}`
    );
    return response.data;
  }

  /**
   * Get search index status and health
   * Returns document count, last indexed time, and health status
   */
  async getSearchStatus(): Promise<SearchIndexStatus> {
    const response = await this.fetch<{ data: SearchIndexStatus }>(
      `/api/v1/smart-search/status`
    );
    return response.data;
  }

  /**
   * Trigger manual reindex of all products to Meilisearch
   * Returns immediately, indexing happens in background
   */
  async reindexSearch(): Promise<{ message: string; started_at: string }> {
    return this.fetch<{ message: string; started_at: string }>(
      `/api/v1/smart-search/reindex`,
      {
        method: "POST",
      }
    );
  }

  // ============================================================================
  // SERVICE PACKAGES METHODS
  // ============================================================================

  /**
   * List all service package types
   */
  async getServiceTypes(
    filters?: ServicePackageTypeFilters,
    limit = 50,
    offset = 0
  ): Promise<{ data: ServicePackageType[]; total: number }> {
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());

    if (filters?.search) params.append("search", filters.search);
    if (filters?.active_only) params.append("active_only", "true");

    const response = await this.fetch<ServicePackageTypesResponse>(
      `/api/v1/service-types?${params.toString()}`
    );
    return { data: response.data ?? [], total: response.meta?.total ?? 0 };
  }

  /**
   * Get a single service package type by ID
   */
  async getServiceType(id: string): Promise<ServicePackageType> {
    const response = await this.fetch<{ data: ServicePackageType }>(
      `/api/v1/service-types/${id}`
    );
    return response.data;
  }

  /**
   * Create a new service package type
   */
  async createServiceType(input: ServicePackageTypeInput): Promise<ServicePackageType> {
    const response = await this.fetch<{ data: ServicePackageType }>(
      `/api/v1/service-types`,
      {
        method: "POST",
        body: JSON.stringify(input),
      }
    );
    return response.data;
  }

  /**
   * Update an existing service package type
   */
  async updateServiceType(id: string, input: ServicePackageTypeInput): Promise<ServicePackageType> {
    const response = await this.fetch<{ data: ServicePackageType }>(
      `/api/v1/service-types/${id}`,
      {
        method: "PUT",
        body: JSON.stringify(input),
      }
    );
    return response.data;
  }

  /**
   * Delete a service package type
   */
  async deleteServiceType(id: string): Promise<void> {
    await this.fetch<{ message: string }>(
      `/api/v1/service-types/${id}`,
      {
        method: "DELETE",
      }
    );
  }

  /**
   * List all service packages with optional filters
   */
  async getServicePackages(
    filters?: ServicePackageFilters,
    limit = 50,
    offset = 0
  ): Promise<{ data: ServicePackage[]; total: number }> {
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());

    if (filters?.type_id) params.append("type_id", filters.type_id);
    if (filters?.search) params.append("search", filters.search);
    if (filters?.active_only) params.append("active_only", "true");

    const response = await this.fetch<ServicePackagesResponse>(
      `/api/v1/service-packages?${params.toString()}`
    );
    return { data: response.data ?? [], total: response.meta?.total ?? 0 };
  }

  /**
   * Get a single service package by ID
   */
  async getServicePackage(id: string): Promise<ServicePackage> {
    const response = await this.fetch<{ data: ServicePackage }>(
      `/api/v1/service-packages/${id}`
    );
    return response.data;
  }

  /**
   * Create a new service package
   */
  async createServicePackage(input: ServicePackageInput): Promise<ServicePackage> {
    const response = await this.fetch<{ data: ServicePackage }>(
      `/api/v1/service-packages`,
      {
        method: "POST",
        body: JSON.stringify(input),
      }
    );
    return response.data;
  }

  /**
   * Update an existing service package
   */
  async updateServicePackage(id: string, input: ServicePackageInput): Promise<ServicePackage> {
    const response = await this.fetch<{ data: ServicePackage }>(
      `/api/v1/service-packages/${id}`,
      {
        method: "PUT",
        body: JSON.stringify(input),
      }
    );
    return response.data;
  }

  /**
   * Delete a service package
   */
  async deleteServicePackage(id: string): Promise<void> {
    await this.fetch<{ message: string }>(
      `/api/v1/service-packages/${id}`,
      {
        method: "DELETE",
      }
    );
  }

  /**
   * List all service orders with optional filters
   */
  async getServiceOrders(
    filters?: ServiceOrderFilters,
    limit = 50,
    offset = 0
  ): Promise<{ data: ServiceOrder[]; total: number }> {
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());

    if (filters?.status) params.append("status", filters.status);
    if (filters?.package_id) params.append("package_id", filters.package_id);
    if (filters?.search) params.append("search", filters.search);
    if (filters?.date_from) params.append("date_from", filters.date_from);
    if (filters?.date_to) params.append("date_to", filters.date_to);

    const response = await this.fetch<ServiceOrdersResponse>(
      `/api/v1/service-orders?${params.toString()}`
    );
    return { data: response.data ?? [], total: response.meta?.total ?? 0 };
  }

  /**
   * Get a single service order by ID
   */
  async getServiceOrder(id: string): Promise<ServiceOrder> {
    const response = await this.fetch<{ data: ServiceOrder }>(
      `/api/v1/service-orders/${id}`
    );
    return response.data;
  }

  /**
   * Update a service order (status, admin notes)
   */
  async updateServiceOrder(id: string, input: UpdateServiceOrderInput): Promise<ServiceOrder> {
    const response = await this.fetch<{ data: ServiceOrder }>(
      `/api/v1/service-orders/${id}`,
      {
        method: "PUT",
        body: JSON.stringify(input),
      }
    );
    return response.data;
  }

  /**
   * Delete a service order
   */
  async deleteServiceOrder(id: string): Promise<void> {
    await this.fetch<{ message: string }>(
      `/api/v1/service-orders/${id}`,
      {
        method: "DELETE",
      }
    );
  }

  /**
   * Get service order statistics
   */
  async getServiceOrderStats(): Promise<ServiceOrderStats> {
    const response = await this.fetch<{ data: ServiceOrderStats }>(
      `/api/v1/service-orders/stats`
    );
    return response.data;
  }
}

export const api = new ApiClient(API_BASE_URL);
export default api;
