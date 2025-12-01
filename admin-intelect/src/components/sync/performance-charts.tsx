"use client";

import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Zap,
  Activity,
  BarChart3,
} from "lucide-react";
import { PerformanceTrend, StepAverages } from "@/types/analytics";
import { useTranslation } from "@/contexts/language-context";

// ============================================================================
// TREND LINE CHART
// ============================================================================

interface TrendChartProps {
  data: PerformanceTrend[];
  isLoading?: boolean;
  title: string;
  description?: string;
  valueKey: keyof PerformanceTrend;
  secondaryKey?: keyof PerformanceTrend;
  formatValue?: (value: number) => string;
  formatSecondary?: (value: number) => string;
  color?: string;
  secondaryColor?: string;
}

export function TrendChart({
  data,
  isLoading,
  title,
  description,
  valueKey,
  secondaryKey,
  formatValue = (v) => v.toLocaleString(),
  formatSecondary,
  color = "hsl(var(--primary))",
  secondaryColor = "hsl(var(--muted-foreground))",
}: TrendChartProps) {
  const { t } = useTranslation("sync");

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return { points: [], secondaryPoints: [], maxValue: 0, minValue: 0 };

    const values = data.map((d) => Number(d[valueKey]) || 0);
    const maxValue = Math.max(...values, 1);
    const minValue = Math.min(...values, 0);
    const range = maxValue - minValue || 1;

    const width = 100;
    const height = 100;
    const padding = 5;

    const points = data.map((d, i) => {
      const x = padding + (i / (data.length - 1 || 1)) * (width - padding * 2);
      const rawValue = Number(d[valueKey]);
      const value = Number.isFinite(rawValue) ? rawValue : 0;
      const y = height - padding - ((value - minValue) / range) * (height - padding * 2);
      // Ensure coordinates are finite numbers to prevent NaN in SVG attributes
      return {
        x: Number.isFinite(x) ? x : padding,
        y: Number.isFinite(y) ? y : height - padding,
        value,
        date: d.date,
      };
    });

    let secondaryPoints: typeof points = [];
    if (secondaryKey) {
      const secondaryValues = data.map((d) => Number(d[secondaryKey]) || 0);
      const secondaryMax = Math.max(...secondaryValues, 1);
      const secondaryMin = Math.min(...secondaryValues, 0);
      const secondaryRange = secondaryMax - secondaryMin || 1;

      secondaryPoints = data.map((d, i) => {
        const x = padding + (i / (data.length - 1 || 1)) * (width - padding * 2);
        const rawValue = Number(d[secondaryKey]);
        const value = Number.isFinite(rawValue) ? rawValue : 0;
        const y = height - padding - ((value - secondaryMin) / secondaryRange) * (height - padding * 2);
        // Ensure coordinates are finite numbers to prevent NaN in SVG attributes
        return {
          x: Number.isFinite(x) ? x : padding,
          y: Number.isFinite(y) ? y : height - padding,
          value,
          date: d.date,
        };
      });
    }

    return { points, secondaryPoints, maxValue, minValue };
  }, [data, valueKey, secondaryKey]);

  const trend = useMemo(() => {
    if (data.length < 2) return { direction: "neutral" as const, percentage: 0 };
    const first = Number(data[0]?.[valueKey]) || 0;
    const last = Number(data[data.length - 1]?.[valueKey]) || 0;
    const change = first > 0 ? ((last - first) / first) * 100 : 0;
    return {
      direction: change > 0 ? "up" as const : change < 0 ? "down" as const : "neutral" as const,
      percentage: Math.abs(change),
    };
  }, [data, valueKey]);

  const pathD = useMemo(() => {
    if (chartData.points.length < 2) return "";
    return chartData.points.reduce((path, point, i) => {
      return i === 0 ? `M ${point.x} ${point.y}` : `${path} L ${point.x} ${point.y}`;
    }, "");
  }, [chartData.points]);

  const secondaryPathD = useMemo(() => {
    if (chartData.secondaryPoints.length < 2) return "";
    return chartData.secondaryPoints.reduce((path, point, i) => {
      return i === 0 ? `M ${point.x} ${point.y}` : `${path} L ${point.x} ${point.y}`;
    }, "");
  }, [chartData.secondaryPoints]);

  const areaD = useMemo(() => {
    if (chartData.points.length < 2) return "";
    const base = pathD;
    const lastPoint = chartData.points[chartData.points.length - 1];
    const firstPoint = chartData.points[0];
    return `${base} L ${lastPoint.x} 100 L ${firstPoint.x} 100 Z`;
  }, [chartData.points, pathD]);

  if (isLoading) {
    return (
      <Card className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48 mt-1" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  const latestValue = data.length > 0 ? Number(data[data.length - 1]?.[valueKey]) || 0 : 0;

  return (
    <Card className="rounded-xl border bg-card shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
            {description && (
              <CardDescription className="text-xs mt-0.5">{description}</CardDescription>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold tabular-nums">{formatValue(latestValue)}</span>
            {trend.direction !== "neutral" && (
              <Badge
                variant="outline"
                className={`gap-1 text-xs ${
                  trend.direction === "up"
                    ? "bg-primary/10 text-primary border-primary/20"
                    : "bg-destructive/10 text-destructive border-destructive/20"
                }`}
              >
                {trend.direction === "up" ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {trend.percentage.toFixed(1)}%
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="relative h-40">
          {data.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              {t("analytics.noData")}
            </div>
          ) : (
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="w-full h-full"
            >
              {/* Grid lines */}
              <defs>
                <linearGradient id={`gradient-${valueKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                  <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Horizontal grid lines */}
              {[0, 25, 50, 75, 100].map((y) => (
                <line
                  key={y}
                  x1="5"
                  y1={y}
                  x2="95"
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity="0.1"
                  strokeDasharray="2,2"
                />
              ))}

              {/* Area fill */}
              {areaD && (
                <path
                  d={areaD}
                  fill={`url(#gradient-${valueKey})`}
                  className="transition-all duration-300"
                />
              )}

              {/* Secondary line */}
              {secondaryPathD && (
                <path
                  d={secondaryPathD}
                  fill="none"
                  stroke={secondaryColor}
                  strokeWidth="1.5"
                  strokeOpacity="0.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-all duration-300"
                />
              )}

              {/* Main line */}
              {pathD && (
                <path
                  d={pathD}
                  fill="none"
                  stroke={color}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-all duration-300"
                />
              )}

              {/* Data points */}
              {chartData.points.map((point, i) => (
                <circle
                  key={i}
                  cx={point.x}
                  cy={point.y}
                  r="2"
                  fill={color}
                  className="transition-all duration-300 hover:r-3"
                />
              ))}
            </svg>
          )}
        </div>

        {/* Legend */}
        {secondaryKey && formatSecondary && (
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: color }} />
              <span>{title}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 rounded-full opacity-50" style={{ backgroundColor: secondaryColor }} />
              <span>Secondary</span>
            </div>
          </div>
        )}

        {/* Date range */}
        {data.length > 0 && (
          <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
            <span>{new Date(data[0]?.date).toLocaleDateString()}</span>
            <span>{new Date(data[data.length - 1]?.date).toLocaleDateString()}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// STEP COMPARISON BAR CHART
// ============================================================================

interface StepBarChartProps {
  data: StepAverages[];
  isLoading?: boolean;
  title: string;
  description?: string;
  valueKey: keyof StepAverages;
  formatValue?: (value: number) => string;
}

export function StepBarChart({
  data,
  isLoading,
  title,
  description,
  valueKey,
  formatValue = (v) => v.toLocaleString(),
}: StepBarChartProps) {
  const { t } = useTranslation("sync");

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return { bars: [], maxValue: 0 };

    const values = data.map((d) => Number(d[valueKey]) || 0);
    const maxValue = Math.max(...values, 1);

    const bars = data.map((d) => ({
      name: d.step_name,
      value: Number(d[valueKey]) || 0,
      percentage: (Number(d[valueKey]) / maxValue) * 100,
      executions: d.total_executions,
    }));

    return { bars, maxValue };
  }, [data, valueKey]);

  if (isLoading) {
    return (
      <Card className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48 mt-1" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl border bg-card shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-muted shadow-sm">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
            {description && (
              <CardDescription className="text-xs mt-0.5">{description}</CardDescription>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {chartData.bars.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
            {t("analytics.noData")}
          </div>
        ) : (
          <div className="space-y-3">
            {chartData.bars.map((bar, index) => (
              <div
                key={bar.name}
                className="group transition-all duration-200"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium truncate max-w-[60%]">
                    {bar.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {bar.executions} {t("analytics.executions")}
                    </span>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatValue(bar.value)}
                    </span>
                  </div>
                </div>
                <div className="relative h-6 rounded-lg bg-muted/50 overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 rounded-lg bg-gradient-to-r from-primary/80 to-primary transition-all duration-500 ease-out group-hover:opacity-90"
                    style={{ width: `${bar.percentage}%` }}
                  />
                  <div className="absolute inset-0 flex items-center px-2">
                    <span className="text-[10px] font-medium text-primary-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                      {bar.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// STAT CARD
// ============================================================================

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: {
    direction: "up" | "down" | "neutral";
    value: string;
  };
  variant?: "default" | "success" | "warning" | "info";
  isLoading?: boolean;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  variant = "default",
  isLoading,
}: StatCardProps) {
  if (isLoading) {
    return (
      <Card className="rounded-xl border bg-card shadow-sm overflow-hidden">
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
    );
  }

  const variantStyles = {
    default: "bg-muted",
    success: "bg-primary/10 text-primary",
    warning: "bg-destructive/10 text-destructive",
    info: "bg-blue-500/10 text-blue-600",
  };

  return (
    <Card className="rounded-xl border bg-card shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1 tabular-nums">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
            {trend && trend.direction !== "neutral" && (
              <div className="flex items-center gap-1 mt-2">
                {trend.direction === "up" ? (
                  <TrendingUp className="h-3 w-3 text-primary" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-destructive" />
                )}
                <span
                  className={`text-xs font-medium ${
                    trend.direction === "up" ? "text-primary" : "text-destructive"
                  }`}
                >
                  {trend.value}
                </span>
              </div>
            )}
          </div>
          <div
            className={`p-2.5 rounded-xl shadow-sm transition-colors ${variantStyles[variant]}`}
          >
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// MINI SPARKLINE
// ============================================================================

interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
}

export function Sparkline({
  data,
  color = "hsl(var(--primary))",
  height = 24,
}: SparklineProps) {
  const pathD = useMemo(() => {
    if (!data || data.length < 2) return "";

    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;

    const points = data.map((value, i) => {
      const safeValue = Number.isFinite(value) ? value : 0;
      const x = (i / (data.length - 1 || 1)) * 100;
      const y = height - ((safeValue - min) / range) * height;
      // Ensure coordinates are finite numbers to prevent NaN in SVG attributes
      return {
        x: Number.isFinite(x) ? x : 0,
        y: Number.isFinite(y) ? y : height,
      };
    });

    return points.reduce((path, point, i) => {
      return i === 0 ? `M ${point.x} ${point.y}` : `${path} L ${point.x} ${point.y}`;
    }, "");
  }, [data, height]);

  if (data.length < 2) return null;

  return (
    <svg
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
    >
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ============================================================================
// DONUT CHART FOR SUCCESS RATE
// ============================================================================

interface DonutChartProps {
  value: number; // percentage 0-100
  label: string;
  size?: number;
  strokeWidth?: number;
  color?: string;
  backgroundColor?: string;
}

export function DonutChart({
  value,
  label,
  size = 120,
  strokeWidth = 12,
  color = "hsl(var(--primary))",
  backgroundColor = "hsl(var(--muted))",
}: DonutChartProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums">{value.toFixed(1)}%</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}
