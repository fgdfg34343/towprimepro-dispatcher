import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { BarChart3, TrendingUp, TrendingDown, Clock, CheckCircle2 } from "lucide-react";
import type { OrderRecord } from "@/hooks/useOrders";

interface AnalyticsWidgetProps {
  orders: OrderRecord[];
  loading: boolean;
  error?: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const parseNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    if (!normalized) {
      return null;
    }
    const parsed = Number(normalized);
    return Number.isNaN(parsed) ? null : parsed;
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  return null;
};

const readNumberFromObject = (candidate: unknown, keys: string[]): number | null => {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }
  const node = candidate as Record<string, unknown>;
  for (const key of keys) {
    const value = node[key];
    const parsed = parseNumber(value);
    if (parsed !== null) {
      return parsed;
    }
  }
  return null;
};

const resolveDurationMinutes = (order: OrderRecord): number | null => {
  if (typeof order.durationMinutes === "number" && order.durationMinutes > 0) {
    return order.durationMinutes;
  }

  if (order.completedAt && order.createdAt) {
    const diffMinutes = (order.completedAt.getTime() - order.createdAt.getTime()) / 60000;
    if (Number.isFinite(diffMinutes) && diffMinutes > 0) {
      return diffMinutes;
    }
  }

  const metadata = (order.metadata ?? {}) as Record<string, unknown>;

  const metadataDuration =
    readNumberFromObject(metadata, ["durationMinutes", "duration"]) ??
    (() => {
      const seconds = readNumberFromObject(metadata, ["durationSeconds"]);
      return seconds !== null ? seconds / 60 : null;
    })();

  if (metadataDuration !== null && metadataDuration > 0) {
    return metadataDuration;
  }

  const pricingNode = metadata.pricing as Record<string, unknown> | undefined;
  if (pricingNode) {
    const pricingDuration =
      readNumberFromObject(pricingNode, ["durationMinutes"]) ??
      (() => {
        const seconds = readNumberFromObject(pricingNode, ["durationSeconds"]);
        return seconds !== null ? seconds / 60 : null;
      })();
    if (pricingDuration !== null && pricingDuration > 0) {
      return pricingDuration;
    }
  }

  const routeNode = metadata.route as Record<string, unknown> | undefined;
  if (routeNode) {
    const routeDuration =
      readNumberFromObject(routeNode, ["durationMinutes", "duration"]) ??
      (() => {
        const seconds = readNumberFromObject(routeNode, ["durationSeconds"]);
        return seconds !== null ? seconds / 60 : null;
      })();
    if (routeDuration !== null && routeDuration > 0) {
      return routeDuration;
    }
  }

  return null;
};

interface AnalyticsMetrics {
  totalOrders: number;
  growthPercent: number;
  avgDurationMinutes: number | null;
  autoAssignRate: number;
  sparklineHeights: number[];
}

const AnalyticsWidget = ({ orders, loading, error }: AnalyticsWidgetProps) => {
  const metrics = useMemo<AnalyticsMetrics>(() => {
    const now = new Date();
    const ordersWithCreated = orders.filter((order) => order.createdAt instanceof Date);

    const windowStart = new Date(now.getTime() - 7 * DAY_MS);
    const previousWindowStart = new Date(now.getTime() - 14 * DAY_MS);

    const recentOrders = ordersWithCreated.filter(
      (order) => order.createdAt && order.createdAt >= windowStart,
    );

    const previousOrders = ordersWithCreated.filter(
      (order) =>
        order.createdAt &&
        order.createdAt >= previousWindowStart &&
        order.createdAt < windowStart,
    );

    const totalOrders = recentOrders.length;

    const autoAssignRate =
      totalOrders === 0
        ? 0
        : (recentOrders.filter((order) => order.assignedAutomatically === true).length / totalOrders) *
          100;

    const durations = recentOrders
      .map((order) => resolveDurationMinutes(order))
      .filter((duration): duration is number => duration !== null && Number.isFinite(duration));

    const avgDurationMinutes =
      durations.length > 0
        ? durations.reduce((sum, value) => sum + value, 0) / durations.length
        : null;

    let growthPercent = 0;
    if (previousOrders.length === 0) {
      growthPercent = totalOrders > 0 ? 100 : 0;
    } else {
      growthPercent = ((totalOrders - previousOrders.length) / previousOrders.length) * 100;
    }
    growthPercent = Math.max(Math.min(growthPercent, 999), -999);

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const dailyCounts = Array.from({ length: 7 }).map((_, index) => {
      const start = new Date(startOfToday);
      start.setDate(start.getDate() - (6 - index));
      const end = new Date(start);
      end.setDate(start.getDate() + 1);

      return ordersWithCreated.filter(
        (order) =>
          order.createdAt &&
          order.createdAt >= start &&
          order.createdAt < end,
      ).length;
    });

    const maxDaily = dailyCounts.reduce((max, count) => Math.max(max, count), 0);

    const sparklineHeights =
      maxDaily === 0
        ? dailyCounts.map((count) => (count > 0 ? 40 : 6))
        : dailyCounts.map((count) => {
            if (count === 0) {
              return 6;
            }
            const percent = (count / maxDaily) * 100;
            return Math.max(18, Math.min(100, percent));
          });

    return {
      totalOrders,
      growthPercent,
      avgDurationMinutes,
      autoAssignRate,
      sparklineHeights,
    };
  }, [orders]);

  const growthRounded = Math.round(metrics.growthPercent);
  const growthDisplay =
    metrics.growthPercent === 0
      ? "0%"
      : `${growthRounded > 0 ? "+" : ""}${growthRounded}%`;
  const autoAssignRounded = Math.round(metrics.autoAssignRate);
  const averageDurationDisplay =
    metrics.avgDurationMinutes !== null
      ? Math.round(metrics.avgDurationMinutes)
      : null;
  const TrendIcon = metrics.growthPercent >= 0 ? TrendingUp : TrendingDown;
  const trendColor =
    metrics.growthPercent >= 0 ? "text-status-completed" : "text-destructive";
  const autoAssignBarWidth = Math.max(0, Math.min(100, autoAssignRounded));

  const renderSkeleton = () => (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-muted/20 p-3 h-20" />
        <div className="rounded-lg bg-muted/20 p-3 h-20" />
        <div className="col-span-2 rounded-lg bg-muted/20 p-3 h-20" />
      </div>
      <div className="flex h-12 items-end gap-1">
        {Array.from({ length: 7 }).map((_, index) => (
          <div
            key={index}
            className="flex-1 rounded-t bg-muted/30"
            style={{ height: `${20 + (index % 3) * 10}%` }}
          />
        ))}
      </div>
    </div>
  );

  return (
    <Card className="border-border p-4">
      <div className="mb-4 flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Аналитика (7 дней)</h3>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          Не удалось обновить аналитические данные: {error}
        </div>
      )}

      {loading ? (
        renderSkeleton()
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-background p-3">
              <div className="mb-1 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-status-completed" />
                <span className="text-xs text-muted-foreground">Заявки</span>
              </div>
              <p className="text-2xl font-bold">{metrics.totalOrders}</p>
              <div className="mt-1 flex items-center gap-1 text-xs">
                <TrendIcon className={`h-3 w-3 ${trendColor}`} />
                <span className={trendColor}>{growthDisplay}</span>
              </div>
            </div>

            <div className="rounded-lg bg-background p-3">
              <div className="mb-1 flex items-center gap-2">
                <Clock className="h-4 w-4 text-status-in-progress" />
                <span className="text-xs text-muted-foreground">Ср. время</span>
              </div>
              <p className="text-2xl font-bold">
                {averageDurationDisplay !== null ? averageDurationDisplay : "—"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {averageDurationDisplay !== null ? "минут" : "Недостаточно данных"}
              </p>
            </div>

            <div className="col-span-2 rounded-lg bg-background p-3">
              <span className="text-xs text-muted-foreground">Автоназначения</span>
              <div className="mt-2 flex items-end justify-between">
                <p className="text-2xl font-bold">{autoAssignRounded}%</p>
                <div className="mx-3 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary transition-all"
                    style={{ width: `${autoAssignBarWidth}%` }}
                  />
                </div>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Рассчитано по последним {metrics.totalOrders || 0} заявкам
              </p>
            </div>
          </div>

          <div className="mt-4 flex h-12 items-end gap-1">
            {metrics.sparklineHeights.map((height, index) => (
              <div
                key={index}
                className="flex-1 rounded-t bg-primary/30 transition-colors hover:bg-primary"
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
        </>
      )}
    </Card>
  );
};

export default AnalyticsWidget;
