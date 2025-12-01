// ============================================================================
// SYNC SCHEDULE TYPES
// ============================================================================

/**
 * Schedule status types
 */
export type ScheduleStatus = 'pending' | 'running' | 'completed' | 'failed';

/**
 * Retry configuration for schedules
 */
export interface RetryConfig {
  max_retries?: number;
  retry_delay_seconds?: number;
  exponential_backoff?: boolean;
}

/**
 * Notification configuration for schedules
 */
export interface NotificationConfig {
  notify_on_success?: boolean;
  notify_on_failure?: boolean;
  recipients?: string[];
}

/**
 * Sync Schedule - represents a scheduled sync operation
 * Matches Go backend SyncSchedule model in internal/models/scheduling.go
 */
export interface SyncSchedule {
  id: string;
  name: string;
  description: string | null;
  cron_expression: string;
  timezone: string;
  configuration_id: string | null;
  configuration_name?: string | null;
  configuration_steps?: string[] | null;
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  last_status: ScheduleStatus | null;
  run_count: number;
  failure_count: number;
  retry_config: RetryConfig;
  notification_config: NotificationConfig;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Sync Schedule Run - represents a single execution of a schedule
 */
export interface SyncScheduleRun {
  id: string;
  schedule_id: string;
  sync_log_id: string | null;
  status: ScheduleStatus;
  triggered_at: string;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  error_message: string | null;
  retry_attempt: number;
  created_at: string;
}

/**
 * Form data for creating/editing a schedule
 */
export interface ScheduleFormData {
  name: string;
  description: string;
  cron_expression: string;
  timezone: string;
  configuration_id: string;
  is_active: boolean;
  retry_config: RetryConfig;
  notification_config: NotificationConfig;
}

/**
 * Request payload for creating a schedule
 * Matches Go backend CreateScheduleRequest in internal/models/scheduling.go
 */
export interface ScheduleCreateRequest {
  name: string;
  description?: string | null;
  cron_expression: string;
  timezone?: string;
  configuration_id?: string | null;
  is_active?: boolean;
  retry_config?: RetryConfig;
  notification_config?: NotificationConfig;
}

/**
 * Request payload for updating a schedule
 * Matches Go backend UpdateScheduleRequest in internal/models/scheduling.go
 */
export interface ScheduleUpdateRequest {
  name?: string;
  description?: string | null;
  cron_expression?: string;
  timezone?: string;
  configuration_id?: string | null;
  is_active?: boolean;
  retry_config?: RetryConfig;
  notification_config?: NotificationConfig;
}

/**
 * Response for listing schedules
 */
export interface SchedulesListResponse {
  schedules: SyncSchedule[];
  total: number;
}

/**
 * Response for listing schedule runs
 */
export interface ScheduleRunsListResponse {
  runs: SyncScheduleRun[];
  total: number;
}

/**
 * Response for toggling schedule status
 */
export interface ScheduleToggleResponse {
  message: string;
  schedule: SyncSchedule;
}

/**
 * Response for testing a schedule (dry run)
 */
export interface ScheduleTestResponse {
  message: string;
  next_runs: string[];
  config_valid: boolean;
}

/**
 * Common cron presets for easy selection
 */
export interface CronPreset {
  label: string;
  expression: string;
  description: string;
}

/**
 * Timezone option for selector
 */
export interface TimezoneOption {
  value: string;
  label: string;
  offset: string;
}

/**
 * Common cron expression presets
 */
export const CRON_PRESETS: CronPreset[] = [
  { label: "Every hour", expression: "0 * * * *", description: "Runs at minute 0 of every hour" },
  { label: "Every 2 hours", expression: "0 */2 * * *", description: "Runs every 2 hours" },
  { label: "Every 6 hours", expression: "0 */6 * * *", description: "Runs at 00:00, 06:00, 12:00, 18:00" },
  { label: "Daily at midnight", expression: "0 0 * * *", description: "Runs at 00:00 every day" },
  { label: "Daily at 6 AM", expression: "0 6 * * *", description: "Runs at 06:00 every day" },
  { label: "Daily at noon", expression: "0 12 * * *", description: "Runs at 12:00 every day" },
  { label: "Twice daily", expression: "0 0,12 * * *", description: "Runs at 00:00 and 12:00" },
  { label: "Weekly on Sunday", expression: "0 0 * * 0", description: "Runs at 00:00 every Sunday" },
  { label: "Weekly on Monday", expression: "0 0 * * 1", description: "Runs at 00:00 every Monday" },
  { label: "Monthly", expression: "0 0 1 * *", description: "Runs at 00:00 on the 1st of each month" },
];

/**
 * Common timezone options
 */
export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  { value: "UTC", label: "UTC", offset: "+00:00" },
  { value: "Europe/Chisinau", label: "Europe/Chisinau (Moldova)", offset: "+02:00" },
  { value: "Europe/Bucharest", label: "Europe/Bucharest (Romania)", offset: "+02:00" },
  { value: "Europe/Moscow", label: "Europe/Moscow (Russia)", offset: "+03:00" },
  { value: "Europe/Kiev", label: "Europe/Kiev (Ukraine)", offset: "+02:00" },
  { value: "Europe/London", label: "Europe/London (UK)", offset: "+00:00" },
  { value: "Europe/Berlin", label: "Europe/Berlin (Germany)", offset: "+01:00" },
  { value: "Europe/Paris", label: "Europe/Paris (France)", offset: "+01:00" },
  { value: "America/New_York", label: "America/New_York (EST)", offset: "-05:00" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (PST)", offset: "-08:00" },
];
