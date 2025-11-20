"use client";

import { useState, useEffect, useCallback, useRef, useMemo, useTransition } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FolderTree,
  MoreHorizontal,
  Trash2,
  ExternalLink,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Eye,
  Filter,
  ArrowUpDown,
  CheckSquare,
  Power,
  PowerOff,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { Category, CategoryFilterOptions } from "@/types";
import { ConfirmDialog } from "@/components/confirm-dialog";

export default function CategoriesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get initial values from URL params
  const initialSearch = searchParams.get("search") || "";
  const initialHasProducts = searchParams.get("has_products") || "";
  const initialSortBy = searchParams.get("sort_by") || "name_asc";
  const initialIsActive = searchParams.get("is_active") || "";
  const initialOffset = parseInt(searchParams.get("offset") || "0", 10);

  // State
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [rootCount, setRootCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [hasProductsFilter, setHasProductsFilter] = useState(initialHasProducts);
  const [sortBy, setSortBy] = useState(initialSortBy);
  const [isActiveFilter, setIsActiveFilter] = useState(initialIsActive);

  // Pagination
  const limit = 100;
  const offset = initialOffset;
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAllMode, setSelectAllMode] = useState(false);

  // Dialogs
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);

  // Build filter object
  const currentFilters: CategoryFilterOptions = useMemo(() => ({
    search: debouncedSearch || undefined,
    has_products: hasProductsFilter || undefined,
    is_active: isActiveFilter || undefined,
    sort_by: sortBy || undefined,
  }), [debouncedSearch, hasProductsFilter, isActiveFilter, sortBy]);

  // Helper to update URL params
  const updateUrlParams = (updates: Record<string, string | null>) => {
    const newParams = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "") {
        newParams.delete(key);
      } else {
        newParams.set(key, value);
      }
    });
    router.push(`/categories?${newParams.toString()}`);
  };

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      setIsLoading(true);

      // Fetch categories with filters
      const result = await api.getCategories(limit, offset, currentFilters);
      setCategories(result.data);
      setTotal(result.total);

      // Calculate root categories count from current data
      const rootCategories = result.data.filter(cat => !cat.parent_id);
      setRootCount(rootCategories.length);

      setError(null);
    } catch (err) {
      console.error("Failed to fetch categories:", err);
      setError("Failed to load categories. Make sure the Go backend API is running.");
    } finally {
      setIsLoading(false);
      setIsSearching(false);
      // Refocus search input after fetch completes
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }
  }, [offset, currentFilters]);

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Debounce search input
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    if (searchQuery !== debouncedSearch) {
      setIsSearching(true);
      debounceTimeoutRef.current = setTimeout(() => {
        setDebouncedSearch(searchQuery);
        // Reset to first page when searching
        if (offset !== 0) {
          updateUrlParams({ search: searchQuery, offset: "0" });
        }
      }, 500);
    }

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [searchQuery, debouncedSearch, offset]);

  const filteredCategories = categories;

  const handleClearSearch = () => {
    setSearchQuery("");
    setDebouncedSearch("");
    updateUrlParams({ search: null, offset: "0" });
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setDebouncedSearch("");
    setHasProductsFilter("");
    setIsActiveFilter("");
    setSortBy("name_asc");
    router.push("/categories");
  };

  const handleHasProductsChange = (value: string) => {
    const filterValue = value === "all" ? "" : value;
    setHasProductsFilter(filterValue);
    setSelectedIds(new Set());
    setSelectAllMode(false);
    updateUrlParams({ has_products: filterValue || null, offset: "0" });
  };

  const handleIsActiveChange = (value: string) => {
    const filterValue = value === "all" ? "" : value;
    setIsActiveFilter(filterValue);
    setSelectedIds(new Set());
    setSelectAllMode(false);
    updateUrlParams({ is_active: filterValue || null, offset: "0" });
  };

  const handleSortByChange = (value: string) => {
    setSortBy(value);
    updateUrlParams({ sort_by: value, offset: "0" });
  };

  const handlePageChange = (newPage: number) => {
    const newOffset = (newPage - 1) * limit;
    if (!selectAllMode) {
      setSelectedIds(new Set());
    }
    updateUrlParams({ offset: newOffset.toString() });
  };

  // Selection handlers
  const handleSelectAll = () => {
    if (selectedIds.size === filteredCategories.length && !selectAllMode) {
      setSelectedIds(new Set());
      setSelectAllMode(false);
    } else {
      const newSelected = new Set(filteredCategories.map(c => c.id));
      setSelectedIds(newSelected);
      setSelectAllMode(false);
    }
  };

  const handleSelectAllMatching = () => {
    setSelectAllMode(true);
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
    setSelectAllMode(false);
  };

  const handleSelectOne = (categoryId: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(categoryId);
    } else {
      newSelected.delete(categoryId);
      if (selectAllMode) {
        setSelectAllMode(false);
      }
    }
    setSelectedIds(newSelected);
  };

  const isAllOnPageSelected = filteredCategories.length > 0 && filteredCategories.every(c => selectedIds.has(c.id));
  const isSomeSelected = selectedIds.size > 0 || selectAllMode;

  // Toggle active status
  const handleToggleActive = async (categoryId: string, isActive: boolean) => {
    setIsProcessing(true);
    try {
      await api.updateCategory(categoryId, { is_active: isActive });
      toast.success(`Category ${isActive ? "activated" : "deactivated"}`);
      startTransition(() => {
        fetchCategories();
      });
    } catch (error) {
      console.error("Failed to update category:", error);
      toast.error("Failed to update category status");
    } finally {
      setIsProcessing(false);
    }
  };

  // Bulk action handlers
  const handleBulkActivate = async () => {
    setIsProcessing(true);
    try {
      let result;
      if (selectAllMode) {
        result = await api.bulkUpdateCategoriesByFilter({
          filter: {
            search: debouncedSearch || undefined,
            has_products: hasProductsFilter || undefined,
            is_active: isActiveFilter || undefined,
          },
          is_active: true,
        });
      } else {
        result = await api.bulkUpdateCategories({
          ids: Array.from(selectedIds),
          is_active: true,
        });
      }
      toast.success(`Successfully activated ${result.updated} categories`);
      handleClearSelection();
      startTransition(() => {
        fetchCategories();
      });
    } catch (error) {
      console.error("Failed to bulk activate categories:", error);
      toast.error("Failed to activate categories");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkDeactivate = async () => {
    setIsProcessing(true);
    try {
      let result;
      if (selectAllMode) {
        result = await api.bulkUpdateCategoriesByFilter({
          filter: {
            search: debouncedSearch || undefined,
            has_products: hasProductsFilter || undefined,
            is_active: isActiveFilter || undefined,
          },
          is_active: false,
        });
      } else {
        result = await api.bulkUpdateCategories({
          ids: Array.from(selectedIds),
          is_active: false,
        });
      }
      toast.success(`Successfully deactivated ${result.updated} categories`);
      handleClearSelection();
      startTransition(() => {
        fetchCategories();
      });
    } catch (error) {
      console.error("Failed to bulk deactivate categories:", error);
      toast.error("Failed to deactivate categories");
    } finally {
      setIsProcessing(false);
    }
  };

  // Delete category
  const handleDeleteCategory = async () => {
    if (!deleteCategoryId) return;

    setIsProcessing(true);
    try {
      await api.deleteCategory(deleteCategoryId);
      toast.success("Category deleted successfully");
      setShowDeleteDialog(false);
      setDeleteCategoryId(null);
      startTransition(() => {
        fetchCategories();
      });
    } catch (error) {
      console.error("Failed to delete category:", error);
      toast.error("Failed to delete category");
    } finally {
      setIsProcessing(false);
    }
  };

  // Check if any filters are active
  const hasActiveFilters = debouncedSearch || hasProductsFilter || isActiveFilter || sortBy !== "name_asc";

  if (isLoading && categories.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
          <p className="text-muted-foreground">
            View and manage all categories in the catalog
          </p>
        </div>
        <CategoriesPageSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
          <p className="text-muted-foreground">
            View and manage all categories in the catalog
          </p>
        </div>
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
        <p className="text-muted-foreground">
          View and manage all categories in the catalog
        </p>
      </div>

      <div className="space-y-4">
        {/* Stats - Compact inline indicators */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-md border">
            <span className="text-xs font-medium text-muted-foreground">Total</span>
            <span className="text-sm font-semibold tabular-nums">
              {(total ?? 0).toLocaleString()}
            </span>
            {hasActiveFilters && (
              <span className="text-[10px] text-muted-foreground">(filtered)</span>
            )}
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-md border">
            <span className="text-xs font-medium text-muted-foreground">Root</span>
            <span className="text-sm font-semibold tabular-nums">{rootCount}</span>
            <span className="text-[10px] text-muted-foreground">on page</span>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-md border">
            <span className="text-xs font-medium text-muted-foreground">Showing</span>
            <span className="text-sm font-semibold tabular-nums">{filteredCategories.length}</span>
            <span className="text-[10px] text-muted-foreground">of {total}</span>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="relative">
            <Input
              ref={searchInputRef}
              name="search"
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-[250px] pr-8"
            />
            {isSearching && (
              <Loader2 className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
          {searchQuery && (
            <Button variant="ghost" size="sm" onClick={handleClearSearch}>
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}

          {/* Product Count Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={hasProductsFilter || "all"} onValueChange={handleHasProductsChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Product count" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                <SelectItem value="true">With products</SelectItem>
                <SelectItem value="false">Without products</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Power className="h-4 w-4 text-muted-foreground" />
            <Select value={isActiveFilter || "all"} onValueChange={handleIsActiveChange}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            <Select value={sortBy} onValueChange={handleSortByChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name_asc">Name A-Z</SelectItem>
                <SelectItem value="name_desc">Name Z-A</SelectItem>
                <SelectItem value="products_desc">Most products</SelectItem>
                <SelectItem value="products_asc">Least products</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={handleClearFilters}>
              Clear all filters
            </Button>
          )}

          {/* Results count */}
          {debouncedSearch && (
            <span className="text-sm text-muted-foreground ml-auto">
              {total} result{total !== 1 ? "s" : ""} found
            </span>
          )}
        </div>

        {/* Bulk Actions Bar */}
        {isSomeSelected && (
          <div className="flex items-center gap-4 p-3 bg-accent rounded-lg border border-border">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">
                {selectAllMode
                  ? `All ${total} matching categories selected`
                  : `${selectedIds.size} ${selectedIds.size !== 1 ? "categories" : "category"} selected`
                }
              </span>
            </div>

            {isAllOnPageSelected && !selectAllMode && total > filteredCategories.length && (
              <Button
                variant="link"
                size="sm"
                className="text-primary"
                onClick={handleSelectAllMatching}
              >
                Select all {total} matching categories
              </Button>
            )}

            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkActivate}
                disabled={isProcessing || isPending}
              >
                <Power className="h-4 w-4 mr-1" />
                Activate
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkDeactivate}
                disabled={isProcessing || isPending}
              >
                <PowerOff className="h-4 w-4 mr-1" />
                Deactivate
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearSelection}
                disabled={isProcessing || isPending}
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            </div>
          </div>
        )}

        {/* Categories Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={isAllOnPageSelected && filteredCategories.length > 0}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead className="w-[60px]">Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Parent</TableHead>
                <TableHead className="text-right">Products</TableHead>
                <TableHead className="w-[80px]">Active</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCategories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <FolderTree className="h-8 w-8 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        No categories found
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredCategories.map((category) => (
                  <TableRow key={category.id} className={selectedIds.has(category.id) || selectAllMode ? "bg-accent" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(category.id) || selectAllMode}
                        onCheckedChange={(checked) => handleSelectOne(category.id, checked as boolean)}
                        aria-label={`Select ${category.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      {category.image_url ? (
                        <img
                          src={category.image_url}
                          alt={category.name}
                          className="h-8 w-8 rounded object-cover"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-muted">
                          <FolderTree className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{category.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {category.parent_name || (
                        <Badge variant="outline">Root</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">
                        {category.product_count || 0}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={category.is_active}
                        onCheckedChange={(checked) =>
                          handleToggleActive(category.id, checked)
                        }
                        disabled={isProcessing || isPending}
                      />
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/categories/${category.id}`}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/products?category_id=${category.id}`}>
                              <ExternalLink className="mr-2 h-4 w-4" />
                              View Products
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              setDeleteCategoryId(category.id);
                              setShowDeleteDialog(true);
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {filteredCategories.length} of {total} categories
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-sm">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Delete Category Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Category"
        description="Are you sure you want to delete this category? This action cannot be undone and may affect child categories and associated products."
        confirmLabel="Delete"
        onConfirm={handleDeleteCategory}
        variant="destructive"
        isLoading={isProcessing}
      />
    </div>
  );
}

function CategoriesPageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-32 rounded-md" />
        ))}
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-10 w-[250px]" />
        <Skeleton className="h-10 w-[180px]" />
        <Skeleton className="h-10 w-[180px]" />
      </div>
      <Skeleton className="h-[400px] w-full" />
    </div>
  );
}
