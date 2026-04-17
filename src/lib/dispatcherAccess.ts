import { collection, getDocs, limit, query, where } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "../firebaseConfig";

function normalize(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function normalizeUid(value?: string | null) {
  return value?.trim() ?? "";
}

async function hasActiveDispatcherRecord(user: User) {
  const userEmail = normalize(user.email);
  const userUid = normalizeUid(user.uid);

  const checks = [];

  if (userEmail) {
    checks.push(
      getDocs(
        query(
          collection(db, "dispatchers"),
          where("email", "==", userEmail),
          where("active", "==", true),
          limit(1),
        ),
      ),
    );
  }

  if (userUid) {
    checks.push(
      getDocs(
        query(
          collection(db, "dispatchers"),
          where("uid", "==", userUid),
          where("active", "==", true),
          limit(1),
        ),
      ),
    );
    checks.push(
      getDocs(
        query(
          collection(db, "dispatchers"),
          where("userUid", "==", userUid),
          where("active", "==", true),
          limit(1),
        ),
      ),
    );
  }

  if (checks.length === 0) {
    return false;
  }

  const snapshots = await Promise.all(checks);
  return snapshots.some((snapshot) => !snapshot.empty);
}

export async function isAllowedDispatcher(user: User) {
  const configuredAdminUid = normalizeUid(import.meta.env.VITE_ADMIN_UID);

  if (configuredAdminUid && user.uid === configuredAdminUid) {
    return true;
  }

  return hasActiveDispatcherRecord(user);
}
