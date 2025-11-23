"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatCard {
  label: string;
  value: number | string;
  icon?: LucideIcon;
}

interface CharacteristicStatsCardsProps {
  stats: StatCard[];
}

export function CharacteristicStatsCards({ stats }: CharacteristicStatsCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
      {stats.map((stat, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
            {stat.icon && <stat.icon className="h-4 w-4 text-muted-foreground" />}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {typeof stat.value === "number"
                ? stat.value.toLocaleString()
                : stat.value}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
