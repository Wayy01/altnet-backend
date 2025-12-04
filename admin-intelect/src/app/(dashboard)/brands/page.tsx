"use client";

import { useState, useEffect, useCallback, useTransition, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Building2,
  ExternalLink,
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
  Search,
  SlidersHorizontal,
  ImageIcon,
  Package,
  Download,
  Pencil,
  Image as ImageIconLucide,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
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
import { Brand, BrandFilterOptions, UpdateBrandPayload } from "@/types";
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
type SortField = "name" | "products";
type SortDirection = "asc" | "desc";

export default function BrandsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const { localize } = useLocalizedValue();
  const { t } = useTranslation("brands");
  const { t: tCommon } = useTranslation("common");

  const [brands, setBrands] = useState<Brand[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get("search") || "");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteBrandId, setDeleteBrandId] = useState<string | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editBrand, setEditBrand] = useState<Brand | null>(null);
  const [editFormState, setEditFormState] = useState({
    name: "",
    code: "",
    logo_url: "",
    is_active: true,
  });
  const [isUploading, setIsUploading] = useState(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Filter states
  const [hasProductsFilter, setHasProductsFilter] = useState<string>(searchParams.get("has_products") || "");
  const [isActiveFilter, setIsActiveFilter] = useState<string>(searchParams.get("is_active") || "");
  const [sortBy, setSortBy] = useState<string>(searchParams.get("sort_by") || "name_asc");

  // Pagination states
  const [pageSize, setPageSize] = useState<number>(parseInt(searchParams.get("limit") || "50", 10));
  const [jumpToPage, setJumpToPage] = useState<string>("");

  // Selection states
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAllMode, setSelectAllMode] = useState<boolean>(false);

  // Animation state for staggered row reveals
  const [rowsVisible, setRowsVisible] = useState(false);

  const limit = pageSize;
  const offset = parseInt(searchParams.get("offset") || "0", 10);
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  // Parse current sort field and direction
  const currentSortField = useMemo((): SortField => {
    if (sortBy.startsWith("name")) return "name";
    if (sortBy.startsWith("products")) return "products";
    return "name";
  }, [sortBy]);

  const currentSortDirection = useMemo((): SortDirection => {
    return sortBy.endsWith("_desc") ? "desc" : "asc";
  }, [sortBy]);

  // Build current filter object
  const currentFilters: BrandFilterOptions = useMemo(() => ({
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
        label: tCommon("actions.search"),
        value: debouncedSearch,
        displayValue: `"${debouncedSearch}"`,
      });
    }

    if (hasProductsFilter) {
      filters.push({
        key: "has_products",
        label: t("table.products"),
        value: hasProductsFilter,
        displayValue: hasProductsFilter === "true" ? t("filters.withProducts") : t("filters.withoutProducts"),
      });
    }

    if (isActiveFilter) {
      filters.push({
        key: "is_active",
        label: t("filters.status"),
        value: isActiveFilter,
        displayValue: isActiveFilter === "true" ? t("filters.active") : t("filters.inactive"),
      });
    }

    if (sortBy && sortBy !== "name_asc") {
      const sortLabels: Record<string, string> = {
        name_desc: t("filters.nameZA"),
        products_desc: t("filters.mostProducts"),
        products_asc: t("filters.leastProducts"),
      };
      filters.push({
        key: "sort_by",
        label: t("filters.sortBy"),
        value: sortBy,
        displayValue: sortLabels[sortBy] || sortBy,
      });
    }

    return filters;
  }, [debouncedSearch, hasProductsFilter, isActiveFilter, sortBy, t, tCommon]);

  const fetchBrands = useCallback(async () => {
    try {
      setIsLoading(true);
      setRowsVisible(false);
      const brandsData = await api.getBrands(limit, offset, currentFilters);
      setBrands(brandsData.data);
      setTotal(brandsData.total);
      setError(null);
      // Trigger staggered row animation after data loads
      setTimeout(() => setRowsVisible(true), 50);
    } catch (err) {
      console.error("Failed to fetch brands:", err);
      setError("Failed to load brands. Make sure the Go backend API is running.");
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
    fetchBrands();
  }, [fetchBrands]);

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
    router.push(`/brands?${newParams.toString()}`);
  };

  // Brands are now fetched from server with filters applied
  const filteredBrands = brands;

  // Count brands with logos in current view
  const brandsWithLogos = useMemo(() => {
    return brands.filter((b) => b.logo_url).length;
  }, [brands]);

  // Count active brands on current page
  const activeBrandsOnPage = useMemo(() => {
    return brands.filter((b) => b.is_active).length;
  }, [brands]);

  // Total products across brands on current page
  const totalProductsOnPage = useMemo(() => {
    return brands.reduce((sum, b) => sum + (b.product_count || 0), 0);
  }, [brands]);

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
    router.push("/brands");
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
    // "all" means no filter - treat it as empty
    const filterValue = value === "all" ? "" : value;
    setHasProductsFilter(filterValue);
    // Clear selection when filter changes
    setSelectedIds(new Set());
    setSelectAllMode(false);
    updateUrlParams({ has_products: filterValue || null, offset: "0" });
  };

  const handleIsActiveChange = (value: string) => {
    // "all" means no filter - treat it as empty
    const filterValue = value === "all" ? "" : value;
    setIsActiveFilter(filterValue);
    // Clear selection when filter changes
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

  const handleToggleActive = async (brandId: string, isActive: boolean) => {
    setIsProcessing(true);
    try {
      await api.updateBrand(brandId, { is_active: isActive });
      toast.success(isActive ? t("toast.activated") : t("toast.deactivated"));
      startTransition(() => {
        fetchBrands();
      });
    } catch (error) {
      console.error("Failed to update brand:", error);
      toast.error(t("toast.updateFailed"));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteBrand = async () => {
    if (!deleteBrandId) return;

    setIsProcessing(true);
    try {
      await api.deleteBrand(deleteBrandId);
      toast.success(t("toast.deleted"));
      setShowDeleteDialog(false);
      setDeleteBrandId(null);
      startTransition(() => {
        fetchBrands();
      });
    } catch (error) {
      console.error("Failed to delete brand:", error);
      toast.error(t("toast.deleteFailed"));
    } finally {
      setIsProcessing(false);
    }
  };

  // Edit modal handlers
  const handleOpenEditDialog = (brand: Brand) => {
    setEditBrand(brand);
    setEditFormState({
      name: brand.name || "",
      code: brand.code || "",
      logo_url: brand.logo_url || "",
      is_active: brand.is_active,
    });
    setShowEditDialog(true);
  };

  const handleEditFormChange = (field: string, value: string | boolean) => {
    setEditFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleEditImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const response = await api.uploadImage(file);
      handleEditFormChange("logo_url", response.url);
      toast.success(t("toast.logoUploaded"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("toast.logoUploadFailed"));
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editBrand) return;

    if (!editFormState.name.trim()) {
      toast.error(t("validation.nameRequired"));
      return;
    }

    setIsProcessing(true);
    try {
      const payload: UpdateBrandPayload = {
        name: editFormState.name.trim(),
        code: editFormState.code.trim() || null,
        logo_url: editFormState.logo_url || null,
        is_active: editFormState.is_active,
      };

      await api.updateBrand(editBrand.id, payload);
      toast.success(t("toast.updated"));
      setShowEditDialog(false);
      setEditBrand(null);
      startTransition(() => {
        fetchBrands();
      });
    } catch (error) {
      console.error("Failed to update brand:", error);
      toast.error(t("toast.updateFailed"));
    } finally {
      setIsProcessing(false);
    }
  };

  // Selection handlers
  const handleSelectAll = () => {
    if (selectedIds.size === filteredBrands.length && !selectAllMode) {
      // All on page selected, clear all
      setSelectedIds(new Set());
      setSelectAllMode(false);
    } else {
      // Select all on current page
      const newSelected = new Set(filteredBrands.map(b => b.id));
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

  const handleSelectOne = (brandId: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(brandId);
    } else {
      newSelected.delete(brandId);
      // If we were in selectAllMode and user deselects one, exit selectAllMode
      if (selectAllMode) {
        setSelectAllMode(false);
      }
    }
    setSelectedIds(newSelected);
  };

  const isAllOnPageSelected = filteredBrands.length > 0 && filteredBrands.every(b => selectedIds.has(b.id));
  const isSomeSelected = selectedIds.size > 0 || selectAllMode;

  // Bulk action handlers
  const handleBulkActivate = async () => {
    setIsProcessing(true);
    try {
      let result;
      if (selectAllMode) {
        // Update all matching brands using filter
        result = await api.bulkUpdateBrandsByFilter({
          filter: {
            search: debouncedSearch || undefined,
            has_products: hasProductsFilter || undefined,
            is_active: isActiveFilter || undefined,
          },
          is_active: true,
        });
      } else {
        // Update selected IDs
        result = await api.bulkUpdateBrands({
          ids: Array.from(selectedIds),
          is_active: true,
        });
      }
      if (result.updated === 0) {
        toast.info(t("toast.noBrandsUpdated"));
      } else {
        toast.success(result.updated === 1
          ? t("toast.bulkActivated", { count: result.updated })
          : t("toast.bulkActivatedPlural", { count: result.updated }));
      }
      handleClearSelection();
      startTransition(() => {
        fetchBrands();
      });
    } catch (error) {
      console.error("Failed to bulk activate brands:", error);
      toast.error(t("toast.bulkFailed"));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkDeactivate = async () => {
    setIsProcessing(true);
    try {
      let result;
      if (selectAllMode) {
        // Update all matching brands using filter
        result = await api.bulkUpdateBrandsByFilter({
          filter: {
            search: debouncedSearch || undefined,
            has_products: hasProductsFilter || undefined,
            is_active: isActiveFilter || undefined,
          },
          is_active: false,
        });
      } else {
        // Update selected IDs
        result = await api.bulkUpdateBrands({
          ids: Array.from(selectedIds),
          is_active: false,
        });
      }
      if (result.updated === 0) {
        toast.info(t("toast.noBrandsUpdated"));
      } else {
        toast.success(result.updated === 1
          ? t("toast.bulkDeactivated", { count: result.updated })
          : t("toast.bulkDeactivatedPlural", { count: result.updated }));
      }
      handleClearSelection();
      startTransition(() => {
        fetchBrands();
      });
    } catch (error) {
      console.error("Failed to bulk deactivate brands:", error);
      toast.error(t("toast.bulkFailed"));
    } finally {
      setIsProcessing(false);
    }
  };

  // Export handler
  const handleExport = async () => {
    try {
      setIsProcessing(true);
      const blob = await api.exportBrands(currentFilters);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `brands-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(t("toast.exportSuccess"));
    } catch (error) {
      console.error("Failed to export brands:", error);
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
      label: t("stats.withLogos"),
      value: brandsWithLogos,
      suffix: t("stats.onPage"),
      icon: <ImageIcon className="h-3.5 w-3.5" />,
      variant: brandsWithLogos > 0 ? "success" : "muted",
    },
    {
      label: t("stats.active"),
      value: activeBrandsOnPage,
      suffix: t("stats.onPage"),
      icon: <Power className="h-3.5 w-3.5" />,
      variant: activeBrandsOnPage > 0 ? "success" : "warning",
    },
    {
      label: t("table.products"),
      value: totalProductsOnPage.toLocaleString(),
      suffix: t("stats.onPage"),
      icon: <Package className="h-3.5 w-3.5" />,
      variant: "muted",
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("page.title")}</h1>
          <p className="text-muted-foreground">
            {t("page.description")}
          </p>
        </div>
        <BrandsPageSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("page.title")}</h1>
          <p className="text-muted-foreground">
            {t("page.description")}
          </p>
        </div>
        <div className="flex flex-col items-center justify-center py-12 rounded-xl border bg-card shadow-sm">
          <div className="p-4 rounded-full bg-muted/50 mb-4">
            <Building2 className="h-10 w-10 text-muted-foreground/50" />
          </div>
          <p className="text-muted-foreground">{error}</p>
          <Button
            variant="outline"
            className="mt-4 transition-all duration-200 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
            onClick={() => window.location.reload()}
          >
            {tCommon("actions.tryAgain")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("page.title")}</h1>
        <p className="text-muted-foreground">
          {t("page.description")}
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
            {t("actions.exportCSV")}
          </Button>
        </div>

        {/* Filters Section - Organized Card Layout */}
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-muted">
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-sm">{t("filters.searchBrands")}</h3>
            </div>
          </div>

          {/* Content */}
          <div className="p-5 space-y-4">
            {/* Search Bar - Full Width */}
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                name="search"
                placeholder={t("filters.searchBrands")}
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

            {/* Primary Filters Section */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t("filters.catalogFilters")}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Product Count Filter */}
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Select value={hasProductsFilter || "all"} onValueChange={handleHasProductsChange}>
                    <SelectTrigger className="w-full transition-all duration-200 hover:border-primary/30">
                      <SelectValue placeholder={t("filters.productCount")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("filters.allBrands")}</SelectItem>
                      <SelectItem value="true">{t("filters.withProducts")}</SelectItem>
                      <SelectItem value="false">{t("filters.withoutProducts")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Status Filter */}
                <div className="flex items-center gap-2">
                  <Power className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Select value={isActiveFilter || "all"} onValueChange={handleIsActiveChange}>
                    <SelectTrigger className="w-full transition-all duration-200 hover:border-primary/30">
                      <SelectValue placeholder={t("filters.status")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{tCommon("filters.all")}</SelectItem>
                      <SelectItem value="true">{t("filters.active")}</SelectItem>
                      <SelectItem value="false">{t("filters.inactive")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Sorting Section */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t("filters.sorting")}
              </h4>
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
                <Select value={sortBy} onValueChange={handleSortByChange}>
                  <SelectTrigger className="w-full transition-all duration-200 hover:border-primary/30">
                    <SelectValue placeholder={t("filters.sortBy")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name_asc">{t("filters.nameAZ")}</SelectItem>
                    <SelectItem value="name_desc">{t("filters.nameZA")}</SelectItem>
                    <SelectItem value="products_desc">{t("filters.mostProducts")}</SelectItem>
                    <SelectItem value="products_asc">{t("filters.leastProducts")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* Active Filter Chips - Enhanced styling */}
        {hasActiveFilters && (
          <div className="rounded-xl border bg-card/50 shadow-sm p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="p-1 rounded bg-muted">
                  <SlidersHorizontal className="h-3 w-3" />
                </div>
                <span className="font-medium">{activeFilters.length} active filter{activeFilters.length === 1 ? "" : "s"}</span>
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

        {/* Bulk Actions Bar */}
        {isSomeSelected && (
          <div className="flex items-center gap-4 p-3 bg-primary/5 rounded-xl border border-primary/20 animate-in fade-in-0 slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-primary/10">
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

            {isAllOnPageSelected && !selectAllMode && total > filteredBrands.length && (
              <Button
                variant="link"
                size="sm"
                className="text-primary p-0 h-auto"
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
                className="transition-all duration-200 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
              >
                <Power className="h-4 w-4 mr-1.5" />
                {t("actions.activate")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkDeactivate}
                disabled={isProcessing || isPending}
                className="transition-all duration-200 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
              >
                <PowerOff className="h-4 w-4 mr-1.5" />
                {t("actions.deactivate")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearSelection}
                disabled={isProcessing || isPending}
              >
                <X className="h-4 w-4 mr-1" />
                {tCommon("actions.clear")}
              </Button>
            </div>
          </div>
        )}

        {/* Brands Table - Enhanced with shadow and rounded corners */}
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={isAllOnPageSelected && filteredBrands.length > 0}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all"
                    className="transition-transform duration-200 hover:scale-110"
                  />
                </TableHead>
                <TableHead className="w-[60px]">{t("table.logo")}</TableHead>
                <TableHead>
                  <button
                    onClick={() => handleColumnSort("name")}
                    className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors group"
                  >
                    {t("table.name")}
                    <span className={`transition-all duration-200 ${currentSortField === "name" ? "opacity-100" : "opacity-0 group-hover:opacity-50"}`}>
                      {currentSortField === "name" && currentSortDirection === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5" />
                      )}
                    </span>
                  </button>
                </TableHead>
                <TableHead>{t("table.slug")}</TableHead>
                <TableHead>{t("table.ultraId")}</TableHead>
                <TableHead className="text-right">
                  <button
                    onClick={() => handleColumnSort("products")}
                    className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors group ml-auto"
                  >
                    {t("table.products")}
                    <span className={`transition-all duration-200 ${currentSortField === "products" ? "opacity-100" : "opacity-0 group-hover:opacity-50"}`}>
                      {currentSortField === "products" && currentSortDirection === "desc" ? (
                        <ArrowDown className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowUp className="h-3.5 w-3.5" />
                      )}
                    </span>
                  </button>
                </TableHead>
                <TableHead className="w-[80px]">{t("table.active")}</TableHead>
                <TableHead className="w-[100px]">{t("table.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBrands.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-48">
                    <div className="flex flex-col items-center justify-center gap-3 py-8">
                      <div className="p-4 rounded-full bg-muted/50">
                        <Building2 className="h-10 w-10 text-muted-foreground/50" />
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-foreground">{t("empty.title")}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {hasActiveFilters
                            ? t("empty.withFilters")
                            : t("empty.noFilters")
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
                          {t("empty.clearFilters")}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredBrands.map((brand, index) => (
                  <TableRow
                    key={brand.id}
                    className={`
                      transition-all duration-200
                      ${selectedIds.has(brand.id) || selectAllMode ? "bg-primary/5" : ""}
                      ${rowsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
                    `}
                    style={{
                      transitionDelay: rowsVisible ? `${Math.min(index * 20, 400)}ms` : "0ms",
                    }}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(brand.id) || selectAllMode}
                        onCheckedChange={(checked) => handleSelectOne(brand.id, checked as boolean)}
                        aria-label={`Select ${brand.name}`}
                        className="transition-transform duration-200 hover:scale-110"
                      />
                    </TableCell>
                    <TableCell>
                      <Avatar className="h-8 w-8 transition-transform duration-200 hover:scale-110">
                        {brand.logo_url ? (
                          <AvatarImage src={brand.logo_url} alt={brand.name} />
                        ) : null}
                        <AvatarFallback className="text-xs font-medium">
                          {brand.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link
                        href={`/brands/${brand.id}`}
                        className="hover:text-primary hover:underline underline-offset-4 transition-colors"
                      >
                        {localize(brand, "name")}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {brand.slug}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {brand.ultra_id}
                    </TableCell>
                    <TableCell className="text-right">
                      {(brand.product_count || 0) > 0 ? (
                        <Badge
                          variant="default"
                          className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20 transition-colors"
                        >
                          {brand.product_count || 0}
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
                          checked={brand.is_active}
                          onCheckedChange={(checked) =>
                            handleToggleActive(brand.id, checked)
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
                            <Link href={`/brands/${brand.id}`} className="cursor-pointer">
                              <Eye className="mr-2 h-4 w-4" />
                              {t("actions.viewDetails")}
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleOpenEditDialog(brand)}
                            className="cursor-pointer"
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            {t("actions.editBrand")}
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/products?brand_id=${brand.id}`} className="cursor-pointer">
                              <ExternalLink className="mr-2 h-4 w-4" />
                              {t("actions.viewProducts")}
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() =>
                              handleToggleActive(brand.id, !brand.is_active)
                            }
                            className="cursor-pointer"
                          >
                            <Power className="mr-2 h-4 w-4" />
                            {brand.is_active ? t("actions.deactivate") : t("actions.activate")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive cursor-pointer focus:text-destructive"
                            onClick={() => {
                              setDeleteBrandId(brand.id);
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

        {/* Enhanced Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <p>
              {tCommon("pagination.showing")} <span className="font-medium text-foreground">{filteredBrands.length}</span> {tCommon("pagination.of")}{" "}
              <span className="font-medium text-foreground">{total}</span> {tCommon("pagination.items")}
            </p>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <span>{tCommon("pagination.rowsPerPage")}:</span>
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
                className="transition-all duration-200 hover:bg-muted"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                {tCommon("actions.previous")}
              </Button>

              {/* Page Info & Jump */}
              <div className="flex items-center gap-2 px-2">
                <span className="text-sm text-muted-foreground">{tCommon("pagination.page")}</span>
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
                {tCommon("actions.next")}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>

              {/* Last Page */}
              <Button
                variant="outline"
                size="icon"
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
                className="h-8 w-8 transition-all duration-200 hover:bg-muted"
                title={tCommon("pagination.lastPage")}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Edit Brand Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t("dialogs.editTitle")}</DialogTitle>
            <DialogDescription>
              {t("dialogs.editDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Logo Upload */}
            <div className="space-y-2">
              <Label>{t("form.brandLogo")}</Label>
              <div className="flex items-start gap-4">
                {editFormState.logo_url ? (
                  <div className="relative group">
                    <img
                      src={editFormState.logo_url}
                      alt={t("form.brandLogoAlt")}
                      className="h-16 w-16 rounded-lg object-cover border shadow-sm"
                    />
                    <button
                      onClick={() => handleEditFormChange("logo_url", "")}
                      className="absolute -top-2 -right-2 p-1 rounded-full bg-destructive text-destructive-foreground shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-16 w-16 rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 cursor-pointer transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleEditImageUpload}
                      className="hidden"
                      disabled={isUploading}
                    />
                    {isUploading ? (
                      <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
                    ) : (
                      <ImageIconLucide className="h-5 w-5 text-muted-foreground" />
                    )}
                  </label>
                )}
                <Input
                  placeholder={t("form.logoUrlPlaceholder")}
                  value={editFormState.logo_url}
                  onChange={(e) => handleEditFormChange("logo_url", e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="edit-name">
                {t("form.brandName")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-name"
                value={editFormState.name}
                onChange={(e) => handleEditFormChange("name", e.target.value)}
                placeholder={t("form.brandNamePlaceholder")}
              />
            </div>

            {/* Code */}
            <div className="space-y-2">
              <Label htmlFor="edit-code">{t("form.brandCode")}</Label>
              <Input
                id="edit-code"
                value={editFormState.code}
                onChange={(e) => handleEditFormChange("code", e.target.value)}
                placeholder={t("form.brandCodePlaceholder")}
                className="font-mono"
              />
            </div>

            {/* Active Status */}
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <div>
                <Label htmlFor="edit-is_active" className="cursor-pointer">{t("form.activeStatus")}</Label>
                <p className="text-xs text-muted-foreground">{t("form.activeStatusDescription")}</p>
              </div>
              <Switch
                id="edit-is_active"
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
              {tCommon("actions.cancel")}
            </Button>
            <Button onClick={handleSaveEdit} disabled={isProcessing}>
              {isProcessing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {tCommon("actions.saveChanges")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Brand Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title={t("dialogs.deleteTitle")}
        description={t("dialogs.deleteDescription")}
        confirmLabel={tCommon("actions.delete")}
        onConfirm={handleDeleteBrand}
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
function BrandsPageSkeleton() {
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
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
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
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-28" />
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
