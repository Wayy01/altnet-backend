"use client";

import { useState, useEffect, useMemo } from "react";
import { Check, ChevronsUpDown, X, Filter as FilterIcon } from "lucide-react";
import { useTranslation } from "@/contexts/language-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { CatalogFilterConfig } from "@/types/catalog";
import { Brand, Category } from "@/types";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface FilterConfigProps {
  value: CatalogFilterConfig | null;
  onChange: (config: CatalogFilterConfig | null) => void;
  disabled?: boolean;
}

/**
 * Multi-select component for selecting multiple items with search
 */
interface MultiSelectProps {
  items: Array<{ id: string; name: string }>;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  label: string;
}

function MultiSelect({
  items,
  selectedIds,
  onSelectionChange,
  placeholder = "Select items...",
  disabled = false,
  loading = false,
  label,
}: MultiSelectProps) {
  const { t } = useTranslation("catalogBuilder");
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const query = searchQuery.toLowerCase();
    return items.filter((item) => item.name.toLowerCase().includes(query));
  }, [items, searchQuery]);

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.includes(item.id)),
    [items, selectedIds]
  );

  const handleToggle = (itemId: string) => {
    const isSelected = selectedIds.includes(itemId);
    if (isSelected) {
      onSelectionChange(selectedIds.filter((id) => id !== itemId));
    } else {
      onSelectionChange([...selectedIds, itemId]);
    }
  };

  const handleRemove = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectionChange(selectedIds.filter((id) => id !== itemId));
  };

  const handleClearAll = () => {
    onSelectionChange([]);
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled || loading}
            className="w-full justify-between h-auto min-h-9 py-2"
          >
            <div className="flex flex-wrap gap-1 flex-1 items-center">
              {selectedItems.length === 0 ? (
                <span className="text-muted-foreground">{placeholder}</span>
              ) : (
                <>
                  {selectedItems.slice(0, 3).map((item) => (
                    <Badge
                      key={item.id}
                      variant="secondary"
                      className="gap-1"
                    >
                      {item.name}
                      <X
                        className="h-3 w-3 cursor-pointer hover:text-destructive"
                        onClick={(e) => handleRemove(item.id, e)}
                      />
                    </Badge>
                  ))}
                  {selectedItems.length > 3 && (
                    <Badge variant="secondary">
                      {t("filter.moreSelected", { count: selectedItems.length - 3 })}
                    </Badge>
                  )}
                </>
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={label === t("filter.categories") ? t("filter.searchCategories") : t("filter.searchBrands")}
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              <CommandEmpty>{t("filter.noItemsFound")}</CommandEmpty>
              <CommandGroup>
                {filteredItems.map((item) => {
                  const isSelected = selectedIds.includes(item.id);
                  return (
                    <CommandItem
                      key={item.id}
                      value={item.id}
                      onSelect={() => handleToggle(item.id)}
                      className="cursor-pointer"
                    >
                      <div
                        className={cn(
                          "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "opacity-50 [&_svg]:invisible"
                        )}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </div>
                      <span className="flex-1">{item.name}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
          {selectedIds.length > 0 && (
            <div className="border-t p-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                className="w-full"
              >
                {t("filter.clearAll")} ({selectedIds.length})
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

/**
 * Filter configuration component for catalog items
 * Allows configuring filters for categories, brands, price range, and stock status
 */
export function FilterConfig({
  value,
  onChange,
  disabled = false,
}: FilterConfigProps) {
  const { t } = useTranslation("catalogBuilder");
  const [isOpen, setIsOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);

  // Internal state for filter values
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    value?.category_ids || []
  );
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>(
    value?.brand_ids || []
  );
  const [priceMin, setPriceMin] = useState<string>(
    value?.price_min?.toString() || ""
  );
  const [priceMax, setPriceMax] = useState<string>(
    value?.price_max?.toString() || ""
  );
  const [inStockOnly, setInStockOnly] = useState<boolean>(
    value?.in_stock_only || false
  );

  // Load categories and brands
  useEffect(() => {
    loadFilterData();
  }, []);

  // Update internal state when value prop changes
  useEffect(() => {
    setSelectedCategoryIds(value?.category_ids || []);
    setSelectedBrandIds(value?.brand_ids || []);
    setPriceMin(value?.price_min?.toString() || "");
    setPriceMax(value?.price_max?.toString() || "");
    setInStockOnly(value?.in_stock_only || false);
  }, [value]);

  const loadFilterData = async () => {
    try {
      setLoading(true);
      const [categoriesData, brandsData] = await Promise.all([
        api.getAllCategories(),
        api.getAllBrands(),
      ]);
      setCategories(categoriesData);
      setBrands(brandsData);
    } catch (error) {
      console.error("Failed to load filter data:", error);
      toast.error("Failed to load filter options");
    } finally {
      setLoading(false);
    }
  };

  // Emit changes to parent component
  const emitChange = (updates: Partial<CatalogFilterConfig>) => {
    const newConfig: CatalogFilterConfig = {
      category_ids: updates.category_ids ?? selectedCategoryIds,
      brand_ids: updates.brand_ids ?? selectedBrandIds,
      price_min: updates.price_min !== undefined ? updates.price_min : (priceMin ? parseFloat(priceMin) : undefined),
      price_max: updates.price_max !== undefined ? updates.price_max : (priceMax ? parseFloat(priceMax) : undefined),
      in_stock_only: updates.in_stock_only ?? inStockOnly,
    };

    // Check if config is empty (all filters cleared)
    const isEmpty =
      (!newConfig.category_ids || newConfig.category_ids.length === 0) &&
      (!newConfig.brand_ids || newConfig.brand_ids.length === 0) &&
      !newConfig.price_min &&
      !newConfig.price_max &&
      !newConfig.in_stock_only;

    onChange(isEmpty ? null : newConfig);
  };

  const handleCategoryChange = (ids: string[]) => {
    setSelectedCategoryIds(ids);
    emitChange({ category_ids: ids });
  };

  const handleBrandChange = (ids: string[]) => {
    setSelectedBrandIds(ids);
    emitChange({ brand_ids: ids });
  };

  const handlePriceMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPriceMin(value);
    emitChange({ price_min: value ? parseFloat(value) : undefined });
  };

  const handlePriceMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPriceMax(value);
    emitChange({ price_max: value ? parseFloat(value) : undefined });
  };

  const handleInStockChange = (checked: boolean) => {
    setInStockOnly(checked);
    emitChange({ in_stock_only: checked });
  };

  const handleClearAll = () => {
    setSelectedCategoryIds([]);
    setSelectedBrandIds([]);
    setPriceMin("");
    setPriceMax("");
    setInStockOnly(false);
    onChange(null);
  };

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCategoryIds.length > 0) count++;
    if (selectedBrandIds.length > 0) count++;
    if (priceMin || priceMax) count++;
    if (inStockOnly) count++;
    return count;
  }, [selectedCategoryIds, selectedBrandIds, priceMin, priceMax, inStockOnly]);

  const categoryItems = useMemo(
    () => categories.map((cat) => ({ id: cat.id, name: cat.name })),
    [categories]
  );

  const brandItems = useMemo(
    () => brands.map((brand) => ({ id: brand.id, name: brand.name })),
    [brands]
  );

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} disabled={disabled}>
      <div className="border rounded-lg">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between p-4 h-auto hover:bg-muted/50"
            disabled={disabled}
          >
            <div className="flex items-center gap-2">
              <FilterIcon className="h-4 w-4" />
              <span className="font-semibold">{t("filter.title")}</span>
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {t("filter.active", { count: activeFilterCount })}
                </Badge>
              )}
            </div>
            <ChevronsUpDown className="h-4 w-4 shrink-0" />
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t p-4 space-y-4">
            {/* Categories Multi-select */}
            <MultiSelect
              items={categoryItems}
              selectedIds={selectedCategoryIds}
              onSelectionChange={handleCategoryChange}
              placeholder={t("filter.allCategories")}
              disabled={disabled || loading}
              loading={loading}
              label={t("filter.categories")}
            />

            {/* Brands Multi-select */}
            <MultiSelect
              items={brandItems}
              selectedIds={selectedBrandIds}
              onSelectionChange={handleBrandChange}
              placeholder={t("filter.allBrands")}
              disabled={disabled || loading}
              loading={loading}
              label={t("filter.brands")}
            />

            {/* Price Range */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t("filter.priceRange")}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder={t("filter.minPrice")}
                  value={priceMin}
                  onChange={handlePriceMinChange}
                  disabled={disabled}
                  min="0"
                  step="0.01"
                  className="flex-1"
                />
                <span className="text-muted-foreground">-</span>
                <Input
                  type="number"
                  placeholder={t("filter.maxPrice")}
                  value={priceMax}
                  onChange={handlePriceMaxChange}
                  disabled={disabled}
                  min="0"
                  step="0.01"
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  MDL
                </span>
              </div>
            </div>

            {/* Stock Filter */}
            <div className="flex items-center space-x-2 p-3 rounded-md border bg-muted/30">
              <Checkbox
                id="in-stock-only"
                checked={inStockOnly}
                onCheckedChange={handleInStockChange}
                disabled={disabled}
              />
              <Label
                htmlFor="in-stock-only"
                className="text-sm font-normal cursor-pointer"
              >
                {t("filter.inStockOnly")}
              </Label>
            </div>

            {/* Clear All Button */}
            {activeFilterCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearAll}
                disabled={disabled}
                className="w-full"
              >
                {t("filter.clearAll")}
              </Button>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
