"use client";

import { Badge } from "@/components/ui/badge";

const riskColors: Record<string, string> = {
  low: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export function RiskBadge({ risk }: { risk: string }) {
  const colorClass = riskColors[risk?.toLowerCase()] ?? riskColors.medium;
  return <Badge className={colorClass}>{risk}</Badge>;
}
