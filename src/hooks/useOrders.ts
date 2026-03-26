import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  type DocumentData,
  type FirestoreError,
} from "firebase/firestore";
import { db } from "@/firebaseConfig";

export type OrderStatus = "new" | "assigned" | "in-progress" | "completed" | "cancelled";

export interface OrderRecord {
  id: string;
  code: string;
  status: OrderStatus;
  clientName: string;
  clientPhone: string;
  pickupAddress: string;
  dropoffAddress: string;
  priority: boolean;
  createdAt: Date | null;
  completedAt: Date | null;
  durationMinutes: number | null;
  assignedAutomatically: boolean | null;
  driverId: string | null;
  driverName: string | null;
  driverPhone: string | null;
  vehicleType: string | null;
  notes: string | null;
  cancelComment: string | null;
  paymentMethod: string;
  paymentStatus: string;
  price: number;
  metadata: Record<string, unknown>;
}

export interface AssignDriverPayload {
  orderId: string;
  driverId: string;
  driverName?: string | null;
  driverPhone?: string | null;
  vehicleType?: string | null;
  keepStatus?: boolean;
  autoAssigned?: boolean;
}

export interface UseOrdersResult {
  orders: OrderRecord[];
  loading: boolean;
  error: string | null;
  assignDriver: (payload: AssignDriverPayload) => Promise<void>;
  cancelOrder: (orderId: string, comment: string) => Promise<void>;
}

const STATUS_ALIASES: Record<string, OrderStatus> = {
  new: "new",
  "new_order": "new",
  "new-order": "new",
  pending: "new",
  queued: "new",
  awaiting: "new",
  wait: "new",
  waiting: "new",
  "ожидание": "new",
  "новая": "new",

  assigned: "assigned",
  dispatch: "assigned",
  dispatched: "assigned",
  "назначена": "assigned",
  scheduled: "assigned",

  "in-progress": "in-progress",
  inprogress: "in-progress",
  "in_progress": "in-progress",
  driving: "in-progress",
  enroute: "in-progress",
  "en-route": "in-progress",
  delivering: "in-progress",
  active: "in-progress",
  "в пути": "in-progress",
  underway: "in-progress",
  arrived: "in-progress",
  loading: "in-progress",
  "on_the_way": "in-progress",
  ontheway: "in-progress",
  "started": "in-progress",

  completed: "completed",
  done: "completed",
  finished: "completed",
  closed: "completed",
  delivered: "completed",
  success: "completed",
  "завершена": "completed",

  cancelled: "cancelled",
  canceled: "cancelled",
  aborted: "cancelled",
  failed: "cancelled",
  "отменена": "cancelled",
  accepted: "assigned", // Fix for driver app sending "accepted"
  "принят": "assigned",
};

const STATUS_SORT_ORDER: Record<OrderStatus, number> = {
  new: 0,
  assigned: 1,
  "in-progress": 2,
  completed: 3,
  cancelled: 4,
};

const STRING_FIELDS_CACHE = new Map<string, string[]>();

const COMMON_SEPARATOR_REGEX = /[_.]/;

const candidateFieldLists: Record<string, string[]> = {
  code: ["displayCode", "code", "orderCode", "orderId", "order_id", "orderNumber", "number", "uid", "shortId", "displayId"],
  clientName: [
    "clientName",
    "client_name",
    "customerName",
    "customer_name",
    "contactName",
    "contact_name",
    "name",
    "client.fullName",
    "client.full_name",
    "client.name",
    "customer.fullName",
    "customer.full_name",
    "customer.name",
  ],
  clientPhone: [
    "clientPhone",
    "client_phone",
    "customerPhone",
    "customer_phone",
    "phone",
    "phoneNumber",
    "phone_number",
    "contactPhone",
    "contact_phone",
    "client.contactPhone",
    "customer.contactPhone",
  ],
  pickupAddress: [
    "pickupAddress",
    "pickup_address",
    "fromAddress",
    "from_address",
    "originAddress",
    "origin_address",
    "pickupLocation.address",
    "pickup.address",
    "pickup.location.address",
    "origin.address",
    "addresses.pickup",
    "route.pickup",
    "addresses.origin",
  ],
  dropoffAddress: [
    "dropoffAddress",
    "dropoff_address",
    "deliveryAddress",
    "delivery_address",
    "toAddress",
    "to_address",
    "destinationAddress",
    "destination_address",
    "dropoffLocation.address",
    "dropoff.address",
    "dropoff.location.address",
    "destination.address",
    "addresses.dropoff",
    "route.dropoff",
    "addresses.destination",
  ],
  status: ["status", "state", "stage"],
  priority: ["priority", "isPriority", "urgent", "isUrgent", "highPriority", "isHighPriority"],
  notes: ["notes", "comment", "description", "details", "remark"],
  cancelComment: ["cancelComment", "cancel_comment", "cancellationReason", "cancelReason"],
  driverId: ["driverId", "driver_id", "assignedDriverId", "assigned_driver_id", "assignedDriver.id", "driver.id", "driver.uid"],
  driverName: ["driverName", "driver_name", "assignedDriverName", "assigned_driver_name", "driver.fullName", "driver.name", "assignedDriver.fullName"],
  driverPhone: ["driverPhone", "driver_phone", "assignedDriverPhone", "driver.phone", "driver.contact.phone", "assignedDriver.phone"],
  vehicleType: ["vehicleType", "driverVehicleType", "vehicle.type", "driver.vehicleType", "assignedDriver.vehicleType"],
  createdAt: ["createdAt", "created_at", "timestamp", "created", "dateCreated", "createdDate", "timeCreated"],
  completedAt: [
    "completedAt",
    "completed_at",
    "finishedAt",
    "finished_at",
    "closedAt",
    "closed_at",
    "statusHistory.completedAt",
    "history.completedAt",
    "timestamps.completedAt",
    "metadata.completedAt",
  ],
  durationMinutes: [
    "durationMinutes",
    "duration_minutes",
    "durationInMinutes",
    "durationMins",
    "duration",
    "metadata.durationMinutes",
    "metadata.duration",
    "metrics.durationMinutes",
  ],
  durationSeconds: [
    "durationSeconds",
    "duration_seconds",
    "durationInSeconds",
    "metrics.durationSeconds",
    "metadata.durationSeconds",
    "route.durationSeconds",
    "route.duration_seconds",
    "analytics.durationSeconds",
  ],
  assignedAutomatically: [
    "assignedAutomatically",
    "autoAssigned",
    "auto_assignment",
    "isAutoAssigned",
    "assignment.auto",
    "assignment.isAuto",
    "metadata.assignedAutomatically",
    "metadata.assignment.auto",
  ],
  paymentMethod: ["paymentMethod", "payment_method", "paymentType", "payment.method"],
  paymentStatus: ["paymentStatus", "payment_status", "status.payment"],
  price: ["price", "cost", "amount", "total", "totalAmount", "estimatedCost"],
};

function getCandidateFields(key: keyof typeof candidateFieldLists): string[] {
  if (!STRING_FIELDS_CACHE.has(key)) {
    STRING_FIELDS_CACHE.set(key, candidateFieldLists[key]);
  }
  return STRING_FIELDS_CACHE.get(key)!;
}

function coerceString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return value.toString();
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return null;
}

function coerceBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (value === 1) {
      return true;
    }
    if (value === 0) {
      return false;
    }
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "yes", "y", "1", "да", "urgent", "priority", "high"].includes(normalized)) {
      return true;
    }
    if (["false", "no", "n", "0", "нет", "normal", "low"].includes(normalized)) {
      return false;
    }
  }
  return null;
}

function coerceNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    if (!normalized) {
      return null;
    }
    const parsed = Number(normalized);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  return null;
}

function coerceDate(value: unknown): Date | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  if (typeof value === "number") {
    if (value > 2400 && value < 4102444800000) {
      return new Date(value);
    }
  }
  if (typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }
  if (typeof value === "object") {
    const maybeTimestamp = value as { seconds?: number; nanoseconds?: number; milliseconds?: number };
    if (typeof maybeTimestamp.seconds === "number") {
      return new Date(maybeTimestamp.seconds * 1000);
    }
    if (typeof maybeTimestamp.milliseconds === "number") {
      return new Date(maybeTimestamp.milliseconds);
    }
  }
  return null;
}

function getNestedValue(data: Record<string, unknown>, path: string): unknown {
  if (path.includes(".")) {
    const segments = path.split(".");
    let current: unknown = data;
    for (const segment of segments) {
      if (!current || typeof current !== "object") {
        return undefined;
      }
      current = (current as Record<string, unknown>)[segment];
    }
    return current;
  }

  if (COMMON_SEPARATOR_REGEX.test(path)) {
    return data[path] ?? data[path.replace(COMMON_SEPARATOR_REGEX, ".")];
  }

  return data[path];
}

function extractString(
  data: Record<string, unknown>,
  keys: keyof typeof candidateFieldLists,
  fallback: string,
): string {
  for (const path of getCandidateFields(keys)) {
    const value = getNestedValue(data, path);
    const result = coerceString(value);
    if (result) {
      return result;
    }
  }
  return fallback;
}

function extractOptionalString(
  data: Record<string, unknown>,
  keys: keyof typeof candidateFieldLists,
): string | null {
  for (const path of getCandidateFields(keys)) {
    const value = getNestedValue(data, path);
    const result = coerceString(value);
    if (result) {
      return result;
    }
  }
  return null;
}

function extractOptionalBoolean(
  data: Record<string, unknown>,
  keys: keyof typeof candidateFieldLists,
): boolean | null {
  for (const path of getCandidateFields(keys)) {
    const value = getNestedValue(data, path);
    const result = coerceBoolean(value);
    if (result !== null) {
      return result;
    }
  }
  return null;
}

function extractBoolean(
  data: Record<string, unknown>,
  keys: keyof typeof candidateFieldLists,
  fallback: boolean,
): boolean {
  const value = extractOptionalBoolean(data, keys);
  return value === null ? fallback : value;
}

function extractOptionalNumber(
  data: Record<string, unknown>,
  keys: keyof typeof candidateFieldLists,
): number | null {
  for (const path of getCandidateFields(keys)) {
    const value = getNestedValue(data, path);
    const result = coerceNumber(value);
    if (result !== null) {
      return result;
    }
  }
  return null;
}

function extractNumber(
  data: Record<string, unknown>,
  keys: keyof typeof candidateFieldLists,
  fallback: number,
): number {
  const value = extractOptionalNumber(data, keys);
  return value === null ? fallback : value;
}

function extractStatus(data: Record<string, unknown>): OrderStatus {
  for (const path of getCandidateFields("status")) {
    const value = getNestedValue(data, path);
    const asString = coerceString(value);
    if (!asString) {
      continue;
    }
    const normalized = asString.trim().toLowerCase();
    if (STATUS_ALIASES[normalized]) {
      return STATUS_ALIASES[normalized];
    }
  }
  return "new";
}

function extractPriority(data: Record<string, unknown>): boolean {
  for (const path of getCandidateFields("priority")) {
    const value = getNestedValue(data, path);
    const boolean = coerceBoolean(value);
    if (boolean !== null) {
      return boolean;
    }
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["sr", "srchny", "срочно", "urgent", "emergency", "critical", "high"].includes(normalized)) {
        return true;
      }
    }
  }
  return false;
}

function extractDate(
  data: Record<string, unknown>,
  field: "createdAt" | "completedAt" = "createdAt",
): Date | null {
  for (const path of getCandidateFields(field)) {
    const value = getNestedValue(data, path);
    const date = coerceDate(value);
    if (date) {
      return date;
    }
  }
  return null;
}

function normalizeOrder(docData: DocumentData, id: string): OrderRecord {
  const data = (docData ?? {}) as Record<string, unknown>;

  const code =
    extractOptionalString(data, "code") ??
    extractOptionalString(data, "clientPhone") ??
    id;

  const clientName = extractString(data, "clientName", "Неизвестный клиент");
  const clientPhone = extractString(data, "clientPhone", "");
  const pickupAddress = extractString(data, "pickupAddress", "Адрес не указан");
  const dropoffAddress = extractString(data, "dropoffAddress", "Адрес не указан");

  const driverId = extractOptionalString(data, "driverId");
  const driverName = extractOptionalString(data, "driverName");
  const driverPhone = extractOptionalString(data, "driverPhone");
  const vehicleType = extractOptionalString(data, "vehicleType");
  const notes = extractOptionalString(data, "notes");
  const cancelComment = extractOptionalString(data, "cancelComment");
  const assignedAutomatically = extractOptionalBoolean(data, "assignedAutomatically");
  const createdAt = extractDate(data, "createdAt");
  const completedAt = extractDate(data, "completedAt");
  const durationMinutesFromDoc = extractOptionalNumber(data, "durationMinutes");
  const durationSecondsFromDoc = extractOptionalNumber(data, "durationSeconds");
  const durationMinutes =
    durationMinutesFromDoc !== null
      ? durationMinutesFromDoc
      : durationSecondsFromDoc !== null
        ? durationSecondsFromDoc / 60
        : null;

  // Force "completed" if completedAt is set OR if the raw status says "completed"
  // This helps if the date parsing fails but the status is correct.
  let status = extractStatus(data);
  const rawStatus = (data.status as string)?.toLowerCase?.() || "";

  // Приоритет: если заявка завершена (completedAt или статус completed), она должна оставаться завершенной
  // Проверяем completedAt ПЕРВЫМ, чтобы гарантировать, что завершенные заявки не перезаписываются
  if (completedAt || rawStatus === "completed" || rawStatus === "finished" || rawStatus === "done" || status === "completed") {
    status = "completed";
  } else if (driverId && status === "new") {
    // Только если заявка НЕ завершена, можем изменить статус с "new" на "assigned"
    status = "assigned";
  }

  // DEBUG: Check if we have a suspicious state
  if (driverId && status === "assigned" && !completedAt) {
    console.warn("[Order Reversion Check]", {
      id,
      status,
      rawStatus,
      completedAt,
      data,
    });
  }

  return {
    id,
    code: code ?? id,
    status,
    clientName,
    clientPhone,
    pickupAddress,
    dropoffAddress,
    priority: extractPriority(data),
    createdAt,
    completedAt,
    durationMinutes: durationMinutes ?? null,
    assignedAutomatically: assignedAutomatically ?? null,
    driverId: driverId ?? null,
    driverName: driverName ?? null,
    driverPhone: driverPhone ?? null,
    vehicleType: vehicleType ?? null,
    notes: notes ?? null,
    cancelComment: cancelComment ?? null,
    paymentMethod: extractString(data, "paymentMethod" as any, "cash"), // Default to cash if missing
    paymentStatus: extractString(data, "paymentStatus" as any, "pending"),
    price: extractNumber(data, "price" as any, 0),
    metadata: data,
  };
}

// Функция нормализации статусов для совместимости с приложением водителя
function normalizeStatus(status: OrderStatus | string): OrderStatus {
  // Если статус уже нормализован (OrderStatus), возвращаем как есть
  // Важно: статус "completed" никогда не должен изменяться
  if (typeof status !== "string") {
    return status;
  }
  
  const normalized = status.trim().toLowerCase();
  
  // Приоритет: если статус уже "completed", он должен остаться "completed"
  if (normalized === "completed" || status === "completed") {
    return "completed";
  }
  
  // Нормализация статусов из приложения водителя
  if (normalized === "accepted") {
    return "assigned";
  }
  if (normalized === "on_the_way") {
    return "in-progress";
  }
  
  // Используем существующую логику нормализации через STATUS_ALIASES
  if (STATUS_ALIASES[normalized]) {
    return STATUS_ALIASES[normalized];
  }
  
  // Если статус уже нормализован, возвращаем как есть
  if (["new", "assigned", "in-progress", "completed", "cancelled"].includes(normalized)) {
    return normalized as OrderStatus;
  }
  
  return "new";
}

export function useOrders(): UseOrdersResult {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const ref = collection(db, "orders");

    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        const normalized = snapshot.docs
          .map((docSnapshot) => {
            const order = normalizeOrder(docSnapshot.data(), docSnapshot.id);
            // Применяем нормализацию статусов перед setState
            return {
              ...order,
              status: normalizeStatus(order.status),
            };
          })
          .sort((a, b) => {
            if (a.createdAt && b.createdAt) {
              const diff = b.createdAt.getTime() - a.createdAt.getTime();
              if (diff !== 0) {
                return diff;
              }
            } else if (a.createdAt) {
              return -1;
            } else if (b.createdAt) {
              return 1;
            }
            return STATUS_SORT_ORDER[a.status] - STATUS_SORT_ORDER[b.status];
          });

        setOrders(normalized);
        setError(null);
        setLoading(false);
      },
      (snapshotError: FirestoreError) => {
        console.error("[orders:onSnapshot] Failed to subscribe orders:", snapshotError);
        setError(snapshotError.message);
        setLoading(false);
      },
    );

    return () => {
      unsubscribe();
    };
  }, []);

  const assignDriver = useCallback(
    async ({
      orderId,
      driverId,
      driverName,
      driverPhone,
      vehicleType,
      keepStatus = false,
      autoAssigned,
    }: AssignDriverPayload) => {
      const orderRef = doc(db, "orders", orderId);

      const payload: Record<string, unknown> = {
        driverId,
        assignedDriverId: driverId,
        driverName: driverName ?? null,
        assignedDriverName: driverName ?? null,
        driverPhone: driverPhone ?? null,
        assignedDriverPhone: driverPhone ?? null,
        updatedAt: serverTimestamp(),
      };

      if (vehicleType) {
        payload.driverVehicleType = vehicleType;
        payload.assignedDriverVehicleType = vehicleType;
      }

      if (!keepStatus) {
        payload.status = "assigned";
      }

      if (typeof autoAssigned === "boolean") {
        payload.assignedAutomatically = autoAssigned;
      }

      console.log("[useOrders] Assigning driver with payload:", payload);
      await updateDoc(orderRef, payload);
    },
    [],
  );

  const cancelOrder = useCallback(
    async (orderId: string, comment: string) => {
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, {
        status: "cancelled",
        cancelComment: comment,
        cancelledAt: serverTimestamp(),
        cancelledBy: "dispatcher",
        updatedAt: serverTimestamp(),
      });
    },
    [],
  );

  const memoizedOrders = useMemo(() => orders, [orders]);

  return {
    orders: memoizedOrders,
    loading,
    error,
    assignDriver,
    cancelOrder,
  };
}
