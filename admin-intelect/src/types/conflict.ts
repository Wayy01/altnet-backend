// ============================================================================
// CONFLICT RESOLUTION SYSTEM TYPES
// ============================================================================

/**
 * Sync step type for conflicts
 */
export type SyncStep = 'brands' | 'categories' | 'products' | 'properties' | 'prices' | 'stock' | 'exchange_rates';

/**
 * Entity types that can have conflicts
 */
export type ConflictEntityType = 'brand' | 'category' | 'product' | 'property';

/**
 * Types of conflicts that can occur
 */
export type ConflictType = 'concurrent_modification' | 'deleted_upstream' | 'validation_error';

/**
 * Resolution strategies for conflicts
 */
export type ResolutionStrategy = 'local_wins' | 'remote_wins' | 'merge' | 'manual' | 'skip';

/**
 * Represents a conflict detected during sync
 */
export interface SyncConflict {
  id: string;
  sync_log_id: string;
  step: SyncStep;
  entity_type: ConflictEntityType;
  entity_id: string;
  entity_ultra_id?: string;
  conflict_type: ConflictType;
  local_data: Record<string, unknown>;
  remote_data: Record<string, unknown>;
  local_modified_at?: string;
  remote_modified_at?: string;
  resolution_strategy?: ResolutionStrategy;
  resolution_applied: boolean;
  resolved_at?: string;
  resolved_by?: string;
  resolved_data?: Record<string, unknown>;
  created_at: string;
  metadata: Record<string, unknown>;
}

/**
 * Represents an automatic conflict resolution rule
 */
export interface SyncConflictRule {
  id: string;
  name: string;
  entity_type: ConflictEntityType;
  conflict_type: ConflictType;
  priority: number;
  conditions: Record<string, unknown>;
  resolution_strategy: ResolutionStrategy;
  merge_strategy: Record<string, unknown>;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Request to resolve conflicts
 */
export interface ConflictResolutionRequest {
  conflict_ids: string[];
  resolution_strategy: ResolutionStrategy;
  custom_resolution?: Record<string, unknown>;
  apply_to_similar: boolean;
  resolved_by?: string;
}

/**
 * Request to create a conflict rule
 */
export interface CreateConflictRuleRequest {
  name: string;
  entity_type: ConflictEntityType;
  conflict_type: ConflictType;
  priority?: number;
  conditions?: Record<string, unknown>;
  resolution_strategy: ResolutionStrategy;
  merge_strategy?: Record<string, unknown>;
  is_active?: boolean;
}

/**
 * Request to update a conflict rule
 */
export interface UpdateConflictRuleRequest {
  name?: string;
  entity_type?: ConflictEntityType;
  conflict_type?: ConflictType;
  priority?: number;
  conditions?: Record<string, unknown>;
  resolution_strategy?: ResolutionStrategy;
  merge_strategy?: Record<string, unknown>;
  is_active?: boolean;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/**
 * Response from listing conflicts
 */
export interface ListConflictsResponse {
  data: SyncConflict[];
  meta: {
    limit: number;
    offset: number;
    total: number;
  };
}

/**
 * Response from getting a single conflict
 */
export interface GetConflictResponse {
  data: SyncConflict;
}

/**
 * Response from resolving conflicts
 */
export interface ResolveConflictsResponse {
  message: string;
  resolved_count: number;
}

/**
 * Response from listing conflict rules
 */
export interface ListConflictRulesResponse {
  data: SyncConflictRule[];
}

/**
 * Response from creating/updating a conflict rule
 */
export interface ConflictRuleResponse {
  data: SyncConflictRule;
  message: string;
}

// ============================================================================
// UI HELPER TYPES
// ============================================================================

/**
 * Translation keys for conflict types
 * Use with t('conflict.types.<key>') from sync namespace
 */
export const CONFLICT_TYPE_TRANSLATION_KEYS: Record<ConflictType, string> = {
  concurrent_modification: 'conflict.types.concurrent_modification',
  deleted_upstream: 'conflict.types.deleted_upstream',
  validation_error: 'conflict.types.validation_error',
};

/**
 * Translation keys for conflict type descriptions
 * Use with t('conflict.typeDescriptions.<key>') from sync namespace
 */
export const CONFLICT_TYPE_DESCRIPTION_KEYS: Record<ConflictType, string> = {
  concurrent_modification: 'conflict.typeDescriptions.concurrent_modification',
  deleted_upstream: 'conflict.typeDescriptions.deleted_upstream',
  validation_error: 'conflict.typeDescriptions.validation_error',
};

/**
 * Translation keys for resolution strategies
 * Use with t('conflict.strategies.<key>') from sync namespace
 */
export const RESOLUTION_STRATEGY_TRANSLATION_KEYS: Record<ResolutionStrategy, string> = {
  local_wins: 'conflict.strategies.local_wins',
  remote_wins: 'conflict.strategies.remote_wins',
  merge: 'conflict.strategies.merge',
  manual: 'conflict.strategies.manual',
  skip: 'conflict.strategies.skip',
};

/**
 * Translation keys for resolution strategy descriptions
 * Use with t('conflict.strategyDescriptions.<key>') from sync namespace
 */
export const RESOLUTION_STRATEGY_DESCRIPTION_KEYS: Record<ResolutionStrategy, string> = {
  local_wins: 'conflict.strategyDescriptions.local_wins',
  remote_wins: 'conflict.strategyDescriptions.remote_wins',
  merge: 'conflict.strategyDescriptions.merge',
  manual: 'conflict.strategyDescriptions.manual',
  skip: 'conflict.strategyDescriptions.skip',
};

/**
 * Translation keys for entity types
 * Use with t('conflict.entityTypes.<key>') from sync namespace
 */
export const ENTITY_TYPE_TRANSLATION_KEYS: Record<ConflictEntityType, string> = {
  brand: 'conflict.entityTypes.brand',
  category: 'conflict.entityTypes.category',
  product: 'conflict.entityTypes.product',
  property: 'conflict.entityTypes.property',
};

/**
 * Conflict status for UI display
 */
export type ConflictStatus = 'unresolved' | 'resolved';

/**
 * Get conflict status badge variant
 */
export function getConflictStatusVariant(conflict: SyncConflict): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (conflict.resolution_applied) {
    return 'default';
  }
  return 'destructive';
}

/**
 * Get conflict type badge variant
 */
export function getConflictTypeVariant(conflictType: ConflictType): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (conflictType) {
    case 'concurrent_modification':
      return 'secondary';
    case 'deleted_upstream':
      return 'destructive';
    case 'validation_error':
      return 'outline';
    default:
      return 'default';
  }
}

/**
 * Props for conflict diff viewer component
 */
export interface ConflictDiffViewerProps {
  conflict: SyncConflict;
  onFieldSelect?: (fieldName: string, source: 'local' | 'remote') => void;
  selectedFields?: Record<string, 'local' | 'remote'>;
}

/**
 * Props for conflict resolver component
 */
export interface ConflictResolverProps {
  conflicts: SyncConflict[];
  onResolve: (request: ConflictResolutionRequest) => Promise<void>;
  onCancel?: () => void;
}

/**
 * Props for conflict rules manager component
 */
export interface ConflictRulesManagerProps {
  onRuleChange?: () => void;
}
