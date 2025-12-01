"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/sync/notification-bell";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/contexts/language-context";

export function Header() {
  const pathname = usePathname();
  const { t } = useTranslation("navigation");
  const segments = pathname.split("/").filter(Boolean);

  // Map segment keys to translation keys
  const segmentToTranslationKey: Record<string, string> = {
    "": "breadcrumbs.dashboard",
    products: "breadcrumbs.products",
    brands: "breadcrumbs.brands",
    categories: "breadcrumbs.categories",
    sync: "breadcrumbs.sync",
    settings: "breadcrumbs.settings",
    properties: "breadcrumbs.properties",
    groupings: "breadcrumbs.groupings",
    translate: "breadcrumbs.translate",
    new: "breadcrumbs.new",
    edit: "breadcrumbs.edit",
    selective: "breadcrumbs.selective",
    configs: "breadcrumbs.configs",
    changes: "breadcrumbs.changes",
    jobs: "breadcrumbs.jobs",
    monitor: "breadcrumbs.monitor",
    groups: "breadcrumbs.groups",
    notifications: "breadcrumbs.notifications",
    rollbacks: "breadcrumbs.rollbacks",
    conflicts: "breadcrumbs.conflicts",
    schedules: "breadcrumbs.schedules",
  };

  const getLabel = (segment: string): string => {
    const key = segmentToTranslationKey[segment];
    if (key) {
      return t(key);
    }
    // If it's a UUID or dynamic segment, return as-is (truncated for UUIDs)
    if (segment.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return segment.substring(0, 8) + "...";
    }
    // Capitalize first letter for unknown segments
    return segment.charAt(0).toUpperCase() + segment.slice(1);
  };

  const breadcrumbs = segments.map((segment, index) => {
    const path = "/" + segments.slice(0, index + 1).join("/");
    const isLast = index === segments.length - 1;
    const label = getLabel(segment);

    return {
      path,
      label,
      isLast,
    };
  });

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            {breadcrumbs.length === 0 ? (
              <BreadcrumbPage>{t("breadcrumbs.dashboard")}</BreadcrumbPage>
            ) : (
              <BreadcrumbLink href="/">{t("breadcrumbs.dashboard")}</BreadcrumbLink>
            )}
          </BreadcrumbItem>
          {breadcrumbs.map((crumb) => (
            <span key={crumb.path} className="flex items-center gap-2">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {crumb.isLast ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={crumb.path}>
                    {crumb.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </span>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto flex items-center gap-2">
        <NotificationBell />
        <ThemeToggle />
      </div>
    </header>
  );
}
