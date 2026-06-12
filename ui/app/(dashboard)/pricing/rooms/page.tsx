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
  source: { id: string | number; name: string };
  destination: { id: string | number; name: string };
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
  const [queryParams, setQueryParams] = useState<{
    journeyDate: string;
    sourceId: string;
    destinationId: string;
  } | null>(null);
  const [openingTripId, setOpeningTripId] = useState<string | null>(null);
  const [openingRouteRoom, setOpeningRouteRoom] = useState(false);

  const { data: routePairsData, isLoading: pairsLoading } = useRoutePairs();
  const { data: roomsData, isLoading: roomsLoading } = usePricingRooms();
  const { data: tripsData, isLoading: tripsLoading, isFetching: tripsFetching } = useTripsByDate(queryParams);

  const pairs: RoutePair[] = routePairsData?.pairs ?? [];
  const rooms: PricingRoom[] = roomsData?.rooms ?? [];
  const trips: Trip[] = tripsData?.trips ?? [];

  // Auto-select Bangalore → Tirupati on load
  useEffect(() => {
    if (!pairs.length || selectedRoute) return;
    const blrTpt = pairs.find(
      (p) =>
        p.source.name.toLowerCase().includes("bangalore") &&
        p.destination.name.toLowerCase().includes("tirupati")
    );
    const first = blrTpt ?? pairs[0];
    if (first) {
      setSelectedRoute({
        sourceId: String(first.source.id),
        destinationId: String(first.destination.id),
        label: `${first.source.name} → ${first.destination.name}`,
      });
    }
  }, [pairs, selectedRoute]);

  async function openServiceRoom(trip: Trip) {
    if (!selectedRoute) return;
    const sourceLabel = selectedRoute.label.split(" → ")[0] ?? "SRC";
    const destLabel = selectedRoute.label.split(" → ")[1] ?? "DST";
    const tripKey = String(trip.tripid ?? trip.servicenumber);
    const routeId = `${sourceLabel.toUpperCase().replace(/\s+/g, "_")}-${destLabel.toUpperCase().replace(/\s+/g, "_")}-${trip.servicenumber}`;
    const routeDirection = `${sourceLabel.toUpperCase().replace(/\s+/g, "_")}_TO_${destLabel.toUpperCase().replace(/\s+/g, "_")}`;

    setOpeningTripId(tripKey);
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
          title: `${trip.servicenumber} · ${sourceLabel} → ${destLabel}`,
          serviceId: String(trip.serviceid ?? trip.tripid),
          serviceNumber: trip.servicenumber,
          tripId: String(trip.tripid),
        }),
      });
      const data = await res.json();
      if (data.room?.id) router.push(`/pricing/rooms/${data.room.id}`);
    } finally {
      setOpeningTripId(null);
    }
  }

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
          Select a route and date to view live services, then open a per-service pricing room.
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
                  value={selectedRoute ? `${selectedRoute.sourceId}__${selectedRoute.destinationId}` : ""}
                  onValueChange={(val) => {
                    const [srcId, dstId] = (val ?? "").split("__");
                    const pair = pairs.find(
                      (p) => String(p.source.id) === srcId && String(p.destination.id) === dstId
                    );
                    if (pair) {
                      setSelectedRoute({
                        sourceId: srcId,
                        destinationId: dstId,
                        label: `${pair.source.name} → ${pair.destination.name}`,
                      });
                      setQueryParams(null); // reset service list
                    }
                  }}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white focus:border-indigo-500">
                    <SelectValue placeholder="Select route…" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700 text-white max-h-64">
                    {pairs.map((p) => (
                      <SelectItem
                        key={`${p.source.id}__${p.destination.id}`}
                        value={`${p.source.id}__${p.destination.id}`}
                        className="text-slate-200 focus:bg-slate-800"
                      >
                        {p.source.name} → {p.destination.name}
                      </SelectItem>
                    ))}
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
                  setQueryParams(null);
                }}
                className="bg-slate-800 border-slate-700 text-white focus:border-indigo-500"
              />
            </div>

            {/* View Services button */}
            <Button
              onClick={() => {
                if (selectedRoute && date) {
                  setQueryParams({
                    journeyDate: date,
                    sourceId: selectedRoute.sourceId,
                    destinationId: selectedRoute.destinationId,
                  });
                }
              }}
              disabled={!selectedRoute || !date}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold mb-0.5"
            >
              {tripsFetching ? (
                <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <ChevronRight className="h-4 w-4 mr-1.5" />
              )}
              View Services
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Phase 2: Service List */}
      {queryParams && (
        <div className="space-y-3">
          {/* Section header */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-semibold text-slate-200">
                {tripsLoading
                  ? "Loading services…"
                  : `${trips.length} service${trips.length !== 1 ? "s" : ""} on ${selectedRoute?.label ?? ""} · ${displayDate}`}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={openRouteRoom}
              disabled={openingRouteRoom}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white text-xs"
            >
              {openingRouteRoom ? (
                <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
              )}
              + Route-Level Room
            </Button>
          </div>

          {/* Trip cards */}
          {tripsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <TripSkeleton key={i} />)}
            </div>
          ) : trips.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center bg-slate-900 border border-slate-800 rounded-xl">
              <Bus className="h-10 w-10 text-slate-700 mb-3" />
              <p className="text-slate-400 font-semibold">No services found on this route for the selected date.</p>
              <p className="text-slate-600 text-sm mt-1">Try a different date or route.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {trips.map((trip) => {
                const tripKey = String(trip.tripid ?? trip.servicenumber);
                const isOpening = openingTripId === tripKey;
                const availPct =
                  trip.totalseats && trip.availableseats != null
                    ? trip.availableseats / trip.totalseats
                    : null;

                return (
                  <div
                    key={tripKey}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4"
                  >
                    {/* Left: Service info */}
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-slate-100 text-lg leading-none">
                          {trip.servicenumber}
                        </span>
                        {trip.vehicletype && (
                          <Badge
                            variant="outline"
                            className="border-slate-700 text-slate-400 text-[10px] py-0"
                          >
                            {trip.vehicletype}
                          </Badge>
                        )}
                      </div>
                      {trip.routename && (
                        <p className="text-slate-400 text-sm">{trip.routename}</p>
                      )}

                      {/* Times */}
                      <div className="flex items-center gap-2 text-sm text-slate-300">
                        <span className="font-semibold">{formatTime(trip.boardingtime)}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
                        <span className="font-semibold">{formatTime(trip.droppingtime)}</span>
                      </div>

                      {/* Seats + fare */}
                      <div className="flex items-center gap-4 text-sm flex-wrap">
                        {trip.availableseats != null && trip.totalseats != null && (
                          <span className={`flex items-center gap-1 font-medium ${seatColor(trip.availableseats, trip.totalseats)}`}>
                            <Users className="h-3.5 w-3.5" />
                            {trip.availableseats}/{trip.totalseats} available
                            {availPct != null && (
                              <span className="text-slate-500 text-xs">
                                ({Math.round(availPct * 100)}%)
                              </span>
                            )}
                          </span>
                        )}
                        {(trip.minseatfare != null || trip.maxseatfare != null) && (
                          <span className="text-slate-300">
                            ₹{trip.minseatfare ?? trip.fare}
                            {trip.maxseatfare && trip.minseatfare !== trip.maxseatfare
                              ? ` – ₹${trip.maxseatfare}`
                              : ""}
                          </span>
                        )}
                      </div>

                      {/* Ratings */}
                      {((trip.redbusrating != null && trip.redbusrating > 0) ||
                        (trip.abhibusrating != null && trip.abhibusrating > 0)) && (
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          {trip.redbusrating != null && trip.redbusrating > 0 && (
                            <span className="flex items-center gap-0.5">
                              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                              {(trip.redbusrating as number).toFixed(1)} Redbus
                            </span>
                          )}
                          {trip.abhibusrating != null && trip.abhibusrating > 0 && (
                            <span className="flex items-center gap-0.5">
                              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                              {(trip.abhibusrating as number).toFixed(1)} Abhibus
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Right: Open Room button */}
                    <div className="shrink-0">
                      <Button
                        onClick={() => openServiceRoom(trip)}
                        disabled={isOpening}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold w-full sm:w-auto"
                      >
                        {isOpening ? (
                          <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
                        ) : (
                          <MessageSquare className="h-4 w-4 mr-1.5" />
                        )}
                        Open Pricing Room
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Phase 3: Recent Rooms */}
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
