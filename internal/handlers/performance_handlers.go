package handlers

import (
	"context"
	"encoding/csv"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"ultra-api-testing/internal/models"
	"ultra-api-testing/internal/repository"
)

// PerformanceHandler handles sync performance analytics endpoints
type PerformanceHandler struct {
	perfRepo *repository.PerformanceRepository
}

// NewPerformanceHandler creates a new performance handler
func NewPerformanceHandler(perfRepo *repository.PerformanceRepository) *PerformanceHandler {
	return &PerformanceHandler{perfRepo: perfRepo}
}

// GetAnalyticsSummary handles GET /api/v1/sync/analytics
// @Summary Get overall analytics summary
// @Description Returns comprehensive sync performance analytics summary
// @Tags Analytics
// @Produce json
// @Param days query int false "Number of days to analyze (default 30)"
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/sync/analytics [get]
func (h *PerformanceHandler) GetAnalyticsSummary(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	days := parseIntParam(r, "days", 30)
	if days < 1 {
		days = 1
	}
	if days > 365 {
		days = 365
	}

	summary, err := h.perfRepo.GetAnalyticsSummary(ctx, days)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to get analytics summary", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": summary,
	})
}

// GetMetrics handles GET /api/v1/sync/analytics/metrics
// @Summary Get raw performance metrics
// @Description Returns raw performance metrics with optional filters
// @Tags Analytics
// @Produce json
// @Param sync_log_id query string false "Filter by sync log ID"
// @Param metric_name query string false "Filter by metric name"
// @Param step_number query int false "Filter by step number"
// @Param start_date query string false "Start date (RFC3339 format)"
// @Param end_date query string false "End date (RFC3339 format)"
// @Param limit query int false "Number of records to return (default 50, max 1000)"
// @Param offset query int false "Number of records to skip"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/sync/analytics/metrics [get]
func (h *PerformanceHandler) GetMetrics(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	filter := &models.MetricFilter{
		Limit:  50,
		Offset: 0,
	}

	// Parse sync_log_id
	if syncLogIDStr := r.URL.Query().Get("sync_log_id"); syncLogIDStr != "" {
		id, err := uuid.Parse(syncLogIDStr)
		if err != nil {
			respondError(w, http.StatusBadRequest, "Invalid sync_log_id", err.Error())
			return
		}
		filter.SyncLogID = &id
	}

	// Parse metric_name
	if metricName := r.URL.Query().Get("metric_name"); metricName != "" {
		filter.MetricName = &metricName
	}

	// Parse step_number
	if stepStr := r.URL.Query().Get("step_number"); stepStr != "" {
		step, err := strconv.Atoi(stepStr)
		if err != nil {
			respondError(w, http.StatusBadRequest, "Invalid step_number", err.Error())
			return
		}
		filter.StepNumber = &step
	}

	// Parse date range
	if startDateStr := r.URL.Query().Get("start_date"); startDateStr != "" {
		startDate, err := time.Parse(time.RFC3339, startDateStr)
		if err != nil {
			respondError(w, http.StatusBadRequest, "Invalid start_date format, use RFC3339", err.Error())
			return
		}
		filter.StartDate = &startDate
	}

	if endDateStr := r.URL.Query().Get("end_date"); endDateStr != "" {
		endDate, err := time.Parse(time.RFC3339, endDateStr)
		if err != nil {
			respondError(w, http.StatusBadRequest, "Invalid end_date format, use RFC3339", err.Error())
			return
		}
		filter.EndDate = &endDate
	}

	// Parse pagination
	filter.Limit = parseIntParam(r, "limit", 50)
	if filter.Limit > 1000 {
		filter.Limit = 1000
	}
	filter.Offset = parseIntParam(r, "offset", 0)

	metrics, total, err := h.perfRepo.GetMetricsWithFilter(ctx, filter)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to get metrics", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": metrics,
		"meta": map[string]interface{}{
			"total":  total,
			"limit":  filter.Limit,
			"offset": filter.Offset,
		},
	})
}

// GetTrends handles GET /api/v1/sync/analytics/trends
// @Summary Get performance trends
// @Description Returns daily performance trends for charting
// @Tags Analytics
// @Produce json
// @Param days query int false "Number of days to analyze (default 30, max 90)"
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/sync/analytics/trends [get]
func (h *PerformanceHandler) GetTrends(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	days := parseIntParam(r, "days", 30)
	if days < 1 {
		days = 1
	}
	if days > 90 {
		days = 90
	}

	trends, err := h.perfRepo.GetTrends(ctx, days)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to get trends", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": trends,
		"meta": map[string]interface{}{
			"days":  days,
			"count": len(trends),
		},
	})
}

// GetBottlenecks handles GET /api/v1/sync/analytics/bottlenecks
// @Summary Get slowest sync operations
// @Description Returns the slowest sync operations (bottlenecks)
// @Tags Analytics
// @Produce json
// @Param limit query int false "Number of bottlenecks to return (default 10, max 50)"
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/sync/analytics/bottlenecks [get]
func (h *PerformanceHandler) GetBottlenecks(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	limit := parseIntParam(r, "limit", 10)
	if limit < 1 {
		limit = 1
	}
	if limit > 50 {
		limit = 50
	}

	bottlenecks, err := h.perfRepo.GetBottlenecks(ctx, limit)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to get bottlenecks", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": bottlenecks,
		"meta": map[string]interface{}{
			"limit": limit,
			"count": len(bottlenecks),
		},
	})
}

// GetStatsByStep handles GET /api/v1/sync/analytics/by-step
// @Summary Get stats grouped by sync step
// @Description Returns average duration and throughput for each sync step
// @Tags Analytics
// @Produce json
// @Param days query int false "Number of days to analyze (default 30)"
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/sync/analytics/by-step [get]
func (h *PerformanceHandler) GetStatsByStep(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	days := parseIntParam(r, "days", 30)
	if days < 1 {
		days = 1
	}
	if days > 365 {
		days = 365
	}

	stepStats, err := h.perfRepo.GetAveragesByStep(ctx, days)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to get step statistics", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": stepStats,
		"meta": map[string]interface{}{
			"days":  days,
			"count": len(stepStats),
		},
	})
}

// GetThroughputStats handles GET /api/v1/sync/analytics/throughput
// @Summary Get throughput statistics
// @Description Returns throughput statistics (records per second)
// @Tags Analytics
// @Produce json
// @Param days query int false "Number of days to analyze (default 30)"
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/sync/analytics/throughput [get]
func (h *PerformanceHandler) GetThroughputStats(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	days := parseIntParam(r, "days", 30)
	if days < 1 {
		days = 1
	}
	if days > 365 {
		days = 365
	}

	stats, err := h.perfRepo.GetThroughputStats(ctx, days)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to get throughput statistics", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": stats,
	})
}

// GetAggregations handles GET /api/v1/sync/analytics/aggregations
// @Summary Get aggregated metrics
// @Description Returns aggregated performance metrics grouped by specified field
// @Tags Analytics
// @Produce json
// @Param group_by query string false "Group by: step, day, or metric_name (default: metric_name)"
// @Param start_date query string false "Start date (RFC3339 format)"
// @Param end_date query string false "End date (RFC3339 format)"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/sync/analytics/aggregations [get]
func (h *PerformanceHandler) GetAggregations(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	groupBy := r.URL.Query().Get("group_by")
	if groupBy == "" {
		groupBy = "metric_name"
	}

	// Validate group_by
	validGroupBy := map[string]bool{"step": true, "day": true, "metric_name": true}
	if !validGroupBy[groupBy] {
		respondError(w, http.StatusBadRequest, "Invalid group_by parameter", "must be one of: step, day, metric_name")
		return
	}

	// Default date range: last 30 days
	endDate := time.Now()
	startDate := endDate.AddDate(0, 0, -30)

	if startDateStr := r.URL.Query().Get("start_date"); startDateStr != "" {
		parsed, err := time.Parse(time.RFC3339, startDateStr)
		if err != nil {
			respondError(w, http.StatusBadRequest, "Invalid start_date format, use RFC3339", err.Error())
			return
		}
		startDate = parsed
	}

	if endDateStr := r.URL.Query().Get("end_date"); endDateStr != "" {
		parsed, err := time.Parse(time.RFC3339, endDateStr)
		if err != nil {
			respondError(w, http.StatusBadRequest, "Invalid end_date format, use RFC3339", err.Error())
			return
		}
		endDate = parsed
	}

	aggregations, err := h.perfRepo.GetAggregations(ctx, groupBy, startDate, endDate)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to get aggregations", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": aggregations,
		"meta": map[string]interface{}{
			"group_by":   groupBy,
			"start_date": startDate.Format(time.RFC3339),
			"end_date":   endDate.Format(time.RFC3339),
			"count":      len(aggregations),
		},
	})
}

// ExportMetrics handles GET /api/v1/sync/analytics/export
// @Summary Export metrics as CSV
// @Description Exports performance metrics as a CSV file
// @Tags Analytics
// @Produce text/csv
// @Param start_date query string false "Start date (RFC3339 format)"
// @Param end_date query string false "End date (RFC3339 format)"
// @Success 200 {file} csv
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/sync/analytics/export [get]
func (h *PerformanceHandler) ExportMetrics(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 60*time.Second)
	defer cancel()

	// Default date range: last 30 days
	endDate := time.Now()
	startDate := endDate.AddDate(0, 0, -30)

	if startDateStr := r.URL.Query().Get("start_date"); startDateStr != "" {
		parsed, err := time.Parse(time.RFC3339, startDateStr)
		if err != nil {
			respondError(w, http.StatusBadRequest, "Invalid start_date format, use RFC3339", err.Error())
			return
		}
		startDate = parsed
	}

	if endDateStr := r.URL.Query().Get("end_date"); endDateStr != "" {
		parsed, err := time.Parse(time.RFC3339, endDateStr)
		if err != nil {
			respondError(w, http.StatusBadRequest, "Invalid end_date format, use RFC3339", err.Error())
			return
		}
		endDate = parsed
	}

	metrics, err := h.perfRepo.GetMetricsForExport(ctx, startDate, endDate)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to export metrics", err.Error())
		return
	}

	// Set headers for CSV download
	filename := fmt.Sprintf("sync_metrics_%s_to_%s.csv",
		startDate.Format("2006-01-02"),
		endDate.Format("2006-01-02"))
	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))

	writer := csv.NewWriter(w)
	defer writer.Flush()

	// Write header
	header := []string{"id", "sync_log_id", "metric_name", "metric_value", "metric_unit", "step_number", "recorded_at"}
	if err := writer.Write(header); err != nil {
		return
	}

	// Write data rows
	for _, m := range metrics {
		unit := ""
		if m.MetricUnit != nil {
			unit = *m.MetricUnit
		}
		step := ""
		if m.StepNumber != nil {
			step = strconv.Itoa(*m.StepNumber)
		}

		row := []string{
			m.ID.String(),
			m.SyncLogID.String(),
			m.MetricName,
			fmt.Sprintf("%.2f", m.MetricValue),
			unit,
			step,
			m.RecordedAt.Format(time.RFC3339),
		}
		if err := writer.Write(row); err != nil {
			return
		}
	}
}

// GetMetricsBySyncLog handles GET /api/v1/sync/analytics/metrics/{sync_log_id}
// @Summary Get metrics for a specific sync log
// @Description Returns all performance metrics for a specific sync operation
// @Tags Analytics
// @Produce json
// @Param sync_log_id path string true "Sync log ID"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/sync/analytics/metrics/{sync_log_id} [get]
func (h *PerformanceHandler) GetMetricsBySyncLog(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	syncLogID, err := uuid.Parse(vars["sync_log_id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid sync_log_id", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	metrics, err := h.perfRepo.GetMetrics(ctx, syncLogID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to get metrics", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": metrics,
		"meta": map[string]interface{}{
			"sync_log_id": syncLogID.String(),
			"count":       len(metrics),
		},
	})
}

// parseIntParam is a helper to parse integer query parameters with a default value
func parseIntParam(r *http.Request, name string, defaultValue int) int {
	valueStr := r.URL.Query().Get(name)
	if valueStr == "" {
		return defaultValue
	}
	value, err := strconv.Atoi(valueStr)
	if err != nil {
		return defaultValue
	}
	return value
}
