import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, type DocumentData } from "firebase/firestore";
import { db } from "../firebaseConfig";
import {
  DriverAvailabilityStatus,
  coerceBoolean,
  deriveDriverStatus,
  normalizeDriverStatus,
  resolveDriverCoordinates,
  toDate,
} from "@/lib/driverData";

export interface DriverDirectoryEntry {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phoneNumber: string;
  vehicleType: string;
  isVerified: boolean;
  verificationStatus: string | null;
  rejectionReason: string | null;
  can_work: boolean;
  status: DriverAvailabilityStatus;
  lat: number | null;
  lng: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

interface DriverDirectoryResult {
  drivers: DriverDirectoryEntry[];
  loading: boolean;
  error: string | null;
}

const STATUS_PRIORITY: Record<DriverAvailabilityStatus, number> = {
  online: 0,
  busy: 1,
  offline: 2,
};

const POSITIVE_VERIFICATION_MARKERS = new Set([
  "approved",
  "approved_by_admin",
  "approved_by_dispatcher",
  "approved_by_operator",
  "verified",
  "verified_by_admin",
  "verified_by_operator",
  "confirmed",
  "completed",
  "complete",
  "done",
  "passed",
  "accepted",
  "success",
  "succeeded",
  "valid",
  "validated",
  "ok",
  "allow",
  "allowed",
  "подтвержден",
  "подтверждён",
  "одобрено",
  "одобрен",
  "успешно",
  "готово",
]);

const NEGATIVE_VERIFICATION_MARKERS = new Set([
  "pending",
  "processing",
  "in_process",
  "in-process",
  "in_review",
  "in-review",
  "review",
  "checking",
  "awaiting",
  "waiting",
  "progress",
  "rejected",
  "declined",
  "denied",
  "failed",
  "cancelled",
  "canceled",
  "blocked",
  "draft",
  "paused",
  "not_verified",
  "not-approved",
  "not_approved",
  "не проверен",
  "в процессе",
  "на проверке",
  "ожидает",
  "в ожидании",
  "отклонен",
  "отклонён",
]);

function interpretVerificationString(value: string | null | undefined): boolean | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) {
    return null;
  }

  if (POSITIVE_VERIFICATION_MARKERS.has(normalized)) {
    return true;
  }

  if (NEGATIVE_VERIFICATION_MARKERS.has(normalized)) {
    return false;
  }

  return null;
}

function interpretVerificationCandidate(value: unknown): boolean | null {
  const coerced = coerceBoolean(value);
  if (coerced !== null) {
    return coerced;
  }

  if (typeof value === "string") {
    const interpreted = interpretVerificationString(value);
    if (interpreted !== null) {
      return interpreted;
    }
  }

  if (value instanceof Date) {
    return true;
  }

  if (value && typeof value === "object") {
    const maybeTimestamp = toDate(value);
    if (maybeTimestamp) {
      return true;
    }
  }

  return null;
}

function collectDocumentStatusVerdict(documents: unknown): boolean | null {
  if (!documents || typeof documents !== "object") {
    return null;
  }

  let sawApproved = false;
  let sawPending = false;
  let sawRejected = false;

  for (const entry of Object.values(documents as Record<string, unknown>)) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const node = entry as Record<string, unknown>;
    const statusCandidate =
      node.status ?? node.state ?? node.stage ?? node.result ?? node.decision ?? node.outcome;

    const interpreted =
      interpretVerificationCandidate(statusCandidate) ??
      interpretVerificationString(typeof statusCandidate === "string" ? statusCandidate : null);

    if (interpreted === true) {
      sawApproved = true;
      continue;
    }

    if (interpreted === false) {
      sawRejected = true;
      break;
    }

    if (typeof statusCandidate === "string") {
      const normalized = statusCandidate.trim().toLowerCase();
      if (NEGATIVE_VERIFICATION_MARKERS.has(normalized)) {
        sawRejected = true;
        break;
      }
      if (normalized.length > 0) {
        sawPending = true;
      }
    }
  }

  if (sawRejected) {
    return false;
  }

  if (sawApproved && !sawPending) {
    return true;
  }

  return null;
}

function resolveVerificationFlag(profile: DocumentData | undefined): boolean {
  if (!profile) {
    return false;
  }

  const verificationNode =
    typeof profile.verification === "object" && profile.verification !== null
      ? (profile.verification as Record<string, unknown>)
      : undefined;

  const primaryCandidates: unknown[] = [
    profile.isVerified,
    profile.verified,
    profile.isApproved,
    profile.approved,
    profile.verificationStatus,
    profile.verificationState,
    profile.verificationStage,
    profile.approvalStatus,
    profile.reviewStatus,
    profile.status,
    verificationNode?.isVerified,
    verificationNode?.status,
    verificationNode?.state,
    verificationNode?.stage,
    verificationNode?.result,
    verificationNode?.decision,
    verificationNode?.outcome,
    (profile.documents as Record<string, unknown> | undefined)?.overallStatus,
  ];

  let seenApproved = false;
  let seenRejected = false;

  for (const candidate of primaryCandidates) {
    const interpreted = interpretVerificationCandidate(candidate);
    if (interpreted === true) {
      seenApproved = true;
    } else if (interpreted === false) {
      seenRejected = true;
    }
  }

  for (const candidate of primaryCandidates) {
    if (typeof candidate === "string") {
      const interpreted = interpretVerificationString(candidate);
      if (interpreted === true) {
        seenApproved = true;
      } else if (interpreted === false) {
        seenRejected = true;
      }
    }
  }

  if (seenApproved && !seenRejected) {
    return true;
  }

  if (seenRejected && !seenApproved) {
    return false;
  }

  const timestampCandidates: unknown[] = [
    profile.verifiedAt,
    profile.verificationCompletedAt,
    profile.approvedAt,
    verificationNode?.verifiedAt,
    verificationNode?.approvedAt,
    verificationNode?.completedAt,
    (profile.documents as Record<string, unknown> | undefined)?.approvedAt,
  ];

  for (const candidate of timestampCandidates) {
    if (toDate(candidate)) {
      return true;
    }
  }

  const documentsVerdict = collectDocumentStatusVerdict(profile.documents);
  if (documentsVerdict !== null) {
    return documentsVerdict;
  }

  if (seenApproved) {
    return true;
  }

  if (seenRejected) {
    return false;
  }

  return false;
}

const UPDATED_AT_KEYS = [
  "updatedAt",
  "updated_at",
  "lastUpdatedAt",
  "last_updated_at",
  "lastSeen",
  "last_seen",
  "lastActiveAt",
  "last_active_at",
  "timestamp",
  "syncedAt",
  "synced_at",
  "refreshedAt",
];

function resolveUpdatedAt(
  primary?: Record<string, unknown>,
  secondary?: Record<string, unknown>,
): Date | null {
  const candidates: unknown[] = [];

  const collect = (source?: Record<string, unknown>) => {
    if (!source) {
      return;
    }

    for (const key of UPDATED_AT_KEYS) {
      if (key in source) {
        candidates.push(source[key]);
      }
    }

    const location = source.location;
    if (location && typeof location === "object") {
      for (const key of UPDATED_AT_KEYS) {
        if (key in (location as Record<string, unknown>)) {
          candidates.push((location as Record<string, unknown>)[key]);
        }
      }
    }
  };

  collect(primary);
  collect(secondary);

  for (const candidate of candidates) {
    const parsed = toDate(candidate);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

export function useDriverDirectory(): DriverDirectoryResult {
  const [driverDocs, setDriverDocs] = useState<Map<string, DocumentData>>(new Map());
  const [locationDocs, setLocationDocs] = useState<Map<string, DocumentData>>(new Map());
  const [driversLoaded, setDriversLoaded] = useState(false);
  const [locationsLoaded, setLocationsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "drivers"),
      (snapshot) => {
        const next = new Map<string, DocumentData>();
        console.log(`[drivers] Получено ${snapshot.docs.length} документов из коллекции drivers`);
        snapshot.forEach((doc) => {
          console.log(`[drivers] Документ ${doc.id}:`, doc.data());
          next.set(doc.id, doc.data());
        });
        setDriverDocs(next);
        setDriversLoaded(true);
      },
      (err) => {
        console.error("❌ Не удалось загрузить водителей из Firestore:", err);
        setError((prev) => prev ?? "Не удалось загрузить список водителей.");
        setDriversLoaded(true);
      },
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "driverLocations"),
      (snapshot) => {
        const next = new Map<string, DocumentData>();
        console.log(`[driverLocations] Получено ${snapshot.docs.length} документов из коллекции driverLocations`);
        snapshot.forEach((doc) => {
          console.log(`[driverLocations] Документ ${doc.id}:`, doc.data());
          next.set(doc.id, doc.data());
        });
        setLocationDocs(next);
        setLocationsLoaded(true);
      },
      (err) => {
        console.error("❌ Не удалось загрузить местоположение водителей из Firestore:", err);
        setError((prev) => prev ?? "Не удалось загрузить местоположения водителей.");
        setLocationsLoaded(true);
      },
    );

    return unsubscribe;
  }, []);

  const drivers = useMemo<DriverDirectoryEntry[]>(() => {
    if (driverDocs.size === 0 && locationDocs.size === 0) {
      return [];
    }

    const entries: DriverDirectoryEntry[] = [];

    driverDocs.forEach((profile, id) => {
      const location = locationDocs.get(id);

      const profileRecord =
        profile && typeof profile === "object"
          ? (profile as Record<string, unknown>)
          : undefined;
      const locationRecord =
        location && typeof location === "object"
          ? (location as Record<string, unknown>)
          : undefined;

      const firstName =
        typeof profile.firstName === "string" ? profile.firstName.trim() : "";
      const lastName =
        typeof profile.lastName === "string" ? profile.lastName.trim() : "";
      const fullNameFromProfile =
        `${firstName} ${lastName}`.trim() ||
        (typeof profile.name === "string" ? profile.name.trim() : "");

      const { lat, lng } = locationRecord
        ? resolveDriverCoordinates(locationRecord)
        : profileRecord
          ? resolveDriverCoordinates(profileRecord)
          : { lat: null, lng: null };

      const locationUpdatedAt = locationRecord
        ? resolveUpdatedAt(locationRecord)
        : null;
      const profileUpdatedAt = profileRecord
        ? resolveUpdatedAt(profileRecord)
        : null;

      const primaryStatusSource = locationRecord ?? profileRecord;
      const secondaryStatusSource = locationRecord ? profileRecord : undefined;

      // ПРИОРИТЕТ: Если в driverLocations есть прямое поле status - используем его!
      let status: DriverAvailabilityStatus;

      if (locationRecord && locationRecord.status) {
        // Используем статус напрямую из driverLocations (приоритет!)
        status = normalizeDriverStatus(locationRecord.status);
        console.log(`[drivers:snapshot] Используем статус из driverLocations для ${id}:`, locationRecord.status, "→", status);
      } else {
        // Если статуса нет, вычисляем по другим полям
        status = deriveDriverStatus(primaryStatusSource, secondaryStatusSource);
      }

      // Проверка на устаревшие данные (увеличиваем порог до 1 часа вместо 5 минут)
      const STALE_THRESHOLD_MS = 60 * 60 * 1_000; // 1 час
      const isLocationStale =
        locationRecord &&
        locationUpdatedAt !== null &&
        Date.now() - locationUpdatedAt.getTime() > STALE_THRESHOLD_MS;

      // Только если данные ОЧЕНЬ старые (больше 1 часа), ставим offline
      if (isLocationStale && status === "online") {
        console.warn(`[drivers:snapshot] Данные водителя ${id} устарели (>${STALE_THRESHOLD_MS / 60000} мин), меняем на offline`);
        status = "offline";
      }

      // ЖЁСТКОЕ ПРАВИЛО: Если can_work = false, то статус всегда offline
      // Водитель не может быть онлайн, если ему запрещена работа
      const canWork = coerceBoolean(profile.can_work) ?? false;
      if (!canWork) {
        status = "offline";
      }

      if (import.meta.env.DEV) {
        console.debug("[drivers:snapshot]", id, {
          profile,
          location,
          derivedStatus: status,
          derivedVerification: resolveVerificationFlag(profile),
          lat,
          lng,
          locationUpdatedAt,
          profileUpdatedAt,
          isLocationStale,
        });
      }

      entries.push({
        id,
        firstName,
        lastName,
        fullName: fullNameFromProfile || `Водитель ${id}`,
        phoneNumber:
          typeof profile.phoneNumber === "string" ? profile.phoneNumber : "",
        vehicleType:
          typeof profile.vehicleType === "string" ? profile.vehicleType : "",
        isVerified: resolveVerificationFlag(profile),
        verificationStatus:
          typeof profile.verificationStatus === "string"
            ? profile.verificationStatus
            : null,
        rejectionReason:
          typeof profile.rejectionReason === "string"
            ? profile.rejectionReason
            : null,
        can_work: coerceBoolean(profile.can_work) ?? false,
        status,
        lat,
        lng,
        createdAt: toDate(profile.createdAt),
        updatedAt:
          locationUpdatedAt ??
          profileUpdatedAt ??
          toDate(profile.updatedAt) ??
          toDate(profileRecord?.createdAt),
      });
    });

    locationDocs.forEach((location, id) => {
      if (driverDocs.has(id)) {
        return;
      }

      const { lat, lng } = resolveDriverCoordinates(location);
      if (lat === null || lng === null) {
        return;
      }

      const fallbackName =
        typeof location.name === "string"
          ? location.name
          : typeof location.driverName === "string"
            ? location.driverName
            : `Водитель ${id}`;

      const locationRecord =
        location && typeof location === "object"
          ? (location as Record<string, unknown>)
          : undefined;

      entries.push({
        id,
        firstName: "",
        lastName: "",
        fullName: fallbackName,
        phoneNumber:
          typeof location.phoneNumber === "string" ? location.phoneNumber : "",
        vehicleType:
          typeof location.vehicleType === "string" ? location.vehicleType : "",
        isVerified: false,
        verificationStatus: null,
        rejectionReason: null,
        can_work: false,
        status: deriveDriverStatus(locationRecord),
        lat,
        lng,
        createdAt: null,
        updatedAt: resolveUpdatedAt(locationRecord) ?? toDate(location.updatedAt),
      });
    });

    return entries.sort((a, b) => {
      const statusDiff = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
      if (statusDiff !== 0) {
        return statusDiff;
      }

      if (a.fullName && b.fullName) {
        return a.fullName.localeCompare(b.fullName, "ru", {
          sensitivity: "base",
        });
      }

      return a.id.localeCompare(b.id, "ru", { sensitivity: "base" });
    });
  }, [driverDocs, locationDocs]);

  return {
    drivers,
    loading: !driversLoaded || !locationsLoaded,
    error,
  };
}
