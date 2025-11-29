"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { loadAllTranslations, translate, TranslationNamespace } from "@/lib/i18n";

// Supported languages
export type LanguageCode = "en" | "ro" | "ru";

export interface LanguageOption {
  code: LanguageCode;
  label: string;
  nativeLabel: string;
  flag: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: "en", label: "English", nativeLabel: "English", flag: "GB" },
  { code: "ro", label: "Romanian", nativeLabel: "Romana", flag: "RO" },
  { code: "ru", label: "Russian", nativeLabel: "Русский", flag: "RU" },
];

const STORAGE_KEY = "cms-language";
const DEFAULT_LANGUAGE: LanguageCode = "en";

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  languages: LanguageOption[];
  currentLanguage: LanguageOption;
  translations: Record<string, Record<string, unknown>>;
  isLoadingTranslations: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

/**
 * Get localized value with fallback to English
 * This is a utility function that can be imported and used anywhere
 */
export function getLocalizedValue<T extends Record<string, unknown>>(
  item: T | null | undefined,
  fieldName: string,
  language: LanguageCode
): string {
  if (!item) return "";

  // For 'en', always use the base field (e.g., 'name', 'description')
  if (language === "en") {
    const value = item[fieldName];
    return typeof value === "string" ? value : "";
  }

  // For other languages, try the localized field first (e.g., 'name_ro', 'name_ru')
  const localizedField = `${fieldName}_${language}`;
  const localizedValue = item[localizedField as keyof T];

  // If localized value exists and is not empty, use it
  if (localizedValue && typeof localizedValue === "string" && localizedValue.trim() !== "") {
    return localizedValue;
  }

  // Fallback to English (base field)
  const baseValue = item[fieldName];
  return typeof baseValue === "string" ? baseValue : "";
}

/**
 * Get localized property name with fallback
 */
export function getLocalizedPropertyName<T extends Record<string, unknown>>(
  property: T | null | undefined,
  language: LanguageCode
): string {
  if (!property) return "";

  if (language === "en") {
    const value = property["property_name"];
    return typeof value === "string" ? value : "";
  }

  // Try localized field (property_name_ro, property_name_ru)
  const localizedField = `property_name_${language}`;
  const localizedValue = property[localizedField as keyof T];

  if (localizedValue && typeof localizedValue === "string" && localizedValue.trim() !== "") {
    return localizedValue;
  }

  // Fallback to English
  const baseValue = property["property_name"];
  return typeof baseValue === "string" ? baseValue : "";
}

/**
 * Get localized group name with fallback
 */
export function getLocalizedGroupName<T extends Record<string, unknown>>(
  property: T | null | undefined,
  language: LanguageCode
): string {
  if (!property) return "";

  if (language === "en") {
    const value = property["group_name"];
    return typeof value === "string" ? value : "";
  }

  // Try localized field (group_name_ro, group_name_ru)
  const localizedField = `group_name_${language}`;
  const localizedValue = property[localizedField as keyof T];

  if (localizedValue && typeof localizedValue === "string" && localizedValue.trim() !== "") {
    return localizedValue;
  }

  // Fallback to English
  const baseValue = property["group_name"];
  return typeof baseValue === "string" ? baseValue : "";
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(DEFAULT_LANGUAGE);
  const [isInitialized, setIsInitialized] = useState(false);
  const [translations, setTranslations] = useState<Record<string, Record<string, unknown>>>({});
  const [isLoadingTranslations, setIsLoadingTranslations] = useState(true);

  // Load translations when language changes
  const loadTranslations = useCallback(async (lang: LanguageCode) => {
    setIsLoadingTranslations(true);
    try {
      const loaded = await loadAllTranslations(lang);
      setTranslations(loaded);
    } catch (error) {
      console.error("Failed to load translations:", error);
    } finally {
      setIsLoadingTranslations(false);
    }
  }, []);

  // Load language from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && LANGUAGES.some((l) => l.code === stored)) {
        setLanguageState(stored as LanguageCode);
      }
      setIsInitialized(true);
    }
  }, []);

  // Load translations when language changes or on init
  useEffect(() => {
    if (isInitialized) {
      loadTranslations(language);
    }
  }, [language, isInitialized, loadTranslations]);

  // Save language to localStorage when it changes
  const setLanguage = useCallback((lang: LanguageCode) => {
    setLanguageState(lang);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, lang);
    }
  }, []);

  const currentLanguage = useMemo(
    () => LANGUAGES.find((l) => l.code === language) || LANGUAGES[0],
    [language]
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      languages: LANGUAGES,
      currentLanguage,
      translations,
      isLoadingTranslations,
    }),
    [language, setLanguage, currentLanguage, translations, isLoadingTranslations]
  );

  // Prevent hydration mismatch by not rendering until initialized
  if (!isInitialized) {
    return null;
  }

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}

/**
 * Hook for UI translations
 * Returns a t() function that translates keys from the specified namespace
 */
export function useTranslation(namespace: TranslationNamespace = "common") {
  const { language, translations } = useLanguage();

  const t = useCallback(
    (key: string, variables?: Record<string, string | number>): string => {
      return translate(translations, namespace, key, variables);
    },
    [translations, namespace]
  );

  return { t, language };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LocalizableEntity = { name?: string | null; name_ro?: string | null; name_ru?: string | null; [key: string]: any };

/**
 * Custom hook for getting localized values
 * Combines the language context with the getLocalizedValue utility
 */
export function useLocalizedValue() {
  const { language } = useLanguage();

  const localize = useCallback(
    (item: LocalizableEntity | null | undefined, fieldName: string): string => {
      return getLocalizedValue(item as Record<string, unknown>, fieldName, language);
    },
    [language]
  );

  const localizePropertyName = useCallback(
    (property: LocalizableEntity | null | undefined): string => {
      return getLocalizedPropertyName(property as Record<string, unknown>, language);
    },
    [language]
  );

  const localizeGroupName = useCallback(
    (property: LocalizableEntity | null | undefined): string => {
      return getLocalizedGroupName(property as Record<string, unknown>, language);
    },
    [language]
  );

  return {
    language,
    localize,
    localizePropertyName,
    localizeGroupName,
  };
}
