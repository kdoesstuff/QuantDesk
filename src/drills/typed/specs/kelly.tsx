import { chance, pick, round } from '../../../lib/random'
import { durationLabel } from '../../../lib/config'
import { Chips, Seg, Setting, toggleIn } from '../../shared/Frames'
import type { Item, TypedSpec } from '../spec'

/**
 * Kelly sizing. f* = p - q/b, the fraction of the bankroll to stake when you
 * win b per unit with probability p. Answers are in percent of bankroll and
 * built to be exact to one place.
 */
export type KVariant = 'full' | 'half' | 'even' | 'decimal' | 'reverse'
export const VARIANT_LABEL: Record<KVariant, string> = {
  full: 'Full Kelly',
  half: 'Half Kelly',
  even: 'Even money',
  decimal: 'Decimal odds',
  reverse: 'Implied win rate',
}
export const ALL_VARIANTS: KVariant[] = ['full', 'half', 'even', 'decimal', 'reverse']

export interface KellyConfig {
  durationSec: 60 | 120 | 180
  variants: KVariant[]
}

const B = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]

function clean1(x: number) {
  return Math.abs(x * 10 - Math.round(x * 10)) < 1e-9
}

function fmtB(b: number) {
  return Number.isInteger(b) ? `${b} to 1` : b === 0.5 ? '1 to 2' : b === 1.5 ? '3 to 2' : b === 2.5 ? '5 to 2' : `${b} to 1`
}

function next(c: KellyConfig, prev?: Item): Item {
  const vs = c.variants.length ? c.variants : ALL_VARIANTS
  let v = pick(vs)
  if (prev && vs.length > 1 && v === prev.kind && chance(0.5)) v = pick(vs.filter((x) => x !== v))
  for (let guard = 0; guard < 200; guard++) {
    if (v === 'even') {
      const p = pick([51, 52, 54, 55, 56, 58, 60, 62, 65, 70, 75, 80, 45, 48, 50])
      const f = Math.max(0, 2 * p - 100)
      return { kind: v, prompt: `win ${p}%, even money`, sub: 'Kelly stake, percent of bankroll', answer: String(f), tags: { variant: v, p, b: 1, noBet: f === 0, size: f >= 30 ? 'large' : f >= 10 ? 'medium' : 'small' } }
    }
    if (v === 'reverse') {
      const b = pick([1, 2, 3, 4, 5])
      const f = pick([5, 10, 15, 20, 25, 30, 40])
      // f = p - (1-p)/b  =>  p = (f + 1/b) / (1 + 1/b)
      const p = round(((f / 100 + 1 / b) / (1 + 1 / b)) * 100, 2)
      if (!clean1(p)) continue
      return { kind: v, prompt: `Kelly says ${f}% at ${fmtB(b)}`, sub: 'implied win probability, percent', answer: String(p), tags: { variant: v, p, b, noBet: false, size: 'n/a' } }
    }
    const b = pick(B)
    const p = pick([20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 90])
    const full = (p / 100 - (1 - p / 100) / b) * 100
    const f = v === 'half' ? full / 2 : full
    const ans = Math.max(0, round(f, 1))
    if (!clean1(ans)) continue
    const oddsText = v === 'decimal' ? `decimal odds ${round(b + 1, 2)}` : fmtB(b)
    return {
      kind: v,
      prompt: `win ${p}%, ${oddsText}`,
      sub: `${v === 'half' ? 'half' : 'full'} Kelly stake, percent of bankroll, 0 if no bet`,
      answer: String(ans),
      tags: { variant: v, p, b, noBet: ans === 0, size: ans >= 30 ? 'large' : ans >= 10 ? 'medium' : ans > 0 ? 'small' : 'none' },
    }
  }
  return { kind: 'even', prompt: 'win 60%, even money', sub: 'Kelly stake, percent of bankroll', answer: '20', tags: { variant: 'even', p: 60, b: 1, noBet: false, size: 'medium' } }
}

function Settings({ cfg, setCfg }: { cfg: KellyConfig; setCfg: (f: (c: KellyConfig) => KellyConfig) => void }) {
  return (
    <>
      <Setting title="Clock">
        <Seg options={[60, 120, 180] as const} value={cfg.durationSec} onChange={(d) => setCfg((c) => ({ ...c, durationSec: d }))} label="Duration" format={durationLabel} />
      </Setting>
      <Setting title="Variants" note="Full Kelly is p minus q over b. Decimal odds of 3.0 mean 2 to 1. Implied win rate goes the other way.">
        <Chips options={ALL_VARIANTS} value={cfg.variants} onToggle={(v) => setCfg((c) => ({ ...c, variants: toggleIn(c.variants, v) }))} labels={VARIANT_LABEL} />
      </Setting>
    </>
  )
}

export const kellySpec: TypedSpec<KellyConfig> = {
  id: 'kelly',
  title: 'Kelly sizing',
  blurb: 'How much of the bankroll, given the edge. Win probability and odds in, stake in percent out. Answers are exact to one place.',
  mode: 'typed',
  defaults: { durationSec: 120, variants: ['full', 'half', 'even', 'decimal'] },
  configKey: (c) => `kelly:${c.durationSec}:${ALL_VARIANTS.filter((v) => c.variants.includes(v)).join(',')}`,
  describe: (c) => `${durationLabel(c.durationSec)}, ${c.variants.length === ALL_VARIANTS.length ? 'all variants' : c.variants.map((v) => VARIANT_LABEL[v].toLowerCase()).join(', ')}`,
  duration: (c) => c.durationSec,
  next,
  Settings,
  inputPattern: /[^\d.]/g,
  breakdowns: [
    { title: 'By variant', key: (e) => VARIANT_LABEL[(e.tags?.variant as KVariant) ?? 'full'] ?? null, order: ALL_VARIANTS.map((v) => VARIANT_LABEL[v]) },
    { title: 'By stake size', key: (e) => (e.tags?.size === 'n/a' ? null : e.tags?.size === 'none' ? 'No bet' : `${String(e.tags?.size)[0].toUpperCase()}${String(e.tags?.size).slice(1)} stake`), order: ['No bet', 'Small stake', 'Medium stake', 'Large stake'] },
  ],
  colour: (e) => (e.tags?.variant === 'reverse' ? 'var(--yellow)' : 'var(--blue-2)'),
}
