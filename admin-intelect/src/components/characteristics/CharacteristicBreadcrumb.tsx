"use client";

import Link from "next/link";
import { ChevronRight, Tag } from "lucide-react";

interface CharacteristicBreadcrumbProps {
  currentLevel: 1 | 2;
  characteristicName?: string;
}

export function CharacteristicBreadcrumb({
  currentLevel,
  characteristicName,
}: CharacteristicBreadcrumbProps) {
  return (
    <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-4">
      <Tag className="h-4 w-4" />
      <Link
        href="/characteristics"
        className={`hover:text-foreground transition-colors ${
          currentLevel === 1 ? "font-semibold text-foreground" : ""
        }`}
      >
        Characteristics
      </Link>

      {currentLevel === 2 && characteristicName && (
        <>
          <ChevronRight className="h-4 w-4" />
          <span className="font-semibold text-foreground">{characteristicName}</span>
        </>
      )}
    </nav>
  );
}
