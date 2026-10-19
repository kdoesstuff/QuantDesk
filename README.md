# Quant Desk

Personal quant trader interview prep. Speed drills, market games, estimation and cognitive tests, each logging every problem so an insights engine can say where you are slow, where you slip, and what to practise next. Vite + React + TypeScript, Three.js for the hero, D3 for charts, Lenis for smooth scrolling, hand-written CSS with six themes.

## Run
```
npm install
npm run dev       # http://localhost:5173
npm run build     # static output in dist/
```

## What is in it
- Speed: Speed arithmetic (Zetamac format), 80 in 8 (Optiver format), Sequences, Fractions to decimals, Percentages.
- Markets: Dice market, Cards market, Make me a market, Betting board, Kelly sizing, ETF arbitrage, Event contracts.
- Estimation: Fermi, with 90 percent intervals and the decomposition shown after every answer.
- Cognitive: Memory grid (visual span), Task switch (switch cost), Intercept (timing lean), Balloon (risk, with colours to learn).
- Progress: activity, score over time, bests, and what to work on.
- Insights on every result page and a focus block on every settings page. `#/method` explains the statistics and the references.

## Layout
- `src/styles/tokens.css`: every colour, type size, space and motion value, one block per theme.
- `src/app/`: shell (rail, theme picker) and the site map (`sections.ts`).
- `src/lib/`: `storage.ts` (the only place the UI talks to persistence; swap `LocalStore` for Supabase without touching pages), `types.ts` (an `Attempt` holds `EventLog`s), `config.ts` (per-drill settings), `random.ts`.
- `src/drills/registry.ts`: label and settings description for every drill, used by the dashboard and the insights.
- `src/drills/shared/`: config, run and result frames, hooks, pace chart, the drill stylesheet.
- `src/drills/typed/`: the typed-answer engine and its choice mode; one spec file per drill in `specs/`.
- `src/drills/rounds/`: the rounds engine (scenario, decision, resolution); specs for dice, cards, make a market, betting board, Fermi.
- `src/drills/cognitive/`: bespoke games with their own run screens.
- `src/drills/speedArithmetic/`: the original drill, on its own pages.
- `src/insights/`: featurizers, statistics, analyzer, recommendations, focus blocks, and the panels.
- `src/pages/`: Today (home), Progress, Method.
- `src/components/`: DiceField (the Three.js hero), GaltonBackdrop (the index section), ThemePicker, Sparkline.

Routing is hash-based so the static build works anywhere; switch to `createBrowserRouter` once hosted with SPA fallback.

## Adding a drill
Write a spec (typed, rounds or cognitive), add its routes in `src/main.tsx`, its entry in `src/drills/registry.ts` and `src/app/sections.ts`, and its categories in `src/insights/features.ts` and `src/insights/recommend.ts`. Everything else, including the insights and focus blocks, comes for free.
