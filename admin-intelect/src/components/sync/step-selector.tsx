"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StepSelectorProps } from "@/types/selective-sync";

/**
 * StepSelector component for selecting sync steps
 *
 * Phase 3 TODO:
 * - Add checkboxes for each sync step
 * - Show step descriptions on hover
 * - Display configuration status per step
 * - Add "Configure" button per step to open field config modal
 * - Add "Execute Sync" button (disabled when no steps selected)
 * - Show loading state during sync execution
 */
export function StepSelector({
  selectedSteps,
  onStepsChange,
  onConfigure,
  hasConfiguration,
  onExecute,
  isRunning,
}: StepSelectorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Step Selector</CardTitle>
        <CardDescription>
          Select sync steps and configure field-level synchronization
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Coming soon: Step selection and configuration interface
          </p>
          <div className="flex gap-2">
            <Button disabled>Configure Steps</Button>
            <Button disabled variant="default">
              Execute Sync
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
