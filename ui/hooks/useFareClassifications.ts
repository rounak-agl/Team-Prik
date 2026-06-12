import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { UpdateClassificationRequest } from "@/lib/schemas";

export function useFareClassifications(tripId: string | number | null) {
  return useQuery({
    queryKey: ["fare-classifications", tripId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/trips/${tripId}/price-classifications`);
      if (!res.ok) throw new Error("Failed to fetch classifications");
      return res.json();
    },
    enabled: !!tripId,
  });
}

export function useUpdateClassification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (req: UpdateClassificationRequest) => {
      const res = await fetch(`/api/admin/trips/${req.tripId}/price-classification`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fareClassification: req.fareClassification,
          pricingModel: req.pricingModel,
        }),
      });
      if (!res.ok) throw new Error("Failed to update classification");
      return res.json();
    },
    onSuccess: (_, req) =>
      qc.invalidateQueries({ queryKey: ["fare-classifications", req.tripId] }),
  });
}
