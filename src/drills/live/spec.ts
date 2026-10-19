import type { FC } from 'react'
import type { Attempt } from '../../lib/types'
import type { BaseSpec } from '../shared/ConfigPage'
import type { Breakdown } from '../typed/spec'

/**
 * A live market on a process that unfolds tick by tick. The engine owns
 * the clock, the market maker (a bot that tracks the true probability
 * with a lag, or overshoots it), the player's single position per round,
 * and the resolution. A process supplies the state, the step, the exact
 * probability at every moment, and the picture.
 */
export type BotStyle = 'lag' | 'jumpy' | 'mixed'

export interface LiveProcess<C extends object, S> {
  init: (cfg: C) => S
  step: (s: S, cfg: C) => S
  done: (s: S, cfg: C) => boolean
  /** Exact probability that YES resolves, given the state. */
  trueP: (s: S, cfg: C) => number
  /** 1 if YES resolved, 0 if NO. Only called once done. */
  outcome: (s: S, cfg: C) => 0 | 1
  /** One line about the state for the round list. */
  describe: (s: S, cfg: C) => string
  /** What the contract is. */
  contract: (cfg: C) => string
  /** How fair is computed from this state, in words with the numbers, for the review. */
  explain: (s: S, cfg: C) => string
  View: FC<{ state: S; cfg: C }>
}

export interface LiveConfig {
  rounds: 5 | 10 | 20
  tickMs: 700 | 450 | 300
  bot: BotStyle
  /** Half the bid-ask spread, in cents. */
  half: 1 | 2 | 3
}

export interface LiveSpec<C extends LiveConfig, S> extends BaseSpec<C> {
  process: LiveProcess<C, S>
  breakdowns: Breakdown[]
  Summary?: FC<{ attempt: Attempt<C> }>
  hint?: string
}
