import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Settings & Guardrails</CardTitle>
          <CardDescription>Configure agent behavior, pricing limits, and system guardrails.</CardDescription>
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
