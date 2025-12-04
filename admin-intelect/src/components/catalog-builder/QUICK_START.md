# FilterConfig - Quick Start Guide

Get started with the FilterConfig component in 5 minutes.

## Step 1: Import

```typescript
import { FilterConfig } from "@/components/catalog-builder";
import { CatalogFilterConfig } from "@/types/catalog";
import { useState } from "react";
```

## Step 2: Add State

```typescript
const [filterConfig, setFilterConfig] = useState<CatalogFilterConfig | null>(null);
```

## Step 3: Render Component

```typescript
<FilterConfig
  value={filterConfig}
  onChange={setFilterConfig}
/>
```

## Complete Example

```typescript
"use client";

import { useState } from "react";
import { FilterConfig } from "@/components/catalog-builder";
import { CatalogFilterConfig } from "@/types/catalog";
import { Button } from "@/components/ui/button";

export function MyCatalogForm() {
  const [formData, setFormData] = useState({
    name_ro: "",
    filter_config: null as CatalogFilterConfig | null,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log("Submitting:", formData);
    // await api.createCatalogGroup(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label>Group Name</label>
        <input
          type="text"
          value={formData.name_ro}
          onChange={(e) => setFormData({ ...formData, name_ro: e.target.value })}
        />
      </div>

      <FilterConfig
        value={formData.filter_config}
        onChange={(config) => setFormData({ ...formData, filter_config: config })}
      />

      <Button type="submit">Save</Button>
    </form>
  );
}
```

## What You Get

- Multi-select categories with search
- Multi-select brands with search
- Price range filter (min/max)
- Stock availability checkbox
- Clear all functionality
- Active filter count badge
- Collapsible interface

## Output Example

When user selects filters, you'll get:

```json
{
  "category_ids": ["uuid1", "uuid2"],
  "brand_ids": ["uuid1"],
  "price_min": 100,
  "price_max": 5000,
  "in_stock_only": true
}
```

Or `null` when all filters are cleared.

## Common Patterns

### Catalog Group (Level 2)
```typescript
interface CatalogGroupInput {
  name_ro: string;
  filter_config?: CatalogFilterConfig;
  // ... other fields
}
```

### Catalog Item (Level 3)
```typescript
// Conditional based on item type
{itemType === "custom_filter" && (
  <FilterConfig value={filterConfig} onChange={setFilterConfig} />
)}
```

### Disabled State
```typescript
<FilterConfig
  value={filterConfig}
  onChange={setFilterConfig}
  disabled={isSubmitting}
/>
```

## Need More Help?

- See `filter-config.example.tsx` for 7 detailed examples
- Read `README.md` for complete documentation
- Use `filter-config.demo.tsx` for visual testing

## That's It!

You're ready to use FilterConfig in your catalog builder forms.
