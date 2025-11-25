"use client";

import { toast as sonnerToast } from "sonner";

type ToastVariant = "default" | "destructive" | "success" | "info" | "warning";

interface ToastOptions {
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

export function useToast() {
  const toast = ({ title, description, variant = "default", duration = 5000 }: ToastOptions) => {
    const message = title || description || "";
    const desc = title && description ? description : undefined;

    switch (variant) {
      case "destructive":
        sonnerToast.error(message, {
          description: desc,
          duration,
        });
        break;
      case "success":
        sonnerToast.success(message, {
          description: desc,
          duration,
        });
        break;
      case "info":
        sonnerToast.info(message, {
          description: desc,
          duration,
        });
        break;
      case "warning":
        sonnerToast.warning(message, {
          description: desc,
          duration,
        });
        break;
      default:
        sonnerToast(message, {
          description: desc,
          duration,
        });
    }
  };

  return { toast };
}
