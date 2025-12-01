// ============================================================================
// SYNC NOTIFICATION SYSTEM TYPES
// ============================================================================

/**
 * Notification type constants
 */
export const NotificationType = {
  SYNC_COMPLETE: 'sync_complete',
  SYNC_FAILED: 'sync_failed',
  SYNC_STARTED: 'sync_started',
  CONFLICTS_FOUND: 'conflicts_found',
  SCHEDULE_EXECUTED: 'schedule_executed',
  SCHEDULE_FAILED: 'schedule_failed',
  ROLLBACK_COMPLETE: 'rollback_complete',
  WARNING: 'warning',
  INFO: 'info',
} as const;

export type NotificationTypeValue = typeof NotificationType[keyof typeof NotificationType];

/**
 * Notification status constants
 */
export const NotificationStatus = {
  PENDING: 'pending',
  SENT: 'sent',
  READ: 'read',
  FAILED: 'failed',
} as const;

export type NotificationStatusValue = typeof NotificationStatus[keyof typeof NotificationStatus];

/**
 * Notification channel constants
 */
export const NotificationChannel = {
  IN_APP: 'in_app',
  EMAIL: 'email',
  SLACK: 'slack',
  WEBHOOK: 'webhook',
} as const;

export type NotificationChannelValue = typeof NotificationChannel[keyof typeof NotificationChannel];

/**
 * SSE event types for notifications
 */
export const SSEEventType = {
  NEW_NOTIFICATION: 'new_notification',
  NOTIFICATION_UPDATE: 'notification_update',
  NOTIFICATION_COUNT: 'notification_count',
} as const;

export type SSEEventTypeValue = typeof SSEEventType[keyof typeof SSEEventType];

/**
 * Represents a sync notification
 */
export interface SyncNotification {
  id: string;
  sync_log_id?: string | null;
  notification_type: NotificationTypeValue;
  title: string;
  message: string;
  recipient: string;
  status: NotificationStatusValue;
  is_read: boolean;
  sent_at?: string | null;
  read_at?: string | null;
  error_message?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

/**
 * Request to create a notification
 */
export interface NotificationCreateRequest {
  sync_log_id?: string | null;
  notification_type: NotificationTypeValue;
  title: string;
  message: string;
  recipient: string;
  metadata?: Record<string, unknown> | null;
}

/**
 * Response from listing notifications
 */
export interface NotificationListResponse {
  data: SyncNotification[];
  total: number;
  unread_count: number;
  limit: number;
  offset: number;
}

/**
 * Response from getting notification count
 */
export interface NotificationCountResponse {
  unread_count: number;
  total_count: number;
}

/**
 * User preferences for notifications
 */
export interface NotificationPreferences {
  enable_in_app: boolean;
  enable_email: boolean;
  enable_slack: boolean;
  enable_webhook: boolean;
  email_address?: string;
  slack_webhook_url?: string;
  webhook_url?: string;
  notify_on_sync_start: boolean;
  notify_on_sync_complete: boolean;
  notify_on_sync_failure: boolean;
  notify_on_conflicts: boolean;
  notify_on_schedule: boolean;
  minimum_severity?: 'info' | 'warning' | 'error';
  muted_types?: NotificationTypeValue[];
}

/**
 * Notification trigger configuration
 */
export interface NotificationTrigger {
  event: string;
  conditions: Record<string, unknown>;
  channels: NotificationChannelValue[];
  template: string;
  is_enabled: boolean;
}

/**
 * Aggregated notification statistics
 */
export interface NotificationStats {
  total_notifications: number;
  unread_notifications: number;
  read_notifications: number;
  by_type: Record<NotificationTypeValue, number>;
  last_24_hours: number;
  last_7_days: number;
}

/**
 * SSE message for notifications
 */
export interface NotificationSSEMessage {
  event: SSEEventTypeValue;
  data: SyncNotification | NotificationCountResponse;
  id?: string;
}

/**
 * Sync completion stats included in notifications
 */
export interface SyncCompletionStats {
  sync_log_id: string;
  sync_type: string;
  status: string;
  duration_seconds: number;
  brands_inserted: number;
  brands_updated: number;
  categories_inserted: number;
  categories_updated: number;
  products_inserted: number;
  products_updated: number;
  properties_inserted: number;
  properties_updated: number;
  total_changes: number;
  conflicts_found: number;
}

// ============================================================================
// UI HELPER TYPES AND CONSTANTS
// ============================================================================

/**
 * Translation keys for notification types
 * Use with t('notification.types.<key>') from sync namespace
 * Note: Keys already exist in sync.json under notification.types
 */
export const NOTIFICATION_TYPE_TRANSLATION_KEYS: Record<NotificationTypeValue, string> = {
  [NotificationType.SYNC_COMPLETE]: 'notification.types.sync_complete',
  [NotificationType.SYNC_FAILED]: 'notification.types.sync_failed',
  [NotificationType.SYNC_STARTED]: 'notification.types.sync_started',
  [NotificationType.CONFLICTS_FOUND]: 'notification.types.conflicts_found',
  [NotificationType.SCHEDULE_EXECUTED]: 'notification.types.schedule_executed',
  [NotificationType.SCHEDULE_FAILED]: 'notification.types.schedule_failed',
  [NotificationType.ROLLBACK_COMPLETE]: 'notification.types.rollback_complete',
  [NotificationType.WARNING]: 'notification.types.warning',
  [NotificationType.INFO]: 'notification.types.info',
};

/**
 * Notification type icons (lucide-react icon names)
 */
export const NOTIFICATION_TYPE_ICONS: Record<NotificationTypeValue, string> = {
  [NotificationType.SYNC_COMPLETE]: 'CheckCircle2',
  [NotificationType.SYNC_FAILED]: 'XCircle',
  [NotificationType.SYNC_STARTED]: 'RefreshCw',
  [NotificationType.CONFLICTS_FOUND]: 'GitMerge',
  [NotificationType.SCHEDULE_EXECUTED]: 'Calendar',
  [NotificationType.SCHEDULE_FAILED]: 'CalendarX',
  [NotificationType.ROLLBACK_COMPLETE]: 'RotateCcw',
  [NotificationType.WARNING]: 'AlertTriangle',
  [NotificationType.INFO]: 'Info',
};

/**
 * Notification type variants for badges
 */
export const NOTIFICATION_TYPE_VARIANTS: Record<NotificationTypeValue, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  [NotificationType.SYNC_COMPLETE]: 'default',
  [NotificationType.SYNC_FAILED]: 'destructive',
  [NotificationType.SYNC_STARTED]: 'secondary',
  [NotificationType.CONFLICTS_FOUND]: 'outline',
  [NotificationType.SCHEDULE_EXECUTED]: 'default',
  [NotificationType.SCHEDULE_FAILED]: 'destructive',
  [NotificationType.ROLLBACK_COMPLETE]: 'default',
  [NotificationType.WARNING]: 'outline',
  [NotificationType.INFO]: 'secondary',
};

/**
 * Get notification type color classes
 */
export function getNotificationTypeColor(type: NotificationTypeValue): string {
  switch (type) {
    case NotificationType.SYNC_COMPLETE:
    case NotificationType.SCHEDULE_EXECUTED:
    case NotificationType.ROLLBACK_COMPLETE:
      return 'text-primary bg-primary/10 border-primary/20';
    case NotificationType.SYNC_FAILED:
    case NotificationType.SCHEDULE_FAILED:
      return 'text-destructive bg-destructive/10 border-destructive/20';
    case NotificationType.SYNC_STARTED:
      return 'text-blue-600 bg-blue-500/10 border-blue-500/20';
    case NotificationType.CONFLICTS_FOUND:
    case NotificationType.WARNING:
      return 'text-yellow-600 bg-yellow-500/10 border-yellow-500/20';
    case NotificationType.INFO:
    default:
      return 'text-muted-foreground bg-muted/50 border-muted';
  }
}

/**
 * Format relative time for notifications
 */
export function formatNotificationTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return 'Just now';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }
  return date.toLocaleDateString();
}

/**
 * Props for notification bell component
 */
export interface NotificationBellProps {
  className?: string;
}

/**
 * Filter options for notification list
 */
export interface NotificationFilters {
  unread_only?: boolean;
  notification_type?: NotificationTypeValue;
  limit?: number;
  offset?: number;
}
