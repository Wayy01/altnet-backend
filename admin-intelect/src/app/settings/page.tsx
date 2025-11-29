"use client";

import { Settings, Server, Database, Palette } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/contexts/language-context";

export default function SettingsPage() {
  const { t } = useTranslation("settings");
  const { t: tCommon } = useTranslation("common");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("page.title")}</h1>
        <p className="text-muted-foreground">
          {t("page.description")}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* API Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-4 w-4" />
              {t("sections.apiConfiguration")}
            </CardTitle>
            <CardDescription>{t("sections.apiDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t("api.url")}</label>
              <p className="mt-1 rounded-md bg-muted p-2 font-mono text-sm">
                {process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">{t("api.status")}</label>
              <div className="mt-1">
                <Badge variant="secondary">{tCommon("status.connected")}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Database Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              {t("sections.database")}
            </CardTitle>
            <CardDescription>{t("sections.databaseDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t("database.name")}</label>
              <p className="mt-1 rounded-md bg-muted p-2 font-mono text-sm">
                ultra-data
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">{t("database.tables")}</label>
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
              {t("sections.appearance")}
            </CardTitle>
            <CardDescription>{t("sections.appearanceDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t("appearance.themeHint")}
            </p>
          </CardContent>
        </Card>

        {/* About */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              {t("sections.about")}
            </CardTitle>
            <CardDescription>{t("sections.aboutDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <label className="text-sm font-medium">{t("about.application")}</label>
              <p className="text-sm text-muted-foreground">Admin Intelect</p>
            </div>
            <div>
              <label className="text-sm font-medium">{t("about.purpose")}</label>
              <p className="text-sm text-muted-foreground">
                {t("about.purposeDescription")}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">{t("about.stack")}</label>
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
