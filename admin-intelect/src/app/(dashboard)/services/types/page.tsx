"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Layers,
  Trash2,
  MoreHorizontal,
  Loader2,
  Pencil,
  Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { ServicePackageType, ServicePackageTypeInput } from "@/types/services";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/contexts/language-context";

export default function ServiceTypesPage() {
  const { t } = useTranslation("services");
  const { t: tCommon } = useTranslation("common");

  const [types, setTypes] = useState<ServicePackageType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTypeId, setDeleteTypeId] = useState<string | null>(null);
  const [editingType, setEditingType] = useState<ServicePackageType | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rowsVisible, setRowsVisible] = useState(false);

  const [formData, setFormData] = useState<ServicePackageTypeInput>({
    name: "",        // English base name (required)
    name_ru: "",
    name_ro: "",
    slug: "",
    sort_order: 0,
    is_active: true,
  });

  const fetchTypes = useCallback(async () => {
    try {
      setIsLoading(true);
      setRowsVisible(false);
      const data = await api.getServicePackageTypes(false);
      setTypes(data ?? []);
      setError(null);
      setTimeout(() => setRowsVisible(true), 50);
    } catch (err) {
      console.error("Failed to fetch types:", err);
      setError(t("error.failedToLoad"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchTypes();
  }, [fetchTypes]);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const handleCreate = () => {
    setEditingType(null);
    setFormData({
      name: "",        // English base name (required)
      name_ru: "",
      name_ro: "",
      slug: "",
      sort_order: 0,
      is_active: true,
    });
    setShowDialog(true);
  };

  const handleEdit = (type: ServicePackageType) => {
    setEditingType(type);
    setFormData({
      name: type.name,          // English base name
      name_ru: type.name_ru || "",
      name_ro: type.name_ro || "",
      slug: type.slug,
      sort_order: type.sort_order,
      is_active: type.is_active,
    });
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || formData.name.trim() === "") {
      toast.error(t("validation.typeNameRequired"));
      return;
    }

    // Auto-generate slug if empty
    const finalData = {
      ...formData,
      slug: formData.slug || generateSlug(formData.name),
    };

    setIsProcessing(true);
    try {
      if (editingType) {
        await api.updateServicePackageType(editingType.id, finalData);
        toast.success(t("toast.updated"));
      } else {
        await api.createServicePackageType(finalData);
        toast.success(t("toast.created"));
      }
      setShowDialog(false);
      fetchTypes();
    } catch (error) {
      console.error("Failed to save type:", error);
      toast.error(t("toast.error"));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTypeId) return;

    setIsProcessing(true);
    try {
      await api.deleteServicePackageType(deleteTypeId);
      toast.success(t("toast.deleted"));
      setShowDeleteDialog(false);
      setDeleteTypeId(null);
      fetchTypes();
    } catch (error) {
      console.error("Failed to delete type:", error);
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
            <h1 className="text-3xl font-bold tracking-tight">{t("types.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1.5">{t("types.description")}</p>
          </div>
        </div>
        <TypesPageSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("types.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1.5">{t("types.description")}</p>
          </div>
        </div>
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="p-4 rounded-full bg-destructive/10 mb-4">
              <Layers className="h-10 w-10 text-destructive" />
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

  const deleteType = types.find((t) => t.id === deleteTypeId);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("types.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1.5">{t("types.description")}</p>
        </div>
        <Button
          size="sm"
          onClick={handleCreate}
          className="transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          {t("types.create")}
        </Button>
      </div>

      <div
        className={cn(
          "rounded-xl border bg-card shadow-sm overflow-hidden transition-all duration-300",
          rowsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        )}
      >
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30 border-b">
              <TableHead className="font-semibold text-xs">{t("table.name")}</TableHead>
              <TableHead className="font-semibold text-xs">{t("table.slug")}</TableHead>
              <TableHead className="font-semibold text-xs">{t("table.packages")}</TableHead>
              <TableHead className="w-[80px] font-semibold text-xs">{t("table.status")}</TableHead>
              <TableHead className="w-[100px] font-semibold text-xs">{t("table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {types.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-64">
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="p-4 rounded-full bg-muted/50 mb-3">
                      <Layers className="h-10 w-10 text-muted-foreground/50" />
                    </div>
                    <div className="text-center mb-4">
                      <p className="text-sm font-semibold text-foreground mb-1">{t("empty.title")}</p>
                      <p className="text-xs text-muted-foreground max-w-md">
                        {t("empty.description")}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleCreate}
                      className="transition-all duration-200 hover:shadow-sm"
                    >
                      <Plus className="h-4 w-4 mr-1.5" />
                      {t("types.create")}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              types.map((type, index) => (
                <TableRow
                  key={type.id}
                  className={cn(
                    "border-b transition-all duration-200 hover:bg-muted/30",
                    rowsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                  )}
                  style={{
                    transitionDelay: rowsVisible ? `${Math.min(index * 20, 400)}ms` : "0ms",
                  }}
                >
                  <TableCell className="font-medium">{type.name}</TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-2 py-1 rounded">{type.slug}</code>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{type.package_count || 0}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={type.is_active ? "default" : "secondary"}>
                      {type.is_active ? t("status.active") : t("status.inactive")}
                    </Badge>
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
                        <DropdownMenuItem onClick={() => handleEdit(type)} className="cursor-pointer">
                          <Pencil className="mr-2 h-4 w-4" />
                          {t("actions.edit")}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive cursor-pointer focus:text-destructive"
                          onClick={() => {
                            setDeleteTypeId(type.id);
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

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingType ? t("types.edit") : t("types.create")}</DialogTitle>
            <DialogDescription>{t("types.description")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Multi-language Names */}
            <Tabs defaultValue="en" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="en">{t("form.english")}</TabsTrigger>
                <TabsTrigger value="ru">{t("form.russian")}</TabsTrigger>
                <TabsTrigger value="ro">{t("form.romanian")}</TabsTrigger>
              </TabsList>
              <TabsContent value="en" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t("types.name")} *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      setFormData({
                        ...formData,
                        name: name,
                        slug: formData.slug || generateSlug(name),
                      });
                    }}
                    placeholder={t("form.namePlaceholder")}
                  />
                </div>
              </TabsContent>
              <TabsContent value="ru" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name_ru">{t("types.name")}</Label>
                  <Input
                    id="name_ru"
                    value={formData.name_ru || ""}
                    onChange={(e) => setFormData({ ...formData, name_ru: e.target.value })}
                    placeholder={t("form.namePlaceholder")}
                  />
                </div>
              </TabsContent>
              <TabsContent value="ro" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name_ro">{t("types.name")}</Label>
                  <Input
                    id="name_ro"
                    value={formData.name_ro || ""}
                    onChange={(e) => setFormData({ ...formData, name_ro: e.target.value })}
                    placeholder={t("form.namePlaceholder")}
                  />
                </div>
              </TabsContent>
            </Tabs>

            {/* Slug */}
            <div className="space-y-2">
              <Label htmlFor="slug">{t("types.slug")}</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="internet-home"
              />
              <p className="text-xs text-muted-foreground">
                Auto-generated from English name if left empty
              </p>
            </div>

            {/* Flags and Sort Order */}
            <div className="flex items-center gap-6">
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active" className="cursor-pointer">
                  {t("types.active")}
                </Label>
              </div>
              <div className="flex-1 space-y-2">
                <Label htmlFor="sort_order">{t("types.sortOrder")}</Label>
                <Input
                  id="sort_order"
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) =>
                    setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              {t("actions.cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {editingType ? t("actions.saving") : t("actions.creating")}
                </>
              ) : editingType ? (
                t("actions.save")
              ) : (
                t("actions.create")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title={t("dialog.deleteTitle")}
        description={
          deleteType?.package_count && deleteType.package_count > 0
            ? t("types.hasPackages")
            : t("types.confirmDelete")
        }
        confirmLabel={t("dialog.confirmDelete")}
        onConfirm={handleDelete}
        variant="destructive"
        isLoading={isProcessing}
      />
    </div>
  );
}

function TypesPageSkeleton() {
  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="bg-muted/30 border-b p-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16 ml-auto" />
        </div>
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 p-4 border-b last:border-b-0 animate-pulse"
          style={{ animationDelay: `${i * 50}ms`, opacity: 1 - i * 0.05 }}
        >
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-6 w-32 rounded" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-6 w-12 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-md ml-auto" />
        </div>
      ))}
    </div>
  );
}
