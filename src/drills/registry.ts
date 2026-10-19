import type { DrillId, SpeedArithmeticConfig } from '../lib/types'
import { durationLabel } from '../lib/config'
import { OP_SIGN } from './speedArithmetic/generator'
import { sequencesSpec } from './typed/specs/sequences'
import { fractionsSpec } from './typed/specs/fractions'
import { percentagesSpec } from './typed/specs/percentages'
import { eightySpec } from './typed/specs/eightyInEight'
import { kellySpec } from './typed/specs/kelly'
import { etfArbSpec } from './typed/specs/etfArb'
import { eventContractsSpec } from './typed/specs/eventContracts'
import { diceMarketSpec, cardsMarketSpec } from './rounds/specs/sumMarket'
import { bettingBoardSpec } from './rounds/specs/bettingBoard'
import { makeMarketSpec } from './rounds/specs/makeMarket'
import { fermiSpec } from './rounds/specs/fermi'
import { memoryGridSpec } from './cognitive/memoryGrid'
import { taskSwitchSpec } from './cognitive/taskSwitch'
import { interceptSpec } from './cognitive/intercept'
import { balloonSpec } from './cognitive/balloon'
import { eventMakerSpec } from './cognitive/eventMaker'
import { dutchBookSpec } from './typed/specs/dutchBook'
import { raceSpec } from './live/specs/race'
import { evidenceSpec } from './live/specs/evidence'

/**
 * What the dashboard needs to know about each drill without importing its
 * pages: a label, how to describe a config in one line, what the score means.
 */
export interface DrillMeta {
  id: DrillId
  label: string
  group: 'Speed' | 'Markets' | 'Prediction' | 'Estimation' | 'Cognitive'
  describe: (config: unknown) => string
  /** Unit shown after the score, if any. */
  unit?: string
  higherIsBetter?: boolean
  /** Short name of what the score counts. */
  scoreName: string
}

function describeArithmetic(c: SpeedArithmeticConfig) {
  const ops = c.ops.map((o) => OP_SIGN[o]).join(' ')
  return `${durationLabel(c.durationSec)}, ${ops}, ${c.addMin} to ${c.addMax}, ${c.mulLeftMin} to ${c.mulLeftMax} × ${c.mulRightMin} to ${c.mulRightMax}`
}

const list: DrillMeta[] = [
  { id: 'speed-arithmetic', label: 'Speed arithmetic', group: 'Speed', describe: (c) => describeArithmetic(c as SpeedArithmeticConfig), scoreName: 'right' },
  { id: 'eighty-in-eight', label: '80 in 8', group: 'Speed', describe: (c) => eightySpec.describe(c as never), unit: ' pts', scoreName: 'points' },
  { id: 'sequences', label: 'Sequences', group: 'Speed', describe: (c) => sequencesSpec.describe(c as never), scoreName: 'right' },
  { id: 'fractions', label: 'Fractions to decimals', group: 'Speed', describe: (c) => fractionsSpec.describe(c as never), scoreName: 'right' },
  { id: 'percentages', label: 'Percentages', group: 'Speed', describe: (c) => percentagesSpec.describe(c as never), scoreName: 'right' },
  { id: 'dice-market', label: 'Dice market', group: 'Markets', describe: (c) => diceMarketSpec.describe(c as never), unit: ' pts', scoreName: 'edge' },
  { id: 'cards-market', label: 'Cards market', group: 'Markets', describe: (c) => cardsMarketSpec.describe(c as never), unit: ' pts', scoreName: 'edge' },
  { id: 'make-a-market', label: 'Make me a market', group: 'Markets', describe: (c) => makeMarketSpec.describe(c as never), unit: ' pts', scoreName: 'points' },
  { id: 'betting-board', label: 'Betting board', group: 'Markets', describe: (c) => bettingBoardSpec.describe(c as never), unit: ' pts', scoreName: 'edge' },
  { id: 'kelly', label: 'Kelly sizing', group: 'Markets', describe: (c) => kellySpec.describe(c as never), scoreName: 'right' },
  { id: 'etf-arb', label: 'ETF arbitrage', group: 'Markets', describe: (c) => etfArbSpec.describe(c as never), unit: ' pts', scoreName: 'points' },
  { id: 'event-contracts', label: 'Event contracts', group: 'Markets', describe: (c) => eventContractsSpec.describe(c as never), scoreName: 'right' },
  { id: 'fermi', label: 'Fermi', group: 'Estimation', describe: (c) => fermiSpec.describe(c as never), unit: ' pts', scoreName: 'points' },
  { id: 'memory-grid', label: 'Memory grid', group: 'Cognitive', describe: (c) => memoryGridSpec.describe(c as never), scoreName: 'cells' },
  { id: 'task-switch', label: 'Task switch', group: 'Cognitive', describe: (c) => taskSwitchSpec.describe(c as never), unit: ' ms', higherIsBetter: false, scoreName: 'switch cost' },
  { id: 'intercept', label: 'Intercept', group: 'Cognitive', describe: (c) => interceptSpec.describe(c as never), scoreName: 'hits' },
  { id: 'balloon', label: 'Balloon', group: 'Cognitive', describe: (c) => balloonSpec.describe(c as never), unit: ' pts', scoreName: 'points' },
  { id: 'dutch-book', label: 'Dutch book', group: 'Prediction', describe: (c) => dutchBookSpec.describe(c as never), unit: ' pts', scoreName: 'points' },
  { id: 'race', label: 'The race', group: 'Prediction', describe: (c) => raceSpec.describe(c as never), unit: 'c', scoreName: 'edge' },
  { id: 'evidence', label: 'Evidence stream', group: 'Prediction', describe: (c) => evidenceSpec.describe(c as never), unit: 'c', scoreName: 'edge' },
  { id: 'event-maker', label: 'Event market maker', group: 'Prediction', describe: (c) => eventMakerSpec.describe(c as never), unit: 'c', scoreName: 'expected profit' },
]

export const DRILLS: Partial<Record<DrillId, DrillMeta>> = Object.fromEntries(list.map((m) => [m.id, m]))

export function drillMeta(id: DrillId): DrillMeta {
  return (
    DRILLS[id] ?? {
      id,
      label: id,
      group: 'Speed',
      describe: () => '',
      scoreName: 'score',
    }
  )
}

export function registerDrill(meta: DrillMeta) {
  DRILLS[meta.id] = meta
}
