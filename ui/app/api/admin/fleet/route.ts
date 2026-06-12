import { NextResponse } from "next/server";

function mockRow(i: number) {
  const routes = ["BLR-HYD", "BLR-CHN", "HYD-BLR", "CHN-BLR", "BLR-GOA"];
  const classifications = ["A", "B", "C", "D", "E"];
  const recommendations = ["increase", "hold", "decrease"];
  const risks = ["low", "medium", "high"];
  const dayTypes = ["weekday", "weekend", "holiday"];

  const occ = Math.round(40 + Math.random() * 55);
  const fareBase = 500 + i * 37;

  return {
    serviceId: `SVC${String(i + 1).padStart(4, "0")}`,
    journeyDate: "2026-06-14",
    route: routes[i % routes.length],
    serviceNumber: `FB${1000 + i}`,
    serviceName: `FreshBus ${1000 + i}`,
    departureTime: `${String(6 + (i % 16)).padStart(2, "0")}:${i % 2 === 0 ? "00" : "30"}`,
    leadTime: Math.round(12 + Math.random() * 60),
    dayType: dayTypes[i % dayTypes.length],
    currentOccupancy: occ,
    occDelta5m: Math.round((Math.random() - 0.5) * 6),
    occDelta15m: Math.round((Math.random() - 0.5) * 12),
    asp: Math.round(fareBase * (1 + occ / 200)),
    epk: Math.round((fareBase * occ) / 40) / 100,
    currentClassification: classifications[i % classifications.length],
    busAdjPct: Math.round((Math.random() - 0.3) * 20),
    agentRecommendation: recommendations[i % recommendations.length],
    confidence: Math.round(60 + Math.random() * 35),
    risk: risks[i % risks.length],
    lastAgentRun: new Date(Date.now() - Math.random() * 3600000).toISOString(),
    lastChange: new Date(Date.now() - Math.random() * 86400000).toISOString(),
    _isMock: true,
  };
}

export async function GET() {
  const rows = Array.from({ length: 20 }, (_, i) => mockRow(i));
  return NextResponse.json({ services: rows, _isMock: true });
}
