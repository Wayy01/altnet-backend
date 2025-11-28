"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Package,
  Barcode,
  Image as ImageIcon,
  Calendar,
  Tag,
  DollarSign,
  Warehouse,
  Info,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Shield,
  Settings,
  Hash,
  Database,
  Boxes,
  Filter,
  Code,
  Clock,
  CheckCircle2,
  XCircle,
  Braces,
  Home,
  Building2,
  FolderTree,
  ZoomIn,
  ArrowUp,
  ArrowDown,
  GitBranch,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { api } from "@/lib/api";
import { Property, Characteristic, ProductDetail, ImageEntry, Product } from "@/types";
import { useCurrency, getPriceByCurrency } from "@/contexts/currency-context";
import { useLocalizedValue } from "@/contexts/language-context";
import { VariantSelector } from "@/components/variant-selector";

interface ProductDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

/**
 * Premium image gallery modal with zoom and navigation
 */
function ImageGalleryModal({
  images,
  isOpen,
  onClose,
  initialIndex = 0,
}: {
  images: ImageEntry[];
  isOpen: boolean;
  onClose: () => void;
  initialIndex?: number;
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setIsZoomed(false);
  }, [initialIndex, isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentIndex]);

  const handlePrev = () => {
    if (images.length === 0) return;
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    setIsZoomed(false);
  };

  const handleNext = () => {
    if (images.length === 0) return;
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    setIsZoomed(false);
  };

  const currentImage = images[currentIndex];
  const imageUrl = currentImage?.url || currentImage?.path_global || '';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-background/95 backdrop-blur-xl">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-muted">
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
              </div>
              Image {currentIndex + 1} of {images.length}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsZoomed(!isZoomed)}
              className="gap-2 transition-all duration-200 hover:bg-primary/10 hover:text-primary"
            >
              <ZoomIn className="h-4 w-4" />
              {isZoomed ? "Reset" : "Zoom"}
            </Button>
          </DialogTitle>
        </DialogHeader>
        <div className="p-4">
          <div
            className={`
              relative bg-muted rounded-xl overflow-hidden transition-all duration-300
              ${isZoomed ? "aspect-auto h-[70vh]" : "aspect-square"}
            `}
          >
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={currentImage?.description || `Product image ${currentIndex + 1}`}
                fill
                className={`
                  transition-transform duration-300 ease-out
                  ${isZoomed ? "object-contain cursor-zoom-out" : "object-contain cursor-zoom-in hover:scale-105"}
                `}
                onClick={() => setIsZoomed(!isZoomed)}
                unoptimized
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="p-4 rounded-full bg-muted/50">
                  <ImageIcon className="h-16 w-16 text-muted-foreground/50" />
                </div>
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex items-center justify-between mt-4">
              <Button
                variant="outline"
                onClick={handlePrev}
                className="transition-all duration-200 hover:bg-muted hover:shadow-sm hover:-translate-y-0.5"
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
              <div className="flex gap-2">
                {images.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setCurrentIndex(index);
                      setIsZoomed(false);
                    }}
                    className={`
                      w-2.5 h-2.5 rounded-full transition-all duration-200
                      ${index === currentIndex
                        ? "bg-primary scale-125 shadow-sm"
                        : "bg-muted-foreground/30 hover:bg-muted-foreground/50 hover:scale-110"
                      }
                    `}
                  />
                ))}
              </div>
              <Button
                variant="outline"
                onClick={handleNext}
                className="transition-all duration-200 hover:bg-muted hover:shadow-sm hover:-translate-y-0.5"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}
          {currentImage?.description && (
            <p className="text-sm text-muted-foreground text-center mt-3 px-4">
              {currentImage.description}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Enhanced copy button with premium animation feedback
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
      className={`
        h-6 px-2 gap-1 transition-all duration-200
        ${copied
          ? "bg-primary/10 text-primary"
          : "hover:bg-primary/10 hover:text-primary"
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
      {label && (
        <span className={`text-xs transition-colors duration-200 ${copied ? "text-primary" : ""}`}>
          {copied ? "Copied" : label}
        </span>
      )}
    </Button>
  );
}

/**
 * Premium copyable field with hover effects
 */
function CopyableField({ label, value, mono = false }: { label: string; value: string | null | undefined; mono?: boolean }) {
  if (!value) return null;

  return (
    <div className="flex justify-between items-center py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-all duration-200 group">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className={`
          text-sm transition-colors duration-200 group-hover:text-foreground
          ${mono ? "font-mono text-xs bg-muted px-2 py-0.5 rounded" : ""}
        `}>
          {value.length > 40 ? `${value.substring(0, 20)}...${value.substring(value.length - 8)}` : value}
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
 * Premium skeleton loader with staggered animations
 */
function ProductDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Breadcrumb skeleton */}
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton
            key={i}
            className={`h-4 ${i % 2 === 0 ? "w-4" : "w-20"}`}
            style={{ animationDelay: `${i * 30}ms` }}
          />
        ))}
      </div>

      {/* Header skeleton */}
      <div className="flex items-start gap-4">
        <Skeleton className="h-10 w-10 rounded-md" style={{ animationDelay: "50ms" }} />
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-72" style={{ animationDelay: "100ms" }} />
            <Skeleton className="h-6 w-16 rounded-full" style={{ animationDelay: "150ms" }} />
            <Skeleton className="h-6 w-20 rounded-full" style={{ animationDelay: "200ms" }} />
          </div>
          <div className="flex gap-4">
            <Skeleton className="h-4 w-28" style={{ animationDelay: "250ms" }} />
            <Skeleton className="h-4 w-36" style={{ animationDelay: "300ms" }} />
          </div>
        </div>
        <Skeleton className="h-9 w-28 rounded-md" style={{ animationDelay: "350ms" }} />
      </div>

      {/* Stats cards skeleton with staggered animation */}
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border bg-card shadow-sm p-6 animate-pulse"
            style={{
              animationDelay: `${400 + i * 75}ms`,
              opacity: 1 - (i * 0.1),
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-7 w-7 rounded-lg" />
            </div>
            <Skeleton className="h-7 w-20 mb-2" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
        ))}
      </div>

      {/* Price card skeleton */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden" style={{ animationDelay: "700ms" }}>
        <div className="p-6 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-7 rounded-lg" />
            <div>
              <Skeleton className="h-5 w-52" />
              <Skeleton className="h-4 w-40 mt-1" />
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-20 rounded-xl"
                style={{
                  animationDelay: `${750 + i * 50}ms`,
                  opacity: 1 - (i * 0.05),
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Content cards skeleton */}
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border bg-card shadow-sm overflow-hidden animate-pulse"
            style={{
              animationDelay: `${1050 + i * 100}ms`,
              opacity: 1 - (i * 0.1),
            }}
          >
            <div className="p-6 border-b bg-muted/30">
              <div className="flex items-center gap-2">
                <Skeleton className="h-7 w-7 rounded-lg" />
                <Skeleton className="h-5 w-40" />
              </div>
            </div>
            <div className="p-6 space-y-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <Skeleton
                  key={j}
                  className="h-11 w-full rounded-lg"
                  style={{ opacity: 1 - (j * 0.15) }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProductDetailPage({
  params,
}: ProductDetailPageProps) {
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [characteristics, setCharacteristics] = useState<Characteristic[]>([]);
  const [variants, setVariants] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [showRawPrices, setShowRawPrices] = useState(false);
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [contentVisible, setContentVisible] = useState(false);
  const [rowsVisible, setRowsVisible] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [mainImageFailed, setMainImageFailed] = useState(false);
  const { currency, formatPrice } = useCurrency();
  const { localize, localizePropertyName, localizeGroupName } = useLocalizedValue();

  // Memoized computations
  const groupedProperties = useMemo(() =>
    properties.reduce((acc, prop) => {
      const group = prop.group_name || "General";
      if (!acc[group]) {
        acc[group] = [];
      }
      acc[group].push(prop);
      return acc;
    }, {} as Record<string, Property[]>),
    [properties]
  );

  const allCurrencies = useMemo(() =>
    Array.from(
      new Set(
        characteristics.flatMap((char) =>
          char.prices?.map((p) => p.currency) || []
        )
      )
    ).sort(),
    [characteristics]
  );

  const { totalWarehouseStock, totalShowroomStock } = useMemo(() => ({
    totalWarehouseStock: characteristics.reduce(
      (sum, char) => sum + (char.stock_warehouse || 0),
      0
    ),
    totalShowroomStock: characteristics.reduce(
      (sum, char) => sum + (char.stock_showroom || 0),
      0
    ),
  }), [characteristics]);

  const currentPrice = useMemo(
    () => product ? getPriceByCurrency(product, currency) : null,
    [product, currency]
  );

  const jsonString = useMemo(() => {
    try {
      return JSON.stringify({
        product,
        properties,
        characteristics,
        variants,
      }, null, 2);
    } catch {
      return 'Error: Unable to stringify data';
    }
  }, [product, properties, characteristics, variants]);

  // Filter out images that failed to load
  const validImages = useMemo(() => {
    if (!product?.images) return [];
    return product.images.filter(img => !failedImages.has(img.uuid));
  }, [product?.images, failedImages]);

  // Get the effective main image URL (fallback to first valid image if main fails)
  const effectiveMainImageUrl = useMemo(() => {
    if (product?.main_image_url && !mainImageFailed) {
      return product.main_image_url;
    }
    // Fallback to first valid image
    if (validImages.length > 0) {
      return validImages[0].url || validImages[0].path_global || null;
    }
    return null;
  }, [product?.main_image_url, mainImageFailed, validImages]);

  const handleImageError = useCallback((imageUuid: string) => {
    setFailedImages(prev => new Set(prev).add(imageUuid));
  }, []);

  const openGallery = useCallback((index: number) => {
    setGalleryIndex(index);
    setGalleryOpen(true);
  }, []);

  // Reset failed images when product changes
  useEffect(() => {
    setFailedImages(new Set());
    setMainImageFailed(false);
  }, [product?.id]);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const { id } = await params;
        if (cancelled) return;

        // First, fetch the product and related data in parallel
        const [productData, propertiesData, characteristicsData] = await Promise.all([
          api.getProduct(id),
          api.getProductProperties(id),
          api.getProductCharacteristics(id),
        ]);

        if (cancelled) return;

        if (!productData) {
          notFound();
          return;
        }

        // Set product data immediately
        setProduct(productData);
        setProperties(propertiesData);
        setCharacteristics(characteristicsData);

        // Now fetch variants based on product's parent_id/is_group status
        // This needs the product data to determine the correct fetching strategy
        try {
          const variantsData = await api.getProductVariantsForDetail(id, productData);
          if (!cancelled) {
            setVariants(variantsData);
          }
        } catch (variantErr) {
          console.error("Failed to fetch variants:", variantErr);
          // Continue without variants - non-critical error
          if (!cancelled) {
            setVariants([]);
          }
        }

        // Trigger staggered content animations
        setTimeout(() => setContentVisible(true), 50);
        setTimeout(() => setRowsVisible(true), 200);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to fetch product:", err);
        setError("Failed to load product. Make sure the Go backend API is running.");
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

  if (loading) {
    return <ProductDetailSkeleton />;
  }

  if (error || !product) {
    return (
      <div className="space-y-6">
        {/* Breadcrumb */}
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
                <Link href="/products" className="transition-colors hover:text-primary">Products</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Not Found</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="rounded-xl border border-dashed bg-card shadow-sm">
          <div className="flex flex-col items-center justify-center py-16">
            <div className="p-4 rounded-full bg-muted/50 mb-4">
              <Package className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Product Not Found</h2>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              {error || "The product you're looking for doesn't exist or has been removed."}
            </p>
            <Button asChild className="transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
              <Link href="/products">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Products
              </Link>
            </Button>
          </div>
        </div>
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
              <Link href="/" className="flex items-center transition-colors hover:text-primary">
                <Home className="h-4 w-4" />
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/products" className="transition-colors hover:text-primary">Products</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="max-w-[200px] truncate">
              {localize(product, "name")}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div
        className={`
          flex items-start gap-4 transition-all duration-300 ease-out
          ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
        `}
      >
        <Button
          variant="outline"
          size="icon"
          asChild
          className="shrink-0 mt-1 transition-all duration-200 hover:bg-muted hover:shadow-md hover:-translate-y-0.5"
        >
          <Link href="/products">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold tracking-tight">{localize(product, "name")}</h1>
            <Badge
              variant={product.is_active ? "default" : "secondary"}
              className={`
                transition-all duration-200
                ${product.is_active
                  ? "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                  : "hover:bg-muted"
                }
              `}
            >
              {product.is_active ? "Active" : "Inactive"}
            </Badge>
            {product.is_group && (
              <Badge variant="outline" className="transition-colors hover:bg-muted">Group</Badge>
            )}
            {product.is_service && (
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
                Service
              </Badge>
            )}
            {!product.is_in_stock && (product.total_stock ?? 0) === 0 && (
              <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20">
                Out of Stock
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 mt-2 text-muted-foreground flex-wrap text-sm">
            <span className="flex items-center gap-1.5 transition-colors hover:text-foreground">
              <Tag className="h-3.5 w-3.5" />
              Code: {product.code}
            </span>
            {product.article && (
              <span className="transition-colors hover:text-foreground">Article: {product.article}</span>
            )}
            {product.slug && (
              <span className="flex items-center gap-1.5 transition-colors hover:text-foreground">
                <Code className="h-3.5 w-3.5" />
                Slug: {product.slug}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            asChild
            className="flex items-center gap-2 transition-all duration-200 hover:bg-primary/10 hover:text-primary hover:border-primary/30 hover:shadow-sm hover:-translate-y-0.5"
          >
            <Link href={`/products/new?duplicate=${product.id}`}>
              <GitBranch className="h-4 w-4" />
              Add Variant
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowJsonModal(true)}
            className="flex items-center gap-2 transition-all duration-200 hover:bg-primary/10 hover:text-primary hover:border-primary/30 hover:shadow-sm hover:-translate-y-0.5"
          >
            <Braces className="h-4 w-4" />
            JSON View
          </Button>
        </div>
      </div>

      {/* JSON View Modal */}
      <Dialog open={showJsonModal} onOpenChange={setShowJsonModal}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] w-full overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-muted">
                <Braces className="h-4 w-4 text-muted-foreground" />
              </div>
              Raw JSON Data
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            <pre className="bg-muted p-4 rounded-xl text-xs overflow-auto font-mono leading-relaxed">
              {jsonString}
            </pre>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Stats Row - Premium Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          {
            title: "Stock Status",
            value: product.total_stock ?? 0,
            badge: (product.total_stock ?? 0) > 0 ? "In Stock" : "Out of Stock",
            badgeVariant: (product.total_stock ?? 0) > 0 ? "success" : "warning",
            icon: Warehouse,
          },
          {
            title: `Price (${currency})`,
            value: currentPrice !== null ? formatPrice(currentPrice) : "N/A",
            badge: allCurrencies.length > 0 ? allCurrencies.join(", ") : "MDL",
            badgeVariant: "muted",
            icon: DollarSign,
          },
          {
            title: "Brand",
            value: product.brand ? localize(product.brand, "name") : (product.brand_name || "No brand"),
            badge: product.brand?.slug,
            badgeVariant: "muted",
            icon: Building2,
            link: product.brand_id ? `/brands/${product.brand_id}` : undefined,
          },
          {
            title: "Category",
            value: product.category ? localize(product.category, "name") : (product.category_name || "No category"),
            badge: product.category?.product_count !== undefined
              ? `${(product.category.product_count ?? 0).toLocaleString()} products`
              : undefined,
            badgeVariant: "muted",
            icon: FolderTree,
            link: product.category_id ? `/categories/${product.category_id}` : undefined,
          },
        ].map((stat, index) => (
          <div
            key={stat.title}
            className={`
              rounded-xl border bg-card shadow-sm overflow-hidden
              transition-all duration-300 ease-out
              ${stat.link ? "cursor-pointer hover:shadow-lg hover:-translate-y-1.5 hover:border-primary/30" : "hover:shadow-md hover:-translate-y-1"}
              ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
            `}
            style={{ transitionDelay: contentVisible ? `${100 + index * 75}ms` : "0ms" }}
          >
            {stat.link ? (
              <Link href={stat.link} className="block p-6 group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">{stat.title}</span>
                  <div className="p-1.5 rounded-lg bg-muted group-hover:bg-primary/10 transition-colors">
                    <stat.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </div>
                <div className="text-xl font-bold mb-1 line-clamp-1 group-hover:text-primary transition-colors">{stat.value}</div>
                {stat.badge && (
                  <p className="text-xs text-muted-foreground">{stat.badge}</p>
                )}
              </Link>
            ) : (
              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-muted-foreground">{stat.title}</span>
                  <div className={`
                    p-1.5 rounded-lg transition-colors
                    ${stat.badgeVariant === "success" ? "bg-primary/10" : ""}
                    ${stat.badgeVariant === "warning" ? "bg-destructive/10" : ""}
                    ${stat.badgeVariant === "muted" ? "bg-muted" : ""}
                  `}>
                    <stat.icon className={`
                      h-4 w-4 transition-colors
                      ${stat.badgeVariant === "success" ? "text-primary" : ""}
                      ${stat.badgeVariant === "warning" ? "text-destructive" : ""}
                      ${stat.badgeVariant === "muted" ? "text-muted-foreground" : ""}
                    `} />
                  </div>
                </div>
                <div className="text-xl font-bold mb-1 tabular-nums">{stat.value}</div>
                {stat.badge && (
                  <Badge
                    variant={stat.badgeVariant === "success" ? "default" : "secondary"}
                    className={`
                      transition-colors
                      ${stat.badgeVariant === "success" ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20" : ""}
                      ${stat.badgeVariant === "warning" ? "bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20" : ""}
                    `}
                  >
                    {stat.badge}
                  </Badge>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Variant Selector */}
      {variants.length > 1 && (
        <div
          className={`
            transition-all duration-300 ease-out
            ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
          `}
          style={{ transitionDelay: contentVisible ? "400ms" : "0ms" }}
        >
          <VariantSelector
            variants={variants}
            currentProductId={product.id}
          />
        </div>
      )}

      {/* All Currency Prices - Product Level */}
      <div
        className={`
          rounded-xl border bg-card shadow-sm overflow-hidden
          transition-all duration-300 ease-out
          ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
        `}
        style={{ transitionDelay: contentVisible ? "475ms" : "0ms" }}
      >
        <div className="p-6 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-background shadow-sm">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold">Product Prices (All Currencies)</h3>
              <p className="text-sm text-muted-foreground">Direct product-level prices and price ranges</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            {/* MDL */}
            <div className="p-4 bg-muted/30 rounded-xl border transition-all duration-200 hover:bg-muted/50 hover:shadow-sm hover:-translate-y-0.5 group">
              <div className="text-sm font-medium text-muted-foreground mb-1 group-hover:text-foreground transition-colors">MDL</div>
              <div className="text-lg font-bold tabular-nums">
                {product.price_mdl !== null && product.price_mdl !== undefined
                  ? (product.price_mdl ?? 0).toLocaleString()
                  : <span className="text-muted-foreground text-sm font-normal">N/A</span>}
              </div>
            </div>

            {/* EUR */}
            <div className="p-4 bg-muted/30 rounded-xl border transition-all duration-200 hover:bg-muted/50 hover:shadow-sm hover:-translate-y-0.5 group">
              <div className="text-sm font-medium text-muted-foreground mb-1 group-hover:text-foreground transition-colors">EUR</div>
              <div className="text-lg font-bold tabular-nums">
                {product.price_eur !== null && product.price_eur !== undefined
                  ? (product.price_eur ?? 0).toLocaleString()
                  : <span className="text-muted-foreground text-sm font-normal">N/A</span>}
              </div>
            </div>

            {/* USD */}
            <div className="p-4 bg-muted/30 rounded-xl border transition-all duration-200 hover:bg-muted/50 hover:shadow-sm hover:-translate-y-0.5 group">
              <div className="text-sm font-medium text-muted-foreground mb-1 group-hover:text-foreground transition-colors">USD</div>
              <div className="text-lg font-bold tabular-nums">
                {product.price_usd !== null && product.price_usd !== undefined
                  ? (product.price_usd ?? 0).toLocaleString()
                  : <span className="text-muted-foreground text-sm font-normal">N/A</span>}
              </div>
            </div>

            {/* Min Price */}
            <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 transition-all duration-200 hover:bg-primary/10 hover:shadow-sm hover:-translate-y-0.5 group">
              <div className="text-sm font-medium text-muted-foreground mb-1 group-hover:text-primary transition-colors flex items-center gap-1">
                <ArrowDown className="h-3 w-3" />
                Min Price
              </div>
              <div className="text-lg font-bold tabular-nums">
                {product.price_min !== null && product.price_min !== undefined
                  ? (product.price_min ?? 0).toLocaleString()
                  : <span className="text-muted-foreground text-sm font-normal">N/A</span>}
              </div>
            </div>

            {/* Max Price */}
            <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 transition-all duration-200 hover:bg-primary/10 hover:shadow-sm hover:-translate-y-0.5 group">
              <div className="text-sm font-medium text-muted-foreground mb-1 group-hover:text-primary transition-colors flex items-center gap-1">
                <ArrowUp className="h-3 w-3" />
                Max Price
              </div>
              <div className="text-lg font-bold tabular-nums">
                {product.price_max !== null && product.price_max !== undefined
                  ? (product.price_max ?? 0).toLocaleString()
                  : <span className="text-muted-foreground text-sm font-normal">N/A</span>}
              </div>
            </div>

            {/* Variants Count */}
            <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 transition-all duration-200 hover:bg-primary/10 hover:shadow-sm hover:-translate-y-0.5 group">
              <div className="text-sm font-medium text-muted-foreground mb-1 group-hover:text-primary transition-colors">Variants</div>
              <div className="text-lg font-bold tabular-nums">{variants.length}</div>
            </div>
          </div>

          {/* Raw JSONB prices for debugging */}
          {product.prices && product.prices.length > 0 && (
            <Collapsible open={showRawPrices} onOpenChange={setShowRawPrices} className="mt-4">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 transition-all duration-200 hover:bg-primary/10 hover:text-primary"
                >
                  <Database className="h-4 w-4" />
                  {showRawPrices ? "Hide" : "Show"} Raw Price Data ({product.prices.length} entries)
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 animate-in fade-in-0 slide-in-from-top-2 duration-200">
                <pre className="p-4 bg-muted rounded-xl text-xs overflow-x-auto font-mono leading-relaxed">
                  {JSON.stringify(product.prices, null, 2)}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </div>

      {/* Description */}
      {product.description && (
        <div
          className={`
            rounded-xl border bg-card shadow-sm overflow-hidden
            transition-all duration-300 ease-out
            ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
          `}
          style={{ transitionDelay: contentVisible ? "550ms" : "0ms" }}
        >
          <div className="p-6 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-background shadow-sm">
                <Info className="h-4 w-4 text-muted-foreground" />
              </div>
              <h3 className="font-semibold">Description</h3>
            </div>
          </div>
          <div className="p-6">
            <p className="text-sm whitespace-pre-wrap leading-relaxed text-muted-foreground">{product.description}</p>
          </div>
        </div>
      )}

      {/* Stock Details */}
      <div
        className={`
          rounded-xl border bg-card shadow-sm overflow-hidden
          transition-all duration-300 ease-out
          ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
        `}
        style={{ transitionDelay: contentVisible ? "625ms" : "0ms" }}
      >
        <div className="p-6 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-background shadow-sm">
              <Warehouse className="h-4 w-4 text-muted-foreground" />
            </div>
            <h3 className="font-semibold">Stock Details</h3>
          </div>
        </div>
        <div className="p-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-3 p-3 rounded-xl border bg-muted/30 transition-all duration-200 hover:bg-muted/50 hover:shadow-sm">
              <span className="text-sm text-muted-foreground">Total Stock:</span>
              <Badge
                variant={(product.total_stock ?? 0) > 0 ? "default" : "secondary"}
                className={`
                  tabular-nums transition-colors
                  ${(product.total_stock ?? 0) > 0 ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20" : ""}
                `}
              >
                {product.total_stock ?? 0}
              </Badge>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl border bg-muted/30 transition-all duration-200 hover:bg-muted/50 hover:shadow-sm">
              <span className="text-sm text-muted-foreground">In Stock:</span>
              {product.is_in_stock ? (
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-primary">Yes</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <XCircle className="h-4 w-4 text-destructive" />
                  <span className="text-sm font-medium text-destructive">No</span>
                </div>
              )}
            </div>
            {characteristics.length > 0 && (
              <>
                <div className="flex items-center gap-3 p-3 rounded-xl border bg-muted/30 transition-all duration-200 hover:bg-muted/50 hover:shadow-sm">
                  <span className="text-sm text-muted-foreground">Warehouse:</span>
                  <span className="font-mono font-medium tabular-nums">{totalWarehouseStock}</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl border bg-muted/30 transition-all duration-200 hover:bg-muted/50 hover:shadow-sm">
                  <span className="text-sm text-muted-foreground">Showroom:</span>
                  <span className="font-mono font-medium tabular-nums">{totalShowroomStock}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Images */}
      <div
        className={`
          rounded-xl border bg-card shadow-sm overflow-hidden
          transition-all duration-300 ease-out
          ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
        `}
        style={{ transitionDelay: contentVisible ? "700ms" : "0ms" }}
      >
        <div className="p-6 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-background shadow-sm">
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold">Images ({validImages.length})</h3>
                {effectiveMainImageUrl && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    Main: {effectiveMainImageUrl.substring(0, 40)}...
                    <CopyButton text={effectiveMainImageUrl} />
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="p-6">
          {validImages.length > 0 ? (
            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {validImages.map((image, index) => {
                const imageUrl = image.url || image.path_global || '';
                return (
                  <button
                    key={image.uuid}
                    onClick={() => openGallery(index)}
                    className={`
                      aspect-square relative rounded-xl overflow-hidden border bg-muted
                      transition-all duration-300 ease-out
                      hover:ring-2 hover:ring-primary hover:shadow-lg hover:scale-105 hover:z-10
                      focus:outline-none focus:ring-2 focus:ring-primary
                      ${rowsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
                    `}
                    style={{ transitionDelay: rowsVisible ? `${Math.min(index * 50, 400)}ms` : "0ms" }}
                  >
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={image.description || `Product image ${index + 1}`}
                        fill
                        className="object-cover"
                        unoptimized
                        onError={() => handleImageError(image.uuid)}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                      <ZoomIn className="h-6 w-6 text-white drop-shadow-lg" />
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="p-4 rounded-full bg-muted/50 mb-3">
                <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-foreground">No images available</p>
              <p className="text-sm text-muted-foreground mt-1">Product images will appear here</p>
            </div>
          )}
        </div>
      </div>

      {/* Technical Details - All IDs and Flags */}
      <div
        className={`
          rounded-xl border bg-card shadow-sm overflow-hidden
          transition-all duration-300 ease-out
          ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
        `}
        style={{ transitionDelay: contentVisible ? "775ms" : "0ms" }}
      >
        <div className="p-6 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-background shadow-sm">
              <Settings className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold">Technical Details</h3>
              <p className="text-sm text-muted-foreground">All IDs, flags, and timestamps for debugging</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {/* IDs Section */}
            <div className="space-y-1 p-4 rounded-xl border bg-muted/30 transition-all duration-200 hover:bg-muted/50 hover:shadow-sm">
              <div className="text-sm font-medium mb-3 flex items-center gap-2 text-foreground">
                <Hash className="h-4 w-4 text-muted-foreground" />
                Identifiers
              </div>
              <CopyableField label="ID (UUID)" value={product.id} mono />
              <CopyableField label="Ultra ID" value={product.ultra_id} mono />
              <CopyableField label="Code" value={product.code} />
              <CopyableField label="Article" value={product.article} />
              <CopyableField label="Slug" value={product.slug} />
            </div>

            {/* Relations Section */}
            <div className="space-y-1 p-4 rounded-xl border bg-muted/30 transition-all duration-200 hover:bg-muted/50 hover:shadow-sm">
              <div className="text-sm font-medium mb-3 flex items-center gap-2 text-foreground">
                <Database className="h-4 w-4 text-muted-foreground" />
                Relations
              </div>
              <CopyableField label="Brand ID" value={product.brand_id} mono />
              <CopyableField label="Category ID" value={product.category_id} mono />
              <CopyableField label="Source ID" value={product.source_id} mono />
              <CopyableField label="Parent ID" value={product.parent_id} mono />
              <CopyableField label="Variant Group ID" value={product.variant_group_id} mono />
            </div>

            {/* Flags Section */}
            <div className="space-y-1 p-4 rounded-xl border bg-muted/30 transition-all duration-200 hover:bg-muted/50 hover:shadow-sm">
              <div className="text-sm font-medium mb-3 flex items-center gap-2 text-foreground">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                Flags
              </div>
              {[
                { label: "Is Active", value: product.is_active },
                { label: "Is Group", value: product.is_group },
                { label: "Is Service", value: product.is_service },
                { label: "Is In Stock", value: product.is_in_stock },
              ].map((flag) => (
                <div key={flag.label} className="flex justify-between items-center py-2.5 px-3 rounded-lg hover:bg-background/50 transition-colors">
                  <span className="text-sm text-muted-foreground">{flag.label}</span>
                  <Badge
                    variant={flag.value ? "default" : "secondary"}
                    className={`
                      transition-colors
                      ${flag.value ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20" : ""}
                    `}
                  >
                    {flag.value ? "Yes" : "No"}
                  </Badge>
                </div>
              ))}
            </div>

            {/* Timestamps Section */}
            <div className="space-y-1 p-4 rounded-xl border bg-muted/30 transition-all duration-200 hover:bg-muted/50 hover:shadow-sm">
              <div className="text-sm font-medium mb-3 flex items-center gap-2 text-foreground">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Timestamps
              </div>
              <div className="flex justify-between items-center py-2.5 px-3 rounded-lg hover:bg-background/50 transition-colors">
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Created
                </span>
                <span className="text-xs tabular-nums">{formatTimestamp(product.created_at)}</span>
              </div>
              <div className="flex justify-between items-center py-2.5 px-3 rounded-lg hover:bg-background/50 transition-colors">
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Updated
                </span>
                <span className="text-xs tabular-nums">{formatTimestamp(product.updated_at)}</span>
              </div>
            </div>
          </div>

          {/* Barcodes */}
          {product.barcodes && product.barcodes.length > 0 && (
            <div className="mt-6 pt-6 border-t">
              <div className="text-sm font-medium mb-3 flex items-center gap-2">
                <Barcode className="h-4 w-4 text-muted-foreground" />
                Barcodes ({product.barcodes.length})
              </div>
              <div className="flex flex-wrap gap-2">
                {product.barcodes.map((barcode, index) => (
                  <div
                    key={index}
                    className={`
                      flex items-center gap-2 p-3 bg-muted/50 rounded-xl border
                      transition-all duration-200 hover:bg-muted hover:shadow-sm hover:-translate-y-0.5
                      ${rowsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
                    `}
                    style={{ transitionDelay: rowsVisible ? `${Math.min(index * 30, 200)}ms` : "0ms" }}
                  >
                    <code className="font-mono text-sm">{barcode}</code>
                    <CopyButton text={barcode} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Warranty */}
      {product.warranty && (
        <div
          className={`
            rounded-xl border bg-card shadow-sm overflow-hidden
            transition-all duration-300 ease-out
            ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
          `}
          style={{ transitionDelay: contentVisible ? "850ms" : "0ms" }}
        >
          <div className="p-6 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-background shadow-sm">
                <Shield className="h-4 w-4 text-muted-foreground" />
              </div>
              <h3 className="font-semibold">Warranty</h3>
            </div>
          </div>
          <div className="p-6">
            <p className="text-sm">{product.warranty}</p>
          </div>
        </div>
      )}

      {/* Characteristics Section */}
      {characteristics.length > 0 && (
        <div
          className={`
            rounded-xl border bg-card shadow-sm overflow-hidden
            transition-all duration-300 ease-out
            ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
          `}
          style={{ transitionDelay: contentVisible ? "925ms" : "0ms" }}
        >
          <div className="p-6 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-background shadow-sm">
                <Boxes className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold">Characteristics / SKUs ({characteristics.length})</h3>
                <p className="text-sm text-muted-foreground">Individual SKUs with their own prices and stock levels</p>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="font-semibold">Name</TableHead>
                  <TableHead className="font-semibold">Code</TableHead>
                  <TableHead className="font-semibold">Ultra ID</TableHead>
                  <TableHead className="text-right font-semibold">Warehouse</TableHead>
                  <TableHead className="text-right font-semibold">Showroom</TableHead>
                  <TableHead className="text-right font-semibold">Total</TableHead>
                  <TableHead className="font-semibold">Prices</TableHead>
                  <TableHead className="text-center font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {characteristics.map((char, index) => (
                  <TableRow
                    key={char.id}
                    className={`
                      transition-all duration-200 hover:bg-muted/50
                      ${rowsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
                    `}
                    style={{ transitionDelay: rowsVisible ? `${Math.min(index * 30, 300)}ms` : "0ms" }}
                  >
                    <TableCell className="font-medium">{char.name}</TableCell>
                    <TableCell>
                      {char.code ? (
                        <div className="flex items-center gap-1">
                          <code className="text-xs bg-muted px-2 py-0.5 rounded">{char.code}</code>
                          <CopyButton text={char.code} />
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
                          {char.ultra_id.substring(0, 8)}...
                        </code>
                        <CopyButton text={char.ultra_id} />
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{char.stock_warehouse ?? 0}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{char.stock_showroom ?? 0}</TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={(char.stock_total ?? 0) > 0 ? "default" : "secondary"}
                        className={`
                          tabular-nums transition-colors
                          ${(char.stock_total ?? 0) > 0 ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20" : ""}
                        `}
                      >
                        {char.stock_total ?? 0}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {char.prices?.map((price, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs tabular-nums transition-colors hover:bg-muted">
                            {price.currency}: {(price.price ?? 0).toLocaleString()}
                          </Badge>
                        ))}
                        {(!char.prices || char.prices.length === 0) && (
                          <span className="text-muted-foreground text-xs">No prices</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {char.is_active ? (
                        <CheckCircle2 className="h-4 w-4 text-primary mx-auto" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {new Date(char.updated_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Properties Section */}
      <div
        className={`
          rounded-xl border bg-card shadow-sm overflow-hidden
          transition-all duration-300 ease-out
          ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
        `}
        style={{ transitionDelay: contentVisible ? "1000ms" : "0ms" }}
      >
        <div className="p-6 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-background shadow-sm">
              <Package className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold">Properties ({properties.length})</h3>
              <p className="text-sm text-muted-foreground">Product specifications grouped by category</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          {Object.keys(groupedProperties).length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <div className="p-4 rounded-full bg-muted/50">
                <Package className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <p className="font-medium text-foreground">No properties found</p>
              <p className="text-sm text-muted-foreground">
                No properties have been set for this product
              </p>
            </div>
          ) : (
            <Tabs defaultValue={Object.keys(groupedProperties)[0]} className="w-full">
              <TabsList className="flex-wrap h-auto gap-1 max-h-[200px] overflow-y-auto bg-muted/50 p-1.5 rounded-xl">
                {Object.keys(groupedProperties).map((group) => (
                  <TabsTrigger
                    key={group}
                    value={group}
                    className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-200 rounded-lg"
                  >
                    {localizeGroupName(groupedProperties[group][0])} ({groupedProperties[group].length})
                  </TabsTrigger>
                ))}
              </TabsList>

              {Object.entries(groupedProperties).map(([group, props]) => (
                <TabsContent key={group} value={group} className="mt-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
                  <div className="rounded-xl border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableHead className="w-1/4 font-semibold">Property</TableHead>
                          <TableHead className="font-semibold">Value</TableHead>
                          <TableHead className="w-[80px] font-semibold">Type</TableHead>
                          <TableHead className="w-[100px] font-semibold">Flags</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {props.map((prop, index) => (
                          <TableRow
                            key={prop.id}
                            className={`
                              transition-all duration-200 hover:bg-muted/50
                              ${rowsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
                            `}
                            style={{ transitionDelay: rowsVisible ? `${Math.min(index * 20, 200)}ms` : "0ms" }}
                          >
                            <TableCell className="font-medium">
                              {localizePropertyName(prop)}
                            </TableCell>
                            <TableCell>{localize(prop, "value") || <span className="text-muted-foreground">-</span>}</TableCell>
                            <TableCell>
                              {prop.value_type && (
                                <Badge variant="outline" className="text-xs transition-colors hover:bg-muted">
                                  {prop.value_type}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {prop.is_filter && (
                                  <Badge variant="secondary" className="text-xs transition-colors hover:bg-muted">
                                    <Filter className="h-3 w-3 mr-1" />
                                    Filter
                                  </Badge>
                                )}
                                {prop.is_modification && (
                                  <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 transition-colors">
                                    <Hash className="h-3 w-3 mr-1" />
                                    Mod
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </div>
      </div>

      {/* Image Gallery Modal */}
      {validImages.length > 0 && (
        <ImageGalleryModal
          images={validImages}
          isOpen={galleryOpen}
          onClose={() => setGalleryOpen(false)}
          initialIndex={galleryIndex}
        />
      )}
    </div>
  );
}
