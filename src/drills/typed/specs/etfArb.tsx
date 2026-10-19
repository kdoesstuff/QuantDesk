import { pick, rint, round } from '../../../lib/random'
import { durationLabel } from '../../../lib/config'
import { Seg, Setting } from '../../shared/Frames'
import type { Item, TypedSpec } from '../spec'

/**
 * ETF arbitrage. An ETF is quoted against its basket. Sum the weights times
 * the prices for the fair value, then decide: buy the ETF and sell the
 * basket if the ETF is offered below fair, the reverse if it is bid above,
 * nothing if the quote straddles fair. Three options, keys 1 to 3.
 */
export interface EtfConfig {
  durationSec: 120 | 180 | 300
  names: 3 | 4 | 5
  /** 1 round prices and weights, 2 decimals and odd weights, 3 tighter gaps. */
  level: 1 | 2 | 3
  penalty: 0 | 1
}

const NAMES = ['ABC', 'DLF', 'HPQ', 'ITC', 'KLM', 'MRF', 'NTC', 'PQR', 'RIL', 'SBI', 'TCS', 'UPL', 'VBL', 'WPR', 'XYZ', 'ZEE']

function weights(n: number, level: number): number[] {
  if (level === 1) {
    const sets: Record<number, number[][]> = {
      3: [[50, 30, 20], [40, 40, 20], [60, 20, 20], [50, 25, 25]],
      4: [[40, 30, 20, 10], [25, 25, 25, 25], [40, 20, 20, 20], [30, 30, 20, 20]],
      5: [[40, 20, 20, 10, 10], [30, 20, 20, 20, 10], [20, 20, 20, 20, 20], [50, 20, 10, 10, 10]],
    }
    return pick(sets[n])
  }
  // Random weights in whole percents summing to 100, none below 5.
  let w: number[] = []
  do {
    const cuts = Array.from({ length: n - 1 }, () => rint(5, 95)).sort((a, b) => a - b)
    w = [cuts[0], ...cuts.slice(1).map((c, i) => c - cuts[i]), 100 - cuts[cuts.length - 1]]
  } while (w.some((x) => x < 5))
  return w
}

function next(c: EtfConfig): Item {
  const n = c.names
  const w = weights(n, c.level)
  const names = [...NAMES].sort(() => Math.random() - 0.5).slice(0, n)
  const prices = Array.from({ length: n }, () => (c.level === 1 ? rint(10, 200) : round(rint(1000, 30000) / 100, c.level === 2 ? 1 : 2)))
  const nav = round(w.reduce((s, wi, i) => s + (wi / 100) * prices[i], 0), 2)
  // Gap between fair and the quote, in percent of NAV, smaller at higher levels.
  const gapPct = pick(c.level === 1 ? [-3, -2, -1.5, 0, 0, 1.5, 2, 3] : c.level === 2 ? [-2, -1, -0.6, 0, 0, 0.6, 1, 2] : [-1, -0.5, -0.3, 0, 0, 0.3, 0.5, 1])
  const half = round(nav * (c.level === 1 ? 0.004 : c.level === 2 ? 0.003 : 0.002), 2)
  const mid = round(nav * (1 + gapPct / 100), 2)
  const bid = round(mid - half, 2)
  const ask = round(mid + half, 2)
  const answer = ask < nav ? 'Buy ETF, sell basket' : bid > nav ? 'Sell ETF, buy basket' : 'No trade'
  const options = ['Buy ETF, sell basket', 'No trade', 'Sell ETF, buy basket']
  const edgeBps = Math.round(((ask < nav ? nav - ask : bid > nav ? bid - nav : 0) / nav) * 10000)
  return {
    kind: answer === 'No trade' ? 'none' : answer.startsWith('Buy') ? 'buy' : 'sell',
    prompt: `ETF ${bid.toFixed(2)} at ${ask.toFixed(2)}`,
    sub: `basket fair is the weighted sum`,
    answer,
    options,
    correctIndex: options.indexOf(answer),
    detail: names.map((nm, i) => ({ label: `${nm} ${w[i]}%`, value: prices[i].toFixed(c.level === 1 ? 0 : 2) })),
    tags: { names: n, level: c.level, direction: answer, edgeBps, nav, gapPct: Math.abs(gapPct) },
  }
}

function Settings({ cfg, setCfg }: { cfg: EtfConfig; setCfg: (f: (c: EtfConfig) => EtfConfig) => void }) {
  return (
    <>
      <Setting title="Clock">
        <Seg options={[120, 180, 300] as const} value={cfg.durationSec} onChange={(d) => setCfg((c) => ({ ...c, durationSec: d }))} label="Duration" format={durationLabel} />
      </Setting>
      <Setting title="Names in the basket">
        <Seg options={[3, 4, 5] as const} value={cfg.names} onChange={(n) => setCfg((c) => ({ ...c, names: n }))} label="Names" />
      </Setting>
      <Setting title="Level" note="Level 1 has round prices and simple weights. Level 3 has two-decimal prices, odd weights and gaps of half a percent.">
        <Seg options={[1, 2, 3] as const} value={cfg.level} onChange={(l) => setCfg((c) => ({ ...c, level: l }))} label="Level" />
      </Setting>
      <Setting title="Wrong call">
        <Seg options={[0, 1] as const} value={cfg.penalty} onChange={(p) => setCfg((c) => ({ ...c, penalty: p }))} label="Penalty" format={(p) => (p === 0 ? 'No penalty' : 'Minus 1')} />
      </Setting>
    </>
  )
}

export const etfArbSpec: TypedSpec<EtfConfig> = {
  id: 'etf-arb',
  title: 'ETF arbitrage',
  blurb: 'An ETF against its basket. Sum the weights times the prices, compare to the quote, hit the gap first. Keys 1 to 3.',
  mode: 'choice',
  defaults: { durationSec: 180, names: 3, level: 1, penalty: 1 },
  configKey: (c) => `etf:${c.durationSec}:n${c.names}:L${c.level}:p${c.penalty}`,
  describe: (c) => `${durationLabel(c.durationSec)}, ${c.names} names, level ${c.level}${c.penalty ? ', minus 1' : ''}`,
  duration: (c) => c.durationSec,
  next,
  Settings,
  points: (c) => ({ right: 1, wrong: -c.penalty }),
  unit: ' pts',
  hint: 'Keys 1 to 3, Enter to skip, Esc to stop',
  breakdowns: [
    { title: 'By right call', key: (e) => String(e.tags?.direction ?? ''), order: ['Buy ETF, sell basket', 'No trade', 'Sell ETF, buy basket'] },
    {
      title: 'By size of the gap',
      key: (e) => {
        const g = Number(e.tags?.gapPct ?? 0)
        return g === 0 ? 'No gap' : g < 1 ? 'Under 1%' : g < 2 ? '1% to 2%' : '2% and up'
      },
      order: ['No gap', 'Under 1%', '1% to 2%', '2% and up'],
    },
  ],
  colour: (e) => (e.correct ? 'var(--blue-2)' : 'var(--wrong)'),
}
