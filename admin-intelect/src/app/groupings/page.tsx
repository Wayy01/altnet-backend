"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { ProductGrouping, DeletionImpact } from "@/types";
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
  Database,
  DollarSign,
  Layers,
  Eye,
  Trash2,
  Loader2,
} from "lucide-react";
import { GroupingBreadcrumb } from "@/components/groupings/GroupingBreadcrumb";
import { GroupingStatsCards } from "@/components/groupings/GroupingStatsCards";
import { DeleteConfirmDialog } from "@/components/properties/DeleteConfirmDialog";

export default function ProductGroupingsPage() {
  const router = useRouter();

  // State
  const [groups, setGroups] = useState<ProductGrouping[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [limit] = useState(50);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  // Deletion state
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    groupId: string;
    groupName: string;
    impact?: DeletionImpact;
    loading: boolean;
  }>({
    open: false,
    groupId: "",
    groupName: "",
    loading: false,
  });

  // Stats for cards
  const [stats, setStats] = useState({
    totalGroups: 0,
    totalVariants: 0,
    totalStock: 0,
    avgPriceRange: "N/A",
  });

  // Fetch groups
  const fetchGroups = useCallback(async () => {
    try {
      setLoading(true);
      const offset = currentPage * limit;
      const response = await api.getProductGroupings(limit, offset, search || undefined);
      setGroups(response.data || []);
      setTotalCount(response.total);

      // Calculate stats from current data
      if (response.data && response.data.length > 0) {
        const totalVariants = response.data.reduce((sum, g) => sum + g.variant_count, 0);
        const totalStock = response.data.reduce((sum, g) => sum + g.total_stock, 0);

        // Calculate average price range
        const validPrices = response.data.filter(g => g.price_min !== null && g.price_max !== null);
        let avgPriceRange = "N/A";
        if (validPrices.length > 0) {
          const avgMin = validPrices.reduce((sum, g) => sum + (g.price_min || 0), 0) / validPrices.length;
          const avgMax = validPrices.reduce((sum, g) => sum + (g.price_max || 0), 0) / validPrices.length;
          avgPriceRange = `${avgMin.toFixed(0)} - ${avgMax.toFixed(0)} MDL`;
        }

        setStats({
          totalGroups: response.total,
          totalVariants,
          totalStock,
          avgPriceRange,
        });
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch product groupings");
    } finally {
      setLoading(false);
    }
  }, [currentPage, limit, search]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

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
  const handleDeleteClick = async (groupId: string, groupName: string) => {
    try {
      setDeleteDialog({ open: true, groupId, groupName, loading: true });
      const impact = await api.getProductGroupingDeletionImpact(groupId);
      setDeleteDialog({ open: true, groupId, groupName, impact, loading: false });
    } catch (error: any) {
      toast.error(error.message || "Failed to get deletion impact");
      setDeleteDialog({ open: false, groupId: "", groupName: "", loading: false });
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      setDeleteDialog((prev) => ({ ...prev, loading: true }));
      await api.deleteProductGrouping(deleteDialog.groupId);
      toast.success("Product group deleted successfully");
      setDeleteDialog({ open: false, groupId: "", groupName: "", loading: false });
      fetchGroups();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete product group");
      setDeleteDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  // Pagination
  const totalPages = Math.ceil(totalCount / limit);
  const canGoPrev = currentPage > 0;
  const canGoNext = currentPage < totalPages - 1;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Product Groupings</h1>
          <p className="text-muted-foreground">
            Manage parent products and their variant relationships
          </p>
        </div>
      </div>

      {/* Breadcrumb */}
      <GroupingBreadcrumb currentLevel={1} />

      {/* Stats Cards */}
      <GroupingStatsCards
        stats={[
          { label: "Total Groups", value: stats.totalGroups, icon: Database },
          { label: "Total Variants", value: stats.totalVariants, icon: Layers },
          { label: "Total Stock", value: stats.totalStock, icon: Package },
          { label: "Avg Price Range", value: stats.avgPriceRange, icon: DollarSign },
        ]}
      />

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search product groups..."
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

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                <p className="mt-2 text-sm text-muted-foreground">Loading groups...</p>
              </div>
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-8">
              <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium">No product groups found</p>
              <p className="text-sm text-muted-foreground">
                {search ? "Try adjusting your search" : "No groups available"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Variants</TableHead>
                    <TableHead className="text-right">Price Range</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map((group) => (
                    <TableRow key={group.id}>
                      <TableCell className="font-medium">
                        {group.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {group.code || group.article || "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {group.brand_name || "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {group.category_name || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">
                          {group.variant_count}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {group.price_min !== null && group.price_max !== null ? (
                          <span className="text-sm">
                            {group.price_min.toFixed(0)} - {group.price_max.toFixed(0)} MDL
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span>{group.total_stock.toLocaleString()}</span>
                          {group.is_in_stock && (
                            <Badge variant="default" className="text-xs bg-green-500">
                              In Stock
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={group.is_active ? "default" : "secondary"}
                          className={group.is_active ? "bg-green-500" : ""}
                        >
                          {group.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              router.push(`/groupings/${group.id}`)
                            }
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View Variants
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(group.id, group.name)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {!loading && groups.length > 0 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {currentPage * limit + 1} to{" "}
                {Math.min((currentPage + 1) * limit, totalCount)} of{" "}
                {totalCount.toLocaleString()} groups
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
        onClose={() => setDeleteDialog({ open: false, groupId: "", groupName: "", loading: false })}
        onConfirm={handleDeleteConfirm}
        title="Delete Product Group"
        description={`Are you sure you want to delete "${deleteDialog.groupName}" and unlink all its variants?`}
        impactData={deleteDialog.impact}
        isLoading={deleteDialog.loading}
      />
    </div>
  );
}
