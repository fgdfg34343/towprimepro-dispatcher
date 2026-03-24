import { useState, useEffect } from 'react';
import { Phone, Menu, X, Zap } from 'lucide-react';

const navLinks = [
  { href: '#how', label: 'Как это работает' },
  { href: '#advantages', label: 'Преимущества' },
  { href: '#trucks', label: 'Эвакуаторы' },
  { href: '#faq', label: 'Вопросы и ответы' },
  { href: '#contacts', label: 'Контакты' },
];

export default function Header({ onOrderClick }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
      scrolled ? 'glass shadow-lg shadow-slate-900/8 py-2' : 'bg-transparent py-4'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <a href="#" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/30 group-hover:scale-105 transition-transform">
              <Zap size={18} className="text-white" fill="white"/>
            </div>
            <div>
              <span className="text-slate-900 font-black text-lg leading-none">Tow</span>
              <span className="gradient-text font-black text-lg leading-none">Prime</span>
            </div>
          </a>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map(link => (
              <a key={link.href} href={link.href}
                className="text-slate-600 hover:text-orange-500 font-medium text-sm px-3 py-2 rounded-lg hover:bg-orange-50 transition-all">
                {link.label}
              </a>
            ))}
          </nav>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            <a href="tel:+79777349128" className="flex items-center gap-2 text-slate-700 hover:text-orange-500 transition-colors font-semibold text-sm">
              <Phone size={16} className="text-orange-500"/>
              +7 977 734 91 28
            </a>
            <button onClick={onOrderClick}
              className="btn-orange px-5 py-2.5 rounded-xl text-white font-bold text-sm shadow-lg">
              Вызвать
            </button>
          </div>

          {/* Mobile menu button */}
          <button
            className="lg:hidden p-2 rounded-xl hover:bg-slate-100 transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={22}/> : <Menu size={22}/>}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="lg:hidden mt-3 pb-4 border-t border-slate-100 animate-fade-up">
            <nav className="flex flex-col gap-1 mt-3">
              {navLinks.map(link => (
                <a key={link.href} href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="text-slate-700 font-medium px-3 py-2.5 rounded-xl hover:bg-orange-50 hover:text-orange-600 transition-all">
                  {link.label}
                </a>
              ))}
            </nav>
            <div className="mt-4 flex flex-col gap-3">
              <a href="tel:+79777349128" className="flex items-center gap-2 text-slate-700 font-semibold px-3">
                <Phone size={16} className="text-orange-500"/> +7 977 734 91 28
              </a>
              <button onClick={() => { onOrderClick(); setMobileOpen(false); }}
                className="btn-orange mx-3 py-3 rounded-xl text-white font-bold text-sm shadow-lg">
                Вызвать эвакуатор
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
