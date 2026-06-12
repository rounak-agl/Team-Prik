"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoom } from "@/hooks/usePricingRooms";
import { format, parseISO } from "date-fns";
import { Clock, Users } from "lucide-react";
import { cn } from "@/lib/utils";

function useRoutePairs() {
  return useQuery({
    queryKey: ["route-pairs"],
    queryFn: async () => {
      const res = await fetch("/api/admin/route-pairs");
      if (!res.ok) return { pairs: [] };
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });
}

interface Props {
  roomId: string;
}

interface Service {
  serviceId: string | number;
  serviceNumber?: string;
  serviceKey?: number;
  routeName?: string;
  departureTime?: string;
  totalSeats?: number;
  bookedSeats?: number;
  availableSeats?: number;
  occupancyPct?: number;
  asp?: number;
  epk?: number;
  tripId?: number;
}

function formatTime(t?: string | null): string {
  if (!t) return "—";
  // already HH:MM:SS or HH:MM
  return t.slice(0, 5);
}

function OccBar({ pct }: { pct?: number | null }) {
  if (pct == null) return null;
  const clamped = Math.min(100, Math.max(0, pct));
  const color = clamped < 50 ? "bg-emerald-500" : clamped < 75 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${clamped}%` }} />
      </div>
      <span className="text-[10px] text-slate-400 tabular-nums w-7 text-right">{Math.round(clamped)}%</span>
    </div>
  );
}

function useServicesByDate(params: { journeyDate: string; sourceId: string; destinationId: string } | null) {
  return useQuery({
    queryKey: ["services-by-date", params],
    queryFn: async () => {
      if (!params) return { services: [] };
      const res = await fetch("/api/admin/services-by-date", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) return { services: [] };
      return res.json();
    },
    enabled: !!params,
    staleTime: 2 * 60 * 1000,
  });
}

export function ServiceContextSidebar({ roomId }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: roomData } = useRoom(roomId);
  const room = roomData?.room;
  const { data: pairsData } = useRoutePairs();

  const resolvedIds = (() => {
    if (!room) return null;
    if (room.sourceStationId && room.destinationStationId) {
      return { sourceId: String(room.sourceStationId), destinationId: String(room.destinationStationId) };
    }
    if (!pairsData?.pairs?.length) return null;
    const match = pairsData.pairs.find(
      (p: { sourceName: string; destinationName: string; sourceId: string | number; destinationId: string | number }) =>
        p.sourceName.toLowerCase().includes((room.source ?? "").toLowerCase()) &&
        p.destinationName.toLowerCase().includes((room.destination ?? "").toLowerCase())
    );
    return match ? { sourceId: String(match.sourceId), destinationId: String(match.destinationId) } : null;
  })();

  const params =
    resolvedIds && room?.journeyDate
      ? { journeyDate: room.journeyDate, ...resolvedIds }
      : null;

  const { data, isLoading } = useServicesByDate(params);
  const services: Service[] = data?.services ?? [];

  const dateLabel = room?.journeyDate
    ? (() => { try { return format(parseISO(room.journeyDate), "d MMM yyyy"); } catch { return room.journeyDate; } })()
    : "";

  return (
    <div className="flex flex-col h-full border-r border-slate-800 bg-slate-950">
      {/* Header */}
      <div className="px-3 py-3 border-b border-slate-800 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Services</span>
          {services.length > 0 && (
            <span className="text-[10px] text-slate-600">{services.length}</span>
          )}
        </div>
        {dateLabel && <div className="text-xs text-slate-400 mt-0.5">{dateLabel}</div>}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-3 rounded-lg bg-slate-900 space-y-2">
                <Skeleton className="h-4 w-20 bg-slate-800" />
                <Skeleton className="h-2 w-full bg-slate-800" />
                <Skeleton className="h-3 w-24 bg-slate-800" />
              </div>
            ))
          ) : services.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-slate-500">
              {params ? "No services found." : "Open a room to see services."}
            </div>
          ) : (
            services.map((svc) => {
              const key = String(svc.serviceId);
              const isActive = selectedId === key;

              return (
                <button
                  key={key}
                  onClick={() => setSelectedId(isActive ? null : key)}
                  className={cn(
                    "w-full text-left rounded-lg p-2.5 transition-all border",
                    isActive
                      ? "bg-indigo-950/60 border-indigo-700/50"
                      : "bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50"
                  )}
                >
                  {/* Service ID + time */}
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={cn("text-sm font-bold font-mono", isActive ? "text-indigo-300" : "text-slate-100")}>
                      {svc.serviceNumber ?? svc.serviceKey ?? svc.serviceId}
                    </span>
                    <div className="flex items-center gap-1 text-slate-400">
                      <Clock className="h-3 w-3" />
                      <span className="text-[11px] tabular-nums">{formatTime(svc.departureTime)}</span>
                    </div>
                  </div>

                  {/* Occupancy bar */}
                  <OccBar pct={svc.occupancyPct} />

                  {/* Seats + ASP */}
                  <div className="flex items-center justify-between mt-1.5">
                    <div className="flex items-center gap-1 text-slate-500">
                      <Users className="h-3 w-3" />
                      <span className="text-[10px] tabular-nums">
                        {svc.bookedSeats ?? "—"}/{svc.totalSeats ?? "—"}
                      </span>
                    </div>
                    {svc.asp != null && (
                      <span className="text-[10px] text-slate-400 tabular-nums">₹{Math.round(svc.asp)}</span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
