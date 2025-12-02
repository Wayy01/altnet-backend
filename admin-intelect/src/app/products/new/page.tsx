"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Package,
  ArrowLeft,
  Save,
  Loader2,
  FileText,
  Image as ImageIcon,
  Settings2,
  GitBranch,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import {
  ProductFormState,
  CreateProductPayload,
  CreatePropertyData,
  ProductDetail,
} from "@/types";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/contexts/language-context";

import { BasicInfoTab } from "./basic-info-tab";
import { MediaTab } from "./media-tab";
import { PropertiesTab } from "./properties-tab";
import { VariantsTab } from "./variants-tab";

/**
 * Generate a unique product code that doesn't exist in the database.
 * Format: PRD-XXXXXX (uppercase alphanumeric)
 */
async function generateUniqueCode(): Promise<string> {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const maxAttempts = 10;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Generate random 6-character suffix
    let suffix = "";
    for (let i = 0; i < 6; i++) {
      suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const code = `PRD-${suffix}`;

    // Check if code already exists
    try {
      const { data } = await api.getProducts({ search: code }, 1, 0);
      // If no exact match found, this code is unique
      const exactMatch = data.some((p) => p.code === code);
      if (!exactMatch) {
        return code;
      }
    } catch {
      // If API fails, just return the generated code
      return code;
    }
  }

  // Fallback: use timestamp-based code
  return `PRD-${Date.now().toString(36).toUpperCase()}`;
}


const initialFormState: ProductFormState = {
  basicInfo: {
    name: "",
    code: "",
    article: "",
    description: "",
    brand_id: "",
    category_id: "",
    source_id: "",
    warranty: "",
    barcodes: [],
    is_active: true,
    is_service: false,
    // Pricing
    price_mdl: null,
    price_eur: null,
    price_usd: null,
    total_stock: 0,
    is_in_stock: false,
  },
  media: {
    main_image_url: "",
    images: [],
    videos: [],
  },
  properties: [],
  variants: {
    parent_id: null,
    is_group: false,
    variant_type: null,
    variant_value: null,
  },
};

/**
 * Tab configuration with icons, labels, and validation status
 */
interface TabConfig {
  id: string;
  labelKey: string;
  icon: React.ReactNode;
  descriptionKey: string;
}

const tabConfigs: TabConfig[] = [
  {
    id: "basic",
    labelKey: "tabs.basicInfo",
    icon: <FileText className="h-4 w-4" />,
    descriptionKey: "navigation.basicInfoDesc",
  },
  {
    id: "media",
    labelKey: "tabs.media",
    icon: <ImageIcon className="h-4 w-4" />,
    descriptionKey: "navigation.mediaDesc",
  },
  {
    id: "properties",
    labelKey: "tabs.properties",
    icon: <Settings2 className="h-4 w-4" />,
    descriptionKey: "navigation.propertiesDesc",
  },
  {
    id: "variants",
    labelKey: "tabs.variants",
    icon: <GitBranch className="h-4 w-4" />,
    descriptionKey: "navigation.variantsDesc",
  },
];

export default function CreateProductPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { t } = useTranslation("products");
  const [activeTab, setActiveTab] = useState("basic");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formState, setFormState] = useState<ProductFormState>(initialFormState);
  const [contentVisible, setContentVisible] = useState(false);

  // Duplicate/variant functionality
  const duplicateId = searchParams.get("duplicate");
  const [sourceProduct, setSourceProduct] = useState<ProductDetail | null>(null);
  const [isLoadingSource, setIsLoadingSource] = useState(false);

  // Trigger entrance animation
  useEffect(() => {
    const timer = setTimeout(() => setContentVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Fetch source product for duplication/variant creation
  useEffect(() => {
    if (!duplicateId) return;

    let cancelled = false;

    async function fetchSourceProduct() {
      setIsLoadingSource(true);
      try {
        // Fetch source product and generate unique code in parallel
        const [product, uniqueCode] = await Promise.all([
          api.getProduct(duplicateId as string),
          generateUniqueCode(),
        ]);

        if (cancelled) return;

        setSourceProduct(product);

        // Pre-fill form with ALL source product data for complete variant duplication
        setFormState((prev) => ({
          ...prev,
          basicInfo: {
            ...prev.basicInfo,
            name: `${product.name} (Variant)`,
            code: uniqueCode, // Auto-generated unique code
            article: product.article || "",
            description: product.description || "",
            // Copy brand and category from source product (now using direct IDs)
            brand_id: product.brand_id || "",
            category_id: product.category_id || "",
            warranty: product.warranty || "",
            barcodes: [], // Clear barcodes - should be unique
            is_active: true,
            is_service: product.is_service || false,
            // Copy pricing
            price_mdl: product.price_mdl ?? null,
            price_eur: product.price_eur ?? null,
            price_usd: product.price_usd ?? null,
            total_stock: 0, // Reset stock for new variant
            is_in_stock: false,
          },
          media: {
            main_image_url: product.main_image_url || "",
            // Copy all images and videos from source product
            images: product.images || [],
            videos: product.videos || [],
          },
          // Copy all properties from source product
          properties: (product.properties || []).map((prop) => ({
            group_name: prop.group_name || null,
            property_name: prop.property_name || "",
            property_code: prop.property_code || null,
            value: prop.value || "",
            value_type: prop.value_type || "string",
            group_uuid: prop.group_uuid || null,
            sort_order: prop.sort_order ?? 0,
            is_filter: prop.is_filter ?? false,
            is_modification: prop.is_modification ?? false,
          })),
          variants: {
            // Auto-link to parent: use source's group if it's already a variant, otherwise use source as parent
            parent_id: product.parent_id || product.id,
            is_group: false,
            variant_type: null, // Will be set by user in variants tab
            variant_value: null,
          },
        }));
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to fetch source product:", error);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSource(false);
        }
      }
    }

    fetchSourceProduct();

    return () => {
      cancelled = true;
    };
    // Note: toast is intentionally excluded from deps to prevent infinite re-renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duplicateId]);

  // Update handlers for each section
  const updateBasicInfo = useCallback(
    (updates: Partial<ProductFormState["basicInfo"]>) => {
      setFormState((prev) => ({
        ...prev,
        basicInfo: { ...prev.basicInfo, ...updates },
      }));
    },
    []
  );

  const updateMedia = useCallback(
    (updates: Partial<ProductFormState["media"]>) => {
      setFormState((prev) => ({
        ...prev,
        media: { ...prev.media, ...updates },
      }));
    },
    []
  );

  const setProperties = useCallback((properties: CreatePropertyData[]) => {
    setFormState((prev) => ({ ...prev, properties }));
  }, []);

  const updateVariants = useCallback(
    (updates: Partial<ProductFormState["variants"]>) => {
      setFormState((prev) => ({
        ...prev,
        variants: { ...prev.variants, ...updates },
      }));
    },
    []
  );

  // Validation
  const validateForm = (): string | null => {
    if (!formState.basicInfo.name.trim()) {
      return t("basicInfo.title") + " " + t("basicInfo.required");
    }
    return null;
  };

  // Get tab completion status
  const getTabStatus = useCallback(
    (tabId: string) => {
      switch (tabId) {
        case "basic":
          return formState.basicInfo.name.trim().length > 0;
        case "media":
          return (
            formState.media.images.length > 0 ||
            formState.media.videos.length > 0 ||
            formState.media.main_image_url.length > 0
          );
        case "properties":
          return formState.properties.length > 0;
        case "variants":
          return formState.variants.parent_id !== null || formState.variants.is_group;
        default:
          return false;
      }
    },
    [formState]
  );

  // Get count badge for tabs
  const getTabCount = useCallback(
    (tabId: string): number | null => {
      switch (tabId) {
        case "media":
          return formState.media.images.length + formState.media.videos.length || null;
        case "properties":
          return formState.properties.length || null;
        default:
          return null;
      }
    },
    [formState]
  );

  // Submit handler
  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) {
      toast({
        title: t("toast.validationError"),
        description: validationError,
        variant: "destructive",
      });
      setActiveTab("basic");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: CreateProductPayload = {
        name: formState.basicInfo.name,
        code: formState.basicInfo.code || null,
        article: formState.basicInfo.article || null,
        description: formState.basicInfo.description || null,
        brand_id: formState.basicInfo.brand_id || null,
        category_id: formState.basicInfo.category_id || null,
        source_id: formState.basicInfo.source_id || null,
        warranty: formState.basicInfo.warranty || null,
        barcodes: formState.basicInfo.barcodes,
        is_active: formState.basicInfo.is_active,
        is_service: formState.basicInfo.is_service,
        // Product-level pricing
        price_mdl: formState.basicInfo.price_mdl,
        price_eur: formState.basicInfo.price_eur,
        price_usd: formState.basicInfo.price_usd,
        total_stock: formState.basicInfo.total_stock,
        is_in_stock: formState.basicInfo.is_in_stock,
        // Media
        main_image_url: formState.media.main_image_url || null,
        images: formState.media.images.length > 0 ? formState.media.images : undefined,
        videos: formState.media.videos.length > 0 ? formState.media.videos : undefined,
        properties: formState.properties.length > 0 ? formState.properties : undefined,
        parent_id: formState.variants.parent_id,
        is_group: formState.variants.is_group,
        variant_type: formState.variants.variant_type,
        variant_value: formState.variants.variant_value,
      };

      const product = await api.createProduct(payload);

      toast({
        title: t("toast.productCreated"),
        description: t("toast.productCreatedDesc", { name: product.name }),
      });

      router.push(`/products/${product.id}`);
    } catch (error) {
      toast({
        title: t("toast.updateFailed"),
        description:
          error instanceof Error ? error.message : t("toast.deleteFailed"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Navigate to next tab
  const goToNextTab = () => {
    const currentIndex = tabConfigs.findIndex((tab) => tab.id === activeTab);
    if (currentIndex < tabConfigs.length - 1) {
      setActiveTab(tabConfigs[currentIndex + 1].id);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-6 p-6 transition-all duration-500",
        contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}
    >
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link
          href="/products"
          className="hover:text-foreground transition-colors"
        >
          {t("page.title")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        {sourceProduct && (
          <>
            <Link
              href={`/products/${sourceProduct.id}`}
              className="hover:text-foreground transition-colors max-w-[200px] truncate"
            >
              {sourceProduct.name}
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
          </>
        )}
        <span className="text-foreground font-medium">
          {duplicateId ? t("page.newVariant") : t("page.newProduct")}
        </span>
      </nav>

      {/* Premium Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.back()}
            className="shrink-0 h-10 w-10 rounded-xl border-border/50 transition-all duration-200 hover:bg-muted hover:border-border hover:-translate-y-0.5 hover:shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-4">
            <div className={cn(
              "flex h-12 w-12 items-center justify-center rounded-xl border shadow-sm",
              duplicateId
                ? "bg-gradient-to-br from-blue-500/20 to-blue-500/5 border-blue-500/20"
                : "bg-gradient-to-br from-primary/20 to-primary/5 border-primary/20"
            )}>
              {duplicateId ? (
                <GitBranch className="h-6 w-6 text-blue-500" />
              ) : (
                <Package className="h-6 w-6 text-primary" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {duplicateId ? t("page.createVariant") : t("page.newTitle")}
              </h1>
              <p className="text-sm text-muted-foreground">
                {duplicateId && sourceProduct
                  ? t("page.creatingVariantOf", { name: sourceProduct.name })
                  : t("page.newDescription")}
              </p>
            </div>
          </div>
        </div>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || isLoadingSource}
          className="h-10 px-6 rounded-xl transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
        >
          {isSubmitting || isLoadingSource ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {duplicateId ? t("page.createVariant") : t("page.newTitle")}
        </Button>
      </div>

      {/* Multi-Tab Form Card */}
      <Card className="rounded-xl border-border/50 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Premium Tab Navigation */}
            <div className="border-b border-border/50 bg-gradient-to-r from-muted/30 to-muted/10">
              <TabsList className="h-auto w-full justify-start gap-0 rounded-none bg-transparent p-0">
                {tabConfigs.map((tab, index) => {
                  const isActive = activeTab === tab.id;
                  const isCompleted = getTabStatus(tab.id);
                  const count = getTabCount(tab.id);

                  return (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      className={cn(
                        "relative flex items-center gap-2 rounded-none border-b-2 px-6 py-4",
                        "transition-all duration-200 ease-out",
                        "data-[state=active]:bg-background data-[state=active]:border-primary",
                        "data-[state=inactive]:border-transparent data-[state=inactive]:hover:bg-muted/50",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0"
                      )}
                      style={{
                        animationDelay: contentVisible ? `${index * 50}ms` : "0ms",
                      }}
                    >
                      <span
                        className={cn(
                          "transition-colors duration-200",
                          isActive ? "text-primary" : "text-muted-foreground"
                        )}
                      >
                        {tab.icon}
                      </span>
                      <span className="font-medium">{t(tab.labelKey)}</span>
                      {count !== null && count > 0 && (
                        <Badge
                          variant="secondary"
                          className={cn(
                            "ml-1 h-5 min-w-[20px] px-1.5 text-xs font-medium transition-colors duration-200",
                            isActive
                              ? "bg-primary/10 text-primary border-primary/20"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {count}
                        </Badge>
                      )}
                      {isCompleted && !count && (
                        <CheckCircle2
                          className={cn(
                            "ml-1 h-4 w-4 transition-colors duration-200",
                            isActive ? "text-primary" : "text-primary/50"
                          )}
                        />
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            {/* Tab Content with Smooth Transitions */}
            <div className="p-6">
              <TabsContent
                value="basic"
                className="m-0 focus-visible:outline-none focus-visible:ring-0 data-[state=inactive]:hidden"
              >
                <BasicInfoTab
                  data={formState.basicInfo}
                  onChange={updateBasicInfo}
                />
              </TabsContent>

              <TabsContent
                value="media"
                className="m-0 focus-visible:outline-none focus-visible:ring-0 data-[state=inactive]:hidden"
              >
                <MediaTab data={formState.media} onChange={updateMedia} />
              </TabsContent>

              <TabsContent
                value="properties"
                className="m-0 focus-visible:outline-none focus-visible:ring-0 data-[state=inactive]:hidden"
              >
                <PropertiesTab
                  properties={formState.properties}
                  onChange={setProperties}
                />
              </TabsContent>

              <TabsContent
                value="variants"
                className="m-0 focus-visible:outline-none focus-visible:ring-0 data-[state=inactive]:hidden"
              >
                <VariantsTab
                  data={formState.variants}
                  onChange={updateVariants}
                  sourceProduct={sourceProduct}
                />
              </TabsContent>
            </div>

            {/* Bottom Action Bar */}
            <div className="border-t border-border/50 bg-muted/20 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>
                    {t("navigation.step", { current: tabConfigs.findIndex((tab) => tab.id === activeTab) + 1, total: tabConfigs.length })}
                  </span>
                  <span className="text-border">|</span>
                  <span className="text-foreground font-medium">
                    {t(tabConfigs.find((tab) => tab.id === activeTab)?.descriptionKey || "")}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {activeTab !== tabConfigs[tabConfigs.length - 1].id && (
                    <Button
                      variant="outline"
                      onClick={goToNextTab}
                      className="transition-all duration-200 hover:bg-muted"
                    >
                      {t("navigation.continue")}
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting || isLoadingSource}
                    className="transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
                  >
                    {isSubmitting || isLoadingSource ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    {duplicateId ? t("page.createVariant") : t("page.newTitle")}
                  </Button>
                </div>
              </div>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
