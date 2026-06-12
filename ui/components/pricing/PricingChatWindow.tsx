"use client";

import { useRef, useEffect, useState, KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Send, Clock, Users, X, Bus } from "lucide-react";
import { usePricingMessages, useSendMessage } from "@/hooks/usePricingMessages";
import { ChatMessageBubble } from "@/components/pricing/ChatMessageBubble";
import { useRoom } from "@/hooks/usePricingRooms";
import type { PricingChatMessage } from "@/lib/schemas";
import { cn } from "@/lib/utils";

interface Props {
  roomId: string;
  onViewChanges?: (batchId: string) => void;
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
  tripId?: number;
}

const SUGGESTION_CHIPS = [
  "Treat this as demand day",
  "Do not reduce before 6 PM",
  "Protect EPK above 90",
  "Reduce late-night services if occupancy is stuck",
  "Hold fares for early evening services",
  "Escalate if occupancy drops by 3+ seats",
];


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

function OccBar({ pct }: { pct?: number | null }) {
  if (pct == null) return null;
  const clamped = Math.min(100, Math.max(0, pct));
  const color = clamped < 50 ? "bg-emerald-500" : clamped < 75 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${clamped}%` }} />
      </div>
      <span className="text-[10px] text-slate-400 tabular-nums w-7 text-right">{Math.round(clamped)}%</span>
    </div>
  );
}

function ServiceCard({
  svc,
  selected,
  onClick,
}: {
  svc: Service;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-left rounded-xl p-3 border transition-all w-full",
        selected
          ? "bg-indigo-950/70 border-indigo-600/60 ring-1 ring-indigo-500/40"
          : "bg-slate-900 border-slate-700 hover:border-slate-600 hover:bg-slate-800/60"
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={cn("font-bold font-mono text-xs leading-tight", selected ? "text-indigo-300" : "text-slate-100")}>
          {svc.serviceNumber ?? svc.serviceKey ?? svc.serviceId}
        </span>
        <div className="flex items-center gap-1 text-slate-400">
          <Clock className="h-3 w-3" />
          <span className="text-[11px] tabular-nums">{svc.departureTime ? svc.departureTime.slice(0, 5) : "—"}</span>
        </div>
      </div>
      <OccBar pct={svc.occupancyPct} />
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1 text-slate-500">
          <Users className="h-3 w-3" />
          <span className="text-[10px] tabular-nums">{svc.bookedSeats ?? "—"}/{svc.totalSeats ?? "—"}</span>
        </div>
        {svc.asp != null && (
          <span className="text-[10px] text-slate-400 tabular-nums">₹{Math.round(svc.asp)}</span>
        )}
      </div>
    </button>
  );
}

export function PricingChatWindow({ roomId, onViewChanges }: Props) {
  const [text, setText] = useState("");
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = usePricingMessages(roomId);
  const sendMessage = useSendMessage(roomId);
  const { data: roomData } = useRoom(roomId);
  const room = roomData?.room;

  // If room is missing station IDs (old rooms), resolve from route-pairs by name match
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
    if (!match) return null;
    return { sourceId: String(match.sourceId), destinationId: String(match.destinationId) };
  })();

  const servicesParams =
    resolvedIds && room?.journeyDate
      ? { journeyDate: room.journeyDate, ...resolvedIds }
      : null;

  const { data: servicesData, isLoading: servicesLoading } = useServicesByDate(servicesParams);
  const services: Service[] = servicesData?.services ?? [];

  const messages: PricingChatMessage[] = data?.messages ?? [];
  const isEmpty = !isLoading && messages.length === 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    sendMessage.mutate({
      messageText: trimmed,
      scope: selectedService ? "service" : "route_date",
      messageType: "instruction",
      metadata: selectedService
        ? { serviceId: selectedService.serviceId, serviceKey: selectedService.serviceKey, departureTime: selectedService.departureTime }
        : undefined,
    });
    setText("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  };

  const handleViewChanges = (batchId: string) => {
    if (onViewChanges) onViewChanges(batchId);
  };

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden border-r border-slate-800 bg-slate-950">
      {/* Messages or empty state with services */}
      <ScrollArea className="flex-1 px-4">
        <div className="py-4 space-y-3">
          {isLoading ? (
            <>
              <Skeleton className="h-12 w-3/4" />
              <Skeleton className="h-16 w-4/5 ml-auto" />
              <Skeleton className="h-10 w-2/3" />
            </>
          ) : isEmpty ? (
            <div className="space-y-4">
              <p className="text-xs text-slate-500 text-center pt-2">
                Select a service below to give targeted instructions, or type for the whole route/date.
              </p>

              {/* Service grid */}
              {servicesLoading ? (
                <div className="grid grid-cols-1 gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
                      <Skeleton className="h-4 w-16 bg-slate-800" />
                      <Skeleton className="h-1.5 w-full bg-slate-800" />
                      <Skeleton className="h-3 w-24 bg-slate-800" />
                    </div>
                  ))}
                </div>
              ) : services.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-slate-600">
                  <Bus className="h-8 w-8" />
                  <span className="text-xs">No services found for this date.</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {services.map((svc) => (
                    <ServiceCard
                      key={String(svc.serviceId)}
                      svc={svc}
                      selected={selectedService?.serviceId === svc.serviceId}
                      onClick={() => setSelectedService(selectedService?.serviceId === svc.serviceId ? null : svc)}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            messages.map((msg) => (
              <ChatMessageBubble
                key={msg.id}
                message={msg}
                onViewChanges={handleViewChanges}
              />
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Suggestion chips */}
      <div className="border-t border-slate-800 px-4 py-2 flex gap-2 overflow-x-auto scrollbar-hide">
        {SUGGESTION_CHIPS.map((chip) => (
          <button
            key={chip}
            onClick={() => setText(chip)}
            className="shrink-0 text-xs px-3 py-1.5 rounded-full border border-slate-700 bg-slate-900/50 hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors whitespace-nowrap"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Selected service pill */}
      {selectedService && (
        <div className="px-4 py-1.5 border-t border-slate-800 flex items-center gap-2">
          <Bus className="h-3 w-3 text-indigo-400 shrink-0" />
          <span className="text-xs text-indigo-300 font-semibold font-mono">
            {selectedService.serviceNumber ?? selectedService.serviceKey}
            {selectedService.departureTime && ` · ${selectedService.departureTime.slice(0, 5)}`}
          </span>
          <button
            onClick={() => setSelectedService(null)}
            className="ml-auto text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Composer */}
      <div className="border-t border-slate-800 px-4 py-3 space-y-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            selectedService
              ? `Instruction for ${selectedService.serviceNumber ?? selectedService.serviceKey}…`
              : "Add pricing instruction for this route/date..."
          }
          rows={2}
          className="resize-none text-sm bg-slate-900 border-slate-700"
        />
        <div className="flex items-center justify-end gap-2">
          <span className="text-[10px] text-slate-500">⌘↵</span>
          <Button
            size="sm"
            className="h-8 px-3 bg-indigo-600 hover:bg-indigo-500"
            onClick={handleSend}
            disabled={!text.trim() || sendMessage.isPending}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
