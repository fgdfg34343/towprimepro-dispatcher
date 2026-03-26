import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { auth } from "../firebaseConfig";
import { onAuthStateChanged, User } from "firebase/auth";
import { canAccessDispatcher } from "@/lib/dispatcherAccess";

type ProtectedRouteProps = {
  children: JSX.Element;
};

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const access = await canAccessDispatcher(firebaseUser);
        setAllowed(access);
      } else {
        setAllowed(false);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  if (loading || allowed === null) {
    return <p>Загрузка...</p>;
  }

  if (!allowed) {
    return <Navigate to="/auth" replace />;
  }

  return children;
};

export default ProtectedRoute;
