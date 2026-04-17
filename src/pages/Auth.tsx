import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Truck } from "lucide-react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebaseConfig";
import ThemeToggle from "@/components/ThemeToggle";
import { isAllowedDispatcher } from "@/lib/dispatcherAccess";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Пожалуйста, заполните все поля");
      return;
    }

    try {
      setIsSubmitting(true);
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const user = userCredential.user;

      const canAccess = await isAllowedDispatcher(user);
      if (!canAccess) {
        alert("❌ Доступ запрещён. Только диспетчер может войти в систему.");
        await auth.signOut();
        return;
      }

      window.location.href = "/dashboard";
    } catch (err) {
      setError("Неверный логин или пароль.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md p-8 bg-card border-border">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-4 shadow-glow">
            <Truck className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            TowPrime<span className="text-primary">PRO</span>
          </h1>
          <p className="text-muted-foreground text-center">
            Добро пожаловать в систему диспетчерской службы
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="dispatcher@towtruck.ru"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-background-elevated border-border"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Пароль</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-background-elevated border-border"
              disabled={isSubmitting}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Входим..." : "Войти"}
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default Auth;
