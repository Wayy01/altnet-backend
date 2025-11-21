"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChangeLogViewerProps } from "@/types/selective-sync";

/**
 * ChangeLogViewer component for displaying sync changes
 *
 * Phase 3 TODO:
 * - Fetch change summary from API
 * - Display summary statistics (total changes, by step, by type)
 * - Show "Most Changed Fields" list
 * - Add filters (by step, by change type, by entity type)
 * - Implement pagination for change details
 * - Add table view with columns: Step, Entity, Type, Fields Changed
 * - Add expandable rows to show field-level details
 * - Add "Export to CSV" button
 * - Show visual indicators (icons, colors) for change types
 * - Add search by entity ID or Ultra ID
 */
export function ChangeLogViewer({ syncLogId }: ChangeLogViewerProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Change Log</CardTitle>
        <CardDescription>
          Detailed view of all changes made during this sync
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Coming soon: Change log and detailed tracking
          </p>
          <div className="flex gap-2">
            <Button disabled variant="outline">
              Filter Changes
            </Button>
            <Button disabled variant="outline">
              Export to CSV
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
