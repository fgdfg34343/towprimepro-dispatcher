import { useState, useEffect } from 'react';
import { Star, Clock, Shield, ChevronDown } from 'lucide-react';
import Calculator from './Calculator';

const stats = [
  { value: '4 мин', label: 'Среднее время\nподачи' },
  { value: '24/7', label: 'Работаем\nкруглосуточно' },
  { value: '5 ★', label: 'Рейтинг\nклиентов' },
  { value: '8 000+', label: 'Выполненных\nзаявок' },
];

export default function HeroSection({ onOrderClick }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section className="hero-gradient relative min-h-screen flex flex-col overflow-hidden noise" id="hero">
      {/* Decorative circles */}
      <div className="absolute top-20 right-0 w-[600px] h-[600px] rounded-full bg-orange-500/5 blur-3xl pointer-events-none"/>
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-orange-500/5 blur-3xl pointer-events-none"/>

      {/* Spinning ring decoration */}
      <div className="absolute top-32 right-20 w-32 h-32 opacity-20 pointer-events-none hidden lg:block">
        <svg viewBox="0 0 128 128" className="animate-spin-slow w-full h-full">
          <circle cx="64" cy="64" r="58" fill="none" stroke="#f97316" strokeWidth="2" strokeDasharray="8 6"/>
        </svg>
      </div>
      <div className="absolute bottom-40 left-10 w-20 h-20 opacity-15 pointer-events-none hidden lg:block">
        <svg viewBox="0 0 80 80" className="animate-spin-slow w-full h-full" style={{animationDirection:'reverse',animationDuration:'15s'}}>
          <circle cx="40" cy="40" r="36" fill="none" stroke="#f97316" strokeWidth="2" strokeDasharray="5 4"/>
        </svg>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 flex flex-col justify-center pt-24 pb-16">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-start">

          {/* Left: Text + Stats */}
          <div className={`space-y-8 transition-all duration-700 ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'}`}>
            {/* Heading */}
            <div className="space-y-3">
              <h1 className="text-5xl sm:text-6xl lg:text-[3.75rem] xl:text-[4.5rem] font-black text-slate-900 leading-[1.05] tracking-tight">
                TowPrime<br/>
                <span className="gradient-text">быстро</span> и<br/>
                <span className="relative">
                  прозрачно
                  <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 300 8" fill="none">
                    <path d="M2 5 Q75 2 150 4 Q225 6 298 3" stroke="#f97316" strokeWidth="3" strokeLinecap="round" opacity="0.5"/>
                  </svg>
                </span>
              </h1>
              <p className="text-slate-500 text-lg font-medium max-w-md">
                Рассчитайте стоимость за 30 секунд. Бережная погрузка, понятные тарифы и подача от 15 минут по Москве и области.
              </p>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap gap-3">
              {[
                { icon: Clock, text: 'Подача 15–30 мин' },
                { icon: Shield, text: 'Бережная погрузка' },
                { icon: Star, text: 'Цена без скрытых доплат' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2 bg-white border border-slate-100 rounded-xl px-4 py-2.5 shadow-sm">
                  <Icon size={15} className="text-orange-500"/>
                  <span className="text-slate-700 text-sm font-medium">{text}</span>
                </div>
              ))}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {stats.map((s, i) => (
                <div key={i} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm hover:shadow-md hover:border-orange-100 transition-all card-3d">
                  <div className="text-2xl font-black text-slate-900">{s.value}</div>
                  <div className="text-xs text-slate-500 font-medium mt-0.5 whitespace-pre-line">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Phone CTA */}
            <div className="flex items-center gap-4 pt-2">
              <a href="tel:+79777349128"
                className="flex items-center gap-2.5 text-slate-800 hover:text-orange-600 transition-colors">
                <div className="w-11 h-11 rounded-full bg-orange-100 flex items-center justify-center animate-pulse-glow">
                  <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-orange-500">
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 014.72 12 19.79 19.79 0 011.65 3.39 2 2 0 013.63 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L7.91 8.59a16 16 0 006.29 6.29l.96-.96a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" fill="currentColor"/>
                  </svg>
                </div>
                <div>
                  <div className="text-lg font-black">+7 977 734 91 28</div>
                  <div className="text-xs text-slate-400">Диспетчерская TowPrime 24/7</div>
                </div>
              </a>
            </div>

            {/* App Promo */}
            <div className="flex items-center gap-4 bg-white border border-slate-100 rounded-2xl px-4 py-4 shadow-sm">
              <img
                src="/app-icon.png"
                alt="TowPrime Driver"
                className="w-16 h-16 rounded-2xl shadow-md flex-shrink-0 object-cover"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold text-slate-800">Скачайте приложение</span>
                  <span className="bg-orange-100 text-orange-600 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">+300 ₽</span>
                </div>
                <p className="text-xs text-slate-500 leading-snug mb-2.5">Вызов эвакуатора в пару касаний. Бонус 300 ₽ на первый заказ при регистрации.</p>
                <div className="flex gap-2">
                  <a href="#" className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-700 transition-colors text-white text-[11px] font-semibold rounded-lg px-3 py-1.5">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                    </svg>
                    App Store
                  </a>
                  <a href="#" className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-700 transition-colors text-white text-[11px] font-semibold rounded-lg px-3 py-1.5">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                      <path d="M3.18 1.7L13.7 12 3.18 22.3a1.5 1.5 0 01-.68-1.27V2.97c0-.53.26-1 .68-1.27z" fill="#EA4335"/>
                      <path d="M17.32 8.1l2.26-1.31c.8-.46.8-1.12 0-1.58L17.32 3.9 13.7 7.5l3.62 3.62z" fill="#FBBC04"/>
                      <path d="M3.18 22.3c.2.12.43.18.67.18.31 0 .63-.09.9-.26l12.57-7.3L13.7 11.5 3.18 22.3z" fill="#34A853"/>
                      <path d="M3.85 1.71L13.7 12.5 17.32 8.1 4.75 1.97c-.27-.16-.59-.25-.9-.25-.24 0-.47.06-.67.18z" fill="#4285F4"/>
                    </svg>
                    Google Play
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Truck 3D + Calculator */}
          <div className={`space-y-6 transition-all duration-700 delay-200 ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}>
            {/* 3D Truck */}
            <div className="relative">
              <img
                src="/towprime-hero.png"
                alt="TowPrime эвакуатор перевозит автомобиль"
                className="w-full max-w-3xl mx-auto drop-shadow-2xl select-none pointer-events-none"
                loading="eager"
              />
              {/* Floating info chips */}
              <div className="absolute top-4 right-4 bg-white rounded-2xl px-4 py-2.5 shadow-lg border border-slate-100 animate-fade-up" style={{animationDelay:'0.7s', animationFillMode:'both'}}>
                <div className="text-xs font-semibold text-slate-700">⚡ Прибытие ~18 мин</div>
              </div>
            </div>

            {/* Calculator */}
            <Calculator onOrderClick={onOrderClick}/>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="flex justify-center pb-8">
        <a href="#how" className="flex flex-col items-center gap-1 text-slate-400 hover:text-orange-500 transition-colors">
          <span className="text-xs font-medium">Узнать больше</span>
          <ChevronDown size={20} className="animate-bounce"/>
        </a>
      </div>
    </section>
  );
}
