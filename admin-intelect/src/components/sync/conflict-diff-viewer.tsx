"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowRight,
  Database,
  Cloud,
  Plus,
  Minus,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { useTranslation } from "@/contexts/language-context";
import {
  SyncConflict,
  ConflictDiffViewerProps,
  getConflictTypeVariant,
} from "@/types/conflict";
import { cn } from "@/lib/utils";

/**
 * Represents a single field difference between local and remote data
 */
interface FieldDiff {
  fieldName: string;
  localValue: unknown;
  remoteValue: unknown;
  changeType: 'added' | 'removed' | 'modified' | 'unchanged';
}

/**
 * Get all unique keys from both objects
 */
function getAllKeys(obj1: Record<string, unknown>, obj2: Record<string, unknown>): string[] {
  const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);
  return Array.from(allKeys).sort();
}

/**
 * Compare two values for equality
 */
function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a === 'object' && a !== null && b !== null) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

/**
 * Format a value for display
 */
function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/**
 * Truncate long strings for display
 */
function truncateValue(value: string, maxLength = 100): string {
  if (value.length <= maxLength) return value;
  return value.slice(0, maxLength) + '...';
}

/**
 * Calculate field differences between local and remote data
 */
function calculateDiffs(
  localData: Record<string, unknown>,
  remoteData: Record<string, unknown>
): FieldDiff[] {
  const keys = getAllKeys(localData, remoteData);

  return keys.map(fieldName => {
    const localValue = localData[fieldName];
    const remoteValue = remoteData[fieldName];

    let changeType: FieldDiff['changeType'];

    if (!(fieldName in localData)) {
      changeType = 'added';
    } else if (!(fieldName in remoteData)) {
      changeType = 'removed';
    } else if (isEqual(localValue, remoteValue)) {
      changeType = 'unchanged';
    } else {
      changeType = 'modified';
    }

    return {
      fieldName,
      localValue,
      remoteValue,
      changeType,
    };
  });
}

/**
 * Conflict Diff Viewer Component
 *
 * Displays a side-by-side comparison of local and remote data for a conflict,
 * highlighting field-level differences.
 */
export function ConflictDiffViewer({
  conflict,
  onFieldSelect,
  selectedFields = {},
}: ConflictDiffViewerProps) {
  const { t } = useTranslation('sync');

  const diffs = useMemo(() => {
    return calculateDiffs(
      conflict.local_data as Record<string, unknown>,
      conflict.remote_data as Record<string, unknown>
    );
  }, [conflict.local_data, conflict.remote_data]);

  const changedDiffs = useMemo(() => {
    return diffs.filter(d => d.changeType !== 'unchanged');
  }, [diffs]);

  const unchangedDiffs = useMemo(() => {
    return diffs.filter(d => d.changeType === 'unchanged');
  }, [diffs]);

  const stats = useMemo(() => {
    return {
      added: diffs.filter(d => d.changeType === 'added').length,
      removed: diffs.filter(d => d.changeType === 'removed').length,
      modified: diffs.filter(d => d.changeType === 'modified').length,
      unchanged: diffs.filter(d => d.changeType === 'unchanged').length,
    };
  }, [diffs]);

  const handleFieldClick = (fieldName: string, source: 'local' | 'remote') => {
    if (onFieldSelect) {
      onFieldSelect(fieldName, source);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with conflict info */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant={getConflictTypeVariant(conflict.conflict_type)}>
            {t(`conflict.types.${conflict.conflict_type}`)}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {conflict.entity_type} / {conflict.entity_id.slice(0, 8)}...
          </span>
        </div>

        {/* Change stats */}
        <div className="flex items-center gap-3 text-xs">
          {stats.added > 0 && (
            <span className="flex items-center gap-1 text-green-600">
              <Plus className="h-3 w-3" />
              {stats.added} {t('conflict.diff.added')}
            </span>
          )}
          {stats.removed > 0 && (
            <span className="flex items-center gap-1 text-red-600">
              <Minus className="h-3 w-3" />
              {stats.removed} {t('conflict.diff.removed')}
            </span>
          )}
          {stats.modified > 0 && (
            <span className="flex items-center gap-1 text-yellow-600">
              <AlertTriangle className="h-3 w-3" />
              {stats.modified} {t('conflict.diff.modified')}
            </span>
          )}
          {stats.unchanged > 0 && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <CheckCircle2 className="h-3 w-3" />
              {stats.unchanged} {t('conflict.diff.unchanged')}
            </span>
          )}
        </div>
      </div>

      {/* Side-by-side comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Local Data */}
        <Card className="rounded-xl border-blue-500/20 bg-blue-500/5">
          <CardHeader className="pb-3 border-b border-blue-500/20">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Database className="h-4 w-4 text-blue-600" />
              {t('conflict.diff.localData')}
              {conflict.local_modified_at && (
                <span className="text-xs text-muted-foreground font-normal ml-auto">
                  {new Date(conflict.local_modified_at).toLocaleString()}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              <div className="p-4 space-y-2">
                {changedDiffs.map((diff) => (
                  <DiffField
                    key={diff.fieldName}
                    diff={diff}
                    source="local"
                    isSelected={selectedFields[diff.fieldName] === 'local'}
                    isSelectable={!!onFieldSelect && diff.changeType !== 'added'}
                    onClick={() => handleFieldClick(diff.fieldName, 'local')}
                  />
                ))}
                {unchangedDiffs.length > 0 && (
                  <details className="mt-4">
                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                      {t('conflict.diff.showUnchanged')} ({unchangedDiffs.length})
                    </summary>
                    <div className="mt-2 space-y-2 opacity-60">
                      {unchangedDiffs.map((diff) => (
                        <DiffField
                          key={diff.fieldName}
                          diff={diff}
                          source="local"
                          isSelected={false}
                          isSelectable={false}
                        />
                      ))}
                    </div>
                  </details>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Remote Data */}
        <Card className="rounded-xl border-green-500/20 bg-green-500/5">
          <CardHeader className="pb-3 border-b border-green-500/20">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Cloud className="h-4 w-4 text-green-600" />
              {t('conflict.diff.remoteData')}
              {conflict.remote_modified_at && (
                <span className="text-xs text-muted-foreground font-normal ml-auto">
                  {new Date(conflict.remote_modified_at).toLocaleString()}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              <div className="p-4 space-y-2">
                {changedDiffs.map((diff) => (
                  <DiffField
                    key={diff.fieldName}
                    diff={diff}
                    source="remote"
                    isSelected={selectedFields[diff.fieldName] === 'remote'}
                    isSelectable={!!onFieldSelect && diff.changeType !== 'removed'}
                    onClick={() => handleFieldClick(diff.fieldName, 'remote')}
                  />
                ))}
                {unchangedDiffs.length > 0 && (
                  <details className="mt-4">
                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                      {t('conflict.diff.showUnchanged')} ({unchangedDiffs.length})
                    </summary>
                    <div className="mt-2 space-y-2 opacity-60">
                      {unchangedDiffs.map((diff) => (
                        <DiffField
                          key={diff.fieldName}
                          diff={diff}
                          source="remote"
                          isSelected={false}
                          isSelectable={false}
                        />
                      ))}
                    </div>
                  </details>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * Single field diff display component
 */
interface DiffFieldProps {
  diff: FieldDiff;
  source: 'local' | 'remote';
  isSelected: boolean;
  isSelectable: boolean;
  onClick?: () => void;
}

function DiffField({ diff, source, isSelected, isSelectable, onClick }: DiffFieldProps) {
  const value = source === 'local' ? diff.localValue : diff.remoteValue;
  const formattedValue = formatValue(value);
  const displayValue = truncateValue(formattedValue);
  const isLongValue = formattedValue.length > 100;

  const getChangeTypeStyles = () => {
    switch (diff.changeType) {
      case 'added':
        return source === 'remote'
          ? 'border-green-500/30 bg-green-500/10'
          : 'border-dashed border-muted-foreground/30 bg-muted/30 opacity-50';
      case 'removed':
        return source === 'local'
          ? 'border-red-500/30 bg-red-500/10'
          : 'border-dashed border-muted-foreground/30 bg-muted/30 opacity-50';
      case 'modified':
        return 'border-yellow-500/30 bg-yellow-500/10';
      default:
        return 'border-border/50 bg-background';
    }
  };

  const getChangeTypeIcon = () => {
    switch (diff.changeType) {
      case 'added':
        return source === 'remote' ? <Plus className="h-3 w-3 text-green-600" /> : null;
      case 'removed':
        return source === 'local' ? <Minus className="h-3 w-3 text-red-600" /> : null;
      case 'modified':
        return <ArrowRight className="h-3 w-3 text-yellow-600" />;
      default:
        return null;
    }
  };

  return (
    <div
      className={cn(
        "rounded-lg border p-2.5 transition-all duration-200",
        getChangeTypeStyles(),
        isSelectable && "cursor-pointer hover:shadow-sm hover:-translate-y-0.5",
        isSelected && "ring-2 ring-primary"
      )}
      onClick={isSelectable ? onClick : undefined}
      role={isSelectable ? "button" : undefined}
      tabIndex={isSelectable ? 0 : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {getChangeTypeIcon()}
          <span className="text-xs font-medium text-muted-foreground truncate">
            {diff.fieldName}
          </span>
        </div>
        {isSelected && (
          <Badge variant="default" className="text-[10px] px-1.5 py-0">
            Selected
          </Badge>
        )}
      </div>
      <div className="mt-1.5">
        {value === undefined || value === null ? (
          <span className="text-xs text-muted-foreground italic">
            {value === undefined ? 'undefined' : 'null'}
          </span>
        ) : (
          <pre className="text-xs font-mono whitespace-pre-wrap break-all text-foreground">
            {displayValue}
          </pre>
        )}
        {isLongValue && (
          <span className="text-[10px] text-muted-foreground mt-1 block">
            ({formattedValue.length} chars)
          </span>
        )}
      </div>
    </div>
  );
}

export default ConflictDiffViewer;
