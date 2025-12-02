"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
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
  DialogFooter,
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Play,
  Clock,
  Search,
  ArrowLeft,
  Calendar,
  CalendarClock,
  Settings,
  CheckCircle2,
  XCircle,
  Loader2,
  History,
  Zap,
  AlertCircle,
  RefreshCw,
  Timer,
  Power,
} from "lucide-react";
import { SyncSchedule } from "@/types/schedule";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/language-context";
import { ScheduleForm } from "@/components/sync/schedule-form";
import { ScheduleRuns } from "@/components/sync/schedule-runs";

export default function SchedulesPage() {
  const { t } = useTranslation('sync');
  const { t: tCommon } = useTranslation('common');
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<SyncSchedule[]>([]);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  // Animation states
  const [contentVisible, setContentVisible] = useState(false);
  const [rowsVisible, setRowsVisible] = useState(false);

  // Dialog states
  const [formOpen, setFormOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<SyncSchedule | null>(null);
  const [runsOpen, setRunsOpen] = useState(false);
  const [viewingSchedule, setViewingSchedule] = useState<SyncSchedule | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingSchedule, setDeletingSchedule] = useState<SyncSchedule | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  // Trigger animations on mount
  useEffect(() => {
    const timer1 = setTimeout(() => setContentVisible(true), 50);
    const timer2 = setTimeout(() => setRowsVisible(true), 200);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  const loadSchedules = useCallback(async () => {
    try {
      setLoading(true);
      setRowsVisible(false);
      const response = await api.listSchedules(100, 0);
      setSchedules(response.schedules ?? []);
      setTotal(response.total ?? 0);
      setTimeout(() => setRowsVisible(true), 100);
    } catch (error) {
      console.error("Failed to load schedules:", error);
      toast.error(t('schedule.toast.loadFailed'));
      setSchedules([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  const handleCreate = () => {
    setEditingSchedule(null);
    setFormOpen(true);
  };

  const handleEdit = (schedule: SyncSchedule) => {
    setEditingSchedule(schedule);
    setFormOpen(true);
  };

  const handleDelete = (schedule: SyncSchedule) => {
    setDeletingSchedule(schedule);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingSchedule) return;

    try {
      await api.deleteSchedule(deletingSchedule.id);
      toast.success(t('schedule.toast.deleted'));
      setDeleteDialogOpen(false);
      setDeletingSchedule(null);
      loadSchedules();
    } catch (error) {
      console.error("Failed to delete schedule:", error);
      toast.error(t('schedule.toast.deleteFailed'));
    }
  };

  const handleToggle = async (schedule: SyncSchedule) => {
    try {
      await api.toggleSchedule(schedule.id);
      toast.success(
        schedule.is_active
          ? t('schedule.toast.disabled')
          : t('schedule.toast.enabled')
      );
      loadSchedules();
    } catch (error) {
      console.error("Failed to toggle schedule:", error);
      toast.error(t('schedule.toast.toggleFailed'));
    }
  };

  const handleTest = async (schedule: SyncSchedule) => {
    try {
      setTestingId(schedule.id);
      const result = await api.testSchedule(schedule.id);
      if (result.config_valid) {
        toast.success(t('schedule.toast.testSuccess'), {
          description: `${t('schedule.toast.nextRuns')}: ${result.next_runs.slice(0, 3).join(", ")}`,
        });
      } else {
        toast.error(t('schedule.toast.testFailed'), {
          description: t('schedule.toast.configInvalid'),
        });
      }
    } catch (error) {
      console.error("Failed to test schedule:", error);
      toast.error(t('schedule.toast.testFailed'));
    } finally {
      setTestingId(null);
    }
  };

  const handleViewRuns = (schedule: SyncSchedule) => {
    setViewingSchedule(schedule);
    setRunsOpen(true);
  };

  const filteredSchedules = useMemo(() => {
    if (!schedules || schedules.length === 0) return [];
    if (!searchQuery.trim()) return schedules;

    const query = searchQuery.toLowerCase();
    return schedules.filter(
      (schedule) =>
        schedule.name.toLowerCase().includes(query) ||
        schedule.description?.toLowerCase().includes(query) ||
        schedule.cron_expression.includes(query)
    );
  }, [schedules, searchQuery]);

  const stats = useMemo(
    () => ({
      total: schedules?.length ?? 0,
      active: schedules?.filter((s) => s.is_active).length ?? 0,
      inactive: schedules?.filter((s) => !s.is_active).length ?? 0,
    }),
    [schedules]
  );

  const formatNextRun = (dateStr: string | null): string => {
    if (!dateStr) return t('schedule.table.notScheduled');
    const date = new Date(dateStr);
    const now = new Date();
    const diff = date.getTime() - now.getTime();

    if (diff < 0) return t('schedule.table.overdue');

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours === 0) return `${minutes}m`;
    if (hours < 24) return `${hours}h ${minutes}m`;
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  };

  const getStatusBadge = (schedule: SyncSchedule) => {
    if (!schedule.is_active) {
      return (
        <Badge variant="secondary" className="gap-1">
          <Power className="h-3 w-3" />
          {t('schedule.status.inactive')}
        </Badge>
      );
    }

    switch (schedule.last_status) {
      case "completed":
        return (
          <Badge variant="default" className="bg-primary/10 text-primary border-primary/20 gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {t('schedule.status.completed')}
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20 gap-1">
            <XCircle className="h-3 w-3" />
            {t('schedule.status.failed')}
          </Badge>
        );
      case "running":
        return (
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t('schedule.status.running')}
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            {t('schedule.status.pending')}
          </Badge>
        );
      default:
        return (
          <Badge className="bg-primary/10 text-primary border-primary/20 gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {t('schedule.status.active')}
          </Badge>
        );
    }
  };

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
              {t('schedule.page.title')}
            </h1>
            <p className="text-muted-foreground">
              {t('schedule.page.description')}
            </p>
          </div>
        </div>
        <Button
          onClick={handleCreate}
          className="gap-2 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
        >
          <Plus className="h-4 w-4" />
          {t('schedule.newSchedule')}
        </Button>
      </div>

      {/* Stats Bar */}
      <div
        className={`
          flex flex-wrap items-center gap-3
          transition-all duration-300 ease-out
          ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
        `}
        style={{ transitionDelay: "50ms" }}
      >
        {[
          {
            label: t('schedule.stats.total'),
            value: stats.total,
            icon: <Calendar className="h-3.5 w-3.5" />,
            variant: "default",
          },
          {
            label: t('schedule.stats.active'),
            value: stats.active,
            icon: <CheckCircle2 className="h-3.5 w-3.5" />,
            variant: stats.active > 0 ? "success" : "muted",
          },
          {
            label: t('schedule.stats.inactive'),
            value: stats.inactive,
            icon: <Power className="h-3.5 w-3.5" />,
            variant: "muted",
          },
        ].map((stat, index) => (
          <div
            key={stat.label}
            className={`
              inline-flex items-center gap-2 px-3 py-2 rounded-lg border
              transition-all duration-200 ease-out hover:shadow-sm hover:border-border/80 hover:-translate-y-0.5
              ${stat.variant === "success" ? "bg-primary/5 border-primary/20 hover:bg-primary/10" : "bg-muted/50"}
            `}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <span className={stat.variant === "success" ? "text-primary" : "text-muted-foreground"}>
              {stat.icon}
            </span>
            <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
            <span className="text-sm font-semibold tabular-nums">{stat.value}</span>
          </div>
        ))}
      </div>

      {/* Main Content Card */}
      <div
        className={`
          transition-all duration-300 ease-out
          ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
        `}
        style={{ transitionDelay: "100ms" }}
      >
        <Card className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <CardHeader className="pb-3 bg-muted/30 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('schedule.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 rounded-lg max-w-md"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <SchedulesSkeleton />
            ) : filteredSchedules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="p-4 rounded-full bg-muted/50 mb-4">
                  <Calendar className="h-10 w-10 text-muted-foreground/50" />
                </div>
                <p className="font-medium text-foreground">
                  {searchQuery
                    ? t('schedule.noSchedulesFound')
                    : t('schedule.noSchedules')}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {searchQuery
                    ? t('schedule.adjustSearch')
                    : t('schedule.createFirst')}
                </p>
                {!searchQuery && (
                  <Button
                    onClick={handleCreate}
                    className="mt-4 gap-2"
                    variant="outline"
                  >
                    <Plus className="h-4 w-4" />
                    {t('schedule.newSchedule')}
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="font-semibold w-[50px]">
                        {t('schedule.table.enabled')}
                      </TableHead>
                      <TableHead className="font-semibold">
                        {t('schedule.table.name')}
                      </TableHead>
                      <TableHead className="font-semibold">
                        {t('schedule.table.schedule')}
                      </TableHead>
                      <TableHead className="font-semibold">
                        {t('schedule.table.config')}
                      </TableHead>
                      <TableHead className="font-semibold">
                        {t('schedule.table.nextRun')}
                      </TableHead>
                      <TableHead className="font-semibold">
                        {t('schedule.table.lastStatus')}
                      </TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSchedules.map((schedule, index) => (
                      <TableRow
                        key={schedule.id}
                        className={`
                          transition-all duration-200 hover:bg-muted/50
                          ${rowsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
                        `}
                        style={{
                          transitionDelay: rowsVisible ? `${Math.min(index * 30, 300)}ms` : "0ms",
                        }}
                      >
                        <TableCell>
                          <Switch
                            checked={schedule.is_active}
                            onCheckedChange={() => handleToggle(schedule)}
                            className="data-[state=checked]:bg-primary"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">
                              {schedule.name}
                            </p>
                            {schedule.description && (
                              <p className="text-xs text-muted-foreground truncate max-w-[200px] mt-0.5">
                                {schedule.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge
                                  variant="outline"
                                  className="font-mono text-xs cursor-help"
                                >
                                  {schedule.cron_expression}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{schedule.timezone}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell>
                          {schedule.configuration_name ? (
                            <Badge variant="secondary" className="gap-1">
                              <Settings className="h-3 w-3" />
                              {schedule.configuration_name}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {t('schedule.table.noConfig')}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {schedule.is_active ? (
                            <div className="flex items-center gap-1.5">
                              <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-sm font-mono">
                                {formatNextRun(schedule.next_run_at)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(schedule)}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 transition-all duration-200 hover:bg-muted hover:scale-105"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 rounded-lg">
                              <DropdownMenuItem
                                onClick={() => handleTest(schedule)}
                                disabled={testingId === schedule.id}
                                className="cursor-pointer"
                              >
                                {testingId === schedule.id ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <Play className="h-4 w-4 mr-2" />
                                )}
                                {t('schedule.actions.test')}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleViewRuns(schedule)}
                                className="cursor-pointer"
                              >
                                <History className="h-4 w-4 mr-2" />
                                {t('schedule.actions.viewRuns')}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleEdit(schedule)}
                                className="cursor-pointer"
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                {t('schedule.actions.edit')}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDelete(schedule)}
                                className="text-destructive focus:text-destructive cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {t('schedule.actions.delete')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Schedule Form Dialog */}
      <ScheduleForm
        open={formOpen}
        onOpenChange={setFormOpen}
        schedule={editingSchedule}
        onSave={loadSchedules}
      />

      {/* Schedule Runs Dialog */}
      <ScheduleRuns
        open={runsOpen}
        onOpenChange={setRunsOpen}
        schedule={viewingSchedule}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="rounded-xl max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 ring-2 ring-destructive/20">
                <Trash2 className="h-5 w-5 text-destructive" />
              </div>
              {t('schedule.deleteDialog.title')}
            </DialogTitle>
            <DialogDescription className="pt-3">
              {t('schedule.deleteDialog.description')}{" "}
              <strong>&quot;{deletingSchedule?.name}&quot;</strong>?{" "}
              {t('schedule.deleteDialog.cannotUndo')}
            </DialogDescription>
          </DialogHeader>
          {deletingSchedule && (
            <div className="p-4 rounded-xl bg-muted/50 border">
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>{t('schedule.deleteDialog.schedule')}:</span>
                  <span className="font-mono font-medium text-foreground">
                    {deletingSchedule.cron_expression}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{t('schedule.deleteDialog.status')}:</span>
                  <span className="font-medium text-foreground">
                    {deletingSchedule.is_active
                      ? t('schedule.status.active')
                      : t('schedule.status.inactive')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{t('schedule.deleteDialog.created')}:</span>
                  <span className="font-medium text-foreground">
                    {new Date(deletingSchedule.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="transition-all duration-200 hover:shadow-sm"
            >
              {tCommon('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              className="transition-all duration-200 hover:shadow-md"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t('schedule.deleteDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Skeleton loader for schedules page
 */
function SchedulesSkeleton() {
  return (
    <div className="p-0">
      {/* Table header skeleton */}
      <div className="flex items-center gap-4 p-4 border-b bg-muted/30">
        <Skeleton className="h-5 w-10" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-8 ml-auto" />
      </div>
      {/* Table rows skeleton */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 p-4 border-b last:border-b-0"
          style={{ opacity: 1 - i * 0.15 }}
        >
          <Skeleton className="h-5 w-10 rounded-full" />
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-lg ml-auto" />
        </div>
      ))}
    </div>
  );
}
