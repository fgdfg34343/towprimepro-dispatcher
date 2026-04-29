# Polymarket Bot Strategy

## Core Rule
Do not send AI-only predictions as betting signals.

Signals must be based on verifiable external data:
- ARBI: Polymarket price differs from bookmaker implied probability.
- SMART: large recent buys show one-sided smart-money pressure.

## Signal Quality Gate
Send only signals with `signal_score >= 75`.

Score inputs:
- external confirmation strength
- edge / EV
- liquidity
- price range
- time to resolution
- smart-money dominance when applicable

## ARBI Rules
- Compare Polymarket against bookmaker consensus (median across all bookmakers).
- Require at least 3 bookmaker quotes per side.
- TIER A (safe): consensus 80-98%, edge ≥10%, 3+ bookmakers.
- TIER B (medium risk): consensus 65-79%, edge ≥20%, 5+ bookmakers — labeled higher risk.
- Skip series/tournament winner markets (comparing to single-game H2H odds = fake edge).
- Validate sport category: NBA bookmaker odds only match to NBA Polymarket markets etc.
- Better team matching: all words >3 chars, not just last word.
- 11 sports covered: EPL, Bundesliga, La Liga, UCL, Serie A, Ligue 1, NBA, MLB, NHL, ATP, WTA.
- Skip weak scores and repeated signals within cooldown.
- "No opportunities" message: max once per 4 hours.

## SMART Rules
- Enabled in all modes (including HIGH_CONFIDENCE_ONLY).
- Safe mode: require ≥$10,000 volume, ≥4 large buys (≥$1,000 each).
- Normal mode: require ≥$2,000 volume, ≥2 large buys (≥$500 each).
- Require one side to dominate ≥65% of large-buy volume.
- Skip markets where large buys appear on both sides without clear dominance.
- Skip repeated signals within cooldown.
- "No opportunities" message: max once per 4 hours.

## Disabled
AI-only scan is disabled as a source of betting signals.
Claude may explain data, but it must not invent probabilities and trigger a bet by itself.

## Signal Journal
Every sent ARBI/SMART signal must be written to `memory/SIGNALS.jsonl`.

The journal must include:
- strategy
- Polymarket slug and URL
- selected outcome
- entry price
- external source values
- signal score
- timestamp

Use `python3 scripts/analyze.py review` to check recent signal price movement against current Polymarket market data.
Use `python3 scripts/analyze.py settle` to record resolved signals into `memory/SIGNAL-SETTLEMENTS.jsonl`.
Use `python3 scripts/analyze.py report` to calculate strategy win rate and ROI using a normalized `$10` stake per signal.

## Risk Notes
No strategy guarantees wins.
Every signal is a candidate for manual review, not automatic execution.
