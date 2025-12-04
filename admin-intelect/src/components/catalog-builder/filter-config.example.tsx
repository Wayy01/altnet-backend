/**
 * Filter Config Component - Usage Examples
 *
 * This file demonstrates how to use the FilterConfig component
 * in different scenarios within the catalog builder.
 */

"use client";

import { useState } from "react";
import { FilterConfig } from "./filter-config";
import { CatalogFilterConfig } from "@/types/catalog";

/**
 * EXAMPLE 1: Basic Usage in a Form
 * Use this in catalog group or item edit forms
 */
export function BasicFilterConfigExample() {
  const [filterConfig, setFilterConfig] = useState<CatalogFilterConfig | null>(null);

  const handleSave = () => {
    // When saving, filterConfig will be:
    // - null if no filters are set
    // - CatalogFilterConfig object if filters are configured
    console.log("Saving filter config:", filterConfig);
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Product Filters</h3>
      <FilterConfig
        value={filterConfig}
        onChange={setFilterConfig}
      />
      <button onClick={handleSave}>Save</button>
    </div>
  );
}

/**
 * EXAMPLE 2: Using with Existing Data
 * Loading existing filter configuration from API
 */
export function ExistingDataExample() {
  // Simulate loaded data from API
  const existingConfig: CatalogFilterConfig = {
    category_ids: ["cat-123", "cat-456"],
    brand_ids: ["brand-789"],
    price_min: 100,
    price_max: 5000,
    in_stock_only: true,
  };

  const [filterConfig, setFilterConfig] = useState<CatalogFilterConfig | null>(
    existingConfig
  );

  return (
    <FilterConfig
      value={filterConfig}
      onChange={setFilterConfig}
    />
  );
}

/**
 * EXAMPLE 3: Disabled State
 * Useful when editing is not allowed
 */
export function DisabledExample() {
  const [filterConfig, setFilterConfig] = useState<CatalogFilterConfig | null>({
    category_ids: ["cat-123"],
    brand_ids: [],
    in_stock_only: false,
  });

  return (
    <FilterConfig
      value={filterConfig}
      onChange={setFilterConfig}
      disabled={true}
    />
  );
}

/**
 * EXAMPLE 4: Catalog Group Form Integration
 * How to integrate with catalog group create/edit forms
 */
export function CatalogGroupFormExample() {
  const [formData, setFormData] = useState({
    name_ro: "",
    name_ru: "",
    column_position: 1,
    sort_order: 0,
    filter_config: null as CatalogFilterConfig | null,
    is_active: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // API payload
    const payload = {
      ...formData,
      // filter_config will be null or a complete CatalogFilterConfig object
      filter_config: formData.filter_config,
    };

    console.log("Submitting:", payload);
    // await api.createCatalogGroup(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        placeholder="Group Name"
        value={formData.name_ro}
        onChange={(e) =>
          setFormData({ ...formData, name_ro: e.target.value })
        }
      />

      <FilterConfig
        value={formData.filter_config}
        onChange={(config) =>
          setFormData({ ...formData, filter_config: config })
        }
      />

      <button type="submit">Save Group</button>
    </form>
  );
}

/**
 * EXAMPLE 5: Catalog Item Form Integration
 * How to integrate with catalog item create/edit forms
 */
export function CatalogItemFormExample() {
  const [itemType, setItemType] = useState<"category_link" | "custom_filter">(
    "custom_filter"
  );
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [filterConfig, setFilterConfig] = useState<CatalogFilterConfig | null>(
    null
  );

  return (
    <div className="space-y-4">
      {/* Item Type Selection */}
      <div>
        <label>Item Type:</label>
        <select
          value={itemType}
          onChange={(e) =>
            setItemType(e.target.value as "category_link" | "custom_filter")
          }
        >
          <option value="category_link">Category Link</option>
          <option value="custom_filter">Custom Filter</option>
        </select>
      </div>

      {/* Show category selector OR filter config based on item type */}
      {itemType === "category_link" ? (
        <div>
          <label>Select Category:</label>
          <select
            value={categoryId || ""}
            onChange={(e) => setCategoryId(e.target.value || null)}
          >
            <option value="">Select a category...</option>
            {/* Categories would be loaded here */}
          </select>
        </div>
      ) : (
        <FilterConfig value={filterConfig} onChange={setFilterConfig} />
      )}
    </div>
  );
}

/**
 * EXAMPLE 6: Reading Filter Config Values
 * How to access individual filter values
 */
export function ReadingFilterValuesExample() {
  const [filterConfig, setFilterConfig] = useState<CatalogFilterConfig | null>({
    category_ids: ["cat-1", "cat-2"],
    brand_ids: ["brand-1"],
    price_min: 50,
    price_max: 1000,
    in_stock_only: true,
  });

  // Access individual values
  const selectedCategoryCount = filterConfig?.category_ids?.length || 0;
  const selectedBrandCount = filterConfig?.brand_ids?.length || 0;
  const hasPriceFilter = !!(filterConfig?.price_min || filterConfig?.price_max);
  const hasStockFilter = filterConfig?.in_stock_only || false;

  return (
    <div className="space-y-4">
      <FilterConfig value={filterConfig} onChange={setFilterConfig} />

      <div className="mt-4 p-4 bg-muted rounded-lg">
        <h4 className="font-semibold mb-2">Filter Summary:</h4>
        <ul className="space-y-1 text-sm">
          <li>Categories: {selectedCategoryCount}</li>
          <li>Brands: {selectedBrandCount}</li>
          <li>Price Filter: {hasPriceFilter ? "Yes" : "No"}</li>
          <li>Stock Filter: {hasStockFilter ? "Yes" : "No"}</li>
        </ul>
      </div>
    </div>
  );
}

/**
 * EXAMPLE 7: Validation
 * How to validate filter configuration
 */
export function ValidationExample() {
  const [filterConfig, setFilterConfig] = useState<CatalogFilterConfig | null>(
    null
  );
  const [errors, setErrors] = useState<string[]>([]);

  const validateFilters = () => {
    const newErrors: string[] = [];

    if (filterConfig?.price_min && filterConfig?.price_max) {
      if (filterConfig.price_min > filterConfig.price_max) {
        newErrors.push("Minimum price cannot be greater than maximum price");
      }
    }

    if (filterConfig?.price_min && filterConfig.price_min < 0) {
      newErrors.push("Minimum price cannot be negative");
    }

    if (filterConfig?.price_max && filterConfig.price_max < 0) {
      newErrors.push("Maximum price cannot be negative");
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSubmit = () => {
    if (validateFilters()) {
      console.log("Valid filter config:", filterConfig);
    }
  };

  return (
    <div className="space-y-4">
      <FilterConfig value={filterConfig} onChange={setFilterConfig} />

      {errors.length > 0 && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <ul className="list-disc list-inside space-y-1 text-sm text-destructive">
            {errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <button onClick={handleSubmit}>Validate & Submit</button>
    </div>
  );
}
