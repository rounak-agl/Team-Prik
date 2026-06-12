import { useQuery, useMutation } from "@tanstack/react-query";
import type { ApplyFareAdjustmentRequest } from "@/lib/schemas";

export function useFareAdjustment(tripId: string | number | null) {
  return useQuery({
    queryKey: ["fare-adjustment", tripId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/trips/${tripId}/fare-adjustment`);
      if (!res.ok) throw new Error("Failed to fetch fare adjustment");
      return res.json();
    },
    enabled: !!tripId,
  });
}

export function useApplyFareAdjustment() {
  return useMutation({
    mutationFn: async (req: ApplyFareAdjustmentRequest) => {
      const res = await fetch(`/api/admin/fare-adjustment/${req.fareValue}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripIds: req.tripIds,
          reasonId: req.reasonId,
          seatType: req.seatType,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Failed to apply fare adjustment");
      }
      return res.json();
    },
  });
}

export function useFareAdjustmentReasons() {
  return useQuery({
    queryKey: ["fare-adjustment-reasons"],
    queryFn: async () => {
      const res = await fetch("/api/admin/fare-adjustment-reasons");
      if (!res.ok) throw new Error("Failed to fetch reasons");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}
