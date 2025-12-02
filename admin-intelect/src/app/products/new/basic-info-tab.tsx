"use client";

import { useEffect, useState, useMemo } from "react";
import { Plus, X, Tag, FolderTree, Search, Loader2, Check, DollarSign, Package, Globe, Trash2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
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
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { api } from "@/lib/api";
import { Brand, Category, ProductFormState, ProductSource } from "@/types";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useTranslation, useLocalizedValue } from "@/contexts/language-context";

interface BasicInfoTabProps {
  data: ProductFormState["basicInfo"];
  onChange: (updates: Partial<ProductFormState["basicInfo"]>) => void;
}

/**
 * Premium Basic Info Tab with searchable selectors for brands, categories, and sources
 * Supports 100+ items efficiently with search filtering and virtualized scrolling
 */
export function BasicInfoTab({ data, onChange }: BasicInfoTabProps) {
  const { toast } = useToast();
  const { t } = useTranslation("products");
  const { localize } = useLocalizedValue();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sources, setSources] = useState<ProductSource[]>([]);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [newSourceName, setNewSourceName] = useState("");
  const [isLoadingBrands, setIsLoadingBrands] = useState(true);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isLoadingSources, setIsLoadingSources] = useState(true);
  const [isAddingSource, setIsAddingSource] = useState(false);
  const [isDeletingSource, setIsDeletingSource] = useState<string | null>(null);

  // Popover open states
  const [brandOpen, setBrandOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);

  // Search states for filtering
  const [brandSearch, setBrandSearch] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [sourceSearch, setSourceSearch] = useState("");

  // Animation state for form sections
  const [sectionsVisible, setSectionsVisible] = useState(false);

  // Trigger entrance animation
  useEffect(() => {
    const timer = setTimeout(() => setSectionsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Load brands, categories, and sources on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [brandsData, categoriesData, sourcesData] = await Promise.all([
          api.getAllBrands(),
          api.getAllCategories(),
          api.getSources(),
        ]);
        setBrands(brandsData);
        setCategories(categoriesData);
        setSources(sourcesData);

        // Auto-select the default source if no source is selected
        if (!data.source_id && sourcesData.length > 0) {
          const defaultSource = sourcesData.find((s) => s.is_default);
          if (defaultSource) {
            onChange({ source_id: defaultSource.id });
          }
        }
      } catch (error) {
        console.error("Failed to load brands/categories/sources:", error);
      } finally {
        setIsLoadingBrands(false);
        setIsLoadingCategories(false);
        setIsLoadingSources(false);
      }
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter brands based on search (search in all language versions)
  const filteredBrands = useMemo(() => {
    if (!brandSearch.trim()) return brands;
    const searchLower = brandSearch.toLowerCase();
    return brands.filter((brand) => {
      const localizedName = localize(brand, "name").toLowerCase();
      const baseName = brand.name.toLowerCase();
      return localizedName.includes(searchLower) || baseName.includes(searchLower);
    });
  }, [brands, brandSearch, localize]);

  // Filter categories based on search (search in all language versions)
  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return categories;
    const searchLower = categorySearch.toLowerCase();
    return categories.filter((category) => {
      const localizedName = localize(category, "name").toLowerCase();
      const baseName = category.name.toLowerCase();
      return localizedName.includes(searchLower) || baseName.includes(searchLower);
    });
  }, [categories, categorySearch, localize]);

  // Filter sources based on search
  const filteredSources = useMemo(() => {
    if (!sourceSearch.trim()) return sources;
    const searchLower = sourceSearch.toLowerCase();
    return sources.filter((source) =>
      source.name.toLowerCase().includes(searchLower)
    );
  }, [sources, sourceSearch]);

  // Get selected brand/category/source names
  const selectedBrand = useMemo(() => {
    return brands.find((b) => b.id === data.brand_id);
  }, [brands, data.brand_id]);

  const selectedCategory = useMemo(() => {
    return categories.find((c) => c.id === data.category_id);
  }, [categories, data.category_id]);

  const selectedSource = useMemo(() => {
    return sources.find((s) => s.id === data.source_id);
  }, [sources, data.source_id]);

  // Add new source handler
  const handleAddSource = async () => {
    if (!newSourceName.trim()) return;

    setIsAddingSource(true);
    try {
      const newSource = await api.createSource({ name: newSourceName.trim() });
      setSources((prev) => [...prev, newSource]);
      onChange({ source_id: newSource.id });
      setNewSourceName("");
      toast({
        title: t("toast.sourceCreated"),
        description: t("toast.sourceCreatedDesc", { name: newSource.name }),
      });
    } catch (error) {
      toast({
        title: t("toast.updateFailed"),
        description: t("toast.createSourceFailed"),
        variant: "destructive",
      });
    } finally {
      setIsAddingSource(false);
    }
  };

  // Delete source handler
  const handleDeleteSource = async (sourceId: string) => {
    const sourceToDelete = sources.find((s) => s.id === sourceId);
    if (!sourceToDelete || sourceToDelete.is_default || !sourceToDelete.is_deletable) {
      toast({
        title: t("toast.cannotDeleteSource"),
        description: t("toast.cannotDeleteSourceDesc"),
        variant: "destructive",
      });
      return;
    }

    setIsDeletingSource(sourceId);
    try {
      await api.deleteSource(sourceId);
      setSources((prev) => prev.filter((s) => s.id !== sourceId));
      // If deleted source was selected, clear selection or select default
      if (data.source_id === sourceId) {
        const defaultSource = sources.find((s) => s.is_default);
        onChange({ source_id: defaultSource?.id || "" });
      }
      toast({
        title: t("toast.sourceDeleted"),
        description: t("toast.sourceDeletedDesc", { name: sourceToDelete.name }),
      });
    } catch (error) {
      toast({
        title: t("toast.updateFailed"),
        description: t("toast.deleteSourceFailed"),
        variant: "destructive",
      });
    } finally {
      setIsDeletingSource(null);
    }
  };

  const addBarcode = () => {
    if (barcodeInput.trim() && !data.barcodes.includes(barcodeInput.trim())) {
      onChange({ barcodes: [...data.barcodes, barcodeInput.trim()] });
      setBarcodeInput("");
    }
  };

  const removeBarcode = (barcode: string) => {
    onChange({ barcodes: data.barcodes.filter((b) => b !== barcode) });
  };

  /**
   * Form section wrapper with staggered animation
   */
  const FormSection = ({
    children,
    index,
    className,
  }: {
    children: React.ReactNode;
    index: number;
    className?: string;
  }) => (
    <div
      className={cn(
        "transition-all duration-300 ease-out",
        sectionsVisible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-4",
        className
      )}
      style={{
        transitionDelay: sectionsVisible ? `${index * 50}ms` : "0ms",
      }}
    >
      {children}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Product Name - Required */}
      <FormSection index={0}>
        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm font-medium">
            {t("basicInfo.title")} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            placeholder={t("basicInfo.namePlaceholder")}
            value={data.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className={cn(
              "h-11 rounded-lg transition-all duration-200",
              "focus:ring-2 focus:ring-primary/20 focus:border-primary",
              "hover:border-primary/50"
            )}
          />
          <p className="text-xs text-muted-foreground">
            {t("basicInfo.nameHint")}
          </p>
        </div>
      </FormSection>

      {/* Code and Article */}
      <FormSection index={1}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="code" className="text-sm font-medium">
              {t("basicInfo.productCode")}
            </Label>
            <Input
              id="code"
              placeholder={t("basicInfo.codePlaceholder")}
              value={data.code}
              onChange={(e) => onChange({ code: e.target.value })}
              className={cn(
                "h-11 rounded-lg font-mono transition-all duration-200",
                "focus:ring-2 focus:ring-primary/20 focus:border-primary",
                "hover:border-primary/50"
              )}
            />
            <p className="text-xs text-muted-foreground">
              {t("basicInfo.codeHint")}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="article" className="text-sm font-medium">
              {t("basicInfo.article")}
            </Label>
            <Input
              id="article"
              placeholder={t("basicInfo.articlePlaceholder")}
              value={data.article}
              onChange={(e) => onChange({ article: e.target.value })}
              className={cn(
                "h-11 rounded-lg font-mono transition-all duration-200",
                "focus:ring-2 focus:ring-primary/20 focus:border-primary",
                "hover:border-primary/50"
              )}
            />
            <p className="text-xs text-muted-foreground">
              {t("basicInfo.articleHint")}
            </p>
          </div>
        </div>
      </FormSection>

      {/* Brand and Category - Searchable Selectors */}
      <FormSection index={2}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Brand Selector - Searchable Combobox */}
          <div className="space-y-2">
            <Label htmlFor="brand" className="text-sm font-medium flex items-center gap-2">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              {t("basicInfo.brand")}
            </Label>
            <Popover open={brandOpen} onOpenChange={setBrandOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={brandOpen}
                  disabled={isLoadingBrands}
                  className={cn(
                    "w-full h-11 justify-between rounded-lg font-normal",
                    "transition-all duration-200",
                    "hover:border-primary/50 hover:bg-muted/30",
                    !data.brand_id && "text-muted-foreground"
                  )}
                >
                  {isLoadingBrands ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("basicInfo.loadingBrands")}
                    </span>
                  ) : selectedBrand ? (
                    <span className="truncate">{localize(selectedBrand, "name")}</span>
                  ) : (
                    t("basicInfo.selectBrand")
                  )}
                  <Tag className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command shouldFilter={false}>
                  <div className="flex items-center border-b px-3">
                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <input
                      placeholder={t("basicInfo.searchBrands")}
                      value={brandSearch}
                      onChange={(e) => setBrandSearch(e.target.value)}
                      className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                    />
                    {brandSearch && (
                      <button
                        onClick={() => setBrandSearch("")}
                        className="p-1 rounded-full hover:bg-muted transition-colors"
                      >
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                  <CommandList className="max-h-[300px] overflow-y-auto">
                    <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                      {brandSearch
                        ? t("basicInfo.noBrandsFound", { search: brandSearch })
                        : t("basicInfo.noBrandsAvailable")}
                    </CommandEmpty>
                    <CommandGroup>
                      {/* No brand option */}
                      <CommandItem
                        value="none"
                        onSelect={() => {
                          onChange({ brand_id: "" });
                          setBrandOpen(false);
                          setBrandSearch("");
                        }}
                        className="cursor-pointer"
                      >
                        <div
                          className={cn(
                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                            !data.brand_id
                              ? "bg-primary text-primary-foreground"
                              : "opacity-50"
                          )}
                        >
                          {!data.brand_id && <Check className="h-3 w-3" />}
                        </div>
                        <span className="text-muted-foreground">{t("basicInfo.noBrand")}</span>
                      </CommandItem>
                      {/* Brand list */}
                      {filteredBrands.map((brand) => (
                        <CommandItem
                          key={brand.id}
                          value={brand.id}
                          onSelect={() => {
                            onChange({ brand_id: brand.id });
                            setBrandOpen(false);
                            setBrandSearch("");
                          }}
                          className="cursor-pointer"
                        >
                          <div
                            className={cn(
                              "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                              data.brand_id === brand.id
                                ? "bg-primary text-primary-foreground"
                                : "opacity-50"
                            )}
                          >
                            {data.brand_id === brand.id && (
                              <Check className="h-3 w-3" />
                            )}
                          </div>
                          <span className="truncate">{localize(brand, "name")}</span>
                          {brand.product_count !== undefined && brand.product_count > 0 && (
                            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                              {brand.product_count}
                            </span>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                  {brands.length > 10 && (
                    <div className="border-t px-3 py-2 text-xs text-muted-foreground">
                      {t("basicInfo.brandsOf", { filtered: filteredBrands.length, total: brands.length })}
                    </div>
                  )}
                </Command>
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">
              {t("basicInfo.brandsAvailable", { count: brands.length })}
            </p>
          </div>

          {/* Category Selector - Searchable Combobox */}
          <div className="space-y-2">
            <Label htmlFor="category" className="text-sm font-medium flex items-center gap-2">
              <FolderTree className="h-3.5 w-3.5 text-muted-foreground" />
              {t("basicInfo.category")}
            </Label>
            <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={categoryOpen}
                  disabled={isLoadingCategories}
                  className={cn(
                    "w-full h-11 justify-between rounded-lg font-normal",
                    "transition-all duration-200",
                    "hover:border-primary/50 hover:bg-muted/30",
                    !data.category_id && "text-muted-foreground"
                  )}
                >
                  {isLoadingCategories ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("basicInfo.loadingCategories")}
                    </span>
                  ) : selectedCategory ? (
                    <span className="truncate">{localize(selectedCategory, "name")}</span>
                  ) : (
                    t("basicInfo.selectCategory")
                  )}
                  <FolderTree className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command shouldFilter={false}>
                  <div className="flex items-center border-b px-3">
                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <input
                      placeholder={t("basicInfo.searchCategories")}
                      value={categorySearch}
                      onChange={(e) => setCategorySearch(e.target.value)}
                      className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                    />
                    {categorySearch && (
                      <button
                        onClick={() => setCategorySearch("")}
                        className="p-1 rounded-full hover:bg-muted transition-colors"
                      >
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                  <CommandList className="max-h-[300px] overflow-y-auto">
                    <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                      {categorySearch
                        ? t("basicInfo.noCategoriesFound", { search: categorySearch })
                        : t("basicInfo.noCategoriesAvailable")}
                    </CommandEmpty>
                    <CommandGroup>
                      {/* No category option */}
                      <CommandItem
                        value="none"
                        onSelect={() => {
                          onChange({ category_id: "" });
                          setCategoryOpen(false);
                          setCategorySearch("");
                        }}
                        className="cursor-pointer"
                      >
                        <div
                          className={cn(
                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                            !data.category_id
                              ? "bg-primary text-primary-foreground"
                              : "opacity-50"
                          )}
                        >
                          {!data.category_id && <Check className="h-3 w-3" />}
                        </div>
                        <span className="text-muted-foreground">{t("basicInfo.noCategory")}</span>
                      </CommandItem>
                      {/* Category list */}
                      {filteredCategories.map((category) => (
                        <CommandItem
                          key={category.id}
                          value={category.id}
                          onSelect={() => {
                            onChange({ category_id: category.id });
                            setCategoryOpen(false);
                            setCategorySearch("");
                          }}
                          className="cursor-pointer"
                        >
                          <div
                            className={cn(
                              "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                              data.category_id === category.id
                                ? "bg-primary text-primary-foreground"
                                : "opacity-50"
                            )}
                          >
                            {data.category_id === category.id && (
                              <Check className="h-3 w-3" />
                            )}
                          </div>
                          <span className="truncate">{localize(category, "name")}</span>
                          {category.product_count !== undefined && category.product_count > 0 && (
                            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                              {category.product_count}
                            </span>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                  {categories.length > 10 && (
                    <div className="border-t px-3 py-2 text-xs text-muted-foreground">
                      {t("basicInfo.categoriesOf", { filtered: filteredCategories.length, total: categories.length })}
                    </div>
                  )}
                </Command>
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">
              {t("basicInfo.categoriesAvailable", { count: categories.length })}
            </p>
          </div>
        </div>
      </FormSection>

      {/* Source Selector */}
      <FormSection index={3}>
        <div className="space-y-2">
          <Label htmlFor="source" className="text-sm font-medium flex items-center gap-2">
            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
            {t("basicInfo.source")}
          </Label>
          <Popover open={sourceOpen} onOpenChange={setSourceOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={sourceOpen}
                disabled={isLoadingSources}
                className={cn(
                  "w-full h-11 justify-between rounded-lg font-normal",
                  "transition-all duration-200",
                  "hover:border-primary/50 hover:bg-muted/30",
                  !data.source_id && "text-muted-foreground"
                )}
              >
                {isLoadingSources ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("basicInfo.loadingSources")}
                  </span>
                ) : selectedSource ? (
                  <span className="flex items-center gap-2">
                    <span className="truncate">{selectedSource.name}</span>
                    {selectedSource.is_default && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {t("basicInfo.default")}
                      </Badge>
                    )}
                  </span>
                ) : (
                  t("basicInfo.selectSource")
                )}
                <Globe className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command shouldFilter={false}>
                <div className="flex items-center border-b px-3">
                  <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                  <input
                    placeholder={t("basicInfo.searchOrAddSource")}
                    value={sourceSearch}
                    onChange={(e) => {
                      setSourceSearch(e.target.value);
                      setNewSourceName(e.target.value);
                    }}
                    className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                  />
                  {sourceSearch && (
                    <button
                      onClick={() => {
                        setSourceSearch("");
                        setNewSourceName("");
                      }}
                      className="p-1 rounded-full hover:bg-muted transition-colors"
                    >
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>
                <CommandList className="max-h-[300px] overflow-y-auto">
                  <CommandEmpty className="py-2 px-3 text-sm text-muted-foreground">
                    {newSourceName.trim() ? (
                      <div className="flex flex-col gap-2">
                        <span>{t("basicInfo.noSourcesFound", { name: newSourceName })}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleAddSource}
                          disabled={isAddingSource}
                          className="w-full"
                        >
                          {isAddingSource ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Plus className="h-4 w-4 mr-2" />
                          )}
                          {t("basicInfo.addSource", { name: newSourceName.trim() })}
                        </Button>
                      </div>
                    ) : (
                      t("basicInfo.noSourcesAvailable")
                    )}
                  </CommandEmpty>
                  <CommandGroup>
                    {/* Source list */}
                    {filteredSources.map((source) => (
                      <CommandItem
                        key={source.id}
                        value={source.id}
                        onSelect={() => {
                          onChange({ source_id: source.id });
                          setSourceOpen(false);
                          setSourceSearch("");
                          setNewSourceName("");
                        }}
                        className="cursor-pointer group"
                      >
                        <div
                          className={cn(
                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                            data.source_id === source.id
                              ? "bg-primary text-primary-foreground"
                              : "opacity-50"
                          )}
                        >
                          {data.source_id === source.id && (
                            <Check className="h-3 w-3" />
                          )}
                        </div>
                        <span className="truncate flex-1">{source.name}</span>
                        {source.is_default && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 mr-2">
                            {t("basicInfo.default")}
                          </Badge>
                        )}
                        {/* Delete button for non-default, deletable sources */}
                        {source.is_deletable && !source.is_default && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSource(source.id);
                            }}
                            disabled={isDeletingSource === source.id}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-all"
                          >
                            {isDeletingSource === source.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
                {/* Add new source inline */}
                {newSourceName.trim() && !filteredSources.some(s => s.name.toLowerCase() === newSourceName.trim().toLowerCase()) && filteredSources.length > 0 && (
                  <div className="border-t px-3 py-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleAddSource}
                      disabled={isAddingSource}
                      className="w-full justify-start"
                    >
                      {isAddingSource ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Plus className="h-4 w-4 mr-2" />
                      )}
                      {t("basicInfo.addSource", { name: newSourceName.trim() })}
                    </Button>
                  </div>
                )}
                {sources.length > 5 && (
                  <div className="border-t px-3 py-2 text-xs text-muted-foreground">
                    {t("basicInfo.sourcesOf", { filtered: filteredSources.length, total: sources.length })}
                  </div>
                )}
              </Command>
            </PopoverContent>
          </Popover>
          <p className="text-xs text-muted-foreground">
            {t("basicInfo.sourceHint")}
          </p>
        </div>
      </FormSection>

      {/* Description */}
      <FormSection index={4}>
        <div className="space-y-2">
          <Label htmlFor="description" className="text-sm font-medium">
            {t("basicInfo.description")}
          </Label>
          <Textarea
            id="description"
            placeholder={t("basicInfo.descriptionPlaceholder")}
            value={data.description}
            onChange={(e) => onChange({ description: e.target.value })}
            rows={4}
            className={cn(
              "resize-none rounded-lg transition-all duration-200",
              "focus:ring-2 focus:ring-primary/20 focus:border-primary",
              "hover:border-primary/50"
            )}
          />
          <p className="text-xs text-muted-foreground">
            {t("basicInfo.descriptionHint")}
          </p>
        </div>
      </FormSection>

      {/* Warranty */}
      <FormSection index={5}>
        <div className="space-y-2">
          <Label htmlFor="warranty" className="text-sm font-medium">
            {t("basicInfo.warranty")}
          </Label>
          <Input
            id="warranty"
            placeholder={t("basicInfo.warrantyPlaceholder")}
            value={data.warranty}
            onChange={(e) => onChange({ warranty: e.target.value })}
            className={cn(
              "h-11 rounded-lg transition-all duration-200",
              "focus:ring-2 focus:ring-primary/20 focus:border-primary",
              "hover:border-primary/50"
            )}
          />
          <p className="text-xs text-muted-foreground">
            {t("basicInfo.warrantyHint")}
          </p>
        </div>
      </FormSection>

      {/* Barcodes */}
      <FormSection index={6}>
        <div className="space-y-3">
          <Label className="text-sm font-medium">{t("basicInfo.barcodes")}</Label>
          <div className="flex gap-2">
            <Input
              placeholder={t("basicInfo.barcodePlaceholder")}
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addBarcode();
                }
              }}
              className={cn(
                "h-11 rounded-lg font-mono transition-all duration-200",
                "focus:ring-2 focus:ring-primary/20 focus:border-primary",
                "hover:border-primary/50"
              )}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={addBarcode}
              disabled={!barcodeInput.trim()}
              className={cn(
                "h-11 w-11 shrink-0 rounded-lg",
                "transition-all duration-200",
                "hover:bg-primary/10 hover:text-primary hover:border-primary/30",
                "disabled:opacity-50"
              )}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {data.barcodes.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {data.barcodes.map((barcode, index) => (
                <Badge
                  key={barcode}
                  variant="secondary"
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg",
                    "bg-muted/50 hover:bg-muted transition-colors",
                    "animate-in fade-in-0 slide-in-from-left-2"
                  )}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <span className="font-mono text-xs">{barcode}</span>
                  <button
                    type="button"
                    onClick={() => removeBarcode(barcode)}
                    className="ml-1 p-0.5 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {t("basicInfo.barcodesHint")}
          </p>
        </div>
      </FormSection>

      {/* Pricing & Stock */}
      <FormSection index={7}>
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-primary" />
            <Label className="text-sm font-semibold">{t("basicInfo.pricingStock")}</Label>
          </div>

          {/* Prices Grid - 3 columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price_mdl" className="text-sm font-medium">
                {t("basicInfo.priceMDL")} <span className="text-xs text-muted-foreground">{t("basicInfo.priceMDLPrimary")}</span>
              </Label>
              <Input
                id="price_mdl"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={data.price_mdl ?? ""}
                onChange={(e) => {
                  const value = e.target.value;
                  if (!value) {
                    onChange({ price_mdl: null });
                    return;
                  }
                  const parsed = parseFloat(value);
                  if (!isNaN(parsed) && parsed >= 0) {
                    onChange({ price_mdl: parsed });
                  }
                }}
                className={cn(
                  "h-11 rounded-lg font-mono transition-all duration-200",
                  "focus:ring-2 focus:ring-primary/20 focus:border-primary",
                  "hover:border-primary/50"
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price_eur" className="text-sm font-medium">
                {t("basicInfo.priceEUR")}
              </Label>
              <Input
                id="price_eur"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={data.price_eur ?? ""}
                onChange={(e) => {
                  const value = e.target.value;
                  if (!value) {
                    onChange({ price_eur: null });
                    return;
                  }
                  const parsed = parseFloat(value);
                  if (!isNaN(parsed) && parsed >= 0) {
                    onChange({ price_eur: parsed });
                  }
                }}
                className={cn(
                  "h-11 rounded-lg font-mono transition-all duration-200",
                  "focus:ring-2 focus:ring-primary/20 focus:border-primary",
                  "hover:border-primary/50"
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price_usd" className="text-sm font-medium">
                {t("basicInfo.priceUSD")}
              </Label>
              <Input
                id="price_usd"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={data.price_usd ?? ""}
                onChange={(e) => {
                  const value = e.target.value;
                  if (!value) {
                    onChange({ price_usd: null });
                    return;
                  }
                  const parsed = parseFloat(value);
                  if (!isNaN(parsed) && parsed >= 0) {
                    onChange({ price_usd: parsed });
                  }
                }}
                className={cn(
                  "h-11 rounded-lg font-mono transition-all duration-200",
                  "focus:ring-2 focus:ring-primary/20 focus:border-primary",
                  "hover:border-primary/50"
                )}
              />
            </div>
          </div>

          {/* Stock Grid - 2 columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="total_stock" className="text-sm font-medium flex items-center gap-2">
                <Package className="h-3.5 w-3.5 text-muted-foreground" />
                {t("basicInfo.totalStock")}
              </Label>
              <Input
                id="total_stock"
                type="number"
                min="0"
                placeholder="0"
                value={data.total_stock || ""}
                onChange={(e) => {
                  const stock = parseInt(e.target.value) || 0;
                  onChange({
                    total_stock: stock,
                    is_in_stock: stock > 0
                  });
                }}
                className={cn(
                  "h-11 rounded-lg font-mono transition-all duration-200",
                  "focus:ring-2 focus:ring-primary/20 focus:border-primary",
                  "hover:border-primary/50"
                )}
              />
              <p className="text-xs text-muted-foreground">
                {t("basicInfo.stockHint")}
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t("basicInfo.stockStatus")}</Label>
              <div className="flex items-center gap-3 h-11 px-4 rounded-lg border bg-muted/30">
                <Switch
                  id="is_in_stock"
                  checked={data.is_in_stock}
                  onCheckedChange={(checked) => onChange({ is_in_stock: checked })}
                  className="data-[state=checked]:bg-primary"
                />
                <Label htmlFor="is_in_stock" className="text-sm cursor-pointer">
                  {data.is_in_stock ? t("basicInfo.inStock") : t("basicInfo.outOfStock")}
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("basicInfo.stockAutoHint")}
              </p>
            </div>
          </div>
        </div>
      </FormSection>

      {/* Status Switches */}
      <FormSection index={8}>
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border/50">
            <div className="space-y-0.5">
              <Label htmlFor="is_active" className="text-sm font-medium">
                {t("basicInfo.active")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("basicInfo.activeDesc")}
              </p>
            </div>
            <Switch
              id="is_active"
              checked={data.is_active}
              onCheckedChange={(checked) => onChange({ is_active: checked })}
              className="data-[state=checked]:bg-primary transition-all duration-200"
            />
          </div>
          <div className="flex items-center justify-between p-4">
            <div className="space-y-0.5">
              <Label htmlFor="is_service" className="text-sm font-medium">
                {t("basicInfo.service")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("basicInfo.serviceDesc")}
              </p>
            </div>
            <Switch
              id="is_service"
              checked={data.is_service}
              onCheckedChange={(checked) => onChange({ is_service: checked })}
              className="data-[state=checked]:bg-primary transition-all duration-200"
            />
          </div>
        </div>
      </FormSection>
    </div>
  );
}
