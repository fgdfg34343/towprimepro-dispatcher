import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";

type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
};

const firebaseConfig: FirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

function initializeFirebaseApp(config: FirebaseConfig): FirebaseApp {
  if (getApps().length > 0) {
    return getApp();
  }

  return initializeApp(config);
}

export const firebaseApp = initializeFirebaseApp(firebaseConfig);

export const firebaseAuth: Auth = getAuth(firebaseApp);

let analyticsInstance: Analytics | null = null;

/**
 * Lazily initialize Analytics only in environments where it's supported (i.e. browser).
 */
export async function getFirebaseAnalytics(): Promise<Analytics | null> {
  if (analyticsInstance) {
    return analyticsInstance;
  }

  if (typeof window === "undefined") {
    return null;
  }

  const supported = await isSupported().catch(() => false);

  if (!supported) {
    return null;
  }

  analyticsInstance = getAnalytics(firebaseApp);
  return analyticsInstance;
}
