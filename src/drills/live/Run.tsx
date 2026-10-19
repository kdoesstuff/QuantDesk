import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Attempt, EventLog } from '../../lib/types'
import { store, uid } from '../../lib/storage'
import { loadDrillConfig } from '../../lib/config'
import { gauss, pick, round } from '../../lib/random'
import { RunFrame } from '../shared/Frames'
import { useEscape, useRunClock } from '../shared/hooks'
import { Choices } from '../rounds/controls'
import type { BotStyle, LiveConfig, LiveSpec } from './spec'

type Side = 'buy' | 'sell'

interface Position {
  side: Side
  price: number
  tick: number
  trueP: number
  marketP: number
  /** The state when the position was taken, for the review. */
  explain: string
}

interface RoundState<S> {
  state: S
  tick: number
  marketP: number
  alpha: number
  style: 'lag' | 'jumpy' | 'efficient'
  bid: number
  ask: number
  position: Position | null
  /** Best available expected edge seen so far, in cents, and when. */
  bestEdge: number
  bestEdgeTick: number
  path: { t: number; p: number; m: number }[]
  done: boolean
  outcome: 0 | 1 | null
}

function pickStyle(bot: BotStyle): 'lag' | 'jumpy' | 'efficient' {
  if (bot === 'lag') return pick(['lag', 'lag', 'lag', 'efficient'])
  if (bot === 'jumpy') return pick(['jumpy', 'jumpy', 'jumpy', 'efficient'])
  return pick(['lag', 'jumpy', 'efficient'])
}

function alphaFor(style: 'lag' | 'jumpy' | 'efficient') {
  return style === 'lag' ? 0.25 + Math.random() * 0.25 : style === 'jumpy' ? 1.4 + Math.random() * 0.5 : 1
}

export default function LiveRun<C extends LiveConfig, S>({ spec }: { spec: LiveSpec<C, S> }) {
  const nav = useNavigate()
  const cfg = useRef<C>(loadDrillConfig(spec.id, spec.defaults)).current
  const P = spec.process
  const [rs, setRs] = useState<RoundState<S>>(() => fresh())
  const [roundNo, setRoundNo] = useState(0)
  const [score, setScore] = useState(0)
  const [feedback, setFeedback] = useState<string | null>(null)
  const logs = useRef<EventLog[]>([])
  const scoreRef = useRef(0)
  const rsRef = useRef(rs)
  rsRef.current = rs
  const finished = useRef(false)
  const timer = useRef<number | null>(null)

  function fresh(): RoundState<S> {
    const state = P.init(cfg)
    const style = pickStyle(cfg.bot)
    const p = P.trueP(state, cfg)
    const marketP = clamp(p + (style === 'efficient' ? 0 : gauss() * 0.04))
    const q = quote(marketP, cfg.half)
    return {
      state,
      tick: 0,
      marketP,
      alpha: alphaFor(style),
      style,
      bid: q.bid,
      ask: q.ask,
      position: null,
      bestEdge: 0,
      bestEdgeTick: 0,
      path: [{ t: 0, p, m: marketP }],
      done: false,
      outcome: null,
    }
  }

  const finish = useCallback(async () => {
    if (finished.current) return
    finished.current = true
    const correct = logs.current.filter((l) => l.correct).length
    const attempt: Attempt<C> = {
      id: uid(),
      ts: Date.now(),
      drill: spec.id,
      configKey: spec.configKey(cfg),
      config: cfg,
      score: round(scoreRef.current, 0),
      correct,
      wrong: logs.current.length - correct,
      durationSec: Math.round((performance.now() - startAt.current) / 1000),
      answers: logs.current,
    }
    await store.saveAttempt(attempt)
    nav(`/drill/${spec.id}/result/${attempt.id}`, { replace: true })
  }, [cfg, nav, spec])

  const { phase, count, elapsed, stop, startAt } = useRunClock(0, finish)
  useEscape(() => nav(`/drill/${spec.id}`))

  // One tick of the process and the market.
  const tick = useCallback(() => {
    setRs((cur) => {
      if (cur.done) return cur
      const state = P.step(cur.state, cfg)
      const p = P.trueP(state, cfg)
      const done = P.done(state, cfg)
      let marketP = cur.marketP + cur.alpha * (p - cur.marketP) + (cur.style === 'efficient' ? 0 : gauss() * 0.015)
      if (done) marketP = p
      marketP = clamp(marketP)
      const q = quote(marketP, cfg.half)
      const edgeBuy = p * 100 - q.ask
      const edgeSell = q.bid - p * 100
      const best = Math.max(edgeBuy, edgeSell)
      const next: RoundState<S> = {
        ...cur,
        state,
        tick: cur.tick + 1,
        marketP,
        bid: q.bid,
        ask: q.ask,
        bestEdge: !cur.position && best > cur.bestEdge ? best : cur.bestEdge,
        bestEdgeTick: !cur.position && best > cur.bestEdge ? cur.tick + 1 : cur.bestEdgeTick,
        path: [...cur.path, { t: cur.tick + 1, p, m: marketP }],
        done,
        outcome: done ? P.outcome(state, cfg) : null,
      }
      return next
    })
  }, [P, cfg])

  // Clock: tick while running and the round is not done.
  useEffect(() => {
    if (phase !== 'running') return
    if (rs.done) return
    timer.current = window.setTimeout(tick, cfg.tickMs)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [phase, rs, tick, cfg.tickMs])

  // Resolution: log the round, show feedback, start the next.
  useEffect(() => {
    if (!rs.done || feedback !== null) return
    const o = rs.outcome!
    const pos = rs.position
    const payout = o * 100
    const edge = pos ? (pos.side === 'buy' ? pos.trueP * 100 - pos.price : pos.price - pos.trueP * 100) : 0
    const realised = pos ? (pos.side === 'buy' ? payout - pos.price : pos.price - payout) : 0
    const missed = !pos && rs.bestEdge >= 4
    const n = rs.path.length
    const entryFrac = pos ? pos.tick / Math.max(1, n - 1) : 1
    const wrong = pos ? edge <= 0 : rs.bestEdge >= 4
    const how = !wrong
      ? undefined
      : pos
        ? `${pos.explain} So fair was ${Math.round(pos.trueP * 100)}c when you ${pos.side === 'buy' ? `bought at the ask ${pos.price}c` : `sold at the bid ${pos.price}c`}, giving expected edge ${edge.toFixed(1)}c. ${pos.side === 'buy' ? 'Buying only pays when the ask is below fair' : 'Selling only pays when the bid is above fair'}; the ${rs.style} market was ${pos.side === 'buy' ? 'above' : 'below'} fair there. The resolution (${o ? 'YES' : 'NO'}) is one draw and does not judge the trade.`
        : `You passed, but at tick ${rs.bestEdgeTick} the quote was ${rs.bestEdge.toFixed(1)}c away from fair, the biggest gap of the round. ${rs.style === 'lag' ? 'A lagging market moves toward fair slowly, so right after the process moves the stale quote is the trade.' : rs.style === 'jumpy' ? 'A jumpy market overshoots fair, so fade the move right after a big jump.' : 'This market tracked fair closely, so the edge was brief.'} ${P.explain(rs.state, cfg)}`
    logs.current.push({
      kind: pos ? pos.side : 'pass',
      prompt: `${P.describe(rs.state, cfg)}, ${rs.style} market`,
      answer: o ? 'YES' : 'NO',
      given: pos ? `${pos.side} at ${pos.price}` : 'pass',
      ms: pos ? pos.tick * cfg.tickMs : n * cfg.tickMs,
      misses: 0,
      correct: pos ? edge > 0 : rs.bestEdge < 4,
      points: round(edge, 1),
      how,
      tags: {
        side: pos ? pos.side : 'pass',
        bot: rs.style,
        edge: round(edge, 1),
        realised,
        missedEdge: round(rs.bestEdge, 1),
        missed,
        entry: pos ? (entryFrac < 0.34 ? 'early' : entryFrac < 0.67 ? 'middle' : 'late') : 'none',
        entryTrueP: pos ? round(pos.trueP, 2) : 0,
        entryMarketP: pos ? round(pos.marketP, 2) : 0,
        lean: pos
          ? pos.side === 'buy'
            ? pos.trueP * 100 > pos.price
              ? 'right side'
              : 'wrong side'
            : pos.price > pos.trueP * 100
              ? 'right side'
              : 'wrong side'
          : 'none',
        outcome: o,
        ticks: n,
        path: JSON.stringify(rs.path.map((x) => [round(x.p, 3), round(x.m, 3)])),
      },
    })
    scoreRef.current += edge
    setScore(scoreRef.current)
    setFeedback(
      pos
        ? `Resolved ${o ? 'YES' : 'NO'}. You ${pos.side === 'buy' ? 'bought' : 'sold'} at ${pos.price} when fair was ${Math.round(pos.trueP * 100)}: ${edge >= 0 ? '+' : ''}${edge.toFixed(1)} expected, ${realised >= 0 ? '+' : ''}${realised} realised.`
        : missed
          ? `Resolved ${o ? 'YES' : 'NO'}. You passed. There was ${rs.bestEdge.toFixed(1)} of edge on offer at tick ${rs.bestEdgeTick}.`
          : `Resolved ${o ? 'YES' : 'NO'}. You passed, and the market never offered much. Fine.`,
    )
    const t = setTimeout(() => {
      setFeedback(null)
      const done = logs.current.length
      if (done >= cfg.rounds) {
        stop()
        return
      }
      setRoundNo(done)
      setRs(fresh())
    }, 2200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rs.done])

  const act = useCallback(
    (side: Side) => {
      const cur = rsRef.current
      if (phase !== 'running' || cur.done || cur.position) return
      const p = P.trueP(cur.state, cfg)
      setRs({
        ...cur,
        position: {
          side,
          price: side === 'buy' ? cur.ask : cur.bid,
          tick: cur.tick,
          trueP: p,
          marketP: cur.marketP,
          explain: P.explain(cur.state, cfg),
        },
      })
    },
    [P, cfg, phase],
  )

  const pos = rs.position
  const fmtScore = (x: number) => (x > 0 ? '+' : '') + x.toFixed(0)
  return (
    <RunFrame
      pct={((cfg.rounds - roundNo) / cfg.rounds) * 100}
      left={
        <>
          {Math.floor(elapsed)}s
          <span className="run__sep">
            {Math.min(roundNo + 1, cfg.rounds)}/{cfg.rounds}
          </span>
        </>
      }
      right={fmtScore(score)}
      countdown={phase === 'countdown' ? count : null}
      hint={spec.hint ?? 'B buys YES at the ask, S sells YES at the bid. One position a round, held to resolution. Esc to stop'}
      wide
    >
      <div className="live">
        <p className="live__contract muted">{P.contract(cfg)}</p>
        <P.View state={rs.state} cfg={cfg} />
        <div className="live__market">
          <div className="live__quote tnum">
            <span className="live__side">
              <small>Bid</small>
              {rs.bid}
            </span>
            <span className="live__side">
              <small>Ask</small>
              {rs.ask}
            </span>
          </div>
          <PricePath path={rs.path} entry={pos} />
        </div>
        {pos ? (
          <p className="live__position tnum">
            {pos.side === 'buy' ? 'Long YES' : 'Short YES'} from {pos.price}. Holding to resolution.
          </p>
        ) : (
          <Choices
            options={[
              { value: 'buy', label: `Buy YES at ${rs.ask}`, key: 'b', tone: 'buy' },
              { value: 'sell', label: `Sell YES at ${rs.bid}`, key: 's', tone: 'sell' },
            ]}
            onPick={act}
            disabled={phase !== 'running' || rs.done}
          />
        )}
        {feedback && (
          <div className="rounds__feedback is-right" role="status">
            <span>{feedback}</span>
          </div>
        )}
      </div>
    </RunFrame>
  )
}

function clamp(x: number) {
  return Math.min(0.99, Math.max(0.01, x))
}

function quote(marketP: number, half: number) {
  const mid = Math.round(marketP * 100)
  return { bid: Math.max(1, mid - half), ask: Math.min(99, mid + half) }
}

/** The market price so far. The true probability is drawn only after the round resolves, so it is never a hint. */
function PricePath({ path, entry }: { path: { t: number; p: number; m: number }[]; entry: Position | null }) {
  const W = 320
  const H = 70
  const n = Math.max(2, path.length)
  const x = (t: number) => 4 + (t / Math.max(1, n - 1)) * (W - 8)
  const y = (p: number) => H - 4 - p * (H - 8)
  const d = path.map((q, i) => `${i ? 'L' : 'M'}${x(q.t).toFixed(1)},${y(q.m).toFixed(1)}`).join(' ')
  return (
    <svg className="live__path" viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true">
      <line x1={4} x2={W - 4} y1={y(0.5)} y2={y(0.5)} stroke="var(--ground-3)" strokeDasharray="3 4" />
      <path d={d} fill="none" stroke="var(--yellow)" strokeWidth="2" />
      {entry && <circle cx={x(entry.tick)} cy={y(entry.marketP)} r="4" fill={entry.side === 'buy' ? 'var(--right)' : 'var(--wrong)'} />}
    </svg>
  )
}
