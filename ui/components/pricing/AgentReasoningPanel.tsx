"use client";

import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ClassificationBadge } from "@/components/pricing/badges/ClassificationBadge";
import { RiskBadge } from "@/components/pricing/badges/RiskBadge";
import { ConfidenceBadge } from "@/components/pricing/badges/ConfidenceBadge";
import {
  usePricingRecommendations,
  useApproveRecommendation,
  useRejectRecommendation,
} from "@/hooks/usePricingRecommendations";
import type { PricingRecommendation } from "@/lib/schemas";
import { ChevronDown, ChevronRight } from "lucide-react";

interface Props {
  roomId: string;
}

export function AgentReasoningPanel({ roomId }: Props) {
  const [guardrailsOpen, setGuardrailsOpen] = useState(false);

  const { data } = usePricingRecommendations(roomId);
  const approve = useApproveRecommendation(roomId);
  const reject = useRejectRecommendation(roomId);

  const recommendations: PricingRecommendation[] = data?.recommendations ?? [];
  const pending = recommendations.filter((r) => r.status === "pending");

  return (
    <div className="flex flex-col h-full bg-muted/20 overflow-hidden">
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">

          {/* Agent Plan */}
          <Card>
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
                Agent Plan
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">Classification</span>
                <ClassificationBadge classification="NORMAL" />
              </div>
              <div className="text-xs text-muted-foreground">
                Pricing Strategy: <span className="text-foreground font-medium">Hold fares, monitor occupancy</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">Confidence</span>
                <ConfidenceBadge confidence={74} />
              </div>
              <Separator />
              <div className="grid grid-cols-3 gap-1 text-xs text-center">
                <div>
                  <div className="font-semibold text-blue-600">2</div>
                  <div className="text-muted-foreground">moving</div>
                </div>
                <div>
                  <div className="font-semibold text-yellow-600">1</div>
                  <div className="text-muted-foreground">stuck</div>
                </div>
                <div>
                  <div className="font-semibold text-red-600">1</div>
                  <div className="text-muted-foreground">dropping</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recommended Actions */}
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2 px-1">
              Recommended Actions
            </div>
            {pending.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-4 border rounded-md bg-card">
                No recommendations for this cycle
              </div>
            ) : (
              <div className="space-y-2">
                {pending.map((rec) => (
                  <RecommendationCard
                    key={rec.id}
                    rec={rec}
                    onApprove={() => approve.mutate(rec.id)}
                    onReject={() => reject.mutate(rec.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Guardrails */}
          <Card>
            <CardHeader
              className="pb-2 pt-3 px-3 cursor-pointer"
              onClick={() => setGuardrailsOpen((o) => !o)}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
                  Guardrails
                </CardTitle>
                {guardrailsOpen ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>
            </CardHeader>
            {guardrailsOpen && (
              <CardContent className="px-3 pb-3 space-y-1.5 text-xs">
                <div className="grid grid-cols-2 gap-y-1">
                  <span className="text-muted-foreground">Min Classification</span>
                  <span className="font-medium">LOW_DEMAND</span>
                  <span className="text-muted-foreground">Max Classification</span>
                  <span className="font-medium">SUPER_HIGH</span>
                  <span className="text-muted-foreground">Bus Adj Limit</span>
                  <span className="font-medium">±20%</span>
                  <span className="text-muted-foreground">EPK Floor</span>
                  <span className="font-medium">₹80</span>
                  <span className="text-muted-foreground">ASP Floor</span>
                  <span className="font-medium">₹500</span>
                  <span className="text-muted-foreground">Cooldown</span>
                  <span className="font-medium">15 min</span>
                </div>
                <Separator />
                <div className="text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400 rounded p-2 leading-snug">
                  ⚠ Negative bus fare adjustment is not confirmed by admin API. Downward actions use classification downgrade only.
                </div>
              </CardContent>
            )}
          </Card>

          {/* Instruction Impact Preview */}
          <Card>
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
                Instruction Impact Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 text-xs text-muted-foreground italic">
              Add an instruction to see impact preview.
            </CardContent>
          </Card>

        </div>
      </ScrollArea>
    </div>
  );
}

function RecommendationCard({
  rec,
  onApprove,
  onReject,
}: {
  rec: PricingRecommendation;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="rounded-md border bg-card p-2.5 space-y-1.5 text-xs">
      <div className="flex items-center gap-1.5">
        <ClassificationBadge classification={rec.currentClassification} />
        <span className="font-mono font-semibold truncate text-xs">{rec.serviceNumber ?? String(rec.tripId)}</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs">
        <span className="text-muted-foreground">Current:</span>
        <span>{rec.currentClassification}, {rec.currentBusAdjPct > 0 ? "+" : ""}{rec.currentBusAdjPct}%</span>
        <span className="text-muted-foreground">→</span>
        <span className="font-medium">{rec.newClassification ?? rec.currentClassification}, {(rec.newBusAdjPct ?? rec.currentBusAdjPct) > 0 ? "+" : ""}{rec.newBusAdjPct ?? rec.currentBusAdjPct}%</span>
      </div>
      <div className="text-muted-foreground italic truncate">{rec.reason}</div>
      <div className="flex items-center gap-2">
        <ConfidenceBadge confidence={rec.confidence} />
        <RiskBadge risk={rec.riskLevel} />
      </div>
      <div className="flex gap-1.5 pt-0.5">
        <Button
          size="sm"
          className="h-6 text-xs px-2 bg-green-600 hover:bg-green-700"
          onClick={onApprove}
        >
          Approve
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="h-6 text-xs px-2"
          onClick={onReject}
        >
          Reject
        </Button>
        <Button size="sm" variant="outline" className="h-6 text-xs px-2">
          Hold
        </Button>
      </div>
    </div>
  );
}
