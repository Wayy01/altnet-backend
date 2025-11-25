"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
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

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080") + "/api/v1";

interface LogEntry {
  id: string;
  sync_log_id: string;
  step_number?: number;
  level: "debug" | "info" | "warn" | "error" | "fatal";
  message: string;
  details?: Record<string, any>;
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

function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString();
}

function getLevelIcon(level: string) {
  switch (level) {
    case "error":
    case "fatal":
      return <XCircle className="h-3 w-3" />;
    case "warn":
      return <AlertCircle className="h-3 w-3" />;
    case "info":
      return <Info className="h-3 w-3" />;
    default:
      return <Terminal className="h-3 w-3" />;
  }
}

function getLevelBadgeClass(level: string): string {
  switch (level) {
    case "fatal":
    case "error":
      return "bg-destructive/15 text-destructive border-destructive/20";
    case "warn":
      return "bg-yellow-500/15 text-yellow-600 border-yellow-500/20 dark:text-yellow-400";
    case "info":
      return "bg-blue-500/15 text-blue-600 border-blue-500/20 dark:text-blue-400";
    default:
      return "bg-muted/50 text-muted-foreground border-muted";
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

  const { toast } = useToast();
  const progressEventSourceRef = useRef<EventSource | null>(null);
  const logsEventSourceRef = useRef<EventSource | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

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

      progressSource.addEventListener("complete", (event) => {
        console.log("Sync completed");
      });

      progressSource.addEventListener("error", (event) => {
        try {
          const messageEvent = event as MessageEvent;
          if (messageEvent.data) {
            const data = JSON.parse(messageEvent.data);
            setError(data.error || "Unknown error occurred");
          }
        } catch (err) {
          // Ignore parse errors for SSE error events
          console.log("SSE error event (non-JSON)");
        }
      });

      progressSource.onerror = (err) => {
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
            // Only add if not already in the logs (prevent duplicates on SSE reconnect)
            setLogs(prev => {
              const exists = prev.some(log => log.id === logEntry.id);
              return exists ? prev : [...prev, logEntry];
            });
          } catch (err) {
            console.error("Failed to parse log event:", err);
          }
        });

        logsSource.onerror = (err) => {
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
  }, [progress?.sync_log_id]);

  // Filter logs
  const filteredLogs = logs.filter(log => {
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/sync">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Real-Time Sync Monitor</h1>
            <p className="text-muted-foreground mt-1">
              Live sync progress with detailed logging and analytics
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {progress && progress.is_running && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowCancelDialog(true)}
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
                  Cancel Sync
                </>
              )}
            </Button>
          )}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
            isConnected ? "bg-primary/10 border-primary/20" : "bg-destructive/10 border-destructive/20"
          }`}>
            <div className={`h-2 w-2 rounded-full ${isConnected ? "bg-primary animate-pulse" : "bg-destructive"}`} />
            <span className="text-sm font-medium">
              {isConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <XCircle className="h-5 w-5 text-destructive shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress Overview */}
      {progress && (
        <Card className={progress.is_running ? "border-primary/50 bg-gradient-to-br from-primary/5 to-primary/10" : ""}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {progress.is_running ? (
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                    <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 ring-2 ring-primary/20">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                  </div>
                ) : progress.status === "completed" ? (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 ring-2 ring-primary/20">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  </div>
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 ring-2 ring-destructive/20">
                    <XCircle className="h-5 w-5 text-destructive" />
                  </div>
                )}
                <div>
                  <CardTitle className="text-xl">
                    {progress.is_running ? "Sync in Progress" : progress.status === "completed" ? "Sync Completed" : "Sync Failed"}
                  </CardTitle>
                  <CardDescription>
                    {progress.sync_type} sync • Step {progress.current_step} of {progress.selected_steps?.length || 7}
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="text-primary border-primary/30 bg-primary/10">
                <Zap className="h-3.5 w-3.5 mr-1.5" />
                {Math.round(progress.overall_progress_percentage || 0)}%
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Progress Bar */}
            {progress.is_running && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Overall Progress</span>
                  <span className="font-medium">{Math.round(progress.overall_progress_percentage || 0)}%</span>
                </div>
                <Progress value={progress.overall_progress_percentage || 0} className="h-2.5" />
              </div>
            )}

            {/* Time Statistics */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-card/50 border">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Elapsed</p>
                  <p className="text-lg font-semibold">{formatDuration(progress.elapsed_seconds)}</p>
                </div>
              </div>

              {progress.estimated_remaining_seconds && (
                <div className="flex items-center gap-3 p-4 rounded-lg bg-card/50 border">
                  <TrendingUp className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Remaining</p>
                    <p className="text-lg font-semibold">{formatDuration(progress.estimated_remaining_seconds)}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 p-4 rounded-lg bg-card/50 border">
                <Activity className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Current Step</p>
                  <p className="text-sm font-medium">{progress.current_step_name}</p>
                </div>
              </div>
            </div>

            {/* Step Details */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Step Progress</h4>
              {progress.steps.map((step) => (
                <div
                  key={step.step_number}
                  className={`p-4 rounded-lg border transition-colors ${
                    step.status === "running"
                      ? "border-primary/30 bg-primary/5"
                      : step.status === "completed"
                      ? "border-primary/20 bg-card/50"
                      : "border-border/50 bg-card/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      {step.status === "running" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                      {step.status === "completed" && <CheckCircle2 className="h-4 w-4 text-primary" />}
                      <span className="font-medium">{step.step_name}</span>
                    </div>
                    <Badge variant="outline" className={step.status === "running" ? "border-primary/30 bg-primary/10 text-primary" : ""}>
                      {step.status}
                    </Badge>
                  </div>

                  {step.items_total > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{step.items_processed} / {step.items_total} items</span>
                        <span>{Math.round(step.progress_percentage)}%</span>
                      </div>
                      <Progress value={step.progress_percentage} className="h-1.5" />
                    </div>
                  )}

                  {(step.inserted > 0 || step.updated > 0) && (
                    <div className="flex gap-4 mt-2 text-xs">
                      {step.inserted > 0 && <span className="text-primary">+{step.inserted} added</span>}
                      {step.updated > 0 && <span className="text-primary">{step.updated} updated</span>}
                      {step.failed > 0 && <span className="text-destructive">{step.failed} failed</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Real-Time Logs */}
      <Card className={isExpanded ? "fixed inset-4 z-50" : ""}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Terminal className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle>Real-Time Logs</CardTitle>
                <CardDescription>
                  {filteredLogs.length} of {logs.length} log entries
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => handleExport("json")}>
                <Download className="h-4 w-4 mr-2" />
                JSON
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport("csv")}>
                <Download className="h-4 w-4 mr-2" />
                CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsExpanded(!isExpanded)}>
                {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 mt-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-32">
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
              <SelectTrigger className="w-32">
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
              className={autoScroll ? "bg-primary/10 border-primary/30" : ""}
            >
              Auto-scroll {autoScroll ? "ON" : "OFF"}
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <div className={`rounded-lg border bg-muted/30 p-4 font-mono text-xs overflow-y-auto ${
            isExpanded ? "h-[calc(100vh-20rem)]" : "h-96"
          }`}>
            {filteredLogs.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                {logs.length === 0 ? "Waiting for logs..." : "No logs match the current filters"}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredLogs.map((log, index) => (
                  <div
                    key={`${log.id}-${log.timestamp}-${index}`}
                    className="flex items-start gap-3 py-2 hover:bg-accent/50 rounded px-2 -mx-2 transition-colors"
                  >
                    <span className="text-muted-foreground shrink-0">{formatTimestamp(log.timestamp)}</span>
                    <Badge variant="outline" className={`shrink-0 ${getLevelBadgeClass(log.level)}`}>
                      {getLevelIcon(log.level)}
                      {log.level}
                    </Badge>
                    {log.step_number && (
                      <Badge variant="outline" className="shrink-0">
                        Step {log.step_number}
                      </Badge>
                    )}
                    <span className="flex-1 break-words">{log.message}</span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cancel Sync Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Running Sync?</AlertDialogTitle>
            <AlertDialogDescription>
              This will stop the sync operation at the next checkpoint. The sync status will be marked as "cancelled".
            </AlertDialogDescription>
            {progress && (
              <div className="mt-3 p-3 rounded-lg bg-muted/50 border text-sm">
                <div className="font-medium">Sync Details:</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Type: {progress.sync_type}
                </div>
                <div className="text-xs text-muted-foreground">
                  Started: {new Date(progress.started_at).toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">
                  Progress: {Math.round(progress.overall_progress_percentage || 0)}%
                </div>
              </div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Running</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelSync}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
