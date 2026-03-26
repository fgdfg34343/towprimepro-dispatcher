import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { toast } from "sonner";
import { db } from "@/firebaseConfig";
import type { SupportChat } from "@/hooks/useSupportChats";
import type { ClientSupportChat } from "@/hooks/useClientSupportChats";

// ── AudioContext singleton ────────────────────────────────────────────────────
let _ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!_ctx) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AC = window.AudioContext ?? (window as any).webkitAudioContext;
      _ctx = new AC();
    }
    return _ctx;
  } catch {
    return null;
  }
}

// Разблокируем при первом взаимодействии
if (typeof document !== "undefined") {
  const unlock = () => {
    const c = getCtx();
    if (c?.state === "suspended") c.resume().catch(() => {});
  };
  document.addEventListener("click", unlock, { capture: true, once: true });
  document.addEventListener("keydown", unlock, { capture: true, once: true });
  document.addEventListener("touchstart", unlock, { capture: true, once: true });
}

function beep(
  freq: number,
  delay: number,
  dur: number,
  vol = 0.5,
  type: OscillatorType = "sine",
) {
  const ctx = getCtx();
  if (!ctx) return;
  const run = () => {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
      gain.gain.setValueAtTime(0, ctx.currentTime + delay);
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + delay + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + dur + 0.02);
    } catch { /* ignore */ }
  };
  if (ctx.state === "suspended") {
    ctx.resume().then(run).catch(() => {});
  } else {
    run();
  }
}

export function playSound(type: "order" | "message") {
  if (type === "order") {
    beep(880, 0, 0.15, 0.18, "square");
    beep(1174, 0.18, 0.16, 0.15, "triangle");
    beep(880, 0.42, 0.15, 0.18, "square");
    beep(1396, 0.6, 0.24, 0.16, "triangle");
  } else {
    beep(760, 0, 0.16, 0.12, "triangle");
    beep(920, 0.19, 0.16, 0.1, "triangle");
  }
}

function showBrowserNotif(title: string, body: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, { body, icon: "/favicon.ico" });
    n.onclick = () => { window.focus(); n.close(); };
    setTimeout(() => n.close(), 8000);
  } catch { /* ignore */ }
}

interface UseDispatcherNotificationsParams {
  supportChats?: SupportChat[];
  supportChatsLoading?: boolean;
  clientSupportChats?: ClientSupportChat[];
  clientSupportChatsLoading?: boolean;
}

export function useDispatcherNotifications({
  supportChats = [],
  supportChatsLoading = false,
  clientSupportChats = [],
  clientSupportChatsLoading = false,
}: UseDispatcherNotificationsParams = {}) {
  const notifRequested = useRef(false);

  // Локальные счетчики непрочитанных с сохранением в localStorage
  const [unreadSupportCount, setUnreadSupportCount] = useState(() => {
    const saved = localStorage.getItem("unreadSupportCount");
    return saved ? parseInt(saved, 10) : 0;
  });
  
  const [unreadClientSupportCount, setUnreadClientSupportCount] = useState(() => {
    const saved = localStorage.getItem("unreadClientSupportCount");
    return saved ? parseInt(saved, 10) : 0;
  });
  const [highlightedSupportChatIds, setHighlightedSupportChatIds] = useState<string[]>(() => {
    const saved = localStorage.getItem("highlightedSupportChatIds");
    if (!saved) return [];

    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed)
        ? parsed.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("unreadSupportCount", unreadSupportCount.toString());
  }, [unreadSupportCount]);

  useEffect(() => {
    localStorage.setItem("unreadClientSupportCount", unreadClientSupportCount.toString());
  }, [unreadClientSupportCount]);

  useEffect(() => {
    localStorage.setItem("highlightedSupportChatIds", JSON.stringify(highlightedSupportChatIds));
  }, [highlightedSupportChatIds]);

  // Запрос разрешения
  useEffect(() => {
    if (notifRequested.current) return;
    notifRequested.current = true;
    getCtx();
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().then((p) => {
        if (p === "granted") toast.success("Уведомления включены 🔔");
      });
    }
  }, []);

  // -- Слушаем SUBCOLLECTIONS чатов водителей --------------------------------
  useEffect(() => {
    if (supportChatsLoading || supportChats.length === 0) return;

    const unsubs = supportChats.map((chat) => {
      // Подписываемся на всю коллекцию, но игнорируем первоначальный снимок.
      // Это позволяет ловить сообщения даже если у них нет поля createdAt
      const q = collection(db, `supportChats/${chat.id}/messages`);
      let initialized = false;

      return onSnapshot(
        q,
        { includeMetadataChanges: false },
        (snapshot) => {
          if (!initialized) {
            initialized = true;
            return;
          }

          snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
              const data = change.doc.data();
              const sender = data.senderType || data.sender || "";
              
              if (sender === "dispatcher") return;

              const text = data.text || data.message || data.content || "новое сообщение";
              const title = "💬 Сообщение от водителя";
              const body = `${chat.driverName}: ${text}`;
              
              setUnreadSupportCount(prev => prev + 1);
              setHighlightedSupportChatIds((prev) => {
                if (prev.includes(chat.id)) {
                  return prev;
                }
                return [chat.id, ...prev];
              });
              
              playSound("message");
              showBrowserNotif(title, body);
              toast(title, { description: body, duration: 6000 });
            }
          });
        },
        (err) => console.error(`[notifications] driver messages error for chat ${chat.id}:`, err)
      );
    });

    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supportChats.map(c => c.id).join(",")]);

  // -- Слушаем SUBCOLLECTIONS чатов клиентов ---------------------------------
  useEffect(() => {
    if (clientSupportChatsLoading || clientSupportChats.length === 0) return;

    const unsubs = clientSupportChats.map((chat) => {
      const q = collection(db, `support_chats/${chat.id}/messages`);
      let initialized = false;

      return onSnapshot(
        q,
        { includeMetadataChanges: false },
        (snapshot) => {
          if (!initialized) {
            initialized = true;
            return;
          }

          snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
              const data = change.doc.data();
              const sender = data.senderType || data.sender || "";
              
              if (sender === "dispatcher") return;

              const text = data.text || data.message || data.content || "новое сообщение";
              const title = "💬 Сообщение от клиента";
              const body = `${chat.clientName}: ${text}`;
              
              setUnreadClientSupportCount(prev => prev + 1);

              playSound("message");
              showBrowserNotif(title, body);
              toast(title, { description: body, duration: 6000 });
            }
          });
        },
        (err) => console.error(`[notifications] client messages error for chat ${chat.id}:`, err)
      );
    });

    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientSupportChats.map(c => c.id).join(",")]);

  // Подписка на новые заявки
  useEffect(() => {
    let initialized = false;

    const unsub = onSnapshot(
      collection(db, "orders"),
      { includeMetadataChanges: false },
      (snapshot) => {
        if (!initialized) {
          initialized = true;
          return;
        }

        const newOrders = snapshot.docChanges()
          .filter((change) => change.type === "added")
          .map((change) => {
            const data = change.doc.data();
            const status: string = data.status ?? "";

            if (status && status !== "new" && status !== "pending") {
              return null;
            }

            return {
              code: data.displayCode ?? data.code ?? change.doc.id,
              clientName: data.clientName ?? data.customerName ?? "Клиент",
              pickup: data.pickupAddress ?? data.fromAddress ?? "",
            };
          })
          .filter((order): order is { code: string; clientName: string; pickup: string } => order !== null);

        if (newOrders.length === 0) {
          return;
        }

        const title =
          newOrders.length === 1
            ? `🚨 Новая заявка ${newOrders[0].code}`
            : `🚨 Новые заявки: ${newOrders.length}`;
        const body =
          newOrders.length === 1
            ? `${newOrders[0].clientName}${newOrders[0].pickup ? ` — ${newOrders[0].pickup}` : ""}`
            : newOrders
              .slice(0, 3)
              .map((order) => order.code)
              .join(", ");

        playSound("order");
        showBrowserNotif(title, body);
        toast(title, {
          description:
            newOrders.length === 1
              ? body
              : `${body}${newOrders.length > 3 ? " и ещё..." : ""}`,
          duration: 9000,
        });
      },
      (err) => console.error("[notifications] orders error:", err)
    );

    return () => unsub();
  }, []);

  return {
    unreadSupportCount,
    setUnreadSupportCount,
    unreadClientSupportCount,
    setUnreadClientSupportCount,
    highlightedSupportChatIds,
    clearSupportChatHighlight: (chatId: string | null) => {
      if (!chatId) return;
      setHighlightedSupportChatIds((prev) => prev.filter((id) => id !== chatId));
    },
  };
}
