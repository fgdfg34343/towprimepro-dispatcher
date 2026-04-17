import { useMemo, useState } from "react";
import { MapPin, Phone, Clock, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { OrderRecord, OrderStatus, AssignDriverPayload } from "@/hooks/useOrders";
import type { DriverDirectoryEntry } from "@/hooks/useDriverDirectory";

type ListFilter = "all" | OrderStatus;

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string }> = {
  new: { label: "Новая", color: "bg-status-new" },
  assigned: { label: "Назначена", color: "bg-status-assigned" },
  "in-progress": { label: "В пути", color: "bg-status-in-progress" },
  completed: { label: "Завершена", color: "bg-status-completed" },
  cancelled: { label: "Отменена", color: "bg-muted text-muted-foreground border border-border" },
};

const STATUS_FILTERS: Array<{ value: ListFilter; label: string }> = [
  { value: "new", label: "Новые" },
  { value: "assigned", label: "Назначены" },
  { value: "in-progress", label: "В пути" },
  { value: "completed", label: "Завершены" },
  { value: "all", label: "Все" },
];

type OrderAttentionStatus = Extract<OrderStatus, "new" | "assigned" | "in-progress">;

interface OrdersListProps {
  searchQuery: string;
  orders: OrderRecord[];
  loading: boolean;
  error: string | null;
  orderAttentionState: Record<OrderAttentionStatus, Set<string>>;
  selectedOrderId: string | null;
  onSelectOrder: (orderId: string | null) => void;
  onAssignDriver: (payload: AssignDriverPayload) => Promise<void>;
  drivers: DriverDirectoryEntry[];
}

function getAttentionStyles(status: string) {
  switch (status) {
    case "new":
      return "bg-orange-950/35 border-orange-400 shadow-[0_0_0_1px_rgba(251,146,60,0.45),0_0_30px_rgba(249,115,22,0.2)] animate-order-attention";
    case "assigned":
      return "bg-blue-950/35 border-blue-400 shadow-[0_0_0_1px_rgba(59,130,246,0.45),0_0_30px_rgba(59,130,246,0.2)] animate-order-attention";
    case "in-progress":
      return "bg-green-950/35 border-green-400 shadow-[0_0_0_1px_rgba(34,197,94,0.45),0_0_30px_rgba(34,197,94,0.2)] animate-order-attention";
    default:
      return "";
  }
}

function getAttentionBadgeClass(status: string) {
  switch (status) {
    case "new":
      return "bg-orange-500 text-black";
    case "assigned":
      return "bg-blue-500 text-white";
    case "in-progress":
      return "bg-green-500 text-white";
    default:
      return "";
  }
}

const OrdersList = ({
  searchQuery,
  orders,
  loading,
  error,
  orderAttentionState,
  selectedOrderId,
  onSelectOrder,
  onAssignDriver,
  drivers,
}: OrdersListProps) => {
  const [filter, setFilter] = useState<ListFilter>("all");
  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null);
  const { toast } = useToast();

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesFilter = filter === "all" ? true : order.status === filter;
      if (!matchesFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        order.clientName,
        order.clientPhone,
        order.pickupAddress,
        order.dropoffAddress,
        order.code,
        order.driverName ?? "",
        order.driverPhone ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [orders, filter, normalizedSearch]);

  const unseenFilteredOrdersCount = useMemo(() => {
    return filteredOrders.reduce((count, order) => {
      const isAttentionStatus = order.status === "new" || order.status === "assigned" || order.status === "in-progress";
      const hasAttention = isAttentionStatus && orderAttentionState[order.status as OrderAttentionStatus].has(order.id);
      return count + (hasAttention ? 1 : 0);
    }, 0);
  }, [filteredOrders, orderAttentionState]);

  const handleAssignDriver = async (order: OrderRecord, driverId: string) => {
    if (!driverId) {
      return;
    }

    const driver = drivers.find((item) => item.id === driverId);
    if (!driver) {
      toast({
        variant: "destructive",
        title: "Не удалось назначить водителя",
        description: "Выбранный водитель не найден",
      });
      return;
    }

    const fallbackName = [driver.firstName, driver.lastName].filter(Boolean).join(" ").trim();
    const driverDisplayName = (driver.fullName || fallbackName || "Водитель").trim();

    try {
      setAssigningOrderId(order.id);
      await onAssignDriver({
        orderId: order.id,
        driverId: driver.id,
        driverName: driverDisplayName,
        driverPhone: driver.phoneNumber,
        vehicleType: driver.vehicleType,
        keepStatus: order.status !== "new",
        autoAssigned: false,
      });

      toast({
        title: "Водитель назначен",
        description: `${driverDisplayName} назначен на заявку ${order.code}`,
      });
    } catch (assignError) {
      console.error("[orders] Failed to assign driver", assignError);
      toast({
        variant: "destructive",
        title: "Ошибка назначения",
        description: "Не удалось назначить водителя, попробуйте ещё раз.",
      });
    } finally {
      setAssigningOrderId(null);
    }
  };

  const renderStatusTabs = () => (
    <Tabs value={filter} onValueChange={(value) => setFilter(value as ListFilter)}>
      <TabsList className="w-full grid grid-cols-5 bg-background">
        {STATUS_FILTERS.map((status) => {
          const isAttentionStatus = status.value === "new" || status.value === "assigned" || status.value === "in-progress";
          const count = isAttentionStatus ? orderAttentionState[status.value as OrderAttentionStatus].size : 0;
          
          return (
            <TabsTrigger key={status.value} value={status.value} className="text-xs relative">
              {status.label}
              {count > 0 && (
                <span className={cn(
                  "absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold shadow-sm",
                  getAttentionBadgeClass(status.value)
                )}>
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );

  const renderSkeleton = () => (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="bg-card border border-border rounded-xl p-4 space-y-3"
        >
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="p-4 space-y-4">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Заявки</h2>
          <div className="flex items-center gap-2">
            {unseenFilteredOrdersCount > 0 && (
              <Badge className="border-0 bg-primary text-primary-foreground px-2 py-1 text-[11px] font-bold shadow">
                Обновлены {unseenFilteredOrdersCount}
              </Badge>
            )}
            {orders.length > 0 && (
              <Badge variant="outline" className="text-xs px-2 py-1">
                {orders.length}
              </Badge>
            )}
          </div>
        </div>
        {renderStatusTabs()}
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <p className="font-semibold">Не удалось загрузить заявки</p>
          <p className="mt-1 opacity-90">{error}</p>
        </div>
      ) : loading ? (
        renderSkeleton()
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>Нет заявок</p>
          <p className="text-sm mt-1">Создайте новую или измените фильтр</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const isSelected = selectedOrderId === order.id;
            const isAttentionStatus = order.status === "new" || order.status === "assigned" || order.status === "in-progress";
            const isUnseen = isAttentionStatus && orderAttentionState[order.status as OrderAttentionStatus].has(order.id);
            const statusMeta = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.new;
            const createdAtLabel = order.createdAt
              ? order.createdAt.toLocaleTimeString("ru-RU", {
                hour: "2-digit",
                minute: "2-digit",
              })
              : "—";

            return (
              <div
                key={order.id}
                className={cn(
                  "border rounded-xl p-4 transition-all cursor-pointer relative",
                  isUnseen
                    ? getAttentionStyles(order.status)
                    : order.status === "new" && !isSelected
                      ? "bg-orange-950/20 border-orange-500/60 shadow-[0_0_12px_2px_rgba(249,115,22,0.18)]"
                      : isSelected
                        ? "bg-card border-primary shadow-glow"
                        : "bg-card border-border hover:border-primary/50",
                  isSelected && "border-primary shadow-glow",
                )}
                onClick={() => onSelectOrder(isSelected ? null : order.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectOrder(isSelected ? null : order.id);
                  }
                }}
              >
                <div className="flex items-start justify-between mb-3 gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm">{order.clientName}</span>
                      {isUnseen && (
                        <Badge className={cn("border-0 px-2 py-0 text-[10px] font-bold uppercase tracking-wide", getAttentionBadgeClass(order.status))}>
                          {STATUS_CONFIG[order.status].label}
                        </Badge>
                      )}
                      {order.priority && (
                        <Badge variant="destructive" className="text-xs px-2 py-0">
                          Срочно
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      {order.code}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge
                      className={cn(
                        "text-xs px-2 py-0.5 border-0",
                        statusMeta.color.includes("border")
                          ? statusMeta.color
                          : `${statusMeta.color} text-white`,
                      )}
                    >
                      {statusMeta.label}
                    </Badge>
                    {isUnseen ? (
                      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-300">
                        ● Не просмотрена
                      </span>
                    ) : order.status === "new" && (
                      <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest animate-pulse">
                        ● Ожидает
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-status-new mt-0.5 flex-shrink-0" />
                    <span className="text-foreground">{order.pickupAddress}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-status-completed mt-0.5 flex-shrink-0" />
                    <span className="text-foreground">{order.dropoffAddress}</span>
                  </div>

                  {/* Payment Info */}
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-dashed border-border/60">
                    <span className="font-bold text-foreground">{order.price} ₽</span>
                    <Badge variant="outline" className={cn(
                      "text-[10px] px-1.5 py-0 h-5",
                      order.paymentStatus === "succeeded"
                        ? "bg-green-500/10 text-green-600 border-green-200"
                        : order.paymentMethod?.includes("card") || order.paymentMethod === "online"
                          ? "bg-blue-500/10 text-blue-600 border-blue-200"
                          : "bg-gray-100 text-gray-600 border-gray-200"
                    )}>
                      {order.paymentMethod?.includes("card") || order.paymentMethod === "online" ? "Карта" : "Наличные"}
                      {order.paymentStatus === "succeeded" && " (Оплачено)"}
                    </Badge>
                  </div>
                </div>

                <div className="flex flex-col gap-3 mt-3 pt-3 border-t border-border">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      <span>{createdAtLabel}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      <span>{order.clientPhone || "—"}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <UserRound className="w-4 h-4" />
                        <span>{order.driverName || "Не назначен"}</span>
                      </div>
                      {order.driverPhone && (
                        <span className="text-xs text-muted-foreground">{order.driverPhone}</span>
                      )}
                    </div>
                    <Select
                      value={order.driverId ?? ""}
                      onValueChange={(value) => handleAssignDriver(order, value)}
                      disabled={assigningOrderId === order.id || drivers.length === 0 || !!order.driverId}
                    >
                      <SelectTrigger
                        onClick={(event) => event.stopPropagation()}
                        onPointerDown={(event) => event.stopPropagation()}
                        className="text-xs"
                      >
                        <SelectValue
                          placeholder={
                            drivers.length === 0
                              ? "Нет водителей"
                              : order.driverId
                                ? "Сменить водителя (недоступно)"
                                : "Назначить водителя"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent onClick={(event) => event.stopPropagation()}>
                        {drivers.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-muted-foreground">
                            Нет доступных водителей
                          </div>
                        ) : (
                          <>
                            {order.driverId && !drivers.some((driver) => driver.id === order.driverId) && (
                              <SelectItem value={order.driverId}>
                                {order.driverName || `Водитель ${order.driverId}`}
                              </SelectItem>
                            )}
                            {drivers.map((driver) => {
                              const fallbackName = [driver.firstName, driver.lastName]
                                .filter(Boolean)
                                .join(" ")
                                .trim();
                              const label = (driver.fullName || fallbackName || "Без имени").trim();

                              return (
                                <SelectItem key={driver.id} value={driver.id}>
                                  {label}
                                </SelectItem>
                              );
                            })}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OrdersList;
