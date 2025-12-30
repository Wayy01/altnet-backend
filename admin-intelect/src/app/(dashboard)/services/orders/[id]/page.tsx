"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  Building2,
  FileText,
  Package as PackageIcon,
  Calendar,
  Clock,
  CheckCircle2,
  Save,
  Trash2,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { ServiceOrder, ServiceOrderStatus } from "@/types/services";
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

function getAvailableStatuses(currentStatus: ServiceOrderStatus): ServiceOrderStatus[] {
  switch (currentStatus) {
    case "pending":
      return ["contacted", "rejected"];
    case "contacted":
      return ["approved", "rejected"];
    case "approved":
      return ["completed", "rejected"];
    case "completed":
      return []; // No changes allowed
    case "rejected":
      return ["pending"]; // Can revert to pending
    default:
      return [];
  }
}

export default function ServiceOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { t } = useTranslation("services");
  const { t: tCommon } = useTranslation("common");

  const orderId = params.id as string;

  const [order, setOrder] = useState<ServiceOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [selectedStatus, setSelectedStatus] = useState<ServiceOrderStatus | "">("");
  const [adminNotes, setAdminNotes] = useState("");

  const fetchOrder = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await api.getServiceOrder(orderId);
      setOrder(data);
      setSelectedStatus("");
      setAdminNotes(data.notes || "");
      setError(null);
    } catch (err) {
      console.error("Failed to fetch order:", err);
      setError(t("error.notFound"));
    } finally {
      setIsLoading(false);
    }
  }, [orderId, t]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const handleUpdateStatus = async () => {
    if (!selectedStatus || !order) return;

    setIsUpdating(true);
    try {
      await api.updateServiceOrder(order.id, { status: selectedStatus });
      toast.success(t("toast.statusUpdated"));
      fetchOrder();
    } catch (error) {
      console.error("Failed to update status:", error);
      toast.error(t("toast.statusError"));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateNotes = async () => {
    if (!order) return;

    setIsUpdating(true);
    try {
      await api.updateServiceOrder(order.id, { notes: adminNotes || null });
      toast.success(t("toast.updated"));
      fetchOrder();
    } catch (error) {
      console.error("Failed to update notes:", error);
      toast.error(t("toast.error"));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!order) return;

    setIsDeleting(true);
    try {
      await api.deleteServiceOrder(order.id);
      toast.success(t("toast.deleted"));
      router.push("/services/orders");
    } catch (error) {
      console.error("Failed to delete order:", error);
      toast.error(t("toast.error"));
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild className="mb-4">
          <Link href="/services/orders">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("error.backToList")}
          </Link>
        </Button>
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="p-4 rounded-full bg-destructive/10 mb-4">
              <PackageIcon className="h-10 w-10 text-destructive" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">{t("error.title")}</p>
            <p className="text-xs text-muted-foreground text-center mb-4">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/services/orders")}
              className="transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
            >
              {t("error.backToList")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const statusConfig = getStatusConfig(order.status, t);
  const availableStatuses = getAvailableStatuses(order.status);
  const canUpdateStatus = availableStatuses.length > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/services/orders">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("orders.detail.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              {format(new Date(order.created_at), "MMMM dd, yyyy 'at' HH:mm")}
            </p>
          </div>
          <Badge variant={statusConfig.variant} className="ml-2">
            <div className={cn("h-1.5 w-1.5 rounded-full mr-1.5", statusConfig.color)} />
            {statusConfig.label}
          </Badge>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setShowDeleteDialog(true)}
          className="transition-all duration-200 hover:shadow-sm"
        >
          <Trash2 className="h-4 w-4 mr-1.5" />
          {t("actions.delete")}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Customer Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {t("orders.detail.customerInfo")}
            </CardTitle>
            <CardDescription>{t("orders.customer")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">{t("orders.customer")}</Label>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{order.customer_name}</span>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">{t("orders.phone")}</Label>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a href={`tel:${order.customer_phone}`} className="font-medium hover:underline">
                  {order.customer_phone}
                </a>
              </div>
            </div>
            {order.customer_email && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">{t("orders.email")}</Label>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${order.customer_email}`} className="font-medium hover:underline">
                      {order.customer_email}
                    </a>
                  </div>
                </div>
              </>
            )}
            {order.customer_address && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">{t("orders.address")}</Label>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{order.customer_address}</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Package Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PackageIcon className="h-5 w-5" />
              {t("orders.detail.packageInfo")}
            </CardTitle>
            <CardDescription>{t("orders.package")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">{t("orders.package")}</Label>
              <div className="flex items-center gap-2">
                <PackageIcon className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{order.package_name || "Unknown Package"}</span>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Created</Label>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{format(new Date(order.created_at), "MMM dd, yyyy HH:mm")}</span>
              </div>
            </div>
            {order.contacted_at && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Contacted</Label>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{format(new Date(order.contacted_at), "MMM dd, yyyy HH:mm")}</span>
                  </div>
                </div>
              </>
            )}
            {order.resolved_at && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Resolved</Label>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{format(new Date(order.resolved_at), "MMM dd, yyyy HH:mm")}</span>
                  </div>
                </div>
              </>
            )}
            {order.admin_username && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Handled by</Label>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{order.admin_username}</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Admin Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t("orders.detail.adminSection")}
          </CardTitle>
          <CardDescription>Manage order status and add internal notes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Update */}
          {canUpdateStatus && (
            <div className="space-y-3">
              <Label htmlFor="status">{t("orders.updateStatus")}</Label>
              <div className="flex gap-2">
                <Select value={selectedStatus} onValueChange={(value) => setSelectedStatus(value as ServiceOrderStatus)}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select new status..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableStatuses.map((status) => {
                      const config = getStatusConfig(status, t);
                      return (
                        <SelectItem key={status} value={status}>
                          <div className="flex items-center gap-2">
                            <div className={cn("h-2 w-2 rounded-full", config.color)} />
                            {config.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleUpdateStatus}
                  disabled={!selectedStatus || isUpdating}
                  className="transition-all duration-200"
                >
                  {isUpdating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Update Status
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {!canUpdateStatus && order.status === "completed" && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm text-muted-foreground">
                This order is completed. No status changes are allowed.
              </span>
            </div>
          )}

          <Separator />

          {/* Admin Notes */}
          <div className="space-y-3">
            <Label htmlFor="admin_notes">{t("orders.notes")}</Label>
            <Textarea
              id="admin_notes"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Add internal notes about this order..."
              rows={6}
              className="resize-none"
            />
            <div className="flex justify-end">
              <Button
                onClick={handleUpdateNotes}
                disabled={isUpdating}
                variant="outline"
                className="transition-all duration-200"
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("orders.detail.saving")}
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {t("orders.detail.save")}
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title={t("dialog.deleteTitle")}
        description={t("dialog.deleteDescription")}
        confirmLabel={t("dialog.confirmDelete")}
        onConfirm={handleDelete}
        variant="destructive"
        isLoading={isDeleting}
      />
    </div>
  );
}
