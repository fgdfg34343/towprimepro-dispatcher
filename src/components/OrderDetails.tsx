import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { MapPin, Phone, UserRound, Truck, ClipboardList, Clock, AlertTriangle, XCircle } from "lucide-react";
import type { OrderRecord, OrderStatus } from "@/hooks/useOrders";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { doc, onSnapshot, type DocumentData, type FirestoreError } from "firebase/firestore";
import { db } from "@/firebaseConfig";
import CancelOrderDialog from "@/components/CancelOrderDialog";

const STATUS_META: Record<OrderStatus, { label: string; color: string }> = {
  new: { label: "Новая", color: "bg-status-new text-white" },
  assigned: { label: "Назначена", color: "bg-status-assigned text-white" },
  "in-progress": { label: "В пути", color: "bg-status-in-progress text-white" },
  completed: { label: "Завершена", color: "bg-status-completed text-white" },
  cancelled: { label: "Отменена", color: "bg-muted text-muted-foreground border border-border" },
};

interface OrderDetailsProps {
  order: OrderRecord;
  onClose?: () => void;
  onCancelOrder?: (orderId: string, comment: string) => Promise<void>;
}

const formatDate = (date: Date | null) => {
  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

interface DriverData {
  name: string | null;
  phone: string | null;
  vehicleType: string | null;
  photo: string | null;
}

const OrderDetails = ({ order, onClose, onCancelOrder }: OrderDetailsProps) => {
  const statusMeta = STATUS_META[order.status] ?? STATUS_META.new;
  const createdAtLabel = formatDate(order.createdAt);
  const [driverData, setDriverData] = useState<DriverData | null>(null);
  const [driverLoading, setDriverLoading] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const canCancel = onCancelOrder && order.status !== "cancelled" && order.status !== "completed";

  // Подтягиваем данные водителя из коллекции drivers через onSnapshot
  useEffect(() => {
    if (!order.driverId) {
      setDriverData(null);
      return;
    }

    setDriverLoading(true);
    const driverRef = doc(db, "drivers", order.driverId);

    const unsubscribe = onSnapshot(
      driverRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as DocumentData;
          
          // Извлекаем имя водителя
          const firstName = typeof data.firstName === "string" ? data.firstName.trim() : "";
          const lastName = typeof data.lastName === "string" ? data.lastName.trim() : "";
          const fullName = typeof data.fullName === "string" ? data.fullName.trim() : "";
          const name = fullName || `${firstName} ${lastName}`.trim() || null;
          
          // Извлекаем телефон
          const phone = typeof data.phoneNumber === "string" ? data.phoneNumber.trim() : null;
          
          // Извлекаем тип транспорта
          const vehicleType = typeof data.vehicleType === "string" ? data.vehicleType.trim() : null;
          
          // Извлекаем фото (может быть в разных местах)
          let photo: string | null = null;
          if (typeof data.photo === "string" && data.photo.trim()) {
            photo = data.photo.trim();
          } else if (typeof data.photoUrl === "string" && data.photoUrl.trim()) {
            photo = data.photoUrl.trim();
          } else if (data.documents && typeof data.documents === "object") {
            // Проверяем документы на наличие фото
            const documents = data.documents as Record<string, unknown>;
            for (const docData of Object.values(documents)) {
              if (docData && typeof docData === "object") {
                const docObj = docData as Record<string, unknown>;
                if (typeof docObj.imageUrl === "string" && docObj.imageUrl.trim()) {
                  photo = docObj.imageUrl.trim();
                  break;
                }
              }
            }
          }
          
          setDriverData({
            name,
            phone,
            vehicleType,
            photo,
          });
        } else {
          setDriverData(null);
        }
        setDriverLoading(false);
      },
      (error: FirestoreError) => {
        console.error("[OrderDetails] Failed to load driver data:", error);
        setDriverData(null);
        setDriverLoading(false);
      },
    );

    return () => {
      unsubscribe();
    };
  }, [order.driverId]);

  // Используем данные из базы, если они есть, иначе fallback на данные из заказа
  const displayDriverName = driverData?.name || order.driverName || "Не назначен";
  const displayDriverPhone = driverData?.phone || order.driverPhone || "—";
  const displayVehicleType = driverData?.vehicleType || order.vehicleType;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-wide">
            {order.id}
          </p>
          <h2 className="text-lg font-semibold mt-1">Заявка {order.code}</h2>
          {createdAtLabel && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
              <Clock className="w-4 h-4" />
              <span>{createdAtLabel}</span>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge
            className={cn(
              "px-3 py-1 text-xs border-0",
              statusMeta.color.includes("border")
                ? statusMeta.color
                : `${statusMeta.color} border-none`,
            )}
          >
            {statusMeta.label}
          </Badge>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose} className="text-xs px-2 py-1">
              Сбросить выбор
            </Button>
          )}
        </div>
      </div>

      {order.priority && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="w-4 h-4" />
          <span>Срочная заявка</span>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ClipboardList className="w-4 h-4 text-muted-foreground" />
          <span>Клиент</span>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-foreground">
            <UserRound className="w-4 h-4 text-muted-foreground" />
            <span>{order.clientName}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="w-4 h-4" />
            <span>{order.clientPhone || "—"}</span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <MapPin className="w-4 h-4 text-muted-foreground" />
          <span>Маршрут</span>
        </div>
        <div className="space-y-2 text-sm text-foreground">
          <div>
            <p className="text-xs text-muted-foreground uppercase">Подача</p>
            <p>{order.pickupAddress}</p>
          </div>
          <Separator />
          <div>
            <p className="text-xs text-muted-foreground uppercase">Назначение</p>
            <p>{order.dropoffAddress}</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Truck className="w-4 h-4 text-muted-foreground" />
          <span>Водитель</span>
        </div>
        {driverLoading ? (
          <div className="text-sm text-muted-foreground">Загрузка данных водителя...</div>
        ) : (
          <div className="space-y-2 text-sm">
            {driverData?.photo && (
              <div className="mb-2">
                <img
                  src={driverData.photo}
                  alt={displayDriverName}
                  className="w-16 h-16 rounded-full object-cover border border-border"
                />
              </div>
            )}
            <div className="flex items-center gap-2 text-foreground">
              <UserRound className="w-4 h-4 text-muted-foreground" />
              <span>{displayDriverName}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="w-4 h-4" />
              <span>{displayDriverPhone}</span>
            </div>
            {displayVehicleType && (
              <p className="text-xs text-muted-foreground">
                Тип транспорта: <span className="text-foreground">{displayVehicleType}</span>
              </p>
            )}
          </div>
        )}
      </div>

      {order.notes && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ClipboardList className="w-4 h-4 text-muted-foreground" />
            <span>Комментарий</span>
          </div>
          <p className="text-sm text-foreground leading-relaxed">{order.notes}</p>
        </div>
      )}

      {/* Кнопка завершения заявки */}
      {canCancel && (
        <Button
          variant="destructive"
          className="w-full gap-2 mt-2"
          onClick={() => setCancelDialogOpen(true)}
        >
          <XCircle className="w-4 h-4" />
          Завершить заявку
        </Button>
      )}

      <CancelOrderDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        orderCode={order.code}
        onConfirm={(comment) => onCancelOrder!(order.id, comment)}
      />
    </div>
  );
};

export default OrderDetails;
