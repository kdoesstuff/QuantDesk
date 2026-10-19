import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Attempt, EventLog } from '../../lib/types'
import { store, uid } from '../../lib/storage'
import { loadDrillConfig } from '../../lib/config'
import { RunFrame } from '../shared/Frames'
import { useEscape, useRunClock } from '../shared/hooks'
import { modeOf, normalise, type Item, type TypedSpec } from './spec'

/**
 * The run screen for every typed-answer drill. Zetamac semantics: a right
 * answer clears itself the moment it is complete, a wrong answer as long as
 * the right one counts a slip and clears. Choice mode shows options and takes
 * the keys 1 to 4, with Enter to skip.
 */
export default function TypedRun<C extends object>({ spec }: { spec: TypedSpec<C> }) {
  const nav = useNavigate()
  const cfg = useRef<C>(loadDrillConfig(spec.id, spec.defaults)).current
  const mode = modeOf(spec, cfg)
  const durationSec = spec.duration(cfg)
  const limit = spec.limit ? spec.limit(cfg) : Infinity
  const points = spec.points ? spec.points(cfg) : { right: 1, wrong: 0 }

  const [item, setItem] = useState<Item>(() => spec.next(cfg))
  const [value, setValue] = useState('')
  const [score, setScore] = useState(0)
  const [n, setN] = useState(0)
  const [shake, setShake] = useState(false)
  const [flash, setFlash] = useState<number | null>(null)

  const logs = useRef<EventLog[]>([])
  const shownAt = useRef(0)
  const misses = useRef(0)
  const tried = useRef<string | undefined>(undefined)
  const inputRef = useRef<HTMLInputElement>(null)
  const itemRef = useRef(item)
  itemRef.current = item
  const scoreRef = useRef(0)
  const finished = useRef(false)

  const finish = useCallback(async () => {
    if (finished.current) return
    finished.current = true
    const it = itemRef.current
    // In typed mode the problem on screen when the clock stops is logged as unanswered.
    if (mode === 'typed') {
      logs.current.push({
        kind: it.kind,
        prompt: it.prompt,
        answer: it.answer,
        given: null,
        ms: performance.now() - shownAt.current,
        misses: misses.current,
        correct: false,
        tags: it.tags,
        how: it.how,
        detail: it.detail,
        tried: tried.current,
      })
    }
    const answered = logs.current.filter((l) => l.given !== null)
    const correct = answered.filter((l) => l.correct).length
    const wrong =
      mode === 'typed' && !spec.oneShot ? logs.current.reduce((s, l) => s + l.misses, 0) : answered.filter((l) => !l.correct).length
    const attempt: Attempt<C> = {
      id: uid(),
      ts: Date.now(),
      drill: spec.id,
      configKey: spec.configKey(cfg),
      config: cfg,
      score: scoreRef.current,
      correct,
      wrong,
      durationSec: durationSec || Math.round((performance.now() - startAt.current) / 1000),
      answers: logs.current,
    }
    await store.saveAttempt(attempt)
    nav(`/drill/${spec.id}/result/${attempt.id}`, { replace: true })
  }, [cfg, durationSec, nav, spec])

  const { phase, count, remaining, elapsed, stop, startAt } = useRunClock(durationSec, finish)

  useEffect(() => {
    if (phase === 'running') {
      shownAt.current = performance.now()
      inputRef.current?.focus()
    }
  }, [phase])
  useEffect(() => {
    if (phase === 'running') inputRef.current?.focus()
  }, [item, phase])

  useEscape(() => nav(`/drill/${spec.id}`))

  const advance = useCallback(
    (log: EventLog, delta: number) => {
      logs.current.push(log)
      scoreRef.current += delta
      setScore(scoreRef.current)
      misses.current = 0
      tried.current = undefined
      setValue('')
      const done = logs.current.length
      setN(done)
      if (done >= limit) {
        stop()
        return
      }
      shownAt.current = performance.now()
      setItem((p) => spec.next(cfg, p))
    },
    [cfg, limit, spec, stop],
  )

  const logCorrect = (v: string) => {
    const slipped = misses.current > 0
    advance(
      {
        kind: item.kind,
        prompt: item.prompt,
        answer: item.answer,
        given: v,
        ms: performance.now() - shownAt.current,
        misses: misses.current,
        correct: true,
        tags: item.tags,
        // The approach is kept only when there is something to review.
        how: slipped ? item.how : undefined,
        detail: slipped ? item.detail : undefined,
        tried: slipped ? tried.current : undefined,
      },
      points.right,
    )
  }
  const miss = () => {
    if (misses.current === 0) tried.current = value
    misses.current += 1
    setShake(true)
    setTimeout(() => setShake(false), 260)
    setValue('')
  }

  // Enter-submit mode: check only when asked, allow a tolerance.
  const onSubmit = () => {
    if (phase !== 'running') return
    if (value === '') {
      // Test conditions: an empty submit is a free skip.
      if (spec.oneShot)
        advance(
          {
            kind: item.kind,
            prompt: item.prompt,
            answer: item.answer,
            given: 'skip',
            ms: performance.now() - shownAt.current,
            misses: 0,
            correct: false,
            tags: { ...item.tags, skipped: true },
            how: item.how,
            detail: item.detail,
          },
          0,
        )
      return
    }
    const n = Number(normalise(value))
    const target = Number(normalise(item.answer))
    const tol = item.tolerance ?? 0
    const accepted = [item.answer, ...(item.alt ?? [])].map(normalise)
    if ((Number.isFinite(n) && Math.abs(n - target) <= tol + 1e-9) || accepted.includes(normalise(value))) logCorrect(value)
    else if (spec.oneShot) {
      // One try: wrong ends the question with the wrong points.
      setShake(true)
      setTimeout(() => setShake(false), 260)
      advance(
        {
          kind: item.kind,
          prompt: item.prompt,
          answer: item.answer,
          given: value,
          ms: performance.now() - shownAt.current,
          misses: 1,
          correct: false,
          tags: item.tags,
          how: item.how,
          detail: item.detail,
          tried: value,
        },
        points.wrong,
      )
    } else miss()
  }

  // Typed mode
  const onChange = (raw: string) => {
    const pattern = spec.inputPattern ?? /[^\d]/g
    const v = raw.replace(pattern, '')
    setValue(v)
    if (v === '' || phase !== 'running' || spec.submitOnEnter) return
    const norm = normalise(v)
    const accepted = [item.answer, ...(item.alt ?? [])].map(normalise)
    if (accepted.includes(norm)) logCorrect(v)
    else if (norm.length >= Math.min(...accepted.map((a) => a.length))) miss()
  }

  // Choice mode
  const choose = useCallback(
    (idx: number | null) => {
      if (phase !== 'running') return
      const it = itemRef.current
      const now = performance.now()
      const correct = idx !== null && idx === it.correctIndex
      if (idx !== null) {
        setFlash(idx)
        setTimeout(() => setFlash(null), 180)
      }
      advance(
        {
          kind: it.kind,
          prompt: it.prompt,
          answer: it.answer,
          given: idx === null ? 'skip' : it.options![idx],
          ms: now - shownAt.current,
          misses: 0,
          correct,
          tags: { ...it.tags, skipped: idx === null },
          how: correct ? undefined : it.how,
          detail: correct ? undefined : it.detail,
        },
        idx === null ? 0 : correct ? points.right : points.wrong,
      )
    },
    [advance, phase, points],
  )

  useEffect(() => {
    if (mode !== 'choice') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= '1' && e.key <= '4') {
        const i = Number(e.key) - 1
        if (itemRef.current.options && i < itemRef.current.options.length) choose(i)
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        choose(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [choose, mode])

  const pct = durationSec > 0 ? (remaining / durationSec) * 100 : limit < Infinity ? (1 - n / limit) * 100 : 100
  const timeText = durationSec > 0 ? `${Math.ceil(remaining)}s` : `${Math.floor(elapsed)}s`
  const left =
    limit < Infinity ? (
      <>
        {timeText}
        <span className="run__sep">
          {n}/{limit}
        </span>
      </>
    ) : (
      timeText
    )

  return (
    <RunFrame
      pct={pct}
      left={left}
      right={score}
      countdown={phase === 'countdown' ? count : null}
      hint={
        (typeof spec.hint === 'function' ? spec.hint(cfg) : spec.hint) ??
        (mode === 'choice'
          ? 'Keys 1 to 4, Enter to skip, Esc to stop'
          : spec.oneShot
            ? 'Type the answer, Enter to submit. Enter on an empty field skips for free. Esc to stop'
            : 'Esc to stop')
      }
      wide={mode === 'choice'}
    >
      {item.detail && (
        <dl className="run__detail tnum">
          {item.detail.map((d, i) => (
            <div key={i}>
              <dt>{d.label}</dt>
              <dd>{d.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className={'run__problem tnum' + (shake ? ' is-shake' : '') + (item.prompt.length > 14 ? ' run__problem--long' : '')}>
        {item.prompt}
      </div>
      {item.sub ? <div className="run__sub muted">{item.sub}</div> : null}
      {mode === 'typed' ? (
        <div className="run__answer">
          <span className="run__eq">=</span>
          <input
            ref={inputRef}
            className="run__input tnum"
            inputMode="decimal"
            autoComplete="off"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && spec.submitOnEnter) {
                e.preventDefault()
                onSubmit()
              }
            }}
            aria-label="Answer"
            disabled={phase !== 'running'}
          />
        </div>
      ) : (
        <div className={'choices' + (item.options!.some((o) => o.length > 7) ? ' choices--text' : '')}>
          {item.options!.map((o, i) => (
            <button
              key={i}
              className={'choice tnum' + (flash === i ? (i === item.correctIndex ? ' is-right' : ' is-wrong') : '')}
              onClick={() => choose(i)}
            >
              <span className="choice__key">{i + 1}</span>
              <span>{o}</span>
            </button>
          ))}
        </div>
      )}
    </RunFrame>
  )
}
