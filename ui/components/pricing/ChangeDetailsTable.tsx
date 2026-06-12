"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ChangeItem } from "@/lib/schemas";
import { cn } from "@/lib/utils";

interface Props {
  items: ChangeItem[];
  onRowClick?: (item: ChangeItem) => void;
}

type SortKey = keyof ChangeItem;
type SortDir = "asc" | "desc";

function writerStatusBadge(status: string | null) {
  if (!status) return <Badge variant="secondary">—</Badge>;
  const lower = status.toLowerCase();
  if (lower === "applied")
    return <Badge className="bg-green-100 text-green-800 border-green-200">{status}</Badge>;
  if (lower === "failed")
    return <Badge className="bg-red-100 text-red-800 border-red-200">{status}</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}

function formatAdj(pct: number | null) {
  if (pct === null || pct === undefined) return "";
  return `${pct >= 0 ? "+" : ""}${pct}%`;
}

function classificationAdj(classification: string | null, adj: number | null) {
  const cls = classification ?? "—";
  if (adj === null || adj === undefined) return cls;
  return `${cls}, ${formatAdj(adj)}`;
}

function fareDiff(before: number | null, after: number | null) {
  if (before === null || after === null) return null;
  return after - before;
}

function ColHeader({
  label,
  sortKey,
  current,
  dir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey | null;
  dir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  const active = current === sortKey;
  return (
    <th
      className="px-3 py-2 text-left text-xs font-medium text-muted-foreground cursor-pointer select-none whitespace-nowrap hover:text-foreground"
      onClick={() => onSort(sortKey)}
    >
      {label}
      {active && (
        <span className="ml-1 text-[10px]">{dir === "asc" ? "↑" : "↓"}</span>
      )}
    </th>
  );
}

export function ChangeDetailsTable({ items, onRowClick }: Props) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = (k: SortKey) => {
    if (sortKey === k) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  const sorted = [...items].sort((a, b) => {
    if (!sortKey) return 0;
    const av = a[sortKey];
    const bv = b[sortKey];
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === "asc" ? cmp : -cmp;
  });

  const colProps = {
    current: sortKey,
    dir: sortDir,
    onSort: handleSort,
  };

  return (
    <TooltipProvider>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="border-b">
            <tr>
              <ColHeader label="Service #" sortKey="serviceNumber" {...colProps} />
              <ColHeader label="Departure" sortKey="departureTime" {...colProps} />
              <ColHeader label="Before" sortKey="beforeClassification" {...colProps} />
              <ColHeader label="Changed To" sortKey="afterClassification" {...colProps} />
              <ColHeader label="Fare Before" sortKey="beforeEffectiveFare" {...colProps} />
              <ColHeader label="Fare After" sortKey="afterEffectiveFare" {...colProps} />
              <ColHeader label="Reason" sortKey="reasonToChange" {...colProps} />
              <ColHeader label="Instruction" sortKey="instructionUsed" {...colProps} />
              <ColHeader label="Status" sortKey="writerStatus" {...colProps} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((item) => {
              const diff = fareDiff(item.beforeEffectiveFare, item.afterEffectiveFare);
              const reason = item.reasonToChange ?? "";
              const truncated = reason.length > 60 ? reason.slice(0, 60) + "…" : reason;

              return (
                <tr
                  key={item.id}
                  className={cn(
                    "border-b hover:bg-muted/50 transition-colors",
                    onRowClick && "cursor-pointer"
                  )}
                  onClick={() => onRowClick?.(item)}
                >
                  {/* Service # */}
                  <td className="px-3 py-2 font-mono font-bold text-xs whitespace-nowrap">
                    {item.serviceNumber ?? "—"}
                  </td>

                  {/* Departure */}
                  <td className="px-3 py-2 text-xs whitespace-nowrap">
                    {item.departureTime
                      ? item.departureTime.slice(0, 5)
                      : "—"}
                  </td>

                  {/* Before */}
                  <td className="px-3 py-2 text-xs whitespace-nowrap">
                    {classificationAdj(item.beforeClassification, item.beforeBusAdjPct)}
                  </td>

                  {/* Changed To */}
                  <td className="px-3 py-2 text-xs whitespace-nowrap">
                    {classificationAdj(item.afterClassification, item.afterBusAdjPct)}
                  </td>

                  {/* Fare Before */}
                  <td className="px-3 py-2 text-xs whitespace-nowrap">
                    {item.beforeEffectiveFare !== null
                      ? `₹${item.beforeEffectiveFare}`
                      : "—"}
                  </td>

                  {/* Fare After */}
                  <td className="px-3 py-2 text-xs whitespace-nowrap">
                    <span>
                      {item.afterEffectiveFare !== null
                        ? `₹${item.afterEffectiveFare}`
                        : "—"}
                    </span>
                    {diff !== null && diff !== 0 && (
                      <span
                        className={cn(
                          "ml-1 text-[10px] font-medium",
                          diff > 0 ? "text-green-600" : "text-red-600"
                        )}
                      >
                        ({diff > 0 ? "+" : ""}{diff}%)
                      </span>
                    )}
                  </td>

                  {/* Reason */}
                  <td className="px-3 py-2 text-xs max-w-[180px]">
                    {reason.length > 60 ? (
                      <Tooltip>
                        <TooltipTrigger>
                          <span className="cursor-default">{truncated}</span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">{reason}</TooltipContent>
                      </Tooltip>
                    ) : (
                      <span>{reason || "—"}</span>
                    )}
                  </td>

                  {/* Instruction */}
                  <td className="px-3 py-2 text-xs italic text-muted-foreground whitespace-nowrap">
                    {item.instructionUsed ?? "None"}
                  </td>

                  {/* Status */}
                  <td className="px-3 py-2 text-xs">
                    {writerStatusBadge(item.writerStatus)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </TooltipProvider>
  );
}
