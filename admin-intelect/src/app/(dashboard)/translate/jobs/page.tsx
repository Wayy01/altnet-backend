"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Languages,
  ListChecks,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  XCircle,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Activity,
  Info,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import {
  TranslationJob,
  TranslationEntityType,
  TargetLanguage,
  TranslationJobStatus,
} from "@/types";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/contexts/language-context";

const PAGE_SIZE = 20;

export default function TranslationJobsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useTranslation('translate');
  const { t: tCommon } = useTranslation('common');

  // State
  const [jobs, setJobs] = useState<TranslationJob[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [contentVisible, setContentVisible] = useState(false);
  const [formSectionVisible, setFormSectionVisible] = useState(false);

  // Filters
  const [entityFilter, setEntityFilter] = useState<TranslationEntityType | "">("");
  const [languageFilter, setLanguageFilter] = useState<TargetLanguage | "">("");
  const [statusFilter, setStatusFilter] = useState<TranslationJobStatus | "">("");

  // Trigger staggered entrance animations
  useEffect(() => {
    const timer1 = setTimeout(() => setContentVisible(true), 50);
    const timer2 = setTimeout(() => setFormSectionVisible(true), 150);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  // Load jobs
  const loadJobs = useCallback(async () => {
    try {
      const filters: {
        entity_type?: TranslationEntityType;
        target_language?: TargetLanguage;
        status?: string;
      } = {};

      if (entityFilter) filters.entity_type = entityFilter;
      if (languageFilter) filters.target_language = languageFilter;
      if (statusFilter) filters.status = statusFilter;

      const { data, total } = await api.getTranslationJobs(PAGE_SIZE, page * PAGE_SIZE, filters);
      setJobs(data);
      setTotal(total);
    } catch (error) {
      console.error("Failed to load jobs:", error);
      toast({
        title: "Error",
        description: "Failed to load translation jobs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, entityFilter, languageFilter, statusFilter]);

  // Load jobs on mount and filter changes
  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  // Auto-refresh when there are running jobs
  useEffect(() => {
    const hasRunningJobs = jobs.some(job => job.status === "running" || job.status === "pending");

    if (hasRunningJobs) {
      const interval = setInterval(() => {
        loadJobs();
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [jobs, loadJobs]);

  // Handle cancel job
  const handleCancelJob = async (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation();
    try {
      await api.cancelTranslationJob(jobId);
      toast({
        title: "Job Cancelled",
        description: "Translation job has been cancelled",
      });
      loadJobs();
    } catch (error) {
      console.error("Failed to cancel job:", error);
      toast({
        title: "Error",
        description: "Failed to cancel job",
        variant: "destructive",
      });
    }
  };

  // Get status config
  const getStatusConfig = (status: TranslationJobStatus) => {
    switch (status) {
      case "completed":
        return { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10", label: "Completed" };
      case "running":
        return { icon: Activity, color: "text-blue-500", bg: "bg-blue-500/10", label: "Running" };
      case "pending":
        return { icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10", label: "Pending" };
      case "failed":
        return { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10", label: "Failed" };
      case "cancelled":
        return { icon: AlertCircle, color: "text-orange-500", bg: "bg-orange-500/10", label: "Cancelled" };
      default:
        return { icon: Clock, color: "text-gray-500", bg: "bg-gray-500/10", label: status };
    }
  };

  // Format duration
  const formatDuration = (job: TranslationJob) => {
    if (!job.started_at) return "-";
    const start = new Date(job.started_at);
    const end = job.completed_at ? new Date(job.completed_at) : new Date();
    const seconds = Math.floor((end.getTime() - start.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Count stats
  const runningCount = jobs.filter(j => j.status === "running").length;
  const completedCount = jobs.filter(j => j.status === "completed").length;
  const failedCount = jobs.filter(j => j.status === "failed").length;

  const hasActiveFilters = entityFilter || languageFilter || statusFilter;

  return (
    <div className="min-h-screen">
      <div
        className={cn(
          "flex flex-col gap-6 p-6 transition-all duration-500 ease-out",
          contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        )}
      >
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link
            href="/"
            className="hover:text-foreground transition-colors duration-200 hover:underline underline-offset-4"
          >
            {t('breadcrumb.dashboard')}
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link
            href="/translate"
            className="hover:text-foreground transition-colors duration-200 hover:underline underline-offset-4"
          >
            {t('breadcrumb.translations')}
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">{t('breadcrumb.jobs')}</span>
        </nav>

        {/* Page Header */}
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => router.back()}
              className="shrink-0 h-10 w-10 rounded-xl border-border/50 transition-all duration-200 hover:bg-muted hover:border-border hover:-translate-y-0.5 hover:shadow-sm active:scale-95"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border shadow-lg bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border-primary/20">
                  <ListChecks className="h-7 w-7 text-primary" />
                </div>
                {runningCount > 0 && (
                  <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-blue-500 border-2 border-background flex items-center justify-center">
                    <span className="text-[9px] font-bold text-white">{runningCount}</span>
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{t('page.jobsTitle')}</h1>
                <p className="text-sm text-muted-foreground">
                  {t('page.jobsDescription')}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => router.push("/translate")}
              className="gap-2 transition-all duration-200 hover:bg-muted"
            >
              <Languages className="h-4 w-4" />
              {t('actions.newTranslation')}
            </Button>
            <Button
              variant="outline"
              onClick={loadJobs}
              disabled={loading}
              className="gap-2 transition-all duration-200 hover:bg-muted"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              {t('actions.refresh')}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div
          className={cn(
            "grid gap-4 md:grid-cols-4 transition-all duration-500 ease-out",
            formSectionVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          )}
          style={{ transitionDelay: "50ms" }}
        >
          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardContent className="py-5">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center">
                  <ListChecks className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{total}</div>
                  <div className="text-xs text-muted-foreground">{t('stats.totalJobs')}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardContent className="py-5">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Activity className={cn("h-5 w-5 text-blue-500", runningCount > 0 && "animate-pulse")} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">{runningCount}</div>
                  <div className="text-xs text-muted-foreground">{t('stats.running')}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardContent className="py-5">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-emerald-600">{completedCount}</div>
                  <div className="text-xs text-muted-foreground">{t('stats.completed')}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardContent className="py-5">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <XCircle className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">{failedCount}</div>
                  <div className="text-xs text-muted-foreground">{t('stats.failed')}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-4">
          {/* Jobs List */}
          <div
            className={cn(
              "lg:col-span-3 transition-all duration-500 ease-out",
              formSectionVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            )}
            style={{ transitionDelay: "100ms" }}
          >
            <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
              <CardHeader className="pb-4 bg-gradient-to-r from-muted/30 to-muted/10 border-b border-border/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background shadow-sm border border-border/50">
                      <ListChecks className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-semibold">{t('jobs.title')}</CardTitle>
                      <CardDescription>{total} {t('jobs.totalJobs')}</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>

              {/* Filters */}
              <div className="p-4 border-b border-border/50 bg-muted/10">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm text-muted-foreground">{t('jobs.filters')}:</Label>
                  </div>

                  <Select value={entityFilter || "all"} onValueChange={(v) => { setEntityFilter(v === "all" ? "" : v as TranslationEntityType); setPage(0); }}>
                    <SelectTrigger className="w-[140px] h-9 rounded-lg border-border/50">
                      <SelectValue placeholder={t('jobs.allEntities')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('jobs.allEntities')}</SelectItem>
                      <SelectItem value="products">{t('form.products')}</SelectItem>
                      <SelectItem value="categories">{t('form.categories')}</SelectItem>
                      <SelectItem value="properties">{t('form.properties')}</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={languageFilter || "all"} onValueChange={(v) => { setLanguageFilter(v === "all" ? "" : v as TargetLanguage); setPage(0); }}>
                    <SelectTrigger className="w-[140px] h-9 rounded-lg border-border/50">
                      <SelectValue placeholder={t('jobs.allLanguages')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('jobs.allLanguages')}</SelectItem>
                      <SelectItem value="ru">{t('languages.ru')}</SelectItem>
                      <SelectItem value="ro">{t('languages.ro')}</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={statusFilter || "all"} onValueChange={(v) => { setStatusFilter(v === "all" ? "" : v as TranslationJobStatus); setPage(0); }}>
                    <SelectTrigger className="w-[140px] h-9 rounded-lg border-border/50">
                      <SelectValue placeholder={t('jobs.allStatuses')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('jobs.allStatuses')}</SelectItem>
                      <SelectItem value="pending">{t('jobStatus.pending')}</SelectItem>
                      <SelectItem value="running">{t('jobStatus.running')}</SelectItem>
                      <SelectItem value="completed">{t('jobStatus.completed')}</SelectItem>
                      <SelectItem value="failed">{t('jobStatus.failed')}</SelectItem>
                      <SelectItem value="cancelled">{t('jobStatus.cancelled')}</SelectItem>
                    </SelectContent>
                  </Select>

                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEntityFilter("");
                        setLanguageFilter("");
                        setStatusFilter("");
                        setPage(0);
                      }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1.5" />
                      {t('jobs.clear')}
                    </Button>
                  )}
                </div>
              </div>

              <CardContent className="p-0">
                {loading && jobs.length === 0 ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">{t('jobs.loading')}</p>
                    </div>
                  </div>
                ) : jobs.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                      <ListChecks className="h-6 w-6 text-muted-foreground/30" />
                    </div>
                    <p className="text-lg font-medium text-muted-foreground mb-2">{t('jobs.noJobsFound')}</p>
                    <p className="text-sm text-muted-foreground/70 mb-4">
                      {hasActiveFilters ? t('jobs.adjustFilters') : t('jobs.startFirst')}
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => router.push("/translate")}
                      className="rounded-xl"
                    >
                      <Languages className="h-4 w-4 mr-2" />
                      {t('jobs.startTranslation')}
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {jobs.map((job) => {
                      const statusConfig = getStatusConfig(job.status);
                      const StatusIcon = statusConfig.icon;
                      const progress = job.total_items > 0
                        ? ((job.translated_items + job.failed_items + job.skipped_items) / job.total_items) * 100
                        : 0;

                      return (
                        <div
                          key={job.id}
                          className="p-4 hover:bg-muted/30 cursor-pointer transition-colors"
                          onClick={() => router.push(`/translate/jobs/${job.id}`)}
                        >
                          <div className="flex items-center gap-4">
                            {/* Status Icon */}
                            <div className={cn(
                              "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
                              statusConfig.bg
                            )}>
                              <StatusIcon className={cn(
                                "h-5 w-5",
                                statusConfig.color,
                                job.status === "running" && "animate-pulse"
                              )} />
                            </div>

                            {/* Job Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold capitalize">{job.entity_type}</span>
                                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                                <Badge variant="outline" className="font-mono text-xs px-2 py-0.5">
                                  {job.target_language.toUpperCase()}
                                </Badge>
                                {job.status === "running" && (
                                  <Badge className="bg-blue-500 text-white text-xs px-2">
                                    <Activity className="h-3 w-3 mr-1" />
                                    {t('jobs.live')}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Created {new Date(job.created_at).toLocaleString()}
                              </div>
                            </div>

                            {/* Progress */}
                            <div className="w-40 hidden md:block">
                              <div className="flex items-center justify-between text-xs mb-1.5">
                                <span className="font-medium text-emerald-600">{job.translated_items.toLocaleString()}</span>
                                <span className="text-muted-foreground">of {job.total_items.toLocaleString()}</span>
                              </div>
                              <Progress value={progress} className="h-1.5" />
                              {job.failed_items > 0 && (
                                <div className="text-xs text-red-500 mt-1 font-medium">
                                  {job.failed_items} failed
                                </div>
                              )}
                            </div>

                            {/* Duration */}
                            <div className="text-right hidden lg:block w-20">
                              <div className="font-mono text-sm font-medium">{formatDuration(job)}</div>
                              <div className="text-xs text-muted-foreground">{t('jobs.duration')}</div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2">
                              {(job.status === "running" || job.status === "pending") && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={(e) => handleCancelJob(e, job.id)}
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              )}
                              <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-4 border-t border-border/50 bg-muted/10">
                    <div className="text-sm text-muted-foreground">
                      {t('jobs.page')} <span className="font-semibold text-foreground">{page + 1}</span> of <span className="font-semibold text-foreground">{totalPages}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0}
                        className="gap-1.5 rounded-lg"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        {t('jobs.previous')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={page >= totalPages - 1}
                        className="gap-1.5 rounded-lg"
                      >
                        {t('jobs.next')}
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Tips */}
          <div
            className={cn(
              "lg:col-span-1 transition-all duration-500 ease-out",
              formSectionVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            )}
            style={{ transitionDelay: "200ms" }}
          >
            <Card className="rounded-2xl border-border/50 shadow-sm sticky top-6 overflow-hidden">
              <CardHeader className="pb-3 bg-gradient-to-r from-blue-500/5 to-blue-500/10 border-b border-blue-500/10">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                    <Info className="h-4 w-4 text-blue-600" />
                  </div>
                  <CardTitle className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                    {t('jobStatus.title')}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-3">
                  {[
                    {
                      status: "Running",
                      icon: Activity,
                      color: "text-blue-500",
                      bg: "bg-blue-500/10",
                      description: "Job is currently processing items",
                    },
                    {
                      status: "Pending",
                      icon: Clock,
                      color: "text-amber-500",
                      bg: "bg-amber-500/10",
                      description: "Job is queued and waiting to start",
                    },
                    {
                      status: "Completed",
                      icon: CheckCircle2,
                      color: "text-emerald-500",
                      bg: "bg-emerald-500/10",
                      description: "Job finished successfully",
                    },
                    {
                      status: "Failed",
                      icon: XCircle,
                      color: "text-red-500",
                      bg: "bg-red-500/10",
                      description: "Job encountered an error and stopped",
                    },
                    {
                      status: "Cancelled",
                      icon: AlertCircle,
                      color: "text-orange-500",
                      bg: "bg-orange-500/10",
                      description: "Job was manually cancelled",
                    },
                  ].map((item, index) => (
                    <div
                      key={item.status}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border/30 transition-all duration-300",
                        formSectionVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4"
                      )}
                      style={{ transitionDelay: `${300 + index * 75}ms` }}
                    >
                      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", item.bg)}>
                        <item.icon className={cn("h-4 w-4", item.color)} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground">{item.status}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Bottom Action Bar */}
        <div
          className={cn(
            "flex items-center justify-between pt-4 border-t border-border/50 transition-all duration-500 ease-out",
            formSectionVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}
          style={{ transitionDelay: "300ms" }}
        >
          <Button
            variant="ghost"
            onClick={() => router.push("/translate")}
            className="transition-all duration-200 hover:bg-muted"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('actions.backToTranslations')}
          </Button>
          <Button
            onClick={() => router.push("/translate")}
            className="gap-2 rounded-xl transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:scale-95"
          >
            <Languages className="h-4 w-4" />
            {t('actions.newTranslation')}
          </Button>
        </div>
      </div>
    </div>
  );
}
