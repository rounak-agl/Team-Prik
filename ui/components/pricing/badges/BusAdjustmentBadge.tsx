"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function BusAdjustmentBadge({ adjustment }: { adjustment: number }) {
  const colorClass =
    adjustment > 0
      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      : adjustment < 0
      ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";

  const label =
    adjustment > 0 ? `+${adjustment}%` : adjustment < 0 ? `${adjustment}%` : "0%";

  return (
    <Badge className={cn(colorClass, "border-0 text-xs font-mono")}>
      {label}
    </Badge>
  );
}
