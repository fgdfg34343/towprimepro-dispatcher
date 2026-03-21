import { useMemo } from "react";
import { MessageSquare, ArrowRight } from "lucide-react";
import type { SupportChat } from "@/hooks/useSupportChats";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface SupportWidgetProps {
  chats: SupportChat[];
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

const SupportWidget = ({ chats, loading, unreadCount = 0, onSelectChat, onOpenInbox }: SupportWidgetProps) => {
  const topChats = useMemo(() => {
    return chats.slice(0, 3);
  }, [chats]);

  return (
    <Card className="border-border p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Поддержка</h3>
        </div>
        {unreadCount > 0 && (
          <Badge className="bg-amber-500 text-white shadow-sm">
            Новые {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        )}
      </div>

      <div className="mb-4 space-y-3">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, index) => (
              <div
                key={index}
                className="animate-pulse rounded-lg bg-background p-3"
              >
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
                  ? "border border-amber-400/70 bg-amber-50/90 shadow-[0_10px_28px_-24px_rgba(245,158,11,0.65)] hover:border-amber-500 hover:bg-amber-50 dark:bg-amber-500/10"
                  : "bg-background hover:bg-background-elevated"
              }`}
              onClick={() => onSelectChat(chat.id)}
            >
              {chat.unreadByDispatcher > 0 && (
                <span className="absolute left-0 top-0 h-full w-1 bg-amber-500 shadow-[0_0_14px_rgba(245,158,11,0.65)]" />
              )}
              <div className="mb-1 flex items-start justify-between">
                <span className="text-sm font-medium text-foreground">
                  {chat.driverName}
                </span>
                <span className={`text-xs ${chat.unreadByDispatcher > 0 ? "text-amber-700 dark:text-amber-300 font-medium" : "text-muted-foreground"}`}>
                  {formatRelativeTime(chat.lastMessageTime)}
                </span>
              </div>
              <p className={`line-clamp-2 text-sm ${chat.unreadByDispatcher > 0 ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                {chat.lastMessage?.trim().length ? chat.lastMessage : "Сообщение без текста"}
              </p>
              {chat.unreadByDispatcher > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <Badge className="bg-amber-500 text-white shadow-sm">Новое</Badge>
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                    Сообщение от водителя требует внимания
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

export default SupportWidget;
