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
} from "@/types";

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

    if (filters?.brand_id) params.append("brand_id", filters.brand_id);
    if (filters?.category_id) params.append("category_id", filters.category_id);
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

  async getProductVariants(id: string): Promise<Product[]> {
    const response = await this.fetch<{ data: Product[] }>(
      `/api/v1/products/${id}/variants`
    );
    return response.data;
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

  async getBrandWithStats(id: string): Promise<BrandWithStats> {
    const response = await this.fetch<{ data: BrandWithStats }>(`/api/v1/brands/${id}/stats`);
    return response.data;
  }

  async getBrandProducts(
    id: string,
    limit = 10,
    offset = 0
  ): Promise<{ data: BrandProduct[]; total: number }> {
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());

    const response = await this.fetch<{ data: BrandProduct[]; meta: { total: number } }>(
      `/api/v1/brands/${id}/products?${params.toString()}`
    );
    return { data: response.data, total: response.meta.total };
  }

  async bulkUpdateBrandProducts(brandId: string, isActive: boolean): Promise<{ updated: number }> {
    return this.fetch<{ updated: number }>(`/api/v1/brands/${brandId}/products/bulk`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: isActive }),
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

  async getCategoryWithStats(id: string): Promise<CategoryWithStats> {
    const response = await this.fetch<{ data: CategoryWithStats }>(`/api/v1/categories/${id}/stats`);
    return response.data;
  }

  async getCategoryProducts(
    id: string,
    limit = 10,
    offset = 0
  ): Promise<{ data: CategoryProduct[]; total: number }> {
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());

    const response = await this.fetch<{ data: CategoryProduct[]; meta: { total: number } }>(
      `/api/v1/categories/${id}/products?${params.toString()}`
    );
    return { data: response.data, total: response.meta.total };
  }

  async getCategorySubcategories(id: string): Promise<Category[]> {
    const response = await this.fetch<{ data: Category[] }>(`/api/v1/categories/${id}/subcategories`);
    return response.data;
  }

  async bulkUpdateCategoryProducts(categoryId: string, isActive: boolean): Promise<{ updated: number }> {
    return this.fetch<{ updated: number }>(`/api/v1/categories/${categoryId}/products/bulk`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: isActive }),
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

  // Low stock alerts
  async getLowStockProducts(
    threshold = 5,
    limit = 10
  ): Promise<LowStockAlert[]> {
    const params = new URLSearchParams();
    params.append("max_stock", threshold.toString());
    params.append("in_stock", "true");
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
}

export const api = new ApiClient(API_BASE_URL);
export default api;
