package sync

import (
	"context"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"ultra-api-testing/internal/models"
	"ultra-api-testing/internal/repository"
)

// CronParser is an interface for parsing cron expressions
// This allows for easy testing and swapping implementations
type CronParser interface {
	Parse(cronExpr string) (CronSchedule, error)
}

// CronSchedule represents a parsed cron schedule
type CronSchedule interface {
	Next(from time.Time) time.Time
}

// SimpleCronParser is a basic cron parser implementation
// It supports standard 5-field cron expressions: minute hour day month weekday
type SimpleCronParser struct{}

// simpleCronSchedule is a basic cron schedule implementation
type simpleCronSchedule struct {
	minute  []int // 0-59
	hour    []int // 0-23
	day     []int // 1-31
	month   []int // 1-12
	weekday []int // 0-6 (Sunday = 0)
}

// Parse parses a cron expression into a schedule
func (p *SimpleCronParser) Parse(cronExpr string) (CronSchedule, error) {
	fields := strings.Fields(cronExpr)
	if len(fields) != 5 {
		return nil, fmt.Errorf("invalid cron expression: expected 5 fields, got %d", len(fields))
	}

	schedule := &simpleCronSchedule{}
	var err error

	// Parse minute (0-59)
	schedule.minute, err = parseCronField(fields[0], 0, 59)
	if err != nil {
		return nil, fmt.Errorf("invalid minute field: %w", err)
	}

	// Parse hour (0-23)
	schedule.hour, err = parseCronField(fields[1], 0, 23)
	if err != nil {
		return nil, fmt.Errorf("invalid hour field: %w", err)
	}

	// Parse day of month (1-31)
	schedule.day, err = parseCronField(fields[2], 1, 31)
	if err != nil {
		return nil, fmt.Errorf("invalid day field: %w", err)
	}

	// Parse month (1-12)
	schedule.month, err = parseCronField(fields[3], 1, 12)
	if err != nil {
		return nil, fmt.Errorf("invalid month field: %w", err)
	}

	// Parse day of week (0-6)
	schedule.weekday, err = parseCronField(fields[4], 0, 6)
	if err != nil {
		return nil, fmt.Errorf("invalid weekday field: %w", err)
	}

	return schedule, nil
}

// parseCronField parses a single cron field
func parseCronField(field string, min, max int) ([]int, error) {
	if field == "*" {
		return makeRange(min, max), nil
	}

	// Handle step values (*/5, 1-10/2)
	if strings.Contains(field, "/") {
		parts := strings.SplitN(field, "/", 2)
		step := 1
		if _, err := fmt.Sscanf(parts[1], "%d", &step); err != nil {
			return nil, fmt.Errorf("invalid step value: %s", parts[1])
		}

		var baseValues []int
		if parts[0] == "*" {
			baseValues = makeRange(min, max)
		} else if strings.Contains(parts[0], "-") {
			rangeParts := strings.SplitN(parts[0], "-", 2)
			var start, end int
			if _, err := fmt.Sscanf(rangeParts[0], "%d", &start); err != nil {
				return nil, fmt.Errorf("invalid range start: %s", rangeParts[0])
			}
			if _, err := fmt.Sscanf(rangeParts[1], "%d", &end); err != nil {
				return nil, fmt.Errorf("invalid range end: %s", rangeParts[1])
			}
			baseValues = makeRange(start, end)
		} else {
			return nil, fmt.Errorf("invalid step base: %s", parts[0])
		}

		var result []int
		for i, v := range baseValues {
			if i%step == 0 {
				result = append(result, v)
			}
		}
		return result, nil
	}

	// Handle ranges (1-5)
	if strings.Contains(field, "-") {
		parts := strings.SplitN(field, "-", 2)
		var start, end int
		if _, err := fmt.Sscanf(parts[0], "%d", &start); err != nil {
			return nil, fmt.Errorf("invalid range start: %s", parts[0])
		}
		if _, err := fmt.Sscanf(parts[1], "%d", &end); err != nil {
			return nil, fmt.Errorf("invalid range end: %s", parts[1])
		}
		if start < min || end > max || start > end {
			return nil, fmt.Errorf("range out of bounds: %d-%d (min: %d, max: %d)", start, end, min, max)
		}
		return makeRange(start, end), nil
	}

	// Handle lists (1,3,5)
	if strings.Contains(field, ",") {
		parts := strings.Split(field, ",")
		var result []int
		for _, p := range parts {
			var val int
			if _, err := fmt.Sscanf(strings.TrimSpace(p), "%d", &val); err != nil {
				return nil, fmt.Errorf("invalid list value: %s", p)
			}
			if val < min || val > max {
				return nil, fmt.Errorf("value out of bounds: %d (min: %d, max: %d)", val, min, max)
			}
			result = append(result, val)
		}
		return result, nil
	}

	// Single value
	var val int
	if _, err := fmt.Sscanf(field, "%d", &val); err != nil {
		return nil, fmt.Errorf("invalid value: %s", field)
	}
	if val < min || val > max {
		return nil, fmt.Errorf("value out of bounds: %d (min: %d, max: %d)", val, min, max)
	}
	return []int{val}, nil
}

// makeRange creates a slice of integers from start to end (inclusive)
func makeRange(start, end int) []int {
	result := make([]int, end-start+1)
	for i := range result {
		result[i] = start + i
	}
	return result
}

// Next calculates the next execution time after the given time
func (s *simpleCronSchedule) Next(from time.Time) time.Time {
	// Start from the next minute
	next := from.Add(time.Minute).Truncate(time.Minute)

	// Search for up to 1 year (sufficient for any valid cron expression).
	// Reduced from 4 years to prevent DoS via expensive cron calculations.
	// 1 year = 365 days * 24 hours * 60 minutes = 525,600 iterations max.
	maxIterations := 365 * 24 * 60
	for i := 0; i < maxIterations; i++ {
		if s.matches(next) {
			return next
		}
		next = next.Add(time.Minute)
	}

	// If no match found within 1 year, return zero time to indicate no valid match.
	// This allows callers to detect and handle invalid/impossible cron expressions.
	return time.Time{}
}

// matches checks if a time matches the cron schedule
func (s *simpleCronSchedule) matches(t time.Time) bool {
	return contains(s.minute, t.Minute()) &&
		contains(s.hour, t.Hour()) &&
		contains(s.day, t.Day()) &&
		contains(s.month, int(t.Month())) &&
		contains(s.weekday, int(t.Weekday()))
}

// contains checks if a slice contains a value
func contains(slice []int, val int) bool {
	for _, v := range slice {
		if v == val {
			return true
		}
	}
	return false
}

// SchedulerStatus represents the current status of the scheduler
type SchedulerStatus struct {
	Running          bool      `json:"running"`
	LastCheck        time.Time `json:"last_check,omitempty"`
	SchedulesChecked int       `json:"schedules_checked"`
	SchedulesRun     int       `json:"schedules_run"`
	Errors           int       `json:"errors"`
	StartedAt        time.Time `json:"started_at,omitempty"`
}

// Scheduler is the background scheduler that executes due sync schedules
type Scheduler struct {
	mu              sync.RWMutex
	scheduleRepo    *repository.ScheduleRepository
	syncConfigRepo  *repository.SyncConfigRepository
	cronParser      CronParser
	ticker          *time.Ticker
	done            chan struct{}
	running         bool
	status          SchedulerStatus
	checkInterval   time.Duration
	executeCallback func(ctx context.Context, schedule *models.SyncSchedule, config *models.SyncConfiguration) error
}

// SchedulerConfig contains configuration for the scheduler
type SchedulerConfig struct {
	CheckInterval   time.Duration
	ExecuteCallback func(ctx context.Context, schedule *models.SyncSchedule, config *models.SyncConfiguration) error
}

// NewScheduler creates a new scheduler instance
func NewScheduler(
	scheduleRepo *repository.ScheduleRepository,
	syncConfigRepo *repository.SyncConfigRepository,
	config *SchedulerConfig,
) *Scheduler {
	checkInterval := 1 * time.Minute
	if config != nil && config.CheckInterval > 0 {
		checkInterval = config.CheckInterval
	}

	s := &Scheduler{
		scheduleRepo:   scheduleRepo,
		syncConfigRepo: syncConfigRepo,
		cronParser:     &SimpleCronParser{},
		done:           make(chan struct{}),
		checkInterval:  checkInterval,
	}

	if config != nil && config.ExecuteCallback != nil {
		s.executeCallback = config.ExecuteCallback
	}

	return s
}

// Start starts the background scheduler
func (s *Scheduler) Start() {
	s.mu.Lock()
	if s.running {
		s.mu.Unlock()
		return
	}
	s.running = true
	s.status.Running = true
	s.status.StartedAt = time.Now()
	s.ticker = time.NewTicker(s.checkInterval)
	s.mu.Unlock()

	log.Printf("Scheduler: Started with check interval of %v", s.checkInterval)

	go s.run()
}

// Stop stops the background scheduler
func (s *Scheduler) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.running {
		return
	}

	close(s.done)
	s.ticker.Stop()
	s.running = false
	s.status.Running = false

	log.Println("Scheduler: Stopped")
}

// run is the main scheduler loop
func (s *Scheduler) run() {
	// Check immediately on start
	s.checkAndExecuteDueSchedules()

	for {
		select {
		case <-s.ticker.C:
			s.checkAndExecuteDueSchedules()
		case <-s.done:
			return
		}
	}
}

// checkAndExecuteDueSchedules checks for due schedules and executes them
func (s *Scheduler) checkAndExecuteDueSchedules() {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	s.mu.Lock()
	s.status.LastCheck = time.Now()
	s.mu.Unlock()

	// Get all due schedules
	schedules, err := s.scheduleRepo.GetDueSchedules(ctx)
	if err != nil {
		log.Printf("Scheduler: Error getting due schedules: %v", err)
		s.mu.Lock()
		s.status.Errors++
		s.mu.Unlock()
		return
	}

	s.mu.Lock()
	s.status.SchedulesChecked += len(schedules)
	s.mu.Unlock()

	if len(schedules) == 0 {
		return
	}

	log.Printf("Scheduler: Found %d due schedules", len(schedules))

	// Execute each due schedule
	for _, schedule := range schedules {
		if err := s.executeSchedule(ctx, schedule); err != nil {
			log.Printf("Scheduler: Error executing schedule %s (%s): %v", schedule.ID, schedule.Name, err)
			s.mu.Lock()
			s.status.Errors++
			s.mu.Unlock()
		} else {
			s.mu.Lock()
			s.status.SchedulesRun++
			s.mu.Unlock()
		}
	}
}

// executeSchedule executes a single schedule
func (s *Scheduler) executeSchedule(ctx context.Context, schedule *models.SyncSchedule) error {
	log.Printf("Scheduler: Executing schedule %s (%s)", schedule.ID, schedule.Name)

	// Get the sync configuration if specified
	var config *models.SyncConfiguration
	if schedule.ConfigurationID != nil {
		var err error
		config, err = s.syncConfigRepo.GetConfigurationByID(ctx, *schedule.ConfigurationID)
		if err != nil {
			return fmt.Errorf("get sync configuration: %w", err)
		}
	} else {
		return fmt.Errorf("schedule has no configuration_id")
	}

	// Create schedule run record
	run, err := s.scheduleRepo.CreateScheduleRun(ctx, schedule.ID, nil)
	if err != nil {
		return fmt.Errorf("create schedule run: %w", err)
	}

	// Calculate next run time
	nextRun, err := s.GetNextRunTime(schedule.CronExpression, schedule.Timezone)
	if err != nil {
		log.Printf("Scheduler: Warning - could not calculate next run time: %v", err)
	}

	// Execute the sync (via callback or placeholder)
	var syncErr error
	var status string

	if s.executeCallback != nil {
		syncErr = s.executeCallback(ctx, schedule, config)
	} else {
		// Placeholder: log that we would execute
		log.Printf("Scheduler: Would execute sync with config %s (steps: %v)", config.Name, config.SelectedSteps)
		syncErr = nil
	}

	if syncErr != nil {
		status = models.ScheduleStatusFailed
		// Update run as failed
		if err := s.scheduleRepo.UpdateScheduleRun(ctx, run.ID, models.ScheduleRunStatusFailed, syncErr.Error(), nil); err != nil {
			log.Printf("Scheduler: Error updating failed run: %v", err)
		}
	} else {
		status = models.ScheduleStatusSuccess
		// Update run as completed
		if err := s.scheduleRepo.UpdateScheduleRun(ctx, run.ID, models.ScheduleRunStatusCompleted, "", nil); err != nil {
			log.Printf("Scheduler: Error updating completed run: %v", err)
		}
	}

	// Update schedule last run info
	if err := s.scheduleRepo.UpdateScheduleLastRun(ctx, schedule.ID, status, &nextRun); err != nil {
		log.Printf("Scheduler: Error updating schedule last run: %v", err)
	}

	if syncErr != nil {
		return syncErr
	}

	log.Printf("Scheduler: Schedule %s executed successfully. Next run at %s", schedule.ID, nextRun)
	return nil
}

// GetNextRunTime calculates the next run time for a cron expression
func (s *Scheduler) GetNextRunTime(cronExpr string, timezone string) (time.Time, error) {
	schedule, err := s.cronParser.Parse(cronExpr)
	if err != nil {
		return time.Time{}, fmt.Errorf("parse cron expression: %w", err)
	}

	// Get current time in the specified timezone
	loc, err := time.LoadLocation(timezone)
	if err != nil {
		loc = time.UTC
	}
	now := time.Now().In(loc)

	// Calculate next run time in the local timezone, then convert to UTC for storage.
	// This ensures the time is properly stored in PostgreSQL and can be converted
	// back to the user's timezone when displayed.
	next := schedule.Next(now)
	return next.UTC(), nil
}

// GetNextRunTimeAfter calculates the next run time after a specific time
func (s *Scheduler) GetNextRunTimeAfter(cronExpr string, timezone string, after time.Time) (time.Time, error) {
	schedule, err := s.cronParser.Parse(cronExpr)
	if err != nil {
		return time.Time{}, fmt.Errorf("parse cron expression: %w", err)
	}

	// Ensure we're in the right timezone
	loc, err := time.LoadLocation(timezone)
	if err != nil {
		loc = time.UTC
	}
	afterInTz := after.In(loc)

	// Calculate next run time in the local timezone, then convert to UTC for storage.
	// This ensures the time is properly stored in PostgreSQL and can be converted
	// back to the user's timezone when displayed.
	next := schedule.Next(afterInTz)
	return next.UTC(), nil
}

// ParseCron parses a cron expression and returns an error if invalid
func (s *Scheduler) ParseCron(cronExpr string) (CronSchedule, error) {
	return s.cronParser.Parse(cronExpr)
}

// GetStatus returns the current scheduler status
func (s *Scheduler) GetStatus() SchedulerStatus {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.status
}

// IsRunning returns whether the scheduler is running
func (s *Scheduler) IsRunning() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.running
}

// SetExecuteCallback sets the callback function for executing syncs
func (s *Scheduler) SetExecuteCallback(callback func(ctx context.Context, schedule *models.SyncSchedule, config *models.SyncConfiguration) error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.executeCallback = callback
}

// TriggerSchedule manually triggers a schedule execution
func (s *Scheduler) TriggerSchedule(ctx context.Context, scheduleID uuid.UUID) error {
	schedule, err := s.scheduleRepo.GetSchedule(ctx, scheduleID)
	if err != nil {
		return fmt.Errorf("get schedule: %w", err)
	}

	return s.executeSchedule(ctx, schedule)
}

// RecalculateNextRuns recalculates next_run_at for all active schedules
// Useful after system restarts or timezone changes
func (s *Scheduler) RecalculateNextRuns(ctx context.Context) (int, error) {
	// Get all active schedules
	schedules, _, err := s.scheduleRepo.ListSchedules(ctx, 1000, 0)
	if err != nil {
		return 0, fmt.Errorf("list schedules: %w", err)
	}

	updated := 0
	for _, schedule := range schedules {
		if !schedule.IsActive {
			continue
		}

		nextRun, err := s.GetNextRunTime(schedule.CronExpression, schedule.Timezone)
		if err != nil {
			log.Printf("Scheduler: Error calculating next run for schedule %s: %v", schedule.ID, err)
			continue
		}

		if err := s.scheduleRepo.SetNextRunAt(ctx, schedule.ID, nextRun); err != nil {
			log.Printf("Scheduler: Error setting next run for schedule %s: %v", schedule.ID, err)
			continue
		}

		updated++
	}

	log.Printf("Scheduler: Recalculated next run times for %d schedules", updated)
	return updated, nil
}
