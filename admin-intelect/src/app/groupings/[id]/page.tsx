"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { ProductGrouping, ProductVariant, DeletionImpact } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Package,
  DollarSign,
  Layers,
  ArrowLeft,
  Trash2,
  Loader2,
  Image as ImageIcon,
} from "lucide-react";
import { GroupingBreadcrumb } from "@/components/groupings/GroupingBreadcrumb";
import { GroupingStatsCards } from "@/components/groupings/GroupingStatsCards";
import { DeleteConfirmDialog } from "@/components/properties/DeleteConfirmDialog";

export default function ProductGroupingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;

  // State
  const [group, setGroup] = useState<ProductGrouping | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [variantsLoading, setVariantsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [limit] = useState(50);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  // Deletion state
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    variantId: string;
    variantName: string;
    loading: boolean;
  }>({
    open: false,
    variantId: "",
    variantName: "",
    loading: false,
  });

  // Stats for cards
  const [stats, setStats] = useState({
    totalVariants: 0,
    activeVariants: 0,
    totalStock: 0,
    priceRange: "N/A",
  });

  // Fetch group details
  const fetchGroup = useCallback(async () => {
    try {
      setLoading(true);
      const groupData = await api.getProductGrouping(groupId);
      setGroup(groupData);
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch product group");
      router.push("/groupings");
    } finally {
      setLoading(false);
    }
  }, [groupId, router]);

  // Fetch variants
  const fetchVariants = useCallback(async () => {
    try {
      setVariantsLoading(true);
      const offset = currentPage * limit;
      const response = await api.getProductVariants(groupId, limit, offset, search || undefined);
      setVariants(response.data || []);
      setTotalCount(response.total || 0);

      // Calculate stats from current data
      if (response.data.length > 0) {
        const activeVariants = response.data.filter(v => v.is_active).length;
        const totalStock = response.data.reduce((sum, v) => sum + v.total_stock, 0);

        // Calculate price range
        const validPrices = response.data.filter(v => v.price_mdl !== null);
        let priceRange = "N/A";
        if (validPrices.length > 0) {
          const prices = validPrices.map(v => v.price_mdl || 0);
          const minPrice = Math.min(...prices);
          const maxPrice = Math.max(...prices);
          priceRange = `${minPrice.toFixed(0)} - ${maxPrice.toFixed(0)} MDL`;
        }

        setStats({
          totalVariants: response.total,
          activeVariants,
          totalStock,
          priceRange,
        });
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch variants");
    } finally {
      setVariantsLoading(false);
    }
  }, [groupId, currentPage, limit, search]);

  useEffect(() => {
    fetchGroup();
  }, [fetchGroup]);

  useEffect(() => {
    fetchVariants();
  }, [fetchVariants]);

  // Handle search
  const handleSearch = () => {
    setSearch(searchInput);
    setCurrentPage(0);
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  // Handle delete
  const handleDeleteClick = async (variantId: string, variantName: string) => {
    setDeleteDialog({ open: true, variantId, variantName, loading: false });
  };

  const handleDeleteConfirm = async () => {
    try {
      setDeleteDialog((prev) => ({ ...prev, loading: true }));
      await api.deleteProductVariant(deleteDialog.variantId);
      toast.success("Variant unlinked successfully");
      setDeleteDialog({ open: false, variantId: "", variantName: "", loading: false });
      fetchVariants();
      fetchGroup(); // Refresh group stats
    } catch (error: any) {
      toast.error(error.message || "Failed to unlink variant");
      setDeleteDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  // Pagination
  const totalPages = Math.ceil(totalCount / limit);
  const canGoPrev = currentPage > 0;
  const canGoNext = currentPage < totalPages - 1;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-sm text-muted-foreground">Loading group details...</p>
        </div>
      </div>
    );
  }

  if (!group) {
    return null;
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/groupings")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Groups
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{group.name}</h1>
            <p className="text-muted-foreground">
              Product variants for this grouping
            </p>
          </div>
        </div>
      </div>

      {/* Breadcrumb */}
      <GroupingBreadcrumb
        currentLevel={2}
        groupId={groupId}
        groupName={group.name}
      />

      {/* Group Info Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Code</p>
              <p className="font-medium">{group.code || group.article || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Brand</p>
              <p className="font-medium">{group.brand_name || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Category</p>
              <p className="font-medium">{group.category_name || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge
                variant={group.is_active ? "default" : "secondary"}
                className={group.is_active ? "bg-green-500" : ""}
              >
                {group.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <GroupingStatsCards
        stats={[
          { label: "Total Variants", value: stats.totalVariants, icon: Layers },
          { label: "Active Variants", value: stats.activeVariants, icon: Package },
          { label: "Total Stock", value: stats.totalStock, icon: Package },
          { label: "Price Range", value: stats.priceRange, icon: DollarSign },
        ]}
      />

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search variants..."
                className="pl-9"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyPress={handleSearchKeyPress}
              />
            </div>
            <Button onClick={handleSearch}>Search</Button>
            {search && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchInput("");
                  setSearch("");
                  setCurrentPage(0);
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Variants Table */}
      <Card>
        <CardContent className="pt-6">
          {variantsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                <p className="mt-2 text-sm text-muted-foreground">Loading variants...</p>
              </div>
            </div>
          ) : variants.length === 0 ? (
            <div className="text-center py-8">
              <Layers className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium">No variants found</p>
              <p className="text-sm text-muted-foreground">
                {search ? "Try adjusting your search" : "No variants available"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Image</TableHead>
                    <TableHead>Variant Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead className="text-right">Price (MDL)</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {variants.map((variant) => (
                    <TableRow key={variant.id}>
                      <TableCell>
                        {variant.main_image_url ? (
                          <img
                            src={variant.main_image_url}
                            alt={variant.name}
                            className="w-12 h-12 object-cover rounded"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                            <ImageIcon className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {variant.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {variant.code || variant.article || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {variant.price_mdl !== null ? (
                          <span>{variant.price_mdl.toFixed(2)}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span>{variant.total_stock.toLocaleString()}</span>
                          {variant.is_in_stock && (
                            <Badge variant="default" className="text-xs bg-green-500">
                              In Stock
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={variant.is_active ? "default" : "secondary"}
                          className={variant.is_active ? "bg-green-500" : ""}
                        >
                          {variant.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(variant.id, variant.name)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {!variantsLoading && variants.length > 0 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {currentPage * limit + 1} to{" "}
                {Math.min((currentPage + 1) * limit, totalCount)} of{" "}
                {totalCount.toLocaleString()} variants
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => p - 1)}
                  disabled={!canGoPrev}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <div className="text-sm font-medium">
                  Page {currentPage + 1} of {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => p + 1)}
                  disabled={!canGoNext}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, variantId: "", variantName: "", loading: false })}
        onConfirm={handleDeleteConfirm}
        title="Unlink Product Variant"
        description={`Are you sure you want to unlink "${deleteDialog.variantName}" from this group?`}
        impactData={{ records_to_delete: 0, products_affected: 1 }}
        isLoading={deleteDialog.loading}
      />
    </div>
  );
}
