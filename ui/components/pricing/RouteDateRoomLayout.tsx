"use client";

import { ServiceContextSidebar } from "@/components/pricing/ServiceContextSidebar";
import { ChangeDetailsDrawerWrapper } from "@/components/pricing/ChangeDetailsDrawerWrapper";
import { AgentReasoningPanel } from "@/components/pricing/AgentReasoningPanel";

interface Props {
  roomId: string;
}

export function RouteDateRoomLayout({ roomId }: Props) {
  return (
    <div className="grid grid-cols-[280px_1fr_320px] h-full gap-0 border rounded-lg overflow-hidden">
      <ServiceContextSidebar roomId={roomId} />
      <ChangeDetailsDrawerWrapper roomId={roomId} />
      <AgentReasoningPanel roomId={roomId} />
    </div>
  );
}
