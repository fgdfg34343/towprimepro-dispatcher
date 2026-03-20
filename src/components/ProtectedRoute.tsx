import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { auth } from "../firebaseConfig";
import { onAuthStateChanged, User } from "firebase/auth";

type ProtectedRouteProps = {
  children: JSX.Element;
};

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  if (loading) {
    return <p>Загрузка...</p>;
  }

  if (!user || user.uid !== import.meta.env.VITE_ADMIN_UID) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
