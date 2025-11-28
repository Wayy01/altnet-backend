"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  XCircle,
  CheckCircle2,
  Clock,
  AlertCircle,
  Activity,
  Timer,
  Target,
  TrendingUp,
  Zap,
  ArrowRight,
  ScrollText,
  ChevronDown,
  Pause,
  Hash,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { TranslationJob, TranslationLog } from "@/types";
import { cn } from "@/lib/utils";

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const jobId = params.id as string;

  // State
  const [job, setJob] = useState<TranslationJob | null>(null);
  const [logs, setLogs] = useState<TranslationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(0);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const lastJobRef = useRef<string | null>(null);
  const lastLogsRef = useRef<string | null>(null);
  const isPollingRef = useRef(false);

  const PAGE_SIZE = 50;

  // Load job details - only update state if data changed
  const loadJob = useCallback(async (isPolling = false) => {
    try {
      const data = await api.getTranslationJob(jobId);
      const dataKey = `${data.status}-${data.translated_items}-${data.failed_items}-${data.skipped_items}`;
      if (lastJobRef.current !== dataKey) {
        lastJobRef.current = dataKey;
        setJob(data);
      }
    } catch (error) {
      if (!isPolling) {
        console.error("Failed to load job:", error);
        toast({
          title: "Error",
          description: "Failed to load job details",
          variant: "destructive",
        });
      }
    } finally {
      if (!isPolling) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  // Load logs - only update state if data changed
  const loadLogs = useCallback(async (page: number = 0, append: boolean = false, isPolling = false) => {
    // Don't show loading spinner during background polling
    if (!append && !isPolling) setLogsLoading(true);
    try {
      const { data, total } = await api.getTranslationLogs(jobId, PAGE_SIZE, page * PAGE_SIZE);
      const logsKey = `${total}-${data.length > 0 ? data[0]?.id : "empty"}`;
      if (append) {
        setLogs(prev => [...prev, ...data]);
        lastLogsRef.current = null;
      } else if (lastLogsRef.current !== logsKey) {
        lastLogsRef.current = logsKey;
        setLogs(data);
        setLogsTotal(total);
      }
    } catch (error) {
      if (!isPolling) console.error("Failed to load logs:", error);
    } finally {
      if (!isPolling) setLogsLoading(false);
    }
  }, [jobId]);

  // Initial load
  useEffect(() => {
    loadJob(false);
    loadLogs(0, false, false);
  }, [loadJob, loadLogs]);

  // Auto-refresh for running jobs - poll silently in background
  useEffect(() => {
    if (job && (job.status === "running" || job.status === "pending")) {
      const interval = setInterval(() => {
        // Silent background polling - no loading states
        loadJob(true);
        loadLogs(0, false, true);
      }, 10000); // Poll every 10 seconds - much less intrusive

      return () => clearInterval(interval);
    }
  }, [job?.status, loadJob, loadLogs]);

  // Auto-scroll logs
  useEffect(() => {
    if (autoScroll && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = 0;
    }
  }, [logs, autoScroll]);

  // Cancel job
  const handleCancelJob = async () => {
    if (!job) return;
    try {
      await api.cancelTranslationJob(job.id);
      toast({ title: "Job Cancelled", description: "Translation job has been cancelled" });
      loadJob();
    } catch (error) {
      console.error("Failed to cancel job:", error);
      toast({ title: "Error", description: "Failed to cancel job", variant: "destructive" });
    }
  };

  // Format duration
  const formatDuration = (job: TranslationJob) => {
    if (!job.started_at) return "Not started";
    const start = new Date(job.started_at);
    const end = job.completed_at ? new Date(job.completed_at) : new Date();
    const seconds = Math.floor((end.getTime() - start.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  // Calculate ETA
  const calculateETA = (job: TranslationJob) => {
    if (!job.started_at || job.translated_items === 0) return "Calculating...";
    const start = new Date(job.started_at);
    const elapsed = (Date.now() - start.getTime()) / 1000;
    const rate = job.translated_items / elapsed;
    const remaining = job.total_items - job.translated_items - job.failed_items - job.skipped_items;
    if (remaining <= 0) return "Almost done";
    const eta = remaining / rate;
    if (eta < 60) return `~${Math.ceil(eta)}s`;
    if (eta < 3600) return `~${Math.ceil(eta / 60)}m`;
    return `~${Math.floor(eta / 3600)}h ${Math.ceil((eta % 3600) / 60)}m`;
  };

  // Get status config
  const getStatusConfig = (status: string) => {
    switch (status) {
      case "completed":
        return { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10", borderColor: "border-emerald-500/30", gradient: "from-emerald-500", label: "Completed" };
      case "running":
        return { icon: Activity, color: "text-blue-500", bg: "bg-blue-500/10", borderColor: "border-blue-500/30", gradient: "from-blue-500", label: "Running" };
      case "pending":
        return { icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10", borderColor: "border-amber-500/30", gradient: "from-amber-500", label: "Pending" };
      case "failed":
        return { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10", borderColor: "border-red-500/30", gradient: "from-red-500", label: "Failed" };
      case "cancelled":
        return { icon: AlertCircle, color: "text-orange-500", bg: "bg-orange-500/10", borderColor: "border-orange-500/30", gradient: "from-orange-500", label: "Cancelled" };
      default:
        return { icon: Clock, color: "text-gray-500", bg: "bg-gray-500/10", borderColor: "border-gray-500/30", gradient: "from-gray-500", label: status };
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-14 w-14 rounded-full border-4 border-muted animate-pulse" />
            <Loader2 className="h-10 w-10 absolute inset-0 m-auto animate-spin text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">Loading job details...</p>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="container mx-auto py-6">
        <Card className="border-0 shadow-lg">
          <CardContent className="py-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-8 w-8 text-muted-foreground/30" />
            </div>
            <p className="text-lg font-medium mb-2">Job not found</p>
            <p className="text-sm text-muted-foreground mb-4">The translation job you are looking for does not exist.</p>
            <Button
              variant="outline"
              onClick={() => router.push("/translate/jobs")}
              className="transition-all duration-200 hover:shadow-md active:scale-95"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Jobs
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusConfig = getStatusConfig(job.status);
  const StatusIcon = statusConfig.icon;
  const progress = job.total_items > 0 ? ((job.translated_items + job.failed_items + job.skipped_items) / job.total_items) * 100 : 0;
  const successRate = (job.translated_items + job.failed_items) > 0
    ? (job.translated_items / (job.translated_items + job.failed_items)) * 100
    : 100;

  return (
    <div className="container mx-auto py-6 space-y-8">
      {/* Premium Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/translate/jobs")}
            className="h-10 w-10 rounded-xl transition-all duration-200 hover:bg-muted hover:scale-105 active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
              <span className="capitalize">{job.entity_type}</span>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
              <span>{job.target_language === "ru" ? "Russian" : "Romanian"}</span>
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Hash className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground font-mono">
                {job.id}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {(job.status === "running" || job.status === "pending") && (
            <Button
              variant="destructive"
              onClick={handleCancelJob}
              className="gap-2 shadow-lg shadow-destructive/25 transition-all duration-200 hover:shadow-xl active:scale-95"
            >
              <Pause className="h-4 w-4" />
              Cancel Job
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => { loadJob(); loadLogs(0); }}
            className="gap-2 transition-all duration-200 hover:shadow-md active:scale-95"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Status Banner - Premium */}
      <Card className={cn(
        "border-0 shadow-lg overflow-hidden relative",
        "bg-gradient-to-br from-card to-card/80"
      )}>
        <div className={cn(
          "absolute inset-y-0 left-0 w-1.5",
          `bg-gradient-to-b ${statusConfig.gradient} to-transparent`
        )} />
        <CardContent className="py-5 pl-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-5">
              <div className={cn(
                "h-14 w-14 rounded-2xl flex items-center justify-center border transition-all duration-300",
                statusConfig.bg,
                statusConfig.borderColor
              )}>
                <StatusIcon className={cn(
                  "h-7 w-7 transition-colors",
                  statusConfig.color,
                  job.status === 'running' && 'animate-pulse'
                )} />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className={cn("text-xl font-bold", statusConfig.color)}>{statusConfig.label}</span>
                  {job.status === "running" && (
                    <Badge className="bg-blue-500 text-white animate-pulse">
                      <Activity className="h-3 w-3 mr-1" />
                      Live
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Started {job.started_at ? new Date(job.started_at).toLocaleString() : "Not yet"}
                </p>
              </div>
            </div>
            {job.status === "running" && (
              <div className="text-right p-4 rounded-xl bg-muted/30">
                <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Estimated Time</div>
                <div className="text-2xl font-mono font-bold">{calculateETA(job)}</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Progress Section - Premium */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-card to-card/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress Bar */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Overall Progress</span>
              <span className="text-3xl font-bold tabular-nums">
                {progress.toFixed(1)}
                <span className="text-lg text-muted-foreground">%</span>
              </span>
            </div>
            <div className="relative">
              <Progress value={progress} className="h-4 bg-muted/50" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-bold text-primary-foreground drop-shadow-sm">
                  {Math.round(progress)}%
                </span>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="group p-5 rounded-xl bg-gradient-to-br from-muted/50 to-muted/30 text-center transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Target className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold tracking-tight">{job.total_items.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mt-1">Total</div>
            </div>
            <div className="group p-5 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 text-center transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
              <div className="flex items-center justify-center gap-2 mb-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
              <div className="text-3xl font-bold tracking-tight text-emerald-600">{job.translated_items.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mt-1">Translated</div>
            </div>
            <div className="group p-5 rounded-xl bg-gradient-to-br from-red-500/10 to-red-500/5 border border-red-500/20 text-center transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
              <div className="flex items-center justify-center gap-2 mb-2">
                <XCircle className="h-5 w-5 text-red-500" />
              </div>
              <div className="text-3xl font-bold tracking-tight text-red-600">{job.failed_items.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mt-1">Failed</div>
            </div>
            <div className="group p-5 rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20 text-center transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
              <div className="flex items-center justify-center gap-2 mb-2">
                <AlertCircle className="h-5 w-5 text-amber-500" />
              </div>
              <div className="text-3xl font-bold tracking-tight text-amber-600">{job.skipped_items.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mt-1">Skipped</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Row - Premium */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="group border-0 shadow-lg bg-gradient-to-br from-card to-card/80 transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg pointer-events-none" />
          <CardContent className="py-5">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/10 flex items-center justify-center transition-transform duration-200 group-hover:scale-110">
                <Timer className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Duration</div>
                <div className="text-2xl font-mono font-bold">{formatDuration(job)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="group border-0 shadow-lg bg-gradient-to-br from-card to-card/80 transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg pointer-events-none" />
          <CardContent className="py-5">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/10 flex items-center justify-center transition-transform duration-200 group-hover:scale-110">
                <Zap className="h-6 w-6 text-emerald-500" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Success Rate</div>
                <div className="text-2xl font-mono font-bold">{successRate.toFixed(1)}%</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="group border-0 shadow-lg bg-gradient-to-br from-card to-card/80 transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg pointer-events-none" />
          <CardContent className="py-5">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/10 flex items-center justify-center transition-transform duration-200 group-hover:scale-110">
                <Activity className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Speed</div>
                <div className="text-2xl font-mono font-bold">
                  {job.started_at && job.translated_items > 0
                    ? `${((job.translated_items / ((Date.now() - new Date(job.started_at).getTime()) / 1000)) * 60).toFixed(1)}/min`
                    : "N/A"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Message */}
      {job.error_message && (
        <Card className="border-0 shadow-lg border-l-4 border-l-red-500 bg-gradient-to-r from-red-500/5 to-transparent">
          <CardContent className="py-5">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                <XCircle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <div className="font-semibold text-red-600 mb-1">Error Message</div>
                <div className="text-sm text-red-500/80">{job.error_message}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Translation Logs - Premium */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-card to-card/80 overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ScrollText className="h-4 w-4 text-muted-foreground" />
              Translation Logs
              <Badge variant="secondary" className="ml-2 font-mono text-xs">
                {logsTotal.toLocaleString()}
              </Badge>
            </CardTitle>
            <Button
              variant={autoScroll ? "default" : "ghost"}
              size="sm"
              onClick={() => setAutoScroll(!autoScroll)}
              className={cn(
                "gap-2 transition-all duration-200",
                autoScroll ? "bg-blue-500 hover:bg-blue-600" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Activity className={cn("h-3.5 w-3.5", autoScroll && "animate-pulse")} />
              {autoScroll ? "Auto-scroll ON" : "Auto-scroll OFF"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div
            ref={logsContainerRef}
            className="h-[450px] overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
          >
            {logsLoading && logs.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Loading logs...</p>
                </div>
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-16">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center mx-auto mb-4">
                  <Activity className="h-7 w-7 text-muted-foreground/30" />
                </div>
                <p className="text-muted-foreground font-medium">No logs available yet</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Logs will appear here as translations are processed</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {logs.map((log, index) => (
                  <div
                    key={`${log.id}-${index}`}
                    className={cn(
                      "px-5 py-4 transition-all duration-300",
                      "hover:bg-gradient-to-r hover:from-muted/30 hover:to-transparent",
                      "animate-in fade-in-0 slide-in-from-top-2",
                      log.status === "failed" && "bg-red-500/5"
                    )}
                    style={{ animationDelay: `${Math.min(index * 20, 500)}ms` }}
                  >
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border",
                        log.status === "success"
                          ? "bg-emerald-500/10 border-emerald-500/20"
                          : log.status === "failed"
                          ? "bg-red-500/10 border-red-500/20"
                          : "bg-amber-500/10 border-amber-500/20"
                      )}>
                        {log.status === "success" ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : log.status === "failed" ? (
                          <XCircle className="h-4 w-4 text-red-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                          <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0">
                            {log.field_name}
                          </Badge>
                          <span className="text-muted-foreground/60">
                            {new Date(log.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          <div className="text-sm text-muted-foreground/80 truncate">
                            {log.original_value}
                          </div>
                          {log.translated_text && (
                            <div className="flex items-center gap-2">
                              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                              <div className="text-sm font-medium text-foreground truncate">
                                {log.translated_text}
                              </div>
                            </div>
                          )}
                          {log.error_message && (
                            <div className="text-xs text-red-500 bg-red-500/5 px-2 py-1 rounded mt-1">
                              {log.error_message}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Load More */}
          {logsTotal > logs.length && (
            <div className="p-4 border-t border-border/50 bg-muted/20 text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setLogsPage(prev => prev + 1);
                  loadLogs(logsPage + 1, true);
                }}
                disabled={logsLoading}
                className="gap-2 transition-all duration-200 hover:shadow-md active:scale-95"
              >
                {logsLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                Load More
                <Badge variant="secondary" className="ml-1 font-mono text-xs">
                  {(logsTotal - logs.length).toLocaleString()} remaining
                </Badge>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
