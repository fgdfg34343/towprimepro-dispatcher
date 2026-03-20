import { useEffect, useMemo, useRef, useState } from "react";
import { X, Send, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import ChatMessage from "@/components/ChatMessage";
import {
  useClientChatMessages,
  type ClientSupportChat,
} from "@/hooks/useClientSupportChats";
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/firebaseConfig";
import { toast } from "sonner";

interface ClientSupportQuickReplyProps {
  chat: ClientSupportChat | null;
  onClose: () => void;
  onOpenFull?: (chatId: string) => void;
}

const MAX_VISIBLE_MESSAGES = 50;

const ClientSupportQuickReply = ({
  chat,
  onClose,
  onOpenFull,
}: ClientSupportQuickReplyProps) => {
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const chatId = chat?.id ?? null;
  const { messages, loading } = useClientChatMessages(chatId);

  const visibleMessages = useMemo(() => {
    if (messages.length <= MAX_VISIBLE_MESSAGES) {
      return messages;
    }

    return messages.slice(messages.length - MAX_VISIBLE_MESSAGES);
  }, [messages]);

  useEffect(() => {
    if (!messagesEndRef.current) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
    return () => cancelAnimationFrame(frame);
  }, [visibleMessages]);

  useEffect(() => {
    if (!chatId || messages.length === 0) {
      return;
    }

    const unreadMessages = messages.filter(
      (message) => message.senderType === "client" && !message.isRead,
    );

    if (unreadMessages.length === 0) {
      return;
    }

    const markAsRead = async () => {
      try {
        const batch = writeBatch(db);
        const chatRef = doc(db, "clientSupportChats", chatId);
        batch.update(chatRef, { unreadByDispatcher: 0 });

        unreadMessages.forEach((message) => {
          const messageRef = doc(db, "clientSupportChats", chatId, "messages", message.id);
          batch.update(messageRef, { isRead: true });
        });

        await batch.commit();
      } catch (error) {
        console.error(
          "[ClientSupportQuickReply] Не удалось отметить сообщения как прочитанные:",
          error,
        );
      }
    };

    void markAsRead();
  }, [chatId, messages]);

  useEffect(() => {
    if (chat && inputRef.current) {
      inputRef.current.focus();
    }
  }, [chat]);

  const handleSendMessage = async () => {
    if (!chat || sending) {
      return;
    }

    const trimmed = messageText.trim();
    if (!trimmed) {
      return;
    }

    setSending(true);
    try {
      await addDoc(collection(db, "clientSupportChats", chat.id, "messages"), {
        chatId: chat.id,
        senderId: "dispatcher",
        senderName: "Диспетчер",
        senderType: "dispatcher",
        text: trimmed,
        isRead: false,
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "clientSupportChats", chat.id), {
        lastMessage: trimmed,
        lastMessageTime: serverTimestamp(),
        lastMessageFrom: "dispatcher",
        unreadByClient: (chat.unreadByClient ?? 0) + 1,
        updatedAt: serverTimestamp(),
      });

      setMessageText("");
      toast.success("Сообщение отправлено");
    } catch (error) {
      console.error("[ClientSupportQuickReply] Ошибка отправки сообщения:", error);
      toast.error("Не удалось отправить сообщение");
    } finally {
      setSending(false);
    }
  };

  if (!chat) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-full max-w-sm animate-in fade-in slide-in-from-bottom-2">
      <Card className="flex h-[420px] flex-col border border-border/80 bg-background shadow-2xl shadow-black/30">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">{chat.clientName}</p>
            <p className="text-xs text-muted-foreground">
              {chat.clientPhone || "Нет телефона"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="gap-1 text-xs"
              onClick={() => {
                if (onOpenFull) {
                  onOpenFull(chat.id);
                }
                onClose();
              }}
            >
              <MessageSquare className="h-4 w-4" />
              Полный чат
            </Button>
            <Button type="button" size="icon" variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Загрузка сообщений...
            </div>
          ) : visibleMessages.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Сообщений пока нет
            </div>
          ) : (
            <div className="flex flex-col">
              {visibleMessages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.senderType === "dispatcher" ? "justify-end" : "justify-start"
                  }`}
                >
                  <ChatMessage message={message} />
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="border-t border-border px-4 py-3">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              placeholder="Быстрый ответ..."
              value={messageText}
              disabled={sending}
              onChange={(event) => setMessageText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void handleSendMessage();
                }
              }}
            />
            <Button
              type="button"
              className="gap-2"
              onClick={handleSendMessage}
              disabled={sending || messageText.trim().length === 0}
            >
              <Send className="h-4 w-4" />
              Отправить
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ClientSupportQuickReply;
