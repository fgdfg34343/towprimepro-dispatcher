export default function AppPromo() {
  return (
    <section className="py-16 px-4 bg-gradient-to-br from-orange-500 to-orange-600 overflow-hidden relative">
      {/* декоративные круги */}
      <div className="absolute -top-16 -right-16 w-64 h-64 bg-white/10 rounded-full" />
      <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-white/10 rounded-full" />

      <div className="max-w-5xl mx-auto relative z-10">
        <div className="flex flex-col md:flex-row items-center gap-10 md:gap-16">

          {/* Иконка приложения */}
          <div className="flex-shrink-0 relative">
            <div className="w-40 h-40 md:w-48 md:h-48 rounded-[2.5rem] shadow-2xl overflow-hidden border-4 border-white/30">
              <img
                src="/app-icon.png"
                alt="TowPrime Driver — приложение"
                className="w-full h-full object-cover"
              />
            </div>
            {/* Бейдж "NEW" */}
            <div className="absolute -top-3 -right-3 bg-yellow-400 text-yellow-900 text-xs font-black px-2.5 py-1 rounded-full shadow-lg rotate-12 uppercase tracking-wide">
              App
            </div>
          </div>

          {/* Текст */}
          <div className="text-white text-center md:text-left flex-1">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-1.5 text-sm font-medium mb-4">
              🎁 Бонус на первый заказ
            </div>

            <h2 className="text-3xl md:text-4xl font-black leading-tight mb-3">
              Скачайте приложение<br />
              <span className="text-yellow-300">TowPrime Driver</span>
            </h2>

            <p className="text-white/85 text-base md:text-lg leading-relaxed mb-6 max-w-md">
              Вызывайте эвакуатор в пару касаний, отслеживайте машину на карте и получайте
              {' '}<strong className="text-white">300 ₽ на первый заказ</strong> при регистрации в приложении.
            </p>

            {/* Бонус-карточка */}
            <div className="inline-flex items-center gap-3 bg-white/15 border border-white/30 rounded-2xl px-5 py-3 mb-7">
              <span className="text-4xl font-black text-yellow-300">300₽</span>
              <div className="text-sm leading-snug text-white/90">
                <div className="font-semibold">Бонус при первом заказе</div>
                <div className="text-white/70">при регистрации через приложение</div>
              </div>
            </div>

            {/* Кнопки скачивания */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
              {/* App Store */}
              <a
                href="#"
                className="flex items-center gap-3 bg-black hover:bg-zinc-800 transition-colors rounded-xl px-5 py-3 shadow-lg group"
              >
                <svg className="w-7 h-7 text-white flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
                <div className="text-left">
                  <div className="text-white/70 text-[10px] leading-none">Скачать в</div>
                  <div className="text-white font-semibold text-sm leading-tight">App Store</div>
                </div>
              </a>

              {/* Google Play */}
              <a
                href="#"
                className="flex items-center gap-3 bg-black hover:bg-zinc-800 transition-colors rounded-xl px-5 py-3 shadow-lg group"
              >
                <svg className="w-7 h-7 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                  <path d="M3.18 1.7L13.7 12 3.18 22.3a1.5 1.5 0 01-.68-1.27V2.97c0-.53.26-1 .68-1.27z" fill="#EA4335"/>
                  <path d="M17.32 8.1l2.26-1.31c.8-.46.8-1.12 0-1.58L17.32 3.9 13.7 7.5l3.62 3.62-.0-.02z" fill="#FBBC04"/>
                  <path d="M3.18 22.3c.2.12.43.18.67.18.31 0 .63-.09.9-.26l12.57-7.3L13.7 11.5 3.18 22.3z" fill="#34A853"/>
                  <path d="M3.18 1.7L13.7 12.5 17.32 8.1 4.75 1.97c-.27-.16-.59-.25-.9-.25-.24 0-.47.06-.67.18-.42.26-.68.73-.68 1.27v-.47z" fill="#4285F4"/>
                </svg>
                <div className="text-left">
                  <div className="text-white/70 text-[10px] leading-none">Скачать в</div>
                  <div className="text-white font-semibold text-sm leading-tight">Google Play</div>
                </div>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
