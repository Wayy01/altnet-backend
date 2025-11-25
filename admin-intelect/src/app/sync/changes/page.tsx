"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertCircle,
  ArrowLeft,
  CalendarClock,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  Timer,
  Tag,
  Layers,
  Package,
  List,
} from "lucide-react";
import { ChangeLogViewer } from "@/components/sync/change-log-viewer";
import { SyncLog } from "@/types";
import { api } from "@/lib/api";
import { handleSyncError } from "@/lib/sync-utils";

/**
 * Format duration in human-readable format
 */
function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds === 0) return "N/A";
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Format number with null safety
 */
function formatNumber(num: number | undefined | null): string {
  if (num == null) return '0';
  return num.toLocaleString();
}

function ChangesPageContent() {
  const searchParams = useSearchParams();
  const logId = searchParams.get("log");

  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [selectedLogId, setSelectedLogId] = useState<string>(logId || "");

  // Animation states
  const [contentVisible, setContentVisible] = useState(false);

  // Trigger animations on mount
  useEffect(() => {
    const timer = setTimeout(() => setContentVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const loadSyncLogs = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.getSyncLogs(50, 0);
      setSyncLogs(response.data);

      // Auto-select first log if no log ID provided - safe array access
      if (!logId && response.data?.length > 0) {
        setSelectedLogId(response.data[0].id);
      }
    } catch (error) {
      handleSyncError(error, "Failed to load sync logs");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [logId]);

  useEffect(() => {
    loadSyncLogs();
  }, [loadSyncLogs]);

  useEffect(() => {
    if (logId && !selectedLogId) {
      setSelectedLogId(logId);
    }
  }, [logId, selectedLogId]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadSyncLogs();
  };

  const selectedLog = useMemo(() => {
    return syncLogs.find((log) => log.id === selectedLogId);
  }, [syncLogs, selectedLogId]);

  // Stats for selected log
  const logStats = useMemo(() => {
    if (!selectedLog) return null;
    return {
      brands: selectedLog.brands_synced ?? 0,
      categories: selectedLog.categories_synced ?? 0,
      products: selectedLog.products_synced ?? 0,
      properties: selectedLog.properties_synced ?? 0,
    };
  }, [selectedLog]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div
        className={`
          flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between
          transition-all duration-300 ease-out
          ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
        `}
      >
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="transition-all duration-200 hover:scale-110 hover:bg-muted active:scale-95"
          >
            <Link href="/sync">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Change History</h1>
            <p className="text-muted-foreground">
              View detailed field-level changes from sync operations
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Sync Log Selector */}
      <div
        className={`
          transition-all duration-300 ease-out
          ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
        `}
        style={{ transitionDelay: "100ms" }}
      >
        <Card className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <CardHeader className="pb-3 bg-muted/30 border-b">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-background shadow-sm">
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold">Select Sync Log</CardTitle>
                <CardDescription className="text-sm">
                  Choose a sync operation to view its change history
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-5 space-y-5">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-12 w-full rounded-xl" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="p-4 rounded-xl border" style={{ opacity: 1 - (i * 0.2) }}>
                      <Skeleton className="h-3 w-16 mb-2" />
                      <Skeleton className="h-6 w-20" />
                    </div>
                  ))}
                </div>
              </div>
            ) : syncLogs.length === 0 ? (
              <Alert className="rounded-xl border-yellow-500/20 bg-yellow-500/5">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                  No sync logs available. Run a selective sync to see change history.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <Select value={selectedLogId} onValueChange={setSelectedLogId}>
                  <SelectTrigger className="h-12 rounded-xl">
                    <SelectValue placeholder="Select a sync log..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl max-h-[400px]">
                    {syncLogs.map((log) => (
                      <SelectItem key={log.id} value={log.id} className="rounded-lg">
                        <div className="flex items-center gap-3 py-1">
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0.5 ${
                              log.status === "completed"
                                ? "bg-primary/10 text-primary border-primary/20"
                                : log.status === "failed"
                                  ? "bg-destructive/10 text-destructive border-destructive/20"
                                  : log.status === "cancelled"
                                    ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
                                    : "bg-muted"
                            }`}
                          >
                            {log.status}
                          </Badge>
                          <span className="font-medium">{log.sync_type}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(log.started_at).toLocaleString()}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedLog && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    {/* Status Banner */}
                    <div className={`rounded-xl border p-4 mb-4 transition-all duration-300 ${
                      selectedLog.status === "completed"
                        ? "border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10"
                        : selectedLog.status === "failed"
                          ? "border-destructive/20 bg-gradient-to-br from-destructive/5 to-destructive/10"
                          : "border-yellow-500/20 bg-gradient-to-br from-yellow-500/5 to-yellow-500/10"
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-full ring-2 shadow-sm ${
                            selectedLog.status === "completed"
                              ? "bg-primary/10 ring-primary/20 shadow-primary/10"
                              : selectedLog.status === "failed"
                                ? "bg-destructive/10 ring-destructive/20 shadow-destructive/10"
                                : "bg-yellow-500/10 ring-yellow-500/20 shadow-yellow-500/10"
                          }`}>
                            {selectedLog.status === "completed" ? (
                              <CheckCircle2 className="h-5 w-5 text-primary" />
                            ) : selectedLog.status === "failed" ? (
                              <XCircle className="h-5 w-5 text-destructive" />
                            ) : (
                              <AlertCircle className="h-5 w-5 text-yellow-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-semibold">{selectedLog.sync_type} Sync</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(selectedLog.started_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Timer className="h-4 w-4" />
                            <span className="font-medium tabular-nums">{formatDuration(selectedLog.duration_seconds)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Stats Grid */}
                    {logStats && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          { label: "Brands", value: logStats.brands, icon: Tag },
                          { label: "Categories", value: logStats.categories, icon: Layers },
                          { label: "Products", value: logStats.products, icon: Package },
                          { label: "Properties", value: logStats.properties, icon: List },
                        ].map(({ label, value, icon: Icon }, index) => (
                          <div
                            key={label}
                            className="group flex flex-col p-4 rounded-xl bg-muted/30 border border-border/30 transition-all duration-200 hover:bg-muted/50 hover:shadow-md hover:-translate-y-0.5"
                            style={{
                              animationDelay: `${index * 50}ms`,
                            }}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="p-1.5 rounded-lg bg-background shadow-sm group-hover:shadow-md transition-shadow">
                                <Icon className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:scale-110" />
                              </div>
                              <p className="text-xl font-bold tabular-nums">{formatNumber(value)}</p>
                            </div>
                            <p className="text-xs text-muted-foreground font-medium">{label} Synced</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Change Log Viewer */}
      {selectedLogId && (
        <div
          className={`
            transition-all duration-300 ease-out
            ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
          `}
          style={{ transitionDelay: "200ms" }}
        >
          <ChangeLogViewer syncLogId={selectedLogId} />
        </div>
      )}
    </div>
  );
}

export default function ChangesPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          <Card className="rounded-xl border bg-card shadow-sm">
            <CardHeader className="pb-3 bg-muted/30 border-b">
              <div className="flex items-center gap-2">
                <Skeleton className="h-7 w-7 rounded-lg" />
                <div className="space-y-1.5">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-56" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-5">
              <Skeleton className="h-12 w-full rounded-xl" />
            </CardContent>
          </Card>
        </div>
      }
    >
      <ChangesPageContent />
    </Suspense>
  );
}
