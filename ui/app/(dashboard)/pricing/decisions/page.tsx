import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AgentDecisionsPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Agent Decisions</CardTitle>
          <CardDescription>Review and approve pricing decisions made by the agent.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            Coming soon
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
