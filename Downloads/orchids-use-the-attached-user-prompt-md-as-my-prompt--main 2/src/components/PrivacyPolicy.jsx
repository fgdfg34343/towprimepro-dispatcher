import { X } from 'lucide-react';

export default function PrivacyPolicy({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-8 py-5 flex items-center justify-between rounded-t-3xl z-10">
          <h2 className="text-xl font-black text-slate-900">Политика конфиденциальности</h2>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
            <X size={18} className="text-slate-600" />
          </button>
        </div>
        <div className="px-8 py-6 space-y-6 text-slate-600 text-sm leading-relaxed">
          <p className="text-slate-400 text-xs">Последнее обновление: 24 марта 2026 г.</p>

          <section>
            <h3 className="font-bold text-slate-900 text-base mb-2">1. Общие положения</h3>
            <p>Настоящая Политика конфиденциальности определяет порядок обработки и защиты персональных данных пользователей сервиса TowPrime (далее — «Сервис»). Используя Сервис, вы соглашаетесь с условиями данной политики.</p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 text-base mb-2">2. Какие данные мы собираем</h3>
            <ul className="space-y-1.5 list-disc list-inside">
              <li>Имя и контактный телефон (при оформлении заявки)</li>
              <li>Адрес подачи эвакуатора</li>
              <li>Геолокация (с вашего разрешения, для определения местоположения)</li>
              <li>Email-адрес (при обращении через форму обратной связи)</li>
              <li>Технические данные: IP-адрес, тип браузера, время посещения</li>
            </ul>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 text-base mb-2">3. Цели обработки данных</h3>
            <ul className="space-y-1.5 list-disc list-inside">
              <li>Обработка и выполнение заявок на эвакуацию</li>
              <li>Связь с вами для уточнения деталей заказа</li>
              <li>Улучшение качества работы Сервиса</li>
              <li>Отправка информации о статусе вашего заказа</li>
            </ul>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 text-base mb-2">4. Хранение и защита данных</h3>
            <p>Мы храним ваши данные на защищённых серверах. Данные не передаются третьим лицам, кроме случаев, предусмотренных законодательством РФ, а также для исполнения заказа (водителю эвакуатора передаётся только адрес и телефон клиента).</p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 text-base mb-2">5. Срок хранения данных</h3>
            <p>Персональные данные хранятся в течение 3 лет с момента последнего взаимодействия с Сервисом, после чего удаляются, если иное не предусмотрено законодательством.</p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 text-base mb-2">6. Ваши права</h3>
            <ul className="space-y-1.5 list-disc list-inside">
              <li>Получить информацию о хранящихся данных</li>
              <li>Потребовать исправления неточных данных</li>
              <li>Потребовать удаления ваших данных</li>
              <li>Отозвать согласие на обработку данных</li>
            </ul>
            <p className="mt-2">Для реализации прав обращайтесь: <a href="mailto:harut6740@gmail.com" className="text-orange-500 hover:underline">harut6740@gmail.com</a></p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 text-base mb-2">7. Cookie-файлы</h3>
            <p>Сайт использует cookie для улучшения пользовательского опыта. Вы можете отключить cookie в настройках браузера, однако это может повлиять на работу некоторых функций Сервиса.</p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 text-base mb-2">8. Контакты</h3>
            <p>По вопросам, связанным с обработкой персональных данных:<br />
            Email: <a href="mailto:harut6740@gmail.com" className="text-orange-500 hover:underline">harut6740@gmail.com</a><br />
            Телефон: <a href="tel:+79777349128" className="text-orange-500 hover:underline">+7 977 734 91 28</a></p>
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
