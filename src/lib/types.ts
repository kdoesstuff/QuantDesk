// Shared domain types. Every drill and game in the site logs into these shapes
// so the dashboard and the insights engine can read everything uniformly.

export type DrillId =
  | 'speed-arithmetic'
  | 'eighty-in-eight'
  | 'sequences'
  | 'fractions'
  | 'percentages'
  | 'dice-market'
  | 'cards-market'
  | 'make-a-market'
  | 'betting-board'
  | 'kelly'
  | 'etf-arb'
  | 'event-contracts'
  | 'fermi'
  | 'memory-grid'
  | 'task-switch'
  | 'intercept'
  | 'balloon'

export type Operation = 'add' | 'sub' | 'mul' | 'div'

export type TagValue = string | number | boolean

/**
 * One event inside an attempt: a problem answered, a market traded, a trial
 * completed. The raw stream the insights engine reads. Games add small facts
 * about the event in `tags` (operand sizes, pattern family, edge, bias) so the
 * analysis can slice performance by category without re-deriving everything.
 */
export interface EventLog {
  /** Generator family or scenario type. */
  kind?: string
  /** What was shown, as text, for the slips list. */
  prompt?: string
  /** The right answer. */
  answer?: number | string
  /** What was finally submitted / accepted. null when the clock ran out mid-problem. */
  given: number | string | null
  /** Milliseconds from shown to cleared. */
  ms: number
  /** Wrong submissions before the right one (0 = first try). */
  misses: number
  correct: boolean
  /** Game-specific facts for the featurizers. */
  tags?: Record<string, TagValue>
  /** Points earned by this event, for games where score is not a count. */
  points?: number
  // Speed arithmetic keeps its original fields so old logs stay readable.
  op?: Operation
  a?: number
  b?: number
}

/** Speed arithmetic's log shape, the original one. */
export type AnswerLog = EventLog & { op: Operation; a: number; b: number; answer: number; given: number | null }

export interface SpeedArithmeticConfig {
  durationSec: 30 | 60 | 120 | 300
  ops: Operation[]
  /** Addition operand range (subtraction is the inverse, so shares it). */
  addMin: number
  addMax: number
  /** Multiplication: left factor range × right factor range (division is the inverse). */
  mulLeftMin: number
  mulLeftMax: number
  mulRightMin: number
  mulRightMax: number
}

export interface Attempt<C = unknown> {
  id: string
  ts: number
  drill: DrillId
  /** Stable key derived from config so personal bests group correctly. */
  configKey: string
  config: C
  score: number
  correct: number
  wrong: number
  durationSec: number
  answers: EventLog[]
  /** Game-specific summary numbers (P&L, switch cost, calibration), for the dashboard. */
  meta?: Record<string, number | string>
  /** Set when the run was played inside a focus block. */
  focus?: string
}
