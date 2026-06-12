"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePricingRooms } from "@/hooks/usePricingRooms";
import { useRoutePairs } from "@/hooks/useRoutePairs";
import { useTripsByDate } from "@/hooks/useTripsByDate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Bus,
  Calendar,
  MessageSquare,
  ArrowRight,
  Clock,
  ChevronRight,
  Star,
  Users,
  RefreshCw,
} from "lucide-react";
import { formatDistanceToNow, format, parseISO } from "date-fns";

interface RoutePair {
  id: string | number;
  sourceId: string | number;
  sourceName: string;
  destinationId: string | number;
  destinationName: string;
}

interface Trip {
  tripid: string | number;
  routename?: string;
  servicenumber: string;
  vehicletype?: string;
  availableseats?: number;
  totalseats?: number;
  fare?: number;
  minseatfare?: number;
  maxseatfare?: number;
  boardingtime?: string;
  droppingtime?: string;
  redbusrating?: number;
  abhibusrating?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

interface PricingRoom {
  id: string;
  routeId: string;
  source?: string | null;
  destination?: string | null;
  journeyDate: string;
  title: string;
  dayType?: string | null;
  status: string;
  messageCount: number;
  updatedAt: string;
  serviceNumber?: string | null;
}

function formatTime(iso?: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso.slice(0, 5);
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return iso.slice(0, 5);
  }
}

function seatColor(available?: number, total?: number): string {
  if (available == null || total == null || total === 0) return "text-slate-400";
  const pct = available / total;
  if (pct > 0.5) return "text-emerald-400";
  if (pct > 0.25) return "text-amber-400";
  return "text-red-400";
}

function TripSkeleton() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
      <div className="flex justify-between">
        <Skeleton className="h-5 w-24 bg-slate-800" />
        <Skeleton className="h-5 w-16 bg-slate-800" />
      </div>
      <Skeleton className="h-4 w-48 bg-slate-800" />
      <div className="flex gap-4">
        <Skeleton className="h-4 w-20 bg-slate-800" />
        <Skeleton className="h-4 w-20 bg-slate-800" />
      </div>
      <div className="flex justify-end">
        <Skeleton className="h-8 w-36 bg-slate-800" />
      </div>
    </div>
  );
}

export default function PricingRoomsPage() {
  const router = useRouter();

  const [selectedRoute, setSelectedRoute] = useState<{
    sourceId: string;
    destinationId: string;
    label: string;
  } | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [openingRouteRoom, setOpeningRouteRoom] = useState(false);

  const { data: routePairsData, isLoading: pairsLoading } = useRoutePairs();
  const { data: roomsData, isLoading: roomsLoading } = usePricingRooms();

  const pairs: RoutePair[] = routePairsData?.pairs ?? [];
  const rooms: PricingRoom[] = roomsData?.rooms ?? [];

  // Auto-select Bangalore → Tirupati on load
  useEffect(() => {
    if (!pairs.length || selectedRoute) return;
    const blrTpt = pairs.find(
      (p: RoutePair) =>
        p.sourceName.toLowerCase().includes("bangalore") &&
        p.destinationName.toLowerCase().includes("tirupati")
    );
    const first = blrTpt ?? pairs[0];
    if (first) {
      setSelectedRoute({
        sourceId: String(first.sourceId),
        destinationId: String(first.destinationId),
        label: `${first.sourceName} → ${first.destinationName}`,
      });
    }
  }, [pairs, selectedRoute]);

  async function openRouteRoom() {
    if (!selectedRoute) return;
    const sourceLabel = selectedRoute.label.split(" → ")[0] ?? "SRC";
    const destLabel = selectedRoute.label.split(" → ")[1] ?? "DST";
    const routeId = `${sourceLabel.toUpperCase().replace(/\s+/g, "_")}-${destLabel.toUpperCase().replace(/\s+/g, "_")}`;
    const routeDirection = `${sourceLabel.toUpperCase().replace(/\s+/g, "_")}_TO_${destLabel.toUpperCase().replace(/\s+/g, "_")}`;

    setOpeningRouteRoom(true);
    try {
      const res = await fetch("/api/pricing/rooms/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routeId,
          routeDirection,
          source: sourceLabel,
          destination: destLabel,
          journeyDate: date,
          title: `${sourceLabel} → ${destLabel} (All Services)`,
          sourceStationId: selectedRoute.sourceId,
          destinationStationId: selectedRoute.destinationId,
        }),
      });
      const data = await res.json();
      if (data.room?.id) router.push(`/pricing/rooms/${data.room.id}`);
    } finally {
      setOpeningRouteRoom(false);
    }
  }

  function formatJourneyDate(dateStr: string) {
    try {
      return format(parseISO(dateStr), "dd MMM yyyy");
    } catch {
      return dateStr;
    }
  }

  function timeAgo(dateStr: string) {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
    } catch {
      return "—";
    }
  }

  const displayDate = date
    ? format(parseISO(date), "d MMM yyyy")
    : "";

  return (
    <div className="p-6 space-y-6 min-h-full bg-slate-950">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Pricing Rooms</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Select a route and date to open a pricing room. Services load inside the room.
        </p>
      </div>

      {/* Phase 1: Route + Date Selector */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-end">
            {/* Route dropdown */}
            <div className="space-y-1.5 flex-1 min-w-[220px]">
              <Label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Route</Label>
              {pairsLoading ? (
                <Skeleton className="h-9 w-full bg-slate-800" />
              ) : (
                <Select
                  value={selectedRoute?.label ?? ""}
                  onValueChange={(val) => {
                    const pair = pairs.find(
                      (p: RoutePair) => `${p.sourceName} → ${p.destinationName}` === val
                    );
                    if (pair) {
                      setSelectedRoute({
                        sourceId: String(pair.sourceId),
                        destinationId: String(pair.destinationId),
                        label: `${pair.sourceName} → ${pair.destinationName}`,
                      });
                    }
                  }}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white focus:border-indigo-500">
                    <SelectValue placeholder="Select route…" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700 text-white max-h-64">
                    {pairs.map((p: RoutePair) => {
                      const label = `${p.sourceName} → ${p.destinationName}`;
                      return (
                        <SelectItem
                          key={String(p.id)}
                          value={label}
                          className="text-slate-200 focus:bg-slate-800"
                        >
                          {label}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Date picker */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Journey Date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                }}
                className="bg-slate-800 border-slate-700 text-white focus:border-indigo-500"
              />
            </div>

            {/* Open Room button */}
            <Button
              onClick={openRouteRoom}
              disabled={!selectedRoute || !date || openingRouteRoom}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold mb-0.5"
            >
              {openingRouteRoom ? (
                <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <MessageSquare className="h-4 w-4 mr-1.5" />
              )}
              Open Room
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Rooms */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Recent Pricing Rooms</h2>

        {roomsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="bg-slate-900 border-slate-800">
                <CardContent className="p-4 space-y-3">
                  <Skeleton className="h-5 w-24 bg-slate-800" />
                  <Skeleton className="h-8 w-32 bg-slate-800" />
                  <Skeleton className="h-4 w-full bg-slate-800" />
                  <Skeleton className="h-4 w-2/3 bg-slate-800" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center bg-slate-900 border border-slate-800 rounded-xl">
            <MessageSquare className="h-10 w-10 text-slate-700 mb-3" />
            <p className="text-slate-400 font-semibold">No pricing rooms yet.</p>
            <p className="text-slate-600 text-sm mt-1">Open one above to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => router.push(`/pricing/rooms/${room.id}`)}
                className="text-left bg-slate-900 border border-slate-800 rounded-xl p-4 hover:bg-slate-800/50 hover:border-slate-700 transition-all group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {room.source && room.destination
                      ? `${room.source} → ${room.destination}`
                      : room.routeId}
                  </span>
                  <Badge
                    variant="outline"
                    className={
                      room.status === "active"
                        ? "border-emerald-800 text-emerald-400 bg-emerald-950/40 text-[10px]"
                        : "border-slate-700 text-slate-500 text-[10px]"
                    }
                  >
                    {room.status}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                  <span className="text-lg font-black text-white">{formatJourneyDate(room.journeyDate)}</span>
                </div>

                <p className="text-xs text-slate-400 font-medium truncate mb-3">{room.title}</p>

                {room.serviceNumber && (
                  <p className="text-xs text-indigo-400 font-semibold mb-2 flex items-center gap-1">
                    <Bus className="h-3 w-3" />
                    {room.serviceNumber}
                  </p>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <MessageSquare className="h-3 w-3" />
                    <span>{room.messageCount} message{room.messageCount !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-600">
                    <Clock className="h-2.5 w-2.5" />
                    <span>{timeAgo(room.updatedAt)}</span>
                  </div>
                </div>

                {room.dayType && (
                  <div className="mt-2">
                    <Badge variant="outline" className="border-slate-700 text-slate-400 text-[10px]">
                      {room.dayType}
                    </Badge>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
