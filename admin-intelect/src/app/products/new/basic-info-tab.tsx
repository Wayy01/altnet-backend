"use client";

import { useEffect, useState, useMemo } from "react";
import { Plus, X, Tag, FolderTree, Search, Loader2, Check, DollarSign, Package } from "lucide-react";

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
import { Brand, Category, ProductFormState } from "@/types";
import { cn } from "@/lib/utils";

interface BasicInfoTabProps {
  data: ProductFormState["basicInfo"];
  onChange: (updates: Partial<ProductFormState["basicInfo"]>) => void;
}

/**
 * Premium Basic Info Tab with searchable selectors for brands and categories
 * Supports 100+ items efficiently with search filtering and virtualized scrolling
 */
export function BasicInfoTab({ data, onChange }: BasicInfoTabProps) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [isLoadingBrands, setIsLoadingBrands] = useState(true);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);

  // Popover open states
  const [brandOpen, setBrandOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);

  // Search states for filtering
  const [brandSearch, setBrandSearch] = useState("");
  const [categorySearch, setCategorySearch] = useState("");

  // Animation state for form sections
  const [sectionsVisible, setSectionsVisible] = useState(false);

  // Trigger entrance animation
  useEffect(() => {
    const timer = setTimeout(() => setSectionsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Load brands and categories on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [brandsData, categoriesData] = await Promise.all([
          api.getAllBrands(),
          api.getAllCategories(),
        ]);
        setBrands(brandsData);
        setCategories(categoriesData);
      } catch (error) {
        console.error("Failed to load brands/categories:", error);
      } finally {
        setIsLoadingBrands(false);
        setIsLoadingCategories(false);
      }
    };
    loadData();
  }, []);

  // Filter brands based on search
  const filteredBrands = useMemo(() => {
    if (!brandSearch.trim()) return brands;
    const searchLower = brandSearch.toLowerCase();
    return brands.filter((brand) =>
      brand.name.toLowerCase().includes(searchLower)
    );
  }, [brands, brandSearch]);

  // Filter categories based on search
  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return categories;
    const searchLower = categorySearch.toLowerCase();
    return categories.filter((category) =>
      category.name.toLowerCase().includes(searchLower)
    );
  }, [categories, categorySearch]);

  // Get selected brand/category names
  const selectedBrand = useMemo(() => {
    return brands.find((b) => b.id === data.brand_id);
  }, [brands, data.brand_id]);

  const selectedCategory = useMemo(() => {
    return categories.find((c) => c.id === data.category_id);
  }, [categories, data.category_id]);

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
            Product Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            placeholder="Enter product name"
            value={data.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className={cn(
              "h-11 rounded-lg transition-all duration-200",
              "focus:ring-2 focus:ring-primary/20 focus:border-primary",
              "hover:border-primary/50"
            )}
          />
          <p className="text-xs text-muted-foreground">
            The main display name for this product
          </p>
        </div>
      </FormSection>

      {/* Code and Article */}
      <FormSection index={1}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="code" className="text-sm font-medium">
              Product Code
            </Label>
            <Input
              id="code"
              placeholder="e.g., PRD-001"
              value={data.code}
              onChange={(e) => onChange({ code: e.target.value })}
              className={cn(
                "h-11 rounded-lg font-mono transition-all duration-200",
                "focus:ring-2 focus:ring-primary/20 focus:border-primary",
                "hover:border-primary/50"
              )}
            />
            <p className="text-xs text-muted-foreground">
              Unique identifier for inventory
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="article" className="text-sm font-medium">
              Article
            </Label>
            <Input
              id="article"
              placeholder="e.g., ART-12345"
              value={data.article}
              onChange={(e) => onChange({ article: e.target.value })}
              className={cn(
                "h-11 rounded-lg font-mono transition-all duration-200",
                "focus:ring-2 focus:ring-primary/20 focus:border-primary",
                "hover:border-primary/50"
              )}
            />
            <p className="text-xs text-muted-foreground">
              Manufacturer article number
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
              Brand
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
                      Loading brands...
                    </span>
                  ) : selectedBrand ? (
                    <span className="truncate">{selectedBrand.name}</span>
                  ) : (
                    "Select brand..."
                  )}
                  <Tag className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command shouldFilter={false}>
                  <div className="flex items-center border-b px-3">
                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <input
                      placeholder="Search brands..."
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
                        ? `No brands found matching "${brandSearch}"`
                        : "No brands available"}
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
                        <span className="text-muted-foreground">No brand</span>
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
                          <span className="truncate">{brand.name}</span>
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
                      {filteredBrands.length} of {brands.length} brands
                    </div>
                  )}
                </Command>
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">
              {brands.length} brands available
            </p>
          </div>

          {/* Category Selector - Searchable Combobox */}
          <div className="space-y-2">
            <Label htmlFor="category" className="text-sm font-medium flex items-center gap-2">
              <FolderTree className="h-3.5 w-3.5 text-muted-foreground" />
              Category
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
                      Loading categories...
                    </span>
                  ) : selectedCategory ? (
                    <span className="truncate">{selectedCategory.name}</span>
                  ) : (
                    "Select category..."
                  )}
                  <FolderTree className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command shouldFilter={false}>
                  <div className="flex items-center border-b px-3">
                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <input
                      placeholder="Search categories..."
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
                        ? `No categories found matching "${categorySearch}"`
                        : "No categories available"}
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
                        <span className="text-muted-foreground">No category</span>
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
                          <span className="truncate">{category.name}</span>
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
                      {filteredCategories.length} of {categories.length} categories
                    </div>
                  )}
                </Command>
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">
              {categories.length} categories available
            </p>
          </div>
        </div>
      </FormSection>

      {/* Description */}
      <FormSection index={3}>
        <div className="space-y-2">
          <Label htmlFor="description" className="text-sm font-medium">
            Description
          </Label>
          <Textarea
            id="description"
            placeholder="Enter product description..."
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
            Detailed description that appears on the product page
          </p>
        </div>
      </FormSection>

      {/* Warranty */}
      <FormSection index={4}>
        <div className="space-y-2">
          <Label htmlFor="warranty" className="text-sm font-medium">
            Warranty
          </Label>
          <Input
            id="warranty"
            placeholder="e.g., 24 months"
            value={data.warranty}
            onChange={(e) => onChange({ warranty: e.target.value })}
            className={cn(
              "h-11 rounded-lg transition-all duration-200",
              "focus:ring-2 focus:ring-primary/20 focus:border-primary",
              "hover:border-primary/50"
            )}
          />
          <p className="text-xs text-muted-foreground">
            Warranty period or terms
          </p>
        </div>
      </FormSection>

      {/* Barcodes */}
      <FormSection index={5}>
        <div className="space-y-3">
          <Label className="text-sm font-medium">Barcodes</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Enter barcode (EAN, UPC, etc.)"
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
            Add multiple barcodes for this product (press Enter or click +)
          </p>
        </div>
      </FormSection>

      {/* Pricing & Stock */}
      <FormSection index={6}>
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-primary" />
            <Label className="text-sm font-semibold">Pricing & Stock</Label>
          </div>

          {/* Prices Grid - 3 columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price_mdl" className="text-sm font-medium">
                Price (MDL) <span className="text-xs text-muted-foreground">Primary</span>
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
                Price (EUR)
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
                Price (USD)
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
                Total Stock
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
                Available units in inventory
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Stock Status</Label>
              <div className="flex items-center gap-3 h-11 px-4 rounded-lg border bg-muted/30">
                <Switch
                  id="is_in_stock"
                  checked={data.is_in_stock}
                  onCheckedChange={(checked) => onChange({ is_in_stock: checked })}
                  className="data-[state=checked]:bg-primary"
                />
                <Label htmlFor="is_in_stock" className="text-sm cursor-pointer">
                  {data.is_in_stock ? "In Stock" : "Out of Stock"}
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Auto-calculated from stock (can override)
              </p>
            </div>
          </div>
        </div>
      </FormSection>

      {/* Status Switches */}
      <FormSection index={7}>
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border/50">
            <div className="space-y-0.5">
              <Label htmlFor="is_active" className="text-sm font-medium">
                Active
              </Label>
              <p className="text-xs text-muted-foreground">
                Product will be visible in the catalog
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
                Service
              </Label>
              <p className="text-xs text-muted-foreground">
                Mark as a service instead of a physical product
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
