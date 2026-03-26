import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, MessageCircle } from "lucide-react";
import type { SupportChat } from "@/hooks/useSupportChats";
import type { DriverDirectoryEntry } from "@/hooks/useDriverDirectory";

interface SupportChatsListProps {
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
  chats: SupportChat[];
  loading: boolean;
  error: string | null;
  drivers: DriverDirectoryEntry[];
  highlightedChatIds?: string[];
}

const formatTime = (date: Date | null): string => {
  if (!date) return "";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "Только что";
  if (diffMinutes < 60) return `${diffMinutes} мин назад`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} ч назад`;

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const SupportChatsList = ({
  selectedChatId,
  onSelectChat,
  chats,
  loading,
  error,
  drivers,
  highlightedChatIds = [],
}: SupportChatsListProps) => {
  const driverMap = useMemo(() => {
    return new Map(drivers.map((driver) => [driver.id, driver]));
  }, [drivers]);
  const orderedChats = useMemo(() => {
    const highlightedIds = new Set(highlightedChatIds);

    return [...chats].sort((a, b) => {
      const aUnread = a.unreadByDispatcher > 0 || highlightedIds.has(a.id) ? 1 : 0;
      const bUnread = b.unreadByDispatcher > 0 || highlightedIds.has(b.id) ? 1 : 0;

      if (aUnread !== bUnread) {
        return bUnread - aUnread;
      }

      const aTime = a.lastMessageTime?.getTime() ?? 0;
      const bTime = b.lastMessageTime?.getTime() ?? 0;
      return bTime - aTime;
    });
  }, [chats, highlightedChatIds]);

  if (loading) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Загрузка чатов...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (chats.length === 0) {
    return (
      <div className="p-6 text-center">
        <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          Нет активных обращений
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-2">
        {orderedChats.map((chat) => {
          const driver = driverMap.get(chat.driverId);
          const displayName =
            (driver?.fullName && driver.fullName.trim().length > 0
              ? driver.fullName
              : chat.driverName)?.trim() || "Неизвестный водитель";
          const displayPhone =
            driver?.phoneNumber?.trim().length
              ? driver.phoneNumber
              : chat.driverPhone;
          const isUnread = chat.unreadByDispatcher > 0 || highlightedChatIds.includes(chat.id);

          return (
            <div
              key={chat.id}
              onClick={() => onSelectChat(chat.id)}
              className={`
                relative overflow-hidden p-4 rounded-xl cursor-pointer transition-all shadow-sm
                ${selectedChatId === chat.id
                  ? "border border-primary/70 bg-primary/10 shadow-[0_10px_28px_-18px_hsl(var(--primary))] ring-1 ring-primary/20"
                  : isUnread
                    ? "border border-red-500/80 bg-red-50/95 shadow-[0_10px_28px_-24px_rgba(239,68,68,0.65)] hover:border-red-500 hover:bg-red-50 dark:bg-red-500/10 ring-1 ring-red-400/25"
                    : "border border-border bg-background-elevated hover:border-primary/35 hover:bg-card"
                }
              `}
            >
              {isUnread && (
                <>
                  <div className="absolute left-0 top-0 h-full w-1 bg-red-500 shadow-[0_0_14px_rgba(239,68,68,0.75)]" />
                  <div className="absolute left-2 top-2 h-2 w-2 rounded-full bg-red-500 animate-ping opacity-80" />
                </>
              )}

              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  {isUnread && (
                    <span className="relative flex h-2.5 w-2.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <h4 className={`font-semibold text-sm truncate ${isUnread ? "text-red-900 dark:text-red-100" : "text-foreground"}`}>
                      {displayName}
                    </h4>
                    <p className={`text-xs truncate ${isUnread ? "text-red-700 dark:text-red-300" : "text-muted-foreground"}`}>
                      {displayPhone}
                    </p>
                  </div>
                </div>
                {isUnread && (
                  <Badge className="ml-2 bg-red-500 text-white shadow-sm">
                    Новое {chat.unreadByDispatcher > 1 ? `· ${chat.unreadByDispatcher}` : ""}
                  </Badge>
                )}
              </div>

              <p className={`text-sm line-clamp-2 mb-2 ${isUnread ? "font-medium text-red-900 dark:text-red-100" : "text-muted-foreground"}`}>
                {chat.lastMessageFrom === "driver" ? "💬 " : "✉️ "}
                {chat.lastMessage}
              </p>

              <div className={`flex items-center gap-2 text-xs ${isUnread ? "text-red-700 dark:text-red-300" : "text-muted-foreground"}`}>
                <Clock className="w-3 h-3" />
                <span>{formatTime(chat.lastMessageTime)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
};

export default SupportChatsList;

