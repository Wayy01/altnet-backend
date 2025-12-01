"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
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
  ArrowLeft,
  RotateCcw,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  History,
  CalendarClock,
  Timer,
  ExternalLink,
  Database,
} from "lucide-react";
import { api } from "@/lib/api";
import { SyncLog } from "@/types";
import {
  SyncRollback,
  RollbackStatus,
  ROLLBACK_STATUS_VARIANTS,
  formatRollbackDuration,
} from "@/types/rollback";
import { RollbackPreviewComponent } from "@/components/sync/rollback-preview";
import { useTranslation } from "@/contexts/language-context";

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString();
}

function formatNumber(num: number | undefined | null): string {
  if (num == null) return '0';
  return num.toLocaleString();
}

function RollbacksPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const syncLogIdParam = searchParams.get("sync_log_id");

  const { t } = useTranslation('sync');
  const { t: tCommon } = useTranslation('common');

  // State
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [rollbacks, setRollbacks] = useState<SyncRollback[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [offset, setOffset] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // New rollback dialog
  const [showNewRollbackDialog, setShowNewRollbackDialog] = useState(!!syncLogIdParam);
  const [selectedSyncLogId, setSelectedSyncLogId] = useState<string>(syncLogIdParam || "");

  // Rollback details dialog
  const [selectedRollback, setSelectedRollback] = useState<SyncRollback | null>(null);

  // Animation states
  const [contentVisible, setContentVisible] = useState(false);
  const [rowsVisible, setRowsVisible] = useState(false);

  const currentPage = Math.floor(offset / pageSize) + 1;
  const totalPages = Math.ceil(total / pageSize);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [rollbacksResponse, logsResponse] = await Promise.all([
        api.listRollbacks(pageSize, offset),
        api.getSyncLogs(50, 0),
      ]);

      setRollbacks(rollbacksResponse.data ?? []);
      setTotal(rollbacksResponse.total ?? 0);
      setSyncLogs(logsResponse.data ?? []);

      setTimeout(() => setContentVisible(true), 50);
      setTimeout(() => setRowsVisible(true), 150);
    } catch (err) {
      console.error("Failed to load rollback data:", err);
      setRollbacks([]);
      setTotal(0);
      setSyncLogs([]);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [pageSize, offset]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRowsVisible(false);
    await loadData();
  };

  const handlePageChange = (newPage: number) => {
    setRowsVisible(false);
    setOffset((newPage - 1) * pageSize);
  };

  const handlePageSizeChange = (newSize: string) => {
    const size = parseInt(newSize, 10);
    setPageSize(size);
    setOffset(0);
    setRowsVisible(false);
  };

  const handleNewRollback = (syncLogId?: string) => {
    setSelectedSyncLogId(syncLogId || "");
    setShowNewRollbackDialog(true);
  };

  const handleRollbackComplete = () => {
    setShowNewRollbackDialog(false);
    setSelectedSyncLogId("");
    handleRefresh();
  };

  const handleViewDetails = (rollback: SyncRollback) => {
    setSelectedRollback(rollback);
  };

  // Filter rollbacks
  const filteredRollbacks = useMemo(() => {
    if (!rollbacks || rollbacks.length === 0) return [];

    let filtered = rollbacks;

    if (statusFilter !== "all") {
      filtered = filtered.filter((r) => r.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.id.toLowerCase().includes(query) ||
          r.original_sync_log_id.toLowerCase().includes(query) ||
          r.rollback_type.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [rollbacks, statusFilter, searchQuery]);

  // Get sync logs that have completed syncs (eligible for rollback)
  const eligibleSyncLogs = useMemo(() => {
    if (!syncLogs || syncLogs.length === 0) return [];
    return syncLogs.filter((log) => log.status === "completed");
  }, [syncLogs]);

  // Stats
  const stats = useMemo(() => {
    const safeRollbacks = rollbacks ?? [];
    const completed = safeRollbacks.filter((r) => r.status === "completed").length;
    const failed = safeRollbacks.filter((r) => r.status === "failed").length;
    const inProgress = safeRollbacks.filter((r) => r.status === "in_progress").length;

    return [
      { label: t('rollback.stats.totalRollbacks'), value: total ?? 0, icon: <RotateCcw className="h-3.5 w-3.5" />, variant: "default" as const },
      { label: t('rollback.stats.completed'), value: completed, icon: <CheckCircle2 className="h-3.5 w-3.5" />, variant: completed > 0 ? "success" as const : "muted" as const },
      { label: t('rollback.stats.failed'), value: failed, icon: <XCircle className="h-3.5 w-3.5" />, variant: failed > 0 ? "warning" as const : "muted" as const },
      { label: t('rollback.stats.inProgress'), value: inProgress, icon: <Loader2 className="h-3.5 w-3.5" />, variant: inProgress > 0 ? "info" as const : "muted" as const },
    ];
  }, [rollbacks, total, t]);

  const getStatusBadge = (status: RollbackStatus) => {
    const variant = ROLLBACK_STATUS_VARIANTS[status];
    const icons = {
      pending: <Clock className="h-3 w-3" />,
      in_progress: <Loader2 className="h-3 w-3 animate-spin" />,
      completed: <CheckCircle2 className="h-3 w-3" />,
      failed: <XCircle className="h-3 w-3" />,
    };

    return (
      <Badge variant={variant} className="gap-1">
        {icons[status]}
        {status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('rollback.page.title')}</h1>
          <p className="text-muted-foreground">{t('rollback.page.description')}</p>
        </div>
        <RollbacksPageSkeleton />
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
            <h1 className="text-3xl font-bold tracking-tight">{t('rollback.page.title')}</h1>
            <p className="text-muted-foreground">{t('rollback.page.description')}</p>
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
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            {t('actions.refresh')}
          </Button>
          <Button
            onClick={() => handleNewRollback()}
            className="transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            {t('rollback.newRollback')}
          </Button>
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
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className={`
              inline-flex items-center gap-2 px-3 py-2 rounded-lg border
              transition-all duration-200 ease-out
              hover:shadow-sm hover:border-border/80 hover:-translate-y-0.5
              ${stat.variant === "success" ? "bg-primary/5 border-primary/20 hover:bg-primary/10" : ""}
              ${stat.variant === "warning" ? "bg-destructive/5 border-destructive/20 hover:bg-destructive/10" : ""}
              ${stat.variant === "info" ? "bg-blue-500/5 border-blue-500/20 hover:bg-blue-500/10" : ""}
              ${stat.variant === "default" || stat.variant === "muted" ? "bg-muted/50" : ""}
            `}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <span className={`
              ${stat.variant === "success" ? "text-primary" : ""}
              ${stat.variant === "warning" ? "text-destructive" : ""}
              ${stat.variant === "info" ? "text-blue-600" : ""}
              ${stat.variant === "default" || stat.variant === "muted" ? "text-muted-foreground" : ""}
            `}>
              {stat.icon}
            </span>
            <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
            <span className="text-sm font-semibold tabular-nums">{stat.value}</span>
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
            placeholder={t('rollback.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 rounded-lg"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] rounded-lg">
            <SelectValue placeholder={t('rollback.filterByStatus')} />
          </SelectTrigger>
          <SelectContent className="rounded-lg">
            <SelectItem value="all">{t('rollback.allStatuses')}</SelectItem>
            <SelectItem value="pending">{t('status.pending')}</SelectItem>
            <SelectItem value="in_progress">{t('status.running')}</SelectItem>
            <SelectItem value="completed">{t('status.completed')}</SelectItem>
            <SelectItem value="failed">{t('status.failed')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Rollbacks Table */}
      <div
        className={`
          transition-all duration-300 ease-out
          ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
        `}
        style={{ transitionDelay: "150ms" }}
      >
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="p-6 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-background shadow-sm">
                <History className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold">{t('rollback.historyTitle')}</h3>
                <p className="text-sm text-muted-foreground">{t('rollback.historyDescription')}</p>
              </div>
            </div>
          </div>

          <div className="p-0">
            {filteredRollbacks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="p-4 rounded-full bg-muted/50 mb-4">
                  <RotateCcw className="h-10 w-10 text-muted-foreground/50" />
                </div>
                <p className="font-medium text-foreground">{t('rollback.noRollbacks')}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('rollback.noRollbacksDescription')}
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => handleNewRollback()}
                >
                  {t('rollback.createFirst')}
                </Button>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead>{t('rollback.table.type')}</TableHead>
                      <TableHead>{t('rollback.table.status')}</TableHead>
                      <TableHead className="text-right">{t('rollback.table.entitiesRestored')}</TableHead>
                      <TableHead>{t('rollback.table.startedAt')}</TableHead>
                      <TableHead>{t('rollback.table.completedAt')}</TableHead>
                      <TableHead className="w-[100px]">{tCommon('actions.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRollbacks.map((rollback, index) => (
                      <TableRow
                        key={rollback.id}
                        className={`
                          transition-all duration-200 hover:bg-muted/50
                          ${rowsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
                        `}
                        style={{
                          transitionDelay: rowsVisible ? `${Math.min(index * 20, 400)}ms` : "0ms",
                        }}
                      >
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {t(`rollback.types.${rollback.rollback_type}`)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(rollback.status)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm tabular-nums">
                          {formatNumber(rollback.entities_restored)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(rollback.started_at)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {rollback.completed_at ? formatDate(rollback.completed_at) : '-'}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(rollback)}
                            className="gap-2"
                          >
                            <ExternalLink className="h-3 w-3" />
                            {tCommon('actions.details')}
                          </Button>
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
                        {t('history.showing')} <span className="font-medium text-foreground">{offset + 1}</span> {t('history.to')}{" "}
                        <span className="font-medium text-foreground">{Math.min(offset + pageSize, total)}</span> {t('history.of')}{" "}
                        <span className="font-medium text-foreground">{total.toLocaleString()}</span> {t('rollback.rollbacks')}
                      </p>
                      <div className="h-4 w-px bg-border" />
                      <div className="flex items-center gap-2">
                        <span>{t('history.rowsPerPage')}:</span>
                        <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                          <SelectTrigger className="w-[70px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="25">25</SelectItem>
                            <SelectItem value="50">50</SelectItem>
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
                        className="h-8 w-8 transition-all duration-200 hover:bg-muted"
                      >
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="transition-all duration-200 hover:bg-muted"
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        {tCommon('pagination.previous')}
                      </Button>
                      <div className="text-sm px-2">
                        {currentPage} / {totalPages}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="transition-all duration-200 hover:bg-muted"
                      >
                        {tCommon('pagination.next')}
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handlePageChange(totalPages)}
                        disabled={currentPage === totalPages}
                        className="h-8 w-8 transition-all duration-200 hover:bg-muted"
                      >
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* New Rollback Dialog */}
      <Dialog open={showNewRollbackDialog} onOpenChange={setShowNewRollbackDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              {t('rollback.newRollbackTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('rollback.newRollbackDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            {!selectedSyncLogId ? (
              // Sync log selection
              <div className="space-y-3">
                <label className="text-sm font-medium">{t('rollback.selectSyncLog')}</label>
                <Select value={selectedSyncLogId} onValueChange={setSelectedSyncLogId}>
                  <SelectTrigger className="h-12 rounded-xl">
                    <SelectValue placeholder={t('rollback.selectSyncLogPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl max-h-[400px]">
                    {eligibleSyncLogs.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        {t('rollback.noEligibleSyncLogs')}
                      </div>
                    ) : (
                      eligibleSyncLogs.map((log) => (
                        <SelectItem key={log.id} value={log.id} className="rounded-lg">
                          <div className="flex items-center gap-3 py-1">
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary border-primary/20"
                            >
                              {log.sync_type}
                            </Badge>
                            <span className="font-medium">{formatDate(log.started_at)}</span>
                            <span className="text-xs text-muted-foreground">
                              {log.products_synced} products
                            </span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              // Rollback preview
              <RollbackPreviewComponent
                syncLogId={selectedSyncLogId}
                onRollbackComplete={handleRollbackComplete}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Rollback Details Dialog */}
      <Dialog open={!!selectedRollback} onOpenChange={() => setSelectedRollback(null)}>
        <DialogContent className="max-w-2xl rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              {t('rollback.detailsTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('rollback.detailsDescription')}
            </DialogDescription>
          </DialogHeader>

          {selectedRollback && (
            <div className="space-y-4 pt-4">
              {/* Status Banner */}
              <div className={`rounded-xl border p-4 ${
                selectedRollback.status === "completed"
                  ? "border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10"
                  : selectedRollback.status === "failed"
                    ? "border-destructive/20 bg-gradient-to-br from-destructive/5 to-destructive/10"
                    : "border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-blue-500/10"
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ring-2 shadow-sm ${
                      selectedRollback.status === "completed"
                        ? "bg-primary/10 ring-primary/20"
                        : selectedRollback.status === "failed"
                          ? "bg-destructive/10 ring-destructive/20"
                          : "bg-blue-500/10 ring-blue-500/20"
                    }`}>
                      {selectedRollback.status === "completed" ? (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      ) : selectedRollback.status === "failed" ? (
                        <XCircle className="h-5 w-5 text-destructive" />
                      ) : selectedRollback.status === "in_progress" ? (
                        <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                      ) : (
                        <Clock className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold capitalize">{selectedRollback.status}</p>
                      <p className="text-xs text-muted-foreground">
                        {t(`rollback.types.${selectedRollback.rollback_type}`)}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-sm">
                    {selectedRollback.entities_restored.toLocaleString()} {t('rollback.entitiesRestored')}
                  </Badge>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border bg-muted/20">
                  <p className="text-xs text-muted-foreground mb-1">{t('rollback.rollbackId')}</p>
                  <p className="text-sm font-mono truncate">{selectedRollback.id}</p>
                </div>
                <div className="p-4 rounded-xl border bg-muted/20">
                  <p className="text-xs text-muted-foreground mb-1">{t('rollback.originalSyncLog')}</p>
                  <p className="text-sm font-mono truncate">{selectedRollback.original_sync_log_id}</p>
                </div>
                <div className="p-4 rounded-xl border bg-muted/20">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                    <CalendarClock className="h-3 w-3" />
                    {t('rollback.startedAt')}
                  </div>
                  <p className="text-sm">{formatDate(selectedRollback.started_at)}</p>
                </div>
                <div className="p-4 rounded-xl border bg-muted/20">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                    <Timer className="h-3 w-3" />
                    {t('rollback.completedAt')}
                  </div>
                  <p className="text-sm">
                    {selectedRollback.completed_at ? formatDate(selectedRollback.completed_at) : '-'}
                  </p>
                </div>
              </div>

              {/* Errors (if any) */}
              {selectedRollback.errors && selectedRollback.errors.length > 0 && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <p className="font-medium text-destructive">{t('rollback.errors')}</p>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-sm text-destructive/80">
                    {selectedRollback.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Initiated By */}
              {selectedRollback.initiated_by && (
                <div className="text-sm text-muted-foreground">
                  {t('rollback.initiatedBy')}: <span className="font-medium text-foreground">{selectedRollback.initiated_by}</span>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RollbacksPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats skeleton */}
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-10 w-32 rounded-lg"
            style={{ animationDelay: `${i * 50}ms` }}
          />
        ))}
      </div>

      {/* Filters skeleton */}
      <div className="flex gap-3">
        <Skeleton className="h-10 flex-1 max-w-sm rounded-lg" />
        <Skeleton className="h-10 w-[180px] rounded-lg" />
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
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-20" style={{ animationDelay: `${i * 30}ms` }} />
            ))}
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-4 border-b last:border-b-0"
              style={{ opacity: 1 - i * 0.15 }}
            >
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-4 w-12 ml-auto" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-20 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function RollbacksPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          <RollbacksPageSkeleton />
        </div>
      }
    >
      <RollbacksPageContent />
    </Suspense>
  );
}
