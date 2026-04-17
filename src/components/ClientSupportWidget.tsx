import { useMemo } from "react";
import { MessageSquare, ArrowRight } from "lucide-react";
import type { ClientSupportChat } from "@/hooks/useClientSupportChats";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ClientSupportWidgetProps {
  chats: ClientSupportChat[];
  loading: boolean;
  unreadCount?: number;
  onSelectChat: (chatId: string) => void;
  onOpenInbox: () => void;
}

function formatRelativeTime(date: Date | null): string {
  if (!date) {
    return "—";
  }

  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0 || diffMs < 60_000) {
    return "только что";
  }

  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 60) {
    return `${diffMinutes} мин`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} ч`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays} дн`;
  }

  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
  });
}

const ClientSupportWidget = ({
  chats,
  loading,
  unreadCount = 0,
  onSelectChat,
  onOpenInbox,
}: ClientSupportWidgetProps) => {
  const topChats = useMemo(() => chats.slice(0, 3), [chats]);

  return (
    <Card className="border-border p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Поддержка клиентов</h3>
        </div>
        {unreadCount > 0 && (
          <Badge className="bg-primary text-primary-foreground">{unreadCount}</Badge>
        )}
      </div>

      <div className="mb-4 space-y-3">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="animate-pulse rounded-lg bg-background p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="h-3 w-24 rounded-full bg-muted" />
                  <span className="h-3 w-10 rounded-full bg-muted" />
                </div>
                <div className="space-y-2">
                  <span className="block h-3 w-full rounded-full bg-muted" />
                  <span className="block h-3 w-4/5 rounded-full bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : topChats.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/50 bg-background p-4 text-center text-sm text-muted-foreground">
            Нет активных обращений
          </div>
        ) : (
          topChats.map((chat) => (
            <button
              key={chat.id}
              type="button"
              className="group w-full rounded-lg bg-background p-3 text-left transition-colors hover:bg-background-elevated"
              onClick={() => onSelectChat(chat.id)}
            >
              <div className="mb-1 flex items-start justify-between">
                <span className="text-sm font-medium text-foreground">{chat.clientName}</span>
                <span className="text-xs text-muted-foreground">
                  {formatRelativeTime(chat.lastMessageTime)}
                </span>
              </div>
              <p className="line-clamp-2 text-sm text-muted-foreground">
                {chat.lastMessage?.trim().length ? chat.lastMessage : "Сообщение без текста"}
              </p>
            </button>
          ))
        )}
      </div>

      <Button variant="outline" className="w-full gap-2" size="sm" onClick={onOpenInbox}>
        Открыть чаты
        <ArrowRight className="h-4 w-4" />
      </Button>
    </Card>
  );
};

export default ClientSupportWidget;
