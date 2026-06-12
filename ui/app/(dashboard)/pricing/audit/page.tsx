"use client";

import { useEffect, useState, useCallback } from "react";
import { Shield, Edit3, Zap, MessageSquare, CheckSquare, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

/* ── Types ─────────────────────────────────────────────────────── */
interface AuditEvent {
  id: string;
  type: "message" | "instruction" | "change";
  subtype: string;
  actor: string;
  text: string;
  room: string | undefined;
  at: string;
}

type FilterType = "all" | "instruction" | "change" | "message" | "approval";

/* ── Helpers ────────────────────────────────────────────────────── */
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; border: string; label: string }> = {
  instruction: { icon: Edit3,      color: "text-blue-400",    border: "border-l-blue-500",   label: "Instruction" },
  change:      { icon: Zap,        color: "text-indigo-400",  border: "border-l-indigo-500", label: "Change"      },
  message:     { icon: MessageSquare, color: "text-slate-400", border: "border-l-slate-600", label: "Message"     },
  approval:    { icon: CheckSquare, color: "text-emerald-400", border: "border-l-emerald-500", label: "Approval"  },
};

function getConfig(event: AuditEvent) {
  if (event.type === "message" && (event.subtype === "approval_request" || event.subtype === "approval_response")) {
    return TYPE_CONFIG.approval;
  }
  return TYPE_CONFIG[event.type] || TYPE_CONFIG.message;
}

/* ── Event Row ───────────────────────────────────────────────────── */
function EventRow({ event }: { event: AuditEvent }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = getConfig(event);
  const Icon = cfg.icon;

  return (
    <div className={`bg-slate-900 border border-slate-800 border-l-4 ${cfg.border} rounded-r-xl rounded-l-sm overflow-hidden`}>
      <div
        className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-slate-800/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Left: icon + time */}
        <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
          <Icon className={`h-4 w-4 ${cfg.color}`} />
        </div>

        {/* Center: content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 ${cfg.color}`}>
              {cfg.label}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">{event.subtype}</span>
            <span className="text-[10px] text-slate-600">by {event.actor}</span>
          </div>
          <p className="text-sm text-slate-300 mt-1 leading-snug">{event.text}</p>
          {event.room && (
            <div className="text-xs text-slate-500 mt-0.5">Room: {event.room}</div>
          )}
        </div>

        {/* Right: time + expand */}
        <div className="shrink-0 text-right">
          <div className="text-xs text-slate-500 font-mono">{fmtTime(event.at)}</div>
          <div className="text-[10px] text-slate-600">{fmtDate(event.at)}</div>
          <div className="mt-1">
            {expanded ? (
              <ChevronUp className="h-3 w-3 text-slate-600 ml-auto" />
            ) : (
              <ChevronDown className="h-3 w-3 text-slate-600 ml-auto" />
            )}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-800 px-4 py-3 bg-slate-950/40">
          <div className="text-xs text-slate-400 space-y-1">
            <div><span className="text-slate-600">ID:</span> <span className="font-mono">{event.id}</span></div>
            <div><span className="text-slate-600">Type:</span> {event.type} / {event.subtype}</div>
            <div><span className="text-slate-600">Actor:</span> {event.actor}</div>
            <div><span className="text-slate-600">Time:</span> {new Date(event.at).toLocaleString("en-IN")}</div>
            {event.room && <div><span className="text-slate-600">Room:</span> {event.room}</div>}
            <div className="mt-2 pt-2 border-t border-slate-800">
              <span className="text-slate-600">Full text:</span>
              <p className="text-slate-300 mt-1 whitespace-pre-wrap">{event.text}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Filter Tabs ─────────────────────────────────────────────────── */
const TABS: { key: FilterType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "instruction", label: "Instructions" },
  { key: "change", label: "Changes" },
  { key: "message", label: "Messages" },
  { key: "approval", label: "Approvals" },
];

/* ── Main Page ───────────────────────────────────────────────────── */
export default function AuditLogsPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterType>("all");

  const fetchEvents = useCallback((tab: FilterType) => {
    setLoading(true);
    const param = tab !== "all" ? `?actionType=${tab}` : "";
    fetch(`/api/pricing/audit${param}`)
      .then((r) => r.json())
      .then((d) => { setEvents(d.events || []); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  useEffect(() => { fetchEvents(activeTab); }, [activeTab, fetchEvents]);

  const handleTabChange = (tab: FilterType) => {
    setActiveTab(tab);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-indigo-400" />
            <h1 className="text-2xl font-black text-white">Audit Logs</h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">Complete trail of all actions and decisions.</p>
        </div>
        <div className="text-xs text-slate-500 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2">
          {events.length} events
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 flex-wrap">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleTabChange(key)}
            className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeTab === key
                ? "bg-indigo-600 text-white"
                : "bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="space-y-2">
        {loading && (
          <>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl h-[76px] animate-pulse" />
            ))}
          </>
        )}

        {error && (
          <div className="bg-red-950/40 border border-red-800 rounded-xl p-4 flex items-center gap-2 text-red-300 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Failed to load audit events: {error}
          </div>
        )}

        {!loading && !error && events.length === 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center">
            <Shield className="h-10 w-10 text-slate-700 mx-auto mb-3" />
            <div className="text-white font-semibold mb-1">No audit events yet.</div>
            <div className="text-sm text-slate-500">Start using the system to see events here.</div>
          </div>
        )}

        {!loading && !error && events.map((event) => (
          <EventRow key={`${event.type}-${event.id}`} event={event} />
        ))}
      </div>
    </div>
  );
}
