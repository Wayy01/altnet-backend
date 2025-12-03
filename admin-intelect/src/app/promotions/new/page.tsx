"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Tag,
  ArrowLeft,
  Save,
  Loader2,
  ChevronRight,
  Calendar,
  Percent,
  DollarSign,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { PromotionInput } from "@/types/promotions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/language-context";

export default function NewPromotionPage() {
  const router = useRouter();
  const { t } = useTranslation("promotions");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contentVisible, setContentVisible] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed_amount">("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [priority, setPriority] = useState("1");

  // Trigger entrance animation
  useEffect(() => {
    const timer = setTimeout(() => setContentVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Validation
  const validateForm = (): string | null => {
    if (!name.trim()) {
      return t("validation.nameRequired");
    }
    if (!discountValue || isNaN(parseFloat(discountValue))) {
      return t("validation.discountValueRequired");
    }
    const valueNum = parseFloat(discountValue);
    if (discountType === "percentage" && (valueNum < 0 || valueNum > 100)) {
      return t("validation.percentageRange");
    }
    if (discountType === "fixed_amount" && valueNum < 0) {
      return t("validation.fixedAmountPositive");
    }
    if (!startDate) {
      return t("validation.startDateRequired");
    }
    if (!endDate) {
      return t("validation.endDateRequired");
    }
    if (new Date(endDate) < new Date(startDate)) {
      return t("validation.endDateAfterStart");
    }
    return null;
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: PromotionInput = {
        name: name.trim(),
        description: description.trim() || undefined,
        discount_type: discountType,
        discount_value: parseFloat(discountValue),
        start_date: startDate,
        end_date: endDate,
        is_active: isActive,
        priority: parseInt(priority, 10),
      };

      const promotion = await api.createPromotion(payload);

      toast.success(t("toast.createdSuccess"));
      router.push(`/promotions/${promotion.id}`);
    } catch (error) {
      console.error("Failed to create promotion:", error);
      toast.error(error instanceof Error ? error.message : t("toast.createFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-3 transition-all duration-500",
        contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}
    >
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link
          href="/promotions"
          className="hover:text-foreground transition-colors duration-200"
        >
          {t("detail.breadcrumb")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">{t("page.createTitle")}</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.back()}
            className="shrink-0 h-10 w-10 rounded-xl border-border/50 transition-all duration-200 hover:bg-muted hover:border-border hover:-translate-y-0.5 hover:shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border shadow-sm bg-gradient-to-br from-primary/20 to-primary/5 border-primary/20 transition-all duration-200 hover:scale-105">
              <Tag className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t("page.createTitle")}</h1>
              <p className="text-sm text-muted-foreground">
                {t("page.createDescription")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Form Card */}
      <Card className="rounded-xl border-border/50 shadow-sm overflow-hidden">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">{t("form.basicInformation")}</h3>

              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">
                  {t("form.promotionName")} <span className="text-destructive">{t("form.required")}</span>
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("form.promotionNamePlaceholder")}
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">{t("form.description")}</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("form.descriptionPlaceholder")}
                  rows={3}
                />
              </div>
            </div>

            {/* Discount Configuration */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">{t("form.discountConfiguration")}</h3>

              <div className="grid gap-4 md:grid-cols-2">
                {/* Discount Type */}
                <div className="space-y-2">
                  <Label htmlFor="discount_type">
                    {t("form.discountType")} <span className="text-destructive">{t("form.required")}</span>
                  </Label>
                  <Select
                    value={discountType}
                    onValueChange={(value: "percentage" | "fixed_amount") =>
                      setDiscountType(value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">
                        <div className="flex items-center gap-2">
                          <Percent className="h-4 w-4" />
                          {t("form.percentage")}
                        </div>
                      </SelectItem>
                      <SelectItem value="fixed_amount">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          {t("form.fixedAmount")}
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Discount Value */}
                <div className="space-y-2">
                  <Label htmlFor="discount_value">
                    {t("form.discountValue")} <span className="text-destructive">{t("form.required")}</span>
                  </Label>
                  <Input
                    id="discount_value"
                    type="number"
                    step={discountType === "percentage" ? "0.1" : "0.01"}
                    min="0"
                    max={discountType === "percentage" ? "100" : undefined}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    placeholder={
                      discountType === "percentage" ? t("form.discountValuePercentagePlaceholder") : t("form.discountValueFixedPlaceholder")
                    }
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    {discountType === "percentage"
                      ? t("form.percentageHelper")
                      : t("form.fixedAmountHelper")}
                  </p>
                </div>
              </div>
            </div>

            {/* Schedule */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {t("form.schedule")}
              </h3>

              <div className="grid gap-4 md:grid-cols-2">
                {/* Start Date */}
                <div className="space-y-2">
                  <Label htmlFor="start_date">
                    {t("form.startDate")} <span className="text-destructive">{t("form.required")}</span>
                  </Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>

                {/* End Date */}
                <div className="space-y-2">
                  <Label htmlFor="end_date">
                    {t("form.endDate")} <span className="text-destructive">{t("form.required")}</span>
                  </Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">{t("form.settings")}</h3>

              <div className="grid gap-4 md:grid-cols-2">
                {/* Priority */}
                <div className="space-y-2">
                  <Label htmlFor="priority">{t("form.priority")}</Label>
                  <Input
                    id="priority"
                    type="number"
                    min="1"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("form.priorityHelper")}
                  </p>
                </div>

                {/* Active Status */}
                <div className="space-y-2">
                  <Label htmlFor="is_active">{t("form.status")}</Label>
                  <div className="flex items-center gap-2 h-10">
                    <Switch
                      id="is_active"
                      checked={isActive}
                      onCheckedChange={setIsActive}
                    />
                    <span className="text-sm text-muted-foreground">
                      {isActive ? t("form.activeStatus") : t("form.inactiveStatus")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("form.statusHelper")}
                  </p>
                </div>
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isSubmitting}
              >
                {t("actions.cancel")}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("actions.createPromotion")}...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {t("actions.createPromotion")}
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
