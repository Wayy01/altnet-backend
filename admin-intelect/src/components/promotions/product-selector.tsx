"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Loader2,
  Package,
  CheckSquare,
  Filter,
  DollarSign,
  Tag,
  FolderTree,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { api } from "@/lib/api";
import { Product, Brand, Category, ProductFilters } from "@/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/contexts/language-context";

interface ProductSelectorProps {
  promotionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProductsAdded: () => void;
}

export function ProductSelector({
  promotionId,
  open,
  onOpenChange,
  onProductsAdded,
}: ProductSelectorProps) {
  const { t } = useTranslation("promotions");
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Dropdowns
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingFilters, setLoadingFilters] = useState(true);

  // Load brands and categories
  useEffect(() => {
    if (open) {
      loadFilters();
    }
  }, [open]);

  const loadFilters = async () => {
    try {
      setLoadingFilters(true);
      const [brandsData, categoriesData] = await Promise.all([
        api.getAllBrands(),
        api.getAllCategories(),
      ]);
      setBrands(brandsData);
      setCategories(categoriesData);
    } catch (error) {
      console.error("Failed to load filters:", error);
    } finally {
      setLoadingFilters(false);
    }
  };

  // Build filters
  const currentFilters: ProductFilters = useMemo(() => {
    const filters: ProductFilters = {};
    if (searchQuery.trim()) filters.search = searchQuery.trim();
    if (brandFilter) filters.brand_id = brandFilter;
    if (categoryFilter) filters.category_id = categoryFilter;
    if (minPrice) filters.min_price = parseFloat(minPrice);
    if (maxPrice) filters.max_price = parseFloat(maxPrice);
    if (inStockOnly) filters.in_stock = true;
    return filters;
  }, [searchQuery, brandFilter, categoryFilter, minPrice, maxPrice, inStockOnly]);

  // Load products
  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const offset = (currentPage - 1) * pageSize;
      const response = await api.getProducts(currentFilters, pageSize, offset);
      setProducts(response.data);
      setTotal(response.total);
    } catch (error) {
      console.error("Failed to load products:", error);
      toast.error(t("toast.productsAddFailed"));
    } finally {
      setLoading(false);
    }
  }, [currentFilters, currentPage, t]);

  useEffect(() => {
    if (open) {
      loadProducts();
    }
  }, [open, loadProducts]);

  // Reset filters
  const handleReset = () => {
    setSearchQuery("");
    setBrandFilter("");
    setCategoryFilter("");
    setMinPrice("");
    setMaxPrice("");
    setInStockOnly(false);
    setCurrentPage(1);
  };

  // Selection handlers
  const handleSelectAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map((p) => p.id)));
    }
  };

  const handleSelectOne = (productId: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(productId);
    } else {
      newSelected.delete(productId);
    }
    setSelectedIds(newSelected);
  };

  // Add selected products
  const handleAddSelected = async () => {
    if (selectedIds.size === 0) {
      toast.error(t("toast.selectAtLeastOne"));
      return;
    }

    try {
      setAdding(true);
      await api.addProductsToPromotion(promotionId, Array.from(selectedIds));
      toast.success(t("toast.productsAddedSuccess", { count: selectedIds.size }));
      setSelectedIds(new Set());
      onProductsAdded();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to add products:", error);
      toast.error(t("toast.productsAddFailed"));
    } finally {
      setAdding(false);
    }
  };

  // Add all matching products
  const handleAddAllMatching = async () => {
    try {
      setAdding(true);
      const result = await api.bulkAddProductsToPromotion(promotionId, {
        brand_id: brandFilter || undefined,
        category_id: categoryFilter || undefined,
        min_price: minPrice ? parseFloat(minPrice) : undefined,
        max_price: maxPrice ? parseFloat(maxPrice) : undefined,
        in_stock: inStockOnly || undefined,
      });
      toast.success(t("toast.productsAddedSuccess", { count: total }));
      setSelectedIds(new Set());
      onProductsAdded();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to add products:", error);
      toast.error(t("toast.productsAddFailed"));
    } finally {
      setAdding(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize);
  const isAllSelected = products.length > 0 && selectedIds.size === products.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{t("productSelector.title")}</DialogTitle>
          <DialogDescription>
            {t("productSelector.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Filters */}
          <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Filter className="h-4 w-4" />
              {t("productSelector.filters")}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("productSelector.search")}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10"
              />
            </div>

            {/* Filter Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Brand */}
              <div className="space-y-1.5">
                <Label className="text-xs">{t("productSelector.brand")}</Label>
                <Select
                  value={brandFilter}
                  onValueChange={(value) => {
                    setBrandFilter(value === "all" ? "" : value);
                    setCurrentPage(1);
                  }}
                  disabled={loadingFilters}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("productSelector.allBrands")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("productSelector.allBrands")}</SelectItem>
                    {brands.map((brand) => (
                      <SelectItem key={brand.id} value={brand.id}>
                        {brand.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <Label className="text-xs">{t("productSelector.category")}</Label>
                <Select
                  value={categoryFilter}
                  onValueChange={(value) => {
                    setCategoryFilter(value === "all" ? "" : value);
                    setCurrentPage(1);
                  }}
                  disabled={loadingFilters}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("productSelector.allCategories")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("productSelector.allCategories")}</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Min Price */}
              <div className="space-y-1.5">
                <Label className="text-xs">{t("productSelector.minPrice")}</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={minPrice}
                  onChange={(e) => {
                    setMinPrice(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>

              {/* Max Price */}
              <div className="space-y-1.5">
                <Label className="text-xs">{t("productSelector.maxPrice")}</Label>
                <Input
                  type="number"
                  placeholder="9999"
                  value={maxPrice}
                  onChange={(e) => {
                    setMaxPrice(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>

              {/* In Stock */}
              <div className="space-y-1.5">
                <Label className="text-xs">{t("productSelector.stockStatus")}</Label>
                <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-background">
                  <Switch
                    checked={inStockOnly}
                    onCheckedChange={(checked) => {
                      setInStockOnly(checked);
                      setCurrentPage(1);
                    }}
                  />
                  <span className="text-sm">{t("productSelector.inStockOnly")}</span>
                </div>
              </div>

              {/* Reset Button */}
              <div className="space-y-1.5">
                <Label className="text-xs">&nbsp;</Label>
                <Button
                  variant="outline"
                  onClick={handleReset}
                  className="w-full"
                >
                  {t("productSelector.resetFilters")}
                </Button>
              </div>
            </div>
          </div>

          {/* Selection Info */}
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between p-3 bg-primary/10 border border-primary/20 rounded-lg">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CheckSquare className="h-4 w-4 text-primary" />
                {t("productSelector.selectedCount", { count: selectedIds.size })}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds(new Set())}
              >
                {t("productSelector.clearSelection")}
              </Button>
            </div>
          )}

          {/* Products Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>{t("productSelector.tableProduct")}</TableHead>
                  <TableHead>{t("productSelector.tableBrand")}</TableHead>
                  <TableHead>{t("productSelector.tableCategory")}</TableHead>
                  <TableHead className="text-right">{t("productSelector.tablePrice")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Package className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">{t("productSelector.noProductsFound")}</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(product.id)}
                          onCheckedChange={(checked) =>
                            handleSelectOne(product.id, checked as boolean)
                          }
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div>
                          <div>{product.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {product.code}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {product.brand_name || "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {product.category_name || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {product.price_mdl !== null ? (
                          <span className="font-medium">
                            {product.price_mdl.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {t("productSelector.showingOf", { showing: products.length, total })}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || loading}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  {t("productSelector.page")} {currentPage} {t("productSelector.of")} {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || loading}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0">
          <div className="flex items-center justify-between w-full gap-3">
            <Button
              variant="outline"
              onClick={() => handleAddAllMatching()}
              disabled={adding || total === 0}
            >
              {adding ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckSquare className="mr-2 h-4 w-4" />
              )}
              {t("productSelector.selectAllMatching", { count: total })}
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t("actions.cancel")}
              </Button>
              <Button
                onClick={handleAddSelected}
                disabled={adding || selectedIds.size === 0}
              >
                {adding ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Package className="mr-2 h-4 w-4" />
                )}
                {t("productSelector.addSelected", { count: selectedIds.size })}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
