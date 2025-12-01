// ============================================================================
// SYNC PERFORMANCE ANALYTICS TYPES
// ============================================================================

/**
 * Individual performance metric for a sync operation step
 */
export interface PerformanceMetric {
  id: string;
  sync_log_id: string;
  step_name: string;
  step_number: number;
  started_at: string;
  completed_at: string | null;
  duration_ms: number;
  items_processed: number;
  items_inserted: number;
  items_updated: number;
  items_failed: number;
  throughput: number; // items per second
  memory_used_mb: number | null;
  error_message: string | null;
  created_at: string;
}

/**
 * Performance trend data point for charting
 */
export interface PerformanceTrend {
  date: string;
  avg_duration_seconds: number;
  avg_throughput: number;
  total_syncs: number;
  successful_syncs: number;
  failed_syncs: number;
  total_items_processed: number;
}

/**
 * Bottleneck information - slowest operations
 */
export interface BottleneckInfo {
  step_name: string;
  sync_log_id: string;
  sync_date: string;
  duration_ms: number;
  duration_seconds: number;
  items_processed: number;
  throughput: number;
  sync_type: string;
}

/**
 * Statistics grouped by sync step
 */
export interface StepAverages {
  step_name: string;
  step_number: number;
  total_executions: number;
  avg_duration_ms: number;
  avg_duration_seconds: number;
  min_duration_ms: number;
  max_duration_ms: number;
  avg_items_processed: number;
  avg_throughput: number;
  total_items_processed: number;
  total_items_inserted: number;
  total_items_updated: number;
  failure_rate: number;
}

/**
 * Overall analytics summary
 */
export interface AnalyticsSummary {
  total_syncs: number;
  successful_syncs: number;
  failed_syncs: number;
  success_rate: number;
  avg_duration_seconds: number;
  avg_throughput: number;
  total_items_synced: number;
  fastest_sync_seconds: number;
  slowest_sync_seconds: number;
  last_sync_at: string | null;
  syncs_last_24h: number;
  syncs_last_7d: number;
  syncs_last_30d: number;
}

/**
 * Throughput statistics over time
 */
export interface ThroughputStats {
  period: string; // "hourly", "daily", "weekly"
  data: ThroughputDataPoint[];
  avg_throughput: number;
  max_throughput: number;
  min_throughput: number;
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
  period_days: number;
}

/**
 * Response for bottlenecks endpoint
 */
export interface BottlenecksResponse {
  data: BottleneckInfo[];
  limit: number;
}

/**
 * Response for step averages endpoint
 */
export interface StepAveragesResponse {
  data: StepAverages[];
  period_days: number;
}

/**
 * Response for throughput stats endpoint
 */
export interface ThroughputStatsResponse {
  data: ThroughputStats;
  period_days: number;
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
