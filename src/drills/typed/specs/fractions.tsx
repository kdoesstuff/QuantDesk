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
      tags: { mode, denominator: d, numerator: n, places: s.length - 2, leadingZeros: leadingZeros(s), fifths: d % 5 === 0 },
    }
  }
  return { kind: 'toDecimal', prompt: '1/8', sub: `to ${c.places} places`, answer: (0.125).toFixed(c.places), tags: { mode: 'toDecimal', denominator: 8, numerator: 1, places: c.places, leadingZeros: 0, fifths: false } }
}

function Settings({ cfg, setCfg }: { cfg: FractionsConfig; setCfg: (f: (c: FractionsConfig) => FractionsConfig) => void }) {
  return (
    <>
      <Setting title="Clock">
        <Seg options={DURATIONS} value={cfg.durationSec} onChange={(d) => setCfg((c) => ({ ...c, durationSec: d }))} label="Duration" format={durationLabel} />
      </Setting>
      <Setting title="Modes">
        <Chips options={ALL_MODES} value={cfg.modes} onToggle={(m) => setCfg((c) => ({ ...c, modes: toggleIn(c.modes, m) }))} labels={MODE_LABEL} />
      </Setting>
      <Setting title="Places" note="Answers are rounded. Trailing zeros are optional when typing.">
        <Seg options={[2, 3, 4] as const} value={cfg.places} onChange={(p) => setCfg((c) => ({ ...c, places: p }))} label="Decimal places" />
      </Setting>
      <Setting title="Denominators" note="For fraction to decimal and reciprocals. Decimal to fraction always uses halves, quarters, fifths, eighths and their multiples.">
        <div className="chips">
          {DENOMS.map((d) => (
            <button key={d} className="chip tnum" aria-pressed={cfg.denoms.includes(d)} onClick={() => setCfg((c) => ({ ...c, denoms: toggleIn(c.denoms, d) }))}>
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
  configKey: (c) => `fr:${c.durationSec}:${ALL_MODES.filter((m) => c.modes.includes(m)).join(',')}:p${c.places}:${[...c.denoms].sort((a, b) => a - b).join('.')}`,
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
