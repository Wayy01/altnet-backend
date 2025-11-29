"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  Link2,
  Unlink,
  Package,
  ExternalLink,
  GitBranch,
  Loader2,
  Info,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useDebouncedCallback } from "use-debounce";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
 * Premium Variants Tab with enhanced parent product search and linking
 * Features elegant search UI, product cards, and informational callouts
 */
export function VariantsTab({ data, onChange, sourceProduct }: VariantsTabProps) {
  const { t } = useTranslation("products");
  // Check if this is an auto-linked variant (came from ?duplicate= query param)
  const isAutoLinked = !!sourceProduct && !!data.parent_id;
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedParent, setSelectedParent] = useState<Product | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [sectionsVisible, setSectionsVisible] = useState(false);
  const mountedRef = useRef(true);

  // Trigger entrance animation and setup cleanup
  useEffect(() => {
    const timer = setTimeout(() => setSectionsVisible(true), 50);
    return () => {
      clearTimeout(timer);
      mountedRef.current = false;
    };
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

    return () => {
      cancelled = true;
    };
  }, [data.parent_id]);

  // Debounced search
  const debouncedSearch = useDebouncedCallback(async (query: string) => {
    if (!query.trim()) {
      if (mountedRef.current) {
        setSearchResults([]);
        setHasSearched(false);
      }
      return;
    }

    if (mountedRef.current) {
      setIsSearching(true);
    }
    try {
      const results = await api.searchProductsForVariants(query, []);
      if (mountedRef.current) {
        setSearchResults(results);
        setHasSearched(true);
      }
    } catch (error) {
      if (mountedRef.current) {
        console.error("Failed to search products:", error);
      }
    } finally {
      if (mountedRef.current) {
        setIsSearching(false);
      }
    }
  }, 300);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    debouncedSearch(value);
  };

  const selectParent = (product: Product) => {
    setSelectedParent(product);
    onChange({ parent_id: product.id, is_group: false });
    setSearchQuery("");
    setSearchResults([]);
    setHasSearched(false);
  };

  const clearParent = () => {
    setSelectedParent(null);
    onChange({ parent_id: null });
  };

  /**
   * Section wrapper with staggered animation
   */
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
        sectionsVisible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-4",
        className
      )}
      style={{
        transitionDelay: sectionsVisible ? `${index * 100}ms` : "0ms",
      }}
    >
      {children}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <Section index={0}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
            <GitBranch className="h-5 w-5 text-primary" />
          </div>
          <div>
            <Label className="text-base font-semibold">{t("variants.title")}</Label>
            <p className="text-sm text-muted-foreground">
              {t("variants.description")}
            </p>
          </div>
        </div>
      </Section>

      {/* Auto-Linked Banner - Shows when creating variant from existing product */}
      {isAutoLinked && sourceProduct && (
        <Section index={1}>
          <div className="rounded-xl border-2 border-blue-500/30 bg-blue-500/5 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20">
                <Link2 className="h-5 w-5 text-blue-500" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-blue-600 dark:text-blue-400">
                    {t("variants.autoLinked")}
                  </h4>
                  <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/20">
                    {t("variants.automatic")}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {t("variants.autoLinkedDesc")}
                </p>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-background border border-border/50">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted border border-border/50 overflow-hidden">
                    {sourceProduct.main_image_url ? (
                      <img
                        src={sourceProduct.main_image_url}
                        alt={sourceProduct.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Package className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{sourceProduct.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {sourceProduct.code && (
                        <span className="font-mono">{sourceProduct.code}</span>
                      )}
                      {sourceProduct.brand_name && (
                        <>
                          <span className="text-border">|</span>
                          <span>{sourceProduct.brand_name}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Link
                    href={`/products/${sourceProduct.id}`}
                    target="_blank"
                    className={cn(
                      "flex items-center justify-center h-9 w-9 rounded-lg",
                      "border border-border/50 bg-muted",
                      "transition-all duration-200 hover:bg-muted/80 hover:border-border"
                    )}
                  >
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* Is Group Toggle */}
      <Section index={isAutoLinked ? 2 : 1}>
        <div className="rounded-xl border border-border/50 bg-card p-4 transition-all duration-200 hover:border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg border transition-colors duration-200",
                  data.is_group
                    ? "bg-primary/10 border-primary/30"
                    : "bg-muted border-border/50"
                )}
              >
                <GitBranch
                  className={cn(
                    "h-5 w-5 transition-colors duration-200",
                    data.is_group ? "text-primary" : "text-muted-foreground"
                  )}
                />
              </div>
              <div className="space-y-0.5">
                <Label htmlFor="is_group" className="text-sm font-medium cursor-pointer">
                  {t("variants.isParentGroup")}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t("variants.isParentGroupDesc")}
                </p>
              </div>
            </div>
            <Switch
              id="is_group"
              checked={data.is_group}
              onCheckedChange={(checked) => {
                onChange({ is_group: checked });
                // If marking as group, clear parent_id
                if (checked && data.parent_id) {
                  onChange({ parent_id: null });
                  setSelectedParent(null);
                }
              }}
              disabled={!!data.parent_id}
              className="data-[state=checked]:bg-primary"
            />
          </div>
          {data.is_group && (
            <div className="mt-4 rounded-lg bg-primary/5 border border-primary/20 p-3 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-primary">
                {t("variants.parentGroupEnabled")}
              </p>
            </div>
          )}
        </div>
      </Section>

      {/* Link to Parent Section */}
      {!data.is_group && !isAutoLinked && (
        <Section index={isAutoLinked ? 3 : 2}>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted border border-border/50">
                <Link2 className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <Label className="text-sm font-semibold">
                  {t("variants.linkToParent")}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t("variants.linkToParentDesc")}
                </p>
              </div>
            </div>

            {/* Selected Parent */}
            {selectedParent ? (
              <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 transition-all duration-200">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-background border border-border overflow-hidden">
                      {selectedParent.main_image_url ? (
                        <img
                          src={selectedParent.main_image_url}
                          alt={selectedParent.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Package className="h-7 w-7 text-muted-foreground" />
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Link2 className="h-4 w-4 text-primary" />
                        <span className="font-semibold">{selectedParent.name}</span>
                      </div>
                      {selectedParent.code && (
                        <Badge variant="outline" className="font-mono text-xs bg-background">
                          {selectedParent.code}
                        </Badge>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {selectedParent.brand_name || "No brand"} •{" "}
                        {selectedParent.category_name || "No category"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/products/${selectedParent.id}`}
                      target="_blank"
                      className={cn(
                        "flex items-center justify-center h-9 w-9 rounded-lg",
                        "border border-border/50 bg-background",
                        "transition-all duration-200 hover:bg-muted hover:border-border"
                      )}
                    >
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </Link>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={cn(
                        "rounded-lg transition-all duration-200",
                        "text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                      )}
                      onClick={clearParent}
                    >
                      <Unlink className="mr-2 h-4 w-4" />
                      {t("variants.unlink")}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Search Input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder={t("variants.searchProducts")}
                    className={cn(
                      "h-11 pl-10 rounded-lg transition-all duration-200",
                      "focus:ring-2 focus:ring-primary/20 focus:border-primary",
                      "hover:border-primary/50"
                    )}
                  />
                  {isSearching && (
                    <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                  )}
                </div>

                {/* Search Results */}
                {isSearching && !searchResults.length && (
                  <div className="rounded-xl border border-border/50 bg-card p-6 text-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">{t("variants.searchingProducts")}</p>
                  </div>
                )}

                {!isSearching && hasSearched && searchResults.length === 0 && (
                  <div className="rounded-xl border border-border/50 bg-card p-6 text-center">
                    <XCircle className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {t("variants.noProductsFound", { query: searchQuery })}
                    </p>
                  </div>
                )}

                {!isSearching && searchResults.length > 0 && (
                  <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
                    <div className="max-h-[300px] overflow-y-auto">
                      {searchResults.map((product, index) => (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => selectParent(product)}
                          className={cn(
                            "flex w-full items-center gap-3 p-3 text-left",
                            "transition-all duration-200 hover:bg-primary/5",
                            "border-b border-border/50 last:border-b-0",
                            "animate-in fade-in-0 slide-in-from-bottom-2"
                          )}
                          style={{ animationDelay: `${index * 30}ms` }}
                        >
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted border border-border/50 overflow-hidden">
                            {product.main_image_url ? (
                              <img
                                src={product.main_image_url}
                                alt={product.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Package className="h-6 w-6 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{product.name}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {product.code && (
                                <span className="font-mono">{product.code}</span>
                              )}
                              {product.brand_name && (
                                <>
                                  <span className="text-border">|</span>
                                  <span>{product.brand_name}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <Badge
                            variant={product.is_active ? "default" : "secondary"}
                            className={cn(
                              "shrink-0 transition-colors",
                              product.is_active
                                ? "bg-green-500/10 text-green-600 border-green-500/20"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {product.is_active ? t("variants.activeStatus") : t("variants.inactiveStatus")}
                          </Badge>
                        </button>
                      ))}
                    </div>
                    {searchResults.length > 5 && (
                      <div className="border-t border-border/50 px-3 py-2 bg-muted/30 text-xs text-muted-foreground text-center">
                        {t("variants.showingResults", { count: searchResults.length })}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </Section>
      )}

      {/* Info Box */}
      <Section index={isAutoLinked ? 3 : (data.is_group ? 2 : 3)}>
        <div className="rounded-xl border border-border/50 bg-muted/30 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
              <Info className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h4 className="font-medium mb-2">{t("variants.aboutVariants")}</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <GitBranch className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                  <span>
                    <strong className="text-foreground">{t("variants.parentProductsDesc")}</strong>: {t("variants.parentProductsInfo")}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Link2 className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                  <span>
                    <strong className="text-foreground">{t("variants.variantProductsDesc")}</strong>: {t("variants.variantProductsInfo")}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Package className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                  <span>
                    {t("variants.inheritPropertiesInfo")}
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

      {/* Summary */}
      <Section index={isAutoLinked ? 4 : (data.is_group ? 3 : 4)}>
        <div className="rounded-xl border border-border/50 bg-muted/30 p-4">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-2">
                <GitBranch
                  className={cn(
                    "h-5 w-5",
                    data.is_group ? "text-primary" : "text-muted-foreground"
                  )}
                />
                <p className="text-lg font-bold">{data.is_group ? t("variants.yes") : t("variants.no")}</p>
              </div>
              <p className="text-xs text-muted-foreground">{t("variants.isParentGroup2")}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-2">
                <Link2
                  className={cn(
                    "h-5 w-5",
                    data.parent_id ? "text-primary" : "text-muted-foreground"
                  )}
                />
                <p className="text-lg font-bold">{data.parent_id ? t("variants.yes") : t("variants.no")}</p>
              </div>
              <p className="text-xs text-muted-foreground">{t("variants.linkedToParent")}</p>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
