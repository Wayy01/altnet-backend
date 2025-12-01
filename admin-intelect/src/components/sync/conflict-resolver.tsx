"use client";

import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Database,
  Cloud,
  GitMerge,
  Edit3,
  SkipForward,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/language-context";
import { ConflictDiffViewer } from "./conflict-diff-viewer";
import {
  SyncConflict,
  ConflictResolverProps,
  ConflictResolutionRequest,
  ResolutionStrategy,
} from "@/types/conflict";
import { cn } from "@/lib/utils";

/**
 * Resolution strategy icons
 */
const STRATEGY_ICONS: Record<ResolutionStrategy, React.ReactNode> = {
  local_wins: <Database className="h-4 w-4" />,
  remote_wins: <Cloud className="h-4 w-4" />,
  merge: <GitMerge className="h-4 w-4" />,
  manual: <Edit3 className="h-4 w-4" />,
  skip: <SkipForward className="h-4 w-4" />,
};

/**
 * Resolution strategy colors
 */
const STRATEGY_COLORS: Record<ResolutionStrategy, string> = {
  local_wins: "border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20",
  remote_wins: "border-green-500/30 bg-green-500/10 hover:bg-green-500/20",
  merge: "border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20",
  manual: "border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20",
  skip: "border-muted-foreground/30 bg-muted/50 hover:bg-muted/70",
};

/**
 * Conflict Resolver Component
 *
 * Allows users to select and resolve one or more conflicts using various strategies.
 * Supports bulk resolution and manual merge editing.
 */
export function ConflictResolver({
  conflicts,
  onResolve,
  onCancel,
}: ConflictResolverProps) {
  const { t } = useTranslation('sync');
  const { t: tCommon } = useTranslation('common');

  // State
  const [selectedConflicts, setSelectedConflicts] = useState<Set<string>>(
    new Set(conflicts.map(c => c.id))
  );
  const [strategy, setStrategy] = useState<ResolutionStrategy>('remote_wins');
  const [customResolution, setCustomResolution] = useState<string>('');
  const [applyToSimilar, setApplyToSimilar] = useState(false);
  const [expandedConflict, setExpandedConflict] = useState<string | null>(
    conflicts.length === 1 ? conflicts[0].id : null
  );
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isResolving, setIsResolving] = useState(false);

  // Animation state
  const [contentVisible, setContentVisible] = useState(true);

  // Calculate selected conflicts
  const selectedConflictsList = useMemo(() => {
    return conflicts.filter(c => selectedConflicts.has(c.id));
  }, [conflicts, selectedConflicts]);

  // Check if all conflicts are selected
  const allSelected = useMemo(() => {
    return conflicts.every(c => selectedConflicts.has(c.id));
  }, [conflicts, selectedConflicts]);

  // Toggle single conflict selection
  const toggleConflict = useCallback((conflictId: string) => {
    setSelectedConflicts(prev => {
      const next = new Set(prev);
      if (next.has(conflictId)) {
        next.delete(conflictId);
      } else {
        next.add(conflictId);
      }
      return next;
    });
  }, []);

  // Toggle all conflicts
  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedConflicts(new Set());
    } else {
      setSelectedConflicts(new Set(conflicts.map(c => c.id)));
    }
  }, [allSelected, conflicts]);

  // Toggle expanded conflict
  const toggleExpanded = useCallback((conflictId: string) => {
    setExpandedConflict(prev => prev === conflictId ? null : conflictId);
  }, []);

  // Validate custom resolution JSON
  const validateCustomResolution = useCallback((): Record<string, unknown> | null => {
    if (strategy !== 'manual') return null;
    if (!customResolution.trim()) {
      toast.error(t('conflict.resolver.customResolutionRequired'));
      return null;
    }
    try {
      const parsed = JSON.parse(customResolution);
      if (typeof parsed !== 'object' || parsed === null) {
        toast.error(t('conflict.resolver.invalidJson'));
        return null;
      }
      return parsed;
    } catch {
      toast.error(t('conflict.resolver.invalidJson'));
      return null;
    }
  }, [strategy, customResolution, t]);

  // Handle resolve button click
  const handleResolveClick = useCallback(() => {
    if (selectedConflictsList.length === 0) {
      toast.error(t('conflict.resolver.selectAtLeastOne'));
      return;
    }

    if (strategy === 'manual') {
      const parsed = validateCustomResolution();
      if (!parsed) return;
    }

    setShowConfirmDialog(true);
  }, [selectedConflictsList.length, strategy, validateCustomResolution, t]);

  // Handle confirm resolution
  const handleConfirmResolve = useCallback(async () => {
    setIsResolving(true);
    setShowConfirmDialog(false);

    try {
      const request: ConflictResolutionRequest = {
        conflict_ids: Array.from(selectedConflicts),
        resolution_strategy: strategy,
        apply_to_similar: applyToSimilar,
      };

      if (strategy === 'manual' && customResolution.trim()) {
        request.custom_resolution = JSON.parse(customResolution);
      }

      await onResolve(request);

      toast.success(t('conflict.resolver.resolveSuccess'), {
        description: `${selectedConflictsList.length} ${t('conflict.resolver.conflictsResolved')}`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to resolve conflicts';
      toast.error(t('conflict.resolver.resolveFailed'), {
        description: errorMessage,
      });
    } finally {
      setIsResolving(false);
    }
  }, [
    selectedConflicts,
    strategy,
    applyToSimilar,
    customResolution,
    selectedConflictsList.length,
    onResolve,
    t,
  ]);

  // Pre-fill custom resolution with merged data
  const prefillMergedData = useCallback(() => {
    if (selectedConflictsList.length !== 1) return;

    const conflict = selectedConflictsList[0];
    const merged = {
      ...conflict.local_data,
      ...conflict.remote_data,
    };
    setCustomResolution(JSON.stringify(merged, null, 2));
  }, [selectedConflictsList]);

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
                <GitMerge className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold">
                  {t('conflict.resolver.title')}
                </CardTitle>
                <CardDescription className="text-sm">
                  {t('conflict.resolver.description')}
                </CardDescription>
              </div>
            </div>
            <Badge variant="secondary" className="text-sm">
              {selectedConflictsList.length} / {conflicts.length} {t('conflict.resolver.selected')}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="pt-5 space-y-6">
          {/* Conflicts List */}
          <div className="space-y-3">
            {/* Select All */}
            <div className="flex items-center justify-between pb-2 border-b">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-all"
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                />
                <Label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                  {t('conflict.resolver.selectAll')}
                </Label>
              </div>
            </div>

            {/* Conflict items */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {conflicts.map((conflict, index) => (
                <div
                  key={conflict.id}
                  className={cn(
                    "rounded-xl border transition-all duration-200",
                    selectedConflicts.has(conflict.id)
                      ? "border-primary/30 bg-primary/5"
                      : "border-border/50 bg-card hover:border-border"
                  )}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* Conflict header */}
                  <div className="flex items-center gap-3 p-3">
                    <Checkbox
                      checked={selectedConflicts.has(conflict.id)}
                      onCheckedChange={() => toggleConflict(conflict.id)}
                    />
                    <div
                      className="flex-1 flex items-center justify-between cursor-pointer"
                      onClick={() => toggleExpanded(conflict.id)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="outline" className="text-xs shrink-0">
                          {t(`conflict.entityTypes.${conflict.entity_type}`)}
                        </Badge>
                        <span className="text-sm font-mono text-muted-foreground truncate">
                          {conflict.entity_id.slice(0, 8)}...
                        </span>
                        <Badge
                          variant="secondary"
                          className="text-xs shrink-0"
                        >
                          {t(`conflict.types.${conflict.conflict_type}`)}
                        </Badge>
                      </div>
                      <Button variant="ghost" size="sm" className="shrink-0">
                        {expandedConflict === conflict.id ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded diff view */}
                  {expandedConflict === conflict.id && (
                    <div className="px-3 pb-3 pt-0 border-t">
                      <div className="pt-3">
                        <ConflictDiffViewer conflict={conflict} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Resolution Strategy */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {t('conflict.resolver.resolutionStrategy')}
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {(['local_wins', 'remote_wins', 'merge', 'manual', 'skip'] as ResolutionStrategy[]).map(
                (strat) => (
                  <button
                    key={strat}
                    type="button"
                    onClick={() => setStrategy(strat)}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-all duration-200",
                      STRATEGY_COLORS[strat],
                      strategy === strat && "ring-2 ring-primary"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {STRATEGY_ICONS[strat]}
                      <span className="text-xs font-medium truncate">
                        {t(`conflict.strategies.${strat}`)}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground line-clamp-2">
                      {t(`conflict.strategyDescriptions.${strat}`)}
                    </p>
                  </button>
                )
              )}
            </div>
          </div>

          {/* Manual Resolution Editor */}
          {strategy === 'manual' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {t('conflict.resolver.customResolution')}
                </h4>
                {selectedConflictsList.length === 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={prefillMergedData}
                    className="text-xs"
                  >
                    {t('conflict.resolver.prefillMerged')}
                  </Button>
                )}
              </div>
              <Textarea
                value={customResolution}
                onChange={(e) => setCustomResolution(e.target.value)}
                placeholder={t('conflict.resolver.customResolutionPlaceholder')}
                className="font-mono text-sm min-h-[200px] rounded-xl"
              />
              <p className="text-xs text-muted-foreground">
                {t('conflict.resolver.customResolutionHint')}
              </p>
            </div>
          )}

          {/* Apply to Similar */}
          <div className="flex items-center gap-2 p-3 rounded-xl border bg-muted/30">
            <Checkbox
              id="apply-similar"
              checked={applyToSimilar}
              onCheckedChange={(checked) => setApplyToSimilar(!!checked)}
            />
            <div className="flex-1">
              <Label htmlFor="apply-similar" className="text-sm font-medium cursor-pointer">
                {t('conflict.resolver.applyToSimilar')}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t('conflict.resolver.applyToSimilarHint')}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            {onCancel && (
              <Button
                variant="outline"
                onClick={onCancel}
                disabled={isResolving}
                className="transition-all duration-200 hover:shadow-sm"
              >
                {tCommon('actions.cancel')}
              </Button>
            )}
            <Button
              onClick={handleResolveClick}
              disabled={selectedConflictsList.length === 0 || isResolving}
              className="transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
            >
              {isResolving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('conflict.resolver.resolving')}
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {t('conflict.resolver.resolveConflicts')} ({selectedConflictsList.length})
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="rounded-xl max-w-lg">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 rounded-full bg-primary/10">
                <GitMerge className="h-6 w-6 text-primary" />
              </div>
              <AlertDialogTitle className="text-xl">
                {t('conflict.resolver.confirmTitle')}
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="space-y-4">
              <p className="text-muted-foreground">
                {t('conflict.resolver.confirmDescription')}
              </p>

              <div className="p-4 rounded-xl bg-muted/50 border space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t('conflict.resolver.conflictsCount')}
                  </span>
                  <span className="text-sm font-medium">{selectedConflictsList.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t('conflict.resolver.strategy')}
                  </span>
                  <span className="text-sm font-medium">
                    {t(`conflict.strategies.${strategy}`)}
                  </span>
                </div>
                {applyToSimilar && (
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span className="text-sm text-muted-foreground">
                      {t('conflict.resolver.willApplyToSimilar')}
                    </span>
                  </div>
                )}
              </div>

              <p className="text-sm text-yellow-600 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{t('conflict.resolver.confirmWarning')}</span>
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="transition-all duration-200 hover:shadow-sm">
              {tCommon('actions.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmResolve}
              className="transition-all duration-200 hover:shadow-sm"
              disabled={isResolving}
            >
              {isResolving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('conflict.resolver.resolving')}
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {t('conflict.resolver.confirm')}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default ConflictResolver;
