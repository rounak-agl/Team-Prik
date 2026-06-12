"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFleetMonitor, FleetFilters } from "@/hooks/useFleetMonitor";
import { ClassificationBadge } from "@/components/pricing/badges/ClassificationBadge";
import { RiskBadge } from "@/components/pricing/badges/RiskBadge";
import { ConfidenceBadge } from "@/components/pricing/badges/ConfidenceBadge";
import { DayTypeBadge } from "@/components/pricing/badges/DayTypeBadge";
import { BusAdjustmentBadge } from "@/components/pricing/badges/BusAdjustmentBadge";
import { RouteDateSelector } from "@/components/pricing/RouteDateSelector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


/* ---------- helpers ---------- */

function fmt(v: number | null | undefined, prefix = "") {
  if (v == null) return "—";
  return `${prefix}${v.toLocaleString("en-IN")}`;
}

function fmtINR(v: number | null | undefined) {
  return fmt(v, "₹");
}

function DeltaCell({ value }: { value: number | null | undefined }) {
  if (value == null || value === 0)
    return <span className="text-muted-foreground">—</span>;
  if (value > 0)
    return (
      <span className="text-emerald-600 font-medium">▲ +{value}</span>
    );
  return <span className="text-red-500 font-medium">▼ {value}</span>;
}

function OccCell({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  const pct = Math.min(100, Math.max(0, value));
  const color =
    pct >= 90
      ? "bg-red-500"
      : pct >= 70
      ? "bg-amber-500"
      : pct >= 40
      ? "bg-emerald-500"
      : "bg-blue-400";
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums w-8 text-right">{pct}%</span>
    </div>
  );
}

function today() {
  return new Date().toISOString().split("T")[0];
}

function plusDays(d: string, n: number) {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + n);
  return dt.toISOString().split("T")[0];
}

/* ---------- KPI Cards ---------- */

interface KpiCardProps {
  title: string;
  value: string | number;
  sub?: string;
}

function KpiCard({ title, value, sub }: KpiCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-1 pt-4 px-4">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4 px-4">
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

/* ---------- FleetMonitorPage ---------- */

export function FleetMonitorPage() {
  const router = useRouter();
  const defaultFrom = today();
  const defaultTo = plusDays(today(), 14);

  const [filters, setFilters] = useState<FleetFilters>({
    dateFrom: defaultFrom,
    dateTo: defaultTo,
  });

  const [routeInput, setRouteInput] = useState("");
  const [sourceInput, setSourceInput] = useState("");
  const [destInput, setDestInput] = useState("");
  const [svcSearch, setSvcSearch] = useState("");
  const [openRoomDialog, setOpenRoomDialog] = useState(false);

  const { data, isLoading, error } = useFleetMonitor(filters);
  const rows: FleetRow[] = data?.data ?? data ?? [];

  /* client-side secondary filter on free-text fields */
  const filtered = useMemo(() => {
    if (!Array.isArray(rows)) return [];
    let r = rows;
    if (routeInput)
      r = r.filter((x) =>
        x.route?.toLowerCase().includes(routeInput.toLowerCase())
      );
    if (sourceInput)
      r = r.filter((x) =>
        x.route?.toLowerCase().startsWith(sourceInput.toLowerCase())
      );
    if (destInput)
      r = r.filter((x) =>
        x.route?.toLowerCase().includes(destInput.toLowerCase())
      );
    if (svcSearch)
      r = r.filter(
        (x) =>
          x.serviceNumber?.toLowerCase().includes(svcSearch.toLowerCase()) ||
          x.serviceName?.toLowerCase().includes(svcSearch.toLowerCase())
      );
    return r;
  }, [rows, routeInput, sourceInput, destInput, svcSearch]);

  /* KPIs */
  const total = filtered.length;
  const needsAction = filtered.filter((x) => x.agentRecommendation != null).length;
  const changed = filtered.filter((x) => x.lastChange != null).length;
  const escalated = filtered.filter((x) => x.risk === "CRITICAL").length;
  const avgOcc =
    total > 0
      ? Math.round(
          filtered.reduce((s, x) => s + (x.currentOccupancy ?? 0), 0) / total
        )
      : 0;
  const avgAsp =
    total > 0
      ? Math.round(filtered.reduce((s, x) => s + (x.asp ?? 0), 0) / total)
      : 0;
  const avgEpk =
    total > 0
      ? (filtered.reduce((s, x) => s + (x.epk ?? 0), 0) / total).toFixed(2)
      : "—";
  const highRisk = filtered.filter(
    (x) => x.risk === "HIGH" || x.risk === "CRITICAL"
  ).length;

  function setFilter(k: keyof FleetFilters, v: string | null) {
    const val = v === "all" || v == null ? undefined : v || undefined;
    setFilters((prev) => ({ ...prev, [k]: val }));
  }

  function clearFilters() {
    setFilters({ dateFrom: defaultFrom, dateTo: defaultTo });
    setRouteInput("");
    setSourceInput("");
    setDestInput("");
    setSvcSearch("");
  }

  function openRoomForRow(row: FleetRow) {
    const route = row.route ?? "";
    const date = row.journeyDate ?? today();
    router.push(`/pricing/rooms?route=${encodeURIComponent(route)}&date=${date}`);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Fleet Monitor</h1>
          <p className="text-sm text-muted-foreground mt-1">
            All services monitored by the pricing agent
          </p>
        </div>
        <Button onClick={() => setOpenRoomDialog(true)}>
          Open Route-Date Chat
        </Button>
      </div>

      {/* KPI Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KpiCard title="Services" value={total} sub="monitored" />
          <KpiCard title="Needs Action" value={needsAction} sub="with recommendation" />
          <KpiCard title="Changed" value={changed} sub="last cycle" />
          <KpiCard title="Escalated" value={escalated} sub="critical risk" />
          <KpiCard title="Avg Occupancy" value={`${avgOcc}%`} />
          <KpiCard title="Avg ASP" value={fmtINR(avgAsp)} />
          <KpiCard title="Avg EPK" value={avgEpk !== "—" ? `₹${avgEpk}` : "—"} />
          <KpiCard title="High Risk" value={highRisk} sub="high + critical" />
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-card border rounded-xl p-4 sticky top-[60px] z-10 shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">From</Label>
            <Input
              type="date"
              value={filters.dateFrom ?? defaultFrom}
              onChange={(e) => setFilter("dateFrom", e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To</Label>
            <Input
              type="date"
              value={filters.dateTo ?? defaultTo}
              onChange={(e) => setFilter("dateTo", e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Route</Label>
            <Input
              placeholder="e.g. BLR-MYS"
              value={routeInput}
              onChange={(e) => setRouteInput(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Source</Label>
            <Input
              placeholder="BLR"
              value={sourceInput}
              onChange={(e) => setSourceInput(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Destination</Label>
            <Input
              placeholder="MYS"
              value={destInput}
              onChange={(e) => setDestInput(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Service</Label>
            <Input
              placeholder="Search…"
              value={svcSearch}
              onChange={(e) => setSvcSearch(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Lead Time</Label>
            <Select
              value={filters.leadTimeBucket ?? "all"}
              onValueChange={(v) => setFilter("leadTimeBucket", v)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="0-2h">0–2 h</SelectItem>
                <SelectItem value="2-6h">2–6 h</SelectItem>
                <SelectItem value="6-24h">6–24 h</SelectItem>
                <SelectItem value="24h+">24 h+</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Day Type</Label>
            <Select
              value={filters.dayType ?? "all"}
              onValueChange={(v) => setFilter("dayType", v)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="WEEKDAY">Weekday</SelectItem>
                <SelectItem value="WEEKEND">Weekend</SelectItem>
                <SelectItem value="HOLIDAY">Holiday</SelectItem>
                <SelectItem value="FESTIVAL">Festival</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Risk</Label>
            <Select
              value={filters.riskLevel ?? "all"}
              onValueChange={(v) => setFilter("riskLevel", v)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="CRITICAL">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Action Status</Label>
            <Select
              value={filters.actionStatus ?? "all"}
              onValueChange={(v) => setFilter("actionStatus", v)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="CHANGED">Changed</SelectItem>
                <SelectItem value="ESCALATED">Escalated</SelectItem>
                <SelectItem value="FROZEN">Frozen</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end col-span-2 sm:col-span-1">
            <Button variant="ghost" size="sm" className="h-8 text-xs w-full" onClick={clearFilters}>
              Clear Filters
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-muted/60 backdrop-blur">
              <TableRow>
                <TableHead className="whitespace-nowrap">Date</TableHead>
                <TableHead className="whitespace-nowrap">Route</TableHead>
                <TableHead className="whitespace-nowrap">Svc #</TableHead>
                <TableHead className="whitespace-nowrap">Service Name</TableHead>
                <TableHead className="whitespace-nowrap">Dep</TableHead>
                <TableHead className="whitespace-nowrap">Lead</TableHead>
                <TableHead className="whitespace-nowrap">Day Type</TableHead>
                <TableHead className="whitespace-nowrap">Occ %</TableHead>
                <TableHead className="whitespace-nowrap">Δ5m</TableHead>
                <TableHead className="whitespace-nowrap">Δ15m</TableHead>
                <TableHead className="whitespace-nowrap">ASP</TableHead>
                <TableHead className="whitespace-nowrap">EPK</TableHead>
                <TableHead className="whitespace-nowrap">Class.</TableHead>
                <TableHead className="whitespace-nowrap">Bus Adj</TableHead>
                <TableHead className="whitespace-nowrap">Recommendation</TableHead>
                <TableHead className="whitespace-nowrap">Confidence</TableHead>
                <TableHead className="whitespace-nowrap">Risk</TableHead>
                <TableHead className="whitespace-nowrap">Last Run</TableHead>
                <TableHead className="whitespace-nowrap">Last Change</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 20 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : filtered.length === 0
                ? (
                    <TableRow>
                      <TableCell
                        colSpan={20}
                        className="text-center py-16 text-muted-foreground"
                      >
                        {error ? "Failed to load fleet data." : "No services found."}
                      </TableCell>
                    </TableRow>
                  )
                : filtered.map((row) => (
                    <TableRow
                      key={row.tripId ?? `${row.journeyDate}-${row.serviceNumber}`}
                      className="cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => openRoomForRow(row)}
                    >
                      <TableCell className="whitespace-nowrap text-xs">
                        {row.journeyDate}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-medium text-sm">
                        {row.route}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs">
                        {row.serviceNumber}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs max-w-[140px] truncate">
                        {row.serviceName}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs tabular-nums">
                        {row.departureTime}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs tabular-nums">
                        {row.leadTime}
                      </TableCell>
                      <TableCell>
                        {row.dayType ? (
                          <DayTypeBadge dayType={row.dayType} />
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="min-w-[100px]">
                        <OccCell value={row.currentOccupancy} />
                      </TableCell>
                      <TableCell className="text-xs">
                        <DeltaCell value={row.occDelta5m} />
                      </TableCell>
                      <TableCell className="text-xs">
                        <DeltaCell value={row.occDelta15m} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs tabular-nums">
                        {fmtINR(row.asp)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs tabular-nums">
                        {fmtINR(row.epk)}
                      </TableCell>
                      <TableCell>
                        {row.currentClassification ? (
                          <ClassificationBadge classification={row.currentClassification} />
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.busAdjPct != null ? (
                          <BusAdjustmentBadge adjustment={row.busAdjPct} />
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs max-w-[160px] truncate">
                        {row.agentRecommendation ?? (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.confidence ? (
                          <ConfidenceBadge confidence={row.confidence} />
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.risk ? (
                          <RiskBadge risk={row.risk} />
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {row.lastAgentRun
                          ? new Date(row.lastAgentRun).toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {row.lastChange
                          ? new Date(row.lastChange).toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted transition-colors">
                            <span className="text-lg leading-none">⋮</span>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => openRoomForRow(row)}
                            >
                              Open Chat
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openRoomForRow(row)}
                            >
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>Approve</DropdownMenuItem>
                            <DropdownMenuItem>Reject</DropdownMenuItem>
                            <DropdownMenuItem>Freeze</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">
                              Escalate
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <RouteDateSelector
        open={openRoomDialog}
        onOpenChange={setOpenRoomDialog}
      />
    </div>
  );
}

/* ---------- local type for row ---------- */

interface FleetRow {
  journeyDate?: string;
  route?: string;
  serviceNumber?: string;
  serviceName?: string;
  departureTime?: string;
  leadTime?: string;
  dayType?: string;
  currentOccupancy?: number;
  occDelta5m?: number;
  occDelta15m?: number;
  asp?: number;
  epk?: number;
  currentClassification?: string;
  busAdjPct?: number;
  agentRecommendation?: string | null;
  confidence?: number;
  risk?: string;
  lastAgentRun?: string;
  lastChange?: string;
  tripId?: string;
}
