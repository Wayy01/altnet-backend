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
  CheckCircle2,
  Info,
  Globe,
  Hash,
  ToggleLeft,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface BrandFormState {
  name: string;
  code: string;
  logo_url: string;
  is_active: boolean;
}

const initialFormState: BrandFormState = {
  name: "",
  code: "",
  logo_url: "",
  is_active: true,
};

/**
 * Premium Create Brand page with enhanced visual design
 * Features smooth animations, visual hierarchy, and premium styling
 */
export default function CreateBrandPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formState, setFormState] = useState<BrandFormState>(initialFormState);
  const [contentVisible, setContentVisible] = useState(false);
  const [formSectionVisible, setFormSectionVisible] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Trigger staggered entrance animations
  useEffect(() => {
    const timer1 = setTimeout(() => setContentVisible(true), 50);
    const timer2 = setTimeout(() => setFormSectionVisible(true), 150);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
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
        title: "Logo Uploaded",
        description: "Brand logo has been uploaded successfully.",
      });
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload logo",
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
      return "Brand name is required";
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
      const brand = await api.createBrand({
        name: formState.name.trim(),
        code: formState.code.trim() || null,
        logo_url: formState.logo_url || null,
        is_active: formState.is_active,
      });

      toast({
        title: "Brand Created",
        description: `"${brand.name}" has been created successfully.`,
      });

      router.push(`/brands/${brand.id}`);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create brand",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate form completion percentage
  const completionPercentage = (() => {
    let filled = 0;
    if (formState.name.trim()) filled++;
    if (formState.code.trim()) filled++;
    if (formState.logo_url) filled++;
    return Math.round((filled / 3) * 100);
  })();

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
            href="/brands"
            className="hover:text-foreground transition-colors duration-200 hover:underline underline-offset-4"
          >
            Brands
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">New Brand</span>
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
                  <Award className="h-7 w-7 text-primary" />
                </div>
                <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center">
                  <span className="text-[8px] font-bold text-primary">+</span>
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Create Brand</h1>
                <p className="text-sm text-muted-foreground">
                  Add a new brand to your catalog
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
              Create Brand
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
                    <Award className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold">Brand Information</CardTitle>
                    <CardDescription>Enter the details for the new brand</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-8">
                {/* Logo Upload Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm font-semibold">Brand Logo</Label>
                  </div>
                  <div className="flex items-start gap-6">
                    {formState.logo_url ? (
                      <div className="relative group">
                        <div className="h-28 w-28 rounded-2xl overflow-hidden border-2 border-border/50 shadow-md transition-all duration-200 group-hover:shadow-lg group-hover:border-border">
                          <img
                            src={formState.logo_url}
                            alt="Brand logo"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        </div>
                        <button
                          onClick={handleRemoveLogo}
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
                        <p className="font-medium text-foreground">Upload a logo image</p>
                        <p className="text-xs mt-1">
                          Recommended: Square image, 200x200 pixels or larger. Supports PNG, JPG, WebP.
                        </p>
                      </div>
                      {/* Alternative URL input */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                          <Label htmlFor="logo_url" className="text-xs font-medium text-muted-foreground">
                            Or paste a URL
                          </Label>
                        </div>
                        <Input
                          id="logo_url"
                          value={formState.logo_url}
                          onChange={(e) => handleChange("logo_url", e.target.value)}
                          placeholder="https://example.com/logo.png"
                          className="h-9 text-sm rounded-lg border-border/50 focus:border-primary/50 transition-colors"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <Separator className="bg-border/50" />

                {/* Brand Name */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="name" className="text-sm font-semibold">
                      Brand Name <span className="text-destructive">*</span>
                    </Label>
                  </div>
                  <Input
                    id="name"
                    value={formState.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    placeholder="Enter brand name"
                    className="h-12 text-base rounded-xl border-border/50 focus:border-primary/50 transition-all duration-200 focus:shadow-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    The display name that will appear throughout the catalog
                  </p>
                </div>

                {/* Brand Code */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="code" className="text-sm font-semibold">Brand Code</Label>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-border/50">
                      Optional
                    </Badge>
                  </div>
                  <Input
                    id="code"
                    value={formState.code}
                    onChange={(e) => handleChange("code", e.target.value.toUpperCase())}
                    placeholder="e.g., SAMSUNG, APPLE"
                    className="h-12 text-base font-mono rounded-xl border-border/50 focus:border-primary/50 transition-all duration-200 focus:shadow-sm uppercase"
                  />
                  <p className="text-xs text-muted-foreground">
                    A unique identifier code for internal reference and API operations
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
                            ? "Brand is visible in the catalog and available for products"
                            : "Brand is hidden from the catalog"}
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
                      title: "Brand Name",
                      description: "Use the official brand name as it appears on product packaging",
                    },
                    {
                      title: "Brand Code",
                      description: "Use uppercase letters and numbers for easy identification",
                    },
                    {
                      title: "Logo Quality",
                      description: "High-resolution logos improve the professional appearance of your catalog",
                    },
                    {
                      title: "Active Status",
                      description: "Inactive brands won't appear in product assignment dropdowns",
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
              Create Brand
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
