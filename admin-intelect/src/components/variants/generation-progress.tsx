"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { VariantGenerationJob, VariantJobStatus } from "@/types/variants";
import {
  Loader2,
  Pause,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Layers,
  Package,
  Zap,
} from "lucide-react";

interface GenerationProgressProps {
  job: VariantGenerationJob;
  onCancel?: () => void;
  className?: string;
}

/**
 * Status configuration for visual styling
 */
const getStatusConfig = (status: VariantJobStatus) => {
  switch (status) {
    case "completed":
      return {
        icon: CheckCircle2,
        color: "text-emerald-500",
        bg: "bg-emerald-500/10",
        borderColor: "border-emerald-500/30",
        gradient: "from-emerald-500",
        label: "Completed",
      };
    case "running":
      return {
        icon: Zap,
        color: "text-blue-500",
        bg: "bg-blue-500/10",
        borderColor: "border-blue-500/30",
        gradient: "from-blue-500",
        label: "Running",
        animate: true,
      };
    case "pending":
      return {
        icon: Clock,
        color: "text-amber-500",
        bg: "bg-amber-500/10",
        borderColor: "border-amber-500/30",
        gradient: "from-amber-500",
        label: "Pending",
      };
    case "failed":
      return {
        icon: XCircle,
        color: "text-red-500",
        bg: "bg-red-500/10",
        borderColor: "border-red-500/30",
        gradient: "from-red-500",
        label: "Failed",
      };
    case "cancelled":
      return {
        icon: AlertCircle,
        color: "text-orange-500",
        bg: "bg-orange-500/10",
        borderColor: "border-orange-500/30",
        gradient: "from-orange-500",
        label: "Cancelled",
      };
    default:
      return {
        icon: Clock,
        color: "text-gray-500",
        bg: "bg-gray-500/10",
        borderColor: "border-gray-500/30",
        gradient: "from-gray-500",
        label: status,
      };
  }
};

/**
 * Generation Progress Component
 * Displays real-time progress of a variant generation job
 */
export function GenerationProgress({
  job,
  onCancel,
  className,
}: GenerationProgressProps) {
  const statusConfig = getStatusConfig(job.status);
  const StatusIcon = statusConfig.icon;

  // Calculate progress percentage
  const progress =
    job.total_products > 0
      ? Math.round((job.processed_products / job.total_products) * 100)
      : 0;

  // Determine if the job is active (can be cancelled)
  const isActive = job.status === "pending" || job.status === "running";

  return (
    <Card
      className={cn(
        "rounded-2xl border-border/50 shadow-sm overflow-hidden relative",
        "bg-gradient-to-br from-card to-card/80",
        className
      )}
    >
      {/* Status indicator bar */}
      <div
        className={cn(
          "absolute inset-y-0 left-0 w-1.5",
          `bg-gradient-to-b ${statusConfig.gradient} to-transparent`
        )}
      />

      <CardContent className="p-6 pl-8">
        <div className="flex items-start justify-between gap-6">
          {/* Left side: Status and progress */}
          <div className="flex items-start gap-4 flex-1">
            {/* Status Icon */}
            <div
              className={cn(
                "h-14 w-14 rounded-2xl flex items-center justify-center border transition-all duration-300",
                statusConfig.bg,
                statusConfig.borderColor
              )}
            >
              <StatusIcon
                className={cn(
                  "h-7 w-7 transition-colors",
                  statusConfig.color,
                  statusConfig.animate && "animate-pulse"
                )}
              />
            </div>

            {/* Progress Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <span className={cn("text-xl font-bold", statusConfig.color)}>
                  {statusConfig.label}
                </span>
                {isActive && (
                  <Badge className="bg-blue-500 text-white animate-pulse">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Live
                  </Badge>
                )}
              </div>

              {/* Progress Bar */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-mono font-semibold">
                    {job.processed_products.toLocaleString()} /{" "}
                    {job.total_products.toLocaleString()}
                  </span>
                </div>
                <div className="relative">
                  <Progress value={progress} className="h-3 bg-muted/50" />
                  {progress > 10 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-primary-foreground drop-shadow-sm">
                        {progress}%
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div
                  className={cn(
                    "p-3 rounded-xl text-center transition-all duration-300",
                    "bg-gradient-to-br from-muted/50 to-muted/30"
                  )}
                >
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-lg font-bold">
                    {job.processed_products.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    Processed
                  </div>
                </div>

                <div
                  className={cn(
                    "p-3 rounded-xl text-center transition-all duration-300",
                    "bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20"
                  )}
                >
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <Layers className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-lg font-bold text-primary">
                    {job.groups_created.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    Groups Created
                  </div>
                </div>

                <div
                  className={cn(
                    "p-3 rounded-xl text-center transition-all duration-300",
                    "bg-gradient-to-br from-muted/50 to-muted/30"
                  )}
                >
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <Zap className="h-4 w-4 text-amber-500" />
                  </div>
                  <div className="text-lg font-bold">
                    {progress}
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    Complete
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {job.error && (
                <div className="mt-4 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                  <div className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                    <div className="text-sm text-red-600">{job.error}</div>
                  </div>
                </div>
              )}

              {/* Completion Message */}
              {job.status === "completed" && (
                <div className="mt-4 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    <div className="text-sm text-emerald-600">
                      Successfully created {job.groups_created} variant groups from{" "}
                      {job.total_products} products
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right side: Cancel button */}
          {isActive && onCancel && (
            <Button
              variant="outline"
              onClick={onCancel}
              className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0"
            >
              <Pause className="h-4 w-4" />
              Cancel
            </Button>
          )}
        </div>

        {/* Timestamps */}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border/50">
          {job.started_at && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Started: {new Date(job.started_at).toLocaleString()}
            </div>
          )}
          {job.completed_at && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Completed: {new Date(job.completed_at).toLocaleString()}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
