"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bell,
  CheckCircle2,
  XCircle,
  RefreshCw,
  GitMerge,
  Calendar,
  CalendarX,
  RotateCcw,
  AlertTriangle,
  Info,
  Check,
  CheckCheck,
  ExternalLink,
  Loader2,
  BellOff,
} from "lucide-react";
import { api } from "@/lib/api";
import {
  SyncNotification,
  NotificationType,
  NotificationTypeValue,
  formatNotificationTime,
  getNotificationTypeColor,
} from "@/types/notification";
import { useTranslation } from "@/contexts/language-context";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Map notification types to their icons
 */
function getNotificationIcon(type: NotificationTypeValue) {
  switch (type) {
    case NotificationType.SYNC_COMPLETE:
      return <CheckCircle2 className="h-4 w-4" />;
    case NotificationType.SYNC_FAILED:
      return <XCircle className="h-4 w-4" />;
    case NotificationType.SYNC_STARTED:
      return <RefreshCw className="h-4 w-4" />;
    case NotificationType.CONFLICTS_FOUND:
      return <GitMerge className="h-4 w-4" />;
    case NotificationType.SCHEDULE_EXECUTED:
      return <Calendar className="h-4 w-4" />;
    case NotificationType.SCHEDULE_FAILED:
      return <CalendarX className="h-4 w-4" />;
    case NotificationType.ROLLBACK_COMPLETE:
      return <RotateCcw className="h-4 w-4" />;
    case NotificationType.WARNING:
      return <AlertTriangle className="h-4 w-4" />;
    case NotificationType.INFO:
    default:
      return <Info className="h-4 w-4" />;
  }
}

interface NotificationBellProps {
  className?: string;
  pollInterval?: number; // in milliseconds, defaults to 30000 (30 seconds)
}

export function NotificationBell({
  className,
  pollInterval = 30000,
}: NotificationBellProps) {
  const { t } = useTranslation("sync");
  const { t: tCommon } = useTranslation("common");

  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<SyncNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [markingRead, setMarkingRead] = useState<string | null>(null);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  // Animation states
  const [bellAnimating, setBellAnimating] = useState(false);
  const previousCount = useRef(0);

  // Fetch unread count
  const fetchCount = useCallback(async () => {
    try {
      const response = await api.getNotificationCount();
      const newCount = response.unread_count;

      // Animate bell if count increased
      if (newCount > previousCount.current && previousCount.current > 0) {
        setBellAnimating(true);
        setTimeout(() => setBellAnimating(false), 500);
      }
      previousCount.current = newCount;
      setUnreadCount(newCount);
    } catch (error) {
      console.error("Failed to fetch notification count:", error);
    }
  }, []);

  // Fetch recent notifications for dropdown
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.listNotifications(10, 0, false);
      setNotifications(response.data);
      setUnreadCount(response.unread_count);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  // Polling for count updates
  useEffect(() => {
    const interval = setInterval(fetchCount, pollInterval);
    return () => clearInterval(interval);
  }, [fetchCount, pollInterval]);

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  // Mark a single notification as read
  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      setMarkingRead(id);
      await api.markNotificationAsRead(id);

      // Update local state
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
      toast.error(t("notification.toast.markReadFailed"));
    } finally {
      setMarkingRead(null);
    }
  };

  // Mark all notifications as read
  const handleMarkAllAsRead = async () => {
    try {
      setMarkingAllRead(true);
      const result = await api.markAllNotificationsAsRead();
      toast.success(t("notification.toast.markedAllRead"), {
        description: `${result.count} ${t("notification.notificationsMarkedRead")}`,
      });

      // Update local state
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all as read:", error);
      toast.error(t("notification.toast.markAllReadFailed"));
    } finally {
      setMarkingAllRead(false);
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "relative h-9 w-9 transition-all duration-200 hover:bg-muted",
            bellAnimating && "animate-wiggle",
            className
          )}
          aria-label={t("notification.bellLabel")}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              className={cn(
                "absolute -right-1 -top-1 h-5 min-w-[20px] px-1 text-[10px]",
                "flex items-center justify-center",
                "bg-destructive text-destructive-foreground",
                "animate-in zoom-in-50 duration-200"
              )}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[380px] rounded-xl p-0"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">{t("notification.title")}</span>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                {unreadCount} {t("notification.unread")}
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleMarkAllAsRead}
              disabled={markingAllRead}
            >
              {markingAllRead ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <CheckCheck className="h-3 w-3" />
              )}
              {t("notification.markAllRead")}
            </Button>
          )}
        </div>

        {/* Notifications List */}
        <ScrollArea className="max-h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="mb-3 rounded-full bg-muted/50 p-3">
                <BellOff className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                {t("notification.noNotifications")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                {t("notification.noNotificationsDesc")}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "relative flex gap-3 px-4 py-3 transition-colors hover:bg-muted/50",
                    !notification.is_read && "bg-primary/5"
                  )}
                >
                  {/* Icon */}
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                      getNotificationTypeColor(notification.notification_type)
                    )}
                  >
                    {getNotificationIcon(notification.notification_type)}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "truncate text-sm",
                        !notification.is_read && "font-medium"
                      )}
                    >
                      {notification.title}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {notification.message}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground/70">
                      {formatNotificationTime(notification.created_at)}
                    </p>
                  </div>

                  {/* Actions */}
                  {!notification.is_read && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={(e) => handleMarkAsRead(notification.id, e)}
                      disabled={markingRead === notification.id}
                      title={t("notification.markAsRead")}
                    >
                      {markingRead === notification.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  )}

                  {/* Unread indicator */}
                  {!notification.is_read && (
                    <div className="absolute left-1.5 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-primary" />
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <DropdownMenuSeparator className="m-0" />
        <div className="p-2">
          <Link href="/sync/notifications" passHref>
            <Button
              variant="ghost"
              className="w-full justify-center gap-2 text-sm"
              onClick={() => setIsOpen(false)}
            >
              {t("notification.viewAll")}
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default NotificationBell;
