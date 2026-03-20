import { useMemo } from "react";
import { Car, Phone, Navigation } from "lucide-react";
import type { DriverDirectoryEntry } from "@/hooks/useDriverDirectory";
import { Card } from "@/components/ui/card";

interface OnlineDriversWidgetProps {
  drivers: DriverDirectoryEntry[];
  loading: boolean;
  error?: string | null;
}

const OnlineDriversWidget = ({ drivers, loading, error }: OnlineDriversWidgetProps) => {
  const onlineDrivers = useMemo(() => {
    return drivers.filter((driver) => driver.status === "online");
  }, [drivers]);

  return (
    <Card className="border-border p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Car className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Водители онлайн</h3>
        </div>
        <span className="text-xs text-muted-foreground">{onlineDrivers.length}</span>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          Не удалось загрузить водителей
        </div>
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="animate-pulse rounded-lg bg-background p-3">
              <div className="mb-2 h-4 w-32 rounded-full bg-muted" />
              <div className="flex items-center gap-2">
                <span className="h-3 w-20 rounded-full bg-muted" />
                <span className="h-3 w-14 rounded-full bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : onlineDrivers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/50 bg-background p-4 text-center text-sm text-muted-foreground">
          Нет водителей в сети
        </div>
      ) : (
        <div className="space-y-3">
          <div className="max-h-72 space-y-2 overflow-y-auto pr-2">
            {onlineDrivers.map((driver) => {
              const name = driver.fullName?.trim().length
                ? driver.fullName.trim()
                : [driver.firstName, driver.lastName].filter(Boolean).join(" ").trim() || `Водитель ${driver.id}`;

              return (
                <div
                  key={driver.id}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm transition-colors hover:border-primary/50"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{name}</span>
                    <span className="text-[10px] uppercase tracking-wide text-status-completed">Online</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {driver.vehicleType && (
                      <span className="inline-flex items-center gap-1">
                        <Navigation className="h-3.5 w-3.5" />
                        {driver.vehicleType}
                      </span>
                    )}
                    {driver.phoneNumber && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5" />
                        {driver.phoneNumber}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
};

export default OnlineDriversWidget;
