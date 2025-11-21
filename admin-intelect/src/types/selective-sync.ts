// TypeScript types for Selective Sync System

export type SyncStep =
  | "brands"
  | "categories"
  | "products"
  | "properties"
  | "prices"
  | "stock"
  | "exchange_rates";

export interface FieldDefinition {
  name: string;
  display_name: string;
  type: "string" | "number" | "boolean" | "jsonb" | "uuid";
  required: boolean;
  description?: string;
  group?: string;
  default_sync: boolean;
  dependencies?: string[];
}

export interface SyncFieldSchema {
  step: SyncStep;
  fields: FieldDefinition[];
}

export interface FieldConfig {
  include_fields?: string[];
  exclude_fields?: string[];
  update_null_values: boolean;
}

export interface SyncConfiguration {
  id: string;
  name: string;
  description?: string;
  selected_steps: SyncStep[];
  field_config: Record<SyncStep, FieldConfig>;
  is_template: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  last_used_at?: string;
}

export interface SelectiveSyncRequest {
  selected_steps: SyncStep[];
  field_config?: Record<SyncStep, FieldConfig>;
  save_as_template?: boolean;
  template_name?: string;
  template_description?: string;
  configuration_id?: string;
}

export interface FieldChange {
  field_name: string;
  old_value?: any;
  new_value?: any;
  was_null: boolean;
}

export interface SyncChange {
  id: string;
  sync_log_id: string;
  step: SyncStep;
  entity_type: string;
  entity_id: string;
  entity_ultra_id?: string;
  change_type: "insert" | "update" | "skip";
  fields_changed: FieldChange[];
  created_at: string;
}

export interface SyncChangeSummary {
  sync_log_id: string;
  total_changes: number;
  by_step: Record<SyncStep, number>;
  by_change_type: Record<string, number>;
  by_entity_type: Record<string, number>;
  most_changed_fields: FieldChangeStat[];
}

export interface FieldChangeStat {
  field_name: string;
  change_count: number;
  step: SyncStep;
}

// UI-specific types

export interface StepSelectorProps {
  selectedSteps: SyncStep[];
  onStepsChange: (steps: SyncStep[]) => void;
  onConfigure: (step: SyncStep) => void;
  hasConfiguration: Record<SyncStep, boolean>;
  onExecute: () => void;
  isRunning: boolean;
}

export interface FieldConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step: SyncStep;
  currentConfig?: FieldConfig;
  onSave: (config: FieldConfig) => void;
}

export interface ChangeLogViewerProps {
  syncLogId: string;
}

// Helper types for API responses

export interface ListConfigurationsResponse {
  configurations: SyncConfiguration[];
  total: number;
}

export interface ListChangesResponse {
  changes: SyncChange[];
  total: number;
}

export interface ExecuteSyncResponse {
  sync_log_id: string;
  status: string;
  message: string;
}

// Constants

export const SYNC_STEP_LABELS: Record<SyncStep, string> = {
  brands: "Brands",
  categories: "Categories",
  products: "Products",
  properties: "Properties",
  prices: "Prices",
  stock: "Stock",
  exchange_rates: "Exchange Rates",
};

export const SYNC_STEP_DESCRIPTIONS: Record<SyncStep, string> = {
  brands: "Sync brand information including names, logos, and slugs",
  categories: "Sync product categories and hierarchical structure",
  products: "Sync product catalog with images, barcodes, and basic info",
  properties: "Sync product specifications and technical details",
  prices: "Update product and variant prices across all currencies",
  stock: "Update stock levels for warehouse and showroom",
  exchange_rates: "Update currency exchange rates (MDL, EUR, USD)",
};

export const ALL_SYNC_STEPS: SyncStep[] = [
  "brands",
  "categories",
  "products",
  "properties",
  "prices",
  "stock",
  "exchange_rates",
];
