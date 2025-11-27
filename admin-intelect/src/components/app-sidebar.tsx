"use client";

import { useState } from "react";
import {
  LayoutDashboard,
  Package,
  Building2,
  FolderTree,
  Settings,
  Coins,
  FileText,
  History,
  Database,
  Network,
  ChevronRight,
  Activity,
  Sparkles,
  PlusCircle,
  Languages,
  ListChecks,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useCurrency, CURRENCY_OPTIONS } from "@/contexts/currency-context";
import { CurrencyCode } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Navigation item type definition for type-safe menu configuration
 */
interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  description?: string;
}

/**
 * Main navigation items with icons and routes
 */
const mainMenuItems: NavItem[] = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
    description: "Overview & statistics",
  },
  {
    title: "Products",
    url: "/products",
    icon: Package,
    description: "Manage product catalog",
  },
  {
    title: "Properties",
    url: "/properties",
    icon: Database,
    description: "Product properties",
  },
  {
    title: "Groupings",
    url: "/groupings",
    icon: Network,
    description: "Product groupings",
  },
  {
    title: "Brands",
    url: "/brands",
    icon: Building2,
    description: "Brand management",
  },
  {
    title: "Categories",
    url: "/categories",
    icon: FolderTree,
    description: "Category hierarchy",
  },
];

/**
 * Sync operation items for the collapsible sync section
 */
const syncMenuItems: NavItem[] = [
  {
    title: "Overview",
    url: "/sync",
    icon: Activity,
    description: "Sync status & logs",
  },
  {
    title: "Selective Sync",
    url: "/sync/selective",
    icon: Sparkles,
    description: "Custom sync operations",
  },
  {
    title: "Configurations",
    url: "/sync/configs",
    icon: FileText,
    description: "Sync templates",
  },
  {
    title: "Change History",
    url: "/sync/changes",
    icon: History,
    description: "Track changes",
  },
];

/**
 * Create new items section
 */
const createMenuItems: NavItem[] = [
  {
    title: "Create Product",
    url: "/products/new",
    icon: Package,
    description: "Add new product",
  },
  {
    title: "Create Brand",
    url: "/brands/new",
    icon: Building2,
    description: "Add new brand",
  },
  {
    title: "Create Category",
    url: "/categories/new",
    icon: FolderTree,
    description: "Add new category",
  },
];

/**
 * Translation items section
 */
const translationMenuItems: NavItem[] = [
  {
    title: "Translate",
    url: "/translate",
    icon: Languages,
    description: "Translate content",
  },
  {
    title: "Jobs",
    url: "/translate/jobs",
    icon: ListChecks,
    description: "Translation jobs",
  },
];

/**
 * Premium sidebar component with enhanced visual design and interactions
 */
export function AppSidebar() {
  const pathname = usePathname();
  const { currency, setCurrency } = useCurrency();
  const { state } = useSidebar();
  const [syncOpen, setSyncOpen] = useState(pathname.startsWith("/sync"));
  const [createOpen, setCreateOpen] = useState(
    pathname === "/products/new" ||
    pathname === "/brands/new" ||
    pathname === "/categories/new"
  );
  const [translateOpen, setTranslateOpen] = useState(pathname.startsWith("/translate"));

  const isCollapsed = state === "collapsed";

  /**
   * Checks if a route is currently active
   * Special handling for routes with sub-pages: exact match required for parent routes
   */
  const isActive = (url: string): boolean => {
    if (url === "/") return pathname === "/";

    // Special case: /sync (Overview) should only be active on exact match
    // This prevents Overview from being highlighted when on /sync/selective, /sync/configs, etc.
    if (url === "/sync") {
      return pathname === "/sync";
    }

    // Special case: /translate should only be active on exact match
    // This prevents Translate from being highlighted when on /translate/jobs
    if (url === "/translate") {
      return pathname === "/translate";
    }

    // For all other routes, use standard prefix matching
    return pathname === url || pathname.startsWith(url + "/");
  };

  return (
    <Sidebar className="border-r border-sidebar-border/50">
      {/* Premium Header with Logo */}
      <SidebarHeader className="border-b border-sidebar-border/50 bg-gradient-to-b from-sidebar to-sidebar/95">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-md shadow-primary/20 transition-transform duration-200 hover:scale-105">
            <Package className="h-4.5 w-4.5" />
            <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-sidebar" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-semibold tracking-tight truncate">
                Admin Intelect
              </span>
              <span className="text-[10px] text-muted-foreground/70 font-medium uppercase tracking-wider">
                Ultra B2B Manager
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {/* Main Navigation */}
        <SidebarGroup className="py-2">
          <SidebarGroupLabel className="px-2 mb-1">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainMenuItems.map((item, index) => (
                <SidebarMenuItem
                  key={item.title}
                  className="animate-in fade-in-0 slide-in-from-left-2"
                  style={{ animationDelay: `${index * 30}ms`, animationFillMode: 'backwards' }}
                >
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={isCollapsed ? item.title : undefined}
                  >
                    <Link href={item.url} className="group/link">
                      <item.icon className={cn(
                        "h-4 w-4 transition-colors duration-200",
                        isActive(item.url) ? "text-primary" : "text-muted-foreground group-hover/link:text-foreground"
                      )} />
                      <span className="font-medium">{item.title}</span>
                      {item.badge && (
                        <Badge
                          variant="secondary"
                          className="ml-auto h-5 px-1.5 text-[10px] font-semibold bg-primary/10 text-primary border-0"
                        >
                          {item.badge}
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="mx-2 bg-sidebar-border/30" />

        {/* Sync Operations - Collapsible */}
        <SidebarGroup className="py-2">
          <Collapsible open={syncOpen} onOpenChange={setSyncOpen}>
            <SidebarGroupLabel asChild className="px-2 mb-1">
              <CollapsibleTrigger className="flex w-full items-center justify-between cursor-pointer hover:text-foreground transition-colors group/trigger">
                <span className="flex items-center gap-2">
                  <RefreshCw className="h-3.5 w-3.5 text-emerald-500" />
                  Sync Operations
                </span>
                <ChevronRight className={cn(
                  "h-3.5 w-3.5 text-muted-foreground/50 transition-transform duration-200 ease-out group-hover/trigger:text-muted-foreground",
                  syncOpen && "rotate-90"
                )} />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 duration-200">
              <SidebarGroupContent>
                <SidebarMenu>
                  {syncMenuItems.map((item, index) => (
                    <SidebarMenuItem
                      key={item.title}
                      className="animate-in fade-in-0 slide-in-from-left-1"
                      style={{ animationDelay: `${index * 40}ms`, animationFillMode: 'backwards' }}
                    >
                      <SidebarMenuButton
                        asChild
                        isActive={isActive(item.url)}
                        tooltip={isCollapsed ? item.title : undefined}
                      >
                        <Link href={item.url} className="group/link">
                          <item.icon className={cn(
                            "h-4 w-4 transition-colors duration-200",
                            isActive(item.url) ? "text-primary" : "text-muted-foreground group-hover/link:text-foreground"
                          )} />
                          <span className="font-medium">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>

        <SidebarSeparator className="mx-2 bg-sidebar-border/30" />

        {/* Create New Section - Collapsible */}
        <SidebarGroup className="py-2">
          <Collapsible open={createOpen} onOpenChange={setCreateOpen}>
            <SidebarGroupLabel asChild className="px-2 mb-1">
              <CollapsibleTrigger className="flex w-full items-center justify-between cursor-pointer hover:text-foreground transition-colors group/trigger">
                <span className="flex items-center gap-2">
                  <PlusCircle className="h-3.5 w-3.5 text-primary" />
                  New
                </span>
                <ChevronRight className={cn(
                  "h-3.5 w-3.5 text-muted-foreground/50 transition-transform duration-200 ease-out group-hover/trigger:text-muted-foreground",
                  createOpen && "rotate-90"
                )} />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 duration-200">
              <SidebarGroupContent>
                <SidebarMenu>
                  {createMenuItems.map((item, index) => (
                    <SidebarMenuItem
                      key={item.title}
                      className="animate-in fade-in-0 slide-in-from-left-1"
                      style={{ animationDelay: `${index * 40}ms`, animationFillMode: 'backwards' }}
                    >
                      <SidebarMenuButton
                        asChild
                        isActive={isActive(item.url)}
                        tooltip={isCollapsed ? item.title : undefined}
                      >
                        <Link href={item.url} className="group/link">
                          <item.icon className={cn(
                            "h-4 w-4 transition-colors duration-200",
                            isActive(item.url) ? "text-primary" : "text-muted-foreground group-hover/link:text-foreground"
                          )} />
                          <span className="font-medium">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>

        <SidebarSeparator className="mx-2 bg-sidebar-border/30" />

        {/* Translations Section - Collapsible */}
        <SidebarGroup className="py-2">
          <Collapsible open={translateOpen} onOpenChange={setTranslateOpen}>
            <SidebarGroupLabel asChild className="px-2 mb-1">
              <CollapsibleTrigger className="flex w-full items-center justify-between cursor-pointer hover:text-foreground transition-colors group/trigger">
                <span className="flex items-center gap-2">
                  <Languages className="h-3.5 w-3.5 text-blue-500" />
                  Translations
                </span>
                <ChevronRight className={cn(
                  "h-3.5 w-3.5 text-muted-foreground/50 transition-transform duration-200 ease-out group-hover/trigger:text-muted-foreground",
                  translateOpen && "rotate-90"
                )} />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 duration-200">
              <SidebarGroupContent>
                <SidebarMenu>
                  {translationMenuItems.map((item, index) => (
                    <SidebarMenuItem
                      key={item.title}
                      className="animate-in fade-in-0 slide-in-from-left-1"
                      style={{ animationDelay: `${index * 40}ms`, animationFillMode: 'backwards' }}
                    >
                      <SidebarMenuButton
                        asChild
                        isActive={isActive(item.url)}
                        tooltip={isCollapsed ? item.title : undefined}
                      >
                        <Link href={item.url} className="group/link">
                          <item.icon className={cn(
                            "h-4 w-4 transition-colors duration-200",
                            isActive(item.url) ? "text-primary" : "text-muted-foreground group-hover/link:text-foreground"
                          )} />
                          <span className="font-medium">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>
      </SidebarContent>

      {/* Premium Footer */}
      <SidebarFooter className="border-t border-sidebar-border/50 bg-gradient-to-t from-sidebar to-sidebar/95">
        <SidebarMenu>
          {/* Currency Selector */}
          <SidebarMenuItem>
            <div className={cn(
              "flex items-center gap-2 px-2 py-2 rounded-lg transition-colors hover:bg-sidebar-accent/50",
              isCollapsed && "justify-center px-0"
            )}>
              <Coins className="h-4 w-4 text-muted-foreground shrink-0" />
              {!isCollapsed && (
                <Select
                  value={currency}
                  onValueChange={(value) => setCurrency(value as CurrencyCode)}
                >
                  <SelectTrigger className="h-7 w-[90px] text-xs border-sidebar-border/50 bg-sidebar-accent/30 hover:bg-sidebar-accent/50 transition-colors">
                    <SelectValue placeholder="Currency" />
                  </SelectTrigger>
                  <SelectContent align="start">
                    {CURRENCY_OPTIONS.map((option) => (
                      <SelectItem
                        key={option.code}
                        value={option.code}
                        className="text-xs"
                      >
                        <span className="font-medium">{option.code}</span>
                        <span className="ml-1.5 text-muted-foreground">{option.symbol}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </SidebarMenuItem>

          {/* Settings Link */}
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive("/settings")}
              tooltip={isCollapsed ? "Settings" : undefined}
            >
              <Link href="/settings" className="group/link">
                <Settings className={cn(
                  "h-4 w-4 transition-all duration-200",
                  isActive("/settings")
                    ? "text-primary"
                    : "text-muted-foreground group-hover/link:text-foreground group-hover/link:rotate-45"
                )} />
                <span className="font-medium">Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* Version indicator */}
          {!isCollapsed && (
            <div className="px-3 py-2 text-[10px] text-muted-foreground/50 font-mono">
              v1.0.0
            </div>
          )}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
