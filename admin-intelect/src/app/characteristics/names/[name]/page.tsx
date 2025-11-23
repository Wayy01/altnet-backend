"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/lib/api";
import { CharacteristicValue } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Package,
  Warehouse,
  Tag,
  DollarSign,
  Edit,
  Trash2,
  Loader2,
} from "lucide-react";
import { CharacteristicBreadcrumb } from "@/components/characteristics/CharacteristicBreadcrumb";
import { CharacteristicStatsCards } from "@/components/characteristics/CharacteristicStatsCards";

export default function CharacteristicValuesPage() {
  const router = useRouter();
  const params = useParams();
  const characteristicName = decodeURIComponent(params.name as string);

  // State
  const [values, setValues] = useState<CharacteristicValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [limit] = useState(100);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Edit dialog state
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    value?: CharacteristicValue;
    loading: boolean;
  }>({
    open: false,
    loading: false,
  });

  const [editForm, setEditForm] = useState({
    code: "",
    reference: "",
    stock_warehouse: 0,
    stock_showroom: 0,
    stock_total: 0,
    is_active: true,
  });

  // Stats for cards
  const [stats, setStats] = useState({
    totalValues: 0,
    uniqueProducts: 0,
    totalStock: 0,
    activeValues: 0,
  });

  // Fetch characteristic values
  const fetchValues = useCallback(async () => {
    try {
      setLoading(true);
      const offset = currentPage * limit;
      const response = await api.getCharacteristicValues(
        characteristicName,
        limit,
        offset,
        search || undefined
      );
      setValues(response.data);
      setTotalCount(response.total);

      // Calculate stats from current data
      if (response.data.length > 0) {
        const uniqueProducts = new Set(response.data.map((v) => v.product_id)).size;
        const totalStock = response.data.reduce((sum, v) => sum + v.stock_total, 0);
        const activeCount = response.data.filter((v) => v.is_active).length;

        setStats({
          totalValues: response.total,
          uniqueProducts,
          totalStock,
          activeValues: activeCount,
        });
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch characteristic values");
    } finally {
      setLoading(false);
    }
  }, [characteristicName, currentPage, limit, search]);

  useEffect(() => {
    fetchValues();
  }, [fetchValues]);

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

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === values.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(values.map((v) => v.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // Edit handlers
  const handleEditClick = (value: CharacteristicValue) => {
    setEditForm({
      code: value.code || "",
      reference: value.reference || "",
      stock_warehouse: value.stock_warehouse,
      stock_showroom: value.stock_showroom,
      stock_total: value.stock_total,
      is_active: value.is_active,
    });
    setEditDialog({ open: true, value, loading: false });
  };

  const handleEditSave = async () => {
    if (!editDialog.value) return;

    try {
      setEditDialog((prev) => ({ ...prev, loading: true }));
      await api.updateCharacteristicValue(editDialog.value.id, editForm);
      toast.success("Characteristic value updated successfully");
      setEditDialog({ open: false, loading: false });
      fetchValues();
    } catch (error: any) {
      toast.error(error.message || "Failed to update characteristic value");
      setEditDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  // Delete handlers
  const handleDelete = async (id: string) => {
    if (!confirm("Delete this characteristic value?")) return;

    try {
      await api.deleteCharacteristicValue(id);
      toast.success("Characteristic value deleted");
      fetchValues();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete characteristic value");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) {
      toast.error("No values selected");
      return;
    }

    if (!confirm(`Delete ${selectedIds.size} selected values?`)) return;

    try {
      await api.bulkDeleteCharacteristicValues(Array.from(selectedIds));
      toast.success(`${selectedIds.size} values deleted`);
      setSelectedIds(new Set());
      fetchValues();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete characteristic values");
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
          <h1 className="text-3xl font-bold">Characteristic Values</h1>
          <p className="text-muted-foreground">
            Manage values for: {characteristicName}
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push("/characteristics")}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to Names
        </Button>
      </div>

      {/* Breadcrumb */}
      <CharacteristicBreadcrumb currentLevel={2} characteristicName={characteristicName} />

      {/* Stats Cards */}
      <CharacteristicStatsCards
        stats={[
          { label: "Total Values", value: stats.totalValues, icon: Tag },
          { label: "Unique Products", value: stats.uniqueProducts, icon: Package },
          { label: "Total Stock", value: stats.totalStock, icon: Warehouse },
          { label: "Active Values", value: stats.activeValues, icon: DollarSign },
        ]}
      />

      {/* Search and Bulk Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by code, reference, or product name..."
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

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <span className="text-sm font-medium">{selectedIds.size} selected</span>
              <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Selected
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
                Clear Selection
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                <p className="mt-2 text-sm text-muted-foreground">Loading characteristic values...</p>
              </div>
            </div>
          ) : values.length === 0 ? (
            <div className="text-center py-8">
              <Tag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium">No characteristic values found</p>
              <p className="text-sm text-muted-foreground">
                {search ? "Try adjusting your search" : "No values available"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedIds.size === values.length && values.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Warehouse</TableHead>
                    <TableHead className="text-right">Showroom</TableHead>
                    <TableHead className="text-right">Total Stock</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {values.map((value) => (
                    <TableRow key={value.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(value.id)}
                          onCheckedChange={() => toggleSelect(value.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{value.product_name || "N/A"}</div>
                          <div className="text-xs text-muted-foreground">{value.product_code}</div>
                        </div>
                      </TableCell>
                      <TableCell>{value.code || "-"}</TableCell>
                      <TableCell>{value.reference || "-"}</TableCell>
                      <TableCell className="text-right">{value.stock_warehouse}</TableCell>
                      <TableCell className="text-right">{value.stock_showroom}</TableCell>
                      <TableCell className="text-right font-medium">{value.stock_total}</TableCell>
                      <TableCell>
                        {value.prices && Array.isArray(value.prices) && value.prices.length > 0 && value.prices[0]?.price != null ? (
                          <div className="text-sm">
                            {Number(value.prices[0].price).toFixed(2)} {value.prices[0].currency || ''}
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={value.is_active ? "default" : "secondary"}>
                          {value.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditClick(value)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(value.id)}
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
          {!loading && values.length > 0 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {currentPage * limit + 1} to{" "}
                {Math.min((currentPage + 1) * limit, totalCount)} of{" "}
                {totalCount.toLocaleString()} values
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

      {/* Edit Dialog */}
      <Dialog open={editDialog.open} onOpenChange={(open) => setEditDialog({ open, loading: false })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Characteristic Value</DialogTitle>
            <DialogDescription>
              Update the characteristic value details
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                value={editForm.code}
                onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="reference">Reference</Label>
              <Input
                id="reference"
                value={editForm.reference}
                onChange={(e) => setEditForm({ ...editForm, reference: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="grid gap-2">
                <Label htmlFor="stock_warehouse">Warehouse Stock</Label>
                <Input
                  id="stock_warehouse"
                  type="number"
                  value={editForm.stock_warehouse}
                  onChange={(e) =>
                    setEditForm({ ...editForm, stock_warehouse: parseInt(e.target.value) || 0 })
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="stock_showroom">Showroom Stock</Label>
                <Input
                  id="stock_showroom"
                  type="number"
                  value={editForm.stock_showroom}
                  onChange={(e) =>
                    setEditForm({ ...editForm, stock_showroom: parseInt(e.target.value) || 0 })
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="stock_total">Total Stock</Label>
                <Input
                  id="stock_total"
                  type="number"
                  value={editForm.stock_total}
                  onChange={(e) =>
                    setEditForm({ ...editForm, stock_total: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="is_active"
                checked={editForm.is_active}
                onCheckedChange={(checked) =>
                  setEditForm({ ...editForm, is_active: checked as boolean })
                }
              />
              <Label htmlFor="is_active">Active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialog({ open: false, loading: false })}
              disabled={editDialog.loading}
            >
              Cancel
            </Button>
            <Button onClick={handleEditSave} disabled={editDialog.loading}>
              {editDialog.loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
