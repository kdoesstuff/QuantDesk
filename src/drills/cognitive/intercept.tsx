import { useCallback, useEffect, useRef, useState } from 'react'
import type { Attempt, EventLog } from '../../lib/types'
import { chance, rint } from '../../lib/random'
import { RunFrame, Seg, Setting } from '../shared/Frames'
import { useEscape } from '../shared/hooks'
import type { CognitiveSpec, Finished } from './spec'

/**
 * Interception. A target crosses the top of the field; a cannon at the
 * bottom fires a shot that takes a fixed time to climb. Fire so the shot
 * and the target arrive together. The log keeps the signed timing error
 * of every shot, so the analysis can see a habit of firing early or late,
 * and whether that depends on speed or direction.
 */
export interface InterceptConfig {
  targets: 10 | 20 | 30
  /** 1 slow targets, 3 fast. */
  speed: 1 | 2 | 3
  /** Seconds for the shot to climb to the target's line. */
  travel: 0.6 | 1 | 1.5
}

interface Target {
  x0: number
  v: number
  r: number
  t0: number
  fired: number | null
  hitAt: number | null
  result: 'hit' | 'miss' | null
}

function Run({ cfg, onDone, onQuit }: { cfg: InterceptConfig; onDone: (f: Finished) => void; onQuit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [phase, setPhase] = useState<'countdown' | 'play' | 'done'>('countdown')
  const [count, setCount] = useState(3)
  const [n, setN] = useState(0)
  const [hits, setHits] = useState(0)
  const logs = useRef<EventLog[]>([])
  const startAt = useRef(0)
  const target = useRef<Target | null>(null)
  const hitsRef = useRef(0)
  const nRef = useRef(0)
  const W = useRef(800)
  const H = useRef(480)

  useEscape(onQuit)

  const spawn = useCallback(() => {
    const w = W.current
    const base = cfg.speed === 1 ? 160 : cfg.speed === 2 ? 260 : 380
    const v = (chance(0.5) ? 1 : -1) * (base + rint(-40, 80))
    const r = 16
    target.current = { x0: v > 0 ? -r : w + r, v, r, t0: performance.now(), fired: null, hitAt: null, result: null }
  }, [cfg.speed])

  useEffect(() => {
    if (phase !== 'countdown') return
    if (count === 0) {
      startAt.current = performance.now()
      setPhase('play')
      spawn()
      return
    }
    const t = setTimeout(() => setCount((c) => c - 1), 650)
    return () => clearTimeout(t)
  }, [phase, count, spawn])

  const finish = useCallback(() => {
    setPhase('done')
    onDone({
      logs: logs.current,
      score: hitsRef.current,
      correct: hitsRef.current,
      wrong: logs.current.length - hitsRef.current,
      durationSec: Math.round((performance.now() - startAt.current) / 1000),
      meta: { hits: hitsRef.current, targets: cfg.targets },
    })
  }, [cfg.targets, onDone])

  const record = useCallback(
    (t: Target, result: 'hit' | 'miss', errorMs: number | null) => {
      nRef.current += 1
      setN(nRef.current)
      if (result === 'hit') {
        hitsRef.current += 1
        setHits(hitsRef.current)
      }
      logs.current.push({
        kind: result,
        prompt: `target ${t.v > 0 ? 'left to right' : 'right to left'} at ${Math.abs(Math.round(t.v))} px/s`,
        answer: 'on time',
        given: t.fired === null ? null : errorMs === null ? 'fired' : `${errorMs > 0 ? 'late' : 'early'} by ${Math.abs(errorMs)} ms`,
        ms: t.fired === null ? 0 : t.fired - t.t0,
        misses: result === 'hit' ? 0 : 1,
        correct: result === 'hit',
        tags: {
          errorMs: errorMs ?? 0,
          lean: errorMs === null ? 'none' : errorMs > 40 ? 'late' : errorMs < -40 ? 'early' : 'on time',
          direction: t.v > 0 ? 'rightward' : 'leftward',
          speed: Math.abs(t.v) < 220 ? 'slow' : Math.abs(t.v) < 330 ? 'medium' : 'fast',
          noShot: t.fired === null,
          travel: cfg.travel,
        },
      })
      if (nRef.current >= cfg.targets) setTimeout(finish, 500)
      else setTimeout(spawn, 500)
      target.current = null
    },
    [cfg.targets, cfg.travel, finish, spawn],
  )

  const fire = useCallback(() => {
    const t = target.current
    if (phase !== 'play' || !t || t.fired !== null) return
    t.fired = performance.now()
    t.hitAt = t.fired + cfg.travel * 1000
  }, [cfg.travel, phase])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        fire()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fire])

  // Draw loop
  useEffect(() => {
    if (phase !== 'play') return
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const resize = () => {
      W.current = canvas.clientWidth
      H.current = canvas.clientHeight
      canvas.width = W.current * dpr
      canvas.height = H.current * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim()
    let raf = 0
    const draw = () => {
      const w = W.current
      const h = H.current
      const now = performance.now()
      ctx.clearRect(0, 0, w, h)
      const yT = h * 0.18
      const cx = w / 2
      const cy = h - 28
      // Track line
      ctx.strokeStyle = css('--ground-3')
      ctx.setLineDash([4, 6])
      ctx.beginPath()
      ctx.moveTo(0, yT)
      ctx.lineTo(w, yT)
      ctx.stroke()
      ctx.setLineDash([])
      // Cannon
      ctx.fillStyle = css('--ink-2')
      ctx.beginPath()
      ctx.arc(cx, cy, 14, Math.PI, 0)
      ctx.fill()
      ctx.fillRect(cx - 4, cy - 34, 8, 24)
      const t = target.current
      if (t) {
        const x = t.x0 + (t.v * (now - t.t0)) / 1000
        // Target
        ctx.fillStyle = css('--yellow')
        ctx.beginPath()
        ctx.arc(x, yT, t.r, 0, Math.PI * 2)
        ctx.fill()
        // Shot
        if (t.fired !== null && t.hitAt !== null) {
          const u = Math.min(1, (now - t.fired) / (cfg.travel * 1000))
          const sy = cy - 34 - u * (cy - 34 - yT)
          ctx.fillStyle = css('--blue-2')
          ctx.beginPath()
          ctx.arc(cx, sy, 6, 0, Math.PI * 2)
          ctx.fill()
          if (now >= t.hitAt && t.result === null) {
            const xAtArrival = t.x0 + (t.v * (t.hitAt - t.t0)) / 1000
            const hit = Math.abs(xAtArrival - cx) <= t.r + 6
            // Signed timing error: when the target was at the cannon line versus when the shot arrived.
            const tAtCannon = t.t0 + ((cx - t.x0) / t.v) * 1000
            const errorMs = Math.round(t.hitAt - tAtCannon)
            t.result = hit ? 'hit' : 'miss'
            record(t, t.result, errorMs)
          }
        }
        // Gone past without a shot or after a miss
        const gone = t.v > 0 ? x > w + t.r : x < -t.r
        if (gone && t.result === null) {
          t.result = 'miss'
          record(t, 'miss', t.fired === null ? null : 0)
        }
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [phase, cfg.travel, record])

  return (
    <RunFrame
      pct={((cfg.targets - n) / cfg.targets) * 100}
      left={
        <>
          {n}/{cfg.targets}
        </>
      }
      right={hits}
      countdown={phase === 'countdown' ? count : null}
      hint={`Space or click to fire. The shot takes ${cfg.travel}s to climb. Esc to stop`}
      wide
    >
      <canvas ref={canvasRef} className="intercept" onPointerDown={fire} aria-label="Interception field" />
    </RunFrame>
  )
}

function Summary({ attempt }: { attempt: Attempt<InterceptConfig> }) {
  const shots = attempt.answers.filter((l) => !l.tags?.noShot)
  if (shots.length === 0) return null
  const errs = shots.map((l) => Number(l.tags?.errorMs ?? 0))
  const mean = errs.reduce((a, b) => a + b, 0) / errs.length
  const sd = Math.sqrt(errs.reduce((a, b) => a + (b - mean) ** 2, 0) / errs.length)
  return (
    <section className="result__section">
      <h2>Timing</h2>
      <p className="muted">
        {attempt.correct} of {attempt.answers.length} hit. Shots landed {Math.abs(Math.round(mean))} ms {mean > 0 ? 'late' : 'early'} on
        average, with a spread of {Math.round(sd)} ms.
        {Math.abs(mean) > 60
          ? ' That is a lean worth correcting: fire a touch ' + (mean > 0 ? 'earlier.' : 'later.')
          : ' No lean to speak of.'}
      </p>
    </section>
  )
}

function Settings({ cfg, setCfg }: { cfg: InterceptConfig; setCfg: (f: (c: InterceptConfig) => InterceptConfig) => void }) {
  return (
    <>
      <Setting title="Targets">
        <Seg options={[10, 20, 30] as const} value={cfg.targets} onChange={(t) => setCfg((c) => ({ ...c, targets: t }))} label="Targets" />
      </Setting>
      <Setting title="Target speed">
        <Seg
          options={[1, 2, 3] as const}
          value={cfg.speed}
          onChange={(s) => setCfg((c) => ({ ...c, speed: s }))}
          label="Speed"
          format={(s) => (s === 1 ? 'Slow' : s === 2 ? 'Medium' : 'Fast')}
        />
      </Setting>
      <Setting
        title="Shot travel time"
        note="Longer travel means more lead. The right moment to fire is when the target is this many seconds from the cannon line."
      >
        <Seg
          options={[0.6, 1, 1.5] as const}
          value={cfg.travel}
          onChange={(t) => setCfg((c) => ({ ...c, travel: t }))}
          label="Travel"
          format={(t) => `${t}s`}
        />
      </Setting>
    </>
  )
}

export const interceptSpec: CognitiveSpec<InterceptConfig> = {
  id: 'intercept',
  title: 'Intercept',
  blurb: 'Lead a moving target with a shot that takes time to arrive. The score is hits. The log keeps whether you fire early or late.',
  defaults: { targets: 20, speed: 2, travel: 1 },
  configKey: (c) => `ic:n${c.targets}:s${c.speed}:t${c.travel}`,
  describe: (c) => `${c.targets} targets, ${c.speed === 1 ? 'slow' : c.speed === 2 ? 'medium' : 'fast'}, ${c.travel}s shot`,
  Settings,
  Run,
  Summary,
  pointsLabel: 'targets hit',
  pace: false,
  breakdowns: [
    {
      title: 'By timing',
      key: (e) =>
        e.tags?.noShot ? 'No shot' : e.tags?.lean === 'early' ? 'Fired early' : e.tags?.lean === 'late' ? 'Fired late' : 'On time',
      order: ['On time', 'Fired early', 'Fired late', 'No shot'],
    },
    {
      title: 'By direction',
      key: (e) => (e.tags?.direction === 'rightward' ? 'Left to right' : 'Right to left'),
      order: ['Left to right', 'Right to left'],
    },
    {
      title: 'By speed',
      key: (e) => `${String(e.tags?.speed ?? 'medium')[0].toUpperCase()}${String(e.tags?.speed ?? 'medium').slice(1)} target`,
      order: ['Slow target', 'Medium target', 'Fast target'],
    },
  ],
}
