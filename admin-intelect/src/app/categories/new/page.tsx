"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FolderTree,
  ArrowLeft,
  Save,
  Loader2,
  ChevronRight,
  X,
  Image as ImageIcon,
  CheckCircle2,
  Info,
  Globe,
  Hash,
  ToggleLeft,
  ListOrdered,
  GitBranch,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Category } from "@/types";
import { cn } from "@/lib/utils";

interface CategoryFormState {
  name: string;
  code: string;
  parent_id: string;
  sort_order: number;
  image_url: string;
  is_active: boolean;
}

const initialFormState: CategoryFormState = {
  name: "",
  code: "",
  parent_id: "",
  sort_order: 0,
  image_url: "",
  is_active: true,
};

/**
 * Premium Create Category page with enhanced visual design
 * Features smooth animations, visual hierarchy, and premium styling
 */
export default function CreateCategoryPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formState, setFormState] = useState<CategoryFormState>(initialFormState);
  const [contentVisible, setContentVisible] = useState(false);
  const [formSectionVisible, setFormSectionVisible] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);

  // Trigger staggered entrance animations
  useEffect(() => {
    const timer1 = setTimeout(() => setContentVisible(true), 50);
    const timer2 = setTimeout(() => setFormSectionVisible(true), 150);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  // Fetch categories for parent selector
  useEffect(() => {
    async function fetchCategories() {
      try {
        const allCategories = await api.getAllCategories();
        setCategories(allCategories);
      } catch (error) {
        console.error("Failed to fetch categories:", error);
      } finally {
        setIsLoadingCategories(false);
      }
    }
    fetchCategories();
  }, []);

  const handleChange = (field: keyof CategoryFormState, value: string | boolean | number) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const response = await api.uploadImage(file);
      handleChange("image_url", response.url);
      toast({
        title: "Image Uploaded",
        description: "Category image has been uploaded successfully.",
      });
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload image",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = () => {
    handleChange("image_url", "");
  };

  const validateForm = (): string | null => {
    if (!formState.name.trim()) {
      return "Category name is required";
    }
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) {
      toast({
        title: "Validation Error",
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const category = await api.createCategory({
        name: formState.name.trim(),
        code: formState.code.trim() || null,
        parent_id: formState.parent_id || null,
        sort_order: formState.sort_order,
        image_url: formState.image_url || null,
        is_active: formState.is_active,
      });

      toast({
        title: "Category Created",
        description: `"${category.name}" has been created successfully.`,
      });

      router.push(`/categories/${category.id}`);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create category",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Build category tree for hierarchical display
  const buildCategoryOptions = () => {
    const rootCategories = categories.filter((c) => !c.parent_id);
    const childCategories = categories.filter((c) => c.parent_id);

    const options: { id: string; name: string; depth: number }[] = [];

    const addCategory = (category: Category, depth: number) => {
      options.push({ id: category.id, name: category.name, depth });
      const children = childCategories.filter((c) => c.parent_id === category.id);
      children.forEach((child) => addCategory(child, depth + 1));
    };

    rootCategories.forEach((cat) => addCategory(cat, 0));

    return options;
  };

  const categoryOptions = buildCategoryOptions();

  // Calculate form completion percentage
  const completionPercentage = (() => {
    let filled = 0;
    if (formState.name.trim()) filled++;
    if (formState.code.trim()) filled++;
    if (formState.image_url) filled++;
    if (formState.parent_id) filled++;
    return Math.round((filled / 4) * 100);
  })();

  // Get parent category name for display
  const parentCategoryName = formState.parent_id
    ? categories.find((c) => c.id === formState.parent_id)?.name
    : null;

  return (
    <div className="min-h-screen">
      <div
        className={cn(
          "flex flex-col gap-6 p-6 transition-all duration-500 ease-out",
          contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        )}
      >
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link
            href="/categories"
            className="hover:text-foreground transition-colors duration-200 hover:underline underline-offset-4"
          >
            Categories
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">New Category</span>
        </nav>

        {/* Premium Page Header */}
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => router.back()}
              className="shrink-0 h-10 w-10 rounded-xl border-border/50 transition-all duration-200 hover:bg-muted hover:border-border hover:-translate-y-0.5 hover:shadow-sm active:scale-95"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border shadow-lg bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border-primary/20">
                  <FolderTree className="h-7 w-7 text-primary" />
                </div>
                <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center">
                  <span className="text-[8px] font-bold text-primary">+</span>
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Create Category</h1>
                <p className="text-sm text-muted-foreground">
                  Add a new category to your catalog
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className={cn(
                "hidden sm:flex gap-1.5 px-3 py-1.5 transition-all duration-300",
                completionPercentage === 100
                  ? "border-primary/30 bg-primary/5 text-primary"
                  : "border-border/50"
              )}
            >
              {completionPercentage === 100 ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <Info className="h-3.5 w-3.5" />
              )}
              {completionPercentage}% complete
            </Badge>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="h-10 px-6 rounded-xl transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:scale-95"
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Create Category
            </Button>
          </div>
        </div>

        {/* Main Form Content */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Form Card - Takes 2/3 width on large screens */}
          <div
            className={cn(
              "lg:col-span-2 transition-all duration-500 ease-out",
              formSectionVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            )}
            style={{ transitionDelay: "100ms" }}
          >
            <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
              <CardHeader className="pb-4 bg-gradient-to-r from-muted/30 to-muted/10 border-b border-border/50">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background shadow-sm border border-border/50">
                    <FolderTree className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold">Category Information</CardTitle>
                    <CardDescription>Enter the details for the new category</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-8">
                {/* Image Upload Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm font-semibold">Category Image</Label>
                  </div>
                  <div className="flex items-start gap-6">
                    {formState.image_url ? (
                      <div className="relative group">
                        <div className="h-28 w-28 rounded-2xl overflow-hidden border-2 border-border/50 shadow-md transition-all duration-200 group-hover:shadow-lg group-hover:border-border">
                          <img
                            src={formState.image_url}
                            alt="Category image"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        </div>
                        <button
                          onClick={handleRemoveImage}
                          className="absolute -top-2 -right-2 p-1.5 rounded-full bg-destructive text-destructive-foreground shadow-md opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110 active:scale-95"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <div className="absolute inset-0 rounded-2xl ring-2 ring-primary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center h-28 w-28 rounded-2xl border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-all duration-200 group">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                          disabled={isUploading}
                        />
                        {isUploading ? (
                          <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
                        ) : (
                          <>
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/50 mb-2 transition-colors group-hover:bg-primary/10">
                              <ImageIcon className="h-6 w-6 text-muted-foreground transition-colors group-hover:text-primary" />
                            </div>
                            <span className="text-xs text-muted-foreground font-medium transition-colors group-hover:text-primary">
                              Upload
                            </span>
                          </>
                        )}
                      </label>
                    )}
                    <div className="flex-1 space-y-3">
                      <div className="text-sm text-muted-foreground">
                        <p className="font-medium text-foreground">Upload a category image</p>
                        <p className="text-xs mt-1">
                          Recommended: 400x400 pixels or larger. Supports PNG, JPG, WebP.
                        </p>
                      </div>
                      {/* Alternative URL input */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                          <Label htmlFor="image_url" className="text-xs font-medium text-muted-foreground">
                            Or paste a URL
                          </Label>
                        </div>
                        <Input
                          id="image_url"
                          value={formState.image_url}
                          onChange={(e) => handleChange("image_url", e.target.value)}
                          placeholder="https://example.com/image.png"
                          className="h-9 text-sm rounded-lg border-border/50 focus:border-primary/50 transition-colors"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <Separator className="bg-border/50" />

                {/* Category Name */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <FolderTree className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="name" className="text-sm font-semibold">
                      Category Name <span className="text-destructive">*</span>
                    </Label>
                  </div>
                  <Input
                    id="name"
                    value={formState.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    placeholder="Enter category name"
                    className="h-12 text-base rounded-xl border-border/50 focus:border-primary/50 transition-all duration-200 focus:shadow-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    The display name that will appear throughout the catalog
                  </p>
                </div>

                {/* Category Code */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="code" className="text-sm font-semibold">Category Code</Label>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-border/50">
                      Optional
                    </Badge>
                  </div>
                  <Input
                    id="code"
                    value={formState.code}
                    onChange={(e) => handleChange("code", e.target.value.toUpperCase())}
                    placeholder="e.g., ELEC, CLOTH"
                    className="h-12 text-base font-mono rounded-xl border-border/50 focus:border-primary/50 transition-all duration-200 focus:shadow-sm uppercase"
                  />
                  <p className="text-xs text-muted-foreground">
                    A unique identifier code for internal reference and API operations
                  </p>
                </div>

                <Separator className="bg-border/50" />

                {/* Parent Category */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="parent_id" className="text-sm font-semibold">Parent Category</Label>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-border/50">
                      Optional
                    </Badge>
                  </div>
                  <Select
                    value={formState.parent_id}
                    onValueChange={(value) => handleChange("parent_id", value === "none" ? "" : value)}
                    disabled={isLoadingCategories}
                  >
                    <SelectTrigger className="h-12 text-base rounded-xl border-border/50 focus:border-primary/50 transition-all duration-200">
                      <SelectValue placeholder={isLoadingCategories ? "Loading categories..." : "Select parent category (optional)"} />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="none" className="rounded-lg">
                        <div className="flex items-center gap-2">
                          <FolderTree className="h-4 w-4 text-muted-foreground" />
                          <span>No parent (Root category)</span>
                        </div>
                      </SelectItem>
                      {categoryOptions.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id} className="rounded-lg">
                          <span className="text-muted-foreground">{"\u2014".repeat(cat.depth)}</span>
                          {cat.depth > 0 && " "}
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {parentCategoryName
                      ? `This will be a subcategory of "${parentCategoryName}"`
                      : "Leave empty to create a root-level category"}
                  </p>
                </div>

                {/* Sort Order */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <ListOrdered className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="sort_order" className="text-sm font-semibold">Sort Order</Label>
                  </div>
                  <Input
                    id="sort_order"
                    type="number"
                    value={formState.sort_order}
                    onChange={(e) => handleChange("sort_order", parseInt(e.target.value) || 0)}
                    placeholder="0"
                    className="h-12 text-base rounded-xl border-border/50 focus:border-primary/50 transition-all duration-200 focus:shadow-sm max-w-[150px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Lower numbers appear first. Categories with the same order are sorted alphabetically.
                  </p>
                </div>

                <Separator className="bg-border/50" />

                {/* Active Status - Premium Toggle */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm font-semibold">Visibility Status</Label>
                  </div>
                  <div className={cn(
                    "flex items-center justify-between p-5 rounded-xl border-2 transition-all duration-300",
                    formState.is_active
                      ? "border-primary/20 bg-primary/5"
                      : "border-border/50 bg-muted/30"
                  )}>
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-300",
                        formState.is_active
                          ? "bg-primary/10 shadow-sm shadow-primary/20"
                          : "bg-muted"
                      )}>
                        {formState.is_active ? (
                          <CheckCircle2 className="h-6 w-6 text-primary" />
                        ) : (
                          <ToggleLeft className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <Label htmlFor="is_active" className="cursor-pointer text-base font-semibold">
                          {formState.is_active ? "Active" : "Inactive"}
                        </Label>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {formState.is_active
                            ? "Category is visible in the catalog and available for products"
                            : "Category is hidden from the catalog"}
                        </p>
                      </div>
                    </div>
                    <Switch
                      id="is_active"
                      checked={formState.is_active}
                      onCheckedChange={(checked) => handleChange("is_active", checked)}
                      className="data-[state=checked]:bg-primary"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar Tips Card */}
          <div
            className={cn(
              "lg:col-span-1 transition-all duration-500 ease-out",
              formSectionVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            )}
            style={{ transitionDelay: "200ms" }}
          >
            <Card className="rounded-2xl border-border/50 shadow-sm sticky top-6 overflow-hidden">
              <CardHeader className="pb-3 bg-gradient-to-r from-blue-500/5 to-blue-500/10 border-b border-blue-500/10">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                    <Info className="h-4 w-4 text-blue-600" />
                  </div>
                  <CardTitle className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                    Tips & Guidelines
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-3">
                  {[
                    {
                      title: "Category Hierarchy",
                      description: "Use parent categories to create a logical product structure",
                    },
                    {
                      title: "Category Name",
                      description: "Use clear, descriptive names that customers will understand",
                    },
                    {
                      title: "Category Code",
                      description: "Use uppercase letters and numbers for easy identification",
                    },
                    {
                      title: "Sort Order",
                      description: "Control the display order of categories in navigation menus",
                    },
                    {
                      title: "Active Status",
                      description: "Inactive categories won't appear in product filters or navigation",
                    },
                  ].map((tip, index) => (
                    <div
                      key={tip.title}
                      className={cn(
                        "p-3 rounded-xl bg-muted/30 border border-border/30 transition-all duration-300",
                        formSectionVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4"
                      )}
                      style={{ transitionDelay: `${300 + index * 75}ms` }}
                    >
                      <p className="text-xs font-semibold text-foreground">{tip.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{tip.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Bottom Action Bar */}
        <div
          className={cn(
            "flex items-center justify-between pt-4 border-t border-border/50 transition-all duration-500 ease-out",
            formSectionVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}
          style={{ transitionDelay: "300ms" }}
        >
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="transition-all duration-200 hover:bg-muted"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className={cn(
                "sm:hidden gap-1.5 px-3 py-1.5 transition-all duration-300",
                completionPercentage === 100
                  ? "border-primary/30 bg-primary/5 text-primary"
                  : "border-border/50"
              )}
            >
              {completionPercentage}% complete
            </Badge>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-6 rounded-xl transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:scale-95"
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Create Category
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
