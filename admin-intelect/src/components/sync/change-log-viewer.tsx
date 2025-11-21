"use client";

import { useState, useEffect, useMemo, useDeferredValue } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  FileJson,
  FilePlus,
  FileEdit,
  FileX,
  ExternalLink,
} from "lucide-react";
import { ChangeLogViewerProps, SyncChange, SyncChangeSummary, SyncStep } from "@/types/selective-sync";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { handleSyncError } from "@/lib/sync-utils";

const CHANGE_TYPE_ICONS = {
  insert: <FilePlus className="h-4 w-4 text-primary" />,
  update: <FileEdit className="h-4 w-4 text-secondary" />,
  skip: <FileX className="h-4 w-4 text-muted-foreground" />,
};

const CHANGE_TYPE_LABELS = {
  insert: "Added",
  update: "Updated",
  skip: "Skipped",
};

export function ChangeLogViewer({ syncLogId }: ChangeLogViewerProps) {
  const [loading, setLoading] = useState(true);
  const [changes, setChanges] = useState<SyncChange[]>([]);
  const [summary, setSummary] = useState<SyncChangeSummary | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [stepFilter, setStepFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedChange, setSelectedChange] = useState<SyncChange | null>(null);

  const limit = 50;
  const offset = (page - 1) * limit;
  const totalPages = Math.ceil(total / limit);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      if (cancelled) return;
      await loadChanges();
      if (cancelled) return;
      await loadSummary();
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [syncLogId, page]);

  const loadChanges = async () => {
    try {
      setLoading(true);
      const response = await api.getSyncChanges(syncLogId, limit, offset);
      setChanges(response.changes);
      setTotal(response.total);
    } catch (error) {
      handleSyncError(error, "Failed to load change log");
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const summaryData = await api.getSyncChangeSummary(syncLogId);
      setSummary(summaryData);
    } catch (error) {
      handleSyncError(error, "Failed to load summary");
    }
  };

  // Use deferred value for search to improve performance
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const filteredChanges = useMemo(() => {
    let filtered = changes;

    if (stepFilter !== "all") {
      filtered = filtered.filter((c) => c.step === stepFilter);
    }

    if (typeFilter !== "all") {
      filtered = filtered.filter((c) => c.change_type === typeFilter);
    }

    if (deferredSearchQuery.trim()) {
      const query = deferredSearchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.entity_id.toLowerCase().includes(query) ||
          c.entity_ultra_id?.toLowerCase().includes(query) ||
          c.entity_type.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [changes, stepFilter, typeFilter, deferredSearchQuery]);

  const handleExport = (format: "json" | "csv") => {
    // TODO: Implement export functionality in backend
    // Backend endpoint /api/v1/sync/{syncLogId}/changes/export not yet implemented
    toast.info("Export functionality coming soon!");

    // const url = api.getExportChangesUrl(syncLogId, format);
    // window.open(url, "_blank");
    // toast.success(`Exporting changes as ${format.toUpperCase()}...`);
  };

  const handleViewDetails = (change: SyncChange) => {
    setSelectedChange(change);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Change Log</CardTitle>
              <CardDescription>
                Detailed view of all changes made during this sync
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("csv")}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("json")}
                className="gap-2"
              >
                <FileJson className="h-4 w-4" />
                Export JSON
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{summary.total_changes.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">Total Changes</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-primary">
                    {summary.by_change_type.insert?.toLocaleString() || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Added</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-secondary">
                    {summary.by_change_type.update?.toLocaleString() || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Updated</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-muted-foreground">
                    {summary.by_change_type.skip?.toLocaleString() || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Skipped</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Filters */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by entity ID or type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={stepFilter} onValueChange={setStepFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by step" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Steps</SelectItem>
                <SelectItem value="brands">Brands</SelectItem>
                <SelectItem value="categories">Categories</SelectItem>
                <SelectItem value="products">Products</SelectItem>
                <SelectItem value="properties">Properties</SelectItem>
                <SelectItem value="prices">Prices</SelectItem>
                <SelectItem value="stock">Stock</SelectItem>
                <SelectItem value="exchange_rates">Exchange Rates</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="insert">Added</SelectItem>
                <SelectItem value="update">Updated</SelectItem>
                <SelectItem value="skip">Skipped</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Changes Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                <p className="text-sm text-muted-foreground">Loading changes...</p>
              </div>
            </div>
          ) : filteredChanges.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No changes found</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Step</TableHead>
                      <TableHead>Entity Type</TableHead>
                      <TableHead>Entity ID</TableHead>
                      <TableHead>Fields Changed</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredChanges.map((change) => (
                      <TableRow key={change.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {CHANGE_TYPE_ICONS[change.change_type as keyof typeof CHANGE_TYPE_ICONS]}
                            <span className="text-sm">{CHANGE_TYPE_LABELS[change.change_type as keyof typeof CHANGE_TYPE_LABELS]}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {change.step}
                          </Badge>
                        </TableCell>
                        <TableCell className="capitalize">{change.entity_type}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {change.entity_ultra_id || change.entity_id.substring(0, 8)}...
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{change.fields_changed.length} fields</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(change.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(change)}
                            className="gap-2"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Showing {offset + 1} to {Math.min(offset + limit, total)} of {total} changes
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <div className="text-sm">
                      Page {page} of {totalPages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Change Details Modal */}
      <Dialog open={!!selectedChange} onOpenChange={() => setSelectedChange(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Change Details</DialogTitle>
            <DialogDescription>
              View all field changes for this entity
            </DialogDescription>
          </DialogHeader>
          {selectedChange && (
            <div className="space-y-4">
              {/* Entity Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Entity Type</p>
                  <p className="text-sm font-medium capitalize">{selectedChange.entity_type}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Change Type</p>
                  <div className="flex items-center gap-2 mt-1">
                    {CHANGE_TYPE_ICONS[selectedChange.change_type as keyof typeof CHANGE_TYPE_ICONS]}
                    <span className="text-sm font-medium">
                      {CHANGE_TYPE_LABELS[selectedChange.change_type as keyof typeof CHANGE_TYPE_LABELS]}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Entity ID</p>
                  <p className="text-xs font-mono">{selectedChange.entity_id}</p>
                </div>
                {selectedChange.entity_ultra_id && (
                  <div>
                    <p className="text-xs text-muted-foreground">Ultra ID</p>
                    <p className="text-xs font-mono">{selectedChange.entity_ultra_id}</p>
                  </div>
                )}
              </div>

              {/* Field Changes */}
              <div>
                <p className="text-sm font-medium mb-3">Field Changes</p>
                <ScrollArea className="h-[400px] rounded-md border p-4">
                  <div className="space-y-3">
                    {selectedChange.fields_changed.slice(0, 50).map((field, index) => (
                      <div key={index} className="rounded-lg border p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{field.field_name}</span>
                          {field.was_null && (
                            <Badge variant="outline" className="text-xs">
                              Was Null
                            </Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <p className="text-muted-foreground mb-1">Old Value</p>
                            <pre className="bg-muted p-2 rounded overflow-x-auto">
                              {field.old_value !== undefined
                                ? JSON.stringify(field.old_value, null, 2)
                                : "null"}
                            </pre>
                          </div>
                          <div>
                            <p className="text-muted-foreground mb-1">New Value</p>
                            <pre className="bg-muted p-2 rounded overflow-x-auto">
                              {field.new_value !== undefined
                                ? JSON.stringify(field.new_value, null, 2)
                                : "null"}
                            </pre>
                          </div>
                        </div>
                      </div>
                    ))}
                    {selectedChange.fields_changed.length > 50 && (
                      <div className="text-center text-sm text-muted-foreground p-4 border rounded-lg bg-muted/20">
                        Showing first 50 of {selectedChange.fields_changed.length} fields.
                        Additional fields were modified but are not displayed for performance.
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
