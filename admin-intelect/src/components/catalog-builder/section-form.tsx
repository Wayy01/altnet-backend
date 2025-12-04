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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Loader2, Languages } from "lucide-react";
import { toast } from "sonner";
import { CatalogSection, CatalogSectionInput } from "@/types/catalog";
import { useCreateSection, useUpdateSection } from "@/hooks/use-catalog";

interface SectionFormProps {
  section?: CatalogSection; // undefined for create, defined for edit
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function SectionForm({
  section,
  open,
  onOpenChange,
  onSuccess,
}: SectionFormProps) {
  const { t } = useTranslation("catalogBuilder");
  const isEdit = !!section;
  const createSection = useCreateSection();
  const updateSection = useUpdateSection();

  // Form state
  const [nameRo, setNameRo] = useState("");
  const [nameRu, setNameRu] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [icon, setIcon] = useState("");
  const [slug, setSlug] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [shakeField, setShakeField] = useState<string | null>(null);

  // Initialize form with section data when editing
  useEffect(() => {
    if (section && open) {
      setNameRo(section.name_ro);
      setNameRu(section.name_ru || "");
      setNameEn(section.name_en || "");
      setIcon(section.icon || "");
      setSlug(section.slug);
      setIsActive(section.is_active);
      setErrors({});
      setShakeField(null);
    } else if (!section && open) {
      // Reset form for create mode
      setNameRo("");
      setNameRu("");
      setNameEn("");
      setIcon("");
      setSlug("");
      setIsActive(true);
      setErrors({});
      setShakeField(null);
    }
  }, [section, open]);

  // Handle shake animation
  useEffect(() => {
    if (shakeField) {
      const timer = setTimeout(() => setShakeField(null), 500);
      return () => clearTimeout(timer);
    }
  }, [shakeField]);

  // Auto-generate slug from name_ro
  useEffect(() => {
    if (!isEdit && nameRo) {
      const generatedSlug = nameRo
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      setSlug(generatedSlug);
    }
  }, [nameRo, isEdit]);

  // Validate form
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!nameRo.trim()) {
      newErrors.nameRo = t("section.required");
    }

    if (icon && !isValidUrl(icon)) {
      newErrors.icon = t("section.invalidUrl");
    }

    setErrors(newErrors);

    // Trigger shake animation on error
    if (Object.keys(newErrors).length > 0) {
      setShakeField(Object.keys(newErrors)[0]);
    }

    return Object.keys(newErrors).length === 0;
  };

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    const data: CatalogSectionInput = {
      name_ro: nameRo.trim(),
      name_ru: nameRu.trim() || undefined,
      name_en: nameEn.trim() || undefined,
      icon: icon.trim() || undefined,
      slug: slug.trim() || undefined,
      is_active: isActive,
    };

    try {
      if (isEdit) {
        await updateSection.mutateAsync({ id: section.id, data });
      } else {
        await createSection.mutateAsync(data);
      }

      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      // Error handling is done in the mutation hooks
      console.error("Form submission error:", error);
    }
  };

  const isSubmitting = createSection.isPending || updateSection.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEdit ? t("section.edit") : t("section.create")}
          </DialogTitle>
          <DialogDescription className="text-base">
            {isEdit
              ? t("section.editDescription")
              : t("section.createDescription")}
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
                    {t("section.nameRo")} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name-ro"
                    value={nameRo}
                    onChange={(e) => setNameRo(e.target.value)}
                    placeholder={t("section.namePlaceholder", { language: t("languages.romanian") })}
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
                  <Label htmlFor="name-ru" className="text-sm font-medium">{t("section.nameRu")}</Label>
                  <Input
                    id="name-ru"
                    value={nameRu}
                    onChange={(e) => setNameRu(e.target.value)}
                    placeholder={t("section.namePlaceholder", { language: t("languages.russian") })}
                    className="transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary"
                  />
                  <p className="text-xs text-muted-foreground">{t("section.optionalLanguage")}</p>
                </div>
              </TabsContent>

              <TabsContent value="en" className="space-y-4 mt-5">
                <div className="space-y-2.5">
                  <Label htmlFor="name-en" className="text-sm font-medium">{t("section.nameEn")}</Label>
                  <Input
                    id="name-en"
                    value={nameEn}
                    onChange={(e) => setNameEn(e.target.value)}
                    placeholder={t("section.namePlaceholder", { language: t("languages.english") })}
                    className="transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary"
                  />
                  <p className="text-xs text-muted-foreground">{t("section.optionalLanguage")}</p>
                </div>
              </TabsContent>
            </Tabs>

            {/* Icon URL */}
            <div className="space-y-2.5">
              <Label htmlFor="icon" className="text-sm font-medium">{t("section.iconUrl")}</Label>
              <Input
                id="icon"
                type="url"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder={t("section.iconPlaceholder")}
                className={`transition-all duration-200 ${
                  errors.icon
                    ? "border-destructive focus-visible:ring-destructive"
                    : "focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary"
                } ${shakeField === 'icon' ? 'animate-shake' : ''}`}
              />
              {errors.icon && (
                <p className="text-sm text-destructive flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                  {errors.icon}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {t("section.iconDescription")}
              </p>
            </div>

            {/* Slug */}
            <div className="space-y-2.5">
              <Label htmlFor="slug" className="text-sm font-medium">{t("section.slug")}</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder={t("section.slugPlaceholder")}
                disabled={isEdit}
                className={`transition-all duration-200 ${
                  !isEdit ? "focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary" : ""
                }`}
              />
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                {isEdit
                  ? t("section.slugDescriptionEdit")
                  : t("section.slugDescriptionCreate")}
              </p>
            </div>

            {/* Is Active */}
            <div className="flex items-center justify-between rounded-lg border border-border/60 p-4 bg-muted/30 transition-all duration-200 hover:border-border hover:bg-muted/50">
              <div className="space-y-0.5">
                <Label htmlFor="is-active" className="text-base font-medium cursor-pointer">
                  {t("section.activeStatus")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("section.activeDescription")}
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
              {isEdit ? t("section.updateButton") : t("section.createButton")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
