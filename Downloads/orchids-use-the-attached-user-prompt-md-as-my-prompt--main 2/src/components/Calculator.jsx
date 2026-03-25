import { useState, useCallback, useEffect, useRef } from 'react';
import {
  MapPin,
  Navigation,
  Car,
  Lock,
  Truck,
  ChevronRight,
  Loader2,
  RotateCcw,
  LocateFixed,
  AlertCircle,
} from 'lucide-react';

const YANDEX_MAPS_API_KEY = import.meta.env.VITE_YANDEX_MAPS_API_KEY;

const CAR_TYPES = [
  { id: 'sedan', label: 'Легковая', icon: '🚗' },
  { id: 'crossover', label: 'Кроссовер', icon: '🚙' },
  { id: 'suv', label: 'Внедорожник', icon: '🛻' },
  { id: 'minivan', label: 'Микроавтобус', icon: '🚌' },
  { id: 'moto', label: 'Мотоцикл', icon: '🏍️' },
  { id: 'other', label: 'Другое', icon: '🚐' },
];

const TRUCK_TYPES = [
  { id: 'broken', label: 'Ломаная платформа', desc: '4 000 ₽ + 100 ₽/км', base: 4000, perKm: 100 },
  { id: 'sliding', label: 'Сдвижная платформа', desc: '4 500 ₽ + 110 ₽/км', base: 4500, perKm: 110 },
  { id: 'manipulator', label: 'Манипулятор', desc: '12 000 ₽ + 150 ₽/км', base: 12000, perKm: 150 },
];

const LOCKED_WHEELS = [0, 1, 2, 3, 4];

const CITY_CENTERS = [
  { name: 'Москва', lat: 55.7558, lng: 37.6173 },
  { name: 'Химки', lat: 55.8887, lng: 37.4302 },
  { name: 'Мытищи', lat: 55.9105, lng: 37.736 },
  { name: 'Красногорск', lat: 55.8319, lng: 37.3294 },
  { name: 'Люберцы', lat: 55.6765, lng: 37.8981 },
  { name: 'Подольск', lat: 55.4311, lng: 37.5454 },
];

const FALLBACK_PLACES = [
  { label: 'Москва, ТТК', city: 'Москва' },
  { label: 'Москва, МКАД', city: 'Москва' },
  { label: 'Москва, Садовое кольцо', city: 'Москва' },
  { label: 'Москва, Ленинградский проспект', city: 'Москва' },
  { label: 'Москва, Кутузовский проспект', city: 'Москва' },
  { label: 'Москва, Варшавское шоссе', city: 'Москва' },
  { label: 'Москва, шоссе Энтузиастов', city: 'Москва' },
  { label: 'Москва, Волгоградский проспект', city: 'Москва' },
  { label: 'Москва, проспект Мира', city: 'Москва' },
  { label: 'Москва, Ленинский проспект', city: 'Москва' },
  { label: 'Москва, Белорусский вокзал', city: 'Москва' },
  { label: 'Москва, Павелецкий вокзал', city: 'Москва' },
  { label: 'Москва, Курский вокзал', city: 'Москва' },
  { label: 'Москва, Киевский вокзал', city: 'Москва' },
  { label: 'Москва, Домодедово', city: 'Москва' },
  { label: 'Москва, Шереметьево', city: 'Москва' },
  { label: 'Москва, Внуково', city: 'Москва' },
  { label: 'Химки, Ленинградское шоссе', city: 'Химки' },
  { label: 'Мытищи, Олимпийский проспект', city: 'Мытищи' },
  { label: 'Красногорск, Ильинское шоссе', city: 'Красногорск' },
  { label: 'Люберцы, Октябрьский проспект', city: 'Люберцы' },
  { label: 'Подольск, Большая Серпуховская улица', city: 'Подольск' },
];

let ymapsPromise;

function normalizeText(value) {
  return value.toLowerCase().replace(/ё/g, 'е').trim();
}

function haversineDistance(lat1, lng1, lat2, lng2) {
  const toRad = (degrees) => degrees * Math.PI / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getNearestCity(latitude, longitude) {
  let nearest = CITY_CENTERS[0];
  let nearestDistance = Number.POSITIVE_INFINITY;
  CITY_CENTERS.forEach((city) => {
    const distance = haversineDistance(latitude, longitude, city.lat, city.lng);
    if (distance < nearestDistance) {
      nearest = city;
      nearestDistance = distance;
    }
  });
  return nearest;
}

function buildFallbackSuggestions(query, userCity) {
  const trimmed = query.trim();
  if (!trimmed) {
    return userCity
      ? FALLBACK_PLACES.filter((p) => p.city === userCity).slice(0, 5).map((p) => p.label)
      : FALLBACK_PLACES.slice(0, 5).map((p) => p.label);
  }

  const baseCity = userCity || 'Москва';
  const normalizedQuery = normalizeText(trimmed);
  const scoredPlaces = FALLBACK_PLACES
    .map((place) => {
      const normalizedLabel = normalizeText(place.label);
      const cityBonus = place.city === userCity ? 4 : 0;
      const startsWithBonus = normalizedLabel.startsWith(normalizedQuery) ? 3 : 0;
      const includesBonus = normalizedLabel.includes(normalizedQuery) ? 2 : 0;
      return { label: place.label, score: cityBonus + startsWithBonus + includesBonus };
    })
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score);

  const generated = [];
  const queryHasBaseCity = normalizedQuery.includes(normalizeText(baseCity));
  generated.push(trimmed);
  if (!queryHasBaseCity) {
    generated.push(`${baseCity}, ${trimmed}`);
    generated.push(`${trimmed}, ${baseCity}`);
  }
  if (baseCity !== 'Москва' && !normalizedQuery.includes('москва')) {
    generated.push(`Москва, ${trimmed}`);
  }
  generated.push(`${trimmed}, Московская область`);

  const suggestions = [...scoredPlaces.map((p) => p.label), ...generated]
    .filter(Boolean)
    .filter((s, i, arr) => arr.indexOf(s) === i)
    .slice(0, 6);

  return suggestions.length ? suggestions : [`${baseCity}, ${trimmed}`];
}

function simulateDistance(from, to, userCity) {
  if (!from || !to) return 0;
  const fromNorm = normalizeText(from);
  const toNorm = normalizeText(to);
  const cityBoost = userCity && (fromNorm.includes(normalizeText(userCity)) || toNorm.includes(normalizeText(userCity))) ? 4 : 0;
  const seed = (from.length * 11 + to.length * 7 + cityBoost + from.charCodeAt(0) + to.charCodeAt(0)) % 45;
  return Math.max(6, seed + 10);
}

function calculatePrice({ lockedWheels, truckType, distance }) {
  if (!distance) return null;
  const selectedTruck = TRUCK_TYPES.find((t) => t.id === truckType) || TRUCK_TYPES[0];
  return selectedTruck.base + (distance * selectedTruck.perKm) + lockedWheels * 800;
}

// ─── Яндекс Карты ──────────────────────────────────────────────────────────

function loadYandexMaps() {
  if (typeof window === 'undefined') return Promise.reject(new Error('unavailable'));

  if (window.ymaps?.ready) {
    return new Promise((resolve) => window.ymaps.ready(() => resolve(window.ymaps)));
  }

  if (!YANDEX_MAPS_API_KEY) return Promise.reject(new Error('no-key'));
  if (ymapsPromise) return ymapsPromise;

  ymapsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-ymaps-loader]');
    if (existing) {
      existing.addEventListener('load', () => window.ymaps.ready(() => resolve(window.ymaps)));
      existing.addEventListener('error', () => reject(new Error('load-failed')));
      return;
    }
    const script = document.createElement('script');
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${YANDEX_MAPS_API_KEY}&lang=ru_RU`;
    script.async = true;
    script.dataset.ymapsLoader = 'true';
    script.onload = () => window.ymaps.ready(() => resolve(window.ymaps));
    script.onerror = () => reject(new Error('yandex-maps-load-failed'));
    document.head.appendChild(script);
  });

  return ymapsPromise;
}

async function reverseGeocodeYandex(coords) {
  try {
    const ymaps = await loadYandexMaps();
    const result = await ymaps.geocode([coords[0], coords[1]], { results: 1 });
    const obj = result.geoObjects.get(0);
    return obj ? obj.getAddressLine() : null;
  } catch {
    return null;
  }
}

async function geocodeAddress(address) {
  try {
    const resp = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`);
    const data = await resp.json();
    return data.coords || null;
  } catch {
    return null;
  }
}

async function calcDirectionsRoute(fromCoords, toCoords) {
  try {
    const resp = await fetch(`/api/route?from=${fromCoords.lat},${fromCoords.lng}&to=${toCoords.lat},${toCoords.lng}`);
    const data = await resp.json();
    if (!data.polylineCoords?.length) return null;
    return { distanceKm: data.distanceKm, polylineCoords: data.polylineCoords };
  } catch {
    return null;
  }
}

// ─── MapPicker ──────────────────────────────────────────────────────────────

function MapPicker({ fromCoords, toCoords, polylineCoords, pinMode, onPinModeChange, onFromChange, onToChange }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const fromPlacemarkRef = useRef(null);
  const toPlacemarkRef = useRef(null);
  const polylineRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    loadYandexMaps().then((ymaps) => {
      if (!mapRef.current || mapInstanceRef.current) return;

      const map = new ymaps.Map(mapRef.current, {
        center: [55.7558, 37.6173],
        zoom: 11,
        controls: ['zoomControl'],
      });
      mapInstanceRef.current = map;

      const fromPlacemark = new ymaps.Placemark([55.7558, 37.6173], { balloonContent: 'Откуда' }, {
        preset: 'islands#orangeCircleIcon',
        draggable: true,
        visible: false,
      });
      fromPlacemarkRef.current = fromPlacemark;
      fromPlacemark.events.add('dragend', async () => {
        const coords = fromPlacemark.geometry.getCoordinates();
        const address = await reverseGeocodeYandex(coords);
        if (address) onFromChange(address, { lat: coords[0], lng: coords[1] });
      });
      map.geoObjects.add(fromPlacemark);

      const toPlacemark = new ymaps.Placemark([55.7558, 37.6173], { balloonContent: 'Куда' }, {
        preset: 'islands#darkBlueCircleIcon',
        draggable: true,
        visible: false,
      });
      toPlacemarkRef.current = toPlacemark;
      toPlacemark.events.add('dragend', async () => {
        const coords = toPlacemark.geometry.getCoordinates();
        const address = await reverseGeocodeYandex(coords);
        if (address) onToChange(address, { lat: coords[0], lng: coords[1] });
      });
      map.geoObjects.add(toPlacemark);

      map.events.add('click', async (e) => {
        const coords = e.get('coords');
        onPinModeChange((mode) => {
          if (mode === 'from') {
            fromPlacemark.geometry.setCoordinates(coords);
            fromPlacemark.options.set('visible', true);
            reverseGeocodeYandex(coords).then((address) => {
              if (address) onFromChange(address, { lat: coords[0], lng: coords[1] });
            });
            return 'to';
          }
          if (mode === 'to') {
            toPlacemark.geometry.setCoordinates(coords);
            toPlacemark.options.set('visible', true);
            reverseGeocodeYandex(coords).then((address) => {
              if (address) onToChange(address, { lat: coords[0], lng: coords[1] });
            });
            return null;
          }
          return mode;
        });
      });

      setMapReady(true);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!mapReady || !fromCoords || !fromPlacemarkRef.current) return;
    fromPlacemarkRef.current.geometry.setCoordinates([fromCoords.lat, fromCoords.lng]);
    fromPlacemarkRef.current.options.set('visible', true);
  }, [fromCoords, mapReady]);

  useEffect(() => {
    if (!mapReady || !toCoords || !toPlacemarkRef.current) return;
    toPlacemarkRef.current.geometry.setCoordinates([toCoords.lat, toCoords.lng]);
    toPlacemarkRef.current.options.set('visible', true);
  }, [toCoords, mapReady]);

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const ymaps = window.ymaps;

    if (polylineRef.current) {
      map.geoObjects.remove(polylineRef.current);
      polylineRef.current = null;
    }

    if (polylineCoords && polylineCoords.length > 1) {
      const polyline = new ymaps.Polyline(polylineCoords, {}, {
        strokeColor: '#f97316',
        strokeWidth: 5,
        strokeOpacity: 0.85,
      });
      polylineRef.current = polyline;
      map.geoObjects.add(polyline);
      const bounds = polyline.geometry.getBounds();
      if (bounds) {
        map.setBounds(bounds, { checkZoomRange: true, zoomMargin: [50, 50, 50, 50] });
      }
    }
  }, [polylineCoords, mapReady]);

  const cursorStyle = pinMode === 'from' || pinMode === 'to' ? 'crosshair' : 'grab';

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200 relative shadow-sm" style={{ height: 300 }}>
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex gap-2">
        <button
          type="button"
          onClick={() => onPinModeChange('from')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg transition-all ${
            pinMode === 'from' ? 'bg-orange-500 text-white scale-105' : 'bg-white text-slate-600 hover:bg-orange-50'
          }`}
        >
          <span className="w-4 h-4 rounded-full bg-orange-500 border-2 border-white inline-block" />
          Откуда
        </button>
        <button
          type="button"
          onClick={() => onPinModeChange('to')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg transition-all ${
            pinMode === 'to' ? 'bg-slate-900 text-white scale-105' : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span className="w-4 h-4 rounded-full bg-slate-900 border-2 border-white inline-block" />
          Куда
        </button>
      </div>

      {(pinMode === 'from' || pinMode === 'to') && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-full px-3 py-1.5 text-xs font-medium text-slate-600 shadow-md whitespace-nowrap">
          {pinMode === 'from' ? '👆 Нажмите на карту — укажите точку отправления' : '👆 Нажмите на карту — укажите точку назначения'}
        </div>
      )}

      <div ref={mapRef} style={{ width: '100%', height: '100%', cursor: cursorStyle }} />
    </div>
  );
}

// ─── AddressAutocompleteInput ───────────────────────────────────────────────

const DEFAULT_CITY = CITY_CENTERS[0];
const CITY_COORDS = Object.fromEntries(CITY_CENTERS.map((c) => [c.name, { lat: c.lat, lng: c.lng }]));

function getLocationBiasCenter(currentPosition, userCity) {
  if (currentPosition) return currentPosition;
  if (userCity && CITY_COORDS[userCity]) return CITY_COORDS[userCity];
  return { lat: DEFAULT_CITY.lat, lng: DEFAULT_CITY.lng };
}

function getSuggestStatusLabel(status) {
  switch (status) {
    case 'yandex': return 'Подсказки Яндекс';
    case 'fallback': return 'Автодополнение';
    case 'loading': return 'Загружаем карты...';
    default: return '';
  }
}

function AddressAutocompleteInput({ icon: Icon, placeholder, value, onChange, onConfirm, userCity, currentPosition }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState('idle');
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const trimmed = value.trim();
    if (!open && trimmed.length < 2) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setLoading(true);
      try {
        const biasCenter = getLocationBiasCenter(currentPosition, userCity);
        const ll = `${biasCenter.lng},${biasCenter.lat}`;
        const resp = await fetch(`/api/suggest?text=${encodeURIComponent(value)}&ll=${ll}`);
        const data = await resp.json();
        if (cancelled) return;

        const effectiveCity = userCity || DEFAULT_CITY.name;
        const addresses = (data.results || [])
          .sort((a, b) => {
            const aScore = normalizeText(a).includes(normalizeText(effectiveCity)) ? 1 : 0;
            const bScore = normalizeText(b).includes(normalizeText(effectiveCity)) ? 1 : 0;
            return bScore - aScore;
          })
          .slice(0, 6);

        if (addresses.length > 0) {
          setSuggestions(addresses);
          setProvider('yandex');
        } else {
          setSuggestions(buildFallbackSuggestions(value, userCity));
          setProvider('fallback');
        }
      } catch (err) {
        console.error('[Suggest error]', err?.message || err);
        if (cancelled) return;
        setSuggestions(buildFallbackSuggestions(value, userCity));
        setProvider('fallback');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [value, open, userCity, currentPosition]);

  return (
    <div className="relative" ref={wrapperRef}>
      <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-orange-500" size={18} />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onFocus={() => setOpen(true)}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        className="input-field w-full pl-10 pr-10 py-3 rounded-xl text-sm font-medium placeholder-slate-400"
      />
      {loading && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" size={16} />}

      {open && (suggestions.length > 0 || provider !== 'idle') && (
        <div className="absolute z-20 left-0 right-0 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {getSuggestStatusLabel(loading ? 'loading' : provider)}
            </span>
            <span className="text-[11px] font-medium text-orange-500">
              Приоритет: {userCity || DEFAULT_CITY.name}
            </span>
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => { onChange(suggestion); onConfirm?.(suggestion); setOpen(false); }}
                className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-orange-50 transition-colors"
              >
                <MapPin size={14} className="mt-0.5 flex-shrink-0 text-orange-500" />
                <span className="text-sm text-slate-700">{suggestion}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Calculator ─────────────────────────────────────────────────────────────

export default function Calculator({ onOrderClick }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [carType, setCarType] = useState('sedan');
  const [lockedWheels, setLockedWheels] = useState(0);
  const [truckType, setTruckType] = useState('broken');
  const [distance, setDistance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [price, setPrice] = useState(null);
  const [geoState, setGeoState] = useState({ status: 'idle', city: '', coords: null });

  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [showMap, setShowMap] = useState(false);
  const [pinMode, setPinMode] = useState('from');
  const [fromCoords, setFromCoords] = useState(null);
  const [toCoords, setToCoords] = useState(null);
  const [polylineCoords, setPolylineCoords] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!navigator.geolocation) {
      setGeoState({ status: 'denied', city: '', coords: null });
      return undefined;
    }
    setGeoState((s) => ({ ...s, status: 'locating' }));
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) return;
        const { latitude, longitude } = position.coords;
        const city = getNearestCity(latitude, longitude);
        setGeoState({ status: 'resolved', city: city?.name || '', coords: { lat: latitude, lng: longitude } });
      },
      (error) => {
        if (cancelled) return;
        if (error.code === 1) {
          setGeoState({ status: 'denied', city: '', coords: null });
        } else {
          setGeoState({ status: 'resolved', city: DEFAULT_CITY.name, coords: { lat: DEFAULT_CITY.lat, lng: DEFAULT_CITY.lng } });
        }
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 }
    );
    return () => { cancelled = true; };
  }, []);

  const calcRouteCoords = useCallback(async (fc, tc) => {
    setLoading(true);
    try {
      const res = await calcDirectionsRoute(fc, tc);
      if (res) {
        setDistance(res.distanceKm);
        setPolylineCoords(res.polylineCoords);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const calcPrice = useCallback(async () => {
    if (!from || !to) return;
    setLoading(true);
    try {
      let fc = fromCoords;
      let tc = toCoords;
      if (!fc) fc = await geocodeAddress(from);
      if (!tc) tc = await geocodeAddress(to);
      if (fc) setFromCoords(fc);
      if (tc) setToCoords(tc);
      if (fc && tc) {
        const res = await calcDirectionsRoute(fc, tc);
        if (res) {
          setDistance(res.distanceKm);
          setPolylineCoords(res.polylineCoords);
        }
      } else {
        setDistance(simulateDistance(from, to, geoState.city));
      }
    } finally {
      setLoading(false);
    }
  }, [from, to, fromCoords, toCoords, geoState.city]);

  useEffect(() => {
    if (distance !== null) {
      setPrice(calculatePrice({ lockedWheels, truckType, distance }));
    }
  }, [distance, lockedWheels, truckType]);

  // Автогеокодирование при открытии карты
  useEffect(() => {
    if (!showMap) return;
    (async () => {
      let fc = fromCoords;
      let tc = toCoords;
      if (from && !fc) {
        fc = await geocodeAddress(from);
        if (fc) setFromCoords(fc);
      }
      if (to && !tc) {
        tc = await geocodeAddress(to);
        if (tc) setToCoords(tc);
      }
      if (fc && tc && !polylineCoords) calcRouteCoords(fc, tc);
    })();
  }, [showMap]);

  // Автогеокодирование при вводе адреса пока карта открыта
  useEffect(() => {
    if (!showMap || !from || from.length < 5) return;
    const timer = setTimeout(async () => {
      const coords = await geocodeAddress(from);
      if (coords) {
        setFromCoords(coords);
        if (toCoords) calcRouteCoords(coords, toCoords);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [from, showMap]);

  useEffect(() => {
    if (!showMap || !to || to.length < 5) return;
    const timer = setTimeout(async () => {
      const coords = await geocodeAddress(to);
      if (coords) {
        setToCoords(coords);
        if (fromCoords) calcRouteCoords(fromCoords, coords);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [to, showMap]);

  const handleFromConfirm = useCallback(async (address) => {
    const coords = await geocodeAddress(address);
    if (coords) {
      setFromCoords(coords);
      if (toCoords) calcRouteCoords(coords, toCoords);
    }
  }, [toCoords, calcRouteCoords]);

  const handleToConfirm = useCallback(async (address) => {
    const coords = await geocodeAddress(address);
    if (coords) {
      setToCoords(coords);
      if (fromCoords) calcRouteCoords(fromCoords, coords);
    }
  }, [fromCoords, calcRouteCoords]);

  const handleFromMapChange = useCallback((address, coords) => {
    setFrom(address);
    setFromCoords(coords);
    setDistance(null);
    setPrice(null);
    setPolylineCoords(null);
    if (coords && toCoords) calcRouteCoords(coords, toCoords);
  }, [toCoords, calcRouteCoords]);

  const handleToMapChange = useCallback((address, coords) => {
    setTo(address);
    setToCoords(coords);
    setDistance(null);
    setPrice(null);
    setPolylineCoords(null);
    if (fromCoords && coords) calcRouteCoords(fromCoords, coords);
  }, [fromCoords, calcRouteCoords]);

  const reset = () => {
    setFrom('');
    setTo('');
    setDistance(null);
    setPrice(null);
    setTruckType('broken');
    setLockedWheels(0);
    setCarType('sedan');
    setFromCoords(null);
    setToCoords(null);
    setPolylineCoords(null);
    setPinMode('from');
  };

  const geoStatusLabel = {
    locating: 'Определяем местоположение...',
    resolved: geoState.city ? `Город: ${geoState.city}` : 'Местоположение найдено',
    denied: 'Доступ к геолокации не получен',
    idle: 'Определяем местоположение',
  }[geoState.status];

  return (
    <div
      className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100"
      style={{ boxShadow: '0 25px 80px rgba(15,23,42,0.12), 0 4px 20px rgba(249,115,22,0.08)' }}
    >
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h3 className="text-white font-bold text-lg">Калькулятор стоимости</h3>
          <p className="text-slate-400 text-sm">Новый прайсинг TowPrime за 30 секунд</p>
        </div>
        <button onClick={reset} className="text-slate-400 hover:text-orange-400 transition-colors p-1.5 rounded-lg hover:bg-white/10">
          <RotateCcw size={16} />
        </button>
      </div>

      <div className="p-5 space-y-5">
        <div
          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium ${
            geoState.status === 'resolved'
              ? 'border-green-100 bg-green-50 text-green-700'
              : geoState.status === 'denied'
                ? 'border-amber-100 bg-amber-50 text-amber-700'
                : 'border-slate-200 bg-slate-50 text-slate-600'
          }`}
        >
          {geoState.status === 'denied' ? <AlertCircle size={14} /> : <LocateFixed size={14} />}
          <span>{geoStatusLabel}</span>
        </div>

        <div className="space-y-3">
          <AddressAutocompleteInput
            icon={MapPin}
            placeholder="Откуда забрать"
            value={from}
            onChange={(v) => { setFrom(v); setDistance(null); setPrice(null); setPolylineCoords(null); }}
            onConfirm={handleFromConfirm}
            userCity={geoState.city}
            currentPosition={geoState.coords}
          />
          <AddressAutocompleteInput
            icon={Navigation}
            placeholder="Куда доставить"
            value={to}
            onChange={(v) => { setTo(v); setDistance(null); setPrice(null); setPolylineCoords(null); }}
            onConfirm={handleToConfirm}
            userCity={geoState.city}
            currentPosition={geoState.coords}
          />

          <button
            type="button"
            onClick={() => setShowMap((v) => !v)}
            className={`w-full py-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              showMap
                ? 'border-orange-300 bg-orange-50 text-orange-600'
                : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-orange-200 hover:bg-orange-50/50'
            }`}
          >
            <MapPin size={13} />
            {showMap ? 'Скрыть карту' : 'Указать точки на карте'}
          </button>

          {showMap && (
            <MapPicker
              fromCoords={fromCoords}
              toCoords={toCoords}
              polylineCoords={polylineCoords}
              pinMode={pinMode}
              onPinModeChange={setPinMode}
              onFromChange={handleFromMapChange}
              onToChange={handleToMapChange}
            />
          )}

          {from && to && !distance && (
            <button
              onClick={calcPrice}
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Loader2 size={15} className="animate-spin" /> Рассчитываю маршрут...</>
              ) : (
                <><Navigation size={15} /> Рассчитать маршрут</>
              )}
            </button>
          )}

          {distance && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-xl border border-green-100">
              <div className="w-2 h-2 bg-green-400 rounded-full" />
              <span className="text-green-700 text-xs font-medium">Маршрут: ~{distance} км по дорогам</span>
            </div>
          )}
        </div>

        <div>
          <label className="flex items-center gap-2 text-slate-700 text-sm font-semibold mb-2.5">
            <Car size={15} className="text-orange-500" /> Тип автомобиля
          </label>
          <div className="grid grid-cols-3 gap-2">
            {CAR_TYPES.map((car) => (
              <button
                key={car.id}
                onClick={() => setCarType(car.id)}
                className={`segment-btn py-2.5 px-2 rounded-xl border text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                  carType === car.id ? 'active border-transparent' : 'border-slate-200 text-slate-600 hover:border-orange-200 hover:bg-orange-50'
                }`}
              >
                <span className="text-base">{car.icon}</span>
                <span>{car.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 text-slate-700 text-sm font-semibold mb-2.5">
            <Lock size={15} className="text-orange-500" /> Заблокированных колёс
          </label>
          <div className="flex gap-2">
            {LOCKED_WHEELS.map((count) => (
              <button
                key={count}
                onClick={() => setLockedWheels(count)}
                className={`segment-btn flex-1 py-2.5 rounded-xl border text-sm font-bold transition-all ${
                  lockedWheels === count ? 'active border-transparent' : 'border-slate-200 text-slate-600 hover:border-orange-200'
                }`}
              >
                {count}
              </button>
            ))}
          </div>
          {lockedWheels > 0 && (
            <p className="text-xs text-slate-500 mt-1.5">+{lockedWheels * 800} ₽ за заблокированные колёса</p>
          )}
        </div>

        <div>
          <label className="flex items-center gap-2 text-slate-700 text-sm font-semibold mb-2.5">
            <Truck size={15} className="text-orange-500" /> Тип эвакуатора
          </label>
          <div className="space-y-2">
            {TRUCK_TYPES.map((truck) => (
              <button
                key={truck.id}
                onClick={() => setTruckType(truck.id)}
                className={`w-full px-4 py-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                  truckType === truck.id ? 'border-orange-400 bg-orange-50' : 'border-slate-200 hover:border-orange-200 hover:bg-slate-50'
                }`}
              >
                <span className={`text-sm font-medium ${truckType === truck.id ? 'text-orange-700' : 'text-slate-700'}`}>
                  {truck.label}
                </span>
                <span className={`text-xs font-semibold ${truckType === truck.id ? 'text-orange-500' : 'text-slate-400'}`}>
                  {truck.desc}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 text-slate-700 text-sm font-semibold mb-2.5">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-orange-500">
              <path d="M2 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H2z" />
              <path fillRule="evenodd" d="M18 9H0v5a2 2 0 002 2h14a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
            </svg>
            Способ оплаты
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPaymentMethod('cash')}
              className={`py-3 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                paymentMethod === 'cash' ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-slate-200 text-slate-600 hover:border-orange-200 hover:bg-orange-50/50'
              }`}
            >
              💵 Наличные
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('card')}
              className={`py-3 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                paymentMethod === 'card' ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-slate-200 text-slate-600 hover:border-orange-200 hover:bg-orange-50/50'
              }`}
            >
              💳 Безналичный
            </button>
          </div>
        </div>

        {price !== null && (
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl p-4 border border-orange-100">
            <p className="text-slate-500 text-xs font-medium mb-1">Стоимость эвакуации</p>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-black text-slate-900">{price.toLocaleString('ru-RU')}</span>
              <span className="text-2xl font-bold text-orange-500 mb-0.5">₽</span>
            </div>
          </div>
        )}

        <button
          onClick={() => onOrderClick({ from, to, carType, lockedWheels, truckType, price, distance, paymentMethod })}
          disabled={!from || !to}
          className={`btn-orange w-full py-4 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2.5 shadow-lg ${
            !from || !to ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          Вызвать эвакуатор
          <ChevronRight size={20} className="mt-0.5" />
        </button>

        <p className="text-center text-xs text-slate-400">
          Или позвоните:{' '}
          <a href="tel:+79777349128" className="text-orange-500 font-semibold">+7 977 734 91 28</a>
        </p>
      </div>
    </div>
  );
}
