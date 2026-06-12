export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const journeyDate = searchParams.get("journeyDate");
  const sourceId = searchParams.get("sourceId");
  const destinationId = searchParams.get("destinationId");

  if (!journeyDate || !sourceId || !destinationId) {
    return Response.json({ error: "Missing params" }, { status: 400 });
  }

  const customerUrl = process.env.CUSTOMER_URL || "https://api-stage.freshbus.com";
  const url = `${customerUrl}/trips?journey_date=${journeyDate}&source_id=${sourceId}&destination_id=${destinationId}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return Response.json({ trips: [] });
    const data = await res.json();
    return Response.json({ trips: Array.isArray(data) ? data : data.trips ?? [] });
  } catch {
    return Response.json({ trips: [] });
  }
}
