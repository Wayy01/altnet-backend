"use client";

/**
 * FilterConfig Component Demo Page
 *
 * This file provides a visual demo and testing interface for the FilterConfig component.
 * You can use this during development or as a reference for integration.
 *
 * To use this demo:
 * 1. Create a page at /app/(dashboard)/demo/filter-config/page.tsx
 * 2. Import and render this component
 * 3. Navigate to /demo/filter-config in your browser
 */

import { useState } from "react";
import { FilterConfig } from "./filter-config";
import { CatalogFilterConfig } from "@/types/catalog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function FilterConfigDemo() {
  const [config1, setConfig1] = useState<CatalogFilterConfig | null>(null);
  const [config2, setConfig2] = useState<CatalogFilterConfig | null>({
    category_ids: [],
    brand_ids: [],
    price_min: 500,
    price_max: 3000,
    in_stock_only: true,
  });
  const [config3, setConfig3] = useState<CatalogFilterConfig | null>(null);

  const handleReset1 = () => setConfig1(null);
  const handleReset2 = () => setConfig2(null);

  const handleSetPreset = () => {
    setConfig1({
      category_ids: [],
      brand_ids: [],
      price_min: 100,
      price_max: 1000,
      in_stock_only: false,
    });
  };

  return (
    <div className="container mx-auto py-8 space-y-8 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold mb-2">FilterConfig Component Demo</h1>
        <p className="text-muted-foreground">
          Interactive demo of the filter configuration component for catalog builder
        </p>
      </div>

      {/* Demo 1: Empty State */}
      <Card>
        <CardHeader>
          <CardTitle>Demo 1: Empty State</CardTitle>
          <CardDescription>
            Start with no filters selected. Try adding filters and clearing them.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FilterConfig value={config1} onChange={setConfig1} />

          <div className="flex gap-2">
            <Button onClick={handleReset1} variant="outline" size="sm">
              Reset to Null
            </Button>
            <Button onClick={handleSetPreset} variant="outline" size="sm">
              Set Preset
            </Button>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm font-semibold mb-2">Current Value:</p>
            <pre className="text-xs overflow-auto">
              {JSON.stringify(config1, null, 2)}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Demo 2: Pre-filled State */}
      <Card>
        <CardHeader>
          <CardTitle>Demo 2: Pre-filled State</CardTitle>
          <CardDescription>
            Start with some filters already configured (price range and stock filter).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FilterConfig value={config2} onChange={setConfig2} />

          <div className="flex gap-2">
            <Button onClick={handleReset2} variant="outline" size="sm">
              Clear All Filters
            </Button>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm font-semibold mb-2">Current Value:</p>
            <pre className="text-xs overflow-auto">
              {JSON.stringify(config2, null, 2)}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Demo 3: Disabled State */}
      <Card>
        <CardHeader>
          <CardTitle>Demo 3: Disabled State</CardTitle>
          <CardDescription>
            Component in disabled state. All controls should be non-interactive.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FilterConfig value={config3} onChange={setConfig3} disabled={true} />

          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm font-semibold mb-2">Current Value:</p>
            <pre className="text-xs overflow-auto">
              {JSON.stringify(config3, null, 2)}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Feature Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Features & Capabilities</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                Multi-Select Categories
                <Badge variant="secondary" className="text-xs">
                  Searchable
                </Badge>
              </h4>
              <p className="text-sm text-muted-foreground">
                Select multiple categories with search and checkbox interface
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                Multi-Select Brands
                <Badge variant="secondary" className="text-xs">
                  Searchable
                </Badge>
              </h4>
              <p className="text-sm text-muted-foreground">
                Select multiple brands with search and checkbox interface
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Price Range Filter</h4>
              <p className="text-sm text-muted-foreground">
                Set minimum and maximum price boundaries in MDL
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Stock Availability</h4>
              <p className="text-sm text-muted-foreground">
                Checkbox to filter only products in stock
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                Collapsible Interface
                <Badge variant="secondary" className="text-xs">
                  UX
                </Badge>
              </h4>
              <p className="text-sm text-muted-foreground">
                Expandable section with active filter count badge
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                Clear All
                <Badge variant="secondary" className="text-xs">
                  UX
                </Badge>
              </h4>
              <p className="text-sm text-muted-foreground">
                Quick action to reset all filters at once
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                Null Handling
                <Badge variant="secondary" className="text-xs">
                  Type Safety
                </Badge>
              </h4>
              <p className="text-sm text-muted-foreground">
                Returns null when all filters are empty/cleared
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                Real-time Updates
                <Badge variant="secondary" className="text-xs">
                  Performance
                </Badge>
              </h4>
              <p className="text-sm text-muted-foreground">
                Immediate propagation of changes to parent component
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Integration Guide */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Integration Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold text-sm mb-2">1. Import the component</h4>
            <pre className="text-xs bg-muted p-3 rounded overflow-auto">
{`import { FilterConfig } from "@/components/catalog-builder/filter-config";
import { CatalogFilterConfig } from "@/types/catalog";`}
            </pre>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-2">2. Add state to your component</h4>
            <pre className="text-xs bg-muted p-3 rounded overflow-auto">
{`const [filterConfig, setFilterConfig] = useState<CatalogFilterConfig | null>(null);`}
            </pre>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-2">3. Render the component</h4>
            <pre className="text-xs bg-muted p-3 rounded overflow-auto">
{`<FilterConfig
  value={filterConfig}
  onChange={setFilterConfig}
  disabled={false}
/>`}
            </pre>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-2">4. Use the filter config in your form</h4>
            <pre className="text-xs bg-muted p-3 rounded overflow-auto">
{`const handleSubmit = async () => {
  const payload = {
    name_ro: "Group Name",
    filter_config: filterConfig, // null or CatalogFilterConfig object
    // ... other fields
  };
  await api.createCatalogGroup(payload);
};`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Technical Details */}
      <Card>
        <CardHeader>
          <CardTitle>Technical Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="font-semibold">Component Type:</div>
            <div className="text-muted-foreground">Client Component ("use client")</div>

            <div className="font-semibold">State Management:</div>
            <div className="text-muted-foreground">Controlled Component Pattern</div>

            <div className="font-semibold">Data Loading:</div>
            <div className="text-muted-foreground">Automatic on mount</div>

            <div className="font-semibold">Search Strategy:</div>
            <div className="text-muted-foreground">Client-side filtering</div>

            <div className="font-semibold">API Endpoints:</div>
            <div className="text-muted-foreground">/api/v1/categories/all, /api/v1/brands/all</div>

            <div className="font-semibold">Dependencies:</div>
            <div className="text-muted-foreground">shadcn/ui components (Command, Popover, etc.)</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
