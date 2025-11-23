import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

interface GroupingBreadcrumbProps {
  currentLevel: 1 | 2;
  groupId?: string;
  groupName?: string;
}

export function GroupingBreadcrumb({
  currentLevel,
  groupId,
  groupName,
}: GroupingBreadcrumbProps) {
  return (
    <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
      <Link
        href="/"
        className="flex items-center hover:text-foreground transition-colors"
      >
        <Home className="h-4 w-4" />
      </Link>

      <ChevronRight className="h-4 w-4" />

      {currentLevel === 1 ? (
        <span className="font-medium text-foreground">Product Groupings</span>
      ) : (
        <>
          <Link
            href="/groupings"
            className="hover:text-foreground transition-colors"
          >
            Product Groupings
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="font-medium text-foreground">
            {groupName || "Variants"}
          </span>
        </>
      )}
    </nav>
  );
}
