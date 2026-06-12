import { NextRequest, NextResponse } from "next/server";
import { pgQuery } from "@/lib/server/postgres";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeLeadTime(journeyDate: string): number {
  const diff = new Date(journeyDate).getTime() - Date.now();
  return Math.max(0, Math.round(diff / (1000 * 60 * 60)));
}

function getDayType(journeyDate: string): string {
  const day = new Date(journeyDate).getDay();
  return day === 0 || day === 6 ? "Weekend" : "Weekday";
}

// ---------------------------------------------------------------------------
// Mock fallback (used when Postgres is unreachable)
// ---------------------------------------------------------------------------

function mockRow(i: number) {
  const routes = ["BLR-HYD", "BLR-CHN", "HYD-BLR", "CHN-BLR", "BLR-GOA"];
  const classifications = ["A", "B", "C", "D", "E"];
  const recommendations = ["increase", "hold", "decrease"];
  const risks = ["low", "medium", "high"];
  const dayTypes = ["Weekday", "Weekend"];

  const occ = Math.round(40 + Math.random() * 55);
  const fareBase = 500 + i * 37;

  return {
    tripId: i + 1,
    serviceId: `SVC${String(i + 1).padStart(4, "0")}`,
    journeyDate: "2026-06-14",
    route: routes[i % routes.length],
    source: routes[i % routes.length].split("-")[0],
    destination: routes[i % routes.length].split("-")[1],
    serviceNumber: `FB${1000 + i}`,
    serviceName: `FreshBus ${1000 + i}`,
    departureTime: `${String(6 + (i % 16)).padStart(2, "0")}:${i % 2 === 0 ? "00" : "30"}`,
    leadTime: Math.round(12 + Math.random() * 60),
    dayType: dayTypes[i % dayTypes.length],
    totalSeats: 40,
    bookedSeats: Math.round(occ * 0.4),
    availableSeats: 40 - Math.round(occ * 0.4),
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
    minFare: fareBase - 50,
    maxFare: fareBase + 150,
    _isMock: true,
  };
}

// ---------------------------------------------------------------------------
// Real query
// ---------------------------------------------------------------------------

interface TripRow {
  tripId: number;
  serviceId: number;
  journeyDate: string | Date;
  serviceNumber: string | null;
  serviceName: string | null;
  fareClassification: string | null;
  staticBaseFare: string | null;
  asp: string | null;
  kilometers: string | null;
  sourceId: number;
  destinationId: number;
  totalSeats: string;
  bookedSeats: string;
  availableSeats: string;
  minFare: string | null;
  maxFare: string | null;
  avgFare: string | null;
}

const BASE_SQL = `
SELECT
  t.id                    AS "tripId",
  t."serviceId"           AS "serviceId",
  t."journeyDate"         AS "journeyDate",
  t."serviceNumber"       AS "serviceNumber",
  t."serviceName"         AS "serviceName",
  t."fareClassification"  AS "fareClassification",
  t."staticBaseFare"      AS "staticBaseFare",
  t."asp"                 AS "asp",
  t.kilometers            AS "kilometers",
  t."sourceId"            AS "sourceId",
  t."destinationId"       AS "destinationId",
  COUNT(ts.id) FILTER (WHERE ts.active = TRUE AND (ts.broken = FALSE OR ts.broken IS NULL)) AS "totalSeats",
  COUNT(ts.id) FILTER (WHERE ts.active = TRUE AND (ts.broken = FALSE OR ts.broken IS NULL) AND ts.available = FALSE) AS "bookedSeats",
  COUNT(ts.id) FILTER (WHERE ts.active = TRUE AND (ts.broken = FALSE OR ts.broken IS NULL) AND ts.available = TRUE) AS "availableSeats",
  MIN(ts.fare) FILTER (WHERE ts.active = TRUE AND ts.available = TRUE AND (ts.broken = FALSE OR ts.broken IS NULL)) AS "minFare",
  MAX(ts.fare) FILTER (WHERE ts.active = TRUE AND ts.available = TRUE AND (ts.broken = FALSE OR ts.broken IS NULL)) AS "maxFare",
  AVG(ts.fare) FILTER (WHERE ts.active = TRUE AND (ts.broken = FALSE OR ts.broken IS NULL)) AS "avgFare"
FROM "Trips" t
LEFT JOIN "TripSeats" ts ON ts."tripId" = t.id
WHERE t.active = TRUE
  AND t."journeyDate" >= CURRENT_DATE
  AND t."journeyDate" <= CURRENT_DATE + INTERVAL '14 days'
`;

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const source = searchParams.get("source");
  const destination = searchParams.get("destination");
  const serviceSearch = searchParams.get("serviceSearch");
  const dayTypeFilter = searchParams.get("dayType");
  const classification = searchParams.get("classification");

  try {
    // Build dynamic WHERE additions and params
    const extraConditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (dateFrom) {
      extraConditions.push(`AND t."journeyDate" >= $${paramIdx++}`);
      params.push(dateFrom);
    }
    if (dateTo) {
      extraConditions.push(`AND t."journeyDate" <= $${paramIdx++}`);
      params.push(dateTo);
    }
    if (source) {
      extraConditions.push(
        `AND CAST(t."sourceId" AS TEXT) ILIKE $${paramIdx++}`
      );
      params.push(`%${source}%`);
    }
    if (destination) {
      extraConditions.push(
        `AND CAST(t."destinationId" AS TEXT) ILIKE $${paramIdx++}`
      );
      params.push(`%${destination}%`);
    }
    if (serviceSearch) {
      extraConditions.push(`AND t."serviceNumber" ILIKE $${paramIdx++}`);
      params.push(`%${serviceSearch}%`);
    }
    if (classification) {
      extraConditions.push(`AND t."fareClassification" = $${paramIdx++}`);
      params.push(classification);
    }

    const sql =
      BASE_SQL +
      extraConditions.join("\n") +
      `
GROUP BY t.id, t."serviceId", t."journeyDate", t."serviceNumber", t."serviceName",
         t."fareClassification", t."staticBaseFare", t."asp", t.kilometers,
         t."sourceId", t."destinationId"
ORDER BY t."journeyDate", t."serviceNumber"
LIMIT 500
`;

    const dbRows = await pgQuery<TripRow>(sql, params);

    let rows = dbRows.map((row) => {
      const totalSeats = Number(row.totalSeats) || 0;
      const bookedSeats = Number(row.bookedSeats) || 0;
      const asp =
        row.asp
          ? Math.round(Number(row.asp))
          : Math.round(
              Number(row.avgFare) || Number(row.staticBaseFare) || 0
            );
      const journeyDateStr =
        row.journeyDate instanceof Date
          ? row.journeyDate.toISOString().split("T")[0]
          : String(row.journeyDate);

      return {
        tripId: row.tripId,
        serviceId: row.serviceId,
        journeyDate: journeyDateStr,
        serviceNumber: row.serviceNumber || `SVC-${row.tripId}`,
        serviceName: row.serviceName || "Unknown Service",
        route: `${row.sourceId} → ${row.destinationId}`,
        source: String(row.sourceId),
        destination: String(row.destinationId),
        departureTime: "—",
        leadTime: computeLeadTime(journeyDateStr),
        dayType: getDayType(journeyDateStr),
        totalSeats,
        bookedSeats,
        availableSeats: Number(row.availableSeats) || 0,
        currentOccupancy:
          totalSeats > 0 ? Math.round((bookedSeats / totalSeats) * 100) : 0,
        occDelta5m: 0,
        occDelta15m: 0,
        asp,
        epk: row.kilometers
          ? Math.round((asp / Number(row.kilometers)) * 10) / 10
          : 0,
        currentClassification: row.fareClassification || "NORMAL",
        busAdjPct: 0,
        agentRecommendation: null,
        confidence: null,
        risk: "low",
        lastAgentRun: null,
        lastChange: null,
        minFare: row.minFare ? Math.round(Number(row.minFare)) : null,
        maxFare: row.maxFare ? Math.round(Number(row.maxFare)) : null,
      };
    });

    // Post-query filter for dayType (computed from journeyDate)
    if (dayTypeFilter) {
      rows = rows.filter(
        (r) => r.dayType.toLowerCase() === dayTypeFilter.toLowerCase()
      );
    }

    const total = rows.length;
    const summary = {
      total,
      needingAction: rows.filter(
        (r) => r.agentRecommendation && r.agentRecommendation !== "hold"
      ).length,
      avgOccupancy:
        total > 0
          ? Math.round(
              rows.reduce((s, r) => s + r.currentOccupancy, 0) / total
            )
          : 0,
      avgAsp:
        total > 0
          ? Math.round(rows.reduce((s, r) => s + r.asp, 0) / total)
          : 0,
      highRisk: rows.filter((r) => r.risk === "high").length,
    };

    return NextResponse.json({ summary, rows });
  } catch (err) {
    console.error("[fleet/route] Postgres error, falling back to mock:", err);

    const mockRows = Array.from({ length: 20 }, (_, i) => mockRow(i));
    const total = mockRows.length;
    const summary = {
      total,
      needingAction: mockRows.filter(
        (r) => r.agentRecommendation && r.agentRecommendation !== "hold"
      ).length,
      avgOccupancy: Math.round(
        mockRows.reduce((s, r) => s + r.currentOccupancy, 0) / total
      ),
      avgAsp: Math.round(
        mockRows.reduce((s, r) => s + r.asp, 0) / total
      ),
      highRisk: mockRows.filter((r) => r.risk === "high").length,
    };

    return NextResponse.json({ summary, rows: mockRows, _isMock: true });
  }
}
