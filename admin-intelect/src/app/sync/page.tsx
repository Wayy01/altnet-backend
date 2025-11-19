"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Loader2,
  Database,
  Tag,
  Layers,
  Package,
  List,
  DollarSign,
  BarChart3,
  ArrowRightLeft,
  Timer,
  CalendarClock,
  Activity,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { SyncLog, SyncProgress } from "@/types";

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === 0) return "N/A";
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

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString();
}

function formatNumber(num: number | undefined | null): string {
  if (num == null) return '0';
  return num.toLocaleString();
}

function getStepIcon(stepNumber: number) {
  const iconClass = "h-4 w-4";
  switch (stepNumber) {
    case 1:
      return <Tag className={iconClass} />;
    case 2:
      return <Layers className={iconClass} />;
    case 3:
      return <Package className={iconClass} />;
    case 4:
      return <List className={iconClass} />;
    case 5:
      return <DollarSign className={iconClass} />;
    case 6:
      return <BarChart3 className={iconClass} />;
    case 7:
      return <ArrowRightLeft className={iconClass} />;
    default:
      return <Database className={iconClass} />;
  }
}

function getStepStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return (
        <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20">
          <CheckCircle2 className="h-3 w-3" />
          Completed
        </Badge>
      );
    case "running":
      return (
        <Badge className="bg-blue-500/15 text-blue-500 border-blue-500/20 hover:bg-blue-500/20">
          <Loader2 className="h-3 w-3 animate-spin" />
          Running
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive" className="bg-red-500/15 text-red-500 border-red-500/20">
          <XCircle className="h-3 w-3" />
          Failed
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="bg-muted/50 text-muted-foreground border-muted">
          <Clock className="h-3 w-3" />
          Pending
        </Badge>
      );
  }
}

export default function SyncPage() {
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limit] = useState(10);
  const [offset, setOffset] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  const fetchData = useCallback(async () => {
    try {
      const [progressResponse, logsResponse] = await Promise.all([
        api.getSyncProgress(),
        api.getSyncLogs(limit, offset),
      ]);

      setSyncProgress(progressResponse);
      setSyncLogs(logsResponse.data);
      setTotal(logsResponse.total);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error("Failed to fetch sync data:", err);
      setError("Failed to load sync data. Make sure the Go backend API is running.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [limit, offset]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh when sync is running
  useEffect(() => {
    // Clear any existing interval first to prevent memory leaks
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (autoRefresh && syncProgress?.isRunning) {
      intervalRef.current = setInterval(() => {
        fetchData();
      }, 1000);
    } else if (autoRefresh && !syncProgress?.isRunning) {
      intervalRef.current = setInterval(() => {
        fetchData();
      }, 30000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, syncProgress?.isRunning, fetchData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
  };

  const handlePageChange = (newPage: number) => {
    setOffset((newPage - 1) * limit);
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sync Status</h1>
          <p className="text-muted-foreground mt-1">
            Real-time synchronization progress and history
          </p>
        </div>
        <SyncPageSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sync Status</h1>
          <p className="text-muted-foreground mt-1">
            Real-time synchronization progress and history
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="transition-all duration-200 hover:bg-accent"
          >
            {autoRefresh ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Pause
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Resume
              </>
            )}
          </Button>
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="transition-all duration-200"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Last Updated Indicator */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <div className={`h-2 w-2 rounded-full ${autoRefresh ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`} />
        <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
        {syncProgress?.isRunning && autoRefresh && (
          <Badge variant="secondary" className="ml-2 text-xs">
            <Activity className="h-3 w-3 mr-1" />
            Live
          </Badge>
        )}
      </div>

      {/* Current Sync Status */}
      {syncProgress && (
        <>
          {/* Status Banner */}
          <Card className={`overflow-hidden transition-all duration-300 ${
            syncProgress.isRunning
              ? "border-blue-500/50 bg-gradient-to-br from-blue-500/5 to-blue-600/10 shadow-lg shadow-blue-500/5"
              : syncProgress.currentStep === 7
                ? "border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-emerald-600/10"
                : ""
          }`}>
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  {syncProgress.isRunning ? (
                    <div className="relative">
                      <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" />
                      <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10 ring-2 ring-blue-500/20">
                        <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                      </div>
                    </div>
                  ) : syncProgress.currentStep === 7 ? (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 ring-2 ring-emerald-500/20">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    </div>
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted ring-2 ring-muted-foreground/10">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <CardTitle className="text-xl">
                      {syncProgress.isRunning
                        ? "Sync in Progress"
                        : syncProgress.currentStep === 7
                          ? "Last Sync Completed"
                          : "No Active Sync"}
                    </CardTitle>
                    {syncProgress.isRunning && (
                      <CardDescription className="mt-0.5">
                        Processing step {syncProgress.currentStep} of {syncProgress.totalSteps}
                      </CardDescription>
                    )}
                  </div>
                </div>
                {syncProgress.isRunning && (
                  <Badge
                    variant="outline"
                    className="text-blue-500 border-blue-500/30 bg-blue-500/10 font-medium px-3 py-1"
                  >
                    <Zap className="h-3.5 w-3.5 mr-1.5" />
                    Step {syncProgress.currentStep}/{syncProgress.totalSteps}
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Progress Bar for Running State */}
              {syncProgress.isRunning && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Overall Progress</span>
                    <span className="font-medium">
                      {Math.round((syncProgress.currentStep / syncProgress.totalSteps) * 100)}%
                    </span>
                  </div>
                  <div className="relative">
                    <Progress
                      value={(syncProgress.currentStep / syncProgress.totalSteps) * 100}
                      className="h-2.5 bg-blue-500/10"
                    />
                    <div
                      className="absolute top-0 left-0 h-2.5 rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500 ease-out"
                      style={{ width: `${(syncProgress.currentStep / syncProgress.totalSteps) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Time Statistics Grid */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="flex items-center gap-3 p-4 rounded-lg bg-card/50 border border-border/50">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                    <Timer className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Elapsed</p>
                    <p className="text-lg font-semibold tabular-nums">
                      {formatDuration(syncProgress.elapsedSeconds)}
                    </p>
                  </div>
                </div>

                {syncProgress.estimatedRemainingSeconds && syncProgress.estimatedRemainingSeconds > 0 && (
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-card/50 border border-border/50">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Remaining</p>
                      <p className="text-lg font-semibold tabular-nums">
                        {formatDuration(syncProgress.estimatedRemainingSeconds)}
                      </p>
                    </div>
                  </div>
                )}

                {syncProgress.startedAt && (
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-card/50 border border-border/50">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                      <CalendarClock className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Started</p>
                      <p className="text-sm font-medium">
                        {formatDate(syncProgress.startedAt)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Step Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-muted-foreground" />
                Sync Steps
              </CardTitle>
              <CardDescription>
                Detailed progress for each synchronization step
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {syncProgress.steps.map((step, index) => (
                  <div
                    key={step.number}
                    className={`group rounded-lg border p-4 transition-all duration-200 ${
                      step.status === "running"
                        ? "border-blue-500/30 bg-blue-500/5 shadow-sm"
                        : step.status === "completed"
                          ? "border-emerald-500/20 bg-emerald-500/5"
                          : step.status === "failed"
                            ? "border-red-500/20 bg-red-500/5"
                            : "border-border/50 bg-card/30 hover:bg-card/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors ${
                          step.status === "completed"
                            ? "bg-emerald-500/10 text-emerald-500"
                            : step.status === "running"
                              ? "bg-blue-500/10 text-blue-500"
                              : step.status === "failed"
                                ? "bg-red-500/10 text-red-500"
                                : "bg-muted text-muted-foreground"
                        }`}>
                          {step.status === "running" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : step.status === "completed" ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            getStepIcon(step.number)
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">
                            {step.name}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {step.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        {step.extracted > 0 && (
                          <span className="text-sm font-mono text-muted-foreground hidden sm:block">
                            {formatNumber(step.extracted)} extracted
                          </span>
                        )}
                        {getStepStatusBadge(step.status)}
                      </div>
                    </div>

                    {/* Change Deltas */}
                    {(step.status === "running" || step.status === "completed") && step.extracted > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/30">
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-muted-foreground">
                            {formatNumber(step.extracted)} items processed
                          </span>
                          {(step.inserted > 0 || step.updated > 0) && (
                            <span className="flex items-center gap-2">
                              {step.inserted > 0 && (
                                <span className="text-emerald-500">
                                  +{formatNumber(step.inserted)} added
                                </span>
                              )}
                              {step.updated > 0 && (
                                <span className="text-blue-500">
                                  {formatNumber(step.updated)} updated
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Sync Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
                Sync Statistics
              </CardTitle>
              <CardDescription>
                Items synchronized with change breakdown
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                {[
                  {
                    icon: Tag,
                    value: syncProgress.brandsSynced,
                    label: "Brands",
                    inserted: syncProgress.brandsInserted,
                    updated: syncProgress.brandsUpdated
                  },
                  {
                    icon: Layers,
                    value: syncProgress.categoriesSynced,
                    label: "Categories",
                    inserted: syncProgress.categoriesInserted,
                    updated: syncProgress.categoriesUpdated
                  },
                  {
                    icon: Package,
                    value: syncProgress.productsSynced,
                    label: "Products",
                    inserted: syncProgress.productsInserted,
                    updated: syncProgress.productsUpdated
                  },
                  {
                    icon: List,
                    value: syncProgress.propertiesSynced,
                    label: "Properties",
                    inserted: syncProgress.propertiesInserted,
                    updated: syncProgress.propertiesUpdated
                  },
                ].map(({ icon: Icon, value, label, inserted, updated }) => (
                  <div
                    key={label}
                    className="flex flex-col p-4 rounded-lg bg-muted/30 border border-border/30 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <p className="text-xl font-bold tabular-nums">{formatNumber(value)}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">{label}</p>
                    {(inserted > 0 || updated > 0) && (
                      <div className="flex gap-2 text-xs mt-1">
                        {inserted > 0 && (
                          <span className="text-emerald-500">+{formatNumber(inserted)}</span>
                        )}
                        {updated > 0 && (
                          <span className="text-blue-500">{formatNumber(updated)} upd</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Database Totals */}
              <div className="mt-6 pt-6 border-t border-border/50">
                <h4 className="text-sm font-medium text-muted-foreground mb-4">Database Totals</h4>
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                  {[
                    { label: "Brands", value: syncProgress.dbTotals.brands },
                    { label: "Categories", value: syncProgress.dbTotals.categories },
                    { label: "Products", value: syncProgress.dbTotals.products },
                    { label: "Variants", value: syncProgress.dbTotals.characteristics },
                    { label: "Properties", value: syncProgress.dbTotals.properties },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="flex items-center justify-between p-3 rounded-md bg-muted/20 border border-border/20"
                    >
                      <span className="text-sm text-muted-foreground">{label}</span>
                      <span className="font-mono font-medium">{formatNumber(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Sync History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            Sync History
          </CardTitle>
          <CardDescription>
            Previous synchronization runs and their results
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mb-4">
                <XCircle className="h-6 w-6 text-destructive" />
              </div>
              <p className="text-muted-foreground text-center max-w-md">{error}</p>
            </div>
          ) : syncLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
                <RefreshCw className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">No sync logs found</p>
            </div>
          ) : (
            <>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="font-semibold">Type</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="text-right font-semibold">Brands</TableHead>
                      <TableHead className="text-right font-semibold">Categories</TableHead>
                      <TableHead className="text-right font-semibold">Products</TableHead>
                      <TableHead className="text-right font-semibold">Properties</TableHead>
                      <TableHead className="text-right font-semibold">Duration</TableHead>
                      <TableHead className="font-semibold">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {syncLogs.map((log, index) => (
                      <TableRow
                        key={log.id}
                        className="transition-colors hover:bg-muted/20"
                      >
                        <TableCell className="font-medium">{log.sync_type}</TableCell>
                        <TableCell>
                          <Badge
                            className={`${
                              log.status === "completed"
                                ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/20"
                                : log.status === "running"
                                  ? "bg-blue-500/15 text-blue-500 border-blue-500/20"
                                  : "bg-red-500/15 text-red-500 border-red-500/20"
                            }`}
                          >
                            {log.status === "completed" ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : log.status === "running" ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <XCircle className="h-3 w-3" />
                            )}
                            {log.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatNumber(log.brands_synced)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatNumber(log.categories_synced)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatNumber(log.products_synced)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatNumber(log.properties_synced)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="inline-flex items-center gap-1.5 text-sm">
                            <Timer className="h-3 w-3 text-muted-foreground" />
                            {formatDuration(log.duration_seconds)}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(log.started_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mt-4 pt-4 border-t border-border/50">
                  <p className="text-sm text-muted-foreground">
                    Showing {offset + 1} to {Math.min(offset + limit, total)} of {total} logs
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="transition-all duration-200"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span className="hidden sm:inline ml-1">Previous</span>
                    </Button>
                    <span className="text-sm px-2">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="transition-all duration-200"
                    >
                      <span className="hidden sm:inline mr-1">Next</span>
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
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-muted-foreground" />
            Sync Commands
          </CardTitle>
          <CardDescription>
            Terminal commands to manage synchronization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            {
              command: "go run cmd/sync/main.go",
              description: "Run the full sync process (all 7 steps)",
            },
            {
              command: "make status",
              description: "Check last sync runs",
            },
            {
              command: "make stats",
              description: "View database statistics",
            },
          ].map(({ command, description }) => (
            <div key={command} className="space-y-1.5">
              <code className="block rounded-lg bg-muted/50 border border-border/50 px-4 py-3 text-sm font-mono">
                {command}
              </code>
              <p className="text-xs text-muted-foreground pl-1">
                {description}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function SyncPageSkeleton() {
  return (
    <div className="space-y-8">
      {/* Status Banner Skeleton */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div>
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-4 rounded-lg border">
                <Skeleton className="h-9 w-9 rounded-md" />
                <div>
                  <Skeleton className="h-3 w-16 mb-2" />
                  <Skeleton className="h-5 w-20" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Steps Skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div>
                      <Skeleton className="h-5 w-32 mb-2" />
                      <Skeleton className="h-4 w-48" />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-6 w-24 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* History Skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full rounded-lg" />
        </CardContent>
      </Card>
    </div>
  );
}
