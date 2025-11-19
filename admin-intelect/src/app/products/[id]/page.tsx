import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Package, Barcode, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { api } from "@/lib/api";
import { Property, Characteristic } from "@/types";

interface ProductDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ProductDetailPage({
  params,
}: ProductDetailPageProps) {
  const { id } = await params;

  try {
    const [product, properties, characteristics] = await Promise.all([
      api.getProduct(id),
      api.getProductProperties(id),
      api.getProductCharacteristics(id),
    ]);

    if (!product) {
      notFound();
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

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/products">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
            <p className="text-muted-foreground">
              Product Code: {product.code}
              {product.article && ` | Article: ${product.article}`}
            </p>
          </div>
        </div>

        {/* Product Overview */}
        <div className="grid gap-4 md:grid-cols-3">
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
              <p className="text-xs text-muted-foreground">USD</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Brand & Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <p className="font-medium">
                  {product.brand_name || (
                    <span className="text-muted-foreground">No brand</span>
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  {product.category_name || "No category"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Images and Barcodes */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Images ({product.images?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {product.images && product.images.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {product.images.map((image, index) => (
                    <Badge key={index} variant="outline" className="font-mono text-xs">
                      {image.uuid ? image.uuid.substring(0, 8) : `Image ${index + 1}`}...
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No images</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Barcode className="h-4 w-4" />
                Barcodes ({product.barcodes?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {product.barcodes && product.barcodes.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {product.barcodes.map((barcode, index) => (
                    <Badge key={index} variant="outline" className="font-mono">
                      {barcode}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No barcodes</p>
              )}
            </CardContent>
          </Card>
        </div>

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
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {char.prices?.map((price, index) => (
                                <Badge
                                  key={index}
                                  variant="outline"
                                  className="font-mono text-xs"
                                >
                                  {price.currency}: {price.price.toLocaleString()}
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
      </div>
    );
  } catch (error) {
    console.error("Failed to fetch product:", error);
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground">
          Failed to load product. Make sure the Go backend API is running.
        </p>
        <Button variant="outline" asChild className="mt-4">
          <Link href="/products">Back to Products</Link>
        </Button>
      </div>
    );
  }
}
