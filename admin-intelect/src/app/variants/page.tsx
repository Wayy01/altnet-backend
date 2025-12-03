"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Layers,
  Play,
  Loader2,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  Search,
  Trash2,
  Eye,
  Package,
  Cpu,
  Zap,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/contexts/language-context";
import {
  VariantStats,
  VariantGenerationJob,
  ProductVariantGroup,
  VariantProgressUpdate,
} from "@/types/variants";
import { GenerationProgress } from "@/components/variants/generation-progress";

const PAGE_SIZE = 20;

export default function VariantsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useTranslation("variants");
  const { t: tCommon } = useTranslation("common");

  // State
  const [stats, setStats] = useState<VariantStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<ProductVariantGroup[]>([]);
  const [groupsTotal, setGroupsTotal] = useState(0);
  const [groupsPage, setGroupsPage] = useState(0);
  const [groupsSearch, setGroupsSearch] = useState("");
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [activeJob, setActiveJob] = useState<VariantGenerationJob | null>(null);
  const [startingJob, setStartingJob] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<ProductVariantGroup | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [contentVisible, setContentVisible] = useState(false);

  // Refs to prevent infinite loops
  const hasLoadedRef = useRef(false);
  const toastRef = useRef(toast);
  toastRef.current = toast;

  // Trigger staggered entrance animations
  useEffect(() => {
    const timer = setTimeout(() => setContentVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Load stats
  const loadStats = useCallback(async () => {
    try {
      const data = await api.getVariantStats();
      setStats(data);
      if (data.active_job) {
        setActiveJob(data.active_job);
      }
    } catch (error) {
      console.error("Failed to load variant stats:", error);
      toastRef.current({
        title: tCommon("status.failed"),
        description: t("errors.loadStats"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Load groups
  const loadGroups = useCallback(
    async (page: number = 0, search: string = "") => {
      setGroupsLoading(true);
      try {
        const { data, total } = await api.getVariantGroups({
          search: search || undefined,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        });
        setGroups(data);
        setGroupsTotal(total);
      } catch (error) {
        console.error("Failed to load variant groups:", error);
      } finally {
        setGroupsLoading(false);
      }
    },
    []
  );

  // Initial load - run only once
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    loadStats();
    loadGroups(0, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refs to access current values in SSE callback without triggering re-renders
  const groupsSearchRef = useRef(groupsSearch);
  groupsSearchRef.current = groupsSearch;

  // SSE for active job progress
  useEffect(() => {
    if (!activeJob || (activeJob.status !== "pending" && activeJob.status !== "running")) {
      return;
    }

    const unsubscribe = api.subscribeToVariantProgress(activeJob.id, (update: VariantProgressUpdate) => {
      setActiveJob((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          status: update.status,
          processed_products: update.processed,
          total_products: update.total,
          groups_created: update.groups_created,
        };
      });

      if (update.status === "completed" || update.status === "failed" || update.status === "cancelled") {
        loadStats();
        loadGroups(0, groupsSearchRef.current);

        toastRef.current({
          title: update.status === "completed" ? t("progress.generationComplete") : t("progress.generationStopped"),
          description:
            update.status === "completed"
              ? t("progress.generationCompleteDesc", { groups: update.groups_created, total: update.total })
              : t("progress.generation", { status: update.status }),
          variant: update.status === "completed" ? "success" : "destructive",
        });
      }
    });

    return () => {
      unsubscribe();
    };
    // Only re-subscribe when job id or status changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeJob?.id, activeJob?.status]);

  // Start generation
  const handleStartGeneration = async () => {
    setStartingJob(true);
    try {
      const job = await api.triggerVariantGeneration();
      setActiveJob(job);
      toast({
        title: t("progress.generationStarted"),
        description: t("progress.generationStartedDesc"),
      });
    } catch (error) {
      console.error("Failed to start generation:", error);
      toast({
        title: tCommon("status.failed"),
        description: error instanceof Error ? error.message : t("errors.startGeneration"),
        variant: "destructive",
      });
    } finally {
      setStartingJob(false);
    }
  };

  // Cancel job
  const handleCancelJob = async () => {
    if (!activeJob) return;
    try {
      await api.cancelVariantJob(activeJob.id);
      setActiveJob(null);
      loadStats();
      toast({
        title: t("progress.jobCancelled"),
        description: t("progress.jobCancelledDesc"),
      });
    } catch (error) {
      console.error("Failed to cancel job:", error);
      toast({
        title: tCommon("status.failed"),
        description: t("errors.cancelJob"),
        variant: "destructive",
      });
    }
  };

  // Delete group
  const handleDeleteGroup = async () => {
    if (!groupToDelete) return;
    setDeleting(true);
    try {
      await api.deleteVariantGroup(groupToDelete.id);
      setDeleteDialogOpen(false);
      setGroupToDelete(null);
      loadStats();
      loadGroups(groupsPage, groupsSearch);
      toast({
        title: t("delete.groupDeleted"),
        description: t("delete.groupDeletedDesc", { name: groupToDelete.base_name }),
      });
    } catch (error) {
      console.error("Failed to delete group:", error);
      toast({
        title: tCommon("status.failed"),
        description: t("errors.deleteGroup"),
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  // Search handler
  const handleSearch = (value: string) => {
    setGroupsSearch(value);
    setGroupsPage(0);
    loadGroups(0, value);
  };

  // Pagination
  const totalPages = Math.ceil(groupsTotal / PAGE_SIZE);
  const canPrevious = groupsPage > 0;
  const canNext = groupsPage < totalPages - 1;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{t("loading.variantData")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("page.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            {t("page.description")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              loadStats();
              loadGroups(groupsPage, groupsSearch);
            }}
            disabled={loading}
            size="sm"
            className="gap-2 transition-all duration-200 hover:bg-muted hover:shadow-sm hover:-translate-y-0.5"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            {t("actions.refresh")}
          </Button>
          <Button
            onClick={handleStartGeneration}
            disabled={startingJob || !!(activeJob && (activeJob.status === "pending" || activeJob.status === "running"))}
            size="sm"
            className="gap-2 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:scale-95"
          >
            {startingJob ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            {t("actions.generateVariants")}
          </Button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex flex-wrap items-center gap-3">
        {[
          {
            label: t("stats.totalGroups"),
            value: (stats?.total_groups ?? 0).toLocaleString(),
            icon: <Layers className="h-3.5 w-3.5" />,
            variant: "default" as const,
          },
          {
            label: t("stats.productsInGroups"),
            value: (stats?.total_products_in_groups ?? 0).toLocaleString(),
            suffix: t("stats.organized"),
            icon: <Package className="h-3.5 w-3.5" />,
            variant: (stats?.total_products_in_groups ?? 0) > 0 ? "success" as const : "muted" as const,
          },
          {
            label: t("stats.aiEngineStatus"),
            value: stats?.ollama_available ? t("stats.available") : t("stats.unavailable"),
            icon: <Cpu className="h-3.5 w-3.5" />,
            variant: stats?.ollama_available ? "success" as const : "warning" as const,
          },
        ].map((stat, index) => (
          <div
            key={stat.label}
            className={`
              inline-flex items-center gap-2 px-3 py-2 rounded-lg border
              transition-all duration-200 ease-out
              hover:shadow-sm hover:border-border/80 hover:-translate-y-0.5
              ${stat.variant === "success" ? "bg-primary/5 border-primary/20 hover:bg-primary/10" : ""}
              ${stat.variant === "warning" ? "bg-destructive/5 border-destructive/20 hover:bg-destructive/10" : ""}
              ${stat.variant === "default" || stat.variant === "muted" ? "bg-muted/50" : ""}
            `}
            style={{
              animationDelay: `${index * 50}ms`,
            }}
          >
            {stat.icon && (
              <span className={`
                ${stat.variant === "success" ? "text-primary" : ""}
                ${stat.variant === "warning" ? "text-destructive" : ""}
                ${stat.variant === "default" || stat.variant === "muted" ? "text-muted-foreground" : ""}
              `}>
                {stat.icon}
              </span>
            )}
            <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
            <span className="text-sm font-semibold tabular-nums">{stat.value}</span>
            {stat.suffix && (
              <span className="text-[10px] text-muted-foreground">({stat.suffix})</span>
            )}
          </div>
        ))}
      </div>

      {/* Active Job Progress */}
      {activeJob && (activeJob.status === "pending" || activeJob.status === "running") && (
        <GenerationProgress job={activeJob} onCancel={handleCancelJob} />
      )}

      {/* Filters Section */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-muted">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-sm">{t("filters.searchGroups")}</h3>
          </div>
        </div>
        <div className="p-5 space-y-4">
          {/* Full-width search bar */}
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("filters.searchGroups")}
              value={groupsSearch}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-9 pr-8 transition-all duration-200 focus:ring-2 focus:ring-primary/20 hover:border-primary/30"
            />
            {groupsSearch && (
              <button
                onClick={() => handleSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted transition-all duration-200"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Variant Groups Table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-muted">
              <Layers className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">{t("cards.variantGroups")}</h3>
              <p className="text-xs text-muted-foreground">
                {groupsTotal === 1
                  ? t("cards.groupsFound", { count: groupsTotal })
                  : t("cards.groupsFoundPlural", { count: groupsTotal })
                }
              </p>
            </div>
          </div>
        </div>
        <div className="overflow-hidden">
          {groupsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-12">
              <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <Layers className="h-6 w-6 text-muted-foreground/30" />
              </div>
              <p className="text-sm font-semibold text-muted-foreground">{t("empty.noGroups")}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {groupsSearch ? t("empty.tryDifferentSearch") : t("empty.generateToStart")}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="text-xs font-semibold h-10">{t("table.baseName")}</TableHead>
                  <TableHead className="text-center text-xs font-semibold h-10">{t("table.members")}</TableHead>
                  <TableHead className="text-xs font-semibold h-10">{t("table.created")}</TableHead>
                  <TableHead className="text-right text-xs font-semibold h-10">{t("table.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((group, index) => (
                  <TableRow
                    key={group.id}
                    className="hover:bg-muted/30 cursor-pointer transition-colors duration-200"
                    onClick={() => router.push(`/variants/groups/${group.id}`)}
                    style={{
                      animationDelay: `${Math.min(index * 20, 400)}ms`,
                      opacity: 0,
                      animation: "fadeIn 0.3s ease-out forwards"
                    }}
                  >
                    <TableCell className="py-3">
                      <div>
                        <div className="font-medium text-sm truncate max-w-[300px]">
                          {group.base_name}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono truncate max-w-[300px]">
                          {group.base_name_normalized}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center py-3">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {group.member_count}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="text-sm">
                        {new Date(group.created_at).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(group.created_at).toLocaleTimeString()}
                      </div>
                    </TableCell>
                    <TableCell className="text-right py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors duration-200"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/variants/groups/${group.id}`);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors duration-200"
                          onClick={(e) => {
                            e.stopPropagation();
                            setGroupToDelete(group);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="rounded-xl border bg-card/50 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              {t("pagination.page", { current: groupsPage + 1, total: totalPages })}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setGroupsPage((p) => p - 1);
                  loadGroups(groupsPage - 1, groupsSearch);
                }}
                disabled={!canPrevious}
                className="h-8 transition-all duration-200 hover:bg-muted hover:shadow-sm"
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                {tCommon("actions.previous")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setGroupsPage((p) => p + 1);
                  loadGroups(groupsPage + 1, groupsSearch);
                }}
                disabled={!canNext}
                className="h-8 transition-all duration-200 hover:bg-muted hover:shadow-sm"
              >
                {tCommon("actions.next")}
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold">{t("delete.title")}</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              {t("delete.description", { name: groupToDelete?.base_name || "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg h-9" disabled={deleting}>
              {tCommon("actions.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteGroup}
              className="rounded-lg h-9 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("delete.deleting")}
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t("delete.deleteGroup")}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
