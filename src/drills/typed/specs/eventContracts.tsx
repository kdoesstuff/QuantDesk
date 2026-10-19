import { chance, pick } from '../../../lib/random'
import { durationLabel } from '../../../lib/config'
import { Chips, Seg, Setting, toggleIn } from '../../shared/Frames'
import type { Item, TypedSpec } from '../spec'

/**
 * Event contracts: price a YES contract in cents. A base rate and a piece
 * of evidence go in, a posterior comes out. Submit with Enter; a cent
 * either way is accepted.
 */
export type EVariant = 'bayes' | 'ratio' | 'both' | 'either' | 'conditional' | 'twoStep' | 'coinBag' | 'doors' | 'children' | 'oneSix'
export const VARIANT_LABEL: Record<EVariant, string> = {
  bayes: 'Test result',
  ratio: 'Likelihood ratio',
  both: 'Both happen',
  either: 'At least one',
  conditional: 'Condition on a cause',
  twoStep: 'Two-stage event',
  coinBag: 'Coin from a bag',
  doors: 'Doors and a host',
  children: 'At least one is',
  oneSix: 'Told one die shows',
}
export const ALL_VARIANTS: EVariant[] = [
  'bayes',
  'ratio',
  'both',
  'either',
  'conditional',
  'twoStep',
  'coinBag',
  'doors',
  'children',
  'oneSix',
]

const pc = (x: number) => `${Math.round(x * 10000) / 100}%`
const r3 = (x: number) => String(Math.round(x * 1000) / 1000)
const r4 = (x: number) => String(Math.round(x * 10000) / 10000)

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
      const post = positive
        ? (prior * sens) / (prior * sens + (1 - prior) * fpr)
        : (prior * (1 - sens)) / (prior * (1 - sens) + (1 - prior) * (1 - fpr))
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
        how: positive
          ? `Imagine 1,000 people. True cases: ${prior * 1000}, of which ${r3(prior * sens * 1000)} test positive. Not cases: ${(1 - prior) * 1000}, of which ${r3((1 - prior) * fpr * 1000)} test positive by mistake. YES given positive = ${r3(prior * sens * 1000)} ÷ (${r3(prior * sens * 1000)} + ${r3((1 - prior) * fpr * 1000)}) = ${pc(post)}, so ${cents(post)}c.`
          : `Imagine 1,000 people. True cases: ${prior * 1000}, of which ${r3(prior * (1 - sens) * 1000)} test negative (missed). Not cases: ${(1 - prior) * 1000}, of which ${r3((1 - prior) * (1 - fpr) * 1000)} test negative. YES given negative = ${r3(prior * (1 - sens) * 1000)} ÷ (${r3(prior * (1 - sens) * 1000)} + ${r3((1 - prior) * (1 - fpr) * 1000)}) = ${pc(post)}, so ${cents(post)}c.`,
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
        how: `Work in odds. Prior odds ${prior * 100}:${100 - prior * 100} = ${r4(prior / (1 - prior))}. Multiply by the likelihood ratio ${lr}: posterior odds ${r4(odds)}. Back to a probability: ${r4(odds)} ÷ (1 + ${r4(odds)}) = ${pc(post)}, so ${cents(post)}c.`,
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
        how: `Independent events multiply: ${a * 100}% × ${b * 100}% = ${pc(a * b)}, so ${cents(a * b)}c.`,
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
        how: `Go through the complement: neither happens with probability ${(1 - a) * 100}% × ${(1 - b) * 100}% = ${pc((1 - a) * (1 - b))}. At least one is 1 minus that: ${pc(1 - (1 - a) * (1 - b))}, so ${cents(1 - (1 - a) * (1 - b))}c. Adding ${a * 100}% + ${b * 100}% double counts the case where both happen.`,
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
        how: `Total probability, weighted by the cause: ${pa * 100}% × ${bGivenA * 100}% + ${(1 - pa) * 100}% × ${bGivenNot * 100}% = ${pc(pa * bGivenA)} + ${pc((1 - pa) * bGivenNot)} = ${pc(pb)}, so ${cents(pb)}c.`,
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
        how: `Every stage must happen, so multiply along the chain: ${p1 * 100}%${n === 2 ? ` × ${p2 * 100}%` : ` × ${p2 * 100}% × ${p2 * 100}%`} = ${pc(p)}, so ${cents(p)}c.`,
        tags: { variant: v, answer: Math.round(p * 100), tiny: p < 0.05 },
      }
    }
    case 'coinBag': {
      // One two-headed coin among fair ones; k heads in a row; price "it is the two-headed coin".
      const fair = pick([1, 3, 7, 9, 15, 31, 63, 99, 127, 255, 999])
      const k = pick([1, 2, 3, 4, 5, 6, 8, 10])
      const likeFair = fair / 2 ** k
      const post = 1 / (1 + likeFair)
      return {
        kind: v,
        prompt: `${k} heads in a row`,
        sub: `a bag holds ${fair} fair ${fair === 1 ? 'coin' : 'coins'} and 1 two-headed coin. One is drawn and flipped ${k} ${k === 1 ? 'time' : 'times'}, all heads. Price "it is the two-headed coin" in cents`,
        detail: [
          { label: 'Fair coins', value: String(fair) },
          { label: 'Two-headed', value: '1' },
          { label: 'Heads in a row', value: String(k) },
        ],
        answer: cents(post),
        tolerance: c.tolerance,
        how: `Compare the two stories. Two-headed coin: 1 way, and ${k} heads are certain. Fair coin: ${fair} ${fair === 1 ? 'way' : 'ways'}, each gives ${k} heads with chance 1/${2 ** k}, so ${fair}/${2 ** k} = ${r4(likeFair)} in total. Posterior = 1 ÷ (1 + ${r4(likeFair)}) = ${pc(post)}, so ${cents(post)}c.`,
        tags: { variant: v, answer: Math.round(post * 100), fair, k },
      }
    }
    case 'doors': {
      // n doors, one prize; you pick one; the host, who knows, opens one empty door; price "switching wins".
      const n = pick([3, 3, 4, 5, 10])
      const stay = 1 / n
      const sw = (n - 1) / (n * (n - 2))
      const ask = n === 3 ? pick(['switch', 'stay']) : pick(['switch', 'switch', 'stay'])
      const p = ask === 'switch' ? sw : stay
      return {
        kind: v,
        prompt: `${n} doors, host opens one`,
        sub: `one door hides the prize. You pick one, the host (who knows) opens a different empty door. Price "${ask === 'switch' ? 'switching to one of the other closed doors wins' : 'staying wins'}" in cents`,
        detail: [
          { label: 'Doors', value: String(n) },
          { label: 'Host opens', value: '1 empty door' },
          { label: 'Price', value: ask === 'switch' ? 'switch wins' : 'stay wins' },
        ],
        answer: cents(p),
        tolerance: c.tolerance,
        how: `Your first pick is right with probability 1/${n} = ${pc(stay)}, and the host opening an empty door never changes that. So staying wins ${pc(stay)}. The other ${n - 1} doors share the rest, ${pc(1 - stay)}, and after one is opened it is split across ${n - 2} closed ${n - 2 === 1 ? 'door' : 'doors'}: switching to one of them wins ${pc(1 - stay)} ÷ ${n - 2} = ${pc(sw)}. Answer ${cents(p)}c.`,
        tags: { variant: v, answer: Math.round(p * 100), n, ask },
      }
    }
    case 'children': {
      // Two children; told at least one is a boy (1/3), or the older is a boy (1/2), or a boy born on a given weekday (13/27).
      const kind = pick(['atLeast', 'older', 'weekday'])
      const p = kind === 'atLeast' ? 1 / 3 : kind === 'older' ? 1 / 2 : 13 / 27
      const sub =
        kind === 'atLeast'
          ? 'a family has two children, equally likely boy or girl, independent. You learn at least one is a boy. Price "both are boys" in cents'
          : kind === 'older'
            ? 'a family has two children, equally likely boy or girl, independent. You learn the older one is a boy. Price "both are boys" in cents'
            : 'a family has two children. You learn at least one is a boy born on a Tuesday (each child boy or girl, each weekday equally likely). Price "both are boys" in cents'
      return {
        kind: v,
        prompt: kind === 'atLeast' ? 'at least one boy' : kind === 'older' ? 'the older is a boy' : 'a boy born on a Tuesday',
        sub,
        answer: cents(p),
        tolerance: c.tolerance,
        how:
          kind === 'atLeast'
            ? 'Four equally likely families: BB, BG, GB, GG. "At least one boy" rules out only GG, leaving three, and BB is one of them: 1/3, so 33c.'
            : kind === 'older'
              ? 'Knowing the older is a boy leaves BB and BG, equally likely. BB is one of two: 1/2, so 50c. The information points at a specific child, which is why this differs from "at least one".'
              : 'Count families with at least one Tuesday boy: each child is a Tuesday boy with chance 1/14. Families with at least one: 1 − (13/14)² = 27/196. Of those, both boys with at least one Tuesday boy: 1 − (13/14)² restricted to boys = (1/4) × (1 − (6/7)²) = 13/196. Ratio 13/27 = 48.1%, so 48c. The weekday detail makes the information closer to pointing at one child.',
        tags: { variant: v, answer: Math.round(p * 100), kind },
      }
    }
    case 'oneSix': {
      // Two dice; told at least one shows k; price "both show k" (1/11), or "sum is s".
      const face = pick([1, 2, 3, 4, 5, 6])
      const kind = pick(['both', 'both', 'sum'])
      if (kind === 'both') {
        const p = 1 / 11
        return {
          kind: v,
          prompt: `at least one ${face}`,
          sub: `two fair dice are rolled and you are told at least one shows a ${face}. Price "both show ${face}" in cents`,
          answer: cents(p),
          tolerance: c.tolerance,
          how: `Of the 36 rolls, those with at least one ${face}: 6 where the first die is ${face}, plus 6 where the second is, minus the double count (${face}, ${face}): 11. Exactly one of those 11 is the double: 1/11 = 9.1%, so 9c. "At least one" is not "a particular die".`,
          tags: { variant: v, answer: Math.round(p * 100), kind },
        }
      }
      const target = pick([7, 8, 9, 10, 11].filter((t) => t - face >= 1 && t - face <= 6))
      const other = target - face
      const ways = other === face ? 1 : 2
      const p = ways / 11
      return {
        kind: v,
        prompt: `at least one ${face}, sum ${target}?`,
        sub: `two fair dice, you are told at least one shows a ${face}. Price "the sum is ${target}" in cents`,
        answer: cents(p),
        tolerance: c.tolerance,
        how: `11 rolls have at least one ${face}. The sum is ${target} when the other die shows ${other}: ${ways === 2 ? `(${face}, ${other}) and (${other}, ${face}), 2 of the 11` : `only (${face}, ${face}), 1 of the 11`}. ${ways}/11 = ${pc(p)}, so ${cents(p)}c.`,
        tags: { variant: v, answer: Math.round(p * 100), kind },
      }
    }
  }
}

function Settings({ cfg, setCfg }: { cfg: EventConfig; setCfg: (f: (c: EventConfig) => EventConfig) => void }) {
  return (
    <>
      <Setting title="Clock">
        <Seg
          options={[120, 180, 300] as const}
          value={cfg.durationSec}
          onChange={(d) => setCfg((c) => ({ ...c, durationSec: d }))}
          label="Duration"
          format={durationLabel}
        />
      </Setting>
      <Setting title="Accepted error" note="In cents. The right price is rounded to the nearest cent.">
        <Seg
          options={[0, 1, 2] as const}
          value={cfg.tolerance}
          onChange={(t) => setCfg((c) => ({ ...c, tolerance: t }))}
          label="Tolerance"
          format={(t) => (t === 0 ? 'Exact' : `Within ${t}`)}
        />
      </Setting>
      <Setting title="Variants">
        <Chips
          options={ALL_VARIANTS}
          value={cfg.variants}
          onToggle={(v) => setCfg((c) => ({ ...c, variants: toggleIn(c.variants, v) }))}
          labels={VARIANT_LABEL}
        />
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
  describe: (c) =>
    `${durationLabel(c.durationSec)}, ${c.tolerance === 0 ? 'exact' : `within ${c.tolerance}c`}${c.variants.length === ALL_VARIANTS.length ? '' : `, ${c.variants.length} variants`}`,
  duration: (c) => c.durationSec,
  next,
  Settings,
  inputPattern: /[^\d.]/g,
  hint: 'Enter to submit, Esc to stop',
  breakdowns: [
    {
      title: 'By variant',
      key: (e) => VARIANT_LABEL[(e.tags?.variant as EVariant) ?? 'bayes'] ?? null,
      order: ALL_VARIANTS.map((v) => VARIANT_LABEL[v]),
    },
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
