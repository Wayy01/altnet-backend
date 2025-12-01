"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  RefreshCw,
  Download,
  Clock,
  Zap,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Activity,
  Timer,
  BarChart3,
  AlertTriangle,
  Database,
  CalendarClock,
} from "lucide-react";
import { api } from "@/lib/api";
import {
  AnalyticsSummary,
  PerformanceTrend,
  BottleneckInfo,
  StepAverages,
  TimeRange,
  TIME_RANGE_OPTIONS,
} from "@/types/analytics";
import {
  TrendChart,
  StepBarChart,
  StatCard,
  DonutChart,
} from "@/components/sync/performance-charts";
import { useTranslation } from "@/contexts/language-context";
import { useToast } from "@/hooks/use-toast";

function formatDuration(seconds: number): string {
  if (seconds === 0) return "0s";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.round(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return formatDuration(ms / 1000);
}

function formatNumber(num: number | undefined | null): string {
  if (num == null) return "0";
  return num.toLocaleString();
}

function formatThroughput(throughput: number): string {
  if (throughput >= 1000) {
    return `${(throughput / 1000).toFixed(1)}k/s`;
  }
  return `${throughput.toFixed(1)}/s`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString();
}

export default function AnalyticsPage() {
  const { t } = useTranslation("sync");
  const { t: tCommon } = useTranslation("common");
  const { toast } = useToast();

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");

  // Data states
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [trends, setTrends] = useState<PerformanceTrend[]>([]);
  const [bottlenecks, setBottlenecks] = useState<BottleneckInfo[] | null>([]);
  const [stepAverages, setStepAverages] = useState<StepAverages[]>([]);

  // Animation states
  const [contentVisible, setContentVisible] = useState(false);

  const selectedDays = useMemo(() => {
    return TIME_RANGE_OPTIONS.find((opt) => opt.value === timeRange)?.days || 30;
  }, [timeRange]);

  const loadData = useCallback(async () => {
    try {
      const [summaryData, trendsData, bottlenecksData, stepData] = await Promise.all([
        api.getAnalyticsSummary(),
        api.getPerformanceTrends(selectedDays),
        api.getBottlenecks(10),
        api.getStepAverages(selectedDays),
      ]);

      setSummary(summaryData);
      setTrends(trendsData ?? []);
      setBottlenecks(bottlenecksData ?? []);
      setStepAverages(stepData ?? []);

      setTimeout(() => setContentVisible(true), 50);
    } catch (err) {
      console.error("Failed to load analytics data:", err);
      toast({
        title: t("analytics.loadFailed"),
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedDays, toast, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setContentVisible(false);
    await loadData();
  };

  const handleExport = async () => {
    try {
      const endDate = new Date().toISOString().split("T")[0];
      const startDate = new Date(Date.now() - selectedDays * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      const blob = await api.exportAnalytics(startDate, endDate);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sync-analytics-${startDate}-to-${endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: t("analytics.exportSuccess"),
        description: t("analytics.exportSuccessDescription"),
      });
    } catch (err) {
      console.error("Failed to export analytics:", err);
      toast({
        title: t("analytics.exportFailed"),
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("analytics.page.title")}</h1>
          <p className="text-muted-foreground">{t("analytics.page.description")}</p>
        </div>
        <AnalyticsPageSkeleton />
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
            <h1 className="text-3xl font-bold tracking-tight">{t("analytics.page.title")}</h1>
            <p className="text-muted-foreground">{t("analytics.page.description")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
            <SelectTrigger className="w-[180px] rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-lg">
              {TIME_RANGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {t(`analytics.timeRange.${option.value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
          >
            <Download className="h-4 w-4 mr-2" />
            {t("analytics.export")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            {t("actions.refresh")}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div
        className={`
          grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4
          transition-all duration-300 ease-out
          ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
        `}
        style={{ transitionDelay: "50ms" }}
      >
        <StatCard
          title={t("analytics.totalSyncs")}
          value={formatNumber(summary?.total_syncs)}
          subtitle={`${formatNumber(summary?.syncs_last_24h)} ${t("analytics.last24h")}`}
          icon={<RefreshCw className="h-5 w-5" />}
          variant="default"
        />
        <StatCard
          title={t("analytics.avgDuration")}
          value={formatDuration(summary?.avg_duration_seconds || 0)}
          subtitle={`${t("analytics.fastest")}: ${formatDuration(summary?.fastest_sync_seconds || 0)}`}
          icon={<Timer className="h-5 w-5" />}
          variant="info"
        />
        <StatCard
          title={t("analytics.successRate")}
          value={`${(summary?.success_rate || 0).toFixed(1)}%`}
          subtitle={`${formatNumber(summary?.successful_syncs)} ${t("analytics.successful")}`}
          icon={<CheckCircle2 className="h-5 w-5" />}
          variant={summary?.success_rate && summary.success_rate >= 90 ? "success" : "warning"}
        />
        <StatCard
          title={t("analytics.avgThroughput")}
          value={formatThroughput(summary?.avg_throughput || 0)}
          subtitle={`${formatNumber(summary?.total_items_synced)} ${t("analytics.totalItems")}`}
          icon={<Zap className="h-5 w-5" />}
          variant="default"
        />
      </div>

      {/* Success Rate Donut + Quick Stats */}
      <div
        className={`
          grid gap-4 grid-cols-1 lg:grid-cols-3
          transition-all duration-300 ease-out
          ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
        `}
        style={{ transitionDelay: "100ms" }}
      >
        <Card className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">{t("analytics.successRateOverview")}</CardTitle>
            <CardDescription className="text-xs">{t("analytics.successRateDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-6">
            <DonutChart
              value={summary?.success_rate || 0}
              label={t("analytics.success")}
              color={
                (summary?.success_rate || 0) >= 90
                  ? "hsl(var(--primary))"
                  : (summary?.success_rate || 0) >= 70
                  ? "hsl(var(--warning))"
                  : "hsl(var(--destructive))"
              }
            />
          </CardContent>
        </Card>

        <Card className="rounded-xl border bg-card shadow-sm overflow-hidden lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-muted shadow-sm">
                <Activity className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">{t("analytics.recentActivity")}</CardTitle>
                <CardDescription className="text-xs">{t("analytics.recentActivityDescription")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-muted/30 border border-border/30 transition-all duration-200 hover:bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">{t("analytics.last24h")}</p>
                <p className="text-xl font-bold tabular-nums">{formatNumber(summary?.syncs_last_24h)}</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/30 border border-border/30 transition-all duration-200 hover:bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">{t("analytics.last7d")}</p>
                <p className="text-xl font-bold tabular-nums">{formatNumber(summary?.syncs_last_7d)}</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/30 border border-border/30 transition-all duration-200 hover:bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">{t("analytics.last30d")}</p>
                <p className="text-xl font-bold tabular-nums">{formatNumber(summary?.syncs_last_30d)}</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/30 border border-border/30 transition-all duration-200 hover:bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">{t("analytics.failedSyncs")}</p>
                <p className="text-xl font-bold tabular-nums text-destructive">{formatNumber(summary?.failed_syncs)}</p>
              </div>
            </div>
            {summary?.last_sync_at && (
              <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarClock className="h-3 w-3" />
                {t("analytics.lastSync")}: {formatDate(summary.last_sync_at)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Trend Charts */}
      <div
        className={`
          grid gap-4 grid-cols-1 lg:grid-cols-2
          transition-all duration-300 ease-out
          ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
        `}
        style={{ transitionDelay: "150ms" }}
      >
        <TrendChart
          data={trends}
          title={t("analytics.durationTrend")}
          description={t("analytics.durationTrendDescription")}
          valueKey="avg_duration_seconds"
          formatValue={(v) => formatDuration(v)}
          color="hsl(var(--primary))"
        />
        <TrendChart
          data={trends}
          title={t("analytics.throughputTrend")}
          description={t("analytics.throughputTrendDescription")}
          valueKey="avg_throughput"
          formatValue={(v) => formatThroughput(v)}
          color="hsl(142, 76%, 36%)"
        />
      </div>

      {/* Step Performance */}
      <div
        className={`
          grid gap-4 grid-cols-1 lg:grid-cols-2
          transition-all duration-300 ease-out
          ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
        `}
        style={{ transitionDelay: "200ms" }}
      >
        <StepBarChart
          data={stepAverages}
          title={t("analytics.stepDuration")}
          description={t("analytics.stepDurationDescription")}
          valueKey="avg_duration_seconds"
          formatValue={(v) => formatDuration(v)}
        />
        <StepBarChart
          data={stepAverages}
          title={t("analytics.stepThroughput")}
          description={t("analytics.stepThroughputDescription")}
          valueKey="avg_throughput"
          formatValue={(v) => formatThroughput(v)}
        />
      </div>

      {/* Bottlenecks Table */}
      <div
        className={`
          transition-all duration-300 ease-out
          ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
        `}
        style={{ transitionDelay: "250ms" }}
      >
        <Card className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <CardHeader className="pb-3 bg-muted/30 border-b">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-background shadow-sm">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">{t("analytics.bottlenecks")}</CardTitle>
                <CardDescription className="text-xs">{t("analytics.bottlenecksDescription")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {(bottlenecks ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="p-4 rounded-full bg-muted/50 mb-4">
                  <CheckCircle2 className="h-10 w-10 text-primary/50" />
                </div>
                <p className="font-medium text-foreground">{t("analytics.noBottlenecks")}</p>
                <p className="text-sm text-muted-foreground mt-1">{t("analytics.noBottlenecksDescription")}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead>{t("analytics.table.step")}</TableHead>
                    <TableHead>{t("analytics.table.syncType")}</TableHead>
                    <TableHead className="text-right">{t("analytics.table.duration")}</TableHead>
                    <TableHead className="text-right">{t("analytics.table.itemsProcessed")}</TableHead>
                    <TableHead className="text-right">{t("analytics.table.throughput")}</TableHead>
                    <TableHead>{t("analytics.table.date")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(bottlenecks ?? []).map((bottleneck, index) => (
                    <TableRow
                      key={`${bottleneck.sync_log_id}-${bottleneck.step_name}`}
                      className="transition-all duration-200 hover:bg-muted/50"
                    >
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {bottleneck.step_name}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{bottleneck.sync_type}</TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center gap-1.5 text-sm tabular-nums">
                          <Timer className="h-3 w-3 text-muted-foreground" />
                          {formatDurationMs(bottleneck.duration_ms)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums">
                        {formatNumber(bottleneck.items_processed)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums">
                        {formatThroughput(bottleneck.throughput)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(bottleneck.sync_date)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Step Statistics Details */}
      <div
        className={`
          transition-all duration-300 ease-out
          ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
        `}
        style={{ transitionDelay: "300ms" }}
      >
        <Card className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <CardHeader className="pb-3 bg-muted/30 border-b">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-background shadow-sm">
                <Database className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">{t("analytics.stepStats")}</CardTitle>
                <CardDescription className="text-xs">{t("analytics.stepStatsDescription")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {stepAverages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="p-4 rounded-full bg-muted/50 mb-4">
                  <BarChart3 className="h-10 w-10 text-muted-foreground/50" />
                </div>
                <p className="font-medium text-foreground">{t("analytics.noStepData")}</p>
                <p className="text-sm text-muted-foreground mt-1">{t("analytics.noStepDataDescription")}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead>{t("analytics.table.step")}</TableHead>
                    <TableHead className="text-right">{t("analytics.table.executions")}</TableHead>
                    <TableHead className="text-right">{t("analytics.table.avgDuration")}</TableHead>
                    <TableHead className="text-right">{t("analytics.table.minMax")}</TableHead>
                    <TableHead className="text-right">{t("analytics.table.avgItems")}</TableHead>
                    <TableHead className="text-right">{t("analytics.table.totalProcessed")}</TableHead>
                    <TableHead className="text-right">{t("analytics.table.failureRate")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stepAverages
                    .sort((a, b) => a.step_number - b.step_number)
                    .map((step) => (
                      <TableRow
                        key={step.step_name}
                        className="transition-all duration-200 hover:bg-muted/50"
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className="text-xs px-1.5 py-0.5 bg-muted/50"
                            >
                              {step.step_number}
                            </Badge>
                            <span className="font-medium capitalize">{step.step_name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm tabular-nums">
                          {formatNumber(step.total_executions)}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {formatDuration(step.avg_duration_seconds)}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                          {formatDurationMs(step.min_duration_ms)} - {formatDurationMs(step.max_duration_ms)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm tabular-nums">
                          {formatNumber(Math.round(step.avg_items_processed))}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm tabular-nums">
                          {formatNumber(step.total_items_processed)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={step.failure_rate > 10 ? "destructive" : step.failure_rate > 0 ? "secondary" : "outline"}
                            className={`text-xs ${
                              step.failure_rate === 0 ? "bg-primary/10 text-primary border-primary/20" : ""
                            }`}
                          >
                            {step.failure_rate.toFixed(1)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AnalyticsPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Summary Cards Skeleton */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-10 w-10 rounded-lg" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Donut + Quick Stats Skeleton */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <Card className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48 mt-1" />
          </CardHeader>
          <CardContent className="flex items-center justify-center py-6">
            <Skeleton className="h-32 w-32 rounded-full" />
          </CardContent>
        </Card>
        <Card className="rounded-xl border bg-card shadow-sm overflow-hidden lg:col-span-2">
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48 mt-1" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart Skeletons */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48 mt-1" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-40 w-full rounded-lg" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bar Chart Skeletons */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48 mt-1" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, j) => (
                  <div key={j} className="space-y-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-6 w-full rounded-lg" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table Skeleton */}
      <Card className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <CardHeader className="pb-3 bg-muted/30 border-b">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48 mt-1" />
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex items-center gap-4 p-4 border-b bg-muted/30">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-20" />
            ))}
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-4 border-b last:border-b-0"
              style={{ opacity: 1 - i * 0.15 }}
            >
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16 ml-auto" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
