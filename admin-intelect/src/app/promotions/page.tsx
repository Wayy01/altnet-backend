"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Tag,
  Trash2,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  Eye,
  X,
  Power,
  PowerOff,
  Search,
  SlidersHorizontal,
  Package,
  CheckCircle2,
  Calendar,
  TrendingDown,
  Pencil,
  Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
import { Promotion } from "@/types/promotions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useTranslation } from "@/contexts/language-context";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

/**
 * Stat indicator item configuration
 */
interface StatIndicator {
  label: string;
  value: number | string;
  suffix?: string;
  icon?: React.ReactNode;
  variant?: "default" | "success" | "warning" | "muted";
}

export default function PromotionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation("promotions");
  const { t: tCommon } = useTranslation("common");

  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get("search") || "");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletePromotionId, setDeletePromotionId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get("status") || "");

  // Pagination states
  const [pageSize, setPageSize] = useState<number>(parseInt(searchParams.get("limit") || "50", 10));
  const [jumpToPage, setJumpToPage] = useState<string>("");

  // Animation state for staggered row reveals
  const [rowsVisible, setRowsVisible] = useState(false);

  const limit = pageSize;
  const offset = parseInt(searchParams.get("offset") || "0", 10);
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  const fetchPromotions = useCallback(async () => {
    try {
      setIsLoading(true);
      setRowsVisible(false);

      const filters: { search?: string; is_active?: boolean } = {};

      if (debouncedSearch.trim()) {
        filters.search = debouncedSearch.trim();
      }

      if (statusFilter === "active") {
        filters.is_active = true;
      } else if (statusFilter === "inactive") {
        filters.is_active = false;
      }

      const response = await api.getPromotions(filters, limit, offset);
      setPromotions(response.data ?? []);
      setTotal(response.total ?? 0);
      setError(null);
      // Trigger staggered row animation after data loads
      setTimeout(() => setRowsVisible(true), 50);
    } catch (err) {
      console.error("Failed to fetch promotions:", err);
      setError("Failed to load promotions. Make sure the Go backend API is running.");
    } finally {
      setIsLoading(false);
      setIsSearching(false);
      // Refocus search input after fetch completes
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }
  }, [offset, debouncedSearch, statusFilter, limit]);

  // Initial fetch and fetch when filters change
  useEffect(() => {
    fetchPromotions();
  }, [fetchPromotions]);

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
    router.push(`/promotions?${newParams.toString()}`);
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
    router.push("/promotions");
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

  const handleToggle = async (promotion: Promotion) => {
    try {
      setTogglingId(promotion.id);
      await api.togglePromotion(promotion.id);
      toast.success(
        promotion.is_active
          ? t("toast.deactivated")
          : t("toast.activated")
      );
      fetchPromotions();
    } catch (error) {
      console.error("Failed to toggle promotion:", error);
      toast.error(t("toast.toggleFailed"));
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeletePromotion = async () => {
    if (!deletePromotionId) return;

    setIsProcessing(true);
    try {
      await api.deletePromotion(deletePromotionId);
      toast.success(t("toast.deletedSuccess"));
      setShowDeleteDialog(false);
      setDeletePromotionId(null);
      fetchPromotions();
    } catch (error) {
      console.error("Failed to delete promotion:", error);
      toast.error(t("toast.deleteFailed"));
    } finally {
      setIsProcessing(false);
    }
  };

  // Calculate stats
  const activePromotions = useMemo(() => {
    return promotions.filter((p) => p.is_active).length;
  }, [promotions]);

  const productsOnPromotion = useMemo(() => {
    return promotions.reduce((sum, p) => sum + (p.product_count || 0), 0);
  }, [promotions]);

  // Check if any filters are active
  const hasActiveFilters = debouncedSearch || statusFilter;

  // Stats indicators configuration
  const statsIndicators: StatIndicator[] = [
    {
      label: t("stats.total"),
      value: (total ?? 0).toLocaleString(),
      suffix: hasActiveFilters ? t("stats.filtered") : undefined,
      variant: "default",
    },
    {
      label: t("stats.active"),
      value: activePromotions,
      suffix: t("stats.onPage"),
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      variant: activePromotions > 0 ? "success" : "muted",
    },
    {
      label: t("stats.productsOnPromotion"),
      value: productsOnPromotion.toLocaleString(),
      suffix: t("stats.onPage"),
      icon: <Package className="h-3.5 w-3.5" />,
      variant: "muted",
    },
  ];

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
        <PromotionsPageSkeleton />
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
              <Tag className="h-10 w-10 text-destructive" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">{tCommon("errors.somethingWentWrong")}</p>
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

  return (
    <div className="space-y-4">
      {/* Page Header - Compact style matching dashboard */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("page.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            {t("page.description")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            asChild
            className="transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
          >
            <Link href="/promotions/new">
              <Plus className="h-4 w-4 mr-1.5" />
              {t("page.newPromotion")}
            </Link>
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Stats Bar */}
        <div className="flex flex-wrap items-center gap-3">
          {statsIndicators.map((stat, index) => (
            <div
              key={stat.label}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-2 rounded-lg border",
                "transition-all duration-200 ease-out",
                "hover:shadow-sm hover:border-border/80 hover:-translate-y-0.5",
                stat.variant === "success" ? "bg-primary/5 border-primary/20 hover:bg-primary/10" : "",
                stat.variant === "warning" ? "bg-destructive/5 border-destructive/20 hover:bg-destructive/10" : "",
                stat.variant === "default" || stat.variant === "muted" ? "bg-muted/50" : ""
              )}
              style={{
                animationDelay: `${index * 50}ms`,
              }}
            >
              {stat.icon && (
                <span className={cn(
                  stat.variant === "success" ? "text-primary" : "",
                  stat.variant === "warning" ? "text-destructive" : "",
                  stat.variant === "default" || stat.variant === "muted" ? "text-muted-foreground" : ""
                )}>
                  {stat.icon}
                </span>
              )}
              <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
              <span className="text-sm font-semibold tabular-nums">{stat.value}</span>
              {stat.suffix && (
                <span className="text-[10px] text-muted-foreground">({stat.suffix})</span>
              )}
            </div>
          ))}
        </div>

        {/* Filters Section - Organized Card Layout */}
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
              <h3 className="font-semibold text-sm">{t("filters.searchPromotions")}</h3>
            </div>
          </div>
          <div className="p-5 space-y-4">
            {/* Search Bar - Full Width */}
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                name="search"
                placeholder={t("filters.searchPromotions")}
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

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Power className="h-4 w-4 text-muted-foreground shrink-0" />
              <Select value={statusFilter || "all"} onValueChange={handleStatusFilterChange}>
                <SelectTrigger className="w-full transition-all duration-200 hover:border-primary/30">
                  <SelectValue placeholder={t("filters.allPromotions")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("filters.allPromotions")}</SelectItem>
                  <SelectItem value="active">{t("filters.activeOnly")}</SelectItem>
                  <SelectItem value="inactive">{t("filters.inactiveOnly")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Promotions Table - Premium styling matching dashboard */}
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
                <TableHead className="font-semibold text-xs">{t("table.name")}</TableHead>
                <TableHead className="font-semibold text-xs">{t("table.discount")}</TableHead>
                <TableHead className="font-semibold text-xs">{t("table.dates")}</TableHead>
                <TableHead className="font-semibold text-xs">{t("table.products")}</TableHead>
                <TableHead className="font-semibold text-xs">{t("table.priority")}</TableHead>
                <TableHead className="w-[80px] font-semibold text-xs">{t("table.status")}</TableHead>
                <TableHead className="w-[100px] font-semibold text-xs">{t("table.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {promotions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-64">
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="p-4 rounded-full bg-muted/50 mb-3">
                        <Tag className="h-10 w-10 text-muted-foreground/50" />
                      </div>
                      <div className="text-center mb-4">
                        <p className="text-sm font-semibold text-foreground mb-1">{t("empty.title")}</p>
                        <p className="text-xs text-muted-foreground max-w-md">
                          {t("empty.description")}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        asChild
                        className="transition-all duration-200 hover:shadow-sm"
                      >
                        <Link href="/promotions/new">
                          <Plus className="h-4 w-4 mr-1.5" />
                          {t("page.newPromotion")}
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                promotions.map((promotion, index) => (
                  <TableRow
                    key={promotion.id}
                    className={cn(
                      "border-b transition-all duration-200",
                      "hover:bg-muted/30",
                      rowsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                    )}
                    style={{
                      transitionDelay: rowsVisible ? `${Math.min(index * 20, 400)}ms` : "0ms",
                    }}
                  >
                    <TableCell className="font-medium">
                      <Link
                        href={`/promotions/${promotion.id}`}
                        className="hover:text-primary hover:underline underline-offset-4 transition-colors duration-200"
                      >
                        {promotion.name}
                      </Link>
                      {promotion.description && (
                        <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {promotion.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-semibold">
                        <TrendingDown className="h-3 w-3 mr-1" />
                        {promotion.discount_type === "percentage"
                          ? `${promotion.discount_value}%`
                          : `${promotion.discount_value} MDL`}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm space-y-0.5">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(promotion.start_date), "MMM dd, yyyy")}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          to {format(new Date(promotion.end_date), "MMM dd, yyyy")}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {promotion.product_count || 0} {t("badges.products")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{promotion.priority}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={promotion.is_active}
                          disabled={togglingId === promotion.id}
                          onCheckedChange={() => handleToggle(promotion)}
                          className="data-[state=checked]:bg-primary transition-all duration-200 hover:opacity-80"
                        />
                        {togglingId === promotion.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Badge
                            variant={promotion.is_active ? "default" : "secondary"}
                            className={cn(
                              promotion.is_active &&
                                "bg-emerald-500 hover:bg-emerald-600"
                            )}
                          >
                            {promotion.is_active ? t("badges.active") : t("badges.inactive")}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 transition-all duration-200 hover:bg-muted hover:scale-105"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem asChild>
                            <Link href={`/promotions/${promotion.id}`} className="cursor-pointer">
                              <Eye className="mr-2 h-4 w-4" />
                              {t("actions.viewDetails")}
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/promotions/${promotion.id}/edit`} className="cursor-pointer">
                              <Pencil className="mr-2 h-4 w-4" />
                              {t("actions.edit")}
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleToggle(promotion)}
                            className="cursor-pointer"
                          >
                            <Power className="mr-2 h-4 w-4" />
                            {promotion.is_active ? t("actions.deactivate") : t("actions.activate")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive cursor-pointer focus:text-destructive"
                            onClick={() => {
                              setDeletePromotionId(promotion.id);
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
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination - Compact style matching dashboard */}
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
                {tCommon("pagination.showing")} <span className="font-semibold text-foreground tabular-nums">{promotions.length}</span> {tCommon("pagination.of")}{" "}
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
                {/* First Page */}
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

                {/* Previous Page */}
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

                {/* Page Info & Jump */}
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
                  <span className="text-xs text-muted-foreground">of {totalPages}</span>
                </div>

                {/* Next Page */}
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

                {/* Last Page */}
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

      {/* Delete Promotion Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title={t("dialogs.deleteTitle")}
        description={t("dialogs.deleteDescription", { name: promotions.find(p => p.id === deletePromotionId)?.name || "" })}
        confirmLabel={tCommon("actions.delete")}
        onConfirm={handleDeletePromotion}
        variant="destructive"
        isLoading={isProcessing}
      />
    </div>
  );
}

/**
 * Enhanced skeleton loader matching dashboard design system
 * Compact spacing, staggered animations, premium feel
 */
function PromotionsPageSkeleton() {
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

      {/* Filters Skeleton - Organized Card Layout */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden animate-pulse">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="p-5 space-y-4">
          {/* Search Bar Skeleton */}
          <Skeleton className="h-10 w-full rounded-md" />

          {/* Status Filter Skeleton */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        </div>
      </div>

      {/* Table Skeleton - Staggered row animation */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-muted/30 border-b p-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24 ml-auto" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>

        {/* Rows with staggered fade-in */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 p-4 border-b last:border-b-0 animate-pulse"
            style={{
              animationDelay: `${i * 50}ms`,
              opacity: 1 - (i * 0.05),
            }}
          >
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-5 w-20 rounded" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-16 rounded" />
            <Skeleton className="h-5 w-12 rounded" />
            <Skeleton className="h-6 w-20 rounded-full ml-auto" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        ))}
      </div>

      {/* Pagination Skeleton - Card style */}
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
