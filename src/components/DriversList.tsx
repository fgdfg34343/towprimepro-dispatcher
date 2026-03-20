import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, Truck, Clock, ShieldCheck, ShieldAlert, CheckCircle, FileText, MessageSquarePlus } from "lucide-react";
import type { DriverDirectoryEntry } from "@/hooks/useDriverDirectory";
import {
  STATUS_BADGE_STYLES,
  STATUS_LABELS,
  type DriverAvailabilityStatus,
} from "@/lib/driverData";
import { verifyDriver, rejectDriver, requestCorrection } from "@/lib/verifyDriver";
import { toast } from "sonner";
import DriverDocumentsDialog from "./DriverDocumentsDialog";
import { doc, getDoc, type DocumentData } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DriversListProps {
  searchQuery: string;
  drivers: DriverDirectoryEntry[];
  loading: boolean;
  error: string | null;
  onOpenChat?: (driverId: string) => void;
  onSelectDriver?: (driverId: string) => void;
  selectedDriverId?: string | null;
}

const formatUpdatedAt = (date: Date | null): string => {
  if (!date) {
    return "Нет обновлений";
  }

  const diffMs = Date.now() - date.getTime();

  if (diffMs < 60_000) {
    return "Только что";
  }

  const diffMinutes = Math.round(diffMs / 60_000);

  if (diffMinutes < 60) {
    return `${diffMinutes} мин назад`;
  }

  const diffHours = Math.round(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours} ч назад`;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const STATUS_DISPLAY_ORDER: DriverAvailabilityStatus[] = ["online", "busy", "offline"];

const DriversList = ({
  searchQuery,
  drivers,
  loading,
  error,
  onOpenChat,
  onSelectDriver,
  selectedDriverId,
}: DriversListProps) => {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const [verifyingDrivers, setVerifyingDrivers] = useState<Set<string>>(new Set());
  const [selectedDriver, setSelectedDriver] = useState<{
    id: string;
    name: string;
    documents: Record<string, any> | null;
    driverData: DocumentData;
  } | null>(null);
  const [loadingDocuments, setLoadingDocuments] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("active");

  const handleVerifyDriver = async (driverId: string, driverName: string) => {
    setVerifyingDrivers((prev) => new Set(prev).add(driverId));
    try {
      await verifyDriver(driverId);
      toast.success(`Водитель ${driverName} верифицирован`, {
        description: "Статус обновлен в системе",
      });
    } catch (error) {
      toast.error("Ошибка верификации", {
        description: error instanceof Error ? error.message : "Не удалось верифицировать водителя",
      });
    } finally {
      setVerifyingDrivers((prev) => {
        const next = new Set(prev);
        next.delete(driverId);
        return next;
      });
    }
  };

  const handleRejectDriver = async (driverId: string, driverName: string, reason: string) => {
    setVerifyingDrivers((prev) => new Set(prev).add(driverId));
    try {
      await rejectDriver(driverId, reason);
      toast.error(`Верификация ${driverName} отклонена`, {
        description: "Водитель получил уведомление с причиной отклонения",
      });
    } catch (error) {
      toast.error("Ошибка отклонения", {
        description: error instanceof Error ? error.message : "Не удалось отклонить водителя",
      });
    } finally {
      setVerifyingDrivers((prev) => {
        const next = new Set(prev);
        next.delete(driverId);
        return next;
      });
    }
  };

  const handleRequestCorrection = async (driverId: string, driverName: string, reason: string) => {
    setVerifyingDrivers((prev) => new Set(prev).add(driverId));
    try {
      await requestCorrection(driverId, reason);
      toast.info(`Отправлено на доработку: ${driverName}`, {
        description: "Водитель получил уведомление с требованиями к исправлению",
      });
    } catch (error) {
      toast.error("Ошибка отправки на доработку", {
        description: error instanceof Error ? error.message : "Не удалось отправить на доработку",
      });
    } finally {
      setVerifyingDrivers((prev) => {
        const next = new Set(prev);
        next.delete(driverId);
        return next;
      });
    }
  };

  const handleViewDocuments = async (driverId: string, driverName: string) => {
    setLoadingDocuments(driverId);
    try {
      const driverRef = doc(db, "drivers", driverId);
      const driverSnap = await getDoc(driverRef);

      if (driverSnap.exists()) {
        const data = driverSnap.data();
        setSelectedDriver({
          id: driverId,
          name: driverName,
          documents: data.documents || null,
          driverData: data,
        });
      } else {
        toast.error("Водитель не найден", {
          description: "Не удалось загрузить данные водителя",
        });
      }
    } catch (error) {
      console.error("Ошибка загрузки документов:", error);
      toast.error("Ошибка загрузки документов", {
        description: error instanceof Error ? error.message : "Не удалось загрузить документы",
      });
    } finally {
      setLoadingDocuments(null);
    }
  };

  const pendingDriversCount = useMemo(() => {
    return drivers.filter(d => d.verificationStatus === 'pending').length;
  }, [drivers]);

  const activeDriversCount = useMemo(() => {
    return drivers.filter(d => d.can_work).length;
  }, [drivers]);

  const rejectedDriversCount = useMemo(() => {
    return drivers.filter(d => d.verificationStatus === 'rejected').length;
  }, [drivers]);

  const filteredDrivers = useMemo(() => {
    let result = drivers;

    // Filter by tab
    if (activeTab === 'pending') {
      result = result.filter(d => d.verificationStatus === 'pending');
    } else if (activeTab === 'active') {
      result = result.filter(d => d.can_work);
    } else if (activeTab === 'rejected') {
      result = result.filter(d => d.verificationStatus === 'rejected');
    }

    if (!normalizedQuery) {
      return result;
    }

    return result.filter((driver) => {
      return (
        driver.fullName.toLowerCase().includes(normalizedQuery) ||
        driver.phoneNumber.replace(/\s+/g, "").includes(normalizedQuery.replace(/\s+/g, "")) ||
        driver.vehicleType.toLowerCase().includes(normalizedQuery) ||
        driver.id.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [drivers, normalizedQuery, activeTab]);

  const refreshDriverData = async () => {
    if (selectedDriver) {
      const docSnap = await getDoc(doc(db, "drivers", selectedDriver.id));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSelectedDriver(prev => prev ? ({ ...prev, driverData: data }) : null);
      }
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Водители</h2>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="pending" className="relative">
              Ожидают
              {pendingDriversCount > 0 && (
                <Badge variant="destructive" className="ml-2 px-1.5 py-0 text-[10px] h-4">
                  {pendingDriversCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="active">
              Активные
              <Badge variant="secondary" className="ml-2 px-1.5 py-0 text-[10px] h-4">
                {activeDriversCount}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="rejected">
              Отклонённые
              <Badge variant="outline" className="ml-2 px-1.5 py-0 text-[10px] h-4">
                {rejectedDriversCount}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loading && (
        <div className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
          Загрузка списка водителей...
        </div>
      )}

      {error && !loading && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && !error && filteredDrivers.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
          <p className="font-medium">Водители не найдены</p>
          <p className="text-sm mt-1">
            {activeTab === 'pending'
              ? "Нет водителей, ожидающих подтверждения."
              : activeTab === 'active'
                ? "Нет активных водителей."
                : "Нет отклоненных водителей."}
          </p>
        </div>
      )}

      <div className="space-y-3">
        {!loading &&
          !error &&
          filteredDrivers.map((driver) => (
            <div
              key={driver.id}
              className={`bg-card border rounded-xl p-4 transition-colors cursor-pointer ${
                selectedDriverId === driver.id
                  ? "border-primary shadow-[0_0_0_1px_hsl(var(--primary))]"
                  : "border-border hover:border-primary/40"
              }`}
              onClick={() => onSelectDriver?.(driver.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-col gap-1 mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{driver.fullName}</span>
                      {driver.isVerified ? (
                        <Badge
                          variant="outline"
                          className="gap-1 text-[11px] border-green-500 text-green-500"
                        >
                          <ShieldCheck className="w-3 h-3" />
                          Проверен
                        </Badge>
                      ) : driver.verificationStatus === 'rejected' ? (
                        <Badge
                          variant="outline"
                          className="gap-1 text-[11px] border-destructive text-destructive"
                        >
                          <ShieldAlert className="w-3 h-3" />
                          Отклонён
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="gap-1 text-[11px] border-border text-muted-foreground"
                        >
                          <ShieldAlert className="w-3 h-3" />
                          Не проверен
                        </Badge>
                      )}
                    </div>
                    {driver.verificationStatus === 'rejected' && driver.rejectionReason && (
                      <div className="text-[11px] text-destructive leading-tight line-clamp-2 hover:line-clamp-none cursor-help transition-all p-1 bg-destructive/5 rounded border border-destructive/10" title={driver.rejectionReason}>
                        <span className="font-semibold">Причина:</span> {driver.rejectionReason}
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">ID: {driver.id}</p>
                </div>
                {activeTab === 'active' && (
                  <Badge className={`${STATUS_BADGE_STYLES[driver.status]} text-xs px-2 py-0.5`}>
                    {STATUS_LABELS[driver.status]}
                  </Badge>
                )}
              </div>

              <div className="mt-3 space-y-2 text-sm">
                {driver.phoneNumber && (
                  <div className="flex items-center gap-2 text-foreground">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span>{driver.phoneNumber}</span>
                  </div>
                )}
                {driver.vehicleType && (
                  <div className="flex items-center gap-2 text-foreground">
                    <Truck className="w-4 h-4 text-muted-foreground" />
                    <span>{driver.vehicleType}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>Обновлено: {formatUpdatedAt(driver.updatedAt)}</span>
                </div>
              </div>

              {/* Кнопки действий */}
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleViewDocuments(driver.id, driver.fullName);
                  }}
                  disabled={loadingDocuments === driver.id}
                >
                  <FileText className="w-3 h-3" />
                  {loadingDocuments === driver.id ? "Загрузка..." : "Документы"}
                </Button>
                {onOpenChat && (
                  <Button
                    size="sm"
                    variant="default"
                    className="flex-1 gap-2"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenChat(driver.id);
                    }}
                  >
                    <MessageSquarePlus className="w-3 h-3" />
                    Написать
                  </Button>
                )}
              </div>

              {/* Кнопки верификации для непроверенных водителей */}
              {activeTab === 'pending' && !driver.isVerified && (
                <div className="mt-3 space-y-2">
                  <Button
                    size="sm"
                    variant="default"
                    className="w-full gap-1"
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleVerifyDriver(driver.id, driver.fullName);
                    }}
                    disabled={verifyingDrivers.has(driver.id)}
                  >
                    <CheckCircle className="w-3 h-3" />
                    {verifyingDrivers.has(driver.id) ? "Обработка..." : "Верифицировать"}
                  </Button>
                </div>
              )}
            </div>
          ))}
      </div>

      {/* Диалог просмотра документов */}
      {selectedDriver && (
        <DriverDocumentsDialog
          open={!!selectedDriver}
          onOpenChange={(open) => !open && setSelectedDriver(null)}
          driverName={selectedDriver.name}
          driverId={selectedDriver.id}
          documents={selectedDriver.documents}
          driverData={selectedDriver.driverData}
          onDriverUpdate={refreshDriverData}
          onVerify={
            !drivers.find((d) => d.id === selectedDriver.id)?.isVerified
              ? () => handleVerifyDriver(selectedDriver.id, selectedDriver.name)
              : undefined
          }
          onReject={
            !drivers.find((d) => d.id === selectedDriver.id)?.isVerified
              ? (reason) => handleRejectDriver(selectedDriver.id, selectedDriver.name, reason)
              : undefined
          }
          onRequestCorrection={
            !drivers.find((d) => d.id === selectedDriver.id)?.isVerified
              ? (reason) => handleRequestCorrection(selectedDriver.id, selectedDriver.name, reason)
              : undefined
          }
        />
      )}
    </div>
  );
};

export default DriversList;
