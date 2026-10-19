// Opens every page of the production build at laptop and phone widths and reports page errors and horizontal overflow.
// Needs a preview server (npm run preview) and playwright (npm i --no-save playwright); CHROME_PATH may point at a Chromium binary.
import { chromium } from 'playwright'
const base = process.env.BASE || 'http://localhost:5200/'
const ids = [
  'speed-arithmetic',
  'eighty-in-eight',
  'sequences',
  'fractions',
  'percentages',
  'dice-market',
  'cards-market',
  'make-a-market',
  'betting-board',
  'kelly',
  'etf-arb',
  'event-contracts',
  'fermi',
  'memory-grid',
  'task-switch',
  'intercept',
  'balloon',
  'race',
  'evidence',
  'event-maker',
  'dutch-book',
  'tricks',
  'dice-games',
  'stop-or-roll',
]
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH })
for (const vp of [
  { width: 1440, height: 900 },
  { width: 390, height: 844, mobile: true },
  { width: 320, height: 640, mobile: true },
]) {
  const ctx = await b.newContext({ viewport: vp, isMobile: !!vp.mobile, hasTouch: !!vp.mobile })
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push('pageerror ' + e.message))
  p.on('console', (m) => {
    if (m.type() === 'error' && !/fonts\.g|ERR_|net::/.test(m.text())) errs.push('console ' + m.text().slice(0, 200))
  })
  const overflow = []
  for (const path of ['', '#/progress', '#/method', ...ids.map((i) => `#/drill/${i}`)]) {
    await p.goto(base + path)
    await p.waitForTimeout(350)
    const sw = await p.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth])
    if (sw[0] > sw[1] + 1) overflow.push(`${path}: ${sw[0]}>${sw[1]}`)
    const err = await p.locator('text=This page hit an error').count()
    if (err) errs.push('errorpage at ' + path)
  }
  console.log(vp.width, 'errors:', errs, 'overflow:', overflow)
  await ctx.close()
}
await b.close()
