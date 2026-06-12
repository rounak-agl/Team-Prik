"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

function usePersistedState(key: string, defaultValue: boolean) {
  const [state, setState] = useState<boolean>(defaultValue);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) setState(JSON.parse(stored));
    } catch {}
  }, [key]);

  function setValue(value: boolean) {
    setState(value);
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }

  return [state, setValue] as const;
}
import {
  LayoutDashboard,
  MessageSquare,
  Bot,
  BookOpen,
  History,
  Shield,
  Settings,
  ChevronLeft,
  ChevronRight,
  Bus,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Fleet Monitor", href: "/pricing/fleet", icon: LayoutDashboard },
  { label: "Pricing Rooms", href: "/pricing/rooms", icon: MessageSquare },
  { label: "Agent Decisions", href: "/pricing/decisions", icon: Bot },
  { label: "Instructions", href: "/pricing/instructions", icon: BookOpen },
  { label: "Change History", href: "/pricing/changes", icon: History },
  { label: "Audit Logs", href: "/pricing/audit", icon: Shield },
  { label: "Settings", href: "/pricing/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = usePersistedState("sidebar-collapsed", false);

  return (
    <aside
      className={cn(
        "flex flex-col bg-slate-950 text-slate-100 transition-all duration-300 border-r border-slate-800 shrink-0",
        collapsed ? "w-[60px]" : "w-[220px]"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "flex items-center gap-3 border-b border-slate-800 h-[60px]",
        collapsed ? "px-3 justify-center" : "px-5"
      )}>
        <div className="bg-indigo-600 rounded-lg p-1.5 shrink-0">
          <Bus className="h-4 w-4 text-white" />
        </div>
        {!collapsed && (
          <div className="leading-tight min-w-0">
            <div className="text-xs font-black text-white tracking-wide uppercase">FreshBus</div>
            <div className="text-[10px] text-indigo-400 font-semibold tracking-widest">PRICING CO-PILOT</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 space-y-0.5 px-2 overflow-y-auto">
        {navItems.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all group",
                isActive
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-100"
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-white" : "text-slate-500 group-hover:text-slate-300")} />
              {!collapsed && <span className="truncate">{label}</span>}
              {!collapsed && isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-300 shrink-0" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className={cn(
        "border-t border-slate-800 h-[52px] flex items-center",
        collapsed ? "justify-center px-3" : "justify-between px-4"
      )}>
        {!collapsed && (
          <span className="text-[10px] text-slate-600 font-mono tracking-wider">v0.1 MVP</span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-slate-600 hover:text-slate-300 transition-colors rounded-md p-1 hover:bg-slate-800"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  );
}
