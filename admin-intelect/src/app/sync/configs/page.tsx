"use client";

import { useState, useEffect, useCallback, useMemo, useDeferredValue } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
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
  Plus,
  MoreVertical,
  Edit,
  Copy,
  Trash2,
  Play,
  Clock,
  Search,
  Filter,
  CheckCircle2,
  ArrowLeft,
  Settings,
  FileText,
  Zap,
  Tag,
  Layers,
  Package,
  List,
  DollarSign,
  BarChart3,
  ArrowRightLeft,
  Database,
  CalendarClock,
  FolderOpen,
  AlertTriangle,
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
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  validateConfigurationName,
  validateConfigurationDescription,
  sanitizeConfigurationName,
  sanitizeConfigurationDescription,
  handleSyncError,
} from "@/lib/sync-utils";

/**
 * Get step icon based on step name
 */
function getStepIcon(stepName: string) {
  const iconClass = "h-3 w-3";
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

export default function ConfigurationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [configurations, setConfigurations] = useState<SyncConfiguration[]>([]);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [templateFilter, setTemplateFilter] = useState<string>("all");

  // Animation states
  const [contentVisible, setContentVisible] = useState(false);
  const [rowsVisible, setRowsVisible] = useState(false);

  // Create/Edit Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<SyncConfiguration | null>(null);
  const [configName, setConfigName] = useState("");
  const [configDescription, setConfigDescription] = useState("");
  const [isTemplate, setIsTemplate] = useState(false);
  const [selectedSteps, setSelectedSteps] = useState<SyncStep[]>([]);
  const [fieldConfigs, setFieldConfigs] = useState<Partial<Record<SyncStep, FieldConfig>>>({});
  const [hasConfiguration, setHasConfiguration] = useState<Partial<Record<SyncStep, boolean>>>({});

  // Field Config Modal State
  const [fieldModalOpen, setFieldModalOpen] = useState(false);
  const [configuringStep, setConfiguringStep] = useState<SyncStep | null>(null);

  // Delete Confirmation State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingConfig, setDeletingConfig] = useState<SyncConfiguration | null>(null);

  // Trigger animations on mount
  useEffect(() => {
    const timer1 = setTimeout(() => setContentVisible(true), 50);
    const timer2 = setTimeout(() => setRowsVisible(true), 200);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  // Memoize load function to prevent unnecessary recreations
  const loadConfigurations = useCallback(async () => {
    try {
      setLoading(true);
      setRowsVisible(false);
      const response = await api.listSyncConfigurations(false, 100, 0);
      setConfigurations(response.configurations);
      setTotal(response.total);
      setTimeout(() => setRowsVisible(true), 100);
    } catch (error) {
      handleSyncError(error, "Failed to load configurations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfigurations();
  }, [loadConfigurations]);


  const handleCreate = () => {
    setEditingConfig(null);
    setConfigName("");
    setConfigDescription("");
    setIsTemplate(false);
    setSelectedSteps([]);
    setFieldConfigs({});
    setHasConfiguration({});
    setDialogOpen(true);
  };

  const handleEdit = (config: SyncConfiguration) => {
    setEditingConfig(config);
    setConfigName(config.name);
    setConfigDescription(config.description || "");
    setIsTemplate(config.is_template);
    setSelectedSteps(config.selected_steps);
    setFieldConfigs(config.field_config);

    // Set hasConfiguration based on existing field configs
    const hasConfig: Partial<Record<SyncStep, boolean>> = {};
    ALL_SYNC_STEPS.forEach((step) => {
      hasConfig[step] = !!config.field_config[step];
    });
    setHasConfiguration(hasConfig);
    setDialogOpen(true);
  };

  const handleDuplicate = (config: SyncConfiguration) => {
    setEditingConfig(null);
    setConfigName(`${config.name} (Copy)`);
    setConfigDescription(config.description || "");
    setIsTemplate(false);
    setSelectedSteps(config.selected_steps);
    setFieldConfigs(config.field_config);

    const hasConfig: Partial<Record<SyncStep, boolean>> = {};
    ALL_SYNC_STEPS.forEach((step) => {
      hasConfig[step] = !!config.field_config[step];
    });
    setHasConfiguration(hasConfig);
    setDialogOpen(true);
  };

  const handleDelete = (config: SyncConfiguration) => {
    setDeletingConfig(config);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingConfig) return;

    try {
      await api.deleteSyncConfiguration(deletingConfig.id);
      toast.success("Configuration deleted successfully");
      setDeleteDialogOpen(false);
      setDeletingConfig(null);
      loadConfigurations();
    } catch (error) {
      handleSyncError(error, "Failed to delete configuration");
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

  const handleSaveConfiguration = async () => {
    // Validate name
    const nameValidation = validateConfigurationName(configName);
    if (!nameValidation.valid) {
      toast.error(nameValidation.error);
      return;
    }

    // Validate description
    const descValidation = validateConfigurationDescription(configDescription);
    if (!descValidation.valid) {
      toast.error(descValidation.error);
      return;
    }

    if (selectedSteps.length === 0) {
      toast.error("Please select at least one sync step");
      return;
    }

    try {
      const configData = {
        name: sanitizeConfigurationName(configName),
        description: configDescription ? sanitizeConfigurationDescription(configDescription) : undefined,
        selected_steps: selectedSteps,
        field_config: fieldConfigs as Record<SyncStep, FieldConfig>,
        is_template: isTemplate,
      };

      if (editingConfig) {
        await api.updateSyncConfiguration(editingConfig.id, configData);
        toast.success("Configuration updated successfully");
      } else {
        await api.saveSyncConfiguration(configData);
        toast.success("Configuration created successfully");
      }

      setDialogOpen(false);
      loadConfigurations();
    } catch (error) {
      handleSyncError(error, "Failed to save configuration");
    }
  };

  const handleExecute = (config: SyncConfiguration) => {
    router.push(`/sync/selective?config=${config.id}`);
  };

  // Use deferred value for search to improve performance
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const filteredConfigurations = useMemo(() => configurations.filter((config) => {
    if (templateFilter === "templates" && !config.is_template) return false;
    if (templateFilter === "custom" && config.is_template) return false;

    if (deferredSearchQuery.trim()) {
      const query = deferredSearchQuery.toLowerCase();
      return (
        config.name.toLowerCase().includes(query) ||
        config.description?.toLowerCase().includes(query)
      );
    }

    return true;
  }), [configurations, templateFilter, deferredSearchQuery]);

  // Statistics
  const stats = useMemo(() => ({
    total: configurations.length,
    templates: configurations.filter(c => c.is_template).length,
    custom: configurations.filter(c => !c.is_template).length,
  }), [configurations]);

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
            <h1 className="text-3xl font-bold tracking-tight">Sync Configurations</h1>
            <p className="text-muted-foreground">
              Manage saved sync configurations and templates
            </p>
          </div>
        </div>
        <Button
          onClick={handleCreate}
          className="gap-2 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
        >
          <Plus className="h-4 w-4" />
          New Configuration
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
          { label: "Total Configs", value: stats.total, icon: <Settings className="h-3.5 w-3.5" />, variant: "default" },
          { label: "Templates", value: stats.templates, icon: <Zap className="h-3.5 w-3.5" />, variant: stats.templates > 0 ? "success" : "muted" },
          { label: "Custom", value: stats.custom, icon: <FileText className="h-3.5 w-3.5" />, variant: "muted" },
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
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search configurations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-10 rounded-lg"
                />
              </div>
              <Select value={templateFilter} onValueChange={setTemplateFilter}>
                <SelectTrigger className="w-[180px] h-10 rounded-lg">
                  <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent className="rounded-lg">
                  <SelectItem value="all">All Configurations</SelectItem>
                  <SelectItem value="templates">Templates Only</SelectItem>
                  <SelectItem value="custom">Custom Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <ConfigsSkeleton />
            ) : filteredConfigurations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="p-4 rounded-full bg-muted/50 mb-4">
                  <FolderOpen className="h-10 w-10 text-muted-foreground/50" />
                </div>
                <p className="font-medium text-foreground">
                  {searchQuery || templateFilter !== "all"
                    ? "No configurations found"
                    : "No configurations yet"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {searchQuery || templateFilter !== "all"
                    ? "Try adjusting your search or filter"
                    : "Create one to get started"}
                </p>
                {!searchQuery && templateFilter === "all" && (
                  <Button
                    onClick={handleCreate}
                    className="mt-4 gap-2"
                    variant="outline"
                  >
                    <Plus className="h-4 w-4" />
                    Create Configuration
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="font-semibold">Name</TableHead>
                      <TableHead className="font-semibold">Steps</TableHead>
                      <TableHead className="font-semibold">Type</TableHead>
                      <TableHead className="font-semibold">Last Used</TableHead>
                      <TableHead className="font-semibold">Created</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredConfigurations.map((config, index) => (
                      <TableRow
                        key={config.id}
                        className={`
                          transition-all duration-200 hover:bg-muted/50
                          ${rowsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
                        `}
                        style={{
                          transitionDelay: rowsVisible ? `${Math.min(index * 30, 300)}ms` : "0ms",
                        }}
                      >
                        <TableCell>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">{config.name}</p>
                            {config.description && (
                              <p className="text-xs text-muted-foreground truncate max-w-[200px] mt-0.5">
                                {config.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {config.selected_steps.slice(0, 4).map((step) => (
                              <Badge
                                key={step}
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 h-5 gap-1 transition-colors hover:bg-muted"
                              >
                                {getStepIcon(step)}
                                {SYNC_STEP_LABELS[step]}
                              </Badge>
                            ))}
                            {config.selected_steps.length > 4 && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                                +{config.selected_steps.length - 4}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {config.is_template ? (
                            <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 gap-1">
                              <Zap className="h-3 w-3" />
                              Template
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1">
                              <FileText className="h-3 w-3" />
                              Custom
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3" />
                            {config.last_used_at
                              ? new Date(config.last_used_at).toLocaleDateString()
                              : "Never"}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <CalendarClock className="h-3 w-3" />
                            {new Date(config.created_at).toLocaleDateString()}
                          </div>
                        </TableCell>
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
                                onClick={() => handleExecute(config)}
                                className="cursor-pointer"
                              >
                                <Play className="h-4 w-4 mr-2" />
                                Execute
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleEdit(config)}
                                className="cursor-pointer"
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDuplicate(config)}
                                className="cursor-pointer"
                              >
                                <Copy className="h-4 w-4 mr-2" />
                                Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDelete(config)}
                                className="text-destructive focus:text-destructive cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {editingConfig ? "Edit Configuration" : "Create Configuration"}
            </DialogTitle>
            <DialogDescription>
              Configure which sync steps to run and customize field-level settings
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="config-name" className="font-medium">
                  Configuration Name
                </Label>
                <Input
                  id="config-name"
                  placeholder="e.g., Prices Only Sync"
                  value={configName}
                  onChange={(e) => setConfigName(e.target.value)}
                  maxLength={255}
                  className="h-11 rounded-lg"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="config-description" className="font-medium">
                  Description (Optional)
                </Label>
                <Textarea
                  id="config-description"
                  placeholder="Describe what this configuration does..."
                  value={configDescription}
                  onChange={(e) => setConfigDescription(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  className="rounded-lg resize-none"
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border p-4 bg-muted/30 transition-colors hover:bg-muted/50">
                <div className="space-y-0.5">
                  <Label htmlFor="is-template" className="font-medium cursor-pointer">
                    Save as Template
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Templates can be reused for quick sync execution
                  </p>
                </div>
                <Switch
                  id="is-template"
                  checked={isTemplate}
                  onCheckedChange={setIsTemplate}
                />
              </div>
            </div>

            {/* Step Selector */}
            <div className="pt-2">
              <StepSelector
                selectedSteps={selectedSteps}
                onStepsChange={setSelectedSteps}
                onConfigure={handleConfigureStep}
                hasConfiguration={hasConfiguration}
                onExecute={() => {}}
                isRunning={false}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="transition-all duration-200 hover:shadow-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveConfiguration}
              className="transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
            >
              {editingConfig ? "Update Configuration" : "Create Configuration"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="rounded-xl max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 ring-2 ring-destructive/20">
                <Trash2 className="h-5 w-5 text-destructive" />
              </div>
              Delete Configuration
            </DialogTitle>
            <DialogDescription className="pt-3">
              Are you sure you want to delete <strong>&quot;{deletingConfig?.name}&quot;</strong>?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deletingConfig && (
            <div className="p-4 rounded-xl bg-muted/50 border">
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Type:</span>
                  <span className="font-medium text-foreground">
                    {deletingConfig.is_template ? "Template" : "Custom"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Steps:</span>
                  <span className="font-medium text-foreground">
                    {deletingConfig.selected_steps.length} selected
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Created:</span>
                  <span className="font-medium text-foreground">
                    {new Date(deletingConfig.created_at).toLocaleDateString()}
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
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              className="transition-all duration-200 hover:shadow-md"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Enhanced skeleton loader for configurations page
 */
function ConfigsSkeleton() {
  return (
    <div className="p-0">
      {/* Table header skeleton */}
      <div className="flex items-center gap-4 p-4 border-b bg-muted/30">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-8 ml-auto" />
      </div>
      {/* Table rows skeleton */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 p-4 border-b last:border-b-0"
          style={{ opacity: 1 - (i * 0.15) }}
        >
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
          <div className="flex gap-1">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-8 rounded-lg ml-auto" />
        </div>
      ))}
    </div>
  );
}
