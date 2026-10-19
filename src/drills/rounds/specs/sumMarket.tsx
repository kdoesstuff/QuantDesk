import type { ReactElement } from 'react'
import { pick, rint, round, shuffle } from '../../../lib/random'
import type { DrillId } from '../../../lib/types'
import { Seg, Setting } from '../../shared/Frames'
import { Choices, QuoteInput } from '../controls'
import type { Outcome, RoundsSpec, Scenario } from '../spec'

/**
 * The dice and cards markets share one shape: some objects are face up, some
 * hidden, and the market is on the total. Take mode shows a quote and asks
 * buy, sell or pass. Make mode asks for a two-sided quote and the house
 * trades on any edge you leave.
 */
export type MarketMode = 'take' | 'make' | 'both'
export type Side = 'buy' | 'sell' | 'pass'

export interface SumConfig {
  count: number
  hidden: number
  mode: MarketMode
  rounds: 10 | 20 | 40
  perRoundSec: 0 | 12 | 6
  /** Widest quote the house will trade with, in points of the sum. */
  maxWidth: number
}

export interface SumScenario extends Scenario {
  shown: number[]
  hiddenCount: number
  fair: number
  /** Take mode quote. */
  bid?: number
  ask?: number
  play: 'take' | 'make'
  /** Resolved values of the hidden objects, drawn in advance. */
  reveal: number[]
}

export type SumDecision = { side: Side } | { bid: number; ask: number }

interface Flavour {
  id: DrillId
  title: string
  blurb: string
  noun: string
  nounPlural: string
  min: number
  max: number
  /** Draw the shown values and the hidden values, and return the fair value of the sum. */
  draw: (count: number, hidden: number) => { shown: number[]; reveal: number[]; fair: number }
  /** How fair is computed, in words with the numbers. */
  fairHow: (shown: number[], hidden: number, fair: number) => string
  /** Render one object. */
  Face: (p: { value: number | null }) => ReactElement
  quoteStep: number
  defaults: Partial<SumConfig>
}

function quoteAround(fair: number, step: number) {
  // Offsets in steps of the quote grid, biased toward small misses so that
  // pass is a real option.
  const w = pick([1, 1, 2, 2, 3]) * step * 2
  const off = pick([-3, -2, -1.5, -1, -0.5, 0, 0, 0.5, 1, 1.5, 2, 3]) * step * 2
  // Snap the mid to the quote grid so quotes read like real ones.
  const mid = round(Math.round((fair + off) / step) * step, 2)
  const bid = round(mid - w / 2, 2)
  const ask = round(mid + w / 2, 2)
  return { bid, ask }
}

function Scene({ scenario, flavour }: { scenario: SumScenario; flavour: Flavour }) {
  return (
    <div className="market">
      <div className="market__objects">
        {scenario.shown.map((v, i) => (
          <flavour.Face key={'s' + i} value={v} />
        ))}
        {Array.from({ length: scenario.hiddenCount }, (_, i) => (
          <flavour.Face key={'h' + i} value={null} />
        ))}
      </div>
      {scenario.play === 'take' ? (
        <p className="market__quote tnum">
          <span className="muted">Market on the sum</span>
          <strong>
            {fmtQ(scenario.bid!)} at {fmtQ(scenario.ask!)}
          </strong>
        </p>
      ) : (
        <p className="market__quote">
          <span className="muted">Make a market on the sum</span>
        </p>
      )}
    </div>
  )
}

function fmtQ(x: number) {
  return Number.isInteger(x) ? String(x) : x.toFixed(x * 10 === Math.round(x * 10) ? 1 : 2)
}

export function makeSumMarket(flavour: Flavour): RoundsSpec<SumConfig, SumScenario, SumDecision> {
  const defaults: SumConfig = { count: 5, hidden: 2, mode: 'both', rounds: 20, perRoundSec: 0, maxWidth: 3, ...flavour.defaults }

  const next = (c: SumConfig, prev?: SumScenario): SumScenario => {
    const hidden = Math.min(c.hidden, c.count - 1)
    const { shown, reveal, fair } = flavour.draw(c.count, hidden)
    const play: 'take' | 'make' = c.mode === 'both' ? (prev ? (prev.play === 'take' ? 'make' : 'take') : 'take') : c.mode
    const base: SumScenario = {
      kind: play,
      prompt: `${shown.join(' ')} + ${hidden} hidden`,
      tags: { play, count: c.count, hidden, shownSum: shown.reduce((a, b) => a + b, 0) },
      shown,
      hiddenCount: hidden,
      fair: round(fair, 2),
      play,
      reveal,
    }
    if (play === 'take') {
      const q = quoteAround(base.fair, flavour.quoteStep)
      base.bid = q.bid
      base.ask = q.ask
      base.prompt += `, ${fmtQ(q.bid)} at ${fmtQ(q.ask)}`
      const where = q.ask < base.fair ? 'cheap' : q.bid > base.fair ? 'rich' : 'fair'
      base.tags.market = where
      base.tags.width = q.ask - q.bid
      base.tags.edge = round(where === 'cheap' ? base.fair - q.ask : where === 'rich' ? q.bid - base.fair : 0, 2)
    }
    return base
  }

  const resolve = (s: SumScenario, d: SumDecision | null, c: SumConfig): Outcome => {
    const realised = s.shown.reduce((a, b) => a + b, 0) + s.reveal.reduce((a, b) => a + b, 0)
    if (s.play === 'take') {
      const bid = s.bid!
      const ask = s.ask!
      const best: Side = ask < s.fair ? 'buy' : bid > s.fair ? 'sell' : 'pass'
      const bestEdge = best === 'buy' ? s.fair - ask : best === 'sell' ? bid - s.fair : 0
      const side: Side = d && 'side' in d ? d.side : 'pass'
      const ev = side === 'buy' ? s.fair - ask : side === 'sell' ? bid - s.fair : 0
      const pnl = side === 'buy' ? realised - ask : side === 'sell' ? bid - realised : 0
      const correct = side === best
      const answerWord = best === 'pass' ? 'pass' : `${best} (${bestEdge > 0 ? '+' : ''}${round(bestEdge, 2)} edge)`
      const verdict =
        best === 'buy'
          ? `The ask ${fmtQ(ask)} is below fair, so buying has ${fmtQ(round(bestEdge, 2))} of expected edge.`
          : best === 'sell'
            ? `The bid ${fmtQ(bid)} is above fair, so selling has ${fmtQ(round(bestEdge, 2))} of expected edge.`
            : `Fair sits inside ${fmtQ(bid)} at ${fmtQ(ask)}, so both sides lose on average: pass.`
      const yours =
        side === 'pass'
          ? 'Passing gave up that edge.'
          : side === 'buy'
            ? `Buying at ${fmtQ(ask)} had an expected edge of ${fmtQ(round(ev, 2))}.`
            : `Selling at ${fmtQ(bid)} had an expected edge of ${fmtQ(round(ev, 2))}.`
      return {
        points: round(ev, 2),
        correct,
        given: d === null ? 'timed out' : side,
        answer: answerWord,
        note: `Fair ${fmtQ(s.fair)}, came in ${realised}. ${side === 'pass' ? 'No trade.' : `Realised ${pnl > 0 ? '+' : ''}${fmtQ(round(pnl, 2))}.`}`,
        how: `${flavour.fairHow(s.shown, s.hiddenCount, s.fair)} ${verdict} ${correct ? '' : yours} What actually came in (${realised}) is noise; the call is judged on expectation.`.replace(
          '  ',
          ' ',
        ),
        tags: { side, best, ev: round(ev, 2), missedEdge: round(bestEdge - ev, 2), realised: round(pnl, 2) },
      }
    }
    // Make mode
    if (!d || !('bid' in d)) {
      return {
        points: -1,
        correct: false,
        given: 'timed out',
        answer: `around ${fmtQ(s.fair)}`,
        note: `Fair was ${fmtQ(s.fair)}.`,
        how: `${flavour.fairHow(s.shown, s.hiddenCount, s.fair)} A quote of about ${fmtQ(round(s.fair - c.maxWidth / 2, 2))} at ${fmtQ(round(s.fair + c.maxWidth / 2, 2))} would have contained fair inside the width limit.`,
        tags: { contained: false },
      }
    }
    const width = round(d.ask - d.bid, 2)
    const mid = round((d.ask + d.bid) / 2, 2)
    const skew = round(mid - s.fair, 2)
    const crossed = d.ask < d.bid
    const contained = !crossed && d.bid <= s.fair && d.ask >= s.fair
    let points: number
    let note: string
    if (crossed) {
      points = -2
      note = `Crossed market. Fair was ${fmtQ(s.fair)}.`
    } else if (!contained) {
      const outside = d.ask < s.fair ? s.fair - d.ask : d.bid - s.fair
      points = round(-1 - outside, 2)
      note =
        d.ask < s.fair
          ? `Lifted at ${fmtQ(d.ask)}, fair ${fmtQ(s.fair)}. You sold ${fmtQ(round(outside, 2))} too cheap.`
          : `Hit at ${fmtQ(d.bid)}, fair ${fmtQ(s.fair)}. You paid ${fmtQ(round(outside, 2))} too much.`
    } else if (width > c.maxWidth) {
      points = 0
      note = `Fair ${fmtQ(s.fair)} is inside, but ${fmtQ(width)} wide is wider than ${c.maxWidth}. No trade.`
    } else {
      points = round(1 + (c.maxWidth - width), 2)
      note = `Fair ${fmtQ(s.fair)} is inside, ${fmtQ(width)} wide. Came in ${realised}.`
    }
    const howMake = crossed
      ? `${flavour.fairHow(s.shown, s.hiddenCount, s.fair)} Your bid was above your ask, which is a crossed market and costs 2 points. Quote bid below ask, with fair inside.`
      : !contained
        ? `${flavour.fairHow(s.shown, s.hiddenCount, s.fair)} Your quote ${fmtQ(d.bid)} at ${fmtQ(d.ask)} does not contain ${fmtQ(s.fair)}, so the house ${d.ask < s.fair ? `lifted your ask and you sold ${fmtQ(round(s.fair - d.ask, 2))} below fair` : `hit your bid and you bought ${fmtQ(round(d.bid - s.fair, 2))} above fair`}. Centre the quote on fair first, then choose the width: ${fmtQ(round(s.fair - c.maxWidth / 2, 2))} at ${fmtQ(round(s.fair + c.maxWidth / 2, 2))} would have scored.`
        : `${flavour.fairHow(s.shown, s.hiddenCount, s.fair)} Fair is inside your quote but ${fmtQ(width)} wide is beyond the ${c.maxWidth} limit, so nobody trades. Tighten to ${c.maxWidth} or less around ${fmtQ(s.fair)}.`
    return {
      points,
      correct: contained && width <= c.maxWidth,
      given: `${fmtQ(d.bid)} at ${fmtQ(d.ask)}`,
      answer: `around ${fmtQ(s.fair)}`,
      note,
      how: howMake,
      tags: { contained, width, skew, skewSign: skew > 0 ? 'high' : skew < 0 ? 'low' : 'centred', tooWide: width > c.maxWidth },
    }
  }

  const TakeOrMake = ({
    scenario,
    onDecide,
    disabled,
  }: {
    scenario: SumScenario
    cfg: SumConfig
    onDecide: (d: SumDecision) => void
    disabled: boolean
  }) =>
    scenario.play === 'take' ? (
      <Choices
        options={[
          { value: 'buy', label: `Buy at ${fmtQ(scenario.ask!)}`, key: 'b', tone: 'buy' },
          { value: 'pass', label: 'Pass', key: 'p', tone: 'quiet' },
          { value: 'sell', label: `Sell at ${fmtQ(scenario.bid!)}`, key: 's', tone: 'sell' },
        ]}
        onPick={(side) => onDecide({ side })}
        disabled={disabled}
      />
    ) : (
      <QuoteInput onSubmit={(bid, ask) => onDecide({ bid, ask })} disabled={disabled} step={flavour.quoteStep} />
    )

  const Settings = ({ cfg, setCfg }: { cfg: SumConfig; setCfg: (f: (c: SumConfig) => SumConfig) => void }) => (
    <>
      <Setting
        title="Mode"
        note="Take: a quote is shown, you buy, sell or pass. Make: you quote both sides and the house trades any edge you leave."
      >
        <Seg
          options={['take', 'make', 'both'] as const}
          value={cfg.mode}
          onChange={(m) => setCfg((c) => ({ ...c, mode: m }))}
          label="Mode"
          format={(m) => (m === 'both' ? 'Alternate' : m === 'take' ? 'Take' : 'Make')}
        />
      </Setting>
      <Setting title={flavour.nounPlural}>
        <Seg
          options={[3, 4, 5, 6, 8] as const}
          value={cfg.count}
          onChange={(n) => setCfg((c) => ({ ...c, count: n, hidden: Math.min(c.hidden, n - 1) }))}
          label="Count"
        />
      </Setting>
      <Setting
        title="Hidden"
        note={`Face down ${flavour.nounPlural.toLowerCase()}. The fair value is the shown total plus the expected hidden total.`}
      >
        <Seg
          options={[1, 2, 3, 4].filter((h) => h < cfg.count)}
          value={cfg.hidden}
          onChange={(h) => setCfg((c) => ({ ...c, hidden: h }))}
          label="Hidden"
        />
      </Setting>
      <Setting title="Rounds">
        <Seg options={[10, 20, 40] as const} value={cfg.rounds} onChange={(r) => setCfg((c) => ({ ...c, rounds: r }))} label="Rounds" />
      </Setting>
      <Setting title="Time per round">
        <Seg
          options={[0, 12, 6] as const}
          value={cfg.perRoundSec}
          onChange={(t) => setCfg((c) => ({ ...c, perRoundSec: t }))}
          label="Time per round"
          format={(t) => (t === 0 ? 'No limit' : `${t}s`)}
        />
      </Setting>
      {cfg.mode !== 'take' && (
        <Setting title="Widest market" note="In make mode, a quote wider than this gets no trade and no points.">
          <Seg
            options={[2, 3, 4, 6] as const}
            value={cfg.maxWidth}
            onChange={(w) => setCfg((c) => ({ ...c, maxWidth: w }))}
            label="Widest market"
            format={(w) => `${w} wide`}
          />
        </Setting>
      )}
    </>
  )

  return {
    id: flavour.id,
    title: flavour.title,
    blurb: flavour.blurb,
    defaults,
    configKey: (c) => `${flavour.id}:${c.mode}:${c.count}h${Math.min(c.hidden, c.count - 1)}:r${c.rounds}:t${c.perRoundSec}:w${c.maxWidth}`,
    describe: (c) =>
      `${c.mode === 'both' ? 'take and make' : c.mode}, ${c.count} ${flavour.nounPlural.toLowerCase()} with ${Math.min(c.hidden, c.count - 1)} hidden, ${c.rounds} rounds${c.perRoundSec ? `, ${c.perRoundSec}s each` : ''}`,
    Settings,
    rounds: (c) => c.rounds,
    perRoundSec: (c) => c.perRoundSec,
    next,
    Scene: ({ scenario }) => <Scene scenario={scenario} flavour={flavour} />,
    Decide: TakeOrMake,
    resolve,
    pointsLabel: 'expected edge in points of the sum',
    places: 1,
    unit: ' pts',
    hint: 'B buy, S sell, P pass. In make mode type bid, Tab, ask, Enter. Esc to stop',
    breakdowns: [
      { title: 'By mode', key: (e) => (e.tags?.play === 'take' ? 'Take' : 'Make'), order: ['Take', 'Make'] },
      {
        title: 'Take mode, by where the market sat',
        key: (e) =>
          e.tags?.play !== 'take'
            ? null
            : e.tags?.market === 'cheap'
              ? 'Below fair (buy)'
              : e.tags?.market === 'rich'
                ? 'Above fair (sell)'
                : 'Around fair (pass)',
        order: ['Below fair (buy)', 'Above fair (sell)', 'Around fair (pass)'],
      },
      {
        title: 'Make mode, by where your mid sat',
        key: (e) =>
          e.tags?.play !== 'make'
            ? null
            : e.tags?.skewSign === 'high'
              ? 'Mid above fair'
              : e.tags?.skewSign === 'low'
                ? 'Mid below fair'
                : 'Mid on fair',
        order: ['Mid below fair', 'Mid on fair', 'Mid above fair'],
      },
    ],
  }
}

/* Dice -------------------------------------------------------------------- */

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [
    [25, 25],
    [75, 75],
  ],
  3: [
    [25, 25],
    [50, 50],
    [75, 75],
  ],
  4: [
    [25, 25],
    [75, 25],
    [25, 75],
    [75, 75],
  ],
  5: [
    [25, 25],
    [75, 25],
    [50, 50],
    [25, 75],
    [75, 75],
  ],
  6: [
    [25, 25],
    [75, 25],
    [25, 50],
    [75, 50],
    [25, 75],
    [75, 75],
  ],
}

export function DieFace({ value }: { value: number | null }) {
  return (
    <svg
      className={'die' + (value === null ? ' die--hidden' : '')}
      viewBox="0 0 100 100"
      aria-label={value === null ? 'hidden die' : `die showing ${value}`}
    >
      <rect x="4" y="4" width="92" height="92" rx="18" />
      {value === null ? (
        <text x="50" y="50" textAnchor="middle" dominantBaseline="central">
          ?
        </text>
      ) : (
        PIPS[value].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="9" />)
      )}
    </svg>
  )
}

export const diceMarketSpec = makeSumMarket({
  id: 'dice-market',
  title: 'Dice market',
  blurb: 'Some dice face up, some hidden. The market is on the total. Fair is what you see plus three and a half a hidden die.',
  noun: 'die',
  nounPlural: 'Dice',
  min: 1,
  max: 6,
  draw: (count, hidden) => {
    const shown = Array.from({ length: count - hidden }, () => rint(1, 6))
    const reveal = Array.from({ length: hidden }, () => rint(1, 6))
    return { shown, reveal, fair: shown.reduce((a, b) => a + b, 0) + 3.5 * hidden }
  },
  fairHow: (shown, hidden, fair) =>
    `Shown total ${shown.reduce((a, b) => a + b, 0)}. A fair die averages 3.5, so ${hidden} hidden ${hidden === 1 ? 'die adds' : 'dice add'} ${fmtQ(3.5 * hidden)}: fair ${fmtQ(fair)}.`,
  Face: DieFace,
  quoteStep: 0.5,
  defaults: {},
})

/* Cards ------------------------------------------------------------------- */

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const SUITS = ['♠', '♥', '♦', '♣']

export function CardFace({ value }: { value: number | null }) {
  // Suit is cosmetic and chosen by value so a given card looks the same within a round.
  const suit = value === null ? '' : SUITS[(value * 7) % 4]
  const red = suit === '♥' || suit === '♦'
  return (
    <div
      className={'card' + (value === null ? ' card--hidden' : '') + (red ? ' card--red' : '')}
      aria-label={value === null ? 'hidden card' : `card ${RANKS[value - 1]}`}
    >
      {value === null ? (
        <span>?</span>
      ) : (
        <>
          <span className="card__rank">{RANKS[value - 1]}</span>
          <span className="card__suit">{suit}</span>
        </>
      )}
    </div>
  )
}

export const cardsMarketSpec = makeSumMarket({
  id: 'cards-market',
  title: 'Cards market',
  blurb:
    'Cards from one deck, ace one to king thirteen. Some face up, some face down. The market is on the total, and the hidden cards come from what is left of the deck.',
  noun: 'card',
  nounPlural: 'Cards',
  min: 1,
  max: 13,
  draw: (count, hidden) => {
    const deck = shuffle(Array.from({ length: 52 }, (_, i) => (i % 13) + 1))
    const shown = deck.slice(0, count - hidden)
    const reveal = deck.slice(count - hidden, count)
    const shownSum = shown.reduce((a, b) => a + b, 0)
    const meanLeft = (364 - shownSum) / (52 - shown.length)
    return { shown, reveal, fair: shownSum + hidden * meanLeft }
  },
  fairHow: (shown, hidden, fair) => {
    const sum = shown.reduce((a, b) => a + b, 0)
    const left = 52 - shown.length
    const mean = (364 - sum) / left
    return `Shown total ${sum}. The deck adds to 364 (four of each rank, ace 1 to king 13, average 7). Take out the ${shown.length} shown: ${364 - sum} over ${left} cards left, average ${round(mean, 2)}, ${mean > 7 ? 'above' : mean < 7 ? 'below' : 'equal to'} 7 because the shown cards were ${mean > 7 ? 'low' : mean < 7 ? 'high' : 'average'}. Fair = ${sum} + ${hidden} × ${round(mean, 2)} = ${fmtQ(fair)}.`
  },
  Face: CardFace,
  quoteStep: 0.5,
  defaults: { count: 4, hidden: 2, maxWidth: 4 },
})
