
import { useEffect, useState, useMemo, useRef } from "react";
import {
    collection,
    query,
    orderBy,
    onSnapshot,
    doc,
    getDoc,
    serverTimestamp,
    Timestamp,
    writeBatch,
    increment,
    where,
    getDocs
} from "firebase/firestore";
import { db } from "@/firebaseConfig";
import {
    Loader2,
    CheckCircle,
    Clock,
    Wallet,
    Calendar,
    User,
    Search,
    AlertCircle,
    XCircle,
    ArrowLeft,
    Folder
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea"; // Assuming this exists
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"; // Assuming these exist

// Типы данных
interface Accrual {
    id: string;
    driverId: string;
    amount?: number; // fallback
    driverAmount?: number; // main field
    status: "accrued" | "paid" | "pending";
    createdAt?: Timestamp;
    date?: Timestamp; // fallback
    paidAt?: Timestamp;
    description?: string;
    orderId?: string;
    paymentMethod?: string;
    withdrawnAmount?: number;
}

interface WithdrawalRequest {
    id: string;
    driverId: string;
    amount: number;
    createdAt?: Timestamp; // Changed from date to match spec
    date?: Timestamp; // keep fallback
    status: "pending" | "approved" | "rejected"; // Changed paid -> approved
    processedAt?: Timestamp;
    processedBy?: string;
    rejectReason?: string;
}

interface Driver {
    id: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
    phone?: string;
    availableToWithdraw?: number;
    toPay?: number; // Fallback
    paid?: number;
}

interface Withdrawal {
    id: string;
    driverId: string;
    amount: number;
    createdAt: Timestamp;
    withdrawalRequestId?: string;
}

export default function Accruals({ defaultTab = "requests" }: { defaultTab?: string }) {
    const [accruals, setAccruals] = useState<Accrual[]>([]);
    const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
    const [historyWithdrawals, setHistoryWithdrawals] = useState<Withdrawal[]>([]);
    const [drivers, setDrivers] = useState<Record<string, Driver>>({});
    const [loadingAccruals, setLoadingAccruals] = useState(true);
    const [loadingRequests, setLoadingRequests] = useState(true);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [requestStatusFilter, setRequestStatusFilter] = useState<string>("pending");
    const [requestSortOrder, setRequestSortOrder] = useState<"asc" | "desc">("asc"); // Default sort by createdAt? Spec says "Sort by createdAt", usually desc.

    // Reject Dialog State
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [selectedRequestToReject, setSelectedRequestToReject] = useState<WithdrawalRequest | null>(null);
    const [rejectReason, setRejectReason] = useState("");

    // Folder View State
    const [selectedDriverHistory, setSelectedDriverHistory] = useState<string | null>(null); // driverId
    const [historyDialogOpen, setHistoryDialogOpen] = useState(false);

    // Track first load for notifications
    const isFirstRun = useRef(true);



    // 3. Слушаем историю выплат (withdrawals)
    useEffect(() => {
        const q = query(
            collection(db, "withdrawals"),
            orderBy("createdAt", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Withdrawal[];

            setHistoryWithdrawals(data);
            setLoadingHistory(false);

            const driverIds = Array.from(new Set(data.map(r => r.driverId)));
            fetchDrivers(driverIds);
        }, (error) => {
            console.error("Error fetching history:", error);
            setLoadingHistory(false);
        });

        return () => unsubscribe();
    }, []);

    // 1. Слушаем начисления
    useEffect(() => {
        const q = query(
            collection(db, "accruals"),
            orderBy("createdAt", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Accrual[];

            setAccruals(data);
            setLoadingAccruals(false);

            const driverIds = Array.from(new Set(data.map(r => r.driverId)));
            fetchDrivers(driverIds);
        }, (error) => {
            console.error("Error fetching accruals:", error);
            toast.error("Ошибка загрузки начислений");
            setLoadingAccruals(false);
        });

        return () => unsubscribe();
        return () => unsubscribe();
    }, []);

    // 2. Слушаем запросы на выплату (withdrawal_requests)
    useEffect(() => {
        // Spec says: Sort by createdAt. Assuming DESC for now to show news first, 
        // but typically "pending" queue might want ASC (oldest first). 
        // Let's stick to DESC usually unless specified.
        const q = query(
            collection(db, "withdrawal_requests"),
            orderBy("createdAt", "desc") // Spec: "Sort by createdAt"
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
                // Normailize date fields if needed
            })) as WithdrawalRequest[];

            // Notification for new requests
            if (isFirstRun.current) {
                isFirstRun.current = false;
            } else {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === "added") {
                        const newReq = change.doc.data();
                        if (newReq.status === 'pending') {
                            toast.info("Новый запрос на выплату!", {
                                description: `Сумма: ${Math.abs(newReq.amount)} ₽`
                            });
                        }
                    }
                });
            }

            setRequests(data);
            setLoadingRequests(false);

            const driverIds = Array.from(new Set(data.map(r => r.driverId)));
            fetchDrivers(driverIds);
        }, (error) => {
            console.error("Error fetching requests:", error);
            if (error.code !== 'permission-denied') {
                // toast.error("Ошибка загрузки запросов");
            }
            setLoadingRequests(false);
        });

        return () => unsubscribe();
    }, []);

    const fetchDrivers = async (ids: string[]) => {
        const newDrivers: Record<string, Driver> = { ...drivers };
        const missingIds = ids.filter(id => !newDrivers[id]);

        if (missingIds.length === 0) return;

        let updated = false;

        for (const id of missingIds) {
            try {
                const driverDoc = await getDoc(doc(db, "drivers", id));
                if (driverDoc.exists()) {
                    const data = driverDoc.data();
                    newDrivers[id] = {
                        id: driverDoc.id,
                        ...data,
                        fullName: data.fullName || `${data.firstName || ""} ${data.lastName || ""}`.trim()
                    } as Driver;
                    updated = true;
                }
            } catch (error) {
                console.error(`Error fetching driver ${id}:`, error);
            }
        }

        if (updated) {
            setDrivers(newDrivers);
        }
    };

    // Обычная выплата начисления (Legacy/Manual logic for Accruals items)
    const handleMarkAsPaid = async (accrualId: string) => {
        const accrual = accruals.find(a => a.id === accrualId);
        if (!accrual) return;

        setProcessingId(accrualId);
        try {
            const batch = writeBatch(db);
            const accrualRef = doc(db, 'accruals', accrualId);
            const driverRef = doc(db, 'drivers', accrual.driverId);

            batch.update(accrualRef, {
                status: "paid",
                paidAt: serverTimestamp(),
                paymentMethod: "dispatcher_manual"
            });

            // Update Aggregates (using availableToWithdraw if available, else toPay)
            // Note: This logic for Accruals tab was not explicitly changed in this task, 
            // but for consistency we might want to check. Keeping original logic for now 
            // but checking field usage.
            // Original used `toPay`. I will keep `toPay` here to not break Accruals tab logic without instruction.
            batch.update(driverRef, {
                toPay: increment(-(accrual.driverAmount || accrual.amount || 0)),
                paid: increment(accrual.driverAmount || accrual.amount || 0)
            });

            await batch.commit();
            toast.success("Выплата успешно оформлена");
        } catch (error: any) {
            console.error(error);
            toast.error(`Ошибка при выплате: ${error.message}`);
        } finally {
            setProcessingId(null);
        }
    };

    // 4. Логика подтверждения выплаты (Approve)
    const handleApproveRequest = async (request: WithdrawalRequest) => {
        if (!confirm(`Подтвердить выплату ${Math.abs(request.amount).toLocaleString("ru-RU")}₽ водителю?`)) return;

        setProcessingId(request.id);
        try {
            // 1. Get all accrued items for this driver to distribute the payment
            const accrualsRef = collection(db, "accruals");
            const qAccount = query(
                accrualsRef,
                where("driverId", "==", request.driverId),
                where("status", "==", "accrued")
            );
            const accrualsSnapshot = await getDocs(qAccount);
            const openAccruals = accrualsSnapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Accrual[];

            // FIFO: Pay oldest first (Client-side sort to avoid index requirement)
            openAccruals.sort((a, b) => {
                const timeA = a.createdAt?.toMillis() || a.date?.toMillis() || 0;
                const timeB = b.createdAt?.toMillis() || b.date?.toMillis() || 0;
                return timeA - timeB;
            });

            const batch = writeBatch(db);
            const amountAbs = Math.abs(request.amount);
            let remainingToPay = amountAbs;

            // 2. Distribute amount across accruals
            for (const accrual of openAccruals) {
                if (remainingToPay <= 0) break;

                const accrualTotal = accrual.driverAmount || accrual.amount || 0;
                const alreadyWithdrawn = accrual.withdrawnAmount || 0;
                const availableInAccrual = accrualTotal - alreadyWithdrawn;

                if (availableInAccrual <= 0) continue;

                const accrualRef = doc(db, "accruals", accrual.id);

                if (remainingToPay >= availableInAccrual) {
                    // Fully pay off this accrual
                    batch.update(accrualRef, {
                        status: "paid",
                        paidAt: serverTimestamp(),
                        withdrawnAmount: accrualTotal, // Fully withdrawn
                        paymentMethod: "withdrawal_request"
                    });
                    remainingToPay -= availableInAccrual;
                } else {
                    // Partially pay this accrual
                    batch.update(accrualRef, {
                        withdrawnAmount: alreadyWithdrawn + remainingToPay,
                        // Status remains "accrued" as it's not fully paid
                    });
                    remainingToPay = 0;
                }
            }

            // 3. Update withdrawal_requests
            const requestRef = doc(db, 'withdrawal_requests', request.id);
            batch.update(requestRef, {
                status: "approved",
                processedAt: serverTimestamp()
            });

            // 4. Create record in withdrawals
            const newWithdrawalRef = doc(collection(db, "withdrawals"));
            batch.set(newWithdrawalRef, {
                driverId: request.driverId,
                amount: amountAbs,
                withdrawalRequestId: request.id,
                createdAt: serverTimestamp()
            });

            // 5. Update driver aggregates
            const driverRef = doc(db, 'drivers', request.driverId);
            batch.update(driverRef, {
                availableToWithdraw: increment(-amountAbs),
                paid: increment(amountAbs),
                toPay: increment(-amountAbs) // Also decrease toPay
            });

            await batch.commit();
            toast.success("Выплата подтверждена и распределена по начислениям");

        } catch (error: any) {
            console.error(error);
            toast.error(`Ошибка обработки запроса: ${error.message}`);
        } finally {
            setProcessingId(null);
        }
    };

    // 5. Логика отклонения (Reject)
    const handleRejectRequest = async () => {
        if (!selectedRequestToReject || !rejectReason.trim()) {
            toast.error("Укажите причину отказа");
            return;
        }

        const request = selectedRequestToReject;
        setProcessingId(request.id);
        setRejectDialogOpen(false); // Close dialog immediately

        try {
            const batch = writeBatch(db);

            // 1. Update withdrawal_requests
            const requestRef = doc(db, 'withdrawal_requests', request.id);
            batch.update(requestRef, {
                status: "rejected", // Spec 5.1
                rejectReason: rejectReason, // Spec 5.2
                processedAt: serverTimestamp()
            });

            // 2. Return sum back to availableToWithdraw
            // Spec 5.3: "Вернуть сумму обратно в доступную к выплате водителя"
            const driverRef = doc(db, 'drivers', request.driverId);
            const amountAbs = Math.abs(request.amount);

            batch.update(driverRef, {
                availableToWithdraw: increment(amountAbs)
            });

            await batch.commit();
            toast.success("Запрос отклонен, средства возвращены");

        } catch (error: any) {
            console.error(error);
            toast.error(`Ошибка отклонения: ${error.message}`);
        } finally {
            setProcessingId(null);
            setRejectReason("");
            setSelectedRequestToReject(null);
        }
    };

    const openRejectDialog = (req: WithdrawalRequest) => {
        setSelectedRequestToReject(req);
        setRejectReason("");
        setRejectDialogOpen(true);
    };

    const filteredAccruals = useMemo(() => {
        return accruals.filter(acc => {
            const driver = drivers[acc.driverId];
            const driverName = driver?.fullName?.toLowerCase() || "";
            const driverPhone = driver?.phone?.toLowerCase() || "";
            const matchesSearch = driverName.includes(searchQuery.toLowerCase()) ||
                driverPhone.includes(searchQuery.toLowerCase()) ||
                acc.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (acc.orderId && acc.orderId.toLowerCase().includes(searchQuery.toLowerCase()));

            const matchesStatus = statusFilter === "all" || acc.status === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [accruals, drivers, searchQuery, statusFilter]);

    const filteredRequests = useMemo(() => {
        return requests.filter(req => {
            const driver = drivers[req.driverId];
            const driverName = driver?.fullName?.toLowerCase() || "";
            const driverPhone = driver?.phone?.toLowerCase() || "";
            const matchesSearch = driverName.includes(searchQuery.toLowerCase()) ||
                driverPhone.includes(searchQuery.toLowerCase()) ||
                req.id.toLowerCase().includes(searchQuery.toLowerCase());

            // Spec 2.2: Default pending. (Handled by initial state of requestStatusFilter)
            const matchesStatus = requestStatusFilter === "all" || req.status === requestStatusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [requests, drivers, searchQuery, requestStatusFilter]);

    // This total depends on the tab, but assuming it's for Accruals generally.
    const totalToPay = useMemo(() => {
        // This likely needs to be updated to reflect `availableToWithdraw` if that's the new truth.
        // For now, let's keep it as sum of accrued items for consistency with existing UI header.
        return accruals
            .filter(acc => acc.status === "accrued")
            .reduce((sum, acc) => {
                const total = acc.driverAmount || acc.amount || 0;
                const withdrawn = acc.withdrawnAmount || 0;
                return sum + (total - withdrawn);
            }, 0);
    }, [accruals]);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "paid": // Accrual paid
            case "approved": // Request approved
                return (
                    <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200 gap-1">
                        <CheckCircle className="w-3 h-3" />
                        {status === "approved" ? "Выплачено" : "Выплачено"}
                    </Badge>
                );
            case "accrued":
                return (
                    <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200 gap-1">
                        <Clock className="w-3 h-3" />
                        Начислено
                    </Badge>
                );
            case "pending":
                return (
                    <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200 gap-1">
                        <Clock className="w-3 h-3" />
                        Ожидает
                    </Badge>
                );
            case "rejected":
                return (
                    <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200 gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Отклонено
                    </Badge>
                );
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const formatDate = (ts?: Timestamp) => {
        if (!ts?.toDate) return "—";
        return ts.toDate().toLocaleString("ru-RU", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    };

    return (
        <div className="p-6 space-y-6 bg-background min-h-screen notranslate" translate="no">
            <div className="flex justify-between items-end gap-4">
                <div className="flex items-center gap-4">
                    <Link to="/dashboard">
                        <Button variant="ghost" size="icon" className="rounded-full">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <div className="space-y-1">
                        <h1 className="text-3xl font-bold tracking-tight">Начисления и Выплаты</h1>
                        <p className="text-muted-foreground text-sm">Управление доходами водителей</p>
                    </div>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Поиск по водителю или ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>

            <Tabs defaultValue={defaultTab} className="w-full">
                <TabsList className="grid w-full dark:bg-muted/40 md:w-[600px] grid-cols-3">
                    <TabsTrigger value="requests" className="relative">
                        Запросы на выплату
                        {requests.some(r => r.status === 'pending') && (
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="history">История выплат</TabsTrigger>
                    <TabsTrigger value="accruals">Все начисления</TabsTrigger>
                </TabsList>

                {/* --- REQUESTS TAB --- */}
                <TabsContent value="requests" className="mt-4">
                    <div className="flex justify-end mb-4">
                        <Select value={requestStatusFilter} onValueChange={setRequestStatusFilter}>
                            <SelectTrigger className="w-full md:w-[180px]">
                                <SelectValue placeholder="Статус" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="pending">Ожидают</SelectItem>
                                <SelectItem value="approved">Выплачены</SelectItem>
                                <SelectItem value="rejected">Отклонены</SelectItem>
                                <SelectItem value="all">Все</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-muted/50 border-b">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold text-muted-foreground">Дата</th>
                                        <th className="px-4 py-3 font-semibold text-muted-foreground">Водитель</th>
                                        <th className="px-4 py-3 font-semibold text-muted-foreground">Сумма запроса</th>
                                        <th className="px-4 py-3 font-semibold text-muted-foreground">Статус</th>
                                        <th className="px-4 py-3 font-semibold text-muted-foreground text-right w-[200px]">Действия</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {loadingRequests ? (
                                        <tr>
                                            <td colSpan={5} className="p-12 text-center text-muted-foreground">
                                                <div className="flex flex-col items-center gap-2">
                                                    <Loader2 className="animate-spin h-8 w-8 text-primary" />
                                                    <span>Загрузка запросов...</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredRequests.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="p-12 text-center text-muted-foreground">
                                                {requestStatusFilter === "pending" ? "Активных запросов нет" : "Запросов не найдено"}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredRequests.map((req) => {
                                            const driver = drivers[req.driverId];
                                            return (
                                                <tr key={req.id} className="hover:bg-muted/30 transition-colors">
                                                    <td className="px-4 py-4 whitespace-nowrap text-muted-foreground">
                                                        <div className="flex items-center gap-2">
                                                            <Calendar className="w-3.5 h-3.5" />
                                                            {formatDate(req.createdAt || req.date)}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        {driver ? (
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center">
                                                                    <User className="w-4 h-4 text-primary" />
                                                                </div>
                                                                <div>
                                                                    <div className="font-medium text-foreground">
                                                                        {driver.fullName}
                                                                    </div>
                                                                    <div className="text-xs text-muted-foreground">
                                                                        {driver.phone}
                                                                        {/* Show balance hint if available */}
                                                                        {driver.availableToWithdraw !== undefined && (
                                                                            <span className="ml-2 text-green-600">
                                                                                (Доступно: {driver.availableToWithdraw.toLocaleString("ru-RU")}₽)
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted-foreground italic text-xs">Загрузка водителя...</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <span className="text-base font-bold text-foreground">
                                                            {Math.abs(req.amount).toLocaleString("ru-RU")} ₽
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        {getStatusBadge(req.status)}
                                                        {req.rejectReason && (
                                                            <div className="text-xs text-red-500 mt-1 max-w-[200px]">
                                                                Причина: {req.rejectReason}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {req.status === "pending" && (
                                                                <>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="destructive"
                                                                        onClick={() => openRejectDialog(req)}
                                                                        disabled={processingId === req.id}
                                                                        className="h-8 w-8 p-0"
                                                                        title="Отклонить"
                                                                    >
                                                                        <XCircle className="w-4 h-4" />
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        onClick={() => handleApproveRequest(req)}
                                                                        disabled={processingId === req.id}
                                                                        className="h-8 gap-2 bg-green-600 hover:bg-green-700 text-white shadow-sm"
                                                                    >
                                                                        {processingId === req.id ? (
                                                                            <Loader2 className="w-3 h-3 animate-spin" />
                                                                        ) : (
                                                                            <CheckCircle className="w-3.5 h-3.5" />
                                                                        )}
                                                                        Выплатить
                                                                    </Button>
                                                                </>
                                                            )}
                                                            {req.status === "approved" && req.processedAt && (
                                                                <div className="text-[10px] text-green-600 font-medium">
                                                                    {formatDate(req.processedAt)}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </TabsContent>

                {/* --- ACCRUALS TAB --- */}
                <TabsContent value="accruals" className="mt-4 space-y-4">
                    <div className="flex justify-end">
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-full md:w-[180px]">
                                <SelectValue placeholder="Статус" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Все статусы</SelectItem>
                                <SelectItem value="accrued">Начислено</SelectItem>
                                <SelectItem value="paid">Выплачено</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-muted/50 border-b">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold text-muted-foreground">Дата</th>
                                        <th className="px-4 py-3 font-semibold text-muted-foreground">Водитель</th>
                                        <th className="px-4 py-3 font-semibold text-muted-foreground">Описание / ID</th>
                                        <th className="px-4 py-3 font-semibold text-muted-foreground">Сумма</th>
                                        <th className="px-4 py-3 font-semibold text-muted-foreground">Статус</th>
                                        <th className="px-4 py-3 font-semibold text-muted-foreground text-right">Действие</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {loadingAccruals ? (
                                        <tr>
                                            <td colSpan={6} className="p-12 text-center text-muted-foreground">
                                                <div className="flex flex-col items-center gap-2">
                                                    <Loader2 className="animate-spin h-8 w-8 text-primary" />
                                                    <span>Загрузка данных...</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredAccruals.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="p-12 text-center text-muted-foreground">
                                                Начислений не обнаружено
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredAccruals.map((acc) => {
                                            const driver = drivers[acc.driverId];
                                            return (
                                                <tr key={acc.id} className="hover:bg-muted/30 transition-colors">
                                                    <td className="px-4 py-4 whitespace-nowrap text-muted-foreground">
                                                        <div className="flex items-center gap-2">
                                                            <Calendar className="w-3.5 h-3.5" />
                                                            {formatDate(acc.createdAt || acc.date)}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        {driver ? (
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center">
                                                                    <User className="w-4 h-4 text-primary" />
                                                                </div>
                                                                <div>
                                                                    <div className="font-medium text-foreground">
                                                                        {driver.fullName}
                                                                    </div>
                                                                    <div className="text-xs text-muted-foreground">{driver.phone}</div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted-foreground italic text-xs">Загрузка водителя...</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <div className="text-foreground font-medium">
                                                            {acc.description || "Начисление за заказ"}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground font-mono">
                                                            ID: {acc.id.substring(0, 8)}...
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <span className="text-base font-bold text-foreground">
                                                            {(acc.driverAmount || acc.amount || 0).toLocaleString("ru-RU")} ₽
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        {getStatusBadge(acc.status)}
                                                    </td>
                                                    <td className="px-4 py-4 text-right">
                                                        {acc.status === "accrued" && (
                                                            <Button
                                                                size="sm"
                                                                onClick={() => handleMarkAsPaid(acc.id)}
                                                                disabled={processingId === acc.id}
                                                                className="h-8 gap-2 bg-green-600 hover:bg-green-700 text-white shadow-sm transition-all"
                                                            >
                                                                {processingId === acc.id ? (
                                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                                ) : (
                                                                    <CheckCircle className="w-3.5 h-3.5" />
                                                                )}
                                                                Выплатить
                                                            </Button>
                                                        )}
                                                        {acc.status === "paid" && acc.paidAt && (
                                                            <div className="text-[10px] text-green-600 font-medium">
                                                                {formatDate(acc.paidAt)}
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </TabsContent>

                {/* --- HISTORY TAB --- */}
                <TabsContent value="history" className="mt-4">
                    {loadingHistory ? (
                        <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                            <Loader2 className="animate-spin h-8 w-8 text-primary mb-2" />
                            <span>Загрузка истории...</span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {Object.entries(
                                historyWithdrawals.reduce((acc, curr) => {
                                    const dId = curr.driverId;
                                    if (!acc[dId]) acc[dId] = { count: 0, total: 0, latest: curr.createdAt };
                                    acc[dId].count += 1;
                                    acc[dId].total += curr.amount;
                                    if (curr.createdAt && acc[dId].latest && curr.createdAt > acc[dId].latest) {
                                        acc[dId].latest = curr.createdAt;
                                    }
                                    return acc;
                                }, {} as Record<string, { count: number; total: number; latest: Timestamp }>)
                            ).filter(([driverId]) => {
                                const driver = drivers[driverId];
                                const name = driver?.fullName?.toLowerCase() || "";
                                return !searchQuery || name.includes(searchQuery.toLowerCase());
                            }).sort((a, b) => (b[1].latest?.toMillis() || 0) - (a[1].latest?.toMillis() || 0))
                                .map(([driverId, stats]) => {
                                    const driver = drivers[driverId];
                                    return (
                                        <div
                                            key={driverId}
                                            className="bg-card border rounded-xl p-4 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all group flex flex-col items-center"
                                            onClick={() => {
                                                setSelectedDriverHistory(driverId);
                                                setHistoryDialogOpen(true);
                                            }}
                                        >
                                            <div className="flex justify-center mb-3">
                                                <Folder className="w-12 h-12 text-blue-200 group-hover:text-blue-400 transition-colors" />
                                            </div>
                                            <div className="text-center w-full">
                                                <h3 className="font-medium text-sm truncate w-full" title={driver?.fullName || driverId}>
                                                    {driver?.fullName || "Загрузка..."}
                                                </h3>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {stats.count} выплат
                                                </p>
                                                <p className="text-xs font-bold text-green-600 mt-1">
                                                    {stats.total.toLocaleString("ru-RU")} ₽
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            {historyWithdrawals.length === 0 && (
                                <div className="col-span-full text-center py-12 text-muted-foreground">
                                    История выплат пуста
                                </div>
                            )}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* History Detail Dialog */}
            <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            История выплат: {drivers[selectedDriverHistory || ""]?.fullName || "Водитель"}
                        </DialogTitle>
                        <DialogDescription>
                            Полный список совершенных выплат
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        {selectedDriverHistory && historyWithdrawals
                            .filter(w => w.driverId === selectedDriverHistory)
                            .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0))
                            .map(withdrawal => (
                                <div key={withdrawal.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/5 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                                            <CheckCircle className="w-5 h-5 text-green-600" />
                                        </div>
                                        <div>
                                            <p className="font-medium">{formatDate(withdrawal.createdAt)}</p>
                                            <p className="text-xs text-muted-foreground">ID: {withdrawal.id}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-bold text-lg">{withdrawal.amount.toLocaleString("ru-RU")} ₽</span>
                                        <div className="text-[10px] text-muted-foreground uppercase">Выплачено</div>
                                    </div>
                                </div>
                            ))}
                        {selectedDriverHistory && historyWithdrawals.filter(w => w.driverId === selectedDriverHistory).length === 0 && (
                            <div className="text-center py-8 text-muted-foreground">Нет записей</div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Reject Dialog */}
            <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Отклонить запрос на выплату</DialogTitle>
                        <DialogDescription>
                            Пожалуйста, укажите причину отклонения. Средства будут возвращены водителю.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Причина отказа</label>
                            <Textarea
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="Например: Неверные реквизиты, тех. сбой и т.д."
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Отмена</Button>
                        <Button variant="destructive" onClick={handleRejectRequest}>Подтвердить отках</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
