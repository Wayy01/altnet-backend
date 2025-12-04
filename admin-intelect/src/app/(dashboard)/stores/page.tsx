"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Store as StoreIcon,
  Trash2,
  MoreHorizontal,
  Loader2,
  Eye,
  MapPin,
  Power,
  Pencil,
  Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { api } from "@/lib/api";
import { Store } from "@/types/stores";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/contexts/language-context";

export default function StoresPage() {
  const router = useRouter();
  const { t } = useTranslation("stores");
  const [stores, setStores] = useState<Store[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteStoreId, setDeleteStoreId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [rowsVisible, setRowsVisible] = useState(false);

  const fetchStores = useCallback(async () => {
    try {
      setIsLoading(true);
      setRowsVisible(false);
      const response = await api.getStores(false, 100, 0);
      setStores(response.data ?? []);
      setTotal(response.total ?? 0);
      setError(null);
      setTimeout(() => setRowsVisible(true), 50);
    } catch (err) {
      console.error("Failed to fetch stores:", err);
      setError("Failed to load stores. Make sure the Go backend API is running.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  const handleToggle = async (store: Store) => {
    try {
      setTogglingId(store.id);
      await api.toggleStore(store.id);
      toast.success(store.is_active ? t("toast.deactivated") : t("toast.activated"));
      fetchStores();
    } catch (error) {
      console.error("Failed to toggle store:", error);
      toast.error(t("toast.toggleError"));
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteStore = async () => {
    if (!deleteStoreId) return;

    setIsProcessing(true);
    try {
      await api.deleteStore(deleteStoreId);
      toast.success(t("toast.deleted"));
      setShowDeleteDialog(false);
      setDeleteStoreId(null);
      fetchStores();
    } catch (error) {
      console.error("Failed to delete store:", error);
      toast.error(t("toast.error"));
    } finally {
      setIsProcessing(false);
    }
  };

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
        <StoresPageSkeleton />
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
              <StoreIcon className="h-10 w-10 text-destructive" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">{t("error.title")}</p>
            <p className="text-xs text-muted-foreground text-center mb-4">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
              className="transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
            >
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
            <Link href="/stores/new">
              <Plus className="h-4 w-4 mr-1.5" />
              {t("actions.newStore")}
            </Link>
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Stats Bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/50 hover:shadow-sm transition-all">
            <StoreIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">{t("stats.totalStores")}</span>
            <span className="text-sm font-semibold tabular-nums">{total.toLocaleString()}</span>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-primary/5 border-primary/20 hover:shadow-sm transition-all">
            <Power className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">{t("stats.active")}</span>
            <span className="text-sm font-semibold tabular-nums">
              {stores.filter((s) => s.is_active).length}
            </span>
          </div>
        </div>

        {/* Stores Table */}
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
                <TableHead className="font-semibold text-xs">{t("table.address")}</TableHead>
                <TableHead className="w-[80px] font-semibold text-xs">{t("table.status")}</TableHead>
                <TableHead className="w-[100px] font-semibold text-xs">{t("table.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stores.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-64">
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="p-4 rounded-full bg-muted/50 mb-3">
                        <StoreIcon className="h-10 w-10 text-muted-foreground/50" />
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
                        <Link href="/stores/new">
                          <Plus className="h-4 w-4 mr-1.5" />
                          {t("actions.newStore")}
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                stores.map((store, index) => (
                  <TableRow
                    key={store.id}
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
                      <div className="flex items-center gap-2">
                        <StoreIcon className="h-4 w-4 text-muted-foreground" />
                        <span>{store.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        <span>{store.address}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={store.is_active}
                          disabled={togglingId === store.id}
                          onCheckedChange={() => handleToggle(store)}
                          className="data-[state=checked]:bg-primary transition-all duration-200 hover:opacity-80"
                        />
                        {togglingId === store.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Badge
                            variant={store.is_active ? "default" : "secondary"}
                            className={cn(
                              store.is_active &&
                                "bg-emerald-500 hover:bg-emerald-600"
                            )}
                          >
                            {store.is_active ? t("status.active") : t("status.inactive")}
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
                            <span className="sr-only">{t("table.actions")}</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem asChild>
                            <Link href={`/stores/${store.id}/edit`} className="cursor-pointer">
                              <Pencil className="mr-2 h-4 w-4" />
                              {t("actions.edit")}
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleToggle(store)}
                            className="cursor-pointer"
                          >
                            <Power className="mr-2 h-4 w-4" />
                            {store.is_active ? t("actions.deactivate") : t("actions.activate")}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive cursor-pointer focus:text-destructive"
                            onClick={() => {
                              setDeleteStoreId(store.id);
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
      </div>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title={t("dialog.deleteTitle")}
        description={t("dialog.deleteDescription").replace("{{storeName}}", stores.find(s => s.id === deleteStoreId)?.name || "")}
        confirmLabel={t("dialog.confirmDelete")}
        onConfirm={handleDeleteStore}
        variant="destructive"
        isLoading={isProcessing}
      />
    </div>
  );
}

function StoresPageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-10 w-32 rounded-lg"
            style={{ animationDelay: `${i * 100}ms` }}
          />
        ))}
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="bg-muted/30 border-b p-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16 ml-auto" />
          </div>
        </div>

        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 p-4 border-b last:border-b-0 animate-pulse"
            style={{
              animationDelay: `${i * 50}ms`,
              opacity: 1 - (i * 0.05),
            }}
          >
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-md ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
