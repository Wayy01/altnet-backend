"use client";

import { useState, useEffect, useCallback, useTransition, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Package,
  Trash2,
  MoreHorizontal,
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
  X,
  Power,
  PowerOff,
  Download,
  DollarSign,
  PackageOpen,
  Tag,
  FolderTree,
  Search,
  SlidersHorizontal,
  GitBranch,
  Layers,
  Pencil,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { PriceDisplay } from "@/components/ui/price-display";
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
import { Product, Brand, Category, ProductFilters, ProductSource } from "@/types";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useLocalizedValue, useTranslation } from "@/contexts/language-context";

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
type SortField = "name" | "code" | "brand" | "category" | "price" | "stock";
type SortDirection = "asc" | "desc";

export default function ProductsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const { localize } = useLocalizedValue();
  const { t } = useTranslation("products");
  const { t: tCommon } = useTranslation("common");

  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get("search") || "");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Filter states
  const [brandFilter, setBrandFilter] = useState<string>(searchParams.get("brand_id") || "");
  const [categoryFilter, setCategoryFilter] = useState<string>(searchParams.get("category_id") || "");
  const [sourceFilter, setSourceFilter] = useState<string>(searchParams.get("source_id") || "");
  const [priceFilter, setPriceFilter] = useState<string>(searchParams.get("price_filter") || "");
  const [stockFilter, setStockFilter] = useState<string>(searchParams.get("stock_filter") || "");
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get("status_filter") || "");
  const [sortBy, setSortBy] = useState<string>(searchParams.get("sort_by") || "name_asc");

  // Pagination states
  const [pageSize, setPageSize] = useState<number>(parseInt(searchParams.get("limit") || "50", 10));
  const [jumpToPage, setJumpToPage] = useState<string>("");

  // Selection states
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAllMode, setSelectAllMode] = useState<boolean>(false);

  // Load all brands, categories, and sources for dropdowns
  const [allBrands, setAllBrands] = useState<Brand[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [allSources, setAllSources] = useState<ProductSource[]>([]);
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);

  // Animation state for staggered row reveals
  const [rowsVisible, setRowsVisible] = useState(false);

  const limit = pageSize;
  const offset = parseInt(searchParams.get("offset") || "0", 10);
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  // Parse current sort field and direction
  const currentSortField = useMemo((): SortField => {
    if (sortBy.startsWith("name")) return "name";
    if (sortBy.startsWith("price")) return "price";
    if (sortBy.startsWith("stock")) return "stock";
    return "name";
  }, [sortBy]);

  const currentSortDirection = useMemo((): SortDirection => {
    return sortBy.endsWith("_desc") || sortBy === "price_high" || sortBy === "stock_high" ? "desc" : "asc";
  }, [sortBy]);

  // Build current filter object
  const currentFilters: ProductFilters = useMemo(() => ({
    search: debouncedSearch || undefined,
    brand_id: brandFilter || undefined,
    category_id: categoryFilter || undefined,
    source_id: sourceFilter || undefined,
    price_filter: priceFilter || undefined,
    stock_filter: stockFilter || undefined,
    status_filter: statusFilter || undefined,
    sort_by: sortBy || undefined,
  }), [debouncedSearch, brandFilter, categoryFilter, sourceFilter, priceFilter, stockFilter, statusFilter, sortBy]);

  // Load all brands, categories, and sources for filter dropdowns
  useEffect(() => {
    async function loadFilters() {
      try {
        setIsLoadingFilters(true);
        const [brandsData, categoriesData, sourcesData] = await Promise.all([
          api.getAllBrands(),
          api.getAllCategories(),
          api.getSources(),
        ]);
        setAllBrands(brandsData);
        setAllCategories(categoriesData);
        setAllSources(sourcesData);
      } catch (err) {
        console.error("Failed to load filter options:", err);
      } finally {
        setIsLoadingFilters(false);
      }
    }
    loadFilters();
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      setIsLoading(true);
      setRowsVisible(false);
      const productsData = await api.getProducts(currentFilters, limit, offset);
      setProducts(productsData.data);
      setTotal(productsData.total);
      setError(null);
      // Trigger staggered row animation after data loads
      setTimeout(() => setRowsVisible(true), 50);
    } catch (err) {
      console.error("Failed to fetch products:", err);
      setError("Failed to load products. Make sure the Go backend API is running.");
    } finally {
      setIsLoading(false);
      setIsSearching(false);
      // Refocus search input after fetch completes
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }
  }, [offset, currentFilters, limit]);

  // Initial fetch and fetch when filters change
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

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
    router.push(`/products?${newParams.toString()}`);
  };

  // Products are now fetched from server with filters applied
  const filteredProducts = products;

  // Count products with prices and in stock in current view
  const productsWithPrices = useMemo(() => {
    return products.filter((p) => p.price_mdl !== null || p.price_eur !== null || p.price_usd !== null).length;
  }, [products]);

  const productsInStock = useMemo(() => {
    return products.filter((p) => p.is_in_stock).length;
  }, [products]);

  // Build active filters list for chip display
  const activeFilters = useMemo((): ActiveFilter[] => {
    const filters: ActiveFilter[] = [];

    if (debouncedSearch) {
      filters.push({
        key: "search",
        label: tCommon("actions.search"),
        value: debouncedSearch,
        displayValue: `"${debouncedSearch}"`,
      });
    }

    if (brandFilter) {
      const brand = allBrands.find(b => b.id === brandFilter);
      filters.push({
        key: "brand_id",
        label: t("table.brand"),
        value: brandFilter,
        displayValue: brand?.name || brandFilter,
      });
    }

    if (categoryFilter) {
      const category = allCategories.find(c => c.id === categoryFilter);
      filters.push({
        key: "category_id",
        label: t("table.category"),
        value: categoryFilter,
        displayValue: category?.name || categoryFilter,
      });
    }

    if (sourceFilter) {
      const source = allSources.find(s => s.id === sourceFilter);
      filters.push({
        key: "source_id",
        label: t("table.source"),
        value: sourceFilter,
        displayValue: source?.name || sourceFilter,
      });
    }

    if (priceFilter) {
      filters.push({
        key: "price_filter",
        label: t("filters.price"),
        value: priceFilter,
        displayValue: priceFilter === "with_price" ? t("filters.withPrice") : t("filters.noPrice"),
      });
    }

    if (stockFilter) {
      filters.push({
        key: "stock_filter",
        label: t("filters.stock"),
        value: stockFilter,
        displayValue: stockFilter === "in_stock" ? t("filters.inStock") : t("filters.outOfStock"),
      });
    }

    if (statusFilter) {
      filters.push({
        key: "status_filter",
        label: t("filters.status"),
        value: statusFilter,
        displayValue: statusFilter === "active" ? t("filters.active") : t("filters.inactive"),
      });
    }

    if (sortBy && sortBy !== "name_asc") {
      const sortLabels: Record<string, string> = {
        name_desc: t("filters.nameZA"),
        price_high: t("filters.highestPrice"),
        price_low: t("filters.lowestPrice"),
        stock_high: t("filters.mostStock"),
        stock_low: t("filters.leastStock"),
      };
      filters.push({
        key: "sort_by",
        label: t("filters.sortBy"),
        value: sortBy,
        displayValue: sortLabels[sortBy] || sortBy,
      });
    }

    return filters;
  }, [debouncedSearch, brandFilter, categoryFilter, sourceFilter, priceFilter, stockFilter, statusFilter, sortBy, allBrands, allCategories, allSources, t, tCommon]);

  const handleClearSearch = () => {
    setSearchQuery("");
    setDebouncedSearch("");
    updateUrlParams({ search: null, offset: "0" });
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setDebouncedSearch("");
    setBrandFilter("");
    setCategoryFilter("");
    setSourceFilter("");
    setPriceFilter("");
    setStockFilter("");
    setStatusFilter("");
    setSortBy("name_asc");
    router.push("/products");
  };

  const handleRemoveFilter = (filterKey: string) => {
    switch (filterKey) {
      case "search":
        handleClearSearch();
        break;
      case "brand_id":
        setBrandFilter("");
        updateUrlParams({ brand_id: null, offset: "0" });
        break;
      case "category_id":
        setCategoryFilter("");
        updateUrlParams({ category_id: null, offset: "0" });
        break;
      case "source_id":
        setSourceFilter("");
        updateUrlParams({ source_id: null, offset: "0" });
        break;
      case "price_filter":
        setPriceFilter("");
        updateUrlParams({ price_filter: null, offset: "0" });
        break;
      case "stock_filter":
        setStockFilter("");
        updateUrlParams({ stock_filter: null, offset: "0" });
        break;
      case "status_filter":
        setStatusFilter("");
        updateUrlParams({ status_filter: null, offset: "0" });
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

  const handleBrandChange = (value: string) => {
    const filterValue = value === "all" ? "" : value;
    setBrandFilter(filterValue);
    // Clear selection when filter changes
    setSelectedIds(new Set());
    setSelectAllMode(false);
    updateUrlParams({ brand_id: filterValue || null, offset: "0" });
  };

  const handleCategoryChange = (value: string) => {
    const filterValue = value === "all" ? "" : value;
    setCategoryFilter(filterValue);
    // Clear selection when filter changes
    setSelectedIds(new Set());
    setSelectAllMode(false);
    updateUrlParams({ category_id: filterValue || null, offset: "0" });
  };

  const handleSourceChange = (value: string) => {
    const filterValue = value === "all" ? "" : value;
    setSourceFilter(filterValue);
    // Clear selection when filter changes
    setSelectedIds(new Set());
    setSelectAllMode(false);
    updateUrlParams({ source_id: filterValue || null, offset: "0" });
  };

  const handlePriceFilterChange = (value: string) => {
    const filterValue = value === "all" ? "" : value;
    setPriceFilter(filterValue);
    // Clear selection when filter changes
    setSelectedIds(new Set());
    setSelectAllMode(false);
    updateUrlParams({ price_filter: filterValue || null, offset: "0" });
  };

  const handleStockFilterChange = (value: string) => {
    const filterValue = value === "all" ? "" : value;
    setStockFilter(filterValue);
    // Clear selection when filter changes
    setSelectedIds(new Set());
    setSelectAllMode(false);
    updateUrlParams({ stock_filter: filterValue || null, offset: "0" });
  };

  const handleStatusFilterChange = (value: string) => {
    const filterValue = value === "all" ? "" : value;
    setStatusFilter(filterValue);
    // Clear selection when filter changes
    setSelectedIds(new Set());
    setSelectAllMode(false);
    updateUrlParams({ status_filter: filterValue || null, offset: "0" });
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
    } else if (field === "price") {
      newSort = currentSortField === "price" && currentSortDirection === "desc" ? "price_low" : "price_high";
    } else if (field === "stock") {
      newSort = currentSortField === "stock" && currentSortDirection === "desc" ? "stock_low" : "stock_high";
    }

    if (newSort) {
      handleSortByChange(newSort);
    }
  };

  const handlePageChange = (newPage: number) => {
    const newOffset = (newPage - 1) * limit;
    // Clear page-level selection when changing pages (unless selectAllMode)
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

  const handleToggleActive = async (productId: string, isActive: boolean) => {
    setIsProcessing(true);
    try {
      await api.updateProduct(productId, { is_active: isActive });
      toast.success(isActive ? t("toast.activated") : t("toast.deactivated"));
      startTransition(() => {
        fetchProducts();
      });
    } catch (error) {
      console.error("Failed to update product:", error);
      toast.error(t("toast.updateFailed"));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!deleteProductId) return;

    setIsProcessing(true);
    try {
      await api.deleteProduct(deleteProductId);
      toast.success(t("toast.deleted"));
      setShowDeleteDialog(false);
      setDeleteProductId(null);
      startTransition(() => {
        fetchProducts();
      });
    } catch (error) {
      console.error("Failed to delete product:", error);
      toast.error(t("toast.deleteFailed"));
    } finally {
      setIsProcessing(false);
    }
  };

  // Selection handlers
  const handleSelectAll = () => {
    if (selectedIds.size === filteredProducts.length && !selectAllMode) {
      // All on page selected, clear all
      setSelectedIds(new Set());
      setSelectAllMode(false);
    } else {
      // Select all on current page
      const newSelected = new Set(filteredProducts.map(p => p.id));
      setSelectedIds(newSelected);
      setSelectAllMode(false);
    }
  };

  const handleSelectAllMatching = () => {
    setSelectAllMode(true);
    // Keep current page selection but mark that we want all matching
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
    setSelectAllMode(false);
  };

  const handleSelectOne = (productId: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(productId);
    } else {
      newSelected.delete(productId);
      // If we were in selectAllMode and user deselects one, exit selectAllMode
      if (selectAllMode) {
        setSelectAllMode(false);
      }
    }
    setSelectedIds(newSelected);
  };

  const isAllOnPageSelected = filteredProducts.length > 0 && filteredProducts.every(p => selectedIds.has(p.id));
  const isSomeSelected = selectedIds.size > 0 || selectAllMode;

  // Bulk action handlers
  const handleBulkActivate = async () => {
    setIsProcessing(true);
    try {
      let result;
      if (selectAllMode) {
        // Update all matching products using filter
        result = await api.bulkUpdateProducts({
          filter: {
            search: debouncedSearch || undefined,
            brand_id: brandFilter || undefined,
            category_id: categoryFilter || undefined,
            price_filter: priceFilter || undefined,
            stock_filter: stockFilter || undefined,
            status_filter: statusFilter || undefined,
          },
          is_active: true,
        });
      } else {
        // Update selected IDs
        result = await api.bulkUpdateProducts({
          ids: Array.from(selectedIds),
          is_active: true,
        });
      }
      if (result.updated === 0) {
        toast.info(t("toast.noProductsUpdated"));
      } else {
        toast.success(result.updated === 1
          ? t("toast.bulkActivated", { count: result.updated })
          : t("toast.bulkActivatedPlural", { count: result.updated }));
      }
      handleClearSelection();
      startTransition(() => {
        fetchProducts();
      });
    } catch (error) {
      console.error("Failed to bulk activate products:", error);
      toast.error(t("toast.updateFailed"));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkDeactivate = async () => {
    setIsProcessing(true);
    try {
      let result;
      if (selectAllMode) {
        // Update all matching products using filter
        result = await api.bulkUpdateProducts({
          filter: {
            search: debouncedSearch || undefined,
            brand_id: brandFilter || undefined,
            category_id: categoryFilter || undefined,
            price_filter: priceFilter || undefined,
            stock_filter: stockFilter || undefined,
            status_filter: statusFilter || undefined,
          },
          is_active: false,
        });
      } else {
        // Update selected IDs
        result = await api.bulkUpdateProducts({
          ids: Array.from(selectedIds),
          is_active: false,
        });
      }
      if (result.updated === 0) {
        toast.info(t("toast.noProductsUpdated"));
      } else {
        toast.success(result.updated === 1
          ? t("toast.bulkDeactivated", { count: result.updated })
          : t("toast.bulkDeactivatedPlural", { count: result.updated }));
      }
      handleClearSelection();
      startTransition(() => {
        fetchProducts();
      });
    } catch (error) {
      console.error("Failed to bulk deactivate products:", error);
      toast.error(t("toast.updateFailed"));
    } finally {
      setIsProcessing(false);
    }
  };

  // Export handler
  const handleExport = async () => {
    try {
      setIsProcessing(true);
      const blob = await api.exportProducts(currentFilters);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `products-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(t("toast.exportSuccess"));
    } catch (error) {
      console.error("Failed to export products:", error);
      toast.error(t("toast.exportFailed"));
    } finally {
      setIsProcessing(false);
    }
  };

  // Check if any filters are active
  const hasActiveFilters = activeFilters.length > 0;

  // Stats indicators configuration
  const statsIndicators: StatIndicator[] = [
    {
      label: t("stats.total"),
      value: (total ?? 0).toLocaleString(),
      suffix: hasActiveFilters ? t("stats.filtered") : undefined,
      variant: "default",
    },
    {
      label: t("stats.withPrices"),
      value: productsWithPrices,
      suffix: t("stats.onPage"),
      icon: <DollarSign className="h-3.5 w-3.5" />,
      variant: productsWithPrices > 0 ? "success" : "muted",
    },
    {
      label: t("stats.inStock"),
      value: productsInStock,
      suffix: t("stats.onPage"),
      icon: <PackageOpen className="h-3.5 w-3.5" />,
      variant: productsInStock > 0 ? "success" : "warning",
    },
    {
      label: t("stats.showing"),
      value: filteredProducts.length,
      suffix: `of ${total}`,
      variant: "muted",
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("page.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              {t("page.description")}
            </p>
          </div>
        </div>
        <ProductsPageSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("page.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              {t("page.description")}
            </p>
          </div>
        </div>
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="p-4 rounded-full bg-destructive/10 mb-4">
              <Package className="h-10 w-10 text-destructive" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">{tCommon("errors.somethingWentWrong")}</p>
            <p className="text-xs text-muted-foreground text-center mb-4">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
              className="transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
            >
              {tCommon("actions.tryAgain")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Page Header - Compact style matching dashboard */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("page.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            {t("page.description")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={isProcessing}
            className="transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
          >
            <Download className="h-4 w-4 mr-1.5" />
            {t("actions.exportCSV")}
          </Button>
          <Button
            size="sm"
            asChild
            className="transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
          >
            <Link href="/products/new">
              <Package className="h-4 w-4 mr-1.5" />
              {t("page.newProduct")}
            </Link>
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Stats Bar */}
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
        </div>

        {/* Filters Section - Organized Grid Layout */}
        <div
          className={`
            rounded-xl border bg-card shadow-sm overflow-hidden
            transition-all duration-300
            ${rowsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
          `}
          style={{ transitionDelay: rowsVisible ? "200ms" : "0ms" }}
        >
          <div className="p-4 border-b">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-muted">
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-sm">{t("filters.searchProducts")}</h3>
            </div>
          </div>
          <div className="p-5 space-y-4">
            {/* Search Bar - Full Width */}
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                name="search"
                placeholder={t("filters.searchProducts")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 transition-all duration-200 focus:ring-2 focus:ring-primary/20 hover:border-primary/30"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
              {searchQuery && !isSearching && (
                <button
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted transition-all duration-200"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>

            {/* Primary Filters - Catalog Organization */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t("filters.catalogFilters")}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Brand Filter */}
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Select value={brandFilter || "all"} onValueChange={handleBrandChange} disabled={isLoadingFilters}>
                    <SelectTrigger className="w-full transition-all duration-200 hover:border-primary/30">
                      <SelectValue placeholder={t("table.brand")} />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      <SelectItem value="all">{t("filters.allBrands")}</SelectItem>
                      {allBrands.map(brand => (
                        <SelectItem key={brand.id} value={brand.id}>
                          {brand.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Category Filter */}
                <div className="flex items-center gap-2">
                  <FolderTree className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Select value={categoryFilter || "all"} onValueChange={handleCategoryChange} disabled={isLoadingFilters}>
                    <SelectTrigger className="w-full transition-all duration-200 hover:border-primary/30">
                      <SelectValue placeholder={t("table.category")} />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      <SelectItem value="all">{t("filters.allCategories")}</SelectItem>
                      {allCategories.map(category => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Source Filter */}
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Select value={sourceFilter || "all"} onValueChange={handleSourceChange} disabled={isLoadingFilters}>
                    <SelectTrigger className="w-full transition-all duration-200 hover:border-primary/30">
                      <SelectValue placeholder={t("table.source")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("filters.allSources")}</SelectItem>
                      {allSources.map(source => (
                        <SelectItem key={source.id} value={source.id}>
                          {source.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Secondary Filters - Attributes & Sorting */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t("filters.attributesSorting")}
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Price Filter */}
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Select value={priceFilter || "all"} onValueChange={handlePriceFilterChange}>
                    <SelectTrigger className="w-full transition-all duration-200 hover:border-primary/30">
                      <SelectValue placeholder={t("filters.price")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{tCommon("filters.all")}</SelectItem>
                      <SelectItem value="with_price">{t("filters.withPrice")}</SelectItem>
                      <SelectItem value="no_price">{t("filters.noPrice")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Stock Filter */}
                <div className="flex items-center gap-2">
                  <PackageOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Select value={stockFilter || "all"} onValueChange={handleStockFilterChange}>
                    <SelectTrigger className="w-full transition-all duration-200 hover:border-primary/30">
                      <SelectValue placeholder={t("filters.stock")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{tCommon("filters.all")}</SelectItem>
                      <SelectItem value="in_stock">{t("filters.inStock")}</SelectItem>
                      <SelectItem value="out_stock">{t("filters.outOfStock")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Status Filter */}
                <div className="flex items-center gap-2">
                  <Power className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Select value={statusFilter || "all"} onValueChange={handleStatusFilterChange}>
                    <SelectTrigger className="w-full transition-all duration-200 hover:border-primary/30">
                      <SelectValue placeholder={t("filters.status")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{tCommon("filters.all")}</SelectItem>
                      <SelectItem value="active">{t("filters.active")}</SelectItem>
                      <SelectItem value="inactive">{t("filters.inactive")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Sort By */}
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Select value={sortBy} onValueChange={handleSortByChange}>
                    <SelectTrigger className="w-full transition-all duration-200 hover:border-primary/30">
                      <SelectValue placeholder={t("filters.sortBy")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name_asc">{t("filters.nameAZ")}</SelectItem>
                      <SelectItem value="name_desc">{t("filters.nameZA")}</SelectItem>
                      <SelectItem value="price_high">{t("filters.highestPrice")}</SelectItem>
                      <SelectItem value="price_low">{t("filters.lowestPrice")}</SelectItem>
                      <SelectItem value="stock_high">{t("filters.mostStock")}</SelectItem>
                      <SelectItem value="stock_low">{t("filters.leastStock")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Active Filter Chips - Enhanced styling */}
        {hasActiveFilters && (
          <div
            className={`
              rounded-xl border bg-card/50 shadow-sm p-3
              transition-all duration-300
              ${rowsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
            `}
            style={{ transitionDelay: rowsVisible ? "250ms" : "0ms" }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="p-1 rounded bg-muted">
                  <SlidersHorizontal className="h-3 w-3" />
                </div>
                <span className="font-medium">{activeFilters.length} {activeFilters.length === 1 ? t("filters.activeFilter") : t("filters.activeFilters")}</span>
              </div>
              {activeFilters.map((filter, index) => (
                <Badge
                  key={filter.key}
                  variant="secondary"
                  className="
                    pl-2.5 pr-1.5 py-1 gap-1.5
                    bg-primary/10 text-primary border-primary/20
                    hover:bg-primary/15 hover:border-primary/30 transition-all duration-200
                    animate-in fade-in-0 slide-in-from-left-2
                  "
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <span className="text-xs font-normal text-primary/70">{filter.label}:</span>
                  <span className="text-xs font-medium max-w-[150px] truncate">{filter.displayValue}</span>
                  <button
                    onClick={() => handleRemoveFilter(filter.key)}
                    className="ml-0.5 p-0.5 rounded-full hover:bg-primary/20 transition-all duration-200"
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
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200"
              >
                {tCommon("actions.clearAll")}
              </Button>
            </div>
          </div>
        )}

        {/* Bulk Actions Bar - Premium styling */}
        {isSomeSelected && (
          <div
            className="
              rounded-xl border shadow-sm p-4 overflow-hidden
              bg-gradient-to-br from-primary/5 via-primary/3 to-transparent border-primary/20
              animate-in fade-in-0 slide-in-from-top-2 duration-300
            "
          >
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <CheckSquare className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm font-medium text-foreground">
                  {selectAllMode
                    ? t("bulk.allMatching", { count: total })
                    : selectedIds.size === 1
                      ? t("bulk.selected", { count: selectedIds.size })
                      : t("bulk.selectedPlural", { count: selectedIds.size })
                  }
                </span>
              </div>

              {isAllOnPageSelected && !selectAllMode && total > filteredProducts.length && (
                <Button
                  variant="link"
                  size="sm"
                  className="text-primary p-0 h-auto hover:underline transition-all duration-200"
                  onClick={handleSelectAllMatching}
                >
                  {t("bulk.selectAllMatching", { count: total })}
                </Button>
              )}

              <div className="flex items-center gap-2 ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkActivate}
                  disabled={isProcessing || isPending}
                  className="transition-all duration-200 hover:shadow-sm hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                >
                  <Power className="h-4 w-4 mr-1.5" />
                  {t("actions.activate")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkDeactivate}
                  disabled={isProcessing || isPending}
                  className="transition-all duration-200 hover:shadow-sm hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                >
                  <PowerOff className="h-4 w-4 mr-1.5" />
                  {t("actions.deactivate")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearSelection}
                  disabled={isProcessing || isPending}
                  className="transition-all duration-200 hover:bg-muted/50"
                >
                  <X className="h-4 w-4 mr-1" />
                  {tCommon("actions.clear")}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Products Table - Premium styling matching dashboard */}
        <div
          className={`
            rounded-xl border bg-card shadow-sm overflow-hidden
            transition-all duration-300
            ${rowsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
          `}
          style={{ transitionDelay: rowsVisible ? "300ms" : "0ms" }}
        >
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30 border-b">
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={isAllOnPageSelected && filteredProducts.length > 0}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all"
                    className="transition-transform duration-200 hover:scale-110"
                  />
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleColumnSort("name")}
                    className="inline-flex items-center gap-1.5 font-semibold text-xs hover:text-primary transition-colors duration-200 group"
                  >
                    {t("table.name")}
                    <span className={`transition-all duration-200 ${currentSortField === "name" ? "opacity-100 text-primary" : "opacity-0 group-hover:opacity-50"}`}>
                      {currentSortField === "name" && currentSortDirection === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5" />
                      )}
                    </span>
                  </button>
                </TableHead>
                <TableHead className="font-semibold text-xs">{t("table.code")}</TableHead>
                <TableHead className="font-semibold text-xs">{t("table.brand")}</TableHead>
                <TableHead className="font-semibold text-xs">{t("table.category")}</TableHead>
                <TableHead className="font-semibold text-xs">{t("table.source")}</TableHead>
                <TableHead className="text-right">
                  <button
                    onClick={() => handleColumnSort("price")}
                    className="inline-flex items-center gap-1.5 font-semibold text-xs hover:text-primary transition-colors duration-200 group ml-auto"
                  >
                    {t("table.priceMDL")}
                    <span className={`transition-all duration-200 ${currentSortField === "price" ? "opacity-100 text-primary" : "opacity-0 group-hover:opacity-50"}`}>
                      {currentSortField === "price" && currentSortDirection === "desc" ? (
                        <ArrowDown className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowUp className="h-3.5 w-3.5" />
                      )}
                    </span>
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button
                    onClick={() => handleColumnSort("stock")}
                    className="inline-flex items-center gap-1.5 font-semibold text-xs hover:text-primary transition-colors duration-200 group ml-auto"
                  >
                    {t("table.stock")}
                    <span className={`transition-all duration-200 ${currentSortField === "stock" ? "opacity-100 text-primary" : "opacity-0 group-hover:opacity-50"}`}>
                      {currentSortField === "stock" && currentSortDirection === "desc" ? (
                        <ArrowDown className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowUp className="h-3.5 w-3.5" />
                      )}
                    </span>
                  </button>
                </TableHead>
                <TableHead className="w-[80px] font-semibold text-xs">{t("table.active")}</TableHead>
                <TableHead className="w-[100px] font-semibold text-xs">{t("table.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-64">
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="p-4 rounded-full bg-muted/50 mb-3">
                        <Package className="h-10 w-10 text-muted-foreground/50" />
                      </div>
                      <div className="text-center mb-4">
                        <p className="text-sm font-semibold text-foreground mb-1">{t("empty.title")}</p>
                        <p className="text-xs text-muted-foreground max-w-md">
                          {hasActiveFilters
                            ? t("empty.withFilters")
                            : t("empty.noFilters")
                          }
                        </p>
                      </div>
                      {hasActiveFilters ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleClearFilters}
                          className="transition-all duration-200 hover:shadow-sm hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                        >
                          <X className="h-4 w-4 mr-1.5" />
                          {t("empty.clearFilters")}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          asChild
                          className="transition-all duration-200 hover:shadow-sm"
                        >
                          <Link href="/products/new">
                            <Package className="h-4 w-4 mr-1.5" />
                            {t("page.newProduct")}
                          </Link>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((product, index) => (
                  <TableRow
                    key={product.id}
                    className={`
                      border-b transition-all duration-200
                      hover:bg-muted/30
                      ${selectedIds.has(product.id) || selectAllMode ? "bg-primary/5 hover:bg-primary/8" : ""}
                      ${rowsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
                    `}
                    style={{
                      transitionDelay: rowsVisible ? `${Math.min(index * 20, 400)}ms` : "0ms",
                    }}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(product.id) || selectAllMode}
                        onCheckedChange={(checked) => handleSelectOne(product.id, checked as boolean)}
                        aria-label={`Select ${product.name}`}
                        className="transition-transform duration-200 hover:scale-110"
                      />
                    </TableCell>
                    <TableCell className="font-medium max-w-[300px]">
                      <Link
                        href={`/products/${product.id}`}
                        className="hover:text-primary hover:underline underline-offset-4 transition-colors duration-200 line-clamp-1"
                      >
                        {localize(product, "name")}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {product.code}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {product.brand_name || (
                        <span className="text-muted-foreground/50">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {product.category_name || (
                        <span className="text-muted-foreground/50">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {product.source_name ? (
                        <Badge variant="outline" className="font-normal text-xs">
                          {product.source_name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground/50">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <PriceDisplay
                        priceMdl={product.price_mdl}
                        priceEur={product.price_eur}
                        priceUsd={product.price_usd}
                        discountedPriceMdl={product.discounted_price_mdl}
                        discountedPriceEur={product.discounted_price_eur}
                        discountedPriceUsd={product.discounted_price_usd}
                        discountPercent={product.effective_discount_percent}
                        size="sm"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {product.is_in_stock ? (
                        <Badge
                          variant="default"
                          className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20 transition-colors duration-200 text-xs font-semibold tabular-nums"
                        >
                          {product.total_stock}
                        </Badge>
                      ) : (
                        <Badge
                          variant="destructive"
                          className="bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20 transition-colors duration-200 text-xs"
                        >
                          {t("badges.outOfStock")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Switch
                          checked={product.is_active}
                          onCheckedChange={(checked) =>
                            handleToggleActive(product.id, checked)
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
                            className="h-8 w-8 transition-all duration-200 hover:bg-muted hover:scale-105"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem asChild>
                            <Link href={`/products/${product.id}`} className="cursor-pointer">
                              <Eye className="mr-2 h-4 w-4" />
                              {t("actions.viewDetails")}
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/products/${product.id}/edit`} className="cursor-pointer">
                              <Pencil className="mr-2 h-4 w-4" />
                              {t("actions.edit")}
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/products/new?duplicate=${product.id}`} className="cursor-pointer">
                              <GitBranch className="mr-2 h-4 w-4" />
                              {t("actions.addVariant")}
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() =>
                              handleToggleActive(product.id, !product.is_active)
                            }
                            className="cursor-pointer"
                          >
                            <Power className="mr-2 h-4 w-4" />
                            {product.is_active ? t("actions.deactivate") : t("actions.activate")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive cursor-pointer focus:text-destructive"
                            onClick={() => {
                              setDeleteProductId(product.id);
                              setShowDeleteDialog(true);
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t("actions.delete")}
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

        {/* Pagination - Compact style matching dashboard */}
        <div
          className={`
            rounded-xl border bg-card/50 shadow-sm p-4
            transition-all duration-300
            ${rowsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
          `}
          style={{ transitionDelay: rowsVisible ? "350ms" : "0ms" }}
        >
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <p>
                {tCommon("pagination.showing")} <span className="font-semibold text-foreground tabular-nums">{filteredProducts.length}</span> {tCommon("pagination.of")}{" "}
                <span className="font-semibold text-foreground tabular-nums">{total}</span> {tCommon("pagination.items")}
              </p>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-2">
                <span>{tCommon("pagination.rowsPerPage")}:</span>
                <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="w-[70px] h-8 transition-all duration-200 hover:border-primary/30">
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
                  className="h-8 w-8 transition-all duration-200 hover:bg-muted hover:shadow-sm"
                  title={tCommon("pagination.firstPage")}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>

                {/* Previous Page */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="transition-all duration-200 hover:bg-muted hover:shadow-sm"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  {tCommon("actions.previous")}
                </Button>

                {/* Page Info & Jump */}
                <div className="flex items-center gap-2 px-2">
                  <span className="text-xs text-muted-foreground">{tCommon("pagination.page")}</span>
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
                    className="w-14 h-8 text-center tabular-nums transition-all duration-200 hover:border-primary/30"
                  />
                  <span className="text-xs text-muted-foreground">of {totalPages}</span>
                </div>

                {/* Next Page */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="transition-all duration-200 hover:bg-muted hover:shadow-sm"
                >
                  {tCommon("actions.next")}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>

                {/* Last Page */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                  className="h-8 w-8 transition-all duration-200 hover:bg-muted hover:shadow-sm"
                  title={tCommon("pagination.lastPage")}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Product Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title={t("dialogs.deleteTitle")}
        description={t("dialogs.deleteDescription")}
        confirmLabel={tCommon("actions.delete")}
        onConfirm={handleDeleteProduct}
        variant="destructive"
        isLoading={isProcessing}
      />
    </div>
  );
}

/**
 * Enhanced skeleton loader matching dashboard design system
 * Compact spacing, staggered animations, premium feel
 */
function ProductsPageSkeleton() {
  return (
    <div className="space-y-4">
      {/* Stats Skeleton - Grid layout like actual stats */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border bg-card shadow-sm p-4 animate-pulse"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="flex items-center justify-between mb-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
            <Skeleton className="h-6 w-16 mb-1" />
          </div>
        ))}
      </div>

      {/* Filters Skeleton - Organized Grid Layout */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden animate-pulse">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="p-5 space-y-4">
          {/* Search Bar Skeleton */}
          <Skeleton className="h-10 w-full rounded-md" />

          {/* Primary Filters Skeleton */}
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          </div>

          {/* Secondary Filters Skeleton */}
          <div className="space-y-2">
            <Skeleton className="h-3 w-32" />
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          </div>
        </div>
      </div>

      {/* Table Skeleton - Staggered row animation */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-muted/30 border-b p-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24 ml-auto" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>

        {/* Rows with staggered fade-in */}
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
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-5 w-16 rounded" />
            <Skeleton className="h-4 w-20 ml-auto" />
            <Skeleton className="h-6 w-12 rounded-full" />
            <Skeleton className="h-5 w-9 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        ))}
      </div>

      {/* Pagination Skeleton - Card style */}
      <div className="rounded-xl border bg-card/50 shadow-sm p-4 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-px" />
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
    </div>
  );
}
