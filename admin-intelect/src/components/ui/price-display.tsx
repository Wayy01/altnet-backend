"use client";

import { Badge } from "@/components/ui/badge";
import { useCurrency } from "@/contexts/currency-context";
import { cn } from "@/lib/utils";
import { Percent } from "lucide-react";

/**
 * Price display sizes
 */
type PriceSize = "sm" | "md" | "lg";

/**
 * Props for PriceDisplay component
 */
interface PriceDisplayProps {
  /** Original price in MDL */
  priceMdl?: number | null;
  /** Original price in EUR */
  priceEur?: number | null;
  /** Original price in USD */
  priceUsd?: number | null;
  /** Discounted price in MDL (if applicable) */
  discountedPriceMdl?: number | null;
  /** Discounted price in EUR (if applicable) */
  discountedPriceEur?: number | null;
  /** Discounted price in USD (if applicable) */
  discountedPriceUsd?: number | null;
  /** Effective discount percentage (if applicable) */
  discountPercent?: number | null;
  /** Size variant */
  size?: PriceSize;
  /** Additional CSS classes */
  className?: string;
  /** Show discount badge even if no discount */
  showZeroDiscount?: boolean;
}

/**
 * Currency symbols map
 */
const CURRENCY_SYMBOLS: Record<string, string> = {
  MDL: "MDL",
  EUR: "€",
  USD: "$",
};

/**
 * Size configuration for text and badges
 */
const SIZE_CONFIG: Record<
  PriceSize,
  {
    priceText: string;
    originalText: string;
    badgeSize: string;
    badgeIcon: string;
  }
> = {
  sm: {
    priceText: "text-sm font-semibold",
    originalText: "text-xs",
    badgeSize: "h-5 px-1.5 text-[10px]",
    badgeIcon: "h-2.5 w-2.5",
  },
  md: {
    priceText: "text-base font-semibold",
    originalText: "text-sm",
    badgeSize: "h-6 px-2 text-xs",
    badgeIcon: "h-3 w-3",
  },
  lg: {
    priceText: "text-xl font-bold",
    originalText: "text-base",
    badgeSize: "h-7 px-2.5 text-sm",
    badgeIcon: "h-3.5 w-3.5",
  },
};

/**
 * PriceDisplay Component
 *
 * A reusable component that displays product prices with support for:
 * - Multi-currency display (MDL, EUR, USD)
 * - Original and discounted prices
 * - Discount percentage badge
 * - Strikethrough for original price when discounted
 * - Multiple size variants
 */
export function PriceDisplay({
  priceMdl,
  priceEur,
  priceUsd,
  discountedPriceMdl,
  discountedPriceEur,
  discountedPriceUsd,
  discountPercent,
  size = "md",
  className,
  showZeroDiscount = false,
}: PriceDisplayProps) {
  const { currency } = useCurrency();

  // Get prices based on selected currency
  const originalPrice =
    currency === "MDL" ? priceMdl : currency === "EUR" ? priceEur : priceUsd;
  const discountedPrice =
    currency === "MDL"
      ? discountedPriceMdl
      : currency === "EUR"
      ? discountedPriceEur
      : discountedPriceUsd;

  const currencySymbol = CURRENCY_SYMBOLS[currency];
  const config = SIZE_CONFIG[size];

  // Check if there's an active discount
  const hasDiscount =
    discountedPrice !== null &&
    discountedPrice !== undefined &&
    originalPrice !== null &&
    originalPrice !== undefined &&
    discountedPrice < originalPrice;

  // If no price available
  if (
    originalPrice === null ||
    originalPrice === undefined ||
    originalPrice === 0
  ) {
    return (
      <span
        className={cn(
          "text-muted-foreground italic",
          config.originalText,
          className
        )}
      >
        N/A
      </span>
    );
  }

  // Format price with currency symbol
  const formatPrice = (price: number) => {
    return `${price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${currencySymbol}`;
  };

  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      {/* Current/Discounted Price */}
      <span
        className={cn(
          config.priceText,
          hasDiscount ? "text-emerald-600 dark:text-emerald-500" : "text-foreground"
        )}
      >
        {formatPrice(hasDiscount ? discountedPrice : originalPrice)}
      </span>

      {/* Original Price (Strikethrough) */}
      {hasDiscount && (
        <span
          className={cn(
            "line-through text-muted-foreground",
            config.originalText
          )}
        >
          {formatPrice(originalPrice)}
        </span>
      )}

      {/* Discount Badge */}
      {(hasDiscount || (showZeroDiscount && discountPercent !== null)) &&
        discountPercent !== null &&
        discountPercent !== undefined && (
          <Badge
            variant="destructive"
            className={cn(
              "font-semibold flex items-center gap-1",
              config.badgeSize,
              "bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700"
            )}
          >
            <Percent className={config.badgeIcon} />
            {discountPercent.toFixed(0)}%
          </Badge>
        )}
    </div>
  );
}
