import { useCallback, useEffect, useRef, useState } from 'react'
import type { Attempt, EventLog } from '../../lib/types'
import { pick, round, shuffle } from '../../lib/random'
import { RunFrame, Seg, Setting } from '../shared/Frames'
import { useEscape } from '../shared/hooks'
import { CardFace, DieFace } from '../rounds/specs/sumMarket'
import type { CognitiveSpec, Finished } from './spec'

/**
 * Stop or roll: optimal stopping by hand. Roll a die (or draw a card from
 * a shrinking deck) up to n times; after each you may stop and bank the
 * value or go on, and the last one is forced. The engine knows the optimal
 * rule by dynamic programming, so every decision has an exact expected
 * cost: stopping at x when continuing is worth V costs V − x, continuing
 * when x > V costs x − V. The score is the share of the optimal expected
 * value your decisions kept, averaged over rounds; 100 is perfect play.
 */
export interface StopConfig {
  mode: 'dice' | 'cards' | 'both'
  draws: 3 | 5 | 8
  sides: 6 | 10
  rounds: 10 | 20 | 30
}

/** Dice: V[k] is the expected value of playing optimally with k rolls still to come, before rolling. */
export function diceValues(sides: number, draws: number) {
  const V: number[] = [(sides + 1) / 2]
  for (let k = 1; k < draws; k++) {
    let e = 0
    for (let x = 1; x <= sides; x++) e += Math.max(x, V[k - 1])
    V.push(e / sides)
  }
  return V
}

/** Cards: expected value of drawing now from the set `mask` with k draws including this one, optimal after. */
const cardMemo = new Map<string, number>()
export function cardValue(mask: number, k: number): number {
  const key = `${mask}:${k}`
  const m = cardMemo.get(key)
  if (m !== undefined) return m
  let total = 0
  let count = 0
  for (let x = 1; x <= 13; x++) {
    if (!(mask & (1 << (x - 1)))) continue
    count++
    if (k <= 1) total += x
    else total += Math.max(x, cardValue(mask & ~(1 << (x - 1)), k - 1))
  }
  const v = count ? total / count : 0
  cardMemo.set(key, v)
  return v
}

const FULL = (1 << 13) - 1
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

interface Round {
  mode: 'dice' | 'cards'
  deck: number[]
  /** Values drawn so far. */
  drawn: number[]
  /** Expected value of the round under optimal play, before the first draw. */
  optimalStart: number
  loss: number
  decisions: number
}

function Run({ cfg, onDone, onQuit }: { cfg: StopConfig; onDone: (f: Finished) => void; onQuit: () => void }) {
  const [phase, setPhase] = useState<'countdown' | 'play' | 'between' | 'done'>('countdown')
  const [count, setCount] = useState(3)
  const [roundNo, setRoundNo] = useState(0)
  const [rd, setRd] = useState<Round | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const logs = useRef<EventLog[]>([])
  const startAt = useRef(0)
  const shownAt = useRef(0)
  const effs = useRef<number[]>([])
  const rdRef = useRef<Round | null>(null)
  rdRef.current = rd
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  useEscape(onQuit)

  const V = useRef(diceValues(cfg.sides, cfg.draws)).current

  const newRound = useCallback(() => {
    const mode: 'dice' | 'cards' = cfg.mode === 'both' ? pick(['dice', 'cards']) : cfg.mode
    const deck =
      mode === 'cards'
        ? shuffle(Array.from({ length: 13 }, (_, i) => i + 1))
        : Array.from({ length: cfg.draws }, () => 1 + Math.floor(Math.random() * cfg.sides))
    const optimalStart = mode === 'cards' ? cardValue(FULL, cfg.draws) : V[cfg.draws - 1]
    const r: Round = { mode, deck, drawn: [deck[0]], optimalStart, loss: 0, decisions: 0 }
    setRd(r)
    setNote(null)
    setPhase('play')
    shownAt.current = performance.now()
  }, [cfg, V])

  useEffect(() => {
    if (phase !== 'countdown') return
    if (count === 0) {
      startAt.current = performance.now()
      newRound()
      return
    }
    const t = setTimeout(() => setCount((c) => c - 1), 700)
    return () => clearTimeout(t)
  }, [phase, count, newRound])

  const finish = useCallback(() => {
    setPhase('done')
    const ok = logs.current.filter((l) => l.correct).length
    const eff = effs.current.length ? effs.current.reduce((a, b) => a + b, 0) / effs.current.length : 0
    onDone({
      logs: logs.current,
      score: round(eff * 100, 1),
      correct: ok,
      wrong: logs.current.length - ok,
      durationSec: Math.round((performance.now() - startAt.current) / 1000),
      meta: { efficiency: round(eff * 100, 1) },
    })
  }, [onDone])

  /** The value of going on from the current position, and the rule in words. */
  const continueValue = (r: Round) => {
    const left = cfg.draws - r.drawn.length
    if (r.mode === 'dice') return V[left - 1]
    let mask = FULL
    for (const x of r.drawn) mask &= ~(1 << (x - 1))
    return cardValue(mask, left)
  }

  const endRound = (r: Round, kept: number) => {
    const eff = r.optimalStart > 0 ? Math.max(0, (r.optimalStart - r.loss) / r.optimalStart) : 1
    effs.current.push(eff)
    const avg = effs.current.reduce((a, b) => a + b, 0) / effs.current.length
    setScore(round(avg * 100, 1))
    setNote(
      `Kept ${r.mode === 'cards' ? RANKS[kept - 1] : kept}. Optimal play is worth ${r.optimalStart.toFixed(2)} a round; your decisions gave up ${r.loss.toFixed(2)} of it (${Math.round(eff * 100)}% kept).`,
    )
    setPhase('between')
    setTimeout(() => {
      const done = roundNo + 1
      if (done >= cfg.rounds) finish()
      else {
        setRoundNo(done)
        newRound()
      }
    }, 2000)
  }

  const decide = (action: 'stop' | 'go') => {
    const r = rdRef.current
    if (!r || phaseRef.current !== 'play') return
    const x = r.drawn[r.drawn.length - 1]
    const left = cfg.draws - r.drawn.length
    if (left === 0) return
    const cont = continueValue(r)
    const best: 'stop' | 'go' = x >= cont ? 'stop' : 'go'
    const loss = action === 'stop' ? Math.max(0, cont - x) : Math.max(0, x - cont)
    const correct = loss < 1e-9
    const label = r.mode === 'cards' ? RANKS[x - 1] : String(x)
    const band = x <= cont - 1 ? 'well below' : x < cont ? 'just below' : x < cont + 1 ? 'just above' : 'well above'
    logs.current.push({
      kind: r.mode,
      prompt: `${r.mode === 'cards' ? 'card' : 'die'} ${label}, ${left} ${left === 1 ? 'draw' : 'draws'} left`,
      answer: best === 'stop' ? `stop (going on is worth ${cont.toFixed(2)})` : `go on (worth ${cont.toFixed(2)})`,
      given: action === 'stop' ? 'stop' : 'go on',
      ms: performance.now() - shownAt.current,
      misses: 0,
      correct,
      points: round(-loss, 3),
      how: correct
        ? undefined
        : r.mode === 'dice'
          ? `With ${left} ${left === 1 ? 'roll' : 'rolls'} left, rolling on is worth ${cont.toFixed(2)} on average: work backwards from the last roll (worth ${((cfg.sides + 1) / 2).toFixed(1)}), and at each stage keep any face above the value of what is left. ${action === 'stop' ? `Stopping at ${x} gives up ${(cont - x).toFixed(2)}.` : `${x} is above ${cont.toFixed(2)}, so rolling on gives up ${(x - cont).toFixed(2)} in expectation.`}`
          : `With ${left} ${left === 1 ? 'draw' : 'draws'} left and ${13 - r.drawn.length} cards still in the deck (average ${(() => {
              let m = FULL
              for (const d of r.drawn) m &= ~(1 << (d - 1))
              let t = 0
              let n = 0
              for (let v = 1; v <= 13; v++) {
                if (m & (1 << (v - 1))) {
                  t += v
                  n++
                }
              }
              return (t / n).toFixed(2)
            })()}), drawing on is worth ${cont.toFixed(2)} under optimal play. ${action === 'stop' ? `Stopping at ${label} (${x}) gives up ${(cont - x).toFixed(2)}.` : `${label} (${x}) is above ${cont.toFixed(2)}, so drawing on gives up ${(x - cont).toFixed(2)}.`} The deck shrinks, so the threshold moves as high cards leave.`,
      tags: {
        mode: r.mode,
        value: x,
        left,
        cont: round(cont, 2),
        action,
        best,
        loss: round(loss, 3),
        band,
        sides: r.mode === 'dice' ? cfg.sides : 13,
      },
    })
    const next: Round = { ...r, loss: r.loss + loss, decisions: r.decisions + 1 }
    if (action === 'stop') {
      setRd(next)
      endRound(next, x)
      return
    }
    const drawn = [...r.drawn, r.deck[r.drawn.length]]
    const after = { ...next, drawn }
    setRd(after)
    shownAt.current = performance.now()
    if (cfg.draws - drawn.length === 0) endRound(after, drawn[drawn.length - 1])
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 's' || e.key === 'S' || e.key === 'Enter') decide('stop')
      else if (e.key === 'r' || e.key === 'R' || e.key === ' ') {
        e.preventDefault()
        decide('go')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg])

  const x = rd ? rd.drawn[rd.drawn.length - 1] : null
  const left = rd ? cfg.draws - rd.drawn.length : 0
  const forced = rd !== null && left === 0
  return (
    <RunFrame
      pct={((cfg.rounds - roundNo) / cfg.rounds) * 100}
      left={
        <>
          {Math.min(roundNo + 1, cfg.rounds)}/{cfg.rounds}
        </>
      }
      right={`${score.toFixed(0)}%`}
      countdown={phase === 'countdown' ? count : null}
      hint="S or Enter stops and keeps the value. R or Space goes on. The last draw is forced. Esc to stop"
      wide
    >
      {rd && (
        <div className="stop">
          <p className="muted stop__rule">
            {rd.mode === 'dice'
              ? `Up to ${cfg.draws} rolls of a ${cfg.sides}-sided die. `
              : `Up to ${cfg.draws} cards from a 13-card deck, ace 1 to king 13, no replacement. `}
            Keep the last one you take.
          </p>
          <div className="stop__history" aria-label="Taken so far">
            {rd.drawn.slice(0, -1).map((v, i) => (
              <span key={i} className="stop__past tnum">
                {rd.mode === 'cards' ? RANKS[v - 1] : v}
              </span>
            ))}
          </div>
          <div className="stop__face">{rd.mode === 'cards' ? <CardFace value={x} /> : <DieFace value={x} />}</div>
          <p className="stop__left tnum">{forced ? 'Last one, kept.' : `${left} ${left === 1 ? 'draw' : 'draws'} left`}</p>
          {!forced && phase === 'play' && (
            <div className="choices choices--row">
              <button className="choice choice--buy" onClick={() => decide('stop')}>
                <span className="choice__key">S</span>
                <span>Stop, keep {rd.mode === 'cards' ? RANKS[x! - 1] : x}</span>
              </button>
              <button className="choice" onClick={() => decide('go')}>
                <span className="choice__key">R</span>
                <span>{rd.mode === 'cards' ? 'Draw again' : 'Roll again'}</span>
              </button>
            </div>
          )}
          {note && (
            <div className="rounds__feedback is-right" role="status">
              <span>{note}</span>
            </div>
          )}
        </div>
      )}
    </RunFrame>
  )
}

function Summary({ attempt }: { attempt: Attempt<StopConfig> }) {
  const rows = [1, 2, 3, 4, 5, 6, 7]
    .map((k) => {
      const at = attempt.answers.filter((l) => Number(l.tags?.left) === k)
      if (!at.length) return null
      const stops = at.filter((l) => l.tags?.action === 'stop').map((l) => Number(l.tags?.value))
      const goes = at.filter((l) => l.tags?.action === 'go').map((l) => Number(l.tags?.value))
      const cont = at.reduce((s, l) => s + Number(l.tags?.cont ?? 0), 0) / at.length
      const loss = at.reduce((s, l) => s + Number(l.tags?.loss ?? 0), 0)
      return {
        k,
        n: at.length,
        lowestStop: stops.length ? Math.min(...stops) : null,
        highestGo: goes.length ? Math.max(...goes) : null,
        cont,
        loss,
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
  if (!rows.length) return null
  return (
    <section className="result__section">
      <h2>Your thresholds</h2>
      <p className="muted">
        By draws left: the lowest value you stopped on, the highest you rolled past, and what going on was worth on average. Stop when the
        value beats the number in the last column.
      </p>
      <table className="optable tnum">
        <thead>
          <tr>
            <th>Draws left</th>
            <th>Decisions</th>
            <th>Lowest stop</th>
            <th>Highest go</th>
            <th>Given up</th>
            <th>Going on worth</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.k}>
              <td>{r.k}</td>
              <td>{r.n}</td>
              <td>{r.lowestStop ?? 'never stopped'}</td>
              <td>{r.highestGo ?? 'never went on'}</td>
              <td>{r.loss.toFixed(2)}</td>
              <td>{r.cont.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function Settings({ cfg, setCfg }: { cfg: StopConfig; setCfg: (f: (c: StopConfig) => StopConfig) => void }) {
  return (
    <>
      <Setting
        title="What you draw"
        note="Dice are independent, so the rule is a fixed threshold per roll left. Cards come from a shrinking 13-card deck, so the threshold moves with what has gone."
      >
        <Seg
          options={['dice', 'cards', 'both'] as const}
          value={cfg.mode}
          onChange={(m) => setCfg((c) => ({ ...c, mode: m }))}
          label="Mode"
          format={(m) => (m === 'both' ? 'Mixed' : m === 'dice' ? 'Dice' : 'Cards')}
        />
      </Setting>
      <Setting title="Draws a round">
        <Seg options={[3, 5, 8] as const} value={cfg.draws} onChange={(d) => setCfg((c) => ({ ...c, draws: d }))} label="Draws" />
      </Setting>
      {cfg.mode !== 'cards' && (
        <Setting title="Die">
          <Seg
            options={[6, 10] as const}
            value={cfg.sides}
            onChange={(s) => setCfg((c) => ({ ...c, sides: s }))}
            label="Sides"
            format={(s) => `${s} sides`}
          />
        </Setting>
      )}
      <Setting title="Rounds">
        <Seg options={[10, 20, 30] as const} value={cfg.rounds} onChange={(r) => setCfg((c) => ({ ...c, rounds: r }))} label="Rounds" />
      </Setting>
    </>
  )
}

export const stopOrRollSpec: CognitiveSpec<StopConfig> = {
  id: 'stop-or-roll',
  title: 'Stop or roll',
  blurb:
    'Roll up to n times, keep the last one you take. Stop too early and you leave value, roll too long and you throw it away. Scored against the optimal rule, decision by decision.',
  defaults: { mode: 'dice', draws: 5, sides: 6, rounds: 20 },
  configKey: (c) => `sr:${c.mode}:d${c.draws}:s${c.mode === 'cards' ? 13 : c.sides}:r${c.rounds}`,
  describe: (c) =>
    `${c.mode === 'both' ? 'dice and cards' : c.mode}, ${c.draws} draws${c.mode !== 'cards' ? `, d${c.sides}` : ''}, ${c.rounds} rounds`,
  Settings,
  Run,
  Summary,
  review: 'Decisions that gave up expected value, with what going on was worth at that moment.',
  pointsLabel: 'the share of the optimal expected value your decisions kept, 100 is perfect',
  unit: '%',
  places: 1,
  pace: true,
  paceLabel: 'Seconds per decision, in order. Blue is a right call, red gave something up.',
  breakdowns: [
    {
      title: 'By draws left',
      key: (e) => `${e.tags?.left} left`,
      order: ['1 left', '2 left', '3 left', '4 left', '5 left', '6 left', '7 left'],
    },
    {
      title: 'By value against the threshold',
      key: (e) => String(e.tags?.band ?? ''),
      order: ['well below', 'just below', 'just above', 'well above'],
    },
    { title: 'By what you did', key: (e) => (e.tags?.action === 'stop' ? 'Stopped' : 'Went on'), order: ['Stopped', 'Went on'] },
  ],
}
