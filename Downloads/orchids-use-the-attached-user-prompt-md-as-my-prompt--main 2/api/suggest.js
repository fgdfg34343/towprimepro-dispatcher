export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { text, ll } = req.query;
  if (!text) return res.status(400).json({ error: 'text required' });

  const apiKey = process.env.VITE_YANDEX_MAPS_API_KEY;
  const params = new URLSearchParams({
    text,
    apikey: apiKey,
    lang: 'ru_RU',
    results: '6',
    v: '9',
    highlight: '0',
    ...(ll ? { ll, spn: '0.5,0.5' } : {}),
  });

  try {
    const resp = await fetch(
      `https://suggest-maps.yandex.ru/suggest-geo?${params}`,
      { headers: { Referer: 'https://towprimepro.ru/' } }
    );
    const raw = await resp.text();
    // Парсим JSONP: suggest.apply({...})
    const json = raw.replace(/^suggest\.apply\(/, '').replace(/\)$/, '');
    const data = JSON.parse(json);

    const results = (data.results || []).map((r) => {
      const title = r?.title?.text || '';
      const subtitle = r?.subtitle?.text || '';
      return subtitle ? `${subtitle}, ${title}` : title;
    }).filter(Boolean);

    res.json({ results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
