"use client";

import { Badge } from "@/components/ui/badge";

interface Props {
  lastRun?: string;
  nextRun?: string;
  mode?: string;
}

export function AgentCycleStatusBadge({ lastRun, nextRun, mode }: Props) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {lastRun && (
        <Badge variant="outline" className="text-xs text-muted-foreground">
          Last run: {lastRun}
        </Badge>
      )}
      {nextRun && (
        <Badge variant="outline" className="text-xs text-muted-foreground">
          Next: {nextRun}
        </Badge>
      )}
      {mode && (
        <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-0 text-xs">
          {mode}
        </Badge>
      )}
    </div>
  );
}
