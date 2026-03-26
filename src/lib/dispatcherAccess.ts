import type { User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";

export async function canAccessDispatcher(user: User | null): Promise<boolean> {
  if (!user) return false;

  try {
    const snap = await getDoc(doc(db, "dispatchers", user.uid));
    if (snap.exists()) {
      return snap.data()?.active !== false;
    }
    return false;
  } catch {
    return false;
  }
}
