"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Clock, CheckCircle2, XCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { SyncLog } from "@/types";

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString();
}

export default function SyncPage() {
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limit] = useState(20);
  const [offset, setOffset] = useState(0);

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  const fetchSyncLogs = useCallback(async () => {
    try {
      const response = await api.getSyncLogs(limit, offset);
      setSyncLogs(response.data);
      setTotal(response.total);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch sync logs:", err);
      setError("Failed to load sync logs. Make sure the Go backend API is running.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [limit, offset]);

  useEffect(() => {
    fetchSyncLogs();
  }, [fetchSyncLogs]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchSyncLogs();
  };

  const handlePageChange = (newPage: number) => {
    setOffset((newPage - 1) * limit);
  };

  // Calculate stats from logs
  const completedCount = syncLogs.filter(l => l.status === "completed").length;
  const failedCount = syncLogs.filter(l => l.status === "failed").length;
  const lastSync = syncLogs[0];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sync Status</h1>
          <p className="text-muted-foreground">
            View synchronization history and status
          </p>
        </div>
        <SyncPageSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sync Status</h1>
          <p className="text-muted-foreground">
            View synchronization history and status
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Sync Steps Info */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Step 1-2</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">Brands & Categories</div>
            <p className="text-xs text-muted-foreground">
              Initial catalog structure
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Step 3</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">Products</div>
            <p className="text-xs text-muted-foreground">
              Full product catalog with variants
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Step 4</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">Properties</div>
            <p className="text-xs text-muted-foreground">
              ~35 min for 418 categories
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Step 5-7</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">Prices & Stock</div>
            <p className="text-xs text-muted-foreground">
              Pricing and inventory updates
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Syncs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completedCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{failedCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Last Sync Info */}
      {lastSync && (
        <Card>
          <CardHeader>
            <CardTitle>Last Sync</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Badge
                  variant={lastSync.status === "completed" ? "default" : "destructive"}
                  className="flex items-center gap-1"
                >
                  {lastSync.status === "completed" ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <XCircle className="h-3 w-3" />
                  )}
                  {lastSync.status}
                </Badge>
                <span className="text-sm">
                  <strong>{lastSync.sync_type}</strong> - {lastSync.items_synced.toLocaleString()} items
                </span>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <div>{formatDate(lastSync.created_at)}</div>
                <div className="flex items-center justify-end gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDuration(lastSync.duration_ms)}
                </div>
              </div>
            </div>
            {lastSync.error_message && (
              <div className="mt-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {lastSync.error_message}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sync History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Sync History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground">{error}</p>
            </div>
          ) : syncLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No sync logs found</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Items Synced</TableHead>
                    <TableHead className="text-right">Duration</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {syncLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">{log.sync_type}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            log.status === "completed" ? "default" : "destructive"
                          }
                          className="flex w-fit items-center gap-1"
                        >
                          {log.status === "completed" ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : (
                            <XCircle className="h-3 w-3" />
                          )}
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {log.items_synced.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="flex items-center justify-end gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {formatDuration(log.duration_ms)}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(log.created_at)}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        {log.error_message ? (
                          <span className="text-sm text-destructive line-clamp-1" title={log.error_message}>
                            {log.error_message}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {offset + 1} to {Math.min(offset + limit, total)} of {total} sync logs
                  </p>
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
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Commands Info */}
      <Card>
        <CardHeader>
          <CardTitle>Sync Commands</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Run sync operations from the terminal:
          </p>
          <div className="space-y-2">
            <code className="block rounded bg-muted p-3 text-sm">
              go run cmd/sync/main.go
            </code>
            <p className="text-xs text-muted-foreground">
              Runs the full sync process (all 7 steps)
            </p>
          </div>
          <div className="space-y-2">
            <code className="block rounded bg-muted p-3 text-sm">
              make status
            </code>
            <p className="text-xs text-muted-foreground">
              Check last sync runs
            </p>
          </div>
          <div className="space-y-2">
            <code className="block rounded bg-muted p-3 text-sm">
              make stats
            </code>
            <p className="text-xs text-muted-foreground">
              View database statistics
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SyncPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-16" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-6 w-32 mb-1" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
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
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
