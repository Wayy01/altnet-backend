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
  }, [groupId]); // Remove toast from dependencies to prevent infinite loop

  // Initial load
  useEffect(() => {
    loadGroup();
  }, [loadGroup]); // loadGroup already depends on groupId via useCallback

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
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 overflow-x-hidden">
      {/* Container with max-width */}
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
        <div
          className={cn(
            "flex flex-col gap-3 py-3 sm:py-4 transition-all duration-500 ease-out",
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
              {group.base_name}
            </span>
          </nav>

          {/* Page Header - Compact */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={() => router.push("/variants")}
                className="shrink-0 h-9 w-9 rounded-xl border-border/50 transition-all duration-200 hover:bg-muted hover:border-border hover:-translate-y-0.5 hover:shadow-sm active:scale-95"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border shadow-md bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border-primary/20 transition-all duration-300 hover:shadow-lg hover:scale-105">
                  <Layers className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate max-w-[300px] sm:max-w-[400px]">
                    {group.base_name}
                  </h1>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="secondary" className="font-mono text-xs px-2 py-0.5">
                      {group.member_count} products
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={loadGroup}
                disabled={loading}
                size="sm"
                className="gap-2 transition-all duration-200 hover:bg-muted hover:shadow-sm"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Group Info - Compact Grid */}
          <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {/* Basic Info Card */}
            <Card className="rounded-lg border-border/50 shadow-sm hover:shadow-md transition-all duration-300 hover:border-border">
              <CardHeader className="pb-2 px-3 pt-3">
                <CardTitle className="text-xs font-semibold flex items-center gap-2">
                  <div className="h-6 w-6 rounded-md bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                    <Hash className="h-3 w-3 text-primary" />
                  </div>
                  Group Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 px-3 pb-3">
                <div>
                  <div className="text-xs text-muted-foreground font-medium mb-1">
                    Base Name
                  </div>
                  <div className="text-sm font-medium truncate">{group.base_name}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground font-medium mb-1">
                    Normalized
                  </div>
                  <div className="text-xs font-mono text-muted-foreground/80 truncate">
                    {group.base_name_normalized}
                  </div>
                </div>
                <Separator className="bg-border/50" />
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Created {new Date(group.created_at).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>

            {/* Variant Properties Card */}
            <Card className="rounded-lg border-border/50 shadow-sm hover:shadow-md transition-all duration-300 hover:border-border">
              <CardHeader className="pb-2 px-3 pt-3">
                <CardTitle className="text-xs font-semibold flex items-center gap-2">
                  <div className="h-6 w-6 rounded-md bg-gradient-to-br from-blue-500/10 to-blue-500/5 flex items-center justify-center">
                    <Tags className="h-3 w-3 text-blue-600" />
                  </div>
                  Variant Properties
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                {!group.properties || group.properties.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-6 text-center">
                    No variant properties detected
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-[140px] overflow-y-auto scrollbar-thin">
                    {group.properties.map((prop) => (
                      <div
                        key={prop.id}
                        className="p-2 rounded-md bg-muted/40 border border-border/30 hover:bg-muted/60 transition-colors duration-200"
                      >
                        <div className="font-medium text-[11px] mb-1 truncate">{prop.property_name}</div>
                        <div className="flex flex-wrap gap-1">
                          {prop.property_values.slice(0, 3).map((value, idx) => (
                            <Badge
                              key={idx}
                              variant="outline"
                              className="text-[10px] font-normal px-1.5 py-0"
                            >
                              {value}
                            </Badge>
                          ))}
                          {prop.property_values.length > 3 && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              +{prop.property_values.length - 3}
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
            <Card className="rounded-lg border-border/50 shadow-sm hover:shadow-md transition-all duration-300 hover:border-border">
              <CardHeader className="pb-2 px-3 pt-3">
                <CardTitle className="text-xs font-semibold flex items-center gap-2">
                  <div className="h-6 w-6 rounded-md bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 flex items-center justify-center">
                    <Grid3X3 className="h-3 w-3 text-emerald-600" />
                  </div>
                  Quick Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-md bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/10 text-center group hover:shadow-sm transition-all duration-200">
                    <div className="text-lg font-bold text-primary group-hover:scale-110 transition-transform duration-200">
                      {group.members?.length ?? 0}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-medium mt-0.5">Products</div>
                  </div>
                  <div className="p-2 rounded-md bg-gradient-to-br from-blue-500/5 to-blue-500/10 border border-blue-500/10 text-center group hover:shadow-sm transition-all duration-200">
                    <div className="text-lg font-bold text-blue-600 group-hover:scale-110 transition-transform duration-200">
                      {group.properties?.length ?? 0}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-medium mt-0.5">Variant Props</div>
                  </div>
                  <div className="p-2 rounded-md bg-gradient-to-br from-amber-500/5 to-amber-500/10 border border-amber-500/10 text-center col-span-2 group hover:shadow-sm transition-all duration-200">
                    <div className="text-lg font-bold text-amber-600 group-hover:scale-110 transition-transform duration-200">
                      {group.matrix?.columns.filter((c) => c.is_variant).length ?? 0}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-medium mt-0.5">Matrix Columns</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Member Products Grid */}
          <Card className="rounded-lg border-border/50 shadow-sm overflow-hidden hover:shadow-md transition-all duration-300">
            <CardHeader className="pb-2 px-3 pt-3 bg-gradient-to-r from-muted/20 to-transparent border-b border-border/50">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20">
                  <Package className="h-3.5 w-3.5 text-purple-600" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold">Member Products</CardTitle>
                  <CardDescription className="text-[10px] mt-0.5">
                    {group.members?.length ?? 0} product{(group.members?.length ?? 0) !== 1 ? "s" : ""} in this group
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-2 sm:p-3">
              {!group.members || group.members.length === 0 ? (
                <div className="text-center py-12">
                  <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                    <Package className="h-6 w-6 text-muted-foreground/30" />
                  </div>
                  <p className="text-sm text-muted-foreground font-medium">No products in this group</p>
                </div>
              ) : (
                <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {group.members.map((member) => {
                    return (
                      <div
                        key={member.id}
                        className="group relative p-2 rounded-md border border-border/50 bg-card hover:border-primary/40 hover:shadow-md transition-all duration-300 cursor-pointer hover:-translate-y-0.5"
                        onClick={() => router.push(`/products/${member.id}`)}
                      >
                        <div className="aspect-square relative mb-1.5 rounded-md overflow-hidden bg-muted/30 ring-1 ring-border/50">
                          {member.main_image_url ? (
                            <Image
                              src={member.main_image_url}
                              alt={member.name || "Product"}
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
                          <div className="font-medium text-[11px] line-clamp-2 min-h-[2rem] group-hover:text-primary transition-colors duration-200">
                            {member.name ?? "Unknown Product"}
                          </div>
                          {member.article && (
                            <div className="text-[9px] text-muted-foreground font-mono mt-0.5 truncate">
                              {member.article}
                            </div>
                          )}
                          {member.price_min && (
                            <div className="text-[11px] font-semibold text-primary mt-1">
                              {member.price_min.toLocaleString()} MDL
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-all duration-200 bg-background/80 backdrop-blur-sm hover:bg-background/90 rounded-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`/products/${member.id}`, "_blank");
                          }}
                        >
                          <ExternalLink className="h-2.5 w-2.5" />
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
            <Card className="rounded-lg border-border/50 shadow-sm overflow-hidden hover:shadow-md transition-all duration-300">
              <CardHeader className="pb-2 px-3 pt-3 bg-gradient-to-r from-muted/20 to-transparent border-b border-border/50">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500/10 to-indigo-500/5 border border-indigo-500/20">
                    <Grid3X3 className="h-3.5 w-3.5 text-indigo-600" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold">Variant Matrix</CardTitle>
                    <CardDescription className="text-[10px] mt-0.5">
                      Visual comparison of product variants across properties
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <VariantMatrixEditor matrix={group.matrix} />
              </CardContent>
            </Card>
          )}

          {/* Bottom Navigation */}
          <div className="flex items-center justify-between pt-2 pb-4 border-t border-border/50">
            <Button
              variant="ghost"
              onClick={() => router.push("/variants")}
              size="sm"
              className="transition-all duration-200 hover:bg-muted hover:shadow-sm gap-2"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Variants
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
