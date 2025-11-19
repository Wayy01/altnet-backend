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
  Loader2,
  Eye,
  Filter,
  ArrowUpDown,
  CheckSquare,
  Square,
  X,
  Power,
  PowerOff
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
import { api } from "@/lib/api";
import { Brand, BrandFilterOptions } from "@/types";
import { ConfirmDialog } from "@/components/confirm-dialog";

export default function BrandsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

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
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Filter states
  const [hasProductsFilter, setHasProductsFilter] = useState<string>(searchParams.get("has_products") || "");
  const [isActiveFilter, setIsActiveFilter] = useState<string>(searchParams.get("is_active") || "");
  const [sortBy, setSortBy] = useState<string>(searchParams.get("sort_by") || "name_asc");

  // Selection states
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAllMode, setSelectAllMode] = useState<boolean>(false);

  const limit = 100;
  const offset = parseInt(searchParams.get("offset") || "0", 10);
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  // Build current filter object
  const currentFilters: BrandFilterOptions = useMemo(() => ({
    search: debouncedSearch || undefined,
    has_products: hasProductsFilter || undefined,
    is_active: isActiveFilter || undefined,
    sort_by: sortBy || undefined,
  }), [debouncedSearch, hasProductsFilter, isActiveFilter, sortBy]);

  const fetchBrands = useCallback(async () => {
    try {
      setIsLoading(true);
      const brandsData = await api.getBrands(limit, offset, currentFilters);
      setBrands(brandsData.data);
      setTotal(brandsData.total);
      setError(null);
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
  }, [offset, currentFilters]);

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

  const handlePageChange = (newPage: number) => {
    const newOffset = (newPage - 1) * limit;
    // Clear page-level selection when changing pages (unless selectAllMode)
    if (!selectAllMode) {
      setSelectedIds(new Set());
    }
    updateUrlParams({ offset: newOffset.toString() });
  };

  const handleToggleActive = async (brandId: string, isActive: boolean) => {
    setIsProcessing(true);
    try {
      await api.updateBrand(brandId, { is_active: isActive });
      toast.success(`Brand ${isActive ? "activated" : "deactivated"}`);
      startTransition(() => {
        fetchBrands();
      });
    } catch (error) {
      console.error("Failed to update brand:", error);
      toast.error("Failed to update brand status");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteBrand = async () => {
    if (!deleteBrandId) return;

    setIsProcessing(true);
    try {
      await api.deleteBrand(deleteBrandId);
      toast.success("Brand deleted successfully");
      setShowDeleteDialog(false);
      setDeleteBrandId(null);
      startTransition(() => {
        fetchBrands();
      });
    } catch (error) {
      console.error("Failed to delete brand:", error);
      toast.error("Failed to delete brand");
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
      toast.success(`Successfully activated ${result.updated} brands`);
      handleClearSelection();
      startTransition(() => {
        fetchBrands();
      });
    } catch (error) {
      console.error("Failed to bulk activate brands:", error);
      toast.error("Failed to activate brands");
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
      toast.success(`Successfully deactivated ${result.updated} brands`);
      handleClearSelection();
      startTransition(() => {
        fetchBrands();
      });
    } catch (error) {
      console.error("Failed to bulk deactivate brands:", error);
      toast.error("Failed to deactivate brands");
    } finally {
      setIsProcessing(false);
    }
  };

  // Check if any filters are active
  const hasActiveFilters = debouncedSearch || hasProductsFilter || isActiveFilter || sortBy !== "name_asc";

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Brands</h1>
          <p className="text-muted-foreground">
            View and manage all brands in the catalog
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
          <h1 className="text-3xl font-bold tracking-tight">Brands</h1>
          <p className="text-muted-foreground">
            View and manage all brands in the catalog
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
        <h1 className="text-3xl font-bold tracking-tight">Brands</h1>
        <p className="text-muted-foreground">
          View and manage all brands in the catalog
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
            <span className="text-xs font-medium text-muted-foreground">With Logos</span>
            <span className="text-sm font-semibold tabular-nums">{brandsWithLogos}</span>
            <span className="text-[10px] text-muted-foreground">on page</span>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-md border">
            <span className="text-xs font-medium text-muted-foreground">Showing</span>
            <span className="text-sm font-semibold tabular-nums">{filteredBrands.length}</span>
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
              placeholder="Search brands..."
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
                <SelectItem value="all">All brands</SelectItem>
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
          <div className="flex items-center gap-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                {selectAllMode
                  ? `All ${total} matching brands selected`
                  : `${selectedIds.size} brand${selectedIds.size !== 1 ? "s" : ""} selected`
                }
              </span>
            </div>

            {isAllOnPageSelected && !selectAllMode && total > filteredBrands.length && (
              <Button
                variant="link"
                size="sm"
                className="text-blue-600"
                onClick={handleSelectAllMatching}
              >
                Select all {total} matching brands
              </Button>
            )}

            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkActivate}
                disabled={isProcessing || isPending}
                className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
              >
                <Power className="h-4 w-4 mr-1" />
                Activate
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkDeactivate}
                disabled={isProcessing || isPending}
                className="bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
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

        {/* Brands Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={isAllOnPageSelected && filteredBrands.length > 0}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead className="w-[60px]">Logo</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Ultra ID</TableHead>
                <TableHead className="text-right">Products</TableHead>
                <TableHead className="w-[80px]">Active</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBrands.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Building2 className="h-8 w-8 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        No brands found
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredBrands.map((brand) => (
                  <TableRow key={brand.id} className={selectedIds.has(brand.id) || selectAllMode ? "bg-blue-50 dark:bg-blue-950/50" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(brand.id) || selectAllMode}
                        onCheckedChange={(checked) => handleSelectOne(brand.id, checked as boolean)}
                        aria-label={`Select ${brand.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Avatar className="h-8 w-8">
                        {brand.logo_url ? (
                          <AvatarImage src={brand.logo_url} alt={brand.name} />
                        ) : null}
                        <AvatarFallback>
                          {brand.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">{brand.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {brand.slug}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {brand.ultra_id}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">
                        {brand.product_count || 0}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={brand.is_active}
                        onCheckedChange={(checked) =>
                          handleToggleActive(brand.id, checked)
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
                            <Link href={`/brands/${brand.id}`}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/products?brand_id=${brand.id}`}>
                              <ExternalLink className="mr-2 h-4 w-4" />
                              View Products
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              setDeleteBrandId(brand.id);
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
            Showing {filteredBrands.length} of {total} brands
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

      {/* Delete Brand Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Brand"
        description="Are you sure you want to delete this brand? This action cannot be undone and may affect associated products."
        confirmLabel="Delete"
        onConfirm={handleDeleteBrand}
        variant="destructive"
        isLoading={isProcessing}
      />
    </div>
  );
}

function BrandsPageSkeleton() {
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
