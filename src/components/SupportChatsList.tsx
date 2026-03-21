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
}: SupportChatsListProps) => {
  const driverMap = useMemo(() => {
    return new Map(drivers.map((driver) => [driver.id, driver]));
  }, [drivers]);

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
        {chats.map((chat) => {
          const driver = driverMap.get(chat.driverId);
          const displayName =
            (driver?.fullName && driver.fullName.trim().length > 0
              ? driver.fullName
              : chat.driverName)?.trim() || "Неизвестный водитель";
          const displayPhone =
            driver?.phoneNumber?.trim().length
              ? driver.phoneNumber
              : chat.driverPhone;
          const isUnread = chat.unreadByDispatcher > 0;

          return (
            <div
              key={chat.id}
              onClick={() => onSelectChat(chat.id)}
              className={`
                relative overflow-hidden p-4 rounded-xl cursor-pointer transition-all shadow-sm
                ${selectedChatId === chat.id
                  ? "border border-primary/70 bg-primary/10 shadow-[0_10px_28px_-18px_hsl(var(--primary))] ring-1 ring-primary/20"
                  : isUnread
                    ? "border border-amber-400/70 bg-amber-50/90 shadow-[0_10px_28px_-24px_rgba(245,158,11,0.65)] hover:border-amber-500 hover:bg-amber-50 dark:bg-amber-500/10"
                    : "border border-border bg-background-elevated hover:border-primary/35 hover:bg-card"
                }
              `}
            >
              {isUnread && (
                <div className="absolute left-0 top-0 h-full w-1 bg-amber-500 shadow-[0_0_14px_rgba(245,158,11,0.65)]" />
              )}

              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  {isUnread && (
                    <span className="relative flex h-2.5 w-2.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <h4 className="font-semibold text-sm truncate">
                      {displayName}
                    </h4>
                    <p className="text-xs text-muted-foreground truncate">
                      {displayPhone}
                    </p>
                  </div>
                </div>
                {isUnread && (
                  <Badge className="ml-2 bg-amber-500 text-white shadow-sm">
                    Новое {chat.unreadByDispatcher > 1 ? `· ${chat.unreadByDispatcher}` : ""}
                  </Badge>
                )}
              </div>

              <p className={`text-sm line-clamp-2 mb-2 ${isUnread ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                {chat.lastMessageFrom === "driver" ? "💬 " : "✉️ "}
                {chat.lastMessage}
              </p>

              <div className={`flex items-center gap-2 text-xs ${isUnread ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}>
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




