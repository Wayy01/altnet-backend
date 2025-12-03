"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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
  PlusCircle,
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
import { CreatePropertyData, PropertyGroup, PropertyName } from "@/types";
import { cn } from "@/lib/utils";
import { useTranslation, useLocalizedValue } from "@/contexts/language-context";

interface PropertiesTabProps {
  properties: CreatePropertyData[];
  onChange: (properties: CreatePropertyData[]) => void;
}

const VALUE_TYPES = [
  { value: "string", labelKey: "properties.typeText", icon: "Aa" },
  { value: "number", labelKey: "properties.typeNumber", icon: "#" },
  { value: "boolean", labelKey: "properties.typeBoolean", icon: "?" },
  { value: "date", labelKey: "properties.typeDate", icon: "D" },
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
  const { t } = useTranslation("products");
  const { localizeGroupName, localizePropertyName } = useLocalizedValue();
  const [groupOptions, setGroupOptions] = useState<PropertyGroup[]>([]);
  const [propertyNameOptions, setPropertyNameOptions] = useState<Record<string, PropertyName[]>>({});
  const [propertyValueOptions, setPropertyValueOptions] = useState<Record<string, string[]>>({});
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [sectionsVisible, setSectionsVisible] = useState(false);

  // Search states for group selector
  const [groupSearches, setGroupSearches] = useState<Record<number, string>>({});
  const [groupOpens, setGroupOpens] = useState<Record<number, boolean>>({});
  const [nameSearches, setNameSearches] = useState<Record<number, string>>({});
  const [nameOpens, setNameOpens] = useState<Record<number, boolean>>({});
  const [valueSearches, setValueSearches] = useState<Record<number, string>>({});
  const [valueOpens, setValueOpens] = useState<Record<number, boolean>>({});

  // Mode for creating new group/property name
  const [isCreatingNewGroup, setIsCreatingNewGroup] = useState<Record<number, boolean>>({});
  const [isCreatingNewName, setIsCreatingNewName] = useState<Record<number, boolean>>({});

  // Refs for input focus
  const groupInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const nameInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  // Trigger entrance animation
  useEffect(() => {
    const timer = setTimeout(() => setSectionsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Load property groups on mount
  useEffect(() => {
    const loadGroups = async () => {
      try {
        const groups = await api.getPropertyGroupOptionsWithLocalization();
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
      const names = await api.getPropertyNameOptionsWithLocalization(groupName);
      setPropertyNameOptions((prev) => ({ ...prev, [groupName]: names }));
    } catch (error) {
      console.error("Failed to load property names:", error);
    }
  };

  // Load property values when property name is selected
  const loadPropertyValues = async (groupName: string, propertyName: string) => {
    const key = `${groupName}:${propertyName}`;
    if (propertyValueOptions[key]) return;

    try {
      const values = await api.getPropertyValueOptions(groupName, propertyName);
      setPropertyValueOptions((prev) => ({ ...prev, [key]: values }));
    } catch (error) {
      console.error("Failed to load property values:", error);
    }
  };

  // Filter groups based on search (search in all language versions)
  const getFilteredGroups = (index: number) => {
    const search = groupSearches[index] || "";
    if (!search.trim()) return groupOptions;
    const searchLower = search.toLowerCase();
    return groupOptions.filter((group) => {
      const localizedName = localizeGroupName(group).toLowerCase();
      const baseName = group.group_name.toLowerCase();
      return localizedName.includes(searchLower) || baseName.includes(searchLower);
    });
  };

  // Filter names based on search (search in all language versions)
  const getFilteredNames = (index: number, groupName: string) => {
    const names = propertyNameOptions[groupName] || [];
    const search = nameSearches[index] || "";
    if (!search.trim()) return names;
    const searchLower = search.toLowerCase();
    return names.filter((propName) => {
      const localizedName = localizePropertyName(propName).toLowerCase();
      const baseName = propName.property_name.toLowerCase();
      return localizedName.includes(searchLower) || baseName.includes(searchLower);
    });
  };

  // Filter values based on search
  const getFilteredValues = (index: number, groupName: string, propertyName: string) => {
    const key = `${groupName}:${propertyName}`;
    const values = propertyValueOptions[key] || [];
    const search = valueSearches[index] || "";
    if (!search.trim()) return values;
    const searchLower = search.toLowerCase();
    return values.filter((value) => value.toLowerCase().includes(searchLower));
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

  const handleGroupChange = (index: number, group: PropertyGroup | null) => {
    const groupName = group?.group_name || null;
    updateProperty(index, { group_name: groupName, property_name: "" });
    if (groupName) {
      loadPropertyNames(groupName);
    }
    setGroupOpens((prev) => ({ ...prev, [index]: false }));
    setGroupSearches((prev) => ({ ...prev, [index]: "" }));
    setIsCreatingNewGroup((prev) => ({ ...prev, [index]: false }));
  };

  const handleCreateNewGroup = (index: number) => {
    setIsCreatingNewGroup((prev) => ({ ...prev, [index]: true }));
    setGroupOpens((prev) => ({ ...prev, [index]: false }));
    // Focus the input after a short delay to allow DOM update
    setTimeout(() => {
      groupInputRefs.current[index]?.focus();
    }, 50);
  };

  const handleNewGroupInput = (index: number, value: string) => {
    updateProperty(index, { group_name: value, property_name: "" });
  };

  const handleNameChange = (index: number, propName: PropertyName) => {
    const property = properties[index];
    updateProperty(index, { property_name: propName.property_name });
    setNameOpens((prev) => ({ ...prev, [index]: false }));
    setNameSearches((prev) => ({ ...prev, [index]: "" }));
    setIsCreatingNewName((prev) => ({ ...prev, [index]: false }));
    // Load values for this property
    if (property.group_name) {
      loadPropertyValues(property.group_name, propName.property_name);
    }
  };

  const handleCreateNewName = (index: number) => {
    setIsCreatingNewName((prev) => ({ ...prev, [index]: true }));
    setNameOpens((prev) => ({ ...prev, [index]: false }));
    // Focus the input after a short delay to allow DOM update
    setTimeout(() => {
      nameInputRefs.current[index]?.focus();
    }, 50);
  };

  const handleNewNameInput = (index: number, value: string) => {
    updateProperty(index, { property_name: value });
  };

  const handleValueSelect = (index: number, value: string) => {
    updateProperty(index, { value });
    setValueOpens((prev) => ({ ...prev, [index]: false }));
    setValueSearches((prev) => ({ ...prev, [index]: "" }));
  };

  // Helper to get localized display name for a group by its base name
  const getLocalizedGroupDisplay = (groupName: string | null | undefined): string => {
    if (!groupName) return "";
    const group = groupOptions.find(g => g.group_name === groupName);
    return group ? localizeGroupName(group) : groupName;
  };

  // Helper to get localized display name for a property name
  const getLocalizedPropertyNameDisplay = (groupName: string | null | undefined, propertyName: string): string => {
    if (!groupName || !propertyName) return propertyName;
    const names = propertyNameOptions[groupName] || [];
    const propName = names.find(n => n.property_name === propertyName);
    return propName ? localizePropertyName(propName) : propertyName;
  };

  // Summary calculations
  const filterCount = properties.filter((p) => p.is_filter).length;
  const modificationCount = properties.filter((p) => p.is_modification).length;

  return (
    <div className="space-y-4">
      {/* Header - Compact */}
      <div
        className={cn(
          "flex items-center justify-between transition-all duration-300",
          sectionsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        )}
      >
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
            <Settings2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <Label className="text-sm font-semibold">{t("properties.title")}</Label>
            <p className="text-xs text-muted-foreground">
              {t("properties.description")}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addProperty}
          className="rounded-lg hover:bg-primary/10 hover:text-primary hover:border-primary/30"
        >
          <Plus className="mr-2 h-4 w-4" />
          {t("properties.addProperty")}
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
              <p className="font-medium">{t("properties.noProperties")}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {t("properties.noPropertiesHint")}
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
              {t("properties.addFirstProperty")}
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
                            {getLocalizedGroupDisplay(property.group_name)}
                          </Badge>
                        )}
                        <span className="font-medium truncate">
                          {property.property_name ? getLocalizedPropertyNameDisplay(property.group_name, property.property_name) : (
                            <span className="text-muted-foreground">{t("properties.newProperty")}</span>
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
                          {t("properties.useAsFilter")}
                        </Badge>
                      )}
                      {property.is_modification && (
                        <Badge
                          variant="secondary"
                          className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/20"
                        >
                          <Sparkles className="h-3 w-3 mr-1" />
                          {t("properties.isModification")}
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
                  <div className="space-y-3 border-t border-border/50 p-3 bg-muted/10">
                    {/* Group and Name */}
                    <div className="grid gap-3 md:grid-cols-2">
                      {/* Group Selector */}
                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium">{t("properties.group")}</Label>
                        {isCreatingNewGroup[index] ? (
                          <div className="flex gap-2">
                            <Input
                              ref={(el) => { groupInputRefs.current[index] = el; }}
                              value={property.group_name || ""}
                              onChange={(e) => handleNewGroupInput(index, e.target.value)}
                              placeholder={t("properties.typeGroupName")}
                              className="h-9 rounded-lg"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 shrink-0"
                              onClick={() => {
                                setIsCreatingNewGroup((prev) => ({ ...prev, [index]: false }));
                                updateProperty(index, { group_name: null });
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
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
                                  "w-full h-9 justify-between rounded-lg font-normal",
                                  !property.group_name && "text-muted-foreground"
                                )}
                              >
                                {getLocalizedGroupDisplay(property.group_name) || t("properties.selectGroup")}
                                <Layers className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                              <Command shouldFilter={false}>
                                <div className="flex items-center border-b px-3">
                                  <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                  <input
                                    placeholder={t("properties.searchGroups")}
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
                                <CommandList className="max-h-[300px] overflow-y-auto">
                                  <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                                    {t("properties.noGroupsFound")}
                                  </CommandEmpty>
                                  <CommandGroup>
                                    {/* Create new group option */}
                                    <CommandItem
                                      value="__create_new__"
                                      onSelect={() => handleCreateNewGroup(index)}
                                      className="cursor-pointer text-primary"
                                    >
                                      <PlusCircle className="mr-2 h-4 w-4" />
                                      <span>{t("properties.createNewGroup")}</span>
                                    </CommandItem>
                                    {/* No group option */}
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
                                      <span className="text-muted-foreground">{t("properties.noGroup")}</span>
                                    </CommandItem>
                                    {getFilteredGroups(index).map((group) => (
                                      <CommandItem
                                        key={group.group_name}
                                        value={group.group_name}
                                        onSelect={() => handleGroupChange(index, group)}
                                        className="cursor-pointer"
                                      >
                                        <div
                                          className={cn(
                                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                            property.group_name === group.group_name
                                              ? "bg-primary text-primary-foreground"
                                              : "opacity-50"
                                          )}
                                        >
                                          {property.group_name === group.group_name && (
                                            <Check className="h-3 w-3" />
                                          )}
                                        </div>
                                        <span className="truncate">{localizeGroupName(group)}</span>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>

                      {/* Property Name Selector */}
                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium">{t("properties.propertyName")}</Label>
                        {isCreatingNewName[index] ? (
                          <div className="flex gap-2">
                            <Input
                              ref={(el) => { nameInputRefs.current[index] = el; }}
                              value={property.property_name || ""}
                              onChange={(e) => handleNewNameInput(index, e.target.value)}
                              placeholder={t("properties.typePropertyName")}
                              className="h-9 rounded-lg"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 shrink-0"
                              onClick={() => {
                                setIsCreatingNewName((prev) => ({ ...prev, [index]: false }));
                                updateProperty(index, { property_name: "" });
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : property.group_name && propertyNameOptions[property.group_name]?.length ? (
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
                                  "w-full h-9 justify-between rounded-lg font-normal",
                                  !property.property_name && "text-muted-foreground"
                                )}
                              >
                                {getLocalizedPropertyNameDisplay(property.group_name, property.property_name) || t("properties.selectProperty")}
                                <Settings2 className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                              <Command shouldFilter={false}>
                                <div className="flex items-center border-b px-3">
                                  <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                  <input
                                    placeholder={t("properties.searchProperties")}
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
                                <CommandList className="max-h-[300px] overflow-y-auto">
                                  <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                                    {t("properties.noPropertiesFound")}
                                  </CommandEmpty>
                                  <CommandGroup>
                                    {/* Create new property name option */}
                                    <CommandItem
                                      value="__create_new__"
                                      onSelect={() => handleCreateNewName(index)}
                                      className="cursor-pointer text-primary"
                                    >
                                      <PlusCircle className="mr-2 h-4 w-4" />
                                      <span>{t("properties.createNewProperty")}</span>
                                    </CommandItem>
                                    {getFilteredNames(index, property.group_name!).map((propName) => (
                                      <CommandItem
                                        key={propName.property_name}
                                        value={propName.property_name}
                                        onSelect={() => handleNameChange(index, propName)}
                                        className="cursor-pointer"
                                      >
                                        <div
                                          className={cn(
                                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                            property.property_name === propName.property_name
                                              ? "bg-primary text-primary-foreground"
                                              : "opacity-50"
                                          )}
                                        >
                                          {property.property_name === propName.property_name && (
                                            <Check className="h-3 w-3" />
                                          )}
                                        </div>
                                        <span className="truncate">{localizePropertyName(propName)}</span>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        ) : (
                          <div className="flex gap-2">
                            <Input
                              value={property.property_name}
                              onChange={(e) =>
                                updateProperty(index, { property_name: e.target.value })
                              }
                              placeholder={t("properties.propertyPlaceholder")}
                              className="h-9 rounded-lg"
                            />
                            {property.group_name && !propertyNameOptions[property.group_name]?.length && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 shrink-0"
                                onClick={() => loadPropertyNames(property.group_name!)}
                              >
                                <Search className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Value and Type */}
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium">{t("properties.value")}</Label>
                        {property.group_name && property.property_name ? (
                          <Popover
                            open={valueOpens[index] || false}
                            onOpenChange={(open) => {
                              setValueOpens((prev) => ({ ...prev, [index]: open }));
                              if (open && property.group_name && property.property_name) {
                                loadPropertyValues(property.group_name, property.property_name);
                              }
                            }}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  "w-full h-9 justify-between rounded-lg font-normal",
                                  !property.value && "text-muted-foreground"
                                )}
                              >
                                <span className="truncate">{property.value || t("properties.selectOrTypeValue")}</span>
                                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                              <Command shouldFilter={false}>
                                <div className="flex items-center border-b px-3">
                                  <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                  <input
                                    placeholder={t("properties.searchValues")}
                                    value={valueSearches[index] || ""}
                                    onChange={(e) => {
                                      setValueSearches((prev) => ({
                                        ...prev,
                                        [index]: e.target.value,
                                      }));
                                      // Also update the property value as user types
                                      updateProperty(index, { value: e.target.value });
                                    }}
                                    className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                                  />
                                </div>
                                <CommandList className="max-h-[200px] overflow-y-auto">
                                  {(() => {
                                    const key = `${property.group_name}:${property.property_name}`;
                                    const existingValues = propertyValueOptions[key] || [];
                                    const filteredValues = getFilteredValues(index, property.group_name!, property.property_name);
                                    const currentSearch = valueSearches[index] || "";

                                    // Show "use typed value" option if user has typed something that's not an exact match
                                    const showTypedOption = currentSearch && !existingValues.includes(currentSearch);

                                    return (
                                      <>
                                        {filteredValues.length === 0 && !showTypedOption && (
                                          <div className="py-6 text-center text-sm text-muted-foreground">
                                            {t("properties.noValuesFound")}
                                            <p className="mt-1 text-xs">{t("properties.typeNewValue")}</p>
                                          </div>
                                        )}
                                        <CommandGroup>
                                          {showTypedOption && (
                                            <CommandItem
                                              value={`__typed__${currentSearch}`}
                                              onSelect={() => handleValueSelect(index, currentSearch)}
                                              className="cursor-pointer text-primary"
                                            >
                                              <PlusCircle className="mr-2 h-4 w-4" />
                                              <span>Use &quot;{currentSearch}&quot;</span>
                                            </CommandItem>
                                          )}
                                          {filteredValues.map((value) => (
                                            <CommandItem
                                              key={value}
                                              value={value}
                                              onSelect={() => handleValueSelect(index, value)}
                                              className="cursor-pointer"
                                            >
                                              <div
                                                className={cn(
                                                  "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                  property.value === value
                                                    ? "bg-primary text-primary-foreground"
                                                    : "opacity-50"
                                                )}
                                              >
                                                {property.value === value && (
                                                  <Check className="h-3 w-3" />
                                                )}
                                              </div>
                                              <span className="truncate">{value}</span>
                                            </CommandItem>
                                          ))}
                                        </CommandGroup>
                                      </>
                                    );
                                  })()}
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        ) : (
                          <Input
                            value={property.value}
                            onChange={(e) =>
                              updateProperty(index, { value: e.target.value })
                            }
                            placeholder={t("properties.valuePlaceholder")}
                            className="h-9 rounded-lg"
                          />
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium">{t("properties.valueType")}</Label>
                        <Select
                          value={property.value_type || "string"}
                          onValueChange={(value) =>
                            updateProperty(index, { value_type: value })
                          }
                        >
                          <SelectTrigger className="h-9 rounded-lg">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {VALUE_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono text-muted-foreground w-4">
                                    {type.icon}
                                  </span>
                                  {t(type.labelKey)}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Code and Sort Order */}
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium">{t("properties.propertyCode")}</Label>
                        <Input
                          value={property.property_code || ""}
                          onChange={(e) =>
                            updateProperty(index, {
                              property_code: e.target.value || null,
                            })
                          }
                          placeholder={t("properties.propertyCodePlaceholder")}
                          className="h-9 rounded-lg font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium">{t("properties.sortOrder")}</Label>
                        <Input
                          type="number"
                          value={property.sort_order}
                          onChange={(e) =>
                            updateProperty(index, {
                              sort_order: parseInt(e.target.value) || 0,
                            })
                          }
                          className="h-9 rounded-lg tabular-nums"
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
                            {t("properties.useAsFilter")}
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
                            {t("properties.isModification")}
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
                        {t("properties.removeProperty")}
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
            {t("properties.addAnotherProperty")}
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
              <p className="text-xs text-muted-foreground">{t("properties.totalProperties")}</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold tabular-nums text-primary">{filterCount}</p>
              <p className="text-xs text-muted-foreground">{t("properties.filterProperties")}</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold tabular-nums text-amber-600">{modificationCount}</p>
              <p className="text-xs text-muted-foreground">{t("properties.modifications")}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
