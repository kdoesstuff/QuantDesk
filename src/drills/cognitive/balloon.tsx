import { useCallback, useEffect, useRef, useState } from 'react'
import type { Attempt, EventLog } from '../../lib/types'
import { pick } from '../../lib/random'
import { RunFrame, Seg, Setting } from '../shared/Frames'
import { useEscape } from '../shared/hooks'
import type { CognitiveSpec, Finished } from './spec'

/**
 * The balloon task (Lejuez et al., 2002), with three colours that pop at
 * different rates. Each pump adds to the balloon's pot; a pop loses the
 * pot; collecting banks it. The pop point of each balloon is uniform on 1
 * to its colour's limit, so the pumps that maximise expected value are
 * about half the limit. The score is points banked. The log keeps pumps per
 * colour, so the analysis can see whether you learned the colours and
 * whether you adjust after a pop.
 */
export interface BalloonConfig {
  balloons: 15 | 30 | 45
  perPump: 5 | 10
  /** Whether the colours have different limits. */
  colours: boolean
}

type Colour = 'blue' | 'yellow' | 'red'
const LIMIT: Record<Colour, number> = { blue: 128, yellow: 32, red: 8 }
const LABEL: Record<Colour, string> = { blue: 'Blue', yellow: 'Yellow', red: 'Red' }

function Run({ cfg, onDone, onQuit }: { cfg: BalloonConfig; onDone: (f: Finished) => void; onQuit: () => void }) {
  const [phase, setPhase] = useState<'countdown' | 'play' | 'burst' | 'banked' | 'done'>('countdown')
  const [count, setCount] = useState(3)
  const [n, setN] = useState(0)
  const [colour, setColour] = useState<Colour>('blue')
  const [pumps, setPumps] = useState(0)
  const [bank, setBank] = useState(0)
  const logs = useRef<EventLog[]>([])
  const startAt = useRef(0)
  const balloonAt = useRef(0)
  const popAt = useRef(1)
  const pumpsRef = useRef(0)
  const bankRef = useRef(0)
  const nRef = useRef(0)
  const colourRef = useRef<Colour>('blue')
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const lastPump = useRef(0)
  const pumpGaps = useRef<number[]>([])

  useEscape(onQuit)

  const newBalloon = useCallback(() => {
    const c: Colour = cfg.colours ? pick(['blue', 'yellow', 'red']) : 'blue'
    const limit = LIMIT[c]
    popAt.current = 1 + Math.floor(Math.random() * limit)
    colourRef.current = c
    setColour(c)
    pumpsRef.current = 0
    setPumps(0)
    pumpGaps.current = []
    balloonAt.current = performance.now()
    lastPump.current = balloonAt.current
    setPhase('play')
  }, [cfg.colours])

  useEffect(() => {
    if (phase !== 'countdown') return
    if (count === 0) {
      startAt.current = performance.now()
      newBalloon()
      return
    }
    const t = setTimeout(() => setCount((c) => c - 1), 650)
    return () => clearTimeout(t)
  }, [phase, count, newBalloon])

  const finish = useCallback(() => {
    setPhase('done')
    const banked = logs.current.filter((l) => l.correct)
    onDone({
      logs: logs.current,
      score: bankRef.current,
      correct: banked.length,
      wrong: logs.current.length - banked.length,
      durationSec: Math.round((performance.now() - startAt.current) / 1000),
      meta: { banked: bankRef.current, pops: logs.current.length - banked.length },
    })
  }, [onDone])

  const endBalloon = useCallback(
    (popped: boolean) => {
      const c = colourRef.current
      const k = pumpsRef.current
      const limit = LIMIT[c]
      const optimal = Math.round(limit / 2)
      const gaps = pumpGaps.current
      const meanGap = gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : 0
      const prev = logs.current[logs.current.length - 1]
      logs.current.push({
        kind: popped ? 'pop' : 'bank',
        prompt: `${LABEL[c]} balloon`,
        answer: `${optimal} pumps is the sweet spot`,
        given: popped ? `popped at ${k}` : `banked at ${k}`,
        ms: performance.now() - balloonAt.current,
        misses: popped ? 1 : 0,
        correct: !popped,
        points: popped ? 0 : k * cfg.perPump,
        tags: {
          colour: c,
          pumps: k,
          limit,
          optimal,
          overshoot: k - optimal,
          popped,
          afterPop: prev ? !!prev.tags?.popped : false,
          meanGapMs: meanGap,
          index: nRef.current + 1,
        },
      })
      if (!popped) {
        bankRef.current += k * cfg.perPump
        setBank(bankRef.current)
      }
      nRef.current += 1
      setN(nRef.current)
      setPhase(popped ? 'burst' : 'banked')
      setTimeout(() => {
        if (nRef.current >= cfg.balloons) finish()
        else newBalloon()
      }, 800)
    },
    [cfg.balloons, cfg.perPump, finish, newBalloon],
  )

  const pump = useCallback(() => {
    if (phaseRef.current !== 'play') return
    const now = performance.now()
    pumpGaps.current.push(now - lastPump.current)
    lastPump.current = now
    pumpsRef.current += 1
    setPumps(pumpsRef.current)
    if (pumpsRef.current >= popAt.current) endBalloon(true)
  }, [endBalloon])

  const collect = useCallback(() => {
    if (phaseRef.current !== 'play' || pumpsRef.current === 0) return
    endBalloon(false)
  }, [endBalloon])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault()
        pump()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        collect()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pump, collect])

  const size = 60 + Math.min(260, pumps * (colour === 'blue' ? 2.2 : colour === 'yellow' ? 6 : 18))
  return (
    <RunFrame
      pct={((cfg.balloons - n) / cfg.balloons) * 100}
      left={
        <>
          {Math.min(n + 1, cfg.balloons)}/{cfg.balloons}
          <span className="run__sep">pot {pumps * cfg.perPump}</span>
        </>
      }
      right={bank}
      countdown={phase === 'countdown' ? count : null}
      hint="Space pumps, Enter collects. Each colour pops at its own rate. Esc to stop"
    >
      <div className="balloon-stage">
        <div
          className={`balloon balloon--${colour}` + (phase === 'burst' ? ' is-burst' : phase === 'banked' ? ' is-banked' : '')}
          style={{ width: size, height: size * 1.15 }}
        >
          <span className="tnum">{phase === 'burst' ? 'pop' : phase === 'banked' ? `+${pumps * cfg.perPump}` : pumps}</span>
        </div>
        <div className="balloon-actions">
          <button className="btn btn-yellow" onClick={pump} disabled={phase !== 'play'}>
            Pump
          </button>
          <button className="btn btn-primary" onClick={collect} disabled={phase !== 'play' || pumps === 0}>
            Collect
          </button>
        </div>
      </div>
    </RunFrame>
  )
}

function Summary({ attempt }: { attempt: Attempt<BalloonConfig> }) {
  const byColour = (['blue', 'yellow', 'red'] as Colour[])
    .map((c) => {
      const rows = attempt.answers.filter((l) => l.tags?.colour === c)
      const banked = rows.filter((l) => !l.tags?.popped)
      const adj = banked.length ? banked.reduce((a, l) => a + Number(l.tags?.pumps), 0) / banked.length : 0
      return { c, n: rows.length, pops: rows.length - banked.length, adj, optimal: Math.round(LIMIT[c] / 2) }
    })
    .filter((r) => r.n > 0)
  return (
    <section className="result__section">
      <h2>Pumps by colour</h2>
      <table className="optable tnum">
        <thead>
          <tr>
            <th></th>
            <th>Balloons</th>
            <th>Popped</th>
            <th>Pumps when banked</th>
            <th>Sweet spot</th>
          </tr>
        </thead>
        <tbody>
          {byColour.map((r) => (
            <tr key={r.c}>
              <td>{LABEL[r.c]}</td>
              <td>{r.n}</td>
              <td>{r.pops}</td>
              <td>{r.adj ? r.adj.toFixed(1) : 'none'}</td>
              <td>{r.optimal}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted">The sweet spot is half the colour's limit. Pumping well under it leaves money; well over it pops too often.</p>
    </section>
  )
}

function Settings({ cfg, setCfg }: { cfg: BalloonConfig; setCfg: (f: (c: BalloonConfig) => BalloonConfig) => void }) {
  return (
    <>
      <Setting title="Balloons">
        <Seg
          options={[15, 30, 45] as const}
          value={cfg.balloons}
          onChange={(b) => setCfg((c) => ({ ...c, balloons: b }))}
          label="Balloons"
        />
      </Setting>
      <Setting title="Points a pump">
        <Seg options={[5, 10] as const} value={cfg.perPump} onChange={(p) => setCfg((c) => ({ ...c, perPump: p }))} label="Per pump" />
      </Setting>
      <Setting
        title="Colours"
        note="With colours on, blue pops somewhere in 1 to 128 pumps, yellow in 1 to 32, red in 1 to 8. You are not told which is which."
      >
        <Seg
          options={[true, false] as const}
          value={cfg.colours}
          onChange={(v) => setCfg((c) => ({ ...c, colours: v }))}
          label="Colours"
          format={(v) => (v ? 'Three colours' : 'Blue only')}
        />
      </Setting>
    </>
  )
}

export const balloonSpec: CognitiveSpec<BalloonConfig> = {
  id: 'balloon',
  title: 'Balloon',
  blurb: 'Pump for points, collect before it pops. Three colours, three risks, and you learn them by playing. The score is points banked.',
  defaults: { balloons: 30, perPump: 5, colours: true },
  configKey: (c) => `bl:n${c.balloons}:p${c.perPump}:${c.colours ? 'rgb' : 'mono'}`,
  describe: (c) => `${c.balloons} balloons, ${c.perPump} a pump, ${c.colours ? 'three colours' : 'blue only'}`,
  Settings,
  Run,
  Summary,
  pointsLabel: 'points banked',
  unit: ' pts',
  pace: false,
  breakdowns: [
    { title: 'By colour', key: (e) => LABEL[(e.tags?.colour as Colour) ?? 'blue'], order: ['Blue', 'Yellow', 'Red'] },
    { title: 'After a pop', key: (e) => (e.tags?.afterPop ? 'Right after a pop' : 'Otherwise'), order: ['Otherwise', 'Right after a pop'] },
  ],
}
