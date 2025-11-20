"use client";

import { useState, useEffect, useRef } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  FolderTree,
  Package,
  Copy,
  Check,
  Calendar,
  Hash,
  ExternalLink,
  Settings,
  Trash2,
  CheckCircle2,
  XCircle,
  Power,
  PowerOff,
  MoreHorizontal,
  Eye,
  ChevronLeft,
  ChevronRight,
  Home,
  Warehouse,
  Tag,
  Clock,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
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
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { api } from "@/lib/api";
import { CategoryWithStats, CategoryProduct, Category } from "@/types";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useCurrency } from "@/contexts/currency-context";

interface CategoryDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

/**
 * Copy button component with visual feedback
 */
function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground transition-colors"
      onClick={handleCopy}
    >
      {copied ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
      {label && <span className="sr-only">{label}</span>}
    </Button>
  );
}

/**
 * Copyable field component for displaying data with copy functionality
 */
function CopyableField({
  label,
  value,
  mono = false
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean
}) {
  if (!value) return null;

  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`text-sm ${mono ? "font-mono text-xs bg-muted px-2 py-0.5 rounded" : ""}`}>
          {value.length > 36 ? `${value.substring(0, 16)}...${value.substring(value.length - 8)}` : value}
        </span>
        <CopyButton text={value} />
      </div>
    </div>
  );
}

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function CategoryDetailPage({ params }: CategoryDetailPageProps) {
  const [category, setCategory] = useState<CategoryWithStats | null>(null);
  const [products, setProducts] = useState<CategoryProduct[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [subcategories, setSubcategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBulkActivateDialog, setShowBulkActivateDialog] = useState(false);
  const [showBulkDeactivateDialog, setShowBulkDeactivateDialog] = useState(false);
  const [showDeleteProductDialog, setShowDeleteProductDialog] = useState(false);
  const [productToDelete, setProductToDelete] = useState<CategoryProduct | null>(null);
  const [togglingProductId, setTogglingProductId] = useState<string | null>(null);
  const { formatPrice } = useCurrency();

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [resolvedId, setResolvedId] = useState<string | null>(null);
  const productsPerPage = 10;

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const { id } = await params;
        if (cancelled) return;

        setResolvedId(id);

        const [categoryData, productsData, subcategoriesData] = await Promise.all([
          api.getCategoryWithStats(id),
          api.getCategoryProducts(id, productsPerPage, 0),
          api.getCategorySubcategories(id),
        ]);

        if (cancelled) return;

        if (!categoryData) {
          notFound();
          return;
        }

        setCategory(categoryData);
        setProducts(productsData.data);
        setTotalProducts(productsData.total);
        setSubcategories(subcategoriesData);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to fetch category:", err);
        setError("Failed to load category. Make sure the Go backend API is running.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [params]);

  // Fetch products when page changes
  const fetchProducts = async (page: number) => {
    if (!resolvedId) return;

    try {
      const offset = (page - 1) * productsPerPage;
      const productsData = await api.getCategoryProducts(resolvedId, productsPerPage, offset);
      setProducts(productsData.data);
      setTotalProducts(productsData.total);
      setCurrentPage(page);
    } catch (err) {
      console.error("Failed to fetch products:", err);
      toast.error("Failed to load products");
    }
  };

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

  const handleDeleteCategory = async () => {
    if (!category) return;

    setIsProcessing(true);
    try {
      await api.deleteCategory(category.id);
      toast.success("Category deleted successfully");
      window.location.href = "/categories";
    } catch (error) {
      console.error("Failed to delete category:", error);
      toast.error("Failed to delete category");
    } finally {
      setIsProcessing(false);
      setShowDeleteDialog(false);
    }
  };

  const handleBulkActivateProducts = async () => {
    if (!category) return;

    setIsProcessing(true);
    try {
      const result = await api.bulkUpdateCategoryProducts(category.id, true);
      toast.success(`Activated ${result.updated} products`);
      const updatedCategory = await api.getCategoryWithStats(category.id);
      setCategory(updatedCategory);
      await fetchProducts(currentPage);
    } catch (error) {
      console.error("Failed to activate products:", error);
      toast.error("Failed to activate products");
    } finally {
      setIsProcessing(false);
      setShowBulkActivateDialog(false);
    }
  };

  const handleBulkDeactivateProducts = async () => {
    if (!category) return;

    setIsProcessing(true);
    try {
      const result = await api.bulkUpdateCategoryProducts(category.id, false);
      toast.success(`Deactivated ${result.updated} products`);
      const updatedCategory = await api.getCategoryWithStats(category.id);
      setCategory(updatedCategory);
      await fetchProducts(currentPage);
    } catch (error) {
      console.error("Failed to deactivate products:", error);
      toast.error("Failed to deactivate products");
    } finally {
      setIsProcessing(false);
      setShowBulkDeactivateDialog(false);
    }
  };

  const handleToggleProductActive = async (product: CategoryProduct, isActive: boolean) => {
    setTogglingProductId(product.id);
    try {
      await api.updateProduct(product.id, { is_active: isActive });
      setProducts(products.map(p =>
        p.id === product.id ? { ...p, is_active: isActive } : p
      ));
      toast.success(`Product ${isActive ? "activated" : "deactivated"}`);
      if (category) {
        const updatedCategory = await api.getCategoryWithStats(category.id);
        setCategory(updatedCategory);
      }
    } catch (error) {
      console.error("Failed to update product:", error);
      toast.error("Failed to update product status");
    } finally {
      setTogglingProductId(null);
    }
  };

  const handleDeleteProduct = async () => {
    if (!productToDelete || !category) return;

    setIsProcessing(true);
    try {
      await api.deleteProduct(productToDelete.id);
      toast.success("Product deleted successfully");
      const updatedCategory = await api.getCategoryWithStats(category.id);
      setCategory(updatedCategory);
      await fetchProducts(currentPage);
    } catch (error) {
      console.error("Failed to delete product:", error);
      toast.error("Failed to delete product");
    } finally {
      setIsProcessing(false);
      setShowDeleteProductDialog(false);
      setProductToDelete(null);
    }
  };

  const totalPages = Math.ceil(totalProducts / productsPerPage);

  if (loading) {
    return <CategoryDetailSkeleton />;
  }

  if (error || !category) {
    return (
      <div className="space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/">
                  <Home className="h-4 w-4" />
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/categories">Categories</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Not Found</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FolderTree className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Category Not Found</h2>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              {error || "The category you're looking for doesn't exist or has been removed."}
            </p>
            <Button asChild>
              <Link href="/categories">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Categories
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/" className="flex items-center">
                <Home className="h-4 w-4" />
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/categories">Categories</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{category.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Button variant="outline" size="icon" asChild className="shrink-0 mt-1">
            <Link href="/categories">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold tracking-tight">{category.name}</h1>
              <Badge
                variant={category.is_active ? "default" : "secondary"}
                className={category.is_active ? "bg-green-100 text-green-800 border-green-200 hover:bg-green-100" : ""}
              >
                {category.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5" />
              {category.slug}
            </p>
            {category.parent_name && (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" />
                Parent: {category.parent_name}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 sm:shrink-0">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
            disabled={isProcessing}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4" />
              Total Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{category.total_products.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">All products in this category</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Active Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{category.active_products.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {category.total_products > 0
                ? `${((category.active_products / category.total_products) * 100).toFixed(1)}% of total`
                : "No products"}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Warehouse className="h-4 w-4 text-blue-600" />
              In Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{category.in_stock_products.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {category.active_products > 0
                ? `${((category.in_stock_products / category.active_products) * 100).toFixed(1)}% of active`
                : "No active products"}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Tag className="h-4 w-4 text-purple-600" />
              With Prices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{category.with_prices_products.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {category.active_products > 0
                ? `${((category.with_prices_products / category.active_products) * 100).toFixed(1)}% of active`
                : "No active products"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Category Information & Admin Actions Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Category Information */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FolderTree className="h-5 w-5 text-primary" />
              Category Information
            </CardTitle>
            <CardDescription>
              Details and identifiers for this category
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <CopyableField label="ID (UUID)" value={category.id} mono />
            <Separator className="my-2" />
            <CopyableField label="Ultra ID" value={category.ultra_id} mono />
            <Separator className="my-2" />
            {category.code && (
              <>
                <CopyableField label="Code" value={category.code} mono />
                <Separator className="my-2" />
              </>
            )}
            <CopyableField label="Slug" value={category.slug} />
            {category.parent_id && (
              <>
                <Separator className="my-2" />
                <CopyableField label="Parent ID" value={category.parent_id} mono />
              </>
            )}
            <Separator className="my-2" />
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Sort Order</span>
              <span className="text-sm">{category.sort_order}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Product Count</span>
              <span className="text-sm">{category.product_count.toLocaleString()}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Child Categories</span>
              <span className="text-sm">{category.child_count}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Status</span>
              <div className="flex items-center gap-3">
                {category.is_active ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <Switch
                  checked={category.is_active}
                  onCheckedChange={handleToggleActive}
                  disabled={isProcessing}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timestamps & Actions */}
        <div className="space-y-6">
          {/* Timestamps */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5 text-primary" />
                Timestamps
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5" />
                  Created
                </span>
                <span className="text-sm">{formatTimestamp(category.created_at)}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5" />
                  Updated
                </span>
                <span className="text-sm">{formatTimestamp(category.updated_at)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Admin Actions */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Settings className="h-5 w-5 text-primary" />
                Admin Actions
              </CardTitle>
              <CardDescription>
                Bulk operations for category products
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => setShowBulkActivateDialog(true)}
                  disabled={isProcessing || category.total_products === 0}
                >
                  <Power className="h-4 w-4 mr-2 text-green-600" />
                  Activate All Products
                </Button>
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => setShowBulkDeactivateDialog(true)}
                  disabled={isProcessing || category.total_products === 0}
                >
                  <PowerOff className="h-4 w-4 mr-2 text-orange-600" />
                  Deactivate All Products
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Subcategories Section */}
      {subcategories.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Layers className="h-5 w-5 text-primary" />
                  Subcategories
                </CardTitle>
                <CardDescription>
                  {subcategories.length} child categories under this category
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {subcategories.map((sub) => (
                <Link key={sub.id} href={`/categories/${sub.id}`}>
                  <Badge
                    variant="outline"
                    className="cursor-pointer hover:bg-muted transition-colors px-3 py-1.5"
                  >
                    <FolderTree className="h-3 w-3 mr-1.5" />
                    {sub.name}
                    <span className="ml-1.5 text-muted-foreground">({sub.product_count})</span>
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Products Table */}
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="h-5 w-5 text-primary" />
                Products
              </CardTitle>
              <CardDescription>
                {totalProducts.toLocaleString()} products in this category
              </CardDescription>
            </div>
            {/* Filter controls placeholder for full-stack-architect */}
            <div className="flex items-center gap-2">
              {/* Filters will go here */}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {products.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <Package className="h-12 w-12 text-muted-foreground/50" />
              <div className="text-center">
                <p className="font-medium">No products found</p>
                <p className="text-sm text-muted-foreground">
                  This category doesn't have any products yet
                </p>
              </div>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Name</TableHead>
                    <TableHead className="font-semibold">Code</TableHead>
                    <TableHead className="text-right font-semibold">Price</TableHead>
                    <TableHead className="text-center font-semibold">Stock</TableHead>
                    <TableHead className="text-center font-semibold">Active</TableHead>
                    <TableHead className="text-right font-semibold w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium max-w-[300px]">
                        <Link
                          href={`/products/${product.id}`}
                          className="hover:underline text-primary truncate block"
                        >
                          {product.name.length > 50
                            ? `${product.name.substring(0, 50)}...`
                            : product.name}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {product.code || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {product.price_min !== null ? (
                          <span className="font-medium">
                            {formatPrice(product.price_min)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">No price</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={product.total_stock > 0 ? "outline" : "destructive"}
                          className={product.total_stock > 0
                            ? "bg-green-50 text-green-700 border-green-200"
                            : ""
                          }
                        >
                          <Warehouse className="h-3 w-3 mr-1" />
                          {product.total_stock > 0 ? product.total_stock : "Out"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={product.is_active}
                          onCheckedChange={(checked) => handleToggleProductActive(product, checked)}
                          disabled={togglingProductId === product.id}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-[160px]">
                            <DropdownMenuItem asChild>
                              <Link href={`/products/${product.id}`}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                setProductToDelete(product);
                                setShowDeleteProductDialog(true);
                              }}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/30">
                  <div className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * productsPerPage) + 1} to {Math.min(currentPage * productsPerPage, totalProducts)} of {totalProducts.toLocaleString()} products
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchProducts(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <div className="text-sm font-medium px-3 py-1 bg-background border rounded-md">
                      {currentPage} / {totalPages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchProducts(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete Category Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Category"
        description={`Are you sure you want to delete "${category.name}"? This action cannot be undone and may affect ${category.child_count} child categories and ${category.total_products.toLocaleString()} products.`}
        confirmLabel="Delete"
        onConfirm={handleDeleteCategory}
        variant="destructive"
        isLoading={isProcessing}
      />

      {/* Bulk Activate Products Dialog */}
      <ConfirmDialog
        open={showBulkActivateDialog}
        onOpenChange={setShowBulkActivateDialog}
        title="Activate All Products"
        description={`Are you sure you want to activate all ${category.total_products.toLocaleString()} products in "${category.name}"?`}
        confirmLabel="Activate All"
        onConfirm={handleBulkActivateProducts}
        isLoading={isProcessing}
      />

      {/* Bulk Deactivate Products Dialog */}
      <ConfirmDialog
        open={showBulkDeactivateDialog}
        onOpenChange={setShowBulkDeactivateDialog}
        title="Deactivate All Products"
        description={`Are you sure you want to deactivate all ${category.total_products.toLocaleString()} products in "${category.name}"?`}
        confirmLabel="Deactivate All"
        onConfirm={handleBulkDeactivateProducts}
        variant="destructive"
        isLoading={isProcessing}
      />

      {/* Delete Product Dialog */}
      <ConfirmDialog
        open={showDeleteProductDialog}
        onOpenChange={setShowDeleteProductDialog}
        title="Delete Product"
        description={`Are you sure you want to delete "${productToDelete?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDeleteProduct}
        variant="destructive"
        isLoading={isProcessing}
      />
    </div>
  );
}

/**
 * Loading skeleton for category detail page
 */
function CategoryDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Breadcrumb skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-24" />
      </div>

      {/* Header skeleton */}
      <div className="flex items-start gap-4">
        <Skeleton className="h-10 w-10 rounded-md" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>

      {/* Stats cards skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="shadow-sm">
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-32 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Info cards skeleton */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-56" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <Skeleton className="h-5 w-36" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Products table skeleton */}
      <Card className="shadow-sm">
        <CardHeader>
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="p-0">
          <div className="p-6 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
