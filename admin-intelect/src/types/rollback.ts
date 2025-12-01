// ============================================================================
// ROLLBACK SYSTEM TYPES
// ============================================================================

/**
 * Represents a database snapshot for rollback
 */
export interface SyncSnapshot {
  id: string;
  sync_log_id: string;
  snapshot_type: 'pre_sync' | 'checkpoint';
  step?: string;
  created_at: string;
  expires_at?: string | null;
  metadata: Record<string, unknown>;
}

/**
 * Represents entity data stored in a snapshot
 */
export interface SyncSnapshotData {
  id: string;
  snapshot_id: string;
  entity_type: string;
  entity_id: string;
  entity_ultra_id?: string;
  snapshot_data: Record<string, unknown>;
  created_at: string;
}

/**
 * Rollback type options
 */
export type RollbackType = 'full' | 'partial' | 'selective';

/**
 * Rollback status options
 */
export type RollbackStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

/**
 * Entity types that can be rolled back
 */
export type RollbackEntityType = 'brand' | 'category' | 'product' | 'property';

/**
 * Represents a rollback operation
 */
export interface SyncRollback {
  id: string;
  original_sync_log_id: string;
  snapshot_id: string;
  rollback_type: RollbackType;
  rollback_scope: Record<string, unknown>;
  initiated_by?: string;
  status: RollbackStatus;
  started_at: string;
  completed_at?: string | null;
  entities_restored: number;
  errors: string[];
  metadata: Record<string, unknown>;
}

/**
 * Request to execute a rollback
 */
export interface RollbackRequest {
  sync_log_id: string;
  rollback_type: RollbackType;
  entity_types?: RollbackEntityType[];
  entity_ids?: string[];
  confirm_hash: string;
  initiated_by?: string;
}

/**
 * Preview of what will be rolled back
 */
export interface RollbackPreview {
  snapshot_id: string;
  snapshot_age: number; // Duration in nanoseconds
  snapshot_age_formatted?: string;
  total_entities: number;
  entities_by_type: Record<string, number>;
  affected_records: number;
  estimated_time: number; // Duration in nanoseconds
  estimated_time_formatted?: string;
  warnings: string[];
  confirm_hash: string;
}

/**
 * Response from executing a rollback
 */
export interface ExecuteRollbackResponse {
  data: SyncRollback;
  message: string;
}

/**
 * Response from listing rollbacks
 */
export interface ListRollbacksResponse {
  data: SyncRollback[];
  meta: {
    limit: number;
    offset: number;
    total: number;
  };
}

/**
 * Response from getting rollback preview
 */
export interface RollbackPreviewResponse {
  data: RollbackPreview;
}

/**
 * Response from getting rollback status
 */
export interface RollbackStatusResponse {
  data: SyncRollback;
}

// ============================================================================
// UI HELPER TYPES
// ============================================================================

/**
 * Props for the RollbackPreview component
 */
export interface RollbackPreviewProps {
  syncLogId: string;
  onRollbackComplete?: () => void;
}

/**
 * Rollback status badge variants
 */
export const ROLLBACK_STATUS_VARIANTS: Record<RollbackStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'outline',
  in_progress: 'secondary',
  completed: 'default',
  failed: 'destructive',
};

/**
 * Translation keys for rollback types
 * Use with t('rollback.types.<key>') from sync namespace
 */
export const ROLLBACK_TYPE_TRANSLATION_KEYS: Record<RollbackType, string> = {
  full: 'rollback.types.full',
  partial: 'rollback.types.partial',
  selective: 'rollback.types.selective',
};

/**
 * Translation keys for rollback type descriptions
 * Use with t('rollback.typeDescriptions.<key>') from sync namespace
 */
export const ROLLBACK_TYPE_DESCRIPTION_KEYS: Record<RollbackType, string> = {
  full: 'rollback.typeDescriptions.full',
  partial: 'rollback.typeDescriptions.partial',
  selective: 'rollback.typeDescriptions.selective',
};

/**
 * Translation keys for entity types
 * Use with t('rollback.entityTypes.<key>') from sync namespace
 */
export const ENTITY_TYPE_TRANSLATION_KEYS: Record<RollbackEntityType, string> = {
  brand: 'rollback.entityTypes.brand',
  category: 'rollback.entityTypes.category',
  product: 'rollback.entityTypes.product',
  property: 'rollback.entityTypes.property',
};

/**
 * Helper to format duration from nanoseconds
 */
export function formatRollbackDuration(nanoseconds: number): string {
  const seconds = Math.floor(nanoseconds / 1_000_000_000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Helper to get risk level based on affected records
 */
export function getRollbackRiskLevel(affectedRecords: number): 'low' | 'medium' | 'high' | 'critical' {
  if (affectedRecords < 100) return 'low';
  if (affectedRecords < 1000) return 'medium';
  if (affectedRecords < 10000) return 'high';
  return 'critical';
}

/**
 * Risk level colors for UI
 */
export const RISK_LEVEL_COLORS: Record<'low' | 'medium' | 'high' | 'critical', string> = {
  low: 'text-primary',
  medium: 'text-yellow-600',
  high: 'text-orange-600',
  critical: 'text-destructive',
};

/**
 * Risk level background colors for UI
 */
export const RISK_LEVEL_BG_COLORS: Record<'low' | 'medium' | 'high' | 'critical', string> = {
  low: 'bg-primary/10 border-primary/20',
  medium: 'bg-yellow-500/10 border-yellow-500/20',
  high: 'bg-orange-500/10 border-orange-500/20',
  critical: 'bg-destructive/10 border-destructive/20',
};
