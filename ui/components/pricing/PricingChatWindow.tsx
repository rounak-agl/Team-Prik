"use client";

import { useRef, useEffect, useState, KeyboardEvent } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Send } from "lucide-react";
import { usePricingMessages, useSendMessage } from "@/hooks/usePricingMessages";
import { ChatMessageBubble } from "@/components/pricing/ChatMessageBubble";
import type { PricingChatMessage } from "@/lib/schemas";

interface Props {
  roomId: string;
  onViewChanges?: (batchId: string) => void;
}

const SUGGESTION_CHIPS = [
  "Treat this as demand day",
  "Do not reduce before 6 PM",
  "Protect EPK above 90",
  "Reduce late-night services if occupancy is stuck",
  "Hold fares for early evening services",
  "Escalate if occupancy drops by 3+ seats",
];

const SCOPE_OPTIONS = [
  { value: "route_date", label: "Apply to this route/date" },
  { value: "service", label: "Apply to selected service" },
  { value: "route_date_all_services", label: "Apply to all services" },
  { value: "time_band", label: "Apply to time band" },
  { value: "until_departure", label: "Until departure" },
];

export function PricingChatWindow({ roomId, onViewChanges }: Props) {
  const [text, setText] = useState("");
  const [scope, setScope] = useState("route_date");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = usePricingMessages(roomId);
  const sendMessage = useSendMessage(roomId);

  const messages: PricingChatMessage[] = data?.messages ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    sendMessage.mutate({ messageText: trimmed, scope, messageType: "instruction" });
    setText("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  };

  const handleViewChanges = (batchId: string) => {
    if (onViewChanges) {
      onViewChanges(batchId);
    }
  };

  return (
    <div className="flex flex-col h-full border-r border-slate-800 bg-slate-950">
      {/* Messages */}
      <ScrollArea className="flex-1 px-4">
        <div className="py-4 space-y-3">
          {isLoading ? (
            <>
              <Skeleton className="h-12 w-3/4" />
              <Skeleton className="h-16 w-4/5 ml-auto" />
              <Skeleton className="h-10 w-2/3" />
            </>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
              No messages yet. Add an instruction to get started.
            </div>
          ) : (
            messages.map((msg) => (
              <ChatMessageBubble
                key={msg.id}
                message={msg}
                onViewChanges={handleViewChanges}
              />
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Suggestion chips */}
      <div className="border-t px-4 py-2 flex gap-2 overflow-x-auto scrollbar-hide">
        {SUGGESTION_CHIPS.map((chip) => (
          <button
            key={chip}
            onClick={() => setText(chip)}
            className="shrink-0 text-xs px-3 py-1.5 rounded-full border bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Composer */}
      <div className="border-t px-4 py-3 space-y-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add pricing instruction for this route/date..."
          rows={2}
          className="resize-none text-sm"
        />
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1">
            <Select value={scope} onValueChange={(v: string | null) => v && setScope(v)}>
              <SelectTrigger className="h-8 text-xs w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCOPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">⌘↵</span>
            <Button
              size="sm"
              className="h-8 px-3"
              onClick={handleSend}
              disabled={!text.trim() || sendMessage.isPending}
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
