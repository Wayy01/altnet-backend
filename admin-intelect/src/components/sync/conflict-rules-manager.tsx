"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Settings2,
  Plus,
  MoreVertical,
  Edit2,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  ArrowUpDown,
  Shield,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/language-context";
import { api } from "@/lib/api";
import {
  SyncConflictRule,
  ConflictEntityType,
  ConflictType,
  ResolutionStrategy,
  CreateConflictRuleRequest,
  UpdateConflictRuleRequest,
  ConflictRulesManagerProps,
} from "@/types/conflict";
import { cn } from "@/lib/utils";

/**
 * Conflict Rules Manager Component
 *
 * Provides CRUD operations for conflict resolution rules with priority ordering.
 */
export function ConflictRulesManager({ onRuleChange }: ConflictRulesManagerProps) {
  const { t } = useTranslation('sync');
  const { t: tCommon } = useTranslation('common');

  // State
  const [rules, setRules] = useState<SyncConflictRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedRule, setSelectedRule] = useState<SyncConflictRule | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form state
  const [formData, setFormData] = useState<CreateConflictRuleRequest>({
    name: '',
    entity_type: 'product',
    conflict_type: 'concurrent_modification',
    priority: 100,
    resolution_strategy: 'remote_wins',
    conditions: {},
    merge_strategy: {},
    is_active: true,
  });

  // Animation states
  const [contentVisible, setContentVisible] = useState(false);
  const [rowsVisible, setRowsVisible] = useState(false);

  // Load rules
  const loadRules = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.listConflictRules();
      setRules(data);
      setTimeout(() => setContentVisible(true), 50);
      setTimeout(() => setRowsVisible(true), 150);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load conflict rules';
      setError(errorMessage);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRowsVisible(false);
    await loadRules();
  };

  // Sorted rules by priority
  const sortedRules = useMemo(() => {
    return [...rules].sort((a, b) => a.priority - b.priority);
  }, [rules]);

  // Stats
  const stats = useMemo(() => {
    const active = rules.filter(r => r.is_active).length;
    const inactive = rules.filter(r => !r.is_active).length;
    return { total: rules.length, active, inactive };
  }, [rules]);

  // Reset form
  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      entity_type: 'product',
      conflict_type: 'concurrent_modification',
      priority: 100,
      resolution_strategy: 'remote_wins',
      conditions: {},
      merge_strategy: {},
      is_active: true,
    });
  }, []);

  // Handle create
  const handleCreate = useCallback(async () => {
    if (!formData.name.trim()) {
      toast.error(t('conflict.rules.nameRequired'));
      return;
    }

    setIsSaving(true);
    try {
      await api.createConflictRule(formData);
      toast.success(t('conflict.rules.createSuccess'));
      setShowCreateDialog(false);
      resetForm();
      await loadRules();
      onRuleChange?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create rule';
      toast.error(t('conflict.rules.createFailed'), { description: errorMessage });
    } finally {
      setIsSaving(false);
    }
  }, [formData, t, resetForm, loadRules, onRuleChange]);

  // Handle edit
  const handleEdit = useCallback((rule: SyncConflictRule) => {
    setSelectedRule(rule);
    setFormData({
      name: rule.name,
      entity_type: rule.entity_type,
      conflict_type: rule.conflict_type,
      priority: rule.priority,
      resolution_strategy: rule.resolution_strategy,
      conditions: rule.conditions,
      merge_strategy: rule.merge_strategy,
      is_active: rule.is_active,
    });
    setShowEditDialog(true);
  }, []);

  // Handle update
  const handleUpdate = useCallback(async () => {
    if (!selectedRule) return;
    if (!formData.name.trim()) {
      toast.error(t('conflict.rules.nameRequired'));
      return;
    }

    setIsSaving(true);
    try {
      await api.updateConflictRule(selectedRule.id, formData as UpdateConflictRuleRequest);
      toast.success(t('conflict.rules.updateSuccess'));
      setShowEditDialog(false);
      setSelectedRule(null);
      resetForm();
      await loadRules();
      onRuleChange?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update rule';
      toast.error(t('conflict.rules.updateFailed'), { description: errorMessage });
    } finally {
      setIsSaving(false);
    }
  }, [selectedRule, formData, t, resetForm, loadRules, onRuleChange]);

  // Handle delete confirm
  const handleDeleteConfirm = useCallback((rule: SyncConflictRule) => {
    setSelectedRule(rule);
    setShowDeleteDialog(true);
  }, []);

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (!selectedRule) return;

    setIsDeleting(true);
    try {
      await api.deleteConflictRule(selectedRule.id);
      toast.success(t('conflict.rules.deleteSuccess'));
      setShowDeleteDialog(false);
      setSelectedRule(null);
      await loadRules();
      onRuleChange?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete rule';
      toast.error(t('conflict.rules.deleteFailed'), { description: errorMessage });
    } finally {
      setIsDeleting(false);
    }
  }, [selectedRule, t, loadRules, onRuleChange]);

  // Handle toggle active
  const handleToggleActive = useCallback(async (rule: SyncConflictRule) => {
    try {
      await api.updateConflictRule(rule.id, { is_active: !rule.is_active });
      toast.success(
        rule.is_active ? t('conflict.rules.deactivated') : t('conflict.rules.activated')
      );
      await loadRules();
      onRuleChange?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update rule';
      toast.error(t('conflict.rules.updateFailed'), { description: errorMessage });
    }
  }, [t, loadRules, onRuleChange]);

  if (loading) {
    return <ConflictRulesManagerSkeleton />;
  }

  if (error) {
    return (
      <Card className="rounded-xl border bg-card shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-8">
            <div className="p-4 rounded-full bg-destructive/10 mb-4">
              <XCircle className="h-10 w-10 text-destructive/50" />
            </div>
            <p className="text-muted-foreground text-center max-w-md">{error}</p>
            <Button variant="outline" className="mt-4" onClick={handleRefresh}>
              {tCommon('actions.retry')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card
        className={cn(
          "rounded-xl border bg-card shadow-sm overflow-hidden",
          "transition-all duration-300 ease-out",
          contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        )}
      >
        <CardHeader className="pb-3 bg-muted/30 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-background shadow-sm">
                <Settings2 className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold">
                  {t('conflict.rules.title')}
                </CardTitle>
                <CardDescription className="text-sm">
                  {t('conflict.rules.description')}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
              >
                <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
                {tCommon('actions.refresh')}
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  resetForm();
                  setShowCreateDialog(true);
                }}
                className="transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('conflict.rules.newRule')}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-5 space-y-5">
          {/* Stats */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/50 transition-all duration-200 hover:shadow-sm">
              <Shield className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                {t('conflict.rules.stats.total')}
              </span>
              <span className="text-sm font-semibold tabular-nums">{stats.total}</span>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-primary/5 border-primary/20 transition-all duration-200 hover:shadow-sm">
              <Zap className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">
                {t('conflict.rules.stats.active')}
              </span>
              <span className="text-sm font-semibold tabular-nums">{stats.active}</span>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/50 transition-all duration-200 hover:shadow-sm">
              <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                {t('conflict.rules.stats.inactive')}
              </span>
              <span className="text-sm font-semibold tabular-nums">{stats.inactive}</span>
            </div>
          </div>

          {/* Rules Table */}
          {sortedRules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="p-4 rounded-full bg-muted/50 mb-4">
                <Settings2 className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <p className="font-medium text-foreground">{t('conflict.rules.noRules')}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {t('conflict.rules.noRulesDescription')}
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  resetForm();
                  setShowCreateDialog(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('conflict.rules.createFirst')}
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="w-[60px]">
                      <ArrowUpDown className="h-4 w-4" />
                    </TableHead>
                    <TableHead>{t('conflict.rules.table.name')}</TableHead>
                    <TableHead>{t('conflict.rules.table.entityType')}</TableHead>
                    <TableHead>{t('conflict.rules.table.conflictType')}</TableHead>
                    <TableHead>{t('conflict.rules.table.strategy')}</TableHead>
                    <TableHead>{t('conflict.rules.table.status')}</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRules.map((rule, index) => (
                    <TableRow
                      key={rule.id}
                      className={cn(
                        "transition-all duration-200 hover:bg-muted/50",
                        rowsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
                        !rule.is_active && "opacity-60"
                      )}
                      style={{
                        transitionDelay: rowsVisible ? `${Math.min(index * 20, 400)}ms` : "0ms",
                      }}
                    >
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        #{rule.priority}
                      </TableCell>
                      <TableCell className="font-medium">{rule.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {t(`conflict.entityTypes.${rule.entity_type}`)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {t(`conflict.types.${rule.conflict_type}`)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="text-xs bg-primary/10 text-primary border-primary/20">
                          {t(`conflict.strategies.${rule.resolution_strategy}`)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={rule.is_active}
                          onCheckedChange={() => handleToggleActive(rule)}
                        />
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onClick={() => handleEdit(rule)}>
                              <Edit2 className="h-4 w-4 mr-2" />
                              {tCommon('actions.edit')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteConfirm(rule)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {tCommon('actions.delete')}
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

      {/* Create/Edit Dialog */}
      <Dialog
        open={showCreateDialog || showEditDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false);
            setShowEditDialog(false);
            setSelectedRule(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="rounded-xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              {showEditDialog ? t('conflict.rules.editRule') : t('conflict.rules.createRule')}
            </DialogTitle>
            <DialogDescription>
              {t('conflict.rules.ruleDialogDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="rule-name">{t('conflict.rules.form.name')}</Label>
              <Input
                id="rule-name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder={t('conflict.rules.form.namePlaceholder')}
                className="rounded-lg"
              />
            </div>

            {/* Entity Type */}
            <div className="space-y-2">
              <Label>{t('conflict.rules.form.entityType')}</Label>
              <Select
                value={formData.entity_type}
                onValueChange={(value) =>
                  setFormData(prev => ({ ...prev, entity_type: value as ConflictEntityType }))
                }
              >
                <SelectTrigger className="rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['brand', 'category', 'product', 'property'] as ConflictEntityType[]).map(
                    (type) => (
                      <SelectItem key={type} value={type}>
                        {t(`conflict.entityTypes.${type}`)}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Conflict Type */}
            <div className="space-y-2">
              <Label>{t('conflict.rules.form.conflictType')}</Label>
              <Select
                value={formData.conflict_type}
                onValueChange={(value) =>
                  setFormData(prev => ({ ...prev, conflict_type: value as ConflictType }))
                }
              >
                <SelectTrigger className="rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['concurrent_modification', 'deleted_upstream', 'validation_error'] as ConflictType[]).map(
                    (type) => (
                      <SelectItem key={type} value={type}>
                        {t(`conflict.types.${type}`)}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label htmlFor="rule-priority">{t('conflict.rules.form.priority')}</Label>
              <Input
                id="rule-priority"
                type="number"
                min={1}
                max={999}
                value={formData.priority}
                onChange={(e) =>
                  setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) || 100 }))
                }
                className="rounded-lg"
              />
              <p className="text-xs text-muted-foreground">
                {t('conflict.rules.form.priorityHint')}
              </p>
            </div>

            {/* Resolution Strategy */}
            <div className="space-y-2">
              <Label>{t('conflict.rules.form.strategy')}</Label>
              <Select
                value={formData.resolution_strategy}
                onValueChange={(value) =>
                  setFormData(prev => ({ ...prev, resolution_strategy: value as ResolutionStrategy }))
                }
              >
                <SelectTrigger className="rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['local_wins', 'remote_wins', 'merge', 'skip'] as ResolutionStrategy[]).map(
                    (strat) => (
                      <SelectItem key={strat} value={strat}>
                        {t(`conflict.strategies.${strat}`)}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <div>
                <Label htmlFor="rule-active">{t('conflict.rules.form.active')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('conflict.rules.form.activeHint')}
                </p>
              </div>
              <Switch
                id="rule-active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData(prev => ({ ...prev, is_active: checked }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                setShowEditDialog(false);
                setSelectedRule(null);
                resetForm();
              }}
              disabled={isSaving}
            >
              {tCommon('actions.cancel')}
            </Button>
            <Button
              onClick={showEditDialog ? handleUpdate : handleCreate}
              disabled={isSaving}
              className="transition-all duration-200 hover:shadow-sm"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('conflict.rules.saving')}
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {showEditDialog ? tCommon('actions.save') : tCommon('actions.create')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {t('conflict.rules.deleteTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>{t('conflict.rules.deleteDescription')}</p>
              {selectedRule && (
                <div className="p-4 rounded-xl bg-muted/50 border">
                  <p className="text-sm font-medium text-foreground">{selectedRule.name}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-xs">
                      {t(`conflict.entityTypes.${selectedRule.entity_type}`)}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {t(`conflict.types.${selectedRule.conflict_type}`)}
                    </Badge>
                  </div>
                </div>
              )}
              <p className="text-sm text-destructive flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{t('conflict.rules.deleteWarning')}</span>
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {tCommon('actions.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('conflict.rules.deleting')}
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {tCommon('actions.delete')}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * Skeleton loader for rules manager
 */
function ConflictRulesManagerSkeleton() {
  return (
    <Card className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <CardHeader className="pb-3 bg-muted/30 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-7 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-24 rounded-lg" />
            <Skeleton className="h-9 w-28 rounded-lg" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-5 space-y-5">
        <div className="flex flex-wrap gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-28 rounded-lg" />
          ))}
        </div>
        <div className="rounded-xl border overflow-hidden">
          <div className="bg-muted/30 p-4 flex gap-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-20" />
            ))}
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="p-4 border-t flex items-center gap-4"
              style={{ opacity: 1 - i * 0.2 }}
            >
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-28 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-12 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-lg ml-auto" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default ConflictRulesManager;
