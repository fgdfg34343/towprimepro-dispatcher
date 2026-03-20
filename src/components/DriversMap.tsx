import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, Navigation } from "lucide-react";

// Mock driver data
const mockDrivers = [
  {
    id: "1",
    name: "Алексей Морозов",
    phone: "+7 (999) 111-22-33",
    lat: 55.7558,
    lng: 37.6173,
    status: "active",
    currentTask: "В пути к: ул. Космонавтов, 5",
  },
  {
    id: "2",
    name: "Дмитрий Волков",
    phone: "+7 (999) 222-33-44",
    lat: 55.7614,
    lng: 37.6242,
    status: "active",
    currentTask: null,
  },
];

const DriversMap = () => {
  return (
    <div className="relative w-full h-full bg-background-elevated">
      {/* Placeholder for map - will integrate Google Maps later */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <MapPin className="w-16 h-16 text-primary mx-auto mb-4" />
          <p className="text-xl font-semibold mb-2">Карта Москвы</p>
          <p className="text-muted-foreground">
            Здесь будет отображаться карта с водителями в реальном времени
          </p>
        </div>
      </div>

      {/* Driver overlay card - positioned bottom right */}
      <Card className="absolute bottom-6 right-6 w-80 bg-card border-border p-4 shadow-lg">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-lg font-bold text-primary">АМ</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate">{mockDrivers[0].name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge className="bg-status-completed text-white border-0">
                Online
              </Badge>
              <Badge variant="outline" className="text-xs">
                Занят
              </Badge>
            </div>
          </div>
        </div>

        {mockDrivers[0].currentTask && (
          <div className="bg-background-elevated rounded-lg p-3 mb-4">
            <div className="flex items-start gap-2">
              <Navigation className="w-4 h-4 text-status-in-progress mt-0.5" />
              <p className="text-sm">{mockDrivers[0].currentTask}</p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Phone className="w-4 h-4" />
          <span>{mockDrivers[0].phone}</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Phone className="w-4 h-4" />
            Позвонить
          </Button>
          <Button size="sm" className="gap-2">
            <Navigation className="w-4 h-4" />
            Завершить
          </Button>
        </div>
      </Card>

      {/* Map legend */}
      <Card className="absolute top-6 left-6 bg-card border-border p-4 shadow-lg">
        <h4 className="text-sm font-semibold mb-3">Легенда</h4>
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-status-completed rounded-full" />
            <span>Доступен</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-status-in-progress rounded-full" />
            <span>Занят</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-muted rounded-full" />
            <span>Оффлайн</span>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default DriversMap;
