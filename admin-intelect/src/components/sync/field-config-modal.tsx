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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Search, Info, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  FieldConfigModalProps,
  FieldConfig,
  FieldDefinition,
  SyncFieldSchema,
  SYNC_STEP_LABELS,
} from "@/types/selective-sync";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { handleSyncError } from "@/lib/sync-utils";

export function FieldConfigModal({
  open,
  onOpenChange,
  step,
  currentConfig,
  onSave,
}: FieldConfigModalProps) {
  const [loading, setLoading] = useState(false);
  const [fieldSchema, setFieldSchema] = useState<FieldDefinition[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [mode, setMode] = useState<"include" | "exclude">("include");
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [updateNullValues, setUpdateNullValues] = useState(true);

  // Load field schema from API
  useEffect(() => {
    if (open) {
      loadFieldSchema();
      // Initialize from current config if exists
      if (currentConfig) {
        setMode(currentConfig.include_fields ? "include" : "exclude");
        setSelectedFields(currentConfig.include_fields || currentConfig.exclude_fields || []);
        setUpdateNullValues(currentConfig.update_null_values);
      } else {
        // Reset to defaults
        setMode("include");
        setSelectedFields([]);
        setUpdateNullValues(true);
      }
    }
  }, [open, step, currentConfig]);

  const loadFieldSchema = async () => {
    try {
      setLoading(true);
      const schemas = await api.getFieldSchemas();
      const schema = schemas.find((s) => s.step === step);
      if (schema) {
        setFieldSchema(schema.fields);
        // If no config exists, pre-select default fields
        if (!currentConfig) {
          const defaultFields = schema.fields
            .filter((f) => f.default_sync)
            .map((f) => f.name);
          setSelectedFields(defaultFields);
        }
      } else {
        // Handle missing schema explicitly - close modal
        toast.error(`No field schema found for ${SYNC_STEP_LABELS[step]}`);
        setFieldSchema([]);
        onOpenChange(false);
        return;
      }
    } catch (error) {
      handleSyncError(error, "Failed to load field configuration");
      setFieldSchema([]);
    } finally {
      setLoading(false);
    }
  };

  // Group fields by category
  const groupedFields = useMemo(() => {
    const groups: Record<string, FieldDefinition[]> = {};
    fieldSchema.forEach((field) => {
      const group = field.group || "general";
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(field);
    });
    return groups;
  }, [fieldSchema]);

  // Filter fields by search query
  const filteredFields = useMemo(() => {
    if (!searchQuery.trim()) return groupedFields;

    const query = searchQuery.toLowerCase();
    const filtered: Record<string, FieldDefinition[]> = {};

    Object.entries(groupedFields).forEach(([group, fields]) => {
      const matchingFields = fields.filter(
        (field) =>
          field.name.toLowerCase().includes(query) ||
          field.display_name.toLowerCase().includes(query) ||
          field.description?.toLowerCase().includes(query)
      );

      if (matchingFields.length > 0) {
        filtered[group] = matchingFields;
      }
    });

    return filtered;
  }, [groupedFields, searchQuery]);

  const handleToggleField = (fieldName: string) => {
    if (selectedFields.includes(fieldName)) {
      setSelectedFields(selectedFields.filter((f) => f !== fieldName));
    } else {
      setSelectedFields([...selectedFields, fieldName]);
    }
  };

  const handleSelectAll = () => {
    setSelectedFields(fieldSchema.map((f) => f.name));
  };

  const handleDeselectAll = () => {
    setSelectedFields([]);
  };

  const handleSelectDefaults = () => {
    const defaultFields = fieldSchema.filter((f) => f.default_sync).map((f) => f.name);
    setSelectedFields(defaultFields);
  };

  const handleSave = () => {
    const config: FieldConfig = {
      update_null_values: updateNullValues,
    };

    if (mode === "include") {
      config.include_fields = selectedFields;
    } else {
      config.exclude_fields = selectedFields;
    }

    // Validate: at least one field must be selected in include mode
    if (mode === "include" && selectedFields.length === 0) {
      toast.error("Please select at least one field to sync");
      return;
    }

    onSave(config);
    onOpenChange(false);
  };

  const selectedCount = selectedFields.length;
  const totalCount = fieldSchema.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Configure Fields: {SYNC_STEP_LABELS[step]}</DialogTitle>
          <DialogDescription>
            Select which fields to synchronize for this step. Fields marked as required will always
            be included.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
              <p className="text-sm text-muted-foreground">Loading field configuration...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Mode Toggle */}
            <Tabs value={mode} onValueChange={(v) => setMode(v as "include" | "exclude")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="include">Include Fields</TabsTrigger>
                <TabsTrigger value="exclude">Exclude Fields</TabsTrigger>
              </TabsList>
              <TabsContent value="include" className="mt-4">
                <div className="rounded-lg bg-accent/50 p-3 text-sm">
                  <p className="font-medium">Include Mode</p>
                  <p className="text-muted-foreground mt-1">
                    Only the selected fields will be synchronized. All other fields will be skipped.
                  </p>
                </div>
              </TabsContent>
              <TabsContent value="exclude" className="mt-4">
                <div className="rounded-lg bg-accent/50 p-3 text-sm">
                  <p className="font-medium">Exclude Mode</p>
                  <p className="text-muted-foreground mt-1">
                    All fields except the selected ones will be synchronized.
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            {/* Search and Actions */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search fields..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button variant="outline" size="sm" onClick={handleSelectDefaults}>
                Defaults
              </Button>
              <Button variant="outline" size="sm" onClick={handleSelectAll}>
                All
              </Button>
              <Button variant="outline" size="sm" onClick={handleDeselectAll}>
                None
              </Button>
            </div>

            {/* Field Selection */}
            <ScrollArea className="h-[400px] rounded-md border">
              <div className="p-4 space-y-6">
                {Object.entries(filteredFields).map(([group, fields]) => (
                  <div key={group} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-xs font-medium text-muted-foreground uppercase">
                        {group}
                      </span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                    <div className="space-y-2">
                      {fields.map((field) => (
                        <FieldRow
                          key={field.name}
                          field={field}
                          isSelected={selectedFields.includes(field.name)}
                          onToggle={handleToggleField}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Null Values Option */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="update-null" className="text-sm font-medium">
                  Update Null Values
                </Label>
                <p className="text-xs text-muted-foreground">
                  Overwrite existing non-null values with null from API
                </p>
              </div>
              <Switch
                id="update-null"
                checked={updateNullValues}
                onCheckedChange={setUpdateNullValues}
              />
            </div>

            {/* Summary */}
            <div className="flex items-center justify-between text-sm">
              <div className="text-muted-foreground">
                {mode === "include" ? (
                  <>
                    {selectedCount} of {totalCount} fields will be synced
                  </>
                ) : (
                  <>
                    {totalCount - selectedCount} of {totalCount} fields will be synced
                  </>
                )}
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Info className="h-4 w-4" />
                <span className="text-xs">Required fields are always included</span>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            Save Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface FieldRowProps {
  field: FieldDefinition;
  isSelected: boolean;
  onToggle: (fieldName: string) => void;
}

function FieldRow({ field, isSelected, onToggle }: FieldRowProps) {
  const isDisabled = field.required;

  return (
    <div
      className={`flex items-start gap-3 p-2 rounded-md transition-colors ${
        isSelected || isDisabled ? "bg-accent/30" : "hover:bg-accent/20"
      }`}
    >
      <Checkbox
        id={`field-${field.name}`}
        checked={isSelected || isDisabled}
        onCheckedChange={() => !isDisabled && onToggle(field.name)}
        disabled={isDisabled}
        className="mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <label
            htmlFor={`field-${field.name}`}
            className={`text-sm font-medium ${isDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}
          >
            {field.display_name}
          </label>
          <Badge variant="outline" className="text-xs">
            {field.type}
          </Badge>
          {field.required && (
            <Badge variant="secondary" className="text-xs">
              Required
            </Badge>
          )}
          {field.default_sync && !field.required && (
            <Badge variant="outline" className="text-xs">
              Default
            </Badge>
          )}
        </div>
        {field.description && (
          <p className="text-xs text-muted-foreground mt-1">{field.description}</p>
        )}
        {field.dependencies && field.dependencies.length > 0 && (
          <div className="flex items-center gap-1 mt-1">
            <AlertCircle className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Requires: {field.dependencies.join(", ")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
