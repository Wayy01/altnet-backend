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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

function DashboardSkeleton() {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, j) => (
                  <Skeleton key={j} className="h-12 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

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
    },
    {
      title: "Brands",
      value: (stats.total_brands ?? 0).toLocaleString(),
      icon: Building2,
      description: "Active brands",
      color: "text-primary",
      link: "/brands",
    },
    {
      title: "Categories",
      value: (stats.total_categories ?? 0).toLocaleString(),
      icon: FolderTree,
      description: "Product categories",
      color: "text-primary",
      link: "/categories",
    },
    {
      title: "Properties",
      value: (stats.total_properties ?? 0).toLocaleString(),
      icon: FileText,
      description: "Product specifications",
      color: "text-primary",
    },
    {
      title: "Characteristics",
      value: (stats.total_characteristics ?? 0).toLocaleString(),
      icon: Tags,
      description: "Product variants/SKUs",
      color: "text-primary",
    },
    {
      title: "Prices",
      value: (stats.total_prices ?? 0).toLocaleString(),
      icon: DollarSign,
      description: "Price entries",
      color: "text-primary",
    },
    {
      title: "Stock Entries",
      value: (stats.total_stock ?? 0).toLocaleString(),
      icon: Warehouse,
      description: "Stock records",
      color: "text-primary",
    },
    {
      title: "In Stock",
      value: (stats.in_stock_products ?? 0).toLocaleString(),
      icon: PackageCheck,
      description: "Products available",
      color: "text-primary",
      link: "/products?stock_filter=in_stock",
    },
    {
      title: "Low Stock",
      value: lowStockAlerts.length.toLocaleString(),
      icon: AlertTriangle,
      description: "Products with <= 5 stock",
      color: "text-destructive",
      link: "/products?stock_filter=low_stock",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header with Quick Actions */}
      <div className="flex items-center justify-between">
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
            <Button variant="outline" size="sm" asChild>
              <Link href="/sync">
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync Status
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/products?stock_filter=low_stock">
                <AlertTriangle className="mr-2 h-4 w-4" />
                Low Stock
              </Link>
            </Button>
            <Button size="sm" asChild>
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
        <Card className={latestSync.status === "completed" ? "border-primary" : "border-destructive"}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Last sync: {formatRelativeTime(latestSync.started_at)} •{" "}
              {(
                (latestSync.products_synced ?? 0) +
                (latestSync.brands_synced ?? 0) +
                (latestSync.categories_synced ?? 0)
              ).toLocaleString()}{" "}
              items • Duration: {formatDuration(latestSync.duration_seconds)}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat) =>
          stat.link ? (
            <Link
              key={stat.title}
              href={stat.link}
              className="block transition-transform hover:scale-105"
            >
              <Card className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {stat.title}
                  </CardTitle>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground">
                    {stat.description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ) : (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          )
        )}
      </div>

      {/* Three Column Grid: Recent Syncs, Low Stock, Stock Summary */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Recent Sync Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Recent Syncs
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/sync">
                View All
                <ExternalLink className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentSyncs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No sync activity recorded yet.
              </p>
            ) : (
              <div className="space-y-3">
                {recentSyncs.map((sync) => (
                  <div
                    key={sync.id}
                    className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center gap-2">
                      {sync.status === "completed" ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
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
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card className="border-destructive/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Low Stock Alerts
              {lowStockAlerts.length > 0 && (
                <Badge variant="destructive">{lowStockAlerts.length}</Badge>
              )}
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/products?stock_filter=low_stock">
                View All
                <ExternalLink className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {lowStockAlerts.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                All products have adequate stock levels
              </div>
            ) : (
              <div className="space-y-3">
                {lowStockAlerts.slice(0, 5).map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0"
                  >
                    <div>
                      <p className="text-sm font-medium line-clamp-1">
                        {product.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {product.code}
                        {product.brand_name && ` - ${product.brand_name}`}
                      </p>
                    </div>
                    <Badge
                      variant={
                        product.total_stock <= 2 ? "destructive" : "secondary"
                      }
                    >
                      {product.total_stock} left
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Categories by Stock */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Warehouse className="h-4 w-4" />
              Top Categories
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/categories">
                View All
                <ExternalLink className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {stockSummary.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No stock data available.
              </p>
            ) : (
              <div className="space-y-3">
                {stockSummary.slice(0, 5).map((category) => (
                  <div
                    key={category.id}
                    className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0"
                  >
                    <div>
                      <p className="text-sm font-medium line-clamp-1">
                        {category.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {category.product_count} products • Avg:{" "}
                        {category.avg_price.toFixed(2)} MDL
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {category.total_stock.toLocaleString()}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Price Distribution Widget */}
      {priceSummary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Price Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Under 100 MDL</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold">
                    {priceSummary.distribution.under_100.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground">products</span>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">100 - 500 MDL</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold">
                    {priceSummary.distribution["100_to_500"].toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground">products</span>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">500 - 1,000 MDL</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold">
                    {priceSummary.distribution["500_to_1000"].toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground">products</span>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Over 1,000 MDL</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold">
                    {priceSummary.distribution.over_1000.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground">products</span>
                </div>
              </div>
            </div>
            <Separator className="my-4" />
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Min Price</p>
                <p className="text-lg font-semibold">
                  {priceSummary.min_price !== null
                    ? `${priceSummary.min_price.toFixed(2)} MDL`
                    : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Max Price</p>
                <p className="text-lg font-semibold">
                  {priceSummary.max_price !== null
                    ? `${priceSummary.max_price.toFixed(2)} MDL`
                    : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Average Price</p>
                <p className="text-lg font-semibold">
                  {priceSummary.avg_price !== null
                    ? `${priceSummary.avg_price.toFixed(2)} MDL`
                    : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Median Price</p>
                <p className="text-lg font-semibold">
                  {priceSummary.median_price !== null
                    ? `${priceSummary.median_price.toFixed(2)} MDL`
                    : "N/A"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
