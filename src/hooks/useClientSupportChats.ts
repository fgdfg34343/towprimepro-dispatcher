import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import type { SupportMessage } from "./useSupportChats";

export interface ClientSupportChat {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientAvatarUrl?: string;
  orderId?: string;
  rawClientData?: Record<string, unknown>;
  status: "active" | "closed" | "pending";
  lastMessage: string;
  lastMessageTime: Date | null;
  lastMessageFrom: "client" | "dispatcher";
  unreadByDispatcher: number;
  unreadByClient: number;
  createdAt: Date | null;
  updatedAt: Date | null;
}

interface UseClientSupportChatsResult {
  chats: ClientSupportChat[];
  loading: boolean;
  error: string | null;
}

// --------------------- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---------------------

const normalizeStatus = (value: unknown): ClientSupportChat["status"] | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();

  if (["active", "open", "in_progress", "ongoing"].includes(normalized)) return "active";
  if (["pending", "new", "waiting", "created"].includes(normalized)) return "pending";
  if (["closed", "resolved", "done", "archived"].includes(normalized)) return "closed";

  return null;
};

const toDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const fn = (value as { toDate?: () => Date }).toDate;
    if (typeof fn === "function") {
      try {
        return fn.call(value);
      } catch {
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

const extractNestedString = (
  record: Record<string, unknown> | undefined,
  keys: string[]
): string | undefined => {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return undefined;
};

const pickFirstNonEmpty = (candidates: Array<unknown>, fallback: string): string => {
  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      const val = candidate.trim();
      if (val.length > 0) return val;
    } else if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return String(candidate);
    }
  }
  return fallback;
};

const resolveClientRecord = (data: Record<string, unknown>) => {
  const possiblePaths = [
    data.client,
    data.customer,
    (data.metadata as { client?: unknown })?.client,
    data.sender,
    (data.order as { client?: unknown })?.client,
  ];
  for (const path of possiblePaths) {
    if (typeof path === "object" && path !== null) return path as Record<string, unknown>;
  }
  return undefined;
};

// --------------------- ОСНОВНОЙ ХУК: СПИСОК ЧАТОВ ---------------------

export function useClientSupportChats(
  statusFilter?: "active" | "closed"
): UseClientSupportChatsResult {
  const [chats, setChats] = useState<ClientSupportChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("[clientSupportChats] Подписка на коллекцию support_chats...");

    const q = collection(db, "support_chats"); // ✅ правильная коллекция для клиентов

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        console.log(`[clientSupportChats] Получено ${snapshot.docs.length} документов`);

        const chatList: ClientSupportChat[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          const rawClientRecord = resolveClientRecord(data as Record<string, unknown>);

          const clientName = pickFirstNonEmpty(
            [
              data.clientName,
              data.name,
              data.senderName,
              extractNestedString(rawClientRecord, ["fullName", "name", "displayName"]),
            ],
            "Неизвестный клиент"
          );

          const clientPhone = pickFirstNonEmpty(
            [
              data.clientPhone,
              data.phone,
              extractNestedString(rawClientRecord, ["phone", "phoneNumber"]),
            ],
            ""
          );

          const resolvedClientId = pickFirstNonEmpty(
            [
              data.clientId,
              data.userId,
              extractNestedString(rawClientRecord, ["id", "uid", "clientId"]),
            ],
            ""
          );

          const status =
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
          } else if (!unreadByDispatcherRaw && typeof data.unreadByDispatcher === "undefined" && typeof data.lastMessageFrom === "string" && data.lastMessageFrom === "client" && status !== "closed") {
            unreadByDispatcher = 1;
          }

          const unreadByClient =
            typeof data.unreadByClient === "number"
              ? data.unreadByClient
              : data.unreadForClient
                ? 1
                : 0;

          const lastMessage =
            typeof data.lastMessage === "string"
              ? data.lastMessage
              : typeof data.text === "string"
                ? data.text
                : "";

          const lastMessageTime =
            toDate(data.lastMessageTime) ??
            toDate(data.updatedAt) ??
            toDate(data.createdAt);

          const lastMessageFrom =
            data.lastMessageFrom === "dispatcher" ? "dispatcher" : "client";

          return {
            id: doc.id,
            clientId: resolvedClientId,
            clientName,
            clientPhone,
            clientAvatarUrl:
              typeof data.clientAvatarUrl === "string"
                ? data.clientAvatarUrl
                : undefined,
            orderId:
              typeof data.orderId === "string" ? data.orderId : undefined,
            rawClientData: rawClientRecord,
            status,
            lastMessage,
            lastMessageTime,
            lastMessageFrom,
            unreadByDispatcher,
            unreadByClient,
            createdAt: toDate(data.createdAt),
            updatedAt: toDate(data.updatedAt),
          };
        });

        chatList.sort((a, b) => {
          const aUnread = a.unreadByDispatcher > 0 ? 1 : 0;
          const bUnread = b.unreadByDispatcher > 0 ? 1 : 0;

          if (aUnread !== bUnread) {
            return bUnread - aUnread;
          }

          if (!a.lastMessageTime) return 1;
          if (!b.lastMessageTime) return -1;
          return b.lastMessageTime.getTime() - a.lastMessageTime.getTime();
        });

        setChats(chatList);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("❌ [clientSupportChats] Ошибка загрузки:", err);
        if (err.code === "permission-denied") {
          setError("Нет доступа к чатам клиентов. Проверьте правила Firestore.");
        } else {
          setError("Ошибка загрузки данных.");
        }
        setChats([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [statusFilter]);

  return { chats, loading, error };
}

// --------------------- ХУК: СООБЩЕНИЯ ВНУТРИ КЛИЕНТСКОГО ЧАТА ---------------------

export function useClientChatMessages(chatId: string | null): {
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

    console.log(`[clientChatMessages] Подписка на support_chats/${chatId}/messages`);

    const q = query(
      collection(db, "support_chats", chatId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        console.log(`[clientChatMessages] Получено ${snapshot.docs.length} сообщений для чата ${chatId}`);

        const messageList: SupportMessage[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            chatId,
            senderId: data.senderId || "",
            senderName: data.senderName || "",
            senderType: data.senderType === "dispatcher" ? "dispatcher" : "client",
            text:
              typeof data.text === "string" && data.text.trim().length > 0
                ? data.text
                : undefined,
            imageUrl:
              typeof data.imageUrl === "string" ? data.imageUrl : undefined,
            fileName:
              typeof data.fileName === "string" ? data.fileName : undefined,
            fileUrl:
              typeof data.fileUrl === "string" ? data.fileUrl : undefined,
            mimeType:
              typeof data.mimeType === "string" ? data.mimeType : undefined,
            isRead: !!data.isRead,
            createdAt: toDate(data.createdAt) ?? new Date(),
          };
        });

        setMessages(messageList);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("❌ Ошибка загрузки клиентских сообщений:", err);
        setError("Не удалось загрузить сообщения клиента");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [chatId]);

  return { messages, loading, error };
}