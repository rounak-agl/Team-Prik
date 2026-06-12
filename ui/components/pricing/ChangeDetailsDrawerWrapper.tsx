"use client";

import { useState } from "react";
import { PricingChatWindow } from "@/components/pricing/PricingChatWindow";
import { ChangeDetailsDrawer } from "@/components/pricing/ChangeDetailsDrawer";

interface Props {
  roomId: string;
  routeTitle?: string;
  journeyDate?: string;
}

export function ChangeDetailsDrawerWrapper({ roomId, routeTitle, journeyDate }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  const handleViewChanges = (batchId: string) => {
    setSelectedBatchId(batchId);
    setDrawerOpen(true);
  };

  return (
    <div className="h-full min-h-0 overflow-hidden flex flex-col">
      <PricingChatWindow roomId={roomId} onViewChanges={handleViewChanges} />
      <ChangeDetailsDrawer
        batchId={selectedBatchId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        routeTitle={routeTitle}
        journeyDate={journeyDate}
      />
    </div>
  );
}
