import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useAllInstructions(params?: { status?: string; scope?: string; routeId?: string }) {
  return useQuery({
    queryKey: ["all-instructions", params],
    queryFn: async () => {
      const search = new URLSearchParams();
      if (params?.status) search.set("status", params.status);
      if (params?.scope) search.set("scope", params.scope);
      if (params?.routeId) search.set("routeId", params.routeId);
      const res = await fetch(`/api/pricing/instructions?${search}`);
      if (!res.ok) throw new Error("Failed to fetch instructions");
      return res.json();
    },
  });
}

export function usePricingInstructions(roomId: string) {
  return useQuery({
    queryKey: ["pricing-instructions", roomId],
    queryFn: async () => {
      const res = await fetch(`/api/pricing/rooms/${roomId}/instructions`);
      if (!res.ok) throw new Error("Failed to fetch instructions");
      return res.json();
    },
    enabled: !!roomId,
  });
}

export function useDisableInstruction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ instructionId, roomId }: { instructionId: string; roomId: string }) => {
      const res = await fetch(`/api/pricing/instructions/${instructionId}/disable`, {
        method: "PATCH",
      });
      if (!res.ok) throw new Error("Failed to disable instruction");
      return res.json();
    },
    onSuccess: (_, { roomId }) =>
      qc.invalidateQueries({ queryKey: ["pricing-instructions", roomId] }),
  });
}
