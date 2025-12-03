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
  Globe,
  Hash,
  ListOrdered,
  GitBranch,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Category } from "@/types";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/contexts/language-context";

interface CategoryFormState {
  name: string;
  code: string;
  parent_id: string;
  sort_order: number;
  image_url: string;
  is_active: boolean;
  name_ru: string;
  name_ro: string;
}

const initialFormState: CategoryFormState = {
  name: "",
  code: "",
  parent_id: "",
  sort_order: 0,
  image_url: "",
  is_active: true,
  name_ru: "",
  name_ro: "",
};

/**
 * Compact category creation page following dashboard design system
 */
export default function CreateCategoryPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useTranslation("categories");
  const { t: tCommon } = useTranslation("common");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formState, setFormState] = useState<CategoryFormState>(initialFormState);
  const [contentVisible, setContentVisible] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [translationsOpen, setTranslationsOpen] = useState(false);

  // Trigger entrance animation
  useEffect(() => {
    const timer = setTimeout(() => setContentVisible(true), 50);
    return () => clearTimeout(timer);
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
        title: tCommon("messages.itemCreated"),
      });
    } catch (error) {
      toast({
        title: tCommon("messages.operationFailed"),
        description: error instanceof Error ? error.message : tCommon("messages.operationFailed"),
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
      return t("toast.nameRequired");
    }
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) {
      toast({
        title: tCommon("messages.invalidInput"),
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
        name_ru: formState.name_ru.trim() || null,
        name_ro: formState.name_ro.trim() || null,
      });

      toast({
        title: t("toast.created"),
      });

      router.push(`/categories/${category.id}`);
    } catch (error) {
      toast({
        title: t("toast.updateFailed"),
        description: error instanceof Error ? error.message : t("toast.updateFailed"),
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

  // Get parent category name for display
  const parentCategoryName = formState.parent_id
    ? categories.find((c) => c.id === formState.parent_id)?.name
    : null;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 transition-all duration-500",
        contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}
    >
      {/* Compact Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link
          href="/categories"
          className="hover:text-foreground transition-colors duration-200"
        >
          {t("page.title")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">{t("page.newTitle")}</span>
      </nav>

      {/* Compact Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.back()}
            className="h-9 w-9 rounded-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("page.newTitle")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("page.newDescription")}
            </p>
          </div>
        </div>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="h-9 rounded-lg transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:scale-[1.02]"
        >
          {isSubmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {tCommon("actions.create")}
        </Button>
      </div>

      {/* Compact Form Card */}
      <Card className="rounded-xl border-border/50 shadow-sm">
        <CardContent className="p-4 space-y-4">
          {/* Image Upload - Compact */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Category Image</Label>
            <div className="flex items-start gap-4">
              {formState.image_url ? (
                <div className="relative group">
                  <div className="h-20 w-20 rounded-lg overflow-hidden border-2 border-border/50 shadow-sm transition-all duration-200 group-hover:shadow-md group-hover:border-border">
                    <img
                      src={formState.image_url}
                      alt="Category image"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <button
                    onClick={handleRemoveImage}
                    className="absolute -top-2 -right-2 p-1 rounded-full bg-destructive text-destructive-foreground shadow-md opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-20 w-20 rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-all duration-200">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={isUploading}
                  />
                  {isUploading ? (
                    <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  )}
                </label>
              )}
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                  <Label htmlFor="image_url" className="text-xs text-muted-foreground">
                    Or paste image URL...
                  </Label>
                </div>
                <Input
                  id="image_url"
                  value={formState.image_url}
                  onChange={(e) => handleChange("image_url", e.target.value)}
                  placeholder="https://example.com/image.png"
                  className="h-9 rounded-lg"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Name & Code - 2 Column Grid */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sm font-medium">
                {t("form.categoryName")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formState.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder={t("form.categoryNamePlaceholder")}
                className="h-9 rounded-lg"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                <Label htmlFor="code" className="text-sm font-medium">
                  Category Code
                </Label>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                  {tCommon("labels.options")}
                </Badge>
              </div>
              <Input
                id="code"
                value={formState.code}
                onChange={(e) => handleChange("code", e.target.value.toUpperCase())}
                placeholder="e.g., ELEC, CLOTH"
                className="h-9 rounded-lg font-mono uppercase"
              />
            </div>
          </div>

          <Separator />

          {/* Parent & Sort Order - 2 Column Grid */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                <Label htmlFor="parent_id" className="text-sm font-medium">
                  Parent Category
                </Label>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                  {tCommon("labels.options")}
                </Badge>
              </div>
              <Select
                value={formState.parent_id}
                onValueChange={(value) => handleChange("parent_id", value === "none" ? "" : value)}
                disabled={isLoadingCategories}
              >
                <SelectTrigger className="h-9 rounded-lg">
                  <SelectValue placeholder={isLoadingCategories ? "Loading..." : "Root category"} />
                </SelectTrigger>
                <SelectContent className="rounded-lg">
                  <SelectItem value="none" className="rounded-lg">
                    No parent (Root)
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
              {parentCategoryName && (
                <p className="text-xs text-muted-foreground">
                  Subcategory of "{parentCategoryName}"
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <ListOrdered className="h-3.5 w-3.5 text-muted-foreground" />
                <Label htmlFor="sort_order" className="text-sm font-medium">
                  Sort Order
                </Label>
              </div>
              <Input
                id="sort_order"
                type="number"
                value={formState.sort_order}
                onChange={(e) => handleChange("sort_order", parseInt(e.target.value) || 0)}
                placeholder="0"
                className="h-9 rounded-lg"
              />
              <p className="text-xs text-muted-foreground">
                Lower numbers appear first
              </p>
            </div>
          </div>

          <Separator />

          {/* Active Status Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <Label htmlFor="is_active" className="text-sm font-medium">
                {t("form.activeStatus")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("form.activeDescription")}
              </p>
            </div>
            <Switch
              id="is_active"
              checked={formState.is_active}
              onCheckedChange={(checked) => handleChange("is_active", checked)}
            />
          </div>

          <Separator />

          {/* Collapsible Translations Section */}
          <Collapsible open={translationsOpen} onOpenChange={setTranslationsOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors">
              <ChevronRight className={cn(
                "h-4 w-4 transition-transform duration-200",
                translationsOpen && "rotate-90"
              )} />
              Translations
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="name_ru" className="text-sm font-medium">
                    Name (Russian)
                  </Label>
                  <Input
                    id="name_ru"
                    value={formState.name_ru}
                    onChange={(e) => handleChange("name_ru", e.target.value)}
                    placeholder="Название категории"
                    className="h-9 rounded-lg"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="name_ro" className="text-sm font-medium">
                    Name (Romanian)
                  </Label>
                  <Input
                    id="name_ro"
                    value={formState.name_ro}
                    onChange={(e) => handleChange("name_ro", e.target.value)}
                    placeholder="Nume categorie"
                    className="h-9 rounded-lg"
                  />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* Bottom Actions */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="h-9"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {tCommon("actions.cancel")}
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="h-9 rounded-lg hover:scale-[1.02] transition-transform"
        >
          {isSubmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {tCommon("actions.create")}
        </Button>
      </div>
    </div>
  );
}
