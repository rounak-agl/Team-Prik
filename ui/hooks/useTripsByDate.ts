import { useQuery } from "@tanstack/react-query";

interface TripParams {
  journeyDate: string;
  sourceId: string;
  destinationId: string;
}

export function useTripsByDate(params: TripParams | null) {
  return useQuery({
    queryKey: ["trips-by-date", params],
    queryFn: async () => {
      if (!params) return { trips: [] };
      const search = new URLSearchParams({
        journeyDate: params.journeyDate,
        sourceId: params.sourceId,
        destinationId: params.destinationId,
      });
      const res = await fetch(`/api/admin/trips-by-date?${search}`);
      if (!res.ok) return { trips: [] };
      return res.json();
    },
    enabled: !!params,
    staleTime: 2 * 60 * 1000,
  });
}
