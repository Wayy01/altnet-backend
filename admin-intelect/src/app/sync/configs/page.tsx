"use client";

import { useState, useEffect, useCallback, useMemo, useDeferredValue } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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

export default function ConfigurationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [configurations, setConfigurations] = useState<SyncConfiguration[]>([]);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [templateFilter, setTemplateFilter] = useState<string>("all");

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

  // Memoize load function to prevent unnecessary recreations
  const loadConfigurations = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.listSyncConfigurations(false, 100, 0);
      setConfigurations(response.configurations);
      setTotal(response.total);
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

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sync Configurations</h1>
          <p className="text-muted-foreground">
            Manage saved sync configurations and templates
          </p>
        </div>
        <Button onClick={handleCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          New Configuration
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search configurations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={templateFilter} onValueChange={setTemplateFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Configurations</SelectItem>
                <SelectItem value="templates">Templates Only</SelectItem>
                <SelectItem value="custom">Custom Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                <p className="text-sm text-muted-foreground">Loading configurations...</p>
              </div>
            </div>
          ) : filteredConfigurations.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {searchQuery || templateFilter !== "all"
                  ? "No configurations found matching your filters"
                  : "No configurations yet. Create one to get started."}
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Steps</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Last Used</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredConfigurations.map((config) => (
                    <TableRow key={config.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{config.name}</p>
                          {config.description && (
                            <p className="text-xs text-muted-foreground">{config.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {config.selected_steps.map((step) => (
                            <Badge key={step} variant="outline" className="text-xs">
                              {SYNC_STEP_LABELS[step]}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {config.is_template ? (
                          <Badge variant="secondary">Template</Badge>
                        ) : (
                          <Badge variant="outline">Custom</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {config.last_used_at
                          ? new Date(config.last_used_at).toLocaleDateString()
                          : "Never"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(config.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleExecute(config)}>
                              <Play className="h-4 w-4 mr-2" />
                              Execute
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(config)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicate(config)}>
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDelete(config)}
                              className="text-destructive"
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingConfig ? "Edit Configuration" : "Create Configuration"}
            </DialogTitle>
            <DialogDescription>
              Configure which sync steps to run and customize field-level settings
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="config-name">Configuration Name</Label>
                <Input
                  id="config-name"
                  placeholder="e.g., Prices Only Sync"
                  value={configName}
                  onChange={(e) => setConfigName(e.target.value)}
                  maxLength={255}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="config-description">Description (Optional)</Label>
                <Textarea
                  id="config-description"
                  placeholder="Describe what this configuration does..."
                  value={configDescription}
                  onChange={(e) => setConfigDescription(e.target.value)}
                  rows={3}
                  maxLength={1000}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="is-template">Save as Template</Label>
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
            <StepSelector
              selectedSteps={selectedSteps}
              onStepsChange={setSelectedSteps}
              onConfigure={handleConfigureStep}
              hasConfiguration={hasConfiguration}
              onExecute={() => {}} // Not used in this context
              isRunning={false}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveConfiguration}>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Configuration</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deletingConfig?.name}&quot;? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
