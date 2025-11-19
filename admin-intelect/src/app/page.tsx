import { Suspense } from "react";
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
import { api } from "@/lib/api";
import { DashboardStats, SyncLog, LowStockAlert } from "@/types";

async function getDashboardData(): Promise<{
  stats: DashboardStats;
  latestSync: SyncLog | null;
  lowStockAlerts: LowStockAlert[];
  recentSyncs: SyncLog[];
}> {
  try {
    const [stats, latestSync, lowStockAlerts, recentSyncsRes] = await Promise.all([
      api.getDashboardStats(),
      api.getLatestSyncLog(),
      api.getLowStockProducts(5, 5).catch(() => []),
      api.getSyncLogs(5, 0).catch(() => ({ data: [], total: 0 })),
    ]);

    return {
      stats,
      latestSync,
      lowStockAlerts,
      recentSyncs: recentSyncsRes.data,
    };
  } catch (error) {
    console.error("Failed to fetch dashboard data:", error);
    return {
      stats: {
        total_products: 0,
        total_brands: 0,
        total_categories: 0,
        total_properties: 0,
        total_characteristics: 0,
        total_prices: 0,
        total_stock: 0,
        in_stock_products: 0,
      },
      latestSync: null,
      lowStockAlerts: [],
      recentSyncs: [],
    };
  }
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

async function DashboardContent() {
  const { stats, latestSync, lowStockAlerts, recentSyncs } = await getDashboardData();

  const statCards = [
    {
      title: "Total Products",
      value: stats.total_products.toLocaleString(),
      icon: Package,
      description: "Products in catalog",
      color: "text-blue-500",
    },
    {
      title: "Brands",
      value: stats.total_brands.toLocaleString(),
      icon: Building2,
      description: "Active brands",
      color: "text-purple-500",
    },
    {
      title: "Categories",
      value: stats.total_categories.toLocaleString(),
      icon: FolderTree,
      description: "Product categories",
      color: "text-green-500",
    },
    {
      title: "Properties",
      value: stats.total_properties.toLocaleString(),
      icon: FileText,
      description: "Product specifications",
      color: "text-orange-500",
    },
    {
      title: "Characteristics",
      value: stats.total_characteristics.toLocaleString(),
      icon: Tags,
      description: "Product variants/SKUs",
      color: "text-pink-500",
    },
    {
      title: "Prices",
      value: stats.total_prices.toLocaleString(),
      icon: DollarSign,
      description: "Price entries",
      color: "text-yellow-500",
    },
    {
      title: "Stock Entries",
      value: stats.total_stock.toLocaleString(),
      icon: Warehouse,
      description: "Stock records",
      color: "text-cyan-500",
    },
    {
      title: "In Stock",
      value: stats.in_stock_products.toLocaleString(),
      icon: PackageCheck,
      description: "Products available",
      color: "text-emerald-500",
    },
  ];

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent Sync Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Recent Sync Activity
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
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <div>
                        <p className="text-sm font-medium">{sync.sync_type}</p>
                        <p className="text-xs text-muted-foreground">
                          {(sync.products_synced + sync.brands_synced + sync.categories_synced).toLocaleString()} items
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Low Stock Alerts
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/products?in_stock=true">
                View All
                <ExternalLink className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {lowStockAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No low stock alerts at the moment.
              </p>
            ) : (
              <div className="space-y-3">
                {lowStockAlerts.map((product) => (
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
                      variant={product.total_stock <= 2 ? "destructive" : "secondary"}
                    >
                      {product.total_stock} left
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Last Sync Status */}
      {latestSync && (
        <Card>
          <CardHeader>
            <CardTitle>Last Sync Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Badge
                  variant={latestSync.status === "completed" ? "default" : "destructive"}
                  className="flex items-center gap-1"
                >
                  {latestSync.status === "completed" ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <XCircle className="h-3 w-3" />
                  )}
                  {latestSync.status}
                </Badge>
                <span className="text-sm">
                  <strong>{latestSync.sync_type}</strong> -{" "}
                  {(latestSync.products_synced + latestSync.brands_synced + latestSync.categories_synced).toLocaleString()} items synced
                </span>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <div>{new Date(latestSync.started_at).toLocaleString()}</div>
                <div className="flex items-center justify-end gap-1">
                  <Clock className="h-3 w-3" />
                  Duration: {formatDuration(latestSync.duration_seconds)}
                </div>
              </div>
            </div>
            {latestSync.error_message && (
              <div className="mt-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {latestSync.error_message}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
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
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of Ultra B2B product data
        </p>
      </div>

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}
