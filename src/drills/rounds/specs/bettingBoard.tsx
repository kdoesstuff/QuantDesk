import { useEffect, useState } from 'react'
import { pick, rint, round } from '../../../lib/random'
import { Chips, Seg, Setting, toggleIn } from '../../shared/Frames'
import type { Outcome, RoundsSpec, Scenario } from '../spec'

/**
 * A board of propositions with payouts. Some pay more than fair, some less.
 * Take every bet with an edge and nothing else. Every proposition has an
 * exact probability from coins, dice, cards or an urn, so the fair payout is
 * a number you can compute, not a feeling.
 */
export type PropFamily = 'coin' | 'dice' | 'cards' | 'urn' | 'walk' | 'classic'
export const FAMILY_LABEL: Record<PropFamily, string> = {
  coin: 'Coins',
  dice: 'Dice',
  cards: 'Cards',
  urn: 'Urns',
  walk: 'Walks and runs',
  classic: 'Classics',
}
export const ALL_FAMILIES: PropFamily[] = ['coin', 'dice', 'cards', 'urn', 'walk', 'classic']

export interface BoardConfig {
  rounds: 5 | 10 | 20
  size: 4 | 5 | 6
  perRoundSec: 0 | 45 | 25
  families: PropFamily[]
}

export interface Prop {
  text: string
  p: number
  /** Pays this much per unit staked on a win. */
  pays: number
  family: PropFamily
  ev: number
  /** Where the probability comes from, for the review. */
  how: string
}

export interface BoardScenario extends Scenario {
  props: Prop[]
}

export type BoardDecision = { taken: boolean[] }

function choose(n: number, k: number) {
  if (k < 0 || k > n) return 0
  let r = 1
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i
  return r
}
function binomAtLeast(n: number, k: number, p: number) {
  let s = 0
  for (let i = k; i <= n; i++) s += choose(n, i) * p ** i * (1 - p) ** (n - i)
  return s
}
/** Number of length-n coin sequences with no two heads in a row: Fibonacci. */
function noTwoHeads(n: number) {
  let a = 1
  let b = 2
  for (let i = 2; i <= n; i++) [a, b] = [b, a + b]
  return n === 0 ? 1 : n === 1 ? 2 : b
}
/** P(all six faces appear in n rolls) by inclusion and exclusion. */
function allFaces(n: number) {
  let s = 0
  for (let k = 0; k <= 6; k++) s += (k % 2 === 0 ? 1 : -1) * choose(6, k) * ((6 - k) / 6) ** n
  return s
}
const pct = (p: number) => `${round(p * 100, 1)}%`
const fr = (a: number, b: number) => `${a}/${b}`

function gen(family: PropFamily): { text: string; p: number; how: string } {
  switch (family) {
    case 'coin': {
      const v = pick(['exact', 'atLeast', 'run', 'allSame'])
      if (v === 'exact') {
        const n = rint(2, 5)
        const k = rint(0, n)
        return {
          text: `exactly ${k} heads in ${n} flips`,
          p: choose(n, k) / 2 ** n,
          how: `${choose(n, k)} of the ${2 ** n} equally likely sequences have exactly ${k} heads (choose ${k} of ${n}): ${fr(choose(n, k), 2 ** n)} = ${pct(choose(n, k) / 2 ** n)}.`,
        }
      }
      if (v === 'atLeast') {
        const n = rint(2, 6)
        const k = rint(1, n)
        const p = binomAtLeast(n, k, 0.5)
        return {
          text: `at least ${k} heads in ${n} flips`,
          p,
          how: `Count sequences with ${k} or more heads out of ${2 ** n}: ${Array.from({ length: n - k + 1 }, (_, i) => choose(n, k + i)).join(' + ')} = ${Math.round(p * 2 ** n)}, so ${pct(p)}.`,
        }
      }
      if (v === 'run') {
        const n = rint(2, 4)
        return {
          text: `${n} heads in a row`,
          p: 1 / 2 ** n,
          how: `Each flip is a head with chance 1/2, independent: (1/2)^${n} = ${fr(1, 2 ** n)} = ${pct(1 / 2 ** n)}.`,
        }
      }
      const n = rint(2, 4)
      return {
        text: `${n} flips all the same`,
        p: 2 / 2 ** n,
        how: `The first flip can be anything; the other ${n - 1} must match it: (1/2)^${n - 1} = ${fr(1, 2 ** (n - 1))} = ${pct(2 / 2 ** n)}.`,
      }
    }
    case 'dice': {
      const v = pick(['sum', 'atLeastOneSix', 'faceAtLeast', 'doubles', 'maxIs'])
      if (v === 'sum') {
        const s = rint(2, 12)
        const ways = 6 - Math.abs(s - 7)
        return {
          text: `two dice sum to ${s}`,
          p: ways / 36,
          how: `${ways} of the 36 ordered rolls add to ${s} (the count rises to 6 at a sum of 7 and falls either side): ${fr(ways, 36)} = ${pct(ways / 36)}.`,
        }
      }
      if (v === 'atLeastOneSix') {
        const n = rint(1, 4)
        return {
          text: `at least one six in ${n} ${n === 1 ? 'roll' : 'rolls'}`,
          p: 1 - (5 / 6) ** n,
          how: `Complement: no six in ${n} ${n === 1 ? 'roll' : 'rolls'} is (5/6)^${n} = ${pct((5 / 6) ** n)}, so at least one six is ${pct(1 - (5 / 6) ** n)}.`,
        }
      }
      if (v === 'faceAtLeast') {
        const k = rint(2, 6)
        return {
          text: `one die shows ${k} or more`,
          p: (7 - k) / 6,
          how: `The faces ${k} to 6 are ${7 - k} of the 6: ${fr(7 - k, 6)} = ${pct((7 - k) / 6)}.`,
        }
      }
      if (v === 'doubles')
        return { text: 'two dice show doubles', p: 1 / 6, how: 'Whatever the first die shows, the second matches it with chance 1/6.' }
      const k = rint(2, 6)
      return {
        text: `higher of two dice is exactly ${k}`,
        p: (2 * k - 1) / 36,
        how: `Both dice at most ${k}: ${k}² = ${k * k} rolls. Both at most ${k - 1}: ${(k - 1) ** 2}. The difference, ${2 * k - 1}, has the maximum exactly ${k}: ${fr(2 * k - 1, 36)} = ${pct((2 * k - 1) / 36)}.`,
      }
    }
    case 'cards': {
      const v = pick(['suit', 'face', 'ace2', 'pair', 'sameSuit2', 'redBoth'])
      if (v === 'suit')
        return {
          text: `one card drawn is a ${pick(['heart', 'spade', 'diamond', 'club'])}`,
          p: 1 / 4,
          how: '13 of the 52 cards are that suit: 1/4.',
        }
      if (v === 'face')
        return {
          text: 'one card drawn is a face card (J, Q, K)',
          p: 12 / 52,
          how: 'Three face ranks in four suits make 12 cards out of 52: 3/13 = 23.1%.',
        }
      if (v === 'ace2')
        return {
          text: 'at least one ace in two cards',
          p: 1 - (48 / 52) * (47 / 51),
          how: `Complement: no ace twice is 48/52 × 47/51 = ${pct((48 / 52) * (47 / 51))}, so at least one ace is ${pct(1 - (48 / 52) * (47 / 51))}.`,
        }
      if (v === 'pair')
        return {
          text: 'two cards drawn are a pair',
          p: 3 / 51,
          how: 'After the first card, 3 of the remaining 51 cards share its rank: 3/51 = 5.9%.',
        }
      if (v === 'sameSuit2')
        return {
          text: 'two cards drawn share a suit',
          p: 12 / 51,
          how: 'After the first card, 12 of the remaining 51 cards share its suit: 12/51 = 23.5%.',
        }
      return {
        text: 'two cards drawn are both red',
        p: (26 / 52) * (25 / 51),
        how: '26/52 for the first red, then 25/51 for the second: 25/102 = 24.5%.',
      }
    }
    case 'urn': {
      const r = rint(2, 6)
      const b = rint(2, 6)
      const v = pick(['one', 'twoSame', 'twoRed'])
      if (v === 'one')
        return {
          text: `one marble from ${r} red and ${b} blue is red`,
          p: r / (r + b),
          how: `${r} red out of ${r + b}: ${fr(r, r + b)} = ${pct(r / (r + b))}.`,
        }
      if (v === 'twoRed')
        return {
          text: `two marbles from ${r} red and ${b} blue, no replacement, both red`,
          p: (r / (r + b)) * ((r - 1) / (r + b - 1)),
          how: `${fr(r, r + b)} for the first red, then ${fr(r - 1, r + b - 1)} for the second: ${pct((r / (r + b)) * ((r - 1) / (r + b - 1)))}.`,
        }
      const n = r + b
      return {
        text: `two marbles from ${r} red and ${b} blue, no replacement, same colour`,
        p: (r * (r - 1) + b * (b - 1)) / (n * (n - 1)),
        how: `Both red: ${fr(r, n)} × ${fr(r - 1, n - 1)}. Both blue: ${fr(b, n)} × ${fr(b - 1, n - 1)}. Add: (${r * (r - 1)} + ${b * (b - 1)})/${n * (n - 1)} = ${pct((r * (r - 1) + b * (b - 1)) / (n * (n - 1)))}.`,
      }
    }
    case 'walk': {
      const v = pick(['ruin', 'noTwoHeads', 'reachBefore'])
      if (v === 'ruin') {
        const a = rint(1, 9)
        const b = a + rint(1, 10)
        return {
          text: `a fair coin bettor with ${a} reaches ${b} before 0 (1 a flip)`,
          p: a / b,
          how: `Fair game, so the expected bankroll never changes: ${a} = P(reach ${b}) × ${b} + 0, giving P = ${fr(a, b)} = ${pct(a / b)}. Your current stake over your target.`,
        }
      }
      if (v === 'noTwoHeads') {
        const n = rint(3, 6)
        const good = noTwoHeads(n)
        return {
          text: `no two heads in a row in ${n} flips`,
          p: good / 2 ** n,
          how: `Sequences with no HH follow the Fibonacci pattern 2, 3, 5, 8, 13, 21 for 1 to 6 flips: ${good} of ${2 ** n}, so ${pct(good / 2 ** n)}.`,
        }
      }
      const k = rint(2, 4)
      const kk = k + rint(1, 3)
      // Fair coin starting at 0: reach +k before -kk with probability kk/(k+kk)
      return {
        text: `a fair walk from 0 hits +${k} before −${kk}`,
        p: kk / (k + kk),
        how: `A fair walk stopped at +${k} or −${kk} has expectation 0: P × ${k} − (1 − P) × ${kk} = 0, so P = ${kk}/${k + kk} = ${pct(kk / (k + kk))}. The nearer barrier is the likelier one.`,
      }
    }
    case 'classic': {
      const v = pick(['newton', 'allFaces', 'birthday', 'aceBeforeKing', 'sameBirthdayAsYou'])
      if (v === 'newton') {
        const k = rint(1, 3)
        const p = binomAtLeast(6 * k, k, 1 / 6)
        return {
          text: `at least ${k} ${k === 1 ? 'six' : 'sixes'} in ${6 * k} dice`,
          p,
          how: `Newton's problem. Count the ways to get fewer than ${k} sixes in ${6 * k} dice and subtract from 1: ${pct(p)}. More dice for the same ratio makes it harder, so one six in six (66.5%) beats two in twelve (61.9%) beats three in eighteen (59.7%).`,
        }
      }
      if (v === 'allFaces') {
        const n = pick([6, 7, 8, 9, 10, 12])
        const p = allFaces(n)
        return {
          text: `all six faces appear in ${n} rolls`,
          p,
          how: `Inclusion and exclusion over the faces that never appear: Σ (−1)^k C(6,k) ((6−k)/6)^${n} = ${pct(p)}. With exactly 6 rolls it is 6!/6^6 = 1.5%; it takes about 15 rolls to pass 50%.`,
        }
      }
      if (v === 'birthday') {
        const n = pick([10, 15, 20, 23, 25, 30, 35, 40])
        let q = 1
        for (let i = 0; i < n; i++) q *= (365 - i) / 365
        return {
          text: `${n} people, two share a birthday`,
          p: 1 - q,
          how: `Complement: all ${n} birthdays different is 365/365 × 364/365 × ... × ${365 - n + 1}/365 = ${pct(q)}, so a shared birthday is ${pct(1 - q)}. Pairs grow like n², which is why 23 people already pass 50%.`,
        }
      }
      if (v === 'aceBeforeKing') {
        return {
          text: 'dealing through a deck, an ace comes before any king',
          p: 1 / 2,
          how: 'Only the relative order of the 8 aces and kings matters, and by symmetry the first of those 8 is an ace with probability 4/8 = 1/2.',
        }
      }
      const n = pick([100, 150, 200, 253, 300])
      const p = 1 - (364 / 365) ** n
      return {
        text: `among ${n} people, one shares your birthday`,
        p,
        how: `Each person matches your birthday with chance 1/365. Complement: (364/365)^${n} = ${pct(1 - p)} that nobody does, so ${pct(p)}. Matching a fixed date is far rarer than any two matching, which is why 253 people are needed for 50%.`,
      }
    }
  }
}

function fairPays(p: number) {
  return (1 - p) / p
}

function fmtPays(x: number) {
  if (x >= 10) return String(Math.round(x))
  return String(round(x, x >= 3 ? 1 : 2))
}

function next(c: BoardConfig): BoardScenario {
  const fams = c.families.length ? c.families : ALL_FAMILIES
  const props: Prop[] = []
  const seen = new Set<string>()
  let guard = 0
  while (props.length < c.size && guard++ < 200) {
    const fam = pick(fams)
    const g = gen(fam)
    if (seen.has(g.text) || g.p <= 0.02 || g.p >= 0.98) continue
    seen.add(g.text)
    const fair = fairPays(g.p)
    // Offered payout: a little or a lot off fair, either way.
    const factor = pick([0.6, 0.75, 0.85, 0.92, 0.97, 1.03, 1.08, 1.15, 1.3, 1.5])
    const pays = Number(fmtPays(fair * factor))
    const ev = round(pays * g.p - (1 - g.p), 3)
    if (Math.abs(ev) < 0.01) continue
    props.push({ text: g.text, p: g.p, pays, family: fam, ev, how: g.how })
  }
  return {
    kind: 'board',
    prompt: `${props.filter((p) => p.ev > 0).length} of ${props.length} had edge`,
    tags: { size: props.length, plus: props.filter((p) => p.ev > 0).length },
    props,
  }
}

function resolve(s: BoardScenario, d: BoardDecision | null): Outcome {
  const taken = d?.taken ?? s.props.map(() => false)
  let points = 0
  let right = 0
  let missed = 0
  let bad = 0
  const perProp: Record<string, number | string | boolean> = {}
  s.props.forEach((p, i) => {
    const plus = p.ev > 0
    if (taken[i]) points += p.ev
    else if (plus) points -= p.ev
    if (taken[i] === plus) right++
    else if (plus) missed++
    else bad++
    perProp[`p${i}`] = taken[i] === plus
  })
  const maxPts = s.props.reduce((a, p) => a + Math.max(0, p.ev), 0)
  const how = s.props
    .map((p, i) => {
      const fair = fairPays(p.p)
      const plus = p.ev > 0
      const you = taken[i] ? 'you took it' : 'you left it'
      const verdict = taken[i] === plus ? 'right' : plus ? 'an edge missed' : 'a bad bet'
      return `${i + 1}. ${p.text}: P = ${pct(p.p)} (${p.how}) Fair payout ${fmtPays(fair)} to 1, offered ${fmtPays(p.pays)} to 1, so expected value per unit ${p.ev > 0 ? '+' : ''}${round(p.ev, 2)}: ${plus ? 'take' : 'leave'}. ${you[0].toUpperCase()}${you.slice(1)}, ${verdict}.`
    })
    .join('\n')
  return {
    points: round(points, 2),
    correct: right === s.props.length,
    given: d === null ? 'timed out' : `${taken.filter(Boolean).length} taken, ${right}/${s.props.length} right`,
    answer:
      s.props
        .map((p, i) => (p.ev > 0 ? i + 1 : null))
        .filter(Boolean)
        .join(', ') || 'none',
    note:
      right === s.props.length
        ? `All ${s.props.length} right. Edge ${round(maxPts, 2)} of ${round(maxPts, 2)}.`
        : `${right} of ${s.props.length} right. ${missed ? `${missed} edge${missed > 1 ? 's' : ''} missed. ` : ''}${bad ? `${bad} bad bet${bad > 1 ? 's' : ''} taken.` : ''}`,
    how: `A bet has edge when the offered payout beats the fair payout (1 − P)/P, that is when P × pays − (1 − P) > 0.\n${how}`,
    tags: { right, missed, bad, maxPts: round(maxPts, 2) },
  }
}

function Scene() {
  return null
}

function Decide({
  scenario,
  onDecide,
  disabled,
}: {
  scenario: BoardScenario
  cfg: BoardConfig
  onDecide: (d: BoardDecision) => void
  disabled: boolean
}) {
  const [taken, setTaken] = useState<boolean[]>(() => scenario.props.map(() => false))
  useEffect(() => setTaken(scenario.props.map(() => false)), [scenario])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (disabled) return
      const n = Number(e.key)
      if (n >= 1 && n <= scenario.props.length) setTaken((t) => t.map((x, i) => (i === n - 1 ? !x : x)))
      else if (e.key === 'Enter') onDecide({ taken })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [disabled, onDecide, scenario, taken])
  return (
    <div className="board">
      <ul className="board__list">
        {scenario.props.map((p, i) => (
          <li key={i}>
            <button
              className={'board__prop' + (taken[i] ? ' is-taken' : '')}
              aria-pressed={taken[i]}
              disabled={disabled}
              onClick={() => setTaken((t) => t.map((x, j) => (j === i ? !x : x)))}
            >
              <span className="choice__key">{i + 1}</span>
              <span className="board__text">{p.text}</span>
              <span className="board__pays tnum">pays {fmtPays(p.pays)} to 1</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="board__actions">
        <button className="btn btn-primary" disabled={disabled} onClick={() => onDecide({ taken })}>
          Place bets
        </button>
        <span className="faint">Enter. Number keys toggle a bet.</span>
      </div>
    </div>
  )
}

function Settings({ cfg, setCfg }: { cfg: BoardConfig; setCfg: (f: (c: BoardConfig) => BoardConfig) => void }) {
  return (
    <>
      <Setting title="Boards">
        <Seg options={[5, 10, 20] as const} value={cfg.rounds} onChange={(r) => setCfg((c) => ({ ...c, rounds: r }))} label="Boards" />
      </Setting>
      <Setting title="Bets per board">
        <Seg options={[4, 5, 6] as const} value={cfg.size} onChange={(s) => setCfg((c) => ({ ...c, size: s }))} label="Bets per board" />
      </Setting>
      <Setting title="Time per board">
        <Seg
          options={[0, 45, 25] as const}
          value={cfg.perRoundSec}
          onChange={(t) => setCfg((c) => ({ ...c, perRoundSec: t }))}
          label="Time per board"
          format={(t) => (t === 0 ? 'No limit' : `${t}s`)}
        />
      </Setting>
      <Setting title="Propositions" note="A payout of 3 to 1 is fair for a 25% event. Take a bet when the payout beats fair.">
        <Chips
          options={ALL_FAMILIES}
          value={cfg.families}
          onToggle={(f) => setCfg((c) => ({ ...c, families: toggleIn(c.families, f) }))}
          labels={FAMILY_LABEL}
        />
      </Setting>
    </>
  )
}

export const bettingBoardSpec: RoundsSpec<BoardConfig, BoardScenario, BoardDecision> = {
  id: 'betting-board',
  title: 'Betting board',
  blurb: 'A board of propositions with payouts. Some pay more than fair, some less. Take every bet with an edge and nothing else.',
  defaults: { rounds: 10, size: 5, perRoundSec: 0, families: [...ALL_FAMILIES] },
  configKey: (c) => `bb:r${c.rounds}:s${c.size}:t${c.perRoundSec}:${ALL_FAMILIES.filter((f) => c.families.includes(f)).join(',')}`,
  describe: (c) => `${c.rounds} boards of ${c.size}${c.perRoundSec ? `, ${c.perRoundSec}s each` : ''}`,
  Settings,
  rounds: (c) => c.rounds,
  perRoundSec: (c) => c.perRoundSec,
  next,
  Scene,
  Decide,
  resolve,
  pointsLabel: 'edge taken minus edge missed, per unit staked',
  places: 2,
  unit: ' pts',
  hint: 'Number keys toggle, Enter places. Esc to stop',
  breakdowns: [
    {
      title: 'By result',
      key: (e) =>
        e.given === null
          ? 'Timed out'
          : e.correct
            ? 'All right'
            : Number(e.tags?.missed ?? 0) > 0 && Number(e.tags?.bad ?? 0) > 0
              ? 'Missed and bad'
              : Number(e.tags?.missed ?? 0) > 0
                ? 'Missed an edge'
                : 'Took a bad bet',
      order: ['All right', 'Missed an edge', 'Took a bad bet', 'Missed and bad', 'Timed out'],
    },
  ],
}
