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
import { LogOut, User } from "lucide-react";

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
    : user?.email?.slice(0, 2).toUpperCase() ?? "U";

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/pricing/login");
  }

  return (
    <header className="flex items-center justify-between border-b bg-background px-6 py-3 shrink-0">
      {/* Breadcrumb */}
      <div className="text-sm font-medium text-foreground">{sectionLabel}</div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        <Badge variant="outline" className="text-xs text-muted-foreground">
          Last cycle: 5 min ago
        </Badge>
        <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 text-xs border-0">
          Recommendation Only
        </Badge>

        <DropdownMenu>
          <DropdownMenuTrigger className="outline-none focus:ring-2 focus:ring-indigo-500 rounded-full">
            <Avatar className="h-8 w-8 cursor-pointer">
              <AvatarFallback className="bg-indigo-600 text-white text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              {user?.name && <span className="text-sm font-medium">{user.name}</span>}
              <span className="text-xs text-muted-foreground font-normal">{user?.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-600 cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
