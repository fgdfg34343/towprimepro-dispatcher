import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  Search,
  Plus,
  MessageSquare,
  MessageCircle,
  BarChart3,
  Users,
  FileText,
  Wallet,
} from "lucide-react";
import { Link } from "react-router-dom";
import OrdersList from "@/components/OrdersList";
import SupportWidget from "@/components/SupportWidget";
import AnalyticsOverview from "@/components/AnalyticsOverview";
import OnlineDriversWidget from "@/components/OnlineDriversWidget";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MapView from "../components/MapView";
import DriversList from "@/components/DriversList";
import DriverOverview from "@/components/DriverOverview";
import SupportChatsList from "@/components/SupportChatsList";
import ChatWindow from "@/components/ChatWindow";
import SupportQuickReply from "@/components/SupportQuickReply";
import ClientSupportChatsList from "@/components/ClientSupportChatsList";
import ClientChatWindow from "@/components/ClientChatWindow";
import ClientSupportQuickReply from "@/components/ClientSupportQuickReply";
import OrderDetails from "@/components/OrderDetails";
import { useDriverDirectory } from "@/hooks/useDriverDirectory";
import { useSupportChats } from "@/hooks/useSupportChats";
import { useClientSupportChats } from "@/hooks/useClientSupportChats";
import { useOrders } from "@/hooks/useOrders";
import type { OrderRecord, OrderStatus } from "@/hooks/useOrders";
import CreateOrderDialog from "@/components/CreateOrderDialog";
import { useDispatcherNotifications } from "@/hooks/useDispatcherNotifications";
import { toast } from "sonner";
import { ensureSupportChatForDriver } from "@/lib/supportChats";
import ThemeToggle from "@/components/ThemeToggle";

type NavTab = "orders" | "drivers" | "support" | "clientSupport" | "analytics";

const ANALYTICS_WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Новые",
  assigned: "Назначены",
  "in-progress": "В пути",
  completed: "Завершены",
  cancelled: "Отменены",
};
type OrderAttentionStatus = Extract<OrderStatus, "new" | "assigned" | "in-progress">;
type OrderAttentionState = Record<OrderAttentionStatus, Set<string>>;

const ORDER_ATTENTION_STORAGE_KEY = "dispatcher-order-stage-attention";
const ORDER_ATTENTION_STATUSES: OrderAttentionStatus[] = ["new", "assigned", "in-progress"];

function createEmptyOrderAttentionState(): OrderAttentionState {
  return {
    new: new Set<string>(),
    assigned: new Set<string>(),
    "in-progress": new Set<string>(),
  };
}

function isOrderAttentionStatus(status: OrderStatus): status is OrderAttentionStatus {
  return ORDER_ATTENTION_STATUSES.includes(status as OrderAttentionStatus);
}

function cloneOrderAttentionState(state: OrderAttentionState): OrderAttentionState {
  return {
    new: new Set(state.new),
    assigned: new Set(state.assigned),
    "in-progress": new Set(state["in-progress"]),
  };
}

function areOrderAttentionStatesEqual(a: OrderAttentionState, b: OrderAttentionState) {
  return ORDER_ATTENTION_STATUSES.every((status) => {
    if (a[status].size !== b[status].size) {
      return false;
    }

    return Array.from(a[status]).every((orderId) => b[status].has(orderId));
  });
}

function loadStoredOrderAttentionState(): OrderAttentionState {
  if (typeof window === "undefined") {
    return createEmptyOrderAttentionState();
  }

  try {
    const rawValue = window.localStorage.getItem(ORDER_ATTENTION_STORAGE_KEY);
    if (!rawValue) {
      return createEmptyOrderAttentionState();
    }

    const parsed = JSON.parse(rawValue);
    const next = createEmptyOrderAttentionState();

    ORDER_ATTENTION_STATUSES.forEach((status) => {
      const values = parsed?.[status];
      if (!Array.isArray(values)) {
        return;
      }

      values.forEach((value) => {
        if (typeof value === "string" && value.trim().length > 0) {
          next[status].add(value);
        }
      });
    });

    return next;
  } catch {
    return createEmptyOrderAttentionState();
  }
}

function persistOrderAttentionState(state: OrderAttentionState) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      ORDER_ATTENTION_STORAGE_KEY,
      JSON.stringify({
        new: Array.from(state.new),
        assigned: Array.from(state.assigned),
        "in-progress": Array.from(state["in-progress"]),
      }),
    );
  } catch {
    // ignore localStorage failures
  }
}

function hasOrderAttention(state: OrderAttentionState, orderId: string) {
  return ORDER_ATTENTION_STATUSES.some((status) => state[status].has(orderId));
}

function getOrderAttentionStatus(state: OrderAttentionState, orderId: string): OrderAttentionStatus | null {
  for (const status of ORDER_ATTENTION_STATUSES) {
    if (state[status].has(orderId)) {
      return status;
    }
  }

  return null;
}

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState<NavTab>("orders");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedClientChatId, setSelectedClientChatId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [quickSupportChatId, setQuickSupportChatId] = useState<string | null>(null);
  const [quickClientSupportChatId, setQuickClientSupportChatId] = useState<string | null>(null);
  const [createOrderOpen, setCreateOrderOpen] = useState(false);
  const [focusedDriverId, setFocusedDriverId] = useState<string | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [orderAttentionState, setOrderAttentionState] = useState<OrderAttentionState>(
    () => loadStoredOrderAttentionState()
  );
  
  const hasInitializedOrdersRef = useRef(false);
  const knownOrderStatusRef = useRef<Map<string, OrderStatus>>(new Map());
  const driverDirectory = useDriverDirectory();
  const {
    chats: supportChats,
    loading: supportChatsLoading,
    error: supportChatsError,
  } = useSupportChats("active");
  const {
    chats: clientSupportChats,
    loading: clientSupportChatsLoading,
    error: clientSupportChatsError,
  } = useClientSupportChats("active");
  const ordersState = useOrders();

  const driverMap = useMemo(() => {
    return new Map(driverDirectory.drivers.map((driver) => [driver.id, driver]));
  }, [driverDirectory.drivers]);

  const updateOrderAttentionState = useCallback(
    (updater: (prev: OrderAttentionState) => OrderAttentionState) => {
      setOrderAttentionState((prev) => {
        const next = updater(prev);
        if (!areOrderAttentionStatesEqual(prev, next)) {
          persistOrderAttentionState(next);
          return next;
        }
        return prev;
      });
    },
    [],
  );

  const handleSelectDriver = (driverId: string) => {
    setSelectedDriverId(driverId);
    setFocusedDriverId(driverId);
  };

  useEffect(() => {
    if (selectedDriverId && !driverMap.has(selectedDriverId)) {
      setSelectedDriverId(null);
    }
  }, [driverMap, selectedDriverId]);

  // Уведомления о новых заявках и сообщениях
  const {
    unreadSupportCount,
    setUnreadSupportCount,
    unreadClientSupportCount,
    setUnreadClientSupportCount,
    highlightedSupportChatIds,
    clearSupportChatHighlight,
  } = useDispatcherNotifications({
    supportChats,
    supportChatsLoading,
    clientSupportChats,
    clientSupportChatsLoading,
  });

  useEffect(() => {
    if (activeTab === "support" || quickSupportChatId) {
      setUnreadSupportCount(0);
    }
  }, [activeTab, quickSupportChatId, setUnreadSupportCount]);

  useEffect(() => {
    if (activeTab === "clientSupport" || quickClientSupportChatId) {
      setUnreadClientSupportCount(0);
    }
  }, [activeTab, quickClientSupportChatId, setUnreadClientSupportCount]);

  useEffect(() => {
    if (selectedChatId && !supportChats.some((chat) => chat.id === selectedChatId)) {
      setSelectedChatId(null);
    }
  }, [selectedChatId, supportChats]);

  useEffect(() => {
    if (!selectedChatId) {
      return;
    }

    clearSupportChatHighlight(selectedChatId);
  }, [clearSupportChatHighlight, selectedChatId]);

  const handleOpenDriverChat = async (driverId: string) => {
    try {
      const driver = driverDirectory.drivers.find((d) => d.id === driverId);
      const resolvedDriverId = driver?.authUid?.trim() || driverId;
      const chatId = await ensureSupportChatForDriver({
        driverId: resolvedDriverId,
        driverName: driver?.fullName || "Водитель",
        driverPhone: driver?.phoneNumber || "",
        vehicleType: driver?.vehicleType ?? null,
      });

      // Переключаемся на вкладку поддержки и открываем чат
      setActiveTab("support");
      setSelectedChatId(chatId);
    } catch (error) {
      console.error("Ошибка открытия чата с водителем:", error);
      toast.error("Не удалось открыть чат с водителем");
    }
  };

  useEffect(() => {
    if (
      selectedClientChatId &&
      !clientSupportChats.some((chat) => chat.id === selectedClientChatId)
    ) {
      setSelectedClientChatId(null);
    }
  }, [selectedClientChatId, clientSupportChats]);

  const selectedChat = useMemo(() => {
    if (!selectedChatId) {
      return null;
    }

    const baseChat = supportChats.find((chat) => chat.id === selectedChatId);
    if (!baseChat) {
      return null;
    }

    const driver = driverMap.get(baseChat.driverId);
    if (!driver) {
      return {
        ...baseChat,
        driverName:
          baseChat.driverName === "Неизвестный водитель" &&
            baseChat.rawDriverData &&
            typeof baseChat.rawDriverData.name === "string"
            ? baseChat.rawDriverData.name
            : baseChat.driverName,
        driverPhone: baseChat.driverPhone,
        vehicleType:
          baseChat.vehicleType ??
          (baseChat.rawDriverData &&
            typeof baseChat.rawDriverData.vehicleType === "string"
            ? baseChat.rawDriverData.vehicleType
            : undefined),
      };
    }

    const enrichedName =
      (driver.fullName && driver.fullName.trim().length > 0
        ? driver.fullName
        : baseChat.driverName)?.trim() || baseChat.driverName;

    const enrichedPhone =
      driver.phoneNumber?.trim().length
        ? driver.phoneNumber
        : baseChat.driverPhone;

    return {
      ...baseChat,
      driverName: enrichedName,
      driverPhone: enrichedPhone,
      vehicleType: baseChat.vehicleType ?? driver.vehicleType,
    };
  }, [selectedChatId, supportChats, driverMap]);

  const selectedClientChat = useMemo(() => {
    if (!selectedClientChatId) {
      return null;
    }

    return clientSupportChats.find((chat) => chat.id === selectedClientChatId) ?? null;
  }, [selectedClientChatId, clientSupportChats]);

  useEffect(() => {
    if (selectedOrderId && !ordersState.orders.some((order) => order.id === selectedOrderId)) {
      setSelectedOrderId(null);
    }
  }, [ordersState.orders, selectedOrderId]);

  useEffect(() => {
    if (ordersState.loading) {
      return;
    }

    const currentOrderStatus = new Map<string, OrderStatus>(
      ordersState.orders.map((order) => [order.id, order.status])
    );

    if (!hasInitializedOrdersRef.current) {
      hasInitializedOrdersRef.current = true;
      knownOrderStatusRef.current = currentOrderStatus;

      updateOrderAttentionState((prev) => {
        const next = createEmptyOrderAttentionState();
        
        // Remove attention for orders that no longer exist
        ORDER_ATTENTION_STATUSES.forEach(status => {
          prev[status].forEach(orderId => {
            if (currentOrderStatus.has(orderId)) {
              // Note: we don't fix the status bucket here if it moved. We'll rely on dispatcher clicking it.
              // Actually, if it's the first load, let's auto-clean up status mismatches:
              const realStatus = currentOrderStatus.get(orderId);
              if (realStatus === status) {
                next[status].add(orderId);
              }
            }
          });
        });

        return next;
      });
      return;
    }

    updateOrderAttentionState((prev) => {
      let changed = false;
      const next = cloneOrderAttentionState(prev);

      // 1. Clean up deleted orders
      ORDER_ATTENTION_STATUSES.forEach(status => {
        next[status].forEach(orderId => {
          if (!currentOrderStatus.has(orderId)) {
            next[status].delete(orderId);
            changed = true;
          }
        });
      });

      // 2. Check for newly created or status-changed orders
      ordersState.orders.forEach((order) => {
        const prevStatus = knownOrderStatusRef.current.get(order.id);
        
        if (prevStatus !== order.status) {
          // Status changed or it's a completely new order
          
          // Clear it from the old status bucket if it was there
          if (prevStatus && isOrderAttentionStatus(prevStatus)) {
            if (next[prevStatus].has(order.id)) {
               next[prevStatus].delete(order.id);
               changed = true;
            }
          }

          // Add it to the new status bucket (if it's an attention status)
          if (isOrderAttentionStatus(order.status)) {
            if (!next[order.status].has(order.id)) {
              next[order.status].add(order.id);
              changed = true;
            }
          }
        }
      });

      return changed ? next : prev;
    });

    knownOrderStatusRef.current = currentOrderStatus;
  }, [ordersState.loading, ordersState.orders, updateOrderAttentionState]);

  const handleSelectOrder = useCallback(
    (orderId: string | null) => {
      setSelectedOrderId(orderId);
      
      if (orderId) {
        updateOrderAttentionState((prev) => {
          const status = getOrderAttentionStatus(prev, orderId);
          if (status) {
            const next = cloneOrderAttentionState(prev);
            next[status].delete(orderId);
            return next;
          }
          return prev;
        });
      }
    },
    [updateOrderAttentionState],
  );

  const selectedOrder = useMemo<OrderRecord | null>(() => {
    if (!selectedOrderId) {
      return null;
    }
    return ordersState.orders.find((order) => order.id === selectedOrderId) ?? null;
  }, [selectedOrderId, ordersState.orders]);

  const selectedDriver = useMemo(() => {
    if (!selectedDriverId) {
      return null;
    }

    return driverMap.get(selectedDriverId) ?? null;
  }, [driverMap, selectedDriverId]);

  const quickReplyChat = useMemo(() => {
    if (!quickSupportChatId) {
      return null;
    }

    return supportChats.find((chat) => chat.id === quickSupportChatId) ?? null;
  }, [quickSupportChatId, supportChats]);

  const quickClientReplyChat = useMemo(() => {
    if (!quickClientSupportChatId) {
      return null;
    }

    return clientSupportChats.find((chat) => chat.id === quickClientSupportChatId) ?? null;
  }, [quickClientSupportChatId, clientSupportChats]);

  useEffect(() => {
    if (!quickSupportChatId) {
      return;
    }

    const exists = supportChats.some((chat) => chat.id === quickSupportChatId);
    if (!exists) {
      setQuickSupportChatId(null);
    }
  }, [quickSupportChatId, supportChats]);

  useEffect(() => {
    if (!quickClientSupportChatId) {
      return;
    }

    const exists = clientSupportChats.some((chat) => chat.id === quickClientSupportChatId);
    if (!exists) {
      setQuickClientSupportChatId(null);
    }
  }, [quickClientSupportChatId, clientSupportChats]);

  const analyticsSidebarSummary = useMemo(() => {
    const cutoff = Date.now() - ANALYTICS_WINDOW_DAYS * DAY_MS;
    const statuses: Record<string, number> = {
      new: 0,
      assigned: 0,
      "in-progress": 0,
      completed: 0,
      cancelled: 0,
    };
    let autoAssigned = 0;

    ordersState.orders.forEach((order) => {
      if (!order.createdAt || order.createdAt.getTime() < cutoff) {
        return;
      }
      statuses[order.status] = (statuses[order.status] ?? 0) + 1;
      if (order.assignedAutomatically) {
        autoAssigned += 1;
      }
    });

    const total = Object.values(statuses).reduce((sum, count) => sum + count, 0);

    const autoAssignRate = total === 0 ? 0 : Math.round((autoAssigned / total) * 100);

    return {
      total,
      statuses,
      autoAssigned,
      autoAssignRate,
    };
  }, [ordersState.orders]);

  const unseenOrdersCount = ORDER_ATTENTION_STATUSES.reduce(
    (sum, status) => sum + orderAttentionState[status].size,
    0
  );

  const searchPlaceholder = (() => {
    switch (activeTab) {
      case "drivers":
        return "Поиск по имени, телефону или ID водителя...";
      case "support":
        return "Поиск по имени или телефону водителя...";
      case "clientSupport":
        return "Поиск по имени или телефону клиента...";
      default:
        return "Поиск по адресу, телефону, номеру заказа...";
    }
  })();

  return (
    <>
      <CreateOrderDialog
        open={createOrderOpen}
        onOpenChange={setCreateOrderOpen}
        drivers={driverDirectory.drivers}
        onAssignDriver={ordersState.assignDriver}
      />
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border bg-card sticky top-0 z-50">
          <div className="px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-8">
              <button
                type="button"
                onClick={() => setActiveTab("orders")}
                className="flex items-center gap-2 rounded-xl px-2 py-1 text-left transition-colors hover:bg-background-elevated"
                aria-label="Открыть страницу заявок"
              >
                <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="font-bold text-lg text-foreground">
                  TowPrime<span className="text-primary">PRO</span>
                </span>
              </button>

              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as NavTab)}>
                <TabsList className="bg-background-elevated">
                  <TabsTrigger value="orders" className="gap-2 relative">
                    <FileText className="w-4 h-4" />
                    Заявки
                    {unseenOrdersCount > 0 && (
                      <span className="absolute -top-1 -right-1 inline-flex min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-black shadow-[0_0_0_3px_hsl(var(--card))]">
                        {unseenOrdersCount > 9 ? "9+" : unseenOrdersCount}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="drivers" className="gap-2">
                    <Users className="w-4 h-4" />
                    Водители
                  </TabsTrigger>
                  <TabsTrigger value="support" className="gap-2 relative">
                    <MessageSquare className="w-4 h-4" />
                    Поддержка
                    {unreadSupportCount > 0 && (
                      <span className="absolute -top-1 -right-1 inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-[0_0_0_3px_hsl(var(--card))]">
                        {unreadSupportCount > 99 ? "99+" : unreadSupportCount}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="clientSupport" className="gap-2 relative">
                    <MessageCircle className="w-4 h-4" />
                    Поддержка клиентов
                    {unreadClientSupportCount > 0 && (
                      <span className="absolute -top-1 -right-1 inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-[0_0_0_3px_hsl(var(--card))]">
                        {unreadClientSupportCount > 99 ? "99+" : unreadClientSupportCount}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="analytics" className="gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Аналитика
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <Link to="/accruals" className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                <Wallet className="w-4 h-4 text-primary" />
                <span>Начисления</span>
              </Link>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-background-elevated border-border"
                  autoComplete="off"
                />
              </div>

              <div className="flex items-center gap-3">
                <ThemeToggle />
                <Badge variant="outline" className="gap-2 px-3 py-1.5">
                  <div className="w-2 h-2 bg-status-completed rounded-full" />
                  <span className="text-sm">Диспетчер</span>
                </Badge>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex h-[calc(100vh-4rem)]">
          {/* Left Sidebar */}
          <aside className="w-96 border-r border-border bg-background-elevated overflow-y-auto">
            {activeTab === "orders" && (
              <OrdersList
                searchQuery={searchQuery}
                orders={ordersState.orders}
                loading={ordersState.loading}
                error={ordersState.error}
                onSelectOrder={handleSelectOrder}
                selectedOrderId={selectedOrderId}
                onAssignDriver={ordersState.assignDriver}
                drivers={driverDirectory.drivers}
                orderAttentionState={orderAttentionState}
              />
            )}

            {activeTab === "drivers" && (
              <DriversList
                searchQuery={searchQuery}
                drivers={driverDirectory.drivers}
                loading={driverDirectory.loading}
                error={driverDirectory.error}
                onOpenChat={handleOpenDriverChat}
                onSelectDriver={handleSelectDriver}
                selectedDriverId={selectedDriverId}
              />
            )}

            {activeTab === "support" && (
              <SupportChatsList
                selectedChatId={selectedChatId}
                onSelectChat={setSelectedChatId}
                chats={supportChats}
                loading={supportChatsLoading}
                error={supportChatsError}
                drivers={driverDirectory.drivers}
                highlightedChatIds={highlightedSupportChatIds}
              />
            )}

            {activeTab === "clientSupport" && (
              <ClientSupportChatsList
                selectedChatId={selectedClientChatId}
                onSelectChat={setSelectedClientChatId}
                chats={clientSupportChats}
                loading={clientSupportChatsLoading}
                error={clientSupportChatsError}
              />
            )}

            {activeTab === "analytics" && (
              <div className="space-y-4 p-6">
                <div className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">За 7 дней</p>
                      <p className="text-xl font-semibold">{analyticsSidebarSummary.total}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      Автоназначения {analyticsSidebarSummary.autoAssignRate}%
                    </Badge>
                  </div>

                  <div className="mt-4 space-y-3 text-sm">
                    {(Object.keys(STATUS_LABELS) as Array<OrderStatus>).map((status) => (
                      <div key={status} className="flex items-center justify-between">
                        <span>{STATUS_LABELS[status]}</span>
                        <span className="font-semibold">
                          {analyticsSidebarSummary.statuses[status] ?? 0}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-dashed border-border/60 bg-background p-4 text-xs text-muted-foreground">
                  Метрики обновляются автоматически при изменении заказов в Firestore.
                </div>
              </div>
            )}
          </aside>

          {/* Center - Map or Chat */}
          <main className="flex-1 relative">
            {activeTab === "support" ? (
              <ChatWindow
                chat={selectedChat}
                onClose={() => setSelectedChatId(null)}
              />
            ) : activeTab === "clientSupport" ? (
              <ClientChatWindow
                chat={selectedClientChat}
                onClose={() => setSelectedClientChatId(null)}
              />
            ) : activeTab === "analytics" ? (
              <AnalyticsOverview
                orders={ordersState.orders}
                loading={ordersState.loading}
                error={ordersState.error}
              />
            ) : (
              <MapView
                selectedOrder={selectedOrder}
                onAssignDriver={ordersState.assignDriver}
                focusedDriverId={focusedDriverId}
                orders={ordersState.orders}
              />
            )}
          </main>

          {activeTab !== "clientSupport" && (
            <aside className="w-96 border-l border-border bg-background-elevated overflow-y-auto p-6 space-y-6">
              {activeTab === "orders" ? (
                selectedOrder ? (
                  <OrderDetails order={selectedOrder} onClose={() => setSelectedOrderId(null)} onCancelOrder={ordersState.cancelOrder} />
                ) : (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold">Быстрые действия</h2>
                      </div>
                      <Button
                        type="button"
                        className="w-full gap-2 shadow-glow"
                        onClick={() => setCreateOrderOpen(true)}
                      >
                        <Plus className="w-4 h-4" />
                        Создать заявку
                      </Button>
                    </div>

                    <SupportWidget
                      chats={supportChats}
                      loading={supportChatsLoading}
                      highlightedChatIds={highlightedSupportChatIds}
                      onSelectChat={(chatId) => {
                        clearSupportChatHighlight(chatId);
                        setQuickSupportChatId(chatId);
                      }}
                      onOpenInbox={() => {
                        setActiveTab("support");
                        if (supportChats.length > 0) {
                          const firstChatId = supportChats[0]?.id ?? null;
                          clearSupportChatHighlight(firstChatId);
                          setSelectedChatId(firstChatId);
                        }
                      }}
                    />
                    <OnlineDriversWidget
                      drivers={driverDirectory.drivers}
                      loading={driverDirectory.loading}
                      error={driverDirectory.error}
                    />
                  </>
                )
              ) : activeTab === "drivers" ? (
                <DriverOverview
                  drivers={driverDirectory.drivers}
                  loading={driverDirectory.loading}
                  error={driverDirectory.error}
                  selectedDriver={selectedDriver}
                />
              ) : activeTab === "support" && selectedChat ? (
                <div>
                  <h2 className="text-lg font-semibold mb-4">Информация о водителе</h2>
                  <div className="bg-card border border-border rounded-lg p-4 space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Имя</p>
                      <p className="font-semibold">{selectedChat.driverName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Телефон</p>
                      <p className="font-semibold">{selectedChat.driverPhone}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">ID водителя</p>
                      <p className="text-xs font-mono">{selectedChat.driverId}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Статус обращения</p>
                      <Badge
                        variant={
                          selectedChat.status === "closed" ? "outline" : "default"
                        }
                      >
                        {selectedChat.status === "closed"
                          ? "Закрыто"
                          : selectedChat.status === "pending"
                            ? "В обработке"
                            : "Активно"}
                      </Badge>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold">Быстрые действия</h2>
                    </div>
                    <Button
                      type="button"
                      className="w-full gap-2 shadow-glow"
                      onClick={() => setCreateOrderOpen(true)}
                    >
                      <Plus className="w-4 h-4" />
                      Создать заявку
                    </Button>
                  </div>

                  <SupportWidget
                    chats={supportChats}
                    loading={supportChatsLoading}
                    unreadCount={unreadSupportCount}
                    highlightedChatIds={highlightedSupportChatIds}
                    onSelectChat={(chatId) => {
                      clearSupportChatHighlight(chatId);
                      setQuickSupportChatId(chatId);
                    }}
                    onOpenInbox={() => {
                      setActiveTab("support");
                      if (supportChats.length > 0) {
                        const firstChatId = supportChats[0]?.id ?? null;
                        clearSupportChatHighlight(firstChatId);
                        setSelectedChatId(firstChatId);
                      }
                    }}
                  />
                  <OnlineDriversWidget
                    drivers={driverDirectory.drivers}
                    loading={driverDirectory.loading}
                    error={driverDirectory.error}
                  />
                </>
              )}
            </aside>
          )}
        </div>
      </div>
      {quickReplyChat && (
        <SupportQuickReply
          chat={quickReplyChat}
          onClose={() => setQuickSupportChatId(null)}
          onOpenFull={(chatId) => {
            setActiveTab("support");
            setSelectedChatId(chatId);
          }}
        />
      )}
      {quickClientReplyChat && (
        <ClientSupportQuickReply
          chat={quickClientReplyChat}
          onClose={() => setQuickClientSupportChatId(null)}
          onOpenFull={(chatId) => {
            setActiveTab("clientSupport");
            setSelectedClientChatId(chatId);
          }}
        />
      )}
    </>
  );
};

export default Dashboard;
