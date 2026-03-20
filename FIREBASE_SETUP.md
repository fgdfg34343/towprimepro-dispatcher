# Настройка Firebase для TowTruck Dispatcher

Это руководство поможет вам настроить Firebase для работы диспетчерской системы.

## 1. Создание проекта Firebase

1. Перейдите в [Firebase Console](https://console.firebase.google.com/)
2. Нажмите "Добавить проект" (Add project)
3. Введите имя проекта (например, "towtruck-dispatch")
4. Следуйте инструкциям мастера создания проекта

## 2. Настройка Firebase Authentication

1. В Firebase Console откройте раздел **Authentication**
2. Нажмите "Начать" (Get started)
3. Включите метод аутентификации **Email/Password**:
   - Нажмите на "Email/Password"
   - Включите переключатель "Enable"
   - Нажмите "Save"

### Создание пользователя диспетчера

1. Перейдите на вкладку **Users**
2. Нажмите "Add user"
3. Введите email (например, `dispatcher@towtruck.ru`)
4. Введите пароль
5. Нажмите "Add user"
6. **ВАЖНО**: Скопируйте **User UID** созданного пользователя
7. Добавьте этот UID в `.env.local` как `VITE_ADMIN_UID`

## 3. Настройка Firestore Database

1. В Firebase Console откройте раздел **Firestore Database**
2. Нажмите "Create database"
3. Выберите режим запуска:
   - **Production mode** для продакшена
   - **Test mode** для разработки (будет работать 30 дней)
4. Выберите регион (например, `europe-west1` для Европы)

### Настройка правил безопасности

1. В Firestore Database перейдите на вкладку **Rules**
2. Скопируйте содержимое файла `firestore.rules` из корня проекта
3. Вставьте в редактор правил
4. Нажмите "Publish"

### Создание коллекций и тестовых данных

#### Создание коллекции настроек (settings)

1. В Firestore создайте коллекцию `settings`
2. Добавьте документ с ID `adminConfig`
3. Добавьте поле:
   - `adminUid` (string): ваш User UID из шага 2

#### Создание тестовых водителей

Создайте коллекцию `drivers` и добавьте документы (примеры):

**Документ 1**: ID = `AothwaliUXk7tcsXsH8d` (или любой автогенерированный)
```json
{
  "firstName": "Владимир",
  "lastName": "Хачатрян",
  "phoneNumber": "+79991112233",
  "vehicleType": "Эвакуатор",
  "isVerified": true,
  "createdAt": "2024-10-14T08:44:00Z",
  "updatedAt": "2024-10-14T08:44:00Z"
}
```

**Документ 2**: ID = `4hsNjSnFZSWqDxQgVZ0vufyhXj2`
```json
{
  "firstName": "Иван",
  "lastName": "Петров",
  "phoneNumber": "+79221234567",
  "vehicleType": "Манипулятор",
  "isVerified": false,
  "createdAt": "2024-10-13T15:14:00Z",
  "updatedAt": "2024-10-13T15:14:00Z"
}
```

#### Создание местоположений водителей

Создайте коллекцию `driverLocations` и добавьте документы с теми же ID, что и водители:

**Документ 1**: ID = `AothwaliUXk7tcsXsH8d`
```json
{
  "driverId": "AothwaliUXk7tcsXsH8d",
  "name": "Владимир Хачатрян",
  "lat": 55.7558,
  "lng": 37.6173,
  "status": "online",
  "updatedAt": "2024-10-15T23:10:00Z"
}
```

**Документ 2**: ID = `4hsNjSnFZSWqDxQgVZ0vufyhXj2`
```json
{
  "driverId": "4hsNjSnFZSWqDxQgVZ0vufyhXj2",
  "name": "Иван Петров",
  "lat": 55.7614,
  "lng": 37.6242,
  "status": "busy",
  "updatedAt": "2024-10-15T23:10:00Z"
}
```

## 4. Получение конфигурации для .env.local

1. В Firebase Console перейдите в **Project Settings** (иконка шестеренки)
2. Прокрутите вниз до раздела **Your apps**
3. Нажмите на иконку веб-приложения `</>`
4. Зарегистрируйте приложение (App nickname: "TowTruck Web")
5. Скопируйте конфигурацию `firebaseConfig`
6. Добавьте значения в `.env.local`:

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

## 5. Проверка настройки

1. Убедитесь, что все переменные в `.env.local` заполнены
2. Перезапустите dev сервер: `npm run dev`
3. Откройте приложение в браузере
4. Войдите используя email и пароль диспетчера
5. Проверьте, что водители отображаются на карте и в списке

## Важные замечания

### Безопасность

- **Никогда не коммитьте `.env.local`** в git
- `.env.local` уже добавлен в `.gitignore`
- Для продакшена используйте строгие правила безопасности Firestore
- Регулярно проверяйте логи доступа в Firebase Console

### Структура данных

#### Коллекция `drivers`
- **ID документа**: Автогенерированный Firebase ID
- Хранит профильную информацию водителя
- Обновляется при регистрации/верификации

#### Коллекция `driverLocations`
- **ID документа**: Тот же ID, что у водителя в `drivers`
- Хранит текущее местоположение и статус
- Обновляется в реальном времени мобильным приложением водителя

#### Статусы водителей
- `online` - В сети, доступен для заказов
- `busy` - Занят, выполняет заказ
- `offline` - Не в сети

#### Верификация водителей
- `isVerified: true` - Водитель проверен администратором
- `isVerified: false` - Ожидает проверки

## Дополнительные ресурсы

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase Authentication](https://firebase.google.com/docs/auth)








