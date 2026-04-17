import { useEffect, useMemo, useState } from "react";
import { CheckCheck } from "lucide-react";
import type { SupportMessage } from "@/hooks/useSupportChats";
import { storage, ref, getDownloadURL } from "@/firebaseConfig";

interface ChatMessageProps {
  message: SupportMessage;
}

const ChatMessage = ({ message }: ChatMessageProps) => {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);

  const storagePath = useMemo(() => {
    if (message.fileStoragePath) {
      return message.fileStoragePath;
    }
    if (message.fileUrl && !message.fileUrl.startsWith("http")) {
      return message.fileUrl;
    }
    return null;
  }, [message.fileStoragePath, message.fileUrl]);

  useEffect(() => {
    if (storagePath) {
      setResolvedUrl(null);
      const fileRef = ref(storage, storagePath);
      getDownloadURL(fileRef)
        .then((url) => setResolvedUrl(url))
        .catch((err) =>
          console.error("[ChatMessage] Ошибка загрузки файла из Storage:", err)
        );
      return;
    }

    const directUrl =
      message.fileUrl ??
      message.fileDownloadUrl ??
      message.imageUrl ??
      null;

    setResolvedUrl(directUrl);
  }, [storagePath, message.fileUrl, message.fileDownloadUrl, message.imageUrl]);

  const isImage = useMemo(() => {
    if (message.mimeType && message.mimeType.startsWith("image/")) {
      return true;
    }
    const candidateName =
      message.fileName ??
      message.fileUrl ??
      message.imageUrl ??
      message.fileDownloadUrl ??
      "";

    return [".jpg", ".jpeg", ".png", ".gif", ".webp"].some((ext) =>
      candidateName.toLowerCase().endsWith(ext)
    );
  }, [message.mimeType, message.fileName, message.fileUrl, message.imageUrl, message.fileDownloadUrl]);

  const isDispatcher = message.senderType === "dispatcher";
  const containerClasses = isDispatcher
    ? "self-end border border-primary/25 bg-primary/12 text-foreground shadow-[0_10px_24px_-20px_hsl(var(--primary))]"
    : "self-start border border-border/80 bg-card text-card-foreground shadow-sm";

  return (
    <div className={`flex flex-col p-3 my-2 rounded-2xl max-w-[70%] backdrop-blur-sm ${containerClasses}`}>
      {message.text && <p className="mb-2 text-sm break-words">{message.text}</p>}

      {resolvedUrl && (
        <div className="mt-2">
          {isImage ? (
            <img
              src={resolvedUrl}
              alt={message.fileName || "Вложение"}
              className="rounded-xl w-full max-h-[300px] object-cover cursor-pointer"
              onClick={() => window.open(resolvedUrl, "_blank")}
            />
          ) : (
            <a
              href={resolvedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs underline inline-flex items-center gap-2"
            >
              <span role="img" aria-label="attachment">
                📎
              </span>
              {message.fileName || "Скачать файл"}
            </a>
          )}
        </div>
      )}

      <div className="flex items-center gap-1 justify-end text-[11px] opacity-70 mt-2">
        <span>
          {new Intl.DateTimeFormat("ru-RU", {
            hour: "2-digit",
            minute: "2-digit",
          }).format(message.createdAt)}
        </span>
        {isDispatcher && message.isRead && (
          <CheckCheck className="w-3 h-3" />
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
