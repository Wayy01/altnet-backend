"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/lib/api";
import { PropertyName, DeletionImpact } from "@/types";
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
  Hash,
  Eye,
  Trash2,
  Loader2,
} from "lucide-react";
import { PropertyBreadcrumb } from "@/components/properties/PropertyBreadcrumb";
import { PropertyStatsCards } from "@/components/properties/PropertyStatsCards";
import { DeleteConfirmDialog } from "@/components/properties/DeleteConfirmDialog";

export default function PropertyNamesPage() {
  const router = useRouter();
  const params = useParams();
  const groupName = decodeURIComponent(params.group_name as string);

  // State
  const [properties, setProperties] = useState<PropertyName[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [limit] = useState(50);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  // Deletion state
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    propertyName: string;
    impact?: DeletionImpact;
    loading: boolean;
  }>({
    open: false,
    propertyName: "",
    loading: false,
  });

  // Stats for cards
  const [stats, setStats] = useState({
    totalProperties: 0,
    totalValues: 0,
    uniqueValues: 0,
    productsUsing: 0,
  });

  // Fetch property names
  const fetchProperties = useCallback(async () => {
    try {
      setLoading(true);
      const offset = currentPage * limit;
      const response = await api.getPropertyNames(
        groupName,
        limit,
        offset,
        search || undefined
      );
      setProperties(response.data);
      setTotalCount(response.total);

      // Calculate stats from current data
      if (response.data.length > 0) {
        setStats({
          totalProperties: response.total,
          totalValues: response.data.reduce((sum, p) => sum + p.value_count, 0),
          uniqueValues: response.data.reduce((sum, p) => sum + p.unique_value_count, 0),
          productsUsing: response.data.reduce((sum, p) => sum + p.products_using, 0),
        });
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch property names");
    } finally {
      setLoading(false);
    }
  }, [groupName, currentPage, limit, search]);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

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
  const handleDeleteClick = async (propertyName: string) => {
    try {
      setDeleteDialog({ open: true, propertyName, loading: true });
      const impact = await api.getPropertyNameDeletionImpact(groupName, propertyName);
      setDeleteDialog({ open: true, propertyName, impact, loading: false });
    } catch (error: any) {
      toast.error(error.message || "Failed to get deletion impact");
      setDeleteDialog({ open: false, propertyName: "", loading: false });
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      setDeleteDialog((prev) => ({ ...prev, loading: true }));
      await api.deletePropertyName(groupName, deleteDialog.propertyName);
      toast.success("Property name deleted successfully");
      setDeleteDialog({ open: false, propertyName: "", loading: false });
      fetchProperties();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete property name");
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
          <h1 className="text-3xl font-bold">Property Names</h1>
          <p className="text-muted-foreground">
            Properties in group: {groupName}
          </p>
        </div>
      </div>

      {/* Breadcrumb */}
      <PropertyBreadcrumb currentLevel={2} groupName={groupName} />

      {/* Stats Cards */}
      <PropertyStatsCards
        stats={[
          { label: "Total Properties", value: stats.totalProperties, icon: Database },
          { label: "Total Values", value: stats.totalValues, icon: FilterIcon },
          { label: "Unique Values", value: stats.uniqueValues, icon: Hash },
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
                placeholder="Search properties..."
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
                <p className="mt-2 text-sm text-muted-foreground">Loading properties...</p>
              </div>
            </div>
          ) : properties.length === 0 ? (
            <div className="text-center py-8">
              <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium">No properties found</p>
              <p className="text-sm text-muted-foreground">
                {search ? "Try adjusting your search" : "No properties in this group"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Property Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead className="text-right">Values</TableHead>
                    <TableHead className="text-right">Unique Values</TableHead>
                    <TableHead className="text-right">Products</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Flags</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {properties.map((property) => (
                    <TableRow key={property.property_name}>
                      <TableCell className="font-medium">
                        {property.property_name}
                      </TableCell>
                      <TableCell>
                        {property.property_code ? (
                          <Badge variant="outline" className="font-mono text-xs">
                            {property.property_code}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {property.value_count.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {property.unique_value_count.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {property.products_using.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {property.common_value_type ? (
                          <Badge variant="secondary">{property.common_value_type}</Badge>
                        ) : (
                          <span className="text-muted-foreground">Mixed</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {property.common_is_filter && (
                            <Badge variant="default" className="text-xs bg-green-500">
                              Filter
                            </Badge>
                          )}
                          {property.common_is_modification && (
                            <Badge variant="default" className="text-xs bg-blue-500">
                              Mod
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
                                `/properties/groups/${encodeURIComponent(
                                  groupName
                                )}/properties/${encodeURIComponent(property.property_name)}`
                              )
                            }
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View Values
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(property.property_name)}
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
          {!loading && properties.length > 0 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {currentPage * limit + 1} to{" "}
                {Math.min((currentPage + 1) * limit, totalCount)} of{" "}
                {totalCount.toLocaleString()} properties
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
        onClose={() => setDeleteDialog({ open: false, propertyName: "", loading: false })}
        onConfirm={handleDeleteConfirm}
        title="Delete Property Name"
        description={`Are you sure you want to delete the property "${deleteDialog.propertyName}" and all its values?`}
        impactData={deleteDialog.impact}
        isLoading={deleteDialog.loading}
      />
    </div>
  );
}
