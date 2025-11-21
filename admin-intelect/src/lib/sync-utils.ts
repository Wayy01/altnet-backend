/**
 * Centralized utilities for selective sync operations
 * Provides error handling, input validation, and common functions
 */

import { toast } from "sonner";

/**
 * Maximum input lengths for validation
 */
export const INPUT_LIMITS = {
  NAME_MAX_LENGTH: 255,
  DESCRIPTION_MAX_LENGTH: 1000,
  SEARCH_MAX_LENGTH: 500,
} as const;

/**
 * Validate configuration name
 */
export function validateConfigurationName(name: string): { valid: boolean; error?: string } {
  const trimmed = name.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: "Configuration name is required" };
  }

  if (trimmed.length > INPUT_LIMITS.NAME_MAX_LENGTH) {
    return { valid: false, error: `Name must be ${INPUT_LIMITS.NAME_MAX_LENGTH} characters or less` };
  }

  return { valid: true };
}

/**
 * Validate configuration description
 */
export function validateConfigurationDescription(description: string): { valid: boolean; error?: string } {
  if (description.length > INPUT_LIMITS.DESCRIPTION_MAX_LENGTH) {
    return { valid: false, error: `Description must be ${INPUT_LIMITS.DESCRIPTION_MAX_LENGTH} characters or less` };
  }

  return { valid: true };
}

/**
 * Sanitize configuration name
 */
export function sanitizeConfigurationName(name: string): string {
  return name.trim().substring(0, INPUT_LIMITS.NAME_MAX_LENGTH);
}

/**
 * Sanitize configuration description
 */
export function sanitizeConfigurationDescription(description: string): string {
  return description.trim().substring(0, INPUT_LIMITS.DESCRIPTION_MAX_LENGTH);
}

/**
 * Centralized error handler for sync operations
 */
export function handleSyncError(error: unknown, context: string): void {
  console.error(`[${context}] Error:`, error);

  if (error instanceof Error) {
    // Parse API error messages
    const message = error.message || "An unexpected error occurred";

    if (message.includes("404")) {
      toast.error(`${context}: Resource not found`);
    } else if (message.includes("400")) {
      toast.error(`${context}: Invalid request`);
    } else if (message.includes("403")) {
      toast.error(`${context}: Access denied`);
    } else if (message.includes("500")) {
      toast.error(`${context}: Server error occurred`);
    } else if (message.includes("Network")) {
      toast.error(`${context}: Network error - please check your connection`);
    } else {
      toast.error(`${context}: ${message}`);
    }
  } else {
    toast.error(`${context}: An unexpected error occurred`);
  }
}

/**
 * Safe array access with default value
 */
export function safeArrayAccess<T>(array: T[] | undefined | null, index: number, defaultValue: T): T {
  if (!array || array.length === 0 || index < 0 || index >= array.length) {
    return defaultValue;
  }
  return array[index];
}

/**
 * Calculate progress percentage safely
 */
export function calculateProgress(completed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, (completed / total) * 100));
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(timestamp: string | null | undefined): string {
  if (!timestamp) return "Never";

  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return "Invalid date";
  }
}

/**
 * Debounce function for search inputs
 */
export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}
