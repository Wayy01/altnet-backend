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
  AlertCircle,
  Braces,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { api } from "@/lib/api";
import { Property, Characteristic, ProductDetail, ImageEntry, Product } from "@/types";
import { useCurrency, getPriceByCurrency } from "@/contexts/currency-context";
import { VariantSelector } from "@/components/variant-selector";

interface ProductDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

// Image gallery modal component
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

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  const handlePrev = () => {
    if (images.length === 0) return;
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNext = () => {
    if (images.length === 0) return;
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const currentImage = images[currentIndex];
  const imageUrl = currentImage?.url || currentImage?.path_global || '';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            Image {currentIndex + 1} of {images.length}
          </DialogTitle>
        </DialogHeader>
        <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={currentImage?.description || `Product image ${currentIndex + 1}`}
              fill
              className="object-contain"
              unoptimized
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <ImageIcon className="h-16 w-16 text-muted-foreground" />
            </div>
          )}
        </div>
        {images.length > 1 && (
          <div className="flex items-center justify-between mt-4">
            <Button variant="outline" onClick={handlePrev}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>
            <div className="flex gap-2">
              {images.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`w-2 h-2 rounded-full ${
                    index === currentIndex ? "bg-primary" : "bg-muted-foreground/30"
                  }`}
                />
              ))}
            </div>
            <Button variant="outline" onClick={handleNext}>
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}
        {currentImage?.description && (
          <p className="text-sm text-muted-foreground text-center mt-2">
            {currentImage.description}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
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
  const { currency, formatPrice } = useCurrency();

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

  const openGallery = useCallback((index: number) => {
    setGalleryIndex(index);
    setGalleryOpen(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const { id } = await params;
        if (cancelled) return;

        const [productData, propertiesData, characteristicsData, variantsData] = await Promise.all([
          api.getProduct(id),
          api.getProductProperties(id),
          api.getProductCharacteristics(id),
          api.getProductVariants(id),
        ]);

        if (cancelled) return;

        if (!productData) {
          notFound();
          return;
        }

        setProduct(productData);
        setProperties(propertiesData);
        setCharacteristics(characteristicsData);
        setVariants(variantsData);
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
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading product details...</div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground">
          {error || "Product not found"}
        </p>
        <Button variant="outline" asChild className="mt-4">
          <Link href="/products">Back to Products</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/products">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
            <Badge variant={product.is_active ? "default" : "secondary"}>
              {product.is_active ? "Active" : "Inactive"}
            </Badge>
            {product.is_group && (
              <Badge variant="outline">Group</Badge>
            )}
            {product.is_service && (
              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                Service
              </Badge>
            )}
            {!product.is_in_stock && product.total_stock === 0 && (
              <Badge variant="destructive">Out of Stock</Badge>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1 text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1">
              <Tag className="h-3 w-3" />
              Code: {product.code}
            </span>
            {product.article && (
              <span>Article: {product.article}</span>
            )}
            {product.slug && (
              <span className="flex items-center gap-1">
                <Code className="h-3 w-3" />
                Slug: {product.slug}
              </span>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowJsonModal(true)}
          className="flex items-center gap-2"
        >
          <Braces className="h-4 w-4" />
          JSON View
        </Button>
      </div>

      {/* JSON View Modal */}
      <Dialog open={showJsonModal} onOpenChange={setShowJsonModal}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] w-full overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Braces className="h-5 w-5" />
              Raw JSON Data
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            <pre className="bg-muted p-4 rounded-lg text-xs overflow-auto">
              {jsonString}
            </pre>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Stats Row */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Stock Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{product.total_stock}</div>
            <Badge variant={product.total_stock > 0 ? "default" : "secondary"}>
              {product.total_stock > 0 ? "In Stock" : "Out of Stock"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Price ({currency})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currentPrice !== null ? (
                formatPrice(currentPrice)
              ) : (
                <span className="text-muted-foreground">N/A</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {allCurrencies.length > 0 ? allCurrencies.join(", ") : "MDL"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Brand</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-medium">
              {product.brand?.name || product.brand_name || (
                <span className="text-muted-foreground">No brand</span>
              )}
            </div>
            {product.brand?.slug && (
              <p className="text-xs text-muted-foreground">
                Slug: {product.brand.slug}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-medium">
              {product.category?.name || product.category_name || (
                <span className="text-muted-foreground">No category</span>
              )}
            </div>
            {product.category?.product_count !== undefined && (
              <p className="text-xs text-muted-foreground">
                {product.category.product_count} products in category
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Variant Selector */}
      {variants.length > 1 && (
        <VariantSelector
          variants={variants}
          currentProductId={product.id}
        />
      )}

      {/* All Currency Prices - Product Level */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Product Prices (All Currencies)
          </CardTitle>
          <CardDescription>
            Direct product-level prices and price ranges
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            {/* MDL */}
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-sm font-medium text-muted-foreground mb-1">MDL</div>
              <div className="text-lg font-bold">
                {product.price_mdl !== null && product.price_mdl !== undefined
                  ? product.price_mdl.toLocaleString()
                  : <span className="text-muted-foreground text-sm">N/A</span>}
              </div>
            </div>

            {/* EUR */}
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-sm font-medium text-muted-foreground mb-1">EUR</div>
              <div className="text-lg font-bold">
                {product.price_eur !== null && product.price_eur !== undefined
                  ? product.price_eur.toLocaleString()
                  : <span className="text-muted-foreground text-sm">N/A</span>}
              </div>
            </div>

            {/* USD */}
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-sm font-medium text-muted-foreground mb-1">USD</div>
              <div className="text-lg font-bold">
                {product.price_usd !== null && product.price_usd !== undefined
                  ? product.price_usd.toLocaleString()
                  : <span className="text-muted-foreground text-sm">N/A</span>}
              </div>
            </div>

            {/* Min Price */}
            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <div className="text-sm font-medium text-muted-foreground mb-1">Min Price</div>
              <div className="text-lg font-bold">
                {product.price_min !== null && product.price_min !== undefined
                  ? product.price_min.toLocaleString()
                  : <span className="text-muted-foreground text-sm">N/A</span>}
              </div>
            </div>

            {/* Max Price */}
            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <div className="text-sm font-medium text-muted-foreground mb-1">Max Price</div>
              <div className="text-lg font-bold">
                {product.price_max !== null && product.price_max !== undefined
                  ? product.price_max.toLocaleString()
                  : <span className="text-muted-foreground text-sm">N/A</span>}
              </div>
            </div>

            {/* Variants Count - Fixed to use variants.length */}
            <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
              <div className="text-sm font-medium text-muted-foreground mb-1">Variants</div>
              <div className="text-lg font-bold">{variants.length}</div>
            </div>
          </div>

          {/* Raw JSONB prices for debugging */}
          {product.prices && product.prices.length > 0 && (
            <Collapsible open={showRawPrices} onOpenChange={setShowRawPrices} className="mt-4">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <Database className="h-4 w-4" />
                  {showRawPrices ? "Hide" : "Show"} Raw Price Data ({product.prices.length} entries)
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <pre className="p-3 bg-muted rounded-lg text-xs overflow-x-auto">
                  {JSON.stringify(product.prices, null, 2)}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          )}
        </CardContent>
      </Card>

      {/* Description */}
      {product.description && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              Description
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{product.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Stock Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Warehouse className="h-4 w-4" />
            Stock Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Total Stock:</span>
              <Badge variant={product.total_stock > 0 ? "default" : "secondary"}>
                {product.total_stock}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">In Stock:</span>
              {product.is_in_stock ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
            </div>
            {characteristics.length > 0 && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Warehouse:</span>
                  <span className="font-mono">{totalWarehouseStock}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Showroom:</span>
                  <span className="font-mono">{totalShowroomStock}</span>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Images */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            Images ({product.images?.length || 0})
          </CardTitle>
          {product.main_image_url && (
            <CardDescription className="flex items-center gap-1 text-xs">
              Main: {product.main_image_url.substring(0, 40)}...
              <CopyButton text={product.main_image_url} />
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {product.images && product.images.length > 0 ? (
            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
              {product.images.map((image, index) => {
                const imageUrl = image.url || image.path_global || '';
                return (
                  <button
                    key={index}
                    onClick={() => openGallery(index)}
                    className="aspect-square relative rounded-md overflow-hidden border bg-muted hover:ring-2 hover:ring-primary transition-all"
                  >
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={image.description || `Product image ${index + 1}`}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No images available</p>
          )}
        </CardContent>
      </Card>

      {/* Technical Details - All IDs and Flags */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Technical Details
          </CardTitle>
          <CardDescription>
            All IDs, flags, and timestamps for debugging
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* IDs Section */}
            <div className="space-y-1">
              <div className="text-sm font-medium mb-2">Identifiers</div>
              <CopyableField label="ID (UUID)" value={product.id} mono />
              <CopyableField label="Ultra ID" value={product.ultra_id} mono />
              <CopyableField label="Code" value={product.code} />
              <CopyableField label="Article" value={product.article} />
              <CopyableField label="Slug" value={product.slug} />
            </div>

            {/* Relations Section */}
            <div className="space-y-1">
              <div className="text-sm font-medium mb-2">Relations</div>
              <CopyableField label="Brand ID" value={product.brand_id} mono />
              <CopyableField label="Category ID" value={product.category_id} mono />
              <CopyableField label="Parent ID" value={product.parent_id} mono />
              <CopyableField label="Variant Group ID" value={product.variant_group_id} mono />
            </div>

            {/* Flags Section */}
            <div className="space-y-1">
              <div className="text-sm font-medium mb-2">Flags</div>
              <div className="flex justify-between items-center py-1">
                <span className="text-sm text-muted-foreground">Is Active</span>
                <Badge variant={product.is_active ? "default" : "secondary"}>
                  {product.is_active ? "Yes" : "No"}
                </Badge>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-sm text-muted-foreground">Is Group</span>
                <Badge variant={product.is_group ? "default" : "secondary"}>
                  {product.is_group ? "Yes" : "No"}
                </Badge>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-sm text-muted-foreground">Is Service</span>
                <Badge variant={product.is_service ? "default" : "secondary"}>
                  {product.is_service ? "Yes" : "No"}
                </Badge>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-sm text-muted-foreground">Is In Stock</span>
                <Badge variant={product.is_in_stock ? "default" : "secondary"}>
                  {product.is_in_stock ? "Yes" : "No"}
                </Badge>
              </div>
            </div>

            {/* Timestamps Section */}
            <div className="space-y-1">
              <div className="text-sm font-medium mb-2">Timestamps</div>
              <div className="flex justify-between items-center py-1">
                <span className="text-sm text-muted-foreground">Created</span>
                <span className="text-xs">{formatTimestamp(product.created_at)}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-sm text-muted-foreground">Updated</span>
                <span className="text-xs">{formatTimestamp(product.updated_at)}</span>
              </div>
            </div>
          </div>

          {/* Barcodes */}
          {product.barcodes && product.barcodes.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <div className="text-sm font-medium mb-2">Barcodes ({product.barcodes.length})</div>
              <div className="flex flex-wrap gap-2">
                {product.barcodes.map((barcode, index) => (
                  <div key={index} className="flex items-center gap-1 p-2 bg-muted rounded-md">
                    <code className="font-mono text-sm">{barcode}</code>
                    <CopyButton text={barcode} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Warranty */}
      {product.warranty && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Warranty
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{product.warranty}</p>
          </CardContent>
        </Card>
      )}

      {/* Characteristics Section */}
      {characteristics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Boxes className="h-4 w-4" />
              Characteristics / SKUs ({characteristics.length})
            </CardTitle>
            <CardDescription>
              Individual SKUs with their own prices and stock levels
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Ultra ID</TableHead>
                  <TableHead className="text-right">Warehouse</TableHead>
                  <TableHead className="text-right">Showroom</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Prices</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {characteristics.map((char) => (
                  <TableRow key={char.id}>
                    <TableCell className="font-medium">{char.name}</TableCell>
                    <TableCell>
                      {char.code ? (
                        <div className="flex items-center gap-1">
                          <code className="text-xs">{char.code}</code>
                          <CopyButton text={char.code} />
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <code className="text-xs font-mono">
                          {char.ultra_id.substring(0, 8)}...
                        </code>
                        <CopyButton text={char.ultra_id} />
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">{char.stock_warehouse}</TableCell>
                    <TableCell className="text-right font-mono">{char.stock_showroom}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={char.stock_total > 0 ? "default" : "secondary"}>
                        {char.stock_total}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {char.prices?.map((price, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {price.currency}: {price.price.toLocaleString()}
                          </Badge>
                        ))}
                        {(!char.prices || char.prices.length === 0) && (
                          <span className="text-muted-foreground text-xs">No prices</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {char.is_active ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(char.updated_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Properties Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Properties ({properties.length})
          </CardTitle>
          <CardDescription>
            Product specifications grouped by category
          </CardDescription>
        </CardHeader>
        <CardContent>
          {Object.keys(groupedProperties).length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8">
              <Package className="h-8 w-8 text-muted-foreground" />
              <p className="text-muted-foreground">
                No properties found for this product
              </p>
            </div>
          ) : (
            <Tabs defaultValue={Object.keys(groupedProperties)[0]} className="w-full">
              <TabsList className="flex-wrap h-auto gap-1 max-h-[200px] overflow-y-auto">
                {Object.keys(groupedProperties).map((group) => (
                  <TabsTrigger key={group} value={group} className="text-xs">
                    {group} ({groupedProperties[group].length})
                  </TabsTrigger>
                ))}
              </TabsList>

              {Object.entries(groupedProperties).map(([group, props]) => (
                <TabsContent key={group} value={group} className="mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-1/4">Property</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead className="w-[80px]">Type</TableHead>
                        <TableHead className="w-[100px]">Flags</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {props.map((prop) => (
                        <TableRow key={prop.id}>
                          <TableCell className="font-medium">
                            {prop.property_name}
                          </TableCell>
                          <TableCell>{prop.value || <span className="text-muted-foreground">-</span>}</TableCell>
                          <TableCell>
                            {prop.value_type && (
                              <Badge variant="outline" className="text-xs">
                                {prop.value_type}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {prop.is_filter && (
                                <Badge variant="secondary" className="text-xs">
                                  <Filter className="h-3 w-3 mr-1" />
                                  Filter
                                </Badge>
                              )}
                              {prop.is_modification && (
                                <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">
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
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Image Gallery Modal */}
      {product.images && product.images.length > 0 && (
        <ImageGalleryModal
          images={product.images}
          isOpen={galleryOpen}
          onClose={() => setGalleryOpen(false)}
          initialIndex={galleryIndex}
        />
      )}
    </div>
  );
}
