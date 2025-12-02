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
  ChevronRight,
  Search,
  Trash2,
  Eye,
  Package,
  Cpu,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Zap,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  const { t } = useTranslation("navigation");

  // State
  const [stats, setStats] = useState<VariantStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<ProductVariantGroup[]>([]);
  const [groupsTotal, setGroupsTotal] = useState(0);
  const [groupsPage, setGroupsPage] = useState(0);
  const [groupsSearch, setGroupsSearch] = useState("");
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [jobs, setJobs] = useState<VariantGenerationJob[]>([]);
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
        title: "Error",
        description: "Failed to load variant statistics",
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

  // Load recent jobs
  const loadJobs = useCallback(async () => {
    try {
      const { data } = await api.getVariantJobs(10, 0);
      setJobs(data);
    } catch (error) {
      console.error("Failed to load variant jobs:", error);
    }
  }, []);

  // Initial load - run only once
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    loadStats();
    loadGroups(0, "");
    loadJobs();
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
        loadJobs();

        toastRef.current({
          title: update.status === "completed" ? "Generation Complete" : "Generation Stopped",
          description:
            update.status === "completed"
              ? `Created ${update.groups_created} variant groups from ${update.total} products`
              : `Generation ${update.status}`,
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
        title: "Generation Started",
        description: "Variant generation job has been started",
      });
    } catch (error) {
      console.error("Failed to start generation:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start generation",
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
      loadJobs();
      toast({
        title: "Job Cancelled",
        description: "Variant generation job has been cancelled",
      });
    } catch (error) {
      console.error("Failed to cancel job:", error);
      toast({
        title: "Error",
        description: "Failed to cancel job",
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
        title: "Group Deleted",
        description: `Variant group "${groupToDelete.base_name}" has been deleted`,
      });
    } catch (error) {
      console.error("Failed to delete group:", error);
      toast({
        title: "Error",
        description: "Failed to delete variant group",
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

  // Get status badge config
  const getStatusConfig = (status: string) => {
    switch (status) {
      case "completed":
        return { icon: CheckCircle2, color: "bg-emerald-500", label: "Completed" };
      case "running":
        return { icon: Loader2, color: "bg-blue-500", label: "Running", animate: true };
      case "pending":
        return { icon: Clock, color: "bg-amber-500", label: "Pending" };
      case "failed":
        return { icon: XCircle, color: "bg-red-500", label: "Failed" };
      case "cancelled":
        return { icon: AlertCircle, color: "bg-orange-500", label: "Cancelled" };
      default:
        return { icon: Clock, color: "bg-gray-500", label: status };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading variant data...</p>
        </div>
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
          <span className="text-foreground font-medium">Variants</span>
        </nav>

        {/* Page Header */}
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => router.back()}
              className="shrink-0 h-10 w-10 rounded-xl border-border/50 transition-all duration-200 hover:bg-muted hover:border-border hover:-translate-y-0.5 hover:shadow-sm active:scale-95"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border shadow-lg bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border-primary/20">
                <Layers className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Variant Management</h1>
                <p className="text-sm text-muted-foreground">
                  Generate and manage product variant groups
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => {
                loadStats();
                loadGroups(groupsPage, groupsSearch);
                loadJobs();
              }}
              disabled={loading}
              className="gap-2 transition-all duration-200 hover:bg-muted"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Refresh
            </Button>
            <Button
              onClick={handleStartGeneration}
              disabled={startingJob || !!(activeJob && (activeJob.status === "pending" || activeJob.status === "running"))}
              className="gap-2 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:scale-95"
            >
              {startingJob ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              Generate Variants
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Total Groups */}
          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Groups
              </CardTitle>
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Layers className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.total_groups.toLocaleString() ?? 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Variant groups created</p>
            </CardContent>
          </Card>

          {/* Products in Groups */}
          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Products in Groups
              </CardTitle>
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Package className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.total_products_in_groups.toLocaleString() ?? 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Products organized</p>
            </CardContent>
          </Card>

          {/* Ollama Status */}
          <Card className="rounded-2xl border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                AI Engine Status
              </CardTitle>
              <div
                className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center",
                  stats?.ollama_available ? "bg-emerald-500/10" : "bg-red-500/10"
                )}
              >
                <Cpu
                  className={cn(
                    "h-4 w-4",
                    stats?.ollama_available ? "text-emerald-500" : "text-red-500"
                  )}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Badge
                  variant={stats?.ollama_available ? "default" : "destructive"}
                  className={cn(
                    stats?.ollama_available ? "bg-emerald-500" : ""
                  )}
                >
                  {stats?.ollama_available ? "Available" : "Unavailable"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Ollama AI for grouping</p>
            </CardContent>
          </Card>
        </div>

        {/* Active Job Progress */}
        {activeJob && (activeJob.status === "pending" || activeJob.status === "running") && (
          <GenerationProgress job={activeJob} onCancel={handleCancelJob} />
        )}

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Variant Groups Table */}
          <div className="lg:col-span-2">
            <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
              <CardHeader className="pb-4 bg-gradient-to-r from-muted/30 to-muted/10 border-b border-border/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background shadow-sm border border-border/50">
                      <Layers className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-semibold">Variant Groups</CardTitle>
                      <CardDescription>
                        {groupsTotal} group{groupsTotal !== 1 ? "s" : ""} found
                      </CardDescription>
                    </div>
                  </div>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search groups..."
                      value={groupsSearch}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="pl-9 h-9 rounded-lg"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {groupsLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : groups.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                      <Layers className="h-7 w-7 text-muted-foreground/30" />
                    </div>
                    <p className="text-muted-foreground font-medium">No variant groups found</p>
                    <p className="text-sm text-muted-foreground/70 mt-1">
                      {groupsSearch ? "Try a different search" : "Generate variants to get started"}
                    </p>
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border/50">
                          <TableHead>Base Name</TableHead>
                          <TableHead className="text-center">Members</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groups.map((group) => (
                          <TableRow
                            key={group.id}
                            className="border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
                            onClick={() => router.push(`/variants/groups/${group.id}`)}
                          >
                            <TableCell>
                              <div>
                                <div className="font-medium truncate max-w-[300px]">
                                  {group.base_name}
                                </div>
                                <div className="text-xs text-muted-foreground font-mono truncate max-w-[300px]">
                                  {group.base_name_normalized}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary" className="font-mono">
                                {group.member_count}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {new Date(group.created_at).toLocaleDateString()}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(group.created_at).toLocaleTimeString()}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
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
                                  className="h-8 w-8 text-destructive hover:text-destructive"
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

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between p-4 border-t border-border/50">
                        <div className="text-sm text-muted-foreground">
                          Page {groupsPage + 1} of {totalPages}
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
                          >
                            <ArrowLeft className="h-4 w-4 mr-1" />
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setGroupsPage((p) => p + 1);
                              loadGroups(groupsPage + 1, groupsSearch);
                            }}
                            disabled={!canNext}
                          >
                            Next
                            <ArrowRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Job History */}
          <div className="lg:col-span-1">
            <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
              <CardHeader className="pb-4 bg-gradient-to-r from-muted/30 to-muted/10 border-b border-border/50">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background shadow-sm border border-border/50">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold">Job History</CardTitle>
                    <CardDescription>Recent generation jobs</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {jobs.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                      <Clock className="h-6 w-6 text-muted-foreground/30" />
                    </div>
                    <p className="text-sm text-muted-foreground">No jobs yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/50 max-h-[500px] overflow-y-auto">
                    {jobs.map((job) => {
                      const statusConfig = getStatusConfig(job.status);
                      const StatusIcon = statusConfig.icon;
                      return (
                        <div key={job.id} className="p-4 hover:bg-muted/30 transition-colors">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div
                                className={cn(
                                  "h-8 w-8 rounded-lg flex items-center justify-center",
                                  `${statusConfig.color}/10`
                                )}
                              >
                                <StatusIcon
                                  className={cn(
                                    "h-4 w-4",
                                    statusConfig.color.replace("bg-", "text-"),
                                    statusConfig.animate && "animate-spin"
                                  )}
                                />
                              </div>
                              <div>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-xs",
                                    job.status === "completed" && "border-emerald-500/50 text-emerald-600",
                                    job.status === "running" && "border-blue-500/50 text-blue-600",
                                    job.status === "pending" && "border-amber-500/50 text-amber-600",
                                    job.status === "failed" && "border-red-500/50 text-red-600",
                                    job.status === "cancelled" && "border-orange-500/50 text-orange-600"
                                  )}
                                >
                                  {statusConfig.label}
                                </Badge>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {job.groups_created} groups from {job.total_products} products
                                </div>
                              </div>
                            </div>
                            <div className="text-right text-xs text-muted-foreground">
                              {new Date(job.created_at).toLocaleDateString()}
                            </div>
                          </div>
                          {job.status === "running" && (
                            <div className="mt-3">
                              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                <span>Progress</span>
                                <span>
                                  {job.processed_products}/{job.total_products}
                                </span>
                              </div>
                              <Progress
                                value={
                                  job.total_products > 0
                                    ? (job.processed_products / job.total_products) * 100
                                    : 0
                                }
                                className="h-1.5"
                              />
                            </div>
                          )}
                          {job.error && (
                            <div className="mt-2 text-xs text-red-500 bg-red-500/5 px-2 py-1 rounded">
                              {job.error}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold">Delete Variant Group?</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              This will delete the variant group{" "}
              <span className="font-semibold text-foreground">
                &quot;{groupToDelete?.base_name}&quot;
              </span>
              . The products in this group will be unlinked but not deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" disabled={deleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteGroup}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Group
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
