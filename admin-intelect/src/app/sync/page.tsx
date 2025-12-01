"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import {
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
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
  Settings,
  FileText,
  TrendingUp,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  GitMerge,
  Calendar,
  Bell,
  Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useTranslation } from "@/contexts/language-context";

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
        <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Completed
        </Badge>
      );
    case "running":
      return (
        <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/20 gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Running
        </Badge>
      );
    case "failed":
      return (
        <Badge className="bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20 gap-1">
          <XCircle className="h-3 w-3" />
          Failed
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="bg-muted/50 text-muted-foreground border-muted gap-1">
          <Clock className="h-3 w-3" />
          Pending
        </Badge>
      );
  }
}

/**
 * Sort direction type
 */
type SortDirection = "asc" | "desc";
type SortField = "date" | "duration" | "status" | "type";

export default function SyncPage() {
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const [offset, setOffset] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [selectedSync, setSelectedSync] = useState<SyncLog | null>(null);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [newStatus, setNewStatus] = useState<"failed" | "cancelled" | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [jumpToPage, setJumpToPage] = useState("");
  const [unresolvedConflictsCount, setUnresolvedConflictsCount] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  const { t } = useTranslation('sync');
  const { t: tCommon } = useTranslation('common');

  // Animation states
  const [contentVisible, setContentVisible] = useState(false);
  const [rowsVisible, setRowsVisible] = useState(false);

  // Sort state
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const currentPage = Math.floor(offset / pageSize) + 1;
  const totalPages = Math.ceil(total / pageSize);

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
      const [progressResponse, logsResponse, conflictsCount] = await Promise.all([
        api.getSyncProgress(),
        api.getSyncLogs(pageSize, offset),
        api.getUnresolvedConflictsCount().catch(() => 0),
      ]);

      setSyncProgress(progressResponse);
      setSyncLogs(logsResponse.data);
      setTotal(logsResponse.total);
      setUnresolvedConflictsCount(conflictsCount);
      setLastUpdated(new Date());
      setError(null);

      // Trigger animations
      setTimeout(() => setContentVisible(true), 50);
      setTimeout(() => setRowsVisible(true), 150);
    } catch (err) {
      console.error("Failed to fetch sync data:", err);
      setError("Failed to load sync data. Make sure the Go backend API is running.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [pageSize, offset]);

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
    setRowsVisible(false);
    await fetchData();
  };

  const handlePageChange = (newPage: number) => {
    setRowsVisible(false);
    setOffset((newPage - 1) * pageSize);
  };

  const handlePageSizeChange = (newSize: string) => {
    const size = parseInt(newSize, 10);
    setPageSize(size);
    setOffset(0);
    setRowsVisible(false);
  };

  const handleJumpToPage = () => {
    const pageNum = parseInt(jumpToPage, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      handlePageChange(pageNum);
      setJumpToPage("");
    }
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

  // Sort column handler
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  }, [sortField]);

  // Sorted logs
  const sortedLogs = useMemo(() => {
    return [...syncLogs].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "date":
          comparison = new Date(a.started_at).getTime() - new Date(b.started_at).getTime();
          break;
        case "duration":
          comparison = (a.duration_seconds ?? 0) - (b.duration_seconds ?? 0);
          break;
        case "status":
          comparison = a.status.localeCompare(b.status);
          break;
        case "type":
          comparison = a.sync_type.localeCompare(b.sync_type);
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [syncLogs, sortField, sortDirection]);

  // Stats indicators
  const statsIndicators = useMemo(() => {
    const completedCount = syncLogs.filter(l => l.status === "completed").length;
    const failedCount = syncLogs.filter(l => l.status === "failed" || l.status === "cancelled").length;
    const avgDuration = syncLogs.length > 0
      ? Math.round(syncLogs.reduce((sum, l) => sum + (l.duration_seconds ?? 0), 0) / syncLogs.length)
      : 0;

    return [
      {
        label: "Total Syncs",
        value: (total ?? 0).toLocaleString(),
        icon: <RefreshCw className="h-3.5 w-3.5" />,
        variant: "default" as const,
      },
      {
        label: "Completed",
        value: completedCount,
        suffix: "on page",
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
        variant: completedCount > 0 ? "success" as const : "muted" as const,
      },
      {
        label: "Failed",
        value: failedCount,
        suffix: "on page",
        icon: <XCircle className="h-3.5 w-3.5" />,
        variant: failedCount > 0 ? "warning" as const : "muted" as const,
      },
      {
        label: "Avg Duration",
        value: formatDuration(avgDuration),
        icon: <Timer className="h-3.5 w-3.5" />,
        variant: "muted" as const,
      },
    ];
  }, [syncLogs, total]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('page.title')}</h1>
          <p className="text-muted-foreground">
            {t('page.description')}
          </p>
        </div>
        <SyncPageSkeleton />
      </div>
    );
  }

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
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('page.title')}</h1>
          <p className="text-muted-foreground">
            {t('page.description')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            asChild
            className="transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
          >
            <Link href="/sync/selective">
              <Zap className="h-4 w-4 mr-2" />
              {t('actions.selectiveSync')}
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            asChild
            className="transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
          >
            <Link href="/sync/monitor">
              <Activity className="h-4 w-4 mr-2" />
              {t('actions.realTimeMonitor')}
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            asChild
            className="transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
          >
            <Link href="/sync/rollbacks">
              <RotateCcw className="h-4 w-4 mr-2" />
              {t('actions.rollbacks')}
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            asChild
            className={`transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5 ${
              unresolvedConflictsCount > 0 ? "border-destructive/30 bg-destructive/5 hover:bg-destructive/10" : ""
            }`}
          >
            <Link href="/sync/conflicts">
              <GitMerge className="h-4 w-4 mr-2" />
              {t('actions.conflicts')}
              {unresolvedConflictsCount > 0 && (
                <Badge variant="destructive" className="ml-1.5 px-1.5 py-0 text-[10px] h-5 min-w-5 flex items-center justify-center">
                  {unresolvedConflictsCount}
                </Badge>
              )}
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            asChild
            className="transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
          >
            <Link href="/sync/schedules">
              <Calendar className="h-4 w-4 mr-2" />
              {t('actions.schedules')}
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            asChild
            className="transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
          >
            <Link href="/sync/notifications">
              <Bell className="h-4 w-4 mr-2" />
              {t('actions.notifications')}
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            asChild
            className="transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
          >
            <Link href="/sync/analytics">
              <TrendingUp className="h-4 w-4 mr-2" />
              {t('actions.analytics')}
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            asChild
            className="transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
          >
            <Link href="/sync/filters">
              <Filter className="h-4 w-4 mr-2" />
              {t('actions.filters')}
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5 ${
              autoRefresh ? "bg-primary/10 border-primary/30" : ""
            }`}
          >
            {autoRefresh ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                {t('actions.pause')}
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                {t('actions.resume')}
              </>
            )}
          </Button>
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
          >
            <RefreshCw className={`mr-2 h-4 w-4 transition-transform duration-500 ${isRefreshing ? "animate-spin" : ""}`} />
            {t('actions.refresh')}
          </Button>
        </div>
      </div>

      {/* Last Updated Indicator */}
      <div
        className={`
          flex items-center gap-2 text-sm text-muted-foreground
          transition-all duration-300 ease-out
          ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
        `}
        style={{ transitionDelay: "50ms" }}
      >
        <div className={`h-2 w-2 rounded-full transition-all duration-300 ${autoRefresh ? "bg-primary animate-pulse shadow-lg shadow-primary/50" : "bg-muted-foreground"}`} />
        <span className="font-medium">{t('lastUpdated')}: {lastUpdated.toLocaleTimeString()}</span>
        {syncProgress?.isRunning && autoRefresh && (
          <Badge variant="secondary" className="ml-2 text-xs bg-primary/10 text-primary border-primary/20 animate-in fade-in slide-in-from-left-2 duration-300">
            <Activity className="h-3 w-3 mr-1" />
            {t('status.live')}
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
            <div
              className={`
                transition-all duration-300 ease-out
                ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
              `}
              style={{ transitionDelay: "100ms" }}
            >
              <Card className={`rounded-xl border bg-card shadow-sm overflow-hidden transition-all duration-500 ${
                syncProgress.isRunning
                  ? "border-blue-500/30 bg-gradient-to-br from-blue-500/5 to-blue-500/10 shadow-lg shadow-blue-500/10"
                  : syncProgress.currentStep === 7
                    ? "border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10"
                    : ""
              }`}>
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      {syncProgress.isRunning ? (
                        <div className="relative">
                          <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" />
                          <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10 ring-2 ring-blue-500/30 shadow-lg shadow-blue-500/20">
                            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                          </div>
                        </div>
                      ) : syncLogs.length > 0 ? (
                        syncLogs[0].status === "completed" ? (
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 ring-2 ring-primary/30 shadow-md shadow-primary/10 transition-all duration-300 hover:scale-105">
                            <CheckCircle2 className="h-6 w-6 text-primary" />
                          </div>
                        ) : syncLogs[0].status === "failed" ? (
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 ring-2 ring-destructive/30 shadow-md shadow-destructive/10 transition-all duration-300 hover:scale-105">
                            <XCircle className="h-6 w-6 text-destructive" />
                          </div>
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-500/10 ring-2 ring-yellow-500/30 shadow-md shadow-yellow-500/10 transition-all duration-300 hover:scale-105">
                            <AlertTriangle className="h-6 w-6 text-yellow-600" />
                          </div>
                        )
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted ring-2 ring-muted-foreground/10">
                          <Clock className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <CardTitle className="text-xl font-bold">
                          {syncProgress.isRunning
                            ? t('status.syncInProgress')
                            : syncLogs.length > 0
                              ? syncLogs[0].status === "completed"
                                ? t('status.lastSyncCompleted')
                                : syncLogs[0].status === "failed"
                                  ? t('status.lastSyncFailed')
                                  : syncLogs[0].status === "cancelled"
                                    ? t('status.lastSyncCancelled')
                                    : t('status.noActiveSync')
                              : t('status.noActiveSync')}
                        </CardTitle>
                        {syncProgress.isRunning && (
                          <CardDescription className="mt-0.5 text-sm">
                            {t('progress.processingStep')} {currentRelative} {t('progress.of')} {totalRelative}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                    {syncProgress.isRunning && (
                      <Badge
                        variant="outline"
                        className="text-blue-600 border-blue-500/30 bg-blue-500/10 font-semibold px-3 py-1.5 shadow-sm animate-in fade-in slide-in-from-right-2 duration-300"
                      >
                        <Zap className="h-3.5 w-3.5 mr-1.5" />
                        Step {currentRelative}/{totalRelative}
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-5">
                  {/* Progress Bar for Running State */}
                  {syncProgress.isRunning && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground font-medium">{t('progress.overallProgress')}</span>
                        <span className="font-semibold tabular-nums text-blue-600">
                          {progressPercentage}%
                        </span>
                      </div>
                      <div className="relative">
                        <Progress
                          value={progressPercentage}
                          className="h-2.5 bg-blue-500/10 shadow-inner"
                        />
                      </div>
                    </div>
                  )}

                  {/* Time Statistics Grid */}
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="group flex items-center gap-3 p-4 rounded-xl bg-card border border-border/50 transition-all duration-200 hover:shadow-md hover:border-border hover:-translate-y-0.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted transition-colors group-hover:bg-muted/80">
                        <Timer className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('progress.elapsed')}</p>
                        <p className="text-lg font-bold tabular-nums truncate">
                          {formatDuration(syncProgress.elapsedSeconds)}
                        </p>
                      </div>
                    </div>

                    {syncProgress.estimatedRemainingSeconds && syncProgress.estimatedRemainingSeconds > 0 && (
                      <div className="group flex items-center gap-3 p-4 rounded-xl bg-card border border-border/50 transition-all duration-200 hover:shadow-md hover:border-border hover:-translate-y-0.5 animate-in fade-in slide-in-from-left-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted transition-colors group-hover:bg-muted/80">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('progress.remaining')}</p>
                          <p className="text-lg font-bold tabular-nums truncate">
                            {formatDuration(syncProgress.estimatedRemainingSeconds)}
                          </p>
                        </div>
                      </div>
                    )}

                    {syncProgress.startedAt && (
                      <div className="group flex items-center gap-3 p-4 rounded-xl bg-card border border-border/50 transition-all duration-200 hover:shadow-md hover:border-border hover:-translate-y-0.5">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted transition-colors group-hover:bg-muted/80">
                          <CalendarClock className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('progress.started')}</p>
                          <p className="text-sm font-semibold truncate">
                            {formatDate(syncProgress.startedAt)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Last Sync Status - Compact View (when no sync running) */}
            {!syncProgress.isRunning && syncLogs.length > 0 && (
              <div
                className={`
                  transition-all duration-300 ease-out
                  ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
                `}
                style={{ transitionDelay: "150ms" }}
              >
                <Card className={`rounded-xl border shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md ${
                  syncLogs[0].status === "completed"
                    ? "border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10"
                    : syncLogs[0].status === "failed"
                      ? "border-destructive/20 bg-gradient-to-br from-destructive/5 to-destructive/10"
                      : "border-yellow-500/20 bg-gradient-to-br from-yellow-500/5 to-yellow-500/10"
                }`}>
                  <CardContent className="pt-5 pb-5">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className={`
                          flex h-14 w-14 items-center justify-center rounded-full ring-2 shadow-md shrink-0 transition-all duration-300 hover:scale-105
                          ${syncLogs[0].status === "completed"
                            ? "bg-primary/10 ring-primary/20 shadow-primary/10"
                            : syncLogs[0].status === "failed"
                              ? "bg-destructive/10 ring-destructive/20 shadow-destructive/10"
                              : "bg-yellow-500/10 ring-yellow-500/20 shadow-yellow-500/10"
                          }
                        `}>
                          {syncLogs[0].status === "completed" ? (
                            <CheckCircle2 className="h-7 w-7 text-primary" />
                          ) : syncLogs[0].status === "failed" ? (
                            <XCircle className="h-7 w-7 text-destructive" />
                          ) : (
                            <AlertTriangle className="h-7 w-7 text-yellow-600" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">
                            {syncLogs[0].status === "completed"
                              ? "Last Sync Completed"
                              : syncLogs[0].status === "failed"
                                ? "Last Sync Failed"
                                : "Last Sync Cancelled"}
                          </p>
                          <p className="text-lg font-bold">{formatDate(syncLogs[0].started_at)}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <Badge variant="outline" className="text-xs font-medium">
                              {syncLogs[0].sync_type}
                            </Badge>
                            <span className="text-xs text-muted-foreground font-medium tabular-nums">
                              {formatDuration(syncLogs[0].duration_seconds)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button asChild className="shrink-0 transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5">
                        <Link href={`/sync/changes?log=${syncLogs[0].id}`}>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View Details
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Step Progress - Only show when sync is running */}
            {syncProgress.isRunning && (
              <div
                className={`
                  transition-all duration-300 ease-out
                  ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
                `}
                style={{ transitionDelay: "200ms" }}
              >
                <Card className="rounded-xl border bg-card shadow-sm overflow-hidden">
                  <CardHeader className="pb-3 bg-muted/30 border-b">
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                      <div className="p-1.5 rounded-lg bg-background shadow-sm">
                        <Activity className="h-4 w-4 text-muted-foreground" />
                      </div>
                      Sync Steps
                      {syncProgress.selectedSteps && syncProgress.selectedSteps.length > 0 && (
                        <Badge variant="secondary" className="ml-2 text-xs bg-blue-500/10 text-blue-600 border-blue-500/20 animate-in fade-in slide-in-from-left-2">
                          Selective: {syncProgress.selectedSteps.length} steps
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="text-sm">
                      Detailed progress for each synchronization step
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="space-y-3">
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
                              className={`group rounded-xl border p-4 transition-all duration-300 ${
                                step.status === "running"
                                  ? "border-blue-500/30 bg-blue-500/5 shadow-md hover:shadow-lg"
                                  : step.status === "completed"
                                    ? "border-primary/20 bg-primary/5 hover:shadow-sm"
                                    : step.status === "failed"
                                      ? "border-destructive/20 bg-destructive/5"
                                      : "border-border/50 bg-card/30 hover:bg-card/50 hover:border-border"
                              }`}
                              style={{
                                animationDelay: `${index * 50}ms`,
                              }}
                            >
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3.5">
                                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-all duration-200 shadow-sm ${
                                    step.status === "completed"
                                      ? "bg-primary/10 text-primary shadow-primary/20"
                                      : step.status === "running"
                                        ? "bg-blue-500/10 text-blue-600 shadow-blue-500/20"
                                        : step.status === "failed"
                                          ? "bg-destructive/10 text-destructive shadow-destructive/20"
                                          : "bg-muted text-muted-foreground"
                                  }`}>
                                    {step.status === "running" ? (
                                      <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : step.status === "completed" ? (
                                      <CheckCircle2 className="h-5 w-5" />
                                    ) : (
                                      getStepIcon(step.number)
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-semibold truncate">
                                      {step.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                                      {step.description}
                                    </p>
                                    {/* Real-time status for running steps */}
                                    {isRunning && step.total > 0 && (
                                      <div className="mt-2.5">
                                        <div className="flex items-center gap-2 text-xs text-blue-600 font-medium">
                                          <span>
                                            {formatNumber(step.count)} / {formatNumber(step.total)} items
                                          </span>
                                          <span className="text-muted-foreground">
                                            ({Math.round(stepProgress)}%)
                                          </span>
                                        </div>
                                        <Progress
                                          value={stepProgress}
                                          className="h-1.5 mt-1.5 bg-blue-500/10 shadow-inner"
                                        />
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  {step.extracted > 0 && !isRunning && (
                                    <span className="text-sm font-mono text-muted-foreground hidden sm:block tabular-nums">
                                      {formatNumber(step.extracted)} extracted
                                    </span>
                                  )}
                                  {getStepStatusBadge(step.status)}
                                </div>
                              </div>

                              {/* Change Deltas */}
                              {(step.status === "running" || step.status === "completed") && step.extracted > 0 && (
                                <div className="mt-3 pt-3 border-t border-border/30">
                                  <div className="flex items-center gap-4 text-xs font-medium">
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
                                  <div className="flex items-center gap-4 text-xs text-muted-foreground font-medium">
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
              </div>
            )}

            {/* Sync Statistics */}
            <div
              className={`
                transition-all duration-300 ease-out
                ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
              `}
              style={{ transitionDelay: "250ms" }}
            >
              <Card className="rounded-xl border bg-card shadow-sm overflow-hidden">
                <CardHeader className="pb-3 bg-muted/30 border-b">
                  <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                    <div className="p-1.5 rounded-lg bg-background shadow-sm">
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    </div>
                    Sync Statistics
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Items synchronized with change breakdown
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
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
                    ].map(({ icon: Icon, value, label, inserted, updated }, index) => (
                      <div
                        key={label}
                        className="group flex flex-col p-4 rounded-xl bg-muted/30 border border-border/30 transition-all duration-200 hover:bg-muted/50 hover:shadow-md hover:-translate-y-0.5"
                        style={{ animationDelay: `${300 + index * 50}ms` }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="p-1.5 rounded-lg bg-background shadow-sm group-hover:shadow-md transition-shadow">
                            <Icon className="h-4 w-4 text-muted-foreground transition-transform group-hover:scale-110" />
                          </div>
                          <p className="text-2xl font-bold tabular-nums">{formatNumber(value)}</p>
                        </div>
                        <p className="text-xs text-muted-foreground mb-1 font-medium">{label}</p>
                        {(inserted > 0 || updated > 0) && (
                          <div className="flex gap-2 text-xs mt-1 font-medium">
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
                  <div className="mt-5 pt-5 border-t border-border/50">
                    <h4 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Database Totals</h4>
                    <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                      {[
                        { label: "Brands", value: syncProgress.dbTotals.brands },
                        { label: "Categories", value: syncProgress.dbTotals.categories },
                        { label: "Products", value: syncProgress.dbTotals.products },
                        { label: "Variants", value: syncProgress.dbTotals.characteristics },
                        { label: "Properties", value: syncProgress.dbTotals.properties },
                      ].map(({ label, value }, index) => (
                        <div
                          key={label}
                          className="group flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/20 transition-all duration-200 hover:bg-muted/30 hover:shadow-sm"
                          style={{ animationDelay: `${400 + index * 30}ms` }}
                        >
                          <span className="text-xs text-muted-foreground font-medium">{label}</span>
                          <span className="font-mono font-bold text-sm tabular-nums">{formatNumber(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        );
      })()}

      {/* Stats Bar for History */}
      <div
        className={`
          flex flex-wrap items-center gap-3
          transition-all duration-300 ease-out
          ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
        `}
        style={{ transitionDelay: "300ms" }}
      >
        {statsIndicators.map((stat, index) => (
          <div
            key={stat.label}
            className={`
              inline-flex items-center gap-2 px-3 py-2 rounded-lg border
              transition-all duration-200 ease-out
              hover:shadow-sm hover:border-border/80 hover:-translate-y-0.5
              ${stat.variant === "success" ? "bg-primary/5 border-primary/20 hover:bg-primary/10" : ""}
              ${stat.variant === "warning" ? "bg-destructive/5 border-destructive/20 hover:bg-destructive/10" : ""}
              ${stat.variant === "default" || stat.variant === "muted" ? "bg-muted/50" : ""}
            `}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <span className={`
              ${stat.variant === "success" ? "text-primary" : ""}
              ${stat.variant === "warning" ? "text-destructive" : ""}
              ${stat.variant === "default" || stat.variant === "muted" ? "text-muted-foreground" : ""}
            `}>
              {stat.icon}
            </span>
            <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
            <span className="text-sm font-semibold tabular-nums">{stat.value}</span>
            {stat.suffix && (
              <span className="text-[10px] text-muted-foreground">({stat.suffix})</span>
            )}
          </div>
        ))}
      </div>

      {/* Sync History */}
      <div
        className={`
          transition-all duration-300 ease-out
          ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
        `}
        style={{ transitionDelay: "350ms" }}
      >
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="p-6 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-background shadow-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold">Sync History</h3>
                <p className="text-sm text-muted-foreground">Previous synchronization runs and their results</p>
              </div>
            </div>
          </div>

          <div className="p-0">
            {error ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="p-4 rounded-full bg-destructive/10 mb-4">
                  <XCircle className="h-10 w-10 text-destructive/50" />
                </div>
                <p className="text-muted-foreground text-center max-w-md">{error}</p>
                <Button variant="outline" className="mt-4" onClick={handleRefresh}>
                  Try Again
                </Button>
              </div>
            ) : sortedLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="p-4 rounded-full bg-muted/50 mb-4">
                  <RefreshCw className="h-10 w-10 text-muted-foreground/50" />
                </div>
                <p className="font-medium text-foreground">No sync logs found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Run a sync operation to see history here
                </p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead>
                        <button
                          onClick={() => handleSort("type")}
                          className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors group"
                        >
                          Type
                          <span className={`transition-all duration-200 ${sortField === "type" ? "opacity-100" : "opacity-0 group-hover:opacity-50"}`}>
                            {sortField === "type" && sortDirection === "asc" ? (
                              <ArrowUp className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowDown className="h-3.5 w-3.5" />
                            )}
                          </span>
                        </button>
                      </TableHead>
                      <TableHead>
                        <button
                          onClick={() => handleSort("status")}
                          className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors group"
                        >
                          Status
                          <span className={`transition-all duration-200 ${sortField === "status" ? "opacity-100" : "opacity-0 group-hover:opacity-50"}`}>
                            {sortField === "status" && sortDirection === "asc" ? (
                              <ArrowUp className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowDown className="h-3.5 w-3.5" />
                            )}
                          </span>
                        </button>
                      </TableHead>
                      <TableHead className="text-right">Brands</TableHead>
                      <TableHead className="text-right">Categories</TableHead>
                      <TableHead className="text-right">Products</TableHead>
                      <TableHead className="text-right">Properties</TableHead>
                      <TableHead className="text-right">
                        <button
                          onClick={() => handleSort("duration")}
                          className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors group ml-auto"
                        >
                          Duration
                          <span className={`transition-all duration-200 ${sortField === "duration" ? "opacity-100" : "opacity-0 group-hover:opacity-50"}`}>
                            {sortField === "duration" && sortDirection === "asc" ? (
                              <ArrowUp className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowDown className="h-3.5 w-3.5" />
                            )}
                          </span>
                        </button>
                      </TableHead>
                      <TableHead>
                        <button
                          onClick={() => handleSort("date")}
                          className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors group"
                        >
                          Date
                          <span className={`transition-all duration-200 ${sortField === "date" ? "opacity-100" : "opacity-0 group-hover:opacity-50"}`}>
                            {sortField === "date" && sortDirection === "asc" ? (
                              <ArrowUp className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowDown className="h-3.5 w-3.5" />
                            )}
                          </span>
                        </button>
                      </TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedLogs.map((log, index) => (
                      <TableRow
                        key={log.id}
                        className={`
                          transition-all duration-200 hover:bg-muted/50
                          ${rowsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
                        `}
                        style={{
                          transitionDelay: rowsVisible ? `${Math.min(index * 20, 400)}ms` : "0ms",
                        }}
                      >
                        <TableCell className="font-semibold text-sm">{log.sync_type}</TableCell>
                        <TableCell>
                          <Badge
                            className={`transition-all duration-200 gap-1 ${
                              log.status === "completed"
                                ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                                : log.status === "running"
                                  ? "bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/20"
                                  : log.status === "failed"
                                    ? "bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20"
                                    : "bg-yellow-500/10 text-yellow-600 border-yellow-500/20 hover:bg-yellow-500/20"
                            }`}
                          >
                            {log.status === "completed" ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : log.status === "running" ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : log.status === "failed" ? (
                              <XCircle className="h-3 w-3" />
                            ) : (
                              <AlertTriangle className="h-3 w-3" />
                            )}
                            {log.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm tabular-nums">
                          {formatNumber(log.brands_synced)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm tabular-nums">
                          {formatNumber(log.categories_synced)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm tabular-nums">
                          {formatNumber(log.products_synced)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm tabular-nums">
                          {formatNumber(log.properties_synced)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="inline-flex items-center gap-1.5 text-sm tabular-nums">
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
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 transition-all duration-200 hover:bg-muted hover:scale-105"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem asChild className="cursor-pointer">
                                <Link href={`/sync/changes?log=${log.id}`}>
                                  <FileText className="h-4 w-4 mr-2" />
                                  View Changes
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleStatusChange(log, "failed")}
                                className="text-destructive focus:text-destructive cursor-pointer"
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Mark as Failed
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleStatusChange(log, "cancelled")}
                                className="text-yellow-600 focus:text-yellow-600 cursor-pointer"
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

                {/* Enhanced Pagination */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t bg-muted/30">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <p>
                      Showing <span className="font-medium text-foreground">{offset + 1}</span> to{" "}
                      <span className="font-medium text-foreground">{Math.min(offset + pageSize, total)}</span> of{" "}
                      <span className="font-medium text-foreground">{(total ?? 0).toLocaleString()}</span> logs
                    </p>
                    <div className="h-4 w-px bg-border" />
                    <div className="flex items-center gap-2">
                      <span>Rows per page:</span>
                      <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                        <SelectTrigger className="w-[70px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handlePageChange(1)}
                        disabled={currentPage === 1}
                        className="h-8 w-8 transition-all duration-200 hover:bg-muted"
                        title="First page"
                      >
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="transition-all duration-200 hover:bg-muted"
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Previous
                      </Button>

                      <div className="flex items-center gap-2 px-2">
                        <span className="text-sm text-muted-foreground">Page</span>
                        <Input
                          type="number"
                          min={1}
                          max={totalPages}
                          value={jumpToPage}
                          onChange={(e) => setJumpToPage(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleJumpToPage();
                            }
                          }}
                          onBlur={handleJumpToPage}
                          placeholder={currentPage.toString()}
                          className="w-14 h-8 text-center tabular-nums"
                        />
                        <span className="text-sm text-muted-foreground">of {totalPages}</span>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="transition-all duration-200 hover:bg-muted"
                      >
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>

                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handlePageChange(totalPages)}
                        disabled={currentPage === totalPages}
                        className="h-8 w-8 transition-all duration-200 hover:bg-muted"
                        title="Last page"
                      >
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Commands Info */}
      <div
        className={`
          transition-all duration-300 ease-out
          ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
        `}
        style={{ transitionDelay: "400ms" }}
      >
        <Card className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <CardHeader className="pb-3 bg-muted/30 border-b">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <div className="p-1.5 rounded-lg bg-background shadow-sm">
                <Database className="h-4 w-4 text-muted-foreground" />
              </div>
              Sync Commands
            </CardTitle>
            <CardDescription className="text-sm">
              Terminal commands to manage synchronization
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
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
            ].map(({ command, description }, index) => (
              <div key={command} className="space-y-1.5 group" style={{ animationDelay: `${450 + index * 50}ms` }}>
                <code className="block rounded-xl bg-muted/50 border border-border/50 px-4 py-3 text-sm font-mono transition-all duration-200 hover:bg-muted/70 hover:border-border hover:shadow-sm group-hover:-translate-y-0.5">
                  {command}
                </code>
                <p className="text-xs text-muted-foreground pl-1 font-medium">
                  {description}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Status Update Confirmation Dialog */}
      <AlertDialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Update Sync Status?</AlertDialogTitle>
            <AlertDialogDescription>
              {newStatus === "failed" ? (
                <>This will mark the sync as <strong>failed</strong>. Use this for syncs that are stuck or didn&apos;t complete properly.</>
              ) : (
                <>This will mark the sync as <strong>cancelled</strong>. Use this for syncs that were manually stopped.</>
              )}
              {selectedSync && (
                <div className="mt-3 p-4 rounded-xl bg-muted/50 border">
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
            <AlertDialogCancel className="transition-all duration-200 hover:shadow-sm">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmStatusUpdate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all duration-200 hover:shadow-sm"
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

/**
 * Enhanced skeleton loader with staggered animations
 */
function SyncPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" style={{ animationDelay: "0ms" }} />
          <Skeleton className="h-4 w-64" style={{ animationDelay: "50ms" }} />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32 rounded-md" style={{ animationDelay: "100ms" }} />
          <Skeleton className="h-9 w-24 rounded-md" style={{ animationDelay: "150ms" }} />
        </div>
      </div>

      {/* Last updated skeleton */}
      <Skeleton className="h-5 w-48" style={{ animationDelay: "200ms" }} />

      {/* Status Banner Skeleton */}
      <div className="rounded-xl border bg-card shadow-sm p-6" style={{ animationDelay: "250ms" }}>
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3 mt-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-4 rounded-xl border" style={{ animationDelay: `${300 + i * 50}ms` }}>
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-5 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats skeleton */}
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-10 w-32 rounded-lg"
            style={{ animationDelay: `${400 + i * 50}ms` }}
          />
        ))}
      </div>

      {/* History Skeleton */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="p-6 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-7 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-56" />
            </div>
          </div>
        </div>
        <div className="p-0">
          {/* Header row */}
          <div className="flex items-center gap-4 p-4 border-b bg-muted/30">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-16" style={{ animationDelay: `${500 + i * 30}ms` }} />
            ))}
          </div>
          {/* Data rows with staggered opacity */}
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-4 border-b last:border-b-0"
              style={{
                animationDelay: `${600 + i * 50}ms`,
                opacity: 1 - (i * 0.1),
              }}
            >
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-4 w-12 ml-auto" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
          ))}
        </div>
        {/* Pagination skeleton */}
        <div className="flex items-center justify-between p-4 border-t bg-muted/30">
          <Skeleton className="h-4 w-48" style={{ animationDelay: "850ms" }} />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
