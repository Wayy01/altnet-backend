"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
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
  ExternalLink,
  MoreVertical,
  AlertTriangle,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
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
        <Badge className="bg-primary/15 text-primary border-primary/20 hover:bg-primary/20">
          <CheckCircle2 className="h-3 w-3" />
          Completed
        </Badge>
      );
    case "running":
      return (
        <Badge className="bg-accent text-accent-foreground border-accent hover:bg-accent">
          <Loader2 className="h-3 w-3 animate-spin" />
          Running
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive" className="bg-destructive/15 text-destructive border-destructive/20">
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
  const [selectedSync, setSelectedSync] = useState<SyncLog | null>(null);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [newStatus, setNewStatus] = useState<"failed" | "cancelled" | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  // Helper function to calculate relative step numbers for selective sync
  const getRelativeStepInfo = useCallback((syncProgress: SyncProgress | null) => {
    if (!syncProgress) return { currentRelative: 0, totalRelative: 7 };

    const selectedSteps = syncProgress.selectedSteps;

    // If no selected steps or full sync, use absolute numbers
    if (!selectedSteps || selectedSteps.length === 0 || selectedSteps.length === 7) {
      return {
        currentRelative: syncProgress.currentStep,
        totalRelative: 7
      };
    }

    // Map step names to their absolute numbers
    const stepNameToNumber: Record<string, number> = {
      'brands': 1,
      'categories': 2,
      'products': 3,
      'properties': 4,
      'prices': 5,
      'stock': 6,
      'exchange_rates': 7
    };

    // Get sorted absolute step numbers for selected steps
    const selectedStepNumbers = selectedSteps
      .map(name => stepNameToNumber[name.toLowerCase()] || 0)
      .filter(num => num > 0)
      .sort((a, b) => a - b);

    // Find relative position of current step
    const currentAbsolute = syncProgress.currentStep;
    const relativePosition = selectedStepNumbers.findIndex(num => num === currentAbsolute);

    // If current step is in selected steps, return its 1-based position
    // Otherwise, find the next step or assume we're past all selected steps
    if (relativePosition >= 0) {
      return {
        currentRelative: relativePosition + 1,
        totalRelative: selectedStepNumbers.length
      };
    }

    // If current step is less than first selected step, we're at step 1
    if (currentAbsolute < selectedStepNumbers[0]) {
      return {
        currentRelative: 1,
        totalRelative: selectedStepNumbers.length
      };
    }

    // If current step is greater than last selected step, we're done
    if (currentAbsolute > selectedStepNumbers[selectedStepNumbers.length - 1]) {
      return {
        currentRelative: selectedStepNumbers.length,
        totalRelative: selectedStepNumbers.length
      };
    }

    // Otherwise, find which selected step we're closest to
    for (let i = 0; i < selectedStepNumbers.length; i++) {
      if (currentAbsolute <= selectedStepNumbers[i]) {
        return {
          currentRelative: i + 1,
          totalRelative: selectedStepNumbers.length
        };
      }
    }

    return {
      currentRelative: selectedStepNumbers.length,
      totalRelative: selectedStepNumbers.length
    };
  }, []);

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

  const handleStatusChange = (log: SyncLog, status: "failed" | "cancelled") => {
    setSelectedSync(log);
    setNewStatus(status);
    setShowStatusDialog(true);
  };

  const confirmStatusUpdate = async () => {
    if (!selectedSync || !newStatus) return;

    setIsUpdatingStatus(true);
    try {
      const result = await api.updateSyncStatus(
        selectedSync.id,
        newStatus,
        `Manually marked as ${newStatus} from UI`
      );

      toast({
        title: "Sync Status Updated",
        description: `Sync status changed from "${result.old_status}" to "${result.new_status}"`,
        variant: "default",
      });

      // Refresh sync logs
      await fetchData();

      setShowStatusDialog(false);
      setSelectedSync(null);
      setNewStatus(null);
    } catch (error) {
      console.error("Failed to update sync status:", error);
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update sync status",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingStatus(false);
    }
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
            asChild
          >
            <Link href="/sync/monitor">
              <Activity className="h-4 w-4 mr-2" />
              Real-Time Monitor
            </Link>
          </Button>
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
        <div className={`h-2 w-2 rounded-full ${autoRefresh ? "bg-primary animate-pulse" : "bg-muted-foreground"}`} />
        <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
        {syncProgress?.isRunning && autoRefresh && (
          <Badge variant="secondary" className="ml-2 text-xs">
            <Activity className="h-3 w-3 mr-1" />
            Live
          </Badge>
        )}
      </div>

      {/* Current Sync Status */}
      {syncProgress && (() => {
        const { currentRelative, totalRelative } = getRelativeStepInfo(syncProgress);
        const progressPercentage = totalRelative > 0 ? Math.round((currentRelative / totalRelative) * 100) : 0;

        return (
          <>
            {/* Status Banner */}
            <Card className={`overflow-hidden transition-all duration-300 ${
              syncProgress.isRunning
                ? "border-primary/50 bg-gradient-to-br from-primary/5 to-primary/10 shadow-lg shadow-primary/5"
                : syncProgress.currentStep === 7
                  ? "border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10"
                  : ""
            }`}>
              <CardHeader className="pb-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    {syncProgress.isRunning ? (
                      <div className="relative">
                        <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                        <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 ring-2 ring-primary/20">
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        </div>
                      </div>
                    ) : syncProgress.currentStep === 7 ? (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 ring-2 ring-primary/20">
                        <CheckCircle2 className="h-5 w-5 text-primary" />
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
                          Processing step {currentRelative} of {totalRelative}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                  {syncProgress.isRunning && (
                    <Badge
                      variant="outline"
                      className="text-primary border-primary/30 bg-primary/10 font-medium px-3 py-1"
                    >
                      <Zap className="h-3.5 w-3.5 mr-1.5" />
                      Step {currentRelative}/{totalRelative}
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
                      {progressPercentage}%
                    </span>
                  </div>
                  <div className="relative">
                    <Progress
                      value={progressPercentage}
                      className="h-2.5 bg-primary/10"
                    />
                    <div
                      className="absolute top-0 left-0 h-2.5 rounded-full bg-gradient-to-r from-primary to-primary transition-all duration-500 ease-out"
                      style={{ width: `${progressPercentage}%` }}
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

          {/* Last Sync Completed - Compact View (when no sync running) */}
          {!syncProgress.isRunning && syncLogs.length > 0 && (
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 ring-2 ring-primary/20 shrink-0">
                      <CheckCircle2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Last Sync Completed</p>
                      <p className="text-lg font-semibold">{formatDate(syncLogs[0].started_at)}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {syncLogs[0].sync_type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDuration(syncLogs[0].duration_seconds)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button asChild>
                    <Link href={`/sync/changes?log=${syncLogs[0].id}`} className="shrink-0">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View Details
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step Progress - Only show when sync is running */}
          {syncProgress.isRunning && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-muted-foreground" />
                  Sync Steps
                  {syncProgress.selectedSteps && syncProgress.selectedSteps.length > 0 && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      Selective: {syncProgress.selectedSteps.length} steps
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Detailed progress for each synchronization step
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {syncProgress.steps
                    .filter((step) => {
                      // For selective sync, only show selected steps
                      if (syncProgress.selectedSteps && syncProgress.selectedSteps.length > 0) {
                        return syncProgress.selectedSteps.includes(step.name.toLowerCase());
                      }
                      // For full sync or no selectedSteps, show all steps
                      return true;
                    })
                    .map((step, index) => {
                      // Calculate step-specific progress for running steps
                      const stepProgress = step.total > 0 ? (step.count / step.total) * 100 : 0;
                      const isRunning = step.status === "running";

                      return (
                        <div
                          key={step.number}
                          className={`group rounded-lg border p-4 transition-all duration-200 ${
                            step.status === "running"
                              ? "border-primary/30 bg-primary/5 shadow-sm"
                              : step.status === "completed"
                                ? "border-primary/20 bg-primary/5"
                                : step.status === "failed"
                                  ? "border-destructive/20 bg-destructive/5"
                                  : "border-border/50 bg-card/30 hover:bg-card/50"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors ${
                                step.status === "completed"
                                  ? "bg-primary/10 text-primary"
                                  : step.status === "running"
                                    ? "bg-primary/10 text-primary"
                                    : step.status === "failed"
                                      ? "bg-destructive/10 text-destructive"
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
                              <div className="min-w-0 flex-1">
                                <p className="font-medium truncate">
                                  {step.name}
                                </p>
                                <p className="text-sm text-muted-foreground truncate">
                                  {step.description}
                                </p>
                                {/* Real-time status for running steps */}
                                {isRunning && step.total > 0 && (
                                  <div className="mt-1.5">
                                    <div className="flex items-center gap-2 text-xs text-primary">
                                      <span className="font-medium">
                                        {formatNumber(step.count)} / {formatNumber(step.total)} items
                                      </span>
                                      <span className="text-muted-foreground">
                                        ({Math.round(stepProgress)}%)
                                      </span>
                                    </div>
                                    <Progress
                                      value={stepProgress}
                                      className="h-1.5 mt-1.5 bg-primary/10"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-4 shrink-0">
                              {step.extracted > 0 && !isRunning && (
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
                                      <span className="text-primary">
                                        +{formatNumber(step.inserted)} added
                                      </span>
                                    )}
                                    {step.updated > 0 && (
                                      <span className="text-primary">
                                        {formatNumber(step.updated)} updated
                                      </span>
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Elapsed time for running/completed steps */}
                          {(step.status === "running" || step.status === "completed") && (step.startedAt || step.completedAt) && (
                            <div className="mt-2 pt-2 border-t border-border/30">
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                {step.startedAt && (
                                  <span className="flex items-center gap-1">
                                    <CalendarClock className="h-3 w-3" />
                                    Started: {new Date(step.startedAt).toLocaleTimeString()}
                                  </span>
                                )}
                                {step.completedAt && (
                                  <span className="flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3" />
                                    Completed: {new Date(step.completedAt).toLocaleTimeString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          )}

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
                          <span className="text-primary">+{formatNumber(inserted)}</span>
                        )}
                        {updated > 0 && (
                          <span className="text-primary">{formatNumber(updated)} upd</span>
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
        );
      })()}

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
                      <TableHead className="w-[50px]"></TableHead>
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
                                ? "bg-primary/15 text-primary border-primary/20"
                                : log.status === "running"
                                  ? "bg-primary/15 text-primary border-primary/20"
                                  : "bg-destructive/15 text-destructive border-destructive/20"
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
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleStatusChange(log, "failed")}
                                className="text-destructive focus:text-destructive"
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Mark as Failed
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleStatusChange(log, "cancelled")}
                                className="text-muted-foreground"
                              >
                                <AlertTriangle className="h-4 w-4 mr-2" />
                                Mark as Cancelled
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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

      {/* Status Update Confirmation Dialog */}
      <AlertDialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update Sync Status?</AlertDialogTitle>
            <AlertDialogDescription>
              {newStatus === "failed" ? (
                <>This will mark the sync as <strong>failed</strong>. Use this for syncs that are stuck or didn't complete properly.</>
              ) : (
                <>This will mark the sync as <strong>cancelled</strong>. Use this for syncs that were manually stopped.</>
              )}
              {selectedSync && (
                <div className="mt-3 p-3 rounded-lg bg-muted/50 border">
                  <p className="text-sm font-medium text-foreground">Sync Details:</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    ID: {selectedSync.id.slice(0, 8)}...
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Type: {selectedSync.sync_type}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Current Status: {selectedSync.status}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Started: {formatDate(selectedSync.started_at)}
                  </p>
                </div>
              )}
              <p className="mt-3 text-sm text-yellow-600 dark:text-yellow-500 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>This action cannot be undone. The sync will be permanently marked as {newStatus}.</span>
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmStatusUpdate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isUpdatingStatus}
            >
              {isUpdatingStatus ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  {newStatus === "failed" ? <XCircle className="h-4 w-4 mr-2" /> : <AlertTriangle className="h-4 w-4 mr-2" />}
                  Yes, Mark as {newStatus && newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
