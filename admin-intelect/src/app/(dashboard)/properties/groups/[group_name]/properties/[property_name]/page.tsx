"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { PropertyValue } from "@/types";
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
  Database,
  Package,
  Filter as FilterIcon,
  Settings,
  Edit,
  Trash2,
  Loader2,
  Hash,
  X,
  SlidersHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckSquare,
  Power,
  PowerOff,
} from "lucide-react";
import { PropertyBreadcrumb } from "@/components/properties/PropertyBreadcrumb";
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
type SortField = "value" | "product" | "sort_order";
type SortDirection = "asc" | "desc";

export default function PropertyValuesPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { localize } = useLocalizedValue();
  const { t } = useTranslation('properties');
  const { t: tCommon } = useTranslation('common');

  const groupName = decodeURIComponent(params.group_name as string);
  const propertyName = decodeURIComponent(params.property_name as string);

  // Get initial values from URL params
  const initialSearch = searchParams.get("search") || "";
  const initialOffset = parseInt(searchParams.get("offset") || "0", 10);
  const initialSortBy = searchParams.get("sort_by") || "value_asc";

  // State
  const [values, setValues] = useState<PropertyValue[] | null>(null);
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
  const [cardsVisible, setCardsVisible] = useState(false);
  const [sectionsVisible, setSectionsVisible] = useState(false);

  // Edit dialog state
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    value?: PropertyValue;
    loading: boolean;
  }>({
    open: false,
    loading: false,
  });

  const [editForm, setEditForm] = useState({
    value: "",
    value_type: "",
    sort_order: 0,
    is_filter: false,
    is_modification: false,
  });

  // Stats for cards
  const [stats, setStats] = useState({
    totalValues: 0,
    uniqueProducts: 0,
    filterProperties: 0,
    modificationProperties: 0,
  });

  // Parse current sort field and direction
  const currentSortField = useMemo((): SortField => {
    if (sortBy.startsWith("value")) return "value";
    if (sortBy.startsWith("product")) return "product";
    if (sortBy.startsWith("sort_order")) return "sort_order";
    return "value";
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
        label: t('filters.search'),
        value: debouncedSearch,
        displayValue: `"${debouncedSearch}"`,
      });
    }

    if (sortBy && sortBy !== "value_asc") {
      const sortLabels: Record<string, string> = {
        value_desc: t('filters.valueZA'),
        product_asc: t('filters.productAZ'),
        product_desc: t('filters.productZA'),
        sort_order_asc: t('filters.sortOrderAsc'),
        sort_order_desc: t('filters.sortOrderDesc'),
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
    router.push(`/properties/groups/${encodeURIComponent(groupName)}/properties/${encodeURIComponent(propertyName)}?${newParams.toString()}`);
  };

  // Fetch property values
  const fetchValues = useCallback(async () => {
    try {
      setLoading(true);
      setRowsVisible(false);
      const response = await api.getPropertyValues(
        groupName,
        propertyName,
        limit,
        offset,
        debouncedSearch || undefined
      );
      setValues(response.data || []);
      setTotalCount(response.total || 0);

      // Calculate stats from current data
      if (response.data && response.data.length > 0) {
        const uniqueProducts = new Set(response.data.map((v) => v.product_id)).size;
        const filterCount = response.data.filter((v) => v.is_filter).length;
        const modCount = response.data.filter((v) => v.is_modification).length;

        setStats({
          totalValues: response.total,
          uniqueProducts,
          filterProperties: filterCount,
          modificationProperties: modCount,
        });
      }

      // Trigger staggered animations after data loads
      setTimeout(() => setCardsVisible(true), 50);
      setTimeout(() => setSectionsVisible(true), 100);
      setTimeout(() => setRowsVisible(true), 150);
    } catch (error: any) {
      toast.error(error.message || t('messages.failedToFetchValues'));
      setValues([]);
    } finally {
      setLoading(false);
      setIsSearching(false);
      // Refocus search input after fetch completes
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }
  }, [groupName, propertyName, limit, offset, debouncedSearch]);

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
    setSortBy("value_asc");
    router.push(`/properties/groups/${encodeURIComponent(groupName)}/properties/${encodeURIComponent(propertyName)}`);
  };

  const handleRemoveFilter = (filterKey: string) => {
    switch (filterKey) {
      case "search":
        handleClearSearch();
        break;
      case "sort_by":
        setSortBy("value_asc");
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

    if (field === "value") {
      newSort = currentSortField === "value" && currentSortDirection === "asc" ? "value_desc" : "value_asc";
    } else if (field === "product") {
      newSort = currentSortField === "product" && currentSortDirection === "asc" ? "product_desc" : "product_asc";
    } else if (field === "sort_order") {
      newSort = currentSortField === "sort_order" && currentSortDirection === "asc" ? "sort_order_desc" : "sort_order_asc";
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
  const handleEditClick = (value: PropertyValue) => {
    setEditForm({
      value: value.value || "",
      value_type: value.value_type || "",
      sort_order: value.sort_order,
      is_filter: value.is_filter,
      is_modification: value.is_modification,
    });
    setEditDialog({ open: true, value, loading: false });
  };

  const handleEditSave = async () => {
    if (!editDialog.value) return;

    try {
      setEditDialog((prev) => ({ ...prev, loading: true }));
      await api.updatePropertyValue(editDialog.value.id, editForm);
      toast.success(t('messages.valueUpdated'));
      setEditDialog({ open: false, loading: false });
      fetchValues();
    } catch (error: any) {
      toast.error(error.message || t('messages.failedToUpdateValue'));
      setEditDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  // Delete handlers
  const handleDelete = async (id: string) => {
    if (!confirm(t('messages.confirmDeleteValue'))) return;

    try {
      await api.deletePropertyValue(id);
      toast.success(t('messages.valueDeleted'));
      fetchValues();
    } catch (error: any) {
      toast.error(error.message || t('messages.failedToDeleteValue'));
    }
  };

  // Bulk operations
  const handleBulkUpdate = async (updates: {
    is_filter?: boolean;
    is_modification?: boolean;
  }) => {
    if (selectedIds.size === 0) return;

    try {
      await api.bulkUpdatePropertyValues(
        groupName,
        propertyName,
        Array.from(selectedIds),
        updates
      );
      toast.success(t('messages.valuesUpdated', { count: selectedIds.size }));
      setSelectedIds(new Set());
      fetchValues();
    } catch (error: any) {
      toast.error(error.message || t('messages.failedToUpdateValues'));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(t('messages.confirmDeleteValues', { count: selectedIds.size }))) return;

    try {
      await api.bulkDeletePropertyValues(
        groupName,
        propertyName,
        Array.from(selectedIds)
      );
      toast.success(t('messages.valuesDeleted', { count: selectedIds.size }));
      setSelectedIds(new Set());
      fetchValues();
    } catch (error: any) {
      toast.error(error.message || t('messages.failedToDeleteValues'));
    }
  };

  // Check if any filters are active
  const hasActiveFilters = activeFilters.length > 0;

  // Check selection states
  const isSomeSelected = selectedIds.size > 0;
  const isAllOnPageSelected = values && values.length > 0 && selectedIds.size === values.length ? true : false;

  if (loading && !values) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('page.valuesTitle')}</h1>
          <p className="text-muted-foreground">
            {t('page.valuesDescription', { propertyName })}
          </p>
        </div>
        <PropertyBreadcrumb
          currentLevel={3}
          groupName={groupName}
          propertyName={propertyName}
        />
        <PropertyValuesPageSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('page.valuesTitle')}</h1>
        <p className="text-muted-foreground">
          {t('page.valuesDescription', { propertyName })}
        </p>
      </div>

      {/* Breadcrumb */}
      <PropertyBreadcrumb
        currentLevel={3}
        groupName={groupName}
        propertyName={propertyName}
      />

      <div className="space-y-4">
        {/* Stats Bar */}
        <div className="flex flex-wrap items-center gap-3">
          {[
            {
              label: t('stats.totalValues'),
              value: stats.totalValues.toLocaleString(),
              suffix: hasActiveFilters ? t('stats.filtered') : undefined,
              icon: <Hash className="h-3.5 w-3.5" />,
              variant: "default" as const,
            },
            {
              label: t('stats.uniqueProducts'),
              value: stats.uniqueProducts.toLocaleString(),
              icon: <Package className="h-3.5 w-3.5" />,
              variant: stats.uniqueProducts > 0 ? "success" as const : "muted" as const,
            },
            {
              label: t('stats.filterProperties'),
              value: stats.filterProperties.toLocaleString(),
              icon: <FilterIcon className="h-3.5 w-3.5" />,
              variant: stats.filterProperties > 0 ? "success" as const : "muted" as const,
            },
            {
              label: t('stats.modificationProperties'),
              value: stats.modificationProperties.toLocaleString(),
              icon: <Settings className="h-3.5 w-3.5" />,
              variant: stats.modificationProperties > 0 ? "success" as const : "muted" as const,
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
              <h3 className="font-semibold text-sm">{t('filters.searchValues')}</h3>
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
                placeholder={t('filters.searchValues')}
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
                    <SelectItem value="value_asc">{t('filters.valueAZ')}</SelectItem>
                    <SelectItem value="value_desc">{t('filters.valueZA')}</SelectItem>
                    <SelectItem value="product_asc">{t('filters.productAZ')}</SelectItem>
                    <SelectItem value="product_desc">{t('filters.productZA')}</SelectItem>
                    <SelectItem value="sort_order_asc">{t('filters.sortOrderAsc')}</SelectItem>
                    <SelectItem value="sort_order_desc">{t('filters.sortOrderDesc')}</SelectItem>
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

        {/* Bulk Actions Bar - Enhanced with premium styling and animation */}
        {isSomeSelected && (
          <div
            className={`
              flex items-center gap-4 p-3 bg-primary/5 rounded-xl border border-primary/20
              transition-all duration-300 animate-in fade-in-0 slide-in-from-top-2
              ${sectionsVisible ? "opacity-100" : "opacity-0"}
            `}
          >
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-primary/10">
                <CheckSquare className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">
                {selectedIds.size !== 1 ? t('bulk.selectedPlural', { count: selectedIds.size }) : t('bulk.selected', { count: selectedIds.size })}
              </span>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkUpdate({ is_filter: true })}
                className="transition-all duration-200 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
              >
                <Power className="h-4 w-4 mr-1.5" />
                {t('actions.setAsFilter')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkUpdate({ is_modification: true })}
                className="transition-all duration-200 hover:bg-blue-500/10 hover:text-blue-600 hover:border-blue-500/30"
              >
                <Settings className="h-4 w-4 mr-1.5" />
                {t('actions.setAsModification')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkDelete}
                className="transition-all duration-200 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
              >
                <Trash2 className="h-4 w-4 mr-1.5" />
                {t('actions.deleteSelected')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
              >
                <X className="h-4 w-4 mr-1" />
                {t('actions.clear')}
              </Button>
            </div>
          </div>
        )}

        {/* Values Table - Enhanced with shadow, rounded corners and animation */}
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
                <TableHead className="w-12">
                  <Checkbox
                    checked={isAllOnPageSelected}
                    onCheckedChange={toggleSelectAll}
                    className="transition-transform duration-200 hover:scale-110"
                  />
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleColumnSort("value")}
                    className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors group"
                  >
                    {t('table.value')}
                    <span className={`transition-all duration-200 ${currentSortField === "value" ? "opacity-100" : "opacity-0 group-hover:opacity-50"}`}>
                      {currentSortField === "value" && currentSortDirection === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5" />
                      )}
                    </span>
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleColumnSort("product")}
                    className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors group"
                  >
                    {t('table.product')}
                    <span className={`transition-all duration-200 ${currentSortField === "product" ? "opacity-100" : "opacity-0 group-hover:opacity-50"}`}>
                      {currentSortField === "product" && currentSortDirection === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5" />
                      )}
                    </span>
                  </button>
                </TableHead>
                <TableHead>{t('table.productCode')}</TableHead>
                <TableHead>{t('table.type')}</TableHead>
                <TableHead className="text-center">
                  <button
                    onClick={() => handleColumnSort("sort_order")}
                    className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors group"
                  >
                    {t('table.sortOrder')}
                    <span className={`transition-all duration-200 ${currentSortField === "sort_order" ? "opacity-100" : "opacity-0 group-hover:opacity-50"}`}>
                      {currentSortField === "sort_order" && currentSortDirection === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5" />
                      )}
                    </span>
                  </button>
                </TableHead>
                <TableHead className="text-center">{t('table.filter')}</TableHead>
                <TableHead className="text-center">{t('table.modification')}</TableHead>
                <TableHead className="text-right w-[100px]">{t('table.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-48">
                    <div className="flex items-center justify-center py-8">
                      <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                        <p className="mt-2 text-sm text-muted-foreground">{t('messages.loadingValues')}</p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : !values || values.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-48">
                    <div className="flex flex-col items-center justify-center gap-3 py-8">
                      <div className="p-4 rounded-full bg-muted/50">
                        <Database className="h-10 w-10 text-muted-foreground/50" />
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-foreground">{t('empty.noValues')}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {hasActiveFilters
                            ? t('empty.adjustFilters')
                            : t('empty.noValuesForProperty')
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
                    <TableCell className="font-medium max-w-xs">
                      <span className="hover:text-primary transition-colors cursor-default truncate block">
                        {localize(value, "value")}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {value.product_name || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      {value.product_code ? (
                        <Badge variant="outline" className="font-mono text-xs">
                          {value.product_code}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {value.value_type ? (
                        <Badge variant="secondary" className="transition-colors hover:bg-secondary/80">
                          {value.value_type}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="inline-flex items-center gap-1 text-muted-foreground">
                        <Hash className="h-3 w-3" />
                        <span className="tabular-nums">{value.sort_order}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {value.is_filter ? (
                        <Badge variant="default" className="text-xs bg-green-500 hover:bg-green-600 transition-colors">
                          {t('table.yes')}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">{t('table.no')}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {value.is_modification ? (
                        <Badge variant="default" className="text-xs bg-blue-500 hover:bg-blue-600 transition-colors">
                          {t('table.yes')}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">{t('table.no')}</span>
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
                {t('pagination.showing')} <span className="font-medium text-foreground">{values.length}</span> {t('pagination.of')}{" "}
                <span className="font-medium text-foreground">{totalCount.toLocaleString()}</span> {t('pagination.values')}
              </p>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-2">
                <span>{t('pagination.rowsPerPage')}:</span>
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

      {/* Edit Dialog - Enhanced styling */}
      <Dialog open={editDialog.open} onOpenChange={(open) => setEditDialog({ open, loading: false })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('dialog.editValueTitle')}</DialogTitle>
            <DialogDescription>
              {t('dialog.editValueDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="value">{t('form.value')}</Label>
              <Input
                id="value"
                value={editForm.value}
                onChange={(e) => setEditForm({ ...editForm, value: e.target.value })}
                className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="value_type">{t('form.valueType')}</Label>
              <Input
                id="value_type"
                value={editForm.value_type}
                onChange={(e) => setEditForm({ ...editForm, value_type: e.target.value })}
                className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sort_order">{t('form.sortOrder')}</Label>
              <Input
                id="sort_order"
                type="number"
                value={editForm.sort_order}
                onChange={(e) =>
                  setEditForm({ ...editForm, sort_order: parseInt(e.target.value) || 0 })
                }
                className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_filter"
                  checked={editForm.is_filter}
                  onCheckedChange={(checked) =>
                    setEditForm({ ...editForm, is_filter: checked as boolean })
                  }
                  className="transition-transform duration-200 hover:scale-110"
                />
                <Label htmlFor="is_filter" className="text-sm font-normal">{t('form.isFilter')}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_modification"
                  checked={editForm.is_modification}
                  onCheckedChange={(checked) =>
                    setEditForm({ ...editForm, is_modification: checked as boolean })
                  }
                  className="transition-transform duration-200 hover:scale-110"
                />
                <Label htmlFor="is_modification" className="text-sm font-normal">{t('form.isModification')}</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialog({ open: false, loading: false })}
              disabled={editDialog.loading}
              className="transition-all duration-200"
            >
              {t('form.cancel')}
            </Button>
            <Button
              onClick={handleEditSave}
              disabled={editDialog.loading}
              className="transition-all duration-200"
            >
              {editDialog.loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  {t('form.saving')}
                </>
              ) : (
                t('form.saveChanges')
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
function PropertyValuesPageSkeleton() {
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
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16 ml-auto" />
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
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-6 w-10 rounded-full" />
            <Skeleton className="h-6 w-10 rounded-full" />
            <Skeleton className="h-8 w-16 ml-auto rounded-md" />
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
