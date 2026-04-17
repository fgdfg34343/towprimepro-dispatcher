import { Button } from "@/components/ui/button";
import { MapPin, Truck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ThemeToggle from "@/components/ThemeToggle";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="text-center max-w-2xl">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-primary rounded-2xl mb-6 shadow-glow">
          <Truck className="w-10 h-10 text-primary-foreground" />
        </div>
        
        <h1 className="mb-4 text-5xl font-bold text-foreground">
          TowPrime<span className="text-primary">PRO</span>
        </h1>
        
        <p className="text-xl text-muted-foreground mb-8">
          Система управления диспетчерской службой эвакуации
        </p>

        <div className="flex items-center justify-center gap-4">
          <Button 
            size="lg" 
            className="gap-2 shadow-glow"
            onClick={() => navigate("/auth")}
          >
            <MapPin className="w-5 h-5" />
            Войти в систему
          </Button>
        </div>

        <div className="mt-12 grid grid-cols-3 gap-6 text-sm">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-2xl font-bold text-primary mb-1">100+</div>
            <div className="text-muted-foreground">Заявок в день</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-2xl font-bold text-primary mb-1">50+</div>
            <div className="text-muted-foreground">Активных водителей</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-2xl font-bold text-primary mb-1">24/7</div>
            <div className="text-muted-foreground">Круглосуточно</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
