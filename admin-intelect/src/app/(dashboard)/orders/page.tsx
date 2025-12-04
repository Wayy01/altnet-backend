"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ShoppingCart,
  Trash2,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  Eye,
  X,
  Search,
  SlidersHorizontal,
  User,
  Calendar,
  DollarSign,
  Package,
  MapPin,
  Phone,
  Mail,
  CreditCard,
  Truck,
  Store as StoreIcon,
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
import { Order, OrderStatus, OrderFilters } from "@/types/orders";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useTranslation } from "@/contexts/language-context";

/**
 * Get status badge variant and label
 */
function getStatusConfig(status: OrderStatus, t: (key: string) => string): {
  variant: "default" | "secondary" | "destructive" | "outline";
  label: string;
  color: string;
} {
  switch (status) {
    case "pending":
      return { variant: "secondary", label: t("status.pending"), color: "bg-yellow-500" };
    case "confirmed":
      return { variant: "default", label: t("status.confirmed"), color: "bg-blue-500" };
    case "processing":
      return { variant: "default", label: t("status.processing"), color: "bg-orange-500" };
    case "shipped":
      return { variant: "default", label: t("status.shipped"), color: "bg-purple-500" };
    case "delivered":
      return { variant: "default", label: t("status.delivered"), color: "bg-green-500" };
    case "cancelled":
      return { variant: "destructive", label: t("status.cancelled"), color: "bg-red-500" };
    default:
      return { variant: "outline", label: status, color: "bg-gray-500" };
  }
}

export default function OrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation("orders");
  const { t: tCommon } = useTranslation("common");

  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get("search") || "");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteOrderId, setDeleteOrderId] = useState<string | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get("status") || "");
  const [dateFrom, setDateFrom] = useState<string>(searchParams.get("date_from") || "");
  const [dateTo, setDateTo] = useState<string>(searchParams.get("date_to") || "");

  // Pagination states
  const [pageSize, setPageSize] = useState<number>(parseInt(searchParams.get("limit") || "50", 10));
  const [jumpToPage, setJumpToPage] = useState<string>("");

  // Animation state for staggered row reveals
  const [rowsVisible, setRowsVisible] = useState(false);

  const limit = pageSize;
  const offset = parseInt(searchParams.get("offset") || "0", 10);
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  const fetchOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      setRowsVisible(false);

      const filters: OrderFilters = {};

      if (debouncedSearch.trim()) {
        filters.search = debouncedSearch.trim();
      }

      if (statusFilter) {
        filters.status = statusFilter as OrderStatus;
      }

      if (dateFrom) {
        filters.date_from = dateFrom;
      }

      if (dateTo) {
        filters.date_to = dateTo;
      }

      const response = await api.getOrders(filters, limit, offset);
      setOrders(response.data ?? []);
      setTotal(response.total ?? 0);
      setError(null);
      // Trigger staggered row animation after data loads
      setTimeout(() => setRowsVisible(true), 50);
    } catch (err) {
      console.error("Failed to fetch orders:", err);
      setError(t("error.failedToLoad"));
    } finally {
      setIsLoading(false);
      setIsSearching(false);
      // Refocus search input after fetch completes
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }
  }, [offset, debouncedSearch, statusFilter, dateFrom, dateTo, limit, t]);

  // Initial fetch and fetch when filters change
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Debounce search input
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    if (searchQuery !== debouncedSearch) {
      setIsSearching(true);
      debounceTimeoutRef.current = setTimeout(() => {
        setDebouncedSearch(searchQuery);
        // Reset to first page when searching
        if (offset !== 0) {
          updateUrlParams({ search: searchQuery, offset: "0" });
        }
      }, 500);
    }

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [searchQuery, debouncedSearch, offset]);

  // Helper to update URL params
  const updateUrlParams = (updates: Record<string, string | null>) => {
    const newParams = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "") {
        newParams.delete(key);
      } else {
        newParams.set(key, value);
      }
    });
    router.push(`/orders?${newParams.toString()}`);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setDebouncedSearch("");
    updateUrlParams({ search: null, offset: "0" });
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setDebouncedSearch("");
    setStatusFilter("");
    setDateFrom("");
    setDateTo("");
    router.push("/orders");
  };

  const handleStatusFilterChange = (value: string) => {
    const filterValue = value === "all" ? "" : value;
    setStatusFilter(filterValue);
    updateUrlParams({ status: filterValue || null, offset: "0" });
  };

  const handlePageChange = (newPage: number) => {
    const newOffset = (newPage - 1) * limit;
    updateUrlParams({ offset: newOffset.toString() });
  };

  const handlePageSizeChange = (newSize: string) => {
    const size = parseInt(newSize, 10);
    setPageSize(size);
    // Reset to first page when changing page size
    updateUrlParams({ limit: newSize, offset: "0" });
  };

  const handleJumpToPage = () => {
    const pageNum = parseInt(jumpToPage, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      handlePageChange(pageNum);
      setJumpToPage("");
    }
  };

  const handleDeleteOrder = async () => {
    if (!deleteOrderId) return;

    setIsProcessing(true);
    try {
      await api.deleteOrder(deleteOrderId);
      toast.success(t("toast.deleted"));
      setShowDeleteDialog(false);
      setDeleteOrderId(null);
      fetchOrders();
    } catch (error) {
      console.error("Failed to delete order:", error);
      toast.error(t("toast.deleteError"));
    } finally {
      setIsProcessing(false);
    }
  };

  // Calculate stats
  const pendingOrders = useMemo(() => {
    return orders.filter((o) => o.status === "pending").length;
  }, [orders]);

  const totalRevenue = useMemo(() => {
    return orders.reduce((sum, o) => sum + o.total_amount, 0);
  }, [orders]);

  // Check if any filters are active
  const hasActiveFilters = debouncedSearch || statusFilter || dateFrom || dateTo;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("page.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              {t("page.description")}
            </p>
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
            <h1 className="text-3xl font-bold tracking-tight">{t("page.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              {t("page.description")}
            </p>
          </div>
        </div>
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="p-4 rounded-full bg-destructive/10 mb-4">
              <ShoppingCart className="h-10 w-10 text-destructive" />
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

  const deleteOrder = orders.find(o => o.id === deleteOrderId);

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("page.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            {t("page.description")}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Stats Bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/50 hover:shadow-sm transition-all">
            <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">{t("stats.total")}</span>
            <span className="text-sm font-semibold tabular-nums">{total.toLocaleString()}</span>
            {hasActiveFilters && <span className="text-[10px] text-muted-foreground">{t("stats.filtered")}</span>}
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-yellow-500/5 border-yellow-500/20 hover:shadow-sm transition-all">
            <Package className="h-3.5 w-3.5 text-yellow-600" />
            <span className="text-xs font-medium text-muted-foreground">{t("stats.pending")}</span>
            <span className="text-sm font-semibold tabular-nums">{pendingOrders}</span>
            <span className="text-[10px] text-muted-foreground">{t("stats.onPage")}</span>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/50 hover:shadow-sm transition-all">
            <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">{t("stats.revenue")}</span>
            <span className="text-sm font-semibold tabular-nums">{totalRevenue.toFixed(2)} MDL</span>
            <span className="text-[10px] text-muted-foreground">{t("stats.onPage")}</span>
          </div>
        </div>

        {/* Filters Section */}
        <div
          className={cn(
            "rounded-xl border bg-card shadow-sm overflow-hidden",
            "transition-all duration-300",
            rowsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
          )}
          style={{ transitionDelay: rowsVisible ? "200ms" : "0ms" }}
        >
          <div className="p-4 border-b">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-muted">
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-sm">{t("filters.title")}</h3>
            </div>
          </div>
          <div className="p-5 space-y-4">
            {/* Search Bar */}
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                name="search"
                placeholder={t("filters.search")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 transition-all duration-200 focus:ring-2 focus:ring-primary/20 hover:border-primary/30"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
              {searchQuery && !isSearching && (
                <button
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted transition-all duration-200"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>

            {/* Filters Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Status Filter */}
              <Select value={statusFilter || "all"} onValueChange={handleStatusFilterChange}>
                <SelectTrigger className="w-full transition-all duration-200 hover:border-primary/30">
                  <SelectValue placeholder={t("filters.allStatuses")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("filters.allStatuses")}</SelectItem>
                  <SelectItem value="pending">{t("status.pending")}</SelectItem>
                  <SelectItem value="confirmed">{t("status.confirmed")}</SelectItem>
                  <SelectItem value="processing">{t("status.processing")}</SelectItem>
                  <SelectItem value="shipped">{t("status.shipped")}</SelectItem>
                  <SelectItem value="delivered">{t("status.delivered")}</SelectItem>
                  <SelectItem value="cancelled">{t("status.cancelled")}</SelectItem>
                </SelectContent>
              </Select>

              {/* Date From */}
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    updateUrlParams({ date_from: e.target.value || null, offset: "0" });
                  }}
                  placeholder={t("filters.dateFrom")}
                  className="pl-9"
                />
              </div>

              {/* Date To */}
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    updateUrlParams({ date_to: e.target.value || null, offset: "0" });
                  }}
                  placeholder={t("filters.dateTo")}
                  className="pl-9"
                />
              </div>
            </div>

            {hasActiveFilters && (
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4 mr-1.5" />
                  {t("filters.clearFilters")}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Orders Table */}
        <div
          className={cn(
            "rounded-xl border bg-card shadow-sm overflow-hidden",
            "transition-all duration-300",
            rowsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
          )}
          style={{ transitionDelay: rowsVisible ? "300ms" : "0ms" }}
        >
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30 border-b">
                <TableHead className="font-semibold text-xs">{t("table.orderNumber")}</TableHead>
                <TableHead className="font-semibold text-xs">{t("table.customer")}</TableHead>
                <TableHead className="font-semibold text-xs">{t("table.total")}</TableHead>
                <TableHead className="font-semibold text-xs">{t("table.status")}</TableHead>
                <TableHead className="font-semibold text-xs">{t("table.payment")}</TableHead>
                <TableHead className="font-semibold text-xs">{t("table.delivery")}</TableHead>
                <TableHead className="font-semibold text-xs">{t("table.date")}</TableHead>
                <TableHead className="w-[100px] font-semibold text-xs">{t("table.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-64">
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="p-4 rounded-full bg-muted/50 mb-3">
                        <ShoppingCart className="h-10 w-10 text-muted-foreground/50" />
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
                        "border-b transition-all duration-200",
                        "hover:bg-muted/30 cursor-pointer",
                        rowsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                      )}
                      style={{
                        transitionDelay: rowsVisible ? `${Math.min(index * 20, 400)}ms` : "0ms",
                      }}
                      onClick={() => router.push(`/orders/${order.id}`)}
                    >
                      <TableCell className="font-medium font-mono text-sm">
                        {order.order_number}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium">{order.full_name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            <span>{order.phone_number}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 font-semibold">
                          <DollarSign className="h-3 w-3" />
                          <span>{order.total_amount.toFixed(2)} {order.currency}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusConfig.variant} className="font-medium">
                          <div className={cn("h-1.5 w-1.5 rounded-full mr-1.5", statusConfig.color)} />
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm">
                          <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="capitalize">{t(`paymentMethod.${order.payment_method}`)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm">
                          {order.delivery_type === 'delivery' ? (
                            <>
                              <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>{t("deliveryType.delivery")}</span>
                            </>
                          ) : (
                            <>
                              <StoreIcon className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>{t("deliveryType.pickup")}</span>
                            </>
                          )}
                        </div>
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
                            <DropdownMenuItem asChild>
                              <Link href={`/orders/${order.id}`} className="cursor-pointer">
                                <Eye className="mr-2 h-4 w-4" />
                                {t("actions.viewDetails")}
                              </Link>
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

        {/* Pagination */}
        <div
          className={cn(
            "rounded-xl border bg-card/50 shadow-sm p-4",
            "transition-all duration-300",
            rowsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
          )}
          style={{ transitionDelay: rowsVisible ? "350ms" : "0ms" }}
        >
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <p>
                {tCommon("pagination.showing")} <span className="font-semibold text-foreground tabular-nums">{orders.length}</span> {tCommon("pagination.of")}{" "}
                <span className="font-semibold text-foreground tabular-nums">{total}</span> {tCommon("pagination.items")}
              </p>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-2">
                <span>{tCommon("pagination.rowsPerPage")}:</span>
                <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="w-[70px] h-8 transition-all duration-200 hover:border-primary/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1}
                  className="h-8 w-8 transition-all duration-200 hover:bg-muted hover:shadow-sm"
                  title={tCommon("pagination.firstPage")}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="transition-all duration-200 hover:bg-muted hover:shadow-sm"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  {tCommon("actions.previous")}
                </Button>

                <div className="flex items-center gap-2 px-2">
                  <span className="text-xs text-muted-foreground">{tCommon("pagination.page")}</span>
                  <Input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={jumpToPage}
                    onChange={(e) => setJumpToPage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleJumpToPage();
                      }
                    }}
                    onBlur={handleJumpToPage}
                    placeholder={currentPage.toString()}
                    className="w-14 h-8 text-center tabular-nums transition-all duration-200 hover:border-primary/30"
                  />
                  <span className="text-xs text-muted-foreground">{tCommon("pagination.of")} {totalPages}</span>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="transition-all duration-200 hover:bg-muted hover:shadow-sm"
                >
                  {tCommon("actions.next")}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                  className="h-8 w-8 transition-all duration-200 hover:bg-muted hover:shadow-sm"
                  title={tCommon("pagination.lastPage")}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Order Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title={t("dialog.deleteTitle")}
        description={t("dialog.deleteDescription", { orderNumber: deleteOrder?.order_number || "" })}
        confirmLabel={t("dialog.confirmDelete")}
        onConfirm={handleDeleteOrder}
        variant="destructive"
        isLoading={isProcessing}
      />
    </div>
  );
}

/**
 * Enhanced skeleton loader for orders page
 */
function OrdersPageSkeleton() {
  return (
    <div className="space-y-4">
      {/* Stats Skeleton */}
      <div className="flex flex-wrap items-center gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-10 w-32 rounded-lg"
            style={{ animationDelay: `${i * 100}ms` }}
          />
        ))}
      </div>

      {/* Filters Skeleton */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden animate-pulse">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="p-5 space-y-4">
          <Skeleton className="h-10 w-full rounded-md" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="bg-muted/30 border-b p-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16 ml-auto" />
          </div>
        </div>

        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 p-4 border-b last:border-b-0 animate-pulse"
            style={{
              animationDelay: `${i * 50}ms`,
              opacity: 1 - (i * 0.05),
            }}
          >
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-8 rounded-md ml-auto" />
          </div>
        ))}
      </div>

      {/* Pagination Skeleton */}
      <div className="rounded-xl border bg-card/50 shadow-sm p-4 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-px" />
            <Skeleton className="h-8 w-[70px] rounded-md" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
