"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Play,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Zap,
  Network,
  ArrowLeft,
  Settings,
  FileText,
  Tag,
  Layers,
  Package,
  List,
  DollarSign,
  BarChart3,
  ArrowRightLeft,
  Database,
  Timer,
  CalendarClock,
  Activity,
  Info,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { StepSelector } from "@/components/sync/step-selector";
import { FieldConfigModal } from "@/components/sync/field-config-modal";
import {
  SyncConfiguration,
  SyncStep,
  FieldConfig,
  ALL_SYNC_STEPS,
  SYNC_STEP_LABELS,
} from "@/types/selective-sync";
import { SyncProgress } from "@/types";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { handleSyncError, calculateProgress } from "@/lib/sync-utils";
import { useTranslation } from "@/contexts/language-context";

/**
 * Format duration in human-readable format
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

/**
 * Format number with null safety
 */
function formatNumber(num: number | undefined | null): string {
  if (num == null) return '0';
  return num.toLocaleString();
}

/**
 * Get step icon based on step name
 */
function getStepIcon(stepName: string) {
  const iconClass = "h-4 w-4";
  switch (stepName.toLowerCase()) {
    case "brands":
      return <Tag className={iconClass} />;
    case "categories":
      return <Layers className={iconClass} />;
    case "products":
      return <Package className={iconClass} />;
    case "properties":
      return <List className={iconClass} />;
    case "prices":
      return <DollarSign className={iconClass} />;
    case "stock":
      return <BarChart3 className={iconClass} />;
    case "exchange_rates":
      return <ArrowRightLeft className={iconClass} />;
    default:
      return <Database className={iconClass} />;
  }
}

export default function SelectiveSyncPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const configId = searchParams.get("config");
  const { t } = useTranslation('sync');
  const { t: tCommon } = useTranslation('common');

  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncLogId, setSyncLogId] = useState<string | null>(null);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const completedSyncRef = useRef<string | null>(null);

  // Animation states
  const [contentVisible, setContentVisible] = useState(false);
  const [stepsVisible, setStepsVisible] = useState(false);

  // Template Selection State
  const [templates, setTemplates] = useState<SyncConfiguration[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  // Custom Sync State
  const [selectedSteps, setSelectedSteps] = useState<SyncStep[]>([]);
  const [fieldConfigs, setFieldConfigs] = useState<Partial<Record<SyncStep, FieldConfig>>>({});
  const [hasConfiguration, setHasConfiguration] = useState<Partial<Record<SyncStep, boolean>>>({});
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  // Field Config Modal State
  const [fieldModalOpen, setFieldModalOpen] = useState(false);
  const [configuringStep, setConfiguringStep] = useState<SyncStep | null>(null);

  // Trigger animations on mount
  useEffect(() => {
    const timer1 = setTimeout(() => setContentVisible(true), 50);
    const timer2 = setTimeout(() => setStepsVisible(true), 200);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  // Memoize loader functions to prevent recreation
  const loadTemplates = useCallback(async () => {
    try {
      const response = await api.listSyncConfigurations(true, 100, 0);
      setTemplates(response.configurations);
    } catch (error) {
      handleSyncError(error, "Failed to load templates");
    }
  }, []);

  const loadConfiguration = useCallback(async (id: string) => {
    try {
      setLoadingTemplate(true);
      const config = await api.getSyncConfiguration(id);

      setSelectedTemplateId(id);
      setSelectedSteps(config.selected_steps);
      setFieldConfigs(config.field_config);

      const hasConfig: Partial<Record<SyncStep, boolean>> = {};
      ALL_SYNC_STEPS.forEach((step) => {
        hasConfig[step] = !!config.field_config[step];
      });
      setHasConfiguration(hasConfig);
    } catch (error) {
      handleSyncError(error, "Failed to load configuration");
    } finally {
      setLoadingTemplate(false);
    }
  }, []);

  const loadProgress = useCallback(async () => {
    try {
      const progressData = await api.getSyncProgress();
      setProgress(progressData);

      // Check if sync completed
      if (!progressData.isRunning && syncing && syncLogId) {
        if (progressData.syncLogId === syncLogId && completedSyncRef.current !== syncLogId) {
          console.log(`Selective sync ${syncLogId} completed, stopping polling`);
          completedSyncRef.current = syncLogId;
          setSyncing(false);
          setIsExecuting(false);
          toast.success("Sync completed successfully!");
        }
      }
    } catch (error) {
      handleSyncError(error, "Failed to load progress");
    }
  }, [syncing, syncLogId]);

  useEffect(() => {
    loadTemplates();

    // If config ID is provided, load that configuration
    if (configId) {
      loadConfiguration(configId);
    }
  }, [configId, loadTemplates, loadConfiguration]);

  // Auto-refresh progress during sync
  useEffect(() => {
    if (syncing && syncLogId && completedSyncRef.current !== syncLogId) {
      console.log(`Starting progress polling for sync ${syncLogId}`);
      const interval = setInterval(() => {
        loadProgress();
      }, 1000);

      return () => {
        console.log(`Stopping progress polling for sync ${syncLogId}`);
        clearInterval(interval);
      };
    }
  }, [syncing, syncLogId, loadProgress]);

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (templateId) {
      loadConfiguration(templateId);
    } else {
      setSelectedSteps([]);
      setFieldConfigs({});
      setHasConfiguration({});
    }
  };

  const handleConfigureStep = (step: SyncStep) => {
    setConfiguringStep(step);
    setFieldModalOpen(true);
  };

  const handleSaveFieldConfig = (config: FieldConfig) => {
    if (configuringStep) {
      setFieldConfigs({
        ...fieldConfigs,
        [configuringStep]: config,
      });
      setHasConfiguration({
        ...hasConfiguration,
        [configuringStep]: true,
      });
    }
  };

  const handleExecute = async () => {
    const callId = Math.random().toString(36).substring(7);
    const timestamp = new Date().toISOString();
    console.log(`========== handleExecute CALLED ==========`);
    console.log(`Call ID: ${callId}`);
    console.log(`Timestamp: ${timestamp}`);

    if (selectedSteps.length === 0) {
      toast.error("Please select at least one sync step");
      return;
    }

    if (isExecuting || syncing) {
      console.warn(`[${callId}] Sync already running, ignoring duplicate start request`);
      return;
    }

    try {
      setIsExecuting(true);

      console.log(`[${callId}] Checking backend for running syncs before starting...`);
      const progressCheck = await api.getSyncProgress();
      if (progressCheck.isRunning) {
        console.error(`[${callId}] Backend reports sync already running, aborting new sync request`);
        toast.error("A sync is already running. Please wait for it to complete.");
        setIsExecuting(false);
        return;
      }

      setSyncing(true);
      completedSyncRef.current = null;

      console.log(`[${callId}] Starting selective sync with steps:`, selectedSteps);
      const response = await api.executeSelectiveSync({
        selected_steps: selectedSteps,
        field_config: fieldConfigs,
        configuration_id: selectedTemplateId || undefined,
      });

      setSyncLogId(response.sync_log_id);
      console.log(`[${callId}] Sync started successfully with log ID:`, response.sync_log_id);
      toast.success("Selective sync started!");

      setTimeout(loadProgress, 1000);
    } catch (error) {
      handleSyncError(error, "Failed to start sync");
      setSyncing(false);
    } finally {
      setIsExecuting(false);
    }
  };

  // Memoize progress calculation
  const overallProgress = useMemo(() => {
    if (!progress) return 0;
    return progress.overall_progress_percentage ?? 0;
  }, [progress]);

  // Filter steps to only show selected ones
  const displaySteps = useMemo(() => {
    if (!progress || !progress.steps) return [];
    if (progress.selected_steps && progress.selected_steps.length > 0) {
      const selectedSet = new Set(progress.selected_steps);
      return progress.steps.filter(step => selectedSet.has(step.name));
    }
    return progress.steps;
  }, [progress]);

  // Grouping trigger button component
  const GroupingTriggerButton = () => {
    const [groupingLoading, setGroupingLoading] = useState(false);
    const [groupingResult, setGroupingResult] = useState<{
      total_groups: number;
      total_variants: number;
    } | null>(null);

    const handleTriggerGrouping = async () => {
      try {
        setGroupingLoading(true);
        const result = await api.triggerProductGrouping();
        setGroupingResult({
          total_groups: result.total_groups,
          total_variants: result.total_variants,
        });
        toast.success(result.message || "Product grouping completed successfully");
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to trigger product grouping";
        toast.error(errorMessage);
      } finally {
        setGroupingLoading(false);
      }
    };

    return (
      <div className="space-y-3">
        <Button
          onClick={handleTriggerGrouping}
          disabled={groupingLoading}
          className="w-full gap-2 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
        >
          {groupingLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Grouping Products...
            </>
          ) : (
            <>
              <Network className="h-4 w-4" />
              Trigger Product Grouping
            </>
          )}
        </Button>
        {groupingResult && (
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground font-medium">Groups Created</span>
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 tabular-nums">
                {formatNumber(groupingResult.total_groups)}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground font-medium">Variants Grouped</span>
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 tabular-nums">
                {formatNumber(groupingResult.total_variants)}
              </Badge>
            </div>
          </div>
        )}
      </div>
    );
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
            <h1 className="text-3xl font-bold tracking-tight">{t('page.selectiveTitle')}</h1>
            <p className="text-muted-foreground">
              {t('page.selectiveDescription')}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            asChild
            className="transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
          >
            <Link href="/sync/configs">
              <Settings className="h-4 w-4 mr-2" />
              {t('actions.manageConfigs')}
            </Link>
          </Button>
          {syncLogId && (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
            >
              <Link href={`/sync/changes?log=${syncLogId}`}>
                <FileText className="h-4 w-4 mr-2" />
                {t('actions.viewChanges')}
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Sync Progress Card - When syncing */}
      {syncing && progress ? (
        <div
          className={`
            transition-all duration-300 ease-out
            ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
          `}
          style={{ transitionDelay: "100ms" }}
        >
          <Card className="rounded-xl border border-blue-500/30 bg-gradient-to-br from-blue-500/5 to-blue-500/10 shadow-lg shadow-blue-500/10 overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" />
                    <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10 ring-2 ring-blue-500/30 shadow-lg shadow-blue-500/20">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                    </div>
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold">Sync in Progress</CardTitle>
                    <CardDescription className="mt-0.5 text-sm">
                      {progress.steps.find((s) => s.status === "running")?.name || "Processing..."}
                    </CardDescription>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="text-blue-600 border-blue-500/30 bg-blue-500/10 font-semibold px-3 py-1.5 shadow-sm tabular-nums"
                >
                  <Zap className="h-3.5 w-3.5 mr-1.5" />
                  {Math.round(overallProgress)}%
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              {/* Overall Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground font-medium">Overall Progress</span>
                  <span className="font-semibold tabular-nums text-blue-600">
                    {Math.round(overallProgress)}%
                  </span>
                </div>
                <Progress value={overallProgress} className="h-2.5 bg-blue-500/10 shadow-inner" />
              </div>

              {/* Step-by-Step Progress */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-muted">
                    <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  Step Progress
                </h4>
                <div className="space-y-2">
                  {displaySteps.map((step, index) => {
                    const stepProgress = step.total > 0 ? (step.count / step.total) * 100 : 0;
                    const isRunning = step.status === "running";

                    return (
                      <div
                        key={step.number}
                        className={`
                          group rounded-xl border p-4 transition-all duration-300
                          ${stepsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
                          ${step.status === "running"
                            ? "border-blue-500/30 bg-blue-500/5 shadow-md"
                            : step.status === "completed"
                              ? "border-primary/20 bg-primary/5"
                              : step.status === "failed"
                                ? "border-destructive/20 bg-destructive/5"
                                : "border-border/50 bg-card/30"
                          }
                        `}
                        style={{
                          transitionDelay: stepsVisible ? `${index * 50}ms` : "0ms",
                        }}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-all duration-200 shadow-sm ${
                              step.status === "completed"
                                ? "bg-primary/10 text-primary shadow-primary/20"
                                : step.status === "running"
                                  ? "bg-blue-500/10 text-blue-600 shadow-blue-500/20"
                                  : step.status === "failed"
                                    ? "bg-destructive/10 text-destructive shadow-destructive/20"
                                    : "bg-muted text-muted-foreground"
                            }`}>
                              {step.status === "completed" && <CheckCircle2 className="h-5 w-5" />}
                              {step.status === "running" && <Loader2 className="h-5 w-5 animate-spin" />}
                              {step.status === "pending" && <Clock className="h-5 w-5" />}
                              {step.status === "failed" && <AlertCircle className="h-5 w-5" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-sm truncate">{step.name}</p>
                              {isRunning && step.total > 0 && (
                                <div className="mt-2">
                                  <div className="flex items-center gap-2 text-xs text-blue-600 font-medium">
                                    <span>
                                      {formatNumber(step.count)} / {formatNumber(step.total)} items
                                    </span>
                                    <span className="text-muted-foreground">
                                      ({Math.round(stepProgress)}%)
                                    </span>
                                  </div>
                                  <Progress
                                    value={stepProgress}
                                    className="h-1.5 mt-1.5 bg-blue-500/10 shadow-inner"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {step.extracted > 0 && (
                              <Badge variant="outline" className="text-xs gap-1 tabular-nums">
                                {formatNumber(step.extracted)} extracted
                              </Badge>
                            )}
                            {step.inserted > 0 && (
                              <Badge variant="secondary" className="text-xs gap-1 bg-primary/10 text-primary border-primary/20 tabular-nums">
                                +{formatNumber(step.inserted)}
                              </Badge>
                            )}
                            {step.updated > 0 && (
                              <Badge variant="outline" className="text-xs gap-1 tabular-nums">
                                {formatNumber(step.updated)} upd
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Time Information */}
              <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-border/30 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Timer className="h-4 w-4" />
                  <span className="font-medium">Elapsed:</span>
                  <span className="tabular-nums">{formatDuration(progress.elapsedSeconds ?? 0)}</span>
                </div>
                {progress.estimatedRemainingSeconds && progress.estimatedRemainingSeconds > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    <span className="font-medium">Est. remaining:</span>
                    <span className="tabular-nums">{formatDuration(progress.estimatedRemainingSeconds)}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Sync Configuration Tabs */
        <div
          className={`
            transition-all duration-300 ease-out
            ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
          `}
          style={{ transitionDelay: "100ms" }}
        >
          <Tabs defaultValue="template" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 h-12 p-1 bg-muted/50 rounded-xl">
              <TabsTrigger
                value="template"
                className="rounded-lg transition-all duration-200 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Zap className="h-4 w-4 mr-2" />
                Quick Sync (Template)
              </TabsTrigger>
              <TabsTrigger
                value="custom"
                className="rounded-lg transition-all duration-200 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Settings className="h-4 w-4 mr-2" />
                Custom Sync
              </TabsTrigger>
            </TabsList>

            {/* Template-Based Sync */}
            <TabsContent value="template" className="space-y-6">
              <Card className="rounded-xl border bg-card shadow-sm overflow-hidden">
                <CardHeader className="pb-3 bg-muted/30 border-b">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-background shadow-sm">
                      <Zap className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-semibold">Select Template</CardTitle>
                      <CardDescription className="text-sm">
                        Choose a pre-configured template for quick sync execution
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-5 space-y-5">
                  <Select value={selectedTemplateId} onValueChange={handleTemplateChange} disabled={loadingTemplate}>
                    <SelectTrigger className="h-12 rounded-xl">
                      <SelectValue placeholder={loadingTemplate ? "Loading..." : "Select a template..."} />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {templates.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          No templates found.{" "}
                          <Link href="/sync/configs" className="text-primary hover:underline">
                            Create one
                          </Link>
                        </div>
                      ) : (
                        templates.map((template) => (
                          <SelectItem key={template.id} value={template.id} className="rounded-lg">
                            <div className="py-1">
                              <p className="font-medium">{template.name}</p>
                              {template.description && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {template.description}
                                </p>
                              )}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>

                  {selectedTemplateId && selectedSteps.length > 0 && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                      <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Selected Steps ({selectedSteps.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {selectedSteps.map((step, index) => (
                          <Badge
                            key={step}
                            variant="secondary"
                            className="gap-1.5 px-3 py-1.5 transition-all duration-200 hover:shadow-sm"
                            style={{
                              animationDelay: `${index * 50}ms`,
                            }}
                          >
                            {getStepIcon(step)}
                            {SYNC_STEP_LABELS[step]}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handleExecute}
                    disabled={!selectedTemplateId || loading || syncing || loadingTemplate || isExecuting}
                    className="w-full h-12 gap-2 text-base transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
                  >
                    {syncing || isExecuting ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Starting Sync...
                      </>
                    ) : (
                      <>
                        <Play className="h-5 w-5" />
                        Execute Sync
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Custom Sync */}
            <TabsContent value="custom" className="space-y-6">
              <StepSelector
                selectedSteps={selectedSteps}
                onStepsChange={setSelectedSteps}
                onConfigure={handleConfigureStep}
                hasConfiguration={hasConfiguration}
                onExecute={handleExecute}
                isRunning={syncing}
              />

              {selectedSteps.length > 0 && (
                <Alert className="rounded-xl border-blue-500/20 bg-blue-500/5">
                  <Info className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-sm text-blue-800 dark:text-blue-200">
                    Configure field-level settings for each step by clicking the &quot;Configure&quot; button.
                    Steps without configuration will sync all fields by default.
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Post-Processing Operations */}
      {!syncing && !loading && (
        <div
          className={`
            transition-all duration-300 ease-out
            ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
          `}
          style={{ transitionDelay: "200ms" }}
        >
          <Card className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <CardHeader className="pb-3 bg-muted/30 border-b">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-background shadow-sm">
                  <Network className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold">Post-Processing Operations</CardTitle>
                  <CardDescription className="text-sm">
                    Run post-processing operations after sync completion
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-5 space-y-4">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  Product Variant Grouping
                </h3>
                <p className="text-sm text-muted-foreground">
                  Auto-link related products (e.g., storage variants) via parent-child relationships
                </p>
              </div>
              <GroupingTriggerButton />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      {!syncing && (
        <div
          className={`
            transition-all duration-300 ease-out
            ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
          `}
          style={{ transitionDelay: "250ms" }}
        >
          <Card className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <CardHeader className="pb-3 bg-muted/30 border-b">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-background shadow-sm">
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
                  <CardDescription className="text-sm">
                    Navigate to related sync features
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 pb-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  {
                    href: "/sync/monitor",
                    icon: Activity,
                    title: "Real-Time Monitor",
                    description: "View live sync progress",
                  },
                  {
                    href: "/sync/configs",
                    icon: Settings,
                    title: "Configurations",
                    description: "Manage sync templates",
                  },
                  {
                    href: "/sync/changes",
                    icon: FileText,
                    title: "Change History",
                    description: "Review sync changes",
                  },
                ].map(({ href, icon: Icon, title, description }, index) => (
                  <Link
                    key={href}
                    href={href}
                    className={`
                      group flex items-center gap-3 p-4 rounded-xl border bg-card/50
                      transition-all duration-200 hover:shadow-md hover:border-border hover:-translate-y-0.5
                      ${stepsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
                    `}
                    style={{
                      transitionDelay: stepsVisible ? `${300 + index * 50}ms` : "0ms",
                    }}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted transition-colors group-hover:bg-muted/80">
                      <Icon className="h-5 w-5 text-muted-foreground transition-transform group-hover:scale-110" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm group-hover:text-primary transition-colors">
                        {title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {description}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Field Config Modal */}
      {configuringStep && (
        <FieldConfigModal
          open={fieldModalOpen}
          onOpenChange={setFieldModalOpen}
          step={configuringStep}
          currentConfig={fieldConfigs[configuringStep]}
          onSave={handleSaveFieldConfig}
        />
      )}
    </div>
  );
}
