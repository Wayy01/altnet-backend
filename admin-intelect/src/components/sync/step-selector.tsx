"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Tag,
  Layers,
  Package,
  List,
  DollarSign,
  BarChart3,
  ArrowRightLeft,
  Settings,
  CheckCircle2,
  Play,
  Loader2,
} from "lucide-react";
import {
  StepSelectorProps,
  SyncStep,
  ALL_SYNC_STEPS,
  SYNC_STEP_LABELS,
  SYNC_STEP_DESCRIPTIONS,
} from "@/types/selective-sync";

const STEP_ICONS: Record<SyncStep, React.ReactNode> = {
  brands: <Tag className="h-4 w-4" />,
  categories: <Layers className="h-4 w-4" />,
  products: <Package className="h-4 w-4" />,
  properties: <List className="h-4 w-4" />,
  prices: <DollarSign className="h-4 w-4" />,
  stock: <BarChart3 className="h-4 w-4" />,
  exchange_rates: <ArrowRightLeft className="h-4 w-4" />,
};

const STEP_GROUPS = {
  data: ["brands", "categories", "products", "properties"] as SyncStep[],
  updates: ["prices", "stock", "exchange_rates"] as SyncStep[],
};

export function StepSelector({
  selectedSteps,
  onStepsChange,
  onConfigure,
  hasConfiguration,
  onExecute,
  isRunning,
}: StepSelectorProps) {
  const handleToggleStep = (step: SyncStep) => {
    if (selectedSteps.includes(step)) {
      onStepsChange(selectedSteps.filter((s) => s !== step));
    } else {
      onStepsChange([...selectedSteps, step]);
    }
  };

  const handleSelectAll = () => {
    onStepsChange(ALL_SYNC_STEPS);
  };

  const handleDeselectAll = () => {
    onStepsChange([]);
  };

  const allSelected = selectedSteps.length === ALL_SYNC_STEPS.length;
  const someSelected = selectedSteps.length > 0 && !allSelected;

  return (
    <Card className="transition-all duration-300 hover:shadow-md">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Select Sync Steps</CardTitle>
            <CardDescription className="text-sm mt-0.5">
              Choose which data to synchronize and configure field-level settings
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={allSelected ? handleDeselectAll : handleSelectAll}
              className="transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              {allSelected ? "Deselect All" : "Select All"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Data Sync Group */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border transition-all duration-300" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data Sync</span>
            <div className="h-px flex-1 bg-border transition-all duration-300" />
          </div>
          <div className="grid gap-2.5">
            {STEP_GROUPS.data.map((step) => (
              <StepRow
                key={step}
                step={step}
                isSelected={selectedSteps.includes(step)}
                hasConfig={hasConfiguration[step] ?? false}
                onToggle={handleToggleStep}
                onConfigure={onConfigure}
                isRunning={isRunning}
              />
            ))}
          </div>
        </div>

        {/* Updates Group */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border transition-all duration-300" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Updates</span>
            <div className="h-px flex-1 bg-border transition-all duration-300" />
          </div>
          <div className="grid gap-2.5">
            {STEP_GROUPS.updates.map((step) => (
              <StepRow
                key={step}
                step={step}
                isSelected={selectedSteps.includes(step)}
                hasConfig={hasConfiguration[step] ?? false}
                onToggle={handleToggleStep}
                onConfigure={onConfigure}
                isRunning={isRunning}
              />
            ))}
          </div>
        </div>

        {/* Execute Button */}
        <div className="flex items-center justify-between pt-4 border-t border-border/50">
          <div className="text-sm text-muted-foreground font-medium">
            {selectedSteps.length === 0 ? (
              "No steps selected"
            ) : (
              <>
                {selectedSteps.length} step{selectedSteps.length !== 1 ? "s" : ""} selected
              </>
            )}
          </div>
          <Button
            onClick={onExecute}
            disabled={selectedSteps.length === 0 || isRunning}
            className="gap-2 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            {isRunning ? (
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
        </div>
      </CardContent>
    </Card>
  );
}

interface StepRowProps {
  step: SyncStep;
  isSelected: boolean;
  hasConfig: boolean;
  onToggle: (step: SyncStep) => void;
  onConfigure: (step: SyncStep) => void;
  isRunning: boolean;
}

function StepRow({ step, isSelected, hasConfig, onToggle, onConfigure, isRunning }: StepRowProps) {
  // Keyboard navigation for step selection
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (isRunning) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onToggle(step);
    }
  };

  // Keyboard navigation for configure button
  const handleConfigureKeyDown = (event: React.KeyboardEvent) => {
    if (isRunning || !isSelected) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onConfigure(step);
    }
  };

  return (
    <div
      className={`group flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 ${
        isSelected
          ? "bg-accent/50 border-primary/50 shadow-sm hover:shadow-md hover:scale-[1.01]"
          : "bg-card hover:bg-accent/20 hover:border-border hover:shadow-sm"
      }`}
      role="row"
      tabIndex={isRunning ? -1 : 0}
      onKeyDown={handleKeyDown}
      aria-label={`${SYNC_STEP_LABELS[step]} sync step ${isSelected ? "selected" : "not selected"}`}
    >
      <Checkbox
        id={`step-${step}`}
        checked={isSelected}
        onCheckedChange={() => onToggle(step)}
        disabled={isRunning}
        aria-label={`Select ${SYNC_STEP_LABELS[step]}`}
        className="transition-all duration-200"
      />
      <div className="flex items-center gap-2.5 flex-1">
        <div className={`transition-all duration-200 ${isSelected ? "text-primary scale-110" : "text-muted-foreground group-hover:scale-105"}`}>
          {STEP_ICONS[step]}
        </div>
        <div className="flex-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <label
                  htmlFor={`step-${step}`}
                  className={`text-sm font-semibold cursor-pointer transition-colors duration-200 ${
                    isRunning ? "cursor-not-allowed" : ""
                  }`}
                >
                  {SYNC_STEP_LABELS[step]}
                </label>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <p className="text-xs">{SYNC_STEP_DESCRIPTIONS[step]}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        {hasConfig && (
          <Badge variant="outline" className="text-xs gap-1 animate-in fade-in slide-in-from-left-2 duration-300">
            <CheckCircle2 className="h-3 w-3 text-primary" />
            Configured
          </Badge>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onConfigure(step)}
        onKeyDown={handleConfigureKeyDown}
        disabled={!isSelected || isRunning}
        className="gap-2 transition-all duration-200 hover:scale-105 active:scale-95"
        aria-label={`Configure ${SYNC_STEP_LABELS[step]} fields`}
      >
        <Settings className="h-3 w-3" />
        Configure
      </Button>
    </div>
  );
}
