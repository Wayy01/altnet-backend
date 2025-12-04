"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Award,
  ArrowLeft,
  Save,
  Loader2,
  ChevronRight,
  X,
  Image as ImageIcon,
  Globe,
  Hash,
  ToggleLeft,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/contexts/language-context";

interface BrandFormState {
  name: string;
  code: string;
  logo_url: string;
  is_active: boolean;
  name_ru: string;
  name_ro: string;
}

const initialFormState: BrandFormState = {
  name: "",
  code: "",
  logo_url: "",
  is_active: true,
  name_ru: "",
  name_ro: "",
};

/**
 * Compact brand creation page following dashboard design system
 */
export default function CreateBrandPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useTranslation("brands");
  const { t: tCommon } = useTranslation("common");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formState, setFormState] = useState<BrandFormState>(initialFormState);
  const [contentVisible, setContentVisible] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [translationsOpen, setTranslationsOpen] = useState(false);

  // Trigger entrance animation
  useEffect(() => {
    const timer = setTimeout(() => setContentVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const handleChange = (field: keyof BrandFormState, value: string | boolean) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const response = await api.uploadImage(file);
      handleChange("logo_url", response.url);
      toast({
        title: t("toast.logoUploaded"),
      });
    } catch (error) {
      toast({
        title: t("toast.logoUploadFailed"),
        description: error instanceof Error ? error.message : tCommon("messages.operationFailed"),
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveLogo = () => {
    handleChange("logo_url", "");
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
      const brand = await api.createBrand({
        name: formState.name.trim(),
        code: formState.code.trim() || null,
        logo_url: formState.logo_url || null,
        is_active: formState.is_active,
        name_ru: formState.name_ru.trim() || null,
        name_ro: formState.name_ro.trim() || null,
      });

      toast({
        title: t("toast.created"),
      });

      router.push(`/brands/${brand.id}`);
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
          href="/brands"
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
          {/* Logo Upload - Compact */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">{t("form.brandLogo")}</Label>
            <div className="flex items-start gap-4">
              {formState.logo_url ? (
                <div className="relative group">
                  <div className="h-20 w-20 rounded-lg overflow-hidden border-2 border-border/50 shadow-sm transition-all duration-200 group-hover:shadow-md group-hover:border-border">
                    <img
                      src={formState.logo_url}
                      alt="Brand logo"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <button
                    onClick={handleRemoveLogo}
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
                  <Label htmlFor="logo_url" className="text-xs text-muted-foreground">
                    {t("form.pasteLogoUrl")}
                  </Label>
                </div>
                <Input
                  id="logo_url"
                  value={formState.logo_url}
                  onChange={(e) => handleChange("logo_url", e.target.value)}
                  placeholder="https://example.com/logo.png"
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
                {t("form.brandName")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formState.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder={t("form.brandNamePlaceholder")}
                className="h-9 rounded-lg"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                <Label htmlFor="code" className="text-sm font-medium">
                  {t("form.brandCode")}
                </Label>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                  {tCommon("labels.options")}
                </Badge>
              </div>
              <Input
                id="code"
                value={formState.code}
                onChange={(e) => handleChange("code", e.target.value.toUpperCase())}
                placeholder={t("form.brandCodePlaceholder")}
                className="h-9 rounded-lg font-mono uppercase"
              />
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
                    placeholder="Название бренда"
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
                    placeholder="Nume brand"
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
