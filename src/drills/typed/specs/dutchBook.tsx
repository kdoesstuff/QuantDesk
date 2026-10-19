import { chance, pick, rint, shuffle } from '../../../lib/random'
import { durationLabel } from '../../../lib/config'
import { Seg, Setting } from '../../shared/Frames'
import type { Item, TypedSpec } from '../spec'

/**
 * Dutch book. A board of related event contracts priced in cents. The
 * prices must obey the rules of probability: "A and B" cannot cost more
 * than A, "A or B" must equal A plus B minus "A and B", A plus "not A" must
 * be 100. One price on the board breaks a rule, or none does. Name the
 * trade that locks in a profit.
 */
export interface DutchConfig {
  durationSec: 120 | 180 | 300
  /** 1 wide gaps and three contracts, 3 narrow gaps and four. */
  level: 1 | 2 | 3
  penalty: 0 | 1
}

const PAIRS: [string, string][] = [
  ['Rain Monday', 'Rain Tuesday'],
  ['Gold up', 'Silver up'],
  ['House passes', 'Senate passes'],
  ['Cut in March', 'Cut in June'],
  ['A in final', 'B in final'],
  ['Coin 1 heads', 'Coin 2 heads'],
  ['Departs on time', 'Lands on time'],
  ['Earnings beat', 'Stock up'],
  ['Heat in July', 'Heat in August'],
  ['Wins Ohio', 'Wins Florida'],
]

type Kind = 'andCap' | 'andFloor' | 'orIdentity' | 'complement' | 'orFloor' | 'none'

interface Board {
  rows: { label: string; price: number }[]
  kind: Kind
  answer: string
  wrong: string[]
}

const c = (x: number) => `${x}c`

function build(level: number): Board {
  const [A, B] = pick(PAIRS)
  const a = rint(4, 16) * 5
  const b = rint(4, 16) * 5
  const lo = Math.max(0, a + b - 100)
  const hi = Math.min(a, b)
  const and = lo + rint(0, Math.max(0, Math.floor((hi - lo) / 5))) * 5
  const or = a + b - and
  const notA = 100 - a
  const gap = level === 1 ? rint(10, 20) : level === 2 ? rint(6, 12) : rint(3, 8)
  const kinds: Kind[] = level === 1 ? ['andCap', 'complement', 'orFloor', 'none'] : ['andCap', 'andFloor', 'orIdentity', 'complement', 'orFloor', 'none']
  const kind = pick(kinds)
  const AB = `${A} and ${B}`
  const AorB = `${A} or ${B}`
  const notAl = `Not: ${A}`
  const rows: { label: string; price: number }[] = []
  let answer = ''
  let wrong: string[] = []

  switch (kind) {
    case 'andCap': {
      // "A and B" priced above the cheaper of A and B.
      const minLabel = a <= b ? A : B
      const minP = Math.min(a, b)
      const bad = Math.min(99, minP + gap)
      rows.push({ label: A, price: a }, { label: B, price: b }, { label: AB, price: bad })
      answer = `Sell "${AB}", buy "${minLabel}"`
      wrong = [`Buy "${AB}", sell "${minLabel}"`, `Sell "${A}", sell "${B}"`, 'No arbitrage']
      break
    }
    case 'andFloor': {
      // "A and B" priced below A plus B minus 100, only possible when a + b > 100.
      if (a + b - 100 < gap + 1) return build(level)
      const bad = Math.max(1, a + b - 100 - gap)
      rows.push({ label: A, price: a }, { label: B, price: b }, { label: AB, price: bad })
      answer = `Buy "${AB}", sell "${A}", sell "${B}"`
      wrong = [`Sell "${AB}", buy "${A}", buy "${B}"`, `Buy "${AB}", buy "${A}"`, 'No arbitrage']
      break
    }
    case 'orIdentity': {
      // "A or B" off the identity A + B minus "A and B".
      const high = chance(0.5)
      const bad = high ? Math.min(99, or + gap) : Math.max(1, or - gap)
      rows.push({ label: A, price: a }, { label: B, price: b }, { label: AB, price: and }, { label: AorB, price: bad })
      answer = high ? `Sell "${AorB}", buy "${A}", buy "${B}", sell "${AB}"` : `Buy "${AorB}", sell "${A}", sell "${B}", buy "${AB}"`
      wrong = [high ? `Buy "${AorB}", sell "${A}", sell "${B}", buy "${AB}"` : `Sell "${AorB}", buy "${A}", buy "${B}", sell "${AB}"`, `Sell "${AB}", buy "${AorB}"`, 'No arbitrage']
      break
    }
    case 'complement': {
      const high = chance(0.5)
      const bad = high ? Math.min(99, notA + gap) : Math.max(1, notA - gap)
      rows.push({ label: A, price: a }, { label: notAl, price: bad }, { label: B, price: b })
      answer = high ? `Sell "${A}", sell "${notAl}"` : `Buy "${A}", buy "${notAl}"`
      wrong = [high ? `Buy "${A}", buy "${notAl}"` : `Sell "${A}", sell "${notAl}"`, `Sell "${A}", buy "${B}"`, 'No arbitrage']
      break
    }
    case 'orFloor': {
      // "A or B" priced below the dearer of A and B.
      const maxLabel = a >= b ? A : B
      const maxP = Math.max(a, b)
      if (maxP - gap < 1) return build(level)
      const bad = maxP - gap
      rows.push({ label: A, price: a }, { label: B, price: b }, { label: AorB, price: bad })
      answer = `Buy "${AorB}", sell "${maxLabel}"`
      wrong = [`Sell "${AorB}", buy "${maxLabel}"`, `Buy "${A}", buy "${B}"`, 'No arbitrage']
      break
    }
    case 'none': {
      // Keep "and" strictly inside its bounds so no trade is a zero-profit edge case.
      if (and === lo || and === hi) return build(level)
      const withOr = level >= 2 && chance(0.5)
      rows.push({ label: A, price: a }, { label: B, price: b }, { label: AB, price: and })
      if (withOr) rows.push({ label: AorB, price: or })
      answer = 'No arbitrage'
      wrong = [`Sell "${AB}", buy "${a <= b ? A : B}"`, `Buy "${AB}", sell "${A}", sell "${B}"`, withOr ? `Sell "${AorB}", buy "${A}", buy "${B}", sell "${AB}"` : `Sell "${A}", sell "${B}"`]
      break
    }
  }
  return { rows: shuffle(rows), kind, answer, wrong }
}

function next(c_: DutchConfig): Item {
  const b = build(c_.level)
  const options = shuffle([b.answer, ...b.wrong])
  return {
    kind: b.kind,
    prompt: 'Which trade is free money?',
    sub: 'prices in cents for a contract paying 100',
    answer: b.answer,
    options,
    correctIndex: options.indexOf(b.answer),
    detail: b.rows.map((r) => ({ label: r.label, value: c(r.price) })),
    tags: { kind: b.kind, level: c_.level, contracts: b.rows.length, none: b.kind === 'none' },
  }
}

const KIND_LABEL: Record<Kind, string> = {
  andCap: '"And" above a leg',
  andFloor: '"And" below the floor',
  orIdentity: '"Or" off the identity',
  complement: 'Complements not 100',
  orFloor: '"Or" below a leg',
  none: 'Consistent board',
}

function Settings({ cfg, setCfg }: { cfg: DutchConfig; setCfg: (f: (c: DutchConfig) => DutchConfig) => void }) {
  return (
    <>
      <Setting title="Clock">
        <Seg options={[120, 180, 300] as const} value={cfg.durationSec} onChange={(d) => setCfg((c) => ({ ...c, durationSec: d }))} label="Duration" format={durationLabel} />
      </Setting>
      <Setting title="Level" note="Level 1 has big gaps and three contracts. Level 3 has gaps of a few cents and four contracts including the identity for or.">
        <Seg options={[1, 2, 3] as const} value={cfg.level} onChange={(l) => setCfg((c) => ({ ...c, level: l }))} label="Level" />
      </Setting>
      <Setting title="Wrong call">
        <Seg options={[0, 1] as const} value={cfg.penalty} onChange={(p) => setCfg((c) => ({ ...c, penalty: p }))} label="Penalty" format={(p) => (p === 0 ? 'No penalty' : 'Minus 1')} />
      </Setting>
    </>
  )
}

export const dutchBookSpec: TypedSpec<DutchConfig> = {
  id: 'dutch-book',
  title: 'Dutch book',
  blurb: 'Related event contracts priced in cents. One price breaks the rules of probability, or none does. Name the trade that locks in a profit. Keys 1 to 4.',
  mode: 'choice',
  defaults: { durationSec: 180, level: 1, penalty: 1 },
  configKey: (c) => `db:${c.durationSec}:L${c.level}:p${c.penalty}`,
  describe: (c) => `${durationLabel(c.durationSec)}, level ${c.level}${c.penalty ? ', minus 1' : ''}`,
  duration: (c) => c.durationSec,
  next,
  Settings,
  points: (c) => ({ right: 1, wrong: -c.penalty }),
  unit: ' pts',
  hint: 'Keys 1 to 4, Enter to skip, Esc to stop',
  breakdowns: [{ title: 'By what was wrong', key: (e) => KIND_LABEL[(e.tags?.kind as Kind) ?? 'none'] ?? null, order: Object.values(KIND_LABEL) }],
  colour: (e) => (e.correct ? 'var(--blue-2)' : 'var(--wrong)'),
}
