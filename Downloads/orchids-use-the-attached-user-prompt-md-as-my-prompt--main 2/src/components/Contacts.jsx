import { useRef, useState, useEffect } from 'react';
import { Phone, MessageCircle, Mail, MapPin, Clock, Send, Loader2 } from 'lucide-react';

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

const contactItems = [
  { icon: Phone, label: 'Телефон', value: '+7 977 734 91 28', sub: 'Диспетчерская 24/7', href: 'tel:+79777349128', color: 'from-green-500 to-emerald-600' },
  { icon: MessageCircle, label: 'WhatsApp / Telegram', value: '+7 977 734 91 28', sub: 'Напишите нам', href: 'https://wa.me/79777349128', color: 'from-green-400 to-teal-500' },
  { icon: Mail, label: 'Email', value: 'harut6740@gmail.com', sub: 'Ответим в течение часа', href: 'mailto:harut6740@gmail.com', color: 'from-blue-500 to-indigo-600' },
  { icon: MapPin, label: 'Адрес офиса', value: 'Москва, ул. Примерная, 1', sub: 'Офис открыт 10:00–19:00', href: null, color: 'from-orange-500 to-red-500' },
  { icon: Clock, label: 'Диспетчерская', value: '24 часа, 7 дней', sub: 'Без выходных и праздников', href: null, color: 'from-purple-500 to-violet-600' },
];

export default function Contacts({ onOrderClick }) {
  const [ref, inView] = useInView();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!name || !phone) return;
    setSending(true);
    await new Promise(r => setTimeout(r, 1200));
    setSending(false);
    setSent(true);
  };

  return (
    <section id="contacts" className="py-24 bg-white" ref={ref}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`text-center mb-16 transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <span className="inline-block bg-orange-100 text-orange-600 text-sm font-bold px-4 py-1.5 rounded-full mb-4">Всегда на связи</span>
          <h2 className="text-4xl sm:text-5xl font-black text-slate-900 mb-4">Контакты</h2>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">Свяжитесь с нами любым удобным способом</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Contact cards */}
          <div className={`space-y-4 transition-all duration-700 ${inView ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'}`}>
            {contactItems.map((c, i) => (
              <div key={i} className="group flex items-center gap-4 bg-slate-50 rounded-2xl p-5 border border-slate-100 hover:border-orange-100 hover:shadow-md transition-all">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center flex-shrink-0 shadow-md group-hover:scale-110 transition-transform`}>
                  <c.icon size={20} className="text-white"/>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-slate-400 font-medium">{c.label}</p>
                  {c.href ? (
                    <a href={c.href} className="text-slate-900 font-bold text-base hover:text-orange-500 transition-colors">{c.value}</a>
                  ) : (
                    <p className="text-slate-900 font-bold text-base">{c.value}</p>
                  )}
                  <p className="text-xs text-slate-400">{c.sub}</p>
                </div>
              </div>
            ))}

            {/* Map placeholder */}
            <div className="relative bg-slate-100 rounded-2xl overflow-hidden h-48 border border-slate-200">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <MapPin size={32} className="text-orange-400 mx-auto mb-2"/>
                  <p className="text-slate-500 text-sm font-medium">Карта покрытия</p>
                  <p className="text-slate-400 text-xs">Москва и Московская область</p>
                </div>
              </div>
              {/* Simulated map grid */}
              <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 400 200">
                {[20,40,60,80,100,120,140,160,180].map(y => (
                  <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="#94a3b8" strokeWidth="1"/>
                ))}
                {[40,80,120,160,200,240,280,320,360].map(x => (
                  <line key={x} x1={x} y1="0" x2={x} y2="200" stroke="#94a3b8" strokeWidth="1"/>
                ))}
                <circle cx="200" cy="100" r="40" fill="#f97316" opacity="0.3"/>
                <circle cx="200" cy="100" r="8" fill="#f97316"/>
              </svg>
            </div>
          </div>

          {/* Contact form */}
          <div className={`transition-all duration-700 delay-200 ${inView ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}>
            <div className="bg-white rounded-3xl border border-slate-100 shadow-xl p-8" style={{boxShadow:'0 20px 60px rgba(15,23,42,0.08)'}}>
              {sent ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Send size={28} className="text-green-500"/>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mb-2">Сообщение отправлено!</h3>
                  <p className="text-slate-500 text-sm">Мы свяжемся с вами в ближайшее время.</p>
                </div>
              ) : (
                <>
                  <h3 className="text-2xl font-black text-slate-900 mb-1">Напишите нам</h3>
                  <p className="text-slate-500 text-sm mb-6">Ответим в течение 15 минут в рабочее время</p>
                  <form onSubmit={handleSend} className="space-y-4">
                    <input
                      type="text"
                      placeholder="Ваше имя"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      required
                      className="input-field w-full px-4 py-3 rounded-xl text-sm font-medium placeholder-slate-400"
                    />
                    <input
                      type="tel"
                      placeholder="Телефон"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      required
                      className="input-field w-full px-4 py-3 rounded-xl text-sm font-medium placeholder-slate-400"
                    />
                    <textarea
                      placeholder="Ваш вопрос или пожелание"
                      value={msg}
                      onChange={e => setMsg(e.target.value)}
                      rows={4}
                      className="input-field w-full px-4 py-3 rounded-xl text-sm font-medium placeholder-slate-400 resize-none"
                    />
                    <button
                      type="submit"
                      disabled={sending}
                      className="btn-orange w-full py-4 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg"
                    >
                      {sending ? <><Loader2 size={18} className="animate-spin"/>Отправляем...</> : <><Send size={18}/>Отправить сообщение</>}
                    </button>
                  </form>
                  <div className="mt-6 pt-6 border-t border-slate-100 text-center">
                    <p className="text-slate-500 text-sm mb-3">Нужен эвакуатор прямо сейчас?</p>
                    <button onClick={onOrderClick}
                      className="btn-orange px-8 py-3 rounded-xl text-white font-bold text-sm shadow-md">
                      Вызвать эвакуатор
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
