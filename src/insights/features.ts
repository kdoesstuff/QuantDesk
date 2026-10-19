import type { Attempt, DrillId, EventLog, Operation } from '../lib/types'

/**
 * Featurizers turn a drill's raw logs into rows the analyzer can slice.
 * Every row carries a set of dimensions (human-readable name and value),
 * the time taken, whether it was right, and where in the run it fell.
 * Games already tag most of this at log time; the arithmetic drill is
 * featurized here from its operands so older logs work too.
 */
export interface Row {
  dims: Record<string, string>
  ms: number
  correct: number // 1 or 0
  /** Position in the run, 0 to 1. */
  pos: number
  ts: number
  attemptId: string
  configKey: string
  points?: number
}

const OP_NAME: Record<Operation, string> = { add: 'Addition', sub: 'Subtraction', mul: 'Multiplication', div: 'Division' }

function digits(n: number) {
  return String(Math.abs(Math.round(n))).length
}

function arithmeticDims(l: EventLog): Record<string, string> {
  const op = l.op as Operation
  const a = l.a ?? 0
  const b = l.b ?? 0
  const d: Record<string, string> = { Operation: OP_NAME[op] ?? String(op) }
  if (op === 'add') {
    const carry = (a % 10) + (b % 10) >= 10 || (Math.floor(a / 10) % 10) + (Math.floor(b / 10) % 10) >= 10
    d['Carry'] = carry ? 'With a carry' : 'No carry'
    d['Operand size'] = `${Math.max(digits(a), digits(b))}-digit addends`
  } else if (op === 'sub') {
    // a - b: borrow if a's ones digit < b's ones digit, or tens
    const borrow = a % 10 < b % 10 || Math.floor(a / 10) % 10 < Math.floor(b / 10) % 10
    d['Borrow'] = borrow ? 'With a borrow' : 'No borrow'
    d['Operand size'] = `${digits(a)}-digit minuend`
  } else if (op === 'mul') {
    const small = Math.min(a, b)
    const large = Math.max(a, b)
    d['Times table'] = small <= 12 ? `${small} times` : 'Over 12'
    d['Large factor'] = `${digits(large)}-digit factor`
  } else if (op === 'div') {
    d['Divisor'] = b <= 12 ? `Divide by ${b}` : 'Divisor over 12'
    d['Quotient size'] = `${digits(l.answer as number)}-digit quotient`
  }
  d['Answer size'] = `${digits(Number(l.answer ?? 0))}-digit answer`
  return d
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
const t = (l: EventLog, k: string) => (l.tags && l.tags[k] !== undefined ? String(l.tags[k]) : undefined)

/** Dimensions per drill, from tags. Keep names short: they become headings. */
const TAG_DIMS: Partial<Record<DrillId, (l: EventLog) => Record<string, string>>> = {
  'speed-arithmetic': arithmeticDims,
  'eighty-in-eight': (l) => ({
    'Question type': cap(String(t(l, 'family') ?? '')),
    'Answer shape': l.tags?.decimal ? 'Decimal answer' : l.tags?.negative ? 'Negative answer' : 'Whole answer',
  }),
  sequences: (l) => ({
    Family: cap(String(t(l, 'family') ?? '')),
    'Answer size': Number(t(l, 'digits') ?? 0) <= 2 ? 'Up to 2 digits' : Number(t(l, 'digits')) === 3 ? '3 digits' : '4 or more digits',
    Level: `Level ${t(l, 'level') ?? '?'}`,
  }),
  fractions: (l) => ({
    Mode: cap(String(t(l, 'mode') ?? '')),
    Denominator: `/${t(l, 'denominator') ?? '?'}`,
    'Leading zeros': Number(t(l, 'leadingZeros') ?? 0) > 0 ? 'Starts with 0.0' : 'No leading zero',
  }),
  percentages: (l) => ({
    Type: cap(String(t(l, 'type') ?? '')),
    'Answer shape': l.tags?.negative ? 'Negative' : Number(t(l, 'decimals') ?? 0) > 0 ? 'With decimals' : 'Whole number',
  }),
  'dice-market': (l) => ({
    Mode: t(l, 'play') === 'take' ? 'Take' : 'Make',
    'Market lean': t(l, 'market') === 'cheap' ? 'Offered below fair' : t(l, 'market') === 'rich' ? 'Bid above fair' : t(l, 'market') === 'fair' ? 'Around fair' : 'Make mode',
    'Your mid': t(l, 'skewSign') === 'high' ? 'Mid above fair' : t(l, 'skewSign') === 'low' ? 'Mid below fair' : t(l, 'skewSign') === 'centred' ? 'Mid on fair' : 'Take mode',
    Hidden: `${t(l, 'hidden') ?? '?'} hidden`,
  }),
  'cards-market': (l) => ({
    Mode: t(l, 'play') === 'take' ? 'Take' : 'Make',
    'Market lean': t(l, 'market') === 'cheap' ? 'Offered below fair' : t(l, 'market') === 'rich' ? 'Bid above fair' : t(l, 'market') === 'fair' ? 'Around fair' : 'Make mode',
    'Your mid': t(l, 'skewSign') === 'high' ? 'Mid above fair' : t(l, 'skewSign') === 'low' ? 'Mid below fair' : t(l, 'skewSign') === 'centred' ? 'Mid on fair' : 'Take mode',
    Hidden: `${t(l, 'hidden') ?? '?'} hidden`,
  }),
  'make-a-market': (l) => ({
    Topic: cap(String(t(l, 'category') ?? '')),
    Width: t(l, 'tightness') === 'tight' ? 'Tight quote' : t(l, 'tightness') === 'medium' ? 'Medium quote' : 'Wide quote',
    Lean: t(l, 'lean') === 'high' ? 'Quoted high' : t(l, 'lean') === 'low' ? 'Quoted low' : 'Centred',
  }),
  'betting-board': (l) => ({
    Outcome: l.correct ? 'All right' : Number(t(l, 'missed') ?? 0) > 0 && Number(t(l, 'bad') ?? 0) > 0 ? 'Missed and bad' : Number(t(l, 'missed') ?? 0) > 0 ? 'Missed an edge' : 'Took a bad bet',
  }),
  kelly: (l) => ({
    Variant: cap(String(t(l, 'variant') ?? '')),
    'Stake size': cap(String(t(l, 'size') ?? '')),
  }),
  'etf-arb': (l) => ({
    'Right call': String(t(l, 'direction') ?? ''),
    Gap: Number(t(l, 'gapPct') ?? 0) === 0 ? 'No gap' : Number(t(l, 'gapPct')) < 1 ? 'Gap under 1%' : 'Gap 1% and up',
    Names: `${t(l, 'names') ?? '?'} names`,
  }),
  'event-contracts': (l) => ({
    Variant: cap(String(t(l, 'variant') ?? '')),
    'Price level': Number(t(l, 'answer') ?? 50) < 10 ? 'Under 10c' : Number(t(l, 'answer')) < 40 ? '10c to 40c' : Number(t(l, 'answer')) < 70 ? '40c to 70c' : '70c and up',
  }),
  fermi: (l) => ({
    Topic: cap(String(t(l, 'topic') ?? '')),
    Lean: t(l, 'lean') === 'high' ? 'Guessed high' : t(l, 'lean') === 'low' ? 'Guessed low' : 'Close',
  }),
  'memory-grid': (l) => ({
    'Pattern size': Number(t(l, 'cells') ?? 0) <= 5 ? '3 to 5 cells' : Number(t(l, 'cells')) <= 8 ? '6 to 8 cells' : '9 and up',
  }),
  'task-switch': (l) => ({
    'Trial type': t(l, 'kind') === 'switch' ? 'Switch' : 'Repeat',
    Rule: t(l, 'task') === 'parity' ? 'Odd or even' : 'Under or over 5',
    Congruence: l.tags?.congruent ? 'Rules agree' : 'Rules disagree',
  }),
  intercept: (l) => ({
    Direction: t(l, 'direction') === 'rightward' ? 'Left to right' : 'Right to left',
    Speed: `${cap(String(t(l, 'speed') ?? 'medium'))} target`,
    Timing: l.tags?.noShot ? 'No shot' : t(l, 'lean') === 'early' ? 'Fired early' : t(l, 'lean') === 'late' ? 'Fired late' : 'On time',
  }),
  balloon: (l) => ({
    Colour: cap(String(t(l, 'colour') ?? '')),
    'After a pop': l.tags?.afterPop ? 'Right after a pop' : 'Otherwise',
  }),
}

/** Which dimensions describe the stimulus (slice-able causes) versus the outcome. Outcome dims are not offered as weak zones. */
export const OUTCOME_DIMS = new Set(['Your mid', 'Lean', 'Width', 'Outcome', 'Timing', 'After a pop', 'Trial type'])

/** Should this row count as answered for time statistics. */
function answered(l: EventLog) {
  return l.given !== null && l.given !== 'skip' && l.ms > 0
}

export function featurize(drill: DrillId, attempts: Attempt[]): Row[] {
  const f = TAG_DIMS[drill]
  if (!f) return []
  const rows: Row[] = []
  for (const a of attempts) {
    const n = a.answers.length
    a.answers.forEach((l, i) => {
      if (!answered(l)) return
      const dims = f(l)
      // Position in run is a dimension too.
      dims['Part of run'] = i < n / 3 ? 'First third' : i < (2 * n) / 3 ? 'Middle third' : 'Last third'
      rows.push({ dims, ms: l.ms, correct: l.correct && l.misses === 0 ? 1 : 0, pos: n > 1 ? i / (n - 1) : 0, ts: a.ts, attemptId: a.id, configKey: a.configKey, points: l.points })
    })
  }
  return rows
}

/** Time is meaningful for most drills; for a few the score is the thing. */
export const TIME_MATTERS: Partial<Record<DrillId, boolean>> = {
  'make-a-market': false,
  'betting-board': false,
  fermi: false,
  'memory-grid': false,
  intercept: false,
  balloon: false,
}
