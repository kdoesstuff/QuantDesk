import type { FC } from 'react'
import type { Attempt, TagValue } from '../../lib/types'
import type { BaseSpec } from '../shared/ConfigPage'
import type { Breakdown } from '../typed/spec'

/** One situation to decide on. */
export interface Scenario {
  kind: string
  /** One line for the rounds list on the result page. */
  prompt: string
  tags: Record<string, TagValue>
}

/** What a decision came to. */
export interface Outcome {
  points: number
  correct: boolean
  /** What the player did, in words. */
  given: string
  /** What was right, in words. */
  answer: string
  /** One line of feedback shown between rounds. */
  note: string
  /** The approach in full, for the review of rounds that went wrong. */
  how?: string
  /** Extra facts for the analysis. */
  tags?: Record<string, TagValue>
}

/**
 * A game played in rounds: a scenario is shown, the player decides, the
 * decision is resolved against the truth, the next round starts. Markets,
 * boards and estimates all fit this shape.
 */
export interface RoundsSpec<C extends object, S extends Scenario, D> extends BaseSpec<C> {
  rounds: (c: C) => number
  /** Seconds allowed per round, 0 for no limit. A timeout resolves with a null decision. */
  perRoundSec: (c: C) => number
  next: (c: C, prev?: S) => S
  /** The scenario on screen. */
  Scene: FC<{ scenario: S; cfg: C }>
  /** The controls. Calls onDecide once. */
  Decide: FC<{ scenario: S; cfg: C; onDecide: (d: D) => void; disabled: boolean }>
  resolve: (scenario: S, decision: D | null, cfg: C) => Outcome
  breakdowns: Breakdown[]
  /** Extra sections on the result page. */
  Summary?: FC<{ attempt: Attempt<C> }>
  /** What the points mean, for the result line. */
  pointsLabel: string
  /** Decimal places for the score. */
  places?: number
  /** Hint under the run screen. */
  hint?: string
}
