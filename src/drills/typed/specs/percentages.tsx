import { chance, gcd, pick, rint, round } from '../../../lib/random'
import { durationLabel } from '../../../lib/config'
import { Chips, Seg, Setting, toggleIn } from '../../shared/Frames'
import type { Item, TypedSpec } from '../spec'

/**
 * Percentages the way a trading desk uses them: percent of, percent change,
 * reversing a change, compounding two moves, basis points and margins.
 * Every problem is built so the answer is clean at the stated precision.
 */
export type PType = 'of' | 'change' | 'reverse' | 'compound' | 'bps' | 'margin'
export const TYPE_LABEL: Record<PType, string> = {
  of: 'Percent of',
  change: 'Percent change',
  reverse: 'Reverse a change',
  compound: 'Two moves compounded',
  bps: 'Basis points',
  margin: 'Margin and markup',
}
export const ALL_TYPES: PType[] = ['of', 'change', 'reverse', 'compound', 'bps', 'margin']

export interface PercentagesConfig {
  durationSec: 60 | 120 | 180 | 300
  types: PType[]
  level: 1 | 2 | 3
}
const DURATIONS = [60, 120, 180, 300] as const

const PCTS_EASY = [5, 10, 20, 25, 50, 75]
const PCTS_MED = [2, 4, 5, 8, 10, 12.5, 15, 20, 25, 30, 35, 40, 45, 50, 60, 75, 80, 90]
const PCTS_HARD = [1, 2.5, 3, 6, 7, 7.5, 9, 11, 12.5, 14, 17.5, 22, 32.5, 37.5, 62.5, 85, 95, 110, 125, 150, 175, 250]

/** Pick an integer base such that base * p / 100 is exact at 2 places. */
function baseFor(p: number, lo: number, hi: number) {
  const p100 = Math.round(p * 100) // p in hundredths of a percent
  // base * p100 / 10000 must have at most 2 decimals: base * p100 divisible by 100
  const need = 100 / gcd(p100, 100)
  const kLo = Math.ceil(lo / need)
  const kHi = Math.floor(hi / need)
  return rint(kLo, Math.max(kLo, kHi)) * need
}

function s(x: number, places = 2) {
  return String(round(x, places))
}

function next(c: PercentagesConfig, prev?: Item): Item {
  const types = c.types.length ? c.types : ALL_TYPES
  let type = pick(types)
  if (prev && types.length > 1 && type === prev.kind && chance(0.5)) type = pick(types.filter((t) => t !== type))
  const L = c.level
  const pcts = L === 1 ? PCTS_EASY : L === 2 ? PCTS_MED : [...PCTS_MED, ...PCTS_HARD]

  for (let guard = 0; guard < 60; guard++) {
    switch (type) {
      case 'of': {
        const p = pick(pcts)
        const base = baseFor(p, L === 1 ? 20 : 40, L === 1 ? 400 : L === 2 ? 2000 : 9000)
        const ans = round((base * p) / 100, 2)
        return {
          kind: type,
          prompt: `${p}% of ${base}`,
          answer: s(ans),
          tags: { type, level: L, pct: p, decimals: String(ans).includes('.') ? String(ans).split('.')[1].length : 0, digits: String(Math.round(ans)).length },
        }
      }
      case 'change': {
        // from a to b, answer in percent to one place
        const p = pick(L === 1 ? [10, 20, 25, 50, -10, -20, -25, -50] : [...pcts, ...pcts.map((x) => -x)].filter((x) => x > -100))
        const p10 = Math.round(p * 10)
        const need = 1000 / gcd(Math.abs(p10), 1000)
        const a = rint(1, Math.max(1, Math.floor((L === 1 ? 500 : 5000) / need))) * need
        const b = a + (a * p10) / 1000
        if (!Number.isInteger(b) || b <= 0) continue
        return {
          kind: type,
          prompt: `${a} to ${b}`,
          sub: 'percent change',
          answer: s(p, 1),
          tags: { type, level: L, pct: p, negative: p < 0, decimals: Number.isInteger(p) ? 0 : 1, digits: String(Math.abs(Math.round(p))).length },
        }
      }
      case 'reverse': {
        const p = pick(L === 1 ? [10, 20, 25, 50, -20, -25, -50] : [...pcts, ...pcts.map((x) => -x)].filter((x) => x > -100 && x <= 150))
        const p10 = Math.round(p * 10)
        const need = 1000 / gcd(Math.abs(p10), 1000)
        const a = rint(1, Math.max(1, Math.floor((L === 1 ? 500 : 4000) / need))) * need
        const b = a + (a * p10) / 1000
        if (!Number.isInteger(b) || b <= 0) continue
        return {
          kind: type,
          prompt: `${p > 0 ? 'up' : 'down'} ${Math.abs(p)}% to ${b}`,
          sub: 'what was it before',
          answer: s(a),
          tags: { type, level: L, pct: p, negative: p < 0, decimals: 0, digits: String(a).length },
        }
      }
      case 'compound': {
        const set = L === 1 ? [10, 20, 30, 50, -10, -20, -30, -50] : [5, 10, 15, 20, 25, 30, 40, 50, -5, -10, -15, -20, -25, -30, -40, -50]
        const x = pick(set)
        const y = pick(set)
        const net = round(((1 + x / 100) * (1 + y / 100) - 1) * 100, 2)
        if (Math.abs(net * 10 - Math.round(net * 10)) > 1e-9) continue
        return {
          kind: type,
          prompt: `${x > 0 ? '+' : ''}${x}% then ${y > 0 ? '+' : ''}${y}%`,
          sub: 'net change in percent',
          answer: s(net, 1),
          tags: { type, level: L, pct: x, pct2: y, negative: net < 0, mixed: Math.sign(x) !== Math.sign(y), decimals: Number.isInteger(net) ? 0 : 1 },
        }
      }
      case 'bps': {
        const variant = L === 1 ? 'convert' : pick(['convert', 'move', 'move'])
        if (variant === 'convert') {
          const bps = pick([5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 80, 90, 100, 120, 125, 150, 175, 200, 250, 300, 350, 400, 450, 500, 750, 1000])
          if (chance(0.5)) return { kind: type, prompt: `${bps} bps`, sub: 'in percent', answer: s(bps / 100), tags: { type, level: L, variant, decimals: 2 } }
          return { kind: type, prompt: `${s(bps / 100)}%`, sub: 'in basis points', answer: String(bps), tags: { type, level: L, variant, decimals: 0 } }
        }
        const a = pick([100, 200, 250, 400, 500, 1000, 1250, 2000, 2500, 4000, 5000, 8000, 10000])
        const need = 10000 / gcd(a, 10000)
        const bps = (chance(0.3) ? -1 : 1) * rint(1, Math.max(1, Math.floor((L === 2 ? 300 : 800) / need))) * need
        const b = a + (a * bps) / 10000
        if (!Number.isInteger(b) || b <= 0 || bps === 0) continue
        return {
          kind: type,
          prompt: `${a} to ${b}`,
          sub: 'move in basis points',
          answer: String(bps),
          tags: { type, level: L, variant, negative: bps < 0, decimals: 0, digits: String(Math.abs(bps)).length },
        }
      }
      case 'margin': {
        const variant = L === 1 ? 'margin' : pick(['margin', 'markup'])
        const price = pick([20, 25, 40, 50, 80, 100, 120, 125, 150, 160, 200, 240, 250, 300, 400, 500, 800, 1000])
        const cost = rint(Math.ceil(price * 0.3), price - 1)
        const m = variant === 'margin' ? ((price - cost) / price) * 100 : ((price - cost) / cost) * 100
        if (Math.abs(m * 10 - Math.round(m * 10)) > 1e-9) continue
        return {
          kind: type,
          prompt: `cost ${cost}, sold ${price}`,
          sub: variant === 'margin' ? 'margin in percent' : 'markup in percent',
          answer: s(m, 1),
          tags: { type, level: L, variant, decimals: Number.isInteger(m) ? 0 : 1, digits: String(Math.round(m)).length },
        }
      }
    }
  }
  return { kind: 'of', prompt: '10% of 250', answer: '25', tags: { type: 'of', level: L, pct: 10, decimals: 0, digits: 2 } }
}

function Settings({ cfg, setCfg }: { cfg: PercentagesConfig; setCfg: (f: (c: PercentagesConfig) => PercentagesConfig) => void }) {
  return (
    <>
      <Setting title="Clock">
        <Seg options={DURATIONS} value={cfg.durationSec} onChange={(d) => setCfg((c) => ({ ...c, durationSec: d }))} label="Duration" format={durationLabel} />
      </Setting>
      <Setting title="Level" note="Level 1 uses round percentages. Level 3 adds halves, odd percentages and larger bases.">
        <Seg options={[1, 2, 3] as const} value={cfg.level} onChange={(l) => setCfg((c) => ({ ...c, level: l }))} label="Level" />
      </Setting>
      <Setting title="Types" note="Answers are numbers only: percent change as 12.5, basis points as 125, money as 37.5.">
        <Chips options={ALL_TYPES} value={cfg.types} onToggle={(t) => setCfg((c) => ({ ...c, types: toggleIn(c.types, t) }))} labels={TYPE_LABEL} />
      </Setting>
    </>
  )
}

export const percentagesSpec: TypedSpec<PercentagesConfig> = {
  id: 'percentages',
  title: 'Percentages',
  blurb: 'Percent of, percent change, reversing a move, compounding two moves, basis points and margins. Type the number only.',
  mode: 'typed',
  defaults: { durationSec: 120, types: [...ALL_TYPES], level: 2 },
  configKey: (c) => `pct:${c.durationSec}:L${c.level}:${ALL_TYPES.filter((t) => c.types.includes(t)).join(',')}`,
  describe: (c) => `${durationLabel(c.durationSec)}, level ${c.level}, ${c.types.length === ALL_TYPES.length ? 'all types' : `${c.types.length} types`}`,
  duration: (c) => c.durationSec,
  next,
  Settings,
  inputPattern: /[^\d.-]/g,
  breakdowns: [
    { title: 'By type', key: (e) => TYPE_LABEL[(e.tags?.type as PType) ?? 'of'] ?? null, order: ALL_TYPES.map((t) => TYPE_LABEL[t]) },
    {
      title: 'By answer shape',
      key: (e) => (e.tags?.negative ? 'Negative' : Number(e.tags?.decimals ?? 0) > 0 ? 'With decimals' : 'Whole number'),
      order: ['Whole number', 'With decimals', 'Negative'],
    },
  ],
  colour: (e) => (['of', 'change', 'reverse'].includes(String(e.tags?.type)) ? 'var(--blue-2)' : 'var(--yellow)'),
}
