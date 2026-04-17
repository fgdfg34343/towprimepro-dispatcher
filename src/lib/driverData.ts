import { Timestamp } from "firebase/firestore";

export type DriverAvailabilityStatus = "online" | "busy" | "offline";

const STATUS_MAP: Record<string, DriverAvailabilityStatus> = {
  online: "online",
  "on-line": "online",
  active: "online",
  available: "online",
  idle: "online",
  working: "online",
  engaged: "busy",
  busy: "busy",
  occupied: "busy",
  "in-progress": "busy",
  "in_route": "busy",
  "in-route": "busy",
  "in-progress-trip": "busy",
  "on-trip": "busy",
  accepted: "busy",
  assigned: "busy",
  "в сети": "online",
  "онлайн": "online",
  "активен": "online",
  "свободен": "online",
  "не в сети": "offline",
  "оффлайн": "offline",
  "офлайн": "offline",
  "неактивен": "offline",
  offline: "offline",
  disconnected: "offline",
};

export const STATUS_LABELS: Record<DriverAvailabilityStatus, string> = {
  online: "Онлайн",
  busy: "Занят",
  offline: "Оффлайн",
};

export const STATUS_BADGE_STYLES: Record<DriverAvailabilityStatus, string> = {
  online: "bg-status-completed text-white border-0",
  busy: "bg-status-in-progress text-white border-0",
  offline: "bg-muted text-muted-foreground border-border",
};

export function normalizeDriverStatus(value: unknown): DriverAvailabilityStatus {
  if (typeof value === "string") {
    const key = value.trim().toLowerCase();
    if (STATUS_MAP[key]) {
      return STATUS_MAP[key];
    }
  }

  if (typeof value === "boolean") {
    return value ? "online" : "offline";
  }

  if (typeof value === "number") {
    if (value > 0) return "online";
    if (value === 0) return "offline";
  }

  return "offline";
}

const TRUE_VALUES = new Set([
  "true",
  "1",
  "yes",
  "y",
  "on",
  "online",
  "active",
  "enabled",
  "да",
  "включено",
  "онлайн",
  "в сети",
  "активен",
  "working",
  "enabled",
]);
const FALSE_VALUES = new Set([
  "false",
  "0",
  "no",
  "n",
  "off",
  "offline",
  "inactive",
  "disabled",
  "нет",
  "выключено",
  "оффлайн",
  "офлайн",
  "не в сети",
  "неактивен",
  "paused",
  "stopped",
]);

export function coerceBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (TRUE_VALUES.has(normalized)) {
      return true;
    }
    if (FALSE_VALUES.has(normalized)) {
      return false;
    }
  }

  return null;
}

function hasActiveOrderCandidate(value: unknown): boolean {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (typeof value === "number") {
    return !Number.isNaN(value);
  }

  return false;
}

const POSITIVE_STATUS_MARKERS = new Set([
  "approved",
  "verified",
  "confirm",
  "confirmed",
  "ok",
  "success",
  "succeeded",
  "accepted",
  "allowed",
  "done",
  "completed",
  "passed",
  "validated",
  "valid",
  "активно",
  "подтвержден",
  "подтверждён",
  "одобрено",
  "одобрен",
  "успешно",
  "готово",
]);

const NEGATIVE_STATUS_MARKERS = new Set([
  "pending",
  "awaiting",
  "waiting",
  "rejected",
  "denied",
  "declined",
  "failed",
  "cancelled",
  "canceled",
  "blocked",
  "invalid",
  "paused",
  "draft",
  "processing",
  "checking",
  "на проверке",
  "не подтвержден",
  "не подтверждён",
  "отклонен",
  "отклонён",
  "ожидает",
  "в ожидании",
]);

function interpretStatusLikeString(value: unknown): boolean | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) {
    return null;
  }

  if (POSITIVE_STATUS_MARKERS.has(normalized)) {
    return true;
  }

  if (NEGATIVE_STATUS_MARKERS.has(normalized)) {
    return false;
  }

  return null;
}

export function deriveDriverStatus(
  primary?: Record<string, unknown>,
  secondary?: Record<string, unknown>,
): DriverAvailabilityStatus {
  const statusCandidate =
    primary?.status ??
    primary?.availability ??
    primary?.state ??
    secondary?.status ??
    secondary?.availability ??
    secondary?.state;

  const normalized = normalizeDriverStatus(statusCandidate);
  if (normalized !== "offline") {
    return normalized;
  }

  const busyFlag =
    coerceBoolean(
      primary?.isBusy ??
        primary?.busy ??
        primary?.onTrip ??
        primary?.inTrip ??
        primary?.isWorking ??
        secondary?.isBusy ??
        secondary?.busy ??
        secondary?.onTrip ??
        secondary?.inTrip ??
        secondary?.isWorking,
    ) ?? null;

  const hasActiveOrder =
    hasActiveOrderCandidate(primary?.currentOrderId) ||
    hasActiveOrderCandidate(primary?.activeOrderId) ||
    hasActiveOrderCandidate(secondary?.currentOrderId) ||
    hasActiveOrderCandidate(secondary?.activeOrderId);

  if (busyFlag === true || hasActiveOrder) {
    return "busy";
  }

  const onlineFlag =
    coerceBoolean(
      primary?.isOnline ??
        primary?.online ??
        primary?.isActive ??
        primary?.active ??
        primary?.available ??
        primary?.isAvailable ??
        secondary?.isOnline ??
        secondary?.online ??
        secondary?.isActive ??
        secondary?.active ??
        secondary?.available ??
        secondary?.isAvailable,
    ) ?? null;

  if (onlineFlag === true) {
    return "online";
  }

  if (busyFlag === false || onlineFlag === false) {
    return "offline";
  }

  return normalized;
}

function parseCoordinateCandidate(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return null;
}

export function resolveDriverCoordinates(
  data: Record<string, unknown>,
): { lat: number | null; lng: number | null } {
  const locationCandidate = data.location as unknown;

  const location =
    locationCandidate && typeof locationCandidate === "object"
      ? (locationCandidate as Record<string, unknown>)
      : undefined;

  const latitudeCandidates = [
    data.lat,
    (data as Record<string, unknown>).latitude,
    location?.latitude,
    location?.lat,
    (location?.coords as Record<string, unknown> | undefined)?.latitude,
    (location?.coords as Record<string, unknown> | undefined)?.lat,
  ];

  const longitudeCandidates = [
    data.lng,
    (data as Record<string, unknown>).longitude,
    location?.longitude,
    location?.lng,
    (location?.coords as Record<string, unknown> | undefined)?.longitude,
    (location?.coords as Record<string, unknown> | undefined)?.lng,
  ];

  let lat: number | null = null;
  for (const candidate of latitudeCandidates) {
    const parsed = parseCoordinateCandidate(candidate);
    if (parsed !== null) {
      lat = parsed;
      break;
    }
  }

  let lng: number | null = null;
  for (const candidate of longitudeCandidates) {
    const parsed = parseCoordinateCandidate(candidate);
    if (parsed !== null) {
      lng = parsed;
      break;
    }
  }

  return { lat, lng };
}

export function toDate(value: unknown): Date | null {
  if (value instanceof Timestamp) {
    return value.toDate();
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}
