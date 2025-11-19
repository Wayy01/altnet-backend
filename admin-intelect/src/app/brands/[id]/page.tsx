"use client";

import { useState, useEffect, useRef } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  Package,
  Copy,
  Check,
  Calendar,
  Hash,
  ExternalLink,
  Settings,
  ToggleLeft,
  ToggleRight,
  Trash2,
  CheckCircle2,
  XCircle,
  DollarSign,
  Warehouse,
  Power,
  PowerOff,
  MoreHorizontal,
  Eye,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { BrandWithStats, BrandProduct } from "@/types";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useCurrency } from "@/contexts/currency-context";

interface BrandDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

// Copy button component
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
    <Button variant="ghost" size="sm" className="h-6 px-2 gap-1" onClick={handleCopy}>
      {copied ? (
        <>
          <Check className="h-3 w-3 text-green-500" />
          {label && <span className="text-xs text-green-500">Copied</span>}
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" />
          {label && <span className="text-xs">{label}</span>}
        </>
      )}
    </Button>
  );
}

// Copyable field component
function CopyableField({ label, value, mono = false }: { label: string; value: string | null | undefined; mono?: boolean }) {
  if (!value) return null;

  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <span className={`text-sm ${mono ? "font-mono text-xs" : ""}`}>
          {value.length > 40 ? `${value.substring(0, 20)}...${value.substring(value.length - 8)}` : value}
        </span>
        <CopyButton text={value} />
      </div>
    </div>
  );
}

// Format timestamp for display
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

export default function BrandDetailPage({
  params,
}: BrandDetailPageProps) {
  const [brand, setBrand] = useState<BrandWithStats | null>(null);
  const [products, setProducts] = useState<BrandProduct[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBulkActivateDialog, setShowBulkActivateDialog] = useState(false);
  const [showBulkDeactivateDialog, setShowBulkDeactivateDialog] = useState(false);
  const [showDeleteProductDialog, setShowDeleteProductDialog] = useState(false);
  const [productToDelete, setProductToDelete] = useState<BrandProduct | null>(null);
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

        const [brandData, productsData] = await Promise.all([
          api.getBrandWithStats(id),
          api.getBrandProducts(id, productsPerPage, 0),
        ]);

        if (cancelled) return;

        if (!brandData) {
          notFound();
          return;
        }

        setBrand(brandData);
        setProducts(productsData.data);
        setTotalProducts(productsData.total);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to fetch brand:", err);
        setError("Failed to load brand. Make sure the Go backend API is running.");
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
      const productsData = await api.getBrandProducts(resolvedId, productsPerPage, offset);
      setProducts(productsData.data);
      setTotalProducts(productsData.total);
      setCurrentPage(page);
    } catch (err) {
      console.error("Failed to fetch products:", err);
      toast.error("Failed to load products");
    }
  };

  const handleToggleActive = async (isActive: boolean) => {
    if (!brand) return;

    setIsProcessing(true);
    try {
      await api.updateBrand(brand.id, { is_active: isActive });
      setBrand({ ...brand, is_active: isActive });
      toast.success(`Brand ${isActive ? "activated" : "deactivated"}`);
    } catch (error) {
      console.error("Failed to update brand:", error);
      toast.error("Failed to update brand status");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteBrand = async () => {
    if (!brand) return;

    setIsProcessing(true);
    try {
      await api.deleteBrand(brand.id);
      toast.success("Brand deleted successfully");
      // Redirect to brands list after deletion
      window.location.href = "/brands";
    } catch (error) {
      console.error("Failed to delete brand:", error);
      toast.error("Failed to delete brand");
    } finally {
      setIsProcessing(false);
      setShowDeleteDialog(false);
    }
  };

  const handleBulkActivateProducts = async () => {
    if (!brand) return;

    setIsProcessing(true);
    try {
      const result = await api.bulkUpdateBrandProducts(brand.id, true);
      toast.success(`Activated ${result.updated} products`);
      // Refresh brand stats
      const updatedBrand = await api.getBrandWithStats(brand.id);
      setBrand(updatedBrand);
      // Refresh products list
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
    if (!brand) return;

    setIsProcessing(true);
    try {
      const result = await api.bulkUpdateBrandProducts(brand.id, false);
      toast.success(`Deactivated ${result.updated} products`);
      // Refresh brand stats
      const updatedBrand = await api.getBrandWithStats(brand.id);
      setBrand(updatedBrand);
      // Refresh products list
      await fetchProducts(currentPage);
    } catch (error) {
      console.error("Failed to deactivate products:", error);
      toast.error("Failed to deactivate products");
    } finally {
      setIsProcessing(false);
      setShowBulkDeactivateDialog(false);
    }
  };

  const handleToggleProductActive = async (product: BrandProduct, isActive: boolean) => {
    setTogglingProductId(product.id);
    try {
      await api.updateProduct(product.id, { is_active: isActive });
      // Update local state
      setProducts(products.map(p =>
        p.id === product.id ? { ...p, is_active: isActive } : p
      ));
      toast.success(`Product ${isActive ? "activated" : "deactivated"}`);
      // Refresh brand stats
      if (brand) {
        const updatedBrand = await api.getBrandWithStats(brand.id);
        setBrand(updatedBrand);
      }
    } catch (error) {
      console.error("Failed to update product:", error);
      toast.error("Failed to update product status");
    } finally {
      setTogglingProductId(null);
    }
  };

  const handleDeleteProduct = async () => {
    if (!productToDelete || !brand) return;

    setIsProcessing(true);
    try {
      await api.deleteProduct(productToDelete.id);
      toast.success("Product deleted successfully");
      // Refresh brand stats
      const updatedBrand = await api.getBrandWithStats(brand.id);
      setBrand(updatedBrand);
      // Refresh products list
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
    return <BrandDetailSkeleton />;
  }

  if (error || !brand) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground">
          {error || "Brand not found"}
        </p>
        <Button variant="outline" asChild className="mt-4">
          <Link href="/brands">Back to Brands</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/brands">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12">
              {brand.logo_url ? (
                <AvatarImage src={brand.logo_url} alt={brand.name} />
              ) : null}
              <AvatarFallback className="text-lg">
                {brand.name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight">{brand.name}</h1>
                <Badge variant={brand.is_active ? "default" : "secondary"}>
                  {brand.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm">
                Slug: {brand.slug}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{brand.total_products.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">All products in this brand</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{brand.active_products.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {brand.total_products > 0
                ? `${((brand.active_products / brand.total_products) * 100).toFixed(1)}% of total`
                : "No products"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">In Stock</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{brand.in_stock_products.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {brand.active_products > 0
                ? `${((brand.in_stock_products / brand.active_products) * 100).toFixed(1)}% of active`
                : "No active products"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">With Prices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{brand.with_prices_products.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {brand.active_products > 0
                ? `${((brand.with_prices_products / brand.active_products) * 100).toFixed(1)}% of active`
                : "No active products"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Brand Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Brand Information
          </CardTitle>
          <CardDescription>
            Brand details and identifiers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {/* Identifiers */}
            <div className="space-y-1">
              <div className="text-sm font-medium mb-2">Identifiers</div>
              <CopyableField label="ID (UUID)" value={brand.id} mono />
              <CopyableField label="Ultra ID" value={brand.ultra_id} mono />
              <CopyableField label="Slug" value={brand.slug} />
              {brand.logo_url && (
                <div className="flex justify-between items-center py-1">
                  <span className="text-sm text-muted-foreground">Logo URL</span>
                  <div className="flex items-center gap-1">
                    <a
                      href={brand.logo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      View Logo
                    </a>
                    <CopyButton text={brand.logo_url} />
                  </div>
                </div>
              )}
            </div>

            {/* Timestamps */}
            <div className="space-y-1">
              <div className="text-sm font-medium mb-2">Timestamps</div>
              <div className="flex justify-between items-center py-1">
                <span className="text-sm text-muted-foreground">Created</span>
                <span className="text-xs">{formatTimestamp(brand.created_at)}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-sm text-muted-foreground">Updated</span>
                <span className="text-xs">{formatTimestamp(brand.updated_at)}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-sm text-muted-foreground">Status</span>
                <div className="flex items-center gap-2">
                  {brand.is_active ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <Switch
                    checked={brand.is_active}
                    onCheckedChange={handleToggleActive}
                    disabled={isProcessing}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Admin Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Admin Actions
          </CardTitle>
          <CardDescription>
            Manage brand and its products
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => setShowBulkActivateDialog(true)}
              disabled={isProcessing || brand.total_products === 0}
            >
              <Power className="h-4 w-4 mr-2" />
              Activate All Products
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowBulkDeactivateDialog(true)}
              disabled={isProcessing || brand.total_products === 0}
            >
              <PowerOff className="h-4 w-4 mr-2" />
              Deactivate All Products
            </Button>
            <Button
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isProcessing}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Brand
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Products Table with Pagination */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Products
              </CardTitle>
              <CardDescription>
                {totalProducts.toLocaleString()} products in this brand
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8">
              <Package className="h-8 w-8 text-muted-foreground" />
              <p className="text-muted-foreground">
                No products found for this brand
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead className="text-right">Price (MDL)</TableHead>
                    <TableHead className="text-center">Stock</TableHead>
                    <TableHead className="text-center">Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/products/${product.id}`}
                          className="hover:underline text-blue-600"
                        >
                          {product.name.length > 50
                            ? `${product.name.substring(0, 50)}...`
                            : product.name}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {product.code || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {product.price_min !== null ? (
                          <span className="font-medium">
                            {formatPrice(product.price_min)}
                          </span>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            No price
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={product.total_stock > 0 ? "default" : "destructive"}
                          className={product.total_stock > 0 ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}
                        >
                          {product.total_stock > 0 ? `${product.total_stock} in stock` : "Out of stock"}
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
                          <DropdownMenuContent align="end">
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
                              className="text-red-600"
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
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
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
                    <div className="text-sm font-medium px-2">
                      Page {currentPage} of {totalPages}
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

      {/* Delete Brand Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Brand"
        description={`Are you sure you want to delete "${brand.name}"? This action cannot be undone and may affect ${brand.total_products.toLocaleString()} associated products.`}
        confirmLabel="Delete"
        onConfirm={handleDeleteBrand}
        variant="destructive"
        isLoading={isProcessing}
      />

      {/* Bulk Activate Products Dialog */}
      <ConfirmDialog
        open={showBulkActivateDialog}
        onOpenChange={setShowBulkActivateDialog}
        title="Activate All Products"
        description={`Are you sure you want to activate all ${brand.total_products.toLocaleString()} products from "${brand.name}"?`}
        confirmLabel="Activate All"
        onConfirm={handleBulkActivateProducts}
        isLoading={isProcessing}
      />

      {/* Bulk Deactivate Products Dialog */}
      <ConfirmDialog
        open={showBulkDeactivateDialog}
        onOpenChange={setShowBulkDeactivateDialog}
        title="Deactivate All Products"
        description={`Are you sure you want to deactivate all ${brand.total_products.toLocaleString()} products from "${brand.name}"?`}
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

function BrandDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32 mt-1" />
          </div>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
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
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
