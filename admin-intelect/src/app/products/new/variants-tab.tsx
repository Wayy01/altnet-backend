"use client";

import { useState, useEffect } from "react";
import {
  Package,
  ExternalLink,
  GitBranch,
  Info,
  Palette,
  HardDrive,
  Cpu,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { Product, ProductFormState, ProductDetail } from "@/types";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/contexts/language-context";

interface VariantsTabProps {
  data: ProductFormState["variants"];
  onChange: (updates: Partial<ProductFormState["variants"]>) => void;
  /** Source product when duplicating/creating variant */
  sourceProduct?: ProductDetail | null;
}

/**
 * Simplified Variants Tab - Shows auto-detected variant info
 * Variants are now automatically detected from product properties (color, storage)
 */
export function VariantsTab({ data, onChange, sourceProduct }: VariantsTabProps) {
  const { t } = useTranslation("products");
  const [selectedParent, setSelectedParent] = useState<Product | null>(null);
  const [sectionsVisible, setSectionsVisible] = useState(false);

  // Trigger entrance animation
  useEffect(() => {
    const timer = setTimeout(() => setSectionsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Load parent product details if parent_id is set
  useEffect(() => {
    if (!data.parent_id) {
      setSelectedParent(null);
      return;
    }

    let cancelled = false;
    async function loadParent() {
      try {
        const parent = await api.getProduct(data.parent_id!);
        if (!cancelled) {
          setSelectedParent(parent as Product);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load parent product:", error);
        }
      }
    }
    loadParent();
    return () => { cancelled = true; };
  }, [data.parent_id]);

  const Section = ({
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
        sectionsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
        className
      )}
      style={{ transitionDelay: sectionsVisible ? `${index * 100}ms` : "0ms" }}
    >
      {children}
    </div>
  );

  // Get variant type icon
  const getVariantIcon = () => {
    if (!data.variant_type) return Sparkles;
    // Check for combined types first, then individual types
    if (data.variant_type.includes("color")) return Palette;
    if (data.variant_type.includes("storage")) return HardDrive;
    if (data.variant_type.includes("ram")) return Cpu;
    return Sparkles;
  };
  const VariantIcon = getVariantIcon();

  return (
    <div className="space-y-4">
      {/* Header - Compact */}
      <Section index={0}>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
            <GitBranch className="h-4 w-4 text-primary" />
          </div>
          <div>
            <Label className="text-sm font-semibold">{t("variants.title")}</Label>
            <p className="text-xs text-muted-foreground">
              {t("variants.description")}
            </p>
          </div>
        </div>
      </Section>

      {/* Auto-Detection Info - Compact */}
      <Section index={1}>
        <div className="rounded-xl border-2 border-blue-500/30 bg-blue-500/5 p-3">
          <div className="flex items-start gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20">
              <Sparkles className="h-4 w-4 text-blue-500" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <h4 className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                  {t("variants.autoDetected")}
                </h4>
                <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/20 text-xs">
                  {t("variants.automatic")}
                </Badge>
              </div>
              <p
                className="text-xs text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: t("variants.autoDetectedDesc") }}
              />
            </div>
          </div>
        </div>
      </Section>

      {/* Current Variant Info (if any) - Compact */}
      {(data.variant_type || data.variant_value || data.parent_id) && (
        <Section index={2}>
          <div className="rounded-xl border border-border/50 bg-card p-3 space-y-3">
            <div className="flex items-center gap-2">
              <VariantIcon className="h-4 w-4 text-primary" />
              <Label className="text-sm font-semibold">{t("variants.variantInfo")}</Label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {data.variant_type && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t("variants.variantType")}</p>
                  <Badge variant="secondary" className="font-medium">
                    {data.variant_type}
                  </Badge>
                </div>
              )}
              {data.variant_value && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t("variants.variantValue")}</p>
                  <Badge variant="outline" className="font-medium">
                    {data.variant_value}
                  </Badge>
                </div>
              )}
            </div>

            {/* Parent Product Display - Compact */}
            {selectedParent && (
              <div className="pt-2 border-t border-border/50">
                <p className="text-xs text-muted-foreground mb-1.5">{t("variants.linkedToParent")}</p>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border/50">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background border border-border/50 overflow-hidden">
                    {selectedParent.main_image_url ? (
                      <img
                        src={selectedParent.main_image_url}
                        alt={selectedParent.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Package className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{selectedParent.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {selectedParent.code && (
                        <span className="font-mono">{selectedParent.code}</span>
                      )}
                      {selectedParent.brand_name && (
                        <>
                          <span className="text-border">|</span>
                          <span>{selectedParent.brand_name}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Link
                    href={`/products/${selectedParent.id}`}
                    target="_blank"
                    className={cn(
                      "flex items-center justify-center h-8 w-8 rounded-lg",
                      "border border-border/50 bg-background",
                      "hover:bg-muted hover:border-border"
                    )}
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Info Box - Compact */}
      <Section index={data.variant_type || data.parent_id ? 3 : 2}>
        <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
          <div className="flex items-start gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
              <Info className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h4 className="text-sm font-medium mb-1.5">{t("variants.howItWorks")}</h4>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Palette className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                  <span>
                    <strong className="text-foreground">{t("variants.colorVariants")}</strong>: {t("variants.colorVariantsDesc")}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <HardDrive className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                  <span>
                    <strong className="text-foreground">{t("variants.storageVariants")}</strong>: {t("variants.storageVariantsDesc")}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Cpu className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                  <span>
                    <strong className="text-foreground">{t("variants.ramVariants")}</strong>: {t("variants.ramVariantsDesc")}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <GitBranch className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                  <span>
                    {t("variants.groupingDesc")}
                  </span>
                </li>
              </ul>
              <div className="mt-3 pt-3 border-t border-border/50">
                <Link
                  href="/groupings"
                  className={cn(
                    "inline-flex items-center gap-1.5 text-sm font-medium text-primary",
                    "transition-colors hover:text-primary/80"
                  )}
                >
                  {t("variants.manageGroupings")}
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
