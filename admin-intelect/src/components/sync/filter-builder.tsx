"use client";

import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
  Plus,
  Trash2,
  HelpCircle,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
} from "lucide-react";
import {
  FilterCondition,
  FilterEntityType,
  FilterLogic,
  FilterOperator,
  FilterFieldDefinition,
  OPERATOR_CONFIGS,
  getOperatorConfig,
  DEFAULT_ENTITY_FIELDS,
} from "@/types/filter";
import { useTranslation } from "@/contexts/language-context";
import { cn } from "@/lib/utils";

interface FilterBuilderProps {
  entityType: FilterEntityType;
  conditions: FilterCondition[];
  logic: FilterLogic;
  onConditionsChange: (conditions: FilterCondition[]) => void;
  onLogicChange: (logic: FilterLogic) => void;
  availableFields?: FilterFieldDefinition[];
  disabled?: boolean;
}

export function FilterBuilder({
  entityType,
  conditions,
  logic,
  onConditionsChange,
  onLogicChange,
  availableFields,
  disabled = false,
}: FilterBuilderProps) {
  const { t } = useTranslation("sync");
  const { t: tCommon } = useTranslation("common");

  // Use provided fields or fallback to defaults
  const fields = useMemo(() => {
    return availableFields || DEFAULT_ENTITY_FIELDS[entityType] || [];
  }, [availableFields, entityType]);

  // Get operators for a specific field
  const getFieldOperators = useCallback(
    (fieldName: string): FilterOperator[] => {
      const field = fields.find((f) => f.name === fieldName);
      return field?.operators || [];
    },
    [fields]
  );

  // Add a new condition
  const handleAddCondition = useCallback(() => {
    const defaultField = fields[0]?.name || "";
    const defaultOperators = getFieldOperators(defaultField);
    const defaultOperator = defaultOperators[0] || "equals";

    const newCondition: FilterCondition = {
      id: crypto.randomUUID(),
      field: defaultField,
      operator: defaultOperator,
      value: "",
    };

    onConditionsChange([...conditions, newCondition]);
  }, [conditions, fields, getFieldOperators, onConditionsChange]);

  // Remove a condition
  const handleRemoveCondition = useCallback(
    (index: number) => {
      const newConditions = conditions.filter((_, i) => i !== index);
      onConditionsChange(newConditions);
    },
    [conditions, onConditionsChange]
  );

  // Update a condition
  const handleConditionChange = useCallback(
    (index: number, updates: Partial<FilterCondition>) => {
      const newConditions = conditions.map((condition, i) => {
        if (i !== index) return condition;

        const updated = { ...condition, ...updates };

        // If field changed, reset operator to first valid one and clear value
        if (updates.field && updates.field !== condition.field) {
          const newOperators = getFieldOperators(updates.field);
          updated.operator = newOperators[0] || "equals";
          updated.value = "";
        }

        // If operator changed to one that doesn't need value, clear value
        if (updates.operator) {
          const opConfig = getOperatorConfig(updates.operator);
          if (opConfig && !opConfig.requiresValue) {
            updated.value = null;
          }
        }

        return updated;
      });

      onConditionsChange(newConditions);
    },
    [conditions, getFieldOperators, onConditionsChange]
  );

  // Toggle logic between AND/OR
  const handleToggleLogic = useCallback(() => {
    onLogicChange(logic === "AND" ? "OR" : "AND");
  }, [logic, onLogicChange]);

  // Get field label
  const getFieldLabel = useCallback(
    (fieldName: string): string => {
      const field = fields.find((f) => f.name === fieldName);
      return field?.label || fieldName;
    },
    [fields]
  );

  // Get field type
  const getFieldType = useCallback(
    (fieldName: string): FilterFieldDefinition["type"] => {
      const field = fields.find((f) => f.name === fieldName);
      return field?.type || "string";
    },
    [fields]
  );

  // Render value input based on field type and operator
  const renderValueInput = useCallback(
    (condition: FilterCondition, index: number) => {
      const opConfig = getOperatorConfig(condition.operator);
      if (!opConfig || !opConfig.requiresValue) {
        return null;
      }

      const fieldType = getFieldType(condition.field);

      // Boolean field
      if (fieldType === "boolean") {
        return (
          <Select
            value={String(condition.value || "true")}
            onValueChange={(value) =>
              handleConditionChange(index, { value: value === "true" })
            }
            disabled={disabled}
          >
            <SelectTrigger className="w-24 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">{tCommon("yes")}</SelectItem>
              <SelectItem value="false">{tCommon("no")}</SelectItem>
            </SelectContent>
          </Select>
        );
      }

      // Number field
      if (fieldType === "number") {
        return (
          <Input
            type="number"
            value={condition.value !== null ? String(condition.value) : ""}
            onChange={(e) =>
              handleConditionChange(index, {
                value: e.target.value ? Number(e.target.value) : null,
              })
            }
            placeholder={t("filter.builder.enterValue")}
            className="w-32 h-9"
            disabled={disabled}
          />
        );
      }

      // Multiple values (in, not_in)
      if (opConfig.valueType === "multiple") {
        const values = Array.isArray(condition.value)
          ? condition.value.join(", ")
          : String(condition.value || "");
        return (
          <div className="flex items-center gap-2">
            <Input
              value={values}
              onChange={(e) =>
                handleConditionChange(index, {
                  value: e.target.value
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean),
                })
              }
              placeholder={t("filter.builder.commaSeparated")}
              className="w-48 h-9"
              disabled={disabled}
            />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>{t("filter.builder.multipleValuesHint")}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        );
      }

      // Default string input
      return (
        <Input
          value={String(condition.value || "")}
          onChange={(e) =>
            handleConditionChange(index, { value: e.target.value })
          }
          placeholder={t("filter.builder.enterValue")}
          className="w-48 h-9"
          disabled={disabled}
        />
      );
    },
    [disabled, getFieldType, handleConditionChange, t, tCommon]
  );

  return (
    <div className="space-y-4">
      {/* Logic Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label className="font-medium text-sm">
            {t("filter.builder.logic")}
          </Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <p>
                  <strong>AND:</strong> {t("filter.builder.andDescription")}
                </p>
                <p className="mt-1">
                  <strong>OR:</strong> {t("filter.builder.orDescription")}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleToggleLogic}
          disabled={disabled || conditions.length < 2}
          className={cn(
            "gap-2 transition-all",
            logic === "AND"
              ? "border-blue-500/30 bg-blue-500/5 text-blue-700 hover:bg-blue-500/10"
              : "border-orange-500/30 bg-orange-500/5 text-orange-700 hover:bg-orange-500/10"
          )}
        >
          {logic === "AND" ? (
            <ToggleLeft className="h-4 w-4" />
          ) : (
            <ToggleRight className="h-4 w-4" />
          )}
          <span className="font-semibold">{logic}</span>
        </Button>
      </div>

      {/* Conditions List */}
      <div className="space-y-3">
        {conditions.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">{t("filter.builder.noConditions")}</p>
              <p className="text-xs mt-1">
                {t("filter.builder.addConditionHint")}
              </p>
            </CardContent>
          </Card>
        ) : (
          conditions.map((condition, index) => {
            const fieldOperators = getFieldOperators(condition.field);
            const opConfig = getOperatorConfig(condition.operator);

            return (
              <Card
                key={condition.id || index}
                className="border bg-card/50 hover:bg-card transition-colors"
              >
                <CardContent className="p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Condition Number / Logic Badge */}
                    {index > 0 && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs font-semibold shrink-0",
                          logic === "AND"
                            ? "border-blue-500/30 bg-blue-500/10 text-blue-700"
                            : "border-orange-500/30 bg-orange-500/10 text-orange-700"
                        )}
                      >
                        {logic}
                      </Badge>
                    )}

                    {/* Field Selector */}
                    <Select
                      value={condition.field}
                      onValueChange={(value) =>
                        handleConditionChange(index, { field: value })
                      }
                      disabled={disabled}
                    >
                      <SelectTrigger className="w-40 h-9">
                        <SelectValue placeholder={t("filter.builder.selectField")} />
                      </SelectTrigger>
                      <SelectContent>
                        {fields.map((field) => (
                          <SelectItem key={field.name} value={field.name}>
                            <div className="flex items-center gap-2">
                              <span>{field.label}</span>
                              <Badge
                                variant="outline"
                                className="text-[10px] h-4 px-1"
                              >
                                {field.type}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Operator Selector */}
                    <Select
                      value={condition.operator}
                      onValueChange={(value) =>
                        handleConditionChange(index, {
                          operator: value as FilterOperator,
                        })
                      }
                      disabled={disabled}
                    >
                      <SelectTrigger className="w-40 h-9">
                        <SelectValue placeholder={t("filter.builder.selectOperator")} />
                      </SelectTrigger>
                      <SelectContent>
                        {fieldOperators.map((op) => {
                          const opInfo = getOperatorConfig(op);
                          return (
                            <SelectItem key={op} value={op}>
                              {opInfo?.label || op}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>

                    {/* Value Input */}
                    {renderValueInput(condition, index)}

                    {/* Remove Button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveCondition(index)}
                      disabled={disabled}
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Validation Warning */}
                  {opConfig?.requiresValue &&
                    (condition.value === null ||
                      condition.value === "" ||
                      (Array.isArray(condition.value) &&
                        condition.value.length === 0)) && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-amber-600">
                        <AlertCircle className="h-3 w-3" />
                        {t("filter.builder.valueRequired")}
                      </div>
                    )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Add Condition Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleAddCondition}
        disabled={disabled || fields.length === 0}
        className="w-full gap-2 border-dashed hover:border-solid transition-all"
      >
        <Plus className="h-4 w-4" />
        {t("filter.builder.addCondition")}
      </Button>

      {/* Summary */}
      {conditions.length > 0 && (
        <div className="rounded-lg bg-muted/30 p-3 text-sm">
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">
              {t("filter.builder.summary")}:
            </span>{" "}
            {t("filter.builder.matchingEntities", {
              logic: logic === "AND" ? t("filter.builder.all") : t("filter.builder.any"),
              count: conditions.length,
            })}
          </p>
        </div>
      )}
    </div>
  );
}
