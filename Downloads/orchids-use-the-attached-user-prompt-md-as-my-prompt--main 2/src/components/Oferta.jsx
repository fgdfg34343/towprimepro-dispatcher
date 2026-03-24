import { X } from 'lucide-react';

export default function Oferta({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-8 py-5 flex items-center justify-between rounded-t-3xl z-10">
          <h2 className="text-xl font-black text-slate-900">Публичная оферта</h2>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
            <X size={18} className="text-slate-600" />
          </button>
        </div>
        <div className="px-8 py-6 space-y-6 text-slate-600 text-sm leading-relaxed">
          <p className="text-slate-400 text-xs">Последнее обновление: 24 марта 2026 г.</p>
          <p>Настоящий документ является публичной офертой TowPrime (далее — «Исполнитель») на оказание услуг эвакуации автомобилей.</p>

          <section>
            <h3 className="font-bold text-slate-900 text-base mb-2">1. Предмет оферты</h3>
            <p>Исполнитель обязуется по заявке Заказчика оказать услуги по эвакуации (транспортировке) автомобиля с места указанного Заказчиком до указанного места назначения на территории Москвы и Московской области.</p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 text-base mb-2">2. Акцепт оферты</h3>
            <p>Акцептом настоящей оферты является подача заявки через сайт, по телефону или в мессенджере, а также устное подтверждение условий диспетчеру. Акцепт означает полное согласие с условиями оферты.</p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 text-base mb-2">3. Стоимость услуг</h3>
            <ul className="space-y-1.5 list-disc list-inside">
              <li>Ломаная платформа: от 4 000 ₽ + 100 ₽/км</li>
              <li>Сдвижная платформа: от 4 500 ₽ + 110 ₽/км</li>
              <li>Манипулятор: от 12 000 ₽ + 150 ₽/км</li>
            </ul>
            <p className="mt-2">Окончательная стоимость фиксируется диспетчером при подтверждении заявки и зависит от расстояния, типа транспортного средства и дополнительных условий.</p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 text-base mb-2">4. Порядок оплаты</h3>
            <p>Оплата производится после оказания услуги одним из следующих способов:</p>
            <ul className="space-y-1.5 list-disc list-inside mt-2">
              <li>Наличными водителю-эвакуаторщику</li>
              <li>Безналичным расчётом (СБП, банковская карта)</li>
            </ul>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 text-base mb-2">5. Обязательства Исполнителя</h3>
            <ul className="space-y-1.5 list-disc list-inside">
              <li>Прибыть в согласованное место в оговорённые сроки</li>
              <li>Обеспечить бережную погрузку и транспортировку автомобиля</li>
              <li>Уведомить Заказчика об изменении времени прибытия</li>
              <li>Нести ответственность за сохранность ТС в процессе транспортировки</li>
            </ul>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 text-base mb-2">6. Обязательства Заказчика</h3>
            <ul className="space-y-1.5 list-disc list-inside">
              <li>Предоставить достоверные сведения о местонахождении и состоянии ТС</li>
              <li>Обеспечить доступ к транспортному средству</li>
              <li>Произвести оплату в полном объёме после оказания услуги</li>
            </ul>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 text-base mb-2">7. Ответственность сторон</h3>
            <p>Исполнитель несёт ответственность за ущерб, причинённый ТС по вине Исполнителя в процессе погрузки и транспортировки. Исполнитель не несёт ответственности за ущерб, вызванный техническим состоянием ТС Заказчика.</p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 text-base mb-2">8. Отказ от услуги</h3>
            <p>Заказчик вправе отменить заявку бесплатно до выезда эвакуатора. После выезда эвакуатора к месту подачи взимается компенсация холостого пробега согласно действующим тарифам.</p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 text-base mb-2">9. Контакты Исполнителя</h3>
            <p>TowPrime<br />
            Телефон: <a href="tel:+79777349128" className="text-orange-500 hover:underline">+7 977 734 91 28</a><br />
            Email: <a href="mailto:harut6740@gmail.com" className="text-orange-500 hover:underline">harut6740@gmail.com</a><br />
            Адрес: Москва, ул. Примерная, д. 1</p>
          </section>
        </div>
        <div className="px-8 pb-6">
          <button onClick={onClose} className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl transition-colors">
            Понятно
          </button>
        </div>
      </div>
    </div>
  );
}
