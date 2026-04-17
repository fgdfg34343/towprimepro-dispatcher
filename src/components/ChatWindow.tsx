import { useState, useEffect, useRef } from "react";
import type { ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Send, X, MessageCircle, ImagePlus } from "lucide-react";
import { useChatMessages, type SupportChat } from "@/hooks/useSupportChats";
import { 
  doc, 
  updateDoc,
  writeBatch
} from "firebase/firestore";
import { db } from "@/firebaseConfig";
import { storage } from "@/firebaseConfig";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { toast } from "sonner";
import ChatMessage from "./ChatMessage";
import { sendDispatcherSupportMessage } from "@/lib/supportChats";

interface ChatWindowProps {
  chat: SupportChat | null;
  onClose?: () => void;
}

const ChatWindow = ({ chat, onClose }: ChatWindowProps) => {
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { messages, loading } = useChatMessages(chat?.id || null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Автопрокрутка вниз при новых сообщениях
  useEffect(() => {
    if (loading) return;
    const node = messagesContainerRef.current;
    if (!node) return;

    const frame = requestAnimationFrame(() => {
      node.scrollTop = node.scrollHeight;
    });

    return () => cancelAnimationFrame(frame);
  }, [messages, loading]);

  // Отмечаем сообщения как прочитанные при открытии чата
  useEffect(() => {
    if (!chat?.id) return;

    const markAsRead = async () => {
      try {
        const batch = writeBatch(db);
        
        // Обновляем счетчик непрочитанных в чате
        const chatRef = doc(db, "supportChats", chat.id);
        batch.update(chatRef, {
          unreadByDispatcher: 0,
        });

        // Отмечаем все сообщения от водителя как прочитанные
        const unreadMessages = messages.filter(
          (msg) => msg.senderType === "driver" && !msg.isRead
        );

        for (const msg of unreadMessages) {
          const msgRef = doc(db, "supportChats", chat.id, "messages", msg.id);
          batch.update(msgRef, { isRead: true });
        }

        if (unreadMessages.length > 0) {
          await batch.commit();
        }
      } catch (error) {
        console.error("Ошибка отметки сообщений как прочитанных:", error);
      }
    };

    markAsRead();
  }, [chat?.id, messages]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Можно отправлять только изображения");
      event.target.value = "";
      return;
    }

    const maxBytes = 5 * 1024 * 1024; // 5MB
    if (file.size > maxBytes) {
      toast.error("Размер файла не должен превышать 5 МБ");
      event.target.value = "";
      return;
    }

    setSelectedFile(file);
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSendMessage = async () => {
    if (!chat) return;

    const trimmedText = messageText.trim();
    const fileToUpload = selectedFile;
    const hadFile = Boolean(fileToUpload);
    if (!trimmedText && !hadFile) return;

    setSending(true);
    try {
      let filePayload: Record<string, unknown> = {};

      if (fileToUpload) {
        const storagePath = `supportChats/${chat.id}/${Date.now()}_${fileToUpload.name}`;
        const storageRef = ref(storage, storagePath);
        const uploadResult = await uploadBytes(storageRef, fileToUpload);
        const downloadUrl = await getDownloadURL(uploadResult.ref);

        filePayload = {
          fileName: fileToUpload.name,
          fileStoragePath: storagePath,
          fileUrl: downloadUrl,
          fileDownloadUrl: downloadUrl,
          mimeType: fileToUpload.type || undefined,
          attachmentType: "PHOTO",
          attachmentName: fileToUpload.name,
          attachmentUrl: downloadUrl,
          attachmentStoragePath: storagePath,
          imageUrl: downloadUrl,
        };
      }

      await sendDispatcherSupportMessage({
        chatId: chat.id,
        text: trimmedText,
        filePayload,
      });

      setMessageText("");
      clearSelectedFile();
      toast.success(hadFile ? "Файл отправлен" : "Сообщение отправлено");
    } catch (error) {
      console.error("Ошибка отправки сообщения:", error);
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Не удалось отправить сообщение";
      toast.error(message);
    } finally {
      setSending(false);
    }
  };

  const handleCloseChat = async () => {
    if (!chat) return;

    try {
      await updateDoc(doc(db, "supportChats", chat.id), {
        status: "closed",
        updatedAt: serverTimestamp(),
      });
      toast.success("Обращение закрыто");
      if (onClose) onClose();
    } catch (error) {
      console.error("Ошибка закрытия чата:", error);
      toast.error("Не удалось закрыть обращение");
    }
  };

  const hasMessageContent = messageText.trim().length > 0 || !!selectedFile;

  if (!chat) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background-elevated">
        <div className="text-center">
          <MessageCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-semibold mb-2">Выберите чат</p>
          <p className="text-sm text-muted-foreground">
            Выберите обращение из списка слева
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background-elevated h-full">
      {/* Header чата */}
      <div className="p-4 border-b border-border bg-card flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">{chat.driverName}</h3>
          <p className="text-sm text-muted-foreground">{chat.driverPhone}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            {chat.status === "active" ? "Активно" : "Закрыто"}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCloseChat}
            disabled={chat.status === "closed"}
          >
            <X className="w-4 h-4 mr-1" />
            Закрыть
          </Button>
        </div>
      </div>

      {/* Сообщения */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto bg-muted/25 p-4 space-y-4"
      >
        {loading ? (
          <div className="text-center text-muted-foreground py-8">
            Загрузка сообщений...
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            Нет сообщений
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.senderType === "dispatcher" ? "justify-end" : "justify-start"
              }`}
            >
              <ChatMessage message={message} />
            </div>
          ))
        )}
      </div>

      {/* Поле ввода */}
      <div className="p-4 border-t border-border bg-card">
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
            disabled={sending || chat.status === "closed"}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending || chat.status === "closed"}
            className="shrink-0"
          >
            <ImagePlus className="w-4 h-4" />
          </Button>
          <Input
            placeholder="Введите сообщение..."
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            disabled={sending || chat.status === "closed"}
            className="flex-1"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!hasMessageContent || sending || chat.status === "closed"}
            className="gap-2"
          >
            <Send className="w-4 h-4" />
            {sending ? "..." : "Отправить"}
          </Button>
        </div>
        {selectedFile && (
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-dashed border-border/70 bg-background-elevated/60 px-3 py-2 text-xs text-muted-foreground">
            <ImagePlus className="w-4 h-4 text-primary" />
            <span className="flex-1 truncate">{selectedFile.name}</span>
            <button
              type="button"
              onClick={clearSelectedFile}
              className="text-muted-foreground transition hover:text-destructive"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {chat.status === "closed" && (
          <p className="text-xs text-muted-foreground mt-2">
            Это обращение закрыто
          </p>
        )}
      </div>
    </div>
  );
};

export default ChatWindow;


