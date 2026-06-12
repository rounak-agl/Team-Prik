"use client";

import { Badge } from "@/components/ui/badge";
import type { ChangeItem } from "@/lib/schemas";
import { cn } from "@/lib/utils";

interface Props {
  item: ChangeItem;
}

function formatTs(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function FareCard({
  label,
  classification,
  busAdj,
  fare,
  occupancy,
  highlight,
}: {
  label: string;
  classification: string | null;
  busAdj: number | null;
  fare: number | null;
  occupancy: number | null;
  highlight?: "red" | "green";
}) {
  const borderClass =
    highlight === "green"
      ? "border-green-300 bg-green-50"
      : highlight === "red"
      ? "border-red-300 bg-red-50"
      : "border-border bg-muted/30";

  return (
    <div className={cn("rounded-lg border p-3 space-y-1.5 flex-1 min-w-0", borderClass)}>
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {label}
      </div>
      <div className="font-semibold text-sm">{classification ?? "—"}</div>
      <div className="text-xs text-muted-foreground">
        Bus Adj: <span className="font-medium text-foreground">{busAdj !== null ? `${busAdj >= 0 ? "+" : ""}${busAdj}%` : "—"}</span>
      </div>
      <div className="text-xs text-muted-foreground">
        Fare: <span className="font-medium text-foreground">{fare !== null ? `₹${fare}` : "—"}</span>
      </div>
      <div className="text-xs text-muted-foreground">
        Occupancy: <span className="font-medium text-foreground">{occupancy !== null ? `${occupancy}%` : "—"}</span>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="text-xs text-muted-foreground w-32 shrink-0">{label}</span>
      <span className="text-xs font-medium text-foreground">{value ?? "—"}</span>
    </div>
  );
}

interface TimelineStep {
  label: string;
  timestamp: string | null;
  active?: boolean;
}

function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="relative border-l border-border ml-2 space-y-4">
      {steps.map((step, i) => (
        <li key={i} className="ml-4">
          <span
            className={cn(
              "absolute -left-1.5 mt-1 flex h-3 w-3 items-center justify-center rounded-full border",
              step.active
                ? "bg-blue-500 border-blue-600"
                : "bg-muted border-border"
            )}
          />
          <div className="text-xs font-medium">{step.label}</div>
          {step.timestamp && (
            <div className="text-[10px] text-muted-foreground">{formatTs(step.timestamp)}</div>
          )}
        </li>
      ))}
    </ol>
  );
}

function writerStatusVariant(status: string | null): "default" | "secondary" | "destructive" | "outline" {
  if (!status) return "secondary";
  const s = status.toLowerCase();
  if (s === "applied") return "default";
  if (s === "failed") return "destructive";
  return "secondary";
}

export function ServiceChangeTimeline({ item }: Props) {
  const fareHighlight =
    item.afterEffectiveFare !== null && item.beforeEffectiveFare !== null
      ? item.afterEffectiveFare < item.beforeEffectiveFare
        ? "red"
        : item.afterEffectiveFare > item.beforeEffectiveFare
        ? "green"
        : undefined
      : undefined;

  const steps: TimelineStep[] = [
    ...(item.instructionUsed
      ? [{ label: `Instruction active: "${item.instructionUsed}"`, timestamp: null }]
      : []),
    { label: "Recommendation created", timestamp: item.createdAt },
    {
      label: item.appliedAt ? `Change applied` : "Change pending",
      timestamp: item.appliedAt,
      active: !!item.appliedAt,
    },
  ];

  return (
    <div className="space-y-4 py-2">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-base">{item.serviceNumber ?? "—"}</span>
          {item.serviceName && (
            <span className="text-sm text-muted-foreground">{item.serviceName}</span>
          )}
        </div>
        {item.departureTime && (
          <div className="text-xs text-muted-foreground mt-0.5">
            Departure: {item.departureTime.slice(0, 5)}
          </div>
        )}
      </div>

      {/* Before / After comparison */}
      <div className="flex items-center gap-3">
        <FareCard
          label="Before"
          classification={item.beforeClassification}
          busAdj={item.beforeBusAdjPct}
          fare={item.beforeEffectiveFare}
          occupancy={item.beforeOccupancy}
          highlight="red"
        />
        <div className="text-xl text-muted-foreground shrink-0">→</div>
        <FareCard
          label="After"
          classification={item.afterClassification}
          busAdj={item.afterBusAdjPct}
          fare={item.afterEffectiveFare}
          occupancy={item.afterOccupancy}
          highlight={fareHighlight as "green" | "red" | undefined}
        />
      </div>

      {/* Details grid */}
      <div className="space-y-1.5 border rounded-lg p-3 bg-muted/20">
        <DetailRow label="Reason" value={item.reasonToChange} />
        <DetailRow
          label="Instruction Used"
          value={item.instructionUsed ?? <span className="italic text-muted-foreground">None</span>}
        />
        <DetailRow
          label="Confidence"
          value={item.agentConfidence !== null ? `${item.agentConfidence}%` : null}
        />
        <DetailRow label="Risk Level" value={item.riskLevel} />
        <DetailRow label="Guardrail Status" value={item.guardrailStatus} />
        <DetailRow
          label="Writer Status"
          value={
            item.writerStatus ? (
              <Badge variant={writerStatusVariant(item.writerStatus)} className="text-xs h-5">
                {item.writerStatus}
              </Badge>
            ) : (
              "—"
            )
          }
        />
      </div>

      {/* Timeline */}
      <div>
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Timeline
        </div>
        <Timeline steps={steps} />
      </div>
    </div>
  );
}
