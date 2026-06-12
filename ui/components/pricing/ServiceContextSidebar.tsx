"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ClassificationBadge } from "@/components/pricing/badges/ClassificationBadge";
import { BusAdjustmentBadge } from "@/components/pricing/badges/BusAdjustmentBadge";
import { RiskBadge } from "@/components/pricing/badges/RiskBadge";
import { DayTypeBadge } from "@/components/pricing/badges/DayTypeBadge";
import { usePricingInstructions } from "@/hooks/usePricingInstructions";
import { usePricingRooms } from "@/hooks/usePricingRooms";

interface Props {
  roomId: string;
}

const MOCK_SERVICES = [
  {
    id: "s1",
    serviceNumber: "9955",
    serviceName: "HYD-VJA Express",
    departureTime: "22:30",
    seatsBooked: 24,
    totalSeats: 40,
    occDelta5m: 2,
    occDelta15m: 5,
    asp: 750,
    epk: 12.5,
    classification: "NORMAL",
    busAdj: 0,
    risk: "low",
    agentNote: "On track. No action needed.",
  },
  {
    id: "s2",
    serviceNumber: "9956",
    serviceName: "HYD-VJA Sleeper",
    departureTime: "23:00",
    seatsBooked: 18,
    totalSeats: 36,
    occDelta5m: 0,
    occDelta15m: -1,
    asp: 950,
    epk: 16.2,
    classification: "MEDIUM_DEMAND",
    busAdj: 5,
    risk: "medium",
    agentNote: "Stuck at 50% for 20 min. Consider -5% bus adj.",
  },
  {
    id: "s3",
    serviceNumber: "9957",
    serviceName: "HYD-VJA Night",
    departureTime: "00:15",
    seatsBooked: 10,
    totalSeats: 40,
    occDelta5m: -1,
    occDelta15m: -3,
    asp: 600,
    epk: 10.0,
    classification: "LOW_DEMAND",
    busAdj: -10,
    risk: "high",
    agentNote: "Dropping fast. Agent flagged for review.",
  },
  {
    id: "s4",
    serviceNumber: "9958",
    serviceName: "HYD-VJA Premium",
    departureTime: "21:45",
    seatsBooked: 36,
    totalSeats: 40,
    occDelta5m: 3,
    occDelta15m: 7,
    asp: 1200,
    epk: 20.0,
    classification: "HIGH_DEMAND",
    busAdj: 15,
    risk: "low",
    agentNote: "Strong demand. Protect EPK.",
  },
];

function OccDeltaIndicator({ delta }: { delta: number }) {
  if (delta > 0) {
    return <span className="text-green-600 text-xs font-medium">▲{delta}</span>;
  } else if (delta < 0) {
    return <span className="text-red-500 text-xs font-medium">▼{Math.abs(delta)}</span>;
  }
  return <span className="text-gray-400 text-xs">—</span>;
}

export function ServiceContextSidebar({ roomId }: Props) {
  const { data: instructionsData } = usePricingInstructions(roomId);
  const activeInstructions = (instructionsData?.instructions ?? []).filter(
    (i: { status: string }) => i.status === "active" || i.status === "used_by_agent"
  );

  return (
    <div className="flex flex-col h-full border-r bg-muted/30">
      {/* Room Context */}
      <div className="p-3 border-b space-y-2">
        <div className="font-semibold text-sm text-foreground">Hyderabad → Vijayawada</div>
        <div className="text-xs text-muted-foreground">Journey: 13 Jun 2026</div>
        <div className="flex flex-wrap gap-1 items-center">
          <DayTypeBadge dayType="Weekday" />
          <span className="text-xs text-muted-foreground">Demand: <span className="font-medium text-foreground">72</span>/100</span>
        </div>
        <div className="grid grid-cols-2 gap-1 text-xs">
          <div className="text-muted-foreground">LY Same-Day Occ</div>
          <div className="font-medium">N/A</div>
          <div className="text-muted-foreground">Last Run</div>
          <div className="font-medium">Not run yet</div>
          <div className="text-muted-foreground">Next Run</div>
          <div className="font-medium">In ~5 min</div>
        </div>
      </div>

      <Separator />

      {/* Services */}
      <div className="px-3 pt-2 pb-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Services</span>
      </div>
      <ScrollArea className="flex-1 px-2">
        <div className="space-y-2 pb-2">
          {MOCK_SERVICES.map((svc) => {
            const occPct = Math.round((svc.seatsBooked / svc.totalSeats) * 100);
            return (
              <div key={svc.id} className="rounded-md border bg-card p-2 space-y-1.5 text-xs">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-mono font-bold text-sm">{svc.serviceNumber}</span>
                  <span className="text-muted-foreground">{svc.departureTime}</span>
                </div>
                <div className="text-muted-foreground truncate">{svc.serviceName}</div>

                {/* Occupancy */}
                <div>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span>{svc.seatsBooked}/{svc.totalSeats} seats ({occPct}%)</span>
                    <span className="flex gap-1 items-center">
                      <span className="text-muted-foreground">Δ5m</span>
                      <OccDeltaIndicator delta={svc.occDelta5m} />
                      <span className="text-muted-foreground ml-1">Δ15m</span>
                      <OccDeltaIndicator delta={svc.occDelta15m} />
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-blue-500"
                      style={{ width: `${occPct}%` }}
                    />
                  </div>
                </div>

                {/* ASP / EPK */}
                <div className="flex gap-3">
                  <span><span className="text-muted-foreground">ASP</span> <span className="font-medium">₹{svc.asp}</span></span>
                  <span><span className="text-muted-foreground">EPK</span> <span className="font-medium">₹{svc.epk}</span></span>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-1">
                  <ClassificationBadge classification={svc.classification} />
                  <BusAdjustmentBadge adjustment={svc.busAdj} />
                  <RiskBadge risk={svc.risk} />
                </div>

                {/* Agent note */}
                <div className="text-muted-foreground italic truncate">{svc.agentNote}</div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Active Instructions count */}
      <Separator />
      <div className="p-3 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{activeInstructions.length}</span> active instruction{activeInstructions.length !== 1 ? "s" : ""} for this room
      </div>
    </div>
  );
}
