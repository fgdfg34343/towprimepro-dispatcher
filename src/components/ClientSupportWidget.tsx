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
              className={`group relative w-full overflow-hidden rounded-lg p-3 text-left transition-all ${
                chat.unreadByDispatcher > 0
                  ? "border border-red-500/80 bg-red-50/95 shadow-[0_10px_28px_-24px_rgba(239,68,68,0.65)] hover:border-red-500 hover:bg-red-50 dark:bg-red-500/10 ring-1 ring-red-400/25"
                  : "bg-background hover:bg-background-elevated"
              }`}
              onClick={() => onSelectChat(chat.id)}
            >
              {chat.unreadByDispatcher > 0 && (
                <>
                  <span className="absolute left-0 top-0 h-full w-1 bg-red-500 shadow-[0_0_14px_rgba(239,68,68,0.75)]" />
                  <span className="absolute left-2 top-2 h-2 w-2 rounded-full bg-red-500 animate-ping opacity-80" />
                </>
              )}
              <div className="mb-1 flex items-start justify-between">
                <span className={`text-sm font-semibold ${chat.unreadByDispatcher > 0 ? "text-red-900 dark:text-red-100" : "text-foreground"}`}>
                  {chat.clientName}
                </span>
                <span className={`text-xs ${chat.unreadByDispatcher > 0 ? "text-red-700 dark:text-red-300 font-medium" : "text-muted-foreground"}`}>
                  {formatRelativeTime(chat.lastMessageTime)}
                </span>
              </div>
              <p className={`line-clamp-2 text-sm ${chat.unreadByDispatcher > 0 ? "font-medium text-red-900 dark:text-red-100" : "text-muted-foreground"}`}>
                {chat.lastMessage?.trim().length ? chat.lastMessage : "Сообщение без текста"}
              </p>
              {chat.unreadByDispatcher > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <Badge className="bg-red-500 text-white shadow-sm">Новое</Badge>
                  <span className="text-xs font-medium text-red-700 dark:text-red-300">
                    Сообщение не прочитано
                  </span>
                </div>
              )}
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
