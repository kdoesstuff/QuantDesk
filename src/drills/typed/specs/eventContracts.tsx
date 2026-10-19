import { chance, pick } from '../../../lib/random'
import { durationLabel } from '../../../lib/config'
import { Chips, Seg, Setting, toggleIn } from '../../shared/Frames'
import type { Item, TypedSpec } from '../spec'

/**
 * Event contracts: price a YES contract in cents. A base rate and a piece
 * of evidence go in, a posterior comes out. Submit with Enter; a cent
 * either way is accepted.
 */
export type EVariant = 'bayes' | 'ratio' | 'both' | 'either' | 'conditional' | 'twoStep'
export const VARIANT_LABEL: Record<EVariant, string> = {
  bayes: 'Test result',
  ratio: 'Likelihood ratio',
  both: 'Both happen',
  either: 'At least one',
  conditional: 'Condition on a cause',
  twoStep: 'Two-stage event',
}
export const ALL_VARIANTS: EVariant[] = ['bayes', 'ratio', 'both', 'either', 'conditional', 'twoStep']

export interface EventConfig {
  durationSec: 120 | 180 | 300
  variants: EVariant[]
  tolerance: 0 | 1 | 2
}

const PCT = [5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90]

function cents(p: number) {
  return String(Math.round(p * 100))
}

function next(c: EventConfig, prev?: Item): Item {
  const vs = c.variants.length ? c.variants : ALL_VARIANTS
  let v = pick(vs)
  if (prev && vs.length > 1 && v === prev.kind && chance(0.5)) v = pick(vs.filter((x) => x !== v))
  switch (v) {
    case 'bayes': {
      const prior = pick([2, 5, 10, 20, 30, 40, 50]) / 100
      const sens = pick([60, 70, 80, 90, 95, 99]) / 100
      const fpr = pick([1, 2, 5, 10, 20, 30]) / 100
      const positive = chance(0.7)
      const post = positive ? (prior * sens) / (prior * sens + (1 - prior) * fpr) : (prior * (1 - sens)) / (prior * (1 - sens) + (1 - prior) * (1 - fpr))
      return {
        kind: v,
        prompt: `${positive ? 'positive' : 'negative'} test`,
        sub: `base rate ${prior * 100}%, catches ${sens * 100}% of true cases, false positive rate ${fpr * 100}%. Price YES in cents`,
        detail: [
          { label: 'Base rate', value: `${prior * 100}%` },
          { label: 'Sensitivity', value: `${sens * 100}%` },
          { label: 'False positive', value: `${fpr * 100}%` },
          { label: 'Result', value: positive ? 'positive' : 'negative' },
        ],
        answer: cents(post),
        tolerance: c.tolerance,
        tags: { variant: v, prior: prior * 100, positive, lowPrior: prior <= 0.1, answer: Math.round(post * 100) },
      }
    }
    case 'ratio': {
      const prior = pick(PCT) / 100
      const lr = pick([0.25, 0.5, 2, 3, 4, 5, 8, 10])
      const odds = (prior / (1 - prior)) * lr
      const post = odds / (1 + odds)
      return {
        kind: v,
        prompt: `evidence ${lr >= 1 ? `${lr}x` : `${1 / lr}x less`} likely if YES`,
        sub: `prior ${prior * 100}%. Price YES in cents`,
        detail: [
          { label: 'Prior', value: `${prior * 100}%` },
          { label: 'Likelihood ratio', value: String(lr) },
        ],
        answer: cents(post),
        tolerance: c.tolerance,
        tags: { variant: v, prior: prior * 100, lr, against: lr < 1, answer: Math.round(post * 100) },
      }
    }
    case 'both': {
      const a = pick(PCT) / 100
      const b = pick(PCT) / 100
      return {
        kind: v,
        prompt: `A and B`,
        sub: `independent, A ${a * 100}%, B ${b * 100}%. Price BOTH in cents`,
        detail: [
          { label: 'A', value: `${a * 100}%` },
          { label: 'B', value: `${b * 100}%` },
        ],
        answer: cents(a * b),
        tolerance: c.tolerance,
        tags: { variant: v, answer: Math.round(a * b * 100) },
      }
    }
    case 'either': {
      const a = pick(PCT) / 100
      const b = pick(PCT) / 100
      return {
        kind: v,
        prompt: `A or B`,
        sub: `independent, A ${a * 100}%, B ${b * 100}%. Price AT LEAST ONE in cents`,
        detail: [
          { label: 'A', value: `${a * 100}%` },
          { label: 'B', value: `${b * 100}%` },
        ],
        answer: cents(1 - (1 - a) * (1 - b)),
        tolerance: c.tolerance,
        tags: { variant: v, answer: Math.round((1 - (1 - a) * (1 - b)) * 100) },
      }
    }
    case 'conditional': {
      const pa = pick(PCT) / 100
      const bGivenA = pick(PCT) / 100
      const bGivenNot = pick(PCT) / 100
      const pb = pa * bGivenA + (1 - pa) * bGivenNot
      return {
        kind: v,
        prompt: `price B`,
        sub: `A ${pa * 100}%. B is ${bGivenA * 100}% if A, ${bGivenNot * 100}% if not A. Price B in cents`,
        detail: [
          { label: 'A', value: `${pa * 100}%` },
          { label: 'B if A', value: `${bGivenA * 100}%` },
          { label: 'B if not A', value: `${bGivenNot * 100}%` },
        ],
        answer: cents(pb),
        tolerance: c.tolerance,
        tags: { variant: v, answer: Math.round(pb * 100) },
      }
    }
    case 'twoStep': {
      const p1 = pick(PCT) / 100
      const p2 = pick(PCT) / 100
      const n = pick([2, 3])
      const p = n === 2 ? p1 * p2 : p1 * p2 * p2
      return {
        kind: v,
        prompt: n === 2 ? 'qualify then win' : 'qualify then win twice',
        sub: `qualify ${p1 * 100}%, then each win ${p2 * 100}%. Price the whole thing in cents`,
        detail: [
          { label: 'Qualify', value: `${p1 * 100}%` },
          { label: 'Each win', value: `${p2 * 100}%` },
          { label: 'Wins needed', value: String(n - 1) },
        ],
        answer: cents(p),
        tolerance: c.tolerance,
        tags: { variant: v, answer: Math.round(p * 100), tiny: p < 0.05 },
      }
    }
  }
}

function Settings({ cfg, setCfg }: { cfg: EventConfig; setCfg: (f: (c: EventConfig) => EventConfig) => void }) {
  return (
    <>
      <Setting title="Clock">
        <Seg options={[120, 180, 300] as const} value={cfg.durationSec} onChange={(d) => setCfg((c) => ({ ...c, durationSec: d }))} label="Duration" format={durationLabel} />
      </Setting>
      <Setting title="Accepted error" note="In cents. The right price is rounded to the nearest cent.">
        <Seg options={[0, 1, 2] as const} value={cfg.tolerance} onChange={(t) => setCfg((c) => ({ ...c, tolerance: t }))} label="Tolerance" format={(t) => (t === 0 ? 'Exact' : `Within ${t}`)} />
      </Setting>
      <Setting title="Variants">
        <Chips options={ALL_VARIANTS} value={cfg.variants} onToggle={(v) => setCfg((c) => ({ ...c, variants: toggleIn(c.variants, v) }))} labels={VARIANT_LABEL} />
      </Setting>
    </>
  )
}

export const eventContractsSpec: TypedSpec<EventConfig> = {
  id: 'event-contracts',
  title: 'Event contracts',
  blurb: 'Price a YES contract in cents from a base rate and a piece of evidence. Type the price and press Enter.',
  mode: 'typed',
  submitOnEnter: true,
  defaults: { durationSec: 180, variants: [...ALL_VARIANTS], tolerance: 1 },
  configKey: (c) => `ev:${c.durationSec}:t${c.tolerance}:${ALL_VARIANTS.filter((v) => c.variants.includes(v)).join(',')}`,
  describe: (c) => `${durationLabel(c.durationSec)}, ${c.tolerance === 0 ? 'exact' : `within ${c.tolerance}c`}${c.variants.length === ALL_VARIANTS.length ? '' : `, ${c.variants.length} variants`}`,
  duration: (c) => c.durationSec,
  next,
  Settings,
  inputPattern: /[^\d.]/g,
  hint: 'Enter to submit, Esc to stop',
  breakdowns: [
    { title: 'By variant', key: (e) => VARIANT_LABEL[(e.tags?.variant as EVariant) ?? 'bayes'] ?? null, order: ALL_VARIANTS.map((v) => VARIANT_LABEL[v]) },
    {
      title: 'By price level',
      key: (e) => {
        const a = Number(e.tags?.answer ?? 50)
        return a < 10 ? 'Under 10c' : a < 40 ? '10c to 40c' : a < 70 ? '40c to 70c' : '70c and up'
      },
      order: ['Under 10c', '10c to 40c', '40c to 70c', '70c and up'],
    },
  ],
  colour: (e) => (['bayes', 'ratio'].includes(String(e.tags?.variant)) ? 'var(--yellow)' : 'var(--blue-2)'),
}
