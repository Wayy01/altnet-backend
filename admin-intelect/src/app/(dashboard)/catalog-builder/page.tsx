"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/language-context";
import {
  FolderTree,
  MoreVertical,
  ChevronRight,
  ChevronDown,
  Loader2,
  Eye,
  Plus,
  Copy,
  Trash2,
  Edit,
  GripVertical,
  Grid3x3,
  List as ListIcon,
  Filter,
  Link as LinkIcon,
  Layers,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  useCatalogSections,
  useCatalogGroups,
  useCatalogItems,
  useDeleteSection,
  useDeleteGroup,
  useDeleteItem,
  useCloneSection,
} from "@/hooks/use-catalog";
import { SectionForm } from "@/components/catalog-builder/section-form";
import { GroupForm } from "@/components/catalog-builder/group-form";
import { ItemForm } from "@/components/catalog-builder/item-form";
import { CatalogSection, CatalogGroup, CatalogItem } from "@/types/catalog";

/**
 * Stat indicator configuration
 */
interface StatIndicator {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
  variant?: "default" | "success" | "warning" | "muted";
}

export default function CatalogBuilderPage() {
  const { t } = useTranslation("catalogBuilder");

  // Fetch sections
  const { data: sections = [], isLoading, error } = useCatalogSections();

  // Delete mutations
  const deleteSection = useDeleteSection();
  const deleteGroup = useDeleteGroup();
  const deleteItem = useDeleteItem();
  const cloneSection = useCloneSection();

  // Form state
  const [showSectionForm, setShowSectionForm] = useState(false);
  const [editingSection, setEditingSection] = useState<CatalogSection | undefined>();

  const [showGroupForm, setShowGroupForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CatalogGroup | undefined>();
  const [groupSectionId, setGroupSectionId] = useState<string>("");

  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | undefined>();
  const [itemGroupId, setItemGroupId] = useState<string>("");

  // Delete confirmation state
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    type: "section" | "group" | "item";
    id: string;
    name: string;
  } | null>(null);

  // Expanded sections state
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Animation state
  const [contentVisible, setContentVisible] = useState(false);

  // Toggle section expansion
  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  }, []);

  // Toggle group expansion
  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  }, []);

  // Section actions
  const handleCreateSection = () => {
    setEditingSection(undefined);
    setShowSectionForm(true);
  };

  const handleEditSection = (section: CatalogSection) => {
    setEditingSection(section);
    setShowSectionForm(true);
  };

  const handleCloneSection = async (sectionId: string) => {
    try {
      await cloneSection.mutateAsync(sectionId);
    } catch (error) {
      console.error("Failed to clone section:", error);
    }
  };

  const handleDeleteSection = (section: CatalogSection) => {
    setDeleteDialog({
      open: true,
      type: "section",
      id: section.id,
      name: section.name_ro,
    });
  };

  // Group actions
  const handleCreateGroup = (sectionId: string) => {
    setEditingGroup(undefined);
    setGroupSectionId(sectionId);
    setShowGroupForm(true);
  };

  const handleEditGroup = (group: CatalogGroup) => {
    setEditingGroup(group);
    setGroupSectionId(group.section_id);
    setShowGroupForm(true);
  };

  const handleDeleteGroup = (group: CatalogGroup) => {
    setDeleteDialog({
      open: true,
      type: "group",
      id: group.id,
      name: group.name_ro,
    });
  };

  // Item actions
  const handleCreateItem = (groupId: string) => {
    setEditingItem(undefined);
    setItemGroupId(groupId);
    setShowItemForm(true);
  };

  const handleEditItem = (item: CatalogItem) => {
    setEditingItem(item);
    setItemGroupId(item.group_id);
    setShowItemForm(true);
  };

  const handleDeleteItem = (item: CatalogItem) => {
    setDeleteDialog({
      open: true,
      type: "item",
      id: item.id,
      name: item.name_ro,
    });
  };

  // Confirm delete
  const confirmDelete = async () => {
    if (!deleteDialog) return;

    try {
      if (deleteDialog.type === "section") {
        await deleteSection.mutateAsync(deleteDialog.id);
      } else if (deleteDialog.type === "group") {
        await deleteGroup.mutateAsync(deleteDialog.id);
      } else if (deleteDialog.type === "item") {
        await deleteItem.mutateAsync(deleteDialog.id);
      }
      setDeleteDialog(null);
    } catch (error) {
      console.error(`Failed to delete ${deleteDialog.type}:`, error);
    }
  };

  // Stats indicators
  const statsIndicators: StatIndicator[] = useMemo(() => {
    const activeSections = sections.filter((s) => s.is_active).length;

    return [
      {
        label: t("stats.totalSections"),
        value: sections.length,
        icon: <FolderTree className="h-3.5 w-3.5" />,
        variant: "default",
      },
      {
        label: t("stats.activeSections"),
        value: activeSections,
        icon: <Layers className="h-3.5 w-3.5" />,
        variant: activeSections > 0 ? "success" : "muted",
      },
    ];
  }, [sections, t]);

  // Start animation after mount
  useEffect(() => {
    const timer = setTimeout(() => setContentVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("page.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            {t("page.description")}
          </p>
        </div>
        <CatalogBuilderSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("page.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            {t("page.description")}
          </p>
        </div>
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="pt-12 pb-12">
            <div className="flex flex-col items-center justify-center">
              <div className="p-4 rounded-full bg-destructive/10 mb-4">
                <FolderTree className="h-10 w-10 text-destructive" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">
                {t("errors.failedToLoad")}
              </p>
              <p className="text-xs text-muted-foreground text-center mb-4">
                {error instanceof Error ? error.message : t("errors.somethingWrong")}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
                className="transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
              >
                {t("actions.tryAgain")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div
        className={`
          flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between
          transition-all duration-300 ease-out
          ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
        `}
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("page.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            {t("page.description")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            asChild
            className="transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
          >
            <Link href="/catalog-builder/preview">
              <Eye className="h-4 w-4 mr-1.5" />
              {t("actions.preview")}
            </Link>
          </Button>
          <Button
            size="sm"
            onClick={handleCreateSection}
            className="transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            {t("actions.addSection")}
          </Button>
        </div>
      </div>

      {/* Stats Bar */}
      <div
        className={`
          flex flex-wrap items-center gap-3
          transition-all duration-300 ease-out
          ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
        `}
        style={{ transitionDelay: "50ms" }}
      >
        {statsIndicators.map((stat, index) => (
          <div
            key={stat.label}
            className={`
              inline-flex items-center gap-2 px-3 py-2 rounded-lg border
              transition-all duration-200 ease-out
              hover:shadow-sm hover:border-border/80 hover:-translate-y-0.5
              ${stat.variant === "success" ? "bg-primary/5 border-primary/20 hover:bg-primary/10" : ""}
              ${stat.variant === "default" || stat.variant === "muted" ? "bg-muted/50" : ""}
            `}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {stat.icon && (
              <span
                className={`
                  ${stat.variant === "success" ? "text-primary" : ""}
                  ${stat.variant === "default" || stat.variant === "muted" ? "text-muted-foreground" : ""}
                `}
              >
                {stat.icon}
              </span>
            )}
            <span className="text-xs font-medium text-muted-foreground">
              {stat.label}
            </span>
            <span className="text-sm font-semibold tabular-nums">{stat.value}</span>
          </div>
        ))}
      </div>

      {/* Catalog Tree */}
      <div
        className={`
          space-y-4
          transition-all duration-300 ease-out
          ${contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
        `}
        style={{ transitionDelay: "100ms" }}
      >
        {sections.length === 0 ? (
          <Card className="rounded-xl border shadow-sm">
            <CardContent className="pt-12 pb-12">
              <div className="flex flex-col items-center justify-center">
                <div className="p-4 rounded-full bg-muted/50 mb-4">
                  <FolderTree className="h-10 w-10 text-muted-foreground/50" />
                </div>
                <p className="font-medium text-foreground mb-1">
                  {t("empty.noSections")}
                </p>
                <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
                  {t("empty.noSectionsDescription")}
                </p>
                <Button
                  onClick={handleCreateSection}
                  className="transition-all duration-200 hover:shadow-sm"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  {t("actions.createFirstSection")}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          sections.map((section, sectionIndex) => (
            <SectionTree
              key={section.id}
              section={section}
              isExpanded={expandedSections.has(section.id)}
              onToggle={() => toggleSection(section.id)}
              onEdit={handleEditSection}
              onClone={handleCloneSection}
              onDelete={handleDeleteSection}
              onCreateGroup={handleCreateGroup}
              expandedGroups={expandedGroups}
              onToggleGroup={toggleGroup}
              onEditGroup={handleEditGroup}
              onDeleteGroup={handleDeleteGroup}
              onCreateItem={handleCreateItem}
              onEditItem={handleEditItem}
              onDeleteItem={handleDeleteItem}
              animationDelay={sectionIndex * 50}
            />
          ))
        )}

        {/* Add Section Button */}
        {sections.length > 0 && (
          <Button
            variant="outline"
            onClick={handleCreateSection}
            className="w-full transition-all duration-200 hover:shadow-sm hover:border-primary/30"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            {t("actions.addSection")}
          </Button>
        )}
      </div>

      {/* Section Form Dialog */}
      <SectionForm
        section={editingSection}
        open={showSectionForm}
        onOpenChange={setShowSectionForm}
        onSuccess={() => {
          setShowSectionForm(false);
          setEditingSection(undefined);
        }}
      />

      {/* Group Form Dialog */}
      <GroupForm
        group={editingGroup}
        sectionId={groupSectionId}
        open={showGroupForm}
        onOpenChange={setShowGroupForm}
        onSuccess={() => {
          setShowGroupForm(false);
          setEditingGroup(undefined);
        }}
      />

      {/* Item Form Dialog */}
      <ItemForm
        item={editingItem}
        groupId={itemGroupId}
        open={showItemForm}
        onOpenChange={setShowItemForm}
        onSuccess={() => {
          setShowItemForm(false);
          setEditingItem(undefined);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteDialog?.open || false}
        onOpenChange={(open) => !open && setDeleteDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteDialog?.type === "section" && t("section.deleteTitle")}
              {deleteDialog?.type === "group" && t("group.deleteTitle")}
              {deleteDialog?.type === "item" && t("item.deleteTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog?.type === "section" && (
                <>
                  <span dangerouslySetInnerHTML={{ __html: t("section.deleteDescription", { name: deleteDialog.name }) }} />
                  <br />
                  <br />
                  {t("section.deleteWarning")}
                </>
              )}
              {deleteDialog?.type === "group" && (
                <>
                  <span dangerouslySetInnerHTML={{ __html: t("group.deleteDescription", { name: deleteDialog.name }) }} />
                  <br />
                  <br />
                  {t("group.deleteWarning")}
                </>
              )}
              {deleteDialog?.type === "item" && (
                <span dangerouslySetInnerHTML={{ __html: t("item.deleteDescription", { name: deleteDialog.name }) }} />
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSection.isPending ||
              deleteGroup.isPending ||
              deleteItem.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {t("actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * Section Tree Component - Displays a section with its groups and items
 */
interface SectionTreeProps {
  section: CatalogSection;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: (section: CatalogSection) => void;
  onClone: (sectionId: string) => void;
  onDelete: (section: CatalogSection) => void;
  onCreateGroup: (sectionId: string) => void;
  expandedGroups: Set<string>;
  onToggleGroup: (groupId: string) => void;
  onEditGroup: (group: CatalogGroup) => void;
  onDeleteGroup: (group: CatalogGroup) => void;
  onCreateItem: (groupId: string) => void;
  onEditItem: (item: CatalogItem) => void;
  onDeleteItem: (item: CatalogItem) => void;
  animationDelay: number;
}

function SectionTree({
  section,
  isExpanded,
  onToggle,
  onEdit,
  onClone,
  onDelete,
  onCreateGroup,
  expandedGroups,
  onToggleGroup,
  onEditGroup,
  onDeleteGroup,
  onCreateItem,
  onEditItem,
  onDeleteItem,
  animationDelay,
}: SectionTreeProps) {
  const { t } = useTranslation("catalogBuilder");
  const { data: groups = [], isLoading: loadingGroups } = useCatalogGroups(
    isExpanded ? section.id : ""
  );

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <Card
        className="rounded-xl border shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md"
        style={{ animationDelay: `${animationDelay}ms` }}
      >
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-md bg-muted">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
              <div className="flex items-center gap-2">
                {section.icon && (
                  <img
                    src={section.icon}
                    alt=""
                    className="h-5 w-5 object-contain"
                  />
                )}
                <h3 className="font-semibold">{section.name_ro}</h3>
              </div>
              <Badge
                variant={section.is_active ? "default" : "secondary"}
                className={
                  section.is_active
                    ? "bg-primary/10 text-primary border-primary/20"
                    : ""
                }
              >
                {section.is_active ? t("states.active") : t("states.inactive")}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 transition-all duration-200 hover:bg-muted"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(section);
                    }}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    {t("actions.edit")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onClone(section.id);
                    }}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    {t("actions.clone")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(section);
                    }}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t("actions.delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t bg-muted/10">
            <div className="p-4 space-y-3">
              {loadingGroups ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("states.loadingGroups")}
                </div>
              ) : groups.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm text-muted-foreground mb-3">
                    {t("empty.noGroups")}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onCreateGroup(section.id)}
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    {t("actions.addFirstGroup")}
                  </Button>
                </div>
              ) : (
                <>
                  {groups.map((group) => (
                    <GroupTree
                      key={group.id}
                      group={group}
                      isExpanded={expandedGroups.has(group.id)}
                      onToggle={() => onToggleGroup(group.id)}
                      onEdit={onEditGroup}
                      onDelete={onDeleteGroup}
                      onCreateItem={onCreateItem}
                      onEditItem={onEditItem}
                      onDeleteItem={onDeleteItem}
                    />
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onCreateGroup(section.id)}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    {t("actions.addGroup")}
                  </Button>
                </>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

/**
 * Group Tree Component - Displays a group with its items
 */
interface GroupTreeProps {
  group: CatalogGroup;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: (group: CatalogGroup) => void;
  onDelete: (group: CatalogGroup) => void;
  onCreateItem: (groupId: string) => void;
  onEditItem: (item: CatalogItem) => void;
  onDeleteItem: (item: CatalogItem) => void;
}

function GroupTree({
  group,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
  onCreateItem,
  onEditItem,
  onDeleteItem,
}: GroupTreeProps) {
  const { t } = useTranslation("catalogBuilder");
  const { data: items = [], isLoading: loadingItems } = useCatalogItems(
    isExpanded ? group.id : ""
  );

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="rounded-lg border bg-card ml-6">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-md bg-muted">
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground cursor-grab" />
              <Grid3x3 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm font-medium">{group.name_ro}</span>
              <Badge variant="outline" className="text-xs">
                {t("group.column", { number: group.column_position })}
              </Badge>
              {!group.is_active && (
                <Badge variant="secondary" className="text-xs">
                  {t("states.inactive")}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 transition-all duration-200 hover:bg-muted"
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(group);
                    }}
                  >
                    <Edit className="mr-2 h-3.5 w-3.5" />
                    {t("actions.edit")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(group);
                    }}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    {t("actions.delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t bg-muted/5">
            <div className="p-3 space-y-2">
              {loadingItems ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t("states.loadingItems")}
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-xs text-muted-foreground mb-2">
                    {t("empty.noItems")}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onCreateItem(group.id)}
                    className="h-7 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {t("actions.addFirstItem")}
                  </Button>
                </div>
              ) : (
                <>
                  {items.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      onEdit={onEditItem}
                      onDelete={onDeleteItem}
                    />
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onCreateItem(group.id)}
                    className="w-full h-7 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {t("actions.addItem")}
                  </Button>
                </>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

/**
 * Item Row Component - Displays a catalog item
 */
interface ItemRowProps {
  item: CatalogItem;
  onEdit: (item: CatalogItem) => void;
  onDelete: (item: CatalogItem) => void;
}

function ItemRow({ item, onEdit, onDelete }: ItemRowProps) {
  const { t } = useTranslation("catalogBuilder");
  return (
    <div className="flex items-center justify-between p-2 rounded-md bg-background border ml-6 hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-2">
        <GripVertical className="h-3 w-3 text-muted-foreground cursor-grab" />
        <ListIcon className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs font-medium">{item.name_ro}</span>
        <Badge
          variant="outline"
          className={`text-xs ${
            item.item_type === "category_link"
              ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
              : "bg-purple-500/10 text-purple-600 border-purple-500/20"
          }`}
        >
          {item.item_type === "category_link" ? (
            <LinkIcon className="h-2.5 w-2.5 mr-1" />
          ) : (
            <Filter className="h-2.5 w-2.5 mr-1" />
          )}
          {item.item_type === "category_link" ? t("item.categoryLink") : t("item.customFilter")}
        </Badge>
        {!item.is_active && (
          <Badge variant="secondary" className="text-xs">
            {t("states.inactive")}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEdit(item)}
          className="h-6 w-6 transition-all duration-200 hover:bg-muted"
        >
          <Edit className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(item)}
          className="h-6 w-6 transition-all duration-200 hover:bg-muted text-destructive hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

/**
 * Skeleton loader for catalog builder page
 */
function CatalogBuilderSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats skeleton */}
      <div className="flex gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-10 w-32 rounded-lg"
            style={{ animationDelay: `${i * 50}ms` }}
          />
        ))}
      </div>

      {/* Sections skeleton */}
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border bg-card shadow-sm p-4"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-md" />
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
