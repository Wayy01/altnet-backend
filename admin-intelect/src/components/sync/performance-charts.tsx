"use client";

import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  ResponsiveContainer,
  RadialBar,
  RadialBarChart,
  PolarAngleAxis,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
} from "lucide-react";
import { PerformanceTrend, StepAverages } from "@/types/analytics";
import { useTranslation } from "@/contexts/language-context";

// ============================================================================
// TREND LINE CHART (using Recharts AreaChart)
// ============================================================================

interface TrendChartProps {
  data: PerformanceTrend[];
  isLoading?: boolean;
  title: string;
  description?: string;
  valueKey: keyof PerformanceTrend;
  formatValue?: (value: number) => string;
  color?: string;
}

const trendChartConfig = {
  value: {
    label: "Value",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

export function TrendChart({
  data,
  isLoading,
  title,
  description,
  valueKey,
  formatValue = (v) => v.toLocaleString(),
  color = "hsl(var(--primary))",
}: TrendChartProps) {
  const { t } = useTranslation("sync");

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return [...data].reverse().map((d) => ({
      date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: Number(d[valueKey]) || 0,
      fullDate: d.date,
    }));
  }, [data, valueKey]);

  const trend = useMemo(() => {
    if (chartData.length < 2) return { direction: "neutral" as const, percentage: 0 };
    const first = chartData[0]?.value || 0;
    const last = chartData[chartData.length - 1]?.value || 0;
    const change = first > 0 ? ((last - first) / first) * 100 : 0;
    return {
      direction: change > 0 ? ("up" as const) : change < 0 ? ("down" as const) : ("neutral" as const),
      percentage: Math.abs(change),
    };
  }, [chartData]);

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

  const latestValue = chartData.length > 0 ? chartData[chartData.length - 1]?.value || 0 : 0;

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
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
            {t("analytics.noData")}
          </div>
        ) : (
          <ChartContainer config={trendChartConfig} className="h-40 w-full">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id={`fill-${valueKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={10}
                className="fill-muted-foreground"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={10}
                width={40}
                tickFormatter={(v) => formatValue(v)}
                className="fill-muted-foreground"
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, payload) => {
                      if (payload?.[0]?.payload?.fullDate) {
                        return new Date(payload[0].payload.fullDate).toLocaleDateString();
                      }
                      return "";
                    }}
                    formatter={(value) => formatValue(Number(value))}
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                fill={`url(#fill-${valueKey})`}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// STEP COMPARISON BAR CHART (using Recharts BarChart)
// ============================================================================

interface StepBarChartProps {
  data: StepAverages[];
  isLoading?: boolean;
  title: string;
  description?: string;
  valueKey: keyof StepAverages;
  formatValue?: (value: number) => string;
}

const stepChartConfig = {
  value: {
    label: "Value",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

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
    if (!data || data.length === 0) return [];
    return data
      .sort((a, b) => a.step_number - b.step_number)
      .map((d) => ({
        name: d.step_name,
        shortName: d.step_name.length > 12 ? d.step_name.slice(0, 12) + "..." : d.step_name,
        value: Number(d[valueKey]) || 0,
        executions: d.sync_count || d.total_executions || 0,
      }));
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
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
            {t("analytics.noData")}
          </div>
        ) : (
          <ChartContainer config={stepChartConfig} className="h-[280px] w-full">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} className="stroke-muted" />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={10}
                tickFormatter={(v) => formatValue(v)}
                className="fill-muted-foreground"
              />
              <YAxis
                type="category"
                dataKey="shortName"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={10}
                width={80}
                className="fill-muted-foreground"
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, payload) => {
                      if (payload?.[0]?.payload?.name) {
                        return `${payload[0].payload.name} (${payload[0].payload.executions} ${t("analytics.executions")})`;
                      }
                      return "";
                    }}
                    formatter={(value) => formatValue(Number(value))}
                  />
                }
              />
              <Bar
                dataKey="value"
                fill="hsl(var(--primary))"
                radius={[0, 4, 4, 0]}
                className="fill-primary"
              />
            </BarChart>
          </ChartContainer>
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
    info: "bg-accent/10 text-accent-foreground",
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
// MINI SPARKLINE (using Recharts AreaChart)
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
  const chartData = useMemo(() => {
    if (!data || data.length < 2) return [];
    return data.map((value, i) => ({
      index: i,
      value: Number.isFinite(value) ? value : 0,
    }));
  }, [data]);

  if (chartData.length < 2) return null;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="sparklineGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          fill="url(#sparklineGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ============================================================================
// DONUT CHART FOR SUCCESS RATE (using Recharts RadialBarChart)
// ============================================================================

interface DonutChartProps {
  value: number; // percentage 0-100
  label: string;
  size?: number;
  color?: string;
}

export function DonutChart({
  value,
  label,
  size = 120,
  color = "hsl(var(--primary))",
}: DonutChartProps) {
  const chartData = [
    {
      name: label,
      value: value,
      fill: color,
    },
  ];

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          cx="50%"
          cy="50%"
          innerRadius="70%"
          outerRadius="100%"
          barSize={12}
          data={chartData}
          startAngle={90}
          endAngle={-270}
        >
          <PolarAngleAxis
            type="number"
            domain={[0, 100]}
            angleAxisId={0}
            tick={false}
          />
          <RadialBar
            background={{ fill: "hsl(var(--muted))" }}
            dataKey="value"
            cornerRadius={6}
            fill={color}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums">{value.toFixed(1)}%</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}
