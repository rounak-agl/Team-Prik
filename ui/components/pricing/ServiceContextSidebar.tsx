"use client";

import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoom } from "@/hooks/usePricingRooms";
import { useTripsByDate } from "@/hooks/useTripsByDate";
import { format, parseISO } from "date-fns";
import { Clock, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  roomId: string;
}

interface Trip {
  tripid: string | number;
  servicenumber: string;
  routename?: string;
  vehicletype?: string;
  availableseats?: number;
  totalseats?: number;
  minseatfare?: number;
  maxseatfare?: number;
  boardingtime?: string;
  droppingtime?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

function formatTime(iso?: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso.slice(0, 5);
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return "—";
  }
}

function OccBar({ available, total }: { available?: number; total?: number }) {
  if (!total || total === 0) return null;
  const pct = Math.round(((total - (available ?? 0)) / total) * 100);
  const color = pct < 50 ? "bg-emerald-500" : pct < 75 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-slate-400 tabular-nums w-7 text-right">{pct}%</span>
    </div>
  );
}

export function ServiceContextSidebar({ roomId }: Props) {
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const { data: roomData } = useRoom(roomId);
  const room = roomData?.room;

  const tripParams =
    room?.sourceStationId && room?.destinationStationId && room?.journeyDate
      ? {
          journeyDate: room.journeyDate,
          sourceId: String(room.sourceStationId),
          destinationId: String(room.destinationStationId),
        }
      : null;

  const { data: tripsData, isLoading: tripsLoading } = useTripsByDate(tripParams);
  const trips: Trip[] = tripsData?.trips ?? [];

  const dateLabel = room?.journeyDate
    ? (() => {
        try {
          return format(parseISO(room.journeyDate), "d MMM yyyy");
        } catch {
          return room.journeyDate;
        }
      })()
    : "";

  return (
    <div className="flex flex-col h-full border-r border-slate-800 bg-slate-950">
      {/* Header */}
      <div className="px-3 py-3 border-b border-slate-800 shrink-0">
        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-0.5">
          Services
        </div>
        {dateLabel && <div className="text-xs text-slate-400">{dateLabel}</div>}
      </div>

      {/* Service list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {tripsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-3 rounded-lg bg-slate-900 space-y-2">
                <Skeleton className="h-4 w-20 bg-slate-800" />
                <Skeleton className="h-3 w-full bg-slate-800" />
                <Skeleton className="h-2 w-full bg-slate-800" />
              </div>
            ))
          ) : trips.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-slate-500">
              {tripParams
                ? "No services found for this route and date."
                : "Open a room from the Pricing Rooms page to see services here."}
            </div>
          ) : (
            trips.map((trip) => {
              const key = String(trip.tripid);
              const isActive =
                selectedTripId === key ||
                (room?.tripId && String(room.tripId) === key);

              return (
                <button
                  key={key}
                  onClick={() => setSelectedTripId(isActive ? null : key)}
                  className={cn(
                    "w-full text-left rounded-lg p-2.5 transition-all border",
                    isActive
                      ? "bg-indigo-950/60 border-indigo-700/50"
                      : "bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50"
                  )}
                >
                  {/* Service number + time */}
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={cn(
                        "text-sm font-bold font-mono",
                        isActive ? "text-indigo-300" : "text-slate-100"
                      )}
                    >
                      {trip.servicenumber}
                    </span>
                    <div className="flex items-center gap-1 text-slate-400">
                      <Clock className="h-3 w-3" />
                      <span className="text-[11px] tabular-nums">
                        {formatTime(trip.boardingtime)}
                      </span>
                    </div>
                  </div>

                  {/* Occupancy bar */}
                  <OccBar available={trip.availableseats} total={trip.totalseats} />

                  {/* Seats + fare */}
                  <div className="flex items-center justify-between mt-1.5">
                    <div className="flex items-center gap-1 text-slate-500">
                      <Users className="h-3 w-3" />
                      <span className="text-[10px]">
                        {(trip.totalseats ?? 0) - (trip.availableseats ?? 0)}/
                        {trip.totalseats ?? "—"}
                      </span>
                    </div>
                    {(trip.minseatfare || trip.maxseatfare) && (
                      <span className="text-[10px] text-slate-400 tabular-nums">
                        ₹{trip.minseatfare ?? "—"}–{trip.maxseatfare ?? "—"}
                      </span>
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
