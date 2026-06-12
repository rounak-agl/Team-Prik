"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePricingRooms, useOpenRoom } from "@/hooks/usePricingRooms";
import { RouteDateSelector } from "@/components/pricing/RouteDateSelector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, MessageSquare, Calendar, ArrowRight, Clock } from "lucide-react";
import { formatDistanceToNow, format, parseISO } from "date-fns";

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
}

export default function PricingRoomsPage() {
  const router = useRouter();
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [quickOpenError, setQuickOpenError] = useState<string | null>(null);

  const { data, isLoading } = usePricingRooms();
  const openRoom = useOpenRoom();

  const rooms: PricingRoom[] = data?.rooms ?? [];

  async function handleQuickOpen() {
    if (!source || !destination || !date) return;
    setQuickOpenError(null);
    const routeId = `${source.toUpperCase().replace(/\s+/g, "_")}-${destination.toUpperCase().replace(/\s+/g, "_")}`;
    const routeDirection = `${source.toUpperCase().replace(/\s+/g, "_")}_TO_${destination.toUpperCase().replace(/\s+/g, "_")}`;
    openRoom.mutate(
      { routeId, routeDirection, source, destination, journeyDate: date },
      {
        onSuccess: (data) => router.push(`/pricing/rooms/${data.room.id}`),
        onError: (err) => setQuickOpenError(err instanceof Error ? err.message : "Failed to open room"),
      }
    );
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

  return (
    <div className="p-6 space-y-6 min-h-full bg-slate-950">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Pricing Rooms</h1>
          <p className="text-sm text-slate-400 mt-0.5">Select a route and date to open a pricing co-pilot session.</p>
        </div>
        <Button
          onClick={() => setSelectorOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          New Room
        </Button>
      </div>

      {/* Quick Open Card */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-slate-200">Open a Pricing Room</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1.5 flex-1 min-w-[120px]">
              <Label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Source</Label>
              <Input
                placeholder="e.g. HYD"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-indigo-500"
              />
            </div>
            <ArrowRight className="h-4 w-4 text-slate-500 mb-2.5 shrink-0" />
            <div className="space-y-1.5 flex-1 min-w-[120px]">
              <Label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Destination</Label>
              <Input
                placeholder="e.g. VJA"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-indigo-500"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Journey Date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white focus:border-indigo-500"
              />
            </div>
            <Button
              onClick={handleQuickOpen}
              disabled={!source || !destination || !date || openRoom.isPending}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold mb-0.5"
            >
              {openRoom.isPending ? "Opening…" : "Open Room"}
            </Button>
          </div>
          {quickOpenError && (
            <p className="text-sm text-red-400 mt-2">{quickOpenError}</p>
          )}
        </CardContent>
      </Card>

      {/* Recent Rooms */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Recent Rooms</h2>

        {isLoading ? (
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
          <div className="flex flex-col items-center justify-center py-16 text-center">
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
                {/* Route */}
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

                {/* Journey Date */}
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                  <span className="text-lg font-black text-white">{formatJourneyDate(room.journeyDate)}</span>
                </div>

                {/* Title */}
                <p className="text-xs text-slate-400 font-medium truncate mb-3">{room.title}</p>

                {/* Footer */}
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

      {/* Dialog fallback */}
      <RouteDateSelector open={selectorOpen} onOpenChange={setSelectorOpen} />
    </div>
  );
}
