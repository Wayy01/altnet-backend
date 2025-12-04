"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  UniqueIdentifier,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft,
  Save,
  GripVertical,
  Loader2,
  Languages,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useFullCatalog,
  useReorderSections,
  useReorderGroups,
  useReorderItems,
} from "@/hooks/use-catalog";
import {
  CatalogSectionWithGroups,
  CatalogGroupWithItems,
  CatalogItemWithCategory,
} from "@/types/catalog";
import { useTranslation } from "@/contexts/language-context";

// Language configuration
type Language = "ro" | "ru" | "en";

interface LanguageConfig {
  code: Language;
  label: string;
}

// Helper function to get translated name with fallback
function getTranslatedName(
  entity: { name_ro: string; name_ru?: string | null; name_en?: string | null },
  language: Language
): string {
  if (language === "ro") return entity.name_ro;
  if (language === "ru") return entity.name_ru || entity.name_ro;
  if (language === "en") return entity.name_en || entity.name_ro;
  return entity.name_ro;
}

// Drag handle component
function DragHandle() {
  return (
    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab active:cursor-grabbing" />
  );
}

// Sortable section component (sidebar)
interface SortableSectionProps {
  section: CatalogSectionWithGroups;
  isActive: boolean;
  language: Language;
  onClick: () => void;
}

function SortableSection({
  section,
  isActive,
  language,
  onClick,
}: SortableSectionProps) {
  const { t } = useTranslation("catalogBuilder");
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : section.is_active ? 1 : 0.6,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <button
        onClick={onClick}
        className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
          isActive
            ? "bg-primary text-primary-foreground"
            : "hover:bg-muted text-foreground"
        } ${!section.is_active ? "opacity-60" : ""}`}
      >
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
          <DragHandle />
        </div>
        <span className="flex-1 text-left truncate">
          {getTranslatedName(section, language)}
        </span>
        {!section.is_active && (
          <Badge variant="secondary" className="text-xs">
            {t("states.inactive")}
          </Badge>
        )}
      </button>
    </div>
  );
}

// Sortable group component (mega-menu columns)
interface SortableGroupProps {
  group: CatalogGroupWithItems;
  language: Language;
  sensors: ReturnType<typeof useSensors>;
  onItemsReorder: (items: CatalogItemWithCategory[]) => void;
}

function SortableGroup({ group, language, sensors, onItemsReorder }: SortableGroupProps) {
  const { t } = useTranslation("catalogBuilder");
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: group.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [items, setItems] = useState(group.items);
  const [activeItemId, setActiveItemId] = useState<UniqueIdentifier | null>(null);

  useEffect(() => {
    setItems(group.items);
  }, [group.items]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveItemId(event.active.id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveItemId(null);

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);

      const newItems = arrayMove(items, oldIndex, newIndex);
      setItems(newItems);
      onItemsReorder(newItems);
    }
  };

  const activeItem = activeItemId
    ? items.find((item) => item.id === activeItemId)
    : null;

  return (
    <div ref={setNodeRef} style={style} className="flex-1 min-w-[200px] max-w-[300px]">
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-2">
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
            <DragHandle />
          </div>
          <h3 className="font-semibold text-sm border-b pb-1">
            {getTranslatedName(group, language)}
          </h3>
          {!group.is_active && (
            <Badge variant="secondary" className="text-xs">
              {t("states.inactive")}
            </Badge>
          )}
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={items} strategy={verticalListSortingStrategy}>
            <div className="space-y-1">
              {items.map((item) => (
                <SortableItem key={item.id} item={item} language={language} />
              ))}
            </div>
          </SortableContext>
          <DragOverlay>
            {activeItem ? (
              <div className="flex items-center gap-2 px-2 py-1 bg-background border rounded shadow-lg">
                <DragHandle />
                <span className="text-sm">{getTranslatedName(activeItem, language)}</span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}

// Sortable item component
interface SortableItemProps {
  item: CatalogItemWithCategory;
  language: Language;
}

function SortableItem({ item, language }: SortableItemProps) {
  const { t } = useTranslation("catalogBuilder");
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : item.is_active ? 1 : 0.5,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-2 py-1 text-sm rounded hover:bg-muted/50 transition-colors"
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <DragHandle />
      </div>
      <span className="flex-1 truncate">{getTranslatedName(item, language)}</span>
      {!item.is_active && (
        <Badge variant="outline" className="text-xs">
          {t("states.inactive")}
        </Badge>
      )}
    </div>
  );
}

// Main preview page component
export default function CatalogPreviewPage() {
  const { t } = useTranslation("catalogBuilder");
  const router = useRouter();
  const { data: catalog, isLoading, error } = useFullCatalog();
  const reorderSections = useReorderSections();
  const reorderGroups = useReorderGroups();
  const reorderItems = useReorderItems();

  const [language, setLanguage] = useState<Language>("ro");
  const [sections, setSections] = useState<CatalogSectionWithGroups[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Track changes for each level
  const [changedSections, setChangedSections] = useState<Set<string>>(new Set());
  const [changedGroups, setChangedGroups] = useState<Set<string>>(new Set());
  const [changedItems, setChangedItems] = useState<Set<string>>(new Set());

  const languages: LanguageConfig[] = useMemo(() => [
    { code: "ro", label: t("languages.ro") },
    { code: "ru", label: t("languages.ru") },
    { code: "en", label: t("languages.en") },
  ], [t]);

  // Initialize sections from catalog data
  useEffect(() => {
    if (catalog) {
      setSections(catalog);
      if (catalog.length > 0) {
        // Reset selection if current doesn't exist in new catalog
        if (!selectedSectionId || !catalog.find(s => s.id === selectedSectionId)) {
          setSelectedSectionId(catalog[0].id);
        }
      } else {
        // Clear selection if catalog is empty
        setSelectedSectionId(null);
      }
    }
  }, [catalog, selectedSectionId]);

  // Check for unsaved changes
  useEffect(() => {
    setHasUnsavedChanges(
      changedSections.size > 0 || changedGroups.size > 0 || changedItems.size > 0
    );
  }, [changedSections, changedGroups, changedItems]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const [activeSectionId, setActiveSectionId] = useState<UniqueIdentifier | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<UniqueIdentifier | null>(null);

  const selectedSection = useMemo(
    () => sections.find((s) => s.id === selectedSectionId),
    [sections, selectedSectionId]
  );

  // Group items by column position
  const groupsByColumn = useMemo(() => {
    if (!selectedSection) return {};

    const columns: Record<number, CatalogGroupWithItems[]> = {};
    selectedSection.groups.forEach((group) => {
      const col = group.column_position || 1;
      if (!columns[col]) columns[col] = [];
      columns[col].push(group);
    });

    // Sort groups within each column by sort_order
    Object.keys(columns).forEach((col) => {
      columns[parseInt(col)].sort((a, b) => a.sort_order - b.sort_order);
    });

    return columns;
  }, [selectedSection]);

  // Handle section drag end
  const handleSectionDragStart = (event: DragStartEvent) => {
    setActiveSectionId(event.active.id);
  };

  const handleSectionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveSectionId(null);

    if (over && active.id !== over.id) {
      setSections((prevSections) => {
        const oldIndex = prevSections.findIndex((s) => s.id === active.id);
        const newIndex = prevSections.findIndex((s) => s.id === over.id);
        const newSections = arrayMove(prevSections, oldIndex, newIndex);

        // Mark all reordered sections as changed
        const changed = new Set(changedSections);
        newSections.forEach((s) => changed.add(s.id));
        setChangedSections(changed);

        return newSections;
      });
    }
  };

  // Handle group drag end
  const handleGroupDragStart = (event: DragStartEvent) => {
    setActiveGroupId(event.active.id);
  };

  const handleGroupDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveGroupId(null);

    if (!selectedSection || !over || active.id === over.id) return;

    setSections((prevSections) =>
      prevSections.map((section) => {
        if (section.id !== selectedSectionId) return section;

        const oldIndex = section.groups.findIndex((g) => g.id === active.id);
        const newIndex = section.groups.findIndex((g) => g.id === over.id);
        const newGroups = arrayMove(section.groups, oldIndex, newIndex);

        // Mark all reordered groups as changed
        const changed = new Set(changedGroups);
        newGroups.forEach((g) => changed.add(g.id));
        setChangedGroups(changed);

        return { ...section, groups: newGroups };
      })
    );
  };

  // Handle items reorder within a group
  const handleItemsReorder = (groupId: string, newItems: CatalogItemWithCategory[]) => {
    setSections((prevSections) =>
      prevSections.map((section) => ({
        ...section,
        groups: section.groups.map((group) =>
          group.id === groupId ? { ...group, items: newItems } : group
        ),
      }))
    );

    // Mark items as changed
    const changed = new Set(changedItems);
    newItems.forEach((item) => changed.add(item.id));
    setChangedItems(changed);
  };

  // Save all changes
  const handleSaveAll = async () => {
    const promises: Promise<any>[] = [];

    // Save section order changes
    if (changedSections.size > 0) {
      const sectionOrders = sections.map((section, index) => ({
        id: section.id,
        sort_order: index,
      }));
      promises.push(reorderSections.mutateAsync(sectionOrders));
    }

    // Save group order changes
    if (changedGroups.size > 0) {
      const groupOrders = sections.flatMap((section) =>
        section.groups.map((group, index) => ({
          id: group.id,
          sort_order: index,
        }))
      );
      promises.push(reorderGroups.mutateAsync(groupOrders));
    }

    // Save item order changes
    if (changedItems.size > 0) {
      const itemOrders = sections.flatMap((section) =>
        section.groups.flatMap((group) =>
          group.items.map((item, index) => ({
            id: item.id,
            sort_order: index,
          }))
        )
      );
      promises.push(reorderItems.mutateAsync(itemOrders));
    }

    try {
      await Promise.all(promises);
      toast.success(t("preview.saveAllSuccess"));
      setChangedSections(new Set());
      setChangedGroups(new Set());
      setChangedItems(new Set());
    } catch (error) {
      toast.error(t("preview.saveAllError"));
      console.error("Save error:", error);
    }
  };

  const activeSection = activeSectionId
    ? sections.find((s) => s.id === activeSectionId)
    : null;

  const activeGroup = activeGroupId
    ? selectedSection?.groups.find((g) => g.id === activeGroupId)
    : null;

  const isSaving =
    reorderSections.isPending || reorderGroups.isPending || reorderItems.isPending;

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen">
        <div className="border-b p-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <div className="flex flex-1">
          <div className="w-64 border-r p-4 space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
          <div className="flex-1 p-6">
            <Skeleton className="h-full w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="p-6 max-w-md">
          <h2 className="text-lg font-semibold text-destructive mb-2">
            {t("errors.errorLoading")}
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            {error instanceof Error ? error.message : t("errors.unknownError")}
          </p>
          <Button onClick={() => router.push("/catalog-builder")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("actions.backToEditor")}
          </Button>
        </Card>
      </div>
    );
  }

  if (!catalog || catalog.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="p-6 max-w-md text-center">
          <h2 className="text-lg font-semibold mb-2">{t("empty.noSectionsFound")}</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {t("empty.noSectionsFoundDescription")}
          </p>
          <Button onClick={() => router.push("/catalog-builder")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("actions.goToEditor")}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="border-b bg-background sticky top-0 z-10">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-2xl font-bold">{t("page.previewTitle")}</h1>
            <div className="flex items-center gap-3">
              <Button variant="outline" asChild>
                <Link href="/catalog-builder">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {t("actions.backToEditor")}
                </Link>
              </Button>
              <Button
                onClick={handleSaveAll}
                disabled={!hasUnsavedChanges || isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("actions.saving")}
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {t("actions.saveAll")} {hasUnsavedChanges && `(${changedSections.size + changedGroups.size + changedItems.size})`}
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Languages className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{t("preview.language")}</span>
            <Select value={language} onValueChange={(value) => setLanguage(value as Language)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {languages.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasUnsavedChanges && (
              <Badge variant="secondary" className="ml-2">
                {t("preview.unsavedChanges")}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar - Sections */}
        <div className="w-64 border-r bg-muted/20 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-sm font-semibold text-muted-foreground mb-3">
              {t("preview.sections")}
            </h2>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleSectionDragStart}
              onDragEnd={handleSectionDragEnd}
            >
              <SortableContext items={sections} strategy={verticalListSortingStrategy}>
                <div className="space-y-1">
                  {sections.map((section) => (
                    <SortableSection
                      key={section.id}
                      section={section}
                      isActive={section.id === selectedSectionId}
                      language={language}
                      onClick={() => setSelectedSectionId(section.id)}
                    />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay>
                {activeSection ? (
                  <div className="px-3 py-2 bg-primary text-primary-foreground rounded-md shadow-lg flex items-center gap-2">
                    <DragHandle />
                    <span className="text-sm">{getTranslatedName(activeSection, language)}</span>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
        </div>

        {/* Right content - Groups and Items */}
        <div className="flex-1 overflow-y-auto bg-background">
          {selectedSection ? (
            <div className="p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold mb-2">
                  {getTranslatedName(selectedSection, language)}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t("preview.dragInstructions")}
                </p>
              </div>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleGroupDragStart}
                onDragEnd={handleGroupDragEnd}
              >
                <SortableContext
                  items={selectedSection.groups}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="flex flex-wrap gap-6">
                    {Object.entries(groupsByColumn)
                      .sort(([a], [b]) => parseInt(a) - parseInt(b))
                      .map(([column, groups]) => (
                        <div key={column} className="flex gap-6">
                          {groups.map((group) => (
                            <SortableGroup
                              key={group.id}
                              group={group}
                              language={language}
                              sensors={sensors}
                              onItemsReorder={(items) => handleItemsReorder(group.id, items)}
                            />
                          ))}
                        </div>
                      ))}
                  </div>
                </SortableContext>
                <DragOverlay>
                  {activeGroup ? (
                    <Card className="p-3 shadow-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <DragHandle />
                        <h3 className="font-semibold text-sm">
                          {getTranslatedName(activeGroup, language)}
                        </h3>
                      </div>
                    </Card>
                  ) : null}
                </DragOverlay>
              </DndContext>

              {selectedSection.groups.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <p>{t("preview.noGroupsInSection")}</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => router.push("/catalog-builder")}
                  >
                    {t("actions.addGroupsInEditor")}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>{t("empty.selectSection")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
