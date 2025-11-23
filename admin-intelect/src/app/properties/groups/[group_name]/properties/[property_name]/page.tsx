"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/lib/api";
import { PropertyValue } from "@/types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Database,
  Package,
  Filter as FilterIcon,
  Settings,
  Edit,
  Trash2,
  Loader2,
  Hash,
} from "lucide-react";
import { PropertyBreadcrumb } from "@/components/properties/PropertyBreadcrumb";
import { PropertyStatsCards } from "@/components/properties/PropertyStatsCards";

export default function PropertyValuesPage() {
  const router = useRouter();
  const params = useParams();
  const groupName = decodeURIComponent(params.group_name as string);
  const propertyName = decodeURIComponent(params.property_name as string);

  // State
  const [values, setValues] = useState<PropertyValue[]>([]);
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
    value?: PropertyValue;
    loading: boolean;
  }>({
    open: false,
    loading: false,
  });

  const [editForm, setEditForm] = useState({
    value: "",
    value_type: "",
    sort_order: 0,
    is_filter: false,
    is_modification: false,
  });

  // Stats for cards
  const [stats, setStats] = useState({
    totalValues: 0,
    uniqueProducts: 0,
    filterProperties: 0,
    modificationProperties: 0,
  });

  // Fetch property values
  const fetchValues = useCallback(async () => {
    try {
      setLoading(true);
      const offset = currentPage * limit;
      const response = await api.getPropertyValues(
        groupName,
        propertyName,
        limit,
        offset,
        search || undefined
      );
      setValues(response.data);
      setTotalCount(response.total);

      // Calculate stats from current data
      if (response.data.length > 0) {
        const uniqueProducts = new Set(response.data.map((v) => v.product_id)).size;
        const filterCount = response.data.filter((v) => v.is_filter).length;
        const modCount = response.data.filter((v) => v.is_modification).length;

        setStats({
          totalValues: response.total,
          uniqueProducts,
          filterProperties: filterCount,
          modificationProperties: modCount,
        });
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch property values");
    } finally {
      setLoading(false);
    }
  }, [groupName, propertyName, currentPage, limit, search]);

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
  const handleEditClick = (value: PropertyValue) => {
    setEditForm({
      value: value.value,
      value_type: value.value_type || "",
      sort_order: value.sort_order,
      is_filter: value.is_filter,
      is_modification: value.is_modification,
    });
    setEditDialog({ open: true, value, loading: false });
  };

  const handleEditSave = async () => {
    if (!editDialog.value) return;

    try {
      setEditDialog((prev) => ({ ...prev, loading: true }));
      await api.updatePropertyValue(editDialog.value.id, editForm);
      toast.success("Property value updated successfully");
      setEditDialog({ open: false, loading: false });
      fetchValues();
    } catch (error: any) {
      toast.error(error.message || "Failed to update property value");
      setEditDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  // Delete handlers
  const handleDelete = async (id: string) => {
    if (!confirm("Delete this property value?")) return;

    try {
      await api.deletePropertyValue(id);
      toast.success("Property value deleted");
      fetchValues();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete property value");
    }
  };

  // Bulk operations
  const handleBulkUpdate = async (updates: {
    is_filter?: boolean;
    is_modification?: boolean;
  }) => {
    if (selectedIds.size === 0) return;

    try {
      const result = await api.bulkUpdatePropertyValues(
        groupName,
        propertyName,
        Array.from(selectedIds),
        updates
      );
      toast.success(`Updated ${result.updated} property values`);
      setSelectedIds(new Set());
      fetchValues();
    } catch (error: any) {
      toast.error(error.message || "Failed to update property values");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} property values?`)) return;

    try {
      const result = await api.bulkDeletePropertyValues(
        groupName,
        propertyName,
        Array.from(selectedIds)
      );
      toast.success(`Deleted ${result.deleted} property values`);
      setSelectedIds(new Set());
      fetchValues();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete property values");
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
          <h1 className="text-3xl font-bold">Property Values</h1>
          <p className="text-muted-foreground">
            Values for property: {propertyName}
          </p>
        </div>
      </div>

      {/* Breadcrumb */}
      <PropertyBreadcrumb
        currentLevel={3}
        groupName={groupName}
        propertyName={propertyName}
      />

      {/* Stats Cards */}
      <PropertyStatsCards
        stats={[
          { label: "Total Values", value: stats.totalValues, icon: Database },
          { label: "Unique Products", value: stats.uniqueProducts, icon: Package },
          { label: "Filter Properties", value: stats.filterProperties, icon: FilterIcon },
          { label: "Modifications", value: stats.modificationProperties, icon: Settings },
        ]}
      />

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search values or product names..."
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

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <Card className="border-orange-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {selectedIds.size} values selected
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkUpdate({ is_filter: true })}
                >
                  Set as Filter
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkUpdate({ is_modification: true })}
                >
                  Set as Modification
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Selected
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                <p className="mt-2 text-sm text-muted-foreground">Loading values...</p>
              </div>
            </div>
          ) : values.length === 0 ? (
            <div className="text-center py-8">
              <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium">No values found</p>
              <p className="text-sm text-muted-foreground">
                {search ? "Try adjusting your search" : "No values for this property"}
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
                    <TableHead>Value</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Product Code</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-center">Sort Order</TableHead>
                    <TableHead className="text-center">Filter</TableHead>
                    <TableHead className="text-center">Modification</TableHead>
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
                      <TableCell className="font-medium max-w-xs truncate">
                        {value.value}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {value.product_name || "-"}
                      </TableCell>
                      <TableCell>
                        {value.product_code ? (
                          <Badge variant="outline" className="font-mono text-xs">
                            {value.product_code}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {value.value_type ? (
                          <Badge variant="secondary">{value.value_type}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Hash className="h-3 w-3 text-muted-foreground" />
                          {value.sort_order}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox checked={value.is_filter} disabled />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox checked={value.is_modification} disabled />
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
            <DialogTitle>Edit Property Value</DialogTitle>
            <DialogDescription>
              Update the property value details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="value">Value</Label>
              <Input
                id="value"
                value={editForm.value}
                onChange={(e) => setEditForm({ ...editForm, value: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="value_type">Value Type</Label>
              <Input
                id="value_type"
                value={editForm.value_type}
                onChange={(e) => setEditForm({ ...editForm, value_type: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sort_order">Sort Order</Label>
              <Input
                id="sort_order"
                type="number"
                value={editForm.sort_order}
                onChange={(e) =>
                  setEditForm({ ...editForm, sort_order: parseInt(e.target.value) || 0 })
                }
              />
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_filter"
                  checked={editForm.is_filter}
                  onCheckedChange={(checked) =>
                    setEditForm({ ...editForm, is_filter: checked as boolean })
                  }
                />
                <Label htmlFor="is_filter">Is Filter</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_modification"
                  checked={editForm.is_modification}
                  onCheckedChange={(checked) =>
                    setEditForm({ ...editForm, is_modification: checked as boolean })
                  }
                />
                <Label htmlFor="is_modification">Is Modification</Label>
              </div>
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
              {editDialog.loading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
