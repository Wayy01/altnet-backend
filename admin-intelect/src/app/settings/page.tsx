import { Settings, Server, Database, Palette } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Application configuration and information
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* API Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-4 w-4" />
              API Configuration
            </CardTitle>
            <CardDescription>Backend API connection settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">API URL</label>
              <p className="mt-1 rounded-md bg-muted p-2 font-mono text-sm">
                {process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">Status</label>
              <div className="mt-1">
                <Badge variant="secondary">Connected</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Database Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Database
            </CardTitle>
            <CardDescription>PostgreSQL database information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Database Name</label>
              <p className="mt-1 rounded-md bg-muted p-2 font-mono text-sm">
                ultra-data
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">Tables</label>
              <div className="mt-1 flex flex-wrap gap-2">
                <Badge variant="outline">products</Badge>
                <Badge variant="outline">brands</Badge>
                <Badge variant="outline">categories</Badge>
                <Badge variant="outline">properties</Badge>
                <Badge variant="outline">characteristics</Badge>
                <Badge variant="outline">exchange_rates</Badge>
                <Badge variant="outline">sync_logs</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Theme Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Appearance
            </CardTitle>
            <CardDescription>Theme and display settings</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Use the theme toggle in the header to switch between light, dark,
              and system themes.
            </p>
          </CardContent>
        </Card>

        {/* About */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              About
            </CardTitle>
            <CardDescription>Application information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <label className="text-sm font-medium">Application</label>
              <p className="text-sm text-muted-foreground">Admin Intelect</p>
            </div>
            <div>
              <label className="text-sm font-medium">Purpose</label>
              <p className="text-sm text-muted-foreground">
                CMS Dashboard for Ultra B2B product data management
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">Stack</label>
              <div className="mt-1 flex flex-wrap gap-2">
                <Badge>Next.js 14</Badge>
                <Badge>TypeScript</Badge>
                <Badge>Tailwind CSS</Badge>
                <Badge>shadcn/ui</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
