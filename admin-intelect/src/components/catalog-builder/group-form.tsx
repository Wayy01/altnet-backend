"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "@/contexts/language-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Loader2, Languages, Columns } from "lucide-react";
import { toast } from "sonner";
import { CatalogGroup, CatalogGroupInput } from "@/types/catalog";
import { useCreateGroup, useUpdateGroup } from "@/hooks/use-catalog";

interface GroupFormProps {
  group?: CatalogGroup;
  sectionId: string; // Required - which section this group belongs to
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function GroupForm({
  group,
  sectionId,
  open,
  onOpenChange,
  onSuccess,
}: GroupFormProps) {
  const { t } = useTranslation("catalogBuilder");
  const isEdit = !!group;
  const createGroup = useCreateGroup();
  const updateGroup = useUpdateGroup();

  // Form state
  const [nameRo, setNameRo] = useState("");
  const [nameRu, setNameRu] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [columnPosition, setColumnPosition] = useState("1");
  const [isActive, setIsActive] = useState(true);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [shakeField, setShakeField] = useState<string | null>(null);

  // Initialize form with group data when editing
  useEffect(() => {
    if (group && open) {
      setNameRo(group.name_ro);
      setNameRu(group.name_ru || "");
      setNameEn(group.name_en || "");
      setColumnPosition(group.column_position.toString());
      setIsActive(group.is_active);
      setErrors({});
      setShakeField(null);
    } else if (!group && open) {
      // Reset form for create mode
      setNameRo("");
      setNameRu("");
      setNameEn("");
      setColumnPosition("1");
      setIsActive(true);
      setErrors({});
      setShakeField(null);
    }
  }, [group, open]);

  // Handle shake animation
  useEffect(() => {
    if (shakeField) {
      const timer = setTimeout(() => setShakeField(null), 500);
      return () => clearTimeout(timer);
    }
  }, [shakeField]);

  // Validate form
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!nameRo.trim()) {
      newErrors.nameRo = t("group.required");
    }

    setErrors(newErrors);

    // Trigger shake animation on error
    if (Object.keys(newErrors).length > 0) {
      setShakeField(Object.keys(newErrors)[0]);
    }

    return Object.keys(newErrors).length === 0;
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    const data: CatalogGroupInput = {
      section_id: sectionId,
      name_ro: nameRo.trim(),
      name_ru: nameRu.trim() || undefined,
      name_en: nameEn.trim() || undefined,
      column_position: parseInt(columnPosition, 10),
      is_active: isActive,
    };

    try {
      if (isEdit) {
        await updateGroup.mutateAsync({ id: group.id, data });
      } else {
        await createGroup.mutateAsync(data);
      }

      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      // Error handling is done in the mutation hooks
      console.error("Form submission error:", error);
    }
  };

  const isSubmitting = createGroup.isPending || updateGroup.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEdit ? t("group.edit") : t("group.create")}
          </DialogTitle>
          <DialogDescription className="text-base">
            {isEdit
              ? t("group.editDescription")
              : t("group.createDescription")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-5">
            {/* Language Tabs */}
            <Tabs defaultValue="ro" className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1">
                <TabsTrigger
                  value="ro"
                  className="flex items-center gap-2 transition-all duration-200 data-[state=active]:shadow-sm"
                >
                  <Languages className="h-4 w-4" />
                  {t("languages.romanian")}
                </TabsTrigger>
                <TabsTrigger
                  value="ru"
                  className="flex items-center gap-2 transition-all duration-200 data-[state=active]:shadow-sm"
                >
                  <Languages className="h-4 w-4" />
                  {t("languages.russian")}
                </TabsTrigger>
                <TabsTrigger
                  value="en"
                  className="flex items-center gap-2 transition-all duration-200 data-[state=active]:shadow-sm"
                >
                  <Languages className="h-4 w-4" />
                  {t("languages.english")}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="ro" className="space-y-4 mt-5">
                <div className="space-y-2.5">
                  <Label htmlFor="name-ro" className="text-sm font-medium">
                    {t("group.nameRo")} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name-ro"
                    value={nameRo}
                    onChange={(e) => setNameRo(e.target.value)}
                    placeholder={t("group.namePlaceholder", { language: t("languages.romanian") })}
                    className={`transition-all duration-200 ${
                      errors.nameRo
                        ? "border-destructive focus-visible:ring-destructive"
                        : "focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary"
                    } ${shakeField === 'nameRo' ? 'animate-shake' : ''}`}
                  />
                  {errors.nameRo && (
                    <p className="text-sm text-destructive flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                      {errors.nameRo}
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="ru" className="space-y-4 mt-5">
                <div className="space-y-2.5">
                  <Label htmlFor="name-ru" className="text-sm font-medium">{t("group.nameRu")}</Label>
                  <Input
                    id="name-ru"
                    value={nameRu}
                    onChange={(e) => setNameRu(e.target.value)}
                    placeholder={t("group.namePlaceholder", { language: t("languages.russian") })}
                    className="transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary"
                  />
                  <p className="text-xs text-muted-foreground">{t("group.optionalLanguage")}</p>
                </div>
              </TabsContent>

              <TabsContent value="en" className="space-y-4 mt-5">
                <div className="space-y-2.5">
                  <Label htmlFor="name-en" className="text-sm font-medium">{t("group.nameEn")}</Label>
                  <Input
                    id="name-en"
                    value={nameEn}
                    onChange={(e) => setNameEn(e.target.value)}
                    placeholder={t("group.namePlaceholder", { language: t("languages.english") })}
                    className="transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary"
                  />
                  <p className="text-xs text-muted-foreground">{t("group.optionalLanguage")}</p>
                </div>
              </TabsContent>
            </Tabs>

            {/* Column Position */}
            <div className="space-y-2.5">
              <Label htmlFor="column-position" className="flex items-center gap-2 text-sm font-medium">
                <Columns className="h-4 w-4" />
                {t("group.columnPosition")}
              </Label>
              <Select
                value={columnPosition}
                onValueChange={setColumnPosition}
              >
                <SelectTrigger
                  id="column-position"
                  className="transition-all duration-200 hover:border-primary/50 focus:ring-2 focus:ring-primary/20"
                >
                  <SelectValue placeholder={t("group.columnPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1" className="cursor-pointer">{t("group.column", { number: "1" })}</SelectItem>
                  <SelectItem value="2" className="cursor-pointer">{t("group.column", { number: "2" })}</SelectItem>
                  <SelectItem value="3" className="cursor-pointer">{t("group.column", { number: "3" })}</SelectItem>
                  <SelectItem value="4" className="cursor-pointer">{t("group.column", { number: "4" })}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t("group.columnDescription")}
              </p>
            </div>

            {/* Is Active */}
            <div className="flex items-center justify-between rounded-lg border border-border/60 p-4 bg-muted/30 transition-all duration-200 hover:border-border hover:bg-muted/50">
              <div className="space-y-0.5">
                <Label htmlFor="is-active" className="text-base font-medium cursor-pointer">
                  {t("group.activeStatus")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("group.activeDescription")}
                </p>
              </div>
              <Switch
                id="is-active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>

            {/* Filter Config Placeholder */}
            <div className="rounded-lg border border-dashed border-muted-foreground/25 p-4 bg-muted/20 transition-all duration-200 hover:border-muted-foreground/40">
              <div className="text-sm text-muted-foreground">
                <p className="font-medium mb-1.5 text-foreground/70">{t("group.filterConfig")}</p>
                <p className="text-xs leading-relaxed">{t("group.filterConfigDescription")}</p>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-8 gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="transition-all duration-200 hover:bg-muted"
            >
              {t("actions.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="transition-all duration-200 hover:shadow-md active:scale-[0.98]"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? t("group.updateButton") : t("group.createButton")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
