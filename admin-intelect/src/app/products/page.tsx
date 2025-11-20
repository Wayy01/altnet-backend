"use client";

import { useState, useEffect, useCallback, useTransition, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Package,
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
  PowerOff,
  Download,
  DollarSign,
  PackageOpen,
  Tag,
  FolderTree
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Product, Brand, Category, ProductFilters } from "@/types";
import { ConfirmDialog } from "@/components/confirm-dialog";

export default function ProductsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

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
  const [priceFilter, setPriceFilter] = useState<string>(searchParams.get("price_filter") || "");
  const [stockFilter, setStockFilter] = useState<string>(searchParams.get("stock_filter") || "");
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get("status_filter") || "");
  const [sortBy, setSortBy] = useState<string>(searchParams.get("sort_by") || "name_asc");

  // Selection states
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAllMode, setSelectAllMode] = useState<boolean>(false);

  // Load all brands and categories for dropdowns
  const [allBrands, setAllBrands] = useState<Brand[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);

  const limit = 50;
  const offset = parseInt(searchParams.get("offset") || "0", 10);
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  // Build current filter object
  const currentFilters: ProductFilters = useMemo(() => ({
    search: debouncedSearch || undefined,
    brand_id: brandFilter || undefined,
    category_id: categoryFilter || undefined,
    price_filter: priceFilter || undefined,
    stock_filter: stockFilter || undefined,
    status_filter: statusFilter || undefined,
    sort_by: sortBy || undefined,
  }), [debouncedSearch, brandFilter, categoryFilter, priceFilter, stockFilter, statusFilter, sortBy]);

  // Load all brands and categories for filter dropdowns
  useEffect(() => {
    async function loadFilters() {
      try {
        setIsLoadingFilters(true);
        const [brandsData, categoriesData] = await Promise.all([
          api.getAllBrands(),
          api.getAllCategories(),
        ]);
        setAllBrands(brandsData);
        setAllCategories(categoriesData);
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
      const productsData = await api.getProducts(currentFilters, limit, offset);
      setProducts(productsData.data);
      setTotal(productsData.total);
      setError(null);
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
    setPriceFilter("");
    setStockFilter("");
    setStatusFilter("");
    setSortBy("name_asc");
    router.push("/products");
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

  const handlePageChange = (newPage: number) => {
    const newOffset = (newPage - 1) * limit;
    // Clear page-level selection when changing pages (unless selectAllMode)
    if (!selectAllMode) {
      setSelectedIds(new Set());
    }
    updateUrlParams({ offset: newOffset.toString() });
  };

  const handleToggleActive = async (productId: string, isActive: boolean) => {
    setIsProcessing(true);
    try {
      await api.updateProduct(productId, { is_active: isActive });
      toast.success(`Product ${isActive ? "activated" : "deactivated"}`);
      startTransition(() => {
        fetchProducts();
      });
    } catch (error) {
      console.error("Failed to update product:", error);
      toast.error("Failed to update product status");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!deleteProductId) return;

    setIsProcessing(true);
    try {
      await api.deleteProduct(deleteProductId);
      toast.success("Product deleted successfully");
      setShowDeleteDialog(false);
      setDeleteProductId(null);
      startTransition(() => {
        fetchProducts();
      });
    } catch (error) {
      console.error("Failed to delete product:", error);
      toast.error("Failed to delete product");
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
        toast.info("No products were updated (may already be active)");
      } else {
        toast.success(`Successfully activated ${result.updated} product${result.updated === 1 ? "" : "s"}`);
      }
      handleClearSelection();
      startTransition(() => {
        fetchProducts();
      });
    } catch (error) {
      console.error("Failed to bulk activate products:", error);
      toast.error("Failed to activate products");
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
        toast.info("No products were updated (may already be inactive)");
      } else {
        toast.success(`Successfully deactivated ${result.updated} product${result.updated === 1 ? "" : "s"}`);
      }
      handleClearSelection();
      startTransition(() => {
        fetchProducts();
      });
    } catch (error) {
      console.error("Failed to bulk deactivate products:", error);
      toast.error("Failed to deactivate products");
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
      toast.success("Products exported successfully");
    } catch (error) {
      console.error("Failed to export products:", error);
      toast.error("Failed to export products");
    } finally {
      setIsProcessing(false);
    }
  };

  // Check if any filters are active
  const hasActiveFilters = debouncedSearch || brandFilter || categoryFilter || priceFilter || stockFilter || statusFilter || sortBy !== "name_asc";

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground">
            Manage and view all products in the catalog
          </p>
        </div>
        <ProductsPageSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground">
            Manage and view all products in the catalog
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
        <h1 className="text-3xl font-bold tracking-tight">Products</h1>
        <p className="text-muted-foreground">
          Manage and view all products in the catalog
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
            <span className="text-xs font-medium text-muted-foreground">With Prices</span>
            <span className="text-sm font-semibold tabular-nums">{productsWithPrices}</span>
            <span className="text-[10px] text-muted-foreground">on page</span>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-md border">
            <span className="text-xs font-medium text-muted-foreground">In Stock</span>
            <span className="text-sm font-semibold tabular-nums">{productsInStock}</span>
            <span className="text-[10px] text-muted-foreground">on page</span>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-md border">
            <span className="text-xs font-medium text-muted-foreground">Showing</span>
            <span className="text-sm font-semibold tabular-nums">{filteredProducts.length}</span>
            <span className="text-[10px] text-muted-foreground">of {total}</span>
          </div>

          {/* Export Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={isProcessing}
            className="ml-auto"
          >
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="relative">
            <Input
              ref={searchInputRef}
              name="search"
              placeholder="Search products..."
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

          {/* Brand Filter */}
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-muted-foreground" />
            <Select value={brandFilter || "all"} onValueChange={handleBrandChange} disabled={isLoadingFilters}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Brand" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="all">All brands</SelectItem>
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
            <FolderTree className="h-4 w-4 text-muted-foreground" />
            <Select value={categoryFilter || "all"} onValueChange={handleCategoryChange} disabled={isLoadingFilters}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="all">All categories</SelectItem>
                {allCategories.map(category => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Price Filter */}
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <Select value={priceFilter || "all"} onValueChange={handlePriceFilterChange}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Price" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="with_price">With Price</SelectItem>
                <SelectItem value="no_price">No Price</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Stock Filter */}
          <div className="flex items-center gap-2">
            <PackageOpen className="h-4 w-4 text-muted-foreground" />
            <Select value={stockFilter || "all"} onValueChange={handleStockFilterChange}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Stock" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="in_stock">In Stock</SelectItem>
                <SelectItem value="out_stock">Out of Stock</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Power className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter || "all"} onValueChange={handleStatusFilterChange}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
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
                <SelectItem value="price_high">Highest Price</SelectItem>
                <SelectItem value="price_low">Lowest Price</SelectItem>
                <SelectItem value="stock_high">Most Stock</SelectItem>
                <SelectItem value="stock_low">Least Stock</SelectItem>
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
                  ? `All ${total} matching products selected`
                  : `${selectedIds.size} product${selectedIds.size !== 1 ? "s" : ""} selected`
                }
              </span>
            </div>

            {isAllOnPageSelected && !selectAllMode && total > filteredProducts.length && (
              <Button
                variant="link"
                size="sm"
                className="text-primary"
                onClick={handleSelectAllMatching}
              >
                Select all {total} matching products
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

        {/* Products Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={isAllOnPageSelected && filteredProducts.length > 0}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Price (MDL)</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="w-[80px]">Active</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="h-8 w-8 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        No products found
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((product) => (
                  <TableRow key={product.id} className={selectedIds.has(product.id) || selectAllMode ? "bg-accent" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(product.id) || selectAllMode}
                        onCheckedChange={(checked) => handleSelectOne(product.id, checked as boolean)}
                        aria-label={`Select ${product.name}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium max-w-[300px] truncate">
                      <Link href={`/products/${product.id}`} className="hover:underline">
                        {product.name}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {product.code}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {product.brand_name || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {product.category_name || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {product.price_mdl !== null ? (
                        <span className="font-medium">
                          {product.price_mdl.toLocaleString()} MDL
                        </span>
                      ) : (
                        <Badge variant="outline">No price</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {product.is_in_stock ? (
                        <Badge variant="default" className="bg-primary/10 text-primary hover:bg-primary/20">
                          {product.total_stock}
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="bg-destructive/10 text-destructive hover:bg-destructive/20">
                          Out of stock
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={product.is_active}
                        onCheckedChange={(checked) =>
                          handleToggleActive(product.id, checked)
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
                            <Link href={`/products/${product.id}`}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() =>
                              handleToggleActive(product.id, !product.is_active)
                            }
                          >
                            <Power className="mr-2 h-4 w-4" />
                            {product.is_active ? "Deactivate" : "Activate"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              setDeleteProductId(product.id);
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
            Showing {filteredProducts.length} of {total} products
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

      {/* Delete Product Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Product"
        description="Are you sure you want to delete this product? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDeleteProduct}
        variant="destructive"
        isLoading={isProcessing}
      />
    </div>
  );
}

function ProductsPageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-32 rounded-md" />
        ))}
      </div>
      <div className="flex flex-wrap gap-4">
        <Skeleton className="h-10 w-[250px]" />
        <Skeleton className="h-10 w-[200px]" />
        <Skeleton className="h-10 w-[200px]" />
        <Skeleton className="h-10 w-[140px]" />
        <Skeleton className="h-10 w-[140px]" />
        <Skeleton className="h-10 w-[140px]" />
        <Skeleton className="h-10 w-[180px]" />
      </div>
      <Skeleton className="h-[600px] w-full" />
    </div>
  );
}
