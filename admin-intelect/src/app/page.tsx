"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Package,
  Building2,
  FolderTree,
  FileText,
  Tags,
  DollarSign,
  Warehouse,
  PackageCheck,
  AlertTriangle,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import {
  DashboardStats,
  SyncLog,
  LowStockAlert,
  StockSummaryItem,
  PriceSummary,
} from "@/types";

interface DashboardData {
  stats: DashboardStats;
  latestSync: SyncLog | null;
  lowStockAlerts: LowStockAlert[];
  recentSyncs: SyncLog[];
  stockSummary: StockSummaryItem[];
  priceSummary: PriceSummary | null;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "N/A";
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
}

/**
 * Enhanced skeleton loader with staggered animations
 */
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>

      {/* Status card skeleton */}
      <Skeleton className="h-20 w-full rounded-xl" />

      {/* Stats cards skeleton with staggered animation */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border bg-card shadow-sm p-6 animate-pulse"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </div>
            <Skeleton className="h-8 w-16 mb-2" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>

      {/* Bottom sections skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border bg-card shadow-sm p-6 animate-pulse"
            style={{ animationDelay: `${(i + 9) * 50}ms` }}
          >
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-8 w-20" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <Skeleton key={j} className="h-12 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [cardsVisible, setCardsVisible] = useState(false);

  async function fetchDashboardData(): Promise<DashboardData> {
    const [
      stats,
      latestSync,
      lowStockAlerts,
      recentSyncsRes,
      stockSummary,
      priceSummary,
    ] = await Promise.all([
      api.getDashboardStats(),
      api.getLatestSyncLog(),
      api.getLowStockProducts(10).catch((error) => {
        console.error("Failed to fetch low stock products:", error);
        return [];
      }),
      api.getSyncLogs(5, 0).catch((error) => {
        console.error("Failed to fetch recent sync logs:", error);
        return { data: [], total: 0 };
      }),
      api.getStockSummary().catch((error) => {
        console.error("Failed to fetch stock summary:", error);
        return [];
      }),
      api.getPriceSummary().catch((error) => {
        console.error("Failed to fetch price summary:", error);
        return null;
      }),
    ]);

    return {
      stats,
      latestSync,
      lowStockAlerts,
      recentSyncs: recentSyncsRes.data,
      stockSummary,
      priceSummary,
    };
  }

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const result = await fetchDashboardData();
        if (cancelled) return;
        setData(result);
        setLastUpdated(new Date());
        // Trigger staggered card animation after data loads
        setTimeout(() => setCardsVisible(true), 50);
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of Ultra B2B product data
          </p>
        </div>
        <DashboardSkeleton />
      </div>
    );
  }

  const { stats, latestSync, lowStockAlerts, recentSyncs, stockSummary, priceSummary } = data;

  const statCards = [
    {
      title: "Total Products",
      value: (stats.total_products ?? 0).toLocaleString(),
      icon: Package,
      description: "Products in catalog",
      color: "text-primary",
      link: "/products",
      variant: "default" as const,
    },
    {
      title: "Brands",
      value: (stats.total_brands ?? 0).toLocaleString(),
      icon: Building2,
      description: "Active brands",
      color: "text-primary",
      link: "/brands",
      variant: "default" as const,
    },
    {
      title: "Categories",
      value: (stats.total_categories ?? 0).toLocaleString(),
      icon: FolderTree,
      description: "Product categories",
      color: "text-primary",
      link: "/categories",
      variant: "default" as const,
    },
    {
      title: "Properties",
      value: (stats.total_properties ?? 0).toLocaleString(),
      icon: FileText,
      description: "Product specifications",
      color: "text-muted-foreground",
      variant: "muted" as const,
    },
    {
      title: "Characteristics",
      value: (stats.total_characteristics ?? 0).toLocaleString(),
      icon: Tags,
      description: "Product variants/SKUs",
      color: "text-muted-foreground",
      variant: "muted" as const,
    },
    {
      title: "Prices",
      value: (stats.total_prices ?? 0).toLocaleString(),
      icon: DollarSign,
      description: "Price entries",
      color: "text-muted-foreground",
      variant: "muted" as const,
    },
    {
      title: "Stock Entries",
      value: (stats.total_stock ?? 0).toLocaleString(),
      icon: Warehouse,
      description: "Stock records",
      color: "text-muted-foreground",
      variant: "muted" as const,
    },
    {
      title: "In Stock",
      value: (stats.in_stock_products ?? 0).toLocaleString(),
      icon: PackageCheck,
      description: "Products available",
      color: "text-primary",
      link: "/products?stock_filter=in_stock",
      variant: "success" as const,
    },
    {
      title: "Low Stock",
      value: lowStockAlerts.length.toLocaleString(),
      icon: AlertTriangle,
      description: "Products with <= 5 stock",
      color: "text-destructive",
      link: "/products?stock_filter=low_stock",
      variant: "warning" as const,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header with Quick Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of Ultra B2B product data
          </p>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-xs text-muted-foreground">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              asChild
              className="transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
            >
              <Link href="/sync">
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync Status
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
            >
              <Link href="/products?stock_filter=low_stock">
                <AlertTriangle className="mr-2 h-4 w-4" />
                Low Stock
              </Link>
            </Button>
            <Button
              size="sm"
              asChild
              className="transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
            >
              <Link href="/products">
                <Package className="mr-2 h-4 w-4" />
                Products
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* System Status Card */}
      {latestSync && (
        <div
          className={`
            rounded-xl border shadow-sm p-4 transition-all duration-300
            ${latestSync.status === "completed"
              ? "bg-primary/5 border-primary/20"
              : latestSync.status === "failed"
              ? "bg-destructive/5 border-destructive/20"
              : "bg-muted/50 border-border"
            }
            ${cardsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
          `}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`
                p-2 rounded-lg
                ${latestSync.status === "completed"
                  ? "bg-primary/10"
                  : latestSync.status === "failed"
                  ? "bg-destructive/10"
                  : "bg-muted"
                }
              `}>
                {latestSync.status === "completed" ? (
                  <Activity className="h-5 w-5 text-primary" />
                ) : latestSync.status === "failed" ? (
                  <XCircle className="h-5 w-5 text-destructive" />
                ) : (
                  <Clock className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-medium flex items-center gap-2">
                  System Status
                  <Badge
                    variant={latestSync.status === "completed" ? "default" : "destructive"}
                    className={`text-xs ${
                      latestSync.status === "completed"
                        ? "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                        : "bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20"
                    }`}
                  >
                    {latestSync.status === "completed" ? "Healthy" : "Issues Detected"}
                  </Badge>
                </h3>
                <p className="text-sm text-muted-foreground">
                  Last sync: {formatRelativeTime(latestSync.started_at)} | {" "}
                  {(
                    (latestSync.products_synced ?? 0) +
                    (latestSync.brands_synced ?? 0) +
                    (latestSync.categories_synced ?? 0)
                  ).toLocaleString()}{" "}
                  items synced | Duration: {formatDuration(latestSync.duration_seconds)}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="transition-all duration-200 hover:bg-primary/10 hover:text-primary"
            >
              <Link href="/sync">
                View Details
                <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* Stat Cards - Enhanced with premium styling */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat, index) => {
          const cardClassName = `
            block rounded-xl border bg-card shadow-sm overflow-hidden
            transition-all duration-200 ease-out
            ${stat.link ? "cursor-pointer hover:shadow-md hover:-translate-y-1" : ""}
            ${stat.variant === "success" ? "border-primary/20 hover:border-primary/40" : ""}
            ${stat.variant === "warning" ? "border-destructive/20 hover:border-destructive/40" : ""}
            ${cardsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
          `;
          const cardStyle = {
            transitionDelay: cardsVisible ? `${Math.min(index * 30, 300)}ms` : "0ms",
          };

          const cardContent = (
            <>
              <div className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </span>
                  <div className={`
                    p-1.5 rounded-lg transition-colors
                    ${stat.variant === "success" ? "bg-primary/10" : ""}
                    ${stat.variant === "warning" ? "bg-destructive/10" : ""}
                    ${stat.variant === "default" || stat.variant === "muted" ? "bg-muted" : ""}
                  `}>
                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                </div>
                <div className="text-2xl font-bold tabular-nums">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.description}
                </p>
              </div>
              {stat.link && (
                <div className="px-6 py-2 bg-muted/30 border-t">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    View all
                    <ExternalLink className="h-3 w-3" />
                  </span>
                </div>
              )}
            </>
          );

          return stat.link ? (
            <Link
              key={stat.title}
              href={stat.link}
              className={cardClassName}
              style={cardStyle}
            >
              {cardContent}
            </Link>
          ) : (
            <div
              key={stat.title}
              className={cardClassName}
              style={cardStyle}
            >
              {cardContent}
            </div>
          );
        })}
      </div>

      {/* Three Column Grid: Recent Syncs, Low Stock, Stock Summary */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Recent Sync Activity */}
        <div
          className={`
            rounded-xl border bg-card shadow-sm overflow-hidden
            transition-all duration-300
            ${cardsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
          `}
          style={{ transitionDelay: cardsVisible ? "350ms" : "0ms" }}
        >
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-muted">
                  <RefreshCw className="h-4 w-4 text-muted-foreground" />
                </div>
                <h3 className="font-semibold">Recent Syncs</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="text-xs transition-all duration-200 hover:bg-primary/10 hover:text-primary"
              >
                <Link href="/sync">
                  View All
                  <ExternalLink className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </div>
          </div>
          <div className="p-4">
            {recentSyncs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="p-3 rounded-full bg-muted/50 mb-3">
                  <RefreshCw className="h-6 w-6 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground">
                  No sync activity recorded yet.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentSyncs.map((sync, index) => (
                  <div
                    key={sync.id}
                    className={`
                      flex items-center justify-between p-3 rounded-lg border
                      transition-all duration-200 hover:bg-muted/50
                      ${index !== recentSyncs.length - 1 ? "" : ""}
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`
                        p-1.5 rounded-full
                        ${sync.status === "completed"
                          ? "bg-primary/10"
                          : "bg-destructive/10"
                        }
                      `}>
                        {sync.status === "completed" ? (
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{sync.sync_type}</p>
                        <p className="text-xs text-muted-foreground">
                          {(
                            (sync.products_synced ?? 0) +
                            (sync.brands_synced ?? 0) +
                            (sync.categories_synced ?? 0)
                          ).toLocaleString()}{" "}
                          items
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        {formatRelativeTime(sync.started_at)}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDuration(sync.duration_seconds)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div
          className={`
            rounded-xl border shadow-sm overflow-hidden
            transition-all duration-300
            ${lowStockAlerts.length > 0
              ? "bg-destructive/5 border-destructive/20"
              : "bg-card border-border"
            }
            ${cardsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
          `}
          style={{ transitionDelay: cardsVisible ? "400ms" : "0ms" }}
        >
          <div className="p-6 border-b border-destructive/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`
                  p-1.5 rounded-lg
                  ${lowStockAlerts.length > 0 ? "bg-destructive/10" : "bg-muted"}
                `}>
                  <AlertTriangle className={`h-4 w-4 ${lowStockAlerts.length > 0 ? "text-destructive" : "text-muted-foreground"}`} />
                </div>
                <h3 className="font-semibold">Low Stock Alerts</h3>
                {lowStockAlerts.length > 0 && (
                  <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20">
                    {lowStockAlerts.length}
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="text-xs transition-all duration-200 hover:bg-destructive/10 hover:text-destructive"
              >
                <Link href="/products?stock_filter=low_stock">
                  View All
                  <ExternalLink className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </div>
          </div>
          <div className="p-4">
            {lowStockAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="p-3 rounded-full bg-primary/10 mb-3">
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                </div>
                <p className="text-sm font-medium text-foreground">All Clear</p>
                <p className="text-xs text-muted-foreground mt-1">
                  All products have adequate stock levels
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {lowStockAlerts.slice(0, 5).map((product) => (
                  <Link
                    key={product.id}
                    href={`/products/${product.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border border-destructive/10 hover:bg-destructive/5 transition-all duration-200"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium line-clamp-1">
                        {product.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {product.code}
                        {product.brand_name && ` | ${product.brand_name}`}
                      </p>
                    </div>
                    <Badge
                      variant={product.total_stock <= 2 ? "destructive" : "secondary"}
                      className={`ml-2 shrink-0 ${
                        product.total_stock <= 2
                          ? "bg-destructive/10 text-destructive border-destructive/20"
                          : ""
                      }`}
                    >
                      {product.total_stock} left
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Top Categories by Stock */}
        <div
          className={`
            rounded-xl border bg-card shadow-sm overflow-hidden
            transition-all duration-300
            ${cardsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
          `}
          style={{ transitionDelay: cardsVisible ? "450ms" : "0ms" }}
        >
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-muted">
                  <Warehouse className="h-4 w-4 text-muted-foreground" />
                </div>
                <h3 className="font-semibold">Top Categories</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="text-xs transition-all duration-200 hover:bg-primary/10 hover:text-primary"
              >
                <Link href="/categories">
                  View All
                  <ExternalLink className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </div>
          </div>
          <div className="p-4">
            {stockSummary.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="p-3 rounded-full bg-muted/50 mb-3">
                  <Warehouse className="h-6 w-6 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground">
                  No stock data available.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {stockSummary.slice(0, 5).map((category) => (
                  <Link
                    key={category.id}
                    href={`/categories/${category.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-all duration-200"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium line-clamp-1">
                        {category.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {category.product_count} products | Avg:{" "}
                        {category.avg_price.toFixed(2)} MDL
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className="ml-2 shrink-0 bg-primary/10 text-primary border-primary/20"
                    >
                      {category.total_stock.toLocaleString()}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Price Distribution Widget */}
      {priceSummary && (
        <div
          className={`
            rounded-xl border bg-card shadow-sm overflow-hidden
            transition-all duration-300
            ${cardsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
          `}
          style={{ transitionDelay: cardsVisible ? "500ms" : "0ms" }}
        >
          <div className="p-6 border-b">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-muted">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </div>
              <h3 className="font-semibold">Price Distribution</h3>
            </div>
          </div>
          <div className="p-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <div className="p-4 rounded-lg bg-muted/30 border transition-all duration-200 hover:bg-muted/50 hover:shadow-sm">
                <p className="text-sm text-muted-foreground mb-1">Under 100 MDL</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold tabular-nums">
                    {priceSummary.distribution.under_100.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground">products</span>
                </div>
              </div>
              <div className="p-4 rounded-lg bg-muted/30 border transition-all duration-200 hover:bg-muted/50 hover:shadow-sm">
                <p className="text-sm text-muted-foreground mb-1">100 - 500 MDL</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold tabular-nums">
                    {priceSummary.distribution["100_to_500"].toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground">products</span>
                </div>
              </div>
              <div className="p-4 rounded-lg bg-muted/30 border transition-all duration-200 hover:bg-muted/50 hover:shadow-sm">
                <p className="text-sm text-muted-foreground mb-1">500 - 1,000 MDL</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold tabular-nums">
                    {priceSummary.distribution["500_to_1000"].toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground">products</span>
                </div>
              </div>
              <div className="p-4 rounded-lg bg-muted/30 border transition-all duration-200 hover:bg-muted/50 hover:shadow-sm">
                <p className="text-sm text-muted-foreground mb-1">Over 1,000 MDL</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold tabular-nums">
                    {priceSummary.distribution.over_1000.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground">products</span>
                </div>
              </div>
            </div>
            <Separator className="my-6" />
            <div className="grid gap-4 md:grid-cols-4">
              <div className="flex items-center gap-3 p-3 rounded-lg border">
                <div className="p-2 rounded-lg bg-primary/10">
                  <TrendingDown className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Min Price</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {priceSummary.min_price !== null
                      ? `${priceSummary.min_price.toFixed(2)} MDL`
                      : "N/A"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg border">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <TrendingUp className="h-4 w-4 text-destructive" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Max Price</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {priceSummary.max_price !== null
                      ? `${priceSummary.max_price.toFixed(2)} MDL`
                      : "N/A"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg border">
                <div className="p-2 rounded-lg bg-muted">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Average Price</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {priceSummary.avg_price !== null
                      ? `${priceSummary.avg_price.toFixed(2)} MDL`
                      : "N/A"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg border">
                <div className="p-2 rounded-lg bg-muted">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Median Price</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {priceSummary.median_price !== null
                      ? `${priceSummary.median_price.toFixed(2)} MDL`
                      : "N/A"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
