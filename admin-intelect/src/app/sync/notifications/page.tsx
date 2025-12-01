"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Bell,
  BellOff,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  GitMerge,
  Calendar,
  CalendarX,
  RotateCcw,
  AlertTriangle,
  Info,
  Check,
  CheckCheck,
  Trash2,
  MoreVertical,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  Clock,
  Mail,
  MailOpen,
} from "lucide-react";
import { api } from "@/lib/api";
import {
  SyncNotification,
  NotificationType,
  NotificationTypeValue,
  NotificationStats,
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

export default function NotificationsPage() {
  const { t } = useTranslation("sync");
  const { t: tCommon } = useTranslation("common");

  // State
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<SyncNotification[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [offset, setOffset] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Selected notifications for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Notification details dialog
  const [selectedNotification, setSelectedNotification] =
    useState<SyncNotification | null>(null);

  // Loading states for actions
  const [markingRead, setMarkingRead] = useState<string | null>(null);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deletingAllRead, setDeletingAllRead] = useState(false);

  // Animation states
  const [contentVisible, setContentVisible] = useState(false);
  const [rowsVisible, setRowsVisible] = useState(false);

  const currentPage = Math.floor(offset / pageSize) + 1;
  const totalPages = Math.ceil(total / pageSize);

  // Load data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setRowsVisible(false);

      const unreadOnly = statusFilter === "unread";
      const [notificationsResponse, statsResponse] = await Promise.all([
        api.listNotifications(pageSize, offset, unreadOnly),
        api.getNotificationStats(),
      ]);

      setNotifications(notificationsResponse.data);
      setTotal(notificationsResponse.total);
      setStats(statsResponse);

      setTimeout(() => setContentVisible(true), 50);
      setTimeout(() => setRowsVisible(true), 150);
    } catch (error) {
      console.error("Failed to load notifications:", error);
      toast.error(t("notification.toast.loadFailed"));
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [pageSize, offset, statusFilter, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRowsVisible(false);
    setSelectedIds(new Set());
    await loadData();
  };

  const handlePageChange = (newPage: number) => {
    setRowsVisible(false);
    setOffset((newPage - 1) * pageSize);
    setSelectedIds(new Set());
  };

  const handlePageSizeChange = (newSize: string) => {
    const size = parseInt(newSize, 10);
    setPageSize(size);
    setOffset(0);
    setRowsVisible(false);
    setSelectedIds(new Set());
  };

  // Filter notifications by search and type
  const filteredNotifications = useMemo(() => {
    let filtered = notifications;

    if (typeFilter !== "all") {
      filtered = filtered.filter((n) => n.notification_type === typeFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (n) =>
          n.title.toLowerCase().includes(query) ||
          n.message.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [notifications, typeFilter, searchQuery]);

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredNotifications.map((n) => n.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  // Mark as read
  const handleMarkAsRead = async (id: string) => {
    try {
      setMarkingRead(id);
      await api.markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      toast.success(t("notification.toast.markedRead"));
    } catch (error) {
      console.error("Failed to mark as read:", error);
      toast.error(t("notification.toast.markReadFailed"));
    } finally {
      setMarkingRead(null);
    }
  };

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    try {
      setMarkingAllRead(true);
      const result = await api.markAllNotificationsAsRead();
      toast.success(t("notification.toast.markedAllRead"), {
        description: `${result.count} ${t("notification.notificationsMarkedRead")}`,
      });
      loadData();
    } catch (error) {
      console.error("Failed to mark all as read:", error);
      toast.error(t("notification.toast.markAllReadFailed"));
    } finally {
      setMarkingAllRead(false);
    }
  };

  // Delete notification
  const handleDelete = async (id: string) => {
    try {
      setDeleting(id);
      await api.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setTotal((prev) => prev - 1);
      toast.success(t("notification.toast.deleted"));
    } catch (error) {
      console.error("Failed to delete notification:", error);
      toast.error(t("notification.toast.deleteFailed"));
    } finally {
      setDeleting(null);
    }
  };

  // Delete all read
  const handleDeleteAllRead = async () => {
    try {
      setDeletingAllRead(true);
      const result = await api.deleteAllReadNotifications();
      toast.success(t("notification.toast.deletedAllRead"), {
        description: `${result.count} ${t("notification.notificationsDeleted")}`,
      });
      loadData();
    } catch (error) {
      console.error("Failed to delete all read:", error);
      toast.error(t("notification.toast.deleteAllReadFailed"));
    } finally {
      setDeletingAllRead(false);
    }
  };

  // View notification details
  const handleViewDetails = (notification: SyncNotification) => {
    setSelectedNotification(notification);
    if (!notification.is_read) {
      handleMarkAsRead(notification.id);
    }
  };

  // Stats summary
  const statItems = useMemo(() => {
    if (!stats) return [];
    return [
      {
        label: t("notification.stats.total"),
        value: stats.total_notifications,
        icon: <Bell className="h-3.5 w-3.5" />,
        variant: "default" as const,
      },
      {
        label: t("notification.stats.unread"),
        value: stats.unread_notifications,
        icon: <Mail className="h-3.5 w-3.5" />,
        variant: stats.unread_notifications > 0 ? ("warning" as const) : ("muted" as const),
      },
      {
        label: t("notification.stats.last24h"),
        value: stats.last_24_hours,
        icon: <Clock className="h-3.5 w-3.5" />,
        variant: "muted" as const,
      },
      {
        label: t("notification.stats.last7d"),
        value: stats.last_7_days,
        icon: <Calendar className="h-3.5 w-3.5" />,
        variant: "muted" as const,
      },
    ];
  }, [stats, t]);

  if (loading && notifications.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <NotificationsPageSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div
        className={`
          flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between
          transition-all duration-300 ease-out
          ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
        `}
      >
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="transition-all duration-200 hover:scale-110 hover:bg-muted active:scale-95"
          >
            <Link href="/sync">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {t("notification.page.title")}
            </h1>
            <p className="text-muted-foreground">
              {t("notification.page.description")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
            />
            {tCommon("actions.refresh")}
          </Button>
          {stats && stats.unread_notifications > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={markingAllRead}
              className="transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
            >
              {markingAllRead ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCheck className="h-4 w-4 mr-2" />
              )}
              {t("notification.markAllRead")}
            </Button>
          )}
          {stats && stats.read_notifications > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteAllRead}
              disabled={deletingAllRead}
              className="text-destructive hover:text-destructive transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
            >
              {deletingAllRead ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              {t("notification.deleteAllRead")}
            </Button>
          )}
        </div>
      </div>

      {/* Stats Bar */}
      <div
        className={`
          flex flex-wrap items-center gap-3
          transition-all duration-300 ease-out
          ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
        `}
        style={{ transitionDelay: "50ms" }}
      >
        {statItems.map((stat, index) => (
          <div
            key={stat.label}
            className={`
              inline-flex items-center gap-2 px-3 py-2 rounded-lg border
              transition-all duration-200 ease-out
              hover:shadow-sm hover:border-border/80 hover:-translate-y-0.5
              ${stat.variant === "warning" ? "bg-yellow-500/5 border-yellow-500/20 hover:bg-yellow-500/10" : ""}
              ${stat.variant === "default" || stat.variant === "muted" ? "bg-muted/50" : ""}
            `}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <span
              className={`
              ${stat.variant === "warning" ? "text-yellow-600" : "text-muted-foreground"}
            `}
            >
              {stat.icon}
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              {stat.label}
            </span>
            <span className="text-sm font-semibold tabular-nums">
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div
        className={`
          flex flex-col sm:flex-row items-start sm:items-center gap-3
          transition-all duration-300 ease-out
          ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
        `}
        style={{ transitionDelay: "100ms" }}
      >
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("notification.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 rounded-lg"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] rounded-lg">
            <SelectValue placeholder={t("notification.filterByStatus")} />
          </SelectTrigger>
          <SelectContent className="rounded-lg">
            <SelectItem value="all">{t("notification.allNotifications")}</SelectItem>
            <SelectItem value="unread">{t("notification.unreadOnly")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[200px] rounded-lg">
            <SelectValue placeholder={t("notification.filterByType")} />
          </SelectTrigger>
          <SelectContent className="rounded-lg">
            <SelectItem value="all">{t("notification.allTypes")}</SelectItem>
            <SelectItem value={NotificationType.SYNC_COMPLETE}>
              {t("notification.types.syncComplete")}
            </SelectItem>
            <SelectItem value={NotificationType.SYNC_FAILED}>
              {t("notification.types.syncFailed")}
            </SelectItem>
            <SelectItem value={NotificationType.SYNC_STARTED}>
              {t("notification.types.syncStarted")}
            </SelectItem>
            <SelectItem value={NotificationType.CONFLICTS_FOUND}>
              {t("notification.types.conflictsFound")}
            </SelectItem>
            <SelectItem value={NotificationType.SCHEDULE_EXECUTED}>
              {t("notification.types.scheduleExecuted")}
            </SelectItem>
            <SelectItem value={NotificationType.SCHEDULE_FAILED}>
              {t("notification.types.scheduleFailed")}
            </SelectItem>
            <SelectItem value={NotificationType.ROLLBACK_COMPLETE}>
              {t("notification.types.rollbackComplete")}
            </SelectItem>
            <SelectItem value={NotificationType.WARNING}>
              {t("notification.types.warning")}
            </SelectItem>
            <SelectItem value={NotificationType.INFO}>
              {t("notification.types.info")}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Notifications Table */}
      <div
        className={`
          transition-all duration-300 ease-out
          ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
        `}
        style={{ transitionDelay: "150ms" }}
      >
        <Card className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <CardHeader className="pb-3 bg-muted/30 border-b">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-background shadow-sm">
                <Bell className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold">{t("notification.listTitle")}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("notification.listDescription")}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="p-4 rounded-full bg-muted/50 mb-4">
                  <BellOff className="h-10 w-10 text-muted-foreground/50" />
                </div>
                <p className="font-medium text-foreground">
                  {t("notification.noNotifications")}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("notification.noNotificationsDesc")}
                </p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={
                            selectedIds.size === filteredNotifications.length &&
                            filteredNotifications.length > 0
                          }
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                      <TableHead className="font-semibold">
                        {t("notification.table.type")}
                      </TableHead>
                      <TableHead className="font-semibold">
                        {t("notification.table.title")}
                      </TableHead>
                      <TableHead className="font-semibold">
                        {t("notification.table.message")}
                      </TableHead>
                      <TableHead className="font-semibold">
                        {t("notification.table.time")}
                      </TableHead>
                      <TableHead className="w-[100px]">
                        {tCommon("actions.actions")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredNotifications.map((notification, index) => (
                      <TableRow
                        key={notification.id}
                        className={cn(
                          "transition-all duration-200 hover:bg-muted/50 cursor-pointer",
                          !notification.is_read && "bg-primary/5",
                          rowsVisible
                            ? "opacity-100 translate-y-0"
                            : "opacity-0 translate-y-2"
                        )}
                        style={{
                          transitionDelay: rowsVisible
                            ? `${Math.min(index * 20, 400)}ms`
                            : "0ms",
                        }}
                        onClick={() => handleViewDetails(notification)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(notification.id)}
                            onCheckedChange={(checked) =>
                              handleSelectOne(notification.id, checked as boolean)
                            }
                          />
                        </TableCell>
                        <TableCell>
                          {notification.is_read ? (
                            <MailOpen className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Mail className="h-4 w-4 text-primary" />
                          )}
                        </TableCell>
                        <TableCell>
                          <div
                            className={cn(
                              "inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs",
                              getNotificationTypeColor(notification.notification_type)
                            )}
                          >
                            {getNotificationIcon(notification.notification_type)}
                            <span className="hidden sm:inline">
                              {t(`notification.types.${notification.notification_type}`)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "text-sm",
                              !notification.is_read && "font-medium"
                            )}
                          >
                            {notification.title}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground line-clamp-1 max-w-[300px]">
                            {notification.message}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatNotificationTime(notification.created_at)}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              {!notification.is_read && (
                                <DropdownMenuItem
                                  onClick={() => handleMarkAsRead(notification.id)}
                                  disabled={markingRead === notification.id}
                                >
                                  {markingRead === notification.id ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  ) : (
                                    <Check className="h-4 w-4 mr-2" />
                                  )}
                                  {t("notification.markAsRead")}
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => handleViewDetails(notification)}
                              >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                {t("notification.viewDetails")}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDelete(notification.id)}
                                disabled={deleting === notification.id}
                                className="text-destructive focus:text-destructive"
                              >
                                {deleting === notification.id ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4 mr-2" />
                                )}
                                {tCommon("actions.delete")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t bg-muted/30">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <p>
                        {t("history.showing")}{" "}
                        <span className="font-medium text-foreground">
                          {offset + 1}
                        </span>{" "}
                        {t("history.to")}{" "}
                        <span className="font-medium text-foreground">
                          {Math.min(offset + pageSize, total)}
                        </span>{" "}
                        {t("history.of")}{" "}
                        <span className="font-medium text-foreground">
                          {total.toLocaleString()}
                        </span>{" "}
                        {t("notification.notifications")}
                      </p>
                      <div className="h-4 w-px bg-border" />
                      <div className="flex items-center gap-2">
                        <span>{t("history.rowsPerPage")}:</span>
                        <Select
                          value={pageSize.toString()}
                          onValueChange={handlePageSizeChange}
                        >
                          <SelectTrigger className="w-[70px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="25">25</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handlePageChange(1)}
                        disabled={currentPage === 1}
                        className="h-8 w-8"
                      >
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        {tCommon("pagination.previous")}
                      </Button>
                      <div className="text-sm px-2">
                        {currentPage} / {totalPages}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                      >
                        {tCommon("pagination.next")}
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handlePageChange(totalPages)}
                        disabled={currentPage === totalPages}
                        className="h-8 w-8"
                      >
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Notification Details Dialog */}
      <Dialog
        open={!!selectedNotification}
        onOpenChange={() => setSelectedNotification(null)}
      >
        <DialogContent className="max-w-lg rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedNotification &&
                getNotificationIcon(selectedNotification.notification_type)}
              {t("notification.detailsTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("notification.detailsDescription")}
            </DialogDescription>
          </DialogHeader>

          {selectedNotification && (
            <div className="space-y-4 pt-4">
              {/* Type Badge */}
              <div
                className={cn(
                  "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border",
                  getNotificationTypeColor(selectedNotification.notification_type)
                )}
              >
                {getNotificationIcon(selectedNotification.notification_type)}
                <span className="text-sm font-medium">
                  {t(`notification.types.${selectedNotification.notification_type}`)}
                </span>
              </div>

              {/* Title & Message */}
              <div className="space-y-2">
                <h4 className="font-semibold">{selectedNotification.title}</h4>
                <p className="text-sm text-muted-foreground">
                  {selectedNotification.message}
                </p>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg border bg-muted/20">
                  <p className="text-xs text-muted-foreground mb-1">
                    {t("notification.details.status")}
                  </p>
                  <div className="flex items-center gap-1.5">
                    {selectedNotification.is_read ? (
                      <>
                        <MailOpen className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{t("notification.read")}</span>
                      </>
                    ) : (
                      <>
                        <Mail className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">
                          {t("notification.unread")}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="p-3 rounded-lg border bg-muted/20">
                  <p className="text-xs text-muted-foreground mb-1">
                    {t("notification.details.createdAt")}
                  </p>
                  <p className="text-sm">
                    {new Date(selectedNotification.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Sync Log Link */}
              {selectedNotification.sync_log_id && (
                <div className="p-3 rounded-lg border bg-muted/20">
                  <p className="text-xs text-muted-foreground mb-1">
                    {t("notification.details.relatedSync")}
                  </p>
                  <Link
                    href={`/sync?log=${selectedNotification.sync_log_id}`}
                    className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                  >
                    {t("notification.details.viewSync")}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              )}

              {/* Metadata */}
              {selectedNotification.metadata && Object.keys(selectedNotification.metadata).length > 0 && (
                <div className="p-3 rounded-lg border bg-muted/20">
                  <p className="text-xs text-muted-foreground mb-2">
                    {t("notification.details.metadata")}
                  </p>
                  <pre className="text-xs overflow-auto max-h-32 p-2 bg-background rounded">
                    {JSON.stringify(selectedNotification.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Skeleton loader for notifications page
 */
function NotificationsPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats skeleton */}
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-10 w-28 rounded-lg"
            style={{ animationDelay: `${i * 50}ms` }}
          />
        ))}
      </div>

      {/* Filters skeleton */}
      <div className="flex gap-3">
        <Skeleton className="h-10 flex-1 max-w-sm rounded-lg" />
        <Skeleton className="h-10 w-[180px] rounded-lg" />
        <Skeleton className="h-10 w-[200px] rounded-lg" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="p-6 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-7 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-56" />
            </div>
          </div>
        </div>
        <div className="p-0">
          <div className="flex items-center gap-4 p-4 border-b bg-muted/30">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-4 w-20"
                style={{ animationDelay: `${i * 30}ms` }}
              />
            ))}
          </div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-4 border-b last:border-b-0"
              style={{ opacity: 1 - i * 0.1 }}
            >
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-8 rounded-lg ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
