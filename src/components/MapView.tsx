import { GoogleMap, InfoWindow, Marker, useJsApiLoader } from "@react-google-maps/api";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
  type DocumentData,
  type FirestoreError,
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import {
  coerceBoolean,
  resolveDriverCoordinates,
  toDate,
} from "@/lib/driverData";
import type { AssignDriverPayload, OrderRecord } from "@/hooks/useOrders";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Star } from "lucide-react";
import { useTheme } from "next-themes";

type DriverAvailability = "FREE" | "BUSY";
type DriverLocationStatus = "ONLINE" | "OFFLINE";

interface InfoRowProps {
  label: string;
  value: string;
  icon?: ReactNode;
}

interface DriverLocationEntry {
  docId: string;
  driverId: string;
  lat: number;
  lng: number;
  availability: DriverAvailability;
  status: DriverLocationStatus;
  updatedAt: Date | null;
  isVerified: boolean;
  rawName: string | null;
  rawPhone: string | null;
  rawVehicleType: string | null;
}

interface DriverProfileEntry {
  driverId: string;
  firstName: string;
  lastName: string;
  fullName: string | null;
  phoneNumber: string | null;
  rating: number | null;
  vehicleType: string | null;
  can_work: boolean;
  rawProfile: Record<string, unknown>;
}

interface DriverMarker extends DriverLocationEntry {
  fullName: string;
  phoneNumber: string | null;
  rating: number | null;
  vehicleType: string | null;
}

interface MapViewProps {
  selectedOrder: OrderRecord | null;
  onAssignDriver: (payload: AssignDriverPayload) => Promise<void>;
  focusedDriverId?: string | null;
}

declare global {
  interface Window {
    gm_authFailure?: () => void;
  }
}

const AVAILABILITY_LABELS: Record<DriverAvailability, string> = {
  FREE: "Свободен",
  BUSY: "Занят",
};

const ONLINE_STATUS_QUERY_VALUES = ["ONLINE", "online", "Online", "OnLine"];

function InfoRow({ label, value, icon }: InfoRowProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-semibold tracking-wide text-black">
        {label}
      </span>
      <span className="flex items-center gap-1 text-sm font-medium text-black">
        {icon}
        {value}
      </span>
    </div>
  );
}

function normalizeAvailability(value: unknown): DriverAvailability {
  if (typeof value === "string") {
    const normalized = value.trim().toUpperCase();
    if (normalized === "FREE") {
      return "FREE";
    }
    if (normalized === "BUSY") {
      return "BUSY";
    }
  }
  return "BUSY";
}

function normalizeStatus(value: unknown): DriverLocationStatus {
  if (typeof value === "string" && value.trim().toUpperCase() === "ONLINE") {
    return "ONLINE";
  }
  return "OFFLINE";
}

function extractRating(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return null;
}

function maskPhoneNumber(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  const digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) {
    return formatPhone(`7${digits.slice(1)}`);
  }

  if (digits.length === 11 && digits.startsWith("7")) {
    return formatPhone(digits);
  }

  if (digits.length === 10) {
    return formatPhone(`7${digits}`);
  }

  return value;
}

function formatPhone(digits: string): string {
  if (digits.length !== 11) {
    return `+${digits}`;
  }

  return `+${digits[0]} (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`;
}

function buildMarkerIcon(availability: DriverAvailability): google.maps.Icon | undefined {
  const url =
    availability === "FREE"
      ? "/icons/marker-green.svg"
      : "/icons/marker-orange.svg";

  if (typeof window !== "undefined" && window.google?.maps) {
    return {
      url,
      scaledSize: new window.google.maps.Size(38, 38),
    };
  }

  return {
    url,
  } as google.maps.Icon;
}

export default function MapView({ selectedOrder, onAssignDriver, focusedDriverId }: MapViewProps) {
  const { resolvedTheme } = useTheme();
  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? "";
  const [mapAuthFailed, setMapAuthFailed] = useState(false);
  const { isLoaded, loadError } = useJsApiLoader({
    id: "towtruck-dispatcher-map",
    googleMapsApiKey,
  });

  const [locations, setLocations] = useState<Map<string, DriverLocationEntry>>(new Map());
  const [profiles, setProfiles] = useState<Map<string, DriverProfileEntry>>(new Map());
  const [activeDriverId, setActiveDriverId] = useState<string | null>(null);
  const [assigningDriverId, setAssigningDriverId] = useState<string | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const mapStyles = useMemo<google.maps.MapTypeStyle[] | undefined>(() => {
    if (resolvedTheme !== "dark") {
      return undefined;
    }

    return [
      { elementType: "geometry", stylers: [{ color: "#1d2c4d" }] },
      { elementType: "labels.text.fill", stylers: [{ color: "#8ec3b9" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#1a3646" }] },
      {
        featureType: "road",
        elementType: "geometry",
        stylers: [{ color: "#304a7d" }],
      },
    ];
  }, [resolvedTheme]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const previousHandler = window.gm_authFailure;
    window.gm_authFailure = () => {
      setMapAuthFailed(true);
      previousHandler?.();
    };

    return () => {
      window.gm_authFailure = previousHandler;
    };
  }, []);

  useEffect(() => {
    const locationsQuery = query(
      collection(db, "driverLocations"),
      where("status", "in", ONLINE_STATUS_QUERY_VALUES),
    );

    const unsubscribe = onSnapshot(
      locationsQuery,
      (snapshot) => {
        const next = new Map<string, DriverLocationEntry>();

        snapshot.forEach((doc) => {
          const data = doc.data() as DocumentData;
          const { lat, lng } = resolveDriverCoordinates(data);

          if (lat === null || lng === null) {
            return;
          }

          const driverId =
            typeof data.driverId === "string" && data.driverId.trim().length > 0
              ? data.driverId.trim()
              : doc.id;

          next.set(driverId, {
            docId: doc.id,
            driverId,
            lat,
            lng,
            availability: normalizeAvailability(data.availability),
            status: normalizeStatus(data.status),
            updatedAt: toDate(data.updatedAt),
            isVerified: coerceBoolean(data.isVerified ?? data.verified) ?? false,
            rawName:
              typeof data.name === "string"
                ? data.name
                : typeof data.driverName === "string"
                  ? data.driverName
                  : null,
            rawPhone: typeof data.phoneNumber === "string" ? data.phoneNumber : null,
            rawVehicleType:
              typeof data.vehicleType === "string" ? data.vehicleType : null,
          });
        });

        setLocations(next);
      },
      (error: FirestoreError) => {
        console.error("❌ Не удалось загрузить локации водителей:", error);
        setLocations(new Map());
      },
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "drivers"),
      (snapshot) => {
        const next = new Map<string, DriverProfileEntry>();

        snapshot.forEach((doc) => {
          const data = doc.data() as DocumentData;

          const firstName =
            typeof data.firstName === "string" ? data.firstName.trim() : "";
          const lastName =
            typeof data.lastName === "string" ? data.lastName.trim() : "";
          const combined =
            `${firstName} ${lastName}`.trim() ||
            (typeof data.fullName === "string" ? data.fullName.trim() : "") ||
            (typeof data.name === "string" ? data.name.trim() : "");

          next.set(doc.id, {
            driverId: doc.id,
            firstName,
            lastName,
            fullName: combined.length > 0 ? combined : null,
            phoneNumber:
              typeof data.phoneNumber === "string" ? data.phoneNumber : null,
            rating: extractRating(data.rating),
            vehicleType:
              typeof data.vehicleType === "string" ? data.vehicleType : null,
            can_work: coerceBoolean(data.can_work) ?? false,
            rawProfile: data as Record<string, unknown>,
          });
        });

        setProfiles(next);
      },
      (error: FirestoreError) => {
        console.error("❌ Не удалось загрузить профили водителей:", error);
        setProfiles(new Map());
      },
    );

    return () => unsubscribe();
  }, []);

  const drivers = useMemo<DriverMarker[]>(() => {
    if (locations.size === 0) {
      return [];
    }

    const markers: DriverMarker[] = [];
    const STALE_THRESHOLD_MS = 60 * 60 * 1_000; // 1 час

    locations.forEach((location) => {
      if (location.status !== "ONLINE") {
        return;
      }

      // Check if location is stale
      if (location.updatedAt !== null) {
        const isStale = Date.now() - location.updatedAt.getTime() > STALE_THRESHOLD_MS;
        if (isStale) return;
      }

      const profile = profiles.get(location.driverId);

      // Check if driver is allowed to work
      if (profile && !profile.can_work) {
        return;
      }

      const fullName =
        profile?.fullName ??
        location.rawName ??
        `Водитель ${location.driverId}`;

      markers.push({
        ...location,
        fullName,
        phoneNumber: profile?.phoneNumber ?? location.rawPhone,
        rating: profile?.rating ?? null,
        vehicleType: profile?.vehicleType ?? location.rawVehicleType,
      });
    });

    return markers.sort((a, b) => {
      if (a.availability === b.availability) {
        return a.fullName.localeCompare(b.fullName, "ru", {
          sensitivity: "base",
        });
      }

      return a.availability === "FREE" ? -1 : 1;
    });
  }, [locations, profiles]);

  useEffect(() => {
    if (activeDriverId && !drivers.some((driver) => driver.driverId === activeDriverId)) {
      setActiveDriverId(null);
    }
  }, [activeDriverId, drivers]);

  // При изменении focusedDriverId — паним карту к водителю и открываем InfoWindow
  useEffect(() => {
    if (!focusedDriverId) return;
    const driver = drivers.find((d) => d.driverId === focusedDriverId);
    if (driver && mapRef.current) {
      mapRef.current.panTo({ lat: driver.lat, lng: driver.lng });
      mapRef.current.setZoom(15);
      setActiveDriverId(focusedDriverId);
    }
  }, [focusedDriverId, drivers]);

  const handleAssignDriver = useCallback(
    async (driver: DriverMarker) => {
      if (!selectedOrder) {
        return;
      }

      setAssigningDriverId(driver.driverId);
      try {
        await onAssignDriver({
          orderId: selectedOrder.id,
          driverId: driver.driverId,
          driverName: driver.fullName,
          driverPhone: driver.phoneNumber,
          vehicleType: driver.vehicleType ?? undefined,
        });
        setActiveDriverId(null);
      } catch (error) {
        console.error("❌ Не удалось назначить водителя:", error);
      } finally {
        setAssigningDriverId(null);
      }
    },
    [onAssignDriver, selectedOrder],
  );

  if (!googleMapsApiKey || loadError || mapAuthFailed) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-destructive/30 bg-card p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">Карта недоступна</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Google Maps отклонил ключ или карта не настроена для домена `localhost`.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Проверьте `VITE_GOOGLE_MAPS_API_KEY`, включён ли Maps JavaScript API, биллинг и разрешён ли referrer для `http://localhost:*`.
          </p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Загрузка карты...
      </div>
    );
  }

  return (
    <GoogleMap
      center={{ lat: 55.7558, lng: 37.6173 }}
      zoom={11}
      mapContainerStyle={{ width: "100%", height: "100%" }}
      onLoad={(map) => { mapRef.current = map; }}
      options={{
        disableDefaultUI: true,
        styles: mapStyles,
      }}
    >
      {drivers.map((driver) => {
        const icon = buildMarkerIcon(driver.availability);

        return (
          <Marker
            key={driver.driverId}
            position={{ lat: driver.lat, lng: driver.lng }}
            onClick={() => setActiveDriverId(driver.driverId)}
            icon={icon}
          >
            {activeDriverId === driver.driverId && (
              <InfoWindow onCloseClick={() => setActiveDriverId(null)}>
                <div className="min-w-[240px] space-y-4 text-sm text-black">
                  <div className="space-y-1">
                    <p className="text-base font-semibold leading-tight text-black">
                      {driver.fullName}
                    </p>
                    <p className="font-medium text-black">
                      {maskPhoneNumber(driver.phoneNumber)}
                    </p>
                  </div>

                  <div className="grid gap-1">
                    <InfoRow label="Доступность" value={AVAILABILITY_LABELS[driver.availability]} />
                    <InfoRow label="Тип ТС" value={driver.vehicleType ?? "—"} />
                    <InfoRow
                      label="Рейтинг"
                      value={
                        driver.rating !== null ? driver.rating.toFixed(1) : "Нет данных"
                      }
                      icon={driver.rating !== null ? <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> : undefined}
                    />
                    <InfoRow label="Статус" value={driver.isVerified ? "Проверен" : "Без проверки"} />
                    <InfoRow
                      label="Обновлено"
                      value={
                        driver.updatedAt
                          ? driver.updatedAt.toLocaleTimeString("ru-RU", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                          : "—"
                      }
                    />
                  </div>

                  <Button
                    className="w-full"
                    size="sm"
                    disabled={!selectedOrder || assigningDriverId === driver.driverId}
                    onClick={() => handleAssignDriver(driver)}
                  >
                    {assigningDriverId === driver.driverId
                      ? "Назначаем..."
                      : selectedOrder
                        ? "Назначить на заказ"
                        : "Выберите заявку"}
                  </Button>
                </div>
              </InfoWindow>
            )}
          </Marker>
        );
      })}
    </GoogleMap>
  );
}
