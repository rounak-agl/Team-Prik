import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function InstructionsPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Instructions Library</CardTitle>
          <CardDescription>Manage pricing instructions and guardrails for the agent.</CardDescription>
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
