function normalizeText(value = '') {
  return value.toLowerCase().replace(/ё/g, 'е').trim();
}

function tokenize(value = '') {
  return normalizeText(value).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

function getPrecisionScore(precision) {
  switch (precision) {
    case 'exact':
      return 40;
    case 'number':
      return 34;
    case 'near':
      return 28;
    case 'range':
      return 22;
    case 'street':
      return 16;
    default:
      return 0;
  }
}

function scoreCandidate(address, geoObject) {
  const meta = geoObject?.metaDataProperty?.GeocoderMetaData;
  const formatted = meta?.Address?.formatted || meta?.text || '';
  const queryTokens = tokenize(address);
  const resultTokens = new Set(tokenize(formatted));
  const digitTokens = queryTokens.filter((token) => /\d/.test(token));
  const matchedTokens = queryTokens.filter((token) => resultTokens.has(token)).length;
  const matchedDigits = digitTokens.filter((token) => resultTokens.has(token)).length;
  const normalizedQuery = normalizeText(address);
  const normalizedFormatted = normalizeText(formatted);

  let score = getPrecisionScore(meta?.precision);
  score += matchedTokens * 6;
  score += matchedDigits * 12;

  if (normalizedFormatted === normalizedQuery) score += 30;
  if (normalizedFormatted.includes(normalizedQuery) || normalizedQuery.includes(normalizedFormatted)) score += 12;
  if (queryTokens.length > 0 && matchedTokens === queryTokens.length) score += 20;

  return { formatted, score };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { address, ll } = req.query;
  if (!address) return res.status(400).json({ error: 'address required' });

  const apiKey = process.env.VITE_YANDEX_MAPS_API_KEY;
  const params = new URLSearchParams({
    apikey: apiKey,
    format: 'json',
    geocode: address,
    results: '5',
    lang: 'ru_RU',
    ...(ll ? { ll, spn: '0.8,0.8' } : {}),
  });

  try {
    const resp = await fetch(
      `https://geocode-maps.yandex.ru/1.x/?${params}`,
      { headers: { Referer: 'https://towprimepro.ru/' } }
    );
    const data = await resp.json();
    const members = data?.response?.GeoObjectCollection?.featureMember || [];
    if (!members.length) return res.json({ coords: null });

    const bestMatch = members
      .map((member) => {
        const geoObject = member?.GeoObject;
        const scored = scoreCandidate(address, geoObject);
        return { geoObject, ...scored };
      })
      .sort((a, b) => b.score - a.score)[0];

    const pos = bestMatch?.geoObject?.Point?.pos?.split(' ');
    if (!pos?.length) return res.json({ coords: null });

    res.json({ coords: { lat: parseFloat(pos[1]), lng: parseFloat(pos[0]) } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
