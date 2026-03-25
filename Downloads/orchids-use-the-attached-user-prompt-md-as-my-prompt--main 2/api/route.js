export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from and to required' });

  // from/to в формате "lat,lng"
  const [fromLat, fromLng] = from.split(',');
  const [toLat, toLng] = to.split(',');

  try {
    // OSRM — бесплатный роутинг
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
    const resp = await fetch(url);
    const data = await resp.json();

    if (data.code !== 'Ok' || !data.routes?.length) {
      return res.json({ distanceKm: null, polylineCoords: [] });
    }

    const route = data.routes[0];
    const distanceKm = Math.round(route.distance / 1000);
    // OSRM возвращает [lng, lat] — конвертируем в [lat, lng] для Яндекс карт
    const polylineCoords = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

    res.json({ distanceKm, polylineCoords });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
