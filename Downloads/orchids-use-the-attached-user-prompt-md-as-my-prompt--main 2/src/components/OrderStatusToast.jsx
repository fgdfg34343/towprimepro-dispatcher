import { useEffect, useMemo, useState } from 'react';
import { CarFront, CheckCircle2, Loader2, Phone, ShieldCheck, UserRound, X } from 'lucide-react';
import { hasAssignedDriver, subscribeToTowOrder } from '../lib/orderTracking';

function formatDisplayPhone(value) {
  const digits = (value || '').replace(/\D/g, '');

  if (digits.length !== 11) {
    return value;
  }

  return `+${digits[0]} ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9, 11)}`;
}

export default function OrderStatusToast({ orderId, onClear }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(Boolean(orderId));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!orderId) {
      setOrder(null);
      setLoading(false);
      setError('');
      return undefined;
    }

    setLoading(true);
    setError('');

    return subscribeToTowOrder(
      orderId,
      (nextOrder) => {
        setOrder(nextOrder);
        setLoading(false);
      },
      () => {
        setLoading(false);
        setError('Статус заявки временно недоступен.');
      }
    );
  }, [orderId]);

  useEffect(() => {
    if (!order) {
      return;
    }

    if (['completed', 'cancelled'].includes(order.status)) {
      onClear?.();
    }
  }, [order, onClear]);

  const driverAssigned = useMemo(() => hasAssignedDriver(order), [order]);

  if (!orderId || (!loading && !order && !error)) {
    return null;
  }

  return (
    <div className="fixed inset-x-4 bottom-4 z-40 sm:inset-x-auto sm:right-4 sm:w-[420px]">
      <div
        className={`rounded-3xl border p-5 shadow-2xl backdrop-blur-xl ${
          driverAssigned
            ? 'border-emerald-200 bg-white/95'
            : 'border-orange-200 bg-white/92'
        }`}
        style={{ boxShadow: '0 24px 70px rgba(15,23,42,0.18)' }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                driverAssigned ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-500'
              }`}
            >
              {driverAssigned ? <CheckCircle2 size={24} /> : <Loader2 size={22} className="animate-spin" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500">Заказ #{order?.code || orderId.slice(-6).toUpperCase()}</p>
              <h4 className="text-lg font-black text-slate-900">
                {driverAssigned ? 'Водитель принял вашу заявку' : 'Подбираем ближайшего водителя'}
              </h4>
              <p className="mt-1 text-sm text-slate-500">
                {driverAssigned
                  ? 'Диспетчер назначил экипаж. Проверьте данные ниже.'
                  : 'Как только диспетчер назначит водителя, карточка обновится автоматически.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Скрыть уведомление"
          >
            <X size={18} />
          </button>
        </div>

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

        {order?.pickupAddress && (
          <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Подача: <span className="font-semibold text-slate-800">{order.pickupAddress}</span>
          </div>
        )}

        {driverAssigned && order ? (
          <div className="mt-4 space-y-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
            <div className="flex items-center gap-3 text-slate-700">
              <UserRound size={18} className="text-emerald-600" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Водитель</p>
                <p className="text-sm font-bold text-slate-900">{order.driverName || 'Экипаж подтверждён'}</p>
              </div>
            </div>

            {(order.driverVehicleType || order.truckType) && (
              <div className="flex items-center gap-3 text-slate-700">
                <CarFront size={18} className="text-emerald-600" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Техника</p>
                  <p className="text-sm font-bold text-slate-900">{order.driverVehicleType || order.truckType}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 text-slate-700">
              <ShieldCheck size={18} className="text-emerald-600" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Статус</p>
                <p className="text-sm font-bold text-slate-900">{order.statusLabel}</p>
              </div>
            </div>

            {order.driverPhone && (
              <a
                href={`tel:${order.driverPhone}`}
                className="btn-orange flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-white"
              >
                <Phone size={16} />
                {formatDisplayPhone(order.driverPhone)}
              </a>
            )}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-orange-100 bg-orange-50/80 p-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">Заявка уже в диспетчерской.</p>
            <p className="mt-1">
              Диспетчер назначит свободного водителя, а сайт сразу покажет имя, телефон и статус экипажа.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
