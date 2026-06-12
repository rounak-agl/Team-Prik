import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { SendMessageRequest } from "@/lib/schemas";

export function usePricingMessages(roomId: string) {
  return useQuery({
    queryKey: ["pricing-messages", roomId],
    queryFn: async () => {
      const res = await fetch(`/api/pricing/rooms/${roomId}/messages`);
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
    refetchInterval: 30000,
    enabled: !!roomId,
  });
}

export function useSendMessage(roomId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: SendMessageRequest) => {
      const res = await fetch(`/api/pricing/rooms/${roomId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to send message");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pricing-messages", roomId] }),
  });
}
