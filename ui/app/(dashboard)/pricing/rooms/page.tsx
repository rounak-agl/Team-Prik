import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function PricingRoomsPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Pricing Rooms</CardTitle>
          <CardDescription>
            Select a route and date to view the pricing room for that service.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            Route / date selector — coming soon
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
