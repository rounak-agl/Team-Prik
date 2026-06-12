import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;

  // Mock recommendations — in production these come from the Python agent
  const recommendations = [
    {
      decisionId: `mock-${roomId}-1`,
      serviceId: "SVC0001",
      serviceNumber: "FB1001",
      serviceName: "FreshBus 1001",
      departureTime: "06:00",
      currentClassification: "B",
      recommendedClassification: "A",
      currentBusAdjPct: 0,
      recommendedBusAdjPct: 10,
      confidence: 85,
      risk: "low",
      reasoning: "High occupancy (82%) with 14h lead time. Demand trending up.",
      _isMock: true,
    },
    {
      decisionId: `mock-${roomId}-2`,
      serviceId: "SVC0002",
      serviceNumber: "FB1002",
      serviceName: "FreshBus 1002",
      departureTime: "08:30",
      currentClassification: "C",
      recommendedClassification: "B",
      currentBusAdjPct: 5,
      recommendedBusAdjPct: 5,
      confidence: 72,
      risk: "medium",
      reasoning: "Occupancy at 61%. Classification upgrade may drive revenue.",
      _isMock: true,
    },
    {
      decisionId: `mock-${roomId}-3`,
      serviceId: "SVC0003",
      serviceNumber: "FB1003",
      serviceName: "FreshBus 1003",
      departureTime: "21:00",
      currentClassification: "A",
      recommendedClassification: "B",
      currentBusAdjPct: 15,
      recommendedBusAdjPct: 0,
      confidence: 68,
      risk: "high",
      reasoning: "Low overnight demand (38%). Downgrade to improve fill rate.",
      _isMock: true,
    },
  ];

  return NextResponse.json({ recommendations, _isMock: true });
}
