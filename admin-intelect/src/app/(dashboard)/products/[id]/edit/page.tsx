"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  Pencil,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import {
  ProductFormState,
  UpdateProductFullPayload,
  CreatePropertyData,
  ProductDetail,
} from "@/types";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/contexts/language-context";

import { BasicInfoTab } from "../../new/basic-info-tab";
import { MediaTab } from "../../new/media-tab";
import { PropertiesTab } from "../../new/properties-tab";
import { VariantsTab } from "../../new/variants-tab";

interface EditProductPageProps {
  params: Promise<{
    id: string;
  }>;
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
    price_mdl: null,
    price_eur: null,
    price_usd: null,
    manual_discount_percent: null,
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

/**
 * Premium skeleton loader with staggered animations - Compact spacing (p-3, p-4)
 */
function EditProductSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {/* Breadcrumb skeleton */}
      <div className="flex items-center gap-1.5">
        <Skeleton className="h-4 w-16" style={{ animationDelay: "0ms" }} />
        <Skeleton className="h-3 w-3" style={{ animationDelay: "30ms" }} />
        <Skeleton className="h-4 w-24" style={{ animationDelay: "60ms" }} />
        <Skeleton className="h-3 w-3" style={{ animationDelay: "90ms" }} />
        <Skeleton className="h-4 w-20" style={{ animationDelay: "120ms" }} />
      </div>

      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-xl" style={{ animationDelay: "150ms" }} />
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-xl" style={{ animationDelay: "180ms" }} />
            <div>
              <Skeleton className="h-8 w-48" style={{ animationDelay: "210ms" }} />
              <Skeleton className="h-4 w-32 mt-1" style={{ animationDelay: "240ms" }} />
            </div>
          </div>
        </div>
        <Skeleton className="h-10 w-32 rounded-xl" style={{ animationDelay: "270ms" }} />
      </div>

      {/* Card skeleton with compact padding */}
      <div className="rounded-xl border shadow-sm" style={{ animationDelay: "300ms" }}>
        <div className="border-b p-0 bg-muted/30">
          <div className="flex gap-0">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-32" style={{ animationDelay: `${300 + i * 30}ms` }} />
            ))}
          </div>
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10 w-full" style={{ animationDelay: `${420 + i * 30}ms` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function EditProductPage({ params }: EditProductPageProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useTranslation("products");
  const [productId, setProductId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("basic");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [formState, setFormState] = useState<ProductFormState>(initialFormState);
  const [contentVisible, setContentVisible] = useState(false);
  const [originalProduct, setOriginalProduct] = useState<ProductDetail | null>(null);

  // Unwrap params Promise once on mount
  useEffect(() => {
    let cancelled = false;

    async function unwrapParams() {
      const { id } = await params;
      if (!cancelled) {
        setProductId(id);
      }
    }

    unwrapParams();

    return () => {
      cancelled = true;
    };
  }, [params]);

  // Load product data when productId is set
  useEffect(() => {
    if (!productId) return;

    let cancelled = false;
    const currentProductId = productId; // Capture for closure to satisfy TypeScript

    async function loadProduct() {
      try {
        const product = await api.getProduct(currentProductId);

        if (cancelled) return;

        if (!product) {
          toast({
            title: "Product not found",
            description: "The product you're trying to edit doesn't exist.",
            variant: "destructive",
          });
          router.push("/products");
          return;
        }

        setOriginalProduct(product);

        // Pre-fill form with product data
        setFormState({
          basicInfo: {
            name: product.name || "",
            code: product.code || "",
            article: product.article || "",
            description: product.description || "",
            brand_id: product.brand_id || "",
            category_id: product.category_id || "",
            source_id: product.source_id || "",
            warranty: product.warranty || "",
            barcodes: product.barcodes || [],
            is_active: product.is_active ?? true,
            is_service: product.is_service ?? false,
            price_mdl: product.price_mdl ?? null,
            price_eur: product.price_eur ?? null,
            price_usd: product.price_usd ?? null,
            manual_discount_percent: product.manual_discount_percent ?? null,
            total_stock: product.total_stock ?? 0,
            is_in_stock: product.is_in_stock ?? false,
          },
          media: {
            main_image_url: product.main_image_url || "",
            images: product.images || [],
            videos: product.videos || [],
          },
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
            parent_id: product.parent_id || null,
            is_group: product.is_group ?? false,
            variant_type: (product as { variant_type?: string | null }).variant_type || null,
            variant_value: (product as { variant_value?: string | null }).variant_value || null,
          },
        });

        // Trigger entrance animation
        setTimeout(() => setContentVisible(true), 50);
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load product:", error);
          toast({
            title: "Failed to load product",
            description: error instanceof Error ? error.message : "Unknown error",
            variant: "destructive",
          });
          router.push("/products");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadProduct();

    return () => {
      cancelled = true;
    };
    // Note: toast and router are intentionally excluded from deps to prevent infinite re-renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

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
    if (!productId) return;

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
      // Build full payload including properties
      const payload: UpdateProductFullPayload = {
        // Basic Info
        name: formState.basicInfo.name,
        code: formState.basicInfo.code || null,
        article: formState.basicInfo.article || null,
        description: formState.basicInfo.description || null,
        brand_id: formState.basicInfo.brand_id || null,
        category_id: formState.basicInfo.category_id || null,
        source_id: formState.basicInfo.source_id || null,
        warranty: formState.basicInfo.warranty || null,
        barcodes: formState.basicInfo.barcodes || [],
        is_active: formState.basicInfo.is_active,
        is_service: formState.basicInfo.is_service,
        // Pricing
        price_mdl: formState.basicInfo.price_mdl,
        price_eur: formState.basicInfo.price_eur,
        price_usd: formState.basicInfo.price_usd,
        manual_discount_percent: formState.basicInfo.manual_discount_percent,
        total_stock: formState.basicInfo.total_stock,
        is_in_stock: formState.basicInfo.is_in_stock,
        // Media
        main_image_url: formState.media.main_image_url || null,
        images: formState.media.images.map((img) => ({
          url: img.url,
          alt: img.alt || null,
          sort_order: img.sort_order ?? 0,
        })),
        videos: formState.media.videos.map((vid) => ({
          url: vid.url,
          title: vid.title || null,
          description: vid.description || null,
          sort_order: vid.sort_order ?? 0,
        })),
        // Properties - will replace existing properties
        properties: formState.properties.map((prop) => ({
          property_name: prop.property_name,
          property_code: prop.property_code || null,
          value: prop.value,
          value_type: prop.value_type || "string",
          group_uuid: prop.group_uuid || null,
          group_name: prop.group_name || null,
          sort_order: prop.sort_order ?? 0,
          is_filter: prop.is_filter ?? false,
          is_modification: prop.is_modification ?? false,
        })),
        // Variants
        parent_id: formState.variants.parent_id,
        is_group: formState.variants.is_group,
      };

      await api.updateProductFull(productId, payload);

      toast({
        title: t("toast.productUpdated") || "Product updated",
        description: t("toast.productUpdatedDesc", { name: formState.basicInfo.name }) || `${formState.basicInfo.name} has been updated successfully.`,
      });

      router.push(`/products/${productId}`);
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

  if (isLoading) {
    return <EditProductSkeleton />;
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 transition-all duration-500",
        contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}
    >
      {/* Breadcrumb Navigation - Compact */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link
          href="/products"
          className="hover:text-foreground transition-colors duration-200"
        >
          {t("page.title")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        {originalProduct && (
          <>
            <Link
              href={`/products/${originalProduct.id}`}
              className="hover:text-foreground transition-colors duration-200 max-w-[200px] truncate"
            >
              {originalProduct.name}
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
          </>
        )}
        <span className="text-foreground font-medium">
          {t("page.editProduct")}
        </span>
      </nav>

      {/* Premium Page Header - Compact */}
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
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border shadow-sm bg-gradient-to-br from-amber-500/20 to-amber-500/5 border-amber-500/20 transition-all duration-200 hover:scale-105">
              <Pencil className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {t("page.editTitle")}
              </h1>
              <p className="text-sm text-muted-foreground">
                {originalProduct
                  ? t("page.editingProduct", { name: originalProduct.name })
                  : t("page.editDescription")}
              </p>
            </div>
          </div>
        </div>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="h-10 px-6 rounded-xl transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:scale-[1.02]"
        >
          {isSubmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {t("page.saveChanges")}
        </Button>
      </div>

      {/* Multi-Tab Form Card - Compact Design */}
      <Card className="rounded-xl border-border/50 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Premium Tab Navigation - Compact */}
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
                        "relative flex items-center gap-2 rounded-none border-b-2 px-5 py-3",
                        "transition-all duration-200 ease-out",
                        "data-[state=active]:bg-background data-[state=active]:border-primary data-[state=active]:shadow-sm",
                        "data-[state=inactive]:border-transparent data-[state=inactive]:hover:bg-muted/50",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0"
                      )}
                      style={{
                        animationDelay: contentVisible ? `${index * 50}ms` : "0ms",
                      }}
                    >
                      <span
                        className={cn(
                          "transition-all duration-200",
                          isActive ? "text-primary scale-110" : "text-muted-foreground"
                        )}
                      >
                        {tab.icon}
                      </span>
                      <span className={cn(
                        "font-medium transition-colors duration-200",
                        isActive ? "text-foreground" : "text-muted-foreground"
                      )}>
                        {t(tab.labelKey)}
                      </span>
                      {count !== null && count > 0 && (
                        <Badge
                          variant="secondary"
                          className={cn(
                            "ml-1 h-5 min-w-[20px] px-1.5 text-xs font-medium transition-all duration-200",
                            isActive
                              ? "bg-primary/10 text-primary border-primary/20 scale-105"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {count}
                        </Badge>
                      )}
                      {isCompleted && !count && (
                        <CheckCircle2
                          className={cn(
                            "ml-1 h-4 w-4 transition-all duration-200",
                            isActive ? "text-primary scale-110" : "text-primary/50"
                          )}
                        />
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            {/* Tab Content with Smooth Transitions - Compact padding */}
            <div className="p-4">
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
                  sourceProduct={originalProduct}
                />
              </TabsContent>
            </div>

            {/* Bottom Action Bar - Compact */}
            <div className="border-t border-border/50 bg-muted/20 px-4 py-3">
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
                      className="transition-all duration-200 hover:bg-muted hover:shadow-sm hover:-translate-y-0.5"
                    >
                      {t("navigation.continue")}
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:scale-[1.02]"
                  >
                    {isSubmitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    {t("page.saveChanges")}
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
