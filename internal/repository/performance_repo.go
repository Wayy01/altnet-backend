package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"ultra-api-testing/internal/models"
)

// PerformanceRepository handles sync performance metrics database operations
type PerformanceRepository struct {
	pool *pgxpool.Pool
}

// NewPerformanceRepository creates a new performance repository
func NewPerformanceRepository(pool *pgxpool.Pool) *PerformanceRepository {
	return &PerformanceRepository{pool: pool}
}

// RecordMetric records a new performance metric
func (r *PerformanceRepository) RecordMetric(ctx context.Context, metric *models.PerformanceMetricInput) error {
	query := `
		INSERT INTO sync_performance_metrics (sync_log_id, metric_name, metric_value, metric_unit, step_number, recorded_at)
		VALUES ($1, $2, $3, $4, $5, COALESCE($6, NOW()))
		RETURNING id
	`

	err := r.pool.QueryRow(ctx, query,
		metric.SyncLogID,
		metric.MetricName,
		metric.MetricValue,
		metric.MetricUnit,
		metric.StepNumber,
		metric.RecordedAt,
	).Scan(&metric.ID)
	if err != nil {
		return fmt.Errorf("record metric: %w", err)
	}

	return nil
}

// RecordMetrics records multiple performance metrics in a single batch
func (r *PerformanceRepository) RecordMetrics(ctx context.Context, metrics []*models.PerformanceMetricInput) error {
	if len(metrics) == 0 {
		return nil
	}

	batch := &pgx.Batch{}
	query := `
		INSERT INTO sync_performance_metrics (sync_log_id, metric_name, metric_value, metric_unit, step_number, recorded_at)
		VALUES ($1, $2, $3, $4, $5, COALESCE($6, NOW()))
	`

	for _, m := range metrics {
		batch.Queue(query, m.SyncLogID, m.MetricName, m.MetricValue, m.MetricUnit, m.StepNumber, m.RecordedAt)
	}

	br := r.pool.SendBatch(ctx, batch)
	defer br.Close()

	for i := 0; i < len(metrics); i++ {
		if _, err := br.Exec(); err != nil {
			return fmt.Errorf("record metric batch item %d: %w", i, err)
		}
	}

	return nil
}

// GetMetrics retrieves metrics for a specific sync log
func (r *PerformanceRepository) GetMetrics(ctx context.Context, syncLogID uuid.UUID) ([]*models.PerformanceMetricInput, error) {
	query := `
		SELECT id, sync_log_id, metric_name, metric_value, metric_unit, step_number, recorded_at
		FROM sync_performance_metrics
		WHERE sync_log_id = $1
		ORDER BY recorded_at ASC
	`

	rows, err := r.pool.Query(ctx, query, syncLogID)
	if err != nil {
		return nil, fmt.Errorf("query metrics: %w", err)
	}
	defer rows.Close()

	return r.scanMetrics(rows)
}

// GetMetricsByDateRange retrieves metrics within a date range
func (r *PerformanceRepository) GetMetricsByDateRange(ctx context.Context, startDate, endDate time.Time, limit, offset int) ([]*models.PerformanceMetricInput, int, error) {
	// Get total count
	countQuery := `
		SELECT COUNT(*)
		FROM sync_performance_metrics
		WHERE recorded_at >= $1 AND recorded_at <= $2
	`
	var total int
	if err := r.pool.QueryRow(ctx, countQuery, startDate, endDate).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count metrics: %w", err)
	}

	// Get paginated results
	query := `
		SELECT id, sync_log_id, metric_name, metric_value, metric_unit, step_number, recorded_at
		FROM sync_performance_metrics
		WHERE recorded_at >= $1 AND recorded_at <= $2
		ORDER BY recorded_at DESC
		LIMIT $3 OFFSET $4
	`

	rows, err := r.pool.Query(ctx, query, startDate, endDate, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("query metrics: %w", err)
	}
	defer rows.Close()

	metrics, err := r.scanMetrics(rows)
	if err != nil {
		return nil, 0, err
	}

	return metrics, total, nil
}

// GetMetricsWithFilter retrieves metrics using a flexible filter
func (r *PerformanceRepository) GetMetricsWithFilter(ctx context.Context, filter *models.MetricFilter) ([]*models.PerformanceMetricInput, int, error) {
	whereClause := "WHERE 1=1"
	args := []interface{}{}
	argNum := 1

	if filter.SyncLogID != nil {
		whereClause += fmt.Sprintf(" AND sync_log_id = $%d", argNum)
		args = append(args, *filter.SyncLogID)
		argNum++
	}
	if filter.MetricName != nil {
		whereClause += fmt.Sprintf(" AND metric_name = $%d", argNum)
		args = append(args, *filter.MetricName)
		argNum++
	}
	if filter.StepNumber != nil {
		whereClause += fmt.Sprintf(" AND step_number = $%d", argNum)
		args = append(args, *filter.StepNumber)
		argNum++
	}
	if filter.StartDate != nil {
		whereClause += fmt.Sprintf(" AND recorded_at >= $%d", argNum)
		args = append(args, *filter.StartDate)
		argNum++
	}
	if filter.EndDate != nil {
		whereClause += fmt.Sprintf(" AND recorded_at <= $%d", argNum)
		args = append(args, *filter.EndDate)
		argNum++
	}

	// Count query
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM sync_performance_metrics %s", whereClause)
	var total int
	if err := r.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count metrics: %w", err)
	}

	// Data query
	dataQuery := fmt.Sprintf(`
		SELECT id, sync_log_id, metric_name, metric_value, metric_unit, step_number, recorded_at
		FROM sync_performance_metrics
		%s
		ORDER BY recorded_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argNum, argNum+1)

	args = append(args, filter.Limit, filter.Offset)

	rows, err := r.pool.Query(ctx, dataQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("query metrics: %w", err)
	}
	defer rows.Close()

	metrics, err := r.scanMetrics(rows)
	if err != nil {
		return nil, 0, err
	}

	return metrics, total, nil
}

// GetAggregations retrieves aggregated performance statistics
func (r *PerformanceRepository) GetAggregations(ctx context.Context, groupBy string, startDate, endDate time.Time) ([]*models.PerformanceAggregation, error) {
	var query string
	var groupColumn string

	switch groupBy {
	case "step":
		groupColumn = "COALESCE(step_number::text, 'overall')"
	case "day":
		groupColumn = "DATE(recorded_at)::text"
	case "metric_name":
		groupColumn = "metric_name"
	default:
		groupColumn = "metric_name"
	}

	query = fmt.Sprintf(`
		SELECT
			'%s' as group_by,
			%s as group_value,
			COUNT(*) as count,
			SUM(metric_value) as total_value,
			AVG(metric_value) as average_value,
			MIN(metric_value) as min_value,
			MAX(metric_value) as max_value,
			STDDEV(metric_value) as std_deviation,
			MIN(metric_unit) as unit
		FROM sync_performance_metrics
		WHERE recorded_at >= $1 AND recorded_at <= $2
		GROUP BY %s
		ORDER BY %s
	`, groupBy, groupColumn, groupColumn, groupColumn)

	rows, err := r.pool.Query(ctx, query, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("query aggregations: %w", err)
	}
	defer rows.Close()

	var results []*models.PerformanceAggregation
	for rows.Next() {
		agg := &models.PerformanceAggregation{}
		if err := rows.Scan(
			&agg.GroupBy,
			&agg.GroupValue,
			&agg.Count,
			&agg.TotalValue,
			&agg.AverageValue,
			&agg.MinValue,
			&agg.MaxValue,
			&agg.StdDeviation,
			&agg.Unit,
		); err != nil {
			return nil, fmt.Errorf("scan aggregation: %w", err)
		}
		results = append(results, agg)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate aggregations: %w", err)
	}

	return results, nil
}

// GetTrends retrieves performance trends over the specified number of days
func (r *PerformanceRepository) GetTrends(ctx context.Context, days int) ([]*models.PerformanceTrend, error) {
	query := `
		WITH daily_stats AS (
			SELECT
				DATE(sl.started_at) as sync_date,
				COUNT(*) as total_syncs,
				COUNT(*) FILTER (WHERE sl.status = 'completed') as successful_syncs,
				COUNT(*) FILTER (WHERE sl.status = 'failed') as failed_syncs,
				AVG(COALESCE(sl.duration_seconds, 0)) as avg_duration,
				SUM(
					COALESCE(sl.brands_synced, 0) +
					COALESCE(sl.categories_synced, 0) +
					COALESCE(sl.products_synced, 0) +
					COALESCE(sl.properties_synced, 0)
				) as total_records
			FROM sync_logs sl
			WHERE sl.started_at >= NOW() - ($1 || ' days')::INTERVAL
			GROUP BY DATE(sl.started_at)
		)
		SELECT
			sync_date::text as date,
			total_syncs,
			successful_syncs,
			failed_syncs,
			COALESCE(avg_duration, 0) as avg_duration,
			COALESCE(total_records, 0)::int as total_records,
			CASE
				WHEN avg_duration > 0 THEN total_records / avg_duration
				ELSE 0
			END as avg_throughput,
			CASE
				WHEN total_syncs > 0 THEN (successful_syncs * 100.0 / total_syncs)
				ELSE 0
			END as success_rate
		FROM daily_stats
		ORDER BY sync_date DESC
	`

	// Convert days to string for PostgreSQL interval concatenation
	daysStr := fmt.Sprintf("%d", days)
	rows, err := r.pool.Query(ctx, query, daysStr)
	if err != nil {
		return nil, fmt.Errorf("query trends: %w", err)
	}
	defer rows.Close()

	var trends []*models.PerformanceTrend
	for rows.Next() {
		trend := &models.PerformanceTrend{}
		if err := rows.Scan(
			&trend.Date,
			&trend.TotalSyncs,
			&trend.SuccessfulSyncs,
			&trend.FailedSyncs,
			&trend.AvgDuration,
			&trend.TotalRecords,
			&trend.AvgThroughput,
			&trend.SuccessRate,
		); err != nil {
			return nil, fmt.Errorf("scan trend: %w", err)
		}
		trends = append(trends, trend)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate trends: %w", err)
	}

	return trends, nil
}

// GetBottlenecks identifies the slowest sync operations
func (r *PerformanceRepository) GetBottlenecks(ctx context.Context, limit int) ([]*models.BottleneckInfo, error) {
	query := `
		SELECT
			ssd.sync_log_id,
			ssd.step_number,
			ssd.step_name,
			COALESCE(EXTRACT(EPOCH FROM (ssd.completed_at - ssd.started_at)), 0) as duration_seconds,
			COALESCE(ssd.extracted, 0) + COALESCE(ssd.inserted, 0) + COALESCE(ssd.updated, 0) as records_processed,
			CASE
				WHEN EXTRACT(EPOCH FROM (ssd.completed_at - ssd.started_at)) > 0
				THEN (COALESCE(ssd.extracted, 0) + COALESCE(ssd.inserted, 0) + COALESCE(ssd.updated, 0)) /
					 EXTRACT(EPOCH FROM (ssd.completed_at - ssd.started_at))
				ELSE 0
			END as throughput,
			ssd.started_at,
			ssd.completed_at,
			ssd.status,
			ssd.error_message
		FROM sync_step_details ssd
		WHERE ssd.started_at IS NOT NULL
		  AND ssd.completed_at IS NOT NULL
		ORDER BY duration_seconds DESC
		LIMIT $1
	`

	rows, err := r.pool.Query(ctx, query, limit)
	if err != nil {
		return nil, fmt.Errorf("query bottlenecks: %w", err)
	}
	defer rows.Close()

	var bottlenecks []*models.BottleneckInfo
	for rows.Next() {
		b := &models.BottleneckInfo{}
		if err := rows.Scan(
			&b.SyncLogID,
			&b.StepNumber,
			&b.StepName,
			&b.DurationSeconds,
			&b.RecordsProcess,
			&b.Throughput,
			&b.StartedAt,
			&b.CompletedAt,
			&b.Status,
			&b.ErrorMessage,
		); err != nil {
			return nil, fmt.Errorf("scan bottleneck: %w", err)
		}
		bottlenecks = append(bottlenecks, b)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate bottlenecks: %w", err)
	}

	return bottlenecks, nil
}

// GetAveragesByStep retrieves average duration and throughput per sync step
func (r *PerformanceRepository) GetAveragesByStep(ctx context.Context, days int) ([]*models.StepAverages, error) {
	query := `
		SELECT
			ssd.step_number,
			ssd.step_name,
			COUNT(*) as sync_count,
			AVG(EXTRACT(EPOCH FROM (ssd.completed_at - ssd.started_at))) as avg_duration,
			MIN(EXTRACT(EPOCH FROM (ssd.completed_at - ssd.started_at))) as min_duration,
			MAX(EXTRACT(EPOCH FROM (ssd.completed_at - ssd.started_at))) as max_duration,
			AVG(COALESCE(ssd.extracted, 0) + COALESCE(ssd.inserted, 0) + COALESCE(ssd.updated, 0)) as avg_records,
			CASE
				WHEN AVG(EXTRACT(EPOCH FROM (ssd.completed_at - ssd.started_at))) > 0
				THEN AVG(COALESCE(ssd.extracted, 0) + COALESCE(ssd.inserted, 0) + COALESCE(ssd.updated, 0)) /
					 AVG(EXTRACT(EPOCH FROM (ssd.completed_at - ssd.started_at)))
				ELSE 0
			END as avg_throughput,
			CASE
				WHEN COUNT(*) > 0
				THEN (COUNT(*) FILTER (WHERE ssd.status = 'completed') * 100.0 / COUNT(*))
				ELSE 0
			END as success_rate
		FROM sync_step_details ssd
		JOIN sync_logs sl ON ssd.sync_log_id = sl.id
		WHERE sl.started_at >= NOW() - ($1 || ' days')::INTERVAL
		  AND ssd.started_at IS NOT NULL
		  AND ssd.completed_at IS NOT NULL
		GROUP BY ssd.step_number, ssd.step_name
		ORDER BY ssd.step_number
	`

	// Convert days to string for PostgreSQL interval concatenation
	daysStr := fmt.Sprintf("%d", days)
	rows, err := r.pool.Query(ctx, query, daysStr)
	if err != nil {
		return nil, fmt.Errorf("query step averages: %w", err)
	}
	defer rows.Close()

	var averages []*models.StepAverages
	for rows.Next() {
		avg := &models.StepAverages{}
		if err := rows.Scan(
			&avg.StepNumber,
			&avg.StepName,
			&avg.SyncCount,
			&avg.AvgDuration,
			&avg.MinDuration,
			&avg.MaxDuration,
			&avg.AvgRecords,
			&avg.AvgThroughput,
			&avg.SuccessRate,
		); err != nil {
			return nil, fmt.Errorf("scan step average: %w", err)
		}
		averages = append(averages, avg)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate step averages: %w", err)
	}

	return averages, nil
}

// GetThroughputStats retrieves throughput statistics
func (r *PerformanceRepository) GetThroughputStats(ctx context.Context, days int) (*models.ThroughputStats, error) {
	query := `
		WITH sync_throughput AS (
			SELECT
				sl.id,
				COALESCE(sl.duration_seconds, 0) as duration,
				(
					COALESCE(sl.brands_synced, 0) +
					COALESCE(sl.categories_synced, 0) +
					COALESCE(sl.products_synced, 0) +
					COALESCE(sl.properties_synced, 0)
				) as records,
				CASE
					WHEN sl.duration_seconds > 0
					THEN (
						COALESCE(sl.brands_synced, 0) +
						COALESCE(sl.categories_synced, 0) +
						COALESCE(sl.products_synced, 0) +
						COALESCE(sl.properties_synced, 0)
					)::float / sl.duration_seconds
					ELSE 0
				END as throughput
			FROM sync_logs sl
			WHERE sl.started_at >= NOW() - ($1 || ' days')::INTERVAL
			  AND sl.status = 'completed'
		)
		SELECT
			CASE
				WHEN $2 <= 7 THEN 'last_7_days'
				WHEN $2 <= 30 THEN 'last_30_days'
				ELSE 'overall'
			END as period,
			COUNT(*) as total_syncs,
			COALESCE(SUM(records), 0) as total_records,
			COALESCE(SUM(duration), 0) as total_duration,
			COALESCE(AVG(throughput), 0) as avg_throughput,
			COALESCE(MAX(throughput), 0) as peak_throughput,
			COALESCE(MIN(throughput), 0) as min_throughput
		FROM sync_throughput
	`

	// Convert days to string for PostgreSQL interval concatenation ($1)
	// but keep days as int for the CASE comparison ($2)
	daysStr := fmt.Sprintf("%d", days)
	stats := &models.ThroughputStats{}
	err := r.pool.QueryRow(ctx, query, daysStr, days).Scan(
		&stats.Period,
		&stats.TotalSyncs,
		&stats.TotalRecords,
		&stats.TotalDuration,
		&stats.AvgThroughput,
		&stats.PeakThroughput,
		&stats.MinThroughput,
	)
	if err != nil {
		return nil, fmt.Errorf("query throughput stats: %w", err)
	}

	return stats, nil
}

// GetAnalyticsSummary retrieves a comprehensive analytics summary
func (r *PerformanceRepository) GetAnalyticsSummary(ctx context.Context, days int) (*models.AnalyticsSummary, error) {
	summary := &models.AnalyticsSummary{}

	// Get overall sync stats
	overallQuery := `
		SELECT
			COUNT(*) as total_syncs,
			COUNT(*) FILTER (WHERE status = 'completed') as successful_syncs,
			COUNT(*) FILTER (WHERE status = 'failed') as failed_syncs,
			COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_syncs,
			COUNT(*) FILTER (WHERE status = 'running') as running_syncs,
			CASE
				WHEN COUNT(*) > 0
				THEN (COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / COUNT(*))
				ELSE 0
			END as success_rate,
			COALESCE(AVG(duration_seconds), 0) as avg_duration,
			COALESCE(SUM(duration_seconds), 0) as total_duration,
			COALESCE(SUM(
				COALESCE(brands_synced, 0) +
				COALESCE(categories_synced, 0) +
				COALESCE(products_synced, 0) +
				COALESCE(properties_synced, 0)
			), 0) as total_records
		FROM sync_logs
		WHERE started_at >= NOW() - ($1 || ' days')::INTERVAL
	`

	// Convert days to string for PostgreSQL interval concatenation
	daysStr := fmt.Sprintf("%d", days)
	err := r.pool.QueryRow(ctx, overallQuery, daysStr).Scan(
		&summary.TotalSyncs,
		&summary.SuccessfulSyncs,
		&summary.FailedSyncs,
		&summary.CancelledSyncs,
		&summary.RunningSyncs,
		&summary.SuccessRate,
		&summary.AvgDuration,
		&summary.TotalDuration,
		&summary.TotalRecords,
	)
	if err != nil {
		return nil, fmt.Errorf("query overall stats: %w", err)
	}

	// Calculate average throughput
	if summary.TotalDuration > 0 {
		summary.AvgThroughput = float64(summary.TotalRecords) / summary.TotalDuration
	}

	// Set period description
	switch {
	case days <= 7:
		summary.Period = "last_7_days"
	case days <= 30:
		summary.Period = "last_30_days"
	case days <= 90:
		summary.Period = "last_90_days"
	default:
		summary.Period = fmt.Sprintf("last_%d_days", days)
	}

	// Get step breakdown
	stepBreakdown, err := r.GetAveragesByStep(ctx, days)
	if err != nil {
		return nil, fmt.Errorf("get step breakdown: %w", err)
	}
	summary.StepBreakdown = stepBreakdown

	// Get recent trends (last 7 days regardless of overall period)
	trendDays := 7
	if days < 7 {
		trendDays = days
	}
	trends, err := r.GetTrends(ctx, trendDays)
	if err != nil {
		return nil, fmt.Errorf("get trends: %w", err)
	}
	summary.RecentTrends = trends

	// Get top 5 bottlenecks
	bottlenecks, err := r.GetBottlenecks(ctx, 5)
	if err != nil {
		return nil, fmt.Errorf("get bottlenecks: %w", err)
	}
	summary.TopBottlenecks = bottlenecks

	return summary, nil
}

// GetMetricsForExport retrieves all metrics in a date range for CSV export
func (r *PerformanceRepository) GetMetricsForExport(ctx context.Context, startDate, endDate time.Time) ([]*models.PerformanceMetricInput, error) {
	query := `
		SELECT id, sync_log_id, metric_name, metric_value, metric_unit, step_number, recorded_at
		FROM sync_performance_metrics
		WHERE recorded_at >= $1 AND recorded_at <= $2
		ORDER BY recorded_at ASC
	`

	rows, err := r.pool.Query(ctx, query, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("query metrics for export: %w", err)
	}
	defer rows.Close()

	return r.scanMetrics(rows)
}

// DeleteOldMetrics removes metrics older than the specified number of days
func (r *PerformanceRepository) DeleteOldMetrics(ctx context.Context, retentionDays int) (int64, error) {
	query := `
		DELETE FROM sync_performance_metrics
		WHERE recorded_at < NOW() - ($1 || ' days')::INTERVAL
	`

	// Convert retentionDays to string for PostgreSQL interval concatenation
	daysStr := fmt.Sprintf("%d", retentionDays)
	result, err := r.pool.Exec(ctx, query, daysStr)
	if err != nil {
		return 0, fmt.Errorf("delete old metrics: %w", err)
	}

	return result.RowsAffected(), nil
}

// scanMetrics is a helper to scan metric rows
func (r *PerformanceRepository) scanMetrics(rows pgx.Rows) ([]*models.PerformanceMetricInput, error) {
	var metrics []*models.PerformanceMetricInput
	for rows.Next() {
		m := &models.PerformanceMetricInput{}
		if err := rows.Scan(
			&m.ID,
			&m.SyncLogID,
			&m.MetricName,
			&m.MetricValue,
			&m.MetricUnit,
			&m.StepNumber,
			&m.RecordedAt,
		); err != nil {
			return nil, fmt.Errorf("scan metric: %w", err)
		}
		metrics = append(metrics, m)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate metrics: %w", err)
	}

	return metrics, nil
}
