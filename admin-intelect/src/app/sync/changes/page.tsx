"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { ChangeLogViewer } from "@/components/sync/change-log-viewer";
import { SyncLog } from "@/types";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { handleSyncError } from "@/lib/sync-utils";

export default function ChangesPage() {
  const searchParams = useSearchParams();
  const logId = searchParams.get("log");

  const [loading, setLoading] = useState(true);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [selectedLogId, setSelectedLogId] = useState<string>(logId || "");

  useEffect(() => {
    loadSyncLogs();
  }, []);

  useEffect(() => {
    if (logId && !selectedLogId) {
      setSelectedLogId(logId);
    }
  }, [logId]);

  const loadSyncLogs = async () => {
    try {
      setLoading(true);
      const response = await api.getSyncLogs(50, 0);
      setSyncLogs(response.data);

      // Auto-select first log if no log ID provided - safe array access
      if (!logId && response.data?.length > 0) {
        setSelectedLogId(response.data[0].id);
      }
    } catch (error) {
      handleSyncError(error, "Failed to load sync logs");
    } finally {
      setLoading(false);
    }
  };

  const selectedLog = syncLogs.find((log) => log.id === selectedLogId);

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Change History</h1>
          <p className="text-muted-foreground">
            View detailed field-level changes from selective sync operations
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Sync Log</CardTitle>
          <CardDescription>
            Choose a sync operation to view its change history
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center space-y-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                <p className="text-sm text-muted-foreground">Loading sync logs...</p>
              </div>
            </div>
          ) : syncLogs.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No sync logs available. Run a selective sync to see change history.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <Select value={selectedLogId} onValueChange={setSelectedLogId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a sync log..." />
                </SelectTrigger>
                <SelectContent>
                  {syncLogs.map((log) => (
                    <SelectItem key={log.id} value={log.id}>
                      <div className="flex items-center gap-2">
                        <span>
                          {new Date(log.started_at).toLocaleString()}
                        </span>
                        <Badge
                          variant={
                            log.status === "completed"
                              ? "default"
                              : log.status === "failed"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {log.status}
                        </Badge>
                        <Badge variant="outline">
                          {log.sync_type}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedLog && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-lg border bg-accent/20">
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <Badge
                      variant={
                        selectedLog.status === "completed"
                          ? "default"
                          : selectedLog.status === "failed"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {selectedLog.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Type</p>
                    <Badge variant="outline">{selectedLog.sync_type}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Duration</p>
                    <p className="text-sm font-medium">
                      {selectedLog.duration_seconds
                        ? `${selectedLog.duration_seconds}s`
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Started At</p>
                    <p className="text-sm font-medium">
                      {new Date(selectedLog.started_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {selectedLogId && <ChangeLogViewer syncLogId={selectedLogId} />}
    </div>
  );
}
