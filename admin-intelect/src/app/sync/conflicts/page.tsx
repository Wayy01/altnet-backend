"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  GitMerge,
  Shield,
  Settings2,
  ExternalLink,
  Clock,
  Database,
  Cloud,
} from "lucide-react";
import { api } from "@/lib/api";
import { SyncLog } from "@/types";
import {
  SyncConflict,
  ConflictResolutionRequest,
  getConflictTypeVariant,
  getConflictStatusVariant,
} from "@/types/conflict";
import { ConflictResolver } from "@/components/sync/conflict-resolver";
import { ConflictRulesManager } from "@/components/sync/conflict-rules-manager";
import { ConflictDiffViewer } from "@/components/sync/conflict-diff-viewer";
import { useTranslation } from "@/contexts/language-context";

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString();
}

function ConflictsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const syncLogIdParam = searchParams.get("sync_log_id");

  const { t } = useTranslation('sync');
  const { t: tCommon } = useTranslation('common');

  // State
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [offset, setOffset] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [syncLogFilter, setSyncLogFilter] = useState<string>(syncLogIdParam || "all");
  const [activeTab, setActiveTab] = useState<string>("conflicts");

  // Dialog state
  const [selectedConflicts, setSelectedConflicts] = useState<SyncConflict[]>([]);
  const [showResolverDialog, setShowResolverDialog] = useState(false);
  const [selectedConflictForView, setSelectedConflictForView] = useState<SyncConflict | null>(null);

  // Animation states
  const [contentVisible, setContentVisible] = useState(false);
  const [rowsVisible, setRowsVisible] = useState(false);

  const currentPage = Math.floor(offset / pageSize) + 1;
  const totalPages = Math.ceil(total / pageSize);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const filters: { sync_log_id?: string; unresolved?: boolean } = {};

      if (syncLogFilter !== "all") {
        filters.sync_log_id = syncLogFilter;
      }
      if (statusFilter === "unresolved") {
        filters.unresolved = true;
      }

      const [conflictsResponse, logsResponse] = await Promise.all([
        api.listConflicts(pageSize, offset, filters),
        api.getSyncLogs(50, 0),
      ]);

      setConflicts(conflictsResponse.data ?? []);
      setTotal(conflictsResponse.total ?? 0);
      setSyncLogs(logsResponse.data ?? []);

      setTimeout(() => setContentVisible(true), 50);
      setTimeout(() => setRowsVisible(true), 150);
    } catch (err) {
      console.error("Failed to load conflict data:", err);
      setConflicts([]);
      setTotal(0);
      setSyncLogs([]);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [pageSize, offset, syncLogFilter, statusFilter]);

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

  const handleResolve = async (request: ConflictResolutionRequest) => {
    await api.resolveConflicts(request);
    setShowResolverDialog(false);
    setSelectedConflicts([]);
    handleRefresh();
  };

  const handleSelectConflict = (conflict: SyncConflict) => {
    setSelectedConflicts(prev => {
      const exists = prev.find(c => c.id === conflict.id);
      if (exists) {
        return prev.filter(c => c.id !== conflict.id);
      }
      return [...prev, conflict];
    });
  };

  const handleSelectAll = () => {
    const unresolvedConflicts = filteredConflicts.filter(c => !c.resolution_applied);
    if (selectedConflicts.length === unresolvedConflicts.length) {
      setSelectedConflicts([]);
    } else {
      setSelectedConflicts(unresolvedConflicts);
    }
  };

  const handleViewConflict = (conflict: SyncConflict) => {
    setSelectedConflictForView(conflict);
  };

  const handleBulkResolve = () => {
    if (selectedConflicts.length > 0) {
      setShowResolverDialog(true);
    }
  };

  // Filter conflicts
  const filteredConflicts = useMemo(() => {
    if (!conflicts || conflicts.length === 0) return [];

    let filtered = conflicts;

    if (statusFilter === "resolved") {
      filtered = filtered.filter(c => c.resolution_applied);
    } else if (statusFilter === "unresolved") {
      filtered = filtered.filter(c => !c.resolution_applied);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.id.toLowerCase().includes(query) ||
          c.entity_id.toLowerCase().includes(query) ||
          c.entity_type.toLowerCase().includes(query) ||
          c.conflict_type.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [conflicts, statusFilter, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    const safeConflicts = conflicts ?? [];
    const resolved = safeConflicts.filter(c => c.resolution_applied).length;
    const unresolved = safeConflicts.filter(c => !c.resolution_applied).length;

    return [
      {
        label: t('conflict.stats.totalConflicts'),
        value: total ?? 0,
        icon: <GitMerge className="h-3.5 w-3.5" />,
        variant: "default" as const,
      },
      {
        label: t('conflict.stats.unresolved'),
        value: unresolved,
        icon: <AlertTriangle className="h-3.5 w-3.5" />,
        variant: unresolved > 0 ? "warning" as const : "muted" as const,
      },
      {
        label: t('conflict.stats.resolved'),
        value: resolved,
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
        variant: resolved > 0 ? "success" as const : "muted" as const,
      },
    ];
  }, [conflicts, total, t]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('conflict.page.title')}</h1>
          <p className="text-muted-foreground">{t('conflict.page.description')}</p>
        </div>
        <ConflictsPageSkeleton />
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
            <h1 className="text-3xl font-bold tracking-tight">{t('conflict.page.title')}</h1>
            <p className="text-muted-foreground">{t('conflict.page.description')}</p>
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
            {tCommon('actions.refresh')}
          </Button>
          {selectedConflicts.length > 0 && activeTab === "conflicts" && (
            <Button
              onClick={handleBulkResolve}
              className="transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
            >
              <GitMerge className="h-4 w-4 mr-2" />
              {t('conflict.resolveSelected')} ({selectedConflicts.length})
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
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className={`
              inline-flex items-center gap-2 px-3 py-2 rounded-lg border
              transition-all duration-200 ease-out
              hover:shadow-sm hover:border-border/80 hover:-translate-y-0.5
              ${stat.variant === "success" ? "bg-primary/5 border-primary/20 hover:bg-primary/10" : ""}
              ${stat.variant === "warning" ? "bg-destructive/5 border-destructive/20 hover:bg-destructive/10" : ""}
              ${stat.variant === "default" || stat.variant === "muted" ? "bg-muted/50" : ""}
            `}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <span className={`
              ${stat.variant === "success" ? "text-primary" : ""}
              ${stat.variant === "warning" ? "text-destructive" : ""}
              ${stat.variant === "default" || stat.variant === "muted" ? "text-muted-foreground" : ""}
            `}>
              {stat.icon}
            </span>
            <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
            <span className="text-sm font-semibold tabular-nums">{stat.value}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div
        className={`
          transition-all duration-300 ease-out
          ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
        `}
        style={{ transitionDelay: "100ms" }}
      >
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2 rounded-xl p-1">
            <TabsTrigger value="conflicts" className="rounded-lg gap-2">
              <GitMerge className="h-4 w-4" />
              {t('conflict.tabs.conflicts')}
              {stats[1].value > 0 && (
                <Badge variant="destructive" className="ml-1 px-1.5 py-0 text-[10px]">
                  {stats[1].value}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="rules" className="rounded-lg gap-2">
              <Settings2 className="h-4 w-4" />
              {t('conflict.tabs.rules')}
            </TabsTrigger>
          </TabsList>

          {/* Conflicts Tab */}
          <TabsContent value="conflicts" className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="relative flex-1 w-full sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('conflict.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 rounded-lg"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px] rounded-lg">
                  <SelectValue placeholder={t('conflict.filterByStatus')} />
                </SelectTrigger>
                <SelectContent className="rounded-lg">
                  <SelectItem value="all">{t('conflict.allStatuses')}</SelectItem>
                  <SelectItem value="unresolved">{t('conflict.unresolved')}</SelectItem>
                  <SelectItem value="resolved">{t('conflict.resolved')}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={syncLogFilter} onValueChange={setSyncLogFilter}>
                <SelectTrigger className="w-[220px] rounded-lg">
                  <SelectValue placeholder={t('conflict.filterBySyncLog')} />
                </SelectTrigger>
                <SelectContent className="rounded-lg max-h-[300px]">
                  <SelectItem value="all">{t('conflict.allSyncLogs')}</SelectItem>
                  {syncLogs.map((log) => (
                    <SelectItem key={log.id} value={log.id}>
                      {formatDate(log.started_at).slice(0, 16)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Conflicts Table */}
            <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
              <div className="p-6 border-b bg-muted/30">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-background shadow-sm">
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{t('conflict.listTitle')}</h3>
                    <p className="text-sm text-muted-foreground">{t('conflict.listDescription')}</p>
                  </div>
                </div>
              </div>

              <div className="p-0">
                {filteredConflicts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="p-4 rounded-full bg-muted/50 mb-4">
                      <CheckCircle2 className="h-10 w-10 text-muted-foreground/50" />
                    </div>
                    <p className="font-medium text-foreground">{t('conflict.noConflicts')}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t('conflict.noConflictsDescription')}
                    </p>
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableHead className="w-[40px]">
                            <input
                              type="checkbox"
                              checked={
                                selectedConflicts.length > 0 &&
                                selectedConflicts.length === filteredConflicts.filter(c => !c.resolution_applied).length
                              }
                              onChange={handleSelectAll}
                              className="rounded border-muted-foreground/30"
                            />
                          </TableHead>
                          <TableHead>{t('conflict.table.entityType')}</TableHead>
                          <TableHead>{t('conflict.table.entityId')}</TableHead>
                          <TableHead>{t('conflict.table.conflictType')}</TableHead>
                          <TableHead>{t('conflict.table.status')}</TableHead>
                          <TableHead>{t('conflict.table.createdAt')}</TableHead>
                          <TableHead className="w-[100px]">{tCommon('actions.actions')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredConflicts.map((conflict, index) => (
                          <TableRow
                            key={conflict.id}
                            className={`
                              transition-all duration-200 hover:bg-muted/50
                              ${rowsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
                              ${selectedConflicts.find(c => c.id === conflict.id) ? "bg-primary/5" : ""}
                            `}
                            style={{
                              transitionDelay: rowsVisible ? `${Math.min(index * 20, 400)}ms` : "0ms",
                            }}
                          >
                            <TableCell>
                              {!conflict.resolution_applied && (
                                <input
                                  type="checkbox"
                                  checked={!!selectedConflicts.find(c => c.id === conflict.id)}
                                  onChange={() => handleSelectConflict(conflict)}
                                  className="rounded border-muted-foreground/30"
                                />
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {t(`conflict.entityTypes.${conflict.entity_type}`)}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {conflict.entity_id.slice(0, 8)}...
                            </TableCell>
                            <TableCell>
                              <Badge variant={getConflictTypeVariant(conflict.conflict_type)} className="text-xs">
                                {t(`conflict.types.${conflict.conflict_type}`)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={getConflictStatusVariant(conflict)}
                                className={`text-xs gap-1 ${
                                  conflict.resolution_applied
                                    ? "bg-primary/10 text-primary border-primary/20"
                                    : "bg-destructive/10 text-destructive border-destructive/20"
                                }`}
                              >
                                {conflict.resolution_applied ? (
                                  <>
                                    <CheckCircle2 className="h-3 w-3" />
                                    {t('conflict.resolved')}
                                  </>
                                ) : (
                                  <>
                                    <Clock className="h-3 w-3" />
                                    {t('conflict.unresolved')}
                                  </>
                                )}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDate(conflict.created_at)}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewConflict(conflict)}
                                className="gap-2"
                              >
                                <ExternalLink className="h-3 w-3" />
                                {tCommon('actions.view')}
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
                            <span className="font-medium text-foreground">{total.toLocaleString()}</span> {t('conflict.conflicts')}
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
          </TabsContent>

          {/* Rules Tab */}
          <TabsContent value="rules">
            <ConflictRulesManager onRuleChange={handleRefresh} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Resolver Dialog */}
      <Dialog open={showResolverDialog} onOpenChange={setShowResolverDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitMerge className="h-5 w-5" />
              {t('conflict.resolverTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('conflict.resolverDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="pt-4">
            <ConflictResolver
              conflicts={selectedConflicts}
              onResolve={handleResolve}
              onCancel={() => setShowResolverDialog(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* View Conflict Dialog */}
      <Dialog
        open={!!selectedConflictForView}
        onOpenChange={(open) => !open && setSelectedConflictForView(null)}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              {t('conflict.viewTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('conflict.viewDescription')}
            </DialogDescription>
          </DialogHeader>

          {selectedConflictForView && (
            <div className="pt-4 space-y-4">
              {/* Conflict Info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg border bg-muted/20">
                  <p className="text-xs text-muted-foreground">{t('conflict.table.entityType')}</p>
                  <Badge variant="outline" className="mt-1">
                    {t(`conflict.entityTypes.${selectedConflictForView.entity_type}`)}
                  </Badge>
                </div>
                <div className="p-3 rounded-lg border bg-muted/20">
                  <p className="text-xs text-muted-foreground">{t('conflict.table.conflictType')}</p>
                  <Badge variant="secondary" className="mt-1">
                    {t(`conflict.types.${selectedConflictForView.conflict_type}`)}
                  </Badge>
                </div>
                <div className="p-3 rounded-lg border bg-muted/20">
                  <p className="text-xs text-muted-foreground">{t('conflict.table.status')}</p>
                  <Badge
                    className={`mt-1 ${
                      selectedConflictForView.resolution_applied
                        ? "bg-primary/10 text-primary border-primary/20"
                        : "bg-destructive/10 text-destructive border-destructive/20"
                    }`}
                  >
                    {selectedConflictForView.resolution_applied ? t('conflict.resolved') : t('conflict.unresolved')}
                  </Badge>
                </div>
                <div className="p-3 rounded-lg border bg-muted/20">
                  <p className="text-xs text-muted-foreground">{t('conflict.table.createdAt')}</p>
                  <p className="text-sm font-medium mt-1">
                    {formatDate(selectedConflictForView.created_at)}
                  </p>
                </div>
              </div>

              {/* Diff Viewer */}
              <ConflictDiffViewer conflict={selectedConflictForView} />

              {/* Resolution Info */}
              {selectedConflictForView.resolution_applied && (
                <Card className="rounded-xl border-primary/20 bg-primary/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      {t('conflict.resolutionInfo')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {selectedConflictForView.resolution_strategy && (
                      <p>
                        <span className="text-muted-foreground">{t('conflict.strategy')}:</span>{" "}
                        <span className="font-medium">{selectedConflictForView.resolution_strategy}</span>
                      </p>
                    )}
                    {selectedConflictForView.resolved_at && (
                      <p>
                        <span className="text-muted-foreground">{t('conflict.resolvedAt')}:</span>{" "}
                        <span className="font-medium">{formatDate(selectedConflictForView.resolved_at)}</span>
                      </p>
                    )}
                    {selectedConflictForView.resolved_by && (
                      <p>
                        <span className="text-muted-foreground">{t('conflict.resolvedBy')}:</span>{" "}
                        <span className="font-medium">{selectedConflictForView.resolved_by}</span>
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Actions */}
              {!selectedConflictForView.resolution_applied && (
                <div className="flex justify-end pt-2">
                  <Button
                    onClick={() => {
                      setSelectedConflicts([selectedConflictForView]);
                      setSelectedConflictForView(null);
                      setShowResolverDialog(true);
                    }}
                    className="transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
                  >
                    <GitMerge className="h-4 w-4 mr-2" />
                    {t('conflict.resolveThis')}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ConflictsPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats skeleton */}
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-10 w-32 rounded-lg"
            style={{ animationDelay: `${i * 50}ms` }}
          />
        ))}
      </div>

      {/* Tabs skeleton */}
      <Skeleton className="h-10 w-80 rounded-xl" />

      {/* Filters skeleton */}
      <div className="flex gap-3">
        <Skeleton className="h-10 flex-1 max-w-sm rounded-lg" />
        <Skeleton className="h-10 w-[180px] rounded-lg" />
        <Skeleton className="h-10 w-[220px] rounded-lg" />
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
              <Skeleton key={i} className="h-4 w-20" style={{ animationDelay: `${i * 30}ms` }} />
            ))}
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-4 border-b last:border-b-0"
              style={{ opacity: 1 - i * 0.15 }}
            >
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-28 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-16 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ConflictsPage() {
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
          <ConflictsPageSkeleton />
        </div>
      }
    >
      <ConflictsPageContent />
    </Suspense>
  );
}
