import { GoogleMap, InfoWindow, Marker, OverlayView, useJsApiLoader } from "@react-google-maps/api";
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
import { AlertTriangle, Star, X } from "lucide-react";
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

interface OrderMarker {
  orderId: string;
  orderCode: string;
  lat: number;
  lng: number;
  type: "pickup" | "dropoff";
}

interface MapViewProps {
  selectedOrder: OrderRecord | null;
  onAssignDriver: (payload: AssignDriverPayload) => Promise<void>;
  focusedDriverId?: string | null;
  orders?: OrderRecord[];
}

declare global {
  interface Window {
    gm_authFailure?: () => void;
  }
}


const ONLINE_STATUS_QUERY_VALUES = ["ONLINE", "online", "Online", "OnLine"];
const VEHICLE_TYPE_LABELS: Record<string, string> = {
  broken: "Неисправный автомобиль",
  standard: "Легковой автомобиль",
  sedan: "Седан",
  suv: "Внедорожник",
  crossover: "Кроссовер",
  truck: "Грузовой автомобиль",
  towtruck: "Эвакуатор",
  "tow truck": "Эвакуатор",
  tow_truck: "Эвакуатор",
  motorcycle: "Мотоцикл",
  bus: "Автобус",
};

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

function formatVehicleType(vehicleType: string | null): string {
  if (!vehicleType) {
    return "—";
  }

  const normalized = vehicleType.trim().toLowerCase();
  if (normalized.length === 0) {
    return "—";
  }

  return VEHICLE_TYPE_LABELS[normalized] ?? vehicleType.trim();
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

export default function MapView({ selectedOrder, onAssignDriver, focusedDriverId, orders = [] }: MapViewProps) {
  const { resolvedTheme } = useTheme();
  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? "";
  const currentOrigin =
    typeof window !== "undefined" ? window.location.origin : "http://localhost:8080";
  const [mapAuthFailed, setMapAuthFailed] = useState(false);
  const { isLoaded, loadError } = useJsApiLoader({
    id: "towtruck-dispatcher-map",
    googleMapsApiKey,
    libraries: ["places"],
  });

  const [locations, setLocations] = useState<Map<string, DriverLocationEntry>>(new Map());
  const [profiles, setProfiles] = useState<Map<string, DriverProfileEntry>>(new Map());
  const [activeDriverId, setActiveDriverId] = useState<string | null>(null);
  const [dismissedFocusedDriverId, setDismissedFocusedDriverId] = useState<string | null>(null);
  const [assigningDriverId, setAssigningDriverId] = useState<string | null>(null);
  const [orderMarkers, setOrderMarkers] = useState<OrderMarker[]>([]);
  const [activeOrderMarkerId, setActiveOrderMarkerId] = useState<string | null>(null);
  const geocodedCache = useRef<Map<string, { lat: number; lng: number }>>(new Map());
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
    if (!focusedDriverId) {
      setDismissedFocusedDriverId(null);
      return;
    }

    if (focusedDriverId !== dismissedFocusedDriverId) {
      setDismissedFocusedDriverId(null);
    }
  }, [dismissedFocusedDriverId, focusedDriverId]);

  useEffect(() => {
    if (activeDriverId && !drivers.some((driver) => driver.driverId === activeDriverId)) {
      setActiveDriverId(null);
    }
  }, [activeDriverId, drivers]);

  // При изменении focusedDriverId — паним карту к водителю и открываем InfoWindow
  useEffect(() => {
    if (!focusedDriverId) return;
    if (focusedDriverId === dismissedFocusedDriverId) return;
    const driver = drivers.find((d) => d.driverId === focusedDriverId);
    if (driver && mapRef.current) {
      mapRef.current.panTo({ lat: driver.lat, lng: driver.lng });
      mapRef.current.setZoom(15);
      setActiveDriverId(focusedDriverId);
    }
  }, [dismissedFocusedDriverId, focusedDriverId, drivers]);

  // Geocode pickup/dropoff for new unassigned orders
  useEffect(() => {
    if (!isLoaded || !window.google?.maps) return;

    const newOrders = orders.filter((o) => o.status === "new" && !o.driverId);
    const newOrderIds = new Set(newOrders.map((o) => o.id));

    setOrderMarkers((prev) => prev.filter((m) => newOrderIds.has(m.orderId)));

    if (newOrders.length === 0) return;

    const geocoder = new window.google.maps.Geocoder();

    const geocodeAddress = (address: string, cb: (lat: number, lng: number) => void) => {
      if (geocodedCache.current.has(address)) {
        const cached = geocodedCache.current.get(address)!;
        cb(cached.lat, cached.lng);
        return;
      }
      geocoder.geocode({ address }, (results, status) => {
        console.log("[MapView] geocode", address, status, results?.[0]);
        if (status === "OK" && results?.[0]) {
          const loc = results[0].geometry.location;
          const coords = { lat: loc.lat(), lng: loc.lng() };
          geocodedCache.current.set(address, coords);
          cb(coords.lat, coords.lng);
        } else {
          console.warn("[MapView] geocode failed:", address, status);
        }
      });
    };

    newOrders.forEach((order) => {
      geocodeAddress(order.pickupAddress, (lat, lng) => {
        setOrderMarkers((prev) => [
          ...prev.filter((m) => !(m.orderId === order.id && m.type === "pickup")),
          { orderId: order.id, orderCode: order.code, lat, lng, type: "pickup" },
        ]);
      });
      geocodeAddress(order.dropoffAddress, (lat, lng) => {
        setOrderMarkers((prev) => [
          ...prev.filter((m) => !(m.orderId === order.id && m.type === "dropoff")),
          { orderId: order.id, orderCode: order.code, lat, lng, type: "dropoff" },
        ]);
      });
    });
  }, [orders, isLoaded]);

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
            Google Maps отклонил ключ или карта не настроена для домена `{currentOrigin}`.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Проверьте `VITE_GOOGLE_MAPS_API_KEY`, включён ли Maps JavaScript API, биллинг и разрешён ли referrer для `{currentOrigin}/*`.
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
      {/* Маркеры точек подачи и назначения для новых заявок */}
      {orderMarkers.map((marker) => {
        const markerId = `${marker.orderId}-${marker.type}`;
        const isPickup = marker.type === "pickup";
        const order = orders.find((o) => o.id === marker.orderId);
        const color = isPickup ? "%23ef4444" : "%2322c55e";
        const svgIcon = `data:image/svg+xml;utf-8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='50' viewBox='0 0 40 50'><path d='M20 0C9 0 0 9 0 20c0 15 20 30 20 30S40 35 40 20C40 9 31 0 20 0z' fill='${color}' stroke='white' stroke-width='2'/><circle cx='20' cy='20' r='9' fill='white'/></svg>`;
        return (
          <Marker
            key={markerId}
            position={{ lat: marker.lat, lng: marker.lng }}
            label={{
              text: isPickup ? "A" : "B",
              color: isPickup ? "#ef4444" : "#22c55e",
              fontWeight: "bold",
              fontSize: "13px",
            }}
            icon={{
              url: svgIcon,
              scaledSize: new window.google.maps.Size(40, 50),
              labelOrigin: new window.google.maps.Point(20, 20),
            }}
            onClick={() => setActiveOrderMarkerId(activeOrderMarkerId === markerId ? null : markerId)}
          >
            {activeOrderMarkerId === markerId && (
              <InfoWindow
                onCloseClick={() => setActiveOrderMarkerId(null)}
                options={{ disableAutoPan: true }}
              >
                <div style={{ fontSize: "13px", minWidth: "180px" }}>
                  <p style={{ fontWeight: "bold", marginBottom: "4px" }}>
                    {isPickup ? "📍 Откуда" : "🏁 Куда"}
                  </p>
                  <p style={{ color: "#555", fontSize: "11px", marginBottom: "4px" }}>
                    Заявка {marker.orderCode}
                  </p>
                  <p>{isPickup ? order?.pickupAddress : order?.dropoffAddress}</p>
                </div>
              </InfoWindow>
            )}
          </Marker>
        );
      })}

      {drivers.map((driver) => {
        const icon = buildMarkerIcon(driver.availability);
        const closeDriverInfo = () => {
          setActiveDriverId(null);
          if (focusedDriverId === driver.driverId) {
            setDismissedFocusedDriverId(driver.driverId);
          }
        };

        return (
          <Marker
            key={driver.driverId}
            position={{ lat: driver.lat, lng: driver.lng }}
            onClick={() => {
              setDismissedFocusedDriverId(null);
              setActiveDriverId(driver.driverId);
            }}
            icon={icon}
          >
            {activeDriverId === driver.driverId && (
              <OverlayView
                position={{ lat: driver.lat, lng: driver.lng }}
                mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                getPixelPositionOffset={(width, height) => ({
                  x: -(width / 2),
                  y: -(height + 18),
                })}
              >
                <div
                  className="relative min-w-[260px] max-w-[280px] overflow-hidden rounded-2xl bg-white shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="relative bg-gradient-to-br from-slate-700 to-slate-900 px-4 py-3 pr-10">
                    <p className="text-base font-bold leading-tight text-white">
                      {driver.fullName}
                    </p>
                    <p className="mt-0.5 text-sm text-slate-300">
                      {maskPhoneNumber(driver.phoneNumber)}
                    </p>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); closeDriverInfo(); }}
                      className="absolute right-2 top-2 rounded-lg p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                      aria-label="Закрыть карточку водителя"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Body */}
                  <div className="px-4 py-3">
                    <div className="grid gap-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold tracking-wide text-slate-500">
                          Статус
                        </span>
                        <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                          В сети
                        </span>
                      </div>
                      <div className="h-px bg-slate-100" />
                      <InfoRow label="Тип ТС" value={formatVehicleType(driver.vehicleType)} />
                      <InfoRow
                        label="Рейтинг"
                        value={
                          driver.rating !== null ? driver.rating.toFixed(1) : "Нет данных"
                        }
                        icon={driver.rating !== null ? <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> : undefined}
                      />
                      <InfoRow label="Верификация" value={driver.isVerified ? "Проверен" : "Не проверен"} />
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
                  </div>

                  {/* Footer */}
                  <div className="px-4 pb-4">
                    <Button
                      className="w-full"
                      size="sm"
                      disabled={!selectedOrder || assigningDriverId === driver.driverId}
                      onClick={(e) => { e.stopPropagation(); handleAssignDriver(driver); }}
                    >
                      {assigningDriverId === driver.driverId
                        ? "Назначаем..."
                        : selectedOrder
                          ? "Назначить на заказ"
                          : "Выберите заявку"}
                    </Button>
                  </div>
                </div>
              </OverlayView>
            )}
          </Marker>
        );
      })}
    </GoogleMap>
  );
}
