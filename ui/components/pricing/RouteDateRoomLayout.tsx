"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PricingChatWindow } from "@/components/pricing/PricingChatWindow";
import { ChangeDetailsDrawer } from "@/components/pricing/ChangeDetailsDrawer";
import { useRoom } from "@/hooks/usePricingRooms";
import { format, parseISO } from "date-fns";
import { useState } from "react";

interface Props {
  roomId: string;
}

function formatDate(d: string) {
  try { return format(parseISO(d), "d MMM yyyy"); } catch { return d; }
}

export function RouteDateRoomLayout({ roomId }: Props) {
  const { data } = useRoom(roomId);
  const room = data?.room;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  const routeLabel = room
    ? `${(room.source ?? "").toUpperCase()} → ${(room.destination ?? "").toUpperCase()}`
    : "Loading…";

  const dateLabel = room?.journeyDate ? formatDate(room.journeyDate) : "";

  return (
    <div className="flex flex-col -m-6" style={{ height: "calc(100vh - 60px)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 h-12 border-b border-slate-800 bg-slate-950 shrink-0">
        <Link
          href="/pricing/rooms"
          className="flex items-center gap-1 text-slate-400 hover:text-slate-100 transition-colors text-sm font-medium shrink-0"
        >
          <ChevronLeft className="h-4 w-4" />
          Rooms
        </Link>
        <span className="text-slate-700 shrink-0">·</span>
        <span className="font-bold text-slate-100 tracking-wide">{routeLabel}</span>
        {dateLabel && (
          <span className="text-slate-500 text-sm shrink-0">{dateLabel}</span>
        )}
      </div>

      {/* Full-width chat */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <PricingChatWindow
          roomId={roomId}
          routeLabel={routeLabel}
          dateLabel={dateLabel}
          onViewChanges={(batchId) => { setSelectedBatchId(batchId); setDrawerOpen(true); }}
        />
      </div>

      <ChangeDetailsDrawer
        batchId={selectedBatchId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        routeTitle={routeLabel}
        journeyDate={room?.journeyDate}
      />
    </div>
  );
}
