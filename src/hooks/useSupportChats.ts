import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  Timestamp
} from "firebase/firestore";
import { db } from "../firebaseConfig";

export interface SupportMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderType: "driver" | "dispatcher" | "client";
  text?: string;
  imageUrl?: string;
  fileName?: string;
  fileUrl?: string;
  fileStoragePath?: string;
  fileDownloadUrl?: string;
  mimeType?: string;
  isRead: boolean;
  createdAt: Date;
}

export interface SupportChat {
  id: string;
  driverId: string;
  driverName: string;
  driverPhone: string;
  vehicleType?: string;
  driverAvatarUrl?: string;
  rawDriverData?: Record<string, unknown>;
  status: "active" | "closed" | "pending";
  lastMessage: string;
  lastMessageTime: Date | null;
  lastMessageFrom: "driver" | "dispatcher";
  unreadByDispatcher: number;
  unreadByDriver: number;
  createdAt: Date | null;
  updatedAt: Date | null;
}

interface UseSupportChatsResult {
  chats: SupportChat[];
  loading: boolean;
  error: string | null;
}

const normalizeStatus = (value: unknown): SupportChat["status"] | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (["active", "open", "opened", "in_progress", "in-progress", "ongoing", "processing"].includes(normalized)) {
    return "active";
  }

  if (["pending", "new", "waiting", "awaiting", "queued", "created", "initiated", "unresolved"].includes(normalized)) {
    return "pending";
  }

  if (["closed", "resolved", "done", "completed", "finished", "archived", "inactive"].includes(normalized)) {
    return "closed";
  }

  return null;
};

const toDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate();

  if (typeof value === "object" && value !== null && "toDate" in value) {
    const candidate = (value as { toDate?: () => Date }).toDate;
    if (typeof candidate === "function") {
      try {
        return candidate.call(value);
      } catch (error) {
        console.warn("[supportChats] Ошибка преобразования toDate:", error);
        return null;
      }
    }
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

export function useSupportChats(statusFilter?: "active" | "closed"): UseSupportChatsResult {
  const [chats, setChats] = useState<SupportChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("[supportChats] Инициализация подписки на чаты...");

    // Простой запрос без orderBy (индекс может не существовать)
    const q = collection(db, "supportChats");

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        console.log(`[supportChats] Получено ${snapshot.docs.length} документов`);

        const chatList = snapshot.docs
          .map((doc) => {
            const data = doc.data();
            console.log(`[supportChats] Чат ${doc.id}:`, data);

            const status: SupportChat["status"] =
              normalizeStatus(data.status) ??
              (data.isActive === false ? "closed" : "active");

            const unreadByDispatcherRaw =
              data.unreadByDispatcher ??
              data.unreadForDispatcher ??
              data.unreadCount ??
              data.unread;

            let unreadByDispatcher = 0;
            if (typeof unreadByDispatcherRaw === "number") {
              unreadByDispatcher = unreadByDispatcherRaw;
            } else if (typeof unreadByDispatcherRaw === "string" && !isNaN(Number(unreadByDispatcherRaw))) {
              unreadByDispatcher = Number(unreadByDispatcherRaw);
            } else if (unreadByDispatcherRaw === true || unreadByDispatcherRaw === "true") {
              unreadByDispatcher = 1;
            } else if (!unreadByDispatcherRaw && typeof data.unreadByDispatcher === "undefined" && typeof data.lastMessageFrom === "string" && data.lastMessageFrom === "driver" && data.status !== "closed") {
              // Fallback: If no unread fields exist, but the driver just sent a message,
              // we can infer it is unread. (Once dispatcher reads, they set unreadByDispatcher = 0).
              unreadByDispatcher = 1;
            }

            const unreadByDriver =
              typeof data.unreadByDriver === "number"
                ? data.unreadByDriver
                : data.unreadForDriver === true
                  ? 1
                  : 0;

            const lastMessage =
              typeof data.lastMessage === "string" && data.lastMessage.trim().length > 0
                ? data.lastMessage
                : typeof data.text === "string"
                  ? data.text
                  : "";

            const lastMessageTime =
              toDate(data.lastMessageTime) ??
              toDate(data.updatedAt) ??
              toDate(data.createdAt);

            const lastMessageFrom =
              (typeof data.lastMessageFrom === "string"
                ? data.lastMessageFrom
                : undefined) ??
              (typeof data.senderType === "string" ? data.senderType : undefined) ??
              "driver";

            const rawDriverRecord = (() => {
              if (data.driver && typeof data.driver === "object") {
                return data.driver as Record<string, unknown>;
              }
              if (data.driverProfile && typeof data.driverProfile === "object") {
                return data.driverProfile as Record<string, unknown>;
              }
              if (data.metadata?.driver && typeof data.metadata.driver === "object") {
                return data.metadata.driver as Record<string, unknown>;
              }
              return undefined;
            })();

            const driverName = (() => {
              if (typeof data.driverName === "string" && data.driverName.trim().length > 0) {
                return data.driverName;
              }
              if (typeof data.senderName === "string" && data.senderName.trim().length > 0) {
                return data.senderName;
              }
              if (rawDriverRecord) {
                const first = typeof rawDriverRecord.firstName === "string" ? rawDriverRecord.firstName.trim() : "";
                const last = typeof rawDriverRecord.lastName === "string" ? rawDriverRecord.lastName.trim() : "";
                const full = `${first} ${last}`.trim();
                if (full.length > 0) {
                  return full;
                }
                if (typeof rawDriverRecord.name === "string" && rawDriverRecord.name.trim().length > 0) {
                  return rawDriverRecord.name.trim();
                }
              }
              return "Неизвестный водитель";
            })();

            const driverPhone = (() => {
              if (typeof data.driverPhone === "string" && data.driverPhone.trim().length > 0) {
                return data.driverPhone;
              }
              if (typeof data.phone === "string" && data.phone.trim().length > 0) {
                return data.phone.trim();
              }
              if (rawDriverRecord && typeof rawDriverRecord.phoneNumber === "string") {
                return rawDriverRecord.phoneNumber.trim();
              }
              return "";
            })();

            const resolvedDriverId = (() => {
              const candidates = [
                data.driverId,
                data.userId,
                rawDriverRecord?.id,
                rawDriverRecord?.driverId,
                rawDriverRecord?.uid,
                rawDriverRecord?.userId,
              ];
              for (const candidate of candidates) {
                if (typeof candidate === "string" && candidate.trim().length > 0) {
                  return candidate.trim();
                }
              }
              return "";
            })();

            const vehicleType =
              typeof data.vehicleType === "string"
                ? data.vehicleType
                : typeof data.driverVehicleType === "string"
                  ? data.driverVehicleType
                  : rawDriverRecord && typeof rawDriverRecord.vehicleType === "string"
                    ? rawDriverRecord.vehicleType
                    : undefined;

            const driverAvatarUrl =
              typeof data.driverAvatarUrl === "string"
                ? data.driverAvatarUrl
                : typeof data.avatarUrl === "string"
                  ? data.avatarUrl
                  : typeof data.driverPhotoUrl === "string"
                    ? data.driverPhotoUrl
                    : rawDriverRecord && typeof rawDriverRecord.avatarUrl === "string"
                      ? rawDriverRecord.avatarUrl
                      : undefined;

            const reopenedByDriver =
              status === "closed" &&
              (unreadByDispatcher > 0 || lastMessageFrom === "driver");

            const effectiveStatus: SupportChat["status"] = reopenedByDriver ? "pending" : status;

            // Поддержка разных вариантов полей
            return {
              id: doc.id,
              driverId: resolvedDriverId,
              driverName,
              driverPhone,
              vehicleType,
              driverAvatarUrl,
              rawDriverData: rawDriverRecord,
              status: effectiveStatus,
              lastMessage,
              lastMessageTime,
              lastMessageFrom,
              unreadByDispatcher,
              unreadByDriver,
              createdAt: toDate(data.createdAt),
              updatedAt: toDate(data.updatedAt),
            };
          })
          // Фильтруем по статусу в клиенте
          .filter((chat) => {
            if (!statusFilter) {
              return true;
            }

            if (chat.status === statusFilter) {
              return true;
            }

            // Поддерживаем отображение "pending" в списке активных обращений
            if (statusFilter === "active" && chat.status === "pending") {
              return true;
            }

            return false;
          })
          // Сортируем: сначала с непрочитанными сообщениями для диспетчера, затем по времени
          .sort((a, b) => {
            const aUnread = a.unreadByDispatcher > 0 ? 1 : 0;
            const bUnread = b.unreadByDispatcher > 0 ? 1 : 0;

            if (aUnread !== bUnread) {
              return bUnread - aUnread; // Непрочитанные (1) выше прочитанных (0)
            }

            if (!a.lastMessageTime) return 1;
            if (!b.lastMessageTime) return -1;
            return b.lastMessageTime.getTime() - a.lastMessageTime.getTime();
          });

        const dedupedChats: SupportChat[] = [];
        const seenDriverIds = new Set<string>();

        chatList.forEach((chat) => {
          const dedupeKey = chat.driverId || chat.id;
          if (seenDriverIds.has(dedupeKey)) {
            return;
          }

          seenDriverIds.add(dedupeKey);
          dedupedChats.push(chat);
        });

        console.log(`[supportChats] Обработано чатов: ${dedupedChats.length}`);
        setChats(dedupedChats);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("❌ [supportChats] Ошибка загрузки чатов:", err);
        console.error("❌ [supportChats] Детали ошибки:", err.message, err.code);

        // Если коллекция пустая или не существует - это не ошибка
        if (err.code === 'permission-denied') {
          setError("Нет доступа к чатам. Проверьте правила Firestore.");
        } else {
          setError(null); // Коллекция пустая - не показываем ошибку
        }

        setChats([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [statusFilter]);

  return { chats, loading, error };
}

export function useChatMessages(chatId: string | null): {
  messages: SupportMessage[];
  loading: boolean;
  error: string | null;
} {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "supportChats", chatId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        console.log(`[chatMessages] Получено ${snapshot.docs.length} сообщений для чата ${chatId}`);

        const messageList: SupportMessage[] = snapshot.docs.map((doc) => {
          const data = doc.data();

          return {
            id: doc.id,
            chatId: chatId,
            senderId: data.senderId || "",
            senderName: data.senderName || "",
            senderType: data.senderType || "driver",
            text: typeof data.text === "string" ? data.text : undefined,
            imageUrl: typeof data.imageUrl === "string" ? data.imageUrl : undefined,
            fileName: typeof data.fileName === "string" ? data.fileName : undefined,
            fileUrl: typeof data.fileUrl === "string" ? data.fileUrl : undefined,
            fileStoragePath:
              typeof data.fileStoragePath === "string"
                ? data.fileStoragePath
                : undefined,
            fileDownloadUrl:
              typeof data.fileDownloadUrl === "string"
                ? data.fileDownloadUrl
                : undefined,
            mimeType: typeof data.mimeType === "string" ? data.mimeType : undefined,
            isRead: data.isRead || false,
            createdAt: toDate(data.createdAt) ?? new Date(),
          };
        });

        setMessages(messageList);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("❌ Ошибка загрузки сообщений:", err);
        setError("Не удалось загрузить сообщения");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [chatId]);

  return { messages, loading, error };
}
