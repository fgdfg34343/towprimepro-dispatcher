import { useEffect, useRef, useState } from 'react';
import { Clock, Zap, DollarSign, HeadphonesIcon, Shield, Award } from 'lucide-react';

const advantages = [
  {
    icon: Clock,
    title: 'Круглосуточно 24/7',
    desc: 'Работаем без выходных и праздников. Ночью, в снегопад, в любую погоду — мы рядом.',
    gradient: 'from-blue-500 to-cyan-500',
    delay: 0,
  },
  {
    icon: Zap,
    title: 'Быстрая подача',
    desc: 'Среднее время прибытия — 18 минут. Ближайший свободный эвакуатор едет к вам.',
    gradient: 'from-orange-500 to-yellow-500',
    delay: 100,
  },
  {
    icon: DollarSign,
    title: 'Прозрачная цена',
    desc: 'Цена рассчитывается заранее. Никаких "сюрпризов" после выполнения заказа.',
    gradient: 'from-green-500 to-emerald-500',
    delay: 200,
  },
  {
    icon: HeadphonesIcon,
    title: 'Поддержка 24/7',
    desc: 'Живые операторы всегда на связи. Чат, телефон, WhatsApp — выберите удобный способ.',
    gradient: 'from-purple-500 to-pink-500',
    delay: 300,
  },
  {
    icon: Shield,
    title: 'Бережная погрузка',
    desc: 'Фиксируем автомобиль мягкими ремнями и подбираем платформу под конкретную ситуацию без лишнего риска.',
    gradient: 'from-red-500 to-rose-500',
    delay: 400,
  },
  {
    icon: Award,
    title: 'Лицензированные водители',
    desc: 'Все водители проходят ежегодную аттестацию. Опыт работы от 3 лет.',
    gradient: 'from-indigo-500 to-violet-500',
    delay: 500,
  },
];

function useInView(threshold = 0.15) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);
  return [ref, inView];
}

export default function Advantages({ onOrderClick }) {
  const [ref, inView] = useInView(0.1);

  return (
    <section id="advantages" className="py-24 bg-slate-50" ref={ref}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className={`text-center mb-16 transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <span className="inline-block bg-orange-100 text-orange-600 text-sm font-bold px-4 py-1.5 rounded-full mb-4">Почему выбирают нас</span>
          <h2 className="text-4xl sm:text-5xl font-black text-slate-900 mb-4">Наши преимущества</h2>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">Более 8 000 довольных клиентов в Москве и Московской области</p>
        </div>

        {/* Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {advantages.map((adv, i) => (
            <div
              key={i}
              className={`group bg-white rounded-3xl p-7 border border-slate-100 shadow-sm hover:shadow-xl hover:border-transparent transition-all duration-500 card-3d ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
              style={{ transitionDelay: `${adv.delay}ms` }}
            >
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${adv.gradient} flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform`}>
                <adv.icon size={24} className="text-white"/>
              </div>
              <h3 className="text-slate-900 font-bold text-xl mb-2.5">{adv.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{adv.desc}</p>
            </div>
          ))}
        </div>

        {/* CTA Banner */}
        <div className={`relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-10 text-center transition-all duration-700 delay-500 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-transparent"/>
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl"/>
          <div className="relative">
            <h3 className="text-white text-3xl sm:text-4xl font-black mb-3">Нужен эвакуатор прямо сейчас?</h3>
            <p className="text-slate-300 text-lg mb-8">Оформите заявку онлайн или позвоните. Мы приедем быстро.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button onClick={onOrderClick}
                className="btn-orange px-8 py-4 rounded-2xl text-white font-bold text-lg shadow-2xl shadow-orange-500/30">
                Вызвать эвакуатор
              </button>
              <a href="tel:+79777349128"
                className="px-8 py-4 rounded-2xl border-2 border-white/20 text-white font-bold text-lg hover:bg-white/10 transition-all">
                +7 977 734 91 28
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
