import { useEffect, useRef, useState } from 'react';

const truckTypes = [
  {
    id: 'broken',
    name: 'Ломаная платформа',
    desc: 'Универсальный вариант для большинства легковых автомобилей. Надёжная погрузка с помощью лебёдки и подкатных роликов.',
    suitable: ['Легковые', 'Кроссоверы', 'Седаны', 'Хэтчбеки'],
    unsuitable: ['Спорткары (низкий клиренс)', 'Транспорт >3.5т'],
    price: '4 000 ₽ + 100 ₽/км',
    tag: 'Популярный',
    tagColor: 'bg-blue-100 text-blue-700',
    accentColor: '#3b82f6',
    svgIcon: (
      <svg viewBox="0 0 200 120" fill="none" className="w-full h-full">
        <defs>
          <linearGradient id="truck1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#334155"/><stop offset="100%" stopColor="#1e293b"/>
          </linearGradient>
        </defs>
        {/* Body */}
        <rect x="10" y="50" width="130" height="40" rx="4" fill="url(#truck1)"/>
        {/* Cab */}
        <path d="M130 50 L130 20 Q130 12 140 12 L170 12 Q182 12 185 25 L190 50 Z" fill="#334155"/>
        {/* Platform - broken angle */}
        <path d="M10 50 L70 30 L130 30 L130 50 Z" fill="#475569"/>
        <line x1="70" y1="30" x2="70" y2="50" stroke="#64748b" strokeWidth="1.5"/>
        {/* Orange stripe */}
        <rect x="10" y="46" width="120" height="4" fill="#f97316"/>
        {/* Wheels */}
        <circle cx="45" cy="92" r="14" fill="#1e293b"/>
        <circle cx="45" cy="92" r="9" fill="#374151"/>
        <circle cx="110" cy="92" r="14" fill="#1e293b"/>
        <circle cx="110" cy="92" r="9" fill="#374151"/>
        <circle cx="168" cy="92" r="14" fill="#1e293b"/>
        <circle cx="168" cy="92" r="9" fill="#374151"/>
      </svg>
    ),
  },
  {
    id: 'sliding',
    name: 'Сдвижная платформа',
    desc: 'Платформа задвигается назад до земли — идеально для спорткаров, автомобилей с низким клиренсом и ценных авто.',
    suitable: ['Спорткары', 'Купе', 'Люксовые авто', 'Авто с нулевым клиренсом'],
    unsuitable: ['Транспорт >3.5т'],
    price: '4 500 ₽ + 110 ₽/км',
    tag: 'Для спорткаров',
    tagColor: 'bg-orange-100 text-orange-700',
    accentColor: '#f97316',
    svgIcon: (
      <svg viewBox="0 0 200 120" fill="none" className="w-full h-full">
        <defs>
          <linearGradient id="truck2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#334155"/><stop offset="100%" stopColor="#1e293b"/>
          </linearGradient>
        </defs>
        {/* Body */}
        <rect x="10" y="50" width="130" height="40" rx="4" fill="url(#truck2)"/>
        {/* Cab */}
        <path d="M130 50 L130 20 Q130 12 140 12 L170 12 Q182 12 185 25 L190 50 Z" fill="#334155"/>
        {/* Platform - flat sliding */}
        <rect x="10" y="30" width="120" height="20" rx="2" fill="#475569"/>
        <rect x="10" y="46" width="120" height="4" fill="#f97316"/>
        {/* Sliding indicator */}
        <path d="M130 50 L150 75 L155 75" stroke="#f97316" strokeWidth="2" strokeDasharray="4 3"/>
        {/* Wheels */}
        <circle cx="45" cy="92" r="14" fill="#1e293b"/>
        <circle cx="45" cy="92" r="9" fill="#374151"/>
        <circle cx="110" cy="92" r="14" fill="#1e293b"/>
        <circle cx="110" cy="92" r="9" fill="#374151"/>
        <circle cx="168" cy="92" r="14" fill="#1e293b"/>
        <circle cx="168" cy="92" r="9" fill="#374151"/>
      </svg>
    ),
  },
  {
    id: 'manipulator',
    name: 'Манипулятор',
    desc: 'Кран-манипулятор поднимает автомобиль с любой позиции — незаменим при сложных ДТП, авто в кювете, во дворах.',
    suitable: ['Авто в кювете', 'Перевёрнутые авто', 'Авто в труднодоступных местах', 'Все типы ТС'],
    unsuitable: [],
    price: '12 000 ₽ + 150 ₽/км',
    tag: 'Для сложных случаев',
    tagColor: 'bg-purple-100 text-purple-700',
    accentColor: '#8b5cf6',
    svgIcon: (
      <svg viewBox="0 0 200 120" fill="none" className="w-full h-full">
        <defs>
          <linearGradient id="truck3" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#334155"/><stop offset="100%" stopColor="#1e293b"/>
          </linearGradient>
        </defs>
        {/* Body */}
        <rect x="10" y="55" width="100" height="35" rx="4" fill="url(#truck3)"/>
        {/* Cab */}
        <path d="M100 55 L100 25 Q100 17 110 17 L150 17 Q162 17 165 30 L170 55 Z" fill="#334155"/>
        {/* Crane arm */}
        <line x1="80" y1="55" x2="80" y2="15" stroke="#475569" strokeWidth="6" strokeLinecap="round"/>
        <line x1="80" y1="15" x2="130" y2="15" stroke="#475569" strokeWidth="5" strokeLinecap="round"/>
        <line x1="130" y1="15" x2="130" y2="40" stroke="#64748b" strokeWidth="3" strokeLinecap="round" strokeDasharray="3 2"/>
        {/* Hook */}
        <path d="M126 40 Q130 48 134 40" stroke="#f97316" strokeWidth="2.5" fill="none"/>
        {/* Orange accent */}
        <rect x="10" y="51" width="100" height="4" fill="#8b5cf6"/>
        {/* Wheels */}
        <circle cx="35" cy="92" r="14" fill="#1e293b"/>
        <circle cx="35" cy="92" r="9" fill="#374151"/>
        <circle cx="85" cy="92" r="14" fill="#1e293b"/>
        <circle cx="85" cy="92" r="9" fill="#374151"/>
        <circle cx="148" cy="92" r="14" fill="#1e293b"/>
        <circle cx="148" cy="92" r="9" fill="#374151"/>
      </svg>
    ),
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

export default function TruckTypes({ onOrderClick }) {
  const [ref, inView] = useInView();

  return (
    <section id="trucks" className="py-24 bg-white" ref={ref}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`text-center mb-16 transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <span className="inline-block bg-orange-100 text-orange-600 text-sm font-bold px-4 py-1.5 rounded-full mb-4">Парк техники</span>
          <h2 className="text-4xl sm:text-5xl font-black text-slate-900 mb-4">Типы эвакуаторов</h2>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">Для каждой ситуации — подходящее решение</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {truckTypes.map((t, i) => (
            <div
              key={t.id}
              className={`group bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 card-3d ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
              style={{ transitionDelay: `${i * 150}ms`, '--accent': t.accentColor }}
            >
              {/* Content */}
              <div className="p-6 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-slate-900 font-black text-xl mb-1">{t.name}</h3>
                  <span className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-full ${t.tagColor}`}>{t.tag}</span>
                </div>
                <p className="text-slate-500 text-sm leading-relaxed">{t.desc}</p>

                {/* Suitable */}
                <div>
                  <p className="text-xs font-semibold text-slate-700 mb-2">Подходит для:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {t.suitable.map(s => (
                      <span key={s} className="text-xs bg-green-50 text-green-700 border border-green-100 px-2.5 py-1 rounded-lg font-medium">✓ {s}</span>
                    ))}
                  </div>
                </div>

                {t.unsuitable.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-700 mb-2">Не подходит:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {t.unsuitable.map(s => (
                        <span key={s} className="text-xs bg-red-50 text-red-600 border border-red-100 px-2.5 py-1 rounded-lg font-medium">✗ {s}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-2xl font-black text-slate-900">{t.price}</span>
                  <button onClick={onOrderClick}
                    className="btn-orange px-5 py-2.5 rounded-xl text-white font-bold text-sm shadow-md">
                    Заказать
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
