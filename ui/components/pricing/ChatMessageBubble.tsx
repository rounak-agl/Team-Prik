"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CompactTableRow {
  service?: string;
  before?: string;
  changed_to?: string;
  reason?: string;
  [key: string]: unknown;
}

interface MessageProps {
  message: {
    id: string;
    senderType: string;
    senderName?: string;
    messageText: string;
    messageType: string;
    metadata?: Record<string, unknown>;
    createdAt: string;
  };
  onViewChanges?: (batchId: string) => void;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function ChatMessageBubble({ message, onViewChanges }: MessageProps) {
  const { senderType, senderName, messageText, messageType, metadata, createdAt } = message;

  const isBA = senderType === "ba";
  const isSystem = senderType === "system";
  const isManager = senderType === "manager";

  if (isSystem) {
    return (
      <div className="flex justify-center my-1">
        <span className="text-xs text-muted-foreground italic px-2">{messageText}</span>
      </div>
    );
  }

  const bubbleClass = cn(
    "rounded-lg px-3 py-2 text-sm max-w-[85%] space-y-1",
    isBA
      ? "bg-blue-600 text-white ml-auto"
      : isManager
      ? "bg-purple-600 text-white"
      : "bg-muted text-foreground"
  );

  const wrapperClass = cn("flex", isBA ? "justify-end" : "justify-start");

  const renderContent = () => {
    if (messageType === "change_summary") {
      const batchId = metadata?.batch_id as string | undefined;
      const changeCount = metadata?.change_count as number | undefined;
      const decreases = metadata?.decreases as number | undefined;
      const increases = metadata?.increases as number | undefined;
      const blocked = metadata?.blocked as number | undefined;
      const compactTable = metadata?.compact_table as CompactTableRow[] | undefined;

      return (
        <div className="space-y-2">
          <p className="font-medium">{messageText}</p>
          <div className="flex flex-wrap gap-2 text-xs">
            {changeCount !== undefined && (
              <Badge variant="secondary">{changeCount} services</Badge>
            )}
            {decreases !== undefined && (
              <Badge className="bg-red-100 text-red-800">▼ {decreases} decreases</Badge>
            )}
            {increases !== undefined && (
              <Badge className="bg-green-100 text-green-800">▲ {increases} increases</Badge>
            )}
            {blocked !== undefined && (
              <Badge className="bg-gray-100 text-gray-700">⊘ {blocked} blocked</Badge>
            )}
          </div>
          {compactTable && compactTable.length > 0 && (
            <div className="overflow-x-auto">
              <table className="text-xs w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-1 pr-2 font-medium opacity-70">Service</th>
                    <th className="text-left py-1 pr-2 font-medium opacity-70">Before</th>
                    <th className="text-left py-1 pr-2 font-medium opacity-70">Changed To</th>
                    <th className="text-left py-1 font-medium opacity-70">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {compactTable.slice(0, 3).map((row, i) => (
                    <tr key={i} className="border-b border-opacity-20">
                      <td className="py-1 pr-2 font-mono">{row.service ?? "—"}</td>
                      <td className="py-1 pr-2">{row.before ?? "—"}</td>
                      <td className="py-1 pr-2">{row.changed_to ?? "—"}</td>
                      <td className="py-1 text-muted-foreground">{row.reason ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {batchId && onViewChanges && (
            <Button
              size="sm"
              variant="secondary"
              className="text-xs h-7"
              onClick={() => onViewChanges(batchId)}
            >
              View changes
            </Button>
          )}
        </div>
      );
    }

    if (messageType === "change_failure") {
      return (
        <div className="rounded border border-red-300 bg-red-50 text-red-800 p-2 text-sm">
          <span className="font-medium">⚠ Change failed: </span>
          {messageText}
        </div>
      );
    }

    if (messageType === "instruction") {
      return <p>📋 {messageText}</p>;
    }

    if (messageType === "approval_request") {
      return (
        <div className="space-y-2">
          <p>{messageText}</p>
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700">
              Approve
            </Button>
            <Button size="sm" variant="destructive" className="h-7 text-xs">
              Reject
            </Button>
          </div>
        </div>
      );
    }

    return <p>{messageText}</p>;
  };

  return (
    <div className={wrapperClass}>
      <div className={bubbleClass}>
        {!isBA && (
          <div className="text-xs font-semibold opacity-70 mb-0.5">
            {senderName ?? (senderType === "agent" ? "Agent" : senderType)}
          </div>
        )}
        {renderContent()}
        <div className="text-[10px] opacity-50 text-right mt-0.5">{formatTime(createdAt)}</div>
      </div>
    </div>
  );
}
