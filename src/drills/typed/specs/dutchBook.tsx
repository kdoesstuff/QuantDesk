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
  how: string
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
  const kinds: Kind[] =
    level === 1 ? ['andCap', 'complement', 'orFloor', 'none'] : ['andCap', 'andFloor', 'orIdentity', 'complement', 'orFloor', 'none']
  const kind = pick(kinds)
  const AB = `${A} and ${B}`
  const AorB = `${A} or ${B}`
  const notAl = `Not: ${A}`
  const rows: { label: string; price: number }[] = []
  let answer = ''
  let wrong: string[] = []
  let how = ''

  switch (kind) {
    case 'andCap': {
      // "A and B" priced above the cheaper of A and B.
      const minLabel = a <= b ? A : B
      const minP = Math.min(a, b)
      const bad = Math.min(99, minP + gap)
      rows.push({ label: A, price: a }, { label: B, price: b }, { label: AB, price: bad })
      answer = `Sell "${AB}", buy "${minLabel}"`
      wrong = [`Buy "${AB}", sell "${minLabel}"`, `Sell "${A}", sell "${B}"`, 'No arbitrage']
      how = `"Both" can never be more likely than either leg, so "${AB}" must cost at most the cheaper leg, ${minP}c. It costs ${bad}c. Sell it at ${bad}c and buy "${minLabel}" at ${minP}c: you collect ${bad - minP}c now, and whenever "${AB}" pays out, "${minLabel}" pays out too, so you can never lose.`
      break
    }
    case 'andFloor': {
      // "A and B" priced below A plus B minus 100, only possible when a + b > 100.
      if (a + b - 100 < gap + 1) return build(level)
      const bad = Math.max(1, a + b - 100 - gap)
      rows.push({ label: A, price: a }, { label: B, price: b }, { label: AB, price: bad })
      answer = `Buy "${AB}", sell "${A}", sell "${B}"`
      wrong = [`Sell "${AB}", buy "${A}", buy "${B}"`, `Buy "${AB}", buy "${A}"`, 'No arbitrage']
      how = `P(A and B) is at least P(A) + P(B) − 1, so "${AB}" must cost at least ${a} + ${b} − 100 = ${a + b - 100}c. It costs ${bad}c. Buy it at ${bad}c and sell both legs for ${a + b}c, collecting ${a + b - bad}c now. If both legs pay you owe 200c and receive 100c, net ${a + b - bad - 100}c; if one pays you owe 100c, net ${a + b - bad - 100}c; if neither pays you keep ${a + b - bad}c. Never below ${a + b - 100 - bad}c.`
      break
    }
    case 'orIdentity': {
      // "A or B" off the identity A + B minus "A and B".
      const high = chance(0.5)
      const bad = high ? Math.min(99, or + gap) : Math.max(1, or - gap)
      rows.push({ label: A, price: a }, { label: B, price: b }, { label: AB, price: and }, { label: AorB, price: bad })
      answer = high ? `Sell "${AorB}", buy "${A}", buy "${B}", sell "${AB}"` : `Buy "${AorB}", sell "${A}", sell "${B}", buy "${AB}"`
      wrong = [
        high ? `Buy "${AorB}", sell "${A}", sell "${B}", buy "${AB}"` : `Sell "${AorB}", buy "${A}", buy "${B}", sell "${AB}"`,
        `Sell "${AB}", buy "${AorB}"`,
        'No arbitrage',
      ]
      how = `P(A or B) = P(A) + P(B) − P(A and B) = ${a} + ${b} − ${and} = ${or}c exactly. "${AorB}" costs ${bad}c, ${high ? 'too much' : 'too little'}. ${high ? `Sell it at ${bad}c and buy the replica (buy A, buy B, sell "and") for ${or}c` : `Buy it at ${bad}c and sell the replica (sell A, sell B, buy "and") for ${or}c`}: the two sides pay out identically in every outcome, so the ${Math.abs(bad - or)}c difference is locked in.`
      break
    }
    case 'complement': {
      const high = chance(0.5)
      const bad = high ? Math.min(99, notA + gap) : Math.max(1, notA - gap)
      rows.push({ label: A, price: a }, { label: notAl, price: bad }, { label: B, price: b })
      answer = high ? `Sell "${A}", sell "${notAl}"` : `Buy "${A}", buy "${notAl}"`
      wrong = [high ? `Buy "${A}", buy "${notAl}"` : `Sell "${A}", sell "${notAl}"`, `Sell "${A}", buy "${B}"`, 'No arbitrage']
      how = `An event and its complement must add to 100c, because exactly one of them pays. Here ${a} + ${bad} = ${a + bad}c. ${high ? `Sell both for ${a + bad}c; exactly one pays 100c, so you keep ${a + bad - 100}c.` : `Buy both for ${a + bad}c; exactly one pays 100c, so you make ${100 - a - bad}c.`}`
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
      how = `"Either" is at least as likely as each leg, so "${AorB}" must cost at least the dearer leg, ${maxP}c. It costs ${bad}c. Buy it at ${bad}c and sell "${maxLabel}" at ${maxP}c: you collect ${maxP - bad}c now, and whenever "${maxLabel}" pays out, "${AorB}" pays out too.`
      break
    }
    case 'none': {
      // Keep "and" strictly inside its bounds so no trade is a zero-profit edge case.
      if (and === lo || and === hi) return build(level)
      const withOr = level >= 2 && chance(0.5)
      rows.push({ label: A, price: a }, { label: B, price: b }, { label: AB, price: and })
      if (withOr) rows.push({ label: AorB, price: or })
      answer = 'No arbitrage'
      how = `Check each rule: "and" (${and}c) sits between ${lo}c (= ${a} + ${b} − 100, floored at 0) and ${hi}c (the cheaper leg)${withOr ? `; "or" (${or}c) equals ${a} + ${b} − ${and}` : ''}. Every price is consistent with some probabilities, so no trade is free money.`
      wrong = [
        `Sell "${AB}", buy "${a <= b ? A : B}"`,
        `Buy "${AB}", sell "${A}", sell "${B}"`,
        withOr ? `Sell "${AorB}", buy "${A}", buy "${B}", sell "${AB}"` : `Sell "${A}", sell "${B}"`,
      ]
      break
    }
  }
  return { rows: shuffle(rows), kind, answer, wrong, how }
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
    how: b.how,
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
        <Seg
          options={[120, 180, 300] as const}
          value={cfg.durationSec}
          onChange={(d) => setCfg((c) => ({ ...c, durationSec: d }))}
          label="Duration"
          format={durationLabel}
        />
      </Setting>
      <Setting
        title="Level"
        note="Level 1 has big gaps and three contracts. Level 3 has gaps of a few cents and four contracts including the identity for or."
      >
        <Seg options={[1, 2, 3] as const} value={cfg.level} onChange={(l) => setCfg((c) => ({ ...c, level: l }))} label="Level" />
      </Setting>
      <Setting title="Wrong call">
        <Seg
          options={[0, 1] as const}
          value={cfg.penalty}
          onChange={(p) => setCfg((c) => ({ ...c, penalty: p }))}
          label="Penalty"
          format={(p) => (p === 0 ? 'No penalty' : 'Minus 1')}
        />
      </Setting>
    </>
  )
}

export const dutchBookSpec: TypedSpec<DutchConfig> = {
  id: 'dutch-book',
  title: 'Dutch book',
  blurb:
    'Related event contracts priced in cents. One price breaks the rules of probability, or none does. Name the trade that locks in a profit. Keys 1 to 4.',
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
  breakdowns: [
    { title: 'By what was wrong', key: (e) => KIND_LABEL[(e.tags?.kind as Kind) ?? 'none'] ?? null, order: Object.values(KIND_LABEL) },
  ],
  colour: (e) => (e.correct ? 'var(--blue-2)' : 'var(--wrong)'),
}
