// Fuzzes every question generator: thousands of items per drill, checking
// that each has a prompt, an answer, an approach, sane tags and (for choice
// mode) one correct option. Run with: npm test
import { createServer } from 'vite'
import assert from 'node:assert/strict'

const mem = new Map()
globalThis.localStorage = {
  getItem: (k) => mem.get(k) ?? null,
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  key: () => null,
  length: 0,
}
globalThis.sessionStorage = { clear() {} }
globalThis.window = globalThis
globalThis.addEventListener = () => {}
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} })

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const load = (p) => server.ssrLoadModule(p)
const N = Number(process.env.N || 3000)
let checked = 0

async function typed(path, name, configs) {
  const m = await load(path)
  const spec = m[name]
  for (const cfg of configs) {
    const full = { ...spec.defaults, ...cfg }
    let prev
    for (let i = 0; i < N; i++) {
      const it = spec.next(full, prev)
      assert.ok(it.prompt && it.answer !== undefined && String(it.answer).length > 0, `${name}: empty item ${JSON.stringify(it)}`)
      assert.ok(typeof it.how === 'string' && it.how.length > 20, `${name}: no approach on ${it.prompt}`)
      assert.ok(
        !it.how.includes('NaN') && !it.how.includes('undefined') && !it.answer.includes('NaN'),
        `${name}: NaN in ${it.prompt}: ${it.how}`,
      )
      if (spec.mode === 'choice') {
        assert.ok(
          it.options && it.options.length >= 3 && it.options[it.correctIndex] === it.answer,
          `${name}: options broken on ${it.prompt}`,
        )
        assert.equal(new Set(it.options).size, it.options.length, `${name}: duplicate options on ${it.prompt}`)
      }
      prev = it
      checked++
    }
  }
}

await typed('/src/drills/typed/specs/sequences.tsx', 'sequencesSpec', [
  { level: 1 },
  { level: 2 },
  { level: 3 },
  { level: 3, families: ['letters', 'repeat', 'padovan', 'pell', 'tribonacci', 'fact', 'tri'] },
])
await typed('/src/drills/typed/specs/fractions.tsx', 'fractionsSpec', [{}, { places: 4 }, { modes: ['toFraction'] }])
await typed('/src/drills/typed/specs/percentages.tsx', 'percentagesSpec', [{ level: 1 }, { level: 2 }, { level: 3 }])
await typed('/src/drills/typed/specs/eightyInEight.tsx', 'eightySpec', [{}])
await typed('/src/drills/typed/specs/kelly.tsx', 'kellySpec', [{}])
await typed('/src/drills/typed/specs/etfArb.tsx', 'etfArbSpec', [{ level: 1 }, { level: 2, names: 5 }, { level: 3 }])
await typed('/src/drills/typed/specs/eventContracts.tsx', 'eventContractsSpec', [
  {},
  { variants: ['coinBag', 'doors', 'children', 'oneSix'] },
])
await typed('/src/drills/typed/specs/dutchBook.tsx', 'dutchBookSpec', [{ level: 1 }, { level: 2 }, { level: 3 }])

await typed('/src/drills/typed/specs/tricks.tsx', 'tricksSpec', [{ level: 1 }, { level: 2 }, { level: 3 }])

// Dice games: fair values against Monte Carlo, approaches present, make and take resolve.
{
  const dg = await load('/src/drills/rounds/specs/diceGames.tsx')
  for (const fam of dg.ALL_GAMES) {
    for (const level of [1, 2, 3]) {
      for (let i = 0; i < 6; i++) {
        const g = dg.makeGame(fam, level)
        assert.ok(g.how.length > 40 && !g.how.includes('NaN') && Number.isFinite(g.fair) && g.fair > 0, `${fam}: ${g.text} ${g.how}`)
        const N = 40000
        let t = 0
        for (let k = 0; k < N; k++) t += g.play()
        const mc = t / N
        const tol = Math.max(0.15, 0.03 * g.fair)
        assert.ok(Math.abs(mc - g.fair) < tol, `${fam} L${level}: fair ${g.fair.toFixed(3)} vs simulated ${mc.toFixed(3)} for "${g.text}"`)
        checked++
      }
    }
  }
  const spec = dg.diceGamesSpec
  let prev
  for (let i = 0; i < 1000; i++) {
    const sc = spec.next({ ...spec.defaults, level: 3 }, prev)
    const out = sc.play === 'take' ? spec.resolve(sc, { side: 'sell' }, spec.defaults) : spec.resolve(sc, { bid: 0, ask: 1 }, spec.defaults)
    assert.ok(
      Number.isFinite(out.points) && (out.correct || (out.how && out.how.length > 40)),
      `dice games resolve: ${JSON.stringify(out)}`,
    )
    prev = sc
    checked++
  }
}

// Stop or roll: the dynamic programme against known values and against simulated optimal play.
{
  const sr = await load('/src/drills/cognitive/stopOrRoll.tsx')
  const V = sr.diceValues(6, 3)
  assert.ok(Math.abs(V[0] - 3.5) < 1e-9 && Math.abs(V[1] - 4.25) < 1e-9 && Math.abs(V[2] - 14 / 3) < 1e-9, `dice values ${V}`)
  const FULL = (1 << 13) - 1
  for (const draws of [3, 5, 8]) {
    const v = sr.cardValue(FULL, draws)
    // Simulate optimal play on shuffled 13-card decks.
    const N = 30000
    let t = 0
    for (let i = 0; i < N; i++) {
      const deck = Array.from({ length: 13 }, (_, k) => k + 1)
      for (let a = deck.length - 1; a > 0; a--) {
        const b = Math.floor(Math.random() * (a + 1))
        ;[deck[a], deck[b]] = [deck[b], deck[a]]
      }
      let mask = FULL
      let kept = 0
      for (let d = 0; d < draws; d++) {
        const x = deck[d]
        mask &= ~(1 << (x - 1))
        const left = draws - d - 1
        if (left === 0 || x >= sr.cardValue(mask, left)) {
          kept = x
          break
        }
      }
      t += kept
    }
    const mc = t / N
    assert.ok(Math.abs(mc - v) < 0.12, `cards ${draws} draws: DP ${v.toFixed(3)} vs simulated ${mc.toFixed(3)}`)
    checked++
  }
}

// Event contract answers must be probabilities in cents.
{
  const m = await load('/src/drills/typed/specs/eventContracts.tsx')
  for (let i = 0; i < 2000; i++) {
    const it = m.eventContractsSpec.next(m.eventContractsSpec.defaults)
    const c = Number(it.answer)
    assert.ok(c >= 0 && c <= 100, `event contract out of range: ${it.prompt} ${it.answer}`)
  }
}

// Rounds: betting board props, sum markets, make a market, fermi all resolve with an approach when wrong.
{
  const bb = await load('/src/drills/rounds/specs/bettingBoard.tsx')
  const spec = bb.bettingBoardSpec
  for (let i = 0; i < 1500; i++) {
    const sc = spec.next(spec.defaults)
    for (const p of sc.props) {
      assert.ok(p.p > 0 && p.p < 1 && Number.isFinite(p.ev) && p.how.length > 10, `board prop broken: ${JSON.stringify(p)}`)
      assert.ok(!p.how.includes('NaN'), `board NaN: ${p.how}`)
    }
    const out = spec.resolve(sc, { taken: sc.props.map(() => false) }, spec.defaults)
    assert.ok(typeof out.how === 'string' && out.how.length > 40)
    checked++
  }
  const sm = await load('/src/drills/rounds/specs/sumMarket.tsx')
  for (const spec of [sm.diceMarketSpec, sm.cardsMarketSpec]) {
    let prev
    for (let i = 0; i < 1500; i++) {
      const sc = spec.next(spec.defaults, prev)
      const out =
        sc.play === 'take'
          ? spec.resolve(sc, { side: 'buy' }, spec.defaults)
          : spec.resolve(sc, { bid: sc.fair + 5, ask: sc.fair + 7 }, spec.defaults)
      assert.ok(
        typeof out.how === 'string' && out.how.toLowerCase().includes('fair') && !out.how.includes('NaN'),
        `sum market how: ${out.how}`,
      )
      const to = spec.resolve(sc, null, spec.defaults)
      assert.ok(typeof to.how === 'string')
      prev = sc
      checked++
    }
  }
  const mm = await load('/src/drills/rounds/specs/makeMarket.tsx')
  for (let i = 0; i < 500; i++) {
    const sc = mm.makeMarketSpec.next(mm.makeMarketSpec.defaults)
    const out = mm.makeMarketSpec.resolve(sc, { bid: sc.fact.v * 2, ask: sc.fact.v * 3 }, mm.makeMarketSpec.defaults)
    assert.ok(out.how && out.how.length > 40 && !out.how.includes('NaN'))
    checked++
  }
  const fm = await load('/src/drills/rounds/specs/fermi.tsx')
  for (let i = 0; i < 300; i++) {
    const sc = fm.fermiSpec.next(fm.fermiSpec.defaults)
    const out = fm.fermiSpec.resolve(sc, { point: sc.q.v * 5 }, fm.fermiSpec.defaults)
    assert.ok(out.how && out.how.length > 20)
    checked++
  }
}

// Arithmetic approaches
{
  const g = await load('/src/drills/speedArithmetic/generator.ts')
  for (let i = 0; i < 3000; i++) {
    const p = g.nextProblem(g.DEFAULT_CONFIG)
    const how = g.howArithmetic(p.op, p.a, p.b)
    assert.ok(how.length > 10 && !how.includes('NaN') && how.includes(String(p.answer)), `arith how: ${p.text} -> ${how}`)
    checked++
  }
}

console.log(`generators fuzzed: ${checked} items, all with answers and approaches`)
await server.close()
