"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Palette, HardDrive } from "lucide-react";
import { Product } from "@/types";
import { useCurrency, getPriceByCurrency } from "@/contexts/currency-context";

interface ParsedVariant {
  id: string;
  color: string;
  memory: string;
  ram: string;
  name: string;
  product: Product;
}

interface VariantSelectorProps {
  variants: Product[];
  currentProductId: string;
}

// Common color names to match in product names (ordered by word count descending for better matching)
const KNOWN_COLORS = [
  // Three-word colors
  "Mineral Grey Blue",
  // Two-word colors
  "Jet Black",
  "Blue Shadow",
  "Silver Shadow",
  "Rose Gold",
  "Space Gray",
  "Space Grey",
  "Midnight Blue",
  "Midnight Green",
  "Pacific Blue",
  "Sierra Blue",
  "Alpine Green",
  "Deep Purple",
  "Natural Titanium",
  "Blue Titanium",
  "White Titanium",
  "Black Titanium",
  "Desert Titanium",
  "Starlight Blue",
  "Ultramarine Blue",
  "Coral Orange",
  "Ocean Blue",
  "Phantom Black",
  "Phantom White",
  "Phantom Silver",
  "Mystic Bronze",
  "Mystic Black",
  "Mystic White",
  "Cosmic Gray",
  "Cosmic Black",
  "Prism White",
  "Prism Black",
  "Aura Glow",
  "Cloud Blue",
  "Cloud Pink",
  "Cloud White",
  "Burgundy Red",
  "Forest Green",
  "Navy Blue",
  "Graphite Grey",
  "Lunar Silver",
  "Titaniu Grey",
  "Mineral Gray",
  "Mineral Grey",
  "Mint Green",
  // Single-word colors
  "Black",
  "White",
  "Silver",
  "Gold",
  "Blue",
  "Red",
  "Green",
  "Pink",
  "Purple",
  "Yellow",
  "Orange",
  "Gray",
  "Grey",
  "Bronze",
  "Coral",
  "Graphite",
  "Titanium",
  "Cream",
  "Lavender",
  "Mint",
  "Burgundy",
  "Navy",
  "Teal",
  "Brown",
  "Beige",
  "Champagne",
  "Violet",
  "Starlight",
  "Midnight",
  "Product",
];

/**
 * Parse variant information from product name
 * Examples:
 * - "Fold7 12/256Gb Jet Black" -> { memory: "256GB", ram: "12", color: "Jet Black" }
 * - "iPhone 15 Pro Max 256GB Natural Titanium" -> { memory: "256GB", color: "Natural Titanium" }
 * - "Galaxy S24 Ultra 512GB Titanium Grey" -> { memory: "512GB", color: "Titanium Grey" }
 */
function parseVariantInfo(name: string): { color: string; memory: string; ram: string } {
  let color = "Default";
  let memory = "";
  let ram = "";

  // Extract memory pattern like "12/256Gb", "16/1Tb", "256GB", "512GB", "1TB"
  // Pattern 1: RAM/Storage format (e.g., "12/256Gb", "16/1Tb")
  const ramStorageMatch = name.match(/(\d+)\/(\d+)\s*(Gb|GB|Tb|TB)/i);
  if (ramStorageMatch) {
    ram = ramStorageMatch[1];
    const storageNum = parseInt(ramStorageMatch[2]);
    const unit = ramStorageMatch[3].toUpperCase();
    memory = `${storageNum}${unit}`;
  } else {
    // Pattern 2: Just storage (e.g., "256GB", "1TB")
    const storageMatch = name.match(/(\d+)\s*(Gb|GB|Tb|TB)/i);
    if (storageMatch) {
      const storageNum = parseInt(storageMatch[1]);
      const unit = storageMatch[2].toUpperCase();
      memory = `${storageNum}${unit}`;
    }
  }

  // Try to match known colors from the product name
  const upperName = name.toUpperCase();
  for (const knownColor of KNOWN_COLORS) {
    const upperColor = knownColor.toUpperCase();
    if (upperName.includes(upperColor)) {
      color = knownColor;
      break;
    }
  }

  // If no known color found, try to extract the last word(s) as color
  if (color === "Default") {
    // Remove memory pattern from name first
    let cleanedName = name
      .replace(/\d+\/\d+\s*(Gb|GB|Tb|TB)/i, "")
      .replace(/\d+\s*(Gb|GB|Tb|TB)/i, "")
      .trim();

    // Get the last 2-3 words as potential color
    const words = cleanedName.split(/\s+/);
    if (words.length >= 2) {
      // Check if last 2 words might be a color
      const lastTwo = words.slice(-2).join(" ");
      if (lastTwo.length > 2 && !/^\d+$/.test(lastTwo)) {
        color = lastTwo;
      } else {
        const lastOne = words.slice(-1)[0];
        if (lastOne && lastOne.length > 2 && !/^\d+$/.test(lastOne)) {
          color = lastOne;
        }
      }
    } else if (words.length === 1 && words[0].length > 2) {
      color = words[0];
    }
  }

  return { color, memory, ram };
}

/**
 * Parse all variants and group by color
 */
function parseAndGroupVariants(variants: Product[]): {
  colorGroups: Map<string, ParsedVariant[]>;
  allColors: string[];
  parsedVariants: ParsedVariant[];
} {
  const parsedVariants: ParsedVariant[] = variants.map((product) => {
    const { color, memory, ram } = parseVariantInfo(product.name);
    return {
      id: product.id,
      color,
      memory,
      ram,
      name: product.name,
      product,
    };
  });

  // Group by color
  const colorGroups = new Map<string, ParsedVariant[]>();
  for (const variant of parsedVariants) {
    const existing = colorGroups.get(variant.color) || [];
    existing.push(variant);
    colorGroups.set(variant.color, existing);
  }

  // Sort memory options within each color group
  for (const [color, variants] of colorGroups) {
    variants.sort((a, b) => {
      // Extract numeric value for sorting
      const aNum = parseInt(a.memory.replace(/[^\d]/g, "")) || 0;
      const bNum = parseInt(b.memory.replace(/[^\d]/g, "")) || 0;
      // Handle TB vs GB (1TB = 1024GB)
      const aValue = a.memory.includes("TB") ? aNum * 1024 : aNum;
      const bValue = b.memory.includes("TB") ? bNum * 1024 : bNum;
      return aValue - bValue;
    });
    colorGroups.set(color, variants);
  }

  // Get all unique colors
  const allColors = Array.from(colorGroups.keys()).sort();

  return { colorGroups, allColors, parsedVariants };
}

export function VariantSelector({ variants, currentProductId }: VariantSelectorProps) {
  const { currency, formatPrice } = useCurrency();

  // Parse and group variants
  const { colorGroups, allColors, parsedVariants } = useMemo(
    () => parseAndGroupVariants(variants),
    [variants]
  );

  // Find current variant info
  const currentVariant = useMemo(
    () => parsedVariants.find((v) => v.id === currentProductId),
    [parsedVariants, currentProductId]
  );

  // State for selected color (initialize with current product's color)
  const [selectedColor, setSelectedColor] = useState<string>(
    currentVariant?.color || allColors[0] || "Default"
  );

  // Update selected color when current product changes
  useEffect(() => {
    if (currentVariant) {
      setSelectedColor(currentVariant.color);
    }
  }, [currentVariant]);

  // Get memory options for selected color
  const memoryOptions = useMemo(
    () => colorGroups.get(selectedColor) || [],
    [colorGroups, selectedColor]
  );

  // Check if we have meaningful color/memory variations
  const hasMultipleColors = allColors.length > 1;
  const hasMultipleMemoryOptions = Array.from(colorGroups.values()).some(
    (variants) => variants.length > 1
  );

  // If there's only one variant or no meaningful variations, don't show selector
  if (variants.length <= 1 || (!hasMultipleColors && !hasMultipleMemoryOptions)) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-4 w-4" />
          Product Variants
        </CardTitle>
        <CardDescription>
          Select color and storage options
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Color Selector */}
        {hasMultipleColors && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Palette className="h-3.5 w-3.5" />
              Color
            </div>
            <div className="flex flex-wrap gap-2">
              {allColors.map((color) => {
                const isSelected = color === selectedColor;
                const colorVariants = colorGroups.get(color) || [];
                const hasStock = colorVariants.some(
                  (v) => v.product.total_stock > 0
                );

                return (
                  <Button
                    key={color}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedColor(color)}
                    className="relative"
                  >
                    <span
                      className={`mr-2 h-2 w-2 rounded-full ${
                        hasStock ? "bg-green-500" : "bg-red-500"
                      }`}
                    />
                    {color}
                    {!hasStock && (
                      <Badge
                        variant="secondary"
                        className="ml-2 text-[10px] px-1 py-0"
                      >
                        Out
                      </Badge>
                    )}
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        {/* Memory/Storage Selector */}
        {memoryOptions.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <HardDrive className="h-3.5 w-3.5" />
              Storage
              {!hasMultipleColors && selectedColor !== "Default" && (
                <span className="text-xs">({selectedColor})</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {memoryOptions.map((variant) => {
                const isCurrentVariant = variant.id === currentProductId;
                const variantPrice = getPriceByCurrency(variant.product, currency);
                const hasStock = variant.product.total_stock > 0;

                // Create display label
                let displayLabel = variant.memory || "Standard";
                if (variant.ram) {
                  displayLabel = `${variant.ram}/${variant.memory}`;
                }

                return (
                  <Link key={variant.id} href={`/products/${variant.id}`}>
                    <Button
                      variant={isCurrentVariant ? "default" : "outline"}
                      size="sm"
                      className="flex flex-col items-start h-auto py-2 px-3"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            hasStock ? "bg-green-500" : "bg-red-500"
                          }`}
                        />
                        <span className="font-medium">{displayLabel}</span>
                      </div>
                      {variantPrice !== null && (
                        <span className="text-xs opacity-70 mt-0.5">
                          {formatPrice(variantPrice)}
                        </span>
                      )}
                    </Button>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Single color with multiple memory options - show color name */}
        {!hasMultipleColors && hasMultipleMemoryOptions && selectedColor !== "Default" && (
          <div className="text-xs text-muted-foreground mt-2">
            All variants in {selectedColor}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default VariantSelector;
