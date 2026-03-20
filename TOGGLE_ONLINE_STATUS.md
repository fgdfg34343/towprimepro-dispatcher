# Переключатель статуса "В сети" для мобильного приложения

## 🎯 Задача

Когда водитель переключает "В сети" → диспетчерская автоматически показывает "Онлайн"  
Когда водитель переключает "Не в сети" → диспетчерская показывает "Оффлайн"

## ✅ Диспетчерская УЖЕ ГОТОВА!

Диспетчерская использует **Firebase Real-Time Listeners** (`onSnapshot`), поэтому:
- ✅ Изменения отображаются **мгновенно** без перезагрузки страницы
- ✅ Статус обновляется **автоматически**
- ✅ Координаты на карте обновляются в **реальном времени**

**Нужно только настроить мобильное приложение!**

---

## 📱 Код для мобильного приложения (React Native)

### 1. Установите зависимости (если еще не установлены)

```bash
npm install firebase
npm install @react-native-firebase/firestore
npm install @react-native-firebase/auth
```

### 2. Создайте сервис для управления статусом

**`services/onlineStatusService.js`:**

```javascript
import firestore from '@react-native-firebase/firestore';
import Geolocation from '@react-native-community/geolocation';
import auth from '@react-native-firebase/auth';

class OnlineStatusService {
  constructor() {
    this.locationInterval = null;
    this.isOnline = false;
  }

  /**
   * Включить статус "В сети"
   */
  async goOnline(driverData) {
    try {
      const userId = auth().currentUser?.uid;
      if (!userId) {
        throw new Error('Пользователь не авторизован');
      }

      // Получаем текущие координаты
      const position = await this.getCurrentPosition();

      // КРИТИЧНО! Обновляем driverLocations
      await firestore()
        .collection('driverLocations')
        .doc(userId)
        .set({
          driverId: userId,
          name: `${driverData.firstName} ${driverData.lastName}`.trim(),
          phoneNumber: driverData.phoneNumber || '',
          vehicleType: driverData.vehicleType || '',
          status: 'online', // ← ВАЖНО! "online" когда в сети
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          isVerified: true,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

      this.isOnline = true;

      // Запускаем обновление координат каждые 30 секунд
      this.startLocationUpdates(userId);

      console.log('✅ Водитель онлайн');
      return true;
    } catch (error) {
      console.error('❌ Ошибка goOnline:', error);
      throw error;
    }
  }

  /**
   * Выключить статус "Не в сети"
   */
  async goOffline() {
    try {
      const userId = auth().currentUser?.uid;
      if (!userId) {
        throw new Error('Пользователь не авторизован');
      }

      // Останавливаем обновление координат
      this.stopLocationUpdates();

      // КРИТИЧНО! Обновляем статус на offline
      await firestore()
        .collection('driverLocations')
        .doc(userId)
        .update({
          status: 'offline', // ← "offline" когда не в сети
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });

      this.isOnline = false;

      console.log('✅ Водитель оффлайн');
      return true;
    } catch (error) {
      console.error('❌ Ошибка goOffline:', error);
      throw error;
    }
  }

  /**
   * Запустить обновление координат (каждые 30 секунд)
   */
  startLocationUpdates(userId) {
    // Останавливаем если уже запущено
    this.stopLocationUpdates();

    // Обновляем координаты каждые 30 секунд
    this.locationInterval = setInterval(async () => {
      try {
        const position = await this.getCurrentPosition();
        
        await firestore()
          .collection('driverLocations')
          .doc(userId)
          .update({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            updatedAt: firestore.FieldValue.serverTimestamp(),
          });

        console.log('📍 Координаты обновлены');
      } catch (error) {
        console.error('❌ Ошибка обновления координат:', error);
      }
    }, 30000); // 30 секунд
  }

  /**
   * Остановить обновление координат
   */
  stopLocationUpdates() {
    if (this.locationInterval) {
      clearInterval(this.locationInterval);
      this.locationInterval = null;
    }
  }

  /**
   * Получить текущие координаты
   */
  getCurrentPosition() {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (position) => resolve(position),
        (error) => reject(error),
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000,
        }
      );
    });
  }

  /**
   * Проверить текущий статус
   */
  getIsOnline() {
    return this.isOnline;
  }
}

export default new OnlineStatusService();
```

### 3. Компонент переключателя "В сети"

**`components/OnlineToggle.js`:**

```javascript
import React, { useState, useEffect } from 'react';
import { View, Text, Switch, StyleSheet, Alert } from 'react-native';
import onlineStatusService from '../services/onlineStatusService';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

const OnlineToggle = ({ driverData }) => {
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(false);

  // Слушаем изменения статуса в реальном времени
  useEffect(() => {
    const userId = auth().currentUser?.uid;
    if (!userId) return;

    const unsubscribe = firestore()
      .collection('driverLocations')
      .doc(userId)
      .onSnapshot((doc) => {
        if (doc.exists) {
          const data = doc.data();
          setIsOnline(data.status === 'online');
        }
      });

    return () => unsubscribe();
  }, []);

  const handleToggle = async (value) => {
    setLoading(true);
    
    try {
      if (value) {
        // Включить "В сети"
        await onlineStatusService.goOnline(driverData);
        Alert.alert('✅ Успешно', 'Вы в сети! Теперь вы можете получать заказы.');
      } else {
        // Выключить "Не в сети"
        await onlineStatusService.goOffline();
        Alert.alert('ℹ️ Оффлайн', 'Вы не в сети. Заказы не будут приходить.');
      }
    } catch (error) {
      Alert.alert('❌ Ошибка', error.message);
      console.error('Ошибка переключения статуса:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.statusContainer}>
        <View style={[styles.statusDot, isOnline ? styles.online : styles.offline]} />
        <Text style={styles.statusText}>
          {isOnline ? '🟢 В сети' : '⚪ Не в сети'}
        </Text>
      </View>
      
      <Switch
        value={isOnline}
        onValueChange={handleToggle}
        disabled={loading}
        trackColor={{ false: '#767577', true: '#4CAF50' }}
        thumbColor={isOnline ? '#fff' : '#f4f3f4'}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  online: {
    backgroundColor: '#4CAF50',
  },
  offline: {
    backgroundColor: '#9E9E9E',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default OnlineToggle;
```

### 4. Использование в главном экране водителя

**`screens/DriverMainScreen.js`:**

```javascript
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import OnlineToggle from '../components/OnlineToggle';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

const DriverMainScreen = () => {
  const [driverData, setDriverData] = useState(null);

  useEffect(() => {
    const userId = auth().currentUser?.uid;
    if (!userId) return;

    // Загружаем данные водителя
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

  if (!driverData) {
    return <Text>Загрузка...</Text>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Главная</Text>
      
      {/* Переключатель статуса */}
      <OnlineToggle driverData={driverData} />
      
      {/* Остальной контент */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
});

export default DriverMainScreen;
```

---

## 🧪 Как протестировать

### Вариант 1: С реальным мобильным приложением

1. **В мобильном приложении:** Переключите "В сети"
2. **В диспетчерской:** Статус должен измениться на "🟢 Онлайн" (без перезагрузки!)
3. **В мобильном приложении:** Переключите "Не в сети"
4. **В диспетчерской:** Статус должен измениться на "⚪ Оффлайн"

### Вариант 2: Тестирование через Firebase Console (пока нет мобильного)

1. Откройте Firebase Console → Firestore → `driverLocations`
2. Найдите документ водителя `XVhFITK6PWgzWa8l3BLftJQNGCx2`
3. **Измените поле `status` на `"online"`**
4. Нажмите **Save**
5. **Откройте диспетчерскую** → статус должен измениться на "🟢 Онлайн" **БЕЗ перезагрузки!**
6. **Измените обратно на `"offline"`**
7. Статус в диспетчерской должен стать "⚪ Оффлайн"

---

## 📊 Структура данных в driverLocations

После включения "В сети" в Firestore должно быть:

```javascript
// Коллекция: driverLocations
// Документ ID: XVhFITK6PWgzWa8l3BLftJQNGCx2

{
  driverId: "XVhFITK6PWgzWa8l3BLftJQNGCx2",
  name: "yk y",
  phoneNumber: "+7hhhhhhhhhh",
  vehicleType: "Эвакуатор",
  status: "online",  // ← ВАЖНО! Меняется при переключении
  lat: 55.7558,      // ← Обновляется каждые 30 сек
  lng: 37.6173,
  isVerified: true,
  updatedAt: <timestamp>
}
```

---

## ✅ Проверочный список

### Для диспетчерской (УЖЕ ГОТОВО):
- ✅ Real-time слушатель на `driverLocations`
- ✅ Автоматическое обновление статуса
- ✅ Отображение на карте
- ✅ Цветные маркеры (зеленый/серый/оранжевый)

### Для мобильного приложения (НУЖНО СДЕЛАТЬ):
- [ ] Создать сервис `onlineStatusService.js`
- [ ] Создать компонент `OnlineToggle.js`
- [ ] Добавить переключатель на главный экран
- [ ] Запросить разрешение на геолокацию
- [ ] Протестировать переключение статуса

---

## 🚨 Важные моменты

1. **Разрешения геолокации**: Не забудьте запросить в `AndroidManifest.xml` и `Info.plist`
2. **Фоновый режим**: Для обновления координат в фоне нужны дополнительные разрешения
3. **Батарея**: Обновление каждые 30 секунд оптимально (не слишком часто, не слишком редко)
4. **Ошибки сети**: Добавьте обработку ошибок сети в `onlineStatusService`

---

## 🎯 Итоговый результат

После реализации:

**В мобильном приложении:**
- Водитель видит переключатель "В сети" / "Не в сети"
- При включении → статус сразу меняется на "🟢 В сети"
- Координаты обновляются автоматически каждые 30 секунд

**В диспетчерской:**
- Статус обновляется **мгновенно** (без перезагрузки)
- Водитель появляется на карте с зеленым маркером
- При выключении → маркер становится серым
- Координаты обновляются в реальном времени

**ВСЁ РАБОТАЕТ АВТОМАТИЧЕСКИ!** 🚀









