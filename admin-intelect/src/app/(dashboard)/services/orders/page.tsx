"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ClipboardList,
  Trash2,
  MoreHorizontal,
  Loader2,
  Eye,
  Search,
  Phone,
  Mail,
  Package as PackageIcon,
  Calendar,
  User,
  Filter,
  X as XIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { ServiceOrder, ServiceOrderStatus, ServicePackage } from "@/types/services";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useTranslation } from "@/contexts/language-context";

function getStatusConfig(status: ServiceOrderStatus, t: (key: string) => string) {
  switch (status) {
    case "pending":
      return { variant: "secondary" as const, label: t("orders.statuses.pending"), color: "bg-yellow-500" };
    case "contacted":
      return { variant: "default" as const, label: t("orders.statuses.contacted"), color: "bg-blue-500" };
    case "approved":
      return { variant: "default" as const, label: t("orders.statuses.approved"), color: "bg-green-500" };
    case "rejected":
      return { variant: "destructive" as const, label: t("orders.statuses.rejected"), color: "bg-red-500" };
    case "completed":
      return { variant: "outline" as const, label: t("orders.statuses.completed"), color: "bg-gray-500" };
    default:
      return { variant: "outline" as const, label: status, color: "bg-gray-500" };
  }
}

export default function ServiceOrdersPage() {
  const router = useRouter();
  const { t } = useTranslation("services");
  const { t: tCommon } = useTranslation("common");

  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ pending: 0, today: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [packageFilter, setPackageFilter] = useState("all");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteOrderId, setDeleteOrderId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rowsVisible, setRowsVisible] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      setRowsVisible(false);
      const filters: any = {};
      if (searchQuery) filters.search = searchQuery;
      if (statusFilter && statusFilter !== "all") filters.status = statusFilter;
      if (packageFilter && packageFilter !== "all") filters.package_id = packageFilter;

      const [ordersResponse, statsResponse] = await Promise.all([
        api.getServiceOrders(filters, 100, 0),
        api.getServiceOrderStats(),
      ]);

      setOrders(ordersResponse.data ?? []);
      setTotal(ordersResponse.total ?? 0);
      setStats({
        pending: statsResponse.pending || 0,
        today: statsResponse.today || 0,
      });
      setError(null);
      setTimeout(() => setRowsVisible(true), 50);
    } catch (err) {
      console.error("Failed to fetch orders:", err);
      setError(t("error.failedToLoad"));
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, statusFilter, packageFilter, t]);

  const fetchPackages = useCallback(async () => {
    try {
      const response = await api.getServicePackages({}, 100, 0);
      setPackages(response.data ?? []);
    } catch (err) {
      console.error("Failed to fetch packages:", err);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchPackages();
  }, [fetchOrders, fetchPackages]);

  const handleDelete = async () => {
    if (!deleteOrderId) return;

    setIsProcessing(true);
    try {
      await api.deleteServiceOrder(deleteOrderId);
      toast.success(t("toast.deleted"));
      setShowDeleteDialog(false);
      setDeleteOrderId(null);
      fetchOrders();
    } catch (error) {
      console.error("Failed to delete order:", error);
      toast.error(t("toast.error"));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setPackageFilter("all");
  };

  const hasActiveFilters = searchQuery || statusFilter !== "all" || packageFilter !== "all";

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("orders.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1.5">{t("orders.description")}</p>
          </div>
        </div>
        <OrdersPageSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("orders.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1.5">{t("orders.description")}</p>
          </div>
        </div>
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="p-4 rounded-full bg-destructive/10 mb-4">
              <ClipboardList className="h-10 w-10 text-destructive" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">{t("error.title")}</p>
            <p className="text-xs text-muted-foreground text-center mb-4">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
              className="transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
            >
              {tCommon("actions.tryAgain")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const deleteOrder = orders.find((o) => o.id === deleteOrderId);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("orders.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1.5">{t("orders.description")}</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Stats Bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/50 hover:shadow-sm transition-all">
            <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">{t("orders.stats.total")}</span>
            <span className="text-sm font-semibold tabular-nums">{total.toLocaleString()}</span>
            {hasActiveFilters && <span className="text-[10px] text-muted-foreground">{t("filters.filtered")}</span>}
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-yellow-500/5 border-yellow-500/20 hover:shadow-sm transition-all">
            <PackageIcon className="h-3.5 w-3.5 text-yellow-600" />
            <span className="text-xs font-medium text-muted-foreground">{t("orders.stats.pending")}</span>
            <span className="text-sm font-semibold tabular-nums">{stats.pending}</span>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-blue-500/5 border-blue-500/20 hover:shadow-sm transition-all">
            <Calendar className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-xs font-medium text-muted-foreground">{t("orders.stats.today")}</span>
            <span className="text-sm font-semibold tabular-nums">{stats.today}</span>
          </div>
        </div>

        {/* Filters Section */}
        <div
          className={cn(
            "rounded-xl border bg-card shadow-sm overflow-hidden transition-all duration-300",
            rowsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
          )}
          style={{ transitionDelay: rowsVisible ? "200ms" : "0ms" }}
        >
          <div className="p-4 border-b">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-muted">
                <Filter className="h-4 w-4 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-sm">{t("filters.title")}</h3>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("filters.search")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder={t("filters.allStatuses")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("filters.allStatuses")}</SelectItem>
                  <SelectItem value="pending">{t("orders.statuses.pending")}</SelectItem>
                  <SelectItem value="contacted">{t("orders.statuses.contacted")}</SelectItem>
                  <SelectItem value="approved">{t("orders.statuses.approved")}</SelectItem>
                  <SelectItem value="rejected">{t("orders.statuses.rejected")}</SelectItem>
                  <SelectItem value="completed">{t("orders.statuses.completed")}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={packageFilter} onValueChange={setPackageFilter}>
                <SelectTrigger>
                  <SelectValue placeholder={t("filters.allPackages")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("filters.allPackages")}</SelectItem>
                  {packages.map((pkg) => (
                    <SelectItem key={pkg.id} value={pkg.id}>
                      {pkg.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {hasActiveFilters && (
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <XIcon className="h-4 w-4 mr-1.5" />
                  {t("filters.clearFilters")}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Orders Table */}
        <div
          className={cn(
            "rounded-xl border bg-card shadow-sm overflow-hidden transition-all duration-300",
            rowsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
          )}
          style={{ transitionDelay: rowsVisible ? "300ms" : "0ms" }}
        >
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30 border-b">
                <TableHead className="font-semibold text-xs">{t("table.customer")}</TableHead>
                <TableHead className="font-semibold text-xs">{t("table.phone")}</TableHead>
                <TableHead className="font-semibold text-xs">{t("table.package")}</TableHead>
                <TableHead className="font-semibold text-xs">{t("table.status")}</TableHead>
                <TableHead className="font-semibold text-xs">{t("table.date")}</TableHead>
                <TableHead className="w-[100px] font-semibold text-xs">{t("table.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-64">
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="p-4 rounded-full bg-muted/50 mb-3">
                        <ClipboardList className="h-10 w-10 text-muted-foreground/50" />
                      </div>
                      <div className="text-center mb-4">
                        <p className="text-sm font-semibold text-foreground mb-1">{t("empty.title")}</p>
                        <p className="text-xs text-muted-foreground max-w-md">
                          {t("empty.description")}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((order, index) => {
                  const statusConfig = getStatusConfig(order.status, t);
                  return (
                    <TableRow
                      key={order.id}
                      className={cn(
                        "border-b transition-all duration-200 hover:bg-muted/30 cursor-pointer",
                        rowsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                      )}
                      style={{
                        transitionDelay: rowsVisible ? `${Math.min(index * 20, 400)}ms` : "0ms",
                      }}
                      onClick={() => router.push(`/services/orders/${order.id}`)}
                    >
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium">{order.customer_name}</span>
                          </div>
                          {order.customer_email && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              <span>{order.customer_email}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{order.customer_phone}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{order.package_name || "-"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusConfig.variant} className="font-medium">
                          <div className={cn("h-1.5 w-1.5 rounded-full mr-1.5", statusConfig.color)} />
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(order.created_at), "MMM dd, yyyy HH:mm")}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 transition-all duration-200 hover:bg-muted hover:scale-105"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">{t("table.actions")}</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={() => router.push(`/services/orders/${order.id}`)}
                              className="cursor-pointer"
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              {t("actions.viewDetails")}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive cursor-pointer focus:text-destructive"
                              onClick={() => {
                                setDeleteOrderId(order.id);
                                setShowDeleteDialog(true);
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {t("actions.delete")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title={t("dialog.deleteTitle")}
        description={t("dialog.deleteDescription")}
        confirmLabel={t("dialog.confirmDelete")}
        onConfirm={handleDelete}
        variant="destructive"
        isLoading={isProcessing}
      />
    </div>
  );
}

function OrdersPageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-32 rounded-lg" style={{ animationDelay: `${i * 100}ms` }} />
        ))}
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden animate-pulse">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="p-5 space-y-4">
          <Skeleton className="h-10 w-full rounded-md" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="bg-muted/30 border-b p-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16 ml-auto" />
          </div>
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 p-4 border-b last:border-b-0 animate-pulse"
            style={{ animationDelay: `${i * 50}ms`, opacity: 1 - i * 0.05 }}
          >
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-32 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-8 rounded-md ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
