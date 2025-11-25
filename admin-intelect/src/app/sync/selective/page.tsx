"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

export default function SelectiveSyncPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const configId = searchParams.get("config");

  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncLogId, setSyncLogId] = useState<string | null>(null);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [isExecuting, setIsExecuting] = useState(false); // Prevent duplicate sync starts
  const completedSyncRef = useRef<string | null>(null); // Track completed sync to prevent re-polling

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

      // Check if sync completed - only if we have an active syncLogId
      // This prevents spurious completion detection from other syncs
      if (!progressData.isRunning && syncing && syncLogId) {
        // Verify this is OUR sync that completed by checking the sync log ID
        // AND that we haven't already marked it as completed
        if (progressData.syncLogId === syncLogId && completedSyncRef.current !== syncLogId) {
          console.log(`Selective sync ${syncLogId} completed, stopping polling`);
          completedSyncRef.current = syncLogId; // Mark as completed
          setSyncing(false);
          setIsExecuting(false);
          toast.success("Sync completed successfully!");
        }
      }
    } catch (error) {
      handleSyncError(error, "Failed to load progress");
    }
  }, [syncing, syncLogId]); // Include syncLogId to verify completion

  useEffect(() => {
    loadTemplates();

    // If config ID is provided, load that configuration
    if (configId) {
      loadConfiguration(configId);
    }
  }, [configId, loadTemplates, loadConfiguration]);

  // Auto-refresh progress during sync
  useEffect(() => {
    // Only poll if sync is active AND we haven't marked it as completed
    if (syncing && syncLogId && completedSyncRef.current !== syncLogId) {
      console.log(`Starting progress polling for sync ${syncLogId}`);
      const interval = setInterval(() => {
        loadProgress();
      }, 1000); // Refresh every second

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
      // Clear selection
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
    // DEBUG: Generate unique call ID and log stack trace
    const callId = Math.random().toString(36).substring(7);
    const timestamp = new Date().toISOString();
    console.log(`========== handleExecute CALLED ==========`);
    console.log(`Call ID: ${callId}`);
    console.log(`Timestamp: ${timestamp}`);
    console.log(`Stack trace:`, new Error().stack);
    console.log(`State: syncing=${syncing}, isExecuting=${isExecuting}`);
    console.log(`==========================================`);

    if (selectedSteps.length === 0) {
      toast.error("Please select at least one sync step");
      return;
    }

    // Prevent duplicate sync starts
    if (isExecuting || syncing) {
      console.warn(`[${callId}] Sync already running (state check), ignoring duplicate start request`);
      return;
    }

    try {
      setIsExecuting(true);

      // CRITICAL: Check backend state before starting sync to prevent race conditions
      console.log(`[${callId}] Checking backend for running syncs before starting...`);
      const progressCheck = await api.getSyncProgress();
      if (progressCheck.isRunning) {
        console.error(`[${callId}] Backend reports sync already running, aborting new sync request`);
        toast.error("A sync is already running. Please wait for it to complete.");
        setIsExecuting(false);
        return;
      }

      setSyncing(true);
      completedSyncRef.current = null; // Reset completion tracker for new sync

      console.log(`[${callId}] Backend confirmed no running syncs. Starting selective sync with steps:`, selectedSteps);
      const response = await api.executeSelectiveSync({
        selected_steps: selectedSteps,
        field_config: fieldConfigs,
        configuration_id: selectedTemplateId || undefined,
      });

      setSyncLogId(response.sync_log_id);
      console.log(`[${callId}] Sync started successfully with log ID:`, response.sync_log_id);
      toast.success("Selective sync started!");

      // Start monitoring progress
      setTimeout(loadProgress, 1000);
    } catch (error) {
      handleSyncError(error, "Failed to start sync");
      setSyncing(false);
    } finally {
      setIsExecuting(false);
    }
  };

  // Memoize progress calculation - use backend-calculated progress
  const overallProgress = useMemo(() => {
    if (!progress) return 0;
    // Use the backend-calculated overall_progress_percentage
    return progress.overall_progress_percentage || 0;
  }, [progress]);

  // Filter steps to only show selected ones
  const displaySteps = useMemo(() => {
    if (!progress || !progress.steps) return [];
    // If sync has selected_steps array, filter to show only those
    if (progress.selected_steps && progress.selected_steps.length > 0) {
      const selectedSet = new Set(progress.selected_steps);
      return progress.steps.filter(step => selectedSet.has(step.name));
    }
    // Otherwise show all steps
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
      } catch (error: any) {
        toast.error(error.message || "Failed to trigger product grouping");
      } finally {
        setGroupingLoading(false);
      }
    };

    return (
      <div className="space-y-2">
        <Button
          onClick={handleTriggerGrouping}
          disabled={groupingLoading}
          className="w-full gap-2"
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
          <div className="text-sm space-y-1 p-3 bg-muted rounded-md">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Groups Created:</span>
              <Badge variant="secondary">{groupingResult.total_groups}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Variants Grouped:</span>
              <Badge variant="secondary">{groupingResult.total_variants}</Badge>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Selective Sync</h1>
          <p className="text-muted-foreground">
            Execute granular sync operations with custom field configurations
          </p>
        </div>
        {syncLogId && (
          <Button
            variant="outline"
            onClick={() => router.push(`/sync/changes?log=${syncLogId}`)}
          >
            View Changes
          </Button>
        )}
      </div>

      {syncing && progress ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              Sync in Progress
            </CardTitle>
            <CardDescription>
              {progress.steps.find((s) => s.status === "running")?.name || "Processing..."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Overall Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Overall Progress</span>
                <span className="text-muted-foreground">{Math.round(overallProgress)}%</span>
              </div>
              <Progress value={overallProgress} className="h-2" />
            </div>

            {/* Step-by-Step Progress */}
            <div className="space-y-3">
              {displaySteps.map((step) => (
                <div key={step.number} className="flex items-center gap-3 p-3 rounded-lg border">
                  <div>
                    {step.status === "completed" && (
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    )}
                    {step.status === "running" && (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    )}
                    {step.status === "pending" && (
                      <Clock className="h-5 w-5 text-muted-foreground" />
                    )}
                    {step.status === "failed" && (
                      <AlertCircle className="h-5 w-5 text-destructive" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{step.name}</span>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {step.extracted > 0 && (
                          <Badge variant="outline" className="gap-1">
                            {step.extracted.toLocaleString()} extracted
                          </Badge>
                        )}
                        {step.inserted > 0 && (
                          <Badge variant="secondary" className="gap-1">
                            +{step.inserted.toLocaleString()} added
                          </Badge>
                        )}
                        {step.updated > 0 && (
                          <Badge variant="outline" className="gap-1">
                            {step.updated.toLocaleString()} updated
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Time Information */}
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>Elapsed: {progress.elapsedSeconds}s</span>
              </div>
              {progress.estimatedRemainingSeconds && (
                <div className="flex items-center gap-1">
                  <Zap className="h-4 w-4" />
                  <span>Est. remaining: {progress.estimatedRemainingSeconds}s</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="template" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="template">Quick Sync (Template)</TabsTrigger>
            <TabsTrigger value="custom">Custom Sync</TabsTrigger>
          </TabsList>

          {/* Template-Based Sync */}
          <TabsContent value="template" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Select Template</CardTitle>
                <CardDescription>
                  Choose a pre-configured template for quick sync execution
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={selectedTemplateId} onValueChange={handleTemplateChange} disabled={loadingTemplate}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingTemplate ? "Loading..." : "Select a template..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        <div>
                          <p className="font-medium">{template.name}</p>
                          {template.description && (
                            <p className="text-xs text-muted-foreground">
                              {template.description}
                            </p>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedTemplateId && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Selected Steps:</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedSteps.map((step) => (
                        <Badge key={step} variant="secondary">
                          {SYNC_STEP_LABELS[step]}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleExecute}
                  disabled={!selectedTemplateId || loading || syncing || loadingTemplate || isExecuting}
                  className="w-full gap-2"
                >
                  {syncing || isExecuting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
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
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Configure field-level settings for each step by clicking the &quot;Configure&quot; button.
                  Steps without configuration will sync all fields by default.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Post-Processing Operations */}
      {!syncing && !loading && (
        <Card>
          <CardHeader>
            <CardTitle>Post-Processing Operations</CardTitle>
            <CardDescription>
              Run post-processing operations after sync completion
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Product Variant Grouping</h3>
              <p className="text-sm text-muted-foreground">
                Auto-link related products (e.g., storage variants) via parent-child relationships
              </p>
              <GroupingTriggerButton />
            </div>
          </CardContent>
        </Card>
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
