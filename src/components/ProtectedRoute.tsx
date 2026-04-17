import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { auth } from "../firebaseConfig";
import { onAuthStateChanged, User } from "firebase/auth";
import { isAllowedDispatcher } from "@/lib/dispatcherAccess";

type ProtectedRouteProps = {
  children: JSX.Element;
};

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (!firebaseUser) {
        setHasAccess(false);
        setLoading(false);
        return;
      }

      const access = await isAllowedDispatcher(firebaseUser);
      setHasAccess(access);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  if (loading) {
    return <p>Загрузка...</p>;
  }

  if (!user || !hasAccess) {
    return <Navigate to="/auth" replace />;
  }

  return children;
};

export default ProtectedRoute;
