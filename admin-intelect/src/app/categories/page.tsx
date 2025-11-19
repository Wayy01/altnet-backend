"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FolderTree,
  Search,
  MoreHorizontal,
  Trash2,
  ExternalLink,
  X,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  // Get initial values from URL params
  const initialSearch = searchParams.get("search") || "";
  const initialHasProducts = searchParams.get("has_products") || "all";
  const initialSortBy = searchParams.get("sort_by") || "name_asc";
  const initialIsActive = searchParams.get("is_active") || "all";
  const initialPage = parseInt(searchParams.get("page") || "1", 10);

  // State
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [rootCount, setRootCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [hasProducts, setHasProducts] = useState(initialHasProducts);
  const [sortBy, setSortBy] = useState(initialSortBy);
  const [isActive, setIsActive] = useState(initialIsActive);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const pageSize = 50;

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAllMatching, setSelectAllMatching] = useState(false);

  // Dialogs
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);

  // Build filter object (convert "all" to undefined for API)
  const filters: CategoryFilterOptions = useMemo(() => ({
    search: searchQuery || undefined,
    has_products: hasProducts && hasProducts !== "all" ? hasProducts : undefined,
    is_active: isActive && isActive !== "all" ? isActive : undefined,
    sort_by: sortBy || undefined,
  }), [searchQuery, hasProducts, isActive, sortBy]);

  // Update URL with current filters (don't include "all" values)
  const updateURL = useCallback(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    if (hasProducts && hasProducts !== "all") params.set("has_products", hasProducts);
    if (sortBy && sortBy !== "name_asc") params.set("sort_by", sortBy);
    if (isActive && isActive !== "all") params.set("is_active", isActive);
    if (currentPage > 1) params.set("page", currentPage.toString());

    const newURL = params.toString() ? `?${params.toString()}` : "/categories";
    router.push(newURL, { scroll: false });
  }, [searchQuery, hasProducts, sortBy, isActive, currentPage, router]);

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      setIsLoading(true);
      const offset = (currentPage - 1) * pageSize;

      // Fetch categories with filters
      const result = await api.getCategories(pageSize, offset, filters);
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
    }
  }, [currentPage, filters, pageSize]);

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchCategories();
    updateURL();
  }, [fetchCategories, updateURL]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle search input
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setSelectedIds(new Set());
    setSelectAllMatching(false);
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery("");
    setHasProducts("all");
    setSortBy("name_asc");
    setIsActive("all");
    setCurrentPage(1);
    setSelectedIds(new Set());
    setSelectAllMatching(false);
  };

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(categories.map((c) => c.id)));
    } else {
      setSelectedIds(new Set());
      setSelectAllMatching(false);
    }
  };

  const handleSelectCategory = (id: string, checked: boolean) => {
    const newSelection = new Set(selectedIds);
    if (checked) {
      newSelection.add(id);
    } else {
      newSelection.delete(id);
      setSelectAllMatching(false);
    }
    setSelectedIds(newSelection);
  };

  const handleSelectAllMatching = () => {
    setSelectAllMatching(true);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectAllMatching(false);
  };

  // Toggle active status
  const handleToggleActive = async (categoryId: string, isActive: boolean) => {
    setIsProcessing(true);
    try {
      await api.updateCategory(categoryId, { is_active: isActive });
      toast.success(`Category ${isActive ? "activated" : "deactivated"}`);
      fetchCategories();
    } catch (error) {
      console.error("Failed to update category:", error);
      toast.error("Failed to update category status");
    } finally {
      setIsProcessing(false);
    }
  };

  // Bulk update
  const handleBulkUpdate = async (activate: boolean) => {
    setIsProcessing(true);
    try {
      let result;

      if (selectAllMatching) {
        // Update all matching categories by filter
        result = await api.bulkUpdateCategoriesByFilter({
          filter: {
            search: searchQuery || undefined,
            has_products: hasProducts || undefined,
            is_active: isActive || undefined,
          },
          is_active: activate,
        });
      } else {
        // Update selected categories by IDs
        result = await api.bulkUpdateCategories({
          ids: Array.from(selectedIds),
          is_active: activate,
        });
      }

      const action = activate ? "activated" : "deactivated";
      toast.success(`Successfully ${action} ${result.updated} categories`);
      clearSelection();
      fetchCategories();
    } catch (error) {
      console.error("Failed to bulk update categories:", error);
      toast.error("Failed to update categories");
    } finally {
      setIsProcessing(false);
    }
  };

  // Delete category
  const handleDeleteClick = (categoryId: string) => {
    setDeleteCategoryId(categoryId);
    setShowDeleteDialog(true);
  };

  const handleDeleteCategory = async () => {
    if (!deleteCategoryId) return;

    setIsProcessing(true);
    try {
      await api.deleteCategory(deleteCategoryId);
      toast.success("Category deleted successfully");
      setShowDeleteDialog(false);
      setDeleteCategoryId(null);
      fetchCategories();
    } catch (error) {
      console.error("Failed to delete category:", error);
      toast.error("Failed to delete category");
    } finally {
      setIsProcessing(false);
    }
  };

  // Pagination
  const totalPages = Math.ceil(total / pageSize);
  const hasActiveFilters = searchQuery || (hasProducts && hasProducts !== "all") || (isActive && isActive !== "all") || sortBy !== "name_asc";

  // Selection count
  const selectionCount = selectAllMatching ? total : selectedIds.size;
  const allOnPageSelected = categories.length > 0 && categories.every((c) => selectedIds.has(c.id));

  if (isLoading && categories.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
          <p className="text-muted-foreground">
            Manage product categories with search, filters, and bulk actions
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
            Manage product categories with search, filters, and bulk actions
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
          Manage product categories with search, filters, and bulk actions
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Root Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rootCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Displayed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{categories.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Search categories..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="pl-10"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              {/* Product Count Filter */}
              <Select value={hasProducts} onValueChange={(v) => { setHasProducts(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Products" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="true">With Products</SelectItem>
                  <SelectItem value="false">No Products</SelectItem>
                </SelectContent>
              </Select>

              {/* Active Status Filter */}
              <Select value={isActive} onValueChange={(v) => { setIsActive(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>

              {/* Sort By */}
              <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name_asc">Name A-Z</SelectItem>
                  <SelectItem value="name_desc">Name Z-A</SelectItem>
                  <SelectItem value="products_desc">Most Products</SelectItem>
                  <SelectItem value="products_asc">Least Products</SelectItem>
                </SelectContent>
              </Select>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="mr-1 h-4 w-4" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selection Banner */}
      {selectionCount > 0 && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="flex items-center justify-between py-3">
            <div className="flex items-center gap-4">
              <span className="font-medium">
                {selectAllMatching
                  ? `All ${total} matching categories selected`
                  : `${selectionCount} ${selectionCount === 1 ? "category" : "categories"} selected`}
              </span>
              {!selectAllMatching && allOnPageSelected && total > categories.length && (
                <Button variant="link" size="sm" onClick={handleSelectAllMatching} className="p-0">
                  Select all {total} matching categories
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                Clear selection
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="default"
                onClick={() => handleBulkUpdate(true)}
                disabled={isProcessing}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle2 className="mr-1 h-4 w-4" />
                Activate
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleBulkUpdate(false)}
                disabled={isProcessing}
              >
                <XCircle className="mr-1 h-4 w-4" />
                Deactivate
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Categories Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={allOnPageSelected && categories.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead className="w-12">Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Parent</TableHead>
                <TableHead className="text-center">Products</TableHead>
                <TableHead className="text-center">Active</TableHead>
                <TableHead className="w-12">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <FolderTree className="h-8 w-8 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {hasActiveFilters ? "No categories match your filters" : "No categories found"}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(category.id)}
                        onCheckedChange={(checked) =>
                          handleSelectCategory(category.id, checked as boolean)
                        }
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
                    <TableCell>
                      <Link
                        href={`/categories/${category.id}`}
                        className="font-medium hover:underline"
                      >
                        {category.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {category.parent_name ? (
                        <span className="text-muted-foreground">{category.parent_name}</span>
                      ) : (
                        <Badge variant="outline">Root</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{category.product_count}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={category.is_active}
                        onCheckedChange={(checked) =>
                          handleToggleActive(category.id, checked)
                        }
                        disabled={isProcessing}
                      />
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/categories/${category.id}`}>
                              <FolderTree className="mr-2 h-4 w-4" />
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
                            onClick={() => handleDeleteClick(category.id)}
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
        </CardContent>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <div className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages} ({total} categories)
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

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
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <div className="space-y-2 p-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
