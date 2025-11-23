import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
}

interface GroupingStatsCardsProps {
  stats: StatCardProps[];
}

export function GroupingStatsCards({ stats }: GroupingStatsCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {stat.label}
                  </p>
                  <p className="text-2xl font-bold">
                    {typeof stat.value === "number"
                      ? stat.value.toLocaleString()
                      : stat.value}
                  </p>
                </div>
                <Icon className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
