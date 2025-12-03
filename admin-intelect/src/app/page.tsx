"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Package,
  Building2,
  FolderTree,
  FileText,
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
  Layers,
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
import { VariantStats } from "@/types/variants";
import { useLocalizedValue, useTranslation } from "@/contexts/language-context";
import { StatCard } from "@/components/dashboard/stat-card";

interface DashboardData {
  stats: DashboardStats;
  latestSync: SyncLog | null;
  lowStockAlerts: LowStockAlert[];
  recentSyncs: SyncLog[];
  stockSummary: StockSummaryItem[];
  priceSummary: PriceSummary | null;
  variantStats: VariantStats | null;
}

function formatDuration(seconds: number | null, t: any): string {
  if (seconds === null) return t("time.na");
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
 * Enhanced skeleton loader with staggered animations - Compact version
 */
function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>

      {/* Stats cards skeleton with staggered animation */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border bg-card shadow-sm p-5 animate-pulse"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="flex items-center justify-between mb-2.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-4 w-4" />
            </div>
            <Skeleton className="h-7 w-16 mb-1.5" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>

      {/* Bottom sections skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border bg-card shadow-sm p-4 animate-pulse"
            style={{ animationDelay: `${(i + 9) * 50}ms` }}
          >
            <div className="flex items-center justify-between mb-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-7 w-20" />
            </div>
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, j) => (
                <Skeleton key={j} className="h-10 w-full" />
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
  const { localize } = useLocalizedValue();
  const { t } = useTranslation("dashboard");
  const { t: tCommon } = useTranslation("common");

  async function fetchDashboardData(): Promise<DashboardData> {
    const [
      stats,
      latestSync,
      lowStockAlerts,
      recentSyncsRes,
      stockSummary,
      priceSummary,
      variantStats,
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
      api.getVariantStats().catch((error) => {
        console.error("Failed to fetch variant stats:", error);
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
      variantStats,
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
          <h1 className="text-3xl font-bold tracking-tight">{t("page.title")}</h1>
          <p className="text-muted-foreground">
            {t("page.description")}
          </p>
        </div>
        <DashboardSkeleton />
      </div>
    );
  }

  const { stats, latestSync, lowStockAlerts, recentSyncs, stockSummary, priceSummary, variantStats } = data;

  // Define stat cards with 4-tier color hierarchy
  const statCardData = [
    // Tier 1: Hero metrics (Primary with gradient)
    {
      title: t("stats.totalProducts"),
      value: (stats.total_products ?? 0).toLocaleString(),
      icon: Package,
      description: t("descriptions.productsInCatalog"),
      variant: "hero" as const,
      link: "/products",
    },
    {
      title: t("stats.brands"),
      value: (stats.total_brands ?? 0).toLocaleString(),
      icon: Building2,
      description: t("descriptions.activeBrands"),
      variant: "hero" as const,
      link: "/brands",
    },
    {
      title: t("variants.groups"),
      value: (variantStats?.total_groups ?? 0).toLocaleString(),
      icon: Layers,
      description: t("variants.aiGenerated"),
      variant: "hero" as const,
      link: "/variants",
    },
    // Tier 2: Important metrics
    {
      title: t("stats.categories"),
      value: (stats.total_categories ?? 0).toLocaleString(),
      icon: FolderTree,
      description: t("descriptions.productCategories"),
      variant: "important" as const,
      link: "/categories",
    },
    {
      title: t("stats.inStock"),
      value: (stats.in_stock_products ?? 0).toLocaleString(),
      icon: PackageCheck,
      description: t("descriptions.productsAvailable"),
      variant: "important" as const,
      link: "/products?stock_filter=in_stock",
    },
    // Tier 3: Contextual metrics
    {
      title: t("stats.properties"),
      value: (stats.total_properties ?? 0).toLocaleString(),
      icon: FileText,
      description: t("descriptions.productSpecifications"),
      variant: "contextual" as const,
    },
    {
      title: t("stats.prices"),
      value: (stats.total_prices ?? 0).toLocaleString(),
      icon: DollarSign,
      description: t("descriptions.priceEntries"),
      variant: "contextual" as const,
    },
    {
      title: t("stats.stockEntries"),
      value: (stats.total_stock ?? 0).toLocaleString(),
      icon: Warehouse,
      description: t("descriptions.stockRecords"),
      variant: "contextual" as const,
    },
    // Tier 4: Alert metric
    {
      title: t("stats.lowStock"),
      value: lowStockAlerts.length.toLocaleString(),
      icon: AlertTriangle,
      description: t("descriptions.productsLowStock"),
      variant: "alert" as const,
      link: "/products?stock_filter=low_stock",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header with Integrated Status */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("page.title")}</h1>
          <div className="flex items-center gap-3 mt-1.5">
            <p className="text-sm text-muted-foreground">
              {t("page.description")}
            </p>
            {latestSync && (
              <>
                <span className="text-muted-foreground/50">•</span>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={latestSync.status === "completed" ? "default" : "destructive"}
                    className={`text-xs ${
                      latestSync.status === "completed"
                        ? "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                        : "bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20"
                    }`}
                  >
                    {latestSync.status === "completed" ? tCommon("status.healthy") : tCommon("status.issuesDetected")}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {t("time.lastSync")} {formatRelativeTime(latestSync.started_at)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <p className="text-xs text-muted-foreground">
            {tCommon("time.lastUpdated")}: {lastUpdated.toLocaleTimeString()}
          </p>
          <Button
            variant="outline"
            size="sm"
            asChild
            className="transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
          >
            <Link href="/sync">
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("buttons.sync")}
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
              {t("buttons.alerts")}
            </Link>
          </Button>
        </div>
      </div>

      {/* Stat Cards - Using new StatCard component with 4-tier hierarchy */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {statCardData.map((card, index) => (
          <StatCard
            key={card.title}
            title={card.title}
            value={card.value}
            description={card.description}
            icon={card.icon}
            variant={card.variant}
            link={card.link}
            animationDelay={Math.min(index * 30, 300)}
            isVisible={cardsVisible}
          />
        ))}
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
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-muted">
                  <RefreshCw className="h-4 w-4 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-sm">{t("cards.recentSyncs")}</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="text-xs transition-all duration-200 hover:bg-primary/10 hover:text-primary h-7"
              >
                <Link href="/sync">
                  {tCommon("actions.viewAll")}
                  <ExternalLink className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </div>
          </div>
          <div className="p-3">
            {recentSyncs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6">
                <div className="p-2.5 rounded-full bg-muted/50 mb-2">
                  <RefreshCw className="h-5 w-5 text-muted-foreground/50" />
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("sync.noSyncActivity")}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentSyncs.map((sync) => (
                  <div
                    key={sync.id}
                    className="flex items-center justify-between p-2.5 rounded-lg border transition-all duration-200 hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`
                        p-1 rounded-full
                        ${sync.status === "completed"
                          ? "bg-primary/10"
                          : "bg-destructive/10"
                        }
                      `}>
                        {sync.status === "completed" ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-destructive" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-medium">{sync.sync_type}</p>
                        <p className="text-xs text-muted-foreground">
                          {(
                            (sync.products_synced ?? 0) +
                            (sync.brands_synced ?? 0) +
                            (sync.categories_synced ?? 0)
                          ).toLocaleString()}{" "}
                          {t("common.items")}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        {formatRelativeTime(sync.started_at)}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDuration(sync.duration_seconds, t)}
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
          <div className="p-4 border-b border-destructive/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`
                  p-1.5 rounded-lg
                  ${lowStockAlerts.length > 0 ? "bg-destructive/10" : "bg-muted"}
                `}>
                  <AlertTriangle className={`h-4 w-4 ${lowStockAlerts.length > 0 ? "text-destructive" : "text-muted-foreground"}`} />
                </div>
                <h3 className="font-semibold text-sm">{t("cards.lowStockAlerts")}</h3>
                {lowStockAlerts.length > 0 && (
                  <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20 text-xs">
                    {lowStockAlerts.length}
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="text-xs transition-all duration-200 hover:bg-destructive/10 hover:text-destructive h-7"
              >
                <Link href="/products?stock_filter=low_stock">
                  {tCommon("actions.viewAll")}
                  <ExternalLink className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </div>
          </div>
          <div className="p-3">
            {lowStockAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6">
                <div className="p-2.5 rounded-full bg-primary/10 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                </div>
                <p className="text-xs font-medium text-foreground">{t("stock.allClear")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("stock.adequateStock")}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {lowStockAlerts.slice(0, 5).map((product) => (
                  <Link
                    key={product.id}
                    href={`/products/${product.id}`}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-destructive/10 hover:bg-destructive/5 transition-all duration-200"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium line-clamp-1">
                        {localize(product, "name")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {product.code}
                        {product.brand_name && ` | ${product.brand_name}`}
                      </p>
                    </div>
                    <Badge
                      variant={product.total_stock <= 2 ? "destructive" : "secondary"}
                      className={`ml-2 shrink-0 text-xs ${
                        product.total_stock <= 2
                          ? "bg-destructive/10 text-destructive border-destructive/20"
                          : ""
                      }`}
                    >
                      {product.total_stock} {t("stock.left")}
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
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-muted">
                  <Warehouse className="h-4 w-4 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-sm">{t("cards.topCategories")}</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="text-xs transition-all duration-200 hover:bg-primary/10 hover:text-primary h-7"
              >
                <Link href="/categories">
                  {tCommon("actions.viewAll")}
                  <ExternalLink className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </div>
          </div>
          <div className="p-3">
            {stockSummary.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6">
                <div className="p-2.5 rounded-full bg-muted/50 mb-2">
                  <Warehouse className="h-5 w-5 text-muted-foreground/50" />
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("stock.noStockData")}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {stockSummary.slice(0, 5).map((category) => (
                  <Link
                    key={category.id}
                    href={`/categories/${category.id}`}
                    className="flex items-center justify-between p-2.5 rounded-lg border hover:bg-muted/50 transition-all duration-200"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium line-clamp-1">
                        {localize(category, "name")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {category.product_count} {t("category.products")} | {t("category.avg")}:{" "}
                        {category.avg_price.toFixed(2)} MDL
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className="ml-2 shrink-0 text-xs bg-primary/10 text-primary border-primary/20"
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

      {/* Price Distribution Widget - Compact */}
      {priceSummary && (
        <div
          className={`
            rounded-xl border bg-card shadow-sm overflow-hidden
            transition-all duration-300
            ${cardsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
          `}
          style={{ transitionDelay: cardsVisible ? "500ms" : "0ms" }}
        >
          <div className="p-4 border-b">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-muted">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-sm">{t("cards.priceDistribution")}</h3>
            </div>
          </div>
          <div className="p-4">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 mb-4">
              <div className="p-3 rounded-lg bg-muted/30 border transition-all duration-200 hover:bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">{t("price.under100")}</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold tabular-nums">
                    {priceSummary.distribution.under_100.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground">{t("price.products")}</span>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 border transition-all duration-200 hover:bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">{t("price.range100to500")}</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold tabular-nums">
                    {priceSummary.distribution["100_to_500"].toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground">{t("price.products")}</span>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 border transition-all duration-200 hover:bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">{t("price.range500to1000")}</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold tabular-nums">
                    {priceSummary.distribution["500_to_1000"].toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground">{t("price.products")}</span>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 border transition-all duration-200 hover:bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">{t("price.over1000")}</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold tabular-nums">
                    {priceSummary.distribution.over_1000.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground">{t("price.products")}</span>
                </div>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="flex items-center gap-2.5 p-2.5 rounded-lg border">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <TrendingDown className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("price.minPrice")}</p>
                  <p className="text-sm font-semibold tabular-nums">
                    {priceSummary.min_price !== null
                      ? `${priceSummary.min_price.toFixed(2)} MDL`
                      : "N/A"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 p-2.5 rounded-lg border">
                <div className="p-1.5 rounded-lg bg-destructive/10">
                  <TrendingUp className="h-3.5 w-3.5 text-destructive" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("price.maxPrice")}</p>
                  <p className="text-sm font-semibold tabular-nums">
                    {priceSummary.max_price !== null
                      ? `${priceSummary.max_price.toFixed(2)} MDL`
                      : "N/A"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 p-2.5 rounded-lg border">
                <div className="p-1.5 rounded-lg bg-muted">
                  <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("price.avgPrice")}</p>
                  <p className="text-sm font-semibold tabular-nums">
                    {priceSummary.avg_price !== null
                      ? `${priceSummary.avg_price.toFixed(2)} MDL`
                      : "N/A"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 p-2.5 rounded-lg border">
                <div className="p-1.5 rounded-lg bg-muted">
                  <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("price.medianPrice")}</p>
                  <p className="text-sm font-semibold tabular-nums">
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
