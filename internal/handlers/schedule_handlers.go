package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"ultra-api-testing/internal/models"
	"ultra-api-testing/internal/repository"
	internalSync "ultra-api-testing/internal/sync"
)

// ScheduleHandler handles sync schedule endpoints
type ScheduleHandler struct {
	scheduleRepo   *repository.ScheduleRepository
	syncConfigRepo *repository.SyncConfigRepository
	scheduler      *internalSync.Scheduler
}

// NewScheduleHandler creates a new schedule handler
func NewScheduleHandler(
	scheduleRepo *repository.ScheduleRepository,
	syncConfigRepo *repository.SyncConfigRepository,
	scheduler *internalSync.Scheduler,
) *ScheduleHandler {
	return &ScheduleHandler{
		scheduleRepo:   scheduleRepo,
		syncConfigRepo: syncConfigRepo,
		scheduler:      scheduler,
	}
}

// ListSchedules handles GET /api/v1/sync/schedules
// @Summary List all sync schedules
// @Description Returns all sync schedules with pagination
// @Tags Schedules
// @Produce json
// @Param limit query int false "Number of results per page (default: 50, max: 100)"
// @Param offset query int false "Pagination offset (default: 0)"
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/sync/schedules [get]
func (h *ScheduleHandler) ListSchedules(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	limit, offset := parsePagination(r)

	schedules, total, err := h.scheduleRepo.ListSchedules(ctx, limit, offset)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch schedules", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data":   schedules,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// GetSchedule handles GET /api/v1/sync/schedules/{id}
// @Summary Get a schedule by ID
// @Description Returns a single sync schedule by ID with its configuration details
// @Tags Schedules
// @Produce json
// @Param id path string true "Schedule ID"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /api/v1/sync/schedules/{id} [get]
func (h *ScheduleHandler) GetSchedule(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid schedule ID", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	schedule, err := h.scheduleRepo.GetScheduleWithConfig(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrScheduleNotFound) {
			respondError(w, http.StatusNotFound, "Schedule not found", err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to fetch schedule", err.Error())
		return
	}

	// Calculate next run time if scheduler is available
	var nextRunInfo map[string]interface{}
	if h.scheduler != nil {
		nextRun, parseErr := h.scheduler.GetNextRunTime(schedule.CronExpression, schedule.Timezone)
		if parseErr == nil {
			nextRunInfo = map[string]interface{}{
				"calculated_next_run": nextRun,
				"time_until_next_run": time.Until(nextRun).String(),
			}
		}
	}

	response := map[string]interface{}{
		"data": schedule,
	}
	if nextRunInfo != nil {
		response["next_run_info"] = nextRunInfo
	}

	respondJSON(w, http.StatusOK, response)
}

// CreateSchedule handles POST /api/v1/sync/schedules
// @Summary Create a new schedule
// @Description Creates a new sync schedule
// @Tags Schedules
// @Accept json
// @Produce json
// @Param schedule body models.ScheduleCreateRequest true "Schedule data"
// @Success 201 {object} map[string]interface{}
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/sync/schedules [post]
func (h *ScheduleHandler) CreateSchedule(w http.ResponseWriter, r *http.Request) {
	// Limit request body size to 1MB to prevent resource exhaustion
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)

	var req models.ScheduleCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	// Validate cron expression with scheduler if available
	if h.scheduler != nil {
		if _, err := h.scheduler.ParseCron(req.CronExpression); err != nil {
			respondError(w, http.StatusBadRequest, "Invalid cron expression", err.Error())
			return
		}
	}

	// Validate configuration_id if provided
	if req.ConfigurationID != nil {
		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		_, err := h.syncConfigRepo.GetConfigurationByID(ctx, *req.ConfigurationID)
		cancel()
		if err != nil {
			respondError(w, http.StatusBadRequest, "Invalid configuration_id", "Sync configuration not found")
			return
		}
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	schedule, err := h.scheduleRepo.CreateSchedule(ctx, &req)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to create schedule", err.Error())
		return
	}

	// Calculate and set next run time if scheduler is available
	if h.scheduler != nil {
		timezone := req.Timezone
		if timezone == "" {
			timezone = "UTC"
		}
		if nextRun, err := h.scheduler.GetNextRunTime(req.CronExpression, timezone); err == nil {
			if err := h.scheduleRepo.SetNextRunAt(ctx, schedule.ID, nextRun); err != nil {
				log.Printf("Warning: Failed to set initial next_run_at for schedule %s: %v", schedule.ID, err)
			} else {
				schedule.NextRunAt = &nextRun
			}
		}
	}

	respondJSON(w, http.StatusCreated, map[string]interface{}{
		"data":    schedule,
		"message": "Schedule created successfully",
	})
}

// UpdateSchedule handles PUT /api/v1/sync/schedules/{id}
// @Summary Update a schedule
// @Description Updates an existing sync schedule
// @Tags Schedules
// @Accept json
// @Produce json
// @Param id path string true "Schedule ID"
// @Param schedule body models.ScheduleUpdateRequest true "Schedule data"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/sync/schedules/{id} [put]
func (h *ScheduleHandler) UpdateSchedule(w http.ResponseWriter, r *http.Request) {
	// Limit request body size to 1MB to prevent resource exhaustion
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)

	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid schedule ID", err.Error())
		return
	}

	var req models.ScheduleUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	// Validate cron expression if provided
	if req.CronExpression != nil && h.scheduler != nil {
		if _, err := h.scheduler.ParseCron(*req.CronExpression); err != nil {
			respondError(w, http.StatusBadRequest, "Invalid cron expression", err.Error())
			return
		}
	}

	// Validate configuration_id if provided
	if req.ConfigurationID != nil {
		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		_, err := h.syncConfigRepo.GetConfigurationByID(ctx, *req.ConfigurationID)
		cancel()
		if err != nil {
			respondError(w, http.StatusBadRequest, "Invalid configuration_id", "Sync configuration not found")
			return
		}
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	schedule, err := h.scheduleRepo.UpdateSchedule(ctx, id, &req)
	if err != nil {
		if errors.Is(err, repository.ErrScheduleNotFound) {
			respondError(w, http.StatusNotFound, "Schedule not found", err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to update schedule", err.Error())
		return
	}

	// Recalculate next run time if cron expression or timezone changed
	if (req.CronExpression != nil || req.Timezone != nil) && h.scheduler != nil {
		if nextRun, err := h.scheduler.GetNextRunTime(schedule.CronExpression, schedule.Timezone); err == nil {
			if err := h.scheduleRepo.SetNextRunAt(ctx, schedule.ID, nextRun); err != nil {
				log.Printf("Warning: Failed to update next_run_at for schedule %s: %v", schedule.ID, err)
			} else {
				schedule.NextRunAt = &nextRun
			}
		}
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data":    schedule,
		"message": "Schedule updated successfully",
	})
}

// DeleteSchedule handles DELETE /api/v1/sync/schedules/{id}
// @Summary Delete a schedule
// @Description Deletes a sync schedule
// @Tags Schedules
// @Produce json
// @Param id path string true "Schedule ID"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/sync/schedules/{id} [delete]
func (h *ScheduleHandler) DeleteSchedule(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid schedule ID", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	err = h.scheduleRepo.DeleteSchedule(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrScheduleNotFound) {
			respondError(w, http.StatusNotFound, "Schedule not found", err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to delete schedule", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Schedule deleted successfully",
	})
}

// ToggleSchedule handles POST /api/v1/sync/schedules/{id}/toggle
// @Summary Toggle schedule active status
// @Description Enables or disables a sync schedule
// @Tags Schedules
// @Produce json
// @Param id path string true "Schedule ID"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/sync/schedules/{id}/toggle [post]
func (h *ScheduleHandler) ToggleSchedule(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid schedule ID", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	schedule, err := h.scheduleRepo.ToggleSchedule(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrScheduleNotFound) {
			respondError(w, http.StatusNotFound, "Schedule not found", err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to toggle schedule", err.Error())
		return
	}

	// Recalculate next run time if schedule was enabled
	if schedule.IsActive && h.scheduler != nil {
		if nextRun, err := h.scheduler.GetNextRunTime(schedule.CronExpression, schedule.Timezone); err == nil {
			if err := h.scheduleRepo.SetNextRunAt(ctx, schedule.ID, nextRun); err != nil {
				log.Printf("Warning: Failed to update next_run_at for schedule %s: %v", schedule.ID, err)
			} else {
				schedule.NextRunAt = &nextRun
			}
		}
	}

	status := "disabled"
	if schedule.IsActive {
		status = "enabled"
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data":    schedule,
		"message": "Schedule " + status + " successfully",
	})
}

// ListScheduleRuns handles GET /api/v1/sync/schedules/{id}/runs
// @Summary List schedule runs
// @Description Returns all runs for a specific schedule with pagination
// @Tags Schedules
// @Produce json
// @Param id path string true "Schedule ID"
// @Param limit query int false "Number of results per page (default: 50, max: 100)"
// @Param offset query int false "Pagination offset (default: 0)"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/sync/schedules/{id}/runs [get]
func (h *ScheduleHandler) ListScheduleRuns(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid schedule ID", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	// First check if schedule exists
	_, err = h.scheduleRepo.GetSchedule(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrScheduleNotFound) {
			respondError(w, http.StatusNotFound, "Schedule not found", err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to fetch schedule", err.Error())
		return
	}

	limit, offset := parsePagination(r)

	runs, total, err := h.scheduleRepo.ListScheduleRuns(ctx, id, limit, offset)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch schedule runs", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data":        runs,
		"total":       total,
		"limit":       limit,
		"offset":      offset,
		"schedule_id": id,
	})
}

// TestSchedule handles POST /api/v1/sync/schedules/{id}/test
// @Summary Test run a schedule (dry run)
// @Description Validates schedule configuration and returns what would happen on next run
// @Tags Schedules
// @Produce json
// @Param id path string true "Schedule ID"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/sync/schedules/{id}/test [post]
func (h *ScheduleHandler) TestSchedule(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := uuid.Parse(vars["id"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid schedule ID", err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	schedule, err := h.scheduleRepo.GetScheduleWithConfig(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrScheduleNotFound) {
			respondError(w, http.StatusNotFound, "Schedule not found", err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to fetch schedule", err.Error())
		return
	}

	// Build test result
	testResult := map[string]interface{}{
		"schedule_id":     schedule.ID,
		"schedule_name":   schedule.Name,
		"is_active":       schedule.IsActive,
		"cron_expression": schedule.CronExpression,
		"timezone":        schedule.Timezone,
	}

	// Validate cron expression
	cronValid := true
	var cronError string
	var nextRuns []time.Time

	if h.scheduler != nil {
		nextRun, err := h.scheduler.GetNextRunTime(schedule.CronExpression, schedule.Timezone)
		if err != nil {
			cronValid = false
			cronError = err.Error()
		} else {
			// Calculate next 5 run times
			nextRuns = append(nextRuns, nextRun)
			for i := 0; i < 4; i++ {
				nextRun, err = h.scheduler.GetNextRunTimeAfter(schedule.CronExpression, schedule.Timezone, nextRun)
				if err != nil {
					break
				}
				nextRuns = append(nextRuns, nextRun)
			}
		}
	}

	testResult["cron_valid"] = cronValid
	if !cronValid {
		testResult["cron_error"] = cronError
	}
	if len(nextRuns) > 0 {
		testResult["next_runs"] = nextRuns
	}

	// Check configuration
	configValid := true
	var configError string
	var configDetails map[string]interface{}

	if schedule.ConfigurationID != nil {
		config, err := h.syncConfigRepo.GetConfigurationByID(ctx, *schedule.ConfigurationID)
		if err != nil {
			configValid = false
			configError = "Configuration not found or invalid"
		} else {
			configDetails = map[string]interface{}{
				"name":           config.Name,
				"selected_steps": config.SelectedSteps,
				"is_template":    config.IsTemplate,
			}
		}
	} else {
		configValid = false
		configError = "No sync configuration associated with this schedule"
	}

	testResult["config_valid"] = configValid
	if !configValid {
		testResult["config_error"] = configError
	}
	if configDetails != nil {
		testResult["configuration"] = configDetails
	}

	// Overall readiness
	testResult["ready_to_run"] = cronValid && configValid && schedule.IsActive

	// Recommendations
	var recommendations []string
	if !schedule.IsActive {
		recommendations = append(recommendations, "Schedule is disabled. Enable it to allow automatic runs.")
	}
	if !cronValid {
		recommendations = append(recommendations, "Fix the cron expression syntax.")
	}
	if !configValid {
		recommendations = append(recommendations, "Associate a valid sync configuration with this schedule.")
	}
	if schedule.FailureCount > 0 {
		recommendations = append(recommendations, "Schedule has previous failures. Review run history for issues.")
	}

	if len(recommendations) > 0 {
		testResult["recommendations"] = recommendations
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": testResult,
	})
}

// GetSchedulerStatus handles GET /api/v1/sync/scheduler/status
// @Summary Get scheduler status
// @Description Returns the current status of the background scheduler
// @Tags Schedules
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/sync/scheduler/status [get]
func (h *ScheduleHandler) GetSchedulerStatus(w http.ResponseWriter, r *http.Request) {
	if h.scheduler == nil {
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"status":  "disabled",
			"message": "Background scheduler is not running",
		})
		return
	}

	status := h.scheduler.GetStatus()
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data": status,
	})
}
