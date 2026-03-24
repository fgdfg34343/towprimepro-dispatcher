import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    q: 'Сколько времени займёт прибытие эвакуатора?',
    a: 'Среднее время подачи по Москве — 18–25 минут. В области может быть немного дольше. После оформления заявки вы получите SMS с контактом водителя и временем прибытия.'
  },
  {
    q: 'Как рассчитывается стоимость эвакуации?',
    a: 'Стоимость зависит от типа платформы и расстояния: ломаная платформа — 4 000 ₽ + 100 ₽/км, сдвижная — 4 500 ₽ + 110 ₽/км, манипулятор — 12 000 ₽ + 150 ₽/км. Заблокированные колёса оплачиваются отдельно: 800 ₽ за каждое.'
  },
  {
    q: 'Что делать, если машина съехала в кювет или перевёрнута?',
    a: 'В таких случаях необходим манипулятор. Выберите этот тип эвакуатора в калькуляторе или сообщите диспетчеру при звонке. Наши водители имеют опыт работы в сложных ситуациях.'
  },
  {
    q: 'Как вы обеспечиваете сохранность автомобиля?',
    a: 'Подбираем подходящий тип эвакуатора под клиренс и состояние авто, аккуратно загружаем машину и фиксируем её ремнями. Если колёса заблокированы или автомобиль стоит в неудобной точке, диспетчер заранее закладывает нужный сценарий погрузки.'
  },
  {
    q: 'Как оплатить услуги эвакуатора?',
    a: 'Оплата производится после выполнения заказа. Принимаем наличные, банковские карты (Visa, MasterCard, МИР), переводы по СБП. Чек и закрывающие документы предоставляются сразу.'
  },
  {
    q: 'Работаете ли вы в Московской области?',
    a: 'Да, мы работаем по всей Москве и Московской области. Для заказов за МКАД стоимость рассчитывается от МКАД. Позвоните нам для уточнения деталей по конкретному адресу.'
  },
  {
    q: 'Можно ли вызвать эвакуатор ночью или в праздники?',
    a: 'Конечно! Мы работаем 24 часа 7 дней в неделю, включая праздничные дни. Ночные вызовы обслуживаются по стандартным ценам без ночных надбавок.'
  },
  {
    q: 'Как подключить ваш сервис к нашей CRM/системе?',
    a: 'Мы предоставляем API для интеграции с любыми CRM-системами, корпоративными порталами и телематическими платформами. Свяжитесь с нашим отделом B2B для получения документации.'
  },
];

function useInView() {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold: 0.1 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, inView];
}

export default function FAQ() {
  const [open, setOpen] = useState(null);
  const [ref, inView] = useInView();

  return (
    <section id="faq" className="py-24 bg-slate-50" ref={ref}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`text-center mb-16 transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <span className="inline-block bg-orange-100 text-orange-600 text-sm font-bold px-4 py-1.5 rounded-full mb-4">Частые вопросы</span>
          <h2 className="text-4xl sm:text-5xl font-black text-slate-900 mb-4">Вопросы и ответы</h2>
          <p className="text-slate-500 text-lg">Ответы на самые популярные вопросы</p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className={`bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm transition-all duration-500 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'} ${open === i ? 'border-orange-100 shadow-md' : 'hover:border-orange-100'}`}
              style={{ transitionDelay: `${i * 60}ms` }}
            >
              <button
                className="w-full px-6 py-5 flex items-center justify-between text-left gap-4"
                onClick={() => setOpen(open === i ? null : i)}
              >
                <span className={`font-semibold text-base transition-colors ${open === i ? 'text-orange-600' : 'text-slate-800'}`}>{faq.q}</span>
                <ChevronDown
                  size={20}
                  className={`flex-shrink-0 transition-transform duration-300 ${open === i ? 'rotate-180 text-orange-500' : 'text-slate-400'}`}
                />
              </button>
              <div className={`overflow-hidden transition-all duration-300 ${open === i ? 'max-h-64' : 'max-h-0'}`}>
                <p className="px-6 pb-5 text-slate-500 text-sm leading-relaxed">{faq.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
