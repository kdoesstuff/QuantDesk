import { chance, gcd, pick, rint } from '../../../lib/random'
import { durationLabel } from '../../../lib/config'
import { Chips, Seg, Setting, toggleIn } from '../../shared/Frames'
import type { Item, TypedSpec } from '../spec'

/**
 * Fractions and decimals from memory. Three modes: a fraction to a decimal
 * to a set number of places, a terminating decimal back to its simplest
 * fraction, and reciprocals.
 */
export type Mode = 'toDecimal' | 'toFraction' | 'reciprocal'
export const MODE_LABEL: Record<Mode, string> = {
  toDecimal: 'Fraction to decimal',
  toFraction: 'Decimal to fraction',
  reciprocal: 'Reciprocals',
}
export const ALL_MODES: Mode[] = ['toDecimal', 'toFraction', 'reciprocal']

export const DENOMS = [3, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 24] as const
export type Denom = (typeof DENOMS)[number]
const TERMINATING = [4, 5, 8, 16, 20, 25, 32, 40, 50, 64] as const

export interface FractionsConfig {
  durationSec: 60 | 120 | 180 | 300
  modes: Mode[]
  denoms: Denom[]
  places: 2 | 3 | 4
}

const DURATIONS = [60, 120, 180, 300] as const

/** Round half away from zero to `p` places, refusing ties so the answer is unambiguous. */
function roundTo(x: number, p: number): string | null {
  const f = 10 ** p
  const scaled = x * f
  const frac = scaled - Math.floor(scaled)
  if (Math.abs(frac - 0.5) < 1e-9) return null
  return (Math.round(scaled) / f).toFixed(p)
}

function leadingZeros(s: string) {
  const m = s.match(/^0\.(0*)/)
  return m ? m[1].length : 0
}

/** The reciprocal of d to 6 places, with a note on whether it repeats, for the review. */
function recipNote(d: number) {
  const r = 1 / d
  const digits = r.toFixed(6)
  const terminates = (() => {
    let x = d
    while (x % 2 === 0) x /= 2
    while (x % 5 === 0) x /= 5
    return x === 1
  })()
  return `1/${d} = ${digits}${terminates ? '' : '... (repeating)'}`
}

function howToDecimal(n: number, d: number, places: number, ans: string) {
  const unit = recipNote(d)
  if (n === 1) return `${unit}. Rounded to ${places} places that is ${ans}.`
  return `Know the unit fraction first: ${unit}. Then ${n}/${d} is ${n} × ${(1 / d).toFixed(4)} = ${(n / d).toFixed(4)}..., which rounds to ${ans} at ${places} places. With the ${d}ths memorised you can also count up the cycle.`
}

function howReciprocal(d: number, places: number, ans: string) {
  const near = [10, 20, 25, 40, 50].reduce((a, b) => (Math.abs(b - d) < Math.abs(a - d) ? b : a))
  if (d >= 11 && d !== near)
    return `Anchor on 1/${near} = ${(1 / near).toFixed(4)} and adjust: 1/${d} is ${d > near ? 'a bit smaller' : 'a bit larger'}, about ${(1 / d).toFixed(4)}. To ${places} places that is ${ans}. (${recipNote(d)}.)`
  return `${recipNote(d)}, so to ${places} places ${ans}.`
}

function howToFraction(s: string, n: number, d: number) {
  const places = s.length - 2
  const num = Math.round(Number(s) * 10 ** places)
  const g = gcd(num, 10 ** places)
  return `${s} is ${num} over ${10 ** places}. Divide top and bottom by ${g}: ${n}/${d}. Decimals that terminate always sit over a power of ten, so the denominator after cancelling only has factors 2 and 5.`
}

function next(c: FractionsConfig, prev?: Item): Item {
  const modes = c.modes.length ? c.modes : ALL_MODES
  let mode = pick(modes)
  if (prev && modes.length > 1 && mode === prev.kind && chance(0.5)) mode = pick(modes.filter((m) => m !== mode))
  const denoms = c.denoms.length ? c.denoms : [...DENOMS]

  for (let guard = 0; guard < 50; guard++) {
    if (mode === 'toDecimal') {
      const d = pick(denoms)
      const n = rint(1, d - 1)
      if (gcd(n, d) !== 1) continue
      const ans = roundTo(n / d, c.places)
      if (!ans) continue
      return {
        kind: mode,
        prompt: `${n}/${d}`,
        sub: `to ${c.places} places`,
        answer: ans,
        how: howToDecimal(n, d, c.places, ans),
        tags: { mode, denominator: d, numerator: n, places: c.places, leadingZeros: leadingZeros(ans), fifths: d % 5 === 0 },
      }
    }
    if (mode === 'reciprocal') {
      const d = chance(0.5) ? pick(denoms) : rint(11, 40)
      const ans = roundTo(1 / d, c.places)
      if (!ans) continue
      return {
        kind: mode,
        prompt: `1/${d}`,
        sub: `to ${c.places} places`,
        answer: ans,
        how: howReciprocal(d, c.places, ans),
        tags: { mode, denominator: d, numerator: 1, places: c.places, leadingZeros: leadingZeros(ans), fifths: d % 5 === 0 },
      }
    }
    // Decimal to fraction, terminating decimals only.
    const d = pick(TERMINATING)
    const n = rint(1, d - 1)
    if (gcd(n, d) !== 1) continue
    const dec = n / d
    const s = String(dec)
    if (s.length > 7) continue
    return {
      kind: mode,
      prompt: s,
      sub: 'as a fraction in lowest terms',
      answer: `${n}/${d}`,
      how: howToFraction(s, n, d),
      tags: { mode, denominator: d, numerator: n, places: s.length - 2, leadingZeros: leadingZeros(s), fifths: d % 5 === 0 },
    }
  }
  return {
    kind: 'toDecimal',
    prompt: '1/8',
    sub: `to ${c.places} places`,
    answer: (0.125).toFixed(c.places),
    tags: { mode: 'toDecimal', denominator: 8, numerator: 1, places: c.places, leadingZeros: 0, fifths: false },
  }
}

function Settings({ cfg, setCfg }: { cfg: FractionsConfig; setCfg: (f: (c: FractionsConfig) => FractionsConfig) => void }) {
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
      <Setting title="Modes">
        <Chips
          options={ALL_MODES}
          value={cfg.modes}
          onToggle={(m) => setCfg((c) => ({ ...c, modes: toggleIn(c.modes, m) }))}
          labels={MODE_LABEL}
        />
      </Setting>
      <Setting title="Places" note="Answers are rounded. Trailing zeros are optional when typing.">
        <Seg
          options={[2, 3, 4] as const}
          value={cfg.places}
          onChange={(p) => setCfg((c) => ({ ...c, places: p }))}
          label="Decimal places"
        />
      </Setting>
      <Setting
        title="Denominators"
        note="For fraction to decimal and reciprocals. Decimal to fraction always uses halves, quarters, fifths, eighths and their multiples."
      >
        <div className="chips">
          {DENOMS.map((d) => (
            <button
              key={d}
              className="chip tnum"
              aria-pressed={cfg.denoms.includes(d)}
              onClick={() => setCfg((c) => ({ ...c, denoms: toggleIn(c.denoms, d) }))}
            >
              {d}
            </button>
          ))}
        </div>
      </Setting>
    </>
  )
}

export const fractionsSpec: TypedSpec<FractionsConfig> = {
  id: 'fractions',
  title: 'Fractions to decimals',
  blurb: 'Sevenths, elevenths, thirteenths, sixteenths, from memory, to a set number of places. Decimal to fraction goes the other way.',
  mode: 'typed',
  defaults: { durationSec: 120, modes: ['toDecimal', 'reciprocal'], denoms: [7, 8, 9, 11, 12, 13, 16], places: 3 },
  configKey: (c) =>
    `fr:${c.durationSec}:${ALL_MODES.filter((m) => c.modes.includes(m)).join(',')}:p${c.places}:${[...c.denoms].sort((a, b) => a - b).join('.')}`,
  describe: (c) => `${durationLabel(c.durationSec)}, ${c.places} places, ${c.modes.map((m) => MODE_LABEL[m].toLowerCase()).join(' and ')}`,
  duration: (c) => c.durationSec,
  next,
  Settings,
  inputPattern: /[^\d./]/g,
  breakdowns: [
    { title: 'By mode', key: (e) => MODE_LABEL[(e.tags?.mode as Mode) ?? 'toDecimal'] ?? null, order: ALL_MODES.map((m) => MODE_LABEL[m]) },
    {
      title: 'By denominator',
      key: (e) => (e.tags?.denominator !== undefined ? `/${e.tags.denominator}` : null),
      order: Array.from({ length: 130 }, (_, i) => `/${i}`),
    },
  ],
  colour: (e) => (e.tags?.mode === 'toFraction' ? 'var(--yellow)' : 'var(--blue-2)'),
}
