import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Users, CheckCircle2, Clock, Phone, Truck, MapPin, ShieldCheck, ShieldAlert } from "lucide-react";
import type { DriverDirectoryEntry } from "@/hooks/useDriverDirectory";
import {
  STATUS_BADGE_STYLES,
  STATUS_LABELS,
  type DriverAvailabilityStatus,
} from "@/lib/driverData";

interface DriverOverviewProps {
  drivers: DriverDirectoryEntry[];
  loading: boolean;
  error: string | null;
  selectedDriver?: DriverDirectoryEntry | null;
}

const formatDateTime = (date: Date | null): string => {
  if (!date) {
    return "Нет данных";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const DriverOverview = ({ drivers, loading, error, selectedDriver }: DriverOverviewProps) => {
  const stats = useMemo(() => {
    const counts: Record<DriverAvailabilityStatus, number> = {
      online: 0,
      busy: 0,
      offline: 0,
    };

    let verified = 0;

    drivers.forEach((driver) => {
      counts[driver.status] += 1;
      if (driver.isVerified) {
        verified += 1;
      }
    });

    const recentDrivers = [...drivers]
      .filter((driver) => driver.createdAt !== null)
      .sort((a, b) => {
        const aTime = a.createdAt?.getTime() ?? 0;
        const bTime = b.createdAt?.getTime() ?? 0;
        return bTime - aTime;
      })
      .slice(0, 3);

    return {
      counts,
      verified,
      recentDrivers,
      total: drivers.length,
    };
  }, [drivers]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
        Загрузка статистики по водителям...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (stats.total === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
        Пока нет зарегистрированных водителей. Они появятся здесь сразу после регистрации.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {selectedDriver && (
        <div className="rounded-xl border border-primary/40 bg-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Выбранный водитель</p>
              <h2 className="mt-1 text-lg font-semibold">{selectedDriver.fullName}</h2>
              <p className="mt-1 text-xs font-mono text-muted-foreground">{selectedDriver.id}</p>
            </div>
            <Badge className={`${STATUS_BADGE_STYLES[selectedDriver.status]} text-xs px-2 py-0.5`}>
              {STATUS_LABELS[selectedDriver.status]}
            </Badge>
          </div>

          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{selectedDriver.phoneNumber || "Телефон не указан"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <span>{selectedDriver.vehicleType || "Тип ТС не указан"}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>
                {selectedDriver.lat !== null && selectedDriver.lng !== null
                  ? `${selectedDriver.lat.toFixed(5)}, ${selectedDriver.lng.toFixed(5)}`
                  : "Координаты не передаются"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {selectedDriver.isVerified ? (
                <ShieldCheck className="h-4 w-4 text-primary" />
              ) : (
                <ShieldAlert className="h-4 w-4 text-muted-foreground" />
              )}
              <span>{selectedDriver.isVerified ? "Проверен" : "Не проверен"}</span>
            </div>
            <div className="rounded-lg border border-border/60 bg-background p-3 text-xs text-muted-foreground">
              <div className="flex items-center justify-between gap-3">
                <span>Зарегистрирован</span>
                <span className="font-medium text-foreground">{formatDateTime(selectedDriver.createdAt)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span>Последнее обновление</span>
                <span className="font-medium text-foreground">{formatDateTime(selectedDriver.updatedAt)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Статистика водителей</h2>
          <Badge variant="outline" className="gap-1 text-xs px-2">
            <Users className="w-3 h-3" />
            {stats.total}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-background p-3 border border-border/60">
            <p className="text-xs text-muted-foreground">Онлайн</p>
            <p className="text-2xl font-semibold mt-1 text-status-completed">
              {stats.counts.online}
            </p>
          </div>
          <div className="rounded-lg bg-background p-3 border border-border/60">
            <p className="text-xs text-muted-foreground">Заняты</p>
            <p className="text-2xl font-semibold mt-1 text-status-in-progress">
              {stats.counts.busy}
            </p>
          </div>
          <div className="rounded-lg bg-background p-3 border border-border/60">
            <p className="text-xs text-muted-foreground">Оффлайн</p>
            <p className="text-2xl font-semibold mt-1 text-muted-foreground">
              {stats.counts.offline}
            </p>
          </div>
          <div className="rounded-lg bg-background p-3 border border-border/60">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="w-3 h-3 text-primary" />
              <span>Проверены</span>
            </div>
            <p className="text-2xl font-semibold mt-1 text-primary">
              {stats.verified}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Недавно зарегистрированы</h3>
        </div>

        {stats.recentDrivers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Новых регистраций пока не было.
          </p>
        ) : (
          <div className="space-y-3">
            {stats.recentDrivers.map((driver) => (
              <div
                key={driver.id}
                className="rounded-lg border border-border/60 bg-background p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{driver.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(driver.createdAt)}
                    </p>
                  </div>
                  <Badge
                    className={`${STATUS_BADGE_STYLES[driver.status]} text-xs px-2 py-0.5`}
                  >
                    {STATUS_LABELS[driver.status]}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DriverOverview;
