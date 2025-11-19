"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  FolderTree,
  Package,
  CheckCircle2,
  XCircle,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  Boxes,
  DollarSign,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { CategoryWithStats, CategoryProduct, Category } from "@/types";
import { ConfirmDialog } from "@/components/confirm-dialog";

// Copyable field component
function CopyableField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }
  };

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <code className="rounded bg-muted px-2 py-1 text-xs font-mono">{value}</code>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopy}>
          {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
        </Button>
      </div>
    </div>
  );
}

export default function CategoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();

  // State
  const [category, setCategory] = useState<CategoryWithStats | null>(null);
  const [products, setProducts] = useState<CategoryProduct[]>([]);
  const [productsTotal, setProductsTotal] = useState(0);
  const [subcategories, setSubcategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Pagination
  const [productsPage, setProductsPage] = useState(1);
  const productsPageSize = 10;

  // Dialogs
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBulkActivateDialog, setShowBulkActivateDialog] = useState(false);
  const [showBulkDeactivateDialog, setShowBulkDeactivateDialog] = useState(false);

  // Fetch category data
  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      const { id } = await params;
      if (cancelled) return;

      try {
        setIsLoading(true);

        // Fetch category with stats
        const categoryData = await api.getCategoryWithStats(id);
        if (cancelled) return;
        setCategory(categoryData);

        // Fetch products
        const offset = (productsPage - 1) * productsPageSize;
        const productsData = await api.getCategoryProducts(id, productsPageSize, offset);
        if (cancelled) return;
        setProducts(productsData.data);
        setProductsTotal(productsData.total);

        // Fetch subcategories
        const subcategoriesData = await api.getCategorySubcategories(id);
        if (cancelled) return;
        setSubcategories(subcategoriesData);

        setError(null);
      } catch (err) {
        console.error("Failed to fetch category:", err);
        if (!cancelled) {
          setError("Failed to load category. Make sure the Go backend API is running.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [params, productsPage, productsPageSize]);

  // Toggle active status
  const handleToggleActive = async (isActive: boolean) => {
    if (!category) return;

    setIsProcessing(true);
    try {
      await api.updateCategory(category.id, { is_active: isActive });
      setCategory({ ...category, is_active: isActive });
      toast.success(`Category ${isActive ? "activated" : "deactivated"}`);
    } catch (error) {
      console.error("Failed to update category:", error);
      toast.error("Failed to update category status");
    } finally {
      setIsProcessing(false);
    }
  };

  // Delete category
  const handleDelete = async () => {
    if (!category) return;

    setIsProcessing(true);
    try {
      await api.deleteCategory(category.id);
      toast.success("Category deleted successfully");
      router.push("/categories");
    } catch (error) {
      console.error("Failed to delete category:", error);
      toast.error("Failed to delete category");
    } finally {
      setIsProcessing(false);
      setShowDeleteDialog(false);
    }
  };

  // Bulk update products
  const handleBulkUpdateProducts = async (activate: boolean) => {
    if (!category) return;

    setIsProcessing(true);
    try {
      const result = await api.bulkUpdateCategoryProducts(category.id, activate);
      const action = activate ? "activated" : "deactivated";
      toast.success(`Successfully ${action} ${result.updated} products`);

      // Refresh category data
      const categoryData = await api.getCategoryWithStats(category.id);
      setCategory(categoryData);

      // Refresh products
      const offset = (productsPage - 1) * productsPageSize;
      const productsData = await api.getCategoryProducts(category.id, productsPageSize, offset);
      setProducts(productsData.data);
      setProductsTotal(productsData.total);
    } catch (error) {
      console.error("Failed to bulk update products:", error);
      toast.error("Failed to update products");
    } finally {
      setIsProcessing(false);
      setShowBulkActivateDialog(false);
      setShowBulkDeactivateDialog(false);
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error || !category) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Category Not Found</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderTree className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{error || "Category not found"}</p>
            <Button className="mt-4" onClick={() => router.push("/categories")}>
              Back to Categories
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const productsTotalPages = Math.ceil(productsTotal / productsPageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{category.name}</h1>
            <p className="text-muted-foreground">
              {category.parent_name ? `Parent: ${category.parent_name}` : "Root category"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={category.is_active}
            onCheckedChange={handleToggleActive}
            disabled={isProcessing}
          />
          <span className="text-sm text-muted-foreground">
            {category.is_active ? "Active" : "Inactive"}
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4" />
              Total Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{category.total_products}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Active Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{category.active_products}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Boxes className="h-4 w-4 text-blue-500" />
              In Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{category.in_stock_products}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-purple-500" />
              With Prices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{category.with_prices_products}</div>
          </CardContent>
        </Card>
      </div>

      {/* Category Information */}
      <Card>
        <CardHeader>
          <CardTitle>Category Information</CardTitle>
          <CardDescription>Details and identifiers for this category</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CopyableField label="Category ID" value={category.id} />
          <CopyableField label="Ultra ID" value={category.ultra_id} />
          {category.code && <CopyableField label="Code" value={category.code} />}
          <CopyableField label="Slug" value={category.slug} />
          {category.parent_id && <CopyableField label="Parent ID" value={category.parent_id} />}

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Sort Order</span>
            <span className="text-sm">{category.sort_order}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Product Count</span>
            <span className="text-sm">{category.product_count}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Child Categories</span>
            <span className="text-sm">{category.child_count}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge variant={category.is_active ? "default" : "secondary"}>
              {category.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Created</span>
            <span className="text-sm">{formatDate(category.created_at)}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Updated</span>
            <span className="text-sm">{formatDate(category.updated_at)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Subcategories */}
      {subcategories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Subcategories ({subcategories.length})</CardTitle>
            <CardDescription>Child categories under this category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {subcategories.map((sub) => (
                <Link key={sub.id} href={`/categories/${sub.id}`}>
                  <Badge variant="outline" className="cursor-pointer hover:bg-muted">
                    {sub.name}
                    <span className="ml-1 text-muted-foreground">({sub.product_count})</span>
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Admin Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Admin Actions</CardTitle>
          <CardDescription>Manage this category and its products</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`/products?category_id=${category.id}`}>
                <ExternalLink className="mr-2 h-4 w-4" />
                View All Products
              </Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowBulkActivateDialog(true)}
              disabled={isProcessing || category.total_products === 0}
              className="text-green-600 hover:text-green-700"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Activate All Products
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowBulkDeactivateDialog(true)}
              disabled={isProcessing || category.total_products === 0}
              className="text-orange-600 hover:text-orange-700"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Deactivate All Products
            </Button>
            <Button
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isProcessing}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Category
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Products ({productsTotal})</CardTitle>
          <CardDescription>Products in this category</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead className="text-right">Price Range</TableHead>
                <TableHead className="text-center">Stock</TableHead>
                <TableHead className="text-center">Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="h-8 w-8 text-muted-foreground" />
                      <span className="text-muted-foreground">No products in this category</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <Link
                        href={`/products/${product.id}`}
                        className="font-medium hover:underline"
                      >
                        {product.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <code className="text-sm">{product.code || "-"}</code>
                    </TableCell>
                    <TableCell className="text-right">
                      {product.price_min !== null ? (
                        <span>
                          {product.price_min === product.price_max
                            ? `${product.price_min.toLocaleString()} MDL`
                            : `${product.price_min.toLocaleString()} - ${product.price_max?.toLocaleString()} MDL`}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={product.total_stock > 0 ? "default" : "secondary"}
                        className={product.total_stock > 0 ? "bg-green-500" : ""}
                      >
                        {product.total_stock}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {product.is_active ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>

        {/* Pagination */}
        {productsTotalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <div className="text-sm text-muted-foreground">
              Page {productsPage} of {productsTotalPages} ({productsTotal} products)
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setProductsPage((p) => Math.max(1, p - 1))}
                disabled={productsPage === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setProductsPage((p) => Math.min(productsTotalPages, p + 1))}
                disabled={productsPage === productsTotalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Delete Category Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Category"
        description={`Are you sure you want to delete "${category.name}"? This action cannot be undone and may affect ${category.child_count} child categories and ${category.total_products} products.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        variant="destructive"
        isLoading={isProcessing}
      />

      {/* Bulk Activate Products Dialog */}
      <ConfirmDialog
        open={showBulkActivateDialog}
        onOpenChange={setShowBulkActivateDialog}
        title="Activate All Products"
        description={`Are you sure you want to activate all ${category.total_products} products in this category?`}
        confirmLabel="Activate All"
        onConfirm={() => handleBulkUpdateProducts(true)}
        isLoading={isProcessing}
      />

      {/* Bulk Deactivate Products Dialog */}
      <ConfirmDialog
        open={showBulkDeactivateDialog}
        onOpenChange={setShowBulkDeactivateDialog}
        title="Deactivate All Products"
        description={`Are you sure you want to deactivate all ${category.total_products} products in this category?`}
        confirmLabel="Deactivate All"
        onConfirm={() => handleBulkUpdateProducts(false)}
        variant="destructive"
        isLoading={isProcessing}
      />
    </div>
  );
}
