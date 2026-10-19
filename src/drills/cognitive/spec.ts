import type { FC } from 'react'
import type { Attempt, EventLog } from '../../lib/types'
import type { BaseSpec } from '../shared/ConfigPage'
import type { Breakdown } from '../typed/spec'

/** What a bespoke game hands back when it is over. */
export interface Finished {
  logs: EventLog[]
  score: number
  correct: number
  wrong: number
  durationSec: number
  meta?: Record<string, number | string>
}

/** A game with its own run screen. */
export interface CognitiveSpec<C extends object> extends BaseSpec<C> {
  Run: FC<{ cfg: C; onDone: (f: Finished) => void; onQuit: () => void }>
  Summary?: FC<{ attempt: Attempt<C> }>
  /** When set, the result page lists the decisions that went wrong with this intro and each log's `how`. */
  review?: string
  breakdowns: Breakdown[]
  pointsLabel: string
  places?: number
  /** Whether the pace chart makes sense for this game. */
  pace?: boolean
  /** Label for the pace chart. */
  paceLabel?: string
}
