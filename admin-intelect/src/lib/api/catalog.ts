/**
 * Catalog Builder API Client
 * API functions for managing the 3-level catalog navigation structure
 */

import {
  CatalogSection,
  CatalogSectionInput,
  CatalogSectionsResponse,
  CatalogGroup,
  CatalogGroupInput,
  CatalogGroupsResponse,
  CatalogItem,
  CatalogItemInput,
  CatalogItemsResponse,
  CatalogSectionWithGroups,
  FullCatalogResponse,
} from "@/types/catalog";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
const TOKEN_KEY = "auth_token"; // Must match the key used in api.ts

/**
 * Get auth token from localStorage
 */
function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Generic fetch helper with error handling and authentication
 */
async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getToken();

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options?.headers,
  };

  // Add Authorization header if token exists
  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle 401 Unauthorized - redirect to login
  if (response.status === 401) {
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
    throw new Error("Unauthorized - please login again");
  }

  if (!response.ok) {
    let errorMessage = `API Error: ${response.status} ${response.statusText}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || errorMessage;
    } catch {
      // Ignore JSON parse errors
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

// ============================================================================
// SECTION APIs (Level 1)
// ============================================================================

/**
 * Get all catalog sections
 */
export async function getCatalogSections(activeOnly = false): Promise<CatalogSection[]> {
  const params = new URLSearchParams();
  if (activeOnly) {
    params.append("active_only", "true");
  }

  const response = await fetchAPI<CatalogSectionsResponse>(
    `/api/v1/admin/catalog/sections?${params.toString()}`
  );
  return response.data ?? [];
}

/**
 * Get a single catalog section by ID
 */
export async function getCatalogSection(id: string): Promise<CatalogSection> {
  const response = await fetchAPI<{ data: CatalogSection }>(
    `/api/v1/admin/catalog/sections/${id}`
  );
  return response.data;
}

/**
 * Create a new catalog section
 */
export async function createCatalogSection(data: CatalogSectionInput): Promise<CatalogSection> {
  const response = await fetchAPI<{ data: CatalogSection }>(
    `/api/v1/admin/catalog/sections`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
  return response.data;
}

/**
 * Update an existing catalog section
 */
export async function updateCatalogSection(
  id: string,
  data: CatalogSectionInput
): Promise<CatalogSection> {
  const response = await fetchAPI<{ data: CatalogSection }>(
    `/api/v1/admin/catalog/sections/${id}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    }
  );
  return response.data;
}

/**
 * Delete a catalog section
 */
export async function deleteCatalogSection(id: string): Promise<void> {
  await fetchAPI<{ message: string }>(
    `/api/v1/admin/catalog/sections/${id}`,
    {
      method: "DELETE",
    }
  );
}

/**
 * Reorder catalog sections
 */
export async function reorderCatalogSections(
  orders: { id: string; sort_order: number }[]
): Promise<void> {
  await fetchAPI<{ message: string }>(
    `/api/v1/admin/catalog/sections/reorder`,
    {
      method: "PATCH",
      body: JSON.stringify({ orders }),
    }
  );
}

/**
 * Clone a catalog section (with all groups and items)
 */
export async function cloneCatalogSection(id: string): Promise<CatalogSection> {
  const response = await fetchAPI<{ data: CatalogSection }>(
    `/api/v1/admin/catalog/sections/${id}/clone`,
    {
      method: "POST",
    }
  );
  return response.data;
}

// ============================================================================
// GROUP APIs (Level 2)
// ============================================================================

/**
 * Get all groups in a section
 */
export async function getCatalogGroups(sectionId: string): Promise<CatalogGroup[]> {
  const response = await fetchAPI<CatalogGroupsResponse>(
    `/api/v1/admin/catalog/sections/${sectionId}/groups`
  );
  return response.data ?? [];
}

/**
 * Get a single catalog group by ID
 */
export async function getCatalogGroup(id: string): Promise<CatalogGroup> {
  const response = await fetchAPI<{ data: CatalogGroup }>(
    `/api/v1/admin/catalog/groups/${id}`
  );
  return response.data;
}

/**
 * Create a new catalog group
 */
export async function createCatalogGroup(data: CatalogGroupInput): Promise<CatalogGroup> {
  const response = await fetchAPI<{ data: CatalogGroup }>(
    `/api/v1/admin/catalog/groups`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
  return response.data;
}

/**
 * Update an existing catalog group
 */
export async function updateCatalogGroup(
  id: string,
  data: CatalogGroupInput
): Promise<CatalogGroup> {
  const response = await fetchAPI<{ data: CatalogGroup }>(
    `/api/v1/admin/catalog/groups/${id}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    }
  );
  return response.data;
}

/**
 * Delete a catalog group
 */
export async function deleteCatalogGroup(id: string): Promise<void> {
  await fetchAPI<{ message: string }>(
    `/api/v1/admin/catalog/groups/${id}`,
    {
      method: "DELETE",
    }
  );
}

/**
 * Reorder catalog groups within a section
 */
export async function reorderCatalogGroups(
  orders: { id: string; sort_order: number }[]
): Promise<void> {
  await fetchAPI<{ message: string }>(
    `/api/v1/admin/catalog/groups/reorder`,
    {
      method: "PATCH",
      body: JSON.stringify({ orders }),
    }
  );
}

// ============================================================================
// ITEM APIs (Level 3)
// ============================================================================

/**
 * Get all items in a group
 */
export async function getCatalogItems(groupId: string): Promise<CatalogItem[]> {
  const response = await fetchAPI<CatalogItemsResponse>(
    `/api/v1/admin/catalog/groups/${groupId}/items`
  );
  return response.data ?? [];
}

/**
 * Get a single catalog item by ID
 */
export async function getCatalogItem(id: string): Promise<CatalogItem> {
  const response = await fetchAPI<{ data: CatalogItem }>(
    `/api/v1/admin/catalog/items/${id}`
  );
  return response.data;
}

/**
 * Create a new catalog item
 */
export async function createCatalogItem(data: CatalogItemInput): Promise<CatalogItem> {
  const response = await fetchAPI<{ data: CatalogItem }>(
    `/api/v1/admin/catalog/items`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
  return response.data;
}

/**
 * Update an existing catalog item
 */
export async function updateCatalogItem(
  id: string,
  data: CatalogItemInput
): Promise<CatalogItem> {
  const response = await fetchAPI<{ data: CatalogItem }>(
    `/api/v1/admin/catalog/items/${id}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    }
  );
  return response.data;
}

/**
 * Delete a catalog item
 */
export async function deleteCatalogItem(id: string): Promise<void> {
  await fetchAPI<{ message: string }>(
    `/api/v1/admin/catalog/items/${id}`,
    {
      method: "DELETE",
    }
  );
}

/**
 * Reorder catalog items within a group
 */
export async function reorderCatalogItems(
  orders: { id: string; sort_order: number }[]
): Promise<void> {
  await fetchAPI<{ message: string }>(
    `/api/v1/admin/catalog/items/reorder`,
    {
      method: "PATCH",
      body: JSON.stringify({ orders }),
    }
  );
}

// ============================================================================
// PUBLIC APIs (For frontend consumption)
// ============================================================================

/**
 * Get the full catalog structure (sections -> groups -> items)
 * Used by the public-facing website
 */
export async function getFullCatalog(): Promise<CatalogSectionWithGroups[]> {
  const response = await fetchAPI<FullCatalogResponse>(
    `/api/v1/catalog`
  );
  return response.data ?? [];
}

/**
 * Get a single section by slug with nested groups and items
 * Used by the public-facing website for specific section pages
 */
export async function getCatalogBySlug(slug: string): Promise<CatalogSectionWithGroups> {
  const response = await fetchAPI<{ data: CatalogSectionWithGroups }>(
    `/api/v1/catalog/${slug}`
  );
  return response.data;
}
