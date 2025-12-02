"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  Layers,
  Package,
  ChevronRight,
  Calendar,
  Hash,
  Tags,
  Grid3X3,
  ExternalLink,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/contexts/language-context";
import { VariantGroupWithDetails } from "@/types/variants";
import { VariantMatrixEditor } from "@/components/variants/variant-matrix-editor";

export default function VariantGroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useTranslation("navigation");
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
        title: "Error",
        description: "Failed to load variant group details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [groupId, toast]);

  // Initial load
  useEffect(() => {
    loadGroup();
  }, [loadGroup]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading variant group...</p>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="container mx-auto py-6">
        <Card className="border-0 shadow-lg">
          <CardContent className="py-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center mx-auto mb-4">
              <Layers className="h-8 w-8 text-muted-foreground/30" />
            </div>
            <p className="text-lg font-medium mb-2">Group Not Found</p>
            <p className="text-sm text-muted-foreground mb-4">
              The variant group you&apos;re looking for doesn&apos;t exist.
            </p>
            <Button
              variant="outline"
              onClick={() => router.push("/variants")}
              className="transition-all duration-200 hover:shadow-md active:scale-95"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Variants
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
          "flex flex-col gap-6 p-6 transition-all duration-500 ease-out",
          contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        )}
      >
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link
            href="/"
            className="hover:text-foreground transition-colors duration-200 hover:underline underline-offset-4"
          >
            Dashboard
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link
            href="/variants"
            className="hover:text-foreground transition-colors duration-200 hover:underline underline-offset-4"
          >
            Variants
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium truncate max-w-[200px]">
            {group.group.base_name}
          </span>
        </nav>

        {/* Page Header */}
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => router.push("/variants")}
              className="shrink-0 h-10 w-10 rounded-xl border-border/50 transition-all duration-200 hover:bg-muted hover:border-border hover:-translate-y-0.5 hover:shadow-sm active:scale-95"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border shadow-lg bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border-primary/20">
                <Layers className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight truncate max-w-[400px]">
                  {group.group.base_name}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="font-mono text-xs">
                    {group.group.member_count} products
                  </Badge>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={loadGroup}
              disabled={loading}
              className="gap-2 transition-all duration-200 hover:bg-muted"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Group Info */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Basic Info Card */}
          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Hash className="h-4 w-4 text-muted-foreground" />
                Group Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Base Name
                </div>
                <div className="text-sm font-medium">{group.group.base_name}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Normalized
                </div>
                <div className="text-sm font-mono text-muted-foreground">
                  {group.group.base_name_normalized}
                </div>
              </div>
              <Separator className="bg-border/50" />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                Created {new Date(group.group.created_at).toLocaleDateString()}
              </div>
            </CardContent>
          </Card>

          {/* Variant Properties Card */}
          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Tags className="h-4 w-4 text-muted-foreground" />
                Variant Properties
              </CardTitle>
            </CardHeader>
            <CardContent>
              {group.variant_properties.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center">
                  No variant properties detected
                </div>
              ) : (
                <div className="space-y-3">
                  {group.variant_properties.map((prop) => (
                    <div
                      key={prop.id}
                      className="p-3 rounded-lg bg-muted/30 border border-border/30"
                    >
                      <div className="font-medium text-sm">{prop.property_name}</div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {prop.property_values.slice(0, 5).map((value, idx) => (
                          <Badge
                            key={idx}
                            variant="outline"
                            className="text-xs font-normal"
                          >
                            {value}
                          </Badge>
                        ))}
                        {prop.property_values.length > 5 && (
                          <Badge variant="secondary" className="text-xs">
                            +{prop.property_values.length - 5} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats Card */}
          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Grid3X3 className="h-4 w-4 text-muted-foreground" />
                Quick Stats
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 text-center">
                  <div className="text-2xl font-bold text-primary">
                    {group.members.length}
                  </div>
                  <div className="text-xs text-muted-foreground">Products</div>
                </div>
                <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/10 text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {group.variant_properties.length}
                  </div>
                  <div className="text-xs text-muted-foreground">Variant Props</div>
                </div>
                <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/10 text-center col-span-2">
                  <div className="text-2xl font-bold text-amber-600">
                    {group.matrix?.columns.filter((c) => c.is_variant).length ?? 0}
                  </div>
                  <div className="text-xs text-muted-foreground">Matrix Columns</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Member Products Grid */}
        <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
          <CardHeader className="pb-4 bg-gradient-to-r from-muted/30 to-muted/10 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background shadow-sm border border-border/50">
                <Package className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold">Member Products</CardTitle>
                <CardDescription>
                  {group.members.length} product{group.members.length !== 1 ? "s" : ""} in this group
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {group.members.length === 0 ? (
              <div className="text-center py-12">
                <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <Package className="h-7 w-7 text-muted-foreground/30" />
                </div>
                <p className="text-muted-foreground font-medium">No products in this group</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {group.members.map((member) => {
                  const product = member.product;
                  return (
                    <div
                      key={member.id}
                      className="group relative p-4 rounded-xl border border-border/50 bg-card hover:border-primary/30 hover:shadow-md transition-all duration-200 cursor-pointer"
                      onClick={() => router.push(`/products/${member.product_id}`)}
                    >
                      <div className="aspect-square relative mb-3 rounded-lg overflow-hidden bg-muted/30">
                        {product?.main_image_url ? (
                          <Image
                            src={product.main_image_url}
                            alt={product.name}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Package className="h-12 w-12 text-muted-foreground/20" />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">
                          {product?.name ?? "Unknown Product"}
                        </div>
                        {product?.code && (
                          <div className="text-xs text-muted-foreground font-mono mt-1">
                            {product.code}
                          </div>
                        )}
                        {product?.price_mdl && (
                          <div className="text-sm font-semibold text-primary mt-2">
                            {product.price_mdl.toLocaleString()} MDL
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`/products/${member.product_id}`, "_blank");
                        }}
                      >
                        <ExternalLink className="h-4 w-4" />
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
          <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
            <CardHeader className="pb-4 bg-gradient-to-r from-muted/30 to-muted/10 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background shadow-sm border border-border/50">
                  <Grid3X3 className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold">Variant Matrix</CardTitle>
                  <CardDescription>
                    Visual comparison of product variants across properties
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <VariantMatrixEditor matrix={group.matrix} />
            </CardContent>
          </Card>
        )}

        {/* Bottom Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-border/50">
          <Button
            variant="ghost"
            onClick={() => router.push("/variants")}
            className="transition-all duration-200 hover:bg-muted"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Variants
          </Button>
        </div>
      </div>
    </div>
  );
}
