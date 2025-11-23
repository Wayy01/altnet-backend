"use client";

import Link from "next/link";
import { ChevronRight, Database } from "lucide-react";

interface PropertyBreadcrumbProps {
  currentLevel: 1 | 2 | 3;
  groupName?: string;
  propertyName?: string;
}

export function PropertyBreadcrumb({
  currentLevel,
  groupName,
  propertyName,
}: PropertyBreadcrumbProps) {
  return (
    <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-4">
      <Database className="h-4 w-4" />
      <Link
        href="/properties"
        className={`hover:text-foreground transition-colors ${
          currentLevel === 1 ? "font-semibold text-foreground" : ""
        }`}
      >
        Properties
      </Link>

      {currentLevel >= 2 && groupName && (
        <>
          <ChevronRight className="h-4 w-4" />
          <Link
            href={`/properties/groups/${encodeURIComponent(groupName)}`}
            className={`hover:text-foreground transition-colors ${
              currentLevel === 2 ? "font-semibold text-foreground" : ""
            }`}
          >
            {groupName}
          </Link>
        </>
      )}

      {currentLevel === 3 && groupName && propertyName && (
        <>
          <ChevronRight className="h-4 w-4" />
          <span className="font-semibold text-foreground">{propertyName}</span>
        </>
      )}
    </nav>
  );
}
