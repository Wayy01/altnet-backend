"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Eye,
  Package,
  MoreHorizontal,
  Download,
  Trash2,
  Power,
  PowerOff,
} from "lucide-react";
import { Product, Brand, Category } from "@/types";
import { api } from "@/lib/api";
import { ConfirmDialog } from "@/components/confirm-dialog";

interface ProductsTableProps {
  products: Product[];
  brands: Brand[];
  categories: Category[];
  total: number;
  limit: number;
  offset: number;
  isLoading?: boolean;
}

export function ProductsTable({
  products,
  brands,
  categories,
  total,
  limit,
  offset,
  isLoading,
}: ProductsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState(
    searchParams.get("search") || ""
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const currentPage = limit > 0 ? Math.floor(offset / limit) + 1 : 1;
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 1;

  const updateQueryParams = (params: Record<string, string | undefined>) => {
    const newParams = new URLSearchParams(searchParams.toString());

    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === "") {
        newParams.delete(key);
      } else {
        newParams.set(key, value);
      }
    });

    router.push(`/products?${newParams.toString()}`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateQueryParams({ search: searchQuery, offset: "0" });
  };

  const handlePageChange = (newPage: number) => {
    const newOffset = (newPage - 1) * limit;
    updateQueryParams({ offset: newOffset.toString() });
  };

  const handleBrandFilter = (brandId: string) => {
    updateQueryParams({
      brand_id: brandId === "all" ? undefined : brandId,
      offset: "0",
    });
  };

  const handleCategoryFilter = (categoryId: string) => {
    updateQueryParams({
      category_id: categoryId === "all" ? undefined : categoryId,
      offset: "0",
    });
  };

  const handleInStockFilter = (checked: boolean) => {
    updateQueryParams({
      in_stock: checked ? "true" : undefined,
      offset: "0",
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(products.map((p) => p.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectProduct = (productId: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, productId]);
    } else {
      setSelectedIds((prev) => prev.filter((id) => id !== productId));
    }
  };

  const handleToggleActive = async (productId: string, isActive: boolean) => {
    setIsProcessing(true);
    try {
      await api.updateProduct(productId, { is_active: isActive });
      toast.success(`Product ${isActive ? "activated" : "deactivated"}`);
      startTransition(() => {
        router.refresh();
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
        router.refresh();
      });
    } catch (error) {
      console.error("Failed to delete product:", error);
      toast.error("Failed to delete product");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkActivate = async (activate: boolean) => {
    if (selectedIds.length === 0) return;

    setIsProcessing(true);
    try {
      await api.bulkUpdateProducts({
        ids: selectedIds,
        is_active: activate,
      });
      toast.success(
        `${selectedIds.length} products ${activate ? "activated" : "deactivated"}`
      );
      setSelectedIds([]);
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      console.error("Failed to bulk update products:", error);
      toast.error("Failed to update products");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;

    setIsProcessing(true);
    try {
      await api.bulkDeleteProducts({ ids: selectedIds });
      toast.success(`${selectedIds.length} products deleted`);
      setSelectedIds([]);
      setShowBulkDeleteDialog(false);
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      console.error("Failed to bulk delete products:", error);
      toast.error("Failed to delete products");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = async () => {
    try {
      const filters = {
        brand_id: searchParams.get("brand_id") || undefined,
        category_id: searchParams.get("category_id") || undefined,
        in_stock: searchParams.get("in_stock") === "true" ? true : undefined,
        format: "csv" as const,
      };

      const blob = await api.exportProducts(filters);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `products-export-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Products exported successfully");
    } catch (error) {
      console.error("Failed to export products:", error);
      toast.error("Failed to export products");
    }
  };

  if (isLoading) {
    return <ProductsTableSkeleton />;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 w-[300px]"
            />
          </div>
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>

        <div className="flex flex-wrap gap-2">
          <Select
            defaultValue={searchParams.get("brand_id") || "all"}
            onValueChange={handleBrandFilter}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by brand" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Brands</SelectItem>
              {brands.slice(0, 50).map((brand) => (
                <SelectItem key={brand.id} value={brand.id}>
                  {brand.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            defaultValue={searchParams.get("category_id") || "all"}
            onValueChange={handleCategoryFilter}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.slice(0, 50).map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="in_stock"
              checked={searchParams.get("in_stock") === "true"}
              onCheckedChange={handleInStockFilter}
            />
            <label
              htmlFor="in_stock"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              In Stock Only
            </label>
          </div>

          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
          <span className="text-sm font-medium">
            {selectedIds.length} selected
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBulkActivate(true)}
            disabled={isProcessing}
          >
            <Power className="mr-1 h-3 w-3" />
            Activate
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBulkActivate(false)}
            disabled={isProcessing}
          >
            <PowerOff className="mr-1 h-3 w-3" />
            Deactivate
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowBulkDeleteDialog(true)}
            disabled={isProcessing}
          >
            <Trash2 className="mr-1 h-3 w-3" />
            Delete
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedIds([])}
          >
            Clear
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={
                    products.length > 0 &&
                    selectedIds.length === products.length
                  }
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead className="w-[100px]">Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Price Range</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="w-[80px]">Active</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
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
              products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(product.id)}
                      onCheckedChange={(checked) =>
                        handleSelectProduct(product.id, checked as boolean)
                      }
                    />
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {product.code}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium line-clamp-1">
                        {product.name}
                      </span>
                      {product.article && (
                        <span className="text-xs text-muted-foreground">
                          {product.article}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {product.brand_name || (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {product.category_name || (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {product.price_min && product.price_max ? (
                      <span className="font-mono text-sm">
                        {product.price_min.toLocaleString()} -{" "}
                        {product.price_max.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant={
                        product.total_stock > 0 ? "default" : "secondary"
                      }
                    >
                      {product.total_stock}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={product.is_active ?? true}
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
          Showing {offset + 1} to {Math.min(offset + limit, total)} of{" "}
          {total.toLocaleString()} products
        </p>
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
      </div>

      {/* Delete Single Product Dialog */}
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

      {/* Bulk Delete Dialog */}
      <ConfirmDialog
        open={showBulkDeleteDialog}
        onOpenChange={setShowBulkDeleteDialog}
        title="Delete Products"
        description={`Are you sure you want to delete ${selectedIds.length} products? This action cannot be undone.`}
        confirmLabel="Delete All"
        onConfirm={handleBulkDelete}
        variant="destructive"
        isLoading={isProcessing}
      />
    </div>
  );
}

function ProductsTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <Skeleton className="h-10 w-[300px]" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-[180px]" />
          <Skeleton className="h-10 w-[180px]" />
        </div>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Select</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 10 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-4 w-4" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-16" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-48" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-12" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-6 w-10" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-8 w-8" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
