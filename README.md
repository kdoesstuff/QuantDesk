# Quant Desk

Personal quant trader interview prep. Speed drills, market games, estimation and cognitive tests, each logging every problem so an insights engine can say where you are slow, where you slip, and what to practise next. Vite + React + TypeScript, Three.js for the hero, D3 for charts, Lenis for smooth scrolling, hand-written CSS with six themes.

Live at https://kdoesstuff.github.io/QuantDesk/ (GitHub Pages, deployed by `.github/workflows/pages.yml` on every push to main).

## Run
```
npm install
npm run dev       # http://localhost:5173
npm run check     # typecheck, lint, storage tests, generator fuzz (78,000 items, fair values against simulation); the deploy runs this first
npm run build     # static output in dist/
npm run preview   # serve dist/ locally
npm run smoke     # opens every page at laptop and phone widths (needs playwright)
```

## What is in it
- Speed: Speed arithmetic (Zetamac format), 80 in 8 (Optiver format), Sequences (18 rule families), Fractions to decimals, Percentages, Mental tricks (nine shortcuts).
- Markets: Dice market, Cards market, Dice games market (a game in a sentence, a market on its expected payout), Make me a market, Betting board (six proposition families), Kelly sizing, ETF arbitrage, Event contracts (ten variants including the classic conditional-probability traps).
- Prediction: Dutch book, The race, Evidence stream, Event market maker, Stop or roll (optimal stopping, scored decision by decision).
- Estimation: Fermi, with 90 percent intervals and the decomposition shown after every answer.
- Cognitive: Memory grid (visual span), Task switch (switch cost), Intercept (timing lean), Balloon (risk, with colours to learn).
- Progress: activity, score over time, bests, and what to work on.
- Every question game's result page has a Review: each wrong, skipped or timed-out question with your answer, the right answer and the approach written with that question's numbers. Approaches come from the generators (`how` on every item), so they are never generic.
- Insights on every result page and a focus block on every settings page. `#/method` explains the statistics and the references.

## Layout
- `src/styles/tokens.css`: every colour, type size, space and motion value, one block per theme.
- `src/app/`: shell (rail, theme picker) and the site map (`sections.ts`).
- `src/lib/`: `persist.ts` (the only file that touches localStorage; never throws, falls back to memory), `storage.ts` (the `Store` interface the UI talks to; swap `LocalStore` for Supabase without touching pages; validates every stored run, caps the history, trims on a full quota), `types.ts` (an `Attempt` holds `EventLog`s), `config.ts` (per-drill settings, checked field by field against defaults), `random.ts`.
- `src/drills/registry.ts`: label and settings description for every drill, used by the dashboard and the insights.
- `src/drills/shared/`: config, run and result frames, hooks, pace chart, the drill stylesheet.
- `src/drills/typed/`: the typed-answer engine and its choice mode; one spec file per drill in `specs/`.
- `src/drills/rounds/`: the rounds engine (scenario, decision, resolution); specs for dice, cards, make a market, betting board, Fermi.
- `src/drills/cognitive/`: bespoke games with their own run screens.
- `src/drills/speedArithmetic/`: the original drill, on its own pages.
- `src/insights/`: featurizers, statistics, analyzer, recommendations, focus blocks, and the panels.
- `src/pages/`: Today (home), Progress, Method, ErrorPage (route errors and unknown links).
- `src/components/`: DiceField (the Three.js hero), GaltonBackdrop (the index section), ThemePicker, Sparkline.

Routing is hash-based so the static build works anywhere; switch to `createBrowserRouter` once hosted with SPA fallback. Every drill route carries a `key`, because one page component serves many drills and React would otherwise keep one drill's settings state when the sidebar jumps to another.

## Data and privacy
Everything a visitor does stays in their own browser: runs under `qd.attempts.v1`, settings under `qd.cfg.<drill>`, focus blocks under `qd.focus.v1`, theme under `qd.theme`. Nothing is sent anywhere. Progress has a one-click wipe. Each person who opens the site gets their own history; accounts (Supabase) can be added behind the `Store` interface later without changing any page.

## Security
The site is static with no backend, so the surface is the page itself. The production page carries a content security policy (added at build time in `vite.config.ts`): scripts only from the site, styles from the site and Google Fonts, fonts from Google's font host, no connections anywhere else. There are no inline scripts (the theme bootstrap is `public/theme-init.js`) and no `innerHTML` anywhere; everything stored in the browser is parsed with JSON and validated before use, so edited or stale storage cannot crash a page or inject anything. Dependencies are audited with `npm audit` (clean at the time of writing).

## Phones and laptops
One layout from 320px up. On desktop the sidebar can be hidden with the panel button in its corner (a matching button brings it back; the choice is remembered under `qd.rail`). Under 860px the sidebar becomes a drawer with a scrim, a close button, Escape and body scroll lock; the sidebar is its own scroll region on desktop and opts out of the smooth scroller. Run screens have a Stop button, wrap long prompts and answer options, and use the numeric keyboard for answers. Keyboard hints are hidden on touch screens. The site installs to a phone's home screen (`public/manifest.webmanifest`).

## Adding a drill
Write a spec (typed, rounds or cognitive), add its routes in `src/main.tsx`, its entry in `src/drills/registry.ts` and `src/app/sections.ts`, and its categories in `src/insights/features.ts` and `src/insights/recommend.ts`. Everything else, including the insights and focus blocks, comes for free.
