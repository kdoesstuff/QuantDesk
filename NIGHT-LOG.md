# Night log

Running notes from the overnight build, newest at the bottom. Written for the morning read.

## Batch 1: shared engine and four speed drills

Done.

- `src/lib/types.ts`: `DrillId` now covers every planned game. Logs are `EventLog` (kind, prompt, answer, given, ms, misses, correct, tags). Speed arithmetic's old shape still reads fine.
- `src/lib/random.ts`, `src/lib/config.ts`: shared helpers. Per-drill settings persist under `qd.cfg.<drill>`.
- `src/drills/shared/`: `Frames.tsx` (config, run and result layouts, settings controls, standing card), `hooks.ts` (countdown and clock, Enter and Esc), `PaceChart.tsx`, `drill.css` (moved here from the arithmetic folder; the old copy at `src/drills/speedArithmetic/drill.css` can be deleted, nothing imports it).
- `src/drills/typed/`: one engine for every typed-answer drill plus a four-option choice mode. A spec file per drill holds the generator, the settings panel and the result breakdowns.
- Live: 80 in 8 (choice mode, plus one minus one, skip is free, 40/80/120 sizes), Sequences (11 rule families, three levels), Fractions to decimals (fraction to decimal, decimal to fraction, reciprocals, 2 to 4 places, chosen denominators), Percentages (percent of, change, reverse, compound, basis points, margin and markup, three levels). Every answer is built to be exact at the stated precision, no rounding ties.
- Generators fuzzed 9,000 times each for bad output. Two full runs played in a headless browser end to end (80 in 8 by keys, Sequences to the clock).
- Progress page now groups by drill and settings and links to any drill's result.
- `registry.ts` is where the dashboard learns a drill's label and how to describe its settings.
- Placeholders in `src/insights/` (FocusCard, InsightsPanel) render nothing until batch 4.

## Batch 2: market games

Done.

- `src/drills/rounds/`: the second engine. A round shows a scenario, takes a decision, resolves it against the truth with a feedback line, then moves on. Per-round clocks optional. `controls.tsx` has the shared buy/sell/pass buttons, the bid-at-ask input (Tab between, Enter submits) and a single-number input.
- Dice market and Cards market share one factory (`specs/sumMarket.tsx`). Take mode quotes a market around fair with a random lean and width; the right call is the one with positive expected edge, pass when fair sits inside. Make mode asks for a two-sided quote; a quote that misses fair is traded against, a quote wider than the cap gets no trade, a quote that contains fair scores one point plus the spare width. The cards fair value uses the mean of the cards left in the deck, not 7.
- Make me a market: 190 numeric facts in `specs/facts.ts` across eight topics. Score per quote is 100 minus a log-width penalty when the truth is inside (three times wide scores zero), minus 50 when it is not. Logs lean (geometric mid against truth) and tightness for the analysis.
- Betting board: five propositions a board with exact probabilities from coins, dice, cards and urns, payouts set a little or a lot off fair either way. Score is edge taken minus edge missed.
- Kelly sizing, ETF arbitrage and Event contracts run on the typed engine. Kelly answers are exact to one place. ETF arb is three-option choice mode (keys 1 to 3) with the basket shown above the quote. Event contracts submit on Enter with a tolerance in cents (new engine feature: `submitOnEnter` and `Item.tolerance`).
- Routes moved from `/game/...` to `/drill/...` so every game shares the same three-page pattern.

## Batch 3: Fermi and the cognitive tests

Done.

- Fermi (rounds engine): 100 questions in `specs/fermiQuestions.ts`, each with a reference value, a unit and the decomposition, which is shown as feedback after every answer. Estimate plus an optional 90 percent interval. Points: 100 within 20 percent of the reference, 0 at a factor of ten. The result page reports typical miss, lean (high or low on average) and interval hit rate against the 90 percent target.
- `src/drills/cognitive/`: bespoke games with their own run screens, sharing the config and result frames.
- Memory grid: visual span, cells flash then you rebuild; one wrong cell ends the trial; 3 lives by default; score is the largest set rebuilt. Logs ms per cell and errors.
- Task switch: Rogers and Monsell cued switching (odd/even versus under/over 5, F and J keys, 50 percent switch rate). Score is the switch cost in ms (lower is better); the result page shows repeat and switch medians and flags runs under 85 percent accuracy as unreliable. Congruent and incongruent digits are tagged.
- Intercept: a target crosses the top, a shot takes a fixed time to climb. Score is hits. Every shot logs a signed timing error, so the summary reports a lean (firing early or late) and spread, by target speed and direction.
- Balloon: the BART task with three colours of different pop limits (uniform 1 to 128, 32, 8); score is points banked; the summary compares your pumps per colour with the sweet spot (half the limit) and tags balloons that follow a pop.
- All five played end to end in a headless browser.

## Batch 4: insights engine and focus blocks

Done. All in `src/insights/`.

- `features.ts`: turns every drill's logs into rows with named categories (operation, times table, carry or borrow, rule family, denominator, market lean, your mid, topic, trial type, and so on) plus position in the run. Arithmetic is featurized from its operands so your existing runs count.
- `stats.ts`: median, bootstrap interval for a ratio of medians (200 resamples, seeded so results are stable), Wilson interval, two-proportion z, least-squares trend, sign test.
- `analyze.ts`: the findings. Slow spot and error spot per category (strict cutoffs because there are many categories: 95 percent bootstrap interval above 10 percent slower, or z of 2.33 for an 8-point accuracy gap, with 15 or 20 events minimum each side). Fade (last third against first third). Rushing (fast half wrong more than slow half) and its mirror, method gap. Trend (last three runs against the three before, with a slope check). Lean (sign test on mid above or below fair, guessed high or low, fired early or late). Fermi calibration (Wilson interval on the 90 percent range hit rate). Balloon pumps against the sweet spot. Today (a category that ran slower than your usual in this run). One finding per category, ranked by effect size with sample size capped at 60 so a tiny effect on a huge sample does not outrank a big one.
- `recommend.ts`: maps a weak category to a settings patch the drill can run with (only the 7 times table, only sevenths, only the doubling-step family, take mode only, and so on) with a line of advice. Categories that settings cannot force get advice only.
- `focus.ts`: focus blocks. Starting one pins the patched settings, remembers the previous settings, records a baseline, and sets a target (15 percent faster without losing accuracy, or 8 points more accurate). It clears when the last three runs under those settings, with 20 or more problems of that category between them, beat the target. Runs with other settings do not count and the card says so. Stop restores the previous settings; a cleared card offers to.
- `InsightsPanel.tsx`: on every result page: percentile of this run against the same settings, the focus strip with progress, up to four findings with a "Focus on this" button, and a link to the method page.
- `FocusCard.tsx`: on every settings page: the active block with progress, or the strongest suggested block to start, or the block just cleared.
- `pages/Method.tsx` (`#/method`): how it all works in plain words, with the thresholds read from the code and the references (Ericsson 1993 deliberate practice, Wilson 2019 eighty-five percent rule, Rohrer and Taylor 2007 interleaving, Cepeda 2006 spacing, Roediger and Karpicke 2006 retrieval, Rogers and Monsell 1995 switch cost, Lejuez 2002 BART).
- Progress page: a "What to work on" section with active blocks and the top finding per drill.
- Speed arithmetic now stores its settings under the shared key, so its first visit after this update starts from defaults once.
- Tested with seeded histories: a planted 70 percent slowdown on the 7 times table is found after 20 runs, a block is created with one click, three faster runs clear it and the card flips to cleared. Analysis of 1,200 problems takes about 200 ms.

## Batch 5: review

Done.

- Every new settings page and run screen checked at 1440 and 390 widths. Fixed on the way: the basket block on ETF arb stacked vertically, three-option choices wrapped, the feedback pill clipped long Fermi notes, nested lists on the Progress page.
- README rewritten for the new layout, with the recipe for adding a drill.
- No em dashes anywhere in `src`, README or this log (checked by grep).
- Not done, for you to decide: the hero and the index are unchanged; the "Problems" group still says next build, which is step 5 with the PDF zip.

## For the morning

1. `git add -A`, commit, push. Delete `src/drills/speedArithmetic/drill.css` first (unreferenced now).
2. Your speed arithmetic settings reset to defaults once (storage key moved).
3. Play a few runs of anything; insights appear after about 100 problems of a drill and tighten with more. The method page has the exact thresholds.
4. Things I would look at first with real play: whether the make-mode scoring in the dice and cards markets feels right (one point for containing fair plus the spare width), and whether the Fermi reference values read as fair where they are approximate.

## Day after: Prediction group, how to play, run log

- Every settings page has a "How to play" box (`src/drills/howTo.ts`), an Insights note that says how many runs until insights start, and a run log (last 10 to 25 runs with a chart).
- New group, Prediction, four games:
  - Dutch book (`typed/specs/dutchBook.tsx`): boards of related contracts with one rule broken or none; pick the arbitrage; keys 1 to 4.
  - The race and Evidence stream run on a new live engine (`src/drills/live/`): a process ticks, the exact probability is known at every tick, a bot market tracks it with a lag or overshoots it, the player takes one position a round held to resolution, score is expected edge at entry. The whole price path is logged per round and drawn on the result page.
  - Event market maker (`cognitive/eventMaker.tsx`): Glosten and Milgrom by hand. Informed traders know the outcome, noise traders have a private value so wide quotes trade less. Score is the expected profit of each quote against the engine's posterior; the best possible quote is found by grid search and the shortfall is logged.
- The Problems group is gone; the question bank idea is replaced by richer question families inside the market games, to be fed by the PDFs.

## Hardening pass

- Crash fix: switching between two games on the same engine through the sidebar reused the page component and its settings state, so the new game read a field that did not exist (`types.includes` on Percentages after Fractions). Every drill route now carries a `key`, and saved settings are checked field by field against the drill's defaults before use (`sanitiseConfig`).
- Error page (`src/pages/ErrorPage.tsx`) on every route: try again, reset this game's settings, home. Unknown links get a not-found page.
- Storage: `src/lib/persist.ts` is the only file that touches localStorage; it never throws and falls back to memory. Stored runs are validated, malformed events dropped, history capped at 4,000 runs, and a full quota trims the oldest runs until the write fits. Another tab's writes invalidate the cache. "Clear all data" on Progress wipes runs, settings and focus blocks (theme stays).
- Sidebar: `data-lenis-prevent` so the wheel scrolls the list, not the page. Phone drawer: slides in with a scrim, close button, Escape, scroll lock, `inert` when closed, closes on navigation. Smooth scrolling is desktop only.
- Phones: run screens have a Stop button; prompts and choice buttons wrap; the run grid can no longer widen the page; key hints hidden on touch screens; Bests table spacing.
- Production page: content security policy injected at build time, referrer policy, description and social tags, manifest and icons for install to home screen, `robots.txt`, theme bootstrap moved out of inline script. Three.js is loaded lazily on the home page only; D3 and Three are their own chunks.
- Checks: `npm run check` (typecheck, lint, `scripts/check-storage.mjs`), run by the deploy workflow before building. `npm run smoke` opens every page at 1440 and 390 and reports errors and overflow.
- Desktop sidebar can be hidden and shown (panel button, remembered). The theme menu in the phone drawer opens inward so it is no longer clipped.
