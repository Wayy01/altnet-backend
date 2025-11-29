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
  UpdateProductPayload,
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

function EditProductSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Breadcrumb skeleton */}
      <div className="flex items-center gap-1.5">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-3 w-3" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-3" />
        <Skeleton className="h-4 w-20" />
      </div>

      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div>
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32 mt-1" />
            </div>
          </div>
        </div>
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>

      {/* Card skeleton */}
      <div className="rounded-xl border shadow-sm">
        <div className="border-b p-0">
          <div className="flex gap-0">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-14 w-32" />
            ))}
          </div>
        </div>
        <div className="p-6 space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
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

    async function loadProduct() {
      try {
        const product = await api.getProduct(productId);

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
            total_stock: product.total_stock ?? 0,
            is_in_stock: product.is_in_stock ?? false,
          },
          media: {
            main_image_url: product.main_image_url || "",
            images: product.images || [],
            videos: product.videos || [],
          },
          properties: (product.properties || []).map((prop) => ({
            group_name: prop.group_name || "",
            property_name: prop.property_name || "",
            value: prop.value || "",
          })),
          variants: {
            parent_id: product.parent_id || null,
            is_group: product.is_group ?? false,
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
      const payload: UpdateProductPayload = {
        name: formState.basicInfo.name,
        code: formState.basicInfo.code || null,
        article: formState.basicInfo.article || null,
        description: formState.basicInfo.description || null,
        brand_id: formState.basicInfo.brand_id || null,
        category_id: formState.basicInfo.category_id || null,
        is_active: formState.basicInfo.is_active,
        is_service: formState.basicInfo.is_service,
      };

      await api.updateProduct(productId, payload);

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
        {originalProduct && (
          <>
            <Link
              href={`/products/${originalProduct.id}`}
              className="hover:text-foreground transition-colors max-w-[200px] truncate"
            >
              {originalProduct.name}
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
          </>
        )}
        <span className="text-foreground font-medium">
          {t("page.editProduct") || "Edit"}
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
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border shadow-sm bg-gradient-to-br from-amber-500/20 to-amber-500/5 border-amber-500/20">
              <Pencil className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {t("page.editTitle") || "Edit Product"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {originalProduct
                  ? t("page.editingProduct", { name: originalProduct.name }) || `Editing ${originalProduct.name}`
                  : t("page.editDescription") || "Update product details"}
              </p>
            </div>
          </div>
        </div>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="h-10 px-6 rounded-xl transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
        >
          {isSubmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {t("page.saveChanges") || "Save Changes"}
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
                  sourceProduct={originalProduct}
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
                    disabled={isSubmitting}
                    className="transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
                  >
                    {isSubmitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    {t("page.saveChanges") || "Save Changes"}
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
