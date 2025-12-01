"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RotateCcw,
  AlertTriangle,
  Clock,
  Database,
  Package,
  Tag,
  Layers,
  List,
  CheckCircle2,
  XCircle,
  Loader2,
  ShieldAlert,
  Info,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/language-context";
import {
  RollbackPreview,
  RollbackPreviewProps,
  RollbackType,
  RollbackEntityType,
  formatRollbackDuration,
  getRollbackRiskLevel,
  RISK_LEVEL_COLORS,
  RISK_LEVEL_BG_COLORS,
} from "@/types/rollback";

const ENTITY_TYPE_ICONS: Record<string, React.ReactNode> = {
  brand: <Tag className="h-4 w-4" />,
  category: <Layers className="h-4 w-4" />,
  product: <Package className="h-4 w-4" />,
  property: <List className="h-4 w-4" />,
};

export function RollbackPreviewComponent({ syncLogId, onRollbackComplete }: RollbackPreviewProps) {
  const { t } = useTranslation('sync');
  const { t: tCommon } = useTranslation('common');

  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<RollbackPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);
  const [rollbackType, setRollbackType] = useState<RollbackType>('full');
  const [selectedEntityTypes, setSelectedEntityTypes] = useState<RollbackEntityType[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  // Animation state
  const [contentVisible, setContentVisible] = useState(false);

  const loadPreview = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setIsNotFound(false);
      const data = await api.getRollbackPreview(syncLogId);
      setPreview(data);
      setTimeout(() => setContentVisible(true), 50);
    } catch (err) {
      // Check if this is a 404 error (no snapshot available)
      const errorMessage = err instanceof Error ? err.message : 'Failed to load rollback preview';
      const is404 = errorMessage.toLowerCase().includes('404') ||
                    errorMessage.toLowerCase().includes('not found') ||
                    errorMessage.toLowerCase().includes('no snapshot');

      if (is404) {
        setIsNotFound(true);
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  }, [syncLogId]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  const handleExecuteRollback = async () => {
    if (!preview) return;

    setIsExecuting(true);
    try {
      const request = {
        sync_log_id: syncLogId,
        rollback_type: rollbackType,
        entity_types: rollbackType === 'partial' ? selectedEntityTypes : undefined,
        confirm_hash: preview.confirm_hash,
      };

      const result = await api.executeRollback(request);

      toast.success(t('rollback.toast.success'), {
        description: `${result.entities_restored} ${t('rollback.entitiesRestored')}`,
      });

      setShowConfirmDialog(false);
      onRollbackComplete?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to execute rollback';
      toast.error(t('rollback.toast.failed'), {
        description: errorMessage,
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const toggleEntityType = (entityType: RollbackEntityType) => {
    setSelectedEntityTypes(prev =>
      prev.includes(entityType)
        ? prev.filter(t => t !== entityType)
        : [...prev, entityType]
    );
  };

  const riskLevel = preview ? getRollbackRiskLevel(preview.affected_records) : 'low';

  if (loading) {
    return <RollbackPreviewSkeleton />;
  }

  if (isNotFound) {
    return (
      <Card className="rounded-xl border bg-card shadow-sm">
        <CardContent className="pt-6">
          <Alert className="rounded-xl border-yellow-500/20 bg-yellow-500/5">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertTitle className="text-yellow-800 dark:text-yellow-200">{t('rollback.noSnapshot')}</AlertTitle>
            <AlertDescription className="text-yellow-700 dark:text-yellow-300">
              {t('rollback.noSnapshotDescription')}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="rounded-xl border bg-card shadow-sm">
        <CardContent className="pt-6">
          <Alert variant="destructive" className="rounded-xl">
            <XCircle className="h-4 w-4" />
            <AlertTitle>{t('rollback.errorTitle')}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="mt-4 flex justify-center">
            <Button variant="outline" onClick={loadPreview}>
              {tCommon('actions.retry')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!preview) {
    return (
      <Card className="rounded-xl border bg-card shadow-sm">
        <CardContent className="pt-6">
          <Alert className="rounded-xl border-yellow-500/20 bg-yellow-500/5">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertTitle>{t('rollback.noSnapshot')}</AlertTitle>
            <AlertDescription>
              {t('rollback.noSnapshotDescription')}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card
        className={`
          rounded-xl border bg-card shadow-sm overflow-hidden
          transition-all duration-300 ease-out
          ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
        `}
      >
        <CardHeader className="pb-3 bg-muted/30 border-b">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-background shadow-sm">
              <RotateCcw className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">{t('rollback.previewTitle')}</CardTitle>
              <CardDescription className="text-sm">
                {t('rollback.previewDescription')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-5 space-y-5">
          {/* Snapshot Info */}
          <div
            className={`
              rounded-xl border p-4 bg-muted/20
              transition-all duration-300 ease-out
              ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
            `}
            style={{ transitionDelay: "50ms" }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">{t('rollback.snapshotInfo')}</span>
              </div>
              <Badge variant="outline" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                {formatRollbackDuration(preview.snapshot_age)} {t('rollback.ago')}
              </Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-background border border-border/50">
                <p className="text-xs text-muted-foreground">{t('rollback.totalEntities')}</p>
                <p className="text-lg font-bold tabular-nums">{preview.total_entities.toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-lg bg-background border border-border/50">
                <p className="text-xs text-muted-foreground">{t('rollback.affectedRecords')}</p>
                <p className="text-lg font-bold tabular-nums">{preview.affected_records.toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-lg bg-background border border-border/50">
                <p className="text-xs text-muted-foreground">{t('rollback.estimatedTime')}</p>
                <p className="text-lg font-bold tabular-nums">{formatRollbackDuration(preview.estimated_time)}</p>
              </div>
              <div className={`p-3 rounded-lg border ${RISK_LEVEL_BG_COLORS[riskLevel]}`}>
                <p className="text-xs text-muted-foreground">{t('rollback.riskLevel')}</p>
                <p className={`text-lg font-bold capitalize ${RISK_LEVEL_COLORS[riskLevel]}`}>{riskLevel}</p>
              </div>
            </div>
          </div>

          {/* Entity Breakdown */}
          <div
            className={`
              transition-all duration-300 ease-out
              ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
            `}
            style={{ transitionDelay: "100ms" }}
          >
            <h4 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
              {t('rollback.entityBreakdown')}
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(preview.entities_by_type).map(([type, count], index) => (
                <div
                  key={type}
                  className={`
                    group flex flex-col p-4 rounded-xl bg-muted/30 border border-border/30
                    transition-all duration-200 hover:bg-muted/50 hover:shadow-md hover:-translate-y-0.5
                    ${rollbackType === 'partial' && selectedEntityTypes.includes(type as RollbackEntityType)
                      ? 'ring-2 ring-primary border-primary/30'
                      : ''
                    }
                  `}
                  style={{ animationDelay: `${150 + index * 50}ms` }}
                  onClick={() => rollbackType === 'partial' && toggleEntityType(type as RollbackEntityType)}
                  role={rollbackType === 'partial' ? 'button' : undefined}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-1.5 rounded-lg bg-background shadow-sm group-hover:shadow-md transition-shadow">
                      {ENTITY_TYPE_ICONS[type] || <Database className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <p className="text-xl font-bold tabular-nums">{count.toLocaleString()}</p>
                  </div>
                  <p className="text-xs text-muted-foreground font-medium capitalize">
                    {t(`rollback.entityTypes.${type}`) || type}
                  </p>
                  {rollbackType === 'partial' && (
                    <div className="mt-2">
                      {selectedEntityTypes.includes(type as RollbackEntityType) ? (
                        <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          {t('rollback.selected')}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          {t('rollback.clickToSelect')}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Rollback Type Selection */}
          <div
            className={`
              transition-all duration-300 ease-out
              ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
            `}
            style={{ transitionDelay: "150ms" }}
          >
            <h4 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
              {t('rollback.rollbackType')}
            </h4>
            <Select value={rollbackType} onValueChange={(v) => setRollbackType(v as RollbackType)}>
              <SelectTrigger className="w-full h-12 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {(['full', 'partial'] as RollbackType[]).map((type) => (
                  <SelectItem key={type} value={type} className="rounded-lg">
                    <div className="flex flex-col py-1">
                      <span className="font-medium">{t(`rollback.types.${type}`)}</span>
                      <span className="text-xs text-muted-foreground">{t(`rollback.typeDescriptions.${type}`)}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Warnings */}
          {preview.warnings.length > 0 && (
            <div
              className={`
                transition-all duration-300 ease-out
                ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
              `}
              style={{ transitionDelay: "200ms" }}
            >
              <Alert className="rounded-xl border-yellow-500/20 bg-yellow-500/5">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertTitle className="text-yellow-800 dark:text-yellow-200">{t('rollback.warnings')}</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1 mt-2 text-yellow-700 dark:text-yellow-300">
                    {preview.warnings.map((warning, index) => (
                      <li key={index} className="text-sm">{warning}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Info Notice */}
          <div
            className={`
              transition-all duration-300 ease-out
              ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
            `}
            style={{ transitionDelay: "250ms" }}
          >
            <Alert className="rounded-xl border-blue-500/20 bg-blue-500/5">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-800 dark:text-blue-200">{t('rollback.infoTitle')}</AlertTitle>
              <AlertDescription className="text-blue-700 dark:text-blue-300 text-sm">
                {t('rollback.infoDescription')}
              </AlertDescription>
            </Alert>
          </div>

          {/* Execute Button */}
          <div
            className={`
              flex justify-end pt-2
              transition-all duration-300 ease-out
              ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
            `}
            style={{ transitionDelay: "300ms" }}
          >
            <Button
              onClick={() => setShowConfirmDialog(true)}
              disabled={rollbackType === 'partial' && selectedEntityTypes.length === 0}
              className="transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              {t('rollback.executeRollback')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="rounded-xl max-w-lg">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-3 rounded-full ${RISK_LEVEL_BG_COLORS[riskLevel]}`}>
                <ShieldAlert className={`h-6 w-6 ${RISK_LEVEL_COLORS[riskLevel]}`} />
              </div>
              <AlertDialogTitle className="text-xl">
                {t('rollback.confirmTitle')}
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="space-y-4">
              <p className="text-muted-foreground">
                {t('rollback.confirmDescription')}
              </p>

              <div className="p-4 rounded-xl bg-muted/50 border space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">{t('rollback.rollbackType')}</span>
                  <span className="text-sm font-medium">{t(`rollback.types.${rollbackType}`)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">{t('rollback.affectedRecords')}</span>
                  <span className="text-sm font-medium">{preview?.affected_records.toLocaleString()}</span>
                </div>
                {rollbackType === 'partial' && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">{t('rollback.entityTypes')}</span>
                    <span className="text-sm font-medium">{selectedEntityTypes.join(', ')}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">{t('rollback.estimatedTime')}</span>
                  <span className="text-sm font-medium">{formatRollbackDuration(preview?.estimated_time || 0)}</span>
                </div>
              </div>

              <p className="text-sm text-destructive flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{t('rollback.confirmWarning')}</span>
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="transition-all duration-200 hover:shadow-sm">
              {tCommon('actions.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExecuteRollback}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all duration-200 hover:shadow-sm"
              disabled={isExecuting}
            >
              {isExecuting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('rollback.executing')}
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  {t('rollback.confirmButton')}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function RollbackPreviewSkeleton() {
  return (
    <Card className="rounded-xl border bg-card shadow-sm">
      <CardHeader className="pb-3 bg-muted/30 border-b">
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-7 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-5 space-y-5">
        <div className="rounded-xl border p-4 bg-muted/20">
          <div className="flex items-center justify-between mb-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-3 rounded-lg bg-background border" style={{ opacity: 1 - i * 0.15 }}>
                <Skeleton className="h-3 w-20 mb-2" />
                <Skeleton className="h-6 w-16" />
              </div>
            ))}
          </div>
        </div>

        <div>
          <Skeleton className="h-4 w-32 mb-3" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-4 rounded-xl border" style={{ opacity: 1 - i * 0.15 }}>
                <div className="flex items-center justify-between mb-2">
                  <Skeleton className="h-7 w-7 rounded-lg" />
                  <Skeleton className="h-6 w-12" />
                </div>
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        </div>

        <div>
          <Skeleton className="h-4 w-28 mb-3" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>

        <div className="flex justify-end pt-2">
          <Skeleton className="h-10 w-40 rounded-md" />
        </div>
      </CardContent>
    </Card>
  );
}
