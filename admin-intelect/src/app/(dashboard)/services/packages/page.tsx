"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Package as PackageIcon,
  Trash2,
  MoreHorizontal,
  Loader2,
  Pencil,
  Plus,
  Star,
  Wifi,
  Check,
  X as XIcon,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { ServicePackage, ServicePackageInput, ServicePackageType } from "@/types/services";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/contexts/language-context";

export default function ServicePackagesPage() {
  const { t } = useTranslation("services");
  const { t: tCommon } = useTranslation("common");

  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [types, setTypes] = useState<ServicePackageType[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletePackageId, setDeletePackageId] = useState<string | null>(null);
  const [editingPackage, setEditingPackage] = useState<ServicePackage | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rowsVisible, setRowsVisible] = useState(false);

  const [formData, setFormData] = useState<ServicePackageInput>({
    type_id: null,
    name: "",
    price: 0,
    network_speed: "",
    benefits: [],
    special_benefits: [],
    is_active: true,
    sort_order: 0,
  });

  const [benefitInput, setBenefitInput] = useState("");
  const [specialBenefitInput, setSpecialBenefitInput] = useState("");

  const fetchPackages = useCallback(async () => {
    try {
      setIsLoading(true);
      setRowsVisible(false);
      const filters: any = {};
      if (searchQuery) filters.search = searchQuery;
      if (typeFilter && typeFilter !== "all") filters.type_id = typeFilter;

      const response = await api.getServicePackages(filters, 100, 0);
      setPackages(response.data ?? []);
      setTotal(response.total ?? 0);
      setError(null);
      setTimeout(() => setRowsVisible(true), 50);
    } catch (err) {
      console.error("Failed to fetch packages:", err);
      setError(t("error.failedToLoad"));
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, typeFilter, t]);

  const fetchTypes = useCallback(async () => {
    try {
      const data = await api.getServicePackageTypes(true);
      setTypes(data ?? []);
    } catch (err) {
      console.error("Failed to fetch types:", err);
    }
  }, []);

  useEffect(() => {
    fetchPackages();
    fetchTypes();
  }, [fetchPackages, fetchTypes]);

  const handleCreate = () => {
    setEditingPackage(null);
    setFormData({
      type_id: null,
      name: "",
      price: 0,
      network_speed: "",
      benefits: [],
      special_benefits: [],
      is_active: true,
      sort_order: 0,
    });
    setBenefitInput("");
    setSpecialBenefitInput("");
    setShowDialog(true);
  };

  const handleEdit = (pkg: ServicePackage) => {
    setEditingPackage(pkg);
    setFormData({
      type_id: pkg.type_id,
      name: pkg.name,
      price: pkg.price,
      network_speed: pkg.network_speed || "",
      benefits: pkg.benefits || [],
      special_benefits: pkg.special_benefits || [],
      is_active: pkg.is_active,
      sort_order: pkg.sort_order,
    });
    setBenefitInput("");
    setSpecialBenefitInput("");
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || formData.name.trim() === "") {
      toast.error(t("validation.nameRequired"));
      return;
    }

    setIsProcessing(true);
    try {
      if (editingPackage) {
        await api.updateServicePackage(editingPackage.id, formData);
        toast.success(t("toast.updated"));
      } else {
        await api.createServicePackage(formData);
        toast.success(t("toast.created"));
      }
      setShowDialog(false);
      fetchPackages();
    } catch (error) {
      console.error("Failed to save package:", error);
      toast.error(t("toast.error"));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!deletePackageId) return;

    setIsProcessing(true);
    try {
      await api.deleteServicePackage(deletePackageId);
      toast.success(t("toast.deleted"));
      setShowDeleteDialog(false);
      setDeletePackageId(null);
      fetchPackages();
    } catch (error) {
      console.error("Failed to delete package:", error);
      toast.error(t("toast.error"));
    } finally {
      setIsProcessing(false);
    }
  };

  const addBenefit = () => {
    if (benefitInput.trim()) {
      setFormData({ ...formData, benefits: [...(formData.benefits || []), benefitInput.trim()] });
      setBenefitInput("");
    }
  };

  const removeBenefit = (index: number) => {
    setFormData({
      ...formData,
      benefits: (formData.benefits || []).filter((_, i) => i !== index),
    });
  };

  const addSpecialBenefit = () => {
    if (specialBenefitInput.trim()) {
      setFormData({
        ...formData,
        special_benefits: [...(formData.special_benefits || []), specialBenefitInput.trim()],
      });
      setSpecialBenefitInput("");
    }
  };

  const removeSpecialBenefit = (index: number) => {
    setFormData({
      ...formData,
      special_benefits: (formData.special_benefits || []).filter((_, i) => i !== index),
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("packages.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1.5">{t("packages.description")}</p>
          </div>
        </div>
        <PackagesPageSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("packages.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1.5">{t("packages.description")}</p>
          </div>
        </div>
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

  const deletePackage = packages.find((p) => p.id === deletePackageId);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("packages.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1.5">{t("packages.description")}</p>
        </div>
        <Button
          size="sm"
          onClick={handleCreate}
          className="transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          {t("packages.create")}
        </Button>
      </div>

      <div className="space-y-4">
        {/* Filters */}
        <div className="flex gap-3">
          <Input
            placeholder={t("filters.search")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
          />
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder={t("filters.allTypes")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filters.allTypes")}</SelectItem>
              {types.map((type) => (
                <SelectItem key={type.id} value={type.id}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Packages Table */}
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
                <TableHead className="font-semibold text-xs">{t("table.type")}</TableHead>
                <TableHead className="font-semibold text-xs">{t("table.price")}</TableHead>
                <TableHead className="font-semibold text-xs">{t("table.speed")}</TableHead>
                <TableHead className="w-[80px] font-semibold text-xs">{t("table.status")}</TableHead>
                <TableHead className="w-[100px] font-semibold text-xs">
                  {t("table.actions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {packages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-64">
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="p-4 rounded-full bg-muted/50 mb-3">
                        <PackageIcon className="h-10 w-10 text-muted-foreground/50" />
                      </div>
                      <div className="text-center mb-4">
                        <p className="text-sm font-semibold text-foreground mb-1">
                          {t("empty.title")}
                        </p>
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
                        {t("packages.create")}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                packages.map((pkg, index) => (
                  <TableRow
                    key={pkg.id}
                    className={cn(
                      "border-b transition-all duration-200 hover:bg-muted/30",
                      rowsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                    )}
                    style={{
                      transitionDelay: rowsVisible ? `${Math.min(index * 20, 400)}ms` : "0ms",
                    }}
                  >
                    <TableCell className="font-medium">
                      <span>{pkg.name}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{pkg.type_name || "-"}</Badge>
                    </TableCell>
                    <TableCell>
                      {pkg.price ? `${pkg.price} MDL` : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Wifi className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm">{pkg.network_speed || "-"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={pkg.is_active ? "default" : "secondary"}>
                        {pkg.is_active ? t("status.active") : t("status.inactive")}
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
                          <DropdownMenuItem onClick={() => handleEdit(pkg)} className="cursor-pointer">
                            <Pencil className="mr-2 h-4 w-4" />
                            {t("actions.edit")}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive cursor-pointer focus:text-destructive"
                            onClick={() => {
                              setDeletePackageId(pkg.id);
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

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPackage ? t("packages.edit") : t("packages.create")}
            </DialogTitle>
            <DialogDescription>{t("packages.description")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Type Selection */}
            <div className="space-y-2">
              <Label htmlFor="type_id">{t("packages.type")}</Label>
              <Select
                value={formData.type_id || "none"}
                onValueChange={(value) => setFormData({ ...formData, type_id: value === "none" ? null : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("form.selectType")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("form.noType")}</SelectItem>
                  {types.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">{t("packages.name")} *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t("form.namePlaceholder")}
              />
            </div>

            {/* Pricing */}
            <div className="space-y-2">
              <Label htmlFor="price">{t("packages.price")} (MDL)</Label>
              <Input
                id="price"
                type="number"
                value={formData.price || ""}
                onChange={(e) => setFormData({ ...formData, price: e.target.value ? parseFloat(e.target.value) : 0 })}
                placeholder="0.00"
              />
            </div>

            {/* Network Speed */}
            <div className="space-y-2">
              <Label htmlFor="network_speed">{t("packages.speed")}</Label>
              <Input
                id="network_speed"
                value={formData.network_speed || ""}
                onChange={(e) => setFormData({ ...formData, network_speed: e.target.value })}
                placeholder={t("packages.speedPlaceholder")}
              />
            </div>

            {/* Benefits */}
            <div className="space-y-2">
              <Label>{t("packages.benefits")}</Label>
              <div className="flex gap-2">
                <Input
                  value={benefitInput}
                  onChange={(e) => setBenefitInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addBenefit();
                    }
                  }}
                  placeholder={t("packages.benefitsPlaceholder")}
                />
                <Button type="button" onClick={addBenefit} variant="outline">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {(formData.benefits || []).map((benefit, index) => (
                  <Badge key={index} variant="secondary" className="pl-2 pr-1 py-1">
                    <Check className="h-3 w-3 mr-1 text-green-600" />
                    {benefit}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 ml-2 hover:bg-transparent"
                      onClick={() => removeBenefit(index)}
                    >
                      <XIcon className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Special Benefits */}
            <div className="space-y-2">
              <Label>{t("packages.specialBenefits")}</Label>
              <div className="flex gap-2">
                <Input
                  value={specialBenefitInput}
                  onChange={(e) => setSpecialBenefitInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSpecialBenefit();
                    }
                  }}
                  placeholder={t("packages.benefitsPlaceholder")}
                />
                <Button type="button" onClick={addSpecialBenefit} variant="outline">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {(formData.special_benefits || []).map((benefit, index) => (
                  <Badge key={index} variant="default" className="pl-2 pr-1 py-1">
                    <Star className="h-3 w-3 mr-1 fill-current" />
                    {benefit}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 ml-2 hover:bg-transparent"
                      onClick={() => removeSpecialBenefit(index)}
                    >
                      <XIcon className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active" className="cursor-pointer">
                {t("packages.active")}
              </Label>
            </div>

            {/* Sort Order */}
            <div className="space-y-2">
              <Label htmlFor="sort_order">{t("packages.sortOrder")}</Label>
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

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              {t("actions.cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {editingPackage ? t("actions.saving") : t("actions.creating")}
                </>
              ) : editingPackage ? (
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
        description={t("packages.confirmDelete")}
        confirmLabel={t("dialog.confirmDelete")}
        onConfirm={handleDelete}
        variant="destructive"
        isLoading={isProcessing}
      />
    </div>
  );
}

function PackagesPageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-48" />
      </div>
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="bg-muted/30 border-b p-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
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
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-md ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
