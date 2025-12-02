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
  Calendar,
  TrendingUp,
  Filter,
  Wrench,
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
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
import { useLanguage, LANGUAGES, useTranslation } from "@/contexts/language-context";
import { CurrencyCode } from "@/types";
import { LanguageCode } from "@/contexts/language-context";
import { cn } from "@/lib/utils";

/**
 * Navigation item type definition for type-safe menu configuration
 */
interface NavItem {
  titleKey: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  descriptionKey?: string;
}

/**
 * Premium sidebar component with enhanced visual design and interactions
 */
export function AppSidebar() {
  const pathname = usePathname();
  const { currency, setCurrency } = useCurrency();
  const { language, setLanguage, currentLanguage } = useLanguage();
  const { t } = useTranslation("navigation");
  const { state } = useSidebar();
  const [syncOpen, setSyncOpen] = useState(pathname.startsWith("/sync"));
  const [syncAdvancedOpen, setSyncAdvancedOpen] = useState(
    pathname === "/sync/schedules" ||
    pathname === "/sync/analytics" ||
    pathname === "/sync/filters"
  );
  const [createOpen, setCreateOpen] = useState(
    pathname === "/products/new" ||
    pathname === "/brands/new" ||
    pathname === "/categories/new"
  );
  const [translateOpen, setTranslateOpen] = useState(pathname.startsWith("/translate"));

  const isCollapsed = state === "collapsed";

  /**
   * Main navigation items with icons and routes
   */
  const mainMenuItems: NavItem[] = [
    {
      titleKey: "menu.dashboard",
      url: "/",
      icon: LayoutDashboard,
      descriptionKey: "descriptions.dashboard",
    },
    {
      titleKey: "menu.products",
      url: "/products",
      icon: Package,
      descriptionKey: "descriptions.products",
    },
    {
      titleKey: "menu.properties",
      url: "/properties",
      icon: Database,
      descriptionKey: "descriptions.properties",
    },
    {
      titleKey: "menu.groupings",
      url: "/groupings",
      icon: Network,
      descriptionKey: "descriptions.groupings",
    },
    {
      titleKey: "menu.brands",
      url: "/brands",
      icon: Building2,
      descriptionKey: "descriptions.brands",
    },
    {
      titleKey: "menu.categories",
      url: "/categories",
      icon: FolderTree,
      descriptionKey: "descriptions.categories",
    },
  ];

  /**
   * Sync operation items for the collapsible sync section
   */
  const syncMenuItems: NavItem[] = [
    {
      titleKey: "sync.overview",
      url: "/sync",
      icon: Activity,
      descriptionKey: "descriptions.syncOverview",
    },
    {
      titleKey: "sync.selectiveSync",
      url: "/sync/selective",
      icon: Sparkles,
      descriptionKey: "descriptions.selectiveSync",
    },
    {
      titleKey: "sync.configurations",
      url: "/sync/configs",
      icon: FileText,
      descriptionKey: "descriptions.configurations",
    },
    {
      titleKey: "sync.changeHistory",
      url: "/sync/changes",
      icon: History,
      descriptionKey: "descriptions.changeHistory",
    },
  ];

  /**
   * Advanced sync operation items for nested collapsible sub-section
   */
  const syncAdvancedItems: NavItem[] = [
    {
      titleKey: "sync.schedules",
      url: "/sync/schedules",
      icon: Calendar,
      descriptionKey: "descriptions.schedules",
    },
    {
      titleKey: "sync.analytics",
      url: "/sync/analytics",
      icon: TrendingUp,
      descriptionKey: "descriptions.analytics",
    },
    {
      titleKey: "sync.filters",
      url: "/sync/filters",
      icon: Filter,
      descriptionKey: "descriptions.filters",
    },
  ];

  /**
   * Create new items section
   */
  const createMenuItems: NavItem[] = [
    {
      titleKey: "create.product",
      url: "/products/new",
      icon: Package,
      descriptionKey: "descriptions.createProduct",
    },
    {
      titleKey: "create.brand",
      url: "/brands/new",
      icon: Building2,
      descriptionKey: "descriptions.createBrand",
    },
    {
      titleKey: "create.category",
      url: "/categories/new",
      icon: FolderTree,
      descriptionKey: "descriptions.createCategory",
    },
  ];

  /**
   * Translation items section
   */
  const translationMenuItems: NavItem[] = [
    {
      titleKey: "translate.translate",
      url: "/translate",
      icon: Languages,
      descriptionKey: "descriptions.translate",
    },
    {
      titleKey: "translate.jobs",
      url: "/translate/jobs",
      icon: ListChecks,
      descriptionKey: "descriptions.jobs",
    },
  ];

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
                {t("sidebar.appName")}
              </span>
              <span className="text-[10px] text-muted-foreground/70 font-medium uppercase tracking-wider">
                {t("sidebar.appSubtitle")}
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {/* Main Navigation */}
        <SidebarGroup className="py-2">
          <SidebarGroupLabel className="px-2 mb-1">{t("sections.navigation")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainMenuItems.map((item, index) => (
                <SidebarMenuItem
                  key={item.titleKey}
                  className="animate-in fade-in-0 slide-in-from-left-2"
                  style={{ animationDelay: `${index * 30}ms`, animationFillMode: 'backwards' }}
                >
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={isCollapsed ? t(item.titleKey) : undefined}
                  >
                    <Link href={item.url} className="group/link">
                      <item.icon className={cn(
                        "h-4 w-4 transition-colors duration-200",
                        isActive(item.url) ? "text-primary" : "text-muted-foreground group-hover/link:text-foreground"
                      )} />
                      <span className="font-medium">{t(item.titleKey)}</span>
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
                  {t("sections.syncOperations")}
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
                      key={item.titleKey}
                      className="animate-in fade-in-0 slide-in-from-left-1"
                      style={{ animationDelay: `${index * 40}ms`, animationFillMode: 'backwards' }}
                    >
                      <SidebarMenuButton
                        asChild
                        isActive={isActive(item.url)}
                        tooltip={isCollapsed ? t(item.titleKey) : undefined}
                      >
                        <Link href={item.url} className="group/link">
                          <item.icon className={cn(
                            "h-4 w-4 transition-colors duration-200",
                            isActive(item.url) ? "text-primary" : "text-muted-foreground group-hover/link:text-foreground"
                          )} />
                          <span className="font-medium">{t(item.titleKey)}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}

                  {/* Advanced Sub-section - Nested Collapsible */}
                  <SidebarMenuItem>
                    <Collapsible open={syncAdvancedOpen} onOpenChange={setSyncAdvancedOpen}>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          tooltip={isCollapsed ? t("sync.advanced") : undefined}
                          className="group/advanced cursor-pointer"
                        >
                          <Wrench className={cn(
                            "h-4 w-4 transition-colors duration-200",
                            syncAdvancedOpen ? "text-primary" : "text-muted-foreground group-hover/advanced:text-foreground"
                          )} />
                          <span className="font-medium">{t("sync.advanced")}</span>
                          <ChevronRight className={cn(
                            "ml-auto h-3.5 w-3.5 text-muted-foreground/50 transition-transform duration-200 ease-out group-hover/advanced:text-muted-foreground",
                            syncAdvancedOpen && "rotate-90"
                          )} />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-1 data-[state=open]:slide-in-from-top-1 duration-200">
                        <SidebarMenuSub>
                          {syncAdvancedItems.map((item, index) => (
                            <SidebarMenuSubItem
                              key={item.titleKey}
                              className="animate-in fade-in-0 slide-in-from-left-1"
                              style={{ animationDelay: `${index * 30}ms`, animationFillMode: 'backwards' }}
                            >
                              <SidebarMenuSubButton
                                asChild
                                isActive={isActive(item.url)}
                              >
                                <Link href={item.url} className="group/sublink">
                                  <item.icon className={cn(
                                    "h-3.5 w-3.5 transition-colors duration-200",
                                    isActive(item.url) ? "text-primary" : "text-muted-foreground group-hover/sublink:text-foreground"
                                  )} />
                                  <span>{t(item.titleKey)}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </Collapsible>
                  </SidebarMenuItem>
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
                  {t("sections.createNew")}
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
                      key={item.titleKey}
                      className="animate-in fade-in-0 slide-in-from-left-1"
                      style={{ animationDelay: `${index * 40}ms`, animationFillMode: 'backwards' }}
                    >
                      <SidebarMenuButton
                        asChild
                        isActive={isActive(item.url)}
                        tooltip={isCollapsed ? t(item.titleKey) : undefined}
                      >
                        <Link href={item.url} className="group/link">
                          <item.icon className={cn(
                            "h-4 w-4 transition-colors duration-200",
                            isActive(item.url) ? "text-primary" : "text-muted-foreground group-hover/link:text-foreground"
                          )} />
                          <span className="font-medium">{t(item.titleKey)}</span>
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
                  {t("sections.translations")}
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
                      key={item.titleKey}
                      className="animate-in fade-in-0 slide-in-from-left-1"
                      style={{ animationDelay: `${index * 40}ms`, animationFillMode: 'backwards' }}
                    >
                      <SidebarMenuButton
                        asChild
                        isActive={isActive(item.url)}
                        tooltip={isCollapsed ? t(item.titleKey) : undefined}
                      >
                        <Link href={item.url} className="group/link">
                          <item.icon className={cn(
                            "h-4 w-4 transition-colors duration-200",
                            isActive(item.url) ? "text-primary" : "text-muted-foreground group-hover/link:text-foreground"
                          )} />
                          <span className="font-medium">{t(item.titleKey)}</span>
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
          {/* Language and Currency Selectors - Premium Full Width Design */}
          {!isCollapsed && (
            <div className="px-2 py-3 space-y-2.5">
              {/* Language Selector */}
              <div className="group/selector">
                <label className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-1.5 px-1 transition-colors group-hover/selector:text-muted-foreground/80">
                  {t("sidebar.language")}
                </label>
                <Select
                  value={language}
                  onValueChange={(value) => setLanguage(value as LanguageCode)}
                >
                  <SelectTrigger className="w-full h-10 px-3 text-sm font-medium border-sidebar-border/40 bg-sidebar-accent/20 hover:bg-sidebar-accent/40 hover:border-sidebar-border/60 focus:bg-sidebar-accent/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all duration-200 rounded-lg shadow-sm hover:shadow">
                    <div className="flex items-center gap-2.5 w-full">
                      <div className="flex items-center justify-center w-6 h-6 rounded-md bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/20">
                        <Languages className="h-3.5 w-3.5 text-blue-400" />
                      </div>
                      <div className="flex items-center gap-2 flex-1">
                        <span className="font-semibold text-foreground">{currentLanguage.code.toUpperCase()}</span>
                        <span className="text-muted-foreground/70 text-xs font-normal">{currentLanguage.nativeLabel}</span>
                      </div>
                    </div>
                  </SelectTrigger>
                  <SelectContent align="start" className="w-[var(--radix-select-trigger-width)]">
                    {LANGUAGES.map((option) => (
                      <SelectItem
                        key={option.code}
                        value={option.code}
                        className="py-2.5 px-3 cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="flex items-center justify-center w-6 h-6 rounded-md bg-gradient-to-br from-blue-500/15 to-blue-600/5 border border-blue-500/15">
                            <span className="text-[10px] font-bold text-blue-400">{option.code.toUpperCase()}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{option.label}</span>
                            <span className="text-[11px] text-muted-foreground/70">{option.nativeLabel}</span>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Currency Selector */}
              <div className="group/selector">
                <label className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-1.5 px-1 transition-colors group-hover/selector:text-muted-foreground/80">
                  {t("sidebar.currency")}
                </label>
                <Select
                  value={currency}
                  onValueChange={(value) => setCurrency(value as CurrencyCode)}
                >
                  <SelectTrigger className="w-full h-10 px-3 text-sm font-medium border-sidebar-border/40 bg-sidebar-accent/20 hover:bg-sidebar-accent/40 hover:border-sidebar-border/60 focus:bg-sidebar-accent/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all duration-200 rounded-lg shadow-sm hover:shadow">
                    <div className="flex items-center gap-2.5 w-full">
                      <div className="flex items-center justify-center w-6 h-6 rounded-md bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20">
                        <Coins className="h-3.5 w-3.5 text-amber-400" />
                      </div>
                      <div className="flex items-center gap-2 flex-1">
                        <span className="font-semibold text-foreground">{currency}</span>
                        <span className="text-muted-foreground/70 text-xs font-normal">{CURRENCY_OPTIONS.find(c => c.code === currency)?.symbol}</span>
                      </div>
                    </div>
                  </SelectTrigger>
                  <SelectContent align="start" className="w-[var(--radix-select-trigger-width)]">
                    {CURRENCY_OPTIONS.map((option) => (
                      <SelectItem
                        key={option.code}
                        value={option.code}
                        className="py-2.5 px-3 cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="flex items-center justify-center w-6 h-6 rounded-md bg-gradient-to-br from-amber-500/15 to-amber-600/5 border border-amber-500/15">
                            <span className="text-xs font-bold text-amber-400">{option.symbol}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{option.code}</span>
                            <span className="text-[11px] text-muted-foreground/70">{option.label}</span>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Collapsed state: Show icons only with tooltips */}
          {isCollapsed && (
            <>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip={`${t("sidebar.language")}: ${currentLanguage.label}`}
                  className="flex items-center justify-center"
                >
                  <div className="flex items-center justify-center w-7 h-7 rounded-md bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/20 transition-all duration-200 hover:from-blue-500/30 hover:to-blue-600/15">
                    <Languages className="h-4 w-4 text-blue-400" />
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip={`${t("sidebar.currency")}: ${currency}`}
                  className="flex items-center justify-center"
                >
                  <div className="flex items-center justify-center w-7 h-7 rounded-md bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20 transition-all duration-200 hover:from-amber-500/30 hover:to-amber-600/15">
                    <Coins className="h-4 w-4 text-amber-400" />
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </>
          )}

          <SidebarSeparator className="mx-2 my-2 bg-sidebar-border/30" />

          {/* Settings Link */}
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive("/settings")}
              tooltip={isCollapsed ? t("menu.settings") : undefined}
            >
              <Link href="/settings" className="group/link">
                <Settings className={cn(
                  "h-4 w-4 transition-all duration-200",
                  isActive("/settings")
                    ? "text-primary"
                    : "text-muted-foreground group-hover/link:text-foreground group-hover/link:rotate-45"
                )} />
                <span className="font-medium">{t("menu.settings")}</span>
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
