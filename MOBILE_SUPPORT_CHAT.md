# Чат поддержки для мобильного приложения водителя

## 📱 Полный код для React Native

### 1. Создайте сервис для работы с чатами

**`services/SupportChatService.js`:**

```javascript
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

class SupportChatService {
  /**
   * Получить или создать чат для текущего водителя
   */
  async getOrCreateChat(driverData) {
    try {
      const userId = auth().currentUser?.uid;
      if (!userId) throw new Error('Не авторизован');

      // Ищем существующий чат
      const existingChats = await firestore()
        .collection('supportChats')
        .where('driverId', '==', userId)
        .where('status', '==', 'active')
        .get();

      if (!existingChats.empty) {
        // Возвращаем существующий чат
        const chatDoc = existingChats.docs[0];
        return {
          id: chatDoc.id,
          ...chatDoc.data(),
        };
      }

      // Создаем новый чат
      const newChatRef = await firestore()
        .collection('supportChats')
        .add({
          driverId: userId,
          driverName: `${driverData.firstName} ${driverData.lastName}`.trim(),
          driverPhone: driverData.phoneNumber || '',
          status: 'active',
          lastMessage: '',
          lastMessageTime: firestore.FieldValue.serverTimestamp(),
          lastMessageFrom: 'driver',
          unreadByDispatcher: 0,
          unreadByDriver: 0,
          createdAt: firestore.FieldValue.serverTimestamp(),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });

      const newChat = await newChatRef.get();
      return {
        id: newChat.id,
        ...newChat.data(),
      };
    } catch (error) {
      console.error('Ошибка getOrCreateChat:', error);
      throw error;
    }
  }

  /**
   * Отправить сообщение в чат
   */
  async sendMessage(chatId, text, driverName) {
    try {
      const userId = auth().currentUser?.uid;
      if (!userId) throw new Error('Не авторизован');

      // Добавляем сообщение
      await firestore()
        .collection('supportChats')
        .doc(chatId)
        .collection('messages')
        .add({
          chatId: chatId,
          senderId: userId,
          senderName: driverName,
          senderType: 'driver',
          text: text.trim(),
          isRead: false,
          createdAt: firestore.FieldValue.serverTimestamp(),
        });

      // Обновляем чат
      await firestore()
        .collection('supportChats')
        .doc(chatId)
        .update({
          lastMessage: text.trim(),
          lastMessageTime: firestore.FieldValue.serverTimestamp(),
          lastMessageFrom: 'driver',
          unreadByDispatcher: firestore.FieldValue.increment(1),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });

      console.log('✅ Сообщение отправлено');
      return true;
    } catch (error) {
      console.error('❌ Ошибка отправки сообщения:', error);
      throw error;
    }
  }

  /**
   * Подписаться на сообщения чата (real-time)
   */
  subscribeToMessages(chatId, callback) {
    return firestore()
      .collection('supportChats')
      .doc(chatId)
      .collection('messages')
      .orderBy('createdAt', 'asc')
      .onSnapshot((snapshot) => {
        const messages = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
        }));
        callback(messages);
      });
  }

  /**
   * Отметить сообщения как прочитанные
   */
  async markMessagesAsRead(chatId) {
    try {
      const userId = auth().currentUser?.uid;
      if (!userId) return;

      // Получаем все непрочитанные сообщения от диспетчера
      const unreadMessages = await firestore()
        .collection('supportChats')
        .doc(chatId)
        .collection('messages')
        .where('senderType', '==', 'dispatcher')
        .where('isRead', '==', false)
        .get();

      const batch = firestore().batch();

      // Отмечаем сообщения как прочитанные
      unreadMessages.docs.forEach((doc) => {
        batch.update(doc.ref, { isRead: true });
      });

      // Обнуляем счетчик непрочитанных для водителя
      const chatRef = firestore().collection('supportChats').doc(chatId);
      batch.update(chatRef, {
        unreadByDriver: 0,
      });

      await batch.commit();
    } catch (error) {
      console.error('Ошибка отметки сообщений:', error);
    }
  }
}

export default new SupportChatService();
```

---

### 2. Создайте экран чата поддержки

**`screens/SupportScreen.js`:**

```javascript
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SupportChatService from '../services/SupportChatService';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

const SupportScreen = () => {
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [chatId, setChatId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [driverData, setDriverData] = useState(null);
  const flatListRef = useRef(null);

  // Загружаем данные водителя
  useEffect(() => {
    const userId = auth().currentUser?.uid;
    if (!userId) return;

    const unsubscribe = firestore()
      .collection('drivers')
      .doc(userId)
      .onSnapshot((doc) => {
        if (doc.exists) {
          setDriverData(doc.data());
        }
      });

    return () => unsubscribe();
  }, []);

  // Инициализация чата
  useEffect(() => {
    if (!driverData) return;

    const initChat = async () => {
      try {
        const chat = await SupportChatService.getOrCreateChat(driverData);
        setChatId(chat.id);
        setLoading(false);
      } catch (error) {
        Alert.alert('Ошибка', 'Не удалось загрузить чат');
        setLoading(false);
      }
    };

    initChat();
  }, [driverData]);

  // Подписка на сообщения (real-time)
  useEffect(() => {
    if (!chatId) return;

    console.log('📨 Подписка на сообщения чата:', chatId);

    const unsubscribe = SupportChatService.subscribeToMessages(
      chatId,
      (newMessages) => {
        console.log('✅ Получено сообщений:', newMessages.length);
        setMessages(newMessages);
        
        // Отмечаем сообщения от диспетчера как прочитанные
        SupportChatService.markMessagesAsRead(chatId);
      }
    );

    return () => unsubscribe();
  }, [chatId]);

  // Автопрокрутка к новым сообщениям
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !chatId || !driverData) return;

    setSending(true);
    const textToSend = messageText.trim();
    setMessageText(''); // Очищаем поле сразу для UX

    try {
      const driverName = `${driverData.firstName} ${driverData.lastName}`.trim();
      await SupportChatService.sendMessage(chatId, textToSend, driverName);
      console.log('✅ Сообщение отправлено диспетчеру');
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось отправить сообщение');
      setMessageText(textToSend); // Возвращаем текст обратно
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }) => {
    const isMyMessage = item.senderType === 'driver';

    return (
      <View
        style={[
          styles.messageBubble,
          isMyMessage ? styles.myMessage : styles.otherMessage,
        ]}
      >
        {!isMyMessage && (
          <Text style={styles.senderName}>{item.senderName}</Text>
        )}
        <Text style={[
          styles.messageText,
          isMyMessage ? styles.myMessageText : styles.otherMessageText,
        ]}>
          {item.text}
        </Text>
        <View style={styles.messageFooter}>
          <Text style={[
            styles.messageTime,
            isMyMessage ? styles.myMessageTime : styles.otherMessageTime,
          ]}>
            {item.createdAt 
              ? new Date(item.createdAt).toLocaleTimeString('ru-RU', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : ''}
          </Text>
          {isMyMessage && item.isRead && (
            <Text style={styles.readIndicator}>✓✓</Text>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Загрузка чата...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Поддержка</Text>
          <Text style={styles.headerSubtitle}>
            Ответим в течение нескольких минут
          </Text>
        </View>

        {/* Список сообщений */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Нет сообщений</Text>
              <Text style={styles.emptySubtext}>
                Отправьте первое сообщение диспетчеру
              </Text>
            </View>
          }
        />

        {/* Поле ввода */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Введите сообщение..."
            placeholderTextColor="#999"
            value={messageText}
            onChangeText={setMessageText}
            multiline
            maxLength={500}
            editable={!sending}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!messageText.trim() || sending) && styles.sendButtonDisabled,
            ]}
            onPress={handleSendMessage}
            disabled={!messageText.trim() || sending}
          >
            <Text style={styles.sendButtonText}>
              {sending ? '...' : '➤'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#4CAF50',
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: '#000',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  messageTime: {
    fontSize: 11,
  },
  myMessageTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  otherMessageTime: {
    color: '#999',
  },
  readIndicator: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    maxHeight: 100,
    fontSize: 15,
    color: '#000',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
});

export default SupportScreen;
```

---

### 3. Добавьте в навигацию

**`navigation/AppNavigator.js`:**

```javascript
import SupportScreen from '../screens/SupportScreen';

// В Stack.Navigator:
<Stack.Screen 
  name="Support" 
  component={SupportScreen}
  options={{
    title: 'Поддержка',
    headerShown: true,
  }}
/>
```

---

### 4. Добавьте кнопку на главный экран

**В главном экране водителя:**

```javascript
<TouchableOpacity
  style={styles.supportButton}
  onPress={() => navigation.navigate('Support')}
>
  <MessageSquare size={24} color="#4CAF50" />
  <Text style={styles.supportButtonText}>Написать в поддержку</Text>
</TouchableOpacity>
```

---

## 🔄 Как это работает

### Водитель отправляет сообщение:

```
Водитель нажимает "Отправить"
    ↓
Сообщение → Firebase (supportChats/{chatId}/messages)
    ↓
Диспетчерская получает через onSnapshot (real-time)
    ↓
Сообщение появляется МГНОВЕННО в диспетчерской!
```

### Диспетчер отвечает:

```
Диспетчер вводит ответ и нажимает "Отправить"
    ↓
Сообщение → Firebase (supportChats/{chatId}/messages)
    ↓
Мобильное приложение получает через onSnapshot
    ↓
Сообщение появляется МГНОВЕННО у водителя!
```

---

## ✅ Функции которые уже реализованы

### В диспетчерской:
- ✅ Real-time обновление списка чатов
- ✅ Real-time обновление сообщений
- ✅ Индикатор непрочитанных сообщений
- ✅ Отметка сообщений как прочитанных
- ✅ Закрытие обращений
- ✅ Информация о водителе

### В мобильном приложении (код выше):
- ✅ Автоматическое создание чата при первом сообщении
- ✅ Real-time получение сообщений от диспетчера
- ✅ Отметка сообщений как прочитанных
- ✅ Индикатор "прочитано" ✓✓
- ✅ Автопрокрутка к новым сообщениям

---

## 🚀 Тестирование

### Тест 1: Первое сообщение водителя

1. Откройте мобильное приложение
2. Перейдите на экран "Поддержка"
3. Введите: "Здравствуйте, нужна помощь"
4. Нажмите "Отправить"
5. ✅ В диспетчерской должен появиться новый чат **мгновенно**

### Тест 2: Ответ диспетчера

1. В диспетчерской перейдите на вкладку "Поддержка"
2. Выберите чат водителя
3. Введите: "Здравствуйте! Как могу помочь?"
4. Нажмите "Отправить"
5. ✅ В мобильном приложении сообщение появится **мгновенно**

### Тест 3: Непрочитанные сообщения

1. Водитель отправляет сообщение
2. ✅ В диспетчерской появляется красная цифра "1"
3. Диспетчер открывает чат
4. ✅ Цифра исчезает (сообщения отмечены как прочитанные)

---

**Всё готово!** 🎉 Осталось только добавить этот код в мобильное приложение!








