"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect?: (roomId: string) => void;
}

export function RouteDateSelector({ open, onOpenChange, onSelect }: Props) {
  const router = useRouter();
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [routeId, setRouteId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const derivedRoute =
    source && destination
      ? `${source.toUpperCase()}_${destination.toUpperCase()}`
      : "";

  const effectiveRouteId = routeId || derivedRoute;

  async function handleSubmit() {
    if (!date || !effectiveRouteId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pricing/rooms/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, routeId: effectiveRouteId }),
      });
      if (!res.ok) throw new Error("Failed to open pricing room");
      const room = await res.json();
      const id = room.id ?? room.roomId;
      onSelect?.(id);
      onOpenChange(false);
      router.push(`/pricing/rooms/${id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Open Pricing Room</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="rds-date">Journey Date</Label>
            <Input
              id="rds-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rds-source">Source</Label>
              <Input
                id="rds-source"
                placeholder="e.g. BLR"
                value={source}
                onChange={(e) => {
                  setSource(e.target.value);
                  setRouteId("");
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rds-dest">Destination</Label>
              <Input
                id="rds-dest"
                placeholder="e.g. MYS"
                value={destination}
                onChange={(e) => {
                  setDestination(e.target.value);
                  setRouteId("");
                }}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rds-routeid">
              Route ID{" "}
              <span className="text-muted-foreground text-xs">(auto-filled)</span>
            </Label>
            <Input
              id="rds-routeid"
              placeholder="BLR_MYS"
              value={routeId || derivedRoute}
              onChange={(e) => setRouteId(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !date || !effectiveRouteId}
          >
            {loading ? "Opening…" : "Open Pricing Room"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
