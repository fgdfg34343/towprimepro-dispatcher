#!/usr/bin/env bash
# =============================================================
# scripts/polymarket.sh — Polymarket Gamma API wrapper
# Read-only market data. No auth required for Phase 1.
# Usage examples:
#   bash scripts/polymarket.sh markets              # All active markets
#   bash scripts/polymarket.sh markets-filtered     # Filtered by strategy
#   bash scripts/polymarket.sh market MARKET_ID     # Single market detail
#   bash scripts/polymarket.sh trending             # Trending markets
#   bash scripts/polymarket.sh search "bitcoin"     # Search markets
#   bash scripts/polymarket.sh prices MARKET_ID     # Price history
#   bash scripts/polymarket.sh positions MARKET_ID  # Top positions/holders
# =============================================================

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

GAMMA="${GAMMA_API_URL:-https://gamma-api.polymarket.com}"
MIN_LIQ="${MIN_LIQUIDITY:-5000}"

cmd="${1:-}"
shift || true

case "$cmd" in

  # ── All active markets (paginated, full scan) ──────────────────────────
  markets)
    python3 -c "
import json, urllib.request, sys

base = '${GAMMA}'
offset = 0
limit = 1000
all_markets = []

while True:
    url = f'{base}/markets?active=true&closed=false&limit={limit}&offset={offset}&order=volume24hr&ascending=false'
    req = urllib.request.Request(url, headers={'User-Agent': 'polymarket-bot/1.0'})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.load(resp)
    markets = data if isinstance(data, list) else data.get('markets', [])
    if not markets:
        break
    all_markets.extend(markets)
    if len(markets) < limit:
        break
    offset += limit

print(json.dumps(all_markets, indent=2))
"
    ;;

  # ── Markets filtered by strategy criteria ─────────────────────────────
  markets-filtered)
    python3 -c "
import json, os, urllib.request
from datetime import datetime, timezone

base = '${GAMMA}'
offset = 0
limit = 500
max_markets = 2000
markets = []

while True:
    url = f'{base}/markets?active=true&closed=false&limit={limit}&offset={offset}&order=volume24hr&ascending=false'
    req = urllib.request.Request(url, headers={'User-Agent': 'polymarket-bot/1.0'})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.load(resp)
    batch = data if isinstance(data, list) else data.get('markets', [])
    if not batch:
        break
    markets.extend(batch)
    if len(batch) < limit:
        break
    offset += limit
    if len(markets) >= max_markets:
        break

min_liq = float(os.environ.get('MIN_LIQUIDITY', '5000'))
skip_kw = [k.strip().lower() for k in
           os.environ.get('SKIP_KEYWORDS', 'meme,joke,fun').split(',')]

filtered = []
now = datetime.now(timezone.utc)

for m in markets:
    try:
        # Liquidity check
        liquidity = float(m.get('liquidity', 0) or 0)
        if liquidity < min_liq:
            continue

        # Skip keywords
        title = (m.get('question', '') or m.get('title', '')).lower()
        if any(kw in title for kw in skip_kw):
            continue

        # End date — prefer markets resolving within 60 days
        end_date_str = m.get('endDate') or m.get('end_date_iso')
        if end_date_str:
            try:
                end_dt = datetime.fromisoformat(
                    end_date_str.replace('Z', '+00:00'))
                days_left = (end_dt - now).days
                if days_left < 1 or days_left > 90:
                    continue
                m['_days_left'] = days_left
            except Exception:
                pass

        # Parse best prices
        outcomes = m.get('outcomes', '[]')
        if isinstance(outcomes, str):
            try:
                outcomes = json.loads(outcomes)
            except Exception:
                outcomes = []
        m['_outcomes_parsed'] = outcomes

        prices = m.get('outcomePrices', '[]')
        if isinstance(prices, str):
            try:
                prices = json.loads(prices)
            except Exception:
                prices = []
        m['_prices_parsed'] = [float(p) for p in prices if p]

        # Parse events for correct URL generation
        events = m.get('events', [])
        if isinstance(events, str):
            try:
                events = json.loads(events)
            except Exception:
                events = []
        m['_events'] = events if isinstance(events, list) else []

        filtered.append(m)
    except Exception as e:
        continue

# Sort by liquidity descending
filtered.sort(key=lambda x: float(x.get('liquidity', 0) or 0), reverse=True)
print(json.dumps(filtered, indent=2))
"
    ;;

  # ── Single market by ID ────────────────────────────────────────────────
  market)
    mid="${1:?usage: market MARKET_ID}"
    curl -fsS "${GAMMA}/markets/${mid}"
    echo
    ;;

  # ── Trending markets ──────────────────────────────────────────────────
  trending)
    curl -fsS \
      "${GAMMA}/markets?active=true&closed=false&limit=20&order=volume24hr&ascending=false"
    echo
    ;;

  # ── Search markets by keyword ─────────────────────────────────────────
  search)
    query="${1:?usage: search KEYWORD}"
    encoded="$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$query")"
    curl -fsS "${GAMMA}/markets?active=true&closed=false&_c=${encoded}&limit=20"
    echo
    ;;

  # ── Price history for a market ────────────────────────────────────────
  prices)
    mid="${1:?usage: prices MARKET_ID}"
    # Try to get price history — fallback to market detail if not available
    curl -fsS "${GAMMA}/markets/${mid}/prices-history?interval=1d&fidelity=10" \
      2>/dev/null || curl -fsS "${GAMMA}/markets/${mid}"
    echo
    ;;

  # ── Top position holders ──────────────────────────────────────────────
  positions)
    mid="${1:?usage: positions MARKET_ID}"
    curl -fsS "${GAMMA}/markets/${mid}/positions?limit=20&sortBy=size&ascending=false" \
      2>/dev/null || echo '{"error": "positions endpoint not available"}'
    echo
    ;;

  # ── Account portfolio (Phase 2) ───────────────────────────────────────
  portfolio)
    if [[ -z "${POLYMARKET_ADDRESS:-}" ]]; then
      echo '{"error": "POLYMARKET_ADDRESS not set — Phase 2 only"}'
      exit 0
    fi
    curl -fsS "${GAMMA}/positions?user=${POLYMARKET_ADDRESS}&sizeThreshold=.01"
    echo
    ;;

  # ── Quick market summary for agent ───────────────────────────────────
  summary)
    mid="${1:?usage: summary MARKET_ID}"
    curl -fsS "${GAMMA}/markets/${mid}" | python3 -c "
import json, sys
m = json.load(sys.stdin)
outcomes = m.get('outcomes', '[]')
if isinstance(outcomes, str):
    import json as j
    try: outcomes = j.loads(outcomes)
    except: outcomes = []
prices = m.get('outcomePrices', '[]')
if isinstance(prices, str):
    try: prices = [float(x) for x in j.loads(prices)]
    except: prices = []
print('=== MARKET SUMMARY ===')
print(f'Title: {m.get(\"question\") or m.get(\"title\")}')
print(f'ID: {m.get(\"id\")}')
print(f'Slug: {m.get(\"slug\")}')
print(f'Liquidity: \${float(m.get(\"liquidity\",0) or 0):,.0f}')
print(f'Volume 24h: \${float(m.get(\"volume24hr\",0) or 0):,.0f}')
print(f'End Date: {m.get(\"endDate\") or m.get(\"end_date_iso\")}')
print(f'Outcomes & Prices:')
for i, (o, p) in enumerate(zip(outcomes, prices)):
    print(f'  [{i}] {o}: {p:.3f} ({p*100:.1f}%)')
print(f'Description: {(m.get(\"description\") or \"\")[:300]}')
"
    ;;

  *)
    echo "Usage: bash scripts/polymarket.sh <command> [args]" >&2
    echo "" >&2
    echo "Commands:" >&2
    echo "  markets            All active markets (top 100 by volume)" >&2
    echo "  markets-filtered   Markets passing strategy criteria" >&2
    echo "  market ID          Single market detail" >&2
    echo "  trending           Top 20 trending markets" >&2
    echo "  search KEYWORD     Search markets" >&2
    echo "  prices ID          Price history" >&2
    echo "  positions ID       Top holders" >&2
    echo "  portfolio          Your open positions (Phase 2)" >&2
    echo "  summary ID         Human-readable market summary" >&2
    exit 1
    ;;
esac
