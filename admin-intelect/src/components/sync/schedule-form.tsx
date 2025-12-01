"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Clock,
  Calendar,
  Settings,
  RefreshCw,
  HelpCircle,
  Globe,
  Zap,
} from "lucide-react";
import {
  SyncSchedule,
  ScheduleFormData,
  ScheduleCreateRequest,
  ScheduleUpdateRequest,
  CRON_PRESETS,
  TIMEZONE_OPTIONS,
  CronPreset,
} from "@/types/schedule";
import { SyncConfiguration } from "@/types/selective-sync";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/language-context";

interface ScheduleFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule?: SyncSchedule | null;
  onSave: () => void;
}

export function ScheduleForm({
  open,
  onOpenChange,
  schedule,
  onSave,
}: ScheduleFormProps) {
  const { t } = useTranslation('sync');
  const { t: tCommon } = useTranslation('common');
  const [loading, setLoading] = useState(false);
  const [configurations, setConfigurations] = useState<SyncConfiguration[]>([]);
  const [loadingConfigs, setLoadingConfigs] = useState(false);

  // Form state
  const [formData, setFormData] = useState<ScheduleFormData>({
    name: "",
    description: "",
    cron_expression: "0 0 * * *",
    timezone: "Europe/Chisinau",
    configuration_id: "",
    is_active: true,
    retry_config: { max_retries: 3, retry_delay_seconds: 60, exponential_backoff: false },
    notification_config: { notify_on_success: false, notify_on_failure: true, recipients: [] },
  });

  // Custom cron mode
  const [cronMode, setCronMode] = useState<"preset" | "custom">("preset");
  const [selectedPreset, setSelectedPreset] = useState<string>("0 0 * * *");

  // Load configurations
  useEffect(() => {
    if (open) {
      loadConfigurations();
    }
  }, [open]);

  // Initialize form data when schedule changes
  useEffect(() => {
    if (open) {
      if (schedule) {
        setFormData({
          name: schedule.name,
          description: schedule.description || "",
          cron_expression: schedule.cron_expression,
          timezone: schedule.timezone,
          configuration_id: schedule.configuration_id || "",
          is_active: schedule.is_active,
          retry_config: schedule.retry_config || { max_retries: 3, retry_delay_seconds: 60, exponential_backoff: false },
          notification_config: schedule.notification_config || { notify_on_success: false, notify_on_failure: true, recipients: [] },
        });

        // Check if cron matches a preset
        const matchingPreset = CRON_PRESETS.find(
          (p) => p.expression === schedule.cron_expression
        );
        if (matchingPreset) {
          setCronMode("preset");
          setSelectedPreset(schedule.cron_expression);
        } else {
          setCronMode("custom");
        }
      } else {
        // Reset to defaults
        setFormData({
          name: "",
          description: "",
          cron_expression: "0 0 * * *",
          timezone: "Europe/Chisinau",
          configuration_id: "",
          is_active: true,
          retry_config: { max_retries: 3, retry_delay_seconds: 60, exponential_backoff: false },
          notification_config: { notify_on_success: false, notify_on_failure: true, recipients: [] },
        });
        setCronMode("preset");
        setSelectedPreset("0 0 * * *");
      }
    }
  }, [open, schedule]);

  const loadConfigurations = async () => {
    try {
      setLoadingConfigs(true);
      const response = await api.listSyncConfigurations(false, 100, 0);
      setConfigurations(response.configurations);
    } catch (error) {
      console.error("Failed to load configurations:", error);
      toast.error(t('schedule.form.loadConfigsFailed'));
    } finally {
      setLoadingConfigs(false);
    }
  };

  const handlePresetChange = (expression: string) => {
    setSelectedPreset(expression);
    setFormData({ ...formData, cron_expression: expression });
  };

  const handleCronModeChange = (mode: "preset" | "custom") => {
    setCronMode(mode);
    if (mode === "preset") {
      setFormData({ ...formData, cron_expression: selectedPreset });
    }
  };

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      toast.error(t('schedule.form.nameRequired'));
      return false;
    }

    if (!formData.cron_expression.trim()) {
      toast.error(t('schedule.form.cronRequired'));
      return false;
    }

    // Basic cron validation (5 parts)
    const cronParts = formData.cron_expression.trim().split(/\s+/);
    if (cronParts.length !== 5) {
      toast.error(t('schedule.form.cronInvalid'));
      return false;
    }

    if ((formData.retry_config.max_retries ?? 0) < 0 || (formData.retry_config.max_retries ?? 0) > 10) {
      toast.error(t('schedule.form.retriesInvalid'));
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);

      if (schedule) {
        // Update existing schedule
        const updateRequest: ScheduleUpdateRequest = {
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          cron_expression: formData.cron_expression.trim(),
          timezone: formData.timezone,
          configuration_id: formData.configuration_id || null,
          is_active: formData.is_active,
          retry_config: formData.retry_config,
          notification_config: formData.notification_config,
        };
        await api.updateSchedule(schedule.id, updateRequest);
        toast.success(t('schedule.toast.updated'));
      } else {
        // Create new schedule
        const createRequest: ScheduleCreateRequest = {
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          cron_expression: formData.cron_expression.trim(),
          timezone: formData.timezone,
          configuration_id: formData.configuration_id || undefined,
          is_active: formData.is_active,
          retry_config: formData.retry_config,
          notification_config: formData.notification_config,
        };
        await api.createSchedule(createRequest);
        toast.success(t('schedule.toast.created'));
      }

      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save schedule:", error);
      toast.error(
        schedule
          ? t('schedule.toast.updateFailed')
          : t('schedule.toast.createFailed')
      );
    } finally {
      setLoading(false);
    }
  };

  // Find selected preset details
  const selectedPresetInfo = useMemo(() => {
    return CRON_PRESETS.find((p) => p.expression === formData.cron_expression);
  }, [formData.cron_expression]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {schedule ? t('schedule.dialog.editTitle') : t('schedule.dialog.createTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('schedule.dialog.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="schedule-name" className="font-medium">
                {t('schedule.form.name')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="schedule-name"
                placeholder={t('schedule.form.namePlaceholder')}
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                maxLength={255}
                className="h-11 rounded-lg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="schedule-description" className="font-medium">
                {t('schedule.form.description')}
              </Label>
              <Textarea
                id="schedule-description"
                placeholder={t('schedule.form.descriptionPlaceholder')}
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={2}
                maxLength={500}
                className="rounded-lg resize-none"
              />
            </div>
          </div>

          {/* Cron Expression */}
          <div className="space-y-4 rounded-xl border p-4 bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <Label className="font-medium">{t('schedule.form.schedule')}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={cronMode === "preset" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleCronModeChange("preset")}
                  className="h-7 text-xs"
                >
                  {t('schedule.form.presets')}
                </Button>
                <Button
                  variant={cronMode === "custom" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleCronModeChange("custom")}
                  className="h-7 text-xs"
                >
                  {t('schedule.form.custom')}
                </Button>
              </div>
            </div>

            {cronMode === "preset" ? (
              <div className="grid grid-cols-2 gap-2">
                {CRON_PRESETS.map((preset) => (
                  <TooltipProvider key={preset.expression}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={
                            formData.cron_expression === preset.expression
                              ? "default"
                              : "outline"
                          }
                          className="justify-start h-auto py-2 px-3"
                          onClick={() => handlePresetChange(preset.expression)}
                        >
                          <div className="text-left">
                            <div className="font-medium text-sm">
                              {preset.label}
                            </div>
                            <div className="text-xs opacity-70 font-mono">
                              {preset.expression}
                            </div>
                          </div>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p>{preset.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="* * * * *"
                    value={formData.cron_expression}
                    onChange={(e) =>
                      setFormData({ ...formData, cron_expression: e.target.value })
                    }
                    className="font-mono"
                  />
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="shrink-0">
                          <HelpCircle className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <p className="font-mono text-xs">
                          {t('schedule.form.cronFormat')}
                        </p>
                        <p className="text-xs mt-1 text-muted-foreground">
                          minute hour day month weekday
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                {selectedPresetInfo && (
                  <p className="text-xs text-muted-foreground">
                    {selectedPresetInfo.description}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Timezone */}
          <div className="space-y-2">
            <Label className="font-medium flex items-center gap-2">
              <Globe className="h-4 w-4" />
              {t('schedule.form.timezone')}
            </Label>
            <Select
              value={formData.timezone}
              onValueChange={(value) =>
                setFormData({ ...formData, timezone: value })
              }
            >
              <SelectTrigger className="h-11 rounded-lg">
                <SelectValue placeholder={t('schedule.form.selectTimezone')} />
              </SelectTrigger>
              <SelectContent className="rounded-lg">
                {TIMEZONE_OPTIONS.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    <div className="flex items-center gap-2">
                      <span>{tz.label}</span>
                      <Badge variant="outline" className="text-xs font-mono">
                        {tz.offset}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Configuration */}
          <div className="space-y-2">
            <Label className="font-medium flex items-center gap-2">
              <Settings className="h-4 w-4" />
              {t('schedule.form.configuration')}
            </Label>
            <Select
              value={formData.configuration_id || "none"}
              onValueChange={(value) =>
                setFormData({ ...formData, configuration_id: value === "none" ? "" : value })
              }
              disabled={loadingConfigs}
            >
              <SelectTrigger className="h-11 rounded-lg">
                <SelectValue
                  placeholder={
                    loadingConfigs
                      ? t('schedule.form.loadingConfigs')
                      : t('schedule.form.selectConfig')
                  }
                />
              </SelectTrigger>
              <SelectContent className="rounded-lg">
                <SelectItem value="none">
                  <span className="text-muted-foreground">
                    {t('schedule.form.noConfig')}
                  </span>
                </SelectItem>
                {configurations.map((config) => (
                  <SelectItem key={config.id} value={config.id}>
                    <div className="flex items-center gap-2">
                      <span>{config.name}</span>
                      {config.is_template && (
                        <Badge
                          variant="secondary"
                          className="text-xs gap-1"
                        >
                          <Zap className="h-3 w-3" />
                          {t('schedule.form.template')}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t('schedule.form.configHint')}
            </p>
          </div>

          {/* Max Retries */}
          <div className="space-y-2">
            <Label htmlFor="max-retries" className="font-medium flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              {t('schedule.form.maxRetries')}
            </Label>
            <Input
              id="max-retries"
              type="number"
              min={0}
              max={10}
              value={formData.retry_config.max_retries ?? 3}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  retry_config: { ...formData.retry_config, max_retries: parseInt(e.target.value) || 0 },
                })
              }
              className="w-32 h-11 rounded-lg"
            />
            <p className="text-xs text-muted-foreground">
              {t('schedule.form.retriesHint')}
            </p>
          </div>

          {/* Active Toggle */}
          <div className="flex items-center justify-between rounded-xl border p-4 bg-muted/30 transition-colors hover:bg-muted/50">
            <div className="space-y-0.5">
              <Label htmlFor="is-active" className="font-medium cursor-pointer">
                {t('schedule.form.active')}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t('schedule.form.activeHint')}
              </p>
            </div>
            <Switch
              id="is-active"
              checked={formData.is_active}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, is_active: checked })
              }
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="transition-all duration-200 hover:shadow-sm"
          >
            {tCommon('cancel')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading}
            className="transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                {t('schedule.form.saving')}
              </>
            ) : schedule ? (
              t('schedule.form.update')
            ) : (
              t('schedule.form.create')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
