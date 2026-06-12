"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePricingChangeItems } from "@/hooks/usePricingChanges";
import { ChangeDetailsTable } from "@/components/pricing/ChangeDetailsTable";
import { ServiceChangeTimeline } from "@/components/pricing/ServiceChangeTimeline";
import type { ChangeItem, ChangeBatch } from "@/lib/schemas";

interface Props {
  batchId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routeTitle?: string;
  journeyDate?: string;
}

interface BatchWithItems {
  batch: ChangeBatch;
  items: ChangeItem[];
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: "red" | "green" | "orange" | "default";
}) {
  const colorClass =
    color === "red"
      ? "text-red-600"
      : color === "green"
      ? "text-green-600"
      : color === "orange"
      ? "text-orange-500"
      : "text-foreground";

  return (
    <div className="flex flex-col items-center justify-center border rounded-lg px-4 py-2 bg-muted/30 min-w-[80px]">
      <span className={`text-xl font-bold ${colorClass}`}>{value}</span>
      <span className="text-[11px] text-muted-foreground mt-0.5">{label}</span>
    </div>
  );
}

function formatTs(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function ChangeDetailsDrawer({
  batchId,
  open,
  onOpenChange,
  routeTitle,
  journeyDate,
}: Props) {
  const [selectedItem, setSelectedItem] = useState<ChangeItem | null>(null);

  const { data, isLoading } = usePricingChangeItems(open ? batchId : null);
  const result = data as BatchWithItems | undefined;

  const batch = result?.batch;
  const items = result?.items ?? [];

  const title = [
    "Pricing Changes",
    routeTitle,
    journeyDate,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[800px] max-w-[90vw] p-0 flex flex-col"
        showCloseButton
      >
        <SheetHeader className="px-5 py-4 border-b shrink-0">
          <SheetTitle>{title}</SheetTitle>
          {batch?.createdAt && (
            <p className="text-xs text-muted-foreground">{formatTs(batch.createdAt)}</p>
          )}
        </SheetHeader>

        {/* Summary stat bar */}
        {(isLoading || batch) && (
          <div className="flex gap-3 px-5 py-3 border-b shrink-0">
            {isLoading ? (
              <>
                <Skeleton className="h-14 w-20" />
                <Skeleton className="h-14 w-20" />
                <Skeleton className="h-14 w-20" />
                <Skeleton className="h-14 w-20" />
              </>
            ) : batch ? (
              <>
                <StatCard label="Total" value={batch.changeCount} />
                <StatCard label="Decreases" value={batch.decreaseCount} color="red" />
                <StatCard label="Increases" value={batch.increaseCount} color="green" />
                <StatCard label="Failed" value={batch.failedCount} color="orange" />
              </>
            ) : null}
          </div>
        )}

        {/* Main content */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-5 py-4">
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
                No changes found for this batch.
              </div>
            ) : (
              <>
                <ChangeDetailsTable
                  items={items}
                  onRowClick={(item) =>
                    setSelectedItem(
                      selectedItem?.id === item.id ? null : item
                    )
                  }
                />
                {selectedItem && (
                  <div className="mt-6 border rounded-lg p-4 bg-muted/20">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Service Detail
                      </span>
                      <button
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => setSelectedItem(null)}
                      >
                        Close ×
                      </button>
                    </div>
                    <ServiceChangeTimeline item={selectedItem} />
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
