import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { OpenRoomRequest } from "@/lib/schemas";

export function usePricingRooms(params?: { date?: string; route?: string }) {
  return useQuery({
    queryKey: ["pricing-rooms", params],
    queryFn: async () => {
      const search = new URLSearchParams();
      if (params?.date) search.set("date", params.date);
      if (params?.route) search.set("route", params.route);
      const res = await fetch(`/api/pricing/rooms?${search}`);
      if (!res.ok) throw new Error("Failed to fetch rooms");
      return res.json();
    },
  });
}

export function useRoom(roomId: string) {
  return useQuery({
    queryKey: ["pricing-room", roomId],
    queryFn: async () => {
      const res = await fetch(`/api/pricing/rooms/${roomId}`);
      if (!res.ok) throw new Error("Room not found");
      return res.json();
    },
    enabled: !!roomId,
    staleTime: 30 * 1000,
  });
}

export function useOpenRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: OpenRoomRequest) => {
      const res = await fetch("/api/pricing/rooms/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to open room");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pricing-rooms"] }),
  });
}
