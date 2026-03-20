# Интеграция мобильного приложения с диспетчерской

## 🎯 Критически важно!

Для того чтобы водители отображались в диспетчерской в реальном времени, мобильное приложение ДОЛЖНО выполнять следующие действия:

---

## 1. 📸 Загрузка документов

### Правильная структура в Firestore

После загрузки документов в Storage, сохраните данные в Firestore так:

```javascript
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebaseConfig';

// После загрузки файла в Storage
const uploadDocument = async (userId, documentType, fileUri) => {
  // 1. Загрузите файл в Storage
  const filename = `${documentType}_${Date.now()}.jpg`;
  const storageRef = ref(storage, `drivers/${userId}/${filename}`);
  
  const response = await fetch(fileUri);
  const blob = await response.blob();
  await uploadBytes(storageRef, blob);
  
  // 2. Получите URL
  const downloadURL = await getDownloadURL(storageRef);
  
  // 3. КРИТИЧНО! Сохраните в Firestore с правильной структурой
  await setDoc(doc(db, "drivers", userId), {
    documents: {
      [documentType]: {
        imageUrl: downloadURL,  // ← ОБЯЗАТЕЛЬНО!
        imagePath: `drivers/${userId}/${filename}`,  // ← Путь для резерва
        status: "pending",
        uploadedAt: serverTimestamp()
      }
    }
  }, { merge: true });
};

// Пример использования
await uploadDocument(userId, "driverLicense", photoUri);
await uploadDocument(userId, "carRegistration", photoUri);
await uploadDocument(userId, "carPhoto", photoUri);
```

### Типы документов:
- `driverLicense` - Водительское удостоверение
- `carRegistration` - СТС
- `carPhoto` - Фото автомобиля
- `passport` - Паспорт (опционально)
- `insurance` - Страховка (опционально)

---

## 2. 🗺️ Обновление статуса "В сети" / "Не в сети"

### ✅ КРИТИЧНО! Это самое главное для отображения водителя в диспетчерской

```javascript
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebaseConfig';

// Функция для включения "В сети"
export const goOnline = async (userId, driverName) => {
  try {
    // Получите текущие координаты
    const position = await getCurrentPosition();
    
    // СОЗДАЙТЕ или ОБНОВИТЕ запись в driverLocations
    await setDoc(doc(db, "driverLocations", userId), {
      driverId: userId,
      name: driverName,
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      status: "online",  // ← ВАЖНО! "online" когда в сети
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    console.log("✅ Водитель онлайн");
  } catch (error) {
    console.error("❌ Ошибка goOnline:", error);
  }
};

// Функция для выключения "Не в сети"
export const goOffline = async (userId) => {
  try {
    await updateDoc(doc(db, "driverLocations", userId), {
      status: "offline",  // ← "offline" когда не в сети
      updatedAt: serverTimestamp()
    });
    
    console.log("✅ Водитель оффлайн");
  } catch (error) {
    console.error("❌ Ошибка goOffline:", error);
  }
};

// Функция для обновления координат (вызывать каждые 30 секунд когда водитель онлайн)
export const updateLocation = async (userId) => {
  try {
    const position = await getCurrentPosition();
    
    await updateDoc(doc(db, "driverLocations", userId), {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      updatedAt: serverTimestamp()
    });
    
    console.log("✅ Координаты обновлены");
  } catch (error) {
    console.error("❌ Ошибка updateLocation:", error);
  }
};

// Функция получения координат
const getCurrentPosition = () => {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0
    });
  });
};
```

### Использование в React Native компоненте:

```javascript
import React, { useState, useEffect } from 'react';
import { Switch, View, Text } from 'react-native';
import { goOnline, goOffline, updateLocation } from './locationService';

const OnlineToggle = ({ userId, driverName }) => {
  const [isOnline, setIsOnline] = useState(false);
  const [intervalId, setIntervalId] = useState(null);
  
  const handleToggle = async (value) => {
    setIsOnline(value);
    
    if (value) {
      // Включить "В сети"
      await goOnline(userId, driverName);
      
      // Запустить обновление координат каждые 30 секунд
      const id = setInterval(() => {
        updateLocation(userId);
      }, 30000);
      
      setIntervalId(id);
    } else {
      // Выключить "Не в сети"
      await goOffline(userId);
      
      // Остановить обновление координат
      if (intervalId) {
        clearInterval(intervalId);
        setIntervalId(null);
      }
    }
  };
  
  useEffect(() => {
    // Очистка при размонтировании
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [intervalId]);
  
  return (
    <View>
      <Text>{isOnline ? "🟢 В сети" : "⚪ Не в сети"}</Text>
      <Switch value={isOnline} onValueChange={handleToggle} />
    </View>
  );
};

export default OnlineToggle;
```

---

## 3. 📊 Структура данных в Firestore

### Коллекция `drivers` (создается при регистрации):

```javascript
{
  "firstName": "Имя",
  "lastName": "Фамилия",
  "phoneNumber": "+79991234567",
  "vehicleType": "Эвакуатор",
  "email": "driver@example.com",
  "createdAt": <timestamp>,
  "updatedAt": <timestamp>,
  
  // Статус верификации (обновляется диспетчером)
  "verified": false,
  "isVerified": false,
  "verificationStatus": "pending",
  
  // Документы (загружает водитель)
  "documents": {
    "driverLicense": {
      "imageUrl": "https://firebasestorage.googleapis.com/...",
      "imagePath": "drivers/USER_ID/driverLicense_123.jpg",
      "status": "pending",
      "uploadedAt": <timestamp>
    },
    "carRegistration": {
      "imageUrl": "https://firebasestorage.googleapis.com/...",
      "imagePath": "drivers/USER_ID/carRegistration_123.jpg",
      "status": "pending",
      "uploadedAt": <timestamp>
    },
    "carPhoto": {
      "imageUrl": "https://firebasestorage.googleapis.com/...",
      "imagePath": "drivers/USER_ID/carPhoto_123.jpg",
      "status": "pending",
      "uploadedAt": <timestamp>
    }
  }
}
```

### Коллекция `driverLocations` (создает/обновляет мобильное приложение):

```javascript
{
  "driverId": "USER_ID",
  "name": "Имя Фамилия",
  "phoneNumber": "+79991234567",
  "vehicleType": "Эвакуатор",
  "status": "online",  // или "offline", "busy"
  "lat": 55.7558,
  "lng": 37.6173,
  "updatedAt": <timestamp>
}
```

**ID документа в `driverLocations` ДОЛЖЕН быть таким же как USER_ID в `drivers`!**

---

## 4. 🔄 Когда обновлять данные

### При регистрации:
- Создать документ в `drivers` с базовой информацией

### После успешной загрузки документов:
- Обновить поле `documents` в `drivers`

### При включении "В сети":
- Создать/обновить документ в `driverLocations` с `status: "online"`
- Запустить таймер обновления координат (каждые 30 сек)

### При выключении "Не в сети":
- Обновить `status: "offline"` в `driverLocations`
- Остановить таймер обновления координат

### При получении заказа:
- Обновить `status: "busy"` в `driverLocations`

### При завершении заказа:
- Обновить `status: "online"` в `driverLocations`

---

## 5. 🚨 Частые ошибки

### ❌ Неправильно:
```javascript
// Нет imageUrl!
documents: {
  driverLicense: {
    imagePath: "drivers/123/file.jpg"  // ← Только путь, диспетчерская не увидит фото
  }
}
```

### ✅ Правильно:
```javascript
documents: {
  driverLicense: {
    imageUrl: "https://firebasestorage.googleapis.com/...",  // ← ОБЯЗАТЕЛЬНО!
    imagePath: "drivers/123/file.jpg",
    status: "pending",
    uploadedAt: serverTimestamp()
  }
}
```

---

## 6. ✅ Проверка что все работает

### После включения "В сети" в мобильном приложении:

1. Откройте Firebase Console → Firestore Database → `driverLocations`
2. Должна появиться запись с вашим USER_ID
3. Проверьте поля:
   - `status: "online"` ✅
   - `lat` и `lng` с реальными координатами ✅
   - `updatedAt` с текущим временем ✅

4. Откройте диспетчерскую в браузере
5. Перейдите на вкладку "Водители"
6. Ваш профиль должен показывать статус "🟢 Онлайн"
7. На карте должен появиться зеленый маркер с вашим местоположением

---

## 7. 📱 Пример полной интеграции

```javascript
// services/driverService.js
import { doc, setDoc, updateDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '../firebaseConfig';

class DriverService {
  constructor() {
    this.locationInterval = null;
    this.userId = null;
  }
  
  // Инициализация при входе
  async initialize() {
    this.userId = auth.currentUser?.uid;
    
    // Слушаем изменения статуса верификации
    if (this.userId) {
      onSnapshot(doc(db, "drivers", this.userId), (doc) => {
        const data = doc.data();
        if (data?.isVerified) {
          console.log("✅ Вы верифицированы!");
          // Разрешить доступ к функциям водителя
        }
      });
    }
  }
  
  // Загрузка документа
  async uploadDocument(documentType, fileUri) {
    if (!this.userId) throw new Error("Не авторизован");
    
    const filename = `${documentType}_${Date.now()}.jpg`;
    const storageRef = ref(storage, `drivers/${this.userId}/${filename}`);
    
    const response = await fetch(fileUri);
    const blob = await response.blob();
    await uploadBytes(storageRef, blob);
    
    const downloadURL = await getDownloadURL(storageRef);
    
    await setDoc(doc(db, "drivers", this.userId), {
      documents: {
        [documentType]: {
          imageUrl: downloadURL,
          imagePath: `drivers/${this.userId}/${filename}`,
          status: "pending",
          uploadedAt: serverTimestamp()
        }
      }
    }, { merge: true });
  }
  
  // Включить "В сети"
  async goOnline() {
    if (!this.userId) throw new Error("Не авторизован");
    
    const position = await this.getCurrentPosition();
    const driverDoc = await getDoc(doc(db, "drivers", this.userId));
    const driverData = driverDoc.data();
    const name = `${driverData.firstName} ${driverData.lastName}`.trim();
    
    await setDoc(doc(db, "driverLocations", this.userId), {
      driverId: this.userId,
      name: name,
      phoneNumber: driverData.phoneNumber || "",
      vehicleType: driverData.vehicleType || "",
      status: "online",
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    // Запустить обновление координат
    this.startLocationUpdates();
  }
  
  // Выключить "Не в сети"
  async goOffline() {
    if (!this.userId) throw new Error("Не авторизован");
    
    await updateDoc(doc(db, "driverLocations", this.userId), {
      status: "offline",
      updatedAt: serverTimestamp()
    });
    
    // Остановить обновление координат
    this.stopLocationUpdates();
  }
  
  // Начать обновление координат
  startLocationUpdates() {
    this.stopLocationUpdates(); // Остановить если уже запущен
    
    this.locationInterval = setInterval(async () => {
      try {
        const position = await this.getCurrentPosition();
        await updateDoc(doc(db, "driverLocations", this.userId), {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        console.error("Ошибка обновления координат:", error);
      }
    }, 30000); // каждые 30 секунд
  }
  
  // Остановить обновление координат
  stopLocationUpdates() {
    if (this.locationInterval) {
      clearInterval(this.locationInterval);
      this.locationInterval = null;
    }
  }
  
  // Получить текущие координаты
  getCurrentPosition() {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      });
    });
  }
}

export default new DriverService();
```

---

**Важно**: После выполнения всех действий перезапустите мобильное приложение и проверьте!










