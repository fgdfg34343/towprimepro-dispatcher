import { useEffect, useState } from 'react';
import { X, Phone, User, MessageSquare, CheckCircle, Loader2, ChevronRight, CarFront, ShieldCheck, CreditCard, Banknote } from 'lucide-react';
import { submitTowOrder } from '../lib/orderSubmission';
import { hasAssignedDriver, subscribeToTowOrder } from '../lib/orderTracking';

const CAR_LABELS = {
  sedan: 'Легковая', crossover: 'Кроссовер', suv: 'Внедорожник',
  minivan: 'Микроавтобус', moto: 'Мотоцикл', other: 'Другое'
};
const TRUCK_LABELS = {
  broken: 'Ломаная платформа', sliding: 'Сдвижная платформа', manipulator: 'Манипулятор'
};
const PAYMENT_LABELS = {
  cash: '💵 Наличные',
  card: '💳 Безналичный (СБП)',
};

function formatDisplayPhone(value) {
  const digits = (value || '').replace(/\D/g, '');

  if (digits.length !== 11) {
    return value;
  }

  return `+${digits[0]} ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9, 11)}`;
}

export default function BookingModal({ orderData, onClose, onTrackOrder }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [trackingError, setTrackingError] = useState('');
  const [submittedOrderId, setSubmittedOrderId] = useState(null);
  const [liveOrder, setLiveOrder] = useState(null);

  useEffect(() => {
    if (!submittedOrderId) {
      return undefined;
    }

    return subscribeToTowOrder(
      submittedOrderId,
      (nextOrder) => {
        setLiveOrder(nextOrder);
        setTrackingError('');
      },
      () => {
        setTrackingError('Статус экипажа обновится чуть позже. Заявка уже принята диспетчерской.');
      }
    );
  }, [submittedOrderId]);

  const validate = () => {
    const e = {};
    if (!name.trim() || name.trim().length < 2) e.name = 'Введите ваше имя';
    if (!/^\+7\d{10}$/.test(phone.trim())) e.phone = 'Введите номер в формате +79993184848';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSubmitError('');
    setTrackingError('');
    setSubmitting(true);
    try {
      const result = await submitTowOrder({ orderData, name, phone, comment });
      setSubmittedOrderId(result.orderId);
      onTrackOrder?.(result.orderId);
      setSuccess(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Не удалось отправить заявку.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatPhone = (v) => {
    const digits = v.replace(/\D/g, '');

    if (!digits) return '+7';

    let normalized = digits;
    if (normalized.startsWith('8')) normalized = `7${normalized.slice(1)}`;
    if (!normalized.startsWith('7')) normalized = `7${normalized}`;

    return `+${normalized.slice(0, 11)}`;
  };

  const driverAssigned = hasAssignedDriver(liveOrder);
  const orderPrice = liveOrder?.priceEstimate ?? orderData?.price ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}/>

      {/* Modal */}
      <div className="relative bg-white rounded-3xl w-full max-w-md overflow-hidden animate-scale-in"
        style={{boxShadow: '0 30px 100px rgba(15,23,42,0.3)'}}>

        {success ? (
          <div className="p-8 text-center">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 ${driverAssigned ? 'bg-emerald-100' : 'bg-green-100'}`}>
              {driverAssigned ? (
                <ShieldCheck size={40} className="text-emerald-500"/>
              ) : (
                <CheckCircle size={40} className="text-green-500"/>
              )}
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">
              {driverAssigned ? 'Водитель уже назначен' : 'Заявка принята!'}
            </h3>
            <p className="text-slate-500 mb-6">
              {driverAssigned
                ? 'Экипаж подтвердил заявку. Ниже данные водителя, который едет за вашим автомобилем.'
                : 'Диспетчер получил заявку. Как только водитель подтвердит выезд, сайт покажет его данные автоматически.'}
            </p>

            {/* СБП QR block */}
            {orderData?.paymentMethod === 'card' && (
              <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50/60 p-5 text-left">
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard size={18} className="text-blue-600"/>
                  <p className="font-bold text-slate-900 text-sm">Оплата через СБП</p>
                  <span className="ml-auto text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">Скоро</span>
                </div>
                <div className="flex justify-center mb-3">
                  <div className="bg-white rounded-xl p-3 shadow-sm border border-blue-100">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=TowPrime-Order-${submittedOrderId || 'NEW'}&color=0f172a&bgcolor=ffffff`}
                      alt="QR СБП"
                      className="w-40 h-40 rounded-lg"
                    />
                  </div>
                </div>
                {orderData?.price && (
                  <p className="text-center text-2xl font-black text-slate-900 mb-1">
                    {orderData.price.toLocaleString('ru-RU')} ₽
                  </p>
                )}
                <p className="text-center text-xs text-slate-500 mb-3">
                  QR-код для оплаты по СБП
                </p>
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-800 leading-relaxed">
                  ⚠️ Онлайн-оплата в процессе подключения. Оператор свяжется с вами и отправит ссылку на оплату в WhatsApp или SMS.
                </div>
              </div>
            )}
            {orderPrice && (
              <div className="bg-orange-50 rounded-2xl p-4 mb-6">
                <p className="text-sm text-slate-500">
                  {driverAssigned ? 'Подтверждённая стоимость' : 'Предварительная стоимость'}
                </p>
                <p className="text-3xl font-black text-orange-500">{orderPrice.toLocaleString('ru-RU')} ₽</p>
              </div>
            )}

            {submittedOrderId && (
              <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Номер заявки</p>
                <p className="text-base font-bold text-slate-900">#{liveOrder?.code || submittedOrderId.slice(-6).toUpperCase()}</p>
              </div>
            )}

            {driverAssigned && liveOrder ? (
              <div className="mb-6 rounded-3xl border border-emerald-100 bg-emerald-50/80 p-5 text-left space-y-4">
                <div className="flex items-center gap-3">
                  <User size={18} className="text-emerald-600"/>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Водитель</p>
                    <p className="text-base font-bold text-slate-900">{liveOrder.driverName || 'Экипаж подтверждён'}</p>
                  </div>
                </div>

                {(liveOrder.driverVehicleType || liveOrder.truckType) && (
                  <div className="flex items-center gap-3">
                    <CarFront size={18} className="text-emerald-600"/>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Техника</p>
                      <p className="text-base font-bold text-slate-900">{liveOrder.driverVehicleType || liveOrder.truckType}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <ShieldCheck size={18} className="text-emerald-600"/>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Статус</p>
                    <p className="text-base font-bold text-slate-900">{liveOrder.statusLabel}</p>
                  </div>
                </div>

                {liveOrder.driverPhone && (
                  <a
                    href={`tel:${liveOrder.driverPhone}`}
                    className="btn-orange w-full py-4 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg"
                  >
                    <Phone size={18}/> {formatDisplayPhone(liveOrder.driverPhone)}
                  </a>
                )}
              </div>
            ) : (
              <div className="mb-6 rounded-3xl border border-orange-100 bg-orange-50/80 p-5 text-left">
                <div className="flex items-center gap-3 mb-2">
                  <Loader2 size={18} className="text-orange-500 animate-spin"/>
                  <p className="text-base font-bold text-slate-900">Подбираем ближайшего водителя</p>
                </div>
                <p className="text-sm text-slate-500">
                  Оставьте это окно открытым или просто оставайтесь на сайте. Как только диспетчер назначит экипаж,
                  мы сразу покажем имя, телефон и статус водителя.
                </p>
              </div>
            )}

            {trackingError && <p className="text-xs text-red-500 mb-4">{trackingError}</p>}

            <p className="text-sm text-slate-400 mb-6">
              {driverAssigned ? 'Если нужно, свяжитесь с нами напрямую:' : 'Или позвоните нам прямо сейчас:'}
            </p>
            <a href="tel:+79777349128"
              className="btn-orange w-full py-4 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg">
              <Phone size={18}/> +7 977 734 91 28
            </a>
            <button onClick={onClose} className="mt-3 text-slate-400 text-sm hover:text-slate-600 transition-colors w-full py-2">Закрыть</button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-5 flex items-center justify-between">
              <div>
                <h3 className="text-white font-bold text-lg">Оформить вызов</h3>
                <p className="text-slate-400 text-sm">Диспетчер перезвонит через 2 мин</p>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-xl hover:bg-white/10">
                <X size={20}/>
              </button>
            </div>

            {/* Order summary */}
            {orderData?.from && (
              <div className="mx-5 mt-5 bg-slate-50 rounded-2xl p-4 text-sm space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Откуда:</span>
                  <span className="text-slate-800 font-medium text-right max-w-[60%] truncate">{orderData.from}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Куда:</span>
                  <span className="text-slate-800 font-medium text-right max-w-[60%] truncate">{orderData.to}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Авто:</span>
                  <span className="text-slate-800 font-medium">{CAR_LABELS[orderData.carType]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Эвакуатор:</span>
                  <span className="text-slate-800 font-medium">{TRUCK_LABELS[orderData.truckType]}</span>
                </div>
                {orderData.paymentMethod && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Оплата:</span>
                    <span className="text-slate-800 font-medium">{PAYMENT_LABELS[orderData.paymentMethod] || orderData.paymentMethod}</span>
                  </div>
                )}
                {orderData.price && (
                  <div className="flex justify-between pt-1.5 border-t border-slate-200">
                    <span className="text-slate-700 font-semibold">Итого:</span>
                    <span className="text-orange-500 font-black text-lg">{orderData.price.toLocaleString('ru-RU')} ₽</span>
                  </div>
                )}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-orange-500" size={17}/>
                  <input
                    type="text"
                    placeholder="Ваше имя"
                    value={name}
                    onChange={e => { setName(e.target.value); setErrors(p => ({...p, name: ''})); }}
                    className={`input-field w-full pl-10 pr-4 py-3 rounded-xl text-sm font-medium placeholder-slate-400 ${errors.name ? 'border-red-400' : ''}`}
                  />
                </div>
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
              </div>

              <div>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-orange-500" size={17}/>
                  <input
                    type="tel"
                    placeholder="+79993184848"
                    value={phone}
                    onChange={e => { setPhone(formatPhone(e.target.value)); setErrors(p => ({...p, phone: ''})); }}
                    required
                    inputMode="numeric"
                    className={`input-field w-full pl-10 pr-4 py-3 rounded-xl text-sm font-medium placeholder-slate-400 ${errors.phone ? 'border-red-400' : ''}`}
                  />
                </div>
                {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
              </div>

              <div className="relative">
                <MessageSquare className="absolute left-3.5 top-3.5 text-orange-500" size={17}/>
                <textarea
                  placeholder="Комментарий (необязательно)"
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  rows={2}
                  className="input-field w-full pl-10 pr-4 py-3 rounded-xl text-sm font-medium placeholder-slate-400 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn-orange w-full py-4 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2.5 shadow-lg"
              >
                {submitting ? (
                  <><Loader2 size={18} className="animate-spin"/> Отправляем заявку...</>
                ) : (
                  <>Подтвердить заявку <ChevronRight size={18}/></>
                )}
              </button>
              {submitError && <p className="text-center text-xs text-red-500">{submitError}</p>}
              <p className="text-center text-xs text-slate-400">Нажимая кнопку, вы соглашаетесь с <span className="text-orange-500 cursor-pointer">политикой конфиденциальности</span></p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
