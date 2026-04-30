#!/usr/bin/env python3
"""
analyze.py — CHALLENGE $10→$100 — ТРИ СТРАТЕГИИ
1. ARBI    — сравнение с букмекерами (реальный edge)
2. SMART   — копируем топ-трейдеров
3. SCAN    — математический скан + Claude
"""

import os, sys, json, subprocess, re, urllib.request, urllib.error, statistics
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).parent.parent
ENV_FILE = ROOT / ".env"

if ENV_FILE.exists():
    for line in ENV_FILE.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            k, v = k.strip(), v.strip().strip('"').strip("'")
            os.environ[k] = v

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
ODDS_API_KEY      = os.environ.get("ODDS_API_KEY", "")
GAMMA             = os.environ.get("GAMMA_API_URL", "https://gamma-api.polymarket.com")
DATA_API          = os.environ.get("DATA_API_URL", "https://data-api.polymarket.com")
MIN_SIGNAL_SCORE  = int(os.environ.get("MIN_SIGNAL_SCORE", "75"))
SIGNAL_COOLDOWN_HOURS = int(os.environ.get("SIGNAL_COOLDOWN_HOURS", "12"))
SMART_MIN_DOMINANCE = float(os.environ.get("SMART_MIN_DOMINANCE", "0.65"))
AI_DISABLED_NOTICE = os.environ.get("AI_DISABLED_NOTICE", "0").lower() in ("1", "true", "yes")
REVIEW_IN_ALL = os.environ.get("REVIEW_IN_ALL", "0").lower() in ("1", "true", "yes")
SETTLE_IN_ALL = os.environ.get("SETTLE_IN_ALL", "0").lower() in ("1", "true", "yes")
HIGH_CONFIDENCE_ONLY = os.environ.get("HIGH_CONFIDENCE_ONLY", "1").lower() in ("1", "true", "yes")
MIN_CONSENSUS_PROB = float(os.environ.get("MIN_CONSENSUS_PROB", "0.80"))
MAX_CONSENSUS_PROB = float(os.environ.get("MAX_CONSENSUS_PROB", "0.98"))
MIN_BOOKMAKER_QUOTES = int(os.environ.get("MIN_BOOKMAKER_QUOTES", "3"))
MEDIUM_CONFIDENCE_MIN = float(os.environ.get("MEDIUM_CONFIDENCE_MIN", "0.65"))
MEDIUM_MIN_EDGE = float(os.environ.get("MEDIUM_MIN_EDGE", "0.20"))
MEDIUM_MIN_BOOKMAKERS = int(os.environ.get("MEDIUM_MIN_BOOKMAKERS", "5"))
NO_OPP_COOLDOWN_HOURS = int(os.environ.get("NO_OPP_COOLDOWN_HOURS", "4"))

# ─────────────────────────────────────────────────────────────
# УТИЛИТЫ
# ─────────────────────────────────────────────────────────────
def fetch(url, headers=None):
    req = urllib.request.Request(
        url, headers=headers or {"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read())

def call_polymarket(cmd):
    r = subprocess.run(
        ["bash", str(ROOT / "scripts/polymarket.sh")] + cmd,
        capture_output=True, text=True, timeout=300)
    if r.returncode != 0:
        raise RuntimeError(r.stderr[:200])
    return json.loads(r.stdout)

def call_claude(system, user, max_tokens=2000):
    payload = json.dumps({
        "model": "claude-sonnet-4-20250514",
        "max_tokens": max_tokens,
        "system": system,
        "messages": [{"role": "user", "content": user}]
    }).encode()
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01"
        }
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read())["content"][0]["text"]

def send_telegram(msg):
    subprocess.run(
        ["bash", str(ROOT / "scripts/telegram.sh"), msg], timeout=15)

def append_memory(f, content):
    p = ROOT / "memory" / f
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, "a") as fp:
        fp.write(content)

def load_memory(f):
    p = ROOT / "memory" / f
    return p.read_text() if p.exists() else ""

def now_str():
    return datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')

def fmt_cents(price):
    return f"{float(price) * 100:.0f}¢"

def fmt_pct(value):
    return f"{float(value) * 100:.0f}%"

def load_json_memory(filename, default):
    path = ROOT / "memory" / filename
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text())
    except Exception:
        return default

def load_jsonl_memory(filename):
    path = ROOT / "memory" / filename
    if not path.exists():
        return []
    rows = []
    for line in path.read_text().splitlines():
        try:
            rows.append(json.loads(line))
        except Exception:
            continue
    return rows

def save_json_memory(filename, data):
    path = ROOT / "memory" / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, sort_keys=True))

def append_jsonl_memory(filename, row):
    path = ROOT / "memory" / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "a") as fp:
        fp.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")

def record_signal(strategy, payload):
    slug = payload.get("slug", "")
    outcome = payload.get("outcome", "")
    sent_at = now_str()
    signal_id = f"{sent_at}|{strategy}|{slug}|{outcome}"
    append_jsonl_memory("SIGNALS.jsonl", {
        "sent_at": sent_at,
        "signal_id": signal_id,
        "strategy": strategy,
        **payload,
    })

def signal_instance_id(row):
    return row.get("signal_id") or (
        f"{row.get('sent_at','')}|{row.get('strategy','')}|"
        f"{row.get('slug','')}|{row.get('outcome','')}"
    )

def signal_key(strategy, slug, outcome):
    return f"{strategy}:{slug}:{outcome}".lower()

def is_on_cooldown(strategy, slug, outcome):
    state = load_json_memory("SIGNAL-STATE.json", {})
    key = signal_key(strategy, slug, outcome)
    last_ts = state.get(key)
    if not last_ts:
        return False
    age = datetime.now(timezone.utc).timestamp() - float(last_ts)
    return age < SIGNAL_COOLDOWN_HOURS * 3600

def should_send_no_opp(strategy):
    state = load_json_memory("SIGNAL-STATE.json", {})
    key = f"last_no_opp:{strategy.lower()}"
    last_ts = state.get(key)
    if not last_ts:
        return True
    age = datetime.now(timezone.utc).timestamp() - float(last_ts)
    return age > NO_OPP_COOLDOWN_HOURS * 3600

def mark_no_opp_sent(strategy):
    state = load_json_memory("SIGNAL-STATE.json", {})
    state[f"last_no_opp:{strategy.lower()}"] = datetime.now(timezone.utc).timestamp()
    save_json_memory("SIGNAL-STATE.json", state)

def mark_signal_sent(strategy, slug, outcome):
    state = load_json_memory("SIGNAL-STATE.json", {})
    state[signal_key(strategy, slug, outcome)] = datetime.now(timezone.utc).timestamp()
    save_json_memory("SIGNAL-STATE.json", state)

def arbi_score(op):
    score = 0
    edge = op["edge"]
    liq = op["liq"]
    price = op["poly_price"]
    prob = op["consensus_prob"]
    # Tier A: high confidence 80-98%
    if prob >= 0.80: score += 20
    if prob >= 0.90: score += 15
    if prob >= 0.95: score += 10
    # Tier B: medium confidence 65-79% — requires stronger edge
    if 0.65 <= prob < 0.80 and edge >= MEDIUM_MIN_EDGE: score += 15
    if op["bookmaker_quotes"] >= 3: score += 10
    if op["bookmaker_quotes"] >= 5: score += 10
    if op["bookmaker_quotes"] >= 8: score += 5
    if edge >= 0.10: score += 15
    if edge >= 0.20: score += 15
    if edge >= 0.30: score += 10
    if 0.55 <= price <= 0.90: score += 10
    if liq >= 10000: score += 5
    if liq >= 50000: score += 5
    hours = op.get("hours", op.get("days", 5) * 24)
    if hours <= 3: score += 25
    elif hours <= 6: score += 20
    elif hours <= 12: score += 15
    elif hours <= 24: score += 10
    return min(score, 100)

def smart_score(op):
    score = 0
    if op["total_size"] >= 2000: score += 25
    if op["total_size"] >= 5000: score += 15
    if op["buyer_count"] >= 2: score += 20
    if op["dominance"] >= SMART_MIN_DOMINANCE: score += 20
    if 0.20 <= op["avg_price"] <= 0.75: score += 10
    hours = op.get("hours", 24)
    if hours <= 3: score += 20
    elif hours <= 6: score += 15
    elif hours <= 12: score += 10
    elif hours <= 24: score += 5
    return min(score, 100)

# ─────────────────────────────────────────────────────────────
# СТРАТЕГИЯ 1: ARBI — Polymarket vs Букмекеры
# ─────────────────────────────────────────────────────────────
def run_arbi():
    """
    Сравниваем Polymarket с the-odds-api.com.
    Если букмекер даёт 75%, а Polymarket 50% → edge +50%.
    Регистрация бесплатно: the-odds-api.com (500 запросов/месяц).
    """
    print("\n[ARBI] ═══ СТРАТЕГИЯ 1: Polymarket vs Букмекеры ═══")

    if not ODDS_API_KEY or ODDS_API_KEY == "your_odds_api_key_here":
        msg = (
            "⚡ *СТРАТЕГИЯ 1: Polymarket vs Букмекеры*\n\n"
            "Для этой стратегии нужен бесплатный API ключ\\.\n\n"
            "1\\. Зайди на the\\-odds\\-api\\.com\n"
            "2\\. Зарегистрируйся \\(бесплатно\\)\n"
            "3\\. Скопируй API key\n"
            "4\\. Добавь в \\.env:\n"
            "`ODDS_API_KEY=твой_ключ`\n\n"
            "После этого бот будет сравнивать Polymarket с реальными "
            "букмекерами и находить реальный edge\\."
        )
        send_telegram(msg)
        print("[ARBI] ODDS_API_KEY не настроен — инструкция отправлена в Telegram")
        return

    print("[ARBI] Загружаю коэффициенты букмекеров...")

    # Ключевые слова для проверки что Polymarket рынок соответствует спорту
    SPORT_POLY_KEYWORDS = {
        "basketball_nba":           ["nba"],
        "soccer_epl":               ["premier", "epl", "english-premier"],
        "soccer_bundesliga":        ["bundesliga", "german"],
        "soccer_spain_la_liga":     ["la-liga", "laliga", "spain"],
        "soccer_uefa_champs_league":["champions", "ucl", "europa"],
        "soccer_italy_serie_a":     ["serie-a", "italy", "italian"],
        "soccer_france_ligue_one":  ["ligue", "french", "france"],
        "baseball_mlb":             ["mlb", "baseball"],
        "icehockey_nhl":            ["nhl", "hockey"],
        "tennis_atp":               ["atp", "tennis"],
        "tennis_wta":               ["wta", "tennis"],
    }

    # Загружаем спортивные события с коэффициентами
    sports = [
        "soccer_epl", "soccer_bundesliga", "soccer_spain_la_liga",
        "basketball_nba", "soccer_uefa_champs_league",
        "soccer_italy_serie_a", "soccer_france_ligue_one",
        "baseball_mlb", "icehockey_nhl",
        "tennis_atp", "tennis_wta",
    ]

    bookie_games = []
    for sport in sports:
        try:
            url = (f"https://api.the-odds-api.com/v4/sports/{sport}/odds/"
                   f"?apiKey={ODDS_API_KEY}&regions=eu&markets=h2h"
                   f"&oddsFormat=decimal&dateFormat=iso")
            games = fetch(url)
            for g in games[:10]:
                bookie_games.append({"sport": sport, **g})
            print(f"[ARBI] {sport}: {len(games)} матчей")
        except Exception as e:
            print(f"[ARBI] Ошибка {sport}: {e}")

    if not bookie_games:
        print("[ARBI] Нет данных от букмекеров")
        return

    # Загружаем Polymarket спортивные рынки — только закрывающиеся через 10 мин — 24ч
    now = datetime.now(timezone.utc)
    try:
        poly_markets = call_polymarket(["markets-filtered"])
        short = []
        for m in poly_markets:
            end = m.get("endDate") or m.get("end_date_iso", "")
            if not end:
                continue
            try:
                end_dt = datetime.fromisoformat(end.replace("Z", "+00:00"))
                hours_left = (end_dt - now).total_seconds() / 3600
                if 0.17 <= hours_left <= 24:
                    m["_hours_left"] = round(hours_left, 1)
                    short.append(m)
            except Exception:
                continue
        print(f"[ARBI] Polymarket рынков 10мин-24ч: {len(short)}")
    except Exception as e:
        print(f"[ARBI] Ошибка Polymarket: {e}")
        return

    # Ищем совпадения между букмекерами и Polymarket
    opportunities = []

    for game in bookie_games:
        home = game.get("home_team", "")
        away = game.get("away_team", "")
        commence = game.get("commence_time", "")

        try:
            game_dt = datetime.fromisoformat(commence.replace("Z", "+00:00"))
            hours_to_game = (game_dt - now).total_seconds() / 3600
            # Матчи которые начинаются в течение 24 часов или уже идут
            if not (-3 <= hours_to_game <= 24):
                continue
        except Exception:
            continue

        # Собираем вероятности по нескольким букмекерам.
        # Для безопасного режима используем медиану, а не один лучший коэффициент.
        home_probs = []
        away_probs = []
        best_home_odds = 0
        best_away_odds = 0
        best_home_bookmaker = ""
        best_away_bookmaker = ""
        for bookmaker in game.get("bookmakers", []):
            bookmaker_name = bookmaker.get("title") or bookmaker.get("key", "bookmaker")
            for market in bookmaker.get("markets", []):
                if market.get("key") != "h2h":
                    continue
                for outcome in market.get("outcomes", []):
                    outcome_price = float(outcome.get("price", 0) or 0)
                    if outcome_price <= 1.0:
                        continue
                    if outcome.get("name") == home:
                        home_probs.append(1 / outcome_price)
                        if outcome_price > best_home_odds:
                            best_home_odds = outcome_price
                            best_home_bookmaker = bookmaker_name
                    elif outcome.get("name") == away:
                        away_probs.append(1 / outcome_price)
                        if outcome_price > best_away_odds:
                            best_away_odds = outcome_price
                            best_away_bookmaker = bookmaker_name

        if len(home_probs) < MIN_BOOKMAKER_QUOTES or len(away_probs) < MIN_BOOKMAKER_QUOTES:
            continue

        home_prob = statistics.median(home_probs)
        away_prob = statistics.median(away_probs)
        home_quote_count = len(home_probs)
        away_quote_count = len(away_probs)

        # Ключевые слова для команд — все слова длиннее 3 символов
        home_kws = [w for w in home.lower().split() if len(w) > 3]
        away_kws = [w for w in away.lower().split() if len(w) > 3]
        if not home_kws:
            home_kws = [home.lower().split()[-1]]
        if not away_kws:
            away_kws = [away.lower().split()[-1]]

        sport_kws = SPORT_POLY_KEYWORDS.get(game.get("sport", ""), [])

        for pm in short:
            q = (pm.get("question") or pm.get("title", "")).lower()
            slug = pm.get("slug", "")

            # Отфильтровываем серийные рынки — букмекерские h2h коэффициенты
            # нельзя сравнивать с "кто выиграет серию/турнир"
            if any(kw in slug for kw in ["win-series", "win-the-series",
                                          "who-will-win-series", "champion",
                                          "world-cup", "stanley-cup",
                                          "world-series", "finals"]):
                continue

            # Проверяем что Polymarket рынок относится к тому же спорту
            if sport_kws and not any(kw in slug or kw in q for kw in sport_kws):
                continue

            if not any(kw in q or kw in slug for kw in home_kws) and \
               not any(kw in q or kw in slug for kw in away_kws):
                continue

            prices = pm.get("_prices_parsed", [])
            outcomes = pm.get("_outcomes_parsed", [])

            for outcome_name, poly_price in zip(outcomes, prices):
                o_lower = outcome_name.lower()

                # Матчим команду по всем ключевым словам
                home_match = any(kw in o_lower for kw in home_kws) or home.lower() in o_lower
                away_match = any(kw in o_lower for kw in away_kws) or away.lower() in o_lower

                if home_match and not away_match:
                    consensus_prob = home_prob
                    team = home
                    best_odds = best_home_odds
                    best_bookmaker = best_home_bookmaker
                    quote_count = home_quote_count
                elif away_match and not home_match:
                    consensus_prob = away_prob
                    team = away
                    best_odds = best_away_odds
                    best_bookmaker = best_away_bookmaker
                    quote_count = away_quote_count
                else:
                    continue

                # Считаем edge до фильтров
                edge = consensus_prob - poly_price
                if edge < 0.10 or poly_price < 0.02 or poly_price > 0.90:
                    continue

                # Tier A: HIGH_CONFIDENCE_ONLY требует 80-98%
                # Tier B: medium tier 65-79% требует больший edge и больше букмекеров
                if HIGH_CONFIDENCE_ONLY:
                    is_high = MIN_CONSENSUS_PROB <= consensus_prob <= MAX_CONSENSUS_PROB
                    is_medium = (MEDIUM_CONFIDENCE_MIN <= consensus_prob < MIN_CONSENSUS_PROB
                                 and edge >= MEDIUM_MIN_EDGE
                                 and len(home_probs if home_match else away_probs) >= MEDIUM_MIN_BOOKMAKERS)
                    if not is_high and not is_medium:
                        continue

                ev = consensus_prob / poly_price - 1
                if ev < 0.30:
                    continue

                actual_sport = game.get("sport", sport)
                hours_left = pm.get("_hours_left", 24)
                opportunities.append({
                    "slug": slug,
                    "question": pm.get("question") or pm.get("title",""),
                    "outcome": outcome_name,
                    "poly_price": poly_price,
                    "consensus_prob": consensus_prob,
                    "bookie_odds": best_odds,
                    "bookmaker": best_bookmaker,
                    "bookmaker_quotes": quote_count,
                    "edge": edge,
                    "ev": ev,
                    "hours": hours_left,
                    "days": max(0, round(hours_left / 24, 1)),
                    "liq": float(pm.get("liquidity", 0) or 0),
                    "sport": actual_sport,
                    "home": home,
                    "away": away,
                    "commence_time": commence,
                    "tier": "A" if consensus_prob >= MIN_CONSENSUS_PROB else "B",
                    "source": f"The Odds API /v4/sports/{actual_sport}/odds and Polymarket Gamma markets"
                })

    print(f"[ARBI] Найдено арбитражных возможностей: {len(opportunities)}")

    if HIGH_CONFIDENCE_ONLY:
        opportunities.sort(
            key=lambda x: (x["consensus_prob"], x["edge"], x["liq"]),
            reverse=True,
        )
    else:
        opportunities.sort(key=lambda x: x["edge"], reverse=True)

    log = f"\n## {now_str()} — ARBI: {len(opportunities)} возможностей\n\n"

    for op in opportunities[:3]:
        poly_price = op["poly_price"]
        if poly_price < 0.02 or poly_price > 0.90:
            print(f"[ARBI] Пропускаю (цена вне диапазона): {op['slug']} price={poly_price}")
            continue
        score = arbi_score(op)
        if score < MIN_SIGNAL_SCORE:
            print(f"[ARBI] Пропускаю (score {score} < {MIN_SIGNAL_SCORE}): {op['slug']}")
            continue
        if is_on_cooldown("ARBI", op["slug"], op["outcome"]):
            print(f"[ARBI] Пропускаю cooldown: {op['slug']} {op['outcome']}")
            continue
        payout = min(round(10 / poly_price), 100)
        ev_pct = round(op["ev"] * 100)
        edge_pct = round(op["edge"] * 100)

        tier = op.get("tier", "A")
        tier_label = "🟢 TIER A \\(высокая уверенность\\)" if tier == "A" else "🟡 TIER B \\(средняя уверенность, больший edge\\)"
        sport_emoji = {"basketball_nba": "🏀", "soccer_epl": "⚽", "soccer_bundesliga": "⚽",
                       "soccer_spain_la_liga": "⚽", "soccer_uefa_champs_league": "⚽",
                       "soccer_italy_serie_a": "⚽", "soccer_france_ligue_one": "⚽",
                       "baseball_mlb": "⚾", "icehockey_nhl": "🏒",
                       "tennis_atp": "🎾", "tennis_wta": "🎾"}.get(op.get("sport",""), "🏟")
        msg = (
            f"🎰 *АРБИТРАЖ: Polymarket vs Букмекеры*\n"
            f"{tier_label}\n\n"
            f"{sport_emoji} *{op['home']} vs {op['away']}*\n"
            f"📋 {op['question'][:80]}\n\n"
            f"🔗 https://polymarket.com/event/{op['slug']}\n\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"✅ *ЧТО СТАВИТЬ:* {op['outcome']}\n"
            f"💰 Цена Polymarket: *{fmt_cents(op['poly_price'])}*\n"
            f"📊 Консенсус букмекеров: *{op['consensus_prob']*100:.0f}%* "
            f"\\({op['bookmaker_quotes']} источников, медиана\\)\n"
            f"🏦 Лучший коэф\\.: *{op['bookie_odds']:.2f}* "
            f"\\({op['bookmaker'] or 'не указан'}\\)\n"
            f"📈 *Edge: \\+{edge_pct}%* \\| EV: *\\+{ev_pct}%*\n"
            f"🧮 Signal score: *{score}/100*\n"
            f"⏱ Закрытие через: *{op['hours']:.1f} ч*\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"💵 *$10 → ${payout} если выиграем*\n\n"
            f"🔍 *Логика:* Консенсус {op['consensus_prob']*100:.0f}% vs "
            f"Polymarket {op['poly_price']*100:.0f}%\\. Edge реальный\\."
        )

        log += (
            f"- {op['question'][:60]}\n"
            f"  {op['outcome']} poly={op['poly_price']:.2f}"
            f" consensus={op['consensus_prob']:.2f} edge={edge_pct}%\n\n"
        )

        send_telegram(msg)
        mark_signal_sent("ARBI", op["slug"], op["outcome"])
        record_signal("ARBI", {
            "slug": op["slug"],
            "question": op["question"],
            "outcome": op["outcome"],
            "polymarket_url": f"https://polymarket.com/event/{op['slug']}",
            "poly_price": op["poly_price"],
            "bookie_probability": op["consensus_prob"],
            "bookie_odds": op["bookie_odds"],
            "bookmaker": op["bookmaker"],
            "bookmaker_quotes": op["bookmaker_quotes"],
            "edge": op["edge"],
            "ev": op["ev"],
            "signal_score": score,
            "liquidity": op["liq"],
            "days": op["days"],
            "sport": op["sport"],
            "tier": op.get("tier", "A"),
            "source": op["source"],
            "commence_time": op["commence_time"],
        })
        print(f"[ARBI] ✅ {op['question'][:50]}")

    append_memory("SCAN-LOG.md", log)

    if not opportunities and should_send_no_opp("ARBI"):
        send_telegram(
            "🎰 *АРБИТРАЖ: нет возможностей*\n\n"
            f"Нет рынков где букмекерский консенсус ≥{int(MEDIUM_CONFIDENCE_MIN*100)}% "
            "и Polymarket недооценивает исход\\."
        )
        mark_no_opp_sent("ARBI")

    print(f"[ARBI] DONE. {min(len(opportunities),3)} сигналов отправлено.")


# ─────────────────────────────────────────────────────────────
# СТРАТЕГИЯ 2: SMART — Копируем топ-трейдеров
# ─────────────────────────────────────────────────────────────
def run_smart():
    """
    Смотрим последние крупные сделки на активных рынках.
    Если видим покупки $1000+ на одном исходе → это умные деньги.
    """
    print("\n[SMART] ═══ СТРАТЕГИЯ 2: Копируем умные деньги ═══")
    # В HIGH_CONFIDENCE_ONLY режиме SMART работает с повышенным порогом объёма
    smart_min_vol = 10000 if HIGH_CONFIDENCE_ONLY else 2000
    smart_min_buys = 4 if HIGH_CONFIDENCE_ONLY else 2
    if HIGH_CONFIDENCE_ONLY:
        print(f"[SMART] Safe mode: требую vol>=${smart_min_vol}, buys>={smart_min_buys}")

    # Берём активные рынки с высокой ликвидностью
    try:
        poly_markets = call_polymarket(["markets-filtered"])
        now_smart = datetime.now(timezone.utc)
        active = []
        for m in poly_markets:
            liq = float(m.get("liquidity", 0) or 0)
            if liq < 50000:
                continue
            end = m.get("endDate") or m.get("end_date_iso", "")
            if not end:
                continue
            try:
                end_dt = datetime.fromisoformat(end.replace("Z", "+00:00"))
                hours_left = (end_dt - now_smart).total_seconds() / 3600
                if 0.17 <= hours_left <= 24:
                    m["_hours_left"] = round(hours_left, 1)
                    active.append(m)
            except Exception:
                continue
        print(f"[SMART] Активных рынков 10мин-24ч: {len(active)}")
    except Exception as e:
        print(f"[SMART] Ошибка загрузки рынков: {e}")
        return

    # Собираем крупные сделки с рынков
    market_activity = {}  # slug -> {outcome: [trades]}

    for m in active[:15]:  # Топ-15 по ликвидности
        slug = m.get("slug", "")
        if not slug:
            continue

        try:
            # Получаем последние трейды для рынка.
            # Polymarket data-api принимает conditionId в параметре market.
            condition_id = m.get("conditionId", "")
            if not condition_id:
                continue
            trades_data = fetch(
                f"{DATA_API}/trades?market={condition_id}&limit=50&takerOnly=false")
            trades = (trades_data if isinstance(trades_data, list)
                      else trades_data.get("trades", []))

            for tr in trades:
                size = float(tr.get("size", tr.get("amount", 0)) or 0)
                min_trade_size = 1000 if HIGH_CONFIDENCE_ONLY else 500
                if size < min_trade_size:
                    continue

                price = float(tr.get("price", 0) or 0)
                if price < 0.10 or price > 0.90:
                    continue

                side = tr.get("side", tr.get("type", "")).lower()
                outcome = tr.get("outcome", "")

                # Только покупки
                if "sell" in side:
                    continue

                if slug not in market_activity:
                    market_activity[slug] = {}
                if outcome not in market_activity[slug]:
                    market_activity[slug][outcome] = []

                market_activity[slug][outcome].append({
                    "price": price,
                    "size": size,
                    "side": side
                })

        except Exception as e:
            print(f"[SMART] Ошибка {slug[:20]}: {e}")

    # Ищем рынки с концентрацией крупных покупок
    consensus = []
    for slug, outcomes in market_activity.items():
        slug_total_size = sum(
            sum(t["size"] for t in trades)
            for trades in outcomes.values()
        )
        for outcome, trades in outcomes.items():
            if len(trades) < smart_min_buys:
                continue

            total_size = sum(t["size"] for t in trades)
            avg_price = sum(t["price"] * t["size"] for t in trades) / total_size
            trade_count = len(trades)
            dominance = total_size / slug_total_size if slug_total_size else 0

            if total_size < smart_min_vol:
                continue
            if dominance < SMART_MIN_DOMINANCE:
                print(
                    f"[SMART] Пропускаю {slug} {outcome}: "
                    f"dominance={dominance:.0%}, есть покупки на обе стороны"
                )
                continue

            # Находим название рынка
            title = slug
            days_left = 999
            condition_id = ""
            for m in active:
                if m.get("slug") == slug:
                    title = m.get("question") or m.get("title", slug)
                    days_left = int(m.get("_days_left", 999))
                    condition_id = m.get("conditionId", "")
                    break

            hours_left = float(m.get("_hours_left", 24) if m.get("slug") == slug else 24)
            for mkt in active:
                if mkt.get("slug") == slug:
                    hours_left = mkt.get("_hours_left", 24)
                    break
            consensus.append({
                "slug": slug,
                "title": title,
                "outcome": outcome,
                "avg_price": avg_price,
                "buyer_count": trade_count,
                "total_size": total_size,
                "dominance": dominance,
                "hours": hours_left,
                "days": max(0, round(hours_left / 24, 1)),
                "condition_id": condition_id,
            })

    # Сортируем по объёму
    consensus.sort(key=lambda x: x["total_size"], reverse=True)

    print(f"[SMART] Найдено консенсусов: {len(consensus)}")

    log = f"\n## {now_str()} — SMART MONEY: {len(consensus)} сигналов\n\n"

    for op in consensus[:3]:
        avg_price = op["avg_price"]
        if avg_price < 0.10 or avg_price > 0.90:
            print(f"[SMART] Пропускаю (цена вне диапазона): {op['slug']} price={avg_price}")
            continue
        score = smart_score(op)
        if score < MIN_SIGNAL_SCORE:
            print(f"[SMART] Пропускаю (score {score} < {MIN_SIGNAL_SCORE}): {op['slug']}")
            continue
        if is_on_cooldown("SMART", op["slug"], op["outcome"]):
            print(f"[SMART] Пропускаю cooldown: {op['slug']} {op['outcome']}")
            continue
        payout = min(round(10 / avg_price), 100)

        msg = (
            f"👀 *УМНЫЕ ДЕНЬГИ — КРУПНЫЕ СДЕЛКИ*\n\n"
            f"📋 *{op['title']}*\n\n"
            f"🔗 https://polymarket.com/event/{op['slug']}\n\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"✅ *ЧТО СТАВИТЬ:* {op['outcome']}\n"
            f"💰 Средняя цена входа: *{fmt_cents(avg_price)}*\n"
            f"👥 Крупных покупок: *{op['buyer_count']}*\n"
            f"💵 Суммарный объём: *${op['total_size']:,.0f}*\n"
            f"📊 Доминирование стороны: *{op['dominance']*100:.0f}%*\n"
            f"🧮 Signal score: *{score}/100*\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"💵 *$10 → ${payout} если выиграем*\n\n"
            f"🔍 *Логика:* Крупные игроки вложили "
            f"${op['total_size']:,.0f} в {op['outcome']}\\. "
            f"Это сигнал для проверки, не гарантия исхода\\.\n\n"
            f"📌 Источник: Polymarket Data API trades"
        )

        log += (
            f"- {op['title'][:60]}\n"
            f"  {op['outcome']}@{avg_price:.2f}"
            f" trades={op['buyer_count']}"
            f" vol=${op['total_size']:,.0f}"
            f" dominance={op['dominance']:.0%}"
            f" score={score}\n\n"
        )

        send_telegram(msg)
        mark_signal_sent("SMART", op["slug"], op["outcome"])
        record_signal("SMART", {
            "slug": op["slug"],
            "question": op["title"],
            "outcome": op["outcome"],
            "polymarket_url": f"https://polymarket.com/event/{op['slug']}",
            "avg_price": op["avg_price"],
            "large_buy_count": op["buyer_count"],
            "total_size": op["total_size"],
            "dominance": op["dominance"],
            "signal_score": score,
            "days": op["days"],
            "source": "Polymarket Data API /trades",
            "condition_id": op["condition_id"],
        })
        print(f"[SMART] ✅ {op['title'][:50]}")

    append_memory("SCAN-LOG.md", log)

    if not consensus and should_send_no_opp("SMART"):
        send_telegram(
            "👀 *УМНЫЕ ДЕНЬГИ*\n\n"
            f"Нет крупных сделок \\(порог: ${smart_min_vol:,}, "
            f"мин\\. {smart_min_buys} покупки\\)\\."
        )
        mark_no_opp_sent("SMART")

    print(f"[SMART] DONE.")


# ─────────────────────────────────────────────────────────────
# СТРАТЕГИЯ 3: RESEARCH — Весь Polymarket + внешние данные
# ─────────────────────────────────────────────────────────────
def fetch_coingecko():
    """Реальные цены топ криптовалют — бесплатно без ключа."""
    try:
        data = fetch(
            "https://api.coingecko.com/api/v3/simple/price"
            "?ids=bitcoin,ethereum,solana,dogecoin,ripple,cardano"
            "&vs_currencies=usd&include_24hr_change=true"
        )
        lines = []
        for coin, vals in data.items():
            price = vals.get("usd", 0)
            change = vals.get("usd_24h_change", 0)
            lines.append(f"{coin.upper()}: ${price:,.0f} ({change:+.1f}% 24h)")
        return "\n".join(lines)
    except Exception as e:
        return f"CoinGecko недоступен: {e}"

def fetch_metaculus_forecasts():
    """Топ активных вопросов с прогнозами сообщества Metaculus."""
    try:
        data = fetch(
            "https://www.metaculus.com/api2/questions/"
            "?status=open&order_by=-activity&limit=30&forecast_type=binary"
        )
        questions = data.get("results", [])
        lines = []
        for q in questions:
            title = q.get("title", "")[:80]
            cp = q.get("community_prediction", {})
            prob = cp.get("q2") or cp.get("full", {}).get("q2")
            if prob is None:
                continue
            close = q.get("close_time", "")[:10]
            lines.append(f'METACULUS: "{title}" prob={prob:.2f} close={close}')
        return "\n".join(lines[:20]) if lines else "нет данных"
    except Exception as e:
        return f"Metaculus недоступен: {e}"

def classify_market(question, slug):
    """Определяем категорию рынка по ключевым словам."""
    q = (question + " " + slug).lower()
    if any(k in q for k in ["bitcoin","btc","ethereum","eth","crypto","solana","sol","doge","xrp"]):
        return "crypto"
    if any(k in q for k in ["trump","biden","election","president","congress","senate","vote","poll","republican","democrat","modi","macron","putin","xi "]):
        return "politics"
    if any(k in q for k in ["nba","nfl","mlb","nhl","soccer","football","tennis","golf","cricket","f1","ufc","boxing"]):
        return "sports"
    if any(k in q for k in ["fed","rate","gdp","inflation","recession","unemployment","s&p","nasdaq","dow","oil","gold","silver"]):
        return "economy"
    if any(k in q for k in ["ai","openai","gpt","claude","anthropic","google","apple","microsoft","meta ","amazon","tesla"]):
        return "tech"
    if any(k in q for k in ["war","ceasefire","sanctions","nato","ukraine","russia","israel","iran","china","taiwan"]):
        return "geopolitics"
    return "other"

def run_research():
    """
    Сканирует ВЕСЬ Polymarket по всем категориям.
    Для каждого топ-рынка подтягивает реальные данные (крипта, Metaculus)
    и просит Claude оценить вероятность на основе этих данных.
    """
    print("\n[RESEARCH] ═══ СТРАТЕГИЯ 3: Весь Polymarket + реальные данные ═══")

    if not ANTHROPIC_API_KEY:
        print("[RESEARCH] Нет ANTHROPIC_API_KEY — пропускаю")
        return

    # Загружаем топ рынков напрямую (быстрее чем полный скан)
    try:
        all_markets = []
        from datetime import timezone as _tz
        now = datetime.now(timezone.utc)
        req = urllib.request.Request(
            f"{GAMMA}/markets?active=true&closed=false"
            f"&limit=50&offset=0&order=volume24hr&ascending=false",
            headers={"User-Agent": "polymarket-bot/1.0"}
        )
        with urllib.request.urlopen(req, timeout=60) as r:
            batch = json.loads(r.read())
        if isinstance(batch, list):
            all_markets.extend(batch)
        elif isinstance(batch, dict):
            all_markets.extend(batch.get("markets", []))
        # Парсим даты и цены
        parsed = []
        for m in all_markets:
            try:
                liq = float(m.get("liquidity", 0) or 0)
                if liq < 10000:
                    continue
                end = m.get("endDate") or m.get("end_date_iso", "")
                if end:
                    end_dt = datetime.fromisoformat(end.replace("Z", "+00:00"))
                    hours = (end_dt - now).total_seconds() / 3600
                    if not (0.17 <= hours <= 24):
                        continue
                    m["_hours_left"] = round(hours, 1)
                    m["_days_left"] = round(hours / 24, 2)
                else:
                    continue
                outcomes = m.get("outcomes", "[]")
                if isinstance(outcomes, str):
                    outcomes = json.loads(outcomes)
                m["_outcomes_parsed"] = outcomes
                prices = m.get("outcomePrices", "[]")
                if isinstance(prices, str):
                    prices = json.loads(prices)
                m["_prices_parsed"] = [float(p) for p in prices if p]
                parsed.append(m)
            except Exception:
                continue
        all_markets = parsed
    except Exception as e:
        print(f"[RESEARCH] Ошибка загрузки рынков: {e}")
        return

    print(f"[RESEARCH] Всего рынков: {len(all_markets)}")

    # Фильтр: 1-21 день, цена 10-85¢ (интересная зона неопределённости)
    candidates = []
    for m in all_markets:
        hours = m.get("_hours_left", 0)
        prices = m.get("_prices_parsed", [])
        liq = float(m.get("liquidity", 0) or 0)
        if not (0.17 <= hours <= 24):
            continue
        if liq < 10000:
            continue
        # Для быстрых событий допускаем любые цены — проверяем через внешние данные
        if not prices:
            continue
        q = m.get("question") or m.get("title", "")
        m["_category"] = classify_market(q, m.get("slug", ""))
        candidates.append(m)

    # Сортируем: сначала по объёму торгов за 24ч
    candidates.sort(key=lambda x: float(x.get("volume24hr", 0) or 0), reverse=True)
    candidates = candidates[:80]

    # Группируем по категориям для статистики
    by_cat = {}
    for m in candidates:
        cat = m["_category"]
        by_cat.setdefault(cat, 0)
        by_cat[cat] += 1
    print(f"[RESEARCH] Кандидатов: {len(candidates)} — {by_cat}")

    # Собираем внешние данные
    print("[RESEARCH] Загружаю внешние данные...")
    crypto_data = fetch_coingecko()
    metaculus_data = fetch_metaculus_forecasts()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Формируем список рынков для Claude
    market_lines = []
    for m in candidates:
        prices = m.get("_prices_parsed", [])
        outcomes = m.get("_outcomes_parsed", [])
        hours = m.get("_hours_left", "?")
        liq = float(m.get("liquidity", 0) or 0)
        vol = float(m.get("volume24hr", 0) or 0)
        cat = m.get("_category", "other")
        price_str = " | ".join(
            f"{o}={p:.2f}" for o, p in zip(outcomes, prices)
            if 0.05 <= p <= 0.95
        )
        q = m.get("question") or m.get("title", "")
        market_lines.append(
            f"[{cat.upper()}] SLUG:{m.get('slug')} HOURS:{hours} "
            f"LIQ:${liq:,.0f} VOL24h:${vol:,.0f} "
            f"PRICES:[{price_str}] \"{q}\""
        )

    system_prompt = f"""Ты опытный трейдер на prediction markets. Сегодня {today}.
ВСЕ РЫНКИ ЗАКРЫВАЮТСЯ ЧЕРЕЗ 10 МИНУТ — 24 ЧАСА. Нужны БЫСТРЫЕ ставки.

ВНЕШНИЕ ДАННЫЕ ДЛЯ АНАЛИЗА:

=== КРИПТА (реальные цены прямо сейчас) ===
{crypto_data}

=== METACULUS ПРОГНОЗЫ СООБЩЕСТВА ===
{metaculus_data}

ТВОЯ ЗАДАЧА:
Найди рынки где цена на Polymarket ЯВНО неправильная — событие уже почти случилось
или точно НЕ случится в ближайшие часы.

ПРАВИЛА ОТБОРА:
1. Нужен конкретный внешний факт подтверждающий твою оценку
2. Для крипта: текущая цена говорит сама за себя (BTC сейчас $X → "достигнет ли $Y за 24ч?")
3. Для спорта: счёт матча, форма команд, контекст прямо сейчас
4. Для политики/событий: что точно НЕ случится за 24 часа (базовые ставки)
5. НЕ угадывай — только факты
6. our_probability ≥ 0.65 И bet_price ≤ 0.80
7. EV = our_probability / bet_price - 1 ≥ 0.12

ФОРМАТ — только JSON массив:
[{{
  "slug": "...",
  "question": "...",
  "category": "crypto/politics/sports/economy/tech/geopolitics/other",
  "bet_outcome": "YES или NO или название исхода",
  "bet_price": 0.XX,
  "our_probability": 0.XX,
  "ev_percent": XX,
  "days_to_resolution": "X.X часов",
  "liquidity": NNNNN,
  "conviction": "HIGH/MEDIUM/LOW",
  "external_evidence": "конкретный факт/источник подтверждающий оценку",
  "risk": "что может пойти не так"
}}]

Верни 3-5 лучших. Только рынки где есть реальный внешний факт. Приоритет — самые срочные."""

    user_prompt = (
        f"Проанализируй эти {len(candidates)} рынков и найди выигрышные ставки:\n\n"
        + "\n".join(market_lines)
    )

    print(f"[RESEARCH] Отправляю {len(candidates)} рынков в Claude...")

    try:
        response = call_claude(system_prompt, user_prompt, max_tokens=3000)
    except Exception as e:
        print(f"[RESEARCH] Claude ошибка: {e}")
        return

    opportunities = []
    try:
        jmatch = re.search(r'\[.*\]', response, re.DOTALL)
        if jmatch:
            opportunities = json.loads(jmatch.group())
    except Exception:
        print(f"[RESEARCH] Ошибка парсинга:\n{response[:300]}")

    print(f"[RESEARCH] Claude нашёл: {len(opportunities)} кандидатов")

    log = f"\n## {now_str()} — RESEARCH: {len(opportunities)} сигналов\n\n"
    sent = 0

    cat_emoji = {
        "crypto": "₿", "politics": "🗳", "sports": "🏆",
        "economy": "📈", "tech": "🤖", "geopolitics": "🌍", "other": "🔍"
    }

    for op in opportunities:
        prob = float(op.get("our_probability", 0))
        price = float(op.get("bet_price", 1))
        ev = prob / price - 1 if price > 0 else 0
        conviction = op.get("conviction", "MEDIUM")

        if prob < 0.65 or price < 0.005 or price > 0.98 or ev < 0.05:
            print(f"[RESEARCH] Пропускаю: {op.get('slug')} prob={prob:.2f} price={price:.2f} ev={ev:.2f}")
            continue
        if not op.get("external_evidence"):
            print(f"[RESEARCH] Пропускаю (нет внешнего подтверждения): {op.get('slug')}")
            continue

        slug = op.get("slug", "")
        outcome = op.get("bet_outcome", "YES")

        if is_on_cooldown("RESEARCH", slug, outcome):
            print(f"[RESEARCH] Cooldown: {slug}")
            continue

        cat = op.get("category", "other")
        emoji = cat_emoji.get(cat, "🔍")
        ev_pct = round(ev * 100)
        payout = min(round(10 / price), 100)
        question = op.get("question", "")[:90]
        evidence = op.get("external_evidence", "")[:200]
        risk = op.get("risk", "")[:150]
        days = op.get("days_to_resolution", "?")

        conv_icon = "🔥🔥" if conviction == "HIGH" else "🔥" if conviction == "MEDIUM" else "⚡"

        msg = (
            f"{conv_icon} *RESEARCH СИГНАЛ* {emoji} {cat.upper()}\n\n"
            f"📋 *{question}*\n\n"
            f"🔗 https://polymarket.com/event/{slug}\n\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"✅ *СТАВИТЬ:* {outcome}\n"
            f"💰 Цена: *{price*100:.0f}¢* \\| Наша оценка: *{prob*100:.0f}%*\n"
            f"📈 *EV: \\+{ev_pct}%* \\| Conviction: *{conviction}*\n"
            f"⏱ Закрытие через: *{op.get('days_to_resolution', '?')} ч*\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"📊 *Факт\\-основание:*\n{evidence}\n\n"
            f"⚠️ *Риск:* {risk}\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"💵 *$10 → ${payout} если выиграем*"
        )

        log += (
            f"- [{cat}] {question[:60]}\n"
            f"  {outcome}@{price:.2f} prob={prob:.0%} EV={ev_pct}%\n"
            f"  Факт: {evidence[:80]}\n\n"
        )

        try:
            send_telegram(msg)
            mark_signal_sent("RESEARCH", slug, outcome)
            record_signal("RESEARCH", {
                "slug": slug,
                "question": question,
                "outcome": outcome,
                "polymarket_url": f"https://polymarket.com/event/{slug}",
                "poly_price": price,
                "our_probability": prob,
                "ev": ev,
                "signal_score": round(ev * 100),
                "days": days,
                "category": cat,
                "external_evidence": evidence,
                "conviction": conviction,
                "source": "Claude + CoinGecko + Metaculus",
            })
            sent += 1
            print(f"[RESEARCH] ✅ [{cat}] {question[:50]}")
        except Exception as e:
            print(f"[RESEARCH] Telegram ошибка: {e}")

    append_memory("SCAN-LOG.md", log)

    if sent == 0 and should_send_no_opp("RESEARCH"):
        send_telegram(
            "🔍 *RESEARCH скан завершён*\n\n"
            f"Проверено {len(candidates)} рынков по всем категориям\\. "
            "Нет сигналов с внешним подтверждением и EV≥20%\\."
        )
        mark_no_opp_sent("RESEARCH")

    print(f"[RESEARCH] DONE. {sent} сигналов.")


# ─────────────────────────────────────────────────────────────
# СТРАТЕГИЯ 4: SCAN — Математика + Claude
# ─────────────────────────────────────────────────────────────
def run_scan():
    """
    Математический отбор топ рынков по объёму.
    Claude объясняет каждый и даёт вероятность 60%+.
    Порог снижен до 60% — честный риск-профиль для челленджа.
    """
    print("\n[SCAN] ═══ СТРАТЕГИЯ 3: Математика + AI ═══")
    print("[SCAN] AI-only сигналы отключены: они не являются проверяемым edge.")
    append_memory(
        "SCAN-LOG.md",
        f"\n## {now_str()} — AI SCAN DISABLED\n\n"
        "AI-only прогнозы не отправляются как ставки. Используй `arbi` и `smart`.\n"
    )
    if AI_DISABLED_NOTICE:
        send_telegram(
            "ℹ️ *БОТ РАБОТАЕТ*\n\n"
            "AI-only блок не отправляет ставки без внешнего подтверждения\\.\n"
            "Боевые сигналы ищутся через ARBI \\(букмекеры\\) и SMART \\(крупные сделки\\)\\."
        )
    return

    try:
        all_markets = call_polymarket(["markets-filtered"])
    except Exception as e:
        print(f"[SCAN] Ошибка: {e}"); sys.exit(1)

    print(f"[SCAN] Всего рынков: {len(all_markets)}")

    # Фильтр: 1-7 дней
    short = [m for m in all_markets
             if m.get("_days_left") and 1 <= m["_days_left"] <= 7]
    if len(short) < 10:
        short += [m for m in all_markets
                  if m.get("_days_left") and 7 < m["_days_left"] <= 14]

    print(f"[SCAN] Краткосрочных: {len(short)}")
    if not short:
        send_telegram("ℹ️ Нет рынков 1\\-14 дней\\."); return

    short.sort(key=lambda x: float(x.get("volume24hr",0) or 0), reverse=True)
    candidates = short[:60]

    lines = []
    for m in candidates:
        prices  = m.get("_prices_parsed", [])
        outcomes = m.get("_outcomes_parsed", [])
        days = m.get("_days_left", "?")
        liq  = float(m.get("liquidity", 0) or 0)
        vol  = float(m.get("volume24hr", 0) or 0)
        ps   = " ".join(f"{o}={p:.2f}" for o, p in zip(outcomes, prices))
        lines.append(
            f"SLUG:{m.get('slug')} DAYS:{days} "
            f"LIQ:${liq:,.0f} VOL:${vol:,.0f} "
            f"[{ps}] \"{m.get('question') or m.get('title','')}\""
        )

    system_prompt = """Ты трейдер на prediction markets. Найди лучшие ставки.

ПРАВИЛА:
- our_probability >= 0.60 (минимум 60% уверенности)
- bet_price <= 0.55 (максимальная цена входа)  
- EV = our_probability / bet_price - 1 >= 0.20 (минимум +20% edge)
- Только рынки 1-7 дней

ЧЕСТНАЯ ОЦЕНКА:
- Явный фаворит в спорте = 65-75%
- Очень явный фаворит = 75-85%
- Неопределённость = 50-60%

ФОРМАТ — только JSON массив:
[{
  "slug": "...",
  "question": "...",
  "bet_outcome": "YES или NO",
  "bet_price": 0.XX,
  "our_probability": 0.XX,
  "ev_percent": XX,
  "days_to_resolution": N,
  "liquidity": NNNNN,
  "conviction": "HIGH/MEDIUM/LOW",
  "why_we_win": "конкретная причина",
  "what_could_go_wrong": "риск",
  "resolution_date": "дата"
}]

Верни 3 лучших. Разрешено включать LOW conviction если EV > 40%.
Всегда верни хотя бы 1 результат."""

    user_prompt = (
        f"Сегодня: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}\n\n"
        f"Trader intel:\n{load_memory('TRADER-LOG.md')[-500:]}\n\n"
        f"РЫНКИ:\n{chr(10).join(lines)}\n\n"
        f"Верни JSON массив с 1-3 лучшими ставками."
    )

    print(f"[SCAN] Анализирую {len(candidates)} рынков через Claude...")

    try:
        response = call_claude(system_prompt, user_prompt, max_tokens=2500)
    except Exception as e:
        print(f"[SCAN] Claude ошибка: {e}"); sys.exit(1)

    opportunities = []
    try:
        jmatch = re.search(r'\[.*\]', response, re.DOTALL)
        if jmatch:
            opportunities = json.loads(jmatch.group())
    except Exception:
        print(f"[SCAN] Ошибка парсинга:\n{response[:300]}")

    print(f"[SCAN] Claude нашёл: {len(opportunities)} кандидатов")

    log = f"\n## {now_str()} — SCAN: {len(opportunities)} сигналов\n\n"
    sent = 0

    for op in opportunities:
        prob  = float(op.get("our_probability", 0))
        price = float(op.get("bet_price", 1))
        ev    = float(op.get("ev_percent", 0))

        if prob < 0.55 or price < 0.10 or price > 0.60:
            print(f"[SCAN] Пропускаю: {op.get('slug')} prob={prob} price={price}")
            continue

        slug       = op.get("slug", "")
        question   = op.get("question", "")[:100]
        outcome    = op.get("bet_outcome", "YES")
        days       = op.get("days_to_resolution", "?")
        liq        = int(op.get("liquidity", 0))
        conviction = op.get("conviction", "MEDIUM")
        why        = op.get("why_we_win", "")
        risk       = op.get("what_could_go_wrong", "")
        res_date   = op.get("resolution_date", "")
        if price < 0.01:
            print(f"[SCAN] Пропускаю (цена слишком низкая): {slug} price={price}")
            continue
        payout = min(round(10 / price), 100)  # макс $100 (10x)
        ev_disp    = round(ev)

        emoji = "🔥🔥" if conviction == "HIGH" else "🔥"

        msg = (
            f"{emoji} *AI СИГНАЛ*\n\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"📋 *{question}*\n"
            f"━━━━━━━━━━━━━━━━━━\n\n"
            f"✅ *ЧТО СТАВИТЬ:* *{outcome}*\n"
            f"🔗 https://polymarket.com/event/{slug}\n\n"
            f"💰 Цена входа: *{fmt_cents(price)}*\n"
            f"🧠 Уверенность: *{prob*100:.0f}%*\n"
            f"📈 *EV: \\+{ev_disp}%*\n"
            f"🎯 Conviction: *{conviction}*\n"
            f"⏱ Резолюция: *{res_date}* \\({days} дн\\.\\)\n"
            f"💧 Ликвидность: ${liq:,}\n\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"💵 *$10 → ${payout} если выиграем*\n\n"
            f"🔍 *Почему выиграем:*\n{why}\n\n"
            f"⚠️ *Риск:* {risk}"
        )

        log += (
            f"- {question[:60]}\n"
            f"  {outcome}@{price:.2f} prob={prob:.0%}"
            f" EV={ev_disp}% days={days}\n\n"
        )

        try:
            send_telegram(msg)
            sent += 1
            print(f"[SCAN] ✅ {question[:50]}")
        except Exception as e:
            print(f"[SCAN] Telegram ошибка: {e}")

    append_memory("SCAN-LOG.md", log)
    print(f"[SCAN] DONE. {sent} сигналов.")

    if sent == 0:
        send_telegram(
            f"🔍 *AI Скан завершён*\n"
            f"Нет сигналов с prob≥55% при цене≤60¢\\.\n"
            f"Следующий скан через 30 минут\\."
        )


# ─────────────────────────────────────────────────────────────
# REVIEW — проверка отправленных сигналов
# ─────────────────────────────────────────────────────────────
def load_signal_rows(limit=10):
    return load_jsonl_memory("SIGNALS.jsonl")[-limit:]

def parse_market_lists(market):
    outcomes = market.get("_outcomes_parsed") or market.get("outcomes", [])
    prices = market.get("_prices_parsed") or market.get("outcomePrices", [])
    if isinstance(outcomes, str):
        try:
            outcomes = json.loads(outcomes)
        except Exception:
            outcomes = []
    if isinstance(prices, str):
        try:
            prices = json.loads(prices)
        except Exception:
            prices = []

    parsed_prices = []
    for p in prices:
        try:
            parsed_prices.append(float(p))
        except Exception:
            parsed_prices.append(None)
    return outcomes, parsed_prices

def fetch_market_by_slug(slug):
    try:
        data = fetch(f"{GAMMA}/markets?slug={slug}&limit=10")
    except Exception:
        return None
    markets = data if isinstance(data, list) else data.get("markets", [])
    for market in markets:
        if market.get("slug") == slug:
            return market
    return markets[0] if markets else None

def outcome_price(market, target_outcome):
    outcomes, parsed_prices = parse_market_lists(market)
    target = str(target_outcome).strip().lower()
    for outcome, price in zip(outcomes, parsed_prices):
        if str(outcome).strip().lower() == target:
            return price
    return None

def market_terminal_status(market, target_outcome):
    final_price = outcome_price(market, target_outcome)
    prices = [p for p in parse_market_lists(market)[1] if p is not None]
    is_terminal = bool(market.get("closed") or market.get("resolved"))
    if prices and all(p in (0.0, 1.0, 0.5) for p in prices):
        is_terminal = True
    if prices and any(p >= 0.99 or p <= 0.01 for p in prices):
        is_terminal = True
    if final_price is None:
        return "UNKNOWN", None, is_terminal
    if not is_terminal:
        return "OPEN", final_price, False
    if final_price >= 0.99:
        return "WIN", final_price, True
    if final_price <= 0.01:
        return "LOSS", final_price, True
    if 0.45 <= final_price <= 0.55:
        return "PUSH", final_price, True
    return "CLOSED_UNCLEAR", final_price, True

def settlement_metrics(entry_price, final_price, stake=10.0):
    entry = float(entry_price)
    final = float(final_price)
    if entry <= 0:
        return None
    shares = stake / entry
    exit_value = shares * final
    pnl = exit_value - stake
    roi = pnl / stake
    return {
        "stake_usd": stake,
        "shares": shares,
        "exit_value_usd": exit_value,
        "pnl_usd": pnl,
        "roi": roi,
    }

def append_settlement(signal, settlement_status, final_price, market):
    entry_price = signal.get("poly_price", signal.get("avg_price"))
    metrics = settlement_metrics(entry_price, final_price) if (
        entry_price is not None and final_price is not None
    ) else None
    append_jsonl_memory("SIGNAL-SETTLEMENTS.jsonl", {
        "signal_id": signal_instance_id(signal),
        "settled_at": now_str(),
        "strategy": signal.get("strategy"),
        "slug": signal.get("slug"),
        "question": signal.get("question"),
        "outcome": signal.get("outcome"),
        "entry_price": entry_price,
        "final_price": final_price,
        "settlement_status": settlement_status,
        "market_closed": bool(market.get("closed")),
        "market_url": signal.get("polymarket_url"),
        "source": "Polymarket Gamma markets by slug",
        **(metrics or {}),
    })

def latest_settlement_map():
    latest = {}
    for row in load_jsonl_memory("SIGNAL-SETTLEMENTS.jsonl"):
        latest[row.get("signal_id")] = row
    return latest

def run_review():
    print("\n[REVIEW] Проверяю последние отправленные сигналы...")
    signals = load_signal_rows(limit=10)
    if not signals:
        print("[REVIEW] Нет SIGNALS.jsonl")
        send_telegram(
            "🧾 *ПРОВЕРКА СИГНАЛОВ*\n\n"
            "Журнал сигналов пока пуст\\. Сначала должен пройти ARBI или SMART сигнал\\."
        )
        return

    lines = []

    for signal in signals:
        slug = signal.get("slug", "")
        outcome = signal.get("outcome", "")
        start_price = signal.get("poly_price", signal.get("avg_price"))
        market = fetch_market_by_slug(slug)
        if not market:
            lines.append(
                f"• {signal.get('strategy')} {outcome}: рынок не найден"
            )
            continue

        current_price = outcome_price(market, outcome)
        if current_price is None or start_price is None:
            lines.append(
                f"• {signal.get('strategy')} {outcome}: текущая цена не найдена"
            )
            continue

        move = current_price - float(start_price)
        direction = "выше" if move > 0 else "ниже" if move < 0 else "без изменения"
        lines.append(
            f"• {signal.get('strategy')} {outcome}: "
            f"{fmt_cents(start_price)} → {fmt_cents(current_price)} "
            f"({direction} на {abs(move)*100:.0f} п.п.)"
        )

    msg = (
        "🧾 *ПРОВЕРКА ПОСЛЕДНИХ СИГНАЛОВ*\n\n"
        + "\n".join(lines[:10])
        + "\n\nИсточник проверки: Polymarket Gamma markets."
    )
    send_telegram(msg)
    print("[REVIEW] DONE.")

def run_settle():
    print("\n[SETTLE] Проверяю, какие сигналы уже закрылись...")
    signals = load_jsonl_memory("SIGNALS.jsonl")
    if not signals:
        print("[SETTLE] Нет SIGNALS.jsonl")
        return

    latest = latest_settlement_map()
    new_terminal = []

    for signal in signals:
        signal_id = signal_instance_id(signal)
        previous = latest.get(signal_id, {})
        if previous.get("settlement_status") in {"WIN", "LOSS", "PUSH"}:
            continue

        market = fetch_market_by_slug(signal.get("slug", ""))
        if not market:
            continue

        status, final_price, is_terminal = market_terminal_status(
            market, signal.get("outcome", "")
        )
        if not is_terminal or final_price is None:
            continue
        if previous.get("settlement_status") == status and previous.get("final_price") == final_price:
            continue

        append_settlement(signal, status, final_price, market)
        if status in {"WIN", "LOSS", "PUSH"}:
            new_terminal.append((signal, status, final_price))
        print(f"[SETTLE] {signal.get('slug')} {signal.get('outcome')}: {status} @ {final_price}")

    if new_terminal:
        lines = []
        for signal, status, final_price in new_terminal[:8]:
            entry_price = signal.get("poly_price", signal.get("avg_price"))
            metrics = settlement_metrics(entry_price, final_price)
            pnl = metrics["pnl_usd"] if metrics else 0.0
            lines.append(
                f"• {signal.get('strategy')} {signal.get('outcome')}: "
                f"{status} | {fmt_cents(entry_price)} → {fmt_cents(final_price)} | "
                f"P&L ${pnl:+.2f}"
            )
        send_telegram(
            "🏁 *ЗАКРЫТЫЕ СИГНАЛЫ*\n\n"
            + "\n".join(lines)
            + "\n\nИсточник: Polymarket Gamma markets."
        )
    else:
        print("[SETTLE] Новых закрытых сигналов нет.")

def run_report():
    print("\n[REPORT] Считаю performance report...")
    signals = load_jsonl_memory("SIGNALS.jsonl")
    if not signals:
        print("[REPORT] Нет SIGNALS.jsonl")
        send_telegram(
            "📊 *PERFORMANCE REPORT*\n\n"
            "Журнал сигналов пока пуст\\."
        )
        return

    latest = latest_settlement_map()
    stats = {}
    for signal in signals:
        strategy = signal.get("strategy", "UNKNOWN")
        stats.setdefault(strategy, {
            "signals": 0,
            "open": 0,
            "settled": 0,
            "wins": 0,
            "losses": 0,
            "pushes": 0,
            "pnl_usd": 0.0,
        })
        bucket = stats[strategy]
        bucket["signals"] += 1

        settlement = latest.get(signal_instance_id(signal)) or {}
        status = settlement.get("settlement_status")
        if status in {"WIN", "LOSS", "PUSH"}:
            bucket["settled"] += 1
            if status == "WIN":
                bucket["wins"] += 1
            elif status == "LOSS":
                bucket["losses"] += 1
            else:
                bucket["pushes"] += 1
            bucket["pnl_usd"] += float(settlement.get("pnl_usd", 0) or 0)
        else:
            bucket["open"] += 1

    lines = []
    for strategy, bucket in sorted(stats.items()):
        settled = bucket["settled"]
        wins = bucket["wins"]
        win_rate = (wins / settled) if settled else 0.0
        roi = (bucket["pnl_usd"] / (settled * 10.0)) if settled else 0.0
        lines.append(
            f"• {strategy}: signals={bucket['signals']}, open={bucket['open']}, "
            f"settled={settled}, W={wins}, L={bucket['losses']}, P={bucket['pushes']}, "
            f"winrate={fmt_pct(win_rate)}, roi={fmt_pct(roi)}, pnl=${bucket['pnl_usd']:+.2f}"
        )

    send_telegram(
        "📊 *PERFORMANCE REPORT*\n\n"
        + "\n".join(lines)
        + "\n\nФормула ROI: по $10 на сигнал, источник результата: Polymarket Gamma markets."
    )
    print("[REPORT] DONE.")


# ─────────────────────────────────────────────────────────────
# MONITOR
# ─────────────────────────────────────────────────────────────
def run_monitor():
    print("[monitor] Проверяю ставки...")
    bet_log = load_memory("BET-LOG.md")
    if not bet_log or "No tracked" in bet_log:
        print("[monitor] Нет ставок."); return

    slugs   = re.findall(r'Slug:\s*`([^`]+)`', bet_log)
    pending = [s for s in slugs if re.search(
        rf'Slug:.*`{re.escape(s)}`.*?Result:\s*PENDING',
        bet_log, re.DOTALL)]

    if not pending:
        print("[monitor] Нет PENDING."); return

    for slug in pending:
        try:
            markets = call_polymarket(["search", slug])
            if isinstance(markets, dict): markets = [markets]
            t = next((m for m in markets
                      if slug in str(m.get("slug",""))), None)
            if not t: continue
            if t.get("closed") or t.get("resolved"):
                send_telegram(
                    f"🏁 *ЗАКРЫЛСЯ\\!*\n`{slug}`\n"
                    f"Результат: *{t.get('winner','?')}*\n"
                    f"Обнови BET\\-LOG\\!")
                continue
            prices   = t.get("outcomePrices","[]")
            outcomes = t.get("outcomes","[]")
            if isinstance(prices,  str):
                try: prices   = [float(x) for x in json.loads(prices)]
                except: prices = []
            if isinstance(outcomes, str):
                try: outcomes = json.loads(outcomes)
                except: outcomes = []
            for o, p in zip(outcomes, prices):
                if p > 0.92:
                    send_telegram(
                        f"✅ *ПОБЕДА БЛИЗКО\\!* `{slug}`\n{o} = {p:.0%}")
                elif p < 0.05:
                    send_telegram(
                        f"❌ *ОПАСНОСТЬ\\!* `{slug}`\n{o} = {p:.0%}")
        except Exception as e:
            print(f"[monitor] {slug}: {e}")
    print("[monitor] DONE.")


# ─────────────────────────────────────────────────────────────
# ALL — запускаем все три стратегии
# ─────────────────────────────────────────────────────────────
def run_all():
    print("═══ ЗАПУСК ВСЕХ ТРЁХ СТРАТЕГИЙ ═══\n")
    if HIGH_CONFIDENCE_ONLY:
        send_telegram(
            "🚀 *ПОЛНЫЙ СКАН — SAFE MODE*\n\n"
            "Режим: только внешне подтверждённые фавориты "
            f"{int(MIN_CONSENSUS_PROB * 100)}\\-{int(MAX_CONSENSUS_PROB * 100)}%\\.\n"
            "SMART и AI-only ставки в этом режиме не используются\\."
        )
    else:
        send_telegram(
            "🚀 *ПОЛНЫЙ СКАН*\n\n"
            "1\\. 🎰 Polymarket vs Букмекеры\n"
            "2\\. 👀 Умные деньги\n"
            "3\\. 🧾 Запись сигналов в журнал\n\n"
            "AI-only ставки не отправляются без внешнего подтверждения\\. "
            "Это нормально: бот не выключен\\."
        )
    run_arbi()
    run_smart()
    run_research()
    run_scan()
    if REVIEW_IN_ALL:
        run_review()
    if SETTLE_IN_ALL:
        run_settle()
    print("\n═══ ВСЕ СТРАТЕГИИ ЗАВЕРШЕНЫ ═══")


# ─────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    cmds = {
        "all":      run_all,
        "arbi":     run_arbi,
        "smart":    run_smart,
        "research": run_research,
        "scan":     run_scan,
        "review":   run_review,
        "settle":   run_settle,
        "report":   run_report,
        "monitor":  run_monitor,
    }
    if len(sys.argv) < 2 or sys.argv[1] not in cmds:
        print("Использование:")
        print("  python3 scripts/analyze.py all       ← все стратегии")
        print("  python3 scripts/analyze.py arbi      ← Polymarket vs Букмекеры")
        print("  python3 scripts/analyze.py smart     ← Умные деньги")
        print("  python3 scripts/analyze.py research  ← Весь Polymarket + CoinGecko + Metaculus")
        print("  python3 scripts/analyze.py scan      ← AI Анализ (legacy)")
        print("  python3 scripts/analyze.py review   ← проверка последних сигналов")
        print("  python3 scripts/analyze.py settle   ← фиксация закрытых сигналов")
        print("  python3 scripts/analyze.py report   ← отчёт по стратегиям")
        print("  python3 scripts/analyze.py monitor  ← следим за ставками")
        sys.exit(1)
    cmds[sys.argv[1]]()
