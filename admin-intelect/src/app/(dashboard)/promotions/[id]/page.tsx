"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Tag,
  ArrowLeft,
  Edit,
  Trash2,
  Calendar,
  Package,
  Plus,
  Percent,
  DollarSign,
  TrendingDown,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { Promotion, PromotionProduct } from "@/types/promotions";
import { PriceDisplay } from "@/components/ui/price-display";
import { ProductSelector } from "@/components/promotions/product-selector";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useTranslation } from "@/contexts/language-context";

interface PromotionDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function PromotionDetailPage({ params }: PromotionDetailPageProps) {
  const router = useRouter();
  const { t } = useTranslation("promotions");
  const [promotionId, setPromotionId] = useState<string | null>(null);
  const [promotion, setPromotion] = useState<Promotion | null>(null);
  const [products, setProducts] = useState<PromotionProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [contentVisible, setContentVisible] = useState(false);

  // Dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productSelectorOpen, setProductSelectorOpen] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Unwrap params
  useEffect(() => {
    let cancelled = false;
    async function unwrapParams() {
      const { id } = await params;
      if (!cancelled) {
        setPromotionId(id);
      }
    }
    unwrapParams();
    return () => {
      cancelled = true;
    };
  }, [params]);

  // Load promotion data
  const loadData = useCallback(async () => {
    if (!promotionId) return;

    try {
      setLoading(true);
      const offset = (currentPage - 1) * pageSize;
      const [promotionData, productsData] = await Promise.all([
        api.getPromotion(promotionId),
        api.getPromotionProducts(promotionId, pageSize, offset),
      ]);
      setPromotion(promotionData);
      setProducts(productsData.data);
      setTotal(productsData.total);
      setTimeout(() => setContentVisible(true), 50);
    } catch (error) {
      console.error("Failed to load promotion:", error);
      toast.error(t("toast.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [promotionId, currentPage, t]);

  useEffect(() => {
    if (promotionId) {
      loadData();
    }
  }, [promotionId, loadData]);

  // Delete promotion
  const handleDelete = async () => {
    if (!promotionId) return;

    try {
      await api.deletePromotion(promotionId);
      toast.success(t("toast.deletedSuccess"));
      router.push("/promotions");
    } catch (error) {
      console.error("Failed to delete promotion:", error);
      toast.error(t("toast.deleteFailed"));
    }
  };

  // Remove selected products
  const handleRemoveProducts = async () => {
    if (!promotionId || selectedProductIds.size === 0) return;

    try {
      await api.removeProductsFromPromotion(promotionId, Array.from(selectedProductIds));
      toast.success(t("toast.productsRemovedSuccess", { count: selectedProductIds.size }));
      setSelectedProductIds(new Set());
      loadData();
    } catch (error) {
      console.error("Failed to remove products:", error);
      toast.error(t("toast.productsRemoveFailed"));
    }
  };

  // Selection handlers
  const handleSelectAll = () => {
    if (selectedProductIds.size === products.length) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(products.map((p) => p.id)));
    }
  };

  const handleSelectOne = (productId: string, checked: boolean) => {
    const newSelected = new Set(selectedProductIds);
    if (checked) {
      newSelected.add(productId);
    } else {
      newSelected.delete(productId);
    }
    setSelectedProductIds(newSelected);
  };

  const totalPages = Math.ceil(total / pageSize);
  const isAllSelected = products.length > 0 && selectedProductIds.size === products.length;

  if (loading || !promotion) {
    return <PromotionDetailSkeleton />;
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 transition-all duration-500",
        contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}
    >
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link
          href="/promotions"
          className="hover:text-foreground transition-colors duration-200"
        >
          {t("detail.breadcrumb")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium max-w-[200px] truncate">
          {promotion.name}
        </span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.back()}
            className="shrink-0 h-10 w-10 rounded-xl"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{promotion.name}</h1>
              <Badge
                variant={promotion.is_active ? "default" : "secondary"}
                className={cn(
                  promotion.is_active && "bg-emerald-500 hover:bg-emerald-600"
                )}
              >
                {promotion.is_active ? (
                  <>
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {t("badges.active")}
                  </>
                ) : (
                  <>
                    <XCircle className="h-3 w-3 mr-1" />
                    {t("badges.inactive")}
                  </>
                )}
              </Badge>
            </div>
            {promotion.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {promotion.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/promotions/${promotion.id}/edit`}>
              <Edit className="h-4 w-4 mr-1.5" />
              {t("actions.edit")}
            </Link>
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            {t("actions.delete")}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{t("stats.discount")}</span>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {promotion.discount_type === "percentage"
                ? `${promotion.discount_value}%`
                : `${promotion.discount_value} MDL`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {promotion.discount_type === "percentage" ? t("detail.discountTypePercentage") : t("detail.discountTypeFixed")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{t("stats.products")}</span>
              <Package className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("stats.productsInPromotion")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{t("stats.startDate")}</span>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {format(new Date(promotion.start_date), "MMM dd, yyyy")}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{t("stats.endDate")}</span>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {format(new Date(promotion.end_date), "MMM dd, yyyy")}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Products Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {t("stats.products")} ({total})
            </CardTitle>
            <Button onClick={() => setProductSelectorOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              {t("actions.addProducts")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {selectedProductIds.size > 0 && (
            <div className="mb-4 flex items-center justify-between p-3 bg-primary/10 border border-primary/20 rounded-lg">
              <span className="text-sm font-medium">
                {t("detail.selectedProducts", { count: selectedProductIds.size })}
              </span>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleRemoveProducts}
              >
                <Trash2 className="h-4 w-4 mr-1.5" />
                {t("actions.removeSelected")}
              </Button>
            </div>
          )}

          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-lg font-semibold">{t("empty.noProducts")}</p>
              <p className="text-sm text-muted-foreground mb-4">
                {t("empty.noProductsDescription")}
              </p>
              <Button onClick={() => setProductSelectorOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" />
                {t("actions.addProducts")}
              </Button>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>{t("productSelector.tableProduct")}</TableHead>
                    <TableHead>{t("productSelector.tableBrand")}</TableHead>
                    <TableHead>{t("productSelector.tableCategory")}</TableHead>
                    <TableHead className="text-right">{t("detail.originalPrice")}</TableHead>
                    <TableHead className="text-right">{t("detail.discountedPrice")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedProductIds.has(product.id)}
                          onCheckedChange={(checked) =>
                            handleSelectOne(product.id, checked as boolean)
                          }
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <Link
                          href={`/products/${product.id}`}
                          className="hover:text-primary hover:underline"
                        >
                          {product.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">{product.code}</div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {product.brand_name || "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {product.category_name || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {product.price_mdl !== null ? (
                          <span className="text-sm">
                            {product.price_mdl.toLocaleString()} MDL
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <PriceDisplay
                          priceMdl={product.price_mdl}
                          priceEur={product.price_eur}
                          priceUsd={product.price_usd}
                          discountedPriceMdl={product.discounted_price_mdl}
                          discountedPriceEur={product.discounted_price_eur}
                          discountedPriceUsd={product.discounted_price_usd}
                          discountPercent={product.effective_discount_percent}
                          size="sm"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    {t("productSelector.page")} {currentPage} {t("productSelector.of")} {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      {t("pagination.previous")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      {t("pagination.next")}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dialogs.deleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("dialogs.deleteDetailDescription", { name: promotion.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {t("actions.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              {t("actions.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Selector */}
      <ProductSelector
        promotionId={promotion.id}
        open={productSelectorOpen}
        onOpenChange={setProductSelectorOpen}
        onProductsAdded={loadData}
      />
    </div>
  );
}

function PromotionDetailSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}
