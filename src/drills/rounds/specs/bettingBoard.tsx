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
export type PropFamily = 'coin' | 'dice' | 'cards' | 'urn'
export const FAMILY_LABEL: Record<PropFamily, string> = { coin: 'Coins', dice: 'Dice', cards: 'Cards', urn: 'Urns' }
export const ALL_FAMILIES: PropFamily[] = ['coin', 'dice', 'cards', 'urn']

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

function gen(family: PropFamily): { text: string; p: number } {
  switch (family) {
    case 'coin': {
      const v = pick(['exact', 'atLeast', 'run', 'allSame'])
      if (v === 'exact') {
        const n = rint(2, 5)
        const k = rint(0, n)
        return { text: `exactly ${k} heads in ${n} flips`, p: choose(n, k) / 2 ** n }
      }
      if (v === 'atLeast') {
        const n = rint(2, 6)
        const k = rint(1, n)
        return { text: `at least ${k} heads in ${n} flips`, p: binomAtLeast(n, k, 0.5) }
      }
      if (v === 'run') {
        const n = rint(2, 4)
        return { text: `${n} heads in a row`, p: 1 / 2 ** n }
      }
      const n = rint(2, 4)
      return { text: `${n} flips all the same`, p: 2 / 2 ** n }
    }
    case 'dice': {
      const v = pick(['sum', 'atLeastOneSix', 'faceAtLeast', 'doubles', 'maxIs'])
      if (v === 'sum') {
        const s = rint(2, 12)
        const ways = 6 - Math.abs(s - 7)
        return { text: `two dice sum to ${s}`, p: ways / 36 }
      }
      if (v === 'atLeastOneSix') {
        const n = rint(1, 4)
        return { text: `at least one six in ${n} ${n === 1 ? 'roll' : 'rolls'}`, p: 1 - (5 / 6) ** n }
      }
      if (v === 'faceAtLeast') {
        const k = rint(2, 6)
        return { text: `one die shows ${k} or more`, p: (7 - k) / 6 }
      }
      if (v === 'doubles') return { text: 'two dice show doubles', p: 1 / 6 }
      const k = rint(2, 6)
      return { text: `higher of two dice is exactly ${k}`, p: (2 * k - 1) / 36 }
    }
    case 'cards': {
      const v = pick(['suit', 'face', 'ace2', 'pair', 'sameSuit2', 'redBoth'])
      if (v === 'suit') return { text: `one card drawn is a ${pick(['heart', 'spade', 'diamond', 'club'])}`, p: 1 / 4 }
      if (v === 'face') return { text: 'one card drawn is a face card (J, Q, K)', p: 12 / 52 }
      if (v === 'ace2') return { text: 'at least one ace in two cards', p: 1 - (48 / 52) * (47 / 51) }
      if (v === 'pair') return { text: 'two cards drawn are a pair', p: 3 / 51 }
      if (v === 'sameSuit2') return { text: 'two cards drawn share a suit', p: 12 / 51 }
      return { text: 'two cards drawn are both red', p: (26 / 52) * (25 / 51) }
    }
    case 'urn': {
      const r = rint(2, 6)
      const b = rint(2, 6)
      const v = pick(['one', 'twoSame', 'twoRed'])
      if (v === 'one') return { text: `one marble from ${r} red and ${b} blue is red`, p: r / (r + b) }
      if (v === 'twoRed') return { text: `two marbles from ${r} red and ${b} blue, no replacement, both red`, p: (r / (r + b)) * ((r - 1) / (r + b - 1)) }
      const n = r + b
      return { text: `two marbles from ${r} red and ${b} blue, no replacement, same colour`, p: (r * (r - 1) + b * (b - 1)) / (n * (n - 1)) }
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
    props.push({ text: g.text, p: g.p, pays, family: fam, ev })
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
  return {
    points: round(points, 2),
    correct: right === s.props.length,
    given: d === null ? 'timed out' : `${taken.filter(Boolean).length} taken, ${right}/${s.props.length} right`,
    answer: s.props.map((p, i) => (p.ev > 0 ? i + 1 : null)).filter(Boolean).join(', ') || 'none',
    note: right === s.props.length ? `All ${s.props.length} right. Edge ${round(maxPts, 2)} of ${round(maxPts, 2)}.` : `${right} of ${s.props.length} right. ${missed ? `${missed} edge${missed > 1 ? 's' : ''} missed. ` : ''}${bad ? `${bad} bad bet${bad > 1 ? 's' : ''} taken.` : ''}`,
    tags: { right, missed, bad, maxPts: round(maxPts, 2) },
  }
}

function Scene() {
  return null
}

function Decide({ scenario, onDecide, disabled }: { scenario: BoardScenario; cfg: BoardConfig; onDecide: (d: BoardDecision) => void; disabled: boolean }) {
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
            <button className={'board__prop' + (taken[i] ? ' is-taken' : '')} aria-pressed={taken[i]} disabled={disabled} onClick={() => setTaken((t) => t.map((x, j) => (j === i ? !x : x)))}>
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
        <Seg options={[0, 45, 25] as const} value={cfg.perRoundSec} onChange={(t) => setCfg((c) => ({ ...c, perRoundSec: t }))} label="Time per board" format={(t) => (t === 0 ? 'No limit' : `${t}s`)} />
      </Setting>
      <Setting title="Propositions" note="A payout of 3 to 1 is fair for a 25% event. Take a bet when the payout beats fair.">
        <Chips options={ALL_FAMILIES} value={cfg.families} onToggle={(f) => setCfg((c) => ({ ...c, families: toggleIn(c.families, f) }))} labels={FAMILY_LABEL} />
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
      key: (e) => (e.given === null ? 'Timed out' : e.correct ? 'All right' : Number(e.tags?.missed ?? 0) > 0 && Number(e.tags?.bad ?? 0) > 0 ? 'Missed and bad' : Number(e.tags?.missed ?? 0) > 0 ? 'Missed an edge' : 'Took a bad bet'),
      order: ['All right', 'Missed an edge', 'Took a bad bet', 'Missed and bad', 'Timed out'],
    },
  ],
}
