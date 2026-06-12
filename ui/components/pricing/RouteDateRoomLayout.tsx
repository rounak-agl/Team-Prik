"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ServiceContextSidebar } from "@/components/pricing/ServiceContextSidebar";
import { ChangeDetailsDrawerWrapper } from "@/components/pricing/ChangeDetailsDrawerWrapper";
import { AgentReasoningPanel } from "@/components/pricing/AgentReasoningPanel";
import { useRoom } from "@/hooks/usePricingRooms";
import { format, parseISO } from "date-fns";

interface Props {
  roomId: string;
}

function formatDate(d: string) {
  try { return format(parseISO(d), "d MMM yyyy"); } catch { return d; }
}

export function RouteDateRoomLayout({ roomId }: Props) {
  const { data } = useRoom(roomId);
  const room = data?.room;

  const title = room
    ? room.serviceNumber
      ? `${room.serviceNumber} · ${room.source ?? ""} → ${room.destination ?? ""}`
      : `${room.source ?? ""} → ${room.destination ?? ""}`
    : "Loading…";

  const subtitle = room?.journeyDate ? formatDate(room.journeyDate) : "";

  return (
    <div className="flex flex-col -m-6" style={{ height: "calc(100vh - 60px)" }}>
      {/* Room header with back button */}
      <div className="flex items-center gap-3 px-4 h-12 border-b border-slate-800 bg-slate-950 shrink-0">
        <Link
          href="/pricing/rooms"
          className="flex items-center gap-1 text-slate-400 hover:text-slate-100 transition-colors text-sm font-medium shrink-0"
        >
          <ChevronLeft className="h-4 w-4" />
          Rooms
        </Link>
        <span className="text-slate-700 shrink-0">·</span>
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-slate-100 truncate">{title}</span>
          {subtitle && (
            <span className="text-slate-500 text-sm shrink-0">{subtitle}</span>
          )}
        </div>
      </div>

      {/* 3-column body */}
      <div className="grid grid-cols-[280px_1fr_320px] flex-1 min-h-0 overflow-hidden">
        <ServiceContextSidebar roomId={roomId} />
        <ChangeDetailsDrawerWrapper
          roomId={roomId}
          routeTitle={title}
          journeyDate={room?.journeyDate}
        />
        <AgentReasoningPanel roomId={roomId} />
      </div>
    </div>
  );
}
