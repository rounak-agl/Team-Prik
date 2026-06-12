import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function usePricingRecommendations(roomId: string) {
  return useQuery({
    queryKey: ["pricing-recommendations", roomId],
    queryFn: async () => {
      const res = await fetch(`/api/pricing/rooms/${roomId}/recommendations`);
      if (!res.ok) throw new Error("Failed to fetch recommendations");
      return res.json();
    },
    enabled: !!roomId,
    refetchInterval: 60000,
  });
}

export function useApproveRecommendation(roomId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (decisionId: string) => {
      const res = await fetch(`/api/pricing/recommendations/${decisionId}/approve`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to approve recommendation");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pricing-recommendations", roomId] });
      qc.invalidateQueries({ queryKey: ["pricing-messages", roomId] });
      qc.invalidateQueries({ queryKey: ["pricing-change-batches", roomId] });
    },
  });
}

export function useRejectRecommendation(roomId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (decisionId: string) => {
      const res = await fetch(`/api/pricing/recommendations/${decisionId}/reject`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to reject recommendation");
      return res.json();
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["pricing-recommendations", roomId] }),
  });
}
