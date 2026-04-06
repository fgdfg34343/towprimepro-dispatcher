import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const CITY_CENTERS = [
  { name: 'Москва', lat: 55.7558, lng: 37.6173 },
  { name: 'Химки', lat: 55.8887, lng: 37.4302 },
  { name: 'Мытищи', lat: 55.9105, lng: 37.7360 },
  { name: 'Красногорск', lat: 55.8319, lng: 37.3294 },
  { name: 'Люберцы', lat: 55.6765, lng: 37.8981 },
  { name: 'Подольск', lat: 55.4311, lng: 37.5454 },
];

const CAR_LABELS = {
  sedan: 'Легковая',
  crossover: 'Кроссовер',
  suv: 'Внедорожник',
  minivan: 'Микроавтобус',
  moto: 'Мотоцикл',
  other: 'Другое',
};

const TRUCK_LABELS = {
  broken: 'Ломаная платформа',
  sliding: 'Сдвижная платформа',
  manipulator: 'Манипулятор',
};

function normalizeText(value) {
  return value.toLowerCase().replace(/ё/g, 'е').trim();
}

function getCityCenterByAddress(address) {
  const normalizedAddress = normalizeText(address);
  return CITY_CENTERS.find((city) => normalizedAddress.includes(normalizeText(city.name))) || CITY_CENTERS[0];
}

function buildProblemDescription({ orderData, comment }) {
  const details = [];

  if (comment?.trim()) {
    details.push(`Комментарий клиента: ${comment.trim()}`);
  }

  if (orderData?.truckType && TRUCK_LABELS[orderData.truckType]) {
    details.push(`Тип эвакуатора: ${TRUCK_LABELS[orderData.truckType]}`);
  }

  if (Number.isFinite(orderData?.lockedWheels) && orderData.lockedWheels > 0) {
    details.push(`Заблокированных колёс: ${orderData.lockedWheels}`);
  }

  if (Number.isFinite(orderData?.distance)) {
    details.push(`Оценка маршрута: ${Number(orderData.distance).toLocaleString('ru-RU')} км`);
  }

  return details.join('. ');
}

async function geocodeAddress(address, fallbackAddress) {
  const trimmedAddress = (address || fallbackAddress || '').trim();
  const fallbackCity = getCityCenterByAddress(trimmedAddress);
  const fallbackPoint = {
    lat: fallbackCity.lat,
    lng: fallbackCity.lng,
    address: trimmedAddress || fallbackAddress || `${fallbackCity.name}, адрес уточнить у клиента`,
  };

  if (!trimmedAddress || !GOOGLE_MAPS_API_KEY) {
    return fallbackPoint;
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(trimmedAddress)}&key=${GOOGLE_MAPS_API_KEY}&language=ru`
    );

    if (!response.ok) {
      return fallbackPoint;
    }

    const data = await response.json();
    const firstResult = data?.results?.[0];

    if (!firstResult?.geometry?.location) {
      return fallbackPoint;
    }

    return {
      lat: firstResult.geometry.location.lat,
      lng: firstResult.geometry.location.lng,
      address: firstResult.formatted_address || fallbackPoint.address,
    };
  } catch {
    return fallbackPoint;
  }
}

export async function submitTowOrder({ orderData, name, phone, comment }) {
  const pickupAddress = orderData?.from?.trim() || 'Москва, адрес подачи уточнить у клиента';
  const dropoffAddress = orderData?.to?.trim() || '';
  const customerName = name.trim();
  const customerPhone = phone.trim();
  const vehicleType = CAR_LABELS[orderData?.carType] || 'Не указано';
  const problemDescription = buildProblemDescription({ orderData, comment });
  const priceEstimate = Number.isFinite(orderData?.price) ? orderData.price : null;

  const [pickup, dropoff] = await Promise.all([
    geocodeAddress(pickupAddress, 'Москва, адрес подачи уточнить у клиента'),
    dropoffAddress ? geocodeAddress(dropoffAddress, dropoffAddress) : Promise.resolve(null),
  ]);

  const payload = {
    customerName,
    customerPhone,
    clientName: customerName,
    clientPhone: customerPhone,
    vehicleType,
    problemDescription: problemDescription || undefined,
    notes: problemDescription || '',
    pickup,
    dropoff,
    pickupAddress: pickup.address,
    dropoffAddress: dropoff?.address || '',
    priceEstimate,
    price: priceEstimate,
    etaMinutes: 18,
    source: 'towprime-landing',
    truckType: TRUCK_LABELS[orderData?.truckType] || null,
    lockedWheels: Number.isFinite(orderData?.lockedWheels) ? orderData.lockedWheels : 0,
    dispatcherId: 'public-web',
    assignedDriverId: null,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, 'orders'), payload);
  return { ok: true, orderId: docRef.id };
}
