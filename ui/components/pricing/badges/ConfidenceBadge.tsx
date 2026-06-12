"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ConfidenceBadgeProps {
  confidence: number;
}

export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  const colorClass =
    confidence >= 80
      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      : confidence >= 60
      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
      : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";

  return (
    <Badge className={cn(colorClass, "border-0")}>
      {confidence}%
    </Badge>
  );
}
