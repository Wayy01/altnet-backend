"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Palette,
  HardDrive,
  Cpu,
  Package,
  Check,
  ImageIcon,
  ChevronRight,
} from "lucide-react";
import { Product } from "@/types";
import { useCurrency, getPriceByCurrency } from "@/contexts/currency-context";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface VariantInfo {
  id: string;
  color: string;
  storage: string;
  ram: string;
  name: string;
  product: Product;
}

interface VariantMatrixProps {
  variants: Product[];
  currentProductId: string;
}

// ============================================================================
// Constants - Color matching patterns
// ============================================================================

const KNOWN_COLORS = [
  // Three-word colors
  "Mineral Grey Blue",
  // Two-word colors
  "Jet Black", "Blue Shadow", "Silver Shadow", "Rose Gold", "Space Gray",
  "Space Grey", "Midnight Blue", "Midnight Green", "Pacific Blue", "Sierra Blue",
  "Alpine Green", "Deep Purple", "Natural Titanium", "Blue Titanium", "White Titanium",
  "Black Titanium", "Desert Titanium", "Starlight Blue", "Ultramarine Blue",
  "Coral Orange", "Ocean Blue", "Phantom Black", "Phantom White", "Phantom Silver",
  "Mystic Bronze", "Mystic Black", "Mystic White", "Cosmic Gray", "Cosmic Black",
  "Prism White", "Prism Black", "Aura Glow", "Cloud Blue", "Cloud Pink",
  "Cloud White", "Burgundy Red", "Forest Green", "Navy Blue", "Graphite Grey",
  "Lunar Silver", "Titanium Grey", "Mineral Gray", "Mineral Grey", "Mint Green",
  // Single-word colors
  "Black", "White", "Silver", "Gold", "Blue", "Red", "Green", "Pink",
  "Purple", "Yellow", "Orange", "Gray", "Grey", "Bronze", "Coral",
  "Graphite", "Titanium", "Cream", "Lavender", "Mint", "Burgundy",
  "Navy", "Teal", "Brown", "Beige", "Champagne", "Violet", "Starlight", "Midnight",
];

// Color to CSS mapping for visual indicators
const COLOR_CSS_MAP: Record<string, string> = {
  "Black": "bg-gray-900",
  "Jet Black": "bg-gray-950",
  "White": "bg-white border border-gray-200",
  "Silver": "bg-gradient-to-br from-gray-200 to-gray-400",
  "Gold": "bg-gradient-to-br from-yellow-300 to-yellow-500",
  "Rose Gold": "bg-gradient-to-br from-pink-200 to-orange-300",
  "Blue": "bg-blue-500",
  "Red": "bg-red-500",
  "Green": "bg-green-500",
  "Pink": "bg-pink-400",
  "Purple": "bg-purple-500",
  "Deep Purple": "bg-purple-700",
  "Orange": "bg-orange-500",
  "Gray": "bg-gray-500",
  "Grey": "bg-gray-500",
  "Space Gray": "bg-gray-600",
  "Space Grey": "bg-gray-600",
  "Graphite": "bg-gray-700",
  "Graphite Grey": "bg-gray-700",
  "Titanium": "bg-gradient-to-br from-gray-300 to-gray-500",
  "Natural Titanium": "bg-gradient-to-br from-gray-200 to-gray-400",
  "Blue Titanium": "bg-gradient-to-br from-blue-400 to-gray-500",
  "Black Titanium": "bg-gradient-to-br from-gray-700 to-gray-900",
  "White Titanium": "bg-gradient-to-br from-gray-100 to-gray-300",
  "Desert Titanium": "bg-gradient-to-br from-amber-300 to-gray-400",
  "Midnight": "bg-gray-900",
  "Midnight Blue": "bg-blue-900",
  "Midnight Green": "bg-green-900",
  "Pacific Blue": "bg-blue-600",
  "Sierra Blue": "bg-sky-400",
  "Alpine Green": "bg-emerald-700",
  "Starlight": "bg-gradient-to-br from-amber-50 to-gray-200",
  "Coral": "bg-coral-500",
  "Coral Orange": "bg-orange-400",
  "Lavender": "bg-purple-300",
  "Mint": "bg-emerald-300",
  "Mint Green": "bg-emerald-400",
  "Cream": "bg-amber-100",
  "Bronze": "bg-amber-700",
  "Mystic Bronze": "bg-gradient-to-br from-amber-500 to-gray-500",
  "Phantom Black": "bg-gray-950",
  "Phantom White": "bg-gray-50 border border-gray-200",
  "Phantom Silver": "bg-gradient-to-br from-gray-100 to-gray-400",
  "Prism White": "bg-gradient-to-br from-white to-gray-100",
  "Prism Black": "bg-gradient-to-br from-gray-800 to-gray-950",
  "Cloud Blue": "bg-sky-300",
  "Cloud Pink": "bg-pink-200",
  "Cloud White": "bg-gray-50 border border-gray-200",
  "Navy": "bg-blue-900",
  "Navy Blue": "bg-blue-900",
  "Teal": "bg-teal-500",
  "Burgundy": "bg-red-900",
  "Burgundy Red": "bg-red-800",
  "Yellow": "bg-yellow-400",
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse variant information from product name (fallback method)
 * Examples:
 * - "Fold7 12/256Gb Jet Black" -> { storage: "256GB", ram: "12GB", color: "Jet Black" }
 * - "iPhone 15 Pro Max 256GB Natural Titanium" -> { storage: "256GB", color: "Natural Titanium" }
 */
function parseVariantInfoFromName(name: string): { color: string; storage: string; ram: string } {
  let color = "";
  let storage = "";
  let ram = "";

  // Pattern 1: RAM/Storage format (e.g., "12/256Gb", "16/1Tb")
  const ramStorageMatch = name.match(/(\d+)\/(\d+)\s*(Gb|GB|Tb|TB)/i);
  if (ramStorageMatch) {
    ram = `${ramStorageMatch[1]}GB`;
    const storageNum = parseInt(ramStorageMatch[2]);
    const unit = ramStorageMatch[3].toUpperCase();
    storage = `${storageNum}${unit}`;
  } else {
    // Pattern 2: Just storage (e.g., "256GB", "1TB")
    const storageMatch = name.match(/(\d+)\s*(Gb|GB|Tb|TB)/i);
    if (storageMatch) {
      const storageNum = parseInt(storageMatch[1]);
      const unit = storageMatch[2].toUpperCase();
      storage = `${storageNum}${unit}`;
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

  // If no known color found, try to extract the last words as color
  if (!color) {
    let cleanedName = name
      .replace(/\d+\/\d+\s*(Gb|GB|Tb|TB)/i, "")
      .replace(/\d+\s*(Gb|GB|Tb|TB)/i, "")
      .trim();

    const words = cleanedName.split(/\s+/);
    if (words.length >= 2) {
      const lastTwo = words.slice(-2).join(" ");
      if (lastTwo.length > 2 && !/^\d+$/.test(lastTwo)) {
        color = lastTwo;
      } else {
        const lastOne = words.slice(-1)[0];
        if (lastOne && lastOne.length > 2 && !/^\d+$/.test(lastOne)) {
          color = lastOne;
        }
      }
    }
  }

  return { color, storage, ram };
}

/**
 * Get variant information from a product.
 * First checks if variant_properties exists from the API response.
 * Falls back to parsing from product name for backwards compatibility.
 */
function getVariantInfo(product: Product): { color: string; storage: string; ram: string } {
  // Check if variant_properties exists and has values
  if (product.variant_properties) {
    const vp = product.variant_properties;
    return {
      color: vp.color?.trim() || "",
      storage: vp.storage?.trim() || "",
      ram: vp.ram?.trim() || "",
    };
  }

  // Fall back to parsing from name for backwards compatibility
  return parseVariantInfoFromName(product.name);
}

/**
 * Get CSS class for color swatch
 */
function getColorSwatchClass(color: string): string {
  return COLOR_CSS_MAP[color] || "bg-gradient-to-br from-gray-300 to-gray-500";
}

/**
 * Parse all variants and organize them
 */
function parseVariants(variants: Product[]): {
  parsed: VariantInfo[];
  colors: string[];
  storages: string[];
  rams: string[];
} {
  const parsed: VariantInfo[] = variants.map((product) => {
    const { color, storage, ram } = getVariantInfo(product);
    return {
      id: product.id,
      color,
      storage,
      ram,
      name: product.name,
      product,
    };
  });

  // Extract unique values and sort them appropriately
  const colorsSet = new Set(parsed.map((v) => v.color).filter(Boolean));
  const storagesSet = new Set(parsed.map((v) => v.storage).filter(Boolean));
  const ramsSet = new Set(parsed.map((v) => v.ram).filter(Boolean));

  const colors = Array.from(colorsSet).sort();

  // Sort storages numerically
  const storages = Array.from(storagesSet).sort((a, b) => {
    const aNum = parseInt(a.replace(/[^\d]/g, "")) || 0;
    const bNum = parseInt(b.replace(/[^\d]/g, "")) || 0;
    const aValue = a.includes("TB") ? aNum * 1024 : aNum;
    const bValue = b.includes("TB") ? bNum * 1024 : bNum;
    return aValue - bValue;
  });

  // Sort RAMs numerically
  const rams = Array.from(ramsSet).sort((a, b) => {
    const aNum = parseInt(a) || 0;
    const bNum = parseInt(b) || 0;
    return aNum - bNum;
  });

  return { parsed, colors, storages, rams };
}

// ============================================================================
// Sub-Components
// ============================================================================

interface VariantOptionButtonProps {
  variant: VariantInfo;
  isSelected: boolean;
  showImage?: boolean;
  label: string;
  subLabel?: string;
  colorSwatch?: string;
}

function VariantOptionButton({
  variant,
  isSelected,
  showImage = false,
  label,
  subLabel,
  colorSwatch,
}: VariantOptionButtonProps) {
  const { formatPrice, currency } = useCurrency();
  const price = getPriceByCurrency(variant.product, currency);
  const hasStock = variant.product.total_stock > 0;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link href={`/products/${variant.id}`}>
            <Button
              variant={isSelected ? "default" : "outline"}
              size="sm"
              className={cn(
                "relative h-auto min-w-[80px] flex-col items-start gap-1 py-2 px-3 transition-all duration-200",
                isSelected && "ring-2 ring-primary ring-offset-2",
                !hasStock && "opacity-60"
              )}
            >
              <div className="flex items-center gap-2 w-full">
                {colorSwatch && (
                  <div
                    className={cn(
                      "h-4 w-4 rounded-full shrink-0",
                      getColorSwatchClass(colorSwatch)
                    )}
                  />
                )}
                <span className="font-medium text-sm truncate">{label}</span>
                {isSelected && (
                  <Check className="h-3 w-3 shrink-0 ml-auto" />
                )}
              </div>
              {subLabel && (
                <span className="text-xs opacity-70 w-full text-left truncate">
                  {subLabel}
                </span>
              )}
              {price !== null && (
                <span className="text-xs opacity-70 w-full text-left tabular-nums">
                  {formatPrice(price)}
                </span>
              )}
              {/* Stock indicator dot */}
              <span
                className={cn(
                  "absolute top-1 right-1 h-2 w-2 rounded-full",
                  hasStock ? "bg-green-500" : "bg-red-500"
                )}
              />
            </Button>
          </Link>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[250px]">
          <div className="space-y-1">
            <p className="font-medium">{variant.name}</p>
            <p className="text-xs text-muted-foreground">
              Stock: {variant.product.total_stock} units
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface VariantRowProps {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}

function VariantRow({ icon, label, children }: VariantRowProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function VariantMatrix({ variants, currentProductId }: VariantMatrixProps) {
  const { parsed, colors, storages, rams } = useMemo(
    () => parseVariants(variants),
    [variants]
  );

  // Find current variant
  const currentVariant = useMemo(
    () => parsed.find((v) => v.id === currentProductId),
    [parsed, currentProductId]
  );

  // State for filtering - synced with current product
  const [selectedColor, setSelectedColor] = useState<string>(
    currentVariant?.color || ""
  );
  const [selectedStorage, setSelectedStorage] = useState<string>(
    currentVariant?.storage || ""
  );
  const [selectedRam, setSelectedRam] = useState<string>(
    currentVariant?.ram || ""
  );

  // Check which dimensions have multiple options
  const hasMultipleColors = colors.length > 1;
  const hasMultipleStorages = storages.length > 1;
  const hasMultipleRams = rams.length > 1;

  // If no variants or no meaningful variations, don't show
  if (
    variants.length < 1 ||
    (!hasMultipleColors && !hasMultipleStorages && !hasMultipleRams)
  ) {
    return null;
  }

  // Filter variants based on current selection
  const getFilteredVariants = useCallback(
    (dimension: "color" | "storage" | "ram") => {
      return parsed.filter((v) => {
        if (dimension === "color") {
          // Show all colors, but consider storage/ram if selected
          if (selectedStorage && v.storage !== selectedStorage && v.storage)
            return false;
          if (selectedRam && v.ram !== selectedRam && v.ram) return false;
          return v.color; // Only variants with color defined
        }
        if (dimension === "storage") {
          // Show all storages, but consider color/ram if selected
          if (selectedColor && v.color !== selectedColor && v.color)
            return false;
          if (selectedRam && v.ram !== selectedRam && v.ram) return false;
          return v.storage; // Only variants with storage defined
        }
        if (dimension === "ram") {
          // Show all RAMs, but consider color/storage if selected
          if (selectedColor && v.color !== selectedColor && v.color)
            return false;
          if (selectedStorage && v.storage !== selectedStorage && v.storage)
            return false;
          return v.ram; // Only variants with RAM defined
        }
        return true;
      });
    },
    [parsed, selectedColor, selectedStorage, selectedRam]
  );

  // Get unique options for each dimension
  const colorOptions = useMemo(() => {
    const filtered = getFilteredVariants("color");
    const uniqueColors = new Map<string, VariantInfo>();
    for (const v of filtered) {
      if (v.color && !uniqueColors.has(v.color)) {
        uniqueColors.set(v.color, v);
      }
    }
    return Array.from(uniqueColors.values());
  }, [getFilteredVariants]);

  const storageOptions = useMemo(() => {
    const filtered = getFilteredVariants("storage");
    const uniqueStorages = new Map<string, VariantInfo>();
    for (const v of filtered) {
      if (v.storage && !uniqueStorages.has(v.storage)) {
        uniqueStorages.set(v.storage, v);
      }
    }
    // Sort by storage size
    return Array.from(uniqueStorages.values()).sort((a, b) => {
      const aNum = parseInt(a.storage.replace(/[^\d]/g, "")) || 0;
      const bNum = parseInt(b.storage.replace(/[^\d]/g, "")) || 0;
      const aValue = a.storage.includes("TB") ? aNum * 1024 : aNum;
      const bValue = b.storage.includes("TB") ? bNum * 1024 : bNum;
      return aValue - bValue;
    });
  }, [getFilteredVariants]);

  const ramOptions = useMemo(() => {
    const filtered = getFilteredVariants("ram");
    const uniqueRams = new Map<string, VariantInfo>();
    for (const v of filtered) {
      if (v.ram && !uniqueRams.has(v.ram)) {
        uniqueRams.set(v.ram, v);
      }
    }
    // Sort by RAM size
    return Array.from(uniqueRams.values()).sort((a, b) => {
      const aNum = parseInt(a.ram) || 0;
      const bNum = parseInt(b.ram) || 0;
      return aNum - bNum;
    });
  }, [getFilteredVariants]);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4" />
            Product Variants
            <Badge variant="secondary" className="ml-1 font-normal">
              {variants.length} options
            </Badge>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Color Row - First */}
        {hasMultipleColors && colorOptions.length > 0 && (
          <VariantRow
            icon={<Palette className="h-3.5 w-3.5" />}
            label="Color"
          >
            {colorOptions.map((variant) => (
              <VariantOptionButton
                key={`color-${variant.id}`}
                variant={variant}
                isSelected={variant.id === currentProductId}
                label={variant.color}
                colorSwatch={variant.color}
              />
            ))}
          </VariantRow>
        )}

        {/* Storage Row - Second */}
        {hasMultipleStorages && storageOptions.length > 0 && (
          <>
            {hasMultipleColors && <Separator />}
            <VariantRow
              icon={<HardDrive className="h-3.5 w-3.5" />}
              label="Storage"
            >
              {storageOptions.map((variant) => (
                <VariantOptionButton
                  key={`storage-${variant.id}`}
                  variant={variant}
                  isSelected={variant.id === currentProductId}
                  label={variant.storage}
                />
              ))}
            </VariantRow>
          </>
        )}

        {/* RAM Row - Third */}
        {hasMultipleRams && ramOptions.length > 0 && (
          <>
            {(hasMultipleColors || hasMultipleStorages) && <Separator />}
            <VariantRow
              icon={<Cpu className="h-3.5 w-3.5" />}
              label="RAM"
            >
              {ramOptions.map((variant) => (
                <VariantOptionButton
                  key={`ram-${variant.id}`}
                  variant={variant}
                  isSelected={variant.id === currentProductId}
                  label={variant.ram}
                />
              ))}
            </VariantRow>
          </>
        )}

        {/* Current selection summary */}
        <div className="pt-2 border-t">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Selected:</span>
            <div className="flex items-center gap-1 flex-wrap">
              {currentVariant?.color && (
                <Badge variant="outline" className="text-xs gap-1">
                  <div
                    className={cn(
                      "h-2 w-2 rounded-full",
                      getColorSwatchClass(currentVariant.color)
                    )}
                  />
                  {currentVariant.color}
                </Badge>
              )}
              {currentVariant?.storage && (
                <Badge variant="outline" className="text-xs">
                  <HardDrive className="h-2.5 w-2.5 mr-1" />
                  {currentVariant.storage}
                </Badge>
              )}
              {currentVariant?.ram && (
                <Badge variant="outline" className="text-xs">
                  <Cpu className="h-2.5 w-2.5 mr-1" />
                  {currentVariant.ram}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default VariantMatrix;
