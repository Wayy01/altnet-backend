"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Play,
  Filter,
  Search,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  Power,
  Package,
  Tag,
  Layers,
  List,
  AlertCircle,
  TestTube,
} from "lucide-react";
import {
  SyncEntityFilter,
  FilterEntityType,
  FilterLogic,
  FilterCondition,
  FilterCreateRequest,
  FilterUpdateRequest,
  FilterTestResult,
  DEFAULT_ENTITY_FIELDS,
} from "@/types/filter";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/language-context";
import { FilterBuilder } from "@/components/sync/filter-builder";

// Entity type icons
const entityTypeIcons: Record<FilterEntityType, React.ReactNode> = {
  products: <Package className="h-4 w-4" />,
  brands: <Tag className="h-4 w-4" />,
  categories: <Layers className="h-4 w-4" />,
  properties: <List className="h-4 w-4" />,
};

// Entity type labels (will be translated)
const entityTypeKeys: Record<FilterEntityType, string> = {
  products: "products",
  brands: "brands",
  categories: "categories",
  properties: "properties",
};

export default function FiltersPage() {
  const { t } = useTranslation("sync");
  const { t: tCommon } = useTranslation("common");
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<SyncEntityFilter[]>([]);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  // Animation states
  const [contentVisible, setContentVisible] = useState(false);
  const [rowsVisible, setRowsVisible] = useState(false);

  // Dialog states
  const [formOpen, setFormOpen] = useState(false);
  const [editingFilter, setEditingFilter] = useState<SyncEntityFilter | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingFilter, setDeletingFilter] = useState<SyncEntityFilter | null>(null);
  const [testResult, setTestResult] = useState<FilterTestResult | null>(null);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    entity_type: FilterEntityType;
    logic: FilterLogic;
    conditions: FilterCondition[];
    is_active: boolean;
  }>({
    name: "",
    description: "",
    entity_type: "products",
    logic: "AND",
    conditions: [],
    is_active: true,
  });
  const [formLoading, setFormLoading] = useState(false);

  // Trigger animations on mount
  useEffect(() => {
    const timer1 = setTimeout(() => setContentVisible(true), 50);
    const timer2 = setTimeout(() => setRowsVisible(true), 200);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  const loadFilters = useCallback(async () => {
    try {
      setLoading(true);
      setRowsVisible(false);
      const response = await api.listFilters(100, 0);
      setFilters(response.data);
      setTotal(response.total);
      setTimeout(() => setRowsVisible(true), 100);
    } catch (error) {
      console.error("Failed to load filters:", error);
      toast.error(t("filter.toast.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadFilters();
  }, [loadFilters]);

  const resetForm = useCallback(() => {
    setFormData({
      name: "",
      description: "",
      entity_type: "products",
      logic: "AND",
      conditions: [],
      is_active: true,
    });
  }, []);

  const handleCreate = () => {
    setEditingFilter(null);
    resetForm();
    setFormOpen(true);
  };

  const handleEdit = (filter: SyncEntityFilter) => {
    setEditingFilter(filter);
    setFormData({
      name: filter.name,
      description: filter.description || "",
      entity_type: filter.entity_type,
      logic: filter.logic,
      conditions: filter.conditions,
      is_active: filter.is_active,
    });
    setFormOpen(true);
  };

  const handleDelete = (filter: SyncEntityFilter) => {
    setDeletingFilter(filter);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingFilter) return;

    try {
      await api.deleteFilter(deletingFilter.id);
      toast.success(t("filter.toast.deleted"));
      setDeleteDialogOpen(false);
      setDeletingFilter(null);
      loadFilters();
    } catch (error) {
      console.error("Failed to delete filter:", error);
      toast.error(t("filter.toast.deleteFailed"));
    }
  };

  const handleToggle = async (filter: SyncEntityFilter) => {
    try {
      await api.toggleFilter(filter.id);
      toast.success(
        filter.is_active
          ? t("filter.toast.disabled")
          : t("filter.toast.enabled")
      );
      loadFilters();
    } catch (error) {
      console.error("Failed to toggle filter:", error);
      toast.error(t("filter.toast.toggleFailed"));
    }
  };

  const handleTest = async (filter: SyncEntityFilter) => {
    try {
      setTestingId(filter.id);
      const result = await api.testFilter(filter.id);
      setTestResult(result);
      setTestDialogOpen(true);
    } catch (error) {
      console.error("Failed to test filter:", error);
      toast.error(t("filter.toast.testFailed"));
    } finally {
      setTestingId(null);
    }
  };

  const handleSaveFilter = async () => {
    // Validation
    if (!formData.name.trim()) {
      toast.error(t("filter.form.nameRequired"));
      return;
    }

    if (formData.conditions.length === 0) {
      toast.error(t("filter.form.conditionsRequired"));
      return;
    }

    // Check if all conditions have required values
    const hasInvalidConditions = formData.conditions.some((c) => {
      const opRequiresValue =
        c.operator !== "is_null" && c.operator !== "is_not_null";
      return (
        opRequiresValue &&
        (c.value === null ||
          c.value === "" ||
          (Array.isArray(c.value) && c.value.length === 0))
      );
    });

    if (hasInvalidConditions) {
      toast.error(t("filter.form.invalidConditions"));
      return;
    }

    try {
      setFormLoading(true);

      if (editingFilter) {
        // Update existing
        const updateRequest: FilterUpdateRequest = {
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          entity_type: formData.entity_type,
          logic: formData.logic,
          conditions: formData.conditions.map(({ field, operator, value }) => ({
            field,
            operator,
            value,
          })),
          is_active: formData.is_active,
        };
        await api.updateFilter(editingFilter.id, updateRequest);
        toast.success(t("filter.toast.updated"));
      } else {
        // Create new
        const createRequest: FilterCreateRequest = {
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          entity_type: formData.entity_type,
          logic: formData.logic,
          conditions: formData.conditions.map(({ field, operator, value }) => ({
            field,
            operator,
            value,
          })),
          is_active: formData.is_active,
        };
        await api.createFilter(createRequest);
        toast.success(t("filter.toast.created"));
      }

      setFormOpen(false);
      loadFilters();
    } catch (error) {
      console.error("Failed to save filter:", error);
      toast.error(
        editingFilter
          ? t("filter.toast.updateFailed")
          : t("filter.toast.createFailed")
      );
    } finally {
      setFormLoading(false);
    }
  };

  const filteredFilters = useMemo(() => {
    if (!searchQuery.trim()) return filters;

    const query = searchQuery.toLowerCase();
    return filters.filter(
      (filter) =>
        filter.name.toLowerCase().includes(query) ||
        filter.description?.toLowerCase().includes(query) ||
        filter.entity_type.toLowerCase().includes(query)
    );
  }, [filters, searchQuery]);

  const stats = useMemo(
    () => ({
      total: filters.length,
      active: filters.filter((f) => f.is_active).length,
      inactive: filters.filter((f) => !f.is_active).length,
    }),
    [filters]
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div
        className={`
          flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between
          transition-all duration-300 ease-out
          ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
        `}
      >
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="transition-all duration-200 hover:scale-110 hover:bg-muted active:scale-95"
          >
            <Link href="/sync">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {t("filter.page.title")}
            </h1>
            <p className="text-muted-foreground">{t("filter.page.description")}</p>
          </div>
        </div>
        <Button
          onClick={handleCreate}
          className="gap-2 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
        >
          <Plus className="h-4 w-4" />
          {t("filter.newFilter")}
        </Button>
      </div>

      {/* Stats Bar */}
      <div
        className={`
          flex flex-wrap items-center gap-3
          transition-all duration-300 ease-out
          ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
        `}
        style={{ transitionDelay: "50ms" }}
      >
        {[
          {
            label: t("filter.stats.total"),
            value: stats.total,
            icon: <Filter className="h-3.5 w-3.5" />,
            variant: "default",
          },
          {
            label: t("filter.stats.active"),
            value: stats.active,
            icon: <CheckCircle2 className="h-3.5 w-3.5" />,
            variant: stats.active > 0 ? "success" : "muted",
          },
          {
            label: t("filter.stats.inactive"),
            value: stats.inactive,
            icon: <Power className="h-3.5 w-3.5" />,
            variant: "muted",
          },
        ].map((stat, index) => (
          <div
            key={stat.label}
            className={`
              inline-flex items-center gap-2 px-3 py-2 rounded-lg border
              transition-all duration-200 ease-out hover:shadow-sm hover:border-border/80 hover:-translate-y-0.5
              ${stat.variant === "success" ? "bg-primary/5 border-primary/20 hover:bg-primary/10" : "bg-muted/50"}
            `}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <span
              className={
                stat.variant === "success"
                  ? "text-primary"
                  : "text-muted-foreground"
              }
            >
              {stat.icon}
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              {stat.label}
            </span>
            <span className="text-sm font-semibold tabular-nums">
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      {/* Main Content Card */}
      <div
        className={`
          transition-all duration-300 ease-out
          ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
        `}
        style={{ transitionDelay: "100ms" }}
      >
        <Card className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <CardHeader className="pb-3 bg-muted/30 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("filter.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 rounded-lg max-w-md"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <FiltersSkeleton />
            ) : filteredFilters.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="p-4 rounded-full bg-muted/50 mb-4">
                  <Filter className="h-10 w-10 text-muted-foreground/50" />
                </div>
                <p className="font-medium text-foreground">
                  {searchQuery
                    ? t("filter.noFiltersFound")
                    : t("filter.noFilters")}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {searchQuery
                    ? t("filter.adjustSearch")
                    : t("filter.createFirst")}
                </p>
                {!searchQuery && (
                  <Button
                    onClick={handleCreate}
                    className="mt-4 gap-2"
                    variant="outline"
                  >
                    <Plus className="h-4 w-4" />
                    {t("filter.newFilter")}
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="font-semibold w-[50px]">
                        {t("filter.table.enabled")}
                      </TableHead>
                      <TableHead className="font-semibold">
                        {t("filter.table.name")}
                      </TableHead>
                      <TableHead className="font-semibold">
                        {t("filter.table.entityType")}
                      </TableHead>
                      <TableHead className="font-semibold">
                        {t("filter.table.logic")}
                      </TableHead>
                      <TableHead className="font-semibold">
                        {t("filter.table.conditions")}
                      </TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFilters.map((filter, index) => (
                      <TableRow
                        key={filter.id}
                        className={`
                          transition-all duration-200 hover:bg-muted/50
                          ${rowsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
                        `}
                        style={{
                          transitionDelay: rowsVisible
                            ? `${Math.min(index * 30, 300)}ms`
                            : "0ms",
                        }}
                      >
                        <TableCell>
                          <Switch
                            checked={filter.is_active}
                            onCheckedChange={() => handleToggle(filter)}
                            className="data-[state=checked]:bg-primary"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">
                              {filter.name}
                            </p>
                            {filter.description && (
                              <p className="text-xs text-muted-foreground truncate max-w-[200px] mt-0.5">
                                {filter.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="gap-1.5">
                            {entityTypeIcons[filter.entity_type]}
                            {t(`filter.entityTypes.${entityTypeKeys[filter.entity_type]}`)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={
                              filter.logic === "AND"
                                ? "bg-primary/10 text-primary border-primary/20"
                                : "bg-secondary text-secondary-foreground border-border"
                            }
                          >
                            {filter.logic}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-mono">
                            {filter.conditions.length}{" "}
                            {filter.conditions.length === 1
                              ? t("filter.table.condition")
                              : t("filter.table.conditionsPlural")}
                          </span>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 transition-all duration-200 hover:bg-muted hover:scale-105"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-48 rounded-lg"
                            >
                              <DropdownMenuItem
                                onClick={() => handleTest(filter)}
                                disabled={testingId === filter.id}
                                className="cursor-pointer"
                              >
                                {testingId === filter.id ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <TestTube className="h-4 w-4 mr-2" />
                                )}
                                {t("filter.actions.test")}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleEdit(filter)}
                                className="cursor-pointer"
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                {t("filter.actions.edit")}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDelete(filter)}
                                className="text-destructive focus:text-destructive cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {t("filter.actions.delete")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filter Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Filter className="h-5 w-5" />
              {editingFilter
                ? t("filter.dialog.editTitle")
                : t("filter.dialog.createTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("filter.dialog.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="filter-name" className="font-medium">
                  {t("filter.form.name")}{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="filter-name"
                  placeholder={t("filter.form.namePlaceholder")}
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  maxLength={255}
                  className="h-11 rounded-lg"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="filter-description" className="font-medium">
                  {t("filter.form.description")}
                </Label>
                <Textarea
                  id="filter-description"
                  placeholder={t("filter.form.descriptionPlaceholder")}
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={2}
                  maxLength={500}
                  className="rounded-lg resize-none"
                />
              </div>
            </div>

            {/* Entity Type */}
            <div className="space-y-2">
              <Label className="font-medium">
                {t("filter.form.entityType")}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.entity_type}
                onValueChange={(value: FilterEntityType) => {
                  setFormData({
                    ...formData,
                    entity_type: value,
                    conditions: [], // Reset conditions when entity type changes
                  });
                }}
                disabled={!!editingFilter} // Can't change entity type when editing
              >
                <SelectTrigger className="h-11 rounded-lg">
                  <SelectValue placeholder={t("filter.form.selectEntityType")} />
                </SelectTrigger>
                <SelectContent className="rounded-lg">
                  {(["products", "brands", "categories", "properties"] as FilterEntityType[]).map(
                    (type) => (
                      <SelectItem key={type} value={type}>
                        <div className="flex items-center gap-2">
                          {entityTypeIcons[type]}
                          <span>{t(`filter.entityTypes.${entityTypeKeys[type]}`)}</span>
                        </div>
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
              {editingFilter && (
                <p className="text-xs text-muted-foreground">
                  {t("filter.form.entityTypeLockedHint")}
                </p>
              )}
            </div>

            {/* Conditions Builder */}
            <div className="space-y-3 rounded-xl border p-4 bg-muted/20">
              <div className="flex items-center gap-2 mb-3">
                <Filter className="h-4 w-4 text-primary" />
                <Label className="font-medium">
                  {t("filter.form.conditions")}{" "}
                  <span className="text-destructive">*</span>
                </Label>
              </div>
              <FilterBuilder
                entityType={formData.entity_type}
                conditions={formData.conditions}
                logic={formData.logic}
                onConditionsChange={(conditions) =>
                  setFormData({ ...formData, conditions })
                }
                onLogicChange={(logic) => setFormData({ ...formData, logic })}
                availableFields={DEFAULT_ENTITY_FIELDS[formData.entity_type]}
                disabled={formLoading}
              />
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between rounded-xl border p-4 bg-muted/30 transition-colors hover:bg-muted/50">
              <div className="space-y-0.5">
                <Label htmlFor="is-active" className="font-medium cursor-pointer">
                  {t("filter.form.active")}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t("filter.form.activeHint")}
                </p>
              </div>
              <Switch
                id="is-active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked })
                }
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setFormOpen(false)}
              disabled={formLoading}
              className="transition-all duration-200 hover:shadow-sm"
            >
              {tCommon("cancel")}
            </Button>
            <Button
              onClick={handleSaveFilter}
              disabled={formLoading}
              className="transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
            >
              {formLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("filter.form.saving")}
                </>
              ) : editingFilter ? (
                t("filter.form.update")
              ) : (
                t("filter.form.create")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Result Dialog */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="rounded-xl max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TestTube className="h-5 w-5" />
              {t("filter.testDialog.title")}
            </DialogTitle>
            <DialogDescription>
              {t("filter.testDialog.description")}
            </DialogDescription>
          </DialogHeader>
          {testResult && (
            <div className="space-y-4 py-4">
              <div className="rounded-xl bg-muted/50 border p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-muted-foreground">
                    {t("filter.testDialog.entityType")}
                  </span>
                  <Badge variant="outline" className="gap-1.5">
                    {entityTypeIcons[testResult.entity_type]}
                    {t(`filter.entityTypes.${entityTypeKeys[testResult.entity_type]}`)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t("filter.testDialog.matchingCount")}
                  </span>
                  <span className="text-2xl font-bold text-primary">
                    {testResult.matching_count.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm text-muted-foreground">
                    {t("filter.testDialog.totalCount")}
                  </span>
                  <span className="text-lg font-semibold">
                    {testResult.total_count.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Match Percentage */}
              <div className="text-center">
                <span className="text-sm text-muted-foreground">
                  {t("filter.testDialog.matchPercentage")}
                </span>
                <p className="text-3xl font-bold mt-1">
                  {testResult.total_count > 0
                    ? (
                        (testResult.matching_count / testResult.total_count) *
                        100
                      ).toFixed(1)
                    : 0}
                  %
                </p>
              </div>

              {testResult.matching_count === 0 && (
                <div className="flex items-start gap-2 text-muted-foreground text-sm p-3 rounded-lg bg-muted/50 border border-border">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{t("filter.testDialog.noMatches")}</span>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              onClick={() => setTestDialogOpen(false)}
              className="transition-all duration-200"
            >
              {tCommon("close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="rounded-xl max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 ring-2 ring-destructive/20">
                <Trash2 className="h-5 w-5 text-destructive" />
              </div>
              {t("filter.deleteDialog.title")}
            </DialogTitle>
            <DialogDescription className="pt-3">
              {t("filter.deleteDialog.description")}{" "}
              <strong>&quot;{deletingFilter?.name}&quot;</strong>?{" "}
              {t("filter.deleteDialog.cannotUndo")}
            </DialogDescription>
          </DialogHeader>
          {deletingFilter && (
            <div className="p-4 rounded-xl bg-muted/50 border">
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>{t("filter.deleteDialog.entityType")}:</span>
                  <span className="font-medium text-foreground">
                    {t(`filter.entityTypes.${entityTypeKeys[deletingFilter.entity_type]}`)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{t("filter.deleteDialog.status")}:</span>
                  <span className="font-medium text-foreground">
                    {deletingFilter.is_active
                      ? t("filter.status.active")
                      : t("filter.status.inactive")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{t("filter.deleteDialog.conditions")}:</span>
                  <span className="font-medium text-foreground">
                    {deletingFilter.conditions.length}
                  </span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="transition-all duration-200 hover:shadow-sm"
            >
              {tCommon("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              className="transition-all duration-200 hover:shadow-md"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t("filter.deleteDialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Skeleton loader for filters page
 */
function FiltersSkeleton() {
  return (
    <div className="p-0">
      {/* Table header skeleton */}
      <div className="flex items-center gap-4 p-4 border-b bg-muted/30">
        <Skeleton className="h-5 w-10" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-8 ml-auto" />
      </div>
      {/* Table rows skeleton */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 p-4 border-b last:border-b-0"
          style={{ opacity: 1 - i * 0.15 }}
        >
          <Skeleton className="h-5 w-10 rounded-full" />
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-12 rounded-full" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-8 rounded-lg ml-auto" />
        </div>
      ))}
    </div>
  );
}
