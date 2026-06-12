"use client";

import { use } from "react";
import { RouteDateRoomLayout } from "@/components/pricing/RouteDateRoomLayout";

export default function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  return <RouteDateRoomLayout roomId={roomId} />;
}
