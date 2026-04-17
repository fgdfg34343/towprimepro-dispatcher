import {
  Timestamp,
  collection,
  doc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/firebaseConfig";

type SupportChatStatus = "active" | "pending" | "closed";

interface EnsureSupportChatParams {
  driverId: string;
  driverName?: string | null;
  driverPhone?: string | null;
  vehicleType?: string | null;
}

interface DispatcherSupportMessagePayload {
  chatId: string;
  text?: string;
  filePayload?: Record<string, unknown>;
}

const SUPPORT_CHAT_DOC_PREFIX = "driver_";

function normalizeSupportChatStatus(value: unknown): SupportChatStatus {
  if (typeof value !== "string") {
    return "active";
  }

  const normalized = value.trim().toLowerCase();

  if (["closed", "resolved", "done", "completed", "finished", "archived", "inactive"].includes(normalized)) {
    return "closed";
  }

  if (["pending", "new", "waiting", "awaiting", "queued", "created", "initiated", "unresolved"].includes(normalized)) {
    return "pending";
  }

  return "active";
}

function toMillis(value: unknown): number {
  if (!value) {
    return 0;
  }

  if (value instanceof Timestamp) {
    return value.toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "object" && value !== null && "toDate" in value) {
    const toDate = (value as { toDate?: () => Date }).toDate;
    if (typeof toDate === "function") {
      try {
        return toDate.call(value).getTime();
      } catch {
        return 0;
      }
    }
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

function getChatSortTime(data: DocumentData) {
  return Math.max(
    toMillis(data.updatedAt),
    toMillis(data.lastMessageTime),
    toMillis(data.createdAt),
  );
}

function getCanonicalSupportChatId(driverId: string) {
  return `${SUPPORT_CHAT_DOC_PREFIX}${driverId}`;
}

function sortSupportChatDocs(
  a: QueryDocumentSnapshot<DocumentData>,
  b: QueryDocumentSnapshot<DocumentData>,
) {
  return getChatSortTime(b.data()) - getChatSortTime(a.data());
}

export async function ensureSupportChatForDriver({
  driverId,
  driverName,
  driverPhone,
  vehicleType,
}: EnsureSupportChatParams) {
  const chatsRef = collection(db, "supportChats");
  const snapshot = await getDocs(query(chatsRef, where("driverId", "==", driverId)));
  const docs = snapshot.docs.slice().sort(sortSupportChatDocs);

  const openChats = docs.filter((chatDoc) => normalizeSupportChatStatus(chatDoc.data().status) !== "closed");
  const primaryOpenChat = openChats[0];

  if (primaryOpenChat) {
    if (openChats.length > 1) {
      const batch = writeBatch(db);

      openChats.slice(1).forEach((duplicateDoc) => {
        batch.set(
          duplicateDoc.ref,
          {
            status: "closed",
            mergedIntoChatId: primaryOpenChat.id,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      });

      await batch.commit();
    }

    await setDoc(
      primaryOpenChat.ref,
      {
        driverId,
        ...(driverName ? { driverName } : {}),
        ...(driverPhone ? { driverPhone } : {}),
        ...(vehicleType ? { vehicleType } : {}),
        status: "active",
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    return primaryOpenChat.id;
  }

  const canonicalChatRef = doc(db, "supportChats", getCanonicalSupportChatId(driverId));

  await setDoc(
    canonicalChatRef,
    {
      driverId,
      driverName: driverName ?? "Водитель",
      driverPhone: driverPhone ?? "",
      ...(vehicleType ? { vehicleType } : {}),
      status: "active",
      lastMessage: "",
      lastMessageTime: null,
      lastMessageFrom: "dispatcher",
      unreadByDispatcher: 0,
      unreadByDriver: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return canonicalChatRef.id;
}

export async function sendDispatcherSupportMessage({
  chatId,
  text,
  filePayload = {},
}: DispatcherSupportMessagePayload) {
  const trimmedText = text?.trim() ?? "";
  const hasFile = Object.keys(filePayload).length > 0;

  if (!trimmedText && !hasFile) {
    throw new Error("Пустое сообщение отправлять нельзя");
  }

  const batch = writeBatch(db);
  const chatRef = doc(db, "supportChats", chatId);
  const messageRef = doc(collection(db, "supportChats", chatId, "messages"));

  batch.set(messageRef, {
    chatId,
    senderId: "dispatcher",
    senderName: "Диспетчер",
    senderType: "dispatcher",
    ...(trimmedText ? { text: trimmedText } : {}),
    ...filePayload,
    isRead: false,
    createdAt: serverTimestamp(),
  });

  batch.set(
    chatRef,
    {
      lastMessage: trimmedText || (hasFile ? "Фото отправлено" : "Сообщение отправлено"),
      lastMessageTime: serverTimestamp(),
      lastMessageFrom: "dispatcher",
      unreadByDriver: increment(1),
      unreadByDispatcher: 0,
      status: "active",
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  await batch.commit();

  return messageRef.id;
}
