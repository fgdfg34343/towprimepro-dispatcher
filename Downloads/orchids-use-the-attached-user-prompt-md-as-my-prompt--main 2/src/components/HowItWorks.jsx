import { useEffect, useRef, useState } from 'react';
import { Calculator, Phone, MapPin, CheckCircle } from 'lucide-react';

const steps = [
  {
    step: '01',
    icon: Calculator,
    title: 'Рассчитайте стоимость',
    desc: 'Введите адреса и выберите параметры. Калькулятор мгновенно покажет точную цену без скрытых доплат.',
    color: 'from-blue-500 to-indigo-600',
    bg: 'bg-blue-50',
    border: 'border-blue-100',
  },
  {
    step: '02',
    icon: Phone,
    title: 'Оставьте заявку',
    desc: 'Заполните форму с контактными данными или позвоните нам. Диспетчер перезвонит в течение 2 минут.',
    color: 'from-orange-500 to-red-500',
    bg: 'bg-orange-50',
    border: 'border-orange-100',
  },
  {
    step: '03',
    icon: MapPin,
    title: 'Следите за эвакуатором',
    desc: 'Вы получите SMS с именем водителя и ссылкой на трекинг. Видите движение эвакуатора в реальном времени.',
    color: 'from-purple-500 to-pink-500',
    bg: 'bg-purple-50',
    border: 'border-purple-100',
  },
  {
    step: '04',
    icon: CheckCircle,
    title: 'Авто на месте назначения',
    desc: 'Водитель бережно погрузит и доставит ваш автомобиль. Оплата после выполнения заказа.',
    color: 'from-green-500 to-emerald-600',
    bg: 'bg-green-50',
    border: 'border-green-100',
  },
];

function useInView(threshold = 0.2) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);
  return [ref, inView];
}

export default function HowItWorks() {
  const [ref, inView] = useInView(0.1);

  return (
    <section id="how" className="py-24 bg-white" ref={ref}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className={`text-center mb-16 transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <span className="inline-block bg-orange-100 text-orange-600 text-sm font-bold px-4 py-1.5 rounded-full mb-4">Просто и понятно</span>
          <h2 className="text-4xl sm:text-5xl font-black text-slate-900 mb-4">Как это работает</h2>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">Вызвать эвакуатор так же просто, как заказать такси — в 4 шага</p>
        </div>

        {/* Steps */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((s, i) => (
            <div
              key={i}
              className={`relative group transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
              style={{ transitionDelay: `${i * 120}ms` }}
            >
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-10 left-full w-full h-0.5 z-0" style={{width: 'calc(100% - 80px)', left: '80px'}}>
                  <div className="w-full h-px bg-gradient-to-r from-slate-200 to-transparent"/>
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-slate-300 rounded-full"/>
                </div>
              )}

              <div className={`relative z-10 ${s.bg} ${s.border} border rounded-3xl p-6 h-full card-3d`}>
                {/* Step number */}
                <div className="text-7xl font-black text-slate-100 absolute top-4 right-5 select-none">{s.step}</div>

                {/* Icon */}
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${s.color} flex items-center justify-center mb-5 shadow-lg`}>
                  <s.icon size={24} className="text-white"/>
                </div>

                <h3 className="text-slate-900 font-bold text-lg mb-2">{s.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
