"use client";

import { useState, useEffect } from "react";
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
  ExternalLink,
  X,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
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
import { api } from "@/lib/api";
import { Property, Characteristic, ProductDetail, ImageEntry } from "@/types";

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
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNext = () => {
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
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }
  };

  return (
    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopy}>
      {copied ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </Button>
  );
}

export default function ProductDetailPage({
  params,
}: ProductDetailPageProps) {
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [characteristics, setCharacteristics] = useState<Characteristic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const { id } = await params;
        if (cancelled) return;

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

        setProduct(productData);
        setProperties(propertiesData);
        setCharacteristics(characteristicsData);
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

  // Group properties by group_name
  const groupedProperties = properties.reduce((acc, prop) => {
    const group = prop.group_name || "General";
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(prop);
    return acc;
  }, {} as Record<string, Property[]>);

  // Get all unique currencies from characteristics
  const allCurrencies = Array.from(
    new Set(
      characteristics.flatMap((char) =>
        char.prices?.map((p) => p.currency) || []
      )
    )
  ).sort();

  // Calculate totals from characteristics
  const totalWarehouseStock = characteristics.reduce(
    (sum, char) => sum + (char.stock_warehouse || 0),
    0
  );
  const totalShowroomStock = characteristics.reduce(
    (sum, char) => sum + (char.stock_showroom || 0),
    0
  );

  const openGallery = (index: number) => {
    setGalleryIndex(index);
    setGalleryOpen(true);
  };

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
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
            <Badge variant={product.is_active ? "default" : "secondary"}>
              {product.is_active ? "Active" : "Inactive"}
            </Badge>
            {product.is_group && (
              <Badge variant="outline">Group</Badge>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1 text-muted-foreground">
            <span className="flex items-center gap-1">
              <Tag className="h-3 w-3" />
              Code: {product.code}
            </span>
            {product.article && (
              <span>Article: {product.article}</span>
            )}
            <span className="flex items-center gap-1">
              <Info className="h-3 w-3" />
              ID: {product.id.substring(0, 8)}...
              <CopyButton text={product.id} />
            </span>
          </div>
        </div>
      </div>

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
            <CardTitle className="text-sm font-medium">Price Range</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {product.price_min && product.price_max ? (
                <>
                  {product.price_min.toLocaleString()} -{" "}
                  {product.price_max.toLocaleString()}
                </>
              ) : (
                <span className="text-muted-foreground">N/A</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {allCurrencies.length > 0 ? allCurrencies.join(", ") : "USD"}
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

      {/* Product Details */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Description */}
        {product.description && (
          <Card className="md:col-span-2">
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

        {/* Images */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              Images ({product.images?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {product.images && product.images.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
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

        {/* Barcodes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Barcode className="h-4 w-4" />
              Barcodes ({product.barcodes?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {product.barcodes && product.barcodes.length > 0 ? (
              <div className="space-y-2">
                {product.barcodes.map((barcode, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-md">
                    <code className="font-mono text-sm">{barcode}</code>
                    <CopyButton text={barcode} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No barcodes</p>
            )}
          </CardContent>
        </Card>

        {/* Stock Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Warehouse className="h-4 w-4" />
              Stock Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Total Stock</span>
                <Badge variant={product.total_stock > 0 ? "default" : "secondary"}>
                  {product.total_stock}
                </Badge>
              </div>
              {characteristics.length > 0 && (
                <>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Warehouse</span>
                    <span className="font-mono">{totalWarehouseStock}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Showroom</span>
                    <span className="font-mono">{totalShowroomStock}</span>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Metadata */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Metadata
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ultra ID</span>
                <span className="font-mono text-xs">{product.ultra_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{new Date(product.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Updated</span>
                <span>{new Date(product.updated_at).toLocaleDateString()}</span>
              </div>
              {product.parent_id && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Parent ID</span>
                  <span className="font-mono text-xs">{product.parent_id}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* All Prices by Currency */}
      {characteristics.length > 0 && allCurrencies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Prices by Currency
            </CardTitle>
            <CardDescription>
              All prices across all variants
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
              {allCurrencies.map((currency) => {
                const pricesForCurrency = characteristics
                  .flatMap((char) =>
                    char.prices?.filter((p) => p.currency === currency) || []
                  )
                  .map((p) => p.price);

                if (pricesForCurrency.length === 0) {
                  return null;
                }

                const minPrice = Math.min(...pricesForCurrency);
                const maxPrice = Math.max(...pricesForCurrency);

                return (
                  <div key={currency} className="p-3 bg-muted rounded-lg">
                    <div className="text-sm font-medium text-muted-foreground mb-1">
                      {currency}
                    </div>
                    <div className="text-lg font-bold">
                      {minPrice === maxPrice
                        ? minPrice.toLocaleString()
                        : `${minPrice.toLocaleString()} - ${maxPrice.toLocaleString()}`}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs for Properties and Characteristics */}
      <Tabs defaultValue="properties" className="w-full">
        <TabsList>
          <TabsTrigger value="properties">
            Properties ({properties.length})
          </TabsTrigger>
          <TabsTrigger value="characteristics">
            Variants ({characteristics.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="properties" className="space-y-4">
          {Object.keys(groupedProperties).length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <div className="flex flex-col items-center gap-2">
                  <Package className="h-8 w-8 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    No properties found for this product
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            Object.entries(groupedProperties).map(([group, props]) => (
              <Card key={group}>
                <CardHeader>
                  <CardTitle className="text-lg">{group}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-1/3">Property</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead className="w-[100px]">Filter</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {props.map((prop) => (
                        <TableRow key={prop.id}>
                          <TableCell className="font-medium">
                            {prop.property_name}
                          </TableCell>
                          <TableCell>{prop.value}</TableCell>
                          <TableCell>
                            {prop.is_filter && (
                              <Badge variant="secondary">Filter</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="characteristics">
          <Card>
            <CardContent className="pt-6">
              {characteristics.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8">
                  <Package className="h-8 w-8 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    No variants found for this product
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Variant Name</TableHead>
                      <TableHead>Ultra ID</TableHead>
                      <TableHead>Prices</TableHead>
                      <TableHead className="text-right">Warehouse</TableHead>
                      <TableHead className="text-right">Showroom</TableHead>
                      <TableHead className="text-right">Total Stock</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {characteristics.map((char) => (
                      <TableRow key={char.id}>
                        <TableCell className="font-medium">
                          {char.name}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {char.ultra_id.substring(0, 8)}...
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {char.prices?.map((price, index) => (
                              <Badge
                                key={index}
                                variant="outline"
                                className="font-mono text-xs"
                              >
                                {price.currency}: {price.price.toLocaleString()}
                                {price.price_type && price.price_type !== "default" && (
                                  <span className="ml-1 text-muted-foreground">
                                    ({price.price_type})
                                  </span>
                                )}
                              </Badge>
                            ))}
                            {(!char.prices || char.prices.length === 0) && (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {char.stock_warehouse}
                        </TableCell>
                        <TableCell className="text-right">
                          {char.stock_showroom}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={
                              char.stock_total > 0 ? "default" : "secondary"
                            }
                          >
                            {char.stock_total}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
