"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  Calendar,
  Timer,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  History,
} from "lucide-react";
import { SyncSchedule, SyncScheduleRun, ScheduleStatus } from "@/types/schedule";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/language-context";

interface ScheduleRunsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: SyncSchedule | null;
}

export function ScheduleRuns({
  open,
  onOpenChange,
  schedule,
}: ScheduleRunsProps) {
  const { t } = useTranslation('sync');
  const [loading, setLoading] = useState(false);
  const [runs, setRuns] = useState<SyncScheduleRun[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    if (open && schedule) {
      loadRuns();
    }
  }, [open, schedule, page]);

  const loadRuns = async () => {
    if (!schedule) return;

    try {
      setLoading(true);
      const response = await api.listScheduleRuns(
        schedule.id,
        pageSize,
        page * pageSize
      );
      setRuns(response.runs);
      setTotal(response.total);
    } catch (error) {
      console.error("Failed to load schedule runs:", error);
      toast.error(t('schedule.runs.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number | null): string => {
    if (seconds === null) return "-";
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}m ${secs}s`;
    }
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  };

  const formatDateTime = (dateStr: string | null): string => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString();
  };

  const getStatusBadge = (status: ScheduleStatus) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-primary/10 text-primary border-primary/20 gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {t('schedule.status.completed')}
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-destructive/10 text-destructive border-destructive/20 gap-1">
            <XCircle className="h-3 w-3" />
            {t('schedule.status.failed')}
          </Badge>
        );
      case "running":
        return (
          <Badge className="bg-accent/10 text-accent-foreground border-accent/20 gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t('schedule.status.running')}
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-muted text-muted-foreground border-border gap-1">
            <Clock className="h-3 w-3" />
            {t('schedule.status.pending')}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            {status}
          </Badge>
        );
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <History className="h-5 w-5" />
            {t('schedule.runs.title')}
          </DialogTitle>
          <DialogDescription>
            {schedule?.name && (
              <span className="font-medium text-foreground">
                {schedule.name}
              </span>
            )}
            {" - "}
            {t('schedule.runs.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-3 border rounded-lg">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : runs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="p-4 rounded-full bg-muted/50 mb-4">
                <Calendar className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <p className="font-medium text-foreground">
                {t('schedule.runs.noRuns')}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {t('schedule.runs.noRunsDescription')}
              </p>
            </div>
          ) : (
            <>
              <ScrollArea className="h-[400px] rounded-lg border">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted/50 backdrop-blur-sm">
                    <TableRow>
                      <TableHead className="font-semibold">
                        {t('schedule.runs.status')}
                      </TableHead>
                      <TableHead className="font-semibold">
                        {t('schedule.runs.triggeredAt')}
                      </TableHead>
                      <TableHead className="font-semibold">
                        {t('schedule.runs.startedAt')}
                      </TableHead>
                      <TableHead className="font-semibold">
                        {t('schedule.runs.duration')}
                      </TableHead>
                      <TableHead className="font-semibold">
                        {t('schedule.runs.attempt')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs.map((run) => (
                      <TableRow
                        key={run.id}
                        className="transition-colors hover:bg-muted/50"
                      >
                        <TableCell>{getStatusBadge(run.status)}</TableCell>
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            {formatDateTime(run.triggered_at)}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {run.started_at ? (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Calendar className="h-3.5 w-3.5" />
                              {formatDateTime(run.started_at)}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {run.duration_seconds !== null ? (
                            <div className="flex items-center gap-1.5">
                              <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="font-mono text-sm">
                                {formatDuration(run.duration_seconds)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {run.retry_attempt > 0 ? (
                            <Badge variant="outline" className="gap-1">
                              <RefreshCw className="h-3 w-3" />
                              {t('schedule.runs.retry')} #{run.retry_attempt}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">
                              {t('schedule.runs.initial')}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-sm text-muted-foreground">
                    {t('schedule.runs.showing')} {page * pageSize + 1}-
                    {Math.min((page + 1) * pageSize, total)} {t('schedule.runs.of')}{" "}
                    {total} {t('schedule.runs.entries')}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">
                      {page + 1} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page >= totalPages - 1}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Error message display for failed runs */}
              {runs.some((r) => r.error_message) && (
                <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                  <h4 className="font-medium text-destructive flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4" />
                    {t('schedule.runs.recentErrors')}
                  </h4>
                  <div className="space-y-2">
                    {runs
                      .filter((r) => r.error_message)
                      .slice(0, 3)
                      .map((run) => (
                        <div
                          key={run.id}
                          className="text-sm text-muted-foreground"
                        >
                          <span className="font-mono text-xs">
                            {new Date(run.triggered_at).toLocaleString()}:
                          </span>{" "}
                          <span className="text-destructive">
                            {run.error_message}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
