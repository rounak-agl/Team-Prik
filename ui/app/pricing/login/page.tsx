"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Bus, TrendingUp } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Invalid credentials.");
        return;
      }
      router.push("/pricing/fleet");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-slate-950">
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-[480px] bg-gradient-to-br from-indigo-600 via-indigo-700 to-slate-900 p-12 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 -left-20 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-0 w-96 h-96 bg-indigo-300 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="bg-white/20 backdrop-blur p-2.5 rounded-xl">
              <Bus className="h-6 w-6 text-white" />
            </div>
            <span className="text-white font-bold text-lg tracking-tight">FreshBus</span>
          </div>

          <h1 className="text-4xl font-black text-white leading-tight mb-4">
            Pricing<br />Co-Pilot
          </h1>
          <p className="text-indigo-200 text-lg leading-relaxed">
            Real-time pricing intelligence for every route, every departure.
          </p>
        </div>

        <div className="relative z-10 space-y-4">
          {[
            { icon: TrendingUp, label: "Live occupancy tracking" },
            { icon: Bus, label: "5-minute pricing cycles" },
            { icon: TrendingUp, label: "BA-guided agent decisions" },
          ].map(({ label }, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-300" />
              <span className="text-indigo-100 text-sm">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-10">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Bus className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-slate-100">FreshBus Pricing Co-Pilot</span>
          </div>

          <div className="mb-10">
            <h2 className="text-3xl font-black text-slate-100 mb-2">Welcome back</h2>
            <p className="text-slate-400">Sign in to your pricing dashboard</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300 font-medium text-sm">
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@freshbus.com"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500 h-11 focus:border-indigo-500 focus:ring-indigo-500/20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300 font-medium text-sm">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500 h-11 focus:border-indigo-500 focus:ring-indigo-500/20"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                <span className="text-red-400 text-sm">{error}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-lg transition-all mt-2 shadow-lg shadow-indigo-600/25"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in…
                </span>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-600">
            FreshBus Pricing Co-Pilot · Internal tool
          </p>
        </div>
      </div>
    </div>
  );
}
