"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Save,
  Package,
  Tag,
  FolderTree,
  DollarSign,
  X,
  Search,
  Check,
  Pencil,
} from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { Product, ProductDetail, Brand, Category } from "@/types";
import { cn } from "@/lib/utils";

interface EditVariantModalProps {
  /** The variant product to edit */
  variant: Product | ProductDetail | null;
  /** Whether the modal is open */
  open: boolean;
  /** Callback when the modal should close */
  onClose: () => void;
  /** Callback after successful save */
  onSave?: () => void;
}

interface FormState {
  name: string;
  code: string;
  article: string;
  description: string;
  brand_id: string;
  category_id: string;
  price_mdl: number | null;
  price_eur: number | null;
  price_usd: number | null;
  total_stock: number;
  is_in_stock: boolean;
  is_active: boolean;
}

/**
 * Edit Variant Modal
 *
 * A modal dialog for editing variant product properties such as name, code,
 * article, pricing, stock, and status.
 */
export function EditVariantModal({
  variant,
  open,
  onClose,
  onSave,
}: EditVariantModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");

  // Form state
  const [formState, setFormState] = useState<FormState>({
    name: "",
    code: "",
    article: "",
    description: "",
    brand_id: "",
    category_id: "",
    price_mdl: null,
    price_eur: null,
    price_usd: null,
    total_stock: 0,
    is_in_stock: false,
    is_active: true,
  });

  // Brand and Category data
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingBrands, setIsLoadingBrands] = useState(false);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);

  // Popover open states
  const [brandOpen, setBrandOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);

  // Search states
  const [brandSearch, setBrandSearch] = useState("");
  const [categorySearch, setCategorySearch] = useState("");

  // Load variant data when modal opens
  useEffect(() => {
    if (open && variant) {
      setFormState({
        name: variant.name || "",
        code: variant.code || "",
        article: variant.article || "",
        description: variant.description || "",
        brand_id: variant.brand_id || "",
        category_id: variant.category_id || "",
        price_mdl: variant.price_mdl ?? null,
        price_eur: variant.price_eur ?? null,
        price_usd: variant.price_usd ?? null,
        total_stock: variant.total_stock || 0,
        is_in_stock: variant.is_in_stock || false,
        is_active: variant.is_active ?? true,
      });
      setActiveTab("basic");
    }
  }, [open, variant]);

  // Load brands and categories when modal opens
  useEffect(() => {
    if (open) {
      const loadData = async () => {
        setIsLoadingBrands(true);
        setIsLoadingCategories(true);
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
    }
  }, [open]);

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
    return brands.find((b) => b.id === formState.brand_id);
  }, [brands, formState.brand_id]);

  const selectedCategory = useMemo(() => {
    return categories.find((c) => c.id === formState.category_id);
  }, [categories, formState.category_id]);

  const updateForm = (updates: Partial<FormState>) => {
    setFormState((prev) => ({ ...prev, ...updates }));
  };

  const handleSave = async () => {
    if (!variant) return;

    if (!formState.name.trim()) {
      toast.error("Product name is required");
      setActiveTab("basic");
      return;
    }

    setIsSaving(true);
    try {
      await api.updateProduct(variant.id, {
        name: formState.name,
        code: formState.code || null,
        article: formState.article || null,
        description: formState.description || null,
        brand_id: formState.brand_id || null,
        category_id: formState.category_id || null,
        is_active: formState.is_active,
      });

      toast.success("Variant updated successfully");
      onSave?.();
      onClose();
    } catch (error) {
      console.error("Failed to update variant:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update variant"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (!isSaving) {
      onClose();
    }
  };

  if (!variant) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
              <Pencil className="h-4 w-4 text-primary" />
            </div>
            Edit Variant
          </DialogTitle>
          <DialogDescription>
            Edit the variant product details. Changes will be saved immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="basic" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Basic Info
              </TabsTrigger>
              <TabsTrigger value="pricing" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Pricing & Stock
              </TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-0">
              {/* Product Name */}
              <div className="space-y-2">
                <Label htmlFor="edit-name" className="text-sm font-medium">
                  Product Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit-name"
                  placeholder="Enter product name"
                  value={formState.name}
                  onChange={(e) => updateForm({ name: e.target.value })}
                  className="h-10"
                />
              </div>

              {/* Code and Article */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-code" className="text-sm font-medium">
                    Product Code
                  </Label>
                  <Input
                    id="edit-code"
                    placeholder="e.g., PRD-123456"
                    value={formState.code}
                    onChange={(e) => updateForm({ code: e.target.value })}
                    className="h-10 font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-article" className="text-sm font-medium">
                    Article
                  </Label>
                  <Input
                    id="edit-article"
                    placeholder="Manufacturer article"
                    value={formState.article}
                    onChange={(e) => updateForm({ article: e.target.value })}
                    className="h-10 font-mono"
                  />
                </div>
              </div>

              {/* Brand and Category */}
              <div className="grid grid-cols-2 gap-4">
                {/* Brand Selector */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
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
                          "w-full h-10 justify-between font-normal",
                          !formState.brand_id && "text-muted-foreground"
                        )}
                      >
                        {isLoadingBrands ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading...
                          </span>
                        ) : selectedBrand ? (
                          <span className="truncate">{selectedBrand.name}</span>
                        ) : (
                          "Select brand"
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
                        <CommandList className="max-h-[200px] overflow-y-auto">
                          <CommandEmpty>No brands found</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="none"
                              onSelect={() => {
                                updateForm({ brand_id: "" });
                                setBrandOpen(false);
                                setBrandSearch("");
                              }}
                              className="cursor-pointer"
                            >
                              <div
                                className={cn(
                                  "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border",
                                  !formState.brand_id
                                    ? "bg-primary border-primary text-primary-foreground"
                                    : "opacity-50"
                                )}
                              >
                                {!formState.brand_id && <Check className="h-3 w-3" />}
                              </div>
                              <span className="text-muted-foreground">No brand</span>
                            </CommandItem>
                            {filteredBrands.map((brand) => (
                              <CommandItem
                                key={brand.id}
                                value={brand.id}
                                onSelect={() => {
                                  updateForm({ brand_id: brand.id });
                                  setBrandOpen(false);
                                  setBrandSearch("");
                                }}
                                className="cursor-pointer"
                              >
                                <div
                                  className={cn(
                                    "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border",
                                    formState.brand_id === brand.id
                                      ? "bg-primary border-primary text-primary-foreground"
                                      : "opacity-50"
                                  )}
                                >
                                  {formState.brand_id === brand.id && (
                                    <Check className="h-3 w-3" />
                                  )}
                                </div>
                                <span className="truncate">{brand.name}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Category Selector */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
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
                          "w-full h-10 justify-between font-normal",
                          !formState.category_id && "text-muted-foreground"
                        )}
                      >
                        {isLoadingCategories ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading...
                          </span>
                        ) : selectedCategory ? (
                          <span className="truncate">{selectedCategory.name}</span>
                        ) : (
                          "Select category"
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
                        <CommandList className="max-h-[200px] overflow-y-auto">
                          <CommandEmpty>No categories found</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="none"
                              onSelect={() => {
                                updateForm({ category_id: "" });
                                setCategoryOpen(false);
                                setCategorySearch("");
                              }}
                              className="cursor-pointer"
                            >
                              <div
                                className={cn(
                                  "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border",
                                  !formState.category_id
                                    ? "bg-primary border-primary text-primary-foreground"
                                    : "opacity-50"
                                )}
                              >
                                {!formState.category_id && <Check className="h-3 w-3" />}
                              </div>
                              <span className="text-muted-foreground">No category</span>
                            </CommandItem>
                            {filteredCategories.map((category) => (
                              <CommandItem
                                key={category.id}
                                value={category.id}
                                onSelect={() => {
                                  updateForm({ category_id: category.id });
                                  setCategoryOpen(false);
                                  setCategorySearch("");
                                }}
                                className="cursor-pointer"
                              >
                                <div
                                  className={cn(
                                    "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border",
                                    formState.category_id === category.id
                                      ? "bg-primary border-primary text-primary-foreground"
                                      : "opacity-50"
                                  )}
                                >
                                  {formState.category_id === category.id && (
                                    <Check className="h-3 w-3" />
                                  )}
                                </div>
                                <span className="truncate">{category.name}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="edit-description" className="text-sm font-medium">
                  Description
                </Label>
                <Textarea
                  id="edit-description"
                  placeholder="Product description..."
                  value={formState.description}
                  onChange={(e) => updateForm({ description: e.target.value })}
                  rows={3}
                  className="resize-none"
                />
              </div>

              {/* Active Status */}
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="edit-is_active" className="text-sm font-medium">
                    Active
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Whether this product is visible and available
                  </p>
                </div>
                <Switch
                  id="edit-is_active"
                  checked={formState.is_active}
                  onCheckedChange={(checked) => updateForm({ is_active: checked })}
                />
              </div>
            </TabsContent>

            <TabsContent value="pricing" className="space-y-4 mt-0">
              {/* Prices */}
              <div className="space-y-4">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-primary" />
                  Prices
                </Label>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-price_mdl" className="text-sm font-medium">
                      Price (MDL)
                    </Label>
                    <Input
                      id="edit-price_mdl"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={formState.price_mdl ?? ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        updateForm({
                          price_mdl: value ? parseFloat(value) : null,
                        });
                      }}
                      className="h-10 font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-price_eur" className="text-sm font-medium">
                      Price (EUR)
                    </Label>
                    <Input
                      id="edit-price_eur"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={formState.price_eur ?? ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        updateForm({
                          price_eur: value ? parseFloat(value) : null,
                        });
                      }}
                      className="h-10 font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-price_usd" className="text-sm font-medium">
                      Price (USD)
                    </Label>
                    <Input
                      id="edit-price_usd"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={formState.price_usd ?? ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        updateForm({
                          price_usd: value ? parseFloat(value) : null,
                        });
                      }}
                      className="h-10 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Stock */}
              <div className="space-y-4">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  Stock
                </Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-total_stock" className="text-sm font-medium">
                      Total Stock
                    </Label>
                    <Input
                      id="edit-total_stock"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={formState.total_stock || ""}
                      onChange={(e) => {
                        const stock = parseInt(e.target.value) || 0;
                        updateForm({
                          total_stock: stock,
                          is_in_stock: stock > 0,
                        });
                      }}
                      className="h-10 font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Stock Status</Label>
                    <div className="flex items-center gap-3 h-10 px-4 rounded-lg border bg-muted/30">
                      <Switch
                        id="edit-is_in_stock"
                        checked={formState.is_in_stock}
                        onCheckedChange={(checked) =>
                          updateForm({ is_in_stock: checked })
                        }
                      />
                      <Label htmlFor="edit-is_in_stock" className="text-sm cursor-pointer">
                        {formState.is_in_stock ? "In Stock" : "Out of Stock"}
                      </Label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Info badge about current variant */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <Package className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-primary">
                      Editing Variant Product
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      This product is a variant. Changes made here will only affect this
                      specific variant, not the parent product or other variants.
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="flex-shrink-0 border-t pt-4">
          <Button variant="outline" onClick={handleClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EditVariantModal;
