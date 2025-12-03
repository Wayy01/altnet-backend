import { useState, useMemo, useCallback, useEffect } from "react";

interface ImageEntry {
  uuid: string;
  url: string;
  path_global?: string | null;
}

interface UseValidatedImageOptions {
  mainImageUrl?: string | null;
  images?: ImageEntry[];
  entityId?: string;
}

interface UseValidatedImageReturn {
  effectiveMainImageUrl: string | null;
  validImages: ImageEntry[];
  handleImageError: (uuid: string) => void;
  handleMainImageError: () => void;
  isMainImageFailed: boolean;
  failedImages: Set<string>;
}

/**
 * Hook for validating product images with automatic fallback logic.
 *
 * Tracks which images have failed to load and provides:
 * - Filtered list of valid (non-failed) images
 * - Effective main image URL with fallback to first valid image
 * - Error handlers for both gallery images and main image
 *
 * @example
 * const {
 *   effectiveMainImageUrl,
 *   validImages,
 *   handleImageError,
 *   handleMainImageError
 * } = useValidatedImage({
 *   mainImageUrl: product.main_image_url,
 *   images: product.images,
 *   entityId: product.id
 * });
 */
export function useValidatedImage({
  mainImageUrl,
  images = [],
  entityId,
}: UseValidatedImageOptions): UseValidatedImageReturn {
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [mainImageFailed, setMainImageFailed] = useState(false);

  // Reset when entity changes
  useEffect(() => {
    setFailedImages(new Set());
    setMainImageFailed(false);
  }, [entityId]);

  // Filter out images that failed to load
  const validImages = useMemo(() => {
    return images.filter((img) => !failedImages.has(img.uuid));
  }, [images, failedImages]);

  // Get the effective main image URL (fallback to first valid image if main fails)
  const effectiveMainImageUrl = useMemo(() => {
    if (mainImageUrl && !mainImageFailed) {
      return mainImageUrl;
    }
    // Fallback to first valid image
    if (validImages.length > 0) {
      return validImages[0].url || validImages[0].path_global || null;
    }
    return null;
  }, [mainImageUrl, mainImageFailed, validImages]);

  const handleImageError = useCallback((uuid: string) => {
    setFailedImages((prev) => new Set(prev).add(uuid));
  }, []);

  const handleMainImageError = useCallback(() => {
    setMainImageFailed(true);
  }, []);

  return {
    effectiveMainImageUrl,
    validImages,
    handleImageError,
    handleMainImageError,
    isMainImageFailed: mainImageFailed,
    failedImages,
  };
}

/**
 * Simple hook for tracking a single image's validity.
 * Useful for components that display just one image (like thumbnails).
 *
 * @example
 * const { hasError, handleError } = useSingleImageValidation();
 *
 * <Image
 *   src={hasError ? fallbackUrl : originalUrl}
 *   onError={handleError}
 * />
 */
export function useSingleImageValidation() {
  const [hasError, setHasError] = useState(false);

  const handleError = useCallback(() => {
    setHasError(true);
  }, []);

  const reset = useCallback(() => {
    setHasError(false);
  }, []);

  return { hasError, handleError, reset };
}
