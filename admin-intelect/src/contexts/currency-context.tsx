"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { CurrencyCode, CurrencyOption } from "@/types";

export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { code: "MDL", label: "Moldovan Leu", symbol: "L" },
  { code: "EUR", label: "Euro", symbol: "E" },
  { code: "USD", label: "US Dollar", symbol: "$" },
];

interface CurrencyContextType {
  currency: CurrencyCode;
  setCurrency: (currency: CurrencyCode) => void;
  currencySymbol: string;
  formatPrice: (price: number | null | undefined) => string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

const STORAGE_KEY = "admin-altnet-currency";

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>("MDL");
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (stored === "MDL" || stored === "EUR" || stored === "USD")) {
      setCurrencyState(stored as CurrencyCode);
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage when currency changes
  const setCurrency = (newCurrency: CurrencyCode) => {
    setCurrencyState(newCurrency);
    localStorage.setItem(STORAGE_KEY, newCurrency);
  };

  const currencyOption = CURRENCY_OPTIONS.find((opt) => opt.code === currency);
  const currencySymbol = currencyOption?.symbol || "L";

  const formatPrice = (price: number | null | undefined): string => {
    if (price === null || price === undefined) {
      return "-";
    }
    return `${price.toLocaleString()} ${currency}`;
  };

  // Don't render until we've loaded from localStorage to avoid hydration mismatch
  if (!isLoaded) {
    return null;
  }

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        setCurrency,
        currencySymbol,
        formatPrice,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
}

// Helper function to get price by currency code
export function getPriceByCurrency(
  product: {
    price_mdl?: number | null;
    price_eur?: number | null;
    price_usd?: number | null;
    price_min?: number | null;
    price_max?: number | null;
  },
  currency: CurrencyCode
): number | null {
  switch (currency) {
    case "MDL":
      return product.price_mdl ?? product.price_min ?? null;
    case "EUR":
      return product.price_eur ?? null;
    case "USD":
      return product.price_usd ?? null;
    default:
      return product.price_mdl ?? product.price_min ?? null;
  }
}
