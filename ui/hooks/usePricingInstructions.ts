import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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
