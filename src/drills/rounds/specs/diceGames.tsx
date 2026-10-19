import { chance, pick, rint, round } from '../../../lib/random'
import { Chips, Seg, Setting, toggleIn } from '../../shared/Frames'
import { Choices, QuoteInput } from '../controls'
import type { Outcome, RoundsSpec, Scenario } from '../spec'
import { DieFace, type MarketMode, type Side } from './sumMarket'

/**
 * Dice games market. A small dice game is described in words and the
 * market is on its expected payout. Every family has an exact fair value,
 * computed by enumeration or a closed form, so the right call is never a
 * matter of taste. Take mode: trade against a quote. Make mode: quote it.
 *
 * The families are the ones that come up in trading interviews: the higher
 * of two dice, roll until a six, keep or re-roll, the best three of four,
 * exploding sixes, products and differences, sums above a threshold.
 */
export type GameFamily =
  | 'highLow'
  | 'untilSix'
  | 'untilAbove'
  | 'reroll'
  | 'bestOf'
  | 'product'
  | 'explode'
  | 'difference'
  | 'doubles'
  | 'threshold'
  | 'countFaces'
  | 'coinDie'
export const GAME_LABEL: Record<GameFamily, string> = {
  highLow: 'Higher or lower of two',
  untilSix: 'Roll until a six',
  untilAbove: 'Roll until above a number',
  reroll: 'Keep or re-roll',
  bestOf: 'Best of several',
  product: 'Product of two',
  explode: 'Exploding top face',
  difference: 'Difference of two',
  doubles: 'Doubles pay extra',
  threshold: 'Paid only above a sum',
  countFaces: 'Paid per face',
  coinDie: 'Coin then dice',
}
export const ALL_GAMES: GameFamily[] = [
  'highLow',
  'untilSix',
  'untilAbove',
  'reroll',
  'bestOf',
  'product',
  'explode',
  'difference',
  'doubles',
  'threshold',
  'countFaces',
  'coinDie',
]

export interface GamesConfig {
  mode: MarketMode
  rounds: 10 | 20 | 40
  perRoundSec: 0 | 30 | 15
  /** 1 six-sided dice and the plain games, 2 twists, 3 other dice sizes too. */
  level: 1 | 2 | 3
  /** Widest make-mode quote as a percent of fair. */
  maxWidthPct: 10 | 20 | 30
  families: GameFamily[]
}

/** A described game with its exact expected payout and a way to play it once. */
export interface Game {
  family: GameFamily
  /** The rules in one or two sentences. */
  text: string
  fair: number
  /** How fair is computed, in words with the numbers. */
  how: string
  /** One random play, for the "came in" line. */
  play: () => number
  /** Dice drawn in the picture. */
  dice: number
  sides: number
}

export interface GamesScenario extends Scenario {
  game: Game
  play: 'take' | 'make'
  bid?: number
  ask?: number
}

export type GamesDecision = { side: Side } | { bid: number; ask: number }

const roll = (s: number) => rint(1, s)
const f2 = (x: number) => String(round(x, 2))
const f3 = (x: number) => String(round(x, 3))

/** Expected value of the maximum (or minimum) of n fair s-sided dice. */
function expMax(n: number, s: number) {
  let e = 0
  for (let k = 1; k <= s; k++) e += k * ((k / s) ** n - ((k - 1) / s) ** n)
  return e
}
function expMin(n: number, s: number) {
  return s + 1 - expMax(n, s)
}

/** Expected value of "keep or re-roll" with r re-rolls left on an s-sided die (optimal play). */
function rerollValue(r: number, s: number): number {
  let v = (s + 1) / 2
  for (let i = 0; i < r; i++) {
    let e = 0
    for (let x = 1; x <= s; x++) e += Math.max(x, v)
    v = e / s
  }
  return v
}

/** Enumerate all outcomes of n s-sided dice and average f over them. */
function enumerate(n: number, s: number, f: (dice: number[]) => number) {
  const dice = Array.from({ length: n }, () => 1)
  let total = 0
  let count = 0
  const rec = (i: number) => {
    if (i === n) {
      total += f(dice)
      count++
      return
    }
    for (let x = 1; x <= s; x++) {
      dice[i] = x
      rec(i + 1)
    }
  }
  rec(0)
  return total / count
}

const pl = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

function sidesFor(level: number) {
  return level === 3 ? pick([6, 6, 8, 10, 12, 20]) : 6
}
const dieName = (s: number) => (s === 6 ? 'a die' : `a ${s}-sided die`)
const diceName = (n: number, s: number) => (s === 6 ? pl(n, 'die', 'dice') : `${n} ${s}-sided dice`)

export function makeGame(family: GameFamily, level: number): Game {
  switch (family) {
    case 'highLow': {
      const s = sidesFor(level)
      const higher = chance(0.65)
      const tieZero = level >= 2 && chance(0.4)
      const base = higher ? expMax(2, s) : expMin(2, s)
      const tieLoss = (s + 1) / 2 / s // E[X | tie] * P(tie) = ((s+1)/2) * (1/s)
      const fair = tieZero ? base - tieLoss : base
      const word = higher ? 'higher' : 'lower'
      return {
        family,
        text: `Roll ${diceName(2, s)}. You are paid the ${word} of the two${tieZero ? ', or nothing if they tie' : ''}.`,
        fair,
        how: `For the ${word} of two ${s}-sided dice, count outcomes: P(${word} = k) = ${higher ? `(k² − (k−1)²)/${s * s} = (2k − 1)/${s * s}` : `((${s + 1}−k)² − (${s}−k)²)/${s * s}`}. Summing k times that gives ${f3(base)}.${tieZero ? ` Ties happen with probability 1/${s} and the tied value averages ${f2((s + 1) / 2)}, so subtract ${f2((s + 1) / 2)}/${s} = ${f3(tieLoss)}: ${f3(fair)}.` : ''} Shortcut for the higher of two d6: 161/36 = 4.47.`,
        play: () => {
          const a = roll(s)
          const b = roll(s)
          if (tieZero && a === b) return 0
          return higher ? Math.max(a, b) : Math.min(a, b)
        },
        dice: 2,
        sides: s,
      }
    }
    case 'untilSix': {
      const s = sidesFor(level)
      const includeTop = level >= 2 && chance(0.5)
      // Non-top rolls: geometric count with mean (s - 1), each averaging s/2.
      const nonTop = (s - 1) * (s / 2)
      const fair = includeTop ? nonTop + s : nonTop
      return {
        family,
        text: `Roll ${dieName(s)} until a ${s} shows. You are paid the total of ${includeTop ? 'every roll including the final ' + s : 'the rolls before the ' + s}.`,
        fair,
        how: `Before the first ${s} there are on average ${s - 1} other rolls (the count is geometric with success chance 1/${s}, mean ${s}, minus the final roll), and each of those averages ${f2(s / 2)} (uniform on 1 to ${s - 1}). So ${s - 1} × ${f2(s / 2)} = ${f2(nonTop)}${includeTop ? `, plus the ${s} itself: ${f2(fair)}` : ''}.`,
        play: () => {
          let t = 0
          for (;;) {
            const x = roll(s)
            if (x === s) return includeTop ? t + s : t
            t += x
          }
        },
        dice: 1,
        sides: s,
      }
    }
    case 'untilAbove': {
      const s = sidesFor(level)
      const k = rint(Math.floor(s / 3), s - 2)
      const p = (s - k) / s
      const n = 1 / p
      const contAvg = (k + 1) / 2
      const stopAvg = (k + 1 + s) / 2
      const fair = (n - 1) * contAvg + stopAvg
      return {
        family,
        text: `Roll ${dieName(s)} until it shows more than ${k}. You are paid the total of all the rolls.`,
        fair,
        how: `Each roll stops with probability ${s - k}/${s}, so the expected number of rolls is ${s}/${s - k} = ${f2(n)}. The rolls that do not stop are uniform on 1 to ${k} and average ${f2(contAvg)}; there are ${f2(n - 1)} of them on average, worth ${f2((n - 1) * contAvg)}. The final roll is uniform on ${k + 1} to ${s}, average ${f2(stopAvg)}. Total ${f2(fair)}.`,
        play: () => {
          let t = 0
          for (;;) {
            const x = roll(s)
            t += x
            if (x > k) return t
          }
        },
        dice: 1,
        sides: s,
      }
    }
    case 'reroll': {
      const s = sidesFor(level)
      const r = level === 1 ? 1 : pick([1, 2, 2, 3])
      const fair = rerollValue(r, s)
      const steps: string[] = []
      let v = (s + 1) / 2
      for (let i = 1; i <= r; i++) {
        const keep = Math.ceil(v + 1e-9)
        const next = rerollValue(i, s)
        steps.push(`with ${i} re-roll${i === 1 ? '' : 's'} left keep ${keep} or more (above ${f2(v)}), value ${f2(next)}`)
        v = next
      }
      return {
        family,
        text: `Roll ${dieName(s)}. You may re-roll up to ${pl(r, 'time', 'times')}, but you must keep the last roll. You are paid the face you keep, played optimally.`,
        fair,
        how: `Work backwards. A plain roll is worth ${f2((s + 1) / 2)}. ${steps.join('; ')}. So the game is worth ${f3(fair)}. Re-roll whenever the face is below the value of what is left.`,
        play: () => {
          let x = roll(s)
          for (let i = r; i >= 1; i--) {
            const cont = rerollValue(i - 1, s)
            if (x < cont) x = roll(s)
            else break
          }
          return x
        },
        dice: 1,
        sides: s,
      }
    }
    case 'bestOf': {
      const s = level === 3 ? pick([6, 6, 8]) : 6
      const n = pick([3, 4, 4, 5])
      const keep = n === 3 ? 2 : 3
      const fair = enumerate(n, s, (d) =>
        [...d]
          .sort((a, b) => b - a)
          .slice(0, keep)
          .reduce((x, y) => x + y, 0),
      )
      return {
        family,
        text: `Roll ${diceName(n, s)} and keep the highest ${keep}. You are paid their total.`,
        fair,
        how: `Enumerate all ${s}^${n} = ${s ** n} outcomes, sort each, add the top ${keep}, and average: ${f3(fair)}. For a quick estimate the top ${keep} of ${n} each sit near the expected ${keep} largest order statistics of a ${s}-sided die (${Array.from({ length: keep }, (_, i) => f2(expOrder(n, s, n - i))).join(', ')}), which add to the same number.`,
        play: () => {
          const d = Array.from({ length: n }, () => roll(s)).sort((a, b) => b - a)
          return d.slice(0, keep).reduce((x, y) => x + y, 0)
        },
        dice: n,
        sides: s,
      }
    }
    case 'product': {
      const s = sidesFor(level)
      const three = level >= 2 && chance(0.3)
      const m = (s + 1) / 2
      const fair = three ? m ** 3 : m ** 2
      return {
        family,
        text: `Roll ${diceName(three ? 3 : 2, s)}. You are paid their product.`,
        fair,
        how: `Independent dice, so the expected product is the product of the expectations: ${f2(m)}${three ? ` × ${f2(m)} × ${f2(m)}` : ` × ${f2(m)}`} = ${f3(fair)}. Independence is what makes this work; it would fail for the square of one die.`,
        play: () => (three ? roll(s) * roll(s) * roll(s) : roll(s) * roll(s)),
        dice: three ? 3 : 2,
        sides: s,
      }
    }
    case 'explode': {
      const s = sidesFor(level)
      const m = (s + 1) / 2
      const fair = m / (1 - 1 / s)
      return {
        family,
        text: `Roll ${dieName(s)}. A ${s} counts and lets you roll again, as many times as it keeps coming up. You are paid the total.`,
        fair,
        how: `Let E be the value. One roll averages ${f2(m)}, and with probability 1/${s} you add another whole game: E = ${f2(m)} + E/${s}, so E = ${f2(m)} ÷ (1 − 1/${s}) = ${f3(fair)}.`,
        play: () => {
          let t = 0
          for (;;) {
            const x = roll(s)
            t += x
            if (x !== s) return t
          }
        },
        dice: 1,
        sides: s,
      }
    }
    case 'difference': {
      const s = sidesFor(level)
      const fair = enumerate(2, s, (d) => Math.abs(d[0] - d[1]))
      return {
        family,
        text: `Roll ${diceName(2, s)}. You are paid the difference between them.`,
        fair,
        how: `Count the ${s * s} ordered pairs by gap: gap g occurs 2(${s} − g) times for g from 1 to ${s - 1}. Σ g × 2(${s} − g) ÷ ${s * s} = ${f3(fair)}. For two d6 that is 70/36 = 1.94.`,
        play: () => Math.abs(roll(s) - roll(s)),
        dice: 2,
        sides: s,
      }
    }
    case 'doubles': {
      const s = sidesFor(level)
      const mult = pick([2, 2, 3])
      const sumMean = s + 1
      const fair = sumMean + ((mult - 1) * sumMean) / s
      return {
        family,
        text: `Roll ${diceName(2, s)}. You are paid the total, ${mult === 2 ? 'doubled' : 'tripled'} if the dice match.`,
        fair,
        how: `The plain total averages ${sumMean}. Doubles happen with probability 1/${s}, and a double's total averages ${sumMean} as well (each face equally likely), so the bonus adds (${mult} − 1) × ${sumMean}/${s} = ${f3(((mult - 1) * sumMean) / s)}. Fair ${f3(fair)}.`,
        play: () => {
          const a = roll(s)
          const b = roll(s)
          return a === b ? mult * (a + b) : a + b
        },
        dice: 2,
        sides: s,
      }
    }
    case 'threshold': {
      const s = sidesFor(level)
      const t = rint(s + 1, 2 * s - 2)
      const fair = enumerate(2, s, (d) => (d[0] + d[1] >= t ? d[0] + d[1] : 0))
      const pAbove = enumerate(2, s, (d) => (d[0] + d[1] >= t ? 1 : 0))
      return {
        family,
        text: `Roll ${diceName(2, s)}. If the total is ${t} or more you are paid the total, otherwise nothing.`,
        fair,
        how: `List the totals from ${t} to ${2 * s} with their counts out of ${s * s} and add total × count: ${Array.from(
          { length: 2 * s - t + 1 },
          (_, i) => {
            const v = t + i
            const ways = s - Math.abs(v - (s + 1))
            return `${v}×${ways}`
          },
        ).join(
          ' + ',
        )} = ${Math.round(fair * s * s)}, over ${s * s} is ${f3(fair)}. The total is at least ${t} with probability ${f3(pAbove)}, and given that it averages ${f2(fair / pAbove)}.`,
        play: () => {
          const x = roll(s) + roll(s)
          return x >= t ? x : 0
        },
        dice: 2,
        sides: s,
      }
    }
    case 'countFaces': {
      const s = sidesFor(level)
      const n = pick([3, 4, 5, 6])
      const pay = pick([5, 10, 12])
      const face = s
      const fair = (n * pay) / s
      return {
        family,
        text: `Roll ${diceName(n, s)}. You are paid ${pay} for every ${face} showing.`,
        fair,
        how: `Linearity of expectation: each die shows a ${face} with probability 1/${s}, so the expected count is ${n}/${s} = ${f3(n / s)}, and the payout is ${pay} × ${f3(n / s)} = ${f3(fair)}. No need to think about the dice together.`,
        play: () => Array.from({ length: n }, () => roll(s)).filter((x) => x === face).length * pay,
        dice: n,
        sides: s,
      }
    }
    case 'coinDie': {
      const s = sidesFor(level)
      const n1 = pick([1, 2])
      const n2 = n1 + pick([1, 2])
      const m = (s + 1) / 2
      const fair = (n1 * m + n2 * m) / 2
      return {
        family,
        text: `Flip a coin. Heads: roll ${diceName(n1, s)}. Tails: roll ${diceName(n2, s)}. You are paid the total shown.`,
        fair,
        how: `Condition on the coin. Heads: ${n1} × ${f2(m)} = ${f2(n1 * m)}. Tails: ${n2} × ${f2(m)} = ${f2(n2 * m)}. Average the two with weight 1/2 each: ${f3(fair)}.`,
        play: () => {
          const n = chance(0.5) ? n1 : n2
          return Array.from({ length: n }, () => roll(s)).reduce((a, b) => a + b, 0)
        },
        dice: n2,
        sides: s,
      }
    }
  }
}

/** Expected value of the k-th smallest of n s-sided dice (k = n is the max). */
function expOrder(n: number, s: number, k: number) {
  // P(X_(k) <= x) = P(at least k dice <= x)
  const atLeast = (x: number) => {
    const p = x / s
    let t = 0
    for (let i = k; i <= n; i++) t += choose(n, i) * p ** i * (1 - p) ** (n - i)
    return t
  }
  let e = 0
  for (let x = 1; x <= s; x++) e += x * (atLeast(x) - atLeast(x - 1))
  return e
}
function choose(n: number, k: number) {
  let r = 1
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i
  return r
}

function quoteAround(fair: number) {
  // Quotes on a 0.25 grid; width and offset scale with fair so big games get wider quotes.
  const step = fair >= 15 ? 0.5 : 0.25
  const w = pick([1, 1, 2, 2, 3]) * step * 2
  const off = pick([-3, -2, -1.5, -1, -0.5, 0, 0, 0.5, 1, 1.5, 2, 3]) * step * 2
  const mid = round(Math.round((fair + off) / step) * step, 2)
  return { bid: round(mid - w / 2, 2), ask: round(mid + w / 2, 2) }
}

const fmtQ = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(2).replace(/0$/, ''))

function next(c: GamesConfig, prev?: GamesScenario): GamesScenario {
  const fams = c.families.length ? c.families : ALL_GAMES
  let family = pick(fams)
  if (prev && fams.length > 1 && family === prev.game.family && chance(0.7)) family = pick(fams.filter((f) => f !== family))
  const game = makeGame(family, c.level)
  const play: 'take' | 'make' = c.mode === 'both' ? (prev ? (prev.play === 'take' ? 'make' : 'take') : 'take') : c.mode
  const sc: GamesScenario = {
    kind: family,
    prompt: game.text,
    tags: { family, play, sides: game.sides, level: c.level, fair: round(game.fair, 3) },
    game,
    play,
  }
  if (play === 'take') {
    const q = quoteAround(game.fair)
    sc.bid = q.bid
    sc.ask = q.ask
    const where = q.ask < game.fair ? 'cheap' : q.bid > game.fair ? 'rich' : 'fair'
    sc.tags.market = where
    sc.tags.edge = round(where === 'cheap' ? game.fair - q.ask : where === 'rich' ? q.bid - game.fair : 0, 2)
  }
  return sc
}

function resolve(s: GamesScenario, d: GamesDecision | null, c: GamesConfig): Outcome {
  const g = s.game
  const realised = g.play()
  const fairS = f2(g.fair)
  if (s.play === 'take') {
    const bid = s.bid!
    const ask = s.ask!
    const best: Side = ask < g.fair ? 'buy' : bid > g.fair ? 'sell' : 'pass'
    const bestEdge = best === 'buy' ? g.fair - ask : best === 'sell' ? bid - g.fair : 0
    const side: Side = d && 'side' in d ? d.side : 'pass'
    const ev = side === 'buy' ? g.fair - ask : side === 'sell' ? bid - g.fair : 0
    const pnl = side === 'buy' ? realised - ask : side === 'sell' ? bid - realised : 0
    const correct = side === best
    const verdict =
      best === 'buy'
        ? `The ask ${fmtQ(ask)} is below fair ${fairS}: buy, ${f2(bestEdge)} of expected edge.`
        : best === 'sell'
          ? `The bid ${fmtQ(bid)} is above fair ${fairS}: sell, ${f2(bestEdge)} of expected edge.`
          : `Fair ${fairS} sits inside ${fmtQ(bid)} at ${fmtQ(ask)}: pass.`
    return {
      points: round(ev, 2),
      correct,
      given: d === null ? 'timed out' : side,
      answer: best === 'pass' ? `pass (fair ${fairS})` : `${best} (fair ${fairS}, +${f2(bestEdge)})`,
      note: `Fair ${fairS}, came in ${realised}. ${side === 'pass' ? 'No trade.' : `Realised ${pnl > 0 ? '+' : ''}${f2(pnl)}.`}`,
      how: `${g.how} ${verdict}${correct ? '' : side === 'pass' ? ' Passing left that on the table.' : ` Your ${side} at ${fmtQ(side === 'buy' ? ask : bid)} had expected edge ${f2(ev)}.`} The single play (${realised}) is noise.`,
      tags: { side, best, ev: round(ev, 2), missedEdge: round(bestEdge - ev, 2), realised: round(pnl, 2) },
    }
  }
  const maxW = Math.max(0.5, round((g.fair * c.maxWidthPct) / 100, 2))
  if (!d || !('bid' in d)) {
    return {
      points: -1,
      correct: false,
      given: 'timed out',
      answer: `around ${fairS}`,
      note: `Fair was ${fairS}.`,
      how: `${g.how} A quote like ${f2(g.fair - maxW / 2)} at ${f2(g.fair + maxW / 2)} contains fair within the ${c.maxWidthPct}% width limit (${f2(maxW)} here).`,
      tags: { contained: false },
    }
  }
  const width = round(d.ask - d.bid, 2)
  const mid = round((d.ask + d.bid) / 2, 2)
  const skew = round(mid - g.fair, 2)
  const crossed = d.ask < d.bid
  const contained = !crossed && d.bid <= g.fair && d.ask >= g.fair
  let points: number
  let note: string
  let how: string
  if (crossed) {
    points = -2
    note = `Crossed market. Fair was ${fairS}.`
    how = `${g.how} Your bid was above your ask, a crossed market, which costs 2 points.`
  } else if (!contained) {
    const outside = d.ask < g.fair ? g.fair - d.ask : d.bid - g.fair
    points = round(-1 - outside, 2)
    note =
      d.ask < g.fair
        ? `Lifted at ${fmtQ(d.ask)}, fair ${fairS}. You sold ${f2(outside)} too cheap.`
        : `Hit at ${fmtQ(d.bid)}, fair ${fairS}. You paid ${f2(outside)} too much.`
    how = `${g.how} Your quote ${fmtQ(d.bid)} at ${fmtQ(d.ask)} does not contain ${fairS}, so the house ${d.ask < g.fair ? `lifted your ask and you sold ${f2(outside)} below fair` : `hit your bid and you bought ${f2(outside)} above fair`}. Centre on fair, then set the width: ${f2(g.fair - maxW / 2)} at ${f2(g.fair + maxW / 2)} would have scored.`
  } else if (width > maxW) {
    points = 0
    note = `Fair ${fairS} is inside, but ${f2(width)} wide is more than ${f2(maxW)} (${c.maxWidthPct}% of fair). No trade.`
    how = `${g.how} Fair is inside your quote but ${f2(width)} wide is beyond the ${c.maxWidthPct}% limit (${f2(maxW)}), so nobody trades. Tighten around ${fairS}.`
  } else {
    points = round(1 + (maxW - width) / maxW, 2)
    note = `Fair ${fairS} is inside, ${f2(width)} wide. Came in ${realised}.`
    how = `${g.how}`
  }
  return {
    points,
    correct: contained && width <= maxW,
    given: `${fmtQ(d.bid)} at ${fmtQ(d.ask)}`,
    answer: `around ${fairS}`,
    note,
    how,
    tags: { contained, width, skew, skewSign: skew > 0.05 ? 'high' : skew < -0.05 ? 'low' : 'centred', tooWide: width > maxW },
  }
}

function Scene({ scenario }: { scenario: GamesScenario }) {
  const g = scenario.game
  return (
    <div className="market games">
      <div className="market__objects games__dice" aria-hidden="true">
        {Array.from({ length: Math.min(g.dice, 5) }, (_, i) => (
          <DieFace key={i} value={null} />
        ))}
        {g.sides !== 6 && <span className="games__sides tnum">d{g.sides}</span>}
      </div>
      <p className="market__question games__text">{g.text}</p>
      {scenario.play === 'take' ? (
        <p className="market__quote tnum">
          <span className="muted">Market on the payout</span>
          <strong>
            {fmtQ(scenario.bid!)} at {fmtQ(scenario.ask!)}
          </strong>
        </p>
      ) : (
        <p className="market__quote">
          <span className="muted">Make a market on the payout</span>
        </p>
      )}
    </div>
  )
}

function Decide({
  scenario,
  onDecide,
  disabled,
}: {
  scenario: GamesScenario
  cfg: GamesConfig
  onDecide: (d: GamesDecision) => void
  disabled: boolean
}) {
  return scenario.play === 'take' ? (
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
    <QuoteInput onSubmit={(bid, ask) => onDecide({ bid, ask })} disabled={disabled} step={0.25} />
  )
}

function Settings({ cfg, setCfg }: { cfg: GamesConfig; setCfg: (f: (c: GamesConfig) => GamesConfig) => void }) {
  return (
    <>
      <Setting
        title="Mode"
        note="Take: a quote on the payout is shown, you buy, sell or pass. Make: you quote both sides and the house trades any edge you leave."
      >
        <Seg
          options={['take', 'make', 'both'] as const}
          value={cfg.mode}
          onChange={(m) => setCfg((c) => ({ ...c, mode: m }))}
          label="Mode"
          format={(m) => (m === 'both' ? 'Alternate' : m === 'take' ? 'Take' : 'Make')}
        />
      </Setting>
      <Setting
        title="Level"
        note="Level 1 is six-sided dice and the plain games. Level 2 adds twists (ties pay nothing, more re-rolls, tripled doubles). Level 3 adds 8, 10, 12 and 20-sided dice."
      >
        <Seg options={[1, 2, 3] as const} value={cfg.level} onChange={(l) => setCfg((c) => ({ ...c, level: l }))} label="Level" />
      </Setting>
      <Setting
        title="Games"
        note="Each family is one kind of game with its own way to compute fair. The result page shows which ones cost you."
      >
        <Chips
          options={ALL_GAMES}
          value={cfg.families}
          onToggle={(f) => setCfg((c) => ({ ...c, families: toggleIn(c.families, f) }))}
          labels={GAME_LABEL}
        />
        <div className="chips chips--actions">
          <button className="btn btn-ghost btn-small" onClick={() => setCfg((c) => ({ ...c, families: [...ALL_GAMES] }))}>
            All
          </button>
        </div>
      </Setting>
      <Setting title="Rounds">
        <Seg options={[10, 20, 40] as const} value={cfg.rounds} onChange={(r) => setCfg((c) => ({ ...c, rounds: r }))} label="Rounds" />
      </Setting>
      <Setting title="Time per round">
        <Seg
          options={[0, 30, 15] as const}
          value={cfg.perRoundSec}
          onChange={(t) => setCfg((c) => ({ ...c, perRoundSec: t }))}
          label="Time per round"
          format={(t) => (t === 0 ? 'No limit' : `${t}s`)}
        />
      </Setting>
      {cfg.mode !== 'take' && (
        <Setting title="Widest market" note="In make mode, a quote wider than this share of fair gets no trade and no points.">
          <Seg
            options={[10, 20, 30] as const}
            value={cfg.maxWidthPct}
            onChange={(w) => setCfg((c) => ({ ...c, maxWidthPct: w }))}
            label="Widest market"
            format={(w) => `${w}% of fair`}
          />
        </Setting>
      )}
    </>
  )
}

export const diceGamesSpec: RoundsSpec<GamesConfig, GamesScenario, GamesDecision> = {
  id: 'dice-games',
  title: 'Dice games market',
  blurb:
    'A dice game described in a sentence. The market is on its expected payout. Work out fair exactly, then trade the quote or make one.',
  defaults: { mode: 'both', rounds: 20, perRoundSec: 0, level: 1, maxWidthPct: 20, families: [...ALL_GAMES] },
  configKey: (c) =>
    `dg:${c.mode}:L${c.level}:r${c.rounds}:t${c.perRoundSec}:w${c.maxWidthPct}:${ALL_GAMES.filter((f) => c.families.includes(f)).join(',')}`,
  describe: (c) =>
    `${c.mode === 'both' ? 'take and make' : c.mode}, level ${c.level}, ${c.rounds} rounds${c.perRoundSec ? `, ${c.perRoundSec}s each` : ''}, ${c.families.length === ALL_GAMES.length ? 'all games' : `${c.families.length} games`}`,
  Settings,
  rounds: (c) => c.rounds,
  perRoundSec: (c) => c.perRoundSec,
  next,
  Scene,
  Decide,
  resolve,
  pointsLabel: 'expected edge in points of the payout',
  places: 1,
  unit: ' pts',
  hint: 'B buy, S sell, P pass. In make mode type bid, Tab, ask, Enter. Esc to stop',
  breakdowns: [
    {
      title: 'By game',
      key: (e) => GAME_LABEL[(e.tags?.family as GameFamily) ?? 'highLow'] ?? null,
      order: ALL_GAMES.map((g) => GAME_LABEL[g]),
    },
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
