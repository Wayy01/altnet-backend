/**
 * Internationalization (i18n) utility module
 * Provides translation loading, caching, and string resolution
 */

import { LanguageCode } from "@/contexts/language-context";

// Translation cache to avoid re-loading files
const translationCache: Map<string, Record<string, unknown>> = new Map();

/**
 * All available translation namespaces
 */
export const NAMESPACES = [
  "common",
  "navigation",
  "dashboard",
  "products",
  "brands",
  "categories",
  "properties",
  "groupings",
  "sync",
  "settings",
  "translate",
] as const;

export type TranslationNamespace = (typeof NAMESPACES)[number];

/**
 * Build cache key for a language/namespace combo
 */
function getCacheKey(language: LanguageCode, namespace: string): string {
  return `${language}:${namespace}`;
}

/**
 * Load a single translation file
 * Uses dynamic imports for code splitting
 */
async function loadTranslationFile(
  language: LanguageCode,
  namespace: string
): Promise<Record<string, unknown>> {
  const cacheKey = getCacheKey(language, namespace);

  // Return from cache if available
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey)!;
  }

  try {
    // Dynamic import of JSON translation files
    const translations = await import(`@/locales/${language}/${namespace}.json`);
    const data = translations.default || translations;
    translationCache.set(cacheKey, data);
    return data;
  } catch (error) {
    console.warn(`Failed to load translations for ${language}/${namespace}:`, error);

    // Try to fall back to English if we're not already loading English
    if (language !== "en") {
      try {
        const fallback = await import(`@/locales/en/${namespace}.json`);
        const data = fallback.default || fallback;
        // Cache under both keys to avoid repeated fallback attempts
        translationCache.set(cacheKey, data);
        return data;
      } catch {
        console.warn(`Failed to load fallback English translations for ${namespace}`);
      }
    }

    return {};
  }
}

/**
 * Load all translation files for a language
 */
export async function loadAllTranslations(
  language: LanguageCode
): Promise<Record<string, Record<string, unknown>>> {
  const results: Record<string, Record<string, unknown>> = {};

  await Promise.all(
    NAMESPACES.map(async (namespace) => {
      results[namespace] = await loadTranslationFile(language, namespace);
    })
  );

  return results;
}

/**
 * Resolve a nested key from a translations object
 * Supports dot notation like "page.title" or "actions.save"
 */
export function resolveKey(
  translations: Record<string, unknown>,
  key: string
): string | undefined {
  const parts = key.split(".");
  let current: unknown = translations;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  if (typeof current === "string") {
    return current;
  }

  return undefined;
}

/**
 * Interpolate variables in a translation string
 * Supports {{variableName}} syntax
 */
export function interpolate(
  text: string,
  variables: Record<string, string | number>
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (key in variables) {
      return String(variables[key]);
    }
    return match; // Keep original if variable not found
  });
}

/**
 * Main translation function
 * Resolves a key from translations with fallback chain and interpolation
 */
export function translate(
  translations: Record<string, Record<string, unknown>>,
  namespace: string,
  key: string,
  variables?: Record<string, string | number>
): string {
  // Try the specific namespace first
  const namespaceTranslations = translations[namespace];
  if (namespaceTranslations) {
    const result = resolveKey(namespaceTranslations, key);
    if (result) {
      return variables ? interpolate(result, variables) : result;
    }
  }

  // Fall back to common namespace
  if (namespace !== "common") {
    const commonTranslations = translations["common"];
    if (commonTranslations) {
      const result = resolveKey(commonTranslations, key);
      if (result) {
        return variables ? interpolate(result, variables) : result;
      }
    }
  }

  // Return the key itself as last resort (helps identify missing translations)
  return key;
}

/**
 * Clear the translation cache (useful for development/hot reload)
 */
export function clearTranslationCache(): void {
  translationCache.clear();
}

/**
 * Preload translations for a specific language
 * Call this early to warm up the cache
 */
export async function preloadTranslations(language: LanguageCode): Promise<void> {
  await loadAllTranslations(language);
}
