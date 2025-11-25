"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { CharacteristicName, DeletionImpact } from "@/types";
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
  Tag,
  Database,
  DollarSign,
  Eye,
  Trash2,
  Loader2,
} from "lucide-react";
import { CharacteristicBreadcrumb } from "@/components/characteristics/CharacteristicBreadcrumb";
import { CharacteristicStatsCards } from "@/components/characteristics/CharacteristicStatsCards";
import { DeleteConfirmDialog } from "@/components/characteristics/DeleteConfirmDialog";

export default function CharacteristicsPage() {
  const router = useRouter();

  // State
  const [names, setNames] = useState<CharacteristicName[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [limit] = useState(50);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  // Deletion state
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    name: string;
    impact?: DeletionImpact;
    loading: boolean;
  }>({
    open: false,
    name: "",
    loading: false,
  });

  // Stats for cards
  const [stats, setStats] = useState({
    totalNames: 0,
    totalCharacteristics: 0,
    totalStock: 0,
    productsUsing: 0,
  });

  // Fetch characteristic names
  const fetchNames = useCallback(async () => {
    try {
      setLoading(true);
      const offset = currentPage * limit;
      const response = await api.getCharacteristicNames(limit, offset, search || undefined);
      setNames(response.data || []);
      setTotalCount(response.total || 0);

      // Calculate stats from current data
      if (response.data && response.data.length > 0) {
        setStats({
          totalNames: response.total,
          totalCharacteristics: response.data.reduce((sum, n) => sum + n.characteristic_count, 0),
          totalStock: response.data.reduce((sum, n) => sum + n.total_stock, 0),
          productsUsing: response.data.reduce((sum, n) => sum + n.products_using, 0),
        });
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch characteristic names");
      setNames([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, limit, search]);

  useEffect(() => {
    fetchNames();
  }, [fetchNames]);

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
  const handleDeleteClick = async (name: string) => {
    try {
      setDeleteDialog({ open: true, name, loading: true });
      const impact = await api.getCharacteristicNameDeletionImpact(name);
      setDeleteDialog({ open: true, name, impact, loading: false });
    } catch (error: any) {
      toast.error(error.message || "Failed to get deletion impact");
      setDeleteDialog({ open: false, name: "", loading: false });
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      setDeleteDialog((prev) => ({ ...prev, loading: true }));
      await api.deleteCharacteristicName(deleteDialog.name);
      toast.success("Characteristic name deleted successfully");
      setDeleteDialog({ open: false, name: "", loading: false });
      fetchNames();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete characteristic name");
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
          <h1 className="text-3xl font-bold">Characteristic Management</h1>
          <p className="text-muted-foreground">
            Browse characteristic names and values (product variants/SKUs)
          </p>
        </div>
      </div>

      {/* Breadcrumb */}
      <CharacteristicBreadcrumb currentLevel={1} />

      {/* Stats Cards */}
      <CharacteristicStatsCards
        stats={[
          { label: "Total Names", value: stats.totalNames, icon: Tag },
          { label: "Total Characteristics", value: stats.totalCharacteristics, icon: Database },
          { label: "Total Stock", value: stats.totalStock, icon: Package },
          { label: "Products Using", value: stats.productsUsing, icon: DollarSign },
        ]}
      />

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search characteristic names..."
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
                <p className="mt-2 text-sm text-muted-foreground">Loading characteristic names...</p>
              </div>
            </div>
          ) : !names || names.length === 0 ? (
            <div className="text-center py-8">
              <Tag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium">No characteristic names found</p>
              <p className="text-sm text-muted-foreground">
                {search ? "Try adjusting your search" : "No names available"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Characteristics</TableHead>
                    <TableHead className="text-right">Products</TableHead>
                    <TableHead className="text-right">Total Stock</TableHead>
                    <TableHead className="text-right">Avg Price</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {names.map((name) => (
                    <TableRow key={name.name}>
                      <TableCell className="font-medium">
                        {name.name}
                      </TableCell>
                      <TableCell className="text-right">
                        {name.characteristic_count.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {name.products_using.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {name.total_stock.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {name.avg_price ? name.avg_price.toFixed(2) : "-"}
                      </TableCell>
                      <TableCell>
                        {name.common_currency ? (
                          <Badge variant="outline">{name.common_currency}</Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              router.push(
                                `/characteristics/names/${encodeURIComponent(name.name)}`
                              )
                            }
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View Values
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(name.name)}
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
          {!loading && names && names.length > 0 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {currentPage * limit + 1} to{" "}
                {Math.min((currentPage + 1) * limit, totalCount)} of{" "}
                {totalCount.toLocaleString()} names
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
        onClose={() => setDeleteDialog({ open: false, name: "", loading: false })}
        onConfirm={handleDeleteConfirm}
        title="Delete Characteristic Name"
        description={`Are you sure you want to delete all characteristics with the name "${deleteDialog.name}"?`}
        impactData={deleteDialog.impact}
        isLoading={deleteDialog.loading}
      />
    </div>
  );
}
