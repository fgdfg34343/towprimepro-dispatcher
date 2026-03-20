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

          return (
            <div
              key={chat.id}
              onClick={() => onSelectChat(chat.id)}
              className={`
                p-4 rounded-xl cursor-pointer transition-all shadow-sm
                ${selectedChatId === chat.id
                  ? "border border-primary/60 bg-primary/8 shadow-[0_8px_24px_-18px_hsl(var(--primary))]"
                  : chat.unreadByDispatcher > 0
                    ? "border border-primary/50 bg-primary/10 hover:bg-primary/14"
                    : "border border-border bg-background-elevated hover:border-primary/35 hover:bg-card"
                }
              `}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  {chat.unreadByDispatcher > 0 && (
                    <span className="relative flex h-2.5 w-2.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
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
                {chat.unreadByDispatcher > 0 && (
                  <Badge className="ml-2 bg-destructive text-white">
                    {chat.unreadByDispatcher}
                  </Badge>
                )}
              </div>

              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                {chat.lastMessageFrom === "driver" ? "💬 " : "✉️ "}
                {chat.lastMessage}
              </p>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
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





