/**
 * Catalog Builder React Query Hooks
 * Custom hooks for managing catalog data with react-query
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CatalogSection,
  CatalogSectionInput,
  CatalogGroup,
  CatalogGroupInput,
  CatalogItem,
  CatalogItemInput,
  CatalogSectionWithGroups,
} from "@/types/catalog";
import {
  getCatalogSections,
  getCatalogSection,
  createCatalogSection,
  updateCatalogSection,
  deleteCatalogSection,
  reorderCatalogSections,
  cloneCatalogSection,
  getCatalogGroups,
  getCatalogGroup,
  createCatalogGroup,
  updateCatalogGroup,
  deleteCatalogGroup,
  reorderCatalogGroups,
  getCatalogItems,
  getCatalogItem,
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
  reorderCatalogItems,
  getFullCatalog,
  getCatalogBySlug,
} from "@/lib/api/catalog";

// ============================================================================
// QUERY KEYS
// ============================================================================

export const catalogKeys = {
  all: ["catalog"] as const,
  sections: () => [...catalogKeys.all, "sections"] as const,
  section: (id: string) => [...catalogKeys.sections(), id] as const,
  groups: (sectionId: string) => [...catalogKeys.all, "groups", sectionId] as const,
  group: (id: string) => [...catalogKeys.all, "group", id] as const,
  items: (groupId: string) => [...catalogKeys.all, "items", groupId] as const,
  item: (id: string) => [...catalogKeys.all, "item", id] as const,
  full: () => [...catalogKeys.all, "full"] as const,
  bySlug: (slug: string) => [...catalogKeys.all, "slug", slug] as const,
};

// ============================================================================
// SECTION QUERIES
// ============================================================================

/**
 * Get all catalog sections
 */
export function useCatalogSections(activeOnly = false) {
  return useQuery({
    queryKey: [...catalogKeys.sections(), { activeOnly }],
    queryFn: () => getCatalogSections(activeOnly),
  });
}

/**
 * Get a single catalog section by ID
 */
export function useCatalogSection(id: string) {
  return useQuery({
    queryKey: catalogKeys.section(id),
    queryFn: () => getCatalogSection(id),
    enabled: !!id,
  });
}

// ============================================================================
// GROUP QUERIES
// ============================================================================

/**
 * Get all groups in a section
 */
export function useCatalogGroups(sectionId: string) {
  return useQuery({
    queryKey: catalogKeys.groups(sectionId),
    queryFn: () => getCatalogGroups(sectionId),
    enabled: !!sectionId,
  });
}

/**
 * Get a single catalog group by ID
 */
export function useCatalogGroup(id: string) {
  return useQuery({
    queryKey: catalogKeys.group(id),
    queryFn: () => getCatalogGroup(id),
    enabled: !!id,
  });
}

// ============================================================================
// ITEM QUERIES
// ============================================================================

/**
 * Get all items in a group
 */
export function useCatalogItems(groupId: string) {
  return useQuery({
    queryKey: catalogKeys.items(groupId),
    queryFn: () => getCatalogItems(groupId),
    enabled: !!groupId,
  });
}

/**
 * Get a single catalog item by ID
 */
export function useCatalogItem(id: string) {
  return useQuery({
    queryKey: catalogKeys.item(id),
    queryFn: () => getCatalogItem(id),
    enabled: !!id,
  });
}

// ============================================================================
// PUBLIC QUERIES
// ============================================================================

/**
 * Get the full catalog structure
 */
export function useFullCatalog() {
  return useQuery({
    queryKey: catalogKeys.full(),
    queryFn: getFullCatalog,
  });
}

/**
 * Get catalog by slug
 */
export function useCatalogBySlug(slug: string) {
  return useQuery({
    queryKey: catalogKeys.bySlug(slug),
    queryFn: () => getCatalogBySlug(slug),
    enabled: !!slug,
  });
}

// ============================================================================
// SECTION MUTATIONS
// ============================================================================

/**
 * Create a new catalog section
 */
export function useCreateSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCatalogSection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: catalogKeys.sections() });
      queryClient.invalidateQueries({ queryKey: catalogKeys.full() });
      toast.success("Section created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create section: ${error.message}`);
    },
  });
}

/**
 * Update an existing catalog section
 */
export function useUpdateSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CatalogSectionInput }) =>
      updateCatalogSection(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: catalogKeys.section(variables.id) });
      queryClient.invalidateQueries({ queryKey: catalogKeys.sections() });
      queryClient.invalidateQueries({ queryKey: catalogKeys.full() });
      toast.success("Section updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update section: ${error.message}`);
    },
  });
}

/**
 * Delete a catalog section
 */
export function useDeleteSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCatalogSection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: catalogKeys.sections() });
      queryClient.invalidateQueries({ queryKey: catalogKeys.full() });
      toast.success("Section deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete section: ${error.message}`);
    },
  });
}

/**
 * Reorder catalog sections
 */
export function useReorderSections() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: reorderCatalogSections,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: catalogKeys.sections() });
      queryClient.invalidateQueries({ queryKey: catalogKeys.full() });
    },
    onError: (error: Error) => {
      toast.error(`Failed to reorder sections: ${error.message}`);
    },
  });
}

/**
 * Clone a catalog section
 */
export function useCloneSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cloneCatalogSection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: catalogKeys.sections() });
      queryClient.invalidateQueries({ queryKey: catalogKeys.full() });
      toast.success("Section cloned successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to clone section: ${error.message}`);
    },
  });
}

// ============================================================================
// GROUP MUTATIONS
// ============================================================================

/**
 * Create a new catalog group
 */
export function useCreateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCatalogGroup,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: catalogKeys.groups(data.section_id) });
      queryClient.invalidateQueries({ queryKey: catalogKeys.full() });
      toast.success("Group created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create group: ${error.message}`);
    },
  });
}

/**
 * Update an existing catalog group
 */
export function useUpdateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CatalogGroupInput }) =>
      updateCatalogGroup(id, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: catalogKeys.group(variables.id) });
      queryClient.invalidateQueries({ queryKey: catalogKeys.groups(data.section_id) });
      queryClient.invalidateQueries({ queryKey: catalogKeys.full() });
      toast.success("Group updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update group: ${error.message}`);
    },
  });
}

/**
 * Delete a catalog group
 */
export function useDeleteGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCatalogGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: catalogKeys.all });
      toast.success("Group deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete group: ${error.message}`);
    },
  });
}

/**
 * Reorder catalog groups
 */
export function useReorderGroups() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: reorderCatalogGroups,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: catalogKeys.all });
    },
    onError: (error: Error) => {
      toast.error(`Failed to reorder groups: ${error.message}`);
    },
  });
}

// ============================================================================
// ITEM MUTATIONS
// ============================================================================

/**
 * Create a new catalog item
 */
export function useCreateItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCatalogItem,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: catalogKeys.items(data.group_id) });
      queryClient.invalidateQueries({ queryKey: catalogKeys.full() });
      toast.success("Item created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create item: ${error.message}`);
    },
  });
}

/**
 * Update an existing catalog item
 */
export function useUpdateItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CatalogItemInput }) =>
      updateCatalogItem(id, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: catalogKeys.item(variables.id) });
      queryClient.invalidateQueries({ queryKey: catalogKeys.items(data.group_id) });
      queryClient.invalidateQueries({ queryKey: catalogKeys.full() });
      toast.success("Item updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update item: ${error.message}`);
    },
  });
}

/**
 * Delete a catalog item
 */
export function useDeleteItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCatalogItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: catalogKeys.all });
      toast.success("Item deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete item: ${error.message}`);
    },
  });
}

/**
 * Reorder catalog items
 */
export function useReorderItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: reorderCatalogItems,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: catalogKeys.all });
    },
    onError: (error: Error) => {
      toast.error(`Failed to reorder items: ${error.message}`);
    },
  });
}
