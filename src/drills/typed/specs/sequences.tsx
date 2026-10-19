import { chance, pick, rint, shuffle } from '../../../lib/random'
import { durationLabel } from '../../../lib/config'
import { Chips, Seg, Setting, toggleIn } from '../../shared/Frames'
import type { Item, TypedSpec } from '../spec'

/**
 * Number sequences, the Flow Traders and Maven format: five or six terms,
 * type the next one. Every family is a real rule, so a slip can be traced
 * to a family rather than to luck.
 */
export type Family =
  | 'arith'
  | 'geo'
  | 'quad'
  | 'alt'
  | 'interleave'
  | 'fib'
  | 'power'
  | 'diffgeo'
  | 'mulAdd'
  | 'primes'
  | 'squareDiff'

export const FAMILY_LABEL: Record<Family, string> = {
  arith: 'Constant step',
  geo: 'Constant ratio',
  quad: 'Growing step',
  alt: 'Alternating rule',
  interleave: 'Two interleaved',
  fib: 'Sum of previous two',
  power: 'Powers with offset',
  diffgeo: 'Doubling step',
  mulAdd: 'Multiply then add',
  primes: 'Primes',
  squareDiff: 'Square steps',
}

export const ALL_FAMILIES: Family[] = [
  'arith',
  'geo',
  'quad',
  'alt',
  'interleave',
  'fib',
  'power',
  'diffgeo',
  'mulAdd',
  'primes',
  'squareDiff',
]

export interface SequencesConfig {
  durationSec: 60 | 120 | 180 | 300
  families: Family[]
  /** 1 small numbers, 2 medium, 3 larger and negative steps. */
  level: 1 | 2 | 3
}

const DURATIONS = [60, 120, 180, 300] as const
const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113]

function build(c: SequencesConfig, family: Family): { terms: number[]; answer: number; shown: number } {
  const L = c.level
  const shown = family === 'interleave' ? 6 : 5
  const need = shown + 1
  const seq: number[] = []
  switch (family) {
    case 'arith': {
      const d = (chance(L >= 3 ? 0.35 : 0.12) ? -1 : 1) * rint(2, L === 1 ? 9 : L === 2 ? 19 : 47)
      let a = rint(1, L === 1 ? 30 : L === 2 ? 90 : 300)
      if (d < 0) a = rint(60, 200)
      for (let i = 0; i < need; i++) seq.push(a + i * d)
      break
    }
    case 'geo': {
      const r = pick(L === 1 ? [2, 3] : L === 2 ? [2, 3, 4, -2] : [2, 3, 4, 5, -2, -3])
      const a = rint(1, L === 1 ? 5 : 9)
      let v = a
      for (let i = 0; i < need; i++) {
        seq.push(v)
        v *= r
      }
      // Halving: present the sequence descending instead.
      if (chance(0.25) && r > 0) seq.reverse()
      break
    }
    case 'quad': {
      const c2 = rint(1, L === 1 ? 1 : L === 2 ? 2 : 3)
      const b = rint(L === 3 ? -4 : 0, L === 1 ? 2 : 6)
      const a = rint(0, L === 1 ? 5 : 20)
      for (let n = 1; n <= need; n++) seq.push(a + b * n + c2 * n * n)
      break
    }
    case 'alt': {
      // Two operations applied in turn: + x then × y, or + x then − y.
      const kind = chance(L === 1 ? 0.4 : 0.6) ? 'addmul' : 'addsub'
      let v = rint(1, L === 1 ? 6 : 12)
      const x = rint(1, L === 1 ? 5 : 9)
      const y = kind === 'addmul' ? rint(2, L === 1 ? 2 : 3) : rint(1, x - 1 > 0 ? x - 1 : 1)
      for (let i = 0; i < need; i++) {
        seq.push(v)
        if (i % 2 === 0) v += x
        else v = kind === 'addmul' ? v * y : v - y
      }
      break
    }
    case 'interleave': {
      const a1 = rint(1, 20)
      const d1 = rint(2, L === 1 ? 5 : 11)
      const a2 = rint(L === 1 ? 20 : 40, 99)
      const d2 = -rint(2, L === 1 ? 5 : 11)
      for (let i = 0; i < need; i++) seq.push(i % 2 === 0 ? a1 + (i / 2) * d1 : a2 + ((i - 1) / 2) * d2)
      break
    }
    case 'fib': {
      let p = rint(1, L === 1 ? 4 : 9)
      let q = rint(p, L === 1 ? 8 : 15)
      for (let i = 0; i < need; i++) {
        seq.push(p)
        ;[p, q] = [q, p + q]
      }
      break
    }
    case 'power': {
      const which = pick(L === 1 ? ['sq', 'cube'] : ['sq', 'cube', 'two', 'sqn'])
      const k = rint(L === 1 ? 0 : -3, L === 1 ? 2 : 5)
      const start = rint(1, 3)
      for (let n = start; n < start + need; n++) {
        if (which === 'sq') seq.push(n * n + k)
        else if (which === 'cube') seq.push(n * n * n + k)
        else if (which === 'two') seq.push(2 ** n + k)
        else seq.push(n * n + n + k)
      }
      break
    }
    case 'diffgeo': {
      let v = rint(1, L === 1 ? 5 : 20)
      let d = rint(1, L === 1 ? 2 : 4)
      const r = L === 3 && chance(0.4) ? 3 : 2
      for (let i = 0; i < need; i++) {
        seq.push(v)
        v += d
        d *= r
      }
      break
    }
    case 'mulAdd': {
      const k = L === 1 ? 2 : pick([2, 2, 3])
      const add = pick(L === 1 ? [1, -1] : [1, -1, 2, -2, 3, -3])
      let v = rint(1, L === 1 ? 4 : 7)
      for (let i = 0; i < need; i++) {
        seq.push(v)
        v = k * v + add
      }
      break
    }
    case 'primes': {
      const step = L === 1 ? 1 : pick([1, 2])
      const start = rint(0, L === 1 ? 4 : 12)
      const off = L === 3 ? rint(-2, 2) : 0
      for (let i = 0; i < need; i++) seq.push(PRIMES[start + i * step] + off)
      break
    }
    case 'squareDiff': {
      let v = rint(1, L === 1 ? 5 : 15)
      const start = rint(1, 2)
      for (let i = 0; i < need; i++) {
        seq.push(v)
        v += (start + i) * (start + i)
      }
      break
    }
  }
  return { terms: seq.slice(0, shown), answer: seq[shown], shown }
}

function next(c: SequencesConfig, prev?: Item): Item {
  const fams = c.families.length ? c.families : ALL_FAMILIES
  let family = pick(fams)
  if (prev && fams.length > 1 && family === prev.kind && chance(0.6)) family = pick(fams.filter((f) => f !== family))
  let built = build(c, family)
  // Keep the numbers on a human scale.
  let guard = 0
  while (Math.abs(built.answer) > 20000 && guard++ < 20) built = build(c, family)
  const magnitude = String(Math.abs(built.answer)).length
  return {
    kind: family,
    prompt: built.terms.join(', ') + ', ?',
    answer: String(built.answer),
    tags: { family, level: c.level, digits: magnitude, negative: built.answer < 0, shown: built.shown },
  }
}

function Settings({ cfg, setCfg }: { cfg: SequencesConfig; setCfg: (f: (c: SequencesConfig) => SequencesConfig) => void }) {
  return (
    <>
      <Setting title="Clock">
        <Seg options={DURATIONS} value={cfg.durationSec} onChange={(d) => setCfg((c) => ({ ...c, durationSec: d }))} label="Duration" format={durationLabel} />
      </Setting>
      <Setting title="Level" note="Level 1 keeps steps small. Level 3 adds negative steps, larger ratios and offsets.">
        <Seg options={[1, 2, 3] as const} value={cfg.level} onChange={(l) => setCfg((c) => ({ ...c, level: l }))} label="Level" />
      </Setting>
      <Setting title="Families" note="Each family is one rule. The results page shows which rules cost you time.">
        <Chips options={ALL_FAMILIES} value={cfg.families} onToggle={(f) => setCfg((c) => ({ ...c, families: toggleIn(c.families, f) }))} labels={FAMILY_LABEL} />
        <div className="chips chips--actions">
          <button className="btn btn-ghost btn-small" onClick={() => setCfg((c) => ({ ...c, families: [...ALL_FAMILIES] }))}>
            All
          </button>
          <button className="btn btn-ghost btn-small" onClick={() => setCfg((c) => ({ ...c, families: shuffle(ALL_FAMILIES).slice(0, 4) }))}>
            Random four
          </button>
        </div>
      </Setting>
    </>
  )
}

export const sequencesSpec: TypedSpec<SequencesConfig> = {
  id: 'sequences',
  title: 'Sequences',
  blurb: 'Five terms, type the sixth. A right answer clears itself. Negative answers take a leading minus.',
  mode: 'typed',
  defaults: { durationSec: 120, families: [...ALL_FAMILIES], level: 2 },
  configKey: (c) => `seq:${c.durationSec}:L${c.level}:${ALL_FAMILIES.filter((f) => c.families.includes(f)).join(',')}`,
  describe: (c) => `${durationLabel(c.durationSec)}, level ${c.level}, ${c.families.length === ALL_FAMILIES.length ? 'all families' : `${c.families.length} families`}`,
  duration: (c) => c.durationSec,
  next,
  Settings,
  inputPattern: /[^\d-]/g,
  breakdowns: [
    { title: 'By family', key: (e) => FAMILY_LABEL[(e.tags?.family as Family) ?? 'arith'] ?? null, order: ALL_FAMILIES.map((f) => FAMILY_LABEL[f]) },
    {
      title: 'By answer size',
      key: (e) => {
        const d = Number(e.tags?.digits ?? 0)
        return d <= 2 ? 'Up to 2 digits' : d === 3 ? '3 digits' : '4 or more'
      },
      order: ['Up to 2 digits', '3 digits', '4 or more'],
    },
  ],
  colour: (e) => (['arith', 'geo', 'fib', 'primes'].includes(String(e.tags?.family)) ? 'var(--blue-2)' : 'var(--yellow)'),
}
