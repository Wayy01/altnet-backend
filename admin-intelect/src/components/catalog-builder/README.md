# Catalog Builder Components

This directory contains components for building and managing the 3-level catalog navigation system.

## Overview

The catalog builder system has three levels:
- **Level 1**: Catalog Sections (main navigation sections with icons)
- **Level 2**: Catalog Groups (column groups within sections)
- **Level 3**: Catalog Items (clickable menu items)

## Components

### FilterConfig

A reusable filter configuration component for catalog groups and items. Allows users to define which products appear when clicking a menu item.

#### Features

- Multi-select for categories
- Multi-select for brands
- Price range filters (min/max)
- Stock availability filter
- Collapsible interface with active filter count
- Clear all functionality
- Automatic data loading from API
- Real-time filter updates

#### Usage

```tsx
import { FilterConfig } from "@/components/catalog-builder/filter-config";
import { CatalogFilterConfig } from "@/types/catalog";
import { useState } from "react";

export function MyComponent() {
  const [filterConfig, setFilterConfig] = useState<CatalogFilterConfig | null>(null);

  return (
    <FilterConfig
      value={filterConfig}
      onChange={setFilterConfig}
      disabled={false}
    />
  );
}
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `CatalogFilterConfig \| null` | - | Current filter configuration |
| `onChange` | `(config: CatalogFilterConfig \| null) => void` | - | Callback when filters change |
| `disabled` | `boolean` | `false` | Disable all filter controls |

#### Output Format

The component outputs a `CatalogFilterConfig` object or `null` if all filters are empty:

```typescript
interface CatalogFilterConfig {
  category_ids?: string[];
  brand_ids?: string[];
  price_min?: number;
  price_max?: number;
  in_stock_only?: boolean;
}
```

Example output:
```typescript
{
  category_ids: ["uuid1", "uuid2"],
  brand_ids: ["uuid1"],
  price_min: 100,
  price_max: 5000,
  in_stock_only: true
}
```

Or `null` when all filters are cleared.

#### Integration with Forms

**Catalog Group Form:**
```tsx
const [formData, setFormData] = useState({
  name_ro: "",
  filter_config: null as CatalogFilterConfig | null,
  // ... other fields
});

<FilterConfig
  value={formData.filter_config}
  onChange={(config) => setFormData({ ...formData, filter_config: config })}
/>
```

**Catalog Item Form:**
```tsx
const [itemType, setItemType] = useState<"category_link" | "custom_filter">("custom_filter");
const [filterConfig, setFilterConfig] = useState<CatalogFilterConfig | null>(null);

{itemType === "custom_filter" && (
  <FilterConfig
    value={filterConfig}
    onChange={setFilterConfig}
  />
)}
```

#### API Integration

The component automatically fetches data from:
- `GET /api/v1/categories/all` - All categories
- `GET /api/v1/brands/all` - All brands

These endpoints are called via the `api` client:
```typescript
const [categoriesData, brandsData] = await Promise.all([
  api.getAllCategories(),
  api.getAllBrands(),
]);
```

#### Styling

The component uses:
- Collapsible section with trigger button
- Command + Popover pattern for multi-select
- Badge components for selected items
- Consistent shadcn/ui styling
- Responsive layout

#### Validation

You can validate the filter configuration before submission:

```typescript
const validateFilters = (config: CatalogFilterConfig | null) => {
  if (!config) return true; // No filters is valid

  if (config.price_min && config.price_max) {
    if (config.price_min > config.price_max) {
      return false; // Invalid: min > max
    }
  }

  if (config.price_min && config.price_min < 0) {
    return false; // Invalid: negative price
  }

  return true;
};
```

#### Examples

See `filter-config.example.tsx` for comprehensive usage examples including:
- Basic usage
- Loading existing data
- Disabled state
- Form integration
- Reading filter values
- Validation

## File Structure

```
catalog-builder/
├── README.md                    # This file
├── filter-config.tsx            # Filter configuration component
├── filter-config.example.tsx    # Usage examples
└── section-form.tsx            # Section form (existing)
```

## Best Practices

1. **Always handle null values**: The component can return `null` when all filters are cleared
2. **Validate price ranges**: Check that min <= max before submission
3. **Use TypeScript types**: Import `CatalogFilterConfig` from `@/types/catalog`
4. **Show active filters**: Use the built-in active filter count badge
5. **Disable when needed**: Use the `disabled` prop during loading or when editing is not allowed

## Component Architecture

### MultiSelect Sub-component

The `MultiSelect` component is an internal component used for category and brand selection:

- Searchable dropdown with Command pattern
- Multiple selection with checkboxes
- Selected items shown as removable badges
- "Clear all" functionality
- Accessible and keyboard-navigable

### Filter State Management

The component maintains internal state for all filters and emits changes immediately to the parent component. This ensures:
- Real-time updates
- No need for "Apply" button
- Automatic null emission when empty
- Controlled component pattern

### Performance Considerations

- Categories and brands are loaded once on mount
- Search filtering is done client-side for instant results
- Memoized filtered lists for performance
- Debouncing not needed due to client-side filtering

## Future Enhancements

Potential improvements:
- Server-side search for large datasets
- Filter presets (save common filter combinations)
- Advanced filters (date ranges, custom properties)
- Filter templates
- Export/import filter configurations
- Filter usage analytics
