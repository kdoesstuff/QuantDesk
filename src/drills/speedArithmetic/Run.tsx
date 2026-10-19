import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { AnswerLog, Attempt, SpeedArithmeticConfig } from '../../lib/types'
import { store, uid } from '../../lib/storage'
import { configKey, loadConfig, nextProblem, type Problem } from './generator'
import '../shared/drill.css'

type Phase = 'countdown' | 'running' | 'done'

export default function SpeedArithmeticRun() {
  const nav = useNavigate()
  const cfg = useRef<SpeedArithmeticConfig>(loadConfig()).current
  const [phase, setPhase] = useState<Phase>('countdown')
  const [count, setCount] = useState(3)
  const [problem, setProblem] = useState<Problem>(() => nextProblem(cfg))
  const [value, setValue] = useState('')
  const [remaining, setRemaining] = useState<number>(cfg.durationSec)
  const [score, setScore] = useState(0)
  const [shake, setShake] = useState(false)

  const logs = useRef<AnswerLog[]>([])
  const shownAt = useRef(0)
  const misses = useRef(0)
  const tried = useRef<number | undefined>(undefined)
  const endAt = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const problemRef = useRef(problem)
  problemRef.current = problem

  // Countdown 3-2-1
  useEffect(() => {
    if (phase !== 'countdown') return
    if (count === 0) {
      setPhase('running')
      endAt.current = performance.now() + cfg.durationSec * 1000
      shownAt.current = performance.now()
      return
    }
    const t = setTimeout(() => setCount((c) => c - 1), 650)
    return () => clearTimeout(t)
  }, [phase, count, cfg.durationSec])

  const finish = useCallback(async () => {
    setPhase('done')
    // Log the problem on screen when the clock ran out.
    const p = problemRef.current
    logs.current.push({
      op: p.op,
      a: p.a,
      b: p.b,
      answer: p.answer,
      given: null,
      ms: performance.now() - shownAt.current,
      misses: misses.current,
      correct: false,
      tried: tried.current === undefined ? undefined : String(tried.current),
    })
    const answered = logs.current.filter((l) => l.given !== null)
    const attempt: Attempt<SpeedArithmeticConfig> = {
      id: uid(),
      ts: Date.now(),
      drill: 'speed-arithmetic',
      configKey: configKey(cfg),
      config: cfg,
      score: answered.filter((l) => l.correct).length,
      correct: answered.filter((l) => l.correct).length,
      wrong: logs.current.reduce((s, l) => s + l.misses, 0),
      durationSec: cfg.durationSec,
      answers: logs.current,
    }
    await store.saveAttempt(attempt)
    nav(`/drill/speed-arithmetic/result/${attempt.id}`, { replace: true })
  }, [cfg, nav])

  // Clock
  useEffect(() => {
    if (phase !== 'running') return
    let raf = 0
    const tick = () => {
      const left = Math.max(0, endAt.current - performance.now())
      setRemaining(left / 1000)
      if (left <= 0) {
        finish()
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase, finish])

  // Keep focus on the input
  useEffect(() => {
    if (phase === 'running') inputRef.current?.focus()
  }, [phase, problem])

  // Escape leaves
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') nav('/drill/speed-arithmetic')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [nav])

  const onChange = (raw: string) => {
    const v = raw.replace(/[^\d]/g, '')
    setValue(v)
    if (v === '') return
    const n = Number(v)
    const now = performance.now()
    if (n === problem.answer) {
      logs.current.push({
        op: problem.op,
        a: problem.a,
        b: problem.b,
        answer: problem.answer,
        given: n,
        ms: now - shownAt.current,
        misses: misses.current,
        correct: true,
        tried: misses.current > 0 && tried.current !== undefined ? String(tried.current) : undefined,
      })
      setScore((s) => s + 1)
      misses.current = 0
      tried.current = undefined
      shownAt.current = now
      setValue('')
      setProblem((p) => nextProblem(cfg, p))
    } else if (v.length >= String(problem.answer).length) {
      // Wrong and already as long as the answer: count a miss, clear, shake.
      if (misses.current === 0) tried.current = n
      misses.current += 1
      setShake(true)
      setTimeout(() => setShake(false), 260)
      setValue('')
    }
  }

  const pct = (remaining / cfg.durationSec) * 100
  const secs = Math.ceil(remaining)

  return (
    <div className="run">
      <div className="run__clock" aria-hidden="true">
        <div className="run__clock-bar" style={{ width: `${pct}%` }} />
      </div>

      <div className="run__meta">
        <span className="tnum run__time">{secs}s</span>
        <Link to="/drill/speed-arithmetic" className="run__stop" aria-label="Stop and go back to settings">
          Stop
        </Link>
        <span className="tnum run__score">{score}</span>
      </div>

      {phase === 'countdown' ? (
        <div className="run__center">
          <div className="run__count tnum" key={count}>
            {count === 0 ? 'Go' : count}
          </div>
        </div>
      ) : (
        <div className="run__center">
          <div className={'run__problem tnum' + (shake ? ' is-shake' : '')}>{problem.text}</div>
          <div className="run__answer">
            <span className="run__eq">=</span>
            <input
              ref={inputRef}
              className="run__input tnum"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              aria-label="Answer"
              disabled={phase !== 'running'}
            />
          </div>
        </div>
      )}

      <p className="run__hint faint">Esc to stop</p>
    </div>
  )
}
