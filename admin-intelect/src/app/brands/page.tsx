import { Suspense } from "react";
import Link from "next/link";
import { Building2, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";

interface BrandsPageProps {
  searchParams: Promise<{
    limit?: string;
    offset?: string;
    search?: string;
  }>;
}

async function BrandsContent({
  searchParams,
}: {
  searchParams: BrandsPageProps["searchParams"];
}) {
  const params = await searchParams;
  const limit = parseInt(params.limit || "100", 10);
  const offset = parseInt(params.offset || "0", 10);

  try {
    const brandsData = await api.getBrands(limit, offset);

    // Filter brands if search is provided
    let filteredBrands = brandsData.data;
    if (params.search) {
      const searchLower = params.search.toLowerCase();
      filteredBrands = brandsData.data.filter(
        (brand) =>
          brand.name.toLowerCase().includes(searchLower) ||
          brand.slug.toLowerCase().includes(searchLower)
      );
    }

    return (
      <div className="space-y-4">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Brands</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {brandsData.total.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">With Logos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {brandsData.data.filter((b) => b.logo_url).length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Displayed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredBrands.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="flex items-center gap-4">
          <form className="flex gap-2">
            <Input
              name="search"
              placeholder="Search brands..."
              defaultValue={params.search}
              className="w-[300px]"
            />
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>
        </div>

        {/* Brands Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Logo</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Ultra ID</TableHead>
                <TableHead className="text-right">Products</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBrands.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Building2 className="h-8 w-8 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        No brands found
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredBrands.map((brand) => (
                  <TableRow key={brand.id}>
                    <TableCell>
                      <Avatar className="h-8 w-8">
                        {brand.logo_url ? (
                          <AvatarImage src={brand.logo_url} alt={brand.name} />
                        ) : null}
                        <AvatarFallback>
                          {brand.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">{brand.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {brand.slug}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {brand.ultra_id}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">
                        {brand.product_count || 0}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/products?brand_id=${brand.id}`}>
                          View Products
                          <ExternalLink className="ml-1 h-3 w-3" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination info */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {filteredBrands.length} of {brandsData.total} brands
          </p>
        </div>
      </div>
    );
  } catch (error) {
    console.error("Failed to fetch brands:", error);
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground">
          Failed to load brands. Make sure the Go backend API is running.
        </p>
      </div>
    );
  }
}

export default async function BrandsPage({ searchParams }: BrandsPageProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Brands</h1>
        <p className="text-muted-foreground">
          View and manage all brands in the catalog
        </p>
      </div>

      <Suspense fallback={<BrandsPageSkeleton />}>
        <BrandsContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function BrandsPageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
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
      <Skeleton className="h-10 w-[300px]" />
      <Skeleton className="h-[400px] w-full" />
    </div>
  );
}
