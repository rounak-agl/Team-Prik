import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ChangeHistoryPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Change History</CardTitle>
          <CardDescription>View all pricing changes applied by the agent and analysts.</CardDescription>
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
