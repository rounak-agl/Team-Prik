import { useQuery } from "@tanstack/react-query";

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
