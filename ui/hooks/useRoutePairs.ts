import { useQuery } from "@tanstack/react-query";

export function useRoutePairs() {
  return useQuery({
    queryKey: ["route-pairs"],
    queryFn: async () => {
      const res = await fetch("/api/admin/route-pairs");
      if (!res.ok) return { pairs: [] };
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });
}
