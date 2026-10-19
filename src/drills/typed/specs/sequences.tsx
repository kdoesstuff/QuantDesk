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
  | 'tri'
  | 'fact'
  | 'pell'
  | 'padovan'
  | 'tribonacci'
  | 'repeat'
  | 'letters'

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
  tri: 'Triangular numbers',
  fact: 'Factorials',
  pell: 'Twice previous plus one before',
  padovan: 'Sum of two and three back',
  tribonacci: 'Sum of previous three',
  repeat: 'Repeating block',
  letters: 'Letters',
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
  'tri',
  'fact',
  'pell',
  'padovan',
  'tribonacci',
  'repeat',
  'letters',
]

export interface SequencesConfig {
  durationSec: 60 | 120 | 180 | 300
  families: Family[]
  /** 1 small numbers, 2 medium, 3 larger and negative steps. */
  level: 1 | 2 | 3
}

const DURATIONS = [60, 120, 180, 300] as const
const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113]
const LETTERS = 'abcdefghijklmnopqrstuvwxyz'

interface Built {
  terms: (number | string)[]
  answer: number | string
  shown: number
  /** The rule with the numbers in it, for the review. */
  how: string
}

const list = (xs: (number | string)[]) => xs.join(', ')
const signed = (d: number) => (d >= 0 ? `+ ${d}` : `− ${-d}`)

function build(c: SequencesConfig, family: Family): Built {
  const L = c.level
  const shown = family === 'interleave' || family === 'repeat' ? 6 : 5
  const need = shown + 1
  const seq: number[] = []
  let how = ''
  switch (family) {
    case 'arith': {
      const d = (chance(L >= 3 ? 0.35 : 0.12) ? -1 : 1) * rint(2, L === 1 ? 9 : L === 2 ? 19 : 47)
      let a = rint(1, L === 1 ? 30 : L === 2 ? 90 : 300)
      if (d < 0) a = rint(60, 200)
      for (let i = 0; i < need; i++) seq.push(a + i * d)
      how = `Each term is the one before ${signed(d)}. The differences are all ${d}, so the next term is ${seq[shown - 1]} ${signed(d)} = ${seq[shown]}.`
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
      if (chance(0.25) && r > 0) {
        seq.reverse()
        how = `Each term is the one before divided by ${r}. ${seq[shown - 1]} ÷ ${r} = ${seq[shown]}.`
      } else
        how = `Each term is the one before times ${r}. The ratio between neighbours is always ${r}, so ${seq[shown - 1]} × ${r} = ${seq[shown]}.`
      break
    }
    case 'quad': {
      const c2 = rint(1, L === 1 ? 1 : L === 2 ? 2 : 3)
      const b = rint(L === 3 ? -4 : 0, L === 1 ? 2 : 6)
      const a = rint(0, L === 1 ? 5 : 20)
      for (let n = 1; n <= need; n++) seq.push(a + b * n + c2 * n * n)
      const diffs = seq.slice(1).map((x, i) => x - seq[i])
      how = `Write the differences: ${list(diffs.slice(0, shown - 1))}. They grow by ${2 * c2} each time, so the next difference is ${diffs[shown - 1]} and the next term is ${seq[shown - 1]} + ${diffs[shown - 1]} = ${seq[shown]}.`
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
      const second = kind === 'addmul' ? `× ${y}` : `− ${y}`
      const lastOp = (shown - 1) % 2 === 0 ? `+ ${x}` : second
      how = `Two rules take turns: + ${x}, then ${second}, then + ${x} again. The step into the missing term is ${lastOp}: ${seq[shown - 1]} ${lastOp} = ${seq[shown]}.`
      break
    }
    case 'interleave': {
      const a1 = rint(1, 20)
      const d1 = rint(2, L === 1 ? 5 : 11)
      const a2 = rint(L === 1 ? 20 : 40, 99)
      const d2 = -rint(2, L === 1 ? 5 : 11)
      for (let i = 0; i < need; i++) seq.push(i % 2 === 0 ? a1 + (i / 2) * d1 : a2 + ((i - 1) / 2) * d2)
      how = `Two sequences take turns. Odd positions go up by ${d1} (${list(seq.filter((_, i) => i % 2 === 0).slice(0, 3))}, ...), even positions go down by ${-d2} (${list(seq.filter((_, i) => i % 2 === 1).slice(0, 3))}, ...). The missing term belongs to the odd-position one: ${seq[shown - 2]} + ${d1} = ${seq[shown]}.`
      break
    }
    case 'fib': {
      let p = rint(1, L === 1 ? 4 : 9)
      let q = rint(p, L === 1 ? 8 : 15)
      for (let i = 0; i < need; i++) {
        seq.push(p)
        ;[p, q] = [q, p + q]
      }
      how = `Each term is the sum of the two before it: ${seq[shown - 2]} + ${seq[shown - 1]} = ${seq[shown]}.`
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
      const n = start + shown
      const base =
        which === 'sq'
          ? `${n}² = ${n * n}`
          : which === 'cube'
            ? `${n}³ = ${n * n * n}`
            : which === 'two'
              ? `2^${n} = ${2 ** n}`
              : `${n}² + ${n} = ${n * n + n}`
      const name = which === 'sq' ? 'squares' : which === 'cube' ? 'cubes' : which === 'two' ? 'powers of two' : 'n² + n'
      how = `These are ${name}${k ? ` ${signed(k)}` : ''}, starting at n = ${start}. The next one is ${base}${k ? ` ${signed(k)}` : ''} = ${seq[shown]}.`
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
      const diffs = seq.slice(1).map((x, i) => x - seq[i])
      how = `The differences are ${list(diffs.slice(0, shown - 1))}, each ${r === 2 ? 'double' : 'triple'} the one before. The next difference is ${diffs[shown - 1]}, so ${seq[shown - 1]} + ${diffs[shown - 1]} = ${seq[shown]}.`
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
      how = `Each term is ${k} times the one before ${signed(add)}. Check: ${seq[0]} × ${k} ${signed(add)} = ${seq[1]}. So ${seq[shown - 1]} × ${k} ${signed(add)} = ${seq[shown]}.`
      break
    }
    case 'primes': {
      const step = L === 1 ? 1 : pick([1, 2])
      const start = rint(0, L === 1 ? 4 : 12)
      const off = L === 3 ? rint(-2, 2) : 0
      for (let i = 0; i < need; i++) seq.push(PRIMES[start + i * step] + off)
      how = `${step === 1 ? 'Consecutive primes' : 'Every second prime'}${off ? ` ${signed(off)}` : ''}: ${list(seq.slice(0, shown).map((x) => x - off))} are primes. The next prime in the run is ${seq[shown] - off}${off ? `, ${signed(off)} gives ${seq[shown]}` : ''}.`
      break
    }
    case 'squareDiff': {
      let v = rint(1, L === 1 ? 5 : 15)
      const start = rint(1, 2)
      for (let i = 0; i < need; i++) {
        seq.push(v)
        v += (start + i) * (start + i)
      }
      const diffs = seq.slice(1).map((x, i) => x - seq[i])
      how = `The differences are square numbers: ${list(diffs.slice(0, shown - 1))}. The next square is ${diffs[shown - 1]}, so ${seq[shown - 1]} + ${diffs[shown - 1]} = ${seq[shown]}.`
      break
    }
    case 'tri': {
      const k = L === 1 ? 0 : rint(-3, 5)
      const start = rint(1, L === 1 ? 2 : 4)
      for (let n = start; n < start + need; n++) seq.push((n * (n + 1)) / 2 + k)
      const n = start + shown
      how = `Triangular numbers${k ? ` ${signed(k)}` : ''}: the differences go up by one each time (${list(seq.slice(1, shown).map((x, i) => x - seq[i]))}). The next is ${n} × ${n + 1} ÷ 2 = ${(n * (n + 1)) / 2}${k ? ` ${signed(k)} = ${seq[shown]}` : ''}.`
      break
    }
    case 'fact': {
      const start = L === 1 ? 1 : rint(1, 2)
      const mult = L === 3 ? pick([1, 2, 3]) : 1
      let v = mult
      for (let n = 1; n < start; n++) v *= n
      for (let n = start; n < start + need; n++) {
        seq.push(v)
        v *= n + 1
      }
      how = `Factorials${mult > 1 ? ` times ${mult}` : ''}: each term is the one before multiplied by the next counting number (×${start + 1}, ×${start + 2}, ...). The last step is ×${start + shown}: ${seq[shown - 1]} × ${start + shown} = ${seq[shown]}.`
      break
    }
    case 'pell': {
      let p = L === 1 ? 0 : rint(0, 3)
      let q = rint(1, L === 1 ? 2 : 4)
      for (let i = 0; i < need; i++) {
        seq.push(p)
        ;[p, q] = [q, 2 * q + p]
      }
      how = `Each term is twice the one before plus the one before that: 2 × ${seq[shown - 1]} + ${seq[shown - 2]} = ${seq[shown]}.`
      break
    }
    case 'padovan': {
      const a = L === 1 ? 1 : rint(1, 3)
      const b = L === 1 ? 1 : rint(1, 3)
      const c3 = L === 1 ? 1 : rint(1, 4)
      const arr = [a, b, c3]
      while (arr.length < need) arr.push(arr[arr.length - 2] + arr[arr.length - 3])
      seq.push(...arr)
      how = `Each term is the sum of the terms two and three places back (skip the one just before): ${seq[shown - 2]} + ${seq[shown - 3]} = ${seq[shown]}.`
      break
    }
    case 'tribonacci': {
      const arr = [rint(0, L === 1 ? 1 : 3), rint(1, 3), rint(1, L === 1 ? 3 : 6)]
      while (arr.length < need) arr.push(arr[arr.length - 1] + arr[arr.length - 2] + arr[arr.length - 3])
      seq.push(...arr)
      how = `Each term is the sum of the three before it: ${seq[shown - 3]} + ${seq[shown - 2]} + ${seq[shown - 1]} = ${seq[shown]}.`
      break
    }
    case 'repeat': {
      // A block that repeats, with a drift on one slot at higher levels.
      const len = pick(L === 1 ? [2, 3] : [2, 3, 4])
      const block = Array.from({ length: len }, () => rint(1, L === 1 ? 9 : 20))
      const drift = L === 1 ? 0 : pick([0, 1, 2, -1, 3])
      for (let i = 0; i < need; i++) seq.push(block[i % len] + (i % len === 0 ? Math.floor(i / len) * drift : 0))
      how = drift
        ? `A block of ${len} repeats (${list(block)}), except the first slot moves by ${drift} each cycle. Position ${shown + 1} is slot ${(shown % len) + 1} of the block${shown % len === 0 ? `, so ${block[0]} + ${Math.floor(shown / len)} × ${drift} = ${seq[shown]}` : `, so it is ${seq[shown]}`}.`
        : `A block of ${len} repeats: ${list(block)}. Position ${shown + 1} is slot ${(shown % len) + 1}, so ${seq[shown]}.`
      break
    }
    case 'letters': {
      // Letters as positions in the alphabet.
      const kind = pick(L === 1 ? ['step', 'step'] : ['step', 'grow', 'back'])
      const d = kind === 'back' ? -rint(1, 3) : rint(1, L === 1 ? 3 : 4)
      let pos = kind === 'back' ? rint(18, 25) : rint(0, 3)
      const letters: string[] = []
      let step = d
      for (let i = 0; i < need; i++) {
        letters.push(LETTERS[pos])
        pos += step
        if (kind === 'grow') step += 1
        if (pos < 0 || pos > 25) return build(c, family)
      }
      const show = letters.slice(0, shown)
      const ans = letters[shown]
      const howL =
        kind === 'step'
          ? `Count forward ${d} letter${d === 1 ? '' : 's'} each time: ${show.join(' ')} go ${d} apart. ${show[shown - 1]} plus ${d} is ${ans}.`
          : kind === 'back'
            ? `Count backward ${-d} letter${d === -1 ? '' : 's'} each time: ${show[shown - 1]} minus ${-d} is ${ans}.`
            : `The gaps grow by one each time (${d}, ${d + 1}, ${d + 2}, ...). The gap into the missing letter is ${d + shown - 1}: ${show[shown - 1]} plus ${d + shown - 1} is ${ans}.`
      return { terms: show, answer: ans, shown, how: howL }
    }
  }
  return { terms: seq.slice(0, shown), answer: seq[shown], shown, how }
}

function next(c: SequencesConfig, prev?: Item): Item {
  const fams = c.families.length ? c.families : ALL_FAMILIES
  let family = pick(fams)
  if (prev && fams.length > 1 && family === prev.kind && chance(0.6)) family = pick(fams.filter((f) => f !== family))
  let built = build(c, family)
  // Keep the numbers on a human scale.
  let guard = 0
  while (typeof built.answer === 'number' && Math.abs(built.answer) > 20000 && guard++ < 20) built = build(c, family)
  const isLetter = typeof built.answer === 'string'
  const magnitude = isLetter ? 1 : String(Math.abs(built.answer as number)).length
  return {
    kind: family,
    prompt: built.terms.join(', ') + ', ?',
    answer: String(built.answer),
    alt: isLetter ? [String(built.answer).toUpperCase()] : undefined,
    how: built.how,
    tags: {
      family,
      level: c.level,
      digits: magnitude,
      negative: typeof built.answer === 'number' && built.answer < 0,
      shown: built.shown,
      letters: isLetter,
    },
  }
}

function Settings({ cfg, setCfg }: { cfg: SequencesConfig; setCfg: (f: (c: SequencesConfig) => SequencesConfig) => void }) {
  return (
    <>
      <Setting title="Clock">
        <Seg
          options={DURATIONS}
          value={cfg.durationSec}
          onChange={(d) => setCfg((c) => ({ ...c, durationSec: d }))}
          label="Duration"
          format={durationLabel}
        />
      </Setting>
      <Setting title="Level" note="Level 1 keeps steps small. Level 3 adds negative steps, larger ratios and offsets.">
        <Seg options={[1, 2, 3] as const} value={cfg.level} onChange={(l) => setCfg((c) => ({ ...c, level: l }))} label="Level" />
      </Setting>
      <Setting title="Families" note="Each family is one rule. The results page shows which rules cost you time.">
        <Chips
          options={ALL_FAMILIES}
          value={cfg.families}
          onToggle={(f) => setCfg((c) => ({ ...c, families: toggleIn(c.families, f) }))}
          labels={FAMILY_LABEL}
        />
        <div className="chips chips--actions">
          <button className="btn btn-ghost btn-small" onClick={() => setCfg((c) => ({ ...c, families: [...ALL_FAMILIES] }))}>
            All
          </button>
          <button
            className="btn btn-ghost btn-small"
            onClick={() => setCfg((c) => ({ ...c, families: shuffle(ALL_FAMILIES).slice(0, 4) }))}
          >
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
  blurb: 'Five terms, type the sixth. A right answer clears itself. Negative answers take a leading minus; letter sequences take a letter.',
  mode: 'typed',
  defaults: { durationSec: 120, families: [...ALL_FAMILIES], level: 2 },
  configKey: (c) => `seq:${c.durationSec}:L${c.level}:${ALL_FAMILIES.filter((f) => c.families.includes(f)).join(',')}`,
  describe: (c) =>
    `${durationLabel(c.durationSec)}, level ${c.level}, ${c.families.length === ALL_FAMILIES.length ? 'all families' : `${c.families.length} families`}`,
  duration: (c) => c.durationSec,
  next,
  Settings,
  inputPattern: /[^\d\-a-zA-Z]/g,
  breakdowns: [
    {
      title: 'By family',
      key: (e) => FAMILY_LABEL[(e.tags?.family as Family) ?? 'arith'] ?? null,
      order: ALL_FAMILIES.map((f) => FAMILY_LABEL[f]),
    },
    {
      title: 'By answer size',
      key: (e) => {
        const d = Number(e.tags?.digits ?? 0)
        return d <= 2 ? 'Up to 2 digits' : d === 3 ? '3 digits' : '4 or more'
      },
      order: ['Up to 2 digits', '3 digits', '4 or more'],
    },
  ],
  colour: (e) =>
    ['arith', 'geo', 'fib', 'primes', 'tri', 'fact', 'letters'].includes(String(e.tags?.family)) ? 'var(--blue-2)' : 'var(--yellow)',
}
