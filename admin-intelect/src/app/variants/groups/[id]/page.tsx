"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  Layers,
  Package,
  Tags,
  Grid3X3,
  ExternalLink,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/contexts/language-context";
import { VariantGroupWithDetails } from "@/types/variants";
import { VariantMatrixEditor } from "@/components/variants/variant-matrix-editor";
import { PriceDisplay } from "@/components/ui/price-display";

export default function VariantGroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useTranslation("variants");
  const { t: tCommon } = useTranslation("common");
  const groupId = params.id as string;

  // State
  const [group, setGroup] = useState<VariantGroupWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [contentVisible, setContentVisible] = useState(false);

  // Trigger staggered entrance animations
  useEffect(() => {
    const timer = setTimeout(() => setContentVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Load group data
  const loadGroup = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getVariantGroup(groupId, true); // Include matrix
      setGroup(data);
    } catch (error) {
      console.error("Failed to load variant group:", error);
      toast({
        title: tCommon("status.failed"),
        description: t("errors.loadGroup"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [groupId, t, tCommon, toast]);

  // Initial load
  useEffect(() => {
    loadGroup();
  }, [loadGroup]); // loadGroup already depends on groupId via useCallback

  // Only show loading spinner on initial load, not during revalidation
  if (loading && !group) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{t("loading.variantGroup")}</p>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="container mx-auto p-4">
        <Card className="rounded-xl border-border/50 shadow-sm">
          <CardContent className="py-12 text-center">
            <div className="h-14 w-14 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
              <Layers className="h-7 w-7 text-muted-foreground/30" />
            </div>
            <p className="text-base font-semibold mb-1">{t("details.groupNotFound")}</p>
            <p className="text-sm text-muted-foreground mb-4">
              {t("details.groupNotFoundDesc")}
            </p>
            <Button
              variant="outline"
              onClick={() => router.push("/variants")}
              size="sm"
              className="transition-all duration-200 hover:shadow-md active:scale-95 h-9"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("actions.backToVariants")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div
        className={cn(
          "space-y-4 transition-all duration-500 ease-out",
          contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        )}
      >
        {/* Page Header - Clean and Simple */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{group.base_name}</h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              {group.member_count === 1
                ? t("details.productsCount", { count: group.member_count })
                : t("details.productsCountPlural", { count: group.member_count })
              } {t("details.inGroup")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push("/variants")}>
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              {t("actions.backToVariants")}
            </Button>
            <Button variant="outline" size="sm" onClick={loadGroup} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4 mr-1.5", loading && "animate-spin")} />
              {t("actions.refresh")}
            </Button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="flex flex-wrap items-center gap-3">
          {[
            {
              label: t("details.products"),
              value: (group.members?.length ?? 0).toLocaleString(),
              icon: <Package className="h-3.5 w-3.5" />,
              variant: "default" as const,
            },
            {
              label: t("details.variantProps"),
              value: (group.properties?.length ?? 0).toLocaleString(),
              icon: <Tags className="h-3.5 w-3.5" />,
              variant: (group.properties?.length ?? 0) > 0 ? "success" as const : "muted" as const,
            },
            {
              label: t("details.matrixColumns"),
              value: (group.matrix?.columns.filter((c) => c.is_variant).length ?? 0).toLocaleString(),
              icon: <Grid3X3 className="h-3.5 w-3.5" />,
              variant: (group.matrix?.columns.filter((c) => c.is_variant).length ?? 0) > 0 ? "success" as const : "muted" as const,
            },
          ].map((stat, index) => (
            <div
              key={stat.label}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200 ease-out hover:shadow-sm hover:border-border/80 hover:-translate-y-0.5",
                stat.variant === "success" && "bg-primary/5 border-primary/20 hover:bg-primary/10",
                stat.variant === "warning" && "bg-destructive/5 border-destructive/20 hover:bg-destructive/10",
                (stat.variant === "default" || stat.variant === "muted") && "bg-muted/50"
              )}
              style={{
                animationDelay: `${index * 50}ms`,
              }}
            >
              {stat.icon && (
                <span className={cn(
                  stat.variant === "success" && "text-primary",
                  stat.variant === "warning" && "text-destructive",
                  (stat.variant === "default" || stat.variant === "muted") && "text-muted-foreground"
                )}>
                  {stat.icon}
                </span>
              )}
              <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
              <span className="text-sm font-semibold tabular-nums">{stat.value}</span>
            </div>
          ))}
        </div>

        {/* Member Products Grid */}
        <Card className="rounded-xl shadow-sm overflow-hidden">
          <div className="p-3 border-b">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-muted">
                <Package className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">{t("cards.memberProducts")}</h3>
                <p className="text-xs text-muted-foreground">
                  {(group.members?.length ?? 0) === 1
                    ? t("details.productsCount", { count: group.members?.length ?? 0 })
                    : t("details.productsCountPlural", { count: group.members?.length ?? 0 })
                  } {t("details.inGroup")}
                </p>
              </div>
            </div>
          </div>
          <CardContent className="p-3">
            {!group.members || group.members.length === 0 ? (
              <div className="text-center py-10">
                <div className="h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-2">
                  <Package className="h-5 w-5 text-muted-foreground/30" />
                </div>
                <p className="text-xs text-muted-foreground">{t("empty.noProducts")}</p>
              </div>
            ) : (
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
                {group.members.map((member, index) => {
                  return (
                    <div
                      key={member.id}
                      className="group relative p-2 rounded-lg border border-border/50 bg-card hover:border-primary/40 hover:shadow-md transition-all duration-300 cursor-pointer hover:-translate-y-0.5"
                      onClick={() => router.push(`/products/${member.id}`)}
                      style={{
                        animationDelay: `${Math.min(index * 20, 400)}ms`,
                        opacity: 0,
                        animation: "fadeIn 0.3s ease-out forwards"
                      }}
                    >
                      <div className="aspect-square relative mb-1.5 rounded-md overflow-hidden bg-muted/30 ring-1 ring-border/50">
                        {member.main_image_url ? (
                          <Image
                            src={member.main_image_url}
                            alt={member.name || t("details.unknownProduct")}
                            fill
                            className="object-cover group-hover:scale-110 transition-transform duration-500"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Package className="h-10 w-10 text-muted-foreground/20" />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-xs line-clamp-2 min-h-[2rem] group-hover:text-primary transition-colors duration-200">
                          {member.name ?? t("details.unknownProduct")}
                        </div>
                        {member.article && (
                          <div className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
                            {member.article}
                          </div>
                        )}
                        <div className="mt-1">
                          <PriceDisplay
                            priceMdl={member.price_mdl}
                            priceEur={member.price_eur}
                            priceUsd={member.price_usd}
                            discountedPriceMdl={member.discounted_price_mdl}
                            discountedPriceEur={member.discounted_price_eur}
                            discountedPriceUsd={member.discounted_price_usd}
                            discountPercent={member.effective_discount_percent}
                            size="sm"
                          />
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-all duration-200 bg-background/80 backdrop-blur-sm hover:bg-background/90 rounded-md"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`/products/${member.id}`, "_blank");
                        }}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Variant Matrix Editor */}
        {group.matrix && (
          <Card className="rounded-xl shadow-sm overflow-hidden">
            <div className="p-3 border-b">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-muted">
                  <Grid3X3 className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{t("cards.variantMatrix")}</h3>
                  <p className="text-xs text-muted-foreground">
                    {t("details.matrixDescription")}
                  </p>
                </div>
              </div>
            </div>
            <CardContent className="p-0 overflow-x-auto">
              <VariantMatrixEditor matrix={group.matrix} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
