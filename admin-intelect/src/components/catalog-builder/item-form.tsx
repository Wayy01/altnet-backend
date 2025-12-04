"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "@/contexts/language-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Loader2, Languages, Link, Filter } from "lucide-react";
import { CatalogItem, CatalogItemInput, CatalogItemType, CatalogFilterConfig } from "@/types/catalog";
import { Category } from "@/types";
import { useCreateItem, useUpdateItem } from "@/hooks/use-catalog";
import { api } from "@/lib/api";
import { FilterConfig } from "./filter-config";

interface ItemFormProps {
  item?: CatalogItem;
  groupId: string; // Required - which group this item belongs to
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ItemForm({
  item,
  groupId,
  open,
  onOpenChange,
  onSuccess,
}: ItemFormProps) {
  const { t } = useTranslation("catalogBuilder");
  const isEdit = !!item;
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();

  // Form state
  const [nameRo, setNameRo] = useState("");
  const [nameRu, setNameRu] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [itemType, setItemType] = useState<CatalogItemType>("category_link");
  const [categoryId, setCategoryId] = useState("");
  const [filterConfig, setFilterConfig] = useState<CatalogFilterConfig | null>(null);
  const [isActive, setIsActive] = useState(true);

  // Categories dropdown
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [shakeField, setShakeField] = useState<string | null>(null);

  // Load categories for dropdown
  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const loadCategories = async () => {
      try {
        setLoadingCategories(true);
        const data = await api.getAllCategories();
        if (!cancelled) {
          setCategories(data);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load categories:", error);
        }
      } finally {
        if (!cancelled) {
          setLoadingCategories(false);
        }
      }
    };

    loadCategories();

    return () => {
      cancelled = true;
    };
  }, [open]);

  // Initialize form with item data when editing
  useEffect(() => {
    if (item && open) {
      setNameRo(item.name_ro);
      setNameRu(item.name_ru || "");
      setNameEn(item.name_en || "");
      setItemType(item.item_type);
      setCategoryId(item.category_id || "");
      setFilterConfig(item.filter_config || null);
      setIsActive(item.is_active);
      setErrors({});
      setShakeField(null);
    } else if (!item && open) {
      // Reset form for create mode
      setNameRo("");
      setNameRu("");
      setNameEn("");
      setItemType("category_link");
      setCategoryId("");
      setFilterConfig(null);
      setIsActive(true);
      setErrors({});
      setShakeField(null);
    }
  }, [item, open]);

  // Handle shake animation
  useEffect(() => {
    if (shakeField) {
      const timer = setTimeout(() => setShakeField(null), 500);
      return () => clearTimeout(timer);
    }
  }, [shakeField]);

  // Validate form
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!nameRo.trim()) {
      newErrors.nameRo = t("item.required");
    }

    if (itemType === "category_link" && !categoryId) {
      newErrors.categoryId = t("item.categoryRequired");
    }

    setErrors(newErrors);

    // Trigger shake animation on error
    if (Object.keys(newErrors).length > 0) {
      setShakeField(Object.keys(newErrors)[0]);
    }

    return Object.keys(newErrors).length === 0;
  };

  // Handle item type change
  const handleItemTypeChange = (newType: CatalogItemType) => {
    setItemType(newType);
    // Clear category selection when switching to custom_filter
    if (newType === "custom_filter") {
      setCategoryId("");
    }
    // Clear filter config when switching to category_link
    if (newType === "category_link") {
      setFilterConfig(null);
    }
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    const data: CatalogItemInput = {
      group_id: groupId,
      name_ro: nameRo.trim(),
      name_ru: nameRu.trim() || undefined,
      name_en: nameEn.trim() || undefined,
      item_type: itemType,
      category_id: itemType === "category_link" ? categoryId : undefined,
      filter_config: itemType === "custom_filter" ? filterConfig || undefined : undefined,
      is_active: isActive,
    };

    try {
      if (isEdit) {
        await updateItem.mutateAsync({ id: item.id, data });
      } else {
        await createItem.mutateAsync(data);
      }

      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      // Error handling is done in the mutation hooks
      console.error("Form submission error:", error);
    }
  };

  const isSubmitting = createItem.isPending || updateItem.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEdit ? t("item.edit") : t("item.create")}
          </DialogTitle>
          <DialogDescription className="text-base">
            {isEdit
              ? t("item.editDescription")
              : t("item.createDescription")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-5">
            {/* Language Tabs */}
            <Tabs defaultValue="ro" className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1">
                <TabsTrigger
                  value="ro"
                  className="flex items-center gap-2 transition-all duration-200 data-[state=active]:shadow-sm"
                >
                  <Languages className="h-4 w-4" />
                  {t("languages.romanian")}
                </TabsTrigger>
                <TabsTrigger
                  value="ru"
                  className="flex items-center gap-2 transition-all duration-200 data-[state=active]:shadow-sm"
                >
                  <Languages className="h-4 w-4" />
                  {t("languages.russian")}
                </TabsTrigger>
                <TabsTrigger
                  value="en"
                  className="flex items-center gap-2 transition-all duration-200 data-[state=active]:shadow-sm"
                >
                  <Languages className="h-4 w-4" />
                  {t("languages.english")}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="ro" className="space-y-4 mt-5">
                <div className="space-y-2.5">
                  <Label htmlFor="name-ro" className="text-sm font-medium">
                    {t("item.nameRo")} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name-ro"
                    value={nameRo}
                    onChange={(e) => setNameRo(e.target.value)}
                    placeholder={t("item.namePlaceholder", { language: t("languages.romanian") })}
                    className={`transition-all duration-200 ${
                      errors.nameRo
                        ? "border-destructive focus-visible:ring-destructive"
                        : "focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary"
                    } ${shakeField === 'nameRo' ? 'animate-shake' : ''}`}
                  />
                  {errors.nameRo && (
                    <p className="text-sm text-destructive flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                      {errors.nameRo}
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="ru" className="space-y-4 mt-5">
                <div className="space-y-2.5">
                  <Label htmlFor="name-ru" className="text-sm font-medium">{t("item.nameRu")}</Label>
                  <Input
                    id="name-ru"
                    value={nameRu}
                    onChange={(e) => setNameRu(e.target.value)}
                    placeholder={t("item.namePlaceholder", { language: t("languages.russian") })}
                    className="transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary"
                  />
                  <p className="text-xs text-muted-foreground">{t("item.optionalLanguage")}</p>
                </div>
              </TabsContent>

              <TabsContent value="en" className="space-y-4 mt-5">
                <div className="space-y-2.5">
                  <Label htmlFor="name-en" className="text-sm font-medium">{t("item.nameEn")}</Label>
                  <Input
                    id="name-en"
                    value={nameEn}
                    onChange={(e) => setNameEn(e.target.value)}
                    placeholder={t("item.namePlaceholder", { language: t("languages.english") })}
                    className="transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary"
                  />
                  <p className="text-xs text-muted-foreground">{t("item.optionalLanguage")}</p>
                </div>
              </TabsContent>
            </Tabs>

            {/* Item Type Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">
                {t("item.itemType")} <span className="text-destructive">*</span>
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleItemTypeChange("category_link")}
                  className={`group relative flex flex-col items-center justify-center p-5 rounded-lg border-2 transition-all duration-200 ${
                    itemType === "category_link"
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border/60 hover:border-primary/50 hover:bg-muted/30"
                  }`}
                >
                  <Link className={`h-8 w-8 mb-2.5 transition-transform duration-200 ${
                    itemType === "category_link" ? "text-primary scale-110" : "text-muted-foreground group-hover:scale-105"
                  }`} />
                  <span className={`font-medium transition-colors ${
                    itemType === "category_link" ? "text-primary" : "text-foreground"
                  }`}>{t("item.categoryLink")}</span>
                  <span className="text-xs text-muted-foreground text-center mt-1.5 leading-relaxed">
                    {t("item.categoryLinkDescription")}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleItemTypeChange("custom_filter")}
                  className={`group relative flex flex-col items-center justify-center p-5 rounded-lg border-2 transition-all duration-200 ${
                    itemType === "custom_filter"
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border/60 hover:border-primary/50 hover:bg-muted/30"
                  }`}
                >
                  <Filter className={`h-8 w-8 mb-2.5 transition-transform duration-200 ${
                    itemType === "custom_filter" ? "text-primary scale-110" : "text-muted-foreground group-hover:scale-105"
                  }`} />
                  <span className={`font-medium transition-colors ${
                    itemType === "custom_filter" ? "text-primary" : "text-foreground"
                  }`}>{t("item.customFilter")}</span>
                  <span className="text-xs text-muted-foreground text-center mt-1.5 leading-relaxed">
                    {t("item.customFilterDescription")}
                  </span>
                </button>
              </div>
            </div>

            {/* Category Selection (for category_link type) */}
            {itemType === "category_link" && (
              <div className="space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-300">
                <Label htmlFor="category" className="text-sm font-medium">
                  {t("item.category")} <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={categoryId}
                  onValueChange={setCategoryId}
                  disabled={loadingCategories}
                >
                  <SelectTrigger
                    id="category"
                    className={`transition-all duration-200 ${
                      errors.categoryId
                        ? "border-destructive focus-visible:ring-destructive"
                        : "hover:border-primary/50 focus:ring-2 focus:ring-primary/20"
                    } ${shakeField === 'categoryId' ? 'animate-shake' : ''}`}
                  >
                    <SelectValue
                      placeholder={
                        loadingCategories
                          ? t("item.loadingCategories")
                          : t("item.categoryPlaceholder")
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {categories.map((category) => (
                      <SelectItem
                        key={category.id}
                        value={category.id}
                        className="cursor-pointer"
                      >
                        {category.parent_name
                          ? `${category.parent_name} > ${category.name}`
                          : category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.categoryId && (
                  <p className="text-sm text-destructive flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                    {errors.categoryId}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {t("item.categoryDescription")}
                </p>
              </div>
            )}

            {/* Custom Filter Configuration (for custom_filter type) */}
            {itemType === "custom_filter" && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <FilterConfig
                  value={filterConfig}
                  onChange={setFilterConfig}
                  disabled={isSubmitting}
                />
              </div>
            )}

            {/* Is Active */}
            <div className="flex items-center justify-between rounded-lg border border-border/60 p-4 bg-muted/30 transition-all duration-200 hover:border-border hover:bg-muted/50">
              <div className="space-y-0.5">
                <Label htmlFor="is-active" className="text-base font-medium cursor-pointer">
                  {t("item.activeStatus")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("item.activeDescription")}
                </p>
              </div>
              <Switch
                id="is-active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
          </div>

          <DialogFooter className="mt-8 gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="transition-all duration-200 hover:bg-muted"
            >
              {t("actions.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="transition-all duration-200 hover:shadow-md active:scale-[0.98]"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? t("item.updateButton") : t("item.createButton")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
