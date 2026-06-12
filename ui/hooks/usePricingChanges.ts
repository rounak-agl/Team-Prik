import { useQuery } from "@tanstack/react-query";

export function useAllChangeBatches(params?: { routeId?: string; date?: string; status?: string }) {
  return useQuery({
    queryKey: ["all-change-batches", params],
    queryFn: async () => {
      const search = new URLSearchParams();
      if (params?.routeId) search.set("routeId", params.routeId);
      if (params?.date) search.set("date", params.date);
      if (params?.status) search.set("status", params.status);
      const res = await fetch(`/api/pricing/changes?${search}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });
}

export function usePricingChangeBatches(roomId: string) {
  return useQuery({
    queryKey: ["pricing-change-batches", roomId],
    queryFn: async () => {
      const res = await fetch(`/api/pricing/rooms/${roomId}/change-batches`);
      if (!res.ok) throw new Error("Failed to fetch change batches");
      return res.json();
    },
    enabled: !!roomId,
  });
}

export function usePricingChangeItems(batchId: string | null) {
  return useQuery({
    queryKey: ["pricing-change-items", batchId],
    queryFn: async () => {
      const res = await fetch(`/api/pricing/change-batches/${batchId}/items`);
      if (!res.ok) throw new Error("Failed to fetch change items");
      return res.json();
    },
    enabled: !!batchId,
  });
}
