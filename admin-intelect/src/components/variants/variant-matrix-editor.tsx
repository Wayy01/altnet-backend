"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { VariantMatrix } from "@/types/variants";
import { ExternalLink, Package, Sparkles, Grid3X3 } from "lucide-react";

interface VariantMatrixEditorProps {
  matrix: VariantMatrix;
  className?: string;
}

/**
 * Shopify-style variant matrix editor
 * Displays products as rows and properties as columns
 * Highlights variant properties (those that differ between products)
 */
export function VariantMatrixEditor({ matrix, className }: VariantMatrixEditorProps) {
  const router = useRouter();
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [hoveredColumn, setHoveredColumn] = useState<string | null>(null);

  // Check if matrix has data
  if (!matrix.columns.length || !matrix.rows.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
          <Grid3X3 className="h-8 w-8 text-muted-foreground/30" />
        </div>
        <p className="text-muted-foreground font-medium text-center">
          No matrix data available
        </p>
        <p className="text-sm text-muted-foreground/70 mt-1 text-center">
          The variant matrix will appear here when properties are analyzed
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
        {/* Matrix Legend */}
        <div className="flex items-center justify-between px-6 py-4 bg-muted/20 border-b border-border/50">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-primary/60" />
              <span className="text-xs text-muted-foreground">
                Variant Properties ({variantColumns.length})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-muted-foreground/30" />
              <span className="text-xs text-muted-foreground">
                Common Properties ({regularColumns.length})
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Package className="h-3.5 w-3.5" />
            {matrix.rows.length} product{matrix.rows.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Matrix Table with Horizontal Scroll */}
        <ScrollArea className="w-full">
          <div className="min-w-max">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 bg-muted/10">
                  {/* Product Name Column Header */}
                  <TableHead className="sticky left-0 z-20 bg-card border-r border-border/50 min-w-[250px]">
                    <div className="flex items-center gap-2 font-semibold">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      Product
                    </div>
                  </TableHead>

                  {/* Property Column Headers */}
                  {matrix.columns.map((column) => (
                    <TableHead
                      key={column.property_name}
                      className={cn(
                        "min-w-[150px] transition-colors duration-200",
                        column.is_variant && "bg-primary/5",
                        hoveredColumn === column.property_name && "bg-primary/10"
                      )}
                      onMouseEnter={() => setHoveredColumn(column.property_name)}
                      onMouseLeave={() => setHoveredColumn(null)}
                    >
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold truncate">
                            {column.property_name}
                          </span>
                          {column.is_variant && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge
                                  variant="default"
                                  className="h-5 px-1.5 text-[10px] bg-primary/80 hover:bg-primary"
                                >
                                  <Sparkles className="h-3 w-3 mr-0.5" />
                                  Variant
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>This property differs between products in this group</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        <Badge
                          variant="outline"
                          className="w-fit text-[10px] font-normal text-muted-foreground"
                        >
                          {column.values.length} value
                          {column.values.length !== 1 ? "s" : ""}
                        </Badge>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>

              <TableBody>
                {matrix.rows.map((row, rowIndex) => (
                  <TableRow
                    key={row.product_id}
                    className={cn(
                      "border-border/50 transition-colors duration-200 cursor-pointer",
                      hoveredRow === row.product_id && "bg-muted/40",
                      rowIndex % 2 === 0 ? "bg-card" : "bg-muted/5"
                    )}
                    onMouseEnter={() => setHoveredRow(row.product_id)}
                    onMouseLeave={() => setHoveredRow(null)}
                    onClick={() => router.push(`/products/${row.product_id}`)}
                  >
                    {/* Product Name Cell */}
                    <TableCell className="sticky left-0 z-10 bg-inherit border-r border-border/50 min-w-[250px]">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-col">
                          <span className="font-medium text-sm line-clamp-1 group-hover:text-primary transition-colors">
                            {row.product_name}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {row.product_id.slice(0, 8)}...
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "h-7 w-7 opacity-0 transition-opacity",
                            hoveredRow === row.product_id && "opacity-100"
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`/products/${row.product_id}`, "_blank");
                          }}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
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
                            "min-w-[150px] transition-colors duration-200",
                            column.is_variant && "bg-primary/[0.02]",
                            hoveredColumn === column.property_name && "bg-primary/5",
                            hoveredRow === row.product_id &&
                              hoveredColumn === column.property_name &&
                              "bg-primary/10"
                          )}
                        >
                          {hasValue ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className={cn(
                                    "px-2.5 py-1 rounded-md text-sm inline-flex items-center max-w-full",
                                    column.is_variant
                                      ? "bg-primary/10 text-primary font-medium"
                                      : "bg-muted/50 text-muted-foreground"
                                  )}
                                >
                                  <span className="truncate">{value}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-[300px] break-words">{value}</p>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-muted-foreground/40 text-sm">-</span>
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
        <div className="flex items-center justify-between px-6 py-3 bg-muted/10 border-t border-border/50">
          <div className="text-xs text-muted-foreground">
            Showing {matrix.rows.length} product{matrix.rows.length !== 1 ? "s" : ""} across{" "}
            {matrix.columns.length} propert{matrix.columns.length !== 1 ? "ies" : "y"}
          </div>
          <div className="flex items-center gap-2">
            {variantColumns.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {variantColumns.slice(0, 3).map((col) => (
                  <Badge
                    key={col.property_name}
                    variant="outline"
                    className="text-[10px] font-normal border-primary/30 text-primary"
                  >
                    {col.property_name}
                  </Badge>
                ))}
                {variantColumns.length > 3 && (
                  <Badge variant="secondary" className="text-[10px]">
                    +{variantColumns.length - 3} more
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
