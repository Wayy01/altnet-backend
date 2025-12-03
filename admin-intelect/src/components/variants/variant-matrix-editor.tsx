"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { VariantMatrix } from "@/types/variants";
import { Package, Grid3X3 } from "lucide-react";
import { useTranslation } from "@/contexts/language-context";

interface VariantMatrixEditorProps {
  matrix: VariantMatrix;
  className?: string;
}

/**
 * Variant matrix editor - displays products as rows and properties as columns
 * Highlights variant properties (those that differ between products)
 */
export function VariantMatrixEditor({ matrix, className }: VariantMatrixEditorProps) {
  const { t } = useTranslation("variants");

  // Check if matrix has data
  if (!matrix.columns.length || !matrix.rows.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="p-2.5 rounded-full bg-muted/50 mb-2">
          <Grid3X3 className="h-5 w-5 text-muted-foreground/50" />
        </div>
        <p className="text-xs font-medium text-foreground">
          {t("matrix.noData")}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t("matrix.noDataDesc")}
        </p>
      </div>
    );
  }

  // Count variant columns
  const variantColumns = matrix.columns.filter((c) => c.is_variant);
  const regularColumns = matrix.columns.filter((c) => !c.is_variant);

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn("relative", className)}>
        {/* Matrix Legend - Compact */}
        <div className="px-4 py-2 border-b flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <span>{t("matrix.variantProperties", { count: variantColumns.length })}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-muted-foreground/50" />
            <span>{t("matrix.commonProperties", { count: regularColumns.length })}</span>
          </div>
        </div>

        {/* Matrix Table with Horizontal Scroll */}
        <ScrollArea className="w-full">
          <div className="min-w-max">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  {/* Product Name Column Header */}
                  <TableHead className="sticky left-0 z-20 bg-card border-r min-w-[280px]">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-semibold">{t("matrix.product")}</span>
                    </div>
                  </TableHead>

                  {/* Property Column Headers */}
                  {matrix.columns.map((column) => (
                    <TableHead
                      key={column.property_name}
                      className={cn(
                        "min-w-[140px] text-xs font-semibold",
                        column.is_variant && "bg-primary/5"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span>{column.property_name}</span>
                        {column.is_variant && (
                          <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-0">
                            {t("matrix.variant")}
                          </Badge>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground font-normal">
                        {column.values.length} {t("matrix.values")}
                      </span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>

              <TableBody>
                {matrix.rows.map((row, rowIndex) => (
                  <TableRow
                    key={row.product_id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    {/* Product Name Cell */}
                    <TableCell className="sticky left-0 z-10 bg-card border-r py-2">
                      <div>
                        <div className="font-medium text-sm">{row.product_name}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {row.product_id.slice(0, 8)}...
                        </div>
                      </div>
                    </TableCell>

                    {/* Property Value Cells */}
                    {matrix.columns.map((column) => {
                      const value = row.values[column.property_name] || "-";
                      const hasValue = value !== "-" && value !== "";

                      return (
                        <TableCell
                          key={column.property_name}
                          className={cn(
                            "min-w-[140px]",
                            column.is_variant && "bg-primary/[0.02]"
                          )}
                        >
                          {hasValue ? (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs font-normal",
                                column.is_variant
                                  ? "bg-primary/10 text-primary border-primary/20"
                                  : "bg-muted/50 text-muted-foreground border-transparent"
                              )}
                            >
                              {value}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground/40">-</span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Matrix Summary Footer */}
        <div className="px-4 py-2 border-t text-xs text-muted-foreground flex items-center justify-between">
          <span>
            {t("matrix.showing", { products: matrix.rows.length, properties: matrix.columns.length })}
          </span>
          {variantColumns.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {variantColumns.map(c => c.property_name).join(", ")}
            </Badge>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
