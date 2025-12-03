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
  Pencil,
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
import { Property, ProductDetail, ImageEntry, Product } from "@/types";
import { useCurrency, getPriceByCurrency } from "@/contexts/currency-context";
import { useLocalizedValue, useTranslation } from "@/contexts/language-context";
import { VariantMatrix } from "@/components/products/variant-matrix";

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
  t,
}: {
  images: ImageEntry[];
  isOpen: boolean;
  onClose: () => void;
  initialIndex?: number;
  t: any;
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
              {t("detail.imageOf", { current: currentIndex + 1, total: images.length })}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsZoomed(!isZoomed)}
              className="gap-2 transition-all duration-200 hover:bg-primary/10 hover:text-primary"
            >
              <ZoomIn className="h-4 w-4" />
              {isZoomed ? t("detail.imageReset") : t("detail.imageZoom")}
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
                {t("detail.imagePrevious")}
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
                {t("detail.imageNext")}
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
function CopyButton({ text, label, t }: { text: string; label?: string; t: any }) {
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
          {copied ? t("detail.codeCopied") : label}
        </span>
      )}
    </Button>
  );
}

/**
 * Premium copyable field with fixed label width for alignment
 */
function CopyableField({ label, value, mono = false, t }: { label: string; value: string | null | undefined; mono?: boolean; t: any }) {
  if (!value) return null;

  return (
    <div className="flex items-center justify-between py-1.5 group">
      <span className="text-xs text-muted-foreground w-20 shrink-0">{label}</span>
      <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
        <span
          className={`
            text-xs truncate transition-colors duration-200 group-hover:text-foreground
            ${mono ? "font-mono" : ""}
          `}
          title={value}
        >
          {value}
        </span>
        <CopyButton text={value} t={t} />
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
 * Premium skeleton loader with staggered animations - Ultra compact spacing (p-3, p-4)
 */
function ProductDetailSkeleton() {
  return (
    <div className="space-y-3">
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
        <div className="flex-1 space-y-2">
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

      {/* Stats cards skeleton with staggered animation - Ultra compact p-4 */}
      <div className="grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border bg-card shadow-sm p-4 animate-pulse"
            style={{
              animationDelay: `${400 + i * 75}ms`,
              opacity: 1 - (i * 0.1),
            }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3.5 w-3.5" />
            </div>
            <Skeleton className="h-6 w-16 mb-1" />
            <Skeleton className="h-2.5 w-32" />
          </div>
        ))}
      </div>

      {/* Price card skeleton */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden" style={{ animationDelay: "700ms" }}>
        <div className="p-3 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-lg" />
            <Skeleton className="h-4 w-52" />
          </div>
        </div>
        <div className="p-4">
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-16 rounded-xl"
                style={{
                  animationDelay: `${750 + i * 50}ms`,
                  opacity: 1 - (i * 0.05),
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Content cards skeleton - Ultra compact p-3 */}
      <div className="grid gap-3 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border bg-card shadow-sm overflow-hidden animate-pulse"
            style={{
              animationDelay: `${1050 + i * 100}ms`,
              opacity: 1 - (i * 0.1),
            }}
          >
            <div className="p-3 border-b bg-muted/30">
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-6 rounded-lg" />
                <Skeleton className="h-4 w-40" />
              </div>
            </div>
            <div className="p-3 space-y-2">
              {Array.from({ length: 3 }).map((_, j) => (
                <Skeleton
                  key={j}
                  className="h-9 w-full rounded-lg"
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
  const [variants, setVariants] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [showRawPrices, setShowRawPrices] = useState(false);
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [contentVisible, setContentVisible] = useState(false);
  const [technicalDetailsOpen, setTechnicalDetailsOpen] = useState(false);
  const [propertiesOpen, setPropertiesOpen] = useState(true);
  const [rowsVisible, setRowsVisible] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [mainImageFailed, setMainImageFailed] = useState(false);
  const { currency, formatPrice } = useCurrency();
  const { localize, localizePropertyName, localizeGroupName } = useLocalizedValue();
  const { t } = useTranslation("products");
  const { t: tCommon } = useTranslation("common");

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

  const currentPrice = useMemo(
    () => product ? getPriceByCurrency(product, currency) : null,
    [product, currency]
  );

  const jsonString = useMemo(() => {
    try {
      return JSON.stringify({
        product,
        properties,
        variants,
      }, null, 2);
    } catch {
      return 'Error: Unable to stringify data';
    }
  }, [product, properties, variants]);

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
        const [productData, propertiesData] = await Promise.all([
          api.getProduct(id),
          api.getProductProperties(id),
        ]);

        if (cancelled) return;

        if (!productData) {
          notFound();
          return;
        }

        // Set product data immediately
        setProduct(productData);
        setProperties(propertiesData);

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
      <div className="space-y-4">
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
                <Link href="/products" className="transition-colors hover:text-primary">{t("page.title")}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{t("detail.productNotFound")}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="rounded-xl border border-dashed bg-card shadow-sm">
          <div className="flex flex-col items-center justify-center py-16">
            <div className="p-4 rounded-full bg-muted/50 mb-4">
              <Package className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <h2 className="text-xl font-semibold mb-2">{t("detail.productNotFound")}</h2>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              {error || t("detail.productNotFoundDesc")}
            </p>
            <Button asChild className="transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
              <Link href="/products">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t("detail.backToProducts")}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Breadcrumb Navigation - Compact */}
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
              <Link href="/products" className="transition-colors hover:text-primary">{t("page.title")}</Link>
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

      {/* Header - Compact style */}
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
              {product.is_active ? t("detail.activeProduct") : t("detail.inactiveProduct")}
            </Badge>
            {product.is_group && (
              <Badge variant="outline" className="transition-colors hover:bg-muted">{t("detail.groupProduct")}</Badge>
            )}
            {product.is_service && (
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
                {t("detail.serviceProduct")}
              </Badge>
            )}
            {!product.is_in_stock && (product.total_stock ?? 0) === 0 && (
              <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20">
                {t("detail.outOfStockProduct")}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 mt-2 text-muted-foreground flex-wrap text-sm">
            <span className="flex items-center gap-1.5 transition-colors hover:text-foreground">
              <Tag className="h-3.5 w-3.5" />
              {t("detail.productCode")}: {product.code}
            </span>
            {product.article && (
              <span className="transition-colors hover:text-foreground">{t("detail.productArticle")}: {product.article}</span>
            )}
            {product.slug && (
              <span className="flex items-center gap-1.5 transition-colors hover:text-foreground">
                <Code className="h-3.5 w-3.5" />
                {t("detail.productSlug")}: {product.slug}
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
            <Link href={`/products/${product.id}/edit`}>
              <Pencil className="h-4 w-4" />
              {t("actions.edit")}
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            asChild
            className="flex items-center gap-2 transition-all duration-200 hover:bg-primary/10 hover:text-primary hover:border-primary/30 hover:shadow-sm hover:-translate-y-0.5"
          >
            <Link href={`/products/new?duplicate=${product.id}`}>
              <GitBranch className="h-4 w-4" />
              {t("detail.addVariantButton")}
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowJsonModal(true)}
            className="flex items-center gap-2 transition-all duration-200 hover:bg-primary/10 hover:text-primary hover:border-primary/30 hover:shadow-sm hover:-translate-y-0.5"
          >
            <Braces className="h-4 w-4" />
            {t("detail.jsonView")}
          </Button>
        </div>
      </div>

      {/* JSON View Modal - Enhanced Premium Version with WIDE layout */}
      <Dialog open={showJsonModal} onOpenChange={setShowJsonModal}>
        <DialogContent className="sm:max-w-[1400px] w-[95vw] max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-muted">
                  <Braces className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <div className="text-base font-semibold">{t("detail.rawJsonData")}</div>
                  <div className="text-xs text-muted-foreground font-normal">
                    Complete product data structure
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(jsonString);
                  } catch (err) {
                    console.error("Failed to copy JSON:", err);
                  }
                }}
                className="gap-2 transition-all duration-200 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
              >
                <Copy className="h-3.5 w-3.5" />
                {t("detail.copyAllJson")}
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto min-h-0 p-4 bg-muted/30">
            <div className="rounded-lg border bg-background shadow-sm overflow-hidden">
              <pre className="p-6 text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre">
                {jsonString}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Stats Row - Premium Cards with 4-tier color hierarchy, compact p-4 */}
      <div className="grid gap-3 md:grid-cols-4">
        {[
          {
            title: t("detail.stockStatus"),
            value: product.total_stock ?? 0,
            badge: (product.total_stock ?? 0) > 0 ? t("detail.inStockProduct") : t("detail.outOfStockProduct"),
            badgeVariant: (product.total_stock ?? 0) > 0 ? "success" : "warning",
            icon: Warehouse,
          },
          {
            title: `${t("detail.priceCurrency")} (${currency})`,
            value: currentPrice !== null ? formatPrice(currentPrice) : t("detail.priceNA"),
            badge: "MDL, EUR, USD",
            badgeVariant: "muted",
            icon: DollarSign,
          },
          {
            title: t("detail.brandInfo"),
            value: product.brand ? localize(product.brand, "name") : (product.brand_name || t("basicInfo.noBrand")),
            badge: product.brand?.slug,
            badgeVariant: "muted",
            icon: Building2,
            link: product.brand_id ? `/brands/${product.brand_id}` : undefined,
          },
          {
            title: t("detail.categoryInfo"),
            value: product.category ? localize(product.category, "name") : (product.category_name || t("basicInfo.noCategory")),
            badge: product.category?.product_count !== undefined
              ? `${(product.category.product_count ?? 0).toLocaleString()} ${t("detail.productsInCategory")}`
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
              transition-all duration-200 ease-out
              ${stat.link ? "cursor-pointer hover:shadow-lg hover:-translate-y-1 hover:border-primary/30" : "hover:shadow-md hover:-translate-y-0.5"}
              ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
            `}
            style={{ transitionDelay: contentVisible ? `${100 + index * 75}ms` : "0ms" }}
          >
            {stat.link ? (
              <Link href={stat.link} className="block p-4 group">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">{stat.title}</span>
                  <div className="p-1 rounded-lg bg-muted group-hover:bg-primary/10 transition-colors">
                    <stat.icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </div>
                <div className="text-lg font-bold mb-0.5 line-clamp-1 group-hover:text-primary transition-colors">{stat.value}</div>
                {stat.badge && (
                  <p className="text-[10px] text-muted-foreground line-clamp-1">{stat.badge}</p>
                )}
              </Link>
            ) : (
              <div className="p-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-muted-foreground">{stat.title}</span>
                  <div className={`
                    p-1 rounded-lg transition-colors
                    ${stat.badgeVariant === "success" ? "bg-primary/10" : ""}
                    ${stat.badgeVariant === "warning" ? "bg-destructive/10" : ""}
                    ${stat.badgeVariant === "muted" ? "bg-muted" : ""}
                  `}>
                    <stat.icon className={`
                      h-3.5 w-3.5 transition-colors
                      ${stat.badgeVariant === "success" ? "text-primary" : ""}
                      ${stat.badgeVariant === "warning" ? "text-destructive" : ""}
                      ${stat.badgeVariant === "muted" ? "text-muted-foreground" : ""}
                    `} />
                  </div>
                </div>
                <div className="text-lg font-bold mb-0.5 tabular-nums">{stat.value}</div>
                {stat.badge && (
                  <Badge
                    variant={stat.badgeVariant === "success" ? "default" : "secondary"}
                    className={`
                      text-[10px] h-4 px-1.5 transition-colors
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

      {/* Variant Matrix - Color, Storage, RAM */}
      {variants.length >= 1 && (
        <div
          className={`
            transition-all duration-300 ease-out
            ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
          `}
          style={{ transitionDelay: contentVisible ? "400ms" : "0ms" }}
        >
          <VariantMatrix
            variants={[product, ...variants]}
            currentProductId={product.id}
          />
        </div>
      )}

      {/* All Currency Prices - Product Level - Compact p-4 */}
      <div
        className={`
          rounded-xl border bg-card shadow-sm overflow-hidden
          transition-all duration-300 ease-out
          ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
        `}
        style={{ transitionDelay: contentVisible ? "475ms" : "0ms" }}
      >
        <div className="p-3 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-lg bg-background shadow-sm">
              <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-xs">{t("detail.allCurrencyPrices")}</h3>
          </div>
        </div>
        <div className="p-4">
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            {/* MDL */}
            <div className="p-3 bg-muted/30 rounded-xl border transition-all duration-200 hover:bg-muted/50 hover:shadow-sm hover:-translate-y-0.5 group">
              <div className="text-xs font-medium text-muted-foreground mb-0.5 group-hover:text-foreground transition-colors">{t("detail.currencyMDL")}</div>
              <div className="text-base font-bold tabular-nums">
                {product.price_mdl !== null && product.price_mdl !== undefined
                  ? (product.price_mdl ?? 0).toLocaleString()
                  : <span className="text-muted-foreground text-xs font-normal">{t("detail.priceNA")}</span>}
              </div>
            </div>

            {/* EUR */}
            <div className="p-3 bg-muted/30 rounded-xl border transition-all duration-200 hover:bg-muted/50 hover:shadow-sm hover:-translate-y-0.5 group">
              <div className="text-xs font-medium text-muted-foreground mb-0.5 group-hover:text-foreground transition-colors">{t("detail.currencyEUR")}</div>
              <div className="text-base font-bold tabular-nums">
                {product.price_eur !== null && product.price_eur !== undefined
                  ? (product.price_eur ?? 0).toLocaleString()
                  : <span className="text-muted-foreground text-xs font-normal">{t("detail.priceNA")}</span>}
              </div>
            </div>

            {/* USD */}
            <div className="p-3 bg-muted/30 rounded-xl border transition-all duration-200 hover:bg-muted/50 hover:shadow-sm hover:-translate-y-0.5 group">
              <div className="text-xs font-medium text-muted-foreground mb-0.5 group-hover:text-foreground transition-colors">{t("detail.currencyUSD")}</div>
              <div className="text-base font-bold tabular-nums">
                {product.price_usd !== null && product.price_usd !== undefined
                  ? (product.price_usd ?? 0).toLocaleString()
                  : <span className="text-muted-foreground text-xs font-normal">{t("detail.priceNA")}</span>}
              </div>
            </div>

            {/* Min Price */}
            <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 transition-all duration-200 hover:bg-primary/10 hover:shadow-sm hover:-translate-y-0.5 group">
              <div className="text-xs font-medium text-muted-foreground mb-0.5 group-hover:text-primary transition-colors flex items-center gap-1">
                <ArrowDown className="h-3 w-3" />
                {t("detail.minPrice")}
              </div>
              <div className="text-base font-bold tabular-nums">
                {product.price_min !== null && product.price_min !== undefined
                  ? (product.price_min ?? 0).toLocaleString()
                  : <span className="text-muted-foreground text-xs font-normal">{t("detail.priceNA")}</span>}
              </div>
            </div>

            {/* Max Price */}
            <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 transition-all duration-200 hover:bg-primary/10 hover:shadow-sm hover:-translate-y-0.5 group">
              <div className="text-xs font-medium text-muted-foreground mb-0.5 group-hover:text-primary transition-colors flex items-center gap-1">
                <ArrowUp className="h-3 w-3" />
                {t("detail.maxPrice")}
              </div>
              <div className="text-base font-bold tabular-nums">
                {product.price_max !== null && product.price_max !== undefined
                  ? (product.price_max ?? 0).toLocaleString()
                  : <span className="text-muted-foreground text-xs font-normal">{t("detail.priceNA")}</span>}
              </div>
            </div>

            {/* Variants Count */}
            <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 transition-all duration-200 hover:bg-primary/10 hover:shadow-sm hover:-translate-y-0.5 group">
              <div className="text-xs font-medium text-muted-foreground mb-0.5 group-hover:text-primary transition-colors">{t("detail.variantsCount")}</div>
              <div className="text-base font-bold tabular-nums">{variants.length}</div>
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
                  {showRawPrices ? t("detail.hideRawPriceData") : t("detail.showRawPriceData")} ({product.prices.length} {t("detail.rawPriceDataEntries")})
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

      {/* Description & Stock Combined - Compact 2-column layout */}
      <div className="grid gap-3 lg:grid-cols-2">
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
            <div className="p-3 border-b bg-muted/30">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-lg bg-background shadow-sm">
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-xs">{t("detail.productDescription")}</h3>
              </div>
            </div>
            <div className="p-4">
              <p className="text-sm whitespace-pre-wrap leading-relaxed text-muted-foreground line-clamp-4">{product.description}</p>
            </div>
          </div>
        )}

        {/* Stock & Warranty - Combined inline */}
        <div
          className={`
            rounded-xl border bg-card shadow-sm overflow-hidden
            transition-all duration-300 ease-out
            ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
          `}
          style={{ transitionDelay: contentVisible ? "550ms" : "0ms" }}
        >
          <div className="p-3 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-lg bg-background shadow-sm">
                <Warehouse className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-xs">{t("detail.stockDetails")}</h3>
            </div>
          </div>
          <div className="p-4">
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/30 transition-all duration-200 hover:bg-muted/50">
                <span className="text-xs text-muted-foreground">{t("detail.totalStock")}:</span>
                <Badge
                  variant={(product.total_stock ?? 0) > 0 ? "default" : "secondary"}
                  className={`
                    tabular-nums transition-colors text-xs h-5 px-2
                    ${(product.total_stock ?? 0) > 0 ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20" : ""}
                  `}
                >
                  {product.total_stock ?? 0}
                </Badge>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/30 transition-all duration-200 hover:bg-muted/50">
                <span className="text-xs text-muted-foreground">{t("detail.inStock")}:</span>
                {product.is_in_stock ? (
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-medium text-primary">{t("detail.yes")}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <XCircle className="h-3.5 w-3.5 text-destructive" />
                    <span className="text-xs font-medium text-destructive">{t("detail.no")}</span>
                  </div>
                )}
              </div>
              {product.warranty && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/30 transition-all duration-200 hover:bg-muted/50">
                  <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{t("detail.warranty")}:</span>
                  <span className="text-xs font-medium">{product.warranty}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Images - Compact horizontal scroll */}
      <div
        className={`
          rounded-xl border bg-card shadow-sm overflow-hidden
          transition-all duration-300 ease-out
          ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
        `}
        style={{ transitionDelay: contentVisible ? "625ms" : "0ms" }}
      >
        <div className="p-3 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-lg bg-background shadow-sm">
                <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-xs">{t("detail.productImages")} ({validImages.length})</h3>
            </div>
          </div>
        </div>
        <div className="p-3">
          {validImages.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
              {validImages.map((image, index) => {
                const imageUrl = image.url || image.path_global || '';
                return (
                  <button
                    key={image.uuid || `image-${index}`}
                    onClick={() => openGallery(index)}
                    className={`
                      flex-shrink-0 w-20 h-20 relative rounded-lg overflow-hidden border bg-muted
                      transition-all duration-200 ease-out
                      hover:ring-2 hover:ring-primary hover:shadow-lg hover:scale-105 hover:z-10
                      focus:outline-none focus:ring-2 focus:ring-primary
                      ${rowsVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"}
                    `}
                    style={{ transitionDelay: rowsVisible ? `${Math.min(index * 30, 300)}ms` : "0ms" }}
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
                        <ImageIcon className="h-5 w-5 text-muted-foreground/50" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                      <ZoomIn className="h-4 w-4 text-white drop-shadow-lg" />
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="p-3 rounded-full bg-muted/50 mb-2">
                <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <p className="text-xs font-medium text-foreground">{t("detail.noImagesAvailable")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t("detail.noImagesDesc")}</p>
            </div>
          )}
        </div>
      </div>

      {/* Technical Details - Collapsible - Compact p-3 */}
      <Collapsible
        open={technicalDetailsOpen}
        onOpenChange={setTechnicalDetailsOpen}
        className={`
          rounded-xl border bg-card shadow-sm overflow-hidden
          transition-all duration-300 ease-out
          ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
        `}
        style={{ transitionDelay: contentVisible ? "700ms" : "0ms" }}
      >
        <CollapsibleTrigger asChild>
          <button className="w-full p-3 border-b bg-muted/30 hover:bg-muted/50 transition-colors text-left group">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-lg bg-background shadow-sm group-hover:bg-primary/10 transition-colors">
                  <Settings className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div>
                  <h3 className="font-semibold text-xs">{t("detail.technicalDetails")}</h3>
                  <p className="text-[10px] text-muted-foreground">{t("detail.technicalDetailsDesc")}</p>
                </div>
              </div>
              <div className={`transition-transform duration-200 ${technicalDetailsOpen ? "rotate-180" : ""}`}>
                <ArrowDown className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="animate-in fade-in-0 slide-in-from-top-2 duration-200">
          <div className="p-3">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {/* IDs Section */}
            <div className="p-3 rounded-xl border bg-muted/30 transition-all duration-200 hover:bg-muted/50 hover:shadow-sm flex flex-col">
              <div className="text-xs font-medium mb-3 flex items-center gap-1.5 text-foreground">
                <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                {t("detail.identifiers")}
              </div>
              <div className="space-y-0.5 flex-1">
                <CopyableField label={t("detail.idUUID")} value={product.id} mono t={t} />
                <CopyableField label={t("detail.ultraId")} value={product.ultra_id} mono t={t} />
                <CopyableField label={t("detail.productCode")} value={product.code} t={t} />
                <CopyableField label={t("detail.productArticle")} value={product.article} t={t} />
                <CopyableField label={t("detail.productSlug")} value={product.slug} t={t} />
              </div>
            </div>

            {/* Relations Section */}
            <div className="p-3 rounded-xl border bg-muted/30 transition-all duration-200 hover:bg-muted/50 hover:shadow-sm flex flex-col">
              <div className="text-xs font-medium mb-3 flex items-center gap-1.5 text-foreground">
                <Database className="h-3.5 w-3.5 text-muted-foreground" />
                {t("detail.relations")}
              </div>
              <div className="space-y-0.5 flex-1">
                <CopyableField label={t("detail.brandId")} value={product.brand_id} mono t={t} />
                <CopyableField label={t("detail.categoryId")} value={product.category_id} mono t={t} />
                <CopyableField label={t("detail.sourceId")} value={product.source_id} mono t={t} />
                <CopyableField label={t("detail.parentId")} value={product.parent_id} mono t={t} />
              </div>
            </div>

            {/* Flags Section */}
            <div className="p-3 rounded-xl border bg-muted/30 transition-all duration-200 hover:bg-muted/50 hover:shadow-sm flex flex-col">
              <div className="text-xs font-medium mb-3 flex items-center gap-1.5 text-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                {t("detail.flags")}
              </div>
              <div className="space-y-0.5 flex-1">
                {[
                  { label: t("detail.isActive"), value: product.is_active },
                  { label: t("detail.isGroup"), value: product.is_group },
                  { label: t("detail.isService"), value: product.is_service },
                  { label: t("detail.isInStock"), value: product.is_in_stock },
                ].map((flag) => (
                  <div key={flag.label} className="flex items-center justify-between py-1.5">
                    <span className="text-xs text-muted-foreground w-20 shrink-0">{flag.label}</span>
                    <Badge
                      variant={flag.value ? "default" : "secondary"}
                      className={`
                        transition-colors text-[10px] h-4 px-1.5
                        ${flag.value ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20" : ""}
                      `}
                    >
                      {flag.value ? t("detail.yes") : t("detail.no")}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Timestamps Section */}
            <div className="p-3 rounded-xl border bg-muted/30 transition-all duration-200 hover:bg-muted/50 hover:shadow-sm flex flex-col">
              <div className="text-xs font-medium mb-3 flex items-center gap-1.5 text-foreground">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                {t("detail.timestamps")}
              </div>
              <div className="space-y-2 flex-1">
                <div className="flex items-start justify-between py-1.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3 shrink-0" />
                    <span>{t("detail.createdAt")}</span>
                  </div>
                  <span className="text-[10px] tabular-nums text-right leading-tight">{formatTimestamp(product.created_at)}</span>
                </div>
                <div className="flex items-start justify-between py-1.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3 shrink-0" />
                    <span>{t("detail.updatedAt")}</span>
                  </div>
                  <span className="text-[10px] tabular-nums text-right leading-tight">{formatTimestamp(product.updated_at)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Barcodes */}
          {product.barcodes && product.barcodes.length > 0 && (
            <div className="mt-3 pt-3 border-t">
              <div className="text-xs font-medium mb-2 flex items-center gap-1.5">
                <Barcode className="h-3.5 w-3.5 text-muted-foreground" />
                {t("detail.barcodes")} ({product.barcodes.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {product.barcodes.map((barcode, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-1.5 px-2 py-1.5 bg-muted/50 rounded-lg border text-xs transition-all duration-200 hover:bg-muted hover:shadow-sm"
                  >
                    <code className="font-mono text-[10px]">{barcode}</code>
                    <CopyButton text={barcode} t={t} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Properties Section - Collapsible - Compact p-3 */}
      <Collapsible
        open={propertiesOpen}
        onOpenChange={setPropertiesOpen}
        className={`
          rounded-xl border bg-card shadow-sm overflow-hidden
          transition-all duration-300 ease-out
          ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
        `}
        style={{ transitionDelay: contentVisible ? "775ms" : "0ms" }}
      >
        <CollapsibleTrigger asChild>
          <button className="w-full p-3 border-b bg-muted/30 hover:bg-muted/50 transition-colors text-left group">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-lg bg-background shadow-sm group-hover:bg-primary/10 transition-colors">
                  <Package className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div>
                  <h3 className="font-semibold text-xs">{t("detail.productProperties")} ({properties.length})</h3>
                  <p className="text-[10px] text-muted-foreground">{t("detail.productPropertiesDesc")}</p>
                </div>
              </div>
              <div className={`transition-transform duration-200 ${propertiesOpen ? "rotate-180" : ""}`}>
                <ArrowDown className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="animate-in fade-in-0 slide-in-from-top-2 duration-200">
          <div className="p-3">
          {Object.keys(groupedProperties).length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8">
              <div className="p-3 rounded-full bg-muted/50">
                <Package className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <p className="text-xs font-medium text-foreground">{t("detail.noPropertiesFound")}</p>
              <p className="text-xs text-muted-foreground">{t("detail.noPropertiesDesc")}</p>
            </div>
          ) : (
            <Tabs defaultValue={Object.keys(groupedProperties)[0]} className="w-full">
              <TabsList className="flex-wrap h-auto gap-1 max-h-[150px] overflow-y-auto bg-muted/50 p-1 rounded-lg">
                {Object.keys(groupedProperties).map((group) => (
                  <TabsTrigger
                    key={group}
                    value={group}
                    className="text-[10px] h-6 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all duration-200 rounded-md"
                  >
                    {localizeGroupName(groupedProperties[group][0])} ({groupedProperties[group].length})
                  </TabsTrigger>
                ))}
              </TabsList>

              {Object.entries(groupedProperties).map(([group, props]) => (
                <TabsContent key={group} value={group} className="mt-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableHead className="w-1/4 font-semibold text-[10px] h-8">{t("detail.propertyName")}</TableHead>
                          <TableHead className="font-semibold text-[10px] h-8">{t("detail.propertyValue")}</TableHead>
                          <TableHead className="w-[70px] font-semibold text-[10px] h-8">{t("detail.propertyType")}</TableHead>
                          <TableHead className="w-[90px] font-semibold text-[10px] h-8">{t("detail.propertyFlags")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {props.map((prop, index) => (
                          <TableRow
                            key={prop.id}
                            className="transition-all duration-200 hover:bg-muted/50 h-9"
                          >
                            <TableCell className="font-medium text-xs py-2">
                              {localizePropertyName(prop)}
                            </TableCell>
                            <TableCell className="text-xs py-2">{localize(prop, "value") || <span className="text-muted-foreground">-</span>}</TableCell>
                            <TableCell className="py-2">
                              {prop.value_type && (
                                <Badge variant="outline" className="text-[10px] h-4 px-1.5 transition-colors hover:bg-muted">
                                  {prop.value_type}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="py-2">
                              <div className="flex gap-1">
                                {prop.is_filter && (
                                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5 transition-colors hover:bg-muted">
                                    <Filter className="h-2.5 w-2.5 mr-0.5" />
                                    {t("detail.propertyFilter")}
                                  </Badge>
                                )}
                                {prop.is_modification && (
                                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 transition-colors">
                                    <Hash className="h-2.5 w-2.5 mr-0.5" />
                                    {t("detail.propertyMod")}
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
        </CollapsibleContent>
      </Collapsible>

      {/* Image Gallery Modal */}
      {validImages.length > 0 && (
        <ImageGalleryModal
          images={validImages}
          isOpen={galleryOpen}
          onClose={() => setGalleryOpen(false)}
          initialIndex={galleryIndex}
          t={t}
        />
      )}
    </div>
  );
}
