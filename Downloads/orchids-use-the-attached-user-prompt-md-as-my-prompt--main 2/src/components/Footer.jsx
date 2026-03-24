import { Zap, Phone, Mail, MapPin, Heart } from 'lucide-react';

const footerLinks = {
  'Услуги': ['Эвакуация легкового авто', 'Эвакуация внедорожника', 'Манипулятор', 'Эвакуация мотоцикла', 'Корпоративным клиентам'],
  'Компания': ['О нас', 'Вакансии', 'Пресса', 'Партнёрам', 'Контакты'],
  'Поддержка': ['Как это работает', 'Калькулятор цены', 'Вопросы и ответы', 'Бережная перевозка', 'Политика конфиденциальности'],
};

export default function Footer({ onPrivacyClick, onOfertaClick }) {
  return (
    <footer className="bg-slate-900 text-slate-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Brand column */}
          <div className="lg:col-span-2 space-y-5">
            <a href="#" className="flex items-center gap-2.5 group w-fit">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/30">
                <Zap size={18} className="text-white" fill="white"/>
              </div>
              <div>
                <span className="text-white font-black text-lg leading-none">Tow</span>
                <span className="text-orange-400 font-black text-lg leading-none">Prime</span>
              </div>
            </a>
            <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
              Сервис эвакуации автомобилей по Москве и Московской области. Прозрачные тарифы, бережная погрузка и работа 24/7.
            </p>
            <div className="space-y-2.5">
              <a href="tel:+79777349128" className="flex items-center gap-2.5 text-slate-300 hover:text-orange-400 transition-colors text-sm font-medium">
                <Phone size={15} className="text-orange-500"/> +7 977 734 91 28
              </a>
              <a href="mailto:harut6740@gmail.com" className="flex items-center gap-2.5 text-slate-300 hover:text-orange-400 transition-colors text-sm">
                <Mail size={15} className="text-orange-500"/> harut6740@gmail.com
              </a>
              <div className="flex items-start gap-2.5 text-slate-400 text-sm">
                <MapPin size={15} className="text-orange-500 flex-shrink-0 mt-0.5"/> Москва, ул. Примерная, д. 1
              </div>
            </div>

            {/* Social */}
            <div className="flex gap-3 pt-1">
              {['VK', 'TG', 'WA'].map(s => (
                <a key={s} href="#"
                  className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-400 hover:bg-orange-500 hover:border-orange-500 hover:text-white transition-all">
                  {s}
                </a>
              ))}
            </div>
          </div>

          {/* Links columns */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-white font-bold text-sm mb-4">{title}</h4>
              <ul className="space-y-2.5">
                {links.map(link => (
                  <li key={link}>
                    <a href="#" className="text-slate-400 hover:text-orange-400 transition-colors text-sm">{link}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-slate-500 text-sm">© 2026 TowPrime. Все права защищены.</p>
          <div className="flex items-center gap-1.5 text-slate-500 text-sm">
            <span>Сделано с</span>
            <Heart size={13} className="text-red-500" fill="#ef4444"/>
            <span>в Москве</span>
          </div>
          <div className="flex gap-4">
            <button onClick={onPrivacyClick} className="text-slate-500 hover:text-slate-300 text-xs transition-colors">Политика конфиденциальности</button>
            <button onClick={onOfertaClick} className="text-slate-500 hover:text-slate-300 text-xs transition-colors">Оферта</button>
          </div>
        </div>
      </div>
    </footer>
  );
}
