"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { PropertyGroup, DeletionImpact } from "@/types";
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
  Layers,
  Package,
  Hash,
  Settings,
  Eye,
  Trash2,
  Loader2,
  X,
  SlidersHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { PropertyBreadcrumb } from "@/components/properties/PropertyBreadcrumb";
import { DeleteConfirmDialog } from "@/components/properties/DeleteConfirmDialog";
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
type SortField = "name" | "properties" | "values" | "products";
type SortDirection = "asc" | "desc";

export default function PropertiesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { localizeGroupName } = useLocalizedValue();
  const { t } = useTranslation('properties');
  const { t: tCommon } = useTranslation('common');

  // Get initial values from URL params
  const initialSearch = searchParams.get("search") || "";
  const initialOffset = parseInt(searchParams.get("offset") || "0", 10);
  const initialSortBy = searchParams.get("sort_by") || "name_asc";

  // State
  const [groups, setGroups] = useState<PropertyGroup[] | null>(null);
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
  const [cardsVisible, setCardsVisible] = useState(false);
  const [sectionsVisible, setSectionsVisible] = useState(false);

  // Deletion state
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    groupName: string;
    impact?: DeletionImpact;
    loading: boolean;
  }>({
    open: false,
    groupName: "",
    loading: false,
  });

  // Stats for cards
  const [stats, setStats] = useState({
    totalGroups: 0,
    totalProperties: 0,
    totalValues: 0,
    productsUsing: 0,
  });

  // Parse current sort field and direction
  const currentSortField = useMemo((): SortField => {
    if (sortBy.startsWith("name")) return "name";
    if (sortBy.startsWith("properties")) return "properties";
    if (sortBy.startsWith("values")) return "values";
    if (sortBy.startsWith("products")) return "products";
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
        name_desc: t('filters.nameZA'),
        properties_desc: t('filters.mostProperties'),
        properties_asc: t('filters.leastProperties'),
        values_desc: t('filters.mostValues'),
        values_asc: t('filters.leastValues'),
        products_desc: t('filters.mostProducts'),
        products_asc: t('filters.leastProducts'),
      };
      filters.push({
        key: "sort_by",
        label: tCommon('filters.sortBy'),
        value: sortBy,
        displayValue: sortLabels[sortBy] || sortBy,
      });
    }

    return filters;
  }, [debouncedSearch, sortBy, t, tCommon]);

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
    router.push(`/properties?${newParams.toString()}`);
  };

  // Fetch groups
  const fetchGroups = useCallback(async () => {
    try {
      setLoading(true);
      setRowsVisible(false);
      const response = await api.getPropertyGroups(limit, offset, debouncedSearch || undefined);
      setGroups(response.data || []);
      setTotalCount(response.total || 0);

      // Calculate stats from current data
      if (response.data && response.data.length > 0) {
        setStats({
          totalGroups: response.total,
          totalProperties: response.data.reduce((sum, g) => sum + g.property_count, 0),
          totalValues: response.data.reduce((sum, g) => sum + g.value_count, 0),
          productsUsing: response.data.reduce((sum, g) => sum + g.products_using, 0),
        });
      }

      // Trigger staggered animations after data loads
      setTimeout(() => setCardsVisible(true), 50);
      setTimeout(() => setSectionsVisible(true), 100);
      setTimeout(() => setRowsVisible(true), 150);
    } catch (error: any) {
      toast.error(error.message || t('messages.failedToFetch'));
      setGroups([]);
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
    fetchGroups();
  }, [fetchGroups]);

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

  // Total values on current page
  const totalValuesOnPage = useMemo(() => {
    return groups?.reduce((sum, g) => sum + g.value_count, 0) || 0;
  }, [groups]);

  // Total products on current page
  const totalProductsOnPage = useMemo(() => {
    return groups?.reduce((sum, g) => sum + g.products_using, 0) || 0;
  }, [groups]);

  const handleClearSearch = () => {
    setSearchQuery("");
    setDebouncedSearch("");
    updateUrlParams({ search: null, offset: "0" });
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setDebouncedSearch("");
    setSortBy("name_asc");
    router.push("/properties");
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
    } else if (field === "properties") {
      newSort = currentSortField === "properties" && currentSortDirection === "desc" ? "properties_asc" : "properties_desc";
    } else if (field === "values") {
      newSort = currentSortField === "values" && currentSortDirection === "desc" ? "values_asc" : "values_desc";
    } else if (field === "products") {
      newSort = currentSortField === "products" && currentSortDirection === "desc" ? "products_asc" : "products_desc";
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
  const handleDeleteClick = async (groupName: string) => {
    try {
      setDeleteDialog({ open: true, groupName, loading: true });
      const impact = await api.getGroupDeletionImpact(groupName);
      setDeleteDialog({ open: true, groupName, impact, loading: false });
    } catch (error: any) {
      toast.error(error.message || t('messages.failedToGetImpact'));
      setDeleteDialog({ open: false, groupName: "", loading: false });
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      setDeleteDialog((prev) => ({ ...prev, loading: true }));
      await api.deletePropertyGroup(deleteDialog.groupName);
      toast.success(t('messages.groupDeleted'));
      setDeleteDialog({ open: false, groupName: "", loading: false });
      fetchGroups();
    } catch (error: any) {
      toast.error(error.message || t('messages.failedToDelete'));
      setDeleteDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  // Check if any filters are active
  const hasActiveFilters = activeFilters.length > 0;

  if (loading && !groups) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('page.title')}</h1>
          <p className="text-muted-foreground">
            {t('page.description')}
          </p>
        </div>
        <PropertyBreadcrumb currentLevel={1} />
        <PropertiesPageSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('page.title')}</h1>
        <p className="text-muted-foreground">
          {t('page.description')}
        </p>
      </div>

      {/* Breadcrumb */}
      <PropertyBreadcrumb currentLevel={1} />

      <div className="space-y-4">
        {/* Stats Bar */}
        <div className="flex flex-wrap items-center gap-3">
          {[
            {
              label: t('stats.totalGroups'),
              value: stats.totalGroups.toLocaleString(),
              suffix: hasActiveFilters ? t('stats.filtered') : undefined,
              icon: <Layers className="h-3.5 w-3.5" />,
              variant: "default" as const,
            },
            {
              label: t('stats.totalProperties'),
              value: stats.totalProperties.toLocaleString(),
              icon: <Settings className="h-3.5 w-3.5" />,
              variant: stats.totalProperties > 0 ? "success" as const : "muted" as const,
            },
            {
              label: t('stats.totalValues'),
              value: totalValuesOnPage.toLocaleString(),
              suffix: t('stats.onPage'),
              icon: <Hash className="h-3.5 w-3.5" />,
              variant: totalValuesOnPage > 0 ? "success" as const : "muted" as const,
            },
            {
              label: t('stats.productsUsing'),
              value: totalProductsOnPage.toLocaleString(),
              suffix: t('stats.onPage'),
              icon: <Package className="h-3.5 w-3.5" />,
              variant: totalProductsOnPage > 0 ? "success" as const : "muted" as const,
            },
          ].map((stat, index) => (
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

        {/* Filters Section - Organized Card Layout */}
        <div
          className={`
            rounded-xl border bg-card shadow-sm overflow-hidden
            transition-all duration-300
            ${sectionsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
          `}
          style={{ transitionDelay: sectionsVisible ? "200ms" : "0ms" }}
        >
          {/* Header */}
          <div className="p-4 border-b">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-muted">
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-sm">{t('filters.searchGroups')}</h3>
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
                placeholder={t('filters.searchGroups')}
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

            {/* Sorting Section */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t('filters.sorting')}
              </h4>
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
                <Select value={sortBy} onValueChange={handleSortByChange}>
                  <SelectTrigger className="w-full transition-all duration-200 hover:border-primary/30">
                    <SelectValue placeholder={t('filters.sortBy')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name_asc">{t('filters.nameAZ')}</SelectItem>
                    <SelectItem value="name_desc">{t('filters.nameZA')}</SelectItem>
                    <SelectItem value="properties_desc">{t('filters.mostProperties')}</SelectItem>
                    <SelectItem value="properties_asc">{t('filters.leastProperties')}</SelectItem>
                    <SelectItem value="values_desc">{t('filters.mostValues')}</SelectItem>
                    <SelectItem value="values_asc">{t('filters.leastValues')}</SelectItem>
                    <SelectItem value="products_desc">{t('filters.mostProducts')}</SelectItem>
                    <SelectItem value="products_asc">{t('filters.leastProducts')}</SelectItem>
                  </SelectContent>
                </Select>
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
              ${sectionsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
            `}
            style={{ transitionDelay: sectionsVisible ? "250ms" : "0ms" }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="p-1 rounded bg-muted">
                  <SlidersHorizontal className="h-3 w-3" />
                </div>
                <span className="font-medium">{activeFilters.length} {activeFilters.length === 1 ? t('activeFilters') : t('activeFiltersPlural')}</span>
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
                {t('actions.clearAll')}
              </Button>
            </div>
          </div>
        )}

        {/* Groups Table - Enhanced with shadow, rounded corners and animation */}
        <div
          className={`
            rounded-xl border bg-card shadow-sm overflow-hidden
            transition-all duration-300
            ${sectionsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
          `}
          style={{ transitionDelay: sectionsVisible ? "250ms" : "0ms" }}
        >
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead>
                  <button
                    onClick={() => handleColumnSort("name")}
                    className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors group"
                  >
                    {t('table.groupName')}
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
                    onClick={() => handleColumnSort("properties")}
                    className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors group ml-auto"
                  >
                    {t('stats.properties')}
                    <span className={`transition-all duration-200 ${currentSortField === "properties" ? "opacity-100" : "opacity-0 group-hover:opacity-50"}`}>
                      {currentSortField === "properties" && currentSortDirection === "desc" ? (
                        <ArrowDown className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowUp className="h-3.5 w-3.5" />
                      )}
                    </span>
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button
                    onClick={() => handleColumnSort("values")}
                    className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors group ml-auto"
                  >
                    {t('stats.values')}
                    <span className={`transition-all duration-200 ${currentSortField === "values" ? "opacity-100" : "opacity-0 group-hover:opacity-50"}`}>
                      {currentSortField === "values" && currentSortDirection === "desc" ? (
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
                    {t('stats.products')}
                    <span className={`transition-all duration-200 ${currentSortField === "products" ? "opacity-100" : "opacity-0 group-hover:opacity-50"}`}>
                      {currentSortField === "products" && currentSortDirection === "desc" ? (
                        <ArrowDown className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowUp className="h-3.5 w-3.5" />
                      )}
                    </span>
                  </button>
                </TableHead>
                <TableHead>{t('table.commonFlags')}</TableHead>
                <TableHead className="text-right w-[180px]">{t('table.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48">
                    <div className="flex items-center justify-center py-8">
                      <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                        <p className="mt-2 text-sm text-muted-foreground">{t('messages.loadingGroups')}</p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : !groups || groups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48">
                    <div className="flex flex-col items-center justify-center gap-3 py-8">
                      <div className="p-4 rounded-full bg-muted/50">
                        <Database className="h-10 w-10 text-muted-foreground/50" />
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-foreground">{t('empty.noGroups')}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {hasActiveFilters
                            ? t('empty.adjustFilters')
                            : t('empty.noGroupsAvailable')
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
                          {t('actions.clearAllFilters')}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                groups.map((group, index) => (
                  <TableRow
                    key={group.group_name}
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
                        {localizeGroupName(group)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {group.property_count > 0 ? (
                        <Badge
                          variant="default"
                          className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20 transition-colors"
                        >
                          {group.property_count.toLocaleString()}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="font-normal text-muted-foreground">
                          0
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {group.value_count.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {group.products_using.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1.5">
                        {group.common_is_filter && (
                          <Badge variant="default" className="text-xs bg-green-500 hover:bg-green-600 transition-colors">
                            {t('table.filters')}
                          </Badge>
                        )}
                        {group.common_is_modification && (
                          <Badge variant="default" className="text-xs bg-blue-500 hover:bg-blue-600 transition-colors">
                            {t('table.mods')}
                          </Badge>
                        )}
                        {!group.common_is_filter && !group.common_is_modification && (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            router.push(
                              `/properties/groups/${encodeURIComponent(group.group_name)}`
                            )
                          }
                          className="transition-all duration-200 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                        >
                          <Eye className="mr-1.5 h-4 w-4" />
                          {t('actions.viewProperties')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(group.group_name)}
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
        {!loading && groups && groups.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <p>
                {t('pagination.showing')} <span className="font-medium text-foreground">{groups.length}</span> {t('pagination.of')}{" "}
                <span className="font-medium text-foreground">{totalCount.toLocaleString()}</span> {t('pagination.groups')}
              </p>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-2">
                <span>{t('pagination.rowsPerPage')}:</span>
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
                  title={t('pagination.firstPage')}
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
                  {t('pagination.previous')}
                </Button>

                {/* Page Info & Jump */}
                <div className="flex items-center gap-2 px-2">
                  <span className="text-sm text-muted-foreground">{t('pagination.page')}</span>
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
                  <span className="text-sm text-muted-foreground">{t('pagination.of')} {totalPages}</span>
                </div>

                {/* Next Page */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="transition-all duration-200 hover:bg-muted"
                >
                  {t('pagination.next')}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>

                {/* Last Page */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                  className="h-8 w-8 transition-all duration-200 hover:bg-muted"
                  title={t('pagination.lastPage')}
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
        onClose={() => setDeleteDialog({ open: false, groupName: "", loading: false })}
        onConfirm={handleDeleteConfirm}
        title={t('dialog.deleteTitle')}
        description={t('dialog.deleteDescription', { groupName: deleteDialog.groupName })}
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
function PropertiesPageSkeleton() {
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
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24 ml-auto" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
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
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-8 w-32 rounded-md" />
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
