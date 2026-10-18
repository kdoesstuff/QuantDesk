// Shared domain types. Every drill and game in the site logs into these shapes
// so the dashboard and (later) the adaptive engine can read everything uniformly.

export type DrillId = 'speed-arithmetic'

export type Operation = 'add' | 'sub' | 'mul' | 'div'

/** One answered (or skipped) problem inside an attempt. The raw event stream. */
export interface AnswerLog {
  op: Operation
  a: number
  b: number
  answer: number
  /** What was finally submitted / accepted. null when the clock ran out mid-problem. */
  given: number | null
  /** Milliseconds from problem shown to problem cleared. */
  ms: number
  /** Number of wrong submissions before the right one (0 = first try). */
  misses: number
  correct: boolean
}

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
  answers: AnswerLog[]
}
