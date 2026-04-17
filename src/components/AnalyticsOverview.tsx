import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import AnalyticsWidget from "@/components/AnalyticsWidget";
import type { OrderRecord, OrderStatus } from "@/hooks/useOrders";

interface AnalyticsOverviewProps {
  orders: OrderRecord[];
  loading: boolean;
  error?: string | null;
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Новые",
  assigned: "Назначены",
  "in-progress": "В пути",
  completed: "Завершены",
  cancelled: "Отменены",
};

const STATUS_BADGE_VARIANTS: Record<OrderStatus, "default" | "secondary" | "outline" | "destructive"> = {
  new: "default",
  assigned: "default",
  "in-progress": "secondary",
  completed: "outline",
  cancelled: "destructive",
};

const AnalyticsOverview = ({ orders, loading, error }: AnalyticsOverviewProps) => {
  const { statusBreakdown, recentOrders } = useMemo(() => {
    const counts: Record<OrderStatus, number> = {
      new: 0,
      assigned: 0,
      "in-progress": 0,
      completed: 0,
      cancelled: 0,
    };

    orders.forEach((order) => {
      counts[order.status] = (counts[order.status] ?? 0) + 1;
    });

    const recent = [...orders]
      .filter((order) => order.createdAt)
      .sort((a, b) => {
        if (!a.createdAt || !b.createdAt) {
          return 0;
        }
        return b.createdAt.getTime() - a.createdAt.getTime();
      })
      .slice(0, 8);

    return {
      statusBreakdown: counts,
      recentOrders: recent,
    };
  }, [orders]);

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-6">
        <AnalyticsWidget orders={orders} loading={loading} error={error} />

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-border p-4">
            <div className="mb-4">
              <h3 className="text-base font-semibold">Статус заявок</h3>
              <p className="text-xs text-muted-foreground">
                Распределение всех заявок по текущим статусам
              </p>
            </div>

            <div className="grid gap-3">
              {Object.entries(statusBreakdown).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between rounded-lg bg-background p-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={STATUS_BADGE_VARIANTS[status as OrderStatus]}>
                      {STATUS_LABELS[status as OrderStatus]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {status === "completed" ? "Завершенные обращения" : "Текущие"}
                    </span>
                  </div>
                  <span className="text-base font-semibold">{count}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="border-border p-4">
            <div className="mb-4">
              <h3 className="text-base font-semibold">Последние заявки</h3>
              <p className="text-xs text-muted-foreground">
                Обновляется в реальном времени
              </p>
            </div>

            {recentOrders.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/50 bg-background p-6 text-center text-sm text-muted-foreground">
                Заявок пока нет
              </div>
            ) : (
              <div className="space-y-3">
                {recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-lg border border-border bg-background p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={STATUS_BADGE_VARIANTS[order.status]} className="text-xs">
                          {STATUS_LABELS[order.status]}
                        </Badge>
                        <span className="text-xs font-mono text-muted-foreground">
                          {order.code}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {order.createdAt
                          ? order.createdAt.toLocaleString("ru-RU", {
                              hour: "2-digit",
                              minute: "2-digit",
                              day: "2-digit",
                              month: "short",
                            })
                          : "—"}
                      </span>
                    </div>
                    <div className="mt-2 text-sm font-medium text-foreground">{order.clientName}</div>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                      {order.pickupAddress} → {order.dropoffAddress}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </ScrollArea>
  );
};

export default AnalyticsOverview;
