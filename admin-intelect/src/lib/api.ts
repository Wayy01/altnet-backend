import {
  Brand,
  Category,
  Product,
  ProductDetail,
  Property,
  Characteristic,
  ProductFilters,
  DashboardStats,
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

    return this.fetch<{ data: Product[]; total: number }>(
      `/api/v1/products?${params.toString()}`
    );
  }

  async getProduct(id: string): Promise<ProductDetail> {
    return this.fetch<ProductDetail>(`/api/v1/products/${id}`);
  }

  async getProductProperties(id: string): Promise<Property[]> {
    return this.fetch<Property[]>(`/api/v1/products/${id}/properties`);
  }

  async getProductCharacteristics(id: string): Promise<Characteristic[]> {
    return this.fetch<Characteristic[]>(
      `/api/v1/products/${id}/characteristics`
    );
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

    return this.fetch<{ data: Product[]; total: number }>(
      `/api/v1/search?${params.toString()}`
    );
  }

  // Brands
  async getBrands(
    limit = 100,
    offset = 0
  ): Promise<{ data: Brand[]; total: number }> {
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());

    return this.fetch<{ data: Brand[]; total: number }>(
      `/api/v1/brands?${params.toString()}`
    );
  }

  async getBrand(id: string): Promise<Brand> {
    return this.fetch<Brand>(`/api/v1/brands/${id}`);
  }

  // Categories
  async getCategories(): Promise<{ data: Category[]; total: number }> {
    return this.fetch<{ data: Category[]; total: number }>(`/api/v1/categories`);
  }

  async getCategory(id: string): Promise<Category> {
    return this.fetch<Category>(`/api/v1/categories/${id}`);
  }

  // Dashboard stats - we'll aggregate from multiple endpoints
  async getDashboardStats(): Promise<DashboardStats> {
    // Since the backend doesn't have a dedicated stats endpoint,
    // we'll fetch counts from the available endpoints
    const [productsRes, brandsRes, categoriesRes] = await Promise.all([
      this.getProducts({}, 1, 0),
      this.getBrands(1, 0),
      this.getCategories(),
    ]);

    // Get in-stock count
    const inStockRes = await this.getProducts({ in_stock: true }, 1, 0);

    // Note: properties, characteristics, prices, and stock counts require
    // a dedicated backend stats endpoint. Showing 0 until implemented.
    return {
      total_products: productsRes.total,
      total_brands: brandsRes.total,
      total_categories: categoriesRes.total,
      total_properties: 0, // TODO: Backend stats endpoint needed
      total_characteristics: 0, // TODO: Backend stats endpoint needed
      total_prices: 0, // TODO: Backend stats endpoint needed
      total_stock: 0, // TODO: Backend stats endpoint needed
      in_stock_products: inStockRes.total,
    };
  }
}

export const api = new ApiClient(API_BASE_URL);
export default api;
