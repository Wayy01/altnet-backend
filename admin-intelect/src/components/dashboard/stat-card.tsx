"use client";

import Link from "next/link";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export type StatCardVariant = "hero" | "important" | "contextual" | "alert";

export interface StatCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: LucideIcon;
  variant?: StatCardVariant;
  link?: string;
  badge?: {
    label: string;
    variant?: "default" | "destructive" | "secondary" | "outline";
  };
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
  animationDelay?: number;
  isVisible?: boolean;
}

const variantConfig: Record<
  StatCardVariant,
  {
    borderColor: string;
    hoverBorderColor: string;
    iconBgColor: string;
    iconColor: string;
    gradientBg?: string;
  }
> = {
  hero: {
    borderColor: "border-primary/20",
    hoverBorderColor: "hover:border-primary/40",
    iconBgColor: "bg-primary/10",
    iconColor: "text-primary",
    gradientBg: "bg-gradient-to-br from-primary/10 via-primary/5 to-transparent",
  },
  important: {
    borderColor: "border-chart-3/20",
    hoverBorderColor: "hover:border-chart-3/40",
    iconBgColor: "bg-chart-3/10",
    iconColor: "text-chart-3",
  },
  contextual: {
    borderColor: "border-border",
    hoverBorderColor: "hover:border-border",
    iconBgColor: "bg-muted",
    iconColor: "text-muted-foreground",
  },
  alert: {
    borderColor: "border-destructive/20",
    hoverBorderColor: "hover:border-destructive/40",
    iconBgColor: "bg-destructive/10",
    iconColor: "text-destructive",
  },
};

/**
 * Premium StatCard component with sophisticated hover effects and color hierarchy
 */
export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  variant = "contextual",
  link,
  badge,
  trend,
  className,
  animationDelay = 0,
  isVisible = true,
}: StatCardProps) {
  const config = variantConfig[variant];

  const cardClassName = cn(
    "block rounded-xl border bg-card shadow-sm overflow-hidden",
    "transition-all duration-300 ease-out",
    config.borderColor,
    link && [
      "cursor-pointer",
      config.hoverBorderColor,
      "hover:shadow-lg hover:-translate-y-1 hover:scale-[1.02]",
    ],
    isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
    className
  );

  const cardStyle = {
    transitionDelay: isVisible ? `${animationDelay}ms` : "0ms",
  };

  const content = (
    <>
      {/* Background gradient for hero cards */}
      {config.gradientBg && (
        <div className={cn("absolute inset-0 -z-10", config.gradientBg)} />
      )}

      <div className="relative p-5">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-sm font-medium text-muted-foreground">
            {title}
          </span>
          <div
            className={cn(
              "p-2 rounded-lg transition-all duration-300",
              config.iconBgColor,
              link && "group-hover:scale-110"
            )}
          >
            <Icon className={cn("h-4 w-4", config.iconColor)} />
          </div>
        </div>

        <div className="flex items-baseline gap-3 mb-1.5">
          <div className="text-2xl font-bold tabular-nums tracking-tight">
            {typeof value === "number" ? value.toLocaleString() : value}
          </div>
          {badge && (
            <Badge
              variant={badge.variant || "default"}
              className={cn(
                "text-xs font-medium",
                variant === "hero" && "bg-primary/20 text-primary hover:bg-primary/30 border-primary/30",
                variant === "alert" && "bg-destructive/20 text-destructive hover:bg-destructive/30 border-destructive/30"
              )}
            >
              {badge.label}
            </Badge>
          )}
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          {description}
        </p>

        {trend && (
          <div
            className={cn(
              "mt-2 text-xs font-medium flex items-center gap-1",
              trend.isPositive ? "text-emerald-600" : "text-red-600"
            )}
          >
            <span>{trend.isPositive ? "↑" : "↓"}</span>
            <span>{Math.abs(trend.value)}%</span>
          </div>
        )}
      </div>
    </>
  );

  if (link) {
    return (
      <Link
        href={link}
        className={cn(cardClassName, "group")}
        style={cardStyle}
      >
        {content}
      </Link>
    );
  }

  return (
    <div className={cardClassName} style={cardStyle}>
      {content}
    </div>
  );
}
