# Быстрый старт TowTruck Dispatcher

## Шаг 1: Установка зависимостей

```bash
npm install
```

## Шаг 2: Настройка переменных окружения

### Вариант A: Используйте существующую Firebase конфигурацию

Если у вас уже есть Firebase проект, создайте файл `.env.local`:

```bash
cp .env.example .env.local
```

Затем откройте `.env.local` и заполните данные:

```env
# Google Maps API Key (уже добавлен)
VITE_GOOGLE_MAPS_API_KEY=AIzaSyBzYA3EB9HRMTq7D6sY6D01G2h6lAtMdQY

# Firebase Configuration (замените на ваши данные)
VITE_FIREBASE_API_KEY=your-api-key-here
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id

# Admin UID (UID пользователя диспетчера из Firebase Authentication)
VITE_ADMIN_UID=your-admin-user-uid
```

### Вариант B: Создайте новый Firebase проект

Следуйте подробной инструкции в [FIREBASE_SETUP.md](./FIREBASE_SETUP.md)

## Шаг 3: Запуск приложения

```bash
npm run dev
```

Приложение будет доступно по адресу: `http://localhost:5173`

## Шаг 4: Вход в систему

1. Откройте приложение в браузере
2. Используйте email и пароль диспетчера, созданного в Firebase Authentication
3. После входа вы попадете на главную страницу диспетчерской

## Что вы должны увидеть

### Главная страница (Dashboard)

- **Карта**: Google Maps с маркерами водителей
- **Список водителей** (слева): Все зарегистрированные водители с их статусами
- **Статистика** (справа): Количество водителей по статусам

### Статусы водителей

- 🟢 **Онлайн** - В сети, доступен для заказов
- 🟠 **Занят** - Выполняет заказ
- ⚪ **Оффлайн** - Не в сети

## Устранение проблем

### Карта не загружается

**Причина**: Не настроен Google Maps API Key или ключ неверный

**Решение**:
1. Убедитесь, что `VITE_GOOGLE_MAPS_API_KEY` указан в `.env.local`
2. Проверьте, что API ключ активен в [Google Cloud Console](https://console.cloud.google.com/)
3. Убедитесь, что включен Google Maps JavaScript API
4. Перезапустите dev сервер: `npm run dev`

### Водители не отображаются

**Причина 1**: Firebase не настроен или конфигурация неверна

**Решение**:
1. Проверьте консоль браузера на наличие ошибок Firebase
2. Убедитесь, что все переменные `VITE_FIREBASE_*` заполнены в `.env.local`
3. Проверьте правильность конфигурации в Firebase Console

**Причина 2**: Коллекции `drivers` и `driverLocations` пустые

**Решение**:
1. Откройте [Firebase Console](https://console.firebase.google.com/)
2. Перейдите в Firestore Database
3. Создайте тестовые данные согласно [FIREBASE_SETUP.md](./FIREBASE_SETUP.md#создание-тестовых-водителей)

**Причина 3**: Правила безопасности Firestore блокируют доступ

**Решение**:
1. Проверьте правила безопасности в Firebase Console → Firestore Database → Rules
2. Для тестирования можно временно использовать:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```
3. ⚠️ **Не используйте эти правила в продакшене!**

### Ошибка при входе: "Неверный логин или пароль"

**Решение**:
1. Убедитесь, что пользователь создан в Firebase Authentication
2. Проверьте правильность email и пароля
3. Убедитесь, что включен метод аутентификации Email/Password

### Ошибка: "Доступ запрещён"

**Причина**: UID пользователя не совпадает с `VITE_ADMIN_UID`

**Решение**:
1. Откройте Firebase Console → Authentication → Users
2. Скопируйте UID вашего пользователя
3. Добавьте его в `.env.local` как `VITE_ADMIN_UID`
4. Перезапустите dev сервер

## Проверка настройки

Откройте консоль браузера (F12) и проверьте:

✅ **Нет ошибок о недостающих переменных окружения**
✅ **Google Maps загрузилась**
✅ **Нет ошибок подключения к Firebase**
✅ **Данные водителей загружаются из Firestore**

## Следующие шаги

После успешного запуска:

1. 📱 Настройте мобильное приложение для водителей
2. 🗺️ Добавьте реальные данные водителей
3. 🔒 Настройте правила безопасности Firestore для продакшена
4. 🚀 Разверните приложение (см. README.md)

## Нужна помощь?

- 📖 [Полная документация по настройке Firebase](./FIREBASE_SETUP.md)
- 📖 [README.md](./README.md)
- 🔥 [Firebase Documentation](https://firebase.google.com/docs)
- 🗺️ [Google Maps API Documentation](https://developers.google.com/maps/documentation)








