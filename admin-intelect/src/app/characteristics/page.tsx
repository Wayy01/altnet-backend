"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { CharacteristicName, DeletionImpact } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Package,
  Tag,
  Database,
  DollarSign,
  Eye,
  Trash2,
  Loader2,
  X,
  SlidersHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { CharacteristicBreadcrumb } from "@/components/characteristics/CharacteristicBreadcrumb";
import { DeleteConfirmDialog } from "@/components/characteristics/DeleteConfirmDialog";

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
type SortField = "name" | "characteristics" | "products" | "stock";
type SortDirection = "asc" | "desc";

export default function CharacteristicsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get initial values from URL params
  const initialSearch = searchParams.get("search") || "";
  const initialOffset = parseInt(searchParams.get("offset") || "0", 10);
  const initialSortBy = searchParams.get("sort_by") || "name_asc";

  // State
  const [names, setNames] = useState<CharacteristicName[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Search states
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [isSearching, setIsSearching] = useState(false);

  // Sort and pagination states
  const [sortBy, setSortBy] = useState(initialSortBy);
  const [pageSize, setPageSize] = useState<number>(parseInt(searchParams.get("limit") || "50", 10));
  const [jumpToPage, setJumpToPage] = useState<string>("");

  const limit = pageSize;
  const offset = initialOffset;
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(totalCount / limit);

  // Animation state for staggered row reveals
  const [rowsVisible, setRowsVisible] = useState(false);

  // Deletion state
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    name: string;
    impact?: DeletionImpact;
    loading: boolean;
  }>({
    open: false,
    name: "",
    loading: false,
  });

  // Stats for cards
  const [stats, setStats] = useState({
    totalNames: 0,
    totalCharacteristics: 0,
    totalStock: 0,
    productsUsing: 0,
  });

  // Parse current sort field and direction
  const currentSortField = useMemo((): SortField => {
    if (sortBy.startsWith("name")) return "name";
    if (sortBy.startsWith("characteristics")) return "characteristics";
    if (sortBy.startsWith("products")) return "products";
    if (sortBy.startsWith("stock")) return "stock";
    return "name";
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

    if (sortBy && sortBy !== "name_asc") {
      const sortLabels: Record<string, string> = {
        name_desc: "Name Z-A",
        characteristics_desc: "Most Characteristics",
        characteristics_asc: "Least Characteristics",
        products_desc: "Most Products",
        products_asc: "Least Products",
        stock_desc: "Most Stock",
        stock_asc: "Least Stock",
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
    router.push(`/characteristics?${newParams.toString()}`);
  };

  // Fetch characteristic names
  const fetchNames = useCallback(async () => {
    try {
      setLoading(true);
      setRowsVisible(false);
      const response = await api.getCharacteristicNames(limit, offset, debouncedSearch || undefined);
      setNames(response.data || []);
      setTotalCount(response.total || 0);

      // Calculate stats from current data
      if (response.data && response.data.length > 0) {
        setStats({
          totalNames: response.total,
          totalCharacteristics: response.data.reduce((sum, n) => sum + n.characteristic_count, 0),
          totalStock: response.data.reduce((sum, n) => sum + n.total_stock, 0),
          productsUsing: response.data.reduce((sum, n) => sum + n.products_using, 0),
        });
      }

      // Trigger staggered row animation after data loads
      setTimeout(() => setRowsVisible(true), 50);
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch characteristic names");
      setNames([]);
    } finally {
      setLoading(false);
      setIsSearching(false);
      // Refocus search input after fetch completes
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }
  }, [limit, offset, debouncedSearch]);

  useEffect(() => {
    fetchNames();
  }, [fetchNames]);

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

  // Total stock on current page
  const totalStockOnPage = useMemo(() => {
    return names?.reduce((sum, n) => sum + n.total_stock, 0) || 0;
  }, [names]);

  // Total products on current page
  const totalProductsOnPage = useMemo(() => {
    return names?.reduce((sum, n) => sum + n.products_using, 0) || 0;
  }, [names]);

  const handleClearSearch = () => {
    setSearchQuery("");
    setDebouncedSearch("");
    updateUrlParams({ search: null, offset: "0" });
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setDebouncedSearch("");
    setSortBy("name_asc");
    router.push("/characteristics");
  };

  const handleRemoveFilter = (filterKey: string) => {
    switch (filterKey) {
      case "search":
        handleClearSearch();
        break;
      case "sort_by":
        setSortBy("name_asc");
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

    if (field === "name") {
      newSort = currentSortField === "name" && currentSortDirection === "asc" ? "name_desc" : "name_asc";
    } else if (field === "characteristics") {
      newSort = currentSortField === "characteristics" && currentSortDirection === "desc" ? "characteristics_asc" : "characteristics_desc";
    } else if (field === "products") {
      newSort = currentSortField === "products" && currentSortDirection === "desc" ? "products_asc" : "products_desc";
    } else if (field === "stock") {
      newSort = currentSortField === "stock" && currentSortDirection === "desc" ? "stock_asc" : "stock_desc";
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

  // Handle delete
  const handleDeleteClick = async (name: string) => {
    try {
      setDeleteDialog({ open: true, name, loading: true });
      const impact = await api.getCharacteristicNameDeletionImpact(name);
      setDeleteDialog({ open: true, name, impact, loading: false });
    } catch (error: any) {
      toast.error(error.message || "Failed to get deletion impact");
      setDeleteDialog({ open: false, name: "", loading: false });
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      setDeleteDialog((prev) => ({ ...prev, loading: true }));
      await api.deleteCharacteristicName(deleteDialog.name);
      toast.success("Characteristic name deleted successfully");
      setDeleteDialog({ open: false, name: "", loading: false });
      fetchNames();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete characteristic name");
      setDeleteDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  // Check if any filters are active
  const hasActiveFilters = activeFilters.length > 0;

  // Stats indicators configuration
  const statsIndicators: StatIndicator[] = [
    {
      label: "Total Names",
      value: stats.totalNames.toLocaleString(),
      suffix: hasActiveFilters ? "filtered" : undefined,
      icon: <Tag className="h-3.5 w-3.5" />,
      variant: "default",
    },
    {
      label: "Characteristics",
      value: stats.totalCharacteristics.toLocaleString(),
      suffix: "on page",
      icon: <Database className="h-3.5 w-3.5" />,
      variant: stats.totalCharacteristics > 0 ? "success" : "muted",
    },
    {
      label: "Total Stock",
      value: totalStockOnPage.toLocaleString(),
      suffix: "on page",
      icon: <Package className="h-3.5 w-3.5" />,
      variant: totalStockOnPage > 0 ? "success" : "warning",
    },
    {
      label: "Products",
      value: totalProductsOnPage.toLocaleString(),
      suffix: "on page",
      icon: <DollarSign className="h-3.5 w-3.5" />,
      variant: "muted",
    },
  ];

  if (loading && !names) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Characteristic Management</h1>
          <p className="text-muted-foreground">
            Browse characteristic names and values (product variants/SKUs)
          </p>
        </div>
        <CharacteristicBreadcrumb currentLevel={1} />
        <CharacteristicsPageSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Characteristic Management</h1>
        <p className="text-muted-foreground">
          Browse characteristic names and values (product variants/SKUs)
        </p>
      </div>

      {/* Breadcrumb */}
      <CharacteristicBreadcrumb currentLevel={1} />

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
              placeholder="Search characteristic names..."
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
            <SelectTrigger className="w-[200px] transition-all duration-200 hover:border-primary/50">
              <ArrowUpDown className="h-4 w-4 mr-1 text-muted-foreground" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name_asc">Name A-Z</SelectItem>
              <SelectItem value="name_desc">Name Z-A</SelectItem>
              <SelectItem value="characteristics_desc">Most characteristics</SelectItem>
              <SelectItem value="characteristics_asc">Least characteristics</SelectItem>
              <SelectItem value="products_desc">Most products</SelectItem>
              <SelectItem value="products_asc">Least products</SelectItem>
              <SelectItem value="stock_desc">Most stock</SelectItem>
              <SelectItem value="stock_asc">Least stock</SelectItem>
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

        {/* Names Table - Enhanced with shadow and rounded corners */}
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
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
                <TableHead className="text-right">
                  <button
                    onClick={() => handleColumnSort("characteristics")}
                    className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors group ml-auto"
                  >
                    Characteristics
                    <span className={`transition-all duration-200 ${currentSortField === "characteristics" ? "opacity-100" : "opacity-0 group-hover:opacity-50"}`}>
                      {currentSortField === "characteristics" && currentSortDirection === "desc" ? (
                        <ArrowDown className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowUp className="h-3.5 w-3.5" />
                      )}
                    </span>
                  </button>
                </TableHead>
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
                <TableHead className="text-right">Avg Price</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead className="text-right w-[180px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-48">
                    <div className="flex items-center justify-center py-8">
                      <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                        <p className="mt-2 text-sm text-muted-foreground">Loading characteristic names...</p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : !names || names.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-48">
                    <div className="flex flex-col items-center justify-center gap-3 py-8">
                      <div className="p-4 rounded-full bg-muted/50">
                        <Tag className="h-10 w-10 text-muted-foreground/50" />
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-foreground">No characteristic names found</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {hasActiveFilters
                            ? "Try adjusting your filters to find what you're looking for"
                            : "No names available"
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
                names.map((name, index) => (
                  <TableRow
                    key={name.name}
                    className={`
                      transition-all duration-200
                      ${rowsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
                    `}
                    style={{
                      transitionDelay: rowsVisible ? `${Math.min(index * 20, 400)}ms` : "0ms",
                    }}
                  >
                    <TableCell className="font-medium">
                      <span className="hover:text-primary transition-colors cursor-default">
                        {name.name}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {name.characteristic_count > 0 ? (
                        <Badge
                          variant="default"
                          className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20 transition-colors"
                        >
                          {name.characteristic_count.toLocaleString()}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="font-normal text-muted-foreground">
                          0
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {name.products_using.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {name.total_stock.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {name.avg_price ? name.avg_price.toFixed(2) : "-"}
                    </TableCell>
                    <TableCell>
                      {name.common_currency ? (
                        <Badge variant="outline" className="font-normal">
                          {name.common_currency}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            router.push(
                              `/characteristics/names/${encodeURIComponent(name.name)}`
                            )
                          }
                          className="transition-all duration-200 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                        >
                          <Eye className="mr-1.5 h-4 w-4" />
                          View Values
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(name.name)}
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
        {!loading && names && names.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <p>
                Showing <span className="font-medium text-foreground">{names.length}</span> of{" "}
                <span className="font-medium text-foreground">{totalCount.toLocaleString()}</span> names
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
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, name: "", loading: false })}
        onConfirm={handleDeleteConfirm}
        title="Delete Characteristic Name"
        description={`Are you sure you want to delete all characteristics with the name "${deleteDialog.name}"?`}
        impactData={deleteDialog.impact}
        isLoading={deleteDialog.loading}
      />
    </div>
  );
}

/**
 * Enhanced skeleton loader with row-by-row loading animation
 * Provides better visual feedback during initial load
 */
function CharacteristicsPageSkeleton() {
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
        <Skeleton className="h-10 w-[200px] rounded-md" />
      </div>

      {/* Table Skeleton with row-by-row animation */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-4 p-4 bg-muted/30 border-b">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-28 ml-auto" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-32" />
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
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-6 w-16 ml-auto rounded-full" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-6 w-12 rounded-full" />
            <Skeleton className="h-8 w-28 rounded-md" />
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
