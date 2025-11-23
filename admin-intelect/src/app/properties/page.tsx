"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { PropertyGroup, DeletionImpact } from "@/types";
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
  Database,
  Package,
  Filter as FilterIcon,
  Settings,
  Eye,
  Trash2,
  Loader2,
} from "lucide-react";
import { PropertyBreadcrumb } from "@/components/properties/PropertyBreadcrumb";
import { PropertyStatsCards } from "@/components/properties/PropertyStatsCards";
import { DeleteConfirmDialog } from "@/components/properties/DeleteConfirmDialog";

export default function PropertiesPage() {
  const router = useRouter();

  // State
  const [groups, setGroups] = useState<PropertyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [limit] = useState(50);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  // Deletion state
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    groupName: string;
    impact?: DeletionImpact;
    loading: boolean;
  }>({
    open: false,
    groupName: "",
    loading: false,
  });

  // Stats for cards
  const [stats, setStats] = useState({
    totalGroups: 0,
    totalProperties: 0,
    totalValues: 0,
    productsUsing: 0,
  });

  // Fetch groups
  const fetchGroups = useCallback(async () => {
    try {
      setLoading(true);
      const offset = currentPage * limit;
      const response = await api.getPropertyGroups(limit, offset, search || undefined);
      setGroups(response.data);
      setTotalCount(response.total);

      // Calculate stats from current data
      if (response.data.length > 0) {
        setStats({
          totalGroups: response.total,
          totalProperties: response.data.reduce((sum, g) => sum + g.property_count, 0),
          totalValues: response.data.reduce((sum, g) => sum + g.value_count, 0),
          productsUsing: response.data.reduce((sum, g) => sum + g.products_using, 0),
        });
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch property groups");
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
  const handleDeleteClick = async (groupName: string) => {
    try {
      setDeleteDialog({ open: true, groupName, loading: true });
      const impact = await api.getGroupDeletionImpact(groupName);
      setDeleteDialog({ open: true, groupName, impact, loading: false });
    } catch (error: any) {
      toast.error(error.message || "Failed to get deletion impact");
      setDeleteDialog({ open: false, groupName: "", loading: false });
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      setDeleteDialog((prev) => ({ ...prev, loading: true }));
      await api.deletePropertyGroup(deleteDialog.groupName);
      toast.success("Property group deleted successfully");
      setDeleteDialog({ open: false, groupName: "", loading: false });
      fetchGroups();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete property group");
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
          <h1 className="text-3xl font-bold">Property Management</h1>
          <p className="text-muted-foreground">
            Browse property groups, names, and values in a hierarchical structure
          </p>
        </div>
      </div>

      {/* Breadcrumb */}
      <PropertyBreadcrumb currentLevel={1} />

      {/* Stats Cards */}
      <PropertyStatsCards
        stats={[
          { label: "Total Groups", value: stats.totalGroups, icon: Database },
          { label: "Total Properties", value: stats.totalProperties, icon: Settings },
          { label: "Total Values", value: stats.totalValues, icon: FilterIcon },
          { label: "Products Using", value: stats.productsUsing, icon: Package },
        ]}
      />

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search groups..."
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
              <p className="text-lg font-medium">No property groups found</p>
              <p className="text-sm text-muted-foreground">
                {search ? "Try adjusting your search" : "No groups available"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Group Name</TableHead>
                    <TableHead className="text-right">Properties</TableHead>
                    <TableHead className="text-right">Values</TableHead>
                    <TableHead className="text-right">Products</TableHead>
                    <TableHead>Common Flags</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map((group) => (
                    <TableRow key={group.group_name}>
                      <TableCell className="font-medium">
                        {group.group_name}
                      </TableCell>
                      <TableCell className="text-right">
                        {group.property_count.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {group.value_count.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {group.products_using.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {group.common_is_filter && (
                            <Badge variant="default" className="text-xs bg-green-500">
                              Filters
                            </Badge>
                          )}
                          {group.common_is_modification && (
                            <Badge variant="default" className="text-xs bg-blue-500">
                              Mods
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              router.push(
                                `/properties/groups/${encodeURIComponent(group.group_name)}`
                              )
                            }
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View Properties
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(group.group_name)}
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
        onClose={() => setDeleteDialog({ open: false, groupName: "", loading: false })}
        onConfirm={handleDeleteConfirm}
        title="Delete Property Group"
        description={`Are you sure you want to delete the group "${deleteDialog.groupName}" and all its properties?`}
        impactData={deleteDialog.impact}
        isLoading={deleteDialog.loading}
      />
    </div>
  );
}
