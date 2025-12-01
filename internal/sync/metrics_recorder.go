package sync

import (
	"context"
	"fmt"
	"runtime"
	"time"

	"github.com/google/uuid"
	"ultra-api-testing/internal/models"
	"ultra-api-testing/internal/repository"
)

// MetricsRecorder provides helpers for recording performance metrics during sync operations
type MetricsRecorder struct {
	repo      *repository.PerformanceRepository
	syncLogID uuid.UUID
	enabled   bool
}

// NewMetricsRecorder creates a new metrics recorder for a sync operation
func NewMetricsRecorder(repo *repository.PerformanceRepository, syncLogID uuid.UUID) *MetricsRecorder {
	return &MetricsRecorder{
		repo:      repo,
		syncLogID: syncLogID,
		enabled:   repo != nil,
	}
}

// SetEnabled enables or disables metrics recording
func (mr *MetricsRecorder) SetEnabled(enabled bool) {
	mr.enabled = enabled
}

// IsEnabled returns whether metrics recording is enabled
func (mr *MetricsRecorder) IsEnabled() bool {
	return mr.enabled && mr.repo != nil
}

// RecordMetric records a single metric
func (mr *MetricsRecorder) RecordMetric(ctx context.Context, name string, value float64, unit *string, stepNumber *int) error {
	if !mr.IsEnabled() {
		return nil
	}

	metric := &models.PerformanceMetricInput{
		SyncLogID:   mr.syncLogID,
		MetricName:  name,
		MetricValue: value,
		MetricUnit:  unit,
		StepNumber:  stepNumber,
		RecordedAt:  time.Now(),
	}

	if err := mr.repo.RecordMetric(ctx, metric); err != nil {
		return fmt.Errorf("record metric %s: %w", name, err)
	}

	return nil
}

// RecordDuration records a duration metric in seconds
func (mr *MetricsRecorder) RecordDuration(ctx context.Context, stepNumber *int, durationSeconds float64) error {
	unit := models.UnitSeconds
	return mr.RecordMetric(ctx, models.MetricDurationSeconds, durationSeconds, &unit, stepNumber)
}

// RecordThroughput records a throughput metric (records per second)
func (mr *MetricsRecorder) RecordThroughput(ctx context.Context, stepNumber *int, recordsPerSecond float64) error {
	unit := models.UnitPerSecond
	return mr.RecordMetric(ctx, models.MetricThroughput, recordsPerSecond, &unit, stepNumber)
}

// RecordRecordsExtracted records the number of records extracted
func (mr *MetricsRecorder) RecordRecordsExtracted(ctx context.Context, stepNumber *int, count int) error {
	unit := models.UnitRecords
	return mr.RecordMetric(ctx, models.MetricRecordsExtracted, float64(count), &unit, stepNumber)
}

// RecordRecordsInserted records the number of records inserted
func (mr *MetricsRecorder) RecordRecordsInserted(ctx context.Context, stepNumber *int, count int) error {
	unit := models.UnitRecords
	return mr.RecordMetric(ctx, models.MetricRecordsInserted, float64(count), &unit, stepNumber)
}

// RecordRecordsUpdated records the number of records updated
func (mr *MetricsRecorder) RecordRecordsUpdated(ctx context.Context, stepNumber *int, count int) error {
	unit := models.UnitRecords
	return mr.RecordMetric(ctx, models.MetricRecordsUpdated, float64(count), &unit, stepNumber)
}

// RecordRecordsFailed records the number of records that failed
func (mr *MetricsRecorder) RecordRecordsFailed(ctx context.Context, stepNumber *int, count int) error {
	unit := models.UnitRecords
	return mr.RecordMetric(ctx, models.MetricRecordsFailed, float64(count), &unit, stepNumber)
}

// RecordAPIResponseTime records API response time in milliseconds
func (mr *MetricsRecorder) RecordAPIResponseTime(ctx context.Context, stepNumber *int, milliseconds float64) error {
	unit := models.UnitMilliseconds
	return mr.RecordMetric(ctx, models.MetricAPIResponseTime, milliseconds, &unit, stepNumber)
}

// RecordDBOperationTime records database operation time in milliseconds
func (mr *MetricsRecorder) RecordDBOperationTime(ctx context.Context, stepNumber *int, milliseconds float64) error {
	unit := models.UnitMilliseconds
	return mr.RecordMetric(ctx, models.MetricDBOperationTime, milliseconds, &unit, stepNumber)
}

// RecordMemoryUsage records current memory usage in MB
func (mr *MetricsRecorder) RecordMemoryUsage(ctx context.Context, stepNumber *int) error {
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)
	memoryMB := float64(memStats.Alloc) / 1024 / 1024

	unit := models.UnitMegabytes
	return mr.RecordMetric(ctx, models.MetricMemoryUsageMB, memoryMB, &unit, stepNumber)
}

// StepMetrics holds metrics collected during a sync step
type StepMetrics struct {
	StepNumber       int
	StartTime        time.Time
	EndTime          time.Time
	RecordsExtracted int
	RecordsInserted  int
	RecordsUpdated   int
	RecordsFailed    int
	APICallTime      time.Duration
	DBOperationTime  time.Duration
}

// RecordStepMetrics records all metrics for a completed sync step
func (mr *MetricsRecorder) RecordStepMetrics(ctx context.Context, metrics *StepMetrics) error {
	if !mr.IsEnabled() {
		return nil
	}

	stepNum := &metrics.StepNumber
	durationSeconds := metrics.EndTime.Sub(metrics.StartTime).Seconds()
	totalRecords := metrics.RecordsExtracted + metrics.RecordsInserted + metrics.RecordsUpdated

	var throughput float64
	if durationSeconds > 0 {
		throughput = float64(totalRecords) / durationSeconds
	}

	// Collect all metrics to record in batch
	metricsToRecord := []*models.PerformanceMetricInput{}

	// Duration
	unitSeconds := models.UnitSeconds
	metricsToRecord = append(metricsToRecord, &models.PerformanceMetricInput{
		SyncLogID:   mr.syncLogID,
		MetricName:  models.MetricDurationSeconds,
		MetricValue: durationSeconds,
		MetricUnit:  &unitSeconds,
		StepNumber:  stepNum,
		RecordedAt:  time.Now(),
	})

	// Throughput
	unitPerSecond := models.UnitPerSecond
	metricsToRecord = append(metricsToRecord, &models.PerformanceMetricInput{
		SyncLogID:   mr.syncLogID,
		MetricName:  models.MetricThroughput,
		MetricValue: throughput,
		MetricUnit:  &unitPerSecond,
		StepNumber:  stepNum,
		RecordedAt:  time.Now(),
	})

	// Records extracted
	unitRecords := models.UnitRecords
	if metrics.RecordsExtracted > 0 {
		metricsToRecord = append(metricsToRecord, &models.PerformanceMetricInput{
			SyncLogID:   mr.syncLogID,
			MetricName:  models.MetricRecordsExtracted,
			MetricValue: float64(metrics.RecordsExtracted),
			MetricUnit:  &unitRecords,
			StepNumber:  stepNum,
			RecordedAt:  time.Now(),
		})
	}

	// Records inserted
	if metrics.RecordsInserted > 0 {
		metricsToRecord = append(metricsToRecord, &models.PerformanceMetricInput{
			SyncLogID:   mr.syncLogID,
			MetricName:  models.MetricRecordsInserted,
			MetricValue: float64(metrics.RecordsInserted),
			MetricUnit:  &unitRecords,
			StepNumber:  stepNum,
			RecordedAt:  time.Now(),
		})
	}

	// Records updated
	if metrics.RecordsUpdated > 0 {
		metricsToRecord = append(metricsToRecord, &models.PerformanceMetricInput{
			SyncLogID:   mr.syncLogID,
			MetricName:  models.MetricRecordsUpdated,
			MetricValue: float64(metrics.RecordsUpdated),
			MetricUnit:  &unitRecords,
			StepNumber:  stepNum,
			RecordedAt:  time.Now(),
		})
	}

	// Records failed
	if metrics.RecordsFailed > 0 {
		metricsToRecord = append(metricsToRecord, &models.PerformanceMetricInput{
			SyncLogID:   mr.syncLogID,
			MetricName:  models.MetricRecordsFailed,
			MetricValue: float64(metrics.RecordsFailed),
			MetricUnit:  &unitRecords,
			StepNumber:  stepNum,
			RecordedAt:  time.Now(),
		})
	}

	// API call time (if recorded)
	unitMS := models.UnitMilliseconds
	if metrics.APICallTime > 0 {
		metricsToRecord = append(metricsToRecord, &models.PerformanceMetricInput{
			SyncLogID:   mr.syncLogID,
			MetricName:  models.MetricAPIResponseTime,
			MetricValue: float64(metrics.APICallTime.Milliseconds()),
			MetricUnit:  &unitMS,
			StepNumber:  stepNum,
			RecordedAt:  time.Now(),
		})
	}

	// DB operation time (if recorded)
	if metrics.DBOperationTime > 0 {
		metricsToRecord = append(metricsToRecord, &models.PerformanceMetricInput{
			SyncLogID:   mr.syncLogID,
			MetricName:  models.MetricDBOperationTime,
			MetricValue: float64(metrics.DBOperationTime.Milliseconds()),
			MetricUnit:  &unitMS,
			StepNumber:  stepNum,
			RecordedAt:  time.Now(),
		})
	}

	// Record all metrics in batch
	if err := mr.repo.RecordMetrics(ctx, metricsToRecord); err != nil {
		return fmt.Errorf("record step metrics: %w", err)
	}

	return nil
}

// Timer provides a convenient way to measure operation durations
type Timer struct {
	startTime time.Time
}

// StartTimer creates a new timer starting from now
func StartTimer() *Timer {
	return &Timer{startTime: time.Now()}
}

// Elapsed returns the elapsed duration since the timer started
func (t *Timer) Elapsed() time.Duration {
	return time.Since(t.startTime)
}

// ElapsedSeconds returns the elapsed time in seconds
func (t *Timer) ElapsedSeconds() float64 {
	return t.Elapsed().Seconds()
}

// ElapsedMilliseconds returns the elapsed time in milliseconds
func (t *Timer) ElapsedMilliseconds() float64 {
	return float64(t.Elapsed().Milliseconds())
}

// Reset restarts the timer
func (t *Timer) Reset() {
	t.startTime = time.Now()
}
