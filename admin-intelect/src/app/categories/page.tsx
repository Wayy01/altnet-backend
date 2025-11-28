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
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  Eye,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckSquare,
  Power,
  PowerOff,
  Search,
  SlidersHorizontal,
  Package,
  Download,
  Layers,
  Pencil,
  Image as ImageIconLucide,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { Category, CategoryFilterOptions, UpdateCategoryPayload } from "@/types";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useLocalizedValue } from "@/contexts/language-context";

/**
 * Stat indicator item configuration
 */
interface StatIndicator {
  label: string;
  value: number | string;
  suffix?: string;
  icon?: React.ReactNode;
  variant?: "default" | "success" | "warning" | "muted";
}

/**
 * Active filter configuration for display chips
 */
interface ActiveFilter {
  key: string;
  label: string;
  value: string;
  displayValue: string;
}

/**
 * Sort configuration for column headers
 */
type SortField = "name" | "products";
type SortDirection = "asc" | "desc";

export default function CategoriesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { localize } = useLocalizedValue();

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

  // Pagination states
  const [pageSize, setPageSize] = useState<number>(parseInt(searchParams.get("limit") || "50", 10));
  const [jumpToPage, setJumpToPage] = useState<string>("");

  const limit = pageSize;
  const offset = initialOffset;
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAllMode, setSelectAllMode] = useState(false);

  // Animation state for staggered row reveals
  const [rowsVisible, setRowsVisible] = useState(false);

  // Dialogs
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);

  // Edit dialog state
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [editFormState, setEditFormState] = useState<{
    name: string;
    code: string;
    parent_id: string;
    sort_order: number;
    image_url: string;
    is_active: boolean;
  }>({
    name: "",
    code: "",
    parent_id: "",
    sort_order: 0,
    image_url: "",
    is_active: true,
  });
  const [isEditUploading, setIsEditUploading] = useState(false);

  // Parse current sort field and direction
  const currentSortField = useMemo((): SortField => {
    if (sortBy.startsWith("name")) return "name";
    if (sortBy.startsWith("products")) return "products";
    return "name";
  }, [sortBy]);

  const currentSortDirection = useMemo((): SortDirection => {
    return sortBy.endsWith("_desc") ? "desc" : "asc";
  }, [sortBy]);

  // Build filter object
  const currentFilters: CategoryFilterOptions = useMemo(() => ({
    search: debouncedSearch || undefined,
    has_products: hasProductsFilter || undefined,
    is_active: isActiveFilter || undefined,
    sort_by: sortBy || undefined,
  }), [debouncedSearch, hasProductsFilter, isActiveFilter, sortBy]);

  // Build active filters list for chip display
  const activeFilters = useMemo((): ActiveFilter[] => {
    const filters: ActiveFilter[] = [];

    if (debouncedSearch) {
      filters.push({
        key: "search",
        label: "Search",
        value: debouncedSearch,
        displayValue: `"${debouncedSearch}"`,
      });
    }

    if (hasProductsFilter) {
      filters.push({
        key: "has_products",
        label: "Products",
        value: hasProductsFilter,
        displayValue: hasProductsFilter === "true" ? "With Products" : "Without Products",
      });
    }

    if (isActiveFilter) {
      filters.push({
        key: "is_active",
        label: "Status",
        value: isActiveFilter,
        displayValue: isActiveFilter === "true" ? "Active" : "Inactive",
      });
    }

    if (sortBy && sortBy !== "name_asc") {
      const sortLabels: Record<string, string> = {
        name_desc: "Name Z-A",
        products_desc: "Most Products",
        products_asc: "Least Products",
      };
      filters.push({
        key: "sort_by",
        label: "Sort",
        value: sortBy,
        displayValue: sortLabels[sortBy] || sortBy,
      });
    }

    return filters;
  }, [debouncedSearch, hasProductsFilter, isActiveFilter, sortBy]);

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
      setRowsVisible(false);

      // Fetch categories with filters
      const result = await api.getCategories(limit, offset, currentFilters);
      setCategories(result.data);
      setTotal(result.total);

      // Calculate root categories count from current data
      const rootCategories = result.data.filter(cat => !cat.parent_id);
      setRootCount(rootCategories.length);

      setError(null);
      // Trigger staggered row animation after data loads
      setTimeout(() => setRowsVisible(true), 50);
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
  }, [offset, currentFilters, limit]);

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

  // Count active categories on current page
  const activeCategoriesOnPage = useMemo(() => {
    return categories.filter((c) => c.is_active).length;
  }, [categories]);

  // Total products across categories on current page
  const totalProductsOnPage = useMemo(() => {
    return categories.reduce((sum, c) => sum + (c.product_count || 0), 0);
  }, [categories]);

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

  const handleRemoveFilter = (filterKey: string) => {
    switch (filterKey) {
      case "search":
        handleClearSearch();
        break;
      case "has_products":
        setHasProductsFilter("");
        updateUrlParams({ has_products: null, offset: "0" });
        break;
      case "is_active":
        setIsActiveFilter("");
        updateUrlParams({ is_active: null, offset: "0" });
        break;
      case "sort_by":
        setSortBy("name_asc");
        updateUrlParams({ sort_by: null, offset: "0" });
        break;
    }
    // Clear selection when filter changes
    setSelectedIds(new Set());
    setSelectAllMode(false);
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

  // Column header sort handler
  const handleColumnSort = (field: SortField) => {
    let newSort = "";

    if (field === "name") {
      newSort = currentSortField === "name" && currentSortDirection === "asc" ? "name_desc" : "name_asc";
    } else if (field === "products") {
      newSort = currentSortField === "products" && currentSortDirection === "desc" ? "products_asc" : "products_desc";
    }

    if (newSort) {
      handleSortByChange(newSort);
    }
  };

  const handlePageChange = (newPage: number) => {
    const newOffset = (newPage - 1) * limit;
    if (!selectAllMode) {
      setSelectedIds(new Set());
    }
    updateUrlParams({ offset: newOffset.toString() });
  };

  const handlePageSizeChange = (newSize: string) => {
    const size = parseInt(newSize, 10);
    setPageSize(size);
    // Reset to first page when changing page size
    setSelectedIds(new Set());
    setSelectAllMode(false);
    updateUrlParams({ limit: newSize, offset: "0" });
  };

  const handleJumpToPage = () => {
    const pageNum = parseInt(jumpToPage, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      handlePageChange(pageNum);
      setJumpToPage("");
    }
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
      if (result.updated === 0) {
        toast.info("No categories were updated (may already be active)");
      } else {
        toast.success(`Successfully activated ${result.updated} ${result.updated === 1 ? "category" : "categories"}`);
      }
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
      if (result.updated === 0) {
        toast.info("No categories were updated (may already be inactive)");
      } else {
        toast.success(`Successfully deactivated ${result.updated} ${result.updated === 1 ? "category" : "categories"}`);
      }
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

  // Export handler
  const handleExport = async () => {
    try {
      setIsProcessing(true);
      const blob = await api.exportCategories(currentFilters);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `categories-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Categories exported successfully");
    } catch (error) {
      console.error("Failed to export categories:", error);
      toast.error("Failed to export categories");
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

  // Edit category handlers
  const handleOpenEditDialog = (category: Category) => {
    setEditCategory(category);
    setEditFormState({
      name: category.name || "",
      code: category.code || "",
      parent_id: category.parent_id || "",
      sort_order: category.sort_order || 0,
      image_url: category.image_url || "",
      is_active: category.is_active,
    });
    setShowEditDialog(true);
  };

  const handleEditFormChange = (field: string, value: string | boolean | number) => {
    setEditFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleEditImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsEditUploading(true);
    try {
      const response = await api.uploadImage(file);
      handleEditFormChange("image_url", response.url);
      toast.success("Image uploaded successfully");
    } catch (error) {
      toast.error("Failed to upload image");
    } finally {
      setIsEditUploading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editCategory) return;

    setIsProcessing(true);
    try {
      const payload: UpdateCategoryPayload = {
        name: editFormState.name.trim() || undefined,
        code: editFormState.code.trim() || null,
        parent_id: editFormState.parent_id || null,
        sort_order: editFormState.sort_order,
        image_url: editFormState.image_url || null,
        is_active: editFormState.is_active,
      };

      await api.updateCategory(editCategory.id, payload);
      toast.success(`Category "${editFormState.name}" updated successfully`);
      setShowEditDialog(false);
      setEditCategory(null);
      startTransition(() => {
        fetchCategories();
      });
    } catch (error) {
      console.error("Failed to update category:", error);
      toast.error("Failed to update category");
    } finally {
      setIsProcessing(false);
    }
  };

  // Build category options for parent selector (excluding current category)
  const buildParentCategoryOptions = (excludeId?: string) => {
    const eligibleCategories = categories.filter((c) => c.id !== excludeId);
    const rootCategories = eligibleCategories.filter((c) => !c.parent_id);
    const childCategories = eligibleCategories.filter((c) => c.parent_id);

    const options: { id: string; name: string; depth: number }[] = [];

    const addCategory = (category: Category, depth: number) => {
      options.push({ id: category.id, name: category.name, depth });
      const children = childCategories.filter((c) => c.parent_id === category.id);
      children.forEach((child) => addCategory(child, depth + 1));
    };

    rootCategories.forEach((cat) => addCategory(cat, 0));

    return options;
  };

  // Check if any filters are active
  const hasActiveFilters = activeFilters.length > 0;

  // Stats indicators configuration
  const statsIndicators: StatIndicator[] = [
    {
      label: "Total",
      value: (total ?? 0).toLocaleString(),
      suffix: hasActiveFilters ? "filtered" : undefined,
      variant: "default",
    },
    {
      label: "Root",
      value: rootCount,
      suffix: "on page",
      icon: <Layers className="h-3.5 w-3.5" />,
      variant: rootCount > 0 ? "success" : "muted",
    },
    {
      label: "Active",
      value: activeCategoriesOnPage,
      suffix: "on page",
      icon: <Power className="h-3.5 w-3.5" />,
      variant: activeCategoriesOnPage > 0 ? "success" : "warning",
    },
    {
      label: "Products",
      value: totalProductsOnPage.toLocaleString(),
      suffix: "on page",
      icon: <Package className="h-3.5 w-3.5" />,
      variant: "muted",
    },
  ];

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
        <div className="flex flex-col items-center justify-center py-12 rounded-xl border bg-card shadow-sm">
          <div className="p-4 rounded-full bg-muted/50 mb-4">
            <FolderTree className="h-10 w-10 text-muted-foreground/50" />
          </div>
          <p className="text-muted-foreground">{error}</p>
          <Button
            variant="outline"
            className="mt-4 transition-all duration-200 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
            onClick={() => window.location.reload()}
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
        <p className="text-muted-foreground">
          View and manage all categories in the catalog
        </p>
      </div>

      <div className="space-y-4">
        {/* Stats Bar - Enhanced with hover effects and better visual hierarchy */}
        <div className="flex flex-wrap items-center gap-3">
          {statsIndicators.map((stat, index) => (
            <div
              key={stat.label}
              className={`
                inline-flex items-center gap-2 px-3 py-2 rounded-lg border
                transition-all duration-200 ease-out
                hover:shadow-sm hover:border-border/80 hover:-translate-y-0.5
                ${stat.variant === "success" ? "bg-primary/5 border-primary/20 hover:bg-primary/10" : ""}
                ${stat.variant === "warning" ? "bg-destructive/5 border-destructive/20 hover:bg-destructive/10" : ""}
                ${stat.variant === "default" || stat.variant === "muted" ? "bg-muted/50" : ""}
              `}
              style={{
                animationDelay: `${index * 50}ms`,
              }}
            >
              {stat.icon && (
                <span className={`
                  ${stat.variant === "success" ? "text-primary" : ""}
                  ${stat.variant === "warning" ? "text-destructive" : ""}
                  ${stat.variant === "default" || stat.variant === "muted" ? "text-muted-foreground" : ""}
                `}>
                  {stat.icon}
                </span>
              )}
              <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
              <span className="text-sm font-semibold tabular-nums">{stat.value}</span>
              {stat.suffix && (
                <span className="text-[10px] text-muted-foreground">({stat.suffix})</span>
              )}
            </div>
          ))}

          {/* Export Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={isProcessing}
            className="ml-auto transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
          >
            <Download className="h-4 w-4 mr-1.5" />
            Export CSV
          </Button>
        </div>

        {/* Filters Row - Enhanced with card styling */}
        <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl border bg-card/50 shadow-sm">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              name="search"
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-[250px] pl-9 pr-8 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
            />
            {isSearching && (
              <Loader2 className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
            {searchQuery && !isSearching && (
              <button
                onClick={handleClearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted transition-colors"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>

          <div className="h-6 w-px bg-border" />

          {/* Product Count Filter */}
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <Select value={hasProductsFilter || "all"} onValueChange={handleHasProductsChange}>
              <SelectTrigger className="w-[180px] transition-all duration-200 hover:border-primary/50">
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
              <SelectTrigger className="w-[140px] transition-all duration-200 hover:border-primary/50">
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
          <Select value={sortBy} onValueChange={handleSortByChange}>
            <SelectTrigger className="w-[180px] transition-all duration-200 hover:border-primary/50">
              <ArrowUpDown className="h-4 w-4 mr-1 text-muted-foreground" />
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

        {/* Active Filter Chips */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 animate-in fade-in-0 slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <SlidersHorizontal className="h-4 w-4" />
              <span className="font-medium">{activeFilters.length} active filter{activeFilters.length !== 1 ? "s" : ""}:</span>
            </div>
            {activeFilters.map((filter, index) => (
              <Badge
                key={filter.key}
                variant="secondary"
                className="
                  pl-2.5 pr-1.5 py-1 gap-1.5
                  bg-primary/10 text-primary border-primary/20
                  hover:bg-primary/15 transition-all duration-200
                  animate-in fade-in-0 slide-in-from-left-2
                "
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <span className="text-xs font-normal text-primary/70">{filter.label}:</span>
                <span className="text-xs font-medium max-w-[150px] truncate">{filter.displayValue}</span>
                <button
                  onClick={() => handleRemoveFilter(filter.key)}
                  className="ml-0.5 p-0.5 rounded-full hover:bg-primary/20 transition-colors"
                  aria-label={`Remove ${filter.label} filter`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear all
            </Button>
          </div>
        )}

        {/* Bulk Actions Bar */}
        {isSomeSelected && (
          <div className="flex items-center gap-4 p-3 bg-primary/5 rounded-xl border border-primary/20 animate-in fade-in-0 slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-primary/10">
                <CheckSquare className="h-4 w-4 text-primary" />
              </div>
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
                className="text-primary p-0 h-auto"
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
                className="transition-all duration-200 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
              >
                <Power className="h-4 w-4 mr-1.5" />
                Activate
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkDeactivate}
                disabled={isProcessing || isPending}
                className="transition-all duration-200 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
              >
                <PowerOff className="h-4 w-4 mr-1.5" />
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

        {/* Categories Table - Enhanced with shadow and rounded corners */}
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={isAllOnPageSelected && filteredCategories.length > 0}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all"
                    className="transition-transform duration-200 hover:scale-110"
                  />
                </TableHead>
                <TableHead className="w-[60px]">Image</TableHead>
                <TableHead>
                  <button
                    onClick={() => handleColumnSort("name")}
                    className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors group"
                  >
                    Name
                    <span className={`transition-all duration-200 ${currentSortField === "name" ? "opacity-100" : "opacity-0 group-hover:opacity-50"}`}>
                      {currentSortField === "name" && currentSortDirection === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5" />
                      )}
                    </span>
                  </button>
                </TableHead>
                <TableHead>Parent</TableHead>
                <TableHead className="text-right">
                  <button
                    onClick={() => handleColumnSort("products")}
                    className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors group ml-auto"
                  >
                    Products
                    <span className={`transition-all duration-200 ${currentSortField === "products" ? "opacity-100" : "opacity-0 group-hover:opacity-50"}`}>
                      {currentSortField === "products" && currentSortDirection === "desc" ? (
                        <ArrowDown className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowUp className="h-3.5 w-3.5" />
                      )}
                    </span>
                  </button>
                </TableHead>
                <TableHead className="w-[80px]">Active</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCategories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-48">
                    <div className="flex flex-col items-center justify-center gap-3 py-8">
                      <div className="p-4 rounded-full bg-muted/50">
                        <FolderTree className="h-10 w-10 text-muted-foreground/50" />
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-foreground">No categories found</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {hasActiveFilters
                            ? "Try adjusting your filters to find what you're looking for"
                            : "Get started by adding your first category"
                          }
                        </p>
                      </div>
                      {hasActiveFilters && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleClearFilters}
                          className="mt-2 transition-all duration-200 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                        >
                          <X className="h-4 w-4 mr-1.5" />
                          Clear all filters
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredCategories.map((category, index) => (
                  <TableRow
                    key={category.id}
                    className={`
                      transition-all duration-200
                      ${selectedIds.has(category.id) || selectAllMode ? "bg-primary/5" : ""}
                      ${rowsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
                    `}
                    style={{
                      transitionDelay: rowsVisible ? `${Math.min(index * 20, 400)}ms` : "0ms",
                    }}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(category.id) || selectAllMode}
                        onCheckedChange={(checked) => handleSelectOne(category.id, checked as boolean)}
                        aria-label={`Select ${category.name}`}
                        className="transition-transform duration-200 hover:scale-110"
                      />
                    </TableCell>
                    <TableCell>
                      {category.image_url ? (
                        <img
                          src={category.image_url}
                          alt={category.name}
                          className="h-8 w-8 rounded object-cover transition-transform duration-200 hover:scale-110"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-muted transition-transform duration-200 hover:scale-110">
                          <FolderTree className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link
                        href={`/categories/${category.id}`}
                        className="hover:text-primary hover:underline underline-offset-4 transition-colors"
                      >
                        {localize(category, "name")}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {category.parent_name || (
                        <Badge variant="outline" className="font-normal">Root</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {(category.product_count || 0) > 0 ? (
                        <Badge
                          variant="default"
                          className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20 transition-colors"
                        >
                          {category.product_count || 0}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="font-normal text-muted-foreground">
                          0
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Switch
                          checked={category.is_active}
                          onCheckedChange={(checked) =>
                            handleToggleActive(category.id, checked)
                          }
                          disabled={isProcessing || isPending}
                          className="data-[state=checked]:bg-primary transition-all duration-200 hover:opacity-80"
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 transition-all duration-200 hover:bg-muted"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem asChild>
                            <Link href={`/categories/${category.id}`} className="cursor-pointer">
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleOpenEditDialog(category)}
                            className="cursor-pointer"
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/products?category_id=${category.id}`} className="cursor-pointer">
                              <ExternalLink className="mr-2 h-4 w-4" />
                              View Products
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() =>
                              handleToggleActive(category.id, !category.is_active)
                            }
                            className="cursor-pointer"
                          >
                            <Power className="mr-2 h-4 w-4" />
                            {category.is_active ? "Deactivate" : "Activate"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive cursor-pointer focus:text-destructive"
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

        {/* Enhanced Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <p>
              Showing <span className="font-medium text-foreground">{filteredCategories.length}</span> of{" "}
              <span className="font-medium text-foreground">{total}</span> categories
            </p>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                <SelectTrigger className="w-[70px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              {/* First Page */}
              <Button
                variant="outline"
                size="icon"
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
                className="h-8 w-8 transition-all duration-200 hover:bg-muted"
                title="First page"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>

              {/* Previous Page */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="transition-all duration-200 hover:bg-muted"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>

              {/* Page Info & Jump */}
              <div className="flex items-center gap-2 px-2">
                <span className="text-sm text-muted-foreground">Page</span>
                <Input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={jumpToPage}
                  onChange={(e) => setJumpToPage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleJumpToPage();
                    }
                  }}
                  onBlur={handleJumpToPage}
                  placeholder={currentPage.toString()}
                  className="w-14 h-8 text-center tabular-nums"
                />
                <span className="text-sm text-muted-foreground">of {totalPages}</span>
              </div>

              {/* Next Page */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="transition-all duration-200 hover:bg-muted"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>

              {/* Last Page */}
              <Button
                variant="outline"
                size="icon"
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
                className="h-8 w-8 transition-all duration-200 hover:bg-muted"
                title="Last page"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Edit Category Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>
              Update the category information below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Category Image */}
            <div className="space-y-2">
              <Label>Category Image</Label>
              <div className="flex items-start gap-4">
                {editFormState.image_url ? (
                  <div className="relative group">
                    <img
                      src={editFormState.image_url}
                      alt="Category image"
                      className="h-20 w-20 rounded-lg object-cover border shadow-sm"
                    />
                    <button
                      onClick={() => handleEditFormChange("image_url", "")}
                      className="absolute -top-2 -right-2 p-1 rounded-full bg-destructive text-destructive-foreground shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-20 w-20 rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 cursor-pointer transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleEditImageUpload}
                      className="hidden"
                      disabled={isEditUploading}
                    />
                    {isEditUploading ? (
                      <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
                    ) : (
                      <>
                        <ImageIconLucide className="h-5 w-5 text-muted-foreground mb-1" />
                        <span className="text-xs text-muted-foreground">Upload</span>
                      </>
                    )}
                  </label>
                )}
              </div>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="edit-name">
                Category Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-name"
                value={editFormState.name}
                onChange={(e) => handleEditFormChange("name", e.target.value)}
                placeholder="Enter category name"
              />
            </div>

            {/* Code */}
            <div className="space-y-2">
              <Label htmlFor="edit-code">Category Code</Label>
              <Input
                id="edit-code"
                value={editFormState.code}
                onChange={(e) => handleEditFormChange("code", e.target.value)}
                placeholder="e.g., ELEC, CLOTH"
                className="font-mono"
              />
            </div>

            {/* Parent Category */}
            <div className="space-y-2">
              <Label htmlFor="edit-parent">Parent Category</Label>
              <Select
                value={editFormState.parent_id || "none"}
                onValueChange={(value) => handleEditFormChange("parent_id", value === "none" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select parent category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No parent (Root category)</SelectItem>
                  {buildParentCategoryOptions(editCategory?.id).map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {"—".repeat(cat.depth)} {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sort Order */}
            <div className="space-y-2">
              <Label htmlFor="edit-sort">Sort Order</Label>
              <Input
                id="edit-sort"
                type="number"
                value={editFormState.sort_order}
                onChange={(e) => handleEditFormChange("sort_order", parseInt(e.target.value) || 0)}
                placeholder="0"
                className="w-32"
              />
            </div>

            {/* Image URL */}
            <div className="space-y-2">
              <Label htmlFor="edit-image-url">Image URL</Label>
              <Input
                id="edit-image-url"
                value={editFormState.image_url}
                onChange={(e) => handleEditFormChange("image_url", e.target.value)}
                placeholder="https://example.com/image.png"
              />
            </div>

            {/* Active Status */}
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <div>
                <Label htmlFor="edit-active" className="cursor-pointer">Active Status</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Active categories are visible in the catalog
                </p>
              </div>
              <Switch
                id="edit-active"
                checked={editFormState.is_active}
                onCheckedChange={(checked) => handleEditFormChange("is_active", checked)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={isProcessing || !editFormState.name.trim()}
            >
              {isProcessing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

/**
 * Enhanced skeleton loader with row-by-row loading animation
 * Provides better visual feedback during initial load
 */
function CategoriesPageSkeleton() {
  return (
    <div className="space-y-4">
      {/* Stats Skeleton */}
      <div className="flex flex-wrap items-center gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-10 w-32 rounded-lg"
            style={{ animationDelay: `${i * 100}ms` }}
          />
        ))}
        <Skeleton className="h-9 w-28 ml-auto rounded-md" />
      </div>

      {/* Filters Skeleton */}
      <div className="flex flex-wrap gap-3 p-4 rounded-xl border bg-card/50">
        <Skeleton className="h-10 w-[250px] rounded-md" />
        <Skeleton className="h-10 w-[180px] rounded-md" />
        <Skeleton className="h-10 w-[140px] rounded-md" />
        <Skeleton className="h-10 w-[180px] rounded-md" />
      </div>

      {/* Table Skeleton with row-by-row animation */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-4 p-4 bg-muted/30 border-b">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16 ml-auto" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-16" />
        </div>

        {/* Rows */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 p-4 border-b last:border-b-0 animate-pulse"
            style={{
              animationDelay: `${i * 50}ms`,
              opacity: 1 - (i * 0.05),
            }}
          >
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-12 ml-auto rounded-full" />
            <Skeleton className="h-5 w-9 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        ))}
      </div>

      {/* Pagination Skeleton */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-8 w-[70px] rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </div>
    </div>
  );
}
