"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ShoppingCart,
  User,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Truck,
  Store,
  Package,
  Calendar,
  DollarSign,
  Loader2,
  ChevronRight,
  FileText,
  CheckCircle2,
  MessageSquare,
  Send,
  ExternalLink,
  RotateCcw,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

import { api } from "@/lib/api";
import { OrderWithItems, OrderStatus, OrderComment } from "@/types/orders";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/contexts/language-context";

/**
 * Get status badge variant and label
 */
function getStatusConfig(status: OrderStatus, t: (key: string) => string): {
  variant: "default" | "secondary" | "destructive" | "outline";
  label: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
} {
  switch (status) {
    case "pending":
      return {
        variant: "secondary",
        label: t("status.pending"),
        bgColor: "bg-amber-100 dark:bg-amber-900/30",
        textColor: "text-amber-700 dark:text-amber-400",
        borderColor: "border-amber-200 dark:border-amber-800"
      };
    case "confirmed":
      return {
        variant: "default",
        label: t("status.confirmed"),
        bgColor: "bg-blue-100 dark:bg-blue-900/30",
        textColor: "text-blue-700 dark:text-blue-400",
        borderColor: "border-blue-200 dark:border-blue-800"
      };
    case "processing":
      return {
        variant: "default",
        label: t("status.processing"),
        bgColor: "bg-orange-100 dark:bg-orange-900/30",
        textColor: "text-orange-700 dark:text-orange-400",
        borderColor: "border-orange-200 dark:border-orange-800"
      };
    case "shipped":
      return {
        variant: "default",
        label: t("status.shipped"),
        bgColor: "bg-purple-100 dark:bg-purple-900/30",
        textColor: "text-purple-700 dark:text-purple-400",
        borderColor: "border-purple-200 dark:border-purple-800"
      };
    case "delivered":
      return {
        variant: "default",
        label: t("status.delivered"),
        bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
        textColor: "text-emerald-700 dark:text-emerald-400",
        borderColor: "border-emerald-200 dark:border-emerald-800"
      };
    case "cancelled":
      return {
        variant: "destructive",
        label: t("status.cancelled"),
        bgColor: "bg-red-100 dark:bg-red-900/30",
        textColor: "text-red-700 dark:text-red-400",
        borderColor: "border-red-200 dark:border-red-800"
      };
    default:
      return {
        variant: "outline",
        label: status,
        bgColor: "bg-gray-100 dark:bg-gray-900/30",
        textColor: "text-gray-700 dark:text-gray-400",
        borderColor: "border-gray-200 dark:border-gray-800"
      };
  }
}

/**
 * Get valid status transitions based on current status
 */
function getValidStatusTransitions(currentStatus: OrderStatus): OrderStatus[] {
  switch (currentStatus) {
    case "pending":
      return ["confirmed", "cancelled"];
    case "confirmed":
      return ["processing", "cancelled"];
    case "processing":
      return ["shipped", "cancelled"];
    case "shipped":
      return ["delivered"];
    case "delivered":
      return []; // Terminal state
    case "cancelled":
      return ["pending"]; // Can revert to pending
    default:
      return [];
  }
}

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;
  const { t } = useTranslation("orders");

  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contentVisible, setContentVisible] = useState(false);
  const [comments, setComments] = useState<OrderComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isAddingComment, setIsAddingComment] = useState(false);

  const fetchComments = async () => {
    try {
      const data = await api.getOrderComments(orderId);
      setComments(data);
    } catch (err) {
      console.error("Failed to fetch comments:", err);
    }
  };

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        setIsLoading(true);
        const data = await api.getOrder(orderId);
        setOrder(data);
        setError(null);
        setTimeout(() => setContentVisible(true), 50);

        // Fetch comments after order is loaded
        await fetchComments();
      } catch (err) {
        console.error("Failed to fetch order:", err);
        setError("Failed to load order details");
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrder();
  }, [orderId]);

  const handleStatusChange = async (newStatus: OrderStatus) => {
    if (!order) return;

    setIsUpdatingStatus(true);
    try {
      await api.updateOrderStatus(orderId, newStatus);
      toast.success(t("toast.statusUpdated"));
      // Refresh order data
      const updatedOrder = await api.getOrder(orderId);
      setOrder(updatedOrder);
    } catch (err) {
      console.error("Failed to update order status:", err);
      toast.error(t("toast.statusError"));
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    setIsAddingComment(true);
    try {
      const comment = await api.createOrderComment(orderId, newComment);
      setComments([comment, ...comments]);
      setNewComment("");
      toast.success(t("toast.commentAdded"));
    } catch (err) {
      console.error("Failed to add comment:", err);
      toast.error(t("toast.commentError"));
    } finally {
      setIsAddingComment(false);
    }
  };

  if (isLoading) {
    return <OrderDetailSkeleton />;
  }

  if (error || !order) {
    return (
      <div className="space-y-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("error.backToOrders")}
        </Button>
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="p-4 rounded-full bg-destructive/10 mb-4">
              <ShoppingCart className="h-10 w-10 text-destructive" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">{t("error.notFound")}</p>
            <p className="text-xs text-muted-foreground text-center mb-4">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/orders")}
            >
              {t("error.backToOrders")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const statusConfig = getStatusConfig(order.status, t);
  const validTransitions = getValidStatusTransitions(order.status);

  return (
    <div
      className={cn(
        "flex flex-col gap-4 transition-all duration-500",
        contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}
    >
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link
          href="/orders"
          className="hover:text-foreground transition-colors duration-200"
        >
          {t("page.title")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">{order.order_number}</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.back()}
            className="shrink-0 h-10 w-10 rounded-xl border-border/50 transition-all duration-200 hover:bg-muted hover:border-border hover:-translate-y-0.5 hover:shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border shadow-sm bg-gradient-to-br from-primary/20 to-primary/5 border-primary/20 transition-all duration-200 hover:scale-105">
              <ShoppingCart className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t("detail.title")} {order.order_number}</h1>
              <p className="text-sm text-muted-foreground">
                {t("detail.placedOn")} {format(new Date(order.created_at), "MMMM dd, yyyy 'at' HH:mm")}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            className={cn(
              "font-medium px-3 py-1 border",
              statusConfig.bgColor,
              statusConfig.textColor,
              statusConfig.borderColor
            )}
          >
            {statusConfig.label}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column - Order Details */}
        <div className="lg:col-span-2 space-y-4">
          {/* Order Items */}
          <Card className="rounded-xl border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Package className="h-4 w-4" />
                {t("detail.orderItems")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("detail.product")}</TableHead>
                    <TableHead className="text-right">{t("detail.quantity")}</TableHead>
                    <TableHead className="text-right">{t("detail.unitPrice")}</TableHead>
                    <TableHead className="text-right">{t("detail.total")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <Link
                            href={`/products/${item.product_id}`}
                            className="font-medium text-primary hover:underline inline-flex items-center gap-1 group"
                          >
                            {item.product_name}
                            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </Link>
                          {item.product_sku && (
                            <span className="text-xs text-muted-foreground">
                              {t("detail.sku")}: {item.product_sku}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">{item.unit_price.toFixed(2)} MDL</TableCell>
                      <TableCell className="text-right font-medium">
                        {item.total_price.toFixed(2)} MDL
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Order Summary */}
              <div className="mt-4 pt-4 border-t space-y-2">
                <div className="flex justify-between text-base font-semibold">
                  <span>{t("detail.total")}</span>
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-4 w-4" />
                    {order.total_amount.toFixed(2)} {order.currency}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Delivery Information */}
          <Card className="rounded-xl border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                {order.delivery_type === "delivery" ? (
                  <Truck className="h-4 w-4" />
                ) : (
                  <Store className="h-4 w-4" />
                )}
                {order.delivery_type === "delivery" ? t("detail.deliveryInfo") : t("detail.pickupInfo")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {order.delivery_type === "delivery" ? (
                <>
                  {order.delivery_address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{t("detail.address")}</span>
                        <span className="text-sm text-muted-foreground">
                          {order.delivery_address}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {order.store_name && (
                    <div className="flex items-start gap-2">
                      <Store className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{t("detail.pickupLocation")}</span>
                        <span className="text-sm text-muted-foreground">{order.store_name}</span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Admin Comments */}
          <Card className="rounded-xl border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                {t("detail.adminComments")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add Comment Form */}
              <div className="space-y-2">
                <Textarea
                  placeholder={t("detail.commentPlaceholder")}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
                <Button
                  onClick={handleAddComment}
                  disabled={isAddingComment || !newComment.trim()}
                  size="sm"
                  className="w-full"
                >
                  {isAddingComment ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  {isAddingComment ? t("detail.addingComment") : t("detail.addComment")}
                </Button>
              </div>

              {/* Comments List */}
              {comments.length > 0 ? (
                <div className="space-y-3 pt-3 border-t">
                  {comments.map((comment) => (
                    <div key={comment.id} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{comment.admin_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(comment.created_at), "MMM dd, HH:mm")}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {comment.content}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  {t("detail.noComments")}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          {order.notes && (
            <Card className="rounded-xl border-border/50 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  {t("detail.orderNotes")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{order.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Customer & Status */}
        <div className="space-y-4">
          {/* Customer Information */}
          <Card className="rounded-xl border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <User className="h-4 w-4" />
                {t("detail.customerInfo")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{order.full_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{order.phone_number}</span>
              </div>
              {order.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{order.email}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Information */}
          <Card className="rounded-xl border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                {t("detail.paymentInfo")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm capitalize">
                  {order.payment_method.replace("_", " ")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">{order.total_amount.toFixed(2)} {order.currency}</span>
              </div>
            </CardContent>
          </Card>

          {/* Status Management */}
          <Card className="rounded-xl border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                {t("detail.orderStatus")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("detail.currentStatus")}</span>
                <Badge
                  className={cn(
                    "font-medium px-2 py-0.5 border",
                    statusConfig.bgColor,
                    statusConfig.textColor,
                    statusConfig.borderColor
                  )}
                >
                  {statusConfig.label}
                </Badge>
              </div>

              {validTransitions.length > 0 && (
                <div className="space-y-2">
                  {order.status === "cancelled" && validTransitions.includes("pending") && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      <RotateCcw className="h-3 w-3" />
                      <span>{t("detail.revertToPending")}</span>
                    </div>
                  )}
                  <span className="text-sm text-muted-foreground">{t("detail.updateStatus")}</span>
                  <Select
                    value={order.status}
                    onValueChange={(value) => handleStatusChange(value as OrderStatus)}
                    disabled={isUpdatingStatus}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={order.status} disabled>
                        {statusConfig.label} ({t("detail.currentStatus")})
                      </SelectItem>
                      {validTransitions.map((status) => {
                        const config = getStatusConfig(status, t);
                        return (
                          <SelectItem key={status} value={status}>
                            {config.label}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {isUpdatingStatus && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>{t("detail.updatingStatus")}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-3 border-t">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>{t("detail.created")}: {format(new Date(order.created_at), "MMM dd, yyyy HH:mm")}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                  <Calendar className="h-3 w-3" />
                  <span>{t("detail.updated")}: {format(new Date(order.updated_at), "MMM dd, yyyy HH:mm")}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton loader for order detail page
 */
function OrderDetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <Skeleton className="h-6 w-48" />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
        </div>
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
