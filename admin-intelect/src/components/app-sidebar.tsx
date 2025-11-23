"use client";

import {
  LayoutDashboard,
  Package,
  Building2,
  FolderTree,
  RefreshCw,
  Settings,
  Coins,
  Zap,
  FileText,
  History,
  Database,
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
import { useCurrency, CURRENCY_OPTIONS } from "@/contexts/currency-context";
import { CurrencyCode } from "@/types";

const menuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Products",
    url: "/products",
    icon: Package,
  },
  {
    title: "Properties",
    url: "/properties",
    icon: Database,
  },
  {
    title: "Brands",
    url: "/brands",
    icon: Building2,
  },
  {
    title: "Categories",
    url: "/categories",
    icon: FolderTree,
  },
];

const syncMenuItems = [
  {
    title: "Sync Status",
    url: "/sync",
    icon: RefreshCw,
  },
  {
    title: "Selective Sync",
    url: "/sync/selective",
    icon: Zap,
  },
  {
    title: "Configurations",
    url: "/sync/configs",
    icon: FileText,
  },
  {
    title: "Change History",
    url: "/sync/changes",
    icon: History,
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { currency, setCurrency } = useCurrency();

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Package className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Admin Intelect</span>
            <span className="text-xs text-muted-foreground">
              Ultra B2B Manager
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      pathname === item.url ||
                      (item.url !== "/" && pathname.startsWith(item.url))
                    }
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Sync Operations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {syncMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2 px-2 py-1.5">
              <Coins className="h-4 w-4 text-muted-foreground" />
              <Select
                value={currency}
                onValueChange={(value) => setCurrency(value as CurrencyCode)}
              >
                <SelectTrigger className="h-8 w-[100px]">
                  <SelectValue placeholder="Currency" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map((option) => (
                    <SelectItem key={option.code} value={option.code}>
                      {option.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/settings">
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
