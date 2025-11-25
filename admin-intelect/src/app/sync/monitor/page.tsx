"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Activity,
  Terminal,
  Filter,
  Download,
  Maximize2,
  Minimize2,
  Search,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Info,
  Zap,
  Clock,
  Database,
  TrendingUp,
  StopCircle,
  RefreshCw,
  Tag,
  Layers,
  Package,
  List,
  DollarSign,
  BarChart3,
  ArrowRightLeft,
  Timer,
  Wifi,
  WifiOff,
  ChevronDown,
  ChevronUp,
  Pause,
  Play,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080") + "/api/v1";

interface LogEntry {
  id: string;
  sync_log_id: string;
  step_number?: number;
  level: "debug" | "info" | "warn" | "error" | "fatal";
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
  created_at: string;
}

interface StepProgress {
  step_number: number;
  step_name: string;
  status: string;
  items_processed: number;
  items_total: number;
  progress_percentage: number;
  extracted: number;
  inserted: number;
  updated: number;
  failed: number;
  throughput_items_per_second?: number;
  started_at?: string;
  completed_at?: string;
  last_updated_at?: string;
}

interface RealtimeProgress {
  sync_log_id: string;
  is_running: boolean;
  status: string;
  sync_type: string;
  current_step: number;
  current_step_name: string;
  overall_progress_percentage: number;
  elapsed_seconds: number;
  estimated_remaining_seconds?: number;
  selected_steps?: string[];
  started_at: string;
  finished_at?: string;
  error_message?: string;
  steps: StepProgress[];
  statistics: {
    brands_synced: number;
    brands_inserted: number;
    brands_updated: number;
    categories_synced: number;
    categories_inserted: number;
    categories_updated: number;
    products_synced: number;
    products_inserted: number;
    products_updated: number;
    properties_synced: number;
    properties_inserted: number;
    properties_updated: number;
  };
  last_updated: string;
}

/**
 * Format duration in human-readable format
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

/**
 * Format timestamp as locale time string
 */
function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString();
}

/**
 * Format number with locale formatting and null safety
 */
function formatNumber(num: number | undefined | null): string {
  if (num == null) return '0';
  return num.toLocaleString();
}

/**
 * Get step icon based on step number
 */
function getStepIcon(stepNumber: number) {
  const iconClass = "h-3.5 w-3.5";
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

/**
 * Get level icon for log entries
 */
function getLevelIcon(level: string) {
  const iconClass = "h-3 w-3";
  switch (level) {
    case "error":
    case "fatal":
      return <XCircle className={iconClass} />;
    case "warn":
      return <AlertCircle className={iconClass} />;
    case "info":
      return <Info className={iconClass} />;
    default:
      return <Terminal className={iconClass} />;
  }
}

/**
 * Get badge class for log level
 */
function getLevelBadgeClass(level: string): string {
  switch (level) {
    case "fatal":
    case "error":
      return "bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20";
    case "warn":
      return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20 hover:bg-yellow-500/20 dark:text-yellow-400";
    case "info":
      return "bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/20 dark:text-blue-400";
    default:
      return "bg-muted/50 text-muted-foreground border-muted hover:bg-muted/80";
  }
}

/**
 * Get status badge component
 */
function getStatusBadge(status: string, isRunning: boolean = false) {
  if (isRunning) {
    return (
      <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/20 gap-1 font-medium">
        <Loader2 className="h-3 w-3 animate-spin" />
        Running
      </Badge>
    );
  }

  switch (status) {
    case "completed":
      return (
        <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 gap-1 font-medium">
          <CheckCircle2 className="h-3 w-3" />
          Completed
        </Badge>
      );
    case "failed":
      return (
        <Badge className="bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20 gap-1 font-medium">
          <XCircle className="h-3 w-3" />
          Failed
        </Badge>
      );
    case "cancelled":
      return (
        <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 hover:bg-yellow-500/20 gap-1 font-medium">
          <AlertCircle className="h-3 w-3" />
          Cancelled
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="bg-muted/50 text-muted-foreground border-muted gap-1 font-medium">
          <Clock className="h-3 w-3" />
          Pending
        </Badge>
      );
  }
}

export default function SyncMonitorPage() {
  const [progress, setProgress] = useState<RealtimeProgress | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [stepFilter, setStepFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  // Animation states
  const [contentVisible, setContentVisible] = useState(false);
  const [stepsVisible, setStepsVisible] = useState(false);

  const { toast } = useToast();
  const progressEventSourceRef = useRef<EventSource | null>(null);
  const logsEventSourceRef = useRef<EventSource | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const pausedProgressRef = useRef<RealtimeProgress | null>(null);

  // Trigger animations on mount
  useEffect(() => {
    const timer1 = setTimeout(() => setContentVisible(true), 50);
    const timer2 = setTimeout(() => setStepsVisible(true), 200);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && !isPaused && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll, isPaused]);

  // Connect to SSE streams
  useEffect(() => {
    let progressSource: EventSource | null = null;
    let logsSource: EventSource | null = null;

    const connectToStreams = () => {
      // Progress stream
      progressSource = new EventSource(`${API_BASE_URL}/sync/stream/progress`);

      progressSource.onopen = () => {
        console.log("Progress stream connected");
        setIsConnected(true);
        setError(null);
      };

      progressSource.addEventListener("progress", (event) => {
        try {
          const data = JSON.parse(event.data);

          // Store in paused ref if paused
          if (isPaused) {
            pausedProgressRef.current = data;
            return;
          }

          // Clear logs if sync_log_id changed (new sync started)
          setProgress(prev => {
            if (prev && prev.sync_log_id !== data.sync_log_id) {
              setLogs([]); // Clear logs for new sync
            }
            return data;
          });

          // Set connected when we receive first data
          setIsConnected(true);
          setError(null);
        } catch (err) {
          console.error("Failed to parse progress event:", err);
        }
      });

      progressSource.addEventListener("complete", () => {
        console.log("Sync completed");
      });

      progressSource.addEventListener("error", (event) => {
        try {
          const messageEvent = event as MessageEvent;
          if (messageEvent.data) {
            const data = JSON.parse(messageEvent.data);
            setError(data.error || "Unknown error occurred");
          }
        } catch {
          // Ignore parse errors for SSE error events
          console.log("SSE error event (non-JSON)");
        }
      });

      progressSource.onerror = () => {
        console.log("Progress stream connection error - will auto-reconnect");
        setIsConnected(false);

        // Auto-reconnect after 3 seconds
        setTimeout(() => {
          if (progressSource) {
            progressSource.close();
          }
          connectToStreams();
        }, 3000);
      };

      progressEventSourceRef.current = progressSource;

      // Logs stream (only if we have a sync_log_id)
      if (progress?.sync_log_id) {
        logsSource = new EventSource(`${API_BASE_URL}/sync/stream/logs?sync_log_id=${progress.sync_log_id}`);

        logsSource.addEventListener("log", (event) => {
          try {
            const logEntry = JSON.parse(event.data);
            if (!isPaused) {
              // Only add if not already in the logs (prevent duplicates on SSE reconnect)
              setLogs(prev => {
                const exists = prev.some(log => log.id === logEntry.id);
                return exists ? prev : [...prev, logEntry];
              });
            }
          } catch (err) {
            console.error("Failed to parse log event:", err);
          }
        });

        logsSource.onerror = () => {
          console.log("Logs stream connection error - will auto-reconnect with progress stream");
        };

        logsEventSourceRef.current = logsSource;
      }
    };

    connectToStreams();

    // Cleanup on unmount
    return () => {
      if (progressSource) {
        progressSource.close();
      }
      if (logsSource) {
        logsSource.close();
      }
    };
  }, [progress?.sync_log_id, isPaused]);

  // Resume from paused state
  useEffect(() => {
    if (!isPaused && pausedProgressRef.current) {
      setProgress(pausedProgressRef.current);
      pausedProgressRef.current = null;
    }
  }, [isPaused]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (levelFilter !== "all" && log.level !== levelFilter) {
        return false;
      }
      if (stepFilter !== "all" && log.step_number?.toString() !== stepFilter) {
        return false;
      }
      if (searchQuery && !log.message.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [logs, levelFilter, stepFilter, searchQuery]);

  // Log statistics
  const logStats = useMemo(() => {
    return {
      total: logs.length,
      filtered: filteredLogs.length,
      error: logs.filter(l => l.level === "error" || l.level === "fatal").length,
      warn: logs.filter(l => l.level === "warn").length,
      info: logs.filter(l => l.level === "info").length,
      debug: logs.filter(l => l.level === "debug").length,
    };
  }, [logs, filteredLogs]);

  // Export logs
  const handleExport = useCallback((format: "json" | "csv") => {
    if (!progress) return;

    const url = `${API_BASE_URL}/sync/realtime/logs/export?sync_log_id=${progress.sync_log_id}&format=${format}`;
    window.open(url, "_blank");
  }, [progress]);

  // Cancel running sync
  const handleCancelSync = useCallback(async () => {
    if (!progress || !progress.is_running) return;

    setIsCancelling(true);
    try {
      const result = await api.cancelSync(progress.sync_log_id, "User requested cancellation from monitor page");

      toast({
        title: "Sync Cancellation Requested",
        description: result.message || "The sync will stop at the next checkpoint.",
        variant: "default",
      });

      setShowCancelDialog(false);

      // Refresh progress to show cancellation status
      setTimeout(() => {
        setIsCancelling(false);
      }, 2000);
    } catch (error) {
      console.error("Failed to cancel sync:", error);
      toast({
        title: "Cancellation Failed",
        description: error instanceof Error ? error.message : "Failed to cancel sync. Please try again.",
        variant: "destructive",
      });
      setIsCancelling(false);
    }
  }, [progress, toast]);

  // Clear logs
  const handleClearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return (
    <div className={`space-y-4 ${isExpanded ? "" : ""}`}>
      {/* Header */}
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
            <h1 className="text-3xl font-bold tracking-tight">Real-Time Monitor</h1>
            <p className="text-muted-foreground text-sm">
              Live sync progress with detailed logging and analytics
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {progress && progress.is_running && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowCancelDialog(true)}
              disabled={isCancelling}
              className="transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
            >
              {isCancelling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                <>
                  <StopCircle className="h-4 w-4 mr-2" />
                  Cancel Sync
                </>
              )}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPaused(!isPaused)}
            className={`transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5 ${
              isPaused ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-600" : ""
            }`}
          >
            {isPaused ? (
              <>
                <Play className="h-4 w-4 mr-2" />
                Resume
              </>
            ) : (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Pause
              </>
            )}
          </Button>
          <div className={`
            flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-sm transition-all duration-300
            ${isConnected
              ? "bg-primary/10 border-primary/20 shadow-primary/10"
              : "bg-destructive/10 border-destructive/20 shadow-destructive/10"
            }
          `}>
            {isConnected ? (
              <Wifi className="h-4 w-4 text-primary" />
            ) : (
              <WifiOff className="h-4 w-4 text-destructive" />
            )}
            <div className={`h-2 w-2 rounded-full transition-all duration-300 ${
              isConnected ? "bg-primary animate-pulse shadow-lg shadow-primary/50" : "bg-destructive"
            }`} />
            <span className="text-sm font-semibold">
              {isConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div
          className={`
            transition-all duration-300 ease-out
            ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
          `}
          style={{ transitionDelay: "50ms" }}
        >
          <Card className="rounded-xl border-destructive/50 bg-destructive/5 shadow-sm overflow-hidden">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 ring-2 ring-destructive/20 shrink-0">
                  <XCircle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="font-medium text-destructive">Connection Error</p>
                  <p className="text-sm text-destructive/80">{error}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Progress Overview */}
      {progress ? (
        <div
          className={`
            transition-all duration-300 ease-out
            ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
          `}
          style={{ transitionDelay: "100ms" }}
        >
          <Card className={`rounded-xl border shadow-sm overflow-hidden transition-all duration-500 ${
            progress.is_running
              ? "border-blue-500/30 bg-gradient-to-br from-blue-500/5 to-blue-500/10 shadow-lg shadow-blue-500/10"
              : progress.status === "completed"
                ? "border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10"
                : progress.status === "failed"
                  ? "border-destructive/30 bg-gradient-to-br from-destructive/5 to-destructive/10"
                  : ""
          }`}>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  {progress.is_running ? (
                    <div className="relative">
                      <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" />
                      <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10 ring-2 ring-blue-500/30 shadow-lg shadow-blue-500/20">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                      </div>
                    </div>
                  ) : progress.status === "completed" ? (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 ring-2 ring-primary/30 shadow-md shadow-primary/10 transition-all duration-300 hover:scale-105">
                      <CheckCircle2 className="h-6 w-6 text-primary" />
                    </div>
                  ) : progress.status === "failed" ? (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 ring-2 ring-destructive/30 shadow-md shadow-destructive/10">
                      <XCircle className="h-6 w-6 text-destructive" />
                    </div>
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-500/10 ring-2 ring-yellow-500/30 shadow-md shadow-yellow-500/10">
                      <AlertCircle className="h-6 w-6 text-yellow-600" />
                    </div>
                  )}
                  <div>
                    <CardTitle className="text-xl font-bold">
                      {progress.is_running
                        ? "Sync in Progress"
                        : progress.status === "completed"
                          ? "Sync Completed"
                          : progress.status === "failed"
                            ? "Sync Failed"
                            : "Sync Cancelled"}
                    </CardTitle>
                    <CardDescription className="mt-0.5 text-sm">
                      {progress.sync_type} sync
                      {progress.selected_steps && progress.selected_steps.length > 0 && progress.selected_steps.length < 7 && (
                        <Badge variant="outline" className="ml-2 text-xs bg-blue-500/10 text-blue-600 border-blue-500/20">
                          Selective: {progress.selected_steps.length} steps
                        </Badge>
                      )}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(progress.status, progress.is_running)}
                  <Badge
                    variant="outline"
                    className={`font-semibold px-3 py-1.5 shadow-sm tabular-nums ${
                      progress.is_running
                        ? "text-blue-600 border-blue-500/30 bg-blue-500/10"
                        : progress.status === "completed"
                          ? "text-primary border-primary/30 bg-primary/10"
                          : "text-muted-foreground"
                    }`}
                  >
                    <Zap className="h-3.5 w-3.5 mr-1.5" />
                    {Math.round(progress.overall_progress_percentage ?? 0)}%
                  </Badge>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-5 pt-3">
              {/* Progress Bar */}
              {progress.is_running && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground font-medium">Overall Progress</span>
                    <span className="font-semibold tabular-nums text-blue-600">
                      {Math.round(progress.overall_progress_percentage ?? 0)}%
                    </span>
                  </div>
                  <div className="relative">
                    <Progress
                      value={progress.overall_progress_percentage ?? 0}
                      className="h-2.5 bg-blue-500/10 shadow-inner"
                    />
                  </div>
                </div>
              )}

              {/* Time Statistics */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="group flex items-center gap-3 p-4 rounded-xl bg-card border border-border/50 transition-all duration-200 hover:shadow-md hover:border-border hover:-translate-y-0.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted transition-colors group-hover:bg-muted/80">
                    <Timer className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Elapsed</p>
                    <p className="text-lg font-bold tabular-nums truncate">
                      {formatDuration(progress.elapsed_seconds ?? 0)}
                    </p>
                  </div>
                </div>

                {progress.estimated_remaining_seconds && progress.estimated_remaining_seconds > 0 && (
                  <div className="group flex items-center gap-3 p-4 rounded-xl bg-card border border-border/50 transition-all duration-200 hover:shadow-md hover:border-border hover:-translate-y-0.5 animate-in fade-in slide-in-from-left-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted transition-colors group-hover:bg-muted/80">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Remaining</p>
                      <p className="text-lg font-bold tabular-nums truncate">
                        {formatDuration(progress.estimated_remaining_seconds)}
                      </p>
                    </div>
                  </div>
                )}

                <div className="group flex items-center gap-3 p-4 rounded-xl bg-card border border-border/50 transition-all duration-200 hover:shadow-md hover:border-border hover:-translate-y-0.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted transition-colors group-hover:bg-muted/80">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Current Step</p>
                    <p className="text-sm font-semibold truncate">{progress.current_step_name}</p>
                  </div>
                </div>

                <div className="group flex items-center gap-3 p-4 rounded-xl bg-card border border-border/50 transition-all duration-200 hover:shadow-md hover:border-border hover:-translate-y-0.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted transition-colors group-hover:bg-muted/80">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Progress</p>
                    <p className="text-sm font-semibold truncate">
                      Step {progress.current_step} of {progress.selected_steps?.length || 7}
                    </p>
                  </div>
                </div>
              </div>

              {/* Step Progress */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-muted">
                      <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    Step Progress
                  </h4>
                </div>

                <div className="space-y-2">
                  {progress.steps.map((step, index) => {
                    const stepProgress = step.items_total > 0 ? (step.items_processed / step.items_total) * 100 : step.progress_percentage;
                    const isRunning = step.status === "running";

                    return (
                      <div
                        key={step.step_number}
                        className={`
                          group rounded-xl border p-4 transition-all duration-300
                          ${stepsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
                          ${step.status === "running"
                            ? "border-blue-500/30 bg-blue-500/5 shadow-md hover:shadow-lg"
                            : step.status === "completed"
                              ? "border-primary/20 bg-primary/5 hover:shadow-sm"
                              : step.status === "failed"
                                ? "border-destructive/20 bg-destructive/5"
                                : "border-border/50 bg-card/30 hover:bg-card/50 hover:border-border"
                          }
                        `}
                        style={{
                          transitionDelay: stepsVisible ? `${index * 50}ms` : "0ms",
                        }}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-all duration-200 shadow-sm ${
                              step.status === "completed"
                                ? "bg-primary/10 text-primary shadow-primary/20"
                                : step.status === "running"
                                  ? "bg-blue-500/10 text-blue-600 shadow-blue-500/20"
                                  : step.status === "failed"
                                    ? "bg-destructive/10 text-destructive shadow-destructive/20"
                                    : "bg-muted text-muted-foreground"
                            }`}>
                              {step.status === "running" ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : step.status === "completed" ? (
                                <CheckCircle2 className="h-4 w-4" />
                              ) : (
                                getStepIcon(step.step_number)
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-sm truncate">{step.step_name}</p>
                              {/* Real-time status for running steps */}
                              {isRunning && step.items_total > 0 && (
                                <div className="mt-2">
                                  <div className="flex items-center gap-2 text-xs text-blue-600 font-medium">
                                    <span>
                                      {formatNumber(step.items_processed)} / {formatNumber(step.items_total)} items
                                    </span>
                                    <span className="text-muted-foreground">
                                      ({Math.round(stepProgress)}%)
                                    </span>
                                    {step.throughput_items_per_second && step.throughput_items_per_second > 0 && (
                                      <span className="text-muted-foreground">
                                        {step.throughput_items_per_second.toFixed(1)}/s
                                      </span>
                                    )}
                                  </div>
                                  <Progress
                                    value={stepProgress}
                                    className="h-1.5 mt-1.5 bg-blue-500/10 shadow-inner"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {step.extracted > 0 && !isRunning && (
                              <span className="text-xs font-mono text-muted-foreground hidden sm:block tabular-nums">
                                {formatNumber(step.extracted)} extracted
                              </span>
                            )}
                            <Badge
                              variant="outline"
                              className={`text-xs transition-all duration-200 ${
                                step.status === "running"
                                  ? "border-blue-500/30 bg-blue-500/10 text-blue-600 shadow-sm"
                                  : step.status === "completed"
                                    ? "border-primary/30 bg-primary/10 text-primary"
                                    : step.status === "failed"
                                      ? "border-destructive/30 bg-destructive/10 text-destructive"
                                      : ""
                              }`}
                            >
                              {step.status}
                            </Badge>
                          </div>
                        </div>

                        {/* Change Deltas */}
                        {(step.status === "running" || step.status === "completed") && (step.inserted > 0 || step.updated > 0 || step.failed > 0) && (
                          <div className="mt-3 pt-3 border-t border-border/30">
                            <div className="flex items-center gap-4 text-xs font-medium">
                              {step.inserted > 0 && (
                                <span className="text-primary">+{formatNumber(step.inserted)} added</span>
                              )}
                              {step.updated > 0 && (
                                <span className="text-primary">{formatNumber(step.updated)} updated</span>
                              )}
                              {step.failed > 0 && (
                                <span className="text-destructive">{formatNumber(step.failed)} failed</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Statistics Collapsible */}
              <Collapsible open={isStatsOpen} onOpenChange={setIsStatsOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between px-0 hover:bg-transparent">
                    <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-muted">
                        <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      Sync Statistics
                    </span>
                    {isStatsOpen ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-3">
                  <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                    {[
                      { label: "Brands", value: progress.statistics.brands_synced, inserted: progress.statistics.brands_inserted, updated: progress.statistics.brands_updated, icon: Tag },
                      { label: "Categories", value: progress.statistics.categories_synced, inserted: progress.statistics.categories_inserted, updated: progress.statistics.categories_updated, icon: Layers },
                      { label: "Products", value: progress.statistics.products_synced, inserted: progress.statistics.products_inserted, updated: progress.statistics.products_updated, icon: Package },
                      { label: "Properties", value: progress.statistics.properties_synced, inserted: progress.statistics.properties_inserted, updated: progress.statistics.properties_updated, icon: List },
                    ].map(({ label, value, inserted, updated, icon: Icon }) => (
                      <div
                        key={label}
                        className="group flex flex-col p-3 rounded-xl bg-muted/30 border border-border/30 transition-all duration-200 hover:bg-muted/50 hover:shadow-md hover:-translate-y-0.5"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="p-1.5 rounded-lg bg-background shadow-sm group-hover:shadow-md transition-shadow">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <p className="text-xl font-bold tabular-nums">{formatNumber(value)}</p>
                        </div>
                        <p className="text-xs text-muted-foreground font-medium">{label}</p>
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
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
        </div>
      ) : (
        <MonitorSkeleton />
      )}

      {/* Real-Time Logs */}
      <div
        className={`
          transition-all duration-300 ease-out
          ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
          ${isExpanded ? "fixed inset-4 z-50" : ""}
        `}
        style={{ transitionDelay: "200ms" }}
      >
        <Card className={`rounded-xl border shadow-sm overflow-hidden transition-all duration-300 ${isExpanded ? "h-full flex flex-col shadow-2xl" : ""}`}>
          <CardHeader className="pb-3 bg-muted/30 border-b shrink-0">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-background shadow-sm">
                  <Terminal className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold">Real-Time Logs</CardTitle>
                  <CardDescription className="text-sm">
                    {logStats.filtered} of {logStats.total} entries
                    {logStats.error > 0 && (
                      <Badge variant="outline" className="ml-2 text-xs bg-destructive/10 text-destructive border-destructive/20">
                        {logStats.error} errors
                      </Badge>
                    )}
                    {logStats.warn > 0 && (
                      <Badge variant="outline" className="ml-2 text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                        {logStats.warn} warnings
                      </Badge>
                    )}
                  </CardDescription>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearLogs}
                  disabled={logs.length === 0}
                  className="transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Clear
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport("json")}
                  disabled={logs.length === 0}
                  className="transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
                >
                  <Download className="h-4 w-4 mr-2" />
                  JSON
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport("csv")}
                  disabled={logs.length === 0}
                  className="transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
                >
                  <Download className="h-4 w-4 mr-2" />
                  CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="transition-all duration-200 hover:scale-105"
                >
                  {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search logs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
              </div>
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger className="w-32 h-9">
                  <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="debug">Debug</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warn">Warn</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="fatal">Fatal</SelectItem>
                </SelectContent>
              </Select>
              <Select value={stepFilter} onValueChange={setStepFilter}>
                <SelectTrigger className="w-32 h-9">
                  <SelectValue placeholder="Step" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Steps</SelectItem>
                  <SelectItem value="1">Brands</SelectItem>
                  <SelectItem value="2">Categories</SelectItem>
                  <SelectItem value="3">Products</SelectItem>
                  <SelectItem value="4">Properties</SelectItem>
                  <SelectItem value="5">Prices</SelectItem>
                  <SelectItem value="6">Stock</SelectItem>
                  <SelectItem value="7">Exchange Rates</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoScroll(!autoScroll)}
                className={`h-9 transition-all duration-200 hover:shadow-sm ${
                  autoScroll ? "bg-primary/10 border-primary/30 text-primary" : ""
                }`}
              >
                Auto-scroll {autoScroll ? "ON" : "OFF"}
              </Button>
            </div>
          </CardHeader>

          <CardContent className={`pt-4 ${isExpanded ? "flex-1 overflow-hidden" : ""}`}>
            <div className={`
              rounded-xl border bg-muted/30 p-4 font-mono text-xs overflow-y-auto shadow-inner
              ${isExpanded ? "h-full" : "h-96"}
            `}>
              {filteredLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <div className="p-4 rounded-full bg-muted/50 mb-4">
                    <Terminal className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <p className="font-medium text-foreground">
                    {logs.length === 0 ? "Waiting for logs..." : "No logs match the current filters"}
                  </p>
                  <p className="text-sm mt-1">
                    {logs.length === 0 ? "Logs will appear when a sync operation starts" : "Try adjusting your filter criteria"}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredLogs.map((log, index) => (
                    <div
                      key={`${log.id}-${log.timestamp}-${index}`}
                      className={`
                        flex items-start gap-2.5 py-2 px-2 -mx-2 rounded-lg
                        hover:bg-accent/50 transition-all duration-150
                        ${stepsVisible ? "opacity-100" : "opacity-0"}
                      `}
                      style={{
                        transitionDelay: `${Math.min(index * 10, 200)}ms`,
                      }}
                    >
                      <span className="text-muted-foreground shrink-0 font-medium tabular-nums">
                        {formatTimestamp(log.timestamp)}
                      </span>
                      <Badge
                        variant="outline"
                        className={`shrink-0 text-[10px] px-1.5 py-0 h-5 gap-1 transition-all duration-200 ${getLevelBadgeClass(log.level)}`}
                      >
                        {getLevelIcon(log.level)}
                        {log.level}
                      </Badge>
                      {log.step_number && (
                        <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0 h-5">
                          Step {log.step_number}
                        </Badge>
                      )}
                      <span className="flex-1 break-words leading-relaxed">{log.message}</span>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cancel Sync Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 ring-2 ring-destructive/20">
                <StopCircle className="h-5 w-5 text-destructive" />
              </div>
              Cancel Running Sync?
            </AlertDialogTitle>
            <AlertDialogDescription className="pt-3">
              This will stop the sync operation at the next checkpoint. The sync status will be marked as "cancelled".
            </AlertDialogDescription>
            {progress && (
              <div className="mt-4 p-4 rounded-xl bg-muted/50 border">
                <p className="text-sm font-semibold text-foreground mb-2">Sync Details</p>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Type:</span>
                    <span className="font-medium text-foreground">{progress.sync_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Started:</span>
                    <span className="font-medium text-foreground">{new Date(progress.started_at).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Progress:</span>
                    <span className="font-medium text-foreground">{Math.round(progress.overall_progress_percentage ?? 0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Current Step:</span>
                    <span className="font-medium text-foreground">{progress.current_step_name}</span>
                  </div>
                </div>
              </div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="transition-all duration-200 hover:shadow-sm">
              Keep Running
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelSync}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all duration-200 hover:shadow-sm"
              disabled={isCancelling}
            >
              {isCancelling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                <>
                  <StopCircle className="h-4 w-4 mr-2" />
                  Yes, Cancel Sync
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
 * Enhanced skeleton loader for the monitor page
 */
function MonitorSkeleton() {
  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="p-6 space-y-5">
        {/* Header skeleton */}
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>

        {/* Progress bar skeleton */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-12" />
          </div>
          <Skeleton className="h-2.5 w-full rounded-full" />
        </div>

        {/* Time stats skeleton */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-4 rounded-xl border"
              style={{ opacity: 1 - (i * 0.15) }}
            >
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-5 w-20" />
              </div>
            </div>
          ))}
        </div>

        {/* Steps skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="p-4 rounded-xl border"
              style={{ opacity: 1 - (i * 0.2) }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <Skeleton className="h-5 w-24" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
