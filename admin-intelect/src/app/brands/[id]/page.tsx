"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
  ChevronsLeft,
  ChevronsRight,
  Home,
  Warehouse,
  Tag,
  Clock,
  Filter,
  CheckSquare,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Layers,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
import { BrandWithStats, BrandProduct, ProductSource } from "@/types";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useCurrency } from "@/contexts/currency-context";
import { useLocalizedValue, useTranslation } from "@/contexts/language-context";

interface BrandDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

/**
 * Enhanced copy button component with premium animation feedback
 */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { t } = useTranslation("brands");

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(async () => {
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
  }, [text]);

  return (
    <Button
      variant="ghost"
      size="sm"
      className={`
        h-6 px-2 gap-1 transition-all duration-200
        ${copied
          ? "bg-primary/10 text-primary scale-105"
          : "hover:bg-primary/10 hover:text-primary hover:scale-105"
        }
      `}
      onClick={handleCopy}
    >
      <span className={`transition-transform duration-200 ${copied ? "scale-110" : ""}`}>
        {copied ? (
          <Check className="h-3 w-3 text-primary" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
      </span>
      <span className={`text-xs transition-colors duration-200 ${copied ? "text-primary" : ""}`}>
        {copied ? t("detail.copied") : "Copy"}
      </span>
    </Button>
  );
}

/**
 * Premium copyable field component with hover effects
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
    <div className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-all duration-200 group">
      <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`
          text-sm transition-colors duration-200 group-hover:text-foreground
          ${mono ? "font-mono text-xs bg-muted px-2 py-0.5 rounded" : ""}
        `}>
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
 * Filter mapping for API calls
 */
function mapFilterToApi(filter: string): string | undefined {
  if (!filter || filter === "all") return undefined;
  return filter;
}

/**
 * Sort direction type
 */
type SortDirection = "asc" | "desc" | null;

/**
 * Sort config interface
 */
interface SortConfig {
  key: string;
  direction: SortDirection;
}

/**
 * Premium skeleton loader for brand detail page with staggered animations
 */
function BrandDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Breadcrumb skeleton */}
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton
            key={i}
            className={`h-4 ${i % 2 === 0 ? "w-4" : i === 1 ? "w-4" : "w-20"}`}
            style={{ animationDelay: `${i * 30}ms` }}
          />
        ))}
      </div>

      {/* Header skeleton */}
      <div className="flex items-start gap-4">
        <Skeleton className="h-10 w-10 rounded-md" style={{ animationDelay: "50ms" }} />
        <div className="flex items-start gap-4">
          <Skeleton className="h-16 w-16 rounded-full" style={{ animationDelay: "100ms" }} />
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-48" style={{ animationDelay: "150ms" }} />
              <Skeleton className="h-6 w-16 rounded-full" style={{ animationDelay: "200ms" }} />
            </div>
            <Skeleton className="h-4 w-32" style={{ animationDelay: "250ms" }} />
          </div>
        </div>
        <div className="ml-auto">
          <Skeleton className="h-9 w-24 rounded-md" style={{ animationDelay: "300ms" }} />
        </div>
      </div>

      {/* Stats cards skeleton with staggered animation */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border bg-card shadow-sm p-6"
            style={{ animationDelay: `${350 + i * 75}ms` }}
          >
            <div className="flex items-center justify-between mb-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-7 w-7 rounded-lg" />
            </div>
            <Skeleton className="h-8 w-20 mb-2" />
            <Skeleton className="h-3 w-36" style={{ opacity: 1 - (i * 0.1) }} />
          </div>
        ))}
      </div>

      {/* Info cards skeleton */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden" style={{ animationDelay: "650ms" }}>
          <div className="p-6 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-7 rounded-lg" />
              <div>
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-56 mt-1" />
              </div>
            </div>
          </div>
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-11 w-full rounded-lg"
                style={{ opacity: 1 - (i * 0.1) }}
              />
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden" style={{ animationDelay: "725ms" }}>
            <div className="p-6 border-b bg-muted/30">
              <div className="flex items-center gap-2">
                <Skeleton className="h-7 w-7 rounded-lg" />
                <Skeleton className="h-5 w-32" />
              </div>
            </div>
            <div className="p-6 space-y-3">
              <Skeleton className="h-11 w-full rounded-lg" />
              <Skeleton className="h-11 w-full rounded-lg" style={{ opacity: 0.9 }} />
            </div>
          </div>

          <div className="rounded-xl border bg-card shadow-sm overflow-hidden" style={{ animationDelay: "800ms" }}>
            <div className="p-6 border-b bg-muted/30">
              <div className="flex items-center gap-2">
                <Skeleton className="h-7 w-7 rounded-lg" />
                <div>
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-4 w-48 mt-1" />
                </div>
              </div>
            </div>
            <div className="p-6 space-y-3">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" style={{ opacity: 0.9 }} />
            </div>
          </div>
        </div>
      </div>

      {/* Products table skeleton */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden" style={{ animationDelay: "875ms" }}>
        <div className="p-6 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-7 rounded-lg" />
            <div>
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-48 mt-1" />
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="flex gap-3 mb-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-10 w-[180px] rounded-lg"
                style={{ animationDelay: `${950 + i * 50}ms` }}
              />
            ))}
          </div>
          {/* Table rows with staggered opacity */}
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 py-4 border-b last:border-b-0"
              style={{ opacity: 1 - (i * 0.12) }}
            >
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-4 w-[300px]" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20 ml-auto" />
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-5 w-10 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
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
  const { localize } = useLocalizedValue();
  const { t } = useTranslation("brands");
  const { t: tCommon } = useTranslation("common");

  // Animation states
  const [contentVisible, setContentVisible] = useState(false);
  const [rowsVisible, setRowsVisible] = useState(false);

  // Filter state
  const [priceFilter, setPriceFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [allSources, setAllSources] = useState<ProductSource[]>([]);

  // Selection state
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [selectAllMode, setSelectAllMode] = useState<boolean>(false);

  // Sort state
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "", direction: null });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [resolvedId, setResolvedId] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const [jumpToPage, setJumpToPage] = useState("");

  // Memoized sorted products
  const sortedProducts = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) return allProducts;

    return [...allProducts].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortConfig.key) {
        case "name":
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case "code":
          aValue = (a.code || "").toLowerCase();
          bValue = (b.code || "").toLowerCase();
          break;
        case "price":
          aValue = a.price_min ?? 0;
          bValue = b.price_min ?? 0;
          break;
        case "stock":
          aValue = a.total_stock ?? 0;
          bValue = b.total_stock ?? 0;
          break;
        case "active":
          aValue = a.is_active ? 1 : 0;
          bValue = b.is_active ? 1 : 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [allProducts, sortConfig]);

  const handleSort = useCallback((key: string) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        if (prev.direction === "asc") return { key, direction: "desc" };
        if (prev.direction === "desc") return { key: "", direction: null };
      }
      return { key, direction: "asc" };
    });
  }, []);

  const getSortIcon = useCallback((key: string) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    if (sortConfig.direction === "asc") return <ArrowUp className="h-4 w-4 ml-1 text-primary" />;
    if (sortConfig.direction === "desc") return <ArrowDown className="h-4 w-4 ml-1 text-primary" />;
    return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
  }, [sortConfig]);

  // Fetch all products for the current page
  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const { id } = await params;
        if (cancelled) return;

        setResolvedId(id);

        const [brandData, productsData, sourcesData] = await Promise.all([
          api.getBrandWithStats(id),
          api.getBrandProducts(id, pageSize, 0, {
            price_filter: mapFilterToApi(priceFilter),
            stock_filter: mapFilterToApi(stockFilter),
            status_filter: mapFilterToApi(statusFilter),
            source_id: mapFilterToApi(sourceFilter),
          }),
          api.getSources(),
        ]);

        if (cancelled) return;

        if (!brandData) {
          notFound();
          return;
        }

        setBrand(brandData);
        setAllProducts(productsData.data);
        setTotalProducts(productsData.total);
        setAllSources(sourcesData);

        // Trigger animations after data loads
        setTimeout(() => setContentVisible(true), 50);
        setTimeout(() => setRowsVisible(true), 150);
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

  // Fetch products when page changes or filters change
  const fetchProducts = useCallback(async (page: number, size: number = pageSize) => {
    if (!resolvedId) return;

    try {
      const offset = (page - 1) * size;
      const productsData = await api.getBrandProducts(resolvedId, size, offset, {
        price_filter: mapFilterToApi(priceFilter),
        stock_filter: mapFilterToApi(stockFilter),
        status_filter: mapFilterToApi(statusFilter),
        source_id: mapFilterToApi(sourceFilter),
      });
      setAllProducts(productsData.data);
      setTotalProducts(productsData.total);
      setCurrentPage(page);
      // Clear selection on page change unless in selectAllMode
      if (!selectAllMode) {
        setSelectedProducts(new Set());
      }
      // Trigger row animations
      setRowsVisible(false);
      setTimeout(() => setRowsVisible(true), 50);
    } catch (err) {
      console.error("Failed to fetch products:", err);
      toast.error("Failed to load products");
    }
  }, [resolvedId, pageSize, priceFilter, stockFilter, statusFilter, sourceFilter, selectAllMode]);

  // Refetch when filters change
  useEffect(() => {
    if (resolvedId) {
      fetchProducts(1); // Reset to first page when filters change
      setSelectedProducts(new Set());
      setSelectAllMode(false);
    }
  }, [priceFilter, stockFilter, statusFilter, sourceFilter]);

  // Products are filtered on backend, so just use sortedProducts directly
  const filteredProducts = sortedProducts;

  // Check if all visible products are selected
  const allVisibleSelected = filteredProducts.length > 0 && filteredProducts.every(p => selectedProducts.has(p.id));
  const isSomeSelected = selectedProducts.size > 0 || selectAllMode;

  // Toggle all visible products selection
  const handleToggleAllSelected = useCallback(() => {
    if (allVisibleSelected && !selectAllMode) {
      setSelectedProducts(new Set());
      setSelectAllMode(false);
    } else {
      setSelectedProducts(new Set(filteredProducts.map(p => p.id)));
      setSelectAllMode(false);
    }
  }, [allVisibleSelected, selectAllMode, filteredProducts]);

  const handleSelectAllMatching = useCallback(() => {
    setSelectAllMode(true);
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedProducts(new Set());
    setSelectAllMode(false);
  }, []);

  // Toggle individual product selection
  const handleToggleProductSelected = useCallback((productId: string) => {
    setSelectedProducts((prev) => {
      const newSelected = new Set(prev);
      if (newSelected.has(productId)) {
        newSelected.delete(productId);
        // Exit selectAllMode if user deselects an item
        if (selectAllMode) {
          setSelectAllMode(false);
        }
      } else {
        newSelected.add(productId);
      }
      return newSelected;
    });
  }, [selectAllMode]);

  // Handle bulk activate selected
  const handleActivateSelected = async () => {
    if (!brand) return;
    if (selectedProducts.size === 0 && !selectAllMode) return;

    setIsProcessing(true);
    try {
      let result;
      if (selectAllMode) {
        // Use filter-based bulk update
        result = await api.bulkUpdateBrandProducts(brand.id, {
          is_active: true,
          filter: {
            price_filter: mapFilterToApi(priceFilter),
            stock_filter: mapFilterToApi(stockFilter),
            status_filter: mapFilterToApi(statusFilter),
          },
        });
      } else {
        // Use ID-based bulk update
        result = await api.bulkUpdateBrandProducts(brand.id, {
          is_active: true,
          ids: Array.from(selectedProducts),
        });
      }
      toast.success(`Activated ${result.updated} products`);

      // Refresh data
      const updatedBrand = await api.getBrandWithStats(brand.id);
      setBrand(updatedBrand);
      await fetchProducts(currentPage);
      handleClearSelection();
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
    if (!brand) return;
    if (selectedProducts.size === 0 && !selectAllMode) return;

    setIsProcessing(true);
    try {
      let result;
      if (selectAllMode) {
        // Use filter-based bulk update
        result = await api.bulkUpdateBrandProducts(brand.id, {
          is_active: false,
          filter: {
            price_filter: mapFilterToApi(priceFilter),
            stock_filter: mapFilterToApi(stockFilter),
            status_filter: mapFilterToApi(statusFilter),
          },
        });
      } else {
        // Use ID-based bulk update
        result = await api.bulkUpdateBrandProducts(brand.id, {
          is_active: false,
          ids: Array.from(selectedProducts),
        });
      }
      toast.success(`Deactivated ${result.updated} products`);

      // Refresh data
      const updatedBrand = await api.getBrandWithStats(brand.id);
      setBrand(updatedBrand);
      await fetchProducts(currentPage);
      handleClearSelection();
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
      const result = await api.bulkUpdateBrandProducts(brand.id, {
        is_active: true,
        // Update ALL products in brand (no filter)
      });
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
      const result = await api.bulkUpdateBrandProducts(brand.id, {
        is_active: false,
        // Update ALL products in brand (no filter)
      });
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

  const handlePageSizeChange = useCallback((value: string) => {
    const newSize = parseInt(value, 10);
    setPageSize(newSize);
    fetchProducts(1, newSize);
  }, [fetchProducts]);

  const handleJumpToPage = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const page = parseInt(jumpToPage, 10);
      const maxPage = Math.ceil(totalProducts / pageSize);
      if (page >= 1 && page <= maxPage) {
        fetchProducts(page);
        setJumpToPage("");
      } else {
        toast.error(`Please enter a page between 1 and ${maxPage}`);
      }
    }
  }, [jumpToPage, totalProducts, pageSize, fetchProducts]);

  const totalPages = Math.ceil(totalProducts / pageSize);

  if (loading) {
    return <BrandDetailSkeleton />;
  }

  if (error || !brand) {
    return (
      <div className="space-y-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/" className="flex items-center transition-colors hover:text-primary">
                  <Home className="h-4 w-4" />
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/brands" className="transition-colors hover:text-primary">{t("page.title")}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{t("detail.notFound")}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="rounded-xl border border-dashed bg-card shadow-sm">
          <div className="flex flex-col items-center justify-center py-16">
            <div className="p-4 rounded-full bg-muted/50 mb-4">
              <Building2 className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <h2 className="text-xl font-semibold mb-2">{t("detail.notFound")}</h2>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              {error || t("detail.notFoundDescription")}
            </p>
            <Button asChild className="transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
              <Link href="/brands">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t("detail.backToBrands")}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Breadcrumb Navigation */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/" className="flex items-center transition-colors hover:text-primary">
                <Home className="h-4 w-4" />
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/brands" className="transition-colors hover:text-primary">{t("page.title")}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="max-w-[200px] truncate">{localize(brand, "name")}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header Section */}
      <div
        className={`
          flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between
          transition-all duration-300 ease-out
          ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
        `}
      >
        <div className="flex items-start gap-4">
          <Button
            variant="outline"
            size="icon"
            asChild
            className="shrink-0 mt-1 transition-all duration-200 hover:bg-muted hover:shadow-md hover:-translate-y-0.5"
          >
            <Link href="/brands">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16 border-2 border-border shadow-sm ring-2 ring-background">
              {brand.logo_url ? (
                <AvatarImage src={brand.logo_url} alt={brand.name} />
              ) : null}
              <AvatarFallback className="text-xl font-semibold bg-primary/10 text-primary">
                {brand.name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1.5">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl font-bold tracking-tight">{localize(brand, "name")}</h1>
                <Badge
                  variant={brand.is_active ? "default" : "secondary"}
                  className={`
                    transition-all duration-200
                    ${brand.is_active
                      ? "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                      : "hover:bg-muted"
                    }
                  `}
                >
                  {brand.is_active ? t("detail.active") : t("detail.inactive")}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 transition-colors hover:text-foreground">
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
            className="transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {tCommon("actions.delete")}
          </Button>
        </div>
      </div>

      {/* Statistics Cards - Compact inline pills */}
      <div className="flex flex-wrap items-center gap-3">
        {[
          {
            title: t("detail.totalProducts"),
            value: brand.total_products,
            description: t("detail.totalProductsDescription"),
            icon: Package,
            variant: "default" as const,
          },
          {
            title: t("detail.activeProducts"),
            value: brand.active_products,
            description: brand.total_products > 0
              ? `${((brand.active_products / brand.total_products) * 100).toFixed(1)}% ${t("detail.ofTotal")}`
              : t("detail.noProducts"),
            icon: CheckCircle2,
            variant: "success" as const,
          },
          {
            title: t("detail.inStock"),
            value: brand.in_stock_products,
            description: brand.active_products > 0
              ? `${((brand.in_stock_products / brand.active_products) * 100).toFixed(1)}% ${t("detail.ofActive")}`
              : t("detail.noActiveProducts"),
            icon: Warehouse,
            variant: brand.in_stock_products > 0 ? "success" as const : "warning" as const,
          },
          {
            title: t("detail.withPrices"),
            value: brand.with_prices_products,
            description: brand.active_products > 0
              ? `${((brand.with_prices_products / brand.active_products) * 100).toFixed(1)}% ${t("detail.ofActive")}`
              : t("detail.noActiveProducts"),
            icon: Tag,
            variant: brand.with_prices_products > 0 ? "success" as const : "warning" as const,
          },
        ].map((stat, index) => (
          <div
            key={stat.title}
            className={`
              inline-flex items-center gap-2 px-3 py-2 rounded-lg border
              transition-all duration-200 ease-out hover:shadow-sm hover:border-border/80 hover:-translate-y-0.5
              ${stat.variant === "success" ? "bg-primary/5 border-primary/20 hover:bg-primary/10" : ""}
              ${stat.variant === "warning" ? "bg-destructive/5 border-destructive/20 hover:bg-destructive/10" : ""}
              ${stat.variant === "default" ? "bg-muted/50" : ""}
              ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
            `}
            style={{ transitionDelay: contentVisible ? `${100 + index * 50}ms` : "0ms" }}
            title={stat.description}
          >
            <div className={`
              p-1 rounded-md transition-colors
              ${stat.variant === "success" ? "bg-primary/10" : ""}
              ${stat.variant === "warning" ? "bg-destructive/10" : ""}
              ${stat.variant === "default" ? "bg-muted" : ""}
            `}>
              <stat.icon className={`h-3.5 w-3.5 transition-colors ${
                stat.variant === "success" ? "text-primary" :
                stat.variant === "warning" ? "text-destructive" :
                "text-muted-foreground"
              }`} />
            </div>
            <span className="text-xs font-medium text-muted-foreground">{stat.title}</span>
            <span className="text-sm font-semibold tabular-nums">{(stat.value ?? 0).toLocaleString()}</span>
          </div>
        ))}
      </div>

      {/* Brand Information & Admin Actions Grid */}
      <div
        className={`
          grid gap-4 lg:grid-cols-2
          transition-all duration-300 ease-out
          ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
        `}
        style={{ transitionDelay: contentVisible ? "400ms" : "0ms" }}
      >
        {/* Brand Information */}
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md">
          <div className="p-3 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-background shadow-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">{t("detail.information")}</h3>
                <p className="text-xs text-muted-foreground">{t("detail.informationDescription")}</p>
              </div>
            </div>
          </div>
          <div className="p-3 space-y-1">
            <CopyableField label={t("detail.idUuid")} value={brand.id} mono />
            <Separator className="my-2" />
            <CopyableField label={t("detail.ultraId")} value={brand.ultra_id} mono />
            <Separator className="my-2" />
            <CopyableField label={t("detail.slug")} value={brand.slug} />
            {brand.logo_url && (
              <>
                <Separator className="my-2" />
                <div className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-all duration-200 group">
                  <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">{t("detail.logo")}</span>
                  <div className="flex items-center gap-2">
                    <a
                      href={brand.logo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex items-center gap-1 transition-all duration-200 hover:text-primary/80"
                    >
                      {t("detail.viewLogo")}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <CopyButton text={brand.logo_url} />
                  </div>
                </div>
              </>
            )}
            <Separator className="my-2" />
            <div className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-all duration-200 group">
              <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">{t("detail.status")}</span>
              <div className="flex items-center gap-3">
                {brand.is_active ? (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
                <Switch
                  checked={brand.is_active}
                  onCheckedChange={handleToggleActive}
                  disabled={isProcessing}
                  className="transition-opacity hover:opacity-80"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Timestamps & Actions */}
        <div className="space-y-4">
          {/* Timestamps */}
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md">
            <div className="p-3 border-b bg-muted/30">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-background shadow-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-sm">{t("detail.timestamps")}</h3>
              </div>
            </div>
            <div className="p-3 space-y-1">
              <div className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-all duration-200 group">
                <span className="text-sm text-muted-foreground flex items-center gap-2 group-hover:text-foreground transition-colors">
                  <Calendar className="h-3.5 w-3.5" />
                  {t("detail.created")}
                </span>
                <span className="text-sm tabular-nums">{formatTimestamp(brand.created_at)}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-all duration-200 group">
                <span className="text-sm text-muted-foreground flex items-center gap-2 group-hover:text-foreground transition-colors">
                  <Calendar className="h-3.5 w-3.5" />
                  {t("detail.updated")}
                </span>
                <span className="text-sm tabular-nums">{formatTimestamp(brand.updated_at)}</span>
              </div>
            </div>
          </div>

          {/* Admin Actions */}
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md">
            <div className="p-3 border-b bg-muted/30">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-background shadow-sm">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{t("detail.adminActions")}</h3>
                  <p className="text-xs text-muted-foreground">{t("detail.adminActionsDescription")}</p>
                </div>
              </div>
            </div>
            <div className="p-3">
              <div className="flex flex-col gap-3">
                <Button
                  variant="outline"
                  className="justify-start transition-all duration-200 hover:bg-primary/10 hover:text-primary hover:border-primary/30 hover:shadow-sm hover:-translate-y-0.5"
                  onClick={() => setShowBulkActivateDialog(true)}
                  disabled={isProcessing || brand.total_products === 0}
                >
                  <Power className="h-4 w-4 mr-2" />
                  {t("detail.activateAllProducts")}
                </Button>
                <Button
                  variant="outline"
                  className="justify-start transition-all duration-200 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 hover:shadow-sm hover:-translate-y-0.5"
                  onClick={() => setShowBulkDeactivateDialog(true)}
                  disabled={isProcessing || brand.total_products === 0}
                >
                  <PowerOff className="h-4 w-4 mr-2" />
                  {t("detail.deactivateAllProducts")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div
        className={`
          rounded-xl border bg-card shadow-sm overflow-hidden
          transition-all duration-300 ease-out
          ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
        `}
        style={{ transitionDelay: contentVisible ? "500ms" : "0ms" }}
      >
        <div className="p-3 border-b bg-muted/30">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-background shadow-sm">
                  <Package className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{t("detail.products")}</h3>
                  <p className="text-xs text-muted-foreground">
                    {(totalProducts ?? 0).toLocaleString()} {t("detail.productsInBrand")}
                    {filteredProducts.length !== allProducts.length && (
                      <> ({filteredProducts.length} {t("detail.filtered")})</>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Filter Controls */}
            <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl border bg-background/50 transition-all duration-200 hover:bg-background/80">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium">{t("detail.filters")}:</span>
              </div>
              <Select value={priceFilter} onValueChange={setPriceFilter}>
                <SelectTrigger className="w-[180px] transition-all duration-200 focus:ring-2 focus:ring-primary/20 hover:bg-muted/50">
                  <SelectValue placeholder={t("detail.price")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("detail.allPrices")}</SelectItem>
                  <SelectItem value="no_price">{t("detail.noPrice")}</SelectItem>
                  <SelectItem value="no_mdl">{t("detail.noMdlPrice")}</SelectItem>
                  <SelectItem value="no_eur">{t("detail.noEurPrice")}</SelectItem>
                  <SelectItem value="no_usd">{t("detail.noUsdPrice")}</SelectItem>
                  <SelectItem value="with_price">{t("detail.withPrice")}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={stockFilter} onValueChange={setStockFilter}>
                <SelectTrigger className="w-[180px] transition-all duration-200 focus:ring-2 focus:ring-primary/20 hover:bg-muted/50">
                  <SelectValue placeholder={t("detail.stock")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("detail.allStock")}</SelectItem>
                  <SelectItem value="in_stock">{t("detail.inStockOnly")}</SelectItem>
                  <SelectItem value="out_of_stock">{t("detail.outOfStock")}</SelectItem>
                  <SelectItem value="low_stock">{t("detail.lowStock")}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px] transition-all duration-200 focus:ring-2 focus:ring-primary/20 hover:bg-muted/50">
                  <SelectValue placeholder={tCommon("labels.status")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("detail.allStatus")}</SelectItem>
                  <SelectItem value="active">{t("detail.activeOnly")}</SelectItem>
                  <SelectItem value="inactive">{t("detail.inactiveOnly")}</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger className="w-[140px] transition-all duration-200 focus:ring-2 focus:ring-primary/20 hover:bg-muted/50">
                    <SelectValue placeholder={t("detail.source")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("detail.allSources")}</SelectItem>
                    {allSources.map((source) => (
                      <SelectItem key={source.id} value={source.id}>
                        {source.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {isSomeSelected && (
          <div className="flex items-center justify-between px-6 py-3 bg-accent/80 backdrop-blur-sm border-b border-border animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground">
                  {selectAllMode
                    ? t("detail.allMatchingSelected", { count: totalProducts ?? 0 })
                    : selectedProducts.size === 1
                      ? t("detail.selectedCount", { count: selectedProducts.size })
                      : t("detail.selectedCountPlural", { count: selectedProducts.size })
                  }
                </span>
              </div>

              {allVisibleSelected && !selectAllMode && totalProducts > filteredProducts.length && (
                <Button
                  variant="link"
                  size="sm"
                  className="text-primary transition-colors hover:text-primary/80"
                  onClick={handleSelectAllMatching}
                >
                  {t("detail.selectAll", { count: totalProducts ?? 0 })}
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowBulkActivateSelectedDialog(true)}
                disabled={isProcessing}
                className="transition-all duration-200 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
              >
                <Power className="h-4 w-4 mr-2" />
                {t("detail.activate")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowBulkDeactivateSelectedDialog(true)}
                disabled={isProcessing}
                className="transition-all duration-200 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
              >
                <PowerOff className="h-4 w-4 mr-2" />
                {t("detail.deactivate")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleClearSelection}
                disabled={isProcessing}
                className="transition-colors hover:bg-muted"
              >
                {t("detail.clear")}
              </Button>
            </div>
          </div>
        )}

        <div className="p-0">
          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16">
              <div className="p-4 rounded-full bg-muted/50">
                <Package className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <div className="text-center">
                <p className="font-medium text-foreground">{t("detail.noProductsFound")}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {allProducts.length === 0
                    ? t("detail.noBrandProducts")
                    : t("detail.tryAdjustingFilters")}
                </p>
              </div>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={allVisibleSelected}
                        onCheckedChange={handleToggleAllSelected}
                        className="transition-transform hover:scale-110"
                      />
                    </TableHead>
                    <TableHead
                      className="font-semibold cursor-pointer select-none transition-colors hover:text-primary"
                      onClick={() => handleSort("name")}
                    >
                      <span className="flex items-center">
                        {t("detail.name")}
                        {getSortIcon("name")}
                      </span>
                    </TableHead>
                    <TableHead
                      className="font-semibold cursor-pointer select-none transition-colors hover:text-primary"
                      onClick={() => handleSort("code")}
                    >
                      <span className="flex items-center">
                        {t("detail.code")}
                        {getSortIcon("code")}
                      </span>
                    </TableHead>
                    <TableHead
                      className="text-right font-semibold cursor-pointer select-none transition-colors hover:text-primary"
                      onClick={() => handleSort("price")}
                    >
                      <span className="flex items-center justify-end">
                        {t("detail.price")}
                        {getSortIcon("price")}
                      </span>
                    </TableHead>
                    <TableHead
                      className="text-center font-semibold cursor-pointer select-none transition-colors hover:text-primary"
                      onClick={() => handleSort("stock")}
                    >
                      <span className="flex items-center justify-center">
                        {t("detail.stock")}
                        {getSortIcon("stock")}
                      </span>
                    </TableHead>
                    <TableHead
                      className="text-center font-semibold cursor-pointer select-none transition-colors hover:text-primary"
                      onClick={() => handleSort("active")}
                    >
                      <span className="flex items-center justify-center">
                        {tCommon("status.active")}
                        {getSortIcon("active")}
                      </span>
                    </TableHead>
                    <TableHead className="font-semibold">{t("detail.source")}</TableHead>
                    <TableHead className="text-right font-semibold w-[80px]">{tCommon("labels.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product, index) => (
                    <TableRow
                      key={product.id}
                      className={`
                        transition-all duration-200
                        hover:bg-muted/50
                        ${selectedProducts.has(product.id) || selectAllMode ? "bg-accent/50" : ""}
                        ${rowsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
                      `}
                      style={{
                        transitionDelay: rowsVisible ? `${Math.min(index * 25, 400)}ms` : "0ms",
                      }}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedProducts.has(product.id) || selectAllMode}
                          onCheckedChange={() => handleToggleProductSelected(product.id)}
                          className="transition-transform hover:scale-110"
                        />
                      </TableCell>
                      <TableCell className="font-medium max-w-[300px]">
                        <Link
                          href={`/products/${product.id}`}
                          className="hover:underline hover:text-primary truncate block transition-colors duration-200"
                        >
                          {localize(product, "name").length > 50
                            ? `${localize(product, "name").substring(0, 50)}...`
                            : localize(product, "name")}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {product.code || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {product.price_min !== null ? (
                          <span className="font-medium text-foreground tabular-nums">
                            {formatPrice(product.price_min)}
                          </span>
                        ) : (
                          <Badge variant="outline" className="font-normal text-muted-foreground">
                            {t("detail.noPriceLabel")}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={(product.total_stock ?? 0) > 0 ? "default" : "destructive"}
                          className={`
                            tabular-nums transition-all duration-200
                            ${(product.total_stock ?? 0) > 0
                              ? "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                              : "bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20"
                            }
                          `}
                        >
                          <Warehouse className="h-3 w-3 mr-1" />
                          {(product.total_stock ?? 0) > 0 ? (product.total_stock ?? 0) : t("detail.outLabel")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={product.is_active}
                          onCheckedChange={(checked) => handleToggleProductActive(product, checked)}
                          disabled={togglingProductId === product.id}
                          className="transition-opacity hover:opacity-80"
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {product.source_name ? (
                          <Badge variant="outline" className="font-normal">
                            {product.source_name}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground/50">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 transition-all duration-200 hover:bg-muted hover:scale-105"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-[160px]">
                            <DropdownMenuItem asChild>
                              <Link href={`/products/${product.id}`} className="cursor-pointer">
                                <Eye className="h-4 w-4 mr-2" />
                                {t("actions.viewDetails")}
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/products/${product.id}/edit`} className="cursor-pointer">
                                <Pencil className="h-4 w-4 mr-2" />
                                {tCommon("actions.edit")}
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                setProductToDelete(product);
                                setShowDeleteProductDialog(true);
                              }}
                              className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {tCommon("actions.delete")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Enhanced Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t bg-muted/30 gap-4">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>
                      {t("detail.showing")} <span className="font-medium text-foreground">{((currentPage - 1) * pageSize) + 1}</span> {t("detail.to")}{" "}
                      <span className="font-medium text-foreground">{Math.min(currentPage * pageSize, totalProducts ?? 0)}</span> {t("detail.of")}{" "}
                      <span className="font-medium text-foreground">{(totalProducts ?? 0).toLocaleString()}</span> {t("detail.products")}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs">{t("detail.show")}:</span>
                      <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                        <SelectTrigger className="h-8 w-[70px] text-xs transition-all duration-200 hover:bg-muted/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchProducts(1)}
                      disabled={currentPage === 1}
                      className="h-8 w-8 p-0 transition-all duration-200 hover:bg-muted hover:shadow-sm"
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchProducts(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="transition-all duration-200 hover:bg-muted hover:shadow-sm"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      {t("detail.previous")}
                    </Button>
                    <div className="flex items-center gap-2 mx-2">
                      <Input
                        type="number"
                        min={1}
                        max={totalPages}
                        value={jumpToPage}
                        onChange={(e) => setJumpToPage(e.target.value)}
                        onKeyDown={handleJumpToPage}
                        placeholder={currentPage.toString()}
                        className="h-8 w-16 text-center text-xs tabular-nums transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                      />
                      <span className="text-sm text-muted-foreground">/ {totalPages}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchProducts(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="transition-all duration-200 hover:bg-muted hover:shadow-sm"
                    >
                      {t("detail.next")}
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchProducts(totalPages)}
                      disabled={currentPage === totalPages}
                      className="h-8 w-8 p-0 transition-all duration-200 hover:bg-muted hover:shadow-sm"
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Delete Brand Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title={t("dialogs.deleteTitle")}
        description={`${t("detail.confirmDelete")} "${localize(brand, "name")}"? ${t("detail.deleteWarning")} ${(brand.total_products ?? 0).toLocaleString()} ${t("detail.associatedProducts")}.`}
        confirmLabel={tCommon("actions.delete")}
        onConfirm={handleDeleteBrand}
        variant="destructive"
        isLoading={isProcessing}
      />

      {/* Bulk Activate Products Dialog */}
      <ConfirmDialog
        open={showBulkActivateDialog}
        onOpenChange={setShowBulkActivateDialog}
        title={t("detail.activateAllProducts")}
        description={`${t("detail.confirmActivateAll")} ${(brand.total_products ?? 0).toLocaleString()} ${t("detail.productsFrom")} "${localize(brand, "name")}"?`}
        confirmLabel={t("detail.activateAllProducts")}
        onConfirm={handleBulkActivateProducts}
        isLoading={isProcessing}
      />

      {/* Bulk Deactivate Products Dialog */}
      <ConfirmDialog
        open={showBulkDeactivateDialog}
        onOpenChange={setShowBulkDeactivateDialog}
        title={t("detail.deactivateAllProducts")}
        description={`${t("detail.confirmDeactivateAll")} ${(brand.total_products ?? 0).toLocaleString()} ${t("detail.productsFrom")} "${localize(brand, "name")}"?`}
        confirmLabel={t("detail.deactivateAllProducts")}
        onConfirm={handleBulkDeactivateProducts}
        variant="destructive"
        isLoading={isProcessing}
      />

      {/* Delete Product Dialog */}
      <ConfirmDialog
        open={showDeleteProductDialog}
        onOpenChange={setShowDeleteProductDialog}
        title={tCommon("actions.delete")}
        description={`${t("detail.confirmDeleteProduct")} "${productToDelete ? localize(productToDelete, "name") : ""}"? ${t("detail.cannotBeUndone")}.`}
        confirmLabel={tCommon("actions.delete")}
        onConfirm={handleDeleteProduct}
        variant="destructive"
        isLoading={isProcessing}
      />

      {/* Bulk Activate Selected Dialog */}
      <ConfirmDialog
        open={showBulkActivateSelectedDialog}
        onOpenChange={setShowBulkActivateSelectedDialog}
        title={t("detail.activate") + " " + t("detail.selectedProducts")}
        description={
          selectAllMode
            ? `${t("detail.confirmActivateSelected")} ${(totalProducts ?? 0).toLocaleString()} ${t("detail.matchingProducts")}?`
            : `${t("detail.confirmActivateSelected")} ${selectedProducts.size} ${t("detail.selectedProducts")}?`
        }
        confirmLabel={t("detail.activate")}
        onConfirm={handleActivateSelected}
        isLoading={isProcessing}
      />

      {/* Bulk Deactivate Selected Dialog */}
      <ConfirmDialog
        open={showBulkDeactivateSelectedDialog}
        onOpenChange={setShowBulkDeactivateSelectedDialog}
        title={t("detail.deactivate") + " " + t("detail.selectedProducts")}
        description={
          selectAllMode
            ? `${t("detail.confirmDeactivateSelected")} ${(totalProducts ?? 0).toLocaleString()} ${t("detail.matchingProducts")}?`
            : `${t("detail.confirmDeactivateSelected")} ${selectedProducts.size} ${t("detail.selectedProducts")}?`
        }
        confirmLabel={t("detail.deactivate")}
        onConfirm={handleDeactivateSelected}
        variant="destructive"
        isLoading={isProcessing}
      />
    </div>
  );
}
