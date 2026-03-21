import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/firebaseConfig";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import type { AssignDriverPayload } from "@/hooks/useOrders";
import type { DriverDirectoryEntry } from "@/hooks/useDriverDirectory";

const PRICING_BASE_FARE = 1500;
const PRICING_PER_KM = 65;
const PRICING_INCLUDED_KM = 5;
const PRICING_MINIMUM = 1500;
const DISTANCE_DEBOUNCE_MS = 600;
const ADDRESS_AUTOCOMPLETE_DEBOUNCE_MS = 250;
const ADDRESS_SUGGESTION_LIMIT = 6;
const ADDRESS_MIN_LENGTH = 3;

const CURRENCY_FORMATTER = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

interface DistanceMatrixElementResponse {
  status: string;
  distance?: { text: string; value: number };
  duration?: { text: string; value: number };
}

interface DistanceMatrixResponse {
  status: string;
  error_message?: string;
  origin_addresses?: string[];
  destination_addresses?: string[];
  rows?: Array<{
    elements?: DistanceMatrixElementResponse[];
  }>;
}

interface DistanceInfo {
  distanceMeters: number;
  distanceText: string;
  durationSeconds: number;
  durationText: string;
  originAddress: string;
  destinationAddress: string;
}

interface AddressSuggestion {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

type AddressFieldKey = "pickup" | "dropoff";

function sanitizeNumericInput(value: string): string {
  return value.replace(/\s/g, "").replace(",", ".");
}

function calculateFare(distanceMeters: number): number {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) {
    return PRICING_MINIMUM;
  }

  const distanceKm = distanceMeters / 1000;
  const billableKm = Math.max(0, distanceKm - PRICING_INCLUDED_KM);
  const rawAmount = PRICING_BASE_FARE + billableKm * PRICING_PER_KM;
  const clamped = Math.max(PRICING_MINIMUM, rawAmount);

  return Math.ceil(clamped / 10) * 10;
}

const orderSchema = z.object({
  clientName: z.string().trim().min(1, "Укажите имя клиента"),
  clientPhone: z
    .string()
    .trim()
    .optional()
    .transform((value) => value ?? ""),
  pickupAddress: z.string().trim().min(1, "Укажите адрес подачи"),
  dropoffAddress: z.string().trim().min(1, "Укажите адрес назначения"),
  vehicleType: z.string().trim().min(1, "Укажите тип/модель ТС"),
  notes: z
    .string()
    .optional()
    .transform((value) => value?.trim() ?? ""),
  driverId: z
    .string()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : "")),
  estimatedCost: z
    .string()
    .trim()
    .min(1, "Укажите стоимость")
    .transform((value) => sanitizeNumericInput(value))
    .refine((value) => {
      const numeric = Number(value);
      return Number.isFinite(numeric) && numeric > 0;
    }, "Некорректная сумма"),
});

type OrderFormValues = z.infer<typeof orderSchema>;

interface CreateOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drivers: DriverDirectoryEntry[];
  onAssignDriver: (payload: AssignDriverPayload) => Promise<void>;
}

const DEFAULT_VALUES: OrderFormValues = {
  clientName: "",
  clientPhone: "",
  pickupAddress: "",
  dropoffAddress: "",
  vehicleType: "",
  notes: "",
  driverId: "",
  estimatedCost: "",
};

const DRIVER_NONE_VALUE = "__driver_none__";

function generateOrderCode(): string {
  const timestampPart = Date.now().toString(36).toUpperCase();
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${timestampPart}-${randomPart}`;
}

export function CreateOrderDialog({
  open,
  onOpenChange,
  drivers,
  onAssignDriver,
}: CreateOrderDialogProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [distanceInfo, setDistanceInfo] = useState<DistanceInfo | null>(null);
  const [distanceError, setDistanceError] = useState<string | null>(null);
  const [distanceLoading, setDistanceLoading] = useState(false);
  const [pickupSuggestions, setPickupSuggestions] = useState<AddressSuggestion[]>([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState<AddressSuggestion[]>([]);
  const [activeAddressField, setActiveAddressField] = useState<AddressFieldKey | null>(null);
  const costManuallyEditedRef = useRef(false);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const previousAddressesRef = useRef<{ pickup: string; dropoff: string }>({
    pickup: "",
    dropoff: "",
  });

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const pickupAddressValue = form.watch("pickupAddress");
  const dropoffAddressValue = form.watch("dropoffAddress");
  const costValueRaw = form.watch("estimatedCost");
  const clientNameValue = form.watch("clientName");
  const vehicleTypeValue = form.watch("vehicleType");

  const getAutocompleteService = useCallback(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const placesApi = window.google?.maps?.places;
    if (!placesApi?.AutocompleteService) {
      return null;
    }

    if (!autocompleteServiceRef.current) {
      autocompleteServiceRef.current = new placesApi.AutocompleteService();
    }

    return autocompleteServiceRef.current;
  }, []);

  const selectAddressSuggestion = useCallback(
    (field: AddressFieldKey, suggestion: AddressSuggestion) => {
      const fieldName = field === "pickup" ? "pickupAddress" : "dropoffAddress";
      form.setValue(fieldName, suggestion.description, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      setActiveAddressField(null);
      if (field === "pickup") {
        setPickupSuggestions([]);
      } else {
        setDropoffSuggestions([]);
      }
    },
    [form],
  );

  useEffect(() => {
    if (!open || activeAddressField !== "pickup") {
      setPickupSuggestions([]);
      return;
    }

    const query = pickupAddressValue.trim();
    const service = getAutocompleteService();
    if (!service || query.length < ADDRESS_MIN_LENGTH) {
      setPickupSuggestions([]);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      service.getPlacePredictions(
        {
          input: query,
          componentRestrictions: { country: "ru" },
          types: ["address"],
        },
        (predictions, status) => {
          if (cancelled) {
            return;
          }

          if (
            status !== google.maps.places.PlacesServiceStatus.OK ||
            !predictions?.length
          ) {
            setPickupSuggestions([]);
            return;
          }

          setPickupSuggestions(
            predictions.slice(0, ADDRESS_SUGGESTION_LIMIT).map((prediction) => ({
              placeId: prediction.place_id,
              description: prediction.description,
              mainText: prediction.structured_formatting.main_text,
              secondaryText: prediction.structured_formatting.secondary_text,
            })),
          );
        },
      );
    }, ADDRESS_AUTOCOMPLETE_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [activeAddressField, getAutocompleteService, open, pickupAddressValue]);

  useEffect(() => {
    if (!open || activeAddressField !== "dropoff") {
      setDropoffSuggestions([]);
      return;
    }

    const query = dropoffAddressValue.trim();
    const service = getAutocompleteService();
    if (!service || query.length < ADDRESS_MIN_LENGTH) {
      setDropoffSuggestions([]);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      service.getPlacePredictions(
        {
          input: query,
          componentRestrictions: { country: "ru" },
          types: ["address"],
        },
        (predictions, status) => {
          if (cancelled) {
            return;
          }

          if (
            status !== google.maps.places.PlacesServiceStatus.OK ||
            !predictions?.length
          ) {
            setDropoffSuggestions([]);
            return;
          }

          setDropoffSuggestions(
            predictions.slice(0, ADDRESS_SUGGESTION_LIMIT).map((prediction) => ({
              placeId: prediction.place_id,
              description: prediction.description,
              mainText: prediction.structured_formatting.main_text,
              secondaryText: prediction.structured_formatting.secondary_text,
            })),
          );
        },
      );
    }, ADDRESS_AUTOCOMPLETE_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [activeAddressField, getAutocompleteService, open, dropoffAddressValue]);

  const requiredFieldsFilled =
    clientNameValue.trim().length > 0 &&
    pickupAddressValue.trim().length > 0 &&
    dropoffAddressValue.trim().length > 0 &&
    vehicleTypeValue.trim().length > 0;

  const numericCostValue = Number(costValueRaw);
  const costIsValid = Number.isFinite(numericCostValue) && numericCostValue > 0;
  const formattedCost = costIsValid
    ? CURRENCY_FORMATTER.format(Math.round(numericCostValue))
    : "—";

  const isSubmitDisabled = submitting || !requiredFieldsFilled || !costIsValid;

  useEffect(() => {
    if (!open) {
      form.reset(DEFAULT_VALUES);
      setDistanceInfo(null);
      setDistanceError(null);
      setDistanceLoading(false);
      costManuallyEditedRef.current = false;
      previousAddressesRef.current = { pickup: "", dropoff: "" };
    }
  }, [open, form]);

  useEffect(() => {
    const origin = pickupAddressValue.trim();
    const destination = dropoffAddressValue.trim();
    const prev = previousAddressesRef.current;
    const addressesChanged = origin !== prev.pickup || destination !== prev.dropoff;

    if (addressesChanged) {
      costManuallyEditedRef.current = false;
      previousAddressesRef.current = { pickup: origin, dropoff: destination };
    }

    if (origin.length < 3 || destination.length < 3) {
      setDistanceInfo(null);
      setDistanceError(null);
      setDistanceLoading(false);
      if (!origin && !destination) {
        form.setValue("estimatedCost", "", { shouldValidate: false, shouldTouch: false });
      }
      return;
    }

    let cancelled = false;
    const abortController = new AbortController();

    setDistanceLoading(true);
    setDistanceError(null);

    const fetchDistance = async () => {
      try {
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
          throw new Error("Google Maps API key не настроен");
        }

        const params = new URLSearchParams({
          origins: origin,
          destinations: destination,
          key: apiKey,
          language: "ru",
          region: "ru",
          units: "metric",
        });

        const response = await fetch(
          `https://maps.googleapis.com/maps/api/distancematrix/json?${params.toString()}`,
          { signal: abortController.signal },
        );

        if (!response.ok) {
          throw new Error(`Google API error (${response.status})`);
        }

        const data: DistanceMatrixResponse = await response.json();
        if (cancelled) {
          return;
        }

        if (data.status !== "OK") {
          throw new Error(data.error_message ?? data.status ?? "Не удалось получить расстояние");
        }

        const element = data.rows?.[0]?.elements?.[0];
        if (
          !element ||
          element.status !== "OK" ||
          !element.distance ||
          !element.duration
        ) {
          throw new Error("Маршрут не найден для указанных адресов");
        }

        const info: DistanceInfo = {
          distanceMeters: element.distance.value,
          distanceText: element.distance.text,
          durationSeconds: element.duration.value,
          durationText: element.duration.text,
          originAddress: data.origin_addresses?.[0] ?? origin,
          destinationAddress: data.destination_addresses?.[0] ?? destination,
        };

        setDistanceInfo(info);
        const autoFare = calculateFare(info.distanceMeters);
        const currentCost = form.getValues("estimatedCost");
        if (!costManuallyEditedRef.current || !currentCost) {
          form.setValue("estimatedCost", autoFare.toString(), { shouldValidate: true });
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        console.error("[orders:create] Distance calculation failed", error);
        setDistanceInfo(null);
        setDistanceError("Не удалось рассчитать маршрут. Проверьте адреса и попробуйте снова.");
      } finally {
        if (!cancelled) {
          setDistanceLoading(false);
        }
      }
    };

    const timeoutId = setTimeout(fetchDistance, DISTANCE_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [pickupAddressValue, dropoffAddressValue, form]);

  const availableDrivers = useMemo(() => {
    return drivers.slice().sort((a, b) => {
      const statusWeight = (status: string) => {
        if (status === "online") return 0;
        if (status === "busy") return 1;
        return 2;
      };

      const diff = statusWeight(a.status) - statusWeight(b.status);
      if (diff !== 0) return diff;
      return a.fullName.localeCompare(b.fullName, "ru", { sensitivity: "base" });
    });
  }, [drivers]);

  const handleSubmit = async (values: OrderFormValues) => {
    setSubmitting(true);
    try {
      const trimmedNotes = values.notes?.trim() ?? "";
      const amount = Math.round(Number(values.estimatedCost));
      const selectedDriver = values.driverId
        ? availableDrivers.find((driver) => driver.id === values.driverId)
        : undefined;
      const driverAssignmentId = selectedDriver
        ? (selectedDriver.authUid?.trim() || selectedDriver.id)
        : null;

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Некорректная стоимость заказа");
      }

      const pricingSource = costManuallyEditedRef.current ? "manual" : "auto";

      const metadata: Record<string, unknown> = {
        createdBy: "dispatcher",
        source: "dispatcher-console",
        pricingSource,
      };

      metadata.assignment = {
        source: driverAssignmentId ? "dispatcher-manual" : "unassigned",
        assignedAutomatically: false,
        driverId: driverAssignmentId,
        driverDocId: selectedDriver?.id ?? null,
      };

      if (distanceInfo) {
        metadata.distanceCalculation = {
          origin: distanceInfo.originAddress,
          destination: distanceInfo.destinationAddress,
          distanceText: distanceInfo.distanceText,
          distanceMeters: distanceInfo.distanceMeters,
          durationSeconds: distanceInfo.durationSeconds,
          durationText: distanceInfo.durationText,
        };
      }

      const pricingPayload: Record<string, unknown> = {
        amount,
        currency: "RUB",
        source: pricingSource,
        baseFare: PRICING_BASE_FARE,
        perKmRate: PRICING_PER_KM,
        includedDistanceKm: PRICING_INCLUDED_KM,
        minimumFare: PRICING_MINIMUM,
        calculatedAt: serverTimestamp(),
      };

      if (distanceInfo) {
        pricingPayload.distanceMeters = distanceInfo.distanceMeters;
        pricingPayload.distanceText = distanceInfo.distanceText;
        pricingPayload.durationSeconds = distanceInfo.durationSeconds;
        pricingPayload.durationText = distanceInfo.durationText;
      }

      const payload: Record<string, unknown> = {
        code: generateOrderCode(),
        clientName: values.clientName.trim(),
        clientPhone: values.clientPhone.trim(),
        pickupAddress: values.pickupAddress.trim(),
        dropoffAddress: values.dropoffAddress.trim(),
        vehicleType: values.vehicleType.trim(),
        notes: trimmedNotes.length > 0 ? trimmedNotes : null,
        status: driverAssignmentId ? "assigned" : "new",
        priority: false,
        assignedAutomatically: false,
        assignmentSource: driverAssignmentId ? "dispatcher-manual" : "unassigned",
        driverId: driverAssignmentId,
        assignedDriverId: driverAssignmentId,
        driverName: selectedDriver ? (selectedDriver.fullName || "Водитель").trim() : null,
        assignedDriverName: selectedDriver ? (selectedDriver.fullName || "Водитель").trim() : null,
        driverPhone: selectedDriver?.phoneNumber ?? null,
        assignedDriverPhone: selectedDriver?.phoneNumber ?? null,
        driverVehicleType: selectedDriver?.vehicleType ?? null,
        assignedDriverVehicleType: selectedDriver?.vehicleType ?? null,
        metadata,
        pricing: pricingPayload,
        estimatedCost: amount,
        totalAmount: amount,
        createdAt: serverTimestamp(),
      };

      if (distanceInfo) {
        payload.route = {
          originAddress: distanceInfo.originAddress,
          destinationAddress: distanceInfo.destinationAddress,
          distanceMeters: distanceInfo.distanceMeters,
          distanceText: distanceInfo.distanceText,
          durationSeconds: distanceInfo.durationSeconds,
          durationText: distanceInfo.durationText,
        };
      }

      const ordersRef = collection(db, "orders");
      const docRef = await addDoc(ordersRef, payload);

      if (selectedDriver && driverAssignmentId) {
        const fallbackName = [selectedDriver.firstName, selectedDriver.lastName]
          .filter(Boolean)
          .join(" ")
          .trim();
        const driverName = (selectedDriver.fullName || fallbackName || "Водитель").trim();

        await onAssignDriver({
          orderId: docRef.id,
          driverId: driverAssignmentId,
          driverName,
          driverPhone: selectedDriver.phoneNumber,
          vehicleType: selectedDriver.vehicleType,
          keepStatus: true,
          autoAssigned: false,
        });
      }

      toast({
        title: "Заявка создана",
        description: selectedDriver
          ? "Заявка создана и водитель назначен."
          : "Заявка создана. Вы можете назначить водителя позже.",
      });

      form.reset(DEFAULT_VALUES);
      setDistanceInfo(null);
      setDistanceError(null);
      costManuallyEditedRef.current = false;
      previousAddressesRef.current = { pickup: "", dropoff: "" };
      onOpenChange(false);
    } catch (error) {
      console.error("[orders:create] Failed to create order", error);
      toast({
        variant: "destructive",
        title: "Не удалось создать заявку",
        description: "Проверьте соединение и попробуйте ещё раз.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] w-full max-w-3xl overflow-y-auto border border-border bg-white px-8 py-6 text-slate-900 shadow-2xl shadow-primary/10 sm:rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Новая заявка</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Заполните детали заказа. Стоимость будет рассчитана автоматически по маршруту, вы можете скорректировать её вручную.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className="space-y-8" onSubmit={form.handleSubmit(handleSubmit)}>
            <section className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                👤 Клиент
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="clientName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Имя клиента</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Например, Иван Петров"
                          className="border-border bg-slate-100 text-slate-900 placeholder:text-slate-400"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="clientPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Телефон клиента</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="+7 (___) ___-__-__"
                          className="border-border bg-slate-100 text-slate-900 placeholder:text-slate-400"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                📍 Местоположение
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="pickupAddress"
                  render={({ field }) => (
                    <FormItem className="relative">
                      <FormLabel>Откуда забрать</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Адрес подачи"
                          className="border-border bg-slate-100 text-slate-900 placeholder:text-slate-400"
                          {...field}
                          onFocus={() => setActiveAddressField("pickup")}
                          onBlur={() => {
                            window.setTimeout(() => {
                              setActiveAddressField((current) =>
                                current === "pickup" ? null : current,
                              );
                            }, 150);
                          }}
                        />
                      </FormControl>
                      {activeAddressField === "pickup" && pickupSuggestions.length > 0 && (
                        <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-border bg-white shadow-xl">
                          {pickupSuggestions.map((suggestion) => (
                            <button
                              key={suggestion.placeId}
                              type="button"
                              className="flex w-full flex-col items-start gap-0.5 border-b border-border/60 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-orange-50"
                              onMouseDown={(event) => {
                                event.preventDefault();
                                selectAddressSuggestion("pickup", suggestion);
                              }}
                            >
                              <span className="font-medium text-slate-900">
                                {suggestion.mainText}
                              </span>
                              <span className="text-xs text-slate-500">
                                {suggestion.secondaryText || suggestion.description}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dropoffAddress"
                  render={({ field }) => (
                    <FormItem className="relative">
                      <FormLabel>Куда доставить</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Адрес назначения"
                          className="border-border bg-slate-100 text-slate-900 placeholder:text-slate-400"
                          {...field}
                          onFocus={() => setActiveAddressField("dropoff")}
                          onBlur={() => {
                            window.setTimeout(() => {
                              setActiveAddressField((current) =>
                                current === "dropoff" ? null : current,
                              );
                            }, 150);
                          }}
                        />
                      </FormControl>
                      {activeAddressField === "dropoff" && dropoffSuggestions.length > 0 && (
                        <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-border bg-white shadow-xl">
                          {dropoffSuggestions.map((suggestion) => (
                            <button
                              key={suggestion.placeId}
                              type="button"
                              className="flex w-full flex-col items-start gap-0.5 border-b border-border/60 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-orange-50"
                              onMouseDown={(event) => {
                                event.preventDefault();
                                selectAddressSuggestion("dropoff", suggestion);
                              }}
                            >
                              <span className="font-medium text-slate-900">
                                {suggestion.mainText}
                              </span>
                              <span className="text-xs text-slate-500">
                                {suggestion.secondaryText || suggestion.description}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                🚘 Данные автомобиля
              </h3>
              <FormField
                control={form.control}
                name="vehicleType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Тип / модель автомобиля</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Например, Toyota Camry, эвакуатор 5т"
                        className="border-border bg-slate-100 text-slate-900 placeholder:text-slate-400"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Комментарии</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Дополнительная информация для водителя или диспетчера"
                        rows={4}
                        className="border-border bg-slate-100 text-slate-900 placeholder:text-slate-400"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            <section className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                👨‍🔧 Водитель
              </h3>
              <FormField
                control={form.control}
                name="driverId"
                render={({ field }) => {
                  const selectValue =
                    field.value && field.value.length > 0 ? field.value : DRIVER_NONE_VALUE;

                  return (
                    <FormItem>
                      <FormLabel>Назначить водителя</FormLabel>
                      <Select
                        value={selectValue}
                        onValueChange={(nextValue) => {
                          field.onChange(nextValue === DRIVER_NONE_VALUE ? "" : nextValue);
                        }}
                      >
                        <FormControl>
                          <SelectTrigger className="border-border bg-slate-100 text-slate-900">
                            <SelectValue placeholder="Выберите водителя (необязательно)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={DRIVER_NONE_VALUE}>Без назначения</SelectItem>
                          {availableDrivers.map((driver) => {
                            const fallbackName = [driver.firstName, driver.lastName]
                              .filter(Boolean)
                              .join(" ")
                              .trim();
                            const label = (driver.fullName || fallbackName || `Водитель ${driver.id}`).trim();
                            const statusLabel =
                              driver.status === "online"
                                ? "Онлайн"
                                : driver.status === "busy"
                                  ? "Занят"
                                  : "Оффлайн";

                            return (
                              <SelectItem key={driver.id} value={driver.id}>
                                {label} • {statusLabel}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            </section>

            <section className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                💰 Стоимость
              </h3>

              <div className="rounded-xl border border-border bg-slate-50 p-4 text-sm text-slate-700">
                {distanceLoading ? (
                  <p>Рассчитываем маршрут...</p>
                ) : distanceInfo ? (
                  <div className="space-y-1">
                    <p>
                      <span className="font-semibold">Дистанция:</span> {distanceInfo.distanceText}
                    </p>
                    <p>
                      <span className="font-semibold">Время в пути:</span> {distanceInfo.durationText}
                    </p>
                    <p>
                      <span className="font-semibold">Предварительная стоимость:</span> {formattedCost}
                    </p>
                  </div>
                ) : (
                  <p>Введите адреса подачи и назначения, чтобы рассчитать стоимость автоматически.</p>
                )}

                {distanceError && (
                  <p className="mt-2 text-sm text-destructive">{distanceError}</p>
                )}
              </div>

              <FormField
                control={form.control}
                name="estimatedCost"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Стоимость для клиента, ₽</FormLabel>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (!distanceInfo) {
                            return;
                          }
                          costManuallyEditedRef.current = false;
                          const autoAmount = calculateFare(distanceInfo.distanceMeters);
                          form.setValue("estimatedCost", autoAmount.toString(), { shouldValidate: true });
                        }}
                        disabled={!distanceInfo}
                      >
                        Пересчитать автоматически
                      </Button>
                    </div>
                    <FormControl>
                      <Input
                        inputMode="numeric"
                        placeholder="Например, 2500"
                        className="border-border bg-slate-100 text-slate-900 placeholder:text-slate-400"
                        {...field}
                        onChange={(event) => {
                          costManuallyEditedRef.current = true;
                          field.onChange(event.target.value);
                        }}
                      />
                    </FormControl>
                    <p className="text-sm text-muted-foreground">
                      Текущая сумма: {formattedCost}
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Отмена
              </Button>
              <Button type="submit" className="shadow-glow" disabled={isSubmitDisabled}>
                {submitting ? "Создание..." : "Создать заявку"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default CreateOrderDialog;
