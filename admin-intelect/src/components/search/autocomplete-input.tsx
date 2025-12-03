"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Search, Loader2, X, Package, Sparkles } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { api } from "@/lib/api";
import { AutocompleteSuggestion } from "@/types/search";
import { Badge } from "@/components/ui/badge";
import { useTranslation, useLocalizedValue } from "@/contexts/language-context";

interface AutocompleteInputProps {
  onSelect?: (suggestion: AutocompleteSuggestion) => void;
  placeholder?: string;
  className?: string;
  onResponseTime?: (ms: number) => void;
}

/**
 * Autocomplete Input Component
 *
 * Premium, fast autocomplete search with sophisticated animations and visual polish.
 * Features:
 * - 150ms debounce with response time tracking
 * - Fixed position dropdown that escapes parent containers
 * - Premium hover states with scale and shadow effects
 * - Stock indicator badges (green for in-stock, gray for out)
 * - Keyboard navigation (arrow keys, enter, escape)
 * - Highlighted matching text with elegant mark styling
 */
export function AutocompleteInput({
  onSelect,
  placeholder = "Search products...",
  className,
  onResponseTime,
}: AutocompleteInputProps) {
  const { t } = useTranslation("search");
  const { localize } = useLocalizedValue();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isFocused, setIsFocused] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestStartTime = useRef<number>(0);

  // Debounce query to avoid excessive API calls
  const debouncedQuery = useDebounce(query, 150);

  // Update dropdown position when open
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width,
      });
    }
  }, [isOpen, suggestions]);

  // Update position on scroll/resize
  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + 8,
          left: rect.left,
          width: rect.width,
        });
      }
    };

    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen]);

  // Fetch suggestions when debounced query changes
  useEffect(() => {
    if (debouncedQuery.trim().length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    const fetchSuggestions = async () => {
      setIsLoading(true);
      requestStartTime.current = performance.now();

      try {
        const response = await api.autocomplete(debouncedQuery, 8);
        const responseTime = Math.round(performance.now() - requestStartTime.current);

        setSuggestions(response.suggestions);
        setIsOpen(response.suggestions.length > 0);
        setSelectedIndex(-1);

        if (onResponseTime) {
          onResponseTime(responseTime);
        }
      } catch (error) {
        console.error("Autocomplete error:", error);
        setSuggestions([]);
        setIsOpen(false);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSuggestions();
  }, [debouncedQuery, onResponseTime]);

  const handleSelect = useCallback(
    (suggestion: AutocompleteSuggestion) => {
      setQuery(localize(suggestion, "name"));
      setIsOpen(false);
      if (onSelect) {
        onSelect(suggestion);
      }
    },
    [onSelect, localize]
  );

  const handleClear = useCallback(() => {
    setQuery("");
    setSuggestions([]);
    setIsOpen(false);
    inputRef.current?.focus();
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSelect(suggestions[selectedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  // Highlight matching text in suggestion with premium styling
  const highlightMatch = (text: string, query: string) => {
    const parts = text.split(new RegExp(`(${query})`, "gi"));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark
              key={i}
              className="bg-primary/20 text-primary font-semibold rounded-sm px-1 py-0.5"
            >
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    );
  };

  return (
    <>
      <div ref={containerRef} className={className}>
        <div
          className="rounded-lg border shadow-sm transition-all duration-300 ease-out bg-background"
          style={{
            boxShadow: isFocused
              ? "0 0 0 3px hsl(var(--primary) / 0.1), 0 4px 6px -1px rgba(0, 0, 0, 0.1)"
              : undefined,
          }}
        >
          <div className="flex items-center px-3 relative">
            <Search className={`h-4 w-4 shrink-0 transition-all duration-300 ${
              isFocused ? "text-primary scale-110" : "text-muted-foreground"
            }`} />
            <input
              ref={inputRef}
              type="text"
              placeholder={placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={handleKeyDown}
              className="flex h-11 w-full bg-transparent px-3 py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
            <div className="flex items-center gap-1 shrink-0">
              {isLoading && (
                <div className="relative animate-in fade-in-0 zoom-in-95 duration-200">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                  <div className="absolute inset-0 blur-sm">
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary opacity-50" />
                  </div>
                </div>
              )}
              {query && !isLoading && (
                <button
                  onClick={handleClear}
                  className="p-1 rounded-full hover:bg-muted transition-all duration-200 hover:scale-110 active:scale-95"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Fixed position dropdown - escapes all parent containers */}
      {isOpen && (
        <div
          className="fixed z-[9999] max-h-[400px] overflow-y-auto rounded-lg border bg-background/98 backdrop-blur-xl text-popover-foreground shadow-2xl animate-in fade-in-0 slide-in-from-top-2 duration-200"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
          }}
        >
          {suggestions.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <Package className="h-10 w-10 text-muted-foreground/50" />
                  <div className="absolute inset-0 blur-md">
                    <Package className="h-10 w-10 text-muted-foreground/30" />
                  </div>
                </div>
                <p className="font-medium">{t("autocomplete.noResults")}</p>
                <p className="text-xs text-muted-foreground/70">{t("autocomplete.adjustSearch")}</p>
              </div>
            </div>
          ) : (
            <div className="p-2">
              {suggestions.map((suggestion, index) => {
                const isInStock = suggestion.total_stock > 0;

                return (
                  <div
                    key={suggestion.id}
                    onClick={() => handleSelect(suggestion)}
                    onKeyDown={(e) => e.key === "Enter" && handleSelect(suggestion)}
                    tabIndex={0}
                    role="option"
                    aria-selected={selectedIndex === index}
                    className={`
                      cursor-pointer px-3 py-3 rounded-lg transition-all duration-200 ease-out
                      hover:bg-accent/80 hover:scale-[1.01] hover:shadow-md
                      active:scale-[0.99]
                      ${selectedIndex === index ? "bg-accent scale-[1.01] shadow-md" : ""}
                    `}
                  >
                    <div className="flex items-center gap-3 w-full">
                      {/* Product Image with gradient placeholder */}
                      {suggestion.image_url ? (
                        <div className="relative h-12 w-12 rounded-lg overflow-hidden border bg-gradient-to-br from-muted to-muted/50 shrink-0 shadow-sm">
                          <img
                            src={suggestion.image_url}
                            alt={suggestion.name}
                            className="h-full w-full object-cover transition-transform duration-300 hover:scale-110"
                            loading="lazy"
                          />
                        </div>
                      ) : (
                        <div className="h-12 w-12 rounded-lg border bg-gradient-to-br from-muted via-muted/70 to-muted/50 flex items-center justify-center shrink-0 shadow-sm">
                          <Package className="h-6 w-6 text-muted-foreground/50" />
                        </div>
                      )}

                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate leading-tight">
                          {highlightMatch(localize(suggestion, "name"), query)}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                          {suggestion.brand_name && (
                            <span className="font-medium">{suggestion.brand_name}</span>
                          )}
                          {suggestion.category_name && (
                            <>
                              <span className="opacity-50">•</span>
                              <span className="truncate">{suggestion.category_name}</span>
                            </>
                          )}
                        </div>

                        {/* Stock Badge */}
                        {suggestion.total_stock !== undefined && (
                          <Badge
                            variant="outline"
                            className={`mt-2 text-[10px] px-2 py-0.5 font-medium ${
                              isInStock
                                ? "bg-green-500/10 text-green-700 border-green-500/20 dark:bg-green-500/20 dark:text-green-400"
                                : "bg-muted text-muted-foreground border-muted-foreground/20"
                            }`}
                          >
                            <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 ${
                              isInStock ? "bg-green-500 animate-pulse" : "bg-muted-foreground/50"
                            }`} />
                            {isInStock ? t("product.inStock", { count: suggestion.total_stock }) : t("product.outOfStock")}
                          </Badge>
                        )}
                      </div>

                      {/* Price & Type Badge */}
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {suggestion.price !== undefined && suggestion.price !== null && (
                          <span className="text-sm font-bold tabular-nums">
                            {suggestion.price.toFixed(2)} MDL
                          </span>
                        )}
                        {suggestion.product_type && (
                          <Badge
                            variant={suggestion.product_type === "main" ? "default" : "secondary"}
                            className="text-[10px] px-2 py-0.5 font-medium shadow-sm"
                          >
                            {suggestion.product_type === "main" ? (
                              <span className="flex items-center gap-1">
                                <Sparkles className="h-2.5 w-2.5" />
                                {t("product.main")}
                              </span>
                            ) : (
                              t("product.accessory")
                            )}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}
