"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Building2, ExternalLink, Trash2, MoreHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
import { Brand } from "@/types";
import { ConfirmDialog } from "@/components/confirm-dialog";

export default function BrandsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [brands, setBrands] = useState<Brand[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteBrandId, setDeleteBrandId] = useState<string | null>(null);

  const limit = 100;
  const offset = parseInt(searchParams.get("offset") || "0", 10);
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  const fetchBrands = useCallback(async () => {
    try {
      setIsLoading(true);
      const brandsData = await api.getBrands(limit, offset);
      setBrands(brandsData.data);
      setTotal(brandsData.total);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch brands:", err);
      setError("Failed to load brands. Make sure the Go backend API is running.");
    } finally {
      setIsLoading(false);
    }
  }, [offset]);

  useEffect(() => {
    fetchBrands();
  }, [fetchBrands]);

  // Filter brands by search
  const filteredBrands = searchQuery
    ? brands.filter(
        (brand) =>
          brand.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          brand.slug.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : brands;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const newParams = new URLSearchParams(searchParams.toString());
    if (searchQuery) {
      newParams.set("search", searchQuery);
    } else {
      newParams.delete("search");
    }
    newParams.set("offset", "0");
    router.push(`/brands?${newParams.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const newOffset = (newPage - 1) * limit;
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.set("offset", newOffset.toString());
    router.push(`/brands?${newParams.toString()}`);
  };

  const handleToggleActive = async (brandId: string, isActive: boolean) => {
    setIsProcessing(true);
    try {
      await api.updateBrand(brandId, { is_active: isActive });
      toast.success(`Brand ${isActive ? "activated" : "deactivated"}`);
      startTransition(() => {
        fetchBrands();
      });
    } catch (error) {
      console.error("Failed to update brand:", error);
      toast.error("Failed to update brand status");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteBrand = async () => {
    if (!deleteBrandId) return;

    setIsProcessing(true);
    try {
      await api.deleteBrand(deleteBrandId);
      toast.success("Brand deleted successfully");
      setShowDeleteDialog(false);
      setDeleteBrandId(null);
      startTransition(() => {
        fetchBrands();
      });
    } catch (error) {
      console.error("Failed to delete brand:", error);
      toast.error("Failed to delete brand");
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Brands</h1>
          <p className="text-muted-foreground">
            View and manage all brands in the catalog
          </p>
        </div>
        <BrandsPageSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Brands</h1>
          <p className="text-muted-foreground">
            View and manage all brands in the catalog
          </p>
        </div>
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Brands</h1>
        <p className="text-muted-foreground">
          View and manage all brands in the catalog
        </p>
      </div>

      <div className="space-y-4">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Brands</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {total.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">With Logos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {brands.filter((b) => b.logo_url).length}
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
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              name="search"
              placeholder="Search brands..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
                <TableHead className="w-[80px]">Active</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBrands.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
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
                      <Switch
                        checked={brand.is_active}
                        onCheckedChange={(checked) =>
                          handleToggleActive(brand.id, checked)
                        }
                        disabled={isProcessing || isPending}
                      />
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/products?brand_id=${brand.id}`}>
                              <ExternalLink className="mr-2 h-4 w-4" />
                              View Products
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              setDeleteBrandId(brand.id);
                              setShowDeleteDialog(true);
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {filteredBrands.length} of {total} brands
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-sm">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Delete Brand Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Brand"
        description="Are you sure you want to delete this brand? This action cannot be undone and may affect associated products."
        confirmLabel="Delete"
        onConfirm={handleDeleteBrand}
        variant="destructive"
        isLoading={isProcessing}
      />
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
