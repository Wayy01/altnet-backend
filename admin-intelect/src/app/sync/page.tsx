import { RefreshCw, Clock, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Placeholder data for sync logs - backend should provide this
const syncLogs = [
  {
    id: "1",
    sync_type: "Full Sync",
    status: "completed",
    items_synced: 48316,
    duration_ms: 2156000,
    error_message: null,
    created_at: new Date().toISOString(),
  },
  {
    id: "2",
    sync_type: "Properties",
    status: "completed",
    items_synced: 876081,
    duration_ms: 2100000,
    error_message: null,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "3",
    sync_type: "Prices",
    status: "completed",
    items_synced: 36682,
    duration_ms: 45000,
    error_message: null,
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: "4",
    sync_type: "Stock",
    status: "completed",
    items_synced: 15488,
    duration_ms: 32000,
    error_message: null,
    created_at: new Date(Date.now() - 10800000).toISOString(),
  },
];

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString();
}

export default function SyncPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Sync Status</h1>
        <p className="text-muted-foreground">
          View synchronization history and status
        </p>
      </div>

      {/* Sync Steps Info */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Step 1-2</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">Brands & Categories</div>
            <p className="text-xs text-muted-foreground">
              Initial catalog structure
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Step 3</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">Products</div>
            <p className="text-xs text-muted-foreground">
              Full product catalog with variants
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Step 4</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">Properties</div>
            <p className="text-xs text-muted-foreground">
              ~35 min for 418 categories
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Step 5-7</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">Prices & Stock</div>
            <p className="text-xs text-muted-foreground">
              Pricing and inventory updates
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sync History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Recent Sync History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Items Synced</TableHead>
                <TableHead className="text-right">Duration</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {syncLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-medium">{log.sync_type}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        log.status === "completed" ? "default" : "destructive"
                      }
                      className="flex w-fit items-center gap-1"
                    >
                      {log.status === "completed" ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <XCircle className="h-3 w-3" />
                      )}
                      {log.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {log.items_synced.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="flex items-center justify-end gap-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      {formatDuration(log.duration_ms)}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(log.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <p className="mt-4 text-sm text-muted-foreground">
            Note: This is placeholder data. Connect to the Go backend to view
            actual sync logs from the sync_logs table.
          </p>
        </CardContent>
      </Card>

      {/* Commands Info */}
      <Card>
        <CardHeader>
          <CardTitle>Sync Commands</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Run sync operations from the terminal:
          </p>
          <div className="space-y-2">
            <code className="block rounded bg-muted p-3 text-sm">
              go run cmd/sync/main.go
            </code>
            <p className="text-xs text-muted-foreground">
              Runs the full sync process (all 7 steps)
            </p>
          </div>
          <div className="space-y-2">
            <code className="block rounded bg-muted p-3 text-sm">
              make status
            </code>
            <p className="text-xs text-muted-foreground">
              Check last sync runs
            </p>
          </div>
          <div className="space-y-2">
            <code className="block rounded bg-muted p-3 text-sm">
              make stats
            </code>
            <p className="text-xs text-muted-foreground">
              View database statistics
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
