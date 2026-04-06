import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

export const TRACKED_ORDER_STORAGE_KEY = 'towprime:last-order-id';

const STATUS_ALIASES = {
  pending: 'pending',
  new: 'pending',
  awaiting: 'pending',
  queued: 'pending',
  assigned: 'assigned',
  accepted: 'assigned',
  'in-progress': 'in-progress',
  inprogress: 'in-progress',
  driving: 'in-progress',
  enroute: 'in-progress',
  completed: 'completed',
  done: 'completed',
  finished: 'completed',
  cancelled: 'cancelled',
  canceled: 'cancelled',
};

function toStringValue(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }

  if (typeof value === 'number' || typeof value === 'bigint') {
    return String(value);
  }

  return null;
}

function toNumberValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getNestedValue(data, path) {
  return path.split('.').reduce((current, segment) => {
    if (!current || typeof current !== 'object') {
      return undefined;
    }

    return current[segment];
  }, data);
}

function pickString(data, paths) {
  for (const path of paths) {
    const value = toStringValue(getNestedValue(data, path));
    if (value) {
      return value;
    }
  }

  return null;
}

function pickNumber(data, paths) {
  for (const path of paths) {
    const value = toNumberValue(getNestedValue(data, path));
    if (value !== null) {
      return value;
    }
  }

  return null;
}

function normalizeStatus(status) {
  const normalized = toStringValue(status)?.toLowerCase();
  return STATUS_ALIASES[normalized] || 'pending';
}

export function normalizeTowOrder(orderId, source = {}) {
  const data = source || {};
  const status = normalizeStatus(data.status);

  return {
    id: orderId,
    code:
      pickString(data, ['displayCode', 'code', 'orderCode']) ||
      orderId.slice(-6).toUpperCase(),
    status,
    statusLabel:
      {
        pending: 'Ищем водителя',
        assigned: 'Водитель назначен',
        'in-progress': 'Водитель уже едет к вам',
        completed: 'Заявка завершена',
        cancelled: 'Заявка отменена',
      }[status] || 'Статус обновляется',
    driverId: pickString(data, ['assignedDriverId', 'driverId']),
    driverName: pickString(data, [
      'assignedDriverName',
      'driverName',
      'assignedDriver.fullName',
      'assignedDriver.name',
      'driver.fullName',
      'driver.name',
    ]),
    driverPhone: pickString(data, [
      'assignedDriverPhone',
      'driverPhone',
      'assignedDriver.phone',
      'driver.phone',
      'driver.contact.phone',
    ]),
    driverVehicleType: pickString(data, [
      'assignedDriverVehicleType',
      'driverVehicleType',
      'assignedDriver.vehicleType',
      'driver.vehicleType',
    ]),
    truckType: pickString(data, ['truckType']),
    etaMinutes: pickNumber(data, ['etaMinutes']),
    priceEstimate: pickNumber(data, ['priceEstimate', 'price']),
    pickupAddress: pickString(data, ['pickup.address', 'pickupAddress', 'fromAddress']),
    customerName: pickString(data, ['customerName', 'clientName']),
  };
}

export function hasAssignedDriver(order) {
  if (!order) {
    return false;
  }

  return ['assigned', 'in-progress'].includes(order.status)
    || Boolean(order.driverId || order.driverName || order.driverPhone);
}

export function subscribeToTowOrder(orderId, onChange, onError) {
  if (!orderId) {
    return () => {};
  }

  return onSnapshot(
    doc(db, 'orders', orderId),
    (snapshot) => {
      if (!snapshot.exists()) {
        onError?.(new Error('Заявка не найдена'));
        return;
      }

      onChange(normalizeTowOrder(snapshot.id, snapshot.data()));
    },
    (error) => {
      onError?.(error);
    }
  );
}

export function readTrackedOrderId() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(TRACKED_ORDER_STORAGE_KEY);
}

export function storeTrackedOrderId(orderId) {
  if (typeof window === 'undefined') {
    return;
  }

  if (!orderId) {
    window.localStorage.removeItem(TRACKED_ORDER_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(TRACKED_ORDER_STORAGE_KEY, orderId);
}
