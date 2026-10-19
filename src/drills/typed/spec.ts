import type { FC } from 'react'
import type { DrillId, EventLog, TagValue } from '../../lib/types'

/** One problem produced by a generator. */
export interface Item {
  /** Generator family, for analysis. */
  kind: string
  /** Shown large. */
  prompt: string
  /** Smaller line under the prompt (units, precision, instruction). */
  sub?: string
  /** Canonical typed answer. */
  answer: string
  /** Other accepted spellings of the answer. */
  alt?: string[]
  tags: Record<string, TagValue>
  /** Choice mode: the options shown, and which is right. */
  options?: string[]
  correctIndex?: number
  /** Extra rows shown above the prompt (a basket, a table of givens). */
  detail?: { label: string; value: string }[]
  /** Enter-submit mode: accept when within this of the answer. */
  tolerance?: number
  /** How to get the answer, in a few sentences with the numbers. Shown in the review when the item went wrong. */
  how?: string
}

export interface Breakdown {
  title: string
  /** Category for one logged event. Return null to leave it out. */
  key: (e: EventLog) => string | null
  /** Fixed order of categories; unknown keys go after, alphabetically. */
  order?: string[]
}

export interface TypedSpec<C extends object> {
  id: DrillId
  title: string
  blurb: string
  /** Typed answers or four options. A function lets a setting decide. */
  mode: 'typed' | 'choice' | ((c: C) => 'typed' | 'choice')
  defaults: C
  configKey: (c: C) => string
  /** One line for the Progress page. */
  describe: (c: C) => string
  /** Seconds on the clock, 0 for none. */
  duration: (c: C) => number
  /** Stop after this many items (choice mode mostly). */
  limit?: (c: C) => number
  next: (c: C, prev?: Item) => Item
  Settings: FC<{ cfg: C; setCfg: (f: (c: C) => C) => void }>
  valid?: (c: C) => boolean
  /** Characters allowed in the typed field. Default digits only. */
  inputPattern?: RegExp
  /** Check on Enter instead of on every keystroke (for answers with a tolerance). */
  submitOnEnter?: boolean
  /** With submitOnEnter: a wrong submission ends the question with the wrong points, and Enter on an empty field skips for free. Test conditions. */
  oneShot?: boolean
  /** Points for right and wrong (choice mode). Default +1 / 0. */
  points?: (c: C) => { right: number; wrong: number }
  breakdowns: Breakdown[]
  /** Bar colour per event on the pace chart. */
  colour?: (e: EventLog) => string
  /** Short unit for the score, like " pts". */
  unit?: string
  /** Hint under the run screen. */
  hint?: string | ((c: C) => string)
}

export function modeOf<C extends object>(spec: TypedSpec<C>, cfg: C): 'typed' | 'choice' {
  return typeof spec.mode === 'function' ? spec.mode(cfg) : spec.mode
}

/** Normalise a typed numeric string so "0.5", ".5", "+.50" compare equal. */
export function normalise(s: string) {
  let t = s.replace(/\s+/g, '').replace(/^\+/, '')
  if (t.startsWith('.')) t = '0' + t
  if (t.startsWith('-.')) t = '-0' + t.slice(1)
  if (/^-?\d+\.\d*$/.test(t)) t = t.replace(/\.?0+$/, '').replace(/\.$/, '')
  if (t === '-0') t = '0'
  return t
}
