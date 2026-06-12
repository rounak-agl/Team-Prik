"use client";

import { useState } from "react";
import { Settings, Shield, Bot, Database, AlertTriangle, CheckCircle2, Info } from "lucide-react";

/* ── Toast ───────────────────────────────────────────────────────── */
function useToast() {
  const [visible, setVisible] = useState(false);
  const show = () => {
    setVisible(true);
    setTimeout(() => setVisible(false), 2500);
  };
  return { visible, show };
}

function Toast({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 bg-slate-800 border border-slate-700 text-white text-sm px-4 py-3 rounded-xl shadow-xl flex items-center gap-2">
      <Info className="h-4 w-4 text-indigo-400" />
      Editing guardrails is coming soon.
    </div>
  );
}

/* ── Types ─────────────────────────────────────────────────────── */
type TabKey = "guardrails" | "agent" | "system" | "negadj";

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "guardrails", label: "Guardrails",       icon: Shield   },
  { key: "agent",      label: "Agent Config",     icon: Bot      },
  { key: "system",     label: "System Info",      icon: Database },
  { key: "negadj",     label: "Neg Adj Warning",  icon: AlertTriangle },
];

/* ── Guardrails Tab ──────────────────────────────────────────────── */
const GUARDRAILS = [
  { name: "Min Classification",      default: "LOW_DEMAND",  status: "Active" },
  { name: "Max Classification",      default: "SUPER_HIGH",  status: "Active" },
  { name: "Bus Adjustment Limit",    default: "±20%",        status: "Active" },
  { name: "EPK Floor",               default: "₹80",         status: "Active" },
  { name: "ASP Floor",               default: "₹500",        status: "Active" },
  { name: "Cooldown Period",         default: "15 min",      status: "Active" },
  { name: "Max Classification Jump", default: "1 level",     status: "Active" },
  { name: "Booked Seat Protection",  default: "Enabled",     status: "Active" },
  { name: "Static Fare Protection",  default: "Enabled",     status: "Active" },
];

function GuardrailsTab({ onEdit }: { onEdit: () => void }) {
  return (
    <div className="space-y-4">
      <div className="bg-amber-950/30 border border-amber-700/60 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-200">
          <span className="font-semibold">Negative bus fare adjustment is not confirmed by admin API.</span>{" "}
          Downward price actions use classification downgrade only until the API is updated.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Pricing Guardrails</h3>
          <button
            onClick={onEdit}
            className="text-xs font-medium text-indigo-400 hover:text-indigo-300 bg-indigo-950/40 border border-indigo-800 px-3 py-1 rounded-lg transition-colors"
          >
            Edit
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-950 text-slate-500 text-xs">
              <th className="px-5 py-2.5 text-left font-medium">Guardrail</th>
              <th className="px-5 py-2.5 text-left font-medium">Default</th>
              <th className="px-5 py-2.5 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {GUARDRAILS.map((g, i) => (
              <tr key={g.name} className={`border-t border-slate-800/50 ${i % 2 === 0 ? "" : "bg-slate-900/50"}`}>
                <td className="px-5 py-3 text-slate-300 font-medium">{g.name}</td>
                <td className="px-5 py-3 text-slate-400 font-mono text-xs">{g.default}</td>
                <td className="px-5 py-3">
                  <span className="flex items-center gap-1.5 text-emerald-400 text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {g.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Agent Config Tab ────────────────────────────────────────────── */
const PIPELINE = [
  "Collector",
  "InstructionAgent",
  "Planner",
  "PricingAgent",
  "Reasoner",
  "Validator",
  "Writer",
  "ChangeSummaryAgent",
];

function AgentConfigTab() {
  const CONFIG = [
    { label: "Agent Mode",           value: "Recommendation Only (BA approval required)" },
    { label: "Cycle Interval",       value: "5 minutes" },
    { label: "Max Trips Per Cycle",  value: "2,000" },
    { label: "Pricing Window",       value: "14 days" },
  ];
  return (
    <div className="space-y-4">
      {/* Pipeline */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="text-sm font-semibold text-white mb-3">Agent Pipeline</div>
        <div className="flex items-center flex-wrap gap-2">
          {PIPELINE.map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <span className="text-xs font-medium bg-indigo-950/50 border border-indigo-700/50 text-indigo-300 px-2.5 py-1 rounded-md">
                {step}
              </span>
              {i < PIPELINE.length - 1 && (
                <span className="text-slate-600 text-xs font-bold">→</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Config cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {CONFIG.map(({ label, value }) => (
          <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-4">
            <div className="text-xs text-slate-500 font-medium mb-1">{label}</div>
            <div className="text-sm font-semibold text-white">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── System Info Tab ─────────────────────────────────────────────── */
function SystemInfoTab() {
  const ITEMS = [
    {
      title: "SQLite (local)",
      subtitle: "UI state — pricing rooms, instructions, change batches, audit",
      icon: Database,
      color: "text-indigo-400",
    },
    {
      title: "PostgreSQL (prod read-only)",
      subtitle: "Trip data — schedules, occupancy, fares from production",
      icon: Database,
      color: "text-emerald-400",
    },
    {
      title: "ClickHouse",
      subtitle: "Analytics — aggregated demand signals, EPK, ASP trends",
      icon: Database,
      color: "text-amber-400",
    },
  ];
  return (
    <div className="space-y-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800">
          <h3 className="text-sm font-semibold text-white">Data Sources</h3>
        </div>
        <div className="divide-y divide-slate-800">
          {ITEMS.map(({ title, subtitle, icon: Icon, color }) => (
            <div key={title} className="flex items-start gap-3 px-5 py-4">
              <Icon className={`h-4 w-4 ${color} mt-0.5 shrink-0`} />
              <div>
                <div className="text-sm font-medium text-white">{title}</div>
                <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-4">
          <div className="text-xs text-slate-500 font-medium mb-1">Admin API</div>
          <div className="text-sm font-mono text-white">
            {process.env.NEXT_PUBLIC_ADMIN_DOMAIN || "freshbus.com"}
            <span className="text-slate-600"> (masked)</span>
          </div>
          <div className="text-xs text-slate-600 mt-0.5">ADMIN_BASE_URL — domain only shown</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-4">
          <div className="text-xs text-slate-500 font-medium mb-1">Version</div>
          <div className="text-sm font-semibold text-white">v0.1 MVP</div>
          <div className="text-xs text-slate-600 mt-0.5">Pricing Co-Pilot — internal build</div>
        </div>
      </div>
    </div>
  );
}

/* ── Negative Adj Tab ────────────────────────────────────────────── */
function NegAdjTab() {
  return (
    <div className="space-y-4">
      {/* Status banner */}
      <div className="bg-amber-950/30 border border-amber-700/60 rounded-xl p-5 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <div className="text-sm font-semibold text-amber-200 mb-1">Status: Not Confirmed</div>
          <p className="text-sm text-amber-200/80">
            Negative bus adjustment values sent to the admin API are silently ignored.
            The backend enforces <code className="bg-amber-950/60 px-1 rounded font-mono text-xs">pct = max(0, int(pct))</code> in{" "}
            <code className="bg-amber-950/60 px-1 rounded font-mono text-xs">admin_client.py</code>, so any negative percentage
            is clamped to zero before being applied.
          </p>
        </div>
      </div>

      {/* Options */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800">
          <h3 className="text-sm font-semibold text-white">Resolution Options</h3>
        </div>
        <div className="divide-y divide-slate-800">
          {[
            {
              label: "Option A — Fix admin_client.py",
              desc: "Remove the max(0, ...) clamp in admin_client.py so negative adjustments pass through. Requires verifying the admin API actually accepts negative values end-to-end.",
              tag: "Recommended",
              tagColor: "bg-emerald-900/60 border-emerald-700 text-emerald-300",
            },
            {
              label: "Option B — Use classification-only downgrade",
              desc: "For downward price actions, only change the classification tier (e.g. MEDIUM → LOW_DEMAND) without setting a negative bus adjustment. This is the current interim behaviour.",
              tag: "Interim (Active)",
              tagColor: "bg-indigo-900/60 border-indigo-700 text-indigo-300",
            },
            {
              label: "Option C — Separate downward pricing flow",
              desc: "Build a dedicated downward pricing path that uses a separate admin API endpoint or mechanism confirmed to support negative values.",
              tag: "Future",
              tagColor: "bg-slate-800 border-slate-700 text-slate-400",
            },
          ].map(({ label, desc, tag, tagColor }) => (
            <div key={label} className="px-5 py-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-white">{label}</span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${tagColor}`}>{tag}</span>
              </div>
              <p className="text-sm text-slate-400">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-sm text-slate-400">
        <strong className="text-white">Current behaviour:</strong> Until Option A is confirmed, downward pricing uses classification
        downgrade only. The bus adjustment field is left at 0% for decreasing-price decisions.
      </div>
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────────────── */
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("guardrails");
  const toast = useToast();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5 text-indigo-400" />
        <h1 className="text-2xl font-black text-white">Settings</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap border-b border-slate-800 pb-0">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 text-sm px-4 py-2.5 font-medium transition-colors border-b-2 -mb-px ${
              activeTab === key
                ? "border-indigo-500 text-white"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-4">
        {activeTab === "guardrails" && <GuardrailsTab onEdit={toast.show} />}
        {activeTab === "agent"      && <AgentConfigTab />}
        {activeTab === "system"     && <SystemInfoTab />}
        {activeTab === "negadj"     && <NegAdjTab />}
      </div>

      <Toast visible={toast.visible} />
    </div>
  );
}
