"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Plus,
  Trash2,
  ChevronDown,
  DollarSign,
  Package,
  Tags,
  Search,
  Check,
  Hash,
  Warehouse,
  Store,
  Activity,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { api } from "@/lib/api";
import { CreateCharacteristicData, CreatePriceData } from "@/types";
import { cn } from "@/lib/utils";

interface CharacteristicsTabProps {
  characteristics: CreateCharacteristicData[];
  onChange: (characteristics: CreateCharacteristicData[]) => void;
}

const CURRENCIES = [
  { code: "MDL", symbol: "L", label: "Moldovan Leu" },
  { code: "EUR", symbol: "E", label: "Euro" },
  { code: "USD", symbol: "$", label: "US Dollar" },
];

const PRICE_TYPES = [
  { value: "retail", label: "Retail" },
  { value: "wholesale", label: "Wholesale" },
  { value: "special", label: "Special" },
];

const emptyCharacteristic: CreateCharacteristicData = {
  name: "",
  code: null,
  reference: null,
  prices: [
    { price: 0, currency: "MDL", type: "retail" },
    { price: 0, currency: "EUR", type: "retail" },
    { price: 0, currency: "USD", type: "retail" },
  ],
  stock_warehouse: 0,
  stock_showroom: 0,
  is_active: true,
};

/**
 * Premium Characteristics (SKUs) Tab with searchable name selector
 * Features elegant card-based layout with pricing inputs and stock management
 */
export function CharacteristicsTab({
  characteristics,
  onChange,
}: CharacteristicsTabProps) {
  const [characteristicNames, setCharacteristicNames] = useState<string[]>([]);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sectionsVisible, setSectionsVisible] = useState(false);

  // Search and popover states
  const [nameSearches, setNameSearches] = useState<Record<number, string>>({});
  const [nameOpens, setNameOpens] = useState<Record<number, boolean>>({});

  // Trigger entrance animation
  useEffect(() => {
    const timer = setTimeout(() => setSectionsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Load characteristic names on mount
  useEffect(() => {
    const loadNames = async () => {
      try {
        const names = await api.getCharacteristicNameOptions();
        setCharacteristicNames(names);
      } catch (error) {
        console.error("Failed to load characteristic names:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadNames();
  }, []);

  // Filter names based on search
  const getFilteredNames = (index: number) => {
    const search = nameSearches[index] || "";
    if (!search.trim()) return characteristicNames;
    const searchLower = search.toLowerCase();
    return characteristicNames.filter((name) =>
      name.toLowerCase().includes(searchLower)
    );
  };

  const addCharacteristic = () => {
    onChange([...characteristics, { ...emptyCharacteristic }]);
    setExpandedIndex(characteristics.length);
  };

  const removeCharacteristic = (index: number) => {
    onChange(characteristics.filter((_, i) => i !== index));
    if (expandedIndex === index) {
      setExpandedIndex(null);
    }
  };

  const updateCharacteristic = (
    index: number,
    updates: Partial<CreateCharacteristicData>
  ) => {
    const updated = [...characteristics];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const updatePrice = (
    charIndex: number,
    priceIndex: number,
    updates: Partial<CreatePriceData>
  ) => {
    const updated = [...characteristics];
    const prices = [...updated[charIndex].prices];
    prices[priceIndex] = { ...prices[priceIndex], ...updates };
    updated[charIndex] = { ...updated[charIndex], prices };
    onChange(updated);
  };

  const handleNameSelect = (index: number, name: string) => {
    updateCharacteristic(index, { name });
    setNameOpens((prev) => ({ ...prev, [index]: false }));
    setNameSearches((prev) => ({ ...prev, [index]: "" }));
  };

  const getTotalStock = (char: CreateCharacteristicData) =>
    (char.stock_warehouse || 0) + (char.stock_showroom || 0);

  const getMainPrice = (char: CreateCharacteristicData) => {
    const mdlPrice = char.prices.find((p) => p.currency === "MDL");
    return mdlPrice?.price || 0;
  };

  // Summary calculations
  const totalStock = characteristics.reduce((sum, c) => sum + getTotalStock(c), 0);
  const activeCount = characteristics.filter((c) => c.is_active).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between transition-all duration-300",
          sectionsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
            <Tags className="h-5 w-5 text-primary" />
          </div>
          <div>
            <Label className="text-base font-semibold">Product SKUs / Characteristics</Label>
            <p className="text-sm text-muted-foreground">
              Add variants with individual prices and stock levels
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addCharacteristic}
          className={cn(
            "rounded-lg transition-all duration-200",
            "hover:bg-primary/10 hover:text-primary hover:border-primary/30",
            "hover:shadow-sm hover:-translate-y-0.5"
          )}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add SKU
        </Button>
      </div>

      {/* Empty State */}
      {characteristics.length === 0 ? (
        <div
          className={cn(
            "rounded-xl border-2 border-dashed border-border/50 p-12 text-center",
            "transition-all duration-300",
            sectionsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}
          style={{ transitionDelay: sectionsVisible ? "100ms" : "0ms" }}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Tags className="h-7 w-7 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">No SKUs added yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Click &quot;Add SKU&quot; to add product variants with prices and stock
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addCharacteristic}
              className="mt-2 rounded-lg transition-all duration-200 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add First SKU
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {characteristics.map((char, index) => (
            <Collapsible
              key={index}
              open={expandedIndex === index}
              onOpenChange={(open) => setExpandedIndex(open ? index : null)}
            >
              <div
                className={cn(
                  "rounded-xl border border-border/50 bg-card overflow-hidden",
                  "transition-all duration-300",
                  sectionsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
                  expandedIndex === index && "ring-2 ring-primary/20 border-primary/30"
                )}
                style={{ transitionDelay: sectionsVisible ? `${index * 50}ms` : "0ms" }}
              >
                <CollapsibleTrigger asChild>
                  <div
                    className={cn(
                      "flex cursor-pointer items-center gap-4 p-4",
                      "transition-colors duration-200 hover:bg-muted/30"
                    )}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted border border-border/50">
                      <Hash className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {char.name || (
                            <span className="text-muted-foreground">New SKU</span>
                          )}
                        </span>
                        {char.code && (
                          <Badge variant="outline" className="text-xs font-mono bg-muted/50">
                            {char.code}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3.5 w-3.5" />
                          {getMainPrice(char).toFixed(2)} MDL
                        </span>
                        <span className="flex items-center gap-1">
                          <Package className="h-3.5 w-3.5" />
                          {getTotalStock(char)} units
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!char.is_active && (
                        <Badge
                          variant="secondary"
                          className="text-xs bg-muted text-muted-foreground"
                        >
                          Inactive
                        </Badge>
                      )}
                      {char.is_active && (
                        <Badge
                          variant="secondary"
                          className="text-xs bg-green-500/10 text-green-600 border-green-500/20"
                        >
                          <Activity className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      )}
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 text-muted-foreground transition-transform duration-200",
                          expandedIndex === index && "rotate-180"
                        )}
                      />
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-4 border-t border-border/50 p-4 bg-muted/10">
                    {/* Name and Code */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* SKU Name Selector */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">SKU Name</Label>
                        {characteristicNames.length > 0 ? (
                          <Popover
                            open={nameOpens[index] || false}
                            onOpenChange={(open) =>
                              setNameOpens((prev) => ({ ...prev, [index]: open }))
                            }
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                disabled={isLoading}
                                className={cn(
                                  "w-full h-10 justify-between rounded-lg font-normal",
                                  "transition-all duration-200",
                                  "hover:border-primary/50 hover:bg-muted/30",
                                  !char.name && "text-muted-foreground"
                                )}
                              >
                                {isLoading
                                  ? "Loading..."
                                  : char.name || "Select or type name..."}
                                <Tags className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                              <Command shouldFilter={false}>
                                <div className="flex items-center border-b px-3">
                                  <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                  <input
                                    placeholder="Search characteristics..."
                                    value={nameSearches[index] || ""}
                                    onChange={(e) =>
                                      setNameSearches((prev) => ({
                                        ...prev,
                                        [index]: e.target.value,
                                      }))
                                    }
                                    className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                                  />
                                </div>
                                <CommandList className="max-h-[200px] overflow-y-auto">
                                  <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                                    No characteristics found
                                  </CommandEmpty>
                                  <CommandGroup>
                                    {getFilteredNames(index).map((name) => (
                                      <CommandItem
                                        key={name}
                                        value={name}
                                        onSelect={() => handleNameSelect(index, name)}
                                        className="cursor-pointer"
                                      >
                                        <div
                                          className={cn(
                                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                            char.name === name
                                              ? "bg-primary text-primary-foreground"
                                              : "opacity-50"
                                          )}
                                        >
                                          {char.name === name && (
                                            <Check className="h-3 w-3" />
                                          )}
                                        </div>
                                        <span className="truncate">{name}</span>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                                {characteristicNames.length > 10 && (
                                  <div className="border-t px-3 py-2 text-xs text-muted-foreground">
                                    {getFilteredNames(index).length} of {characteristicNames.length} characteristics
                                  </div>
                                )}
                              </Command>
                            </PopoverContent>
                          </Popover>
                        ) : (
                          <Input
                            value={char.name}
                            onChange={(e) =>
                              updateCharacteristic(index, { name: e.target.value })
                            }
                            placeholder="e.g., Size XL, Color Red"
                            className={cn(
                              "h-10 rounded-lg transition-all duration-200",
                              "focus:ring-2 focus:ring-primary/20 focus:border-primary",
                              "hover:border-primary/50"
                            )}
                          />
                        )}
                      </div>
                      {/* SKU Code */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">SKU Code</Label>
                        <Input
                          value={char.code || ""}
                          onChange={(e) =>
                            updateCharacteristic(index, {
                              code: e.target.value || null,
                            })
                          }
                          placeholder="e.g., SKU-001"
                          className={cn(
                            "h-10 rounded-lg font-mono transition-all duration-200",
                            "focus:ring-2 focus:ring-primary/20 focus:border-primary",
                            "hover:border-primary/50"
                          )}
                        />
                      </div>
                    </div>

                    {/* Reference */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Reference</Label>
                      <Input
                        value={char.reference || ""}
                        onChange={(e) =>
                          updateCharacteristic(index, {
                            reference: e.target.value || null,
                          })
                        }
                        placeholder="External reference (optional)"
                        className={cn(
                          "h-10 rounded-lg transition-all duration-200",
                          "focus:ring-2 focus:ring-primary/20 focus:border-primary",
                          "hover:border-primary/50"
                        )}
                      />
                    </div>

                    {/* Prices */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        Prices
                      </Label>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {char.prices.map((price, priceIndex) => {
                          const currencyInfo = CURRENCIES.find(
                            (c) => c.code === price.currency
                          );
                          return (
                            <div key={price.currency} className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                <span className="font-medium">{price.currency}</span>
                                <span>({currencyInfo?.symbol})</span>
                              </Label>
                              <div className="relative">
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={price.price}
                                  onChange={(e) =>
                                    updatePrice(index, priceIndex, {
                                      price: parseFloat(e.target.value) || 0,
                                    })
                                  }
                                  className={cn(
                                    "h-10 rounded-lg pr-10 tabular-nums transition-all duration-200",
                                    "focus:ring-2 focus:ring-primary/20 focus:border-primary",
                                    "hover:border-primary/50"
                                  )}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                  {currencyInfo?.symbol}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Stock */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        Stock Levels
                      </Label>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1">
                            <Warehouse className="h-3 w-3" />
                            Warehouse
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            value={char.stock_warehouse}
                            onChange={(e) =>
                              updateCharacteristic(index, {
                                stock_warehouse: parseInt(e.target.value) || 0,
                              })
                            }
                            className={cn(
                              "h-10 rounded-lg tabular-nums transition-all duration-200",
                              "focus:ring-2 focus:ring-primary/20 focus:border-primary",
                              "hover:border-primary/50"
                            )}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1">
                            <Store className="h-3 w-3" />
                            Showroom
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            value={char.stock_showroom}
                            onChange={(e) =>
                              updateCharacteristic(index, {
                                stock_showroom: parseInt(e.target.value) || 0,
                              })
                            }
                            className={cn(
                              "h-10 rounded-lg tabular-nums transition-all duration-200",
                              "focus:ring-2 focus:ring-primary/20 focus:border-primary",
                              "hover:border-primary/50"
                            )}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Total</Label>
                          <div className="flex h-10 items-center rounded-lg border border-border/50 bg-muted/30 px-3 text-sm tabular-nums font-medium">
                            {getTotalStock(char)} units
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Active Switch */}
                    <div className="rounded-lg border border-border/50 bg-background p-3">
                      <div className="flex items-center gap-3">
                        <Switch
                          id={`is_active_${index}`}
                          checked={char.is_active}
                          onCheckedChange={(checked) =>
                            updateCharacteristic(index, { is_active: checked })
                          }
                          className="data-[state=checked]:bg-green-500"
                        />
                        <Label
                          htmlFor={`is_active_${index}`}
                          className="text-sm font-normal flex items-center gap-1.5 cursor-pointer"
                        >
                          <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                          Active
                        </Label>
                      </div>
                    </div>

                    {/* Remove Button */}
                    <div className="flex justify-end pt-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "rounded-lg transition-all duration-200",
                          "text-destructive hover:bg-destructive/10 hover:text-destructive"
                        )}
                        onClick={() => removeCharacteristic(index)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove SKU
                      </Button>
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))}
        </div>
      )}

      {/* Add Another Button */}
      {characteristics.length > 0 && (
        <div
          className={cn(
            "flex justify-center pt-2 transition-all duration-300",
            sectionsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}
          style={{ transitionDelay: sectionsVisible ? `${characteristics.length * 50 + 100}ms` : "0ms" }}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addCharacteristic}
            className={cn(
              "rounded-lg transition-all duration-200",
              "hover:bg-primary/10 hover:text-primary hover:border-primary/30"
            )}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Another SKU
          </Button>
        </div>
      )}

      {/* Summary Stats */}
      {characteristics.length > 0 && (
        <div
          className={cn(
            "rounded-xl border border-border/50 bg-muted/30 p-4 transition-all duration-300",
            sectionsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}
          style={{ transitionDelay: sectionsVisible ? `${characteristics.length * 50 + 150}ms` : "0ms" }}
        >
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="space-y-1">
              <p className="text-2xl font-bold tabular-nums">{characteristics.length}</p>
              <p className="text-xs text-muted-foreground">Total SKUs</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold tabular-nums">{totalStock}</p>
              <p className="text-xs text-muted-foreground">Total Stock</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold tabular-nums text-green-600">{activeCount}</p>
              <p className="text-xs text-muted-foreground">Active SKUs</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
