"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { Package, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface ValidatedProductImageProps {
  /** Primary image source URL */
  src: string | null | undefined;
  /** Alt text for the image */
  alt: string;
  /** Fallback image URL to use if primary fails */
  fallbackSrc?: string | null;
  /** Callback when image fails to load */
  onError?: () => void;
  /** Additional className for the Image component */
  className?: string;
  /** ClassName for the container div (when showing placeholder) */
  containerClassName?: string;
  /** Use fill mode for responsive images (default: true) */
  fill?: boolean;
  /** Fixed width (only when fill=false) */
  width?: number;
  /** Fixed height (only when fill=false) */
  height?: number;
  /** Custom fallback element to show when image fails */
  fallbackIcon?: React.ReactNode;
  /** Disable Next.js image optimization (default: true for external images) */
  unoptimized?: boolean;
  /** Size preset for fallback icon */
  iconSize?: "xs" | "sm" | "md" | "lg";
}

const iconSizes = {
  xs: "h-4 w-4",
  sm: "h-6 w-6",
  md: "h-10 w-10",
  lg: "h-16 w-16",
};

/**
 * A wrapper around Next.js Image component with built-in error handling
 * and fallback support.
 *
 * When the primary image fails to load:
 * 1. If fallbackSrc is provided, tries to load that
 * 2. If fallback also fails (or not provided), shows a placeholder icon
 *
 * @example
 * <ValidatedProductImage
 *   src={product.main_image_url}
 *   alt={product.name}
 *   fallbackSrc={product.images?.[0]?.url}
 *   onError={() => handleImageError(product.id)}
 *   className="object-cover"
 * />
 */
export function ValidatedProductImage({
  src,
  alt,
  fallbackSrc,
  onError,
  className,
  containerClassName,
  fill = true,
  width,
  height,
  fallbackIcon,
  unoptimized = true,
  iconSize = "md",
}: ValidatedProductImageProps) {
  const [primaryFailed, setPrimaryFailed] = useState(false);
  const [fallbackFailed, setFallbackFailed] = useState(false);

  const handleError = useCallback(() => {
    if (!primaryFailed) {
      setPrimaryFailed(true);
      onError?.();
    } else if (fallbackSrc && !fallbackFailed) {
      setFallbackFailed(true);
    }
  }, [primaryFailed, fallbackSrc, fallbackFailed, onError]);

  // Determine which source to use
  const currentSrc = primaryFailed && fallbackSrc && !fallbackFailed ? fallbackSrc : src;

  // Show placeholder if no source or all sources failed
  const showPlaceholder = !currentSrc || (primaryFailed && (!fallbackSrc || fallbackFailed));

  if (showPlaceholder) {
    return (
      <div
        className={cn(
          "flex items-center justify-center h-full bg-muted/30",
          containerClassName
        )}
      >
        {fallbackIcon || (
          <Package
            className={cn(iconSizes[iconSize], "text-muted-foreground/50")}
          />
        )}
      </div>
    );
  }

  if (fill) {
    return (
      <Image
        src={currentSrc}
        alt={alt}
        fill
        className={cn("object-cover", className)}
        onError={handleError}
        unoptimized={unoptimized}
      />
    );
  }

  return (
    <Image
      src={currentSrc}
      alt={alt}
      width={width}
      height={height}
      className={cn("object-cover", className)}
      onError={handleError}
      unoptimized={unoptimized}
    />
  );
}

/**
 * A simpler validated image using native img tag.
 * Useful for simple cases where Next.js Image optimization isn't needed.
 *
 * @example
 * <ValidatedImg
 *   src={product.main_image_url}
 *   alt={product.name}
 *   className="h-12 w-12 rounded object-cover"
 * />
 */
export function ValidatedImg({
  src,
  alt,
  fallbackSrc,
  onError,
  className,
  containerClassName,
  fallbackIcon,
  iconSize = "sm",
}: Omit<ValidatedProductImageProps, "fill" | "width" | "height" | "unoptimized">) {
  const [primaryFailed, setPrimaryFailed] = useState(false);
  const [fallbackFailed, setFallbackFailed] = useState(false);

  const handleError = useCallback(() => {
    if (!primaryFailed) {
      setPrimaryFailed(true);
      onError?.();
    } else if (fallbackSrc && !fallbackFailed) {
      setFallbackFailed(true);
    }
  }, [primaryFailed, fallbackSrc, fallbackFailed, onError]);

  const currentSrc = primaryFailed && fallbackSrc && !fallbackFailed ? fallbackSrc : src;
  const showPlaceholder = !currentSrc || (primaryFailed && (!fallbackSrc || fallbackFailed));

  if (showPlaceholder) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted",
          containerClassName,
          className
        )}
      >
        {fallbackIcon || (
          <Package
            className={cn(iconSizes[iconSize], "text-muted-foreground/50")}
          />
        )}
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      onError={handleError}
    />
  );
}
