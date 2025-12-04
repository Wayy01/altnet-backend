/**
 * Test file to verify FilterConfig component imports and types work correctly
 * This file can be deleted - it's just for verification
 */

import { FilterConfig } from "./filter-config";
import { CatalogFilterConfig } from "@/types/catalog";

// Test 1: Component can be imported
const TestComponent = FilterConfig;

// Test 2: Type can be imported and used
const testConfig: CatalogFilterConfig = {
  category_ids: ["test"],
  brand_ids: ["test"],
  price_min: 100,
  price_max: 200,
  in_stock_only: true,
};

// Test 3: Component props are correctly typed
export function TestUsage() {
  return (
    <FilterConfig
      value={testConfig}
      onChange={(config) => {
        // config is correctly typed as CatalogFilterConfig | null
        console.log(config);
      }}
      disabled={false}
    />
  );
}
