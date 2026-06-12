"use client";

import { usePathname, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Clock, Zap } from "lucide-react";

interface TopBarProps {
  user?: { email: string; name?: string; role?: string };
}

const sectionLabels: Record<string, string> = {
  fleet: "Fleet Monitor",
  rooms: "Pricing Rooms",
  decisions: "Agent Decisions",
  instructions: "Instructions Library",
  changes: "Change History",
  audit: "Audit Logs",
  settings: "Settings & Guardrails",
};

function getSectionLabel(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  const last = parts[parts.length - 1];
  return sectionLabels[last] ?? "Pricing Co-Pilot";
}

export function TopBar({ user }: TopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const sectionLabel = getSectionLabel(pathname);

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() ?? "BA";

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/pricing/login");
  }

  return (
    <header className="flex items-center justify-between h-[60px] border-b border-slate-800 bg-slate-950 px-6 shrink-0">
      {/* Section title */}
      <h1 className="text-sm font-bold text-slate-100 tracking-wide">{sectionLabel}</h1>

      {/* Right side */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-full px-3 py-1.5">
          <Clock className="h-3 w-3 text-slate-500" />
          <span className="text-xs text-slate-400">Last cycle: <span className="text-slate-200 font-medium">5 min ago</span></span>
        </div>

        <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1.5">
          <Zap className="h-3 w-3 text-amber-400" />
          <span className="text-xs text-amber-400 font-medium">Recommendation Only</span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger className="outline-none ml-1">
            <Avatar className="h-8 w-8 cursor-pointer ring-2 ring-slate-700 hover:ring-indigo-500 transition-all">
              <AvatarFallback className="bg-indigo-600 text-white text-xs font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 bg-slate-900 border-slate-700">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              {user?.name && <span className="text-sm font-semibold text-slate-100">{user.name}</span>}
              <span className="text-xs text-slate-400 font-normal">{user?.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-800" />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-red-400 cursor-pointer hover:bg-red-500/10 focus:bg-red-500/10"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
