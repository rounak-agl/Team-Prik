import { useQuery } from "@tanstack/react-query";

export interface FleetFilters {
  dateFrom?: string;
  dateTo?: string;
  route?: string;
  source?: string;
  destination?: string;
  leadTimeBucket?: string;
  dayType?: string;
  riskLevel?: string;
  actionStatus?: string;
  serviceSearch?: string;
}

export function useFleetMonitor(filters: FleetFilters) {
  return useQuery({
    queryKey: ["fleet-monitor", filters],
    queryFn: async () => {
      const search = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => {
        if (v) search.set(k, v);
      });
      const res = await fetch(`/api/admin/fleet?${search}`);
      if (!res.ok) throw new Error("Failed to fetch fleet data");
      return res.json();
    },
    refetchInterval: 5 * 60 * 1000,
  });
}
