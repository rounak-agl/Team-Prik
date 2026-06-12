"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const classificationColors: Record<string, string> = {
  LOW_DEMAND: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  NORMAL: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  MEDIUM_DEMAND: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  HIGH_DEMAND: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  SUPER_HIGH: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  FESTIVE: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  SPECIAL_HIGH: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

export function ClassificationBadge({ classification }: { classification: string }) {
  const colorClass =
    classificationColors[classification?.toUpperCase()] ??
    classificationColors.NORMAL;

  return (
    <Badge className={cn(colorClass, "border-0 text-xs")}>
      {classification}
    </Badge>
  );
}
