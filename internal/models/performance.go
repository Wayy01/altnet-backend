package models

import (
	"time"

	"github.com/google/uuid"
)

// ============================================================================
// SYNC PERFORMANCE ANALYTICS
// ============================================================================

// NOTE: SyncPerformanceMetric is defined in scheduling.go
// This file contains additional analytics types for performance reporting

// PerformanceMetricInput is used for inserting metrics into sync_performance_metrics table
// This matches the database schema more closely than the existing SyncPerformanceMetric
type PerformanceMetricInput struct {
	ID          uuid.UUID `json:"id"`
	SyncLogID   uuid.UUID `json:"sync_log_id"`
	MetricName  string    `json:"metric_name"`
	MetricValue float64   `json:"metric_value"`
	MetricUnit  *string   `json:"metric_unit,omitempty"`
	StepNumber  *int      `json:"step_number,omitempty"`
	RecordedAt  time.Time `json:"recorded_at"`
}

// PerformanceAggregation represents aggregated performance statistics
type PerformanceAggregation struct {
	GroupBy      string   `json:"group_by"`                // "step", "day", "metric_name"
	GroupValue   string   `json:"group_value"`             // e.g., "brands", "2024-01-15", "duration_seconds"
	Count        int      `json:"count"`                   // Number of data points
	TotalValue   float64  `json:"total_value"`             // Sum of all values
	AverageValue float64  `json:"average_value"`           // Mean
	MinValue     float64  `json:"min_value"`               // Minimum
	MaxValue     float64  `json:"max_value"`               // Maximum
	StdDeviation *float64 `json:"std_deviation,omitempty"` // Standard deviation
	Unit         *string  `json:"unit,omitempty"`          // Unit of measurement
}

// PerformanceTrend represents performance data over time for charting
type PerformanceTrend struct {
	Date            string  `json:"date"`             // Date in YYYY-MM-DD format
	TotalSyncs      int     `json:"total_syncs"`      // Number of syncs on this day
	SuccessfulSyncs int     `json:"successful_syncs"` // Number of successful syncs
	FailedSyncs     int     `json:"failed_syncs"`     // Number of failed syncs
	AvgDuration     float64 `json:"avg_duration"`     // Average sync duration in seconds
	TotalRecords    int     `json:"total_records"`    // Total records processed
	AvgThroughput   float64 `json:"avg_throughput"`   // Average records per second
	SuccessRate     float64 `json:"success_rate"`     // Percentage of successful syncs
}

// BottleneckInfo identifies slow sync operations
type BottleneckInfo struct {
	SyncLogID       uuid.UUID  `json:"sync_log_id"`
	StepNumber      *int       `json:"step_number,omitempty"`
	StepName        string     `json:"step_name"`
	DurationSeconds float64    `json:"duration_seconds"`
	RecordsProcess  int        `json:"records_processed"`
	Throughput      float64    `json:"throughput"` // Records per second
	StartedAt       time.Time  `json:"started_at"`
	CompletedAt     *time.Time `json:"completed_at,omitempty"`
	Status          string     `json:"status"`
	ErrorMessage    *string    `json:"error_message,omitempty"`
}

// StepAverages represents average performance metrics for each sync step
type StepAverages struct {
	StepNumber    int     `json:"step_number"`
	StepName      string  `json:"step_name"`
	SyncCount     int     `json:"sync_count"`     // Number of syncs that included this step
	AvgDuration   float64 `json:"avg_duration"`   // Average duration in seconds
	MinDuration   float64 `json:"min_duration"`   // Fastest execution
	MaxDuration   float64 `json:"max_duration"`   // Slowest execution
	AvgRecords    float64 `json:"avg_records"`    // Average records processed
	AvgThroughput float64 `json:"avg_throughput"` // Average throughput
	SuccessRate   float64 `json:"success_rate"`   // Percentage of successful completions
}

// ThroughputStats represents throughput statistics
type ThroughputStats struct {
	Period         string  `json:"period"` // "overall", "last_7_days", "last_30_days"
	TotalSyncs     int     `json:"total_syncs"`
	TotalRecords   int64   `json:"total_records"`
	TotalDuration  float64 `json:"total_duration"`  // Total seconds spent syncing
	AvgThroughput  float64 `json:"avg_throughput"`  // Average records/second
	PeakThroughput float64 `json:"peak_throughput"` // Maximum throughput observed
	MinThroughput  float64 `json:"min_throughput"`  // Minimum throughput observed
}

// AnalyticsSummary provides an overall summary of sync performance
type AnalyticsSummary struct {
	Period          string              `json:"period"`      // Time period covered
	TotalSyncs      int                 `json:"total_syncs"` // Total number of syncs
	SuccessfulSyncs int                 `json:"successful_syncs"`
	FailedSyncs     int                 `json:"failed_syncs"`
	CancelledSyncs  int                 `json:"cancelled_syncs"`
	RunningSyncs    int                 `json:"running_syncs"`
	SuccessRate     float64             `json:"success_rate"`    // Percentage
	AvgDuration     float64             `json:"avg_duration"`    // Average duration in seconds
	TotalDuration   float64             `json:"total_duration"`  // Total time spent syncing
	TotalRecords    int64               `json:"total_records"`   // Total records synced
	AvgThroughput   float64             `json:"avg_throughput"`  // Average records/second
	StepBreakdown   []*StepAverages     `json:"step_breakdown"`  // Per-step breakdown
	RecentTrends    []*PerformanceTrend `json:"recent_trends"`   // Last 7 days trends
	TopBottlenecks  []*BottleneckInfo   `json:"top_bottlenecks"` // Slowest operations
}

// MetricFilter represents filter options for querying metrics
type MetricFilter struct {
	SyncLogID  *uuid.UUID `json:"sync_log_id,omitempty"`
	MetricName *string    `json:"metric_name,omitempty"`
	StepNumber *int       `json:"step_number,omitempty"`
	StartDate  *time.Time `json:"start_date,omitempty"`
	EndDate    *time.Time `json:"end_date,omitempty"`
	Limit      int        `json:"limit"`
	Offset     int        `json:"offset"`
}

// PerformanceMetricRecord is used for reading metrics from sync_performance_metrics table
// Aliased to PerformanceMetricInput since they have the same structure
type PerformanceMetricRecord = PerformanceMetricInput

// Common metric names for consistency
const (
	MetricDurationSeconds  = "duration_seconds"
	MetricRecordsExtracted = "records_extracted"
	MetricRecordsInserted  = "records_inserted"
	MetricRecordsUpdated   = "records_updated"
	MetricRecordsFailed    = "records_failed"
	MetricThroughput       = "throughput_per_second"
	MetricAPIResponseTime  = "api_response_time_ms"
	MetricDBOperationTime  = "db_operation_time_ms"
	MetricMemoryUsageMB    = "memory_usage_mb"
)

// Common metric units
const (
	UnitSeconds      = "seconds"
	UnitMilliseconds = "ms"
	UnitRecords      = "records"
	UnitPerSecond    = "records/s"
	UnitMegabytes    = "MB"
)

// Step name constants for consistency
var StepNames = map[int]string{
	1: "brands",
	2: "categories",
	3: "products",
	4: "properties",
	5: "prices",
	6: "stock",
	7: "exchange_rates",
}

// GetStepName returns the step name for a step number
func GetStepName(stepNumber int) string {
	if name, ok := StepNames[stepNumber]; ok {
		return name
	}
	return "unknown"
}
