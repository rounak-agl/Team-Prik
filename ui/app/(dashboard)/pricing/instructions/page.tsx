"use client";

import { useState } from "react";
import { useAllInstructions } from "@/hooks/usePricingInstructions";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { format, isAfter, addHours } from "date-fns";

const STATUS_TABS = [
  { label: "All", value: "" },
  { label: "Active", value: "active" },
  { label: "Used", value: "used_by_agent" },
  { label: "Expired", value: "expired" },
  { label: "Disabled", value: "disabled" },
];

const SCOPE_OPTIONS = [
  { label: "All", value: "" },
  { label: "Route-Date", value: "route_date" },
  { label: "Service", value: "service" },
  { label: "Time Band", value: "time_band" },
  { label: "Permanent", value: "permanent" },
];

function statusBadge(status: string) {
  const map: Record<string, string> = {
    active: "bg-green-500/20 text-green-400 border-green-500/30",
    used_by_agent: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
    draft: "bg-slate-500/20 text-slate-400 border-slate-500/30",
    expired: "bg-slate-700/40 text-slate-500 border-slate-700/30",
    disabled: "bg-red-500/20 text-red-400 border-red-500/30",
    requires_approval: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  };
  return map[status] ?? "bg-slate-500/20 text-slate-400 border-slate-500/30";
}

function typeBadge(type: string) {
  const map: Record<string, string> = {
    demand_override: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    pricing_guardrail: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    occupancy_target: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    service_strategy: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    manual_freeze: "bg-red-500/20 text-red-400 border-red-500/30",
    escalation_rule: "bg-rose-500/20 text-rose-400 border-rose-500/30",
  };
  return map[type] ?? "bg-slate-500/20 text-slate-400 border-slate-500/30";
}

function SkeletonRow() {
  return (
    <tr className="border-b border-slate-800 animate-pulse">
      {[...Array(7)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-slate-800 rounded w-full" />
        </td>
      ))}
    </tr>
  );
}

export default function InstructionsPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [scopeFilter, setScopeFilter] = useState("");
  const [routeSearch, setRouteSearch] = useState("");
  const [routeInput, setRouteInput] = useState("");

  const { data, isLoading } = useAllInstructions({
    status: statusFilter || undefined,
    scope: scopeFilter || undefined,
    routeId: routeSearch || undefined,
  });

  const instructions: any[] = data?.instructions ?? [];

  const now = new Date();
  const totalActive = instructions.filter((i) => i.status === "active").length;
  const requireApproval = instructions.filter((i) => i.status === "requires_approval").length;
  const expiringToday = instructions.filter((i) => {
    if (!i.expiresAt) return false;
    const exp = new Date(i.expiresAt);
    return isAfter(exp, now) && !isAfter(exp, addHours(now, 2));
  }).length;
  const usedThisCycle = instructions.filter((i) => i.status === "used_by_agent").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-100">Instructions Library</h1>
        <p className="text-slate-400 text-sm mt-1">
          All active pricing instructions across routes and dates
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Active", value: totalActive, color: "text-green-400" },
          { label: "Requiring Approval", value: requireApproval, color: "text-yellow-400" },
          { label: "Expiring Soon", value: expiringToday, color: "text-red-400" },
          { label: "Used This Cycle", value: usedThisCycle, color: "text-indigo-400" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-slate-900 border border-slate-800 rounded-xl p-4"
          >
            <div className={`text-2xl font-black ${stat.color}`}>{stat.value}</div>
            <div className="text-slate-400 text-xs mt-1 font-semibold">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        {/* Status tabs */}
        <div className="flex gap-1 flex-wrap">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                statusFilter === tab.value
                  ? "bg-slate-700 text-slate-100"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex gap-3 flex-wrap items-center">
          {/* Scope filter */}
          <div className="flex gap-1 flex-wrap">
            {SCOPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setScopeFilter(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  scopeFilter === opt.value
                    ? "bg-slate-700 text-slate-100"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {/* Route search */}
          <div className="flex gap-2 ml-auto">
            <Input
              placeholder="Search route ID..."
              value={routeInput}
              onChange={(e) => setRouteInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setRouteSearch(routeInput)}
              className="w-48 bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 text-xs h-8"
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
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                {["Instruction", "Type", "Scope", "Route / Date", "Status", "Priority", "Expires At"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                [...Array(5)].map((_, i) => <SkeletonRow key={i} />)}
              {!isLoading && instructions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-slate-400 text-sm">
                    No instructions found. Add instructions from a Pricing Room chat.
                  </td>
                </tr>
              )}
              {!isLoading &&
                instructions.map((inst: any) => {
                  const expiresAt = inst.expiresAt ? new Date(inst.expiresAt) : null;
                  const expiringSoon =
                    expiresAt && isAfter(expiresAt, now) && !isAfter(expiresAt, addHours(now, 2));
                  const routeDate = inst.room?.journeyDate ?? inst.journeyDate ?? "-";
                  const routeLabel = inst.routeId ?? "-";

                  return (
                    <tr
                      key={inst.id}
                      className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-4 py-3 max-w-xs">
                        <span
                          className="text-slate-100 cursor-default"
                          title={inst.instruction}
                        >
                          {inst.instruction?.length > 80
                            ? inst.instruction.slice(0, 80) + "…"
                            : inst.instruction}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${typeBadge(inst.instructionType)}`}
                        >
                          {inst.instructionType?.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-slate-300 text-xs font-semibold">
                          {inst.scope?.replace(/_/g, " ") ?? "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-100 text-xs font-semibold">{routeLabel}</div>
                        <div className="text-slate-500 text-xs">{routeDate}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${statusBadge(inst.status)}`}
                        >
                          {inst.status?.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-xs font-semibold">
                        {inst.priority ?? "-"}
                      </td>
                      <td className="px-4 py-3">
                        {expiresAt ? (
                          <span
                            className={`text-xs font-semibold ${expiringSoon ? "text-red-400" : "text-slate-400"}`}
                          >
                            {format(expiresAt, "dd MMM, HH:mm")}
                          </span>
                        ) : (
                          <span className="text-slate-600 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
