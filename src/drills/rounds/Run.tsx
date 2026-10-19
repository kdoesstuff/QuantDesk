import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Attempt, EventLog } from '../../lib/types'
import { store, uid } from '../../lib/storage'
import { loadDrillConfig } from '../../lib/config'
import { round } from '../../lib/random'
import { RunFrame } from '../shared/Frames'
import { useEscape, useRunClock } from '../shared/hooks'
import type { Outcome, RoundsSpec, Scenario } from './spec'

const FEEDBACK_MS = 1100

export default function RoundsRun<C extends object, S extends Scenario, D>({ spec }: { spec: RoundsSpec<C, S, D> }) {
  const nav = useNavigate()
  const cfg = useRef<C>(loadDrillConfig(spec.id, spec.defaults)).current
  const total = spec.rounds(cfg)
  const perRound = spec.perRoundSec(cfg)
  const places = spec.places ?? 0

  const [scenario, setScenario] = useState<S>(() => spec.next(cfg))
  const [round_, setRound] = useState(0)
  const [score, setScore] = useState(0)
  const [feedback, setFeedback] = useState<Outcome | null>(null)
  const [roundLeft, setRoundLeft] = useState(perRound)

  const logs = useRef<EventLog[]>([])
  const shownAt = useRef(0)
  const scoreRef = useRef(0)
  const scenarioRef = useRef(scenario)
  scenarioRef.current = scenario
  const finished = useRef(false)
  const deciding = useRef(true)

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
      score: round(scoreRef.current, places),
      correct,
      wrong: logs.current.length - correct,
      durationSec: Math.round((performance.now() - startAt.current) / 1000),
      answers: logs.current,
    }
    await store.saveAttempt(attempt)
    nav(`/drill/${spec.id}/result/${attempt.id}`, { replace: true })
  }, [cfg, nav, places, spec])

  const { phase, count, elapsed, stop, startAt } = useRunClock(0, finish)
  useEscape(() => nav(`/drill/${spec.id}`))

  useEffect(() => {
    if (phase === 'running') {
      shownAt.current = performance.now()
      deciding.current = true
    }
  }, [phase])

  const decide = useCallback(
    (d: D | null) => {
      if (phase !== 'running' || !deciding.current) return
      deciding.current = false
      const sc = scenarioRef.current
      const out = spec.resolve(sc, d, cfg)
      const now = performance.now()
      logs.current.push({
        kind: sc.kind,
        prompt: sc.prompt,
        answer: out.answer,
        given: d === null ? null : out.given,
        ms: now - shownAt.current,
        misses: 0,
        correct: out.correct,
        points: out.points,
        tags: { ...sc.tags, ...out.tags, timedOut: d === null },
      })
      scoreRef.current += out.points
      setScore(scoreRef.current)
      setFeedback(out)
      setTimeout(() => {
        setFeedback(null)
        const n = logs.current.length
        if (n >= total) {
          stop()
          return
        }
        setRound(n)
        setScenario((p) => spec.next(cfg, p))
        shownAt.current = performance.now()
        setRoundLeft(perRound)
        deciding.current = true
      }, FEEDBACK_MS)
    },
    [cfg, perRound, phase, spec, stop, total],
  )

  // Per-round clock
  useEffect(() => {
    if (phase !== 'running' || perRound <= 0) return
    let raf = 0
    const tick = () => {
      if (deciding.current) {
        const left = Math.max(0, perRound - (performance.now() - shownAt.current) / 1000)
        setRoundLeft(left)
        if (left <= 0) decide(null)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase, perRound, decide])

  const pct = perRound > 0 ? (roundLeft / perRound) * 100 : ((total - round_) / total) * 100
  const fmtScore = (x: number) => (places > 0 ? x.toFixed(places) : String(Math.round(x)))

  return (
    <RunFrame
      pct={pct}
      left={
        <>
          {Math.floor(elapsed)}s
          <span className="run__sep">
            {Math.min(round_ + 1, total)}/{total}
          </span>
        </>
      }
      right={(score > 0 ? '+' : '') + fmtScore(score)}
      countdown={phase === 'countdown' ? count : null}
      hint={spec.hint ?? 'Esc to stop'}
      wide
    >
      <div className={'rounds' + (feedback ? ' is-feedback' : '')}>
        <spec.Scene scenario={scenario} cfg={cfg} />
        <spec.Decide scenario={scenario} cfg={cfg} onDecide={decide} disabled={!!feedback || phase !== 'running'} />
        {feedback && (
          <div className={'rounds__feedback' + (feedback.correct ? ' is-right' : ' is-wrong')} role="status">
            <span className="rounds__points tnum">
              {feedback.points > 0 ? '+' : ''}
              {fmtScore(feedback.points)}
            </span>
            <span>{feedback.note}</span>
          </div>
        )}
      </div>
    </RunFrame>
  )
}
