"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { ProductGrouping, ProductVariant } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Package,
  DollarSign,
  Layers,
  ArrowLeft,
  Trash2,
  Loader2,
  Image as ImageIcon,
  X,
  Home,
  Tag,
  Warehouse,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { DeleteConfirmDialog } from "@/components/properties/DeleteConfirmDialog";
import { useLocalizedValue, useTranslation } from "@/contexts/language-context";

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

export default function ProductGroupingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;
  const { localize } = useLocalizedValue();
  const { t } = useTranslation('groupings');
  const { t: tCommon } = useTranslation('common');

  // State
  const [group, setGroup] = useState<ProductGrouping | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [variantsLoading, setVariantsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [limit] = useState(50);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [jumpToPage, setJumpToPage] = useState("");

  // Animation state for staggered row reveals
  const [rowsVisible, setRowsVisible] = useState(false);

  // Deletion state
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    variantId: string;
    variantName: string;
    loading: boolean;
  }>({
    open: false,
    variantId: "",
    variantName: "",
    loading: false,
  });

  // Stats for cards
  const [stats, setStats] = useState({
    totalVariants: 0,
    activeVariants: 0,
    totalStock: 0,
    priceRange: "N/A",
  });

  // Fetch group details
  const fetchGroup = useCallback(async () => {
    try {
      setLoading(true);
      const groupData = await api.getProductGrouping(groupId);
      setGroup(groupData);
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch product group");
      router.push("/groupings");
    } finally {
      setLoading(false);
    }
  }, [groupId, router]);

  // Fetch variants
  const fetchVariants = useCallback(async () => {
    try {
      setVariantsLoading(true);
      setRowsVisible(false);
      const offset = (currentPage - 1) * limit;
      const response = await api.getGroupingVariants(groupId, limit, offset, search || undefined);
      setVariants(response.data || []);
      setTotalCount(response.total || 0);

      // Calculate stats from current data
      if (response.data.length > 0) {
        const activeVariants = response.data.filter(v => v.is_active).length;
        const totalStock = response.data.reduce((sum, v) => sum + v.total_stock, 0);

        // Calculate price range
        const validPrices = response.data.filter(v => v.price_mdl !== null);
        let priceRange = "N/A";
        if (validPrices.length > 0) {
          const prices = validPrices.map(v => v.price_mdl || 0);
          const minPrice = Math.min(...prices);
          const maxPrice = Math.max(...prices);
          priceRange = `${minPrice.toFixed(0)} - ${maxPrice.toFixed(0)} MDL`;
        }

        setStats({
          totalVariants: response.total,
          activeVariants,
          totalStock,
          priceRange,
        });
      }

      // Trigger staggered row animation after data loads
      setTimeout(() => setRowsVisible(true), 50);
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch variants");
    } finally {
      setVariantsLoading(false);
      setIsSearching(false);
    }
  }, [groupId, currentPage, limit, search]);

  useEffect(() => {
    fetchGroup();
  }, [fetchGroup]);

  useEffect(() => {
    fetchVariants();
  }, [fetchVariants]);

  // Handle search
  const handleSearch = () => {
    setIsSearching(true);
    setSearch(searchInput);
    setCurrentPage(1);
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setSearch("");
    setCurrentPage(1);
  };

  // Handle delete
  const handleDeleteClick = async (variant: ProductVariant) => {
    const variantName = localize(variant, "name");
    setDeleteDialog({ open: true, variantId: variant.id, variantName, loading: false });
  };

  const handleDeleteConfirm = async () => {
    try {
      setDeleteDialog((prev) => ({ ...prev, loading: true }));
      await api.deleteProductVariant(deleteDialog.variantId);
      toast.success("Variant unlinked successfully");
      setDeleteDialog({ open: false, variantId: "", variantName: "", loading: false });
      fetchVariants();
      fetchGroup(); // Refresh group stats
    } catch (error: any) {
      toast.error(error.message || "Failed to unlink variant");
      setDeleteDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  // Pagination
  const totalPages = Math.ceil(totalCount / limit);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handleJumpToPage = () => {
    const pageNum = parseInt(jumpToPage, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      handlePageChange(pageNum);
      setJumpToPage("");
    }
  };

  // Stats indicators configuration
  const statsIndicators: StatIndicator[] = [
    {
      label: t('stats.totalVariants'),
      value: stats.totalVariants.toLocaleString(),
      icon: <Layers className="h-3.5 w-3.5" />,
      variant: "default",
    },
    {
      label: t('stats.active'),
      value: stats.activeVariants,
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      variant: stats.activeVariants > 0 ? "success" : "muted",
    },
    {
      label: t('stats.totalStock'),
      value: stats.totalStock.toLocaleString(),
      icon: <Warehouse className="h-3.5 w-3.5" />,
      variant: stats.totalStock > 0 ? "success" : "warning",
    },
    {
      label: t('stats.priceRange'),
      value: stats.priceRange,
      icon: <DollarSign className="h-3.5 w-3.5" />,
      variant: "muted",
    },
  ];

  if (loading) {
    return <GroupingDetailSkeleton />;
  }

  if (!group) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/" className="flex items-center">
                <Home className="h-4 w-4" />
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/groupings">{tCommon('navigation.groupings')}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{localize(group, "name")}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Button
            variant="outline"
            size="icon"
            asChild
            className="shrink-0 mt-1 transition-all duration-200 hover:bg-muted hover:shadow-sm hover:-translate-y-0.5"
          >
            <Link href="/groupings">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold tracking-tight">{localize(group, "name")}</h1>
              <Badge
                variant={group.is_active ? "default" : "secondary"}
                className={`transition-colors ${
                  group.is_active
                    ? "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                    : ""
                }`}
              >
                {group.is_active ? t('badges.active') : t('badges.inactive')}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {t('page.detailDescription')}
            </p>
          </div>
        </div>
      </div>

      {/* Group Info Card */}
      <div className="rounded-xl border bg-card shadow-sm p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('detail.code')}</p>
            <p className="font-medium">{group.code || group.article || "-"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('detail.brand')}</p>
            <p className="font-medium">{group.brand_name || "-"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('detail.category')}</p>
            <p className="font-medium">{group.category_name || "-"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('detail.status')}</p>
            <div className="flex items-center gap-2">
              {group.is_active ? (
                <CheckCircle2 className="h-4 w-4 text-primary" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              <span className="font-medium">{group.is_active ? t('badges.active') : t('badges.inactive')}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Stats Bar - Enhanced with hover effects and better visual hierarchy */}
        <div className="flex flex-wrap items-center gap-3">
          {statsIndicators.map((stat, index) => (
            <div
              key={stat.label}
              className={`
                inline-flex items-center gap-2 px-3 py-2 rounded-lg border
                transition-all duration-200 ease-out
                hover:shadow-sm hover:border-border/80 hover:-translate-y-0.5
                ${stat.variant === "success" ? "bg-primary/5 border-primary/20 hover:bg-primary/10" : ""}
                ${stat.variant === "warning" ? "bg-destructive/5 border-destructive/20 hover:bg-destructive/10" : ""}
                ${stat.variant === "default" || stat.variant === "muted" ? "bg-muted/50" : ""}
              `}
              style={{
                animationDelay: `${index * 50}ms`,
              }}
            >
              {stat.icon && (
                <span className={`
                  ${stat.variant === "success" ? "text-primary" : ""}
                  ${stat.variant === "warning" ? "text-destructive" : ""}
                  ${stat.variant === "default" || stat.variant === "muted" ? "text-muted-foreground" : ""}
                `}>
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

        {/* Search Bar */}
        <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl border bg-card/50 shadow-sm">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('filters.searchVariants')}
              className="pl-9 pr-8 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyPress={handleSearchKeyPress}
            />
            {isSearching && (
              <Loader2 className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
            {searchInput && !isSearching && (
              <button
                onClick={handleClearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted transition-colors"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
          <Button
            onClick={handleSearch}
            className="transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
          >
            {tCommon('actions.search')}
          </Button>
          {search && (
            <Badge
              variant="secondary"
              className="
                pl-2.5 pr-1.5 py-1 gap-1.5
                bg-primary/10 text-primary border-primary/20
                hover:bg-primary/15 transition-all duration-200
              "
            >
              <span className="text-xs font-normal text-primary/70">{tCommon('actions.search')}:</span>
              <span className="text-xs font-medium max-w-[150px] truncate">"{search}"</span>
              <button
                onClick={handleClearSearch}
                className="ml-0.5 p-0.5 rounded-full hover:bg-primary/20 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>

        {/* Variants Table - Enhanced with premium styling */}
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          {variantsLoading ? (
            <VariantsTableSkeleton />
          ) : variants.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <div className="p-4 rounded-full bg-muted/50">
                <Layers className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <div className="text-center">
                <p className="font-medium text-foreground">{t('empty.noVariants')}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {search ? t('empty.withFilters') : t('empty.noVariantsForGroup')}
                </p>
              </div>
              {search && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearSearch}
                  className="mt-2 transition-all duration-200 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                >
                  <X className="h-4 w-4 mr-1.5" />
                  {t('actions.clearSearch')}
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-[60px]">{t('table.image')}</TableHead>
                  <TableHead>{t('table.variantName')}</TableHead>
                  <TableHead>{t('table.code')}</TableHead>
                  <TableHead className="text-right">{t('table.priceMDL')}</TableHead>
                  <TableHead className="text-right">{t('table.stock')}</TableHead>
                  <TableHead className="text-center">{t('table.status')}</TableHead>
                  <TableHead className="text-right w-[80px]">{t('table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {variants.map((variant, index) => (
                  <TableRow
                    key={variant.id}
                    className={`
                      transition-all duration-200
                      hover:bg-muted/50
                      ${rowsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
                    `}
                    style={{
                      transitionDelay: rowsVisible ? `${Math.min(index * 20, 400)}ms` : "0ms",
                    }}
                  >
                    <TableCell>
                      {variant.main_image_url ? (
                        <div className="w-10 h-10 rounded-lg overflow-hidden border bg-muted transition-transform duration-200 hover:scale-105">
                          <img
                            src={variant.main_image_url}
                            alt={variant.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center border">
                          <ImageIcon className="h-5 w-5 text-muted-foreground/50" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium max-w-[250px]">
                      <Link
                        href={`/products/${variant.id}`}
                        className="hover:text-primary hover:underline underline-offset-4 transition-colors truncate block"
                      >
                        {localize(variant, "name")}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {variant.code || variant.article || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {variant.price_mdl !== null ? (
                        <span className="font-medium tabular-nums">
                          {variant.price_mdl.toFixed(2)}
                        </span>
                      ) : (
                        <Badge variant="outline" className="font-normal text-muted-foreground">
                          {t('badges.noPrice')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="tabular-nums">{variant.total_stock.toLocaleString()}</span>
                        {variant.is_in_stock ? (
                          <Badge
                            variant="default"
                            className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20 transition-colors text-xs"
                          >
                            {t('badges.inStock')}
                          </Badge>
                        ) : (
                          <Badge
                            variant="destructive"
                            className="bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20 transition-colors text-xs"
                          >
                            {t('badges.outOfStock')}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {variant.is_active ? (
                        <Badge
                          variant="default"
                          className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20 transition-colors"
                        >
                          {t('badges.active')}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          {t('badges.inactive')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteClick(variant)}
                        className="h-8 w-8 transition-all duration-200 hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Enhanced Pagination */}
        {!variantsLoading && variants.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <p>
                {t('pagination.showing')} <span className="font-medium text-foreground">{variants.length}</span> {t('pagination.of')}{" "}
                <span className="font-medium text-foreground">{totalCount.toLocaleString()}</span> {t('pagination.variants')}
              </p>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                {/* First Page */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1}
                  className="h-8 w-8 transition-all duration-200 hover:bg-muted"
                  title={t('pagination.firstPage')}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>

                {/* Previous Page */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="transition-all duration-200 hover:bg-muted"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  {t('pagination.previous')}
                </Button>

                {/* Page Info & Jump */}
                <div className="flex items-center gap-2 px-2">
                  <span className="text-sm text-muted-foreground">{t('pagination.page')}</span>
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
                    className="w-14 h-8 text-center tabular-nums"
                  />
                  <span className="text-sm text-muted-foreground">of {totalPages}</span>
                </div>

                {/* Next Page */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="transition-all duration-200 hover:bg-muted"
                >
                  {t('pagination.next')}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>

                {/* Last Page */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                  className="h-8 w-8 transition-all duration-200 hover:bg-muted"
                  title={t('pagination.lastPage')}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, variantId: "", variantName: "", loading: false })}
        onConfirm={handleDeleteConfirm}
        title={t('delete.variantTitle')}
        description={t('delete.variantDescription').replace('{{name}}', deleteDialog.variantName)}
        impactData={{ records_to_delete: 0, products_affected: 1 }}
        isLoading={deleteDialog.loading}
      />
    </div>
  );
}

/**
 * Enhanced skeleton loader for grouping detail page
 */
function GroupingDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Breadcrumb skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Header skeleton */}
      <div className="flex items-start gap-4">
        <Skeleton className="h-10 w-10 rounded-md" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>

      {/* Info card skeleton */}
      <div className="rounded-xl border bg-card shadow-sm p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-24" />
            </div>
          ))}
        </div>
      </div>

      {/* Stats skeleton */}
      <div className="flex flex-wrap items-center gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-10 w-32 rounded-lg"
            style={{ animationDelay: `${i * 100}ms` }}
          />
        ))}
      </div>

      {/* Search skeleton */}
      <div className="flex flex-wrap gap-3 p-4 rounded-xl border bg-card/50">
        <Skeleton className="h-10 w-[300px] rounded-md" />
        <Skeleton className="h-10 w-24 rounded-md" />
      </div>

      <VariantsTableSkeleton />
    </div>
  );
}

/**
 * Enhanced skeleton loader for variants table
 */
function VariantsTableSkeleton() {
  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 bg-muted/30 border-b">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-24 ml-auto" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-12" />
      </div>

      {/* Rows with staggered opacity */}
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 p-4 border-b last:border-b-0 animate-pulse"
          style={{
            animationDelay: `${i * 50}ms`,
            opacity: 1 - (i * 0.05),
          }}
        >
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20 ml-auto" />
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      ))}
    </div>
  );
}
