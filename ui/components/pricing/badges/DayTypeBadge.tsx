"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const dayTypeColors: Record<string, string> = {
  weekday: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  weekend: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  holiday: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  festival: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

export function DayTypeBadge({ dayType }: { dayType: string }) {
  const key = dayType?.toLowerCase();
  const colorClass = dayTypeColors[key] ?? dayTypeColors.weekday;

  return (
    <Badge className={cn(colorClass, "border-0 text-xs")}>
      {dayType}
    </Badge>
  );
}
