import { useState, useEffect } from "react";

/**
 * Debounce Hook
 *
 * Delays updating a value until after a specified delay has passed
 * since the last time the value changed. Useful for optimizing
 * expensive operations like API calls triggered by user input.
 *
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 150ms)
 * @returns The debounced value
 *
 * @example
 * const [searchQuery, setSearchQuery] = useState('');
 * const debouncedQuery = useDebounce(searchQuery, 300);
 *
 * useEffect(() => {
 *   // Only runs after user stops typing for 300ms
 *   if (debouncedQuery) {
 *     fetchSearchResults(debouncedQuery);
 *   }
 * }, [debouncedQuery]);
 */
export function useDebounce<T>(value: T, delay: number = 150): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Set up the timeout to update debounced value
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Clean up the timeout if value changes before delay expires
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
