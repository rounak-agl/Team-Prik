"use client";

import { useEffect, useState } from "react";
import { Bot, ArrowRight, CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";

/* ── Types ─────────────────────────────────────────────────────── */
interface ChangeItem {
  serviceNumber: string | null;
  serviceId: string;
  beforeClassification: string | null;
  afterClassification: string | null;
  beforeBusAdjPct: number | null;
  afterBusAdjPct: number | null;
  beforeEffectiveFare: number | null;
  afterEffectiveFare: number | null;
  reasonToChange: string;
  agentConfidence: number | null;
  riskLevel: string | null;
  writerStatus: string | null;
}

interface Batch {
  id: string;
  cycleId: string | null;
  routeId: string | null;
  journeyDate: string | null;
  changeCount: number;
  increaseCount: number;
  decreaseCount: number;
  failedCount: number;
  status: string;
  createdAt: string;
  room: { title: string; source: string | null; destination: string | null; journeyDate: string } | null;
  _count: { items: number };
  items: ChangeItem[];
}

interface Stats {
  totalItems: number;
  appliedItems: number;
  failedItems: number;
  batches: number;
}

interface ApiData {
  stats: Stats;
  batches: Batch[];
}

/* ── Helpers ────────────────────────────────────────────────────── */
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtINR(v: number | null | undefined) {
  if (v == null) return "—";
  return `₹${v.toLocaleString("en-IN")}`;
}

function StatusPill({ status }: { status: string | null }) {
  const s = status || "pending";
  const map: Record<string, string> = {
    applied: "bg-emerald-900/60 text-emerald-300 border-emerald-700",
    failed: "bg-red-900/60 text-red-300 border-red-700",
    pending: "bg-amber-900/60 text-amber-300 border-amber-700",
    blocked: "bg-slate-800 text-slate-400 border-slate-700",
  };
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${map[s] || map.pending}`}>
      {s.toUpperCase()}
    </span>
  );
}

function RiskPill({ risk }: { risk: string | null }) {
  if (!risk) return null;
  const map: Record<string, string> = {
    low: "text-emerald-400",
    medium: "text-amber-400",
    high: "text-red-400",
  };
  return <span className={`text-xs font-medium ${map[risk.toLowerCase()] || "text-slate-400"}`}>{risk}</span>;
}

/* ── Pipeline Banner ─────────────────────────────────────────────── */
function AgentStatusBanner() {
  const steps = ["Collector", "Planner", "PricingAgent", "Reasoner", "Validator", "Writer"];
  return (
    <div className="bg-slate-900 border border-slate-800 border-l-4 border-l-indigo-500 rounded-xl p-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="text-sm font-semibold text-white">Agent Active</span>
          <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">Mode: Recommendation Only</span>
        </div>
        <div className="text-xs text-slate-500">
          <span className="text-slate-400">Last run:</span> — (no cycles yet) &nbsp;·&nbsp;
          <span className="text-slate-400">Next:</span> ~5 min
        </div>
      </div>
      <div className="mt-3 flex items-center flex-wrap gap-1">
        {steps.map((step, i) => (
          <div key={step} className="flex items-center gap-1">
            <span className="text-xs font-medium bg-indigo-900/50 border border-indigo-700/50 text-indigo-300 px-2 py-0.5 rounded">
              {step}
            </span>
            {i < steps.length - 1 && <ArrowRight className="h-3 w-3 text-slate-600 shrink-0" />}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Stats Row ───────────────────────────────────────────────────── */
function StatsRow({ stats }: { stats: Stats }) {
  const cards = [
    { label: "Total Decisions", value: stats.totalItems, icon: Bot, color: "text-indigo-400" },
    { label: "Applied", value: stats.appliedItems, icon: CheckCircle2, color: "text-emerald-400" },
    { label: "Failed", value: stats.failedItems, icon: XCircle, color: "text-red-400" },
    { label: "Pending Review", value: stats.totalItems - stats.appliedItems - stats.failedItems, icon: Clock, color: "text-amber-400" },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map(({ label, value, icon: Icon, color }) => (
        <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Icon className={`h-4 w-4 ${color}`} />
            <span className="text-xs text-slate-400 font-medium">{label}</span>
          </div>
          <div className="text-2xl font-black text-white tabular-nums">{value}</div>
        </div>
      ))}
    </div>
  );
}

/* ── Batch Card ──────────────────────────────────────────────────── */
function BatchCard({ batch }: { batch: Batch }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-5 py-4 hover:bg-slate-800/40 transition-colors"
      >
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="font-semibold text-white text-sm">
              {batch.room?.title || batch.routeId || "Unknown Route"}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {batch.journeyDate} · Cycle: {batch.cycleId?.slice(0, 8) || "—"} · {fmtDate(batch.createdAt)} {fmtTime(batch.createdAt)}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <span className="text-xs text-slate-400">{batch._count.items} items</span>
            <span className="text-xs text-emerald-400">▲ {batch.increaseCount}</span>
            <span className="text-xs text-red-400">▼ {batch.decreaseCount}</span>
            {batch.failedCount > 0 && <span className="text-xs text-red-400">{batch.failedCount} failed</span>}
            <StatusPill status={batch.status} />
          </div>
        </div>
      </button>

      {expanded && batch.items.length > 0 && (
        <div className="border-t border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-950 text-slate-500">
                  <th className="px-4 py-2 text-left font-medium">Service</th>
                  <th className="px-4 py-2 text-left font-medium">Classification</th>
                  <th className="px-4 py-2 text-left font-medium">Bus Adj</th>
                  <th className="px-4 py-2 text-left font-medium">Fare</th>
                  <th className="px-4 py-2 text-left font-medium">Confidence</th>
                  <th className="px-4 py-2 text-left font-medium">Risk</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  <th className="px-4 py-2 text-left font-medium">Reason</th>
                </tr>
              </thead>
              <tbody>
                {batch.items.map((item, idx) => (
                  <tr key={idx} className="border-t border-slate-800/50 hover:bg-slate-800/20">
                    <td className="px-4 py-2.5 font-mono text-slate-300">{item.serviceNumber || item.serviceId.slice(0, 8)}</td>
                    <td className="px-4 py-2.5">
                      {item.beforeClassification && item.afterClassification ? (
                        <span className="flex items-center gap-1 text-slate-300">
                          <span className="text-slate-500">{item.beforeClassification}</span>
                          <ArrowRight className="h-3 w-3 text-slate-600" />
                          <span className="text-indigo-300 font-medium">{item.afterClassification}</span>
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-300">
                      {item.beforeBusAdjPct != null && item.afterBusAdjPct != null
                        ? `${item.beforeBusAdjPct}% → ${item.afterBusAdjPct}%`
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-300">
                      {fmtINR(item.beforeEffectiveFare)} → {fmtINR(item.afterEffectiveFare)}
                    </td>
                    <td className="px-4 py-2.5">
                      {item.agentConfidence != null
                        ? <span className="text-indigo-300">{Math.round(item.agentConfidence * 100)}%</span>
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5"><RiskPill risk={item.riskLevel} /></td>
                    <td className="px-4 py-2.5"><StatusPill status={item.writerStatus} /></td>
                    <td className="px-4 py-2.5 text-slate-400 max-w-[200px] truncate" title={item.reasonToChange}>
                      {item.reasonToChange}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Empty State ─────────────────────────────────────────────────── */
function EmptyState() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
      <Bot className="h-10 w-10 text-slate-600 mx-auto mb-3" />
      <div className="text-white font-semibold mb-1">No decisions recorded yet.</div>
      <div className="text-sm text-slate-400 mb-4">
        The agent hasn&apos;t run through this UI yet.
      </div>
      <div className="bg-slate-950 border border-slate-700 rounded-lg p-3 inline-block text-left">
        <div className="text-xs text-slate-500 mb-1 font-medium">Start the Python agent with:</div>
        <code className="text-sm text-emerald-400 font-mono">python run.py</code>
      </div>
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────────────── */
export default function AgentDecisionsPage() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/pricing/decisions")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white">Agent Decisions</h1>
        <p className="text-sm text-slate-400 mt-1">All pricing recommendations and actions from the agent pipeline.</p>
      </div>

      {/* Agent Status Banner */}
      <AgentStatusBanner />

      {/* Stats */}
      {data && <StatsRow stats={data.stats} />}
      {loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4 h-[76px] animate-pulse" />
          ))}
        </div>
      )}

      {/* Batches */}
      <div>
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Recent Decision Batches</h2>
        {loading && (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl h-[72px] animate-pulse" />
            ))}
          </div>
        )}
        {error && (
          <div className="bg-red-950/40 border border-red-800 rounded-xl p-4 flex items-center gap-2 text-red-300 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Failed to load decisions: {error}
          </div>
        )}
        {data && data.batches.length === 0 && <EmptyState />}
        {data && data.batches.length > 0 && (
          <div className="space-y-3">
            {data.batches.map((batch) => (
              <BatchCard key={batch.id} batch={batch} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
