// ============================================================================
// SYNC PERFORMANCE ANALYTICS TYPES
// ============================================================================

/**
 * Individual performance metric for a sync operation step
 */
export interface PerformanceMetric {
  id: string;
  sync_log_id: string;
  metric_name: string;
  metric_value: number;
  metric_unit: string | null;
  step_number: number | null;
  recorded_at: string;
}

/**
 * Performance trend data point for charting
 * Matches backend PerformanceTrend struct
 */
export interface PerformanceTrend {
  date: string;
  total_syncs: number;
  successful_syncs: number;
  failed_syncs: number;
  avg_duration: number; // in seconds (matches avg_duration_seconds for compatibility)
  avg_duration_seconds: number; // alias for chart compatibility
  total_records: number;
  total_items_processed: number; // alias for compatibility
  avg_throughput: number;
  success_rate: number;
}

/**
 * Bottleneck information - slowest operations
 * Matches backend BottleneckInfo struct
 */
export interface BottleneckInfo {
  sync_log_id: string;
  step_number: number | null;
  step_name: string;
  duration_seconds: number;
  duration_ms: number; // computed field (duration_seconds * 1000)
  records_processed: number;
  items_processed: number; // alias
  throughput: number;
  started_at: string;
  completed_at: string | null;
  status: string;
  error_message: string | null;
  sync_type: string; // derived from step_name
  sync_date: string; // derived from started_at
}

/**
 * Statistics grouped by sync step
 * Matches backend StepAverages struct
 */
export interface StepAverages {
  step_number: number;
  step_name: string;
  sync_count: number;
  total_executions: number; // alias for sync_count
  avg_duration: number; // in seconds
  avg_duration_seconds: number; // alias
  avg_duration_ms: number; // computed (avg_duration * 1000)
  min_duration: number; // in seconds
  min_duration_ms: number; // computed
  max_duration: number; // in seconds
  max_duration_ms: number; // computed
  avg_records: number;
  avg_items_processed: number; // alias
  avg_throughput: number;
  success_rate: number;
  failure_rate: number; // computed (100 - success_rate)
  total_items_processed: number; // computed (sync_count * avg_records)
  total_items_inserted: number; // placeholder
  total_items_updated: number; // placeholder
}

/**
 * Overall analytics summary
 * Matches backend AnalyticsSummary struct
 */
export interface AnalyticsSummary {
  period: string;
  total_syncs: number;
  successful_syncs: number;
  failed_syncs: number;
  cancelled_syncs: number;
  running_syncs: number;
  success_rate: number;
  avg_duration: number; // in seconds
  avg_duration_seconds: number; // alias
  total_duration: number;
  total_records: number;
  total_items_synced: number; // alias
  avg_throughput: number;
  fastest_sync_seconds: number; // derived
  slowest_sync_seconds: number; // derived
  last_sync_at: string | null;
  syncs_last_24h: number;
  syncs_last_7d: number;
  syncs_last_30d: number;
  step_breakdown: StepAverages[];
  recent_trends: PerformanceTrend[];
  top_bottlenecks: BottleneckInfo[];
}

/**
 * Throughput statistics over time
 * Matches backend ThroughputStats struct
 */
export interface ThroughputStats {
  period: string;
  total_syncs: number;
  total_records: number;
  total_duration: number;
  avg_throughput: number;
  peak_throughput: number;
  max_throughput: number; // alias
  min_throughput: number;
  data?: ThroughputDataPoint[];
}

/**
 * Single throughput data point
 */
export interface ThroughputDataPoint {
  timestamp: string;
  throughput: number;
  items_processed: number;
  duration_seconds: number;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/**
 * Response for analytics summary endpoint
 */
export interface AnalyticsSummaryResponse {
  data: AnalyticsSummary;
}

/**
 * Response for performance metrics list endpoint
 */
export interface PerformanceMetricsResponse {
  data: PerformanceMetric[];
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
}

/**
 * Response for performance trends endpoint
 */
export interface PerformanceTrendsResponse {
  data: PerformanceTrend[];
  meta?: {
    days: number;
    count: number;
  };
}

/**
 * Response for bottlenecks endpoint
 */
export interface BottlenecksResponse {
  data: BottleneckInfo[];
  meta?: {
    limit: number;
    count: number;
  };
}

/**
 * Response for step averages endpoint
 */
export interface StepAveragesResponse {
  data: StepAverages[];
  meta?: {
    days: number;
    count: number;
  };
}

/**
 * Response for throughput stats endpoint
 */
export interface ThroughputStatsResponse {
  data: ThroughputStats;
  period_days?: number;
}

// ============================================================================
// QUERY PARAMETERS
// ============================================================================

/**
 * Parameters for filtering performance metrics
 */
export interface PerformanceMetricsParams {
  start_date?: string;
  end_date?: string;
  step?: string;
  limit?: number;
  offset?: number;
}

/**
 * Parameters for trend queries
 */
export interface TrendParams {
  days?: number;
}

/**
 * Parameters for bottleneck queries
 */
export interface BottleneckParams {
  limit?: number;
}

// ============================================================================
// CHART DATA TYPES
// ============================================================================

/**
 * Formatted data for line charts
 */
export interface ChartDataPoint {
  name: string;
  value: number;
  secondary?: number;
  label?: string;
}

/**
 * Time range options for analytics
 */
export type TimeRange = "7d" | "30d" | "90d";

/**
 * Time range configuration
 */
export interface TimeRangeOption {
  value: TimeRange;
  label: string;
  days: number;
}

/**
 * Available time range options
 */
export const TIME_RANGE_OPTIONS: TimeRangeOption[] = [
  { value: "7d", label: "Last 7 days", days: 7 },
  { value: "30d", label: "Last 30 days", days: 30 },
  { value: "90d", label: "Last 90 days", days: 90 },
];

// ============================================================================
// TRANSFORM FUNCTIONS
// ============================================================================

/**
 * Transform raw API response to normalized PerformanceTrend
 */
export function normalizePerformanceTrend(raw: Partial<PerformanceTrend>): PerformanceTrend {
  return {
    date: raw.date || "",
    total_syncs: raw.total_syncs || 0,
    successful_syncs: raw.successful_syncs || 0,
    failed_syncs: raw.failed_syncs || 0,
    avg_duration: raw.avg_duration || 0,
    avg_duration_seconds: raw.avg_duration || raw.avg_duration_seconds || 0,
    total_records: raw.total_records || 0,
    total_items_processed: raw.total_records || raw.total_items_processed || 0,
    avg_throughput: raw.avg_throughput || 0,
    success_rate: raw.success_rate || 0,
  };
}

/**
 * Transform raw API response to normalized StepAverages
 */
export function normalizeStepAverages(raw: Partial<StepAverages>): StepAverages {
  const avgDuration = raw.avg_duration || 0;
  const minDuration = raw.min_duration || 0;
  const maxDuration = raw.max_duration || 0;
  const syncCount = raw.sync_count || 0;
  const avgRecords = raw.avg_records || 0;
  const successRate = raw.success_rate || 0;

  return {
    step_number: raw.step_number || 0,
    step_name: raw.step_name || "",
    sync_count: syncCount,
    total_executions: syncCount,
    avg_duration: avgDuration,
    avg_duration_seconds: avgDuration,
    avg_duration_ms: avgDuration * 1000,
    min_duration: minDuration,
    min_duration_ms: minDuration * 1000,
    max_duration: maxDuration,
    max_duration_ms: maxDuration * 1000,
    avg_records: avgRecords,
    avg_items_processed: avgRecords,
    avg_throughput: raw.avg_throughput || 0,
    success_rate: successRate,
    failure_rate: 100 - successRate,
    total_items_processed: Math.round(syncCount * avgRecords),
    total_items_inserted: 0,
    total_items_updated: 0,
  };
}

/**
 * Transform raw API response to normalized BottleneckInfo
 */
export function normalizeBottleneckInfo(raw: Partial<BottleneckInfo>): BottleneckInfo {
  const durationSeconds = raw.duration_seconds || 0;
  return {
    sync_log_id: raw.sync_log_id || "",
    step_number: raw.step_number ?? null,
    step_name: raw.step_name || "",
    duration_seconds: durationSeconds,
    duration_ms: durationSeconds * 1000,
    records_processed: raw.records_processed || 0,
    items_processed: raw.records_processed || raw.items_processed || 0,
    throughput: raw.throughput || 0,
    started_at: raw.started_at || "",
    completed_at: raw.completed_at ?? null,
    status: raw.status || "",
    error_message: raw.error_message ?? null,
    sync_type: raw.step_name || "unknown",
    sync_date: raw.started_at || "",
  };
}
