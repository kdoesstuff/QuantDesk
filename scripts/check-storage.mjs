// Storage and settings sanitisation tests. Run with: npm test
import { createServer } from 'vite'
import assert from 'node:assert/strict'
// Minimal browser shims
const mem = new Map()
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  key: (i) => [...mem.keys()][i] ?? null,
  get length() {
    return mem.size
  },
}
globalThis.sessionStorage = { clear() {} }
globalThis.window = globalThis
globalThis.addEventListener = () => {}
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const cfg = await server.ssrLoadModule('/src/lib/config.ts')
const st = await server.ssrLoadModule('/src/lib/storage.ts')

// 1. stale shapes never reach a generator
const d = { durationSec: 120, types: ['of', 'change'], level: 2 }
assert.deepEqual(cfg.sanitiseConfig(d, undefined), d)
assert.deepEqual(cfg.sanitiseConfig(d, { modes: ['x'], denoms: [7] }), d) // another drill's config
assert.deepEqual(cfg.sanitiseConfig(d, { types: null, level: '3', durationSec: 60 }), { ...d, durationSec: 60 })
assert.deepEqual(cfg.sanitiseConfig(d, { types: ['bps'], extra: 1 }), { ...d, types: ['bps'] })
assert.deepEqual(cfg.sanitiseConfig(d, 'garbage'), d)
assert.deepEqual(cfg.sanitiseConfig(d, [1, 2]), d)
assert.deepEqual(cfg.sanitiseConfig(d, { durationSec: NaN }), d)
mem.set('qd.cfg.percentages', '{not json')
assert.deepEqual(cfg.loadDrillConfig('percentages', d), d)
mem.set('qd.cfg.percentages', JSON.stringify({ level: 3 }))
assert.deepEqual(cfg.loadDrillConfig('percentages', d), { ...d, level: 3 })
assert.deepEqual(cfg.readRawDrillConfig('percentages'), { level: 3 })

// 2. attempts: malformed entries dropped, malformed events dropped, caps and quota
const good = {
  id: 'a1',
  ts: 1,
  drill: 'percentages',
  configKey: 'k',
  config: {},
  score: 1,
  correct: 1,
  wrong: 0,
  durationSec: 60,
  answers: [{ given: 1, ms: 500, misses: 0, correct: true }],
}
mem.set(
  'qd.attempts.v1',
  JSON.stringify([
    good,
    { id: 'bad' },
    null,
    'x',
    { ...good, id: 'a2', drill: 'nope' },
    {
      ...good,
      id: 'a3',
      answers: [
        { given: 1, ms: 'slow', misses: 0, correct: true },
        { given: null, ms: 0, misses: 0, correct: false },
      ],
    },
  ]),
)
const store = new (Object.getPrototypeOf(st.store).constructor)()
let list = await store.listAttempts()
assert.equal(list.length, 2)
assert.equal(list.find((a) => a.id === 'a3').answers.length, 1)
await store.saveAttempt({ ...good, id: 'a4', ts: 9 })
list = await store.listAttempts({ drill: 'percentages' })
assert.equal(list[0].id, 'a4')
await store.saveAttempt({ id: 'junk' })
assert.equal((await store.listAttempts()).length, 3)
// cap
for (let i = 0; i < st.MAX_ATTEMPTS + 10; i++) await store.saveAttempt({ ...good, id: 'x' + i, ts: 100 + i })
assert.equal((await store.listAttempts()).length, st.MAX_ATTEMPTS)
// quota: setItem throws over a size
let budget = 200_000
localStorage.setItem = (k, v) => {
  if (String(v).length > budget) throw new Error('QuotaExceededError')
  mem.set(k, String(v))
}
await store.saveAttempt({
  ...good,
  id: 'after-quota',
  ts: 99999,
  answers: Array.from({ length: 50 }, () => ({ given: 1, ms: 400, misses: 0, correct: true })),
})
const after = await store.listAttempts()
assert.equal(after[0].id, 'after-quota')
assert.ok(JSON.parse(mem.get('qd.attempts.v1')).length < st.MAX_ATTEMPTS, 'trimmed to fit the quota')
// uid uniqueness
const ids = new Set(Array.from({ length: 2000 }, () => st.uid()))
assert.equal(ids.size, 2000)
console.log('storage and config tests passed')
await server.close()
