"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Languages,
  Package,
  FolderTree,
  Database,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  Info,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import {
  TranslationStats,
  TranslationJob,
  TranslationEntityType,
  TargetLanguage,
  TranslationLog,
} from "@/types";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/contexts/language-context";

// Entity type options
const entityOptions = [
  {
    value: "products",
    label: "Products",
    icon: Package,
    description: "Names & descriptions",
  },
  {
    value: "categories",
    label: "Categories",
    icon: FolderTree,
    description: "Category names",
  },
  {
    value: "properties",
    label: "Properties",
    icon: Database,
    description: "Groups & names",
  },
];

// Language options
const languageOptions = [
  {
    value: "ru",
    label: "Russian",
    flag: "RU",
    nativeName: "Русский",
  },
  {
    value: "ro",
    label: "Romanian",
    flag: "RO",
    nativeName: "Română",
  },
];

export default function TranslatePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useTranslation('translate');
  const { t: tCommon } = useTranslation('common');

  // State
  const [stats, setStats] = useState<TranslationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEntity, setSelectedEntity] = useState<TranslationEntityType>("products");
  const [selectedLanguage, setSelectedLanguage] = useState<TargetLanguage>("ru");
  const [startingJob, setStartingJob] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [activeJob, setActiveJob] = useState<TranslationJob | null>(null);
  const [recentLogs, setRecentLogs] = useState<TranslationLog[]>([]);
  const [recentJobs, setRecentJobs] = useState<TranslationJob[]>([]);
  const [contentVisible, setContentVisible] = useState(false);
  const [formSectionVisible, setFormSectionVisible] = useState(false);

  // Trigger staggered entrance animations
  useEffect(() => {
    const timer1 = setTimeout(() => setContentVisible(true), 50);
    const timer2 = setTimeout(() => setFormSectionVisible(true), 150);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  // Load stats
  const loadStats = useCallback(async () => {
    try {
      const data = await api.getTranslationStats();
      setStats(data);
    } catch (error) {
      console.error("Failed to load stats:", error);
      toast({
        title: "Error",
        description: "Failed to load translation statistics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Load recent jobs
  const loadRecentJobs = useCallback(async () => {
    try {
      const { data } = await api.getTranslationJobs(5, 0);
      setRecentJobs(data);

      // Check if there's an active job
      const running = data.find(j => j.status === "running" || j.status === "pending");
      if (running) {
        setActiveJob(running);
      }
    } catch (error) {
      console.error("Failed to load recent jobs:", error);
    }
  }, []);

  // Load initial data
  useEffect(() => {
    loadStats();
    loadRecentJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // SSE for active job progress
  useEffect(() => {
    if (!activeJob) return;

    const eventSource = api.createTranslationProgressStream(activeJob.id);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setActiveJob(prev => prev ? { ...prev, ...data } : data);

        if (data.status === "completed" || data.status === "failed" || data.status === "cancelled") {
          eventSource.close();
          loadStats();
          loadRecentJobs();

          toast({
            title: data.status === "completed" ? "Translation Complete" : "Translation Stopped",
            description: `Job ${data.status}. Translated ${data.translated_items || 0} items.`,
            variant: data.status === "completed" ? "default" : "destructive",
          });
        }
      } catch (e) {
        console.error("Error parsing SSE data:", e);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [activeJob?.id, loadStats, loadRecentJobs, toast]);

  // Load logs for active job
  useEffect(() => {
    if (!activeJob) return;

    const loadLogs = async () => {
      try {
        const { data } = await api.getTranslationLogs(activeJob.id, 10, 0);
        setRecentLogs(data);
      } catch (error) {
        console.error("Failed to load logs:", error);
      }
    };

    loadLogs();
    const interval = setInterval(loadLogs, 2000);
    return () => clearInterval(interval);
  }, [activeJob?.id]);

  // Start translation
  const handleStartTranslation = async () => {
    setConfirmDialogOpen(false);
    setStartingJob(true);

    try {
      const job = await api.startTranslation(selectedEntity, selectedLanguage);
      setActiveJob(job);
      toast({
        title: "Translation Started",
        description: `Started translating ${selectedEntity} to ${selectedLanguage === "ru" ? "Russian" : "Romanian"}`,
      });
    } catch (error) {
      console.error("Failed to start translation:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start translation",
        variant: "destructive",
      });
    } finally {
      setStartingJob(false);
    }
  };

  // Cancel job
  const handleCancelJob = async () => {
    if (!activeJob) return;

    try {
      await api.cancelTranslationJob(activeJob.id);
      setActiveJob(null);
      loadStats();
      loadRecentJobs();
      toast({
        title: "Job Cancelled",
        description: "Translation job has been cancelled",
      });
    } catch (error) {
      console.error("Failed to cancel job:", error);
      toast({
        title: "Error",
        description: "Failed to cancel job",
        variant: "destructive",
      });
    }
  };

  // Get pending count for selected entity/language
  const getPendingCount = () => {
    if (!stats) return 0;

    if (selectedEntity === "products") {
      return selectedLanguage === "ru" ? stats.products.pending_ru : stats.products.pending_ro;
    } else if (selectedEntity === "categories") {
      return selectedLanguage === "ru" ? stats.categories.pending_ru : stats.categories.pending_ro;
    } else {
      const groupsPending = selectedLanguage === "ru" ? stats.properties.groups_pending_ru : stats.properties.groups_pending_ro;
      const namesPending = selectedLanguage === "ru" ? stats.properties.names_pending_ru : stats.properties.names_pending_ro;
      return groupsPending + namesPending;
    }
  };

  // Calculate translation progress percentage
  const getTranslationProgress = (translated: number, total: number) => {
    if (total === 0) return 100;
    return Math.round((translated / total) * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading translation data...</p>
        </div>
      </div>
    );
  }

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
          <span className="text-foreground font-medium">{t('breadcrumb.translations')}</span>
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
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border shadow-lg bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border-primary/20">
                <Languages className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{t('page.title')}</h1>
                <p className="text-sm text-muted-foreground">
                  {t('page.description')}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => { loadStats(); loadRecentJobs(); }}
              disabled={loading}
              className="gap-2 transition-all duration-200 hover:bg-muted"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              {t('actions.refresh')}
            </Button>
            <Button
              onClick={() => router.push("/translate/jobs")}
              variant="outline"
              className="gap-2 transition-all duration-200 hover:bg-muted"
            >
              {t('actions.viewAllJobs')}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div
            className={cn(
              "grid gap-4 md:grid-cols-3 transition-all duration-500 ease-out",
              formSectionVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            )}
            style={{ transitionDelay: "50ms" }}
          >
            {/* Products Stats */}
            <Card className="rounded-2xl border-border/50 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Products</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Package className="h-4 w-4 text-blue-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.products.total.toLocaleString()}</div>
                <div className="flex gap-4 mt-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Russian</span>
                      <span className="font-mono">{getTranslationProgress(stats.products.translated_ru, stats.products.total)}%</span>
                    </div>
                    <Progress
                      value={getTranslationProgress(stats.products.translated_ru, stats.products.total)}
                      className="h-1.5"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Romanian</span>
                      <span className="font-mono">{getTranslationProgress(stats.products.translated_ro, stats.products.total)}%</span>
                    </div>
                    <Progress
                      value={getTranslationProgress(stats.products.translated_ro, stats.products.total)}
                      className="h-1.5"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Categories Stats */}
            <Card className="rounded-2xl border-border/50 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Categories</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <FolderTree className="h-4 w-4 text-amber-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.categories.total.toLocaleString()}</div>
                <div className="flex gap-4 mt-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Russian</span>
                      <span className="font-mono">{getTranslationProgress(stats.categories.translated_ru, stats.categories.total)}%</span>
                    </div>
                    <Progress
                      value={getTranslationProgress(stats.categories.translated_ru, stats.categories.total)}
                      className="h-1.5"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Romanian</span>
                      <span className="font-mono">{getTranslationProgress(stats.categories.translated_ro, stats.categories.total)}%</span>
                    </div>
                    <Progress
                      value={getTranslationProgress(stats.categories.translated_ro, stats.categories.total)}
                      className="h-1.5"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Properties Stats */}
            <Card className="rounded-2xl border-border/50 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Properties</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Database className="h-4 w-4 text-purple-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(stats.properties.total_groups + stats.properties.total_names).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  {stats.properties.total_groups} groups, {stats.properties.total_names} names
                </p>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Russian</span>
                      <span className="font-mono">
                        {getTranslationProgress(
                          stats.properties.groups_translated_ru + stats.properties.names_translated_ru,
                          stats.properties.total_groups + stats.properties.total_names
                        )}%
                      </span>
                    </div>
                    <Progress
                      value={getTranslationProgress(
                        stats.properties.groups_translated_ru + stats.properties.names_translated_ru,
                        stats.properties.total_groups + stats.properties.total_names
                      )}
                      className="h-1.5"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Romanian</span>
                      <span className="font-mono">
                        {getTranslationProgress(
                          stats.properties.groups_translated_ro + stats.properties.names_translated_ro,
                          stats.properties.total_groups + stats.properties.total_names
                        )}%
                      </span>
                    </div>
                    <Progress
                      value={getTranslationProgress(
                        stats.properties.groups_translated_ro + stats.properties.names_translated_ro,
                        stats.properties.total_groups + stats.properties.total_names
                      )}
                      className="h-1.5"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Start Translation Card */}
          <div
            className={cn(
              "lg:col-span-2 transition-all duration-500 ease-out",
              formSectionVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            )}
            style={{ transitionDelay: "100ms" }}
          >
            <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
              <CardHeader className="pb-4 bg-gradient-to-r from-muted/30 to-muted/10 border-b border-border/50">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background shadow-sm border border-border/50">
                    <Languages className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold">{t('form.startTranslation')}</CardTitle>
                    <CardDescription>{t('form.configureAndLaunch')}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-8">
                {/* Entity Type Selection */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm font-semibold">{t('form.entityType')}</Label>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {entityOptions.map((opt) => {
                      const isSelected = selectedEntity === opt.value;
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => !activeJob && setSelectedEntity(opt.value as TranslationEntityType)}
                          disabled={!!activeJob}
                          className={cn(
                            "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200",
                            "disabled:opacity-50 disabled:cursor-not-allowed",
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "border-border/50 hover:border-border hover:bg-muted/30"
                          )}
                        >
                          <div className={cn(
                            "h-10 w-10 rounded-xl flex items-center justify-center transition-colors",
                            isSelected ? "bg-primary/10" : "bg-muted/50"
                          )}>
                            <Icon className={cn(
                              "h-5 w-5",
                              isSelected ? "text-primary" : "text-muted-foreground"
                            )} />
                          </div>
                          <div className="text-center">
                            <div className={cn(
                              "font-semibold text-sm",
                              isSelected ? "text-foreground" : "text-muted-foreground"
                            )}>
                              {opt.label}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {opt.description}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Separator className="bg-border/50" />

                {/* Language Selection */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Languages className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm font-semibold">{t('form.targetLanguage')}</Label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {languageOptions.map((opt) => {
                      const isSelected = selectedLanguage === opt.value;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => !activeJob && setSelectedLanguage(opt.value as TargetLanguage)}
                          disabled={!!activeJob}
                          className={cn(
                            "flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200",
                            "disabled:opacity-50 disabled:cursor-not-allowed",
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "border-border/50 hover:border-border hover:bg-muted/30"
                          )}
                        >
                          <div className={cn(
                            "h-10 w-10 rounded-lg flex items-center justify-center font-bold text-sm transition-colors",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          )}>
                            {opt.flag}
                          </div>
                          <div className="text-left flex-1">
                            <div className={cn(
                              "font-semibold",
                              isSelected ? "text-foreground" : "text-muted-foreground"
                            )}>
                              {opt.label}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {opt.nativeName}
                            </div>
                          </div>
                          <div className={cn(
                            "h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all",
                            isSelected ? "border-primary bg-primary" : "border-muted-foreground/30"
                          )}>
                            {isSelected && (
                              <div className="h-2 w-2 rounded-full bg-white" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Separator className="bg-border/50" />

                {/* Items Summary */}
                <div className={cn(
                  "flex items-center justify-between p-5 rounded-xl border-2 transition-all duration-300",
                  getPendingCount() > 0
                    ? "border-primary/20 bg-primary/5"
                    : "border-border/50 bg-muted/30"
                )}>
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-xl",
                      getPendingCount() > 0 ? "bg-primary/10" : "bg-muted"
                    )}>
                      {getPendingCount() > 0 ? (
                        <Languages className="h-6 w-6 text-primary" />
                      ) : (
                        <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <Label className="text-base font-semibold">
                        {getPendingCount() > 0 ? t('form.itemsPending') : t('form.allTranslated')}
                      </Label>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {selectedEntity} {t('form.to')} {selectedLanguage === "ru" ? t('languages.ru') : t('languages.ro')}
                      </p>
                    </div>
                  </div>
                  <div className={cn(
                    "px-4 py-2 rounded-xl font-mono text-2xl font-bold",
                    getPendingCount() > 0
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {getPendingCount().toLocaleString()}
                  </div>
                </div>

                {/* Start Button */}
                <Button
                  onClick={() => setConfirmDialogOpen(true)}
                  disabled={startingJob || !!activeJob || getPendingCount() === 0}
                  className="w-full h-12 text-base rounded-xl transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  {startingJob ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      {t('actions.startingTranslation')}
                    </>
                  ) : activeJob ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      {t('actions.translationInProgress')}
                    </>
                  ) : getPendingCount() === 0 ? (
                    <>
                      <CheckCircle2 className="mr-2 h-5 w-5" />
                      {t('actions.allItemsTranslated')}
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-5 w-5" />
                      {t('actions.startTranslation')}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Active Job / Tips */}
          <div
            className={cn(
              "lg:col-span-1 space-y-6 transition-all duration-500 ease-out",
              formSectionVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            )}
            style={{ transitionDelay: "200ms" }}
          >
            {/* Active Job Card */}
            {activeJob && (
              <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
                <CardHeader className="pb-3 bg-gradient-to-r from-blue-500/5 to-blue-500/10 border-b border-blue-500/10">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                      <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                    </div>
                    <CardTitle className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                      Active Job
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Badge variant="secondary" className="mb-2">
                        {activeJob.status}
                      </Badge>
                      <p className="text-sm font-medium capitalize">{activeJob.entity_type}</p>
                      <p className="text-xs text-muted-foreground">
                        to {activeJob.target_language === "ru" ? "Russian" : "Romanian"}
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleCancelJob}
                    >
                      Cancel
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span className="font-mono font-medium">
                        {activeJob.translated_items}/{activeJob.total_items}
                      </span>
                    </div>
                    <Progress
                      value={activeJob.total_items > 0 ? (activeJob.translated_items / activeJob.total_items) * 100 : 0}
                      className="h-2"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded-lg bg-emerald-500/10">
                      <div className="text-lg font-bold text-emerald-600">{activeJob.translated_items}</div>
                      <div className="text-[10px] text-muted-foreground">Translated</div>
                    </div>
                    <div className="p-2 rounded-lg bg-red-500/10">
                      <div className="text-lg font-bold text-red-600">{activeJob.failed_items}</div>
                      <div className="text-[10px] text-muted-foreground">Failed</div>
                    </div>
                    <div className="p-2 rounded-lg bg-amber-500/10">
                      <div className="text-lg font-bold text-amber-600">{activeJob.skipped_items}</div>
                      <div className="text-[10px] text-muted-foreground">Skipped</div>
                    </div>
                  </div>

                  {/* Recent Logs */}
                  {recentLogs.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground">Recent Activity</p>
                      <div className="max-h-[120px] overflow-y-auto space-y-1.5">
                        {recentLogs.slice(0, 5).map((log) => (
                          <div
                            key={log.id}
                            className={cn(
                              "text-xs p-2 rounded-lg border",
                              log.status === "success"
                                ? "bg-emerald-500/5 border-emerald-500/20"
                                : log.status === "failed"
                                ? "bg-red-500/5 border-red-500/20"
                                : "bg-amber-500/5 border-amber-500/20"
                            )}
                          >
                            <div className="flex items-center gap-1.5">
                              {log.status === "success" ? (
                                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                              ) : log.status === "failed" ? (
                                <XCircle className="h-3 w-3 text-red-500" />
                              ) : (
                                <Clock className="h-3 w-3 text-amber-500" />
                              )}
                              <span className="font-mono truncate">{log.field_name}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Tips Card */}
            <Card className="rounded-2xl border-border/50 shadow-sm sticky top-6 overflow-hidden">
              <CardHeader className="pb-3 bg-gradient-to-r from-blue-500/5 to-blue-500/10 border-b border-blue-500/10">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                    <Info className="h-4 w-4 text-blue-600" />
                  </div>
                  <CardTitle className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                    Tips & Guidelines
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-3">
                  {[
                    {
                      title: "Entity Selection",
                      description: "Choose what type of content to translate",
                    },
                    {
                      title: "Language Target",
                      description: "Select Russian or Romanian as the target language",
                    },
                    {
                      title: "Batch Processing",
                      description: "Items are translated in batches for efficiency",
                    },
                    {
                      title: "Progress Tracking",
                      description: "Monitor progress in real-time during translation",
                    },
                  ].map((tip, index) => (
                    <div
                      key={tip.title}
                      className={cn(
                        "p-3 rounded-xl bg-muted/30 border border-border/30 transition-all duration-300",
                        formSectionVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4"
                      )}
                      style={{ transitionDelay: `${300 + index * 75}ms` }}
                    >
                      <p className="text-xs font-semibold text-foreground">{tip.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{tip.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Recent Jobs */}
        <div
          className={cn(
            "transition-all duration-500 ease-out",
            formSectionVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          )}
          style={{ transitionDelay: "250ms" }}
        >
          <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
            <CardHeader className="pb-4 bg-gradient-to-r from-muted/30 to-muted/10 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background shadow-sm border border-border/50">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold">Recent Jobs</CardTitle>
                    <CardDescription>Last 5 translation jobs</CardDescription>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/translate/jobs")}
                  className="gap-2"
                >
                  View All
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {recentJobs.length === 0 ? (
                <div className="text-center py-12">
                  <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                    <Clock className="h-6 w-6 text-muted-foreground/30" />
                  </div>
                  <p className="text-muted-foreground">No translation jobs yet</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {recentJobs.map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between p-4 hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => router.push(`/translate/jobs/${job.id}`)}
                    >
                      <div className="flex items-center gap-4">
                        <Badge
                          variant={
                            job.status === "completed"
                              ? "default"
                              : job.status === "running"
                              ? "secondary"
                              : job.status === "failed"
                              ? "destructive"
                              : "outline"
                          }
                          className={cn(
                            "px-3 py-1",
                            job.status === "completed" && "bg-emerald-500",
                            job.status === "running" && "animate-pulse"
                          )}
                        >
                          {job.status}
                        </Badge>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium capitalize">{job.entity_type}</span>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                              {job.target_language.toUpperCase()}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {job.translated_items}/{job.total_items} items
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm">
                          {job.created_at && new Date(job.created_at).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {job.created_at && new Date(job.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
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
            onClick={() => router.back()}
            className="transition-all duration-200 hover:bg-muted"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button
            onClick={() => router.push("/translate/jobs")}
            variant="outline"
            className="gap-2 transition-all duration-200 hover:bg-muted"
          >
            View All Jobs
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold">Start Translation Job?</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              This will translate{" "}
              <span className="font-bold text-primary">{getPendingCount().toLocaleString()}</span>{" "}
              <span className="font-semibold capitalize">{selectedEntity}</span> to{" "}
              <span className="font-semibold">
                {selectedLanguage === "ru" ? "Russian" : "Romanian"}
              </span>.
              <span className="block mt-2 text-sm text-muted-foreground">
                Duration depends on the number of items to process.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleStartTranslation}
              className="rounded-xl"
            >
              <Play className="h-4 w-4 mr-2" />
              Start Translation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
