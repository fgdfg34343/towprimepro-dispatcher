import type { User } from "firebase/auth";

function normalizeValue(value?: string | null): string {
  return value?.trim() ?? "";
}

function normalizeEmail(value?: string | null): string {
  return normalizeValue(value).toLowerCase();
}

export function canAccessDispatcher(user: User | null): boolean {
  if (!user) {
    return false;
  }

  const adminUid = normalizeValue(import.meta.env.VITE_ADMIN_UID);
  const adminEmail = normalizeEmail(import.meta.env.VITE_ADMIN_EMAIL);

  if (!adminUid && !adminEmail) {
    console.warn(
      "⚠️ VITE_ADMIN_UID и VITE_ADMIN_EMAIL не установлены. Любой аутентифицированный пользователь может получить доступ к диспетчерской."
    );
    return true;
  }

  const uidMatches = adminUid ? normalizeValue(user.uid) === adminUid : false;
  const emailMatches = adminEmail
    ? normalizeEmail(user.email) === adminEmail
    : false;

  return uidMatches || emailMatches;
}
