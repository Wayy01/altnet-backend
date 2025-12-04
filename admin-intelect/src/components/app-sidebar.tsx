"use client";

import { useState, useEffect } from "react";
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
  Layers,
  Tag,
  Search,
  ShoppingCart,
  Store,
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
 * Follows the dashboard design system with:
 * - Smooth animations (duration-200 for interactions)
 * - Proper color hierarchy (primary for active, muted for default)
 * - Staggered entrance animations
 * - Premium hover effects (subtle scale, translate, shadow)
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
  const [isVisible, setIsVisible] = useState(false);

  const isCollapsed = state === "collapsed";

  // Trigger entrance animation on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

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
      titleKey: "menu.promotions",
      url: "/promotions",
      icon: Tag,
      descriptionKey: "descriptions.promotions",
    },
    {
      titleKey: "menu.variants",
      url: "/variants",
      icon: Layers,
      descriptionKey: "descriptions.variants",
    },
    {
      titleKey: "menu.properties",
      url: "/properties",
      icon: Database,
      descriptionKey: "descriptions.properties",
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
    {
      titleKey: "menu.searchTest",
      url: "/search-test",
      icon: Search,
      descriptionKey: "descriptions.searchTest",
    },
    {
      titleKey: "menu.orders",
      url: "/orders",
      icon: ShoppingCart,
      descriptionKey: "descriptions.orders",
    },
    {
      titleKey: "menu.stores",
      url: "/stores",
      icon: Store,
      descriptionKey: "descriptions.stores",
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
      {/* Premium Header with Logo - Enhanced with staggered animation */}
      <SidebarHeader
        className={cn(
          "border-b border-sidebar-border/50 bg-gradient-to-b from-sidebar to-sidebar/95",
          "transition-all duration-300",
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
        )}
      >
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/30 transition-all duration-200 hover:scale-105 hover:shadow-xl hover:shadow-primary/40">
            <Package className="h-5 w-5" />
            <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-sidebar animate-pulse" />
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
        {/* Main Navigation - Enhanced with staggered entrance animations */}
        <SidebarGroup
          className={cn(
            "py-2 transition-all duration-300",
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}
          style={{ transitionDelay: isVisible ? "100ms" : "0ms" }}
        >
          <SidebarGroupLabel className="px-2 mb-1">{t("sections.navigation")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainMenuItems.map((item, index) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem
                    key={item.titleKey}
                    className={cn(
                      "transition-all duration-300",
                      isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
                    )}
                    style={{
                      transitionDelay: isVisible ? `${150 + index * 30}ms` : "0ms",
                    }}
                  >
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={isCollapsed ? t(item.titleKey) : undefined}
                    >
                      <Link href={item.url} className="group/link">
                        <item.icon
                          className={cn(
                            "h-4 w-4 transition-all duration-200",
                            active
                              ? "text-primary scale-110"
                              : "text-muted-foreground group-hover/link:text-foreground group-hover/link:scale-105"
                          )}
                        />
                        <span className="font-medium">{t(item.titleKey)}</span>
                        {item.badge && (
                          <Badge
                            variant="secondary"
                            className="ml-auto h-5 px-1.5 text-[10px] font-semibold bg-primary/10 text-primary border-0 transition-all duration-200 hover:bg-primary/20"
                          >
                            {item.badge}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator
          className={cn(
            "mx-2 bg-sidebar-border/30 transition-all duration-300",
            isVisible ? "opacity-100 scale-x-100" : "opacity-0 scale-x-0"
          )}
          style={{ transitionDelay: isVisible ? "350ms" : "0ms" }}
        />

        {/* Sync Operations - Collapsible with enhanced visual feedback */}
        <SidebarGroup
          className={cn(
            "py-2 transition-all duration-300",
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}
          style={{ transitionDelay: isVisible ? "400ms" : "0ms" }}
        >
          <Collapsible open={syncOpen} onOpenChange={setSyncOpen}>
            <SidebarGroupLabel asChild className="px-2 mb-1">
              <CollapsibleTrigger className="flex w-full items-center justify-between cursor-pointer hover:text-foreground transition-all duration-200 group/trigger hover:translate-x-0.5">
                <span className="flex items-center gap-2">
                  <RefreshCw
                    className={cn(
                      "h-3.5 w-3.5 text-emerald-500 transition-all duration-200",
                      syncOpen && "rotate-180"
                    )}
                  />
                  {t("sections.syncOperations")}
                </span>
                <ChevronRight
                  className={cn(
                    "h-3.5 w-3.5 text-muted-foreground/50 transition-all duration-200 ease-out",
                    "group-hover/trigger:text-muted-foreground group-hover/trigger:translate-x-0.5",
                    syncOpen && "rotate-90"
                  )}
                />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 duration-200">
              <SidebarGroupContent>
                <SidebarMenu>
                  {syncMenuItems.map((item, index) => {
                    const active = isActive(item.url);
                    return (
                      <SidebarMenuItem
                        key={item.titleKey}
                        className="animate-in fade-in-0 slide-in-from-left-1"
                        style={{ animationDelay: `${index * 40}ms`, animationFillMode: "backwards" }}
                      >
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={isCollapsed ? t(item.titleKey) : undefined}
                        >
                          <Link href={item.url} className="group/link">
                            <item.icon
                              className={cn(
                                "h-4 w-4 transition-all duration-200",
                                active
                                  ? "text-primary scale-110"
                                  : "text-muted-foreground group-hover/link:text-foreground group-hover/link:scale-105"
                              )}
                            />
                            <span className="font-medium">{t(item.titleKey)}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}

                  {/* Advanced Sub-section - Nested Collapsible with enhanced interaction */}
                  <SidebarMenuItem>
                    <Collapsible open={syncAdvancedOpen} onOpenChange={setSyncAdvancedOpen}>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          tooltip={isCollapsed ? t("sync.advanced") : undefined}
                          className="group/advanced cursor-pointer"
                        >
                          <Wrench
                            className={cn(
                              "h-4 w-4 transition-all duration-200",
                              syncAdvancedOpen
                                ? "text-primary scale-110 rotate-90"
                                : "text-muted-foreground group-hover/advanced:text-foreground group-hover/advanced:scale-105 group-hover/advanced:rotate-12"
                            )}
                          />
                          <span className="font-medium">{t("sync.advanced")}</span>
                          <ChevronRight
                            className={cn(
                              "ml-auto h-3.5 w-3.5 text-muted-foreground/50 transition-all duration-200 ease-out",
                              "group-hover/advanced:text-muted-foreground group-hover/advanced:translate-x-0.5",
                              syncAdvancedOpen && "rotate-90"
                            )}
                          />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-1 data-[state=open]:slide-in-from-top-1 duration-200">
                        <SidebarMenuSub>
                          {syncAdvancedItems.map((item, index) => {
                            const active = isActive(item.url);
                            return (
                              <SidebarMenuSubItem
                                key={item.titleKey}
                                className="animate-in fade-in-0 slide-in-from-left-1"
                                style={{ animationDelay: `${index * 30}ms`, animationFillMode: "backwards" }}
                              >
                                <SidebarMenuSubButton asChild isActive={active}>
                                  <Link href={item.url} className="group/sublink">
                                    <item.icon
                                      className={cn(
                                        "h-3.5 w-3.5 transition-all duration-200",
                                        active
                                          ? "text-primary scale-110"
                                          : "text-muted-foreground group-hover/sublink:text-foreground group-hover/sublink:scale-105"
                                      )}
                                    />
                                    <span>{t(item.titleKey)}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          })}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </Collapsible>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>

        <SidebarSeparator
          className={cn(
            "mx-2 bg-sidebar-border/30 transition-all duration-300",
            isVisible ? "opacity-100 scale-x-100" : "opacity-0 scale-x-0"
          )}
          style={{ transitionDelay: isVisible ? "450ms" : "0ms" }}
        />

        {/* Create New Section - Collapsible with premium feel */}
        <SidebarGroup
          className={cn(
            "py-2 transition-all duration-300",
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}
          style={{ transitionDelay: isVisible ? "500ms" : "0ms" }}
        >
          <Collapsible open={createOpen} onOpenChange={setCreateOpen}>
            <SidebarGroupLabel asChild className="px-2 mb-1">
              <CollapsibleTrigger className="flex w-full items-center justify-between cursor-pointer hover:text-foreground transition-all duration-200 group/trigger hover:translate-x-0.5">
                <span className="flex items-center gap-2">
                  <PlusCircle
                    className={cn(
                      "h-3.5 w-3.5 text-primary transition-all duration-200",
                      createOpen && "rotate-90 scale-110"
                    )}
                  />
                  {t("sections.createNew")}
                </span>
                <ChevronRight
                  className={cn(
                    "h-3.5 w-3.5 text-muted-foreground/50 transition-all duration-200 ease-out",
                    "group-hover/trigger:text-muted-foreground group-hover/trigger:translate-x-0.5",
                    createOpen && "rotate-90"
                  )}
                />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 duration-200">
              <SidebarGroupContent>
                <SidebarMenu>
                  {createMenuItems.map((item, index) => {
                    const active = isActive(item.url);
                    return (
                      <SidebarMenuItem
                        key={item.titleKey}
                        className="animate-in fade-in-0 slide-in-from-left-1"
                        style={{ animationDelay: `${index * 40}ms`, animationFillMode: "backwards" }}
                      >
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={isCollapsed ? t(item.titleKey) : undefined}
                        >
                          <Link href={item.url} className="group/link">
                            <item.icon
                              className={cn(
                                "h-4 w-4 transition-all duration-200",
                                active
                                  ? "text-primary scale-110"
                                  : "text-muted-foreground group-hover/link:text-foreground group-hover/link:scale-105"
                              )}
                            />
                            <span className="font-medium">{t(item.titleKey)}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>

        <SidebarSeparator
          className={cn(
            "mx-2 bg-sidebar-border/30 transition-all duration-300",
            isVisible ? "opacity-100 scale-x-100" : "opacity-0 scale-x-0"
          )}
          style={{ transitionDelay: isVisible ? "550ms" : "0ms" }}
        />

        {/* Translations Section - Collapsible with blue accent */}
        <SidebarGroup
          className={cn(
            "py-2 transition-all duration-300",
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}
          style={{ transitionDelay: isVisible ? "600ms" : "0ms" }}
        >
          <Collapsible open={translateOpen} onOpenChange={setTranslateOpen}>
            <SidebarGroupLabel asChild className="px-2 mb-1">
              <CollapsibleTrigger className="flex w-full items-center justify-between cursor-pointer hover:text-foreground transition-all duration-200 group/trigger hover:translate-x-0.5">
                <span className="flex items-center gap-2">
                  <Languages
                    className={cn(
                      "h-3.5 w-3.5 text-chart-3 transition-all duration-200",
                      translateOpen && "scale-110"
                    )}
                  />
                  {t("sections.translations")}
                </span>
                <ChevronRight
                  className={cn(
                    "h-3.5 w-3.5 text-muted-foreground/50 transition-all duration-200 ease-out",
                    "group-hover/trigger:text-muted-foreground group-hover/trigger:translate-x-0.5",
                    translateOpen && "rotate-90"
                  )}
                />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 duration-200">
              <SidebarGroupContent>
                <SidebarMenu>
                  {translationMenuItems.map((item, index) => {
                    const active = isActive(item.url);
                    return (
                      <SidebarMenuItem
                        key={item.titleKey}
                        className="animate-in fade-in-0 slide-in-from-left-1"
                        style={{ animationDelay: `${index * 40}ms`, animationFillMode: "backwards" }}
                      >
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={isCollapsed ? t(item.titleKey) : undefined}
                        >
                          <Link href={item.url} className="group/link">
                            <item.icon
                              className={cn(
                                "h-4 w-4 transition-all duration-200",
                                active
                                  ? "text-primary scale-110"
                                  : "text-muted-foreground group-hover/link:text-foreground group-hover/link:scale-105"
                              )}
                            />
                            <span className="font-medium">{t(item.titleKey)}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>
      </SidebarContent>

      {/* Premium Footer - Enhanced with staggered animation */}
      <SidebarFooter
        className={cn(
          "border-t border-sidebar-border/50 bg-gradient-to-t from-sidebar to-sidebar/95",
          "transition-all duration-300",
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        )}
        style={{ transitionDelay: isVisible ? "650ms" : "0ms" }}
      >
        <SidebarMenu>
          {/* Language and Currency Selectors - Enhanced with smooth hover transitions */}
          {!isCollapsed && (
            <div className="px-2 py-2 flex gap-2">
              {/* Language Selector */}
              <Select
                value={language}
                onValueChange={(value) => setLanguage(value as LanguageCode)}
              >
                <SelectTrigger className="flex-1 h-9 px-2.5 text-xs border border-sidebar-border bg-sidebar hover:bg-sidebar-accent/50 hover:border-sidebar-primary/30 focus:ring-2 focus:ring-sidebar-primary/30 rounded-md transition-all duration-200 hover:shadow-sm">
                  <div className="flex items-center gap-1.5">
                    <Languages className="h-3.5 w-3.5 text-muted-foreground transition-colors duration-200" />
                    <span className="font-medium">{currentLanguage.code.toUpperCase()}</span>
                  </div>
                </SelectTrigger>
                <SelectContent align="start" sideOffset={4}>
                  {LANGUAGES.map((option) => (
                    <SelectItem
                      key={option.code}
                      value={option.code}
                      className="text-xs transition-all duration-150 hover:translate-x-1"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{option.code.toUpperCase()}</span>
                        <span className="text-muted-foreground">{option.nativeLabel}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Currency Selector */}
              <Select
                value={currency}
                onValueChange={(value) => setCurrency(value as CurrencyCode)}
              >
                <SelectTrigger className="flex-1 h-9 px-2.5 text-xs border border-sidebar-border bg-sidebar hover:bg-sidebar-accent/50 hover:border-sidebar-primary/30 focus:ring-2 focus:ring-sidebar-primary/30 rounded-md transition-all duration-200 hover:shadow-sm">
                  <div className="flex items-center gap-1.5">
                    <Coins className="h-3.5 w-3.5 text-muted-foreground transition-colors duration-200" />
                    <span className="font-medium">{currency}</span>
                  </div>
                </SelectTrigger>
                <SelectContent align="start" sideOffset={4}>
                  {CURRENCY_OPTIONS.map((option) => (
                    <SelectItem
                      key={option.code}
                      value={option.code}
                      className="text-xs transition-all duration-150 hover:translate-x-1"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{option.code}</span>
                        <span className="text-muted-foreground">{option.symbol}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Collapsed state: Show icons only with tooltips */}
          {isCollapsed && (
            <>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip={`${t("sidebar.language")}: ${currentLanguage.label}`}
                  className="flex items-center justify-center transition-all duration-200 hover:scale-105"
                >
                  <Languages className="h-4 w-4 text-muted-foreground" />
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip={`${t("sidebar.currency")}: ${currency}`}
                  className="flex items-center justify-center transition-all duration-200 hover:scale-105"
                >
                  <Coins className="h-4 w-4 text-muted-foreground" />
                </SidebarMenuButton>
              </SidebarMenuItem>
            </>
          )}

          <SidebarSeparator className="mx-2 my-2 bg-sidebar-border/30" />

          {/* Settings Link - Enhanced with premium rotate effect */}
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive("/settings")}
              tooltip={isCollapsed ? t("menu.settings") : undefined}
            >
              <Link href="/settings" className="group/link">
                <Settings
                  className={cn(
                    "h-4 w-4 transition-all duration-300",
                    isActive("/settings")
                      ? "text-primary scale-110 rotate-90"
                      : "text-muted-foreground group-hover/link:text-foreground group-hover/link:rotate-90 group-hover/link:scale-105"
                  )}
                />
                <span className="font-medium">{t("menu.settings")}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* Version indicator - Subtle and premium */}
          {!isCollapsed && (
            <div className="px-3 py-2 text-[10px] text-muted-foreground/50 font-mono tracking-wider flex items-center justify-between">
              <span>v1.0.0</span>
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500/50 animate-pulse" />
            </div>
          )}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
