# Quant Desk

Personal quant interview prep site. Vite + React + TypeScript, Three.js for the 3D hero, D3 for charts, Lenis for smooth scrolling, hand-written CSS.

## Run
```
npm install
npm run dev       # http://localhost:5173
npm run build     # static output in dist/
```

## Layout
- `src/styles/tokens.css`: every colour, type size, space and motion value. Light and dark.
- `src/app/`: shell (left rail, theme toggle) and the site map (`sections.ts`).
- `src/lib/storage.ts`: the only place the UI talks to persistence. Swap `LocalStore` for Supabase without touching pages.
- `src/lib/types.ts`: shared shapes. Every drill logs an `Attempt` plus a per-problem `AnswerLog`.
- `src/drills/speedArithmetic/`: generator, config, run, result.
- `src/pages/`: Today (home), Progress.
- `src/components/`: DiceField (the Three.js hero), GaltonBoard (kept for the probability section), Sparkline.

Routing is hash-based so the static build works anywhere; switch to `createBrowserRouter` once hosted with SPA fallback.
