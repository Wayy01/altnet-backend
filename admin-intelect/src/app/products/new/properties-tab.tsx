"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Plus,
  Trash2,
  ChevronDown,
  GripVertical,
  Settings2,
  Search,
  X,
  Check,
  Layers,
  Filter,
  Sparkles,
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
import { CreatePropertyData } from "@/types";
import { cn } from "@/lib/utils";

interface PropertiesTabProps {
  properties: CreatePropertyData[];
  onChange: (properties: CreatePropertyData[]) => void;
}

const VALUE_TYPES = [
  { value: "string", label: "Text", icon: "Aa" },
  { value: "number", label: "Number", icon: "#" },
  { value: "boolean", label: "Boolean", icon: "?" },
  { value: "date", label: "Date", icon: "D" },
];

const emptyProperty: CreatePropertyData = {
  property_name: "",
  property_code: null,
  value: "",
  value_type: "string",
  group_uuid: null,
  group_name: null,
  sort_order: 0,
  is_filter: false,
  is_modification: false,
};

/**
 * Premium Properties Tab with searchable group/name selectors and collapsible items
 * Features elegant animations, hover effects, and intuitive form controls
 */
export function PropertiesTab({ properties, onChange }: PropertiesTabProps) {
  const [groupOptions, setGroupOptions] = useState<string[]>([]);
  const [propertyNameOptions, setPropertyNameOptions] = useState<Record<string, string[]>>({});
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [sectionsVisible, setSectionsVisible] = useState(false);

  // Search states for group selector
  const [groupSearches, setGroupSearches] = useState<Record<number, string>>({});
  const [groupOpens, setGroupOpens] = useState<Record<number, boolean>>({});
  const [nameSearches, setNameSearches] = useState<Record<number, string>>({});
  const [nameOpens, setNameOpens] = useState<Record<number, boolean>>({});

  // Trigger entrance animation
  useEffect(() => {
    const timer = setTimeout(() => setSectionsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Load property groups on mount
  useEffect(() => {
    const loadGroups = async () => {
      try {
        const groups = await api.getPropertyGroupOptions();
        setGroupOptions(groups);
      } catch (error) {
        console.error("Failed to load property groups:", error);
      } finally {
        setIsLoadingGroups(false);
      }
    };
    loadGroups();
  }, []);

  // Load property names when group changes
  const loadPropertyNames = async (groupName: string) => {
    if (propertyNameOptions[groupName]) return;

    try {
      const names = await api.getPropertyNameOptions(groupName);
      setPropertyNameOptions((prev) => ({ ...prev, [groupName]: names }));
    } catch (error) {
      console.error("Failed to load property names:", error);
    }
  };

  // Filter groups based on search
  const getFilteredGroups = (index: number) => {
    const search = groupSearches[index] || "";
    if (!search.trim()) return groupOptions;
    const searchLower = search.toLowerCase();
    return groupOptions.filter((group) =>
      group.toLowerCase().includes(searchLower)
    );
  };

  // Filter names based on search
  const getFilteredNames = (index: number, groupName: string) => {
    const names = propertyNameOptions[groupName] || [];
    const search = nameSearches[index] || "";
    if (!search.trim()) return names;
    const searchLower = search.toLowerCase();
    return names.filter((name) => name.toLowerCase().includes(searchLower));
  };

  const addProperty = () => {
    const newProperty = { ...emptyProperty, sort_order: properties.length };
    onChange([...properties, newProperty]);
    setExpandedIndex(properties.length);
  };

  const removeProperty = (index: number) => {
    onChange(properties.filter((_, i) => i !== index));
    if (expandedIndex === index) {
      setExpandedIndex(null);
    }
  };

  const updateProperty = (index: number, updates: Partial<CreatePropertyData>) => {
    const updatedProperties = [...properties];
    updatedProperties[index] = { ...updatedProperties[index], ...updates };
    onChange(updatedProperties);
  };

  const handleGroupChange = (index: number, groupName: string | null) => {
    updateProperty(index, { group_name: groupName, property_name: "" });
    if (groupName) {
      loadPropertyNames(groupName);
    }
    setGroupOpens((prev) => ({ ...prev, [index]: false }));
    setGroupSearches((prev) => ({ ...prev, [index]: "" }));
  };

  const handleNameChange = (index: number, name: string) => {
    updateProperty(index, { property_name: name });
    setNameOpens((prev) => ({ ...prev, [index]: false }));
    setNameSearches((prev) => ({ ...prev, [index]: "" }));
  };

  // Summary calculations
  const filterCount = properties.filter((p) => p.is_filter).length;
  const modificationCount = properties.filter((p) => p.is_modification).length;

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
            <Settings2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <Label className="text-base font-semibold">Product Properties</Label>
            <p className="text-sm text-muted-foreground">
              Add specifications and attributes for this product
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addProperty}
          className={cn(
            "rounded-lg transition-all duration-200",
            "hover:bg-primary/10 hover:text-primary hover:border-primary/30",
            "hover:shadow-sm hover:-translate-y-0.5"
          )}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Property
        </Button>
      </div>

      {/* Empty State */}
      {properties.length === 0 ? (
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
              <Layers className="h-7 w-7 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">No properties added yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Click &quot;Add Property&quot; to add product specifications
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addProperty}
              className="mt-2 rounded-lg transition-all duration-200 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add First Property
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {properties.map((property, index) => (
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
                      "flex cursor-pointer items-center gap-3 p-4",
                      "transition-colors duration-200 hover:bg-muted/30"
                    )}
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {property.group_name && (
                          <Badge
                            variant="outline"
                            className="text-xs bg-muted/50 border-border/50"
                          >
                            {property.group_name}
                          </Badge>
                        )}
                        <span className="font-medium truncate">
                          {property.property_name || (
                            <span className="text-muted-foreground">New Property</span>
                          )}
                        </span>
                      </div>
                      {property.value && (
                        <p className="text-sm text-muted-foreground truncate mt-0.5">
                          {property.value}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {property.is_filter && (
                        <Badge
                          variant="secondary"
                          className="text-xs bg-primary/10 text-primary border-primary/20"
                        >
                          <Filter className="h-3 w-3 mr-1" />
                          Filter
                        </Badge>
                      )}
                      {property.is_modification && (
                        <Badge
                          variant="secondary"
                          className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/20"
                        >
                          <Sparkles className="h-3 w-3 mr-1" />
                          Mod
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
                    {/* Group and Name */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Group Selector */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Group</Label>
                        <Popover
                          open={groupOpens[index] || false}
                          onOpenChange={(open) =>
                            setGroupOpens((prev) => ({ ...prev, [index]: open }))
                          }
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              disabled={isLoadingGroups}
                              className={cn(
                                "w-full h-10 justify-between rounded-lg font-normal",
                                "transition-all duration-200",
                                "hover:border-primary/50 hover:bg-muted/30",
                                !property.group_name && "text-muted-foreground"
                              )}
                            >
                              {property.group_name || "Select group..."}
                              <Layers className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                            <Command shouldFilter={false}>
                              <div className="flex items-center border-b px-3">
                                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                <input
                                  placeholder="Search groups..."
                                  value={groupSearches[index] || ""}
                                  onChange={(e) =>
                                    setGroupSearches((prev) => ({
                                      ...prev,
                                      [index]: e.target.value,
                                    }))
                                  }
                                  className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                                />
                              </div>
                              <CommandList className="max-h-[200px] overflow-y-auto">
                                <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                                  No groups found
                                </CommandEmpty>
                                <CommandGroup>
                                  <CommandItem
                                    value="none"
                                    onSelect={() => handleGroupChange(index, null)}
                                    className="cursor-pointer"
                                  >
                                    <div
                                      className={cn(
                                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                        !property.group_name
                                          ? "bg-primary text-primary-foreground"
                                          : "opacity-50"
                                      )}
                                    >
                                      {!property.group_name && <Check className="h-3 w-3" />}
                                    </div>
                                    <span className="text-muted-foreground">No group</span>
                                  </CommandItem>
                                  {getFilteredGroups(index).map((group) => (
                                    <CommandItem
                                      key={group}
                                      value={group}
                                      onSelect={() => handleGroupChange(index, group)}
                                      className="cursor-pointer"
                                    >
                                      <div
                                        className={cn(
                                          "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                          property.group_name === group
                                            ? "bg-primary text-primary-foreground"
                                            : "opacity-50"
                                        )}
                                      >
                                        {property.group_name === group && (
                                          <Check className="h-3 w-3" />
                                        )}
                                      </div>
                                      <span className="truncate">{group}</span>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Property Name Selector */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Property Name</Label>
                        {property.group_name && propertyNameOptions[property.group_name]?.length ? (
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
                                className={cn(
                                  "w-full h-10 justify-between rounded-lg font-normal",
                                  "transition-all duration-200",
                                  "hover:border-primary/50 hover:bg-muted/30",
                                  !property.property_name && "text-muted-foreground"
                                )}
                              >
                                {property.property_name || "Select property..."}
                                <Settings2 className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                              <Command shouldFilter={false}>
                                <div className="flex items-center border-b px-3">
                                  <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                  <input
                                    placeholder="Search properties..."
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
                                    No properties found
                                  </CommandEmpty>
                                  <CommandGroup>
                                    {getFilteredNames(index, property.group_name!).map((name) => (
                                      <CommandItem
                                        key={name}
                                        value={name}
                                        onSelect={() => handleNameChange(index, name)}
                                        className="cursor-pointer"
                                      >
                                        <div
                                          className={cn(
                                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                            property.property_name === name
                                              ? "bg-primary text-primary-foreground"
                                              : "opacity-50"
                                          )}
                                        >
                                          {property.property_name === name && (
                                            <Check className="h-3 w-3" />
                                          )}
                                        </div>
                                        <span className="truncate">{name}</span>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        ) : (
                          <Input
                            value={property.property_name}
                            onChange={(e) =>
                              updateProperty(index, { property_name: e.target.value })
                            }
                            placeholder="e.g., Color, Size, Weight"
                            className={cn(
                              "h-10 rounded-lg transition-all duration-200",
                              "focus:ring-2 focus:ring-primary/20 focus:border-primary",
                              "hover:border-primary/50"
                            )}
                          />
                        )}
                      </div>
                    </div>

                    {/* Value and Type */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Value</Label>
                        <Input
                          value={property.value}
                          onChange={(e) =>
                            updateProperty(index, { value: e.target.value })
                          }
                          placeholder="Property value"
                          className={cn(
                            "h-10 rounded-lg transition-all duration-200",
                            "focus:ring-2 focus:ring-primary/20 focus:border-primary",
                            "hover:border-primary/50"
                          )}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Value Type</Label>
                        <Select
                          value={property.value_type || "string"}
                          onValueChange={(value) =>
                            updateProperty(index, { value_type: value })
                          }
                        >
                          <SelectTrigger className="h-10 rounded-lg transition-all duration-200 hover:border-primary/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {VALUE_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono text-muted-foreground w-4">
                                    {type.icon}
                                  </span>
                                  {type.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Code and Sort Order */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Property Code</Label>
                        <Input
                          value={property.property_code || ""}
                          onChange={(e) =>
                            updateProperty(index, {
                              property_code: e.target.value || null,
                            })
                          }
                          placeholder="Optional code"
                          className={cn(
                            "h-10 rounded-lg font-mono transition-all duration-200",
                            "focus:ring-2 focus:ring-primary/20 focus:border-primary",
                            "hover:border-primary/50"
                          )}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Sort Order</Label>
                        <Input
                          type="number"
                          value={property.sort_order}
                          onChange={(e) =>
                            updateProperty(index, {
                              sort_order: parseInt(e.target.value) || 0,
                            })
                          }
                          className={cn(
                            "h-10 rounded-lg tabular-nums transition-all duration-200",
                            "focus:ring-2 focus:ring-primary/20 focus:border-primary",
                            "hover:border-primary/50"
                          )}
                        />
                      </div>
                    </div>

                    {/* Switches */}
                    <div className="rounded-lg border border-border/50 bg-background p-3">
                      <div className="flex flex-wrap items-center gap-6">
                        <div className="flex items-center gap-3">
                          <Switch
                            id={`is_filter_${index}`}
                            checked={property.is_filter}
                            onCheckedChange={(checked) =>
                              updateProperty(index, { is_filter: checked })
                            }
                            className="data-[state=checked]:bg-primary"
                          />
                          <Label
                            htmlFor={`is_filter_${index}`}
                            className="text-sm font-normal flex items-center gap-1.5 cursor-pointer"
                          >
                            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                            Use as filter
                          </Label>
                        </div>
                        <div className="flex items-center gap-3">
                          <Switch
                            id={`is_modification_${index}`}
                            checked={property.is_modification}
                            onCheckedChange={(checked) =>
                              updateProperty(index, { is_modification: checked })
                            }
                            className="data-[state=checked]:bg-amber-500"
                          />
                          <Label
                            htmlFor={`is_modification_${index}`}
                            className="text-sm font-normal flex items-center gap-1.5 cursor-pointer"
                          >
                            <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                            Is modification
                          </Label>
                        </div>
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
                        onClick={() => removeProperty(index)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove Property
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
      {properties.length > 0 && (
        <div
          className={cn(
            "flex justify-center pt-2 transition-all duration-300",
            sectionsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}
          style={{ transitionDelay: sectionsVisible ? `${properties.length * 50 + 100}ms` : "0ms" }}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addProperty}
            className={cn(
              "rounded-lg transition-all duration-200",
              "hover:bg-primary/10 hover:text-primary hover:border-primary/30"
            )}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Another Property
          </Button>
        </div>
      )}

      {/* Summary Stats */}
      {properties.length > 0 && (
        <div
          className={cn(
            "rounded-xl border border-border/50 bg-muted/30 p-4 transition-all duration-300",
            sectionsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}
          style={{ transitionDelay: sectionsVisible ? `${properties.length * 50 + 150}ms` : "0ms" }}
        >
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="space-y-1">
              <p className="text-2xl font-bold tabular-nums">{properties.length}</p>
              <p className="text-xs text-muted-foreground">Total Properties</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold tabular-nums text-primary">{filterCount}</p>
              <p className="text-xs text-muted-foreground">Filter Properties</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold tabular-nums text-amber-600">{modificationCount}</p>
              <p className="text-xs text-muted-foreground">Modifications</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
