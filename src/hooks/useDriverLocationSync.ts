import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

type DriverStatus = "online" | "busy" | "offline";

type PermissionStatusState = "granted" | "denied" | "prompt" | "unsupported";

export interface DriverLocationOptions {
  intervalMs?: number;
  isEnabled?: boolean;
  driverName?: string;
  status?: DriverStatus;
}

export interface DriverLocationSyncResult {
  permissionState: PermissionStatusState;
  error: string | null;
  isActive: boolean;
}

const DEFAULT_INTERVAL_MS = 5_000;

/**
 * Periodically publishes the authenticated driver's GPS position to Firestore.
 * Wrap in a component rendered only for drivers who should share location.
 */
export function useDriverLocationSync(
  options: DriverLocationOptions = {},
): DriverLocationSyncResult {
  const { intervalMs = DEFAULT_INTERVAL_MS, isEnabled = true, driverName, status = "online" } =
    options;

  const [permissionState, setPermissionState] = useState<PermissionStatusState>("prompt");
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(() => auth.currentUser);
  const [isActive, setIsActive] = useState(false);

  const effectiveName = useMemo(() => driverName ?? currentUser?.displayName ?? "Водитель", [
    driverName,
    currentUser?.displayName,
  ]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    let permissionListener: ((this: PermissionStatus, ev: Event) => unknown) | null = null;
    let permissionStatus: PermissionStatus | null = null;

    if ("permissions" in navigator && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then((permission) => {
          permissionStatus = permission;
          setPermissionState(permission.state as PermissionStatusState);

          permissionListener = () => {
            setPermissionState(permission.state as PermissionStatusState);
          };

          permission.addEventListener("change", permissionListener);
        })
        .catch(() => {
          setPermissionState("unsupported");
        });
    } else {
      setPermissionState("unsupported");
    }

    return () => {
      if (permissionListener && permissionStatus) {
        permissionStatus.removeEventListener("change", permissionListener);
      }
    };
  }, []);

  useEffect(() => {
    if (!isEnabled) {
      setIsActive(false);
      return;
    }

    if (!navigator.geolocation) {
      setError("Geolocation API недоступен в этом браузере.");
      setIsActive(false);
      return;
    }

    if (!currentUser) {
      setError(null);
      setIsActive(false);
      return;
    }

    let isCancelled = false;
    let intervalId: number | null = null;

    const publishLocation = async (coords: GeolocationCoordinates) => {
      try {
        await setDoc(
          doc(db, "driverLocations", currentUser.uid),
          {
            driverId: currentUser.uid,
            name: effectiveName,
            lat: coords.latitude,
            lng: coords.longitude,
            status,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
        setError(null);
      } catch (firestoreError) {
        setError("Не удалось обновить местоположение водителя.");
        console.error("Failed to update driver location", firestoreError);
      }
    };

    const readAndPublishLocation = () => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          setPermissionState("granted");
          if (isCancelled) return;
          await publishLocation(position.coords);
        },
        (geoError) => {
          console.error("Geolocation error", geoError);
          const permission: PermissionStatusState =
            geoError.code === geoError.PERMISSION_DENIED ? "denied" : "prompt";
          setPermissionState(permission);

          if (geoError.code === geoError.PERMISSION_DENIED) {
            setError("Доступ к геолокации отклонён.");
          } else {
            setError("Не удалось получить координаты устройства.");
          }
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5_000,
          timeout: 10_000,
        },
      );
    };

    readAndPublishLocation();
    intervalId = window.setInterval(readAndPublishLocation, intervalMs);
    setIsActive(true);

    return () => {
      isCancelled = true;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
      setIsActive(false);
    };
  }, [isEnabled, intervalMs, currentUser, effectiveName, status]);

  return { permissionState, error, isActive };
}
