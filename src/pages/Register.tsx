import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Truck, Eye, EyeOff } from "lucide-react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import ThemeToggle from "@/components/ThemeToggle";
import { Link } from "react-router-dom";

const Register = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password || !confirmPassword) {
      setError("Пожалуйста, заполните все поля");
      return;
    }

    if (password !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }

    if (password.length < 6) {
      setError("Пароль должен содержать не менее 6 символов");
      return;
    }

    try {
      setIsSubmitting(true);
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, "dispatchers", user.uid), {
        email: user.email,
        createdAt: serverTimestamp(),
        active: true,
      });
      setSuccess(true);
    } catch (err: any) {
      if (err.code === "auth/email-already-in-use") {
        setError("Этот email уже зарегистрирован");
      } else if (err.code === "auth/invalid-email") {
        setError("Некорректный email адрес");
      } else if (err.code === "auth/weak-password") {
        setError("Слишком слабый пароль");
      } else {
        setError("Ошибка при регистрации. Попробуйте ещё раз.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <Card className="w-full max-w-md p-8 bg-card border-border text-center">
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-4 shadow-glow">
              <Truck className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              TowPrime<span className="text-primary">PRO</span>
            </h1>
          </div>
          <p className="text-green-500 font-medium mb-2">Аккаунт успешно создан!</p>
          <p className="text-muted-foreground text-sm mb-6">
            Ваш аккаунт зарегистрирован. Войдите в систему, чтобы продолжить.
          </p>
          <Link to="/auth">
            <Button className="w-full">Войти в систему</Button>
          </Link>
        </Card>
      </div>
    );
  }

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
            Создайте аккаунт диспетчера
          </p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
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
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-background-elevated border-border pr-10"
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Подтвердите пароль</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="bg-background-elevated border-border pr-10"
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Регистрация..." : "Зарегистрироваться"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Уже есть аккаунт?{" "}
            <Link to="/auth" className="text-primary hover:underline">
              Войти
            </Link>
          </p>
        </form>
      </Card>
    </div>
  );
};

export default Register;
