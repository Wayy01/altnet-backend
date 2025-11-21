"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FieldConfigModalProps } from "@/types/selective-sync";

/**
 * FieldConfigModal component for configuring field-level sync
 *
 * Phase 3 TODO:
 * - Load field schema for selected step from API
 * - Display field list with checkboxes (grouped by category)
 * - Add "Include/Exclude" mode toggle
 * - Add "Update null values" checkbox
 * - Show field dependencies (e.g., if A is selected, B must be too)
 * - Add preset configurations (e.g., "Prices Only", "Stock Only")
 * - Validate configuration before save
 * - Show affected field count
 */
export function FieldConfigModal({
  open,
  onOpenChange,
  step,
  currentConfig,
  onSave,
}: FieldConfigModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Configure Fields for {step}</DialogTitle>
          <DialogDescription>
            Select which fields to synchronize for this step
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Coming soon: Field configuration interface
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button disabled>Save Configuration</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
