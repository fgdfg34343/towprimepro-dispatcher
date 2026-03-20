# Структура данных для чата поддержки

## 📊 Firestore Collections

### 1. Коллекция `supportChats`

Хранит информацию о чатах между водителями и диспетчером.

**Документ ID**: Автогенерированный ID чата

```javascript
{
  chatId: "auto_generated_id",
  driverId: "USER_ID_водителя",
  driverName: "Имя Фамилия",
  driverPhone: "+79991234567",
  status: "active", // "active", "closed", "pending"
  lastMessage: "Последнее сообщение...",
  lastMessageTime: <timestamp>,
  lastMessageFrom: "driver", // "driver" или "dispatcher"
  unreadByDispatcher: 5, // Количество непрочитанных диспетчером
  unreadByDriver: 0, // Количество непрочитанных водителем
  createdAt: <timestamp>,
  updatedAt: <timestamp>
}
```

### 2. Подколлекция `supportChats/{chatId}/messages`

Хранит все сообщения в чате.

**Документ ID**: Автогенерированный ID сообщения

```javascript
{
  messageId: "auto_generated_id",
  chatId: "parent_chat_id",
  senderId: "USER_ID_отправителя",
  senderName: "Имя отправителя",
  senderType: "driver", // "driver" или "dispatcher"
  text: "Текст сообщения",
  imageUrl: null, // Опционально - URL фото
  isRead: false, // Прочитано ли сообщение получателем
  createdAt: <timestamp>
}
```

---

## 🔄 Сценарии использования

### Сценарий 1: Водитель отправляет первое сообщение

1. **Мобильное приложение проверяет** - есть ли уже чат для этого водителя
2. Если нет - **создает новый чат** в `supportChats`
3. **Добавляет сообщение** в `supportChats/{chatId}/messages`
4. **Обновляет чат** (`lastMessage`, `lastMessageTime`, `unreadByDispatcher++`)

### Сценарий 2: Диспетчер видит новый чат

1. **Real-time listener** (`onSnapshot`) получает новый чат
2. **Чат появляется** в левой колонке с индикатором 🔸
3. Диспетчер **открывает чат**
4. Сообщения отмечаются как **прочитанные** (`unreadByDispatcher = 0`)

### Сценарий 3: Диспетчер отвечает

1. Диспетчер **вводит текст** и нажимает "Отправить"
2. Сообщение **добавляется** в `messages`
3. Чат **обновляется** (`lastMessage`, `lastMessageFrom = "dispatcher"`, `unreadByDriver++`)
4. **Мобильное приложение** получает обновление через `onSnapshot`
5. Водитель **видит ответ** мгновенно

### Сценарий 4: Закрытие обращения

1. Диспетчер нажимает **"Закрыть обращение"**
2. Статус чата меняется на **`"closed"`**
3. Чат **перемещается** в архив (или фильтруется из активных)

---

## 📱 Firebase Security Rules для чата

Добавьте в `firestore.rules`:

```javascript
// Чаты поддержки
match /supportChats/{chatId} {
  allow read: if isAuthenticated();
  allow create: if isAuthenticated();
  allow update: if isAuthenticated();
  
  // Подколлекция сообщений
  match /messages/{messageId} {
    allow read: if isAuthenticated();
    allow create: if isAuthenticated();
    allow update: if isAuthenticated();
  }
}
```

---

## 🎨 UI компоненты

### Для диспетчерской:
1. `SupportChatsList.tsx` - список всех чатов (левая колонка)
2. `ChatWindow.tsx` - окно активного чата (центр/право)
3. `MessageBubble.tsx` - компонент отдельного сообщения
4. `ChatInput.tsx` - поле ввода сообщения

### Для мобильного приложения:
1. `SupportScreen.js` - главный экран поддержки
2. `ChatMessage.js` - компонент сообщения
3. `ChatInput.js` - поле ввода

---

Это базовая структура для реализации!








