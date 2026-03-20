import { doc, updateDoc, serverTimestamp, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";

/**
 * Верифицирует водителя в системе и создает запись в driverLocations
 */
export async function verifyDriver(driverId: string): Promise<void> {
  console.log(`🔄 [Верификация] Начало верификации водителя ${driverId}`);

  try {
    const driverRef = doc(db, "drivers", driverId);

    // Обновляем статус верификации
    console.log(`📝 [Верификация] Обновление статуса в drivers...`);
    await updateDoc(driverRef, {
      verified: true,
      isVerified: true,
      can_work: true,
      inn_verified: true,
      verifiedAt: serverTimestamp(),
      verificationStatus: "approved",
      verificationMessage: "Вы прошли верификацию! Теперь вы можете принимать заказы.",
    });
    console.log(`✅ [Верификация] Статус в drivers обновлен`);

    // Получаем данные водителя для создания записи в driverLocations
    console.log(`📖 [Верификация] Получение данных водителя...`);
    const driverSnap = await getDoc(driverRef);

    if (!driverSnap.exists()) {
      console.error(`❌ [Верификация] Документ водителя не найден!`);
      throw new Error("Документ водителя не найден");
    }

    const driverData = driverSnap.data();
    console.log(`📋 [Верификация] Данные водителя:`, driverData);

    const fullName = `${driverData.firstName || ""} ${driverData.lastName || ""}`.trim();
    console.log(`👤 [Верификация] Полное имя: ${fullName}`);

    // Создаем или обновляем запись в driverLocations
    const locationRef = doc(db, "driverLocations", driverId);
    const locationData = {
      driverId: driverId,
      name: fullName || driverData.name || "Водитель",
      phoneNumber: driverData.phoneNumber || "",
      vehicleType: driverData.vehicleType || "",
      status: "offline", // По умолчанию offline, пока водитель не включит "в сети" в приложении
      lat: 55.7558, // Координаты Москвы по умолчанию
      lng: 37.6173,
      isVerified: true,
      updatedAt: serverTimestamp(),
    };

    console.log(`🗺️ [Верификация] Создание записи в driverLocations:`, locationData);
    await setDoc(locationRef, locationData, { merge: true });
    console.log(`✅ [Верификация] Запись в driverLocations создана успешно!`);

    console.log(`🎉 [Верификация] Водитель ${driverId} успешно верифицирован и добавлен в driverLocations`);
  } catch (error) {
    console.error(`❌ [Верификация] Ошибка верификации водителя ${driverId}:`, error);
    if (error instanceof Error) {
      console.error(`❌ [Верификация] Детали ошибки:`, error.message, error.stack);
    }
    throw new Error("Не удалось верифицировать водителя: " + (error instanceof Error ? error.message : String(error)));
  }
}

/**
 * Отклоняет верификацию водителя
 */
export async function rejectDriver(driverId: string, reason: string): Promise<void> {
  try {
    const driverRef = doc(db, "drivers", driverId);
    await updateDoc(driverRef, {
      verified: false,
      isVerified: false,
      can_work: false,
      verificationStatus: "rejected",
      verificationMessage: `Отказано в верификации. Причина: ${reason}`,
      rejectionReason: reason,
      rejectedAt: serverTimestamp(),
    });
    console.log(`❌ Верификация водителя ${driverId} отклонена`);
  } catch (error) {
    console.error(`❌ Ошибка отклонения водителя ${driverId}:`, error);
    throw new Error("Не удалось отклонить водителя");
  }
}

/**
 * Отправляет документы на доработку (но со статусом отклонен)
 */
export async function requestCorrection(driverId: string, reason: string): Promise<void> {
  try {
    const driverRef = doc(db, "drivers", driverId);
    await updateDoc(driverRef, {
      verified: false,
      isVerified: false,
      can_work: false,
      verificationStatus: "rejected", // Изменено по требованию: статус rejected
      verificationMessage: `Требуется доработка документов. Причина: ${reason}`,
      rejectionReason: reason, // Изменено: используем rejectionReason
      correctionRequestedAt: serverTimestamp(),
    });
    console.log(`🔄 Запрошена доработка (статус rejected) для водителя ${driverId}`);
  } catch (error) {
    console.error(`❌ Ошибка запроса доработки для водителя ${driverId}:`, error);
    throw new Error("Не удалось отправить на доработку");
  }
}

/**
 * Подтверждает ИНН водителя
 */
export async function confirmDriverInn(driverId: string): Promise<void> {
  try {
    const driverRef = doc(db, "drivers", driverId);
    await updateDoc(driverRef, {
      inn_verified: true,
      lastInnVerifiedAt: serverTimestamp(),
    });
    console.log(`✅ ИНН водителя ${driverId} подтвержден`);
  } catch (error) {
    console.error(`❌ Ошибка подтверждения ИНН водителя ${driverId}:`, error);
    throw new Error("Не удалось подтвердить ИНН");
  }
}

/**
 * Обновляет ИНН водителя и сбрасывает статус верификации
 */
export async function updateDriverInn(driverId: string, newInn: string): Promise<void> {
  try {
    const driverRef = doc(db, "drivers", driverId);
    await updateDoc(driverRef, {
      inn: newInn, // Обновляем поле inn в корне (или taxId если используется)
      taxId: newInn, // Дублируем для надежности, так как в UI используется taxId
      inn_verified: false,
      verificationStatus: "correction_required", // Используем существующий статус для "needs_fix"
      can_work: false,
      isVerified: false,
      verified: false,
      updatedAt: serverTimestamp(),
    });
    console.log(`🔄 ИНН водителя ${driverId} обновлен на ${newInn}, статус сброшен`);
  } catch (error) {
    console.error(`❌ Ошибка обновления ИНН водителя ${driverId}:`, error);
    throw new Error("Не удалось обновить ИНН");
  }
}
