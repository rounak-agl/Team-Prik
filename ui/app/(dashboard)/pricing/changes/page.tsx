"use client";

import { useState } from "react";
import { useAllChangeBatches } from "@/hooks/usePricingChanges";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import Link from "next/link";

const STATUS_OPTIONS = [
  { label: "All", value: "" },
  { label: "Applied", value: "applied" },
  { label: "Failed", value: "failed" },
  { label: "Rejected", value: "rejected" },
];

function statusBadge(status: string) {
  const map: Record<string, string> = {
    applied: "bg-green-500/20 text-green-400 border-green-500/30",
    failed: "bg-red-500/20 text-red-400 border-red-500/30",
    rejected: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    partial: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  };
  return map[status] ?? "bg-slate-500/20 text-slate-400 border-slate-500/30";
}

function BatchCard({ batch }: { batch: any }) {
  const [expanded, setExpanded] = useState(false);
  const items: any[] = batch.items ?? [];
  const totalItems = batch.totalItems ?? items.length;

  const decreases = items.filter(
    (i) => (i.afterEffectiveFare ?? 0) < (i.beforeEffectiveFare ?? 0)
  ).length;
  const increases = items.filter(
    (i) => (i.afterEffectiveFare ?? 0) > (i.beforeEffectiveFare ?? 0)
  ).length;
  const failed = items.filter((i) => i.writerStatus === "failed").length;

  const title = batch.room?.title ?? `${batch.room?.source ?? ""} → ${batch.room?.destination ?? ""}`;
  const createdAt = batch.createdAt ? new Date(batch.createdAt) : null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      {/* Batch header */}
      <div className="flex items-start justify-between p-4 gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black text-slate-100 text-sm">{title}</span>
            <span className="text-slate-500 text-xs">
              {batch.journeyDate ?? "—"}
            </span>
            {createdAt && (
              <span className="text-slate-500 text-xs">
                {format(createdAt, "hh:mm a")}
              </span>
            )}
          </div>
          <div className="text-slate-400 text-xs mt-1">
            {totalItems} changes —{" "}
            <span className="text-blue-400">{decreases} ↓ decreases</span>,{" "}
            <span className="text-green-400">{increases} ↑ increases</span>,{" "}
            <span className={failed > 0 ? "text-red-400" : "text-slate-500"}>
              {failed} failed
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${statusBadge(batch.status)}`}
          >
            {batch.status}
          </span>
          {batch.roomId && (
            <Link href={`/pricing/rooms/${batch.roomId}`}>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                Open Room
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Preview items */}
      {items.length > 0 && (
        <div className="border-t border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-800">
                  {["Service", "Before", "After", "Reason"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(expanded ? items : items.slice(0, 3)).map((item: any, idx: number) => (
                  <tr
                    key={idx}
                    className="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-4 py-2 text-slate-300 font-semibold">
                      {item.serviceNumber ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-slate-400">
                      <div>{item.beforeClassification ?? "—"}</div>
                      {item.beforeEffectiveFare != null && (
                        <div className="text-slate-500">₹{item.beforeEffectiveFare}</div>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div
                        className={
                          item.afterEffectiveFare > item.beforeEffectiveFare
                            ? "text-green-400"
                            : item.afterEffectiveFare < item.beforeEffectiveFare
                            ? "text-blue-400"
                            : "text-slate-300"
                        }
                      >
                        {item.afterClassification ?? "—"}
                      </div>
                      {item.afterEffectiveFare != null && (
                        <div className="text-slate-500">₹{item.afterEffectiveFare}</div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-400 max-w-xs">
                      <span title={item.reasonToChange}>
                        {item.reasonToChange?.length > 60
                          ? item.reasonToChange.slice(0, 60) + "…"
                          : item.reasonToChange ?? "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalItems > 3 && (
            <div className="px-4 py-2 flex items-center gap-3">
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
              >
                {expanded ? "Show less" : `View all ${totalItems} changes`}
              </button>
              <Link
                href={`/pricing/change-batches/${batch.id}/items`}
                className="text-xs text-slate-500 hover:text-slate-300"
              >
                Open full view →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ChangeHistoryPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [routeInput, setRouteInput] = useState("");
  const [routeSearch, setRouteSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  const { data, isLoading } = useAllChangeBatches({
    routeId: routeSearch || undefined,
    date: dateFilter || undefined,
    status: statusFilter || undefined,
  });

  const batches: any[] = data?.batches ?? [];
  const today = new Date().toISOString().slice(0, 10);

  const totalToday = batches.filter(
    (b) => b.journeyDate === today || b.createdAt?.slice(0, 10) === today
  ).length;
  const successful = batches.filter((b) => b.status === "applied").length;
  const failed = batches.filter((b) => b.status === "failed").length;
  const classificationChanges = batches.reduce((acc: number, b: any) => {
    return (
      acc +
      (b.items ?? []).filter(
        (i: any) => i.beforeClassification !== i.afterClassification
      ).length
    );
  }, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-100">Change History</h1>
        <p className="text-slate-400 text-sm mt-1">
          All pricing changes applied by the agent
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Changes Today", value: totalToday, color: "text-slate-100" },
          { label: "Successful Applies", value: successful, color: "text-green-400" },
          { label: "Failed Applies", value: failed, color: "text-red-400" },
          { label: "Classification Changes", value: classificationChanges, color: "text-indigo-400" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className={`text-2xl font-black ${kpi.color}`}>{kpi.value}</div>
            <div className="text-slate-400 text-xs mt-1 font-semibold">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex gap-3 flex-wrap items-center">
        {/* Status tabs */}
        <div className="flex gap-1">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                statusFilter === opt.value
                  ? "bg-slate-700 text-slate-100"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 ml-auto items-center flex-wrap">
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-100 rounded-lg text-xs px-3 h-8 focus:outline-none focus:ring-1 focus:ring-slate-600"
          />
          {dateFilter && (
            <button
              onClick={() => setDateFilter("")}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Clear date
            </button>
          )}
          <Input
            placeholder="Search route ID..."
            value={routeInput}
            onChange={(e) => setRouteInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setRouteSearch(routeInput)}
            className="w-44 bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 text-xs h-8"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRouteSearch(routeInput)}
            className="h-8 border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
          >
            Search
          </Button>
          {routeSearch && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setRouteSearch(""); setRouteInput(""); }}
              className="h-8 text-slate-400 text-xs"
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Batches list */}
      <div className="space-y-4">
        {isLoading &&
          [...Array(4)].map((_, i) => (
            <div
              key={i}
              className="bg-slate-900 border border-slate-800 rounded-xl p-4 animate-pulse"
            >
              <div className="h-4 bg-slate-800 rounded w-1/3 mb-2" />
              <div className="h-3 bg-slate-800 rounded w-1/2" />
            </div>
          ))}
        {!isLoading && batches.length === 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-16 text-center">
            <p className="text-slate-400 text-sm">
              No change history yet. Changes will appear here after the agent runs.
            </p>
          </div>
        )}
        {!isLoading && batches.map((batch: any) => <BatchCard key={batch.id} batch={batch} />)}
      </div>
    </div>
  );
}
