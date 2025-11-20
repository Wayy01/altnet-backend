"use client";

import { useState, useEffect, useRef, useMemo } from "react";
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
  Filter,
  CheckSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
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
import { BrandWithStats, BrandProduct } from "@/types";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useCurrency } from "@/contexts/currency-context";

interface BrandDetailPageProps {
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

/**
 * Filter products based on price, stock, and status criteria
 */
function filterProducts(
  products: BrandProduct[],
  priceFilter: string,
  stockFilter: string,
  statusFilter: string
): BrandProduct[] {
  return products.filter((product) => {
    // Price filter
    let priceMatch = true;
    if (priceFilter === "no_price") {
      priceMatch = product.price_mdl === null && product.price_eur === null && product.price_usd === null;
    } else if (priceFilter === "no_mdl") {
      priceMatch = product.price_mdl === null;
    } else if (priceFilter === "no_eur") {
      priceMatch = product.price_eur === null;
    } else if (priceFilter === "no_usd") {
      priceMatch = product.price_usd === null;
    } else if (priceFilter === "with_price") {
      priceMatch = product.price_mdl !== null || product.price_eur !== null || product.price_usd !== null;
    }

    // Stock filter
    let stockMatch = true;
    if (stockFilter === "in_stock") {
      stockMatch = product.total_stock > 0;
    } else if (stockFilter === "out_of_stock") {
      stockMatch = product.total_stock === 0 || product.total_stock === null;
    } else if (stockFilter === "low_stock") {
      stockMatch = product.total_stock > 0 && product.total_stock <= 5;
    }

    // Status filter
    let statusMatch = true;
    if (statusFilter === "active") {
      statusMatch = product.is_active === true;
    } else if (statusFilter === "inactive") {
      statusMatch = product.is_active === false;
    }

    return priceMatch && stockMatch && statusMatch;
  });
}

export default function BrandDetailPage({ params }: BrandDetailPageProps) {
  const [brand, setBrand] = useState<BrandWithStats | null>(null);
  const [allProducts, setAllProducts] = useState<BrandProduct[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBulkActivateDialog, setShowBulkActivateDialog] = useState(false);
  const [showBulkDeactivateDialog, setShowBulkDeactivateDialog] = useState(false);
  const [showDeleteProductDialog, setShowDeleteProductDialog] = useState(false);
  const [showBulkActivateSelectedDialog, setShowBulkActivateSelectedDialog] = useState(false);
  const [showBulkDeactivateSelectedDialog, setShowBulkDeactivateSelectedDialog] = useState(false);
  const [productToDelete, setProductToDelete] = useState<BrandProduct | null>(null);
  const [togglingProductId, setTogglingProductId] = useState<string | null>(null);
  const { formatPrice } = useCurrency();

  // Filter state
  const [priceFilter, setPriceFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Selection state
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [resolvedId, setResolvedId] = useState<string | null>(null);
  const productsPerPage = 10;

  // Fetch all products for the current page
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
        setAllProducts(productsData.data);
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
      setAllProducts(productsData.data);
      setTotalProducts(productsData.total);
      setCurrentPage(page);
      setSelectedProducts(new Set()); // Clear selection on page change
    } catch (err) {
      console.error("Failed to fetch products:", err);
      toast.error("Failed to load products");
    }
  };

  // Apply client-side filtering
  const filteredProducts = useMemo(() => {
    return filterProducts(allProducts, priceFilter, stockFilter, statusFilter);
  }, [allProducts, priceFilter, stockFilter, statusFilter]);

  // Check if all visible products are selected
  const allVisibleSelected = filteredProducts.length > 0 && filteredProducts.every(p => selectedProducts.has(p.id));

  // Toggle all visible products selection
  const handleToggleAllSelected = () => {
    if (allVisibleSelected) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(filteredProducts.map(p => p.id)));
    }
  };

  // Toggle individual product selection
  const handleToggleProductSelected = (productId: string) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
  };

  // Handle bulk activate selected
  const handleActivateSelected = async () => {
    if (selectedProducts.size === 0) return;

    setIsProcessing(true);
    try {
      const result = await api.bulkUpdateProducts({
        ids: Array.from(selectedProducts),
        is_active: true,
      });
      toast.success(`Activated ${result.updated} products`);

      // Refresh data
      if (brand) {
        const updatedBrand = await api.getBrandWithStats(brand.id);
        setBrand(updatedBrand);
      }
      await fetchProducts(currentPage);
      setSelectedProducts(new Set());
    } catch (error) {
      console.error("Failed to activate products:", error);
      toast.error("Failed to activate products");
    } finally {
      setIsProcessing(false);
      setShowBulkActivateSelectedDialog(false);
    }
  };

  // Handle bulk deactivate selected
  const handleDeactivateSelected = async () => {
    if (selectedProducts.size === 0) return;

    setIsProcessing(true);
    try {
      const result = await api.bulkUpdateProducts({
        ids: Array.from(selectedProducts),
        is_active: false,
      });
      toast.success(`Deactivated ${result.updated} products`);

      // Refresh data
      if (brand) {
        const updatedBrand = await api.getBrandWithStats(brand.id);
        setBrand(updatedBrand);
      }
      await fetchProducts(currentPage);
      setSelectedProducts(new Set());
    } catch (error) {
      console.error("Failed to deactivate products:", error);
      toast.error("Failed to deactivate products");
    } finally {
      setIsProcessing(false);
      setShowBulkDeactivateSelectedDialog(false);
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
      const updatedBrand = await api.getBrandWithStats(brand.id);
      setBrand(updatedBrand);
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
      const updatedBrand = await api.getBrandWithStats(brand.id);
      setBrand(updatedBrand);
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
      setAllProducts(allProducts.map(p =>
        p.id === product.id ? { ...p, is_active: isActive } : p
      ));
      toast.success(`Product ${isActive ? "activated" : "deactivated"}`);
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
      const updatedBrand = await api.getBrandWithStats(brand.id);
      setBrand(updatedBrand);
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
                <Link href="/brands">Brands</Link>
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
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Brand Not Found</h2>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              {error || "The brand you're looking for doesn't exist or has been removed."}
            </p>
            <Button asChild>
              <Link href="/brands">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Brands
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
              <Link href="/brands">Brands</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{brand.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Button variant="outline" size="icon" asChild className="shrink-0 mt-1">
            <Link href="/brands">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16 border-2 border-border shadow-sm">
              {brand.logo_url ? (
                <AvatarImage src={brand.logo_url} alt={brand.name} />
              ) : null}
              <AvatarFallback className="text-xl font-semibold bg-primary/10 text-primary">
                {brand.name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl font-bold tracking-tight">{brand.name}</h1>
                <Badge
                  variant={brand.is_active ? "default" : "secondary"}
                  className={brand.is_active ? "bg-green-100 text-green-800 border-green-200 hover:bg-green-100" : ""}
                >
                  {brand.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" />
                {brand.slug}
              </p>
            </div>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{brand.total_products.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">All products in this brand</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{brand.active_products.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {brand.total_products > 0
                ? `${((brand.active_products / brand.total_products) * 100).toFixed(1)}% of total`
                : "No products"}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">In Stock</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{brand.in_stock_products.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {brand.active_products > 0
                ? `${((brand.in_stock_products / brand.active_products) * 100).toFixed(1)}% of active`
                : "No active products"}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">With Prices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{brand.with_prices_products.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {brand.active_products > 0
                ? `${((brand.with_prices_products / brand.active_products) * 100).toFixed(1)}% of active`
                : "No active products"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Brand Information & Admin Actions Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Brand Information */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5 text-primary" />
              Brand Information
            </CardTitle>
            <CardDescription>
              Details and identifiers for this brand
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <CopyableField label="ID (UUID)" value={brand.id} mono />
            <Separator className="my-2" />
            <CopyableField label="Ultra ID" value={brand.ultra_id} mono />
            <Separator className="my-2" />
            <CopyableField label="Slug" value={brand.slug} />
            {brand.logo_url && (
              <>
                <Separator className="my-2" />
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-muted-foreground">Logo</span>
                  <div className="flex items-center gap-2">
                    <a
                      href={brand.logo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                      View Logo
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <CopyButton text={brand.logo_url} />
                  </div>
                </div>
              </>
            )}
            <Separator className="my-2" />
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Status</span>
              <div className="flex items-center gap-3">
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
                <span className="text-sm">{formatTimestamp(brand.created_at)}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5" />
                  Updated
                </span>
                <span className="text-sm">{formatTimestamp(brand.updated_at)}</span>
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
                Bulk operations for brand products
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => setShowBulkActivateDialog(true)}
                  disabled={isProcessing || brand.total_products === 0}
                >
                  <Power className="h-4 w-4 mr-2 text-green-600" />
                  Activate All Products
                </Button>
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => setShowBulkDeactivateDialog(true)}
                  disabled={isProcessing || brand.total_products === 0}
                >
                  <PowerOff className="h-4 w-4 mr-2 text-orange-600" />
                  Deactivate All Products
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Products Table */}
      <Card className="shadow-sm">
        <CardHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Package className="h-5 w-5 text-primary" />
                  Products
                </CardTitle>
                <CardDescription>
                  {totalProducts.toLocaleString()} products in this brand
                  {filteredProducts.length !== allProducts.length && (
                    <> ({filteredProducts.length} filtered)</>
                  )}
                </CardDescription>
              </div>
            </div>

            {/* Filter Controls */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filters:</span>
              </div>
              <Select value={priceFilter} onValueChange={setPriceFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Price filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All prices</SelectItem>
                  <SelectItem value="no_price">No price</SelectItem>
                  <SelectItem value="no_mdl">No MDL price</SelectItem>
                  <SelectItem value="no_eur">No EUR price</SelectItem>
                  <SelectItem value="no_usd">No USD price</SelectItem>
                  <SelectItem value="with_price">With price</SelectItem>
                </SelectContent>
              </Select>
              <Select value={stockFilter} onValueChange={setStockFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Stock filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All stock</SelectItem>
                  <SelectItem value="in_stock">In stock</SelectItem>
                  <SelectItem value="out_of_stock">Out of stock</SelectItem>
                  <SelectItem value="low_stock">Low stock (≤5)</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="active">Active only</SelectItem>
                  <SelectItem value="inactive">Inactive only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        {/* Bulk Actions Bar */}
        {selectedProducts.size > 0 && (
          <div className="flex items-center justify-between px-6 py-3 bg-primary/10 border-b">
            <div className="flex items-center gap-3">
              <CheckSquare className="h-5 w-5 text-primary" />
              <span className="font-medium">{selectedProducts.size} products selected</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowBulkActivateSelectedDialog(true)}
                disabled={isProcessing}
              >
                <Power className="h-4 w-4 mr-2" />
                Activate Selected
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowBulkDeactivateSelectedDialog(true)}
                disabled={isProcessing}
              >
                <PowerOff className="h-4 w-4 mr-2" />
                Deactivate Selected
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedProducts(new Set())}
              >
                Clear Selection
              </Button>
            </div>
          </div>
        )}

        <CardContent className="p-0">
          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <Package className="h-12 w-12 text-muted-foreground/50" />
              <div className="text-center">
                <p className="font-medium">No products found</p>
                <p className="text-sm text-muted-foreground">
                  {allProducts.length === 0
                    ? "This brand doesn't have any products yet"
                    : "Try adjusting your filters"}
                </p>
              </div>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={allVisibleSelected}
                        onCheckedChange={handleToggleAllSelected}
                      />
                    </TableHead>
                    <TableHead className="font-semibold">Name</TableHead>
                    <TableHead className="font-semibold">Code</TableHead>
                    <TableHead className="text-right font-semibold">Price</TableHead>
                    <TableHead className="text-center font-semibold">Stock</TableHead>
                    <TableHead className="text-center font-semibold">Active</TableHead>
                    <TableHead className="text-right font-semibold w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell>
                        <Checkbox
                          checked={selectedProducts.has(product.id)}
                          onCheckedChange={() => handleToggleProductSelected(product.id)}
                        />
                      </TableCell>
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

      {/* Bulk Activate Selected Dialog */}
      <ConfirmDialog
        open={showBulkActivateSelectedDialog}
        onOpenChange={setShowBulkActivateSelectedDialog}
        title="Activate Selected Products"
        description={`Are you sure you want to activate ${selectedProducts.size} selected products?`}
        confirmLabel="Activate"
        onConfirm={handleActivateSelected}
        isLoading={isProcessing}
      />

      {/* Bulk Deactivate Selected Dialog */}
      <ConfirmDialog
        open={showBulkDeactivateSelectedDialog}
        onOpenChange={setShowBulkDeactivateSelectedDialog}
        title="Deactivate Selected Products"
        description={`Are you sure you want to deactivate ${selectedProducts.size} selected products?`}
        confirmLabel="Deactivate"
        onConfirm={handleDeactivateSelected}
        variant="destructive"
        isLoading={isProcessing}
      />
    </div>
  );
}

/**
 * Loading skeleton for brand detail page
 */
function BrandDetailSkeleton() {
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
        <div className="flex items-start gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
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
              {Array.from({ length: 5 }).map((_, i) => (
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
