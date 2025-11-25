"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { CharacteristicValue } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Package,
  Warehouse,
  Tag,
  DollarSign,
  Edit,
  Trash2,
  Loader2,
  X,
  SlidersHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckSquare,
  Power,
  PowerOff,
} from "lucide-react";
import { CharacteristicBreadcrumb } from "@/components/characteristics/CharacteristicBreadcrumb";

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
type SortField = "product" | "code" | "stock" | "price";
type SortDirection = "asc" | "desc";

export default function CharacteristicValuesPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const characteristicName = decodeURIComponent(params.name as string);

  // Get initial values from URL params
  const initialSearch = searchParams.get("search") || "";
  const initialOffset = parseInt(searchParams.get("offset") || "0", 10);
  const initialSortBy = searchParams.get("sort_by") || "product_asc";

  // State
  const [values, setValues] = useState<CharacteristicValue[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Search states
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [isSearching, setIsSearching] = useState(false);

  // Sort and pagination states
  const [sortBy, setSortBy] = useState(initialSortBy);
  const [pageSize, setPageSize] = useState<number>(parseInt(searchParams.get("limit") || "100", 10));
  const [jumpToPage, setJumpToPage] = useState<string>("");

  const limit = pageSize;
  const offset = initialOffset;
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(totalCount / limit);

  // Animation state for staggered row reveals
  const [rowsVisible, setRowsVisible] = useState(false);

  // Edit dialog state
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    value?: CharacteristicValue;
    loading: boolean;
  }>({
    open: false,
    loading: false,
  });

  const [editForm, setEditForm] = useState({
    code: "",
    reference: "",
    stock_warehouse: 0,
    stock_showroom: 0,
    stock_total: 0,
    is_active: true,
  });

  // Stats for cards
  const [stats, setStats] = useState({
    totalValues: 0,
    uniqueProducts: 0,
    totalStock: 0,
    activeValues: 0,
  });

  // Parse current sort field and direction
  const currentSortField = useMemo((): SortField => {
    if (sortBy.startsWith("product")) return "product";
    if (sortBy.startsWith("code")) return "code";
    if (sortBy.startsWith("stock")) return "stock";
    if (sortBy.startsWith("price")) return "price";
    return "product";
  }, [sortBy]);

  const currentSortDirection = useMemo((): SortDirection => {
    return sortBy.endsWith("_desc") ? "desc" : "asc";
  }, [sortBy]);

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

    if (sortBy && sortBy !== "product_asc") {
      const sortLabels: Record<string, string> = {
        product_desc: "Product Z-A",
        code_asc: "Code A-Z",
        code_desc: "Code Z-A",
        stock_desc: "Most Stock",
        stock_asc: "Least Stock",
        price_desc: "Highest Price",
        price_asc: "Lowest Price",
      };
      filters.push({
        key: "sort_by",
        label: "Sort",
        value: sortBy,
        displayValue: sortLabels[sortBy] || sortBy,
      });
    }

    return filters;
  }, [debouncedSearch, sortBy]);

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
    router.push(`/characteristics/names/${encodeURIComponent(characteristicName)}?${newParams.toString()}`);
  };

  // Fetch characteristic values
  const fetchValues = useCallback(async () => {
    try {
      setLoading(true);
      setRowsVisible(false);
      const response = await api.getCharacteristicValues(
        characteristicName,
        limit,
        offset,
        debouncedSearch || undefined
      );
      setValues(response.data || []);
      setTotalCount(response.total || 0);

      // Calculate stats from current data
      if (response.data && response.data.length > 0) {
        const uniqueProducts = new Set(response.data.map((v) => v.product_id)).size;
        const totalStock = response.data.reduce((sum, v) => sum + v.stock_total, 0);
        const activeCount = response.data.filter((v) => v.is_active).length;

        setStats({
          totalValues: response.total,
          uniqueProducts,
          totalStock,
          activeValues: activeCount,
        });
      }

      // Trigger staggered row animation after data loads
      setTimeout(() => setRowsVisible(true), 50);
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch characteristic values");
      setValues([]);
    } finally {
      setLoading(false);
      setIsSearching(false);
      // Refocus search input after fetch completes
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }
  }, [characteristicName, limit, offset, debouncedSearch]);

  useEffect(() => {
    fetchValues();
  }, [fetchValues]);

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

  const handleClearSearch = () => {
    setSearchQuery("");
    setDebouncedSearch("");
    updateUrlParams({ search: null, offset: "0" });
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setDebouncedSearch("");
    setSortBy("product_asc");
    router.push(`/characteristics/names/${encodeURIComponent(characteristicName)}`);
  };

  const handleRemoveFilter = (filterKey: string) => {
    switch (filterKey) {
      case "search":
        handleClearSearch();
        break;
      case "sort_by":
        setSortBy("product_asc");
        updateUrlParams({ sort_by: null, offset: "0" });
        break;
    }
  };

  const handleSortByChange = (value: string) => {
    setSortBy(value);
    updateUrlParams({ sort_by: value, offset: "0" });
  };

  // Column header sort handler
  const handleColumnSort = (field: SortField) => {
    let newSort = "";

    if (field === "product") {
      newSort = currentSortField === "product" && currentSortDirection === "asc" ? "product_desc" : "product_asc";
    } else if (field === "code") {
      newSort = currentSortField === "code" && currentSortDirection === "asc" ? "code_desc" : "code_asc";
    } else if (field === "stock") {
      newSort = currentSortField === "stock" && currentSortDirection === "desc" ? "stock_asc" : "stock_desc";
    } else if (field === "price") {
      newSort = currentSortField === "price" && currentSortDirection === "desc" ? "price_asc" : "price_desc";
    }

    if (newSort) {
      handleSortByChange(newSort);
    }
  };

  const handlePageChange = (newPage: number) => {
    const newOffset = (newPage - 1) * limit;
    updateUrlParams({ offset: newOffset.toString() });
  };

  const handlePageSizeChange = (newSize: string) => {
    const size = parseInt(newSize, 10);
    setPageSize(size);
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
  const toggleSelectAll = () => {
    if (values && selectedIds.size === values.length) {
      setSelectedIds(new Set());
    } else if (values) {
      setSelectedIds(new Set(values.map((v) => v.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // Edit handlers
  const handleEditClick = (value: CharacteristicValue) => {
    setEditForm({
      code: value.code || "",
      reference: value.reference || "",
      stock_warehouse: value.stock_warehouse,
      stock_showroom: value.stock_showroom,
      stock_total: value.stock_total,
      is_active: value.is_active,
    });
    setEditDialog({ open: true, value, loading: false });
  };

  const handleEditSave = async () => {
    if (!editDialog.value) return;

    try {
      setEditDialog((prev) => ({ ...prev, loading: true }));
      await api.updateCharacteristicValue(editDialog.value.id, editForm);
      toast.success("Characteristic value updated successfully");
      setEditDialog({ open: false, loading: false });
      fetchValues();
    } catch (error: any) {
      toast.error(error.message || "Failed to update characteristic value");
      setEditDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  // Delete handlers
  const handleDelete = async (id: string) => {
    if (!confirm("Delete this characteristic value?")) return;

    try {
      await api.deleteCharacteristicValue(id);
      toast.success("Characteristic value deleted");
      fetchValues();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete characteristic value");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) {
      toast.error("No values selected");
      return;
    }

    if (!confirm(`Delete ${selectedIds.size} selected values?`)) return;

    try {
      await api.bulkDeleteCharacteristicValues(Array.from(selectedIds));
      toast.success(`${selectedIds.size} values deleted`);
      setSelectedIds(new Set());
      fetchValues();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete characteristic values");
    }
  };

  // Check if any filters are active
  const hasActiveFilters = activeFilters.length > 0;

  // Check selection states
  const isSomeSelected = selectedIds.size > 0;
  const isAllOnPageSelected = values && values.length > 0 && selectedIds.size === values.length;

  // Stats indicators configuration
  const statsIndicators: StatIndicator[] = [
    {
      label: "Total Values",
      value: stats.totalValues.toLocaleString(),
      suffix: hasActiveFilters ? "filtered" : undefined,
      icon: <Tag className="h-3.5 w-3.5" />,
      variant: "default",
    },
    {
      label: "Unique Products",
      value: stats.uniqueProducts.toLocaleString(),
      suffix: "on page",
      icon: <Package className="h-3.5 w-3.5" />,
      variant: stats.uniqueProducts > 0 ? "success" : "muted",
    },
    {
      label: "Total Stock",
      value: stats.totalStock.toLocaleString(),
      suffix: "on page",
      icon: <Warehouse className="h-3.5 w-3.5" />,
      variant: stats.totalStock > 0 ? "success" : "warning",
    },
    {
      label: "Active Values",
      value: stats.activeValues.toLocaleString(),
      suffix: "on page",
      icon: <DollarSign className="h-3.5 w-3.5" />,
      variant: stats.activeValues > 0 ? "success" : "muted",
    },
  ];

  if (loading && !values) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Characteristic Values</h1>
            <p className="text-muted-foreground">
              Manage values for: {characteristicName}
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push("/characteristics")}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Names
          </Button>
        </div>
        <CharacteristicBreadcrumb currentLevel={2} characteristicName={characteristicName} />
        <CharacteristicValuesPageSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Characteristic Values</h1>
          <p className="text-muted-foreground">
            Manage values for: {characteristicName}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push("/characteristics")}
          className="transition-all duration-200 hover:bg-muted"
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to Names
        </Button>
      </div>

      {/* Breadcrumb */}
      <CharacteristicBreadcrumb currentLevel={2} characteristicName={characteristicName} />

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
        </div>

        {/* Filters Row - Enhanced with card styling */}
        <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl border bg-card/50 shadow-sm">
          {/* Search */}
          <div className="relative flex-1 min-w-[250px] max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Search by code, reference, or product name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
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

          {/* Sort By */}
          <Select value={sortBy} onValueChange={handleSortByChange}>
            <SelectTrigger className="w-[180px] transition-all duration-200 hover:border-primary/50">
              <ArrowUpDown className="h-4 w-4 mr-1 text-muted-foreground" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="product_asc">Product A-Z</SelectItem>
              <SelectItem value="product_desc">Product Z-A</SelectItem>
              <SelectItem value="code_asc">Code A-Z</SelectItem>
              <SelectItem value="code_desc">Code Z-A</SelectItem>
              <SelectItem value="stock_desc">Most Stock</SelectItem>
              <SelectItem value="stock_asc">Least Stock</SelectItem>
              <SelectItem value="price_desc">Highest Price</SelectItem>
              <SelectItem value="price_asc">Lowest Price</SelectItem>
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

        {/* Bulk Actions Bar - Enhanced with premium styling */}
        {isSomeSelected && (
          <div className="flex items-center gap-4 p-3 bg-primary/5 rounded-xl border border-primary/20 animate-in fade-in-0 slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-primary/10">
                <CheckSquare className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">
                {selectedIds.size} value{selectedIds.size !== 1 ? "s" : ""} selected
              </span>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkDelete}
                className="transition-all duration-200 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
              >
                <Trash2 className="h-4 w-4 mr-1.5" />
                Delete Selected
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            </div>
          </div>
        )}

        {/* Values Table - Enhanced with shadow and rounded corners */}
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-12">
                  <Checkbox
                    checked={isAllOnPageSelected}
                    onCheckedChange={toggleSelectAll}
                    className="transition-transform duration-200 hover:scale-110"
                  />
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleColumnSort("product")}
                    className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors group"
                  >
                    Product
                    <span className={`transition-all duration-200 ${currentSortField === "product" ? "opacity-100" : "opacity-0 group-hover:opacity-50"}`}>
                      {currentSortField === "product" && currentSortDirection === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5" />
                      )}
                    </span>
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleColumnSort("code")}
                    className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors group"
                  >
                    Code
                    <span className={`transition-all duration-200 ${currentSortField === "code" ? "opacity-100" : "opacity-0 group-hover:opacity-50"}`}>
                      {currentSortField === "code" && currentSortDirection === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5" />
                      )}
                    </span>
                  </button>
                </TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="text-right">Warehouse</TableHead>
                <TableHead className="text-right">Showroom</TableHead>
                <TableHead className="text-right">
                  <button
                    onClick={() => handleColumnSort("stock")}
                    className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors group ml-auto"
                  >
                    Total Stock
                    <span className={`transition-all duration-200 ${currentSortField === "stock" ? "opacity-100" : "opacity-0 group-hover:opacity-50"}`}>
                      {currentSortField === "stock" && currentSortDirection === "desc" ? (
                        <ArrowDown className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowUp className="h-3.5 w-3.5" />
                      )}
                    </span>
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleColumnSort("price")}
                    className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors group"
                  >
                    Price
                    <span className={`transition-all duration-200 ${currentSortField === "price" ? "opacity-100" : "opacity-0 group-hover:opacity-50"}`}>
                      {currentSortField === "price" && currentSortDirection === "desc" ? (
                        <ArrowDown className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowUp className="h-3.5 w-3.5" />
                      )}
                    </span>
                  </button>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-48">
                    <div className="flex items-center justify-center py-8">
                      <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                        <p className="mt-2 text-sm text-muted-foreground">Loading characteristic values...</p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : !values || values.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-48">
                    <div className="flex flex-col items-center justify-center gap-3 py-8">
                      <div className="p-4 rounded-full bg-muted/50">
                        <Tag className="h-10 w-10 text-muted-foreground/50" />
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-foreground">No characteristic values found</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {hasActiveFilters
                            ? "Try adjusting your filters to find what you're looking for"
                            : "No values available"
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
                values.map((value, index) => (
                  <TableRow
                    key={value.id}
                    className={`
                      transition-all duration-200
                      ${selectedIds.has(value.id) ? "bg-primary/5" : ""}
                      ${rowsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
                    `}
                    style={{
                      transitionDelay: rowsVisible ? `${Math.min(index * 15, 400)}ms` : "0ms",
                    }}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(value.id)}
                        onCheckedChange={() => toggleSelect(value.id)}
                        className="transition-transform duration-200 hover:scale-110"
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium hover:text-primary transition-colors cursor-default">
                          {value.product_name || "N/A"}
                        </div>
                        <div className="text-xs text-muted-foreground">{value.product_code}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {value.code ? (
                        <Badge variant="outline" className="font-mono text-xs">
                          {value.code}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {value.reference || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{value.stock_warehouse}</TableCell>
                    <TableCell className="text-right tabular-nums">{value.stock_showroom}</TableCell>
                    <TableCell className="text-right">
                      {value.stock_total > 0 ? (
                        <Badge
                          variant="default"
                          className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20 transition-colors tabular-nums"
                        >
                          {value.stock_total}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="font-normal text-muted-foreground tabular-nums">
                          0
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {value.prices && Array.isArray(value.prices) && value.prices.length > 0 && value.prices[0]?.price != null ? (
                        <span className="text-sm font-medium tabular-nums">
                          {Number(value.prices[0].price).toFixed(2)} {value.prices[0].currency || ''}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {value.is_active ? (
                        <Badge variant="default" className="text-xs bg-green-500 hover:bg-green-600 transition-colors">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditClick(value)}
                          className="h-8 w-8 transition-all duration-200 hover:bg-primary/10 hover:text-primary"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(value.id)}
                          className="h-8 w-8 transition-all duration-200 hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Enhanced Pagination */}
        {!loading && values && values.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <p>
                Showing <span className="font-medium text-foreground">{values.length}</span> of{" "}
                <span className="font-medium text-foreground">{totalCount.toLocaleString()}</span> values
              </p>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-2">
                <span>Rows per page:</span>
                <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="w-[70px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="200">200</SelectItem>
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
        )}
      </div>

      {/* Edit Dialog - Enhanced styling */}
      <Dialog open={editDialog.open} onOpenChange={(open) => setEditDialog({ open, loading: false })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Characteristic Value</DialogTitle>
            <DialogDescription>
              Update the characteristic value details
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                value={editForm.code}
                onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="reference">Reference</Label>
              <Input
                id="reference"
                value={editForm.reference}
                onChange={(e) => setEditForm({ ...editForm, reference: e.target.value })}
                className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="grid gap-2">
                <Label htmlFor="stock_warehouse">Warehouse Stock</Label>
                <Input
                  id="stock_warehouse"
                  type="number"
                  value={editForm.stock_warehouse}
                  onChange={(e) =>
                    setEditForm({ ...editForm, stock_warehouse: parseInt(e.target.value) || 0 })
                  }
                  className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="stock_showroom">Showroom Stock</Label>
                <Input
                  id="stock_showroom"
                  type="number"
                  value={editForm.stock_showroom}
                  onChange={(e) =>
                    setEditForm({ ...editForm, stock_showroom: parseInt(e.target.value) || 0 })
                  }
                  className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="stock_total">Total Stock</Label>
                <Input
                  id="stock_total"
                  type="number"
                  value={editForm.stock_total}
                  onChange={(e) =>
                    setEditForm({ ...editForm, stock_total: parseInt(e.target.value) || 0 })
                  }
                  className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="is_active"
                checked={editForm.is_active}
                onCheckedChange={(checked) =>
                  setEditForm({ ...editForm, is_active: checked as boolean })
                }
                className="transition-transform duration-200 hover:scale-110"
              />
              <Label htmlFor="is_active" className="text-sm font-normal">Active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialog({ open: false, loading: false })}
              disabled={editDialog.loading}
              className="transition-all duration-200"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditSave}
              disabled={editDialog.loading}
              className="transition-all duration-200"
            >
              {editDialog.loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Enhanced skeleton loader with row-by-row loading animation
 * Provides better visual feedback during initial load
 */
function CharacteristicValuesPageSkeleton() {
  return (
    <div className="space-y-4">
      {/* Stats Skeleton */}
      <div className="flex flex-wrap items-center gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-10 w-36 rounded-lg"
            style={{ animationDelay: `${i * 100}ms` }}
          />
        ))}
      </div>

      {/* Filters Skeleton */}
      <div className="flex flex-wrap gap-3 p-4 rounded-xl border bg-card/50">
        <Skeleton className="h-10 flex-1 min-w-[250px] max-w-md rounded-md" />
        <Skeleton className="h-10 w-[180px] rounded-md" />
      </div>

      {/* Table Skeleton with row-by-row animation */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-4 p-4 bg-muted/30 border-b">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16 ml-auto" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
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
            <div className="flex flex-col gap-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-12 ml-auto" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-6 w-12 rounded-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-8 w-16 rounded-md" />
          </div>
        ))}
      </div>

      {/* Pagination Skeleton */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-48" />
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
