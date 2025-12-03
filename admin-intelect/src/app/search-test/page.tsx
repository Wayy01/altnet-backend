"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, RefreshCw, Package, Clock, TrendingUp, Database, AlertCircle, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { SearchComparisonResponse, SearchIndexStatus } from "@/types/search";
import { AutocompleteInput } from "@/components/search/autocomplete-input";
import { ValidatedImg } from "@/components/ui/validated-product-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocalizedValue, useTranslation } from "@/contexts/language-context";

/**
 * Search Test Page
 *
 * Comprehensive testing interface for evaluating smart search quality:
 * - Side-by-side comparison: Old PostgreSQL search vs Smart Meilisearch
 * - Response time metrics
 * - Result count comparison
 * - Product type badges (main vs accessory)
 * - Autocomplete preview
 * - Index health monitoring
 * - Manual reindex trigger
 * - Pre-configured test cases
 */
export default function SearchTestPage() {
  const router = useRouter();
  const { t } = useTranslation("search");
  const [query, setQuery] = useState("");
  const [comparison, setComparison] = useState<SearchComparisonResponse | null>(null);
  const [indexStatus, setIndexStatus] = useState<SearchIndexStatus | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isReindexing, setIsReindexing] = useState(false);
  const { localize } = useLocalizedValue();

  // Pre-configured test queries using translations
  const TEST_QUERIES = useMemo(() => [
    {
      query: t("testQueries.iphone.query"),
      description: t("testQueries.iphone.description"),
    },
    {
      query: t("testQueries.typo.query"),
      description: t("testQueries.typo.description"),
    },
    {
      query: t("testQueries.property.query"),
      description: t("testQueries.property.description"),
    },
    {
      query: t("testQueries.samsung.query"),
      description: t("testQueries.samsung.description"),
    },
  ], [t]);

  // Navigate to product detail page
  const navigateToProduct = useCallback((productId: string) => {
    router.push(`/products/${productId}`);
  }, [router]);

  const loadIndexStatus = useCallback(async () => {
    setIsLoadingStatus(true);
    try {
      const status = await api.getSearchStatus();
      setIndexStatus(status);
    } catch (error) {
      console.error("Failed to load index status:", error);
      toast.error(t("toast.statusFailed"));
    } finally {
      setIsLoadingStatus(false);
    }
  }, [t]);

  // Fetch index status on mount
  useEffect(() => {
    loadIndexStatus();
  }, [loadIndexStatus]);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) {
      toast.error(t("comparison.placeholder"));
      return;
    }

    setIsSearching(true);
    try {
      const result = await api.compareSearch(query);
      setComparison(result);
      toast.success(t("toast.searchCompleted", { time: result.newSearch.processingTimeMs }));
    } catch (error) {
      console.error("Search failed:", error);
      toast.error(t("toast.searchFailed"));
      setComparison(null);
    } finally {
      setIsSearching(false);
    }
  }, [query, t]);

  const handleTestQuery = useCallback((testQuery: string) => {
    setQuery(testQuery);
    setComparison(null);
  }, []);

  const handleReindex = useCallback(async () => {
    setIsReindexing(true);
    try {
      await api.reindexSearch();
      toast.success(t("toast.reindexStarted"));
      // Reload status after 2 seconds
      setTimeout(() => loadIndexStatus(), 2000);
    } catch (error) {
      console.error("Reindex failed:", error);
      toast.error(t("toast.reindexFailed"));
    } finally {
      setIsReindexing(false);
    }
  }, [loadIndexStatus, t]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("page.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            {t("page.subtitle")}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadIndexStatus}
          disabled={isLoadingStatus}
          className="transition-all duration-200 hover:shadow-sm"
        >
          <RefreshCw className={`h-4 w-4 mr-1.5 ${isLoadingStatus ? "animate-spin" : ""}`} />
          {t("actions.refreshStatus")}
        </Button>
      </div>

      {/* Index Status Card */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">{t("index.title")}</CardTitle>
            </div>
            {indexStatus && (
              <Badge
                variant={indexStatus.isHealthy ? "default" : "destructive"}
                className="gap-1"
              >
                {indexStatus.isHealthy ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <XCircle className="h-3 w-3" />
                )}
                {indexStatus.isHealthy ? t("index.healthy") : t("index.issuesDetected")}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingStatus ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : indexStatus ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">{t("index.documents")}</p>
                <p className="text-lg font-semibold tabular-nums">
                  {indexStatus.documentCount.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("index.pendingUpdates")}</p>
                <p className="text-lg font-semibold tabular-nums">
                  {indexStatus.pendingUpdates}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("index.status")}</p>
                <p className="text-lg font-semibold">
                  {indexStatus.isIndexing ? (
                    <span className="text-primary">{t("index.indexing")}</span>
                  ) : (
                    <span className="text-muted-foreground">{t("index.idle")}</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("index.lastIndexed")}</p>
                <p className="text-sm font-medium">
                  {indexStatus.lastIndexedAt
                    ? new Date(indexStatus.lastIndexedAt).toLocaleString()
                    : t("index.never")}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              <span>{t("index.failedToLoad")}</span>
            </div>
          )}

          <div className="mt-4 pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReindex}
              disabled={isReindexing || (indexStatus?.isIndexing ?? false)}
              className="w-full sm:w-auto"
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${isReindexing ? "animate-spin" : ""}`} />
              {isReindexing ? t("actions.reindexing") : t("actions.triggerReindex")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Autocomplete Preview - Premium Edition */}
      <Card className="border shadow-sm relative overflow-visible group">
        {/* Subtle gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        <CardHeader className="pb-4 relative">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center shadow-sm">
                  <Search className="h-4 w-4 text-primary" />
                </div>
                <CardTitle className="text-base">{t("autocomplete.title")}</CardTitle>
              </div>
              <CardDescription className="text-sm">
                {t("autocomplete.subtitle")}
              </CardDescription>

              {/* Feature badges */}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <Badge variant="outline" className="text-xs font-normal gap-1.5 shadow-sm">
                  <Clock className="h-3 w-3" />
                  {t("autocomplete.debounce")}
                </Badge>
                <Badge variant="outline" className="text-xs font-normal gap-1.5 shadow-sm">
                  <TrendingUp className="h-3 w-3" />
                  {t("autocomplete.smartRanking")}
                </Badge>
                <Badge variant="outline" className="text-xs font-normal gap-1.5 shadow-sm">
                  <Package className="h-3 w-3" />
                  {t("autocomplete.stockAware")}
                </Badge>
              </div>
            </div>

            {/* Response time badge - will update dynamically */}
            <div
              id="response-time-badge"
              className="hidden animate-in fade-in-0 slide-in-from-top-2 duration-300"
            >
              <Badge
                variant="default"
                className="gap-1.5 shadow-md px-3 py-1"
              >
                <div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs font-semibold tabular-nums" id="response-time-value">
                  --ms
                </span>
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="relative overflow-visible pb-8">
          <AutocompleteInput
            placeholder={t("autocomplete.placeholder")}
            onSelect={(suggestion) => {
              navigateToProduct(suggestion.id);
            }}
            onResponseTime={(ms) => {
              // Update response time badge
              const badge = document.getElementById('response-time-badge');
              const value = document.getElementById('response-time-value');
              if (badge && value) {
                badge.classList.remove('hidden');
                value.textContent = `${ms}ms`;

                // Auto-hide after 3 seconds
                setTimeout(() => {
                  badge.classList.add('animate-out', 'fade-out-0', 'slide-out-to-top-2');
                  setTimeout(() => {
                    badge.classList.add('hidden');
                    badge.classList.remove('animate-out', 'fade-out-0', 'slide-out-to-top-2');
                  }, 300);
                }, 3000);
              }
            }}
            className="max-w-2xl"
          />

          {/* Keyboard shortcut hint */}
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <kbd className="px-2 py-1 rounded bg-muted border shadow-sm font-mono font-medium">
              ↑
            </kbd>
            <kbd className="px-2 py-1 rounded bg-muted border shadow-sm font-mono font-medium">
              ↓
            </kbd>
            <span>{t("autocomplete.keyboard.navigate")}</span>
            <span className="mx-1 opacity-50">•</span>
            <kbd className="px-2 py-1 rounded bg-muted border shadow-sm font-mono font-medium">
              Enter
            </kbd>
            <span>{t("autocomplete.keyboard.select")}</span>
            <span className="mx-1 opacity-50">•</span>
            <kbd className="px-2 py-1 rounded bg-muted border shadow-sm font-mono font-medium">
              Esc
            </kbd>
            <span>{t("autocomplete.keyboard.close")}</span>
          </div>
        </CardContent>
      </Card>

      {/* Search Input & Test Cases */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("comparison.title")}</CardTitle>
          <CardDescription>
            {t("comparison.subtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Input */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder={t("comparison.placeholder")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-9"
              />
            </div>
            <Button onClick={handleSearch} disabled={isSearching || !query.trim()}>
              {isSearching ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
                  {t("actions.searching")}
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-1.5" />
                  {t("actions.compare")}
                </>
              )}
            </Button>
          </div>

          {/* Pre-configured Test Cases */}
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("comparison.testCases")}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {TEST_QUERIES.map((test) => (
                <button
                  key={test.query}
                  onClick={() => handleTestQuery(test.query)}
                  className="text-left p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-all duration-200 hover:shadow-sm group"
                >
                  <p className="text-sm font-medium group-hover:text-primary transition-colors">
                    "{test.query}"
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {test.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search Results Comparison */}
      {comparison && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Old Search Results */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{t("comparison.oldSearch")}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="gap-1">
                    <Clock className="h-3 w-3" />
                    {comparison.oldSearch.timeMs}ms
                  </Badge>
                  <Badge variant="secondary">
                    {comparison.oldSearch.count} {t("comparison.results")}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-3">
                {comparison.oldSearch.results.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Package className="h-10 w-10 mb-2 opacity-50" />
                    <p className="text-sm">{t("comparison.noResults")}</p>
                  </div>
                ) : (
                  comparison.oldSearch.results.slice(0, 10).map((product: any) => (
                    <div
                      key={product.id}
                      onClick={() => navigateToProduct(product.id)}
                      className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors cursor-pointer group"
                    >
                      <ValidatedImg
                        src={product.main_image_url}
                        fallbackSrc={product.images?.[0]?.url || product.images?.[0]?.path_global}
                        alt={product.name}
                        className="h-12 w-12 rounded object-cover border bg-muted shrink-0"
                        containerClassName="h-12 w-12 rounded border shrink-0"
                        iconSize="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
                          {localize(product, "name")}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          {product.brand_name && <span>{product.brand_name}</span>}
                          {product.price_mdl && (
                            <>
                              <span>•</span>
                              <span className="font-semibold tabular-nums">
                                {product.price_mdl.toFixed(2)} MDL
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Smart Search Results */}
          <Card className="border shadow-sm border-primary/20 bg-primary/5">
            <CardHeader className="pb-3 bg-primary/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">{t("comparison.smartSearch")}</CardTitle>
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="gap-1 bg-background">
                    <Clock className="h-3 w-3" />
                    {comparison.newSearch.processingTimeMs}ms
                  </Badge>
                  <Badge className="bg-primary">
                    {comparison.newSearch.estimatedTotalHits} {t("comparison.results")}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-3">
                {comparison.newSearch.hits.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Package className="h-10 w-10 mb-2 opacity-50" />
                    <p className="text-sm">{t("comparison.noResults")}</p>
                  </div>
                ) : (
                  comparison.newSearch.hits.map((hit) => (
                    <div
                      key={hit.id}
                      onClick={() => navigateToProduct(hit.id)}
                      className="flex items-start gap-3 p-3 rounded-lg border bg-background hover:bg-muted/30 transition-colors cursor-pointer group"
                    >
                      <ValidatedImg
                        src={hit.main_image_url}
                        fallbackSrc={hit.images?.[0]?.url || hit.images?.[0]?.path_global}
                        alt={hit.name}
                        className="h-12 w-12 rounded object-cover border bg-muted shrink-0"
                        containerClassName="h-12 w-12 rounded border shrink-0"
                        iconSize="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2">
                          <p className="text-sm font-medium line-clamp-2 flex-1 group-hover:text-primary transition-colors">
                            {hit.name}
                          </p>
                          <Badge
                            variant={hit.product_type === "main" ? "default" : "secondary"}
                            className="text-[10px] px-1.5 py-0 shrink-0"
                          >
                            {hit.product_type === "main" ? t("product.main") : t("product.accessory")}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          {hit.brand_name && <span>{hit.brand_name}</span>}
                          {hit.category_name && (
                            <>
                              <span>•</span>
                              <span>{hit.category_name}</span>
                            </>
                          )}
                          {hit.price_mdl && (
                            <>
                              <span>•</span>
                              <span className="font-semibold tabular-nums">
                                {hit.price_mdl.toFixed(2)} MDL
                              </span>
                            </>
                          )}
                        </div>
                        {hit.is_in_stock && (
                          <Badge variant="outline" className="mt-1 text-[10px] px-1.5 py-0">
                            {t("product.inStock", { count: hit.total_stock })}
                          </Badge>
                        )}
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 self-center" />
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
