import { useEffect, useRef, useState } from 'react'
import { pick, round } from '../../../lib/random'
import type { Attempt } from '../../../lib/types'
import { Chips, Seg, Setting, toggleIn } from '../../shared/Frames'
import type { Outcome, RoundsSpec, Scenario } from '../spec'
import { ALL_TOPICS, FERMI, TOPIC_LABEL, type FermiQ, type FermiTopic } from './fermiQuestions'

/**
 * Fermi estimation. A point estimate and a 90 percent interval. The point is
 * scored on a log scale: within 20 percent is 100, a factor of ten off is 0.
 * The interval is scored by calibration over time: 90 percent of them
 * should contain the reference, and they should be as narrow as that allows.
 */
export interface FermiConfig {
  rounds: 5 | 10 | 20
  perRoundSec: 0 | 60 | 30
  topics: FermiTopic[]
  /** Ask for an interval as well as the point. */
  interval: boolean
}

export interface FermiScenario extends Scenario {
  q: FermiQ
}
export type FermiDecision = { point: number; low?: number; high?: number }

function fmt(x: number) {
  return x >= 1000 ? Math.round(x).toLocaleString('en-US') : String(round(x, 2))
}

function next(c: FermiConfig, prev?: FermiScenario): FermiScenario {
  const topics = c.topics.length ? c.topics : ALL_TOPICS
  const pool = FERMI.filter((f) => topics.includes(f.topic) && f !== prev?.q)
  const q = pick(pool)
  return { kind: q.topic, prompt: `${q.q} (${q.unit})`, tags: { topic: q.topic, magnitude: Math.floor(Math.log10(q.v)) }, q }
}

function resolve(s: FermiScenario, d: FermiDecision | null, c: FermiConfig): Outcome {
  const T = s.q.v
  const truth = `${fmt(T)} ${s.q.unit}. ${s.q.how}`
  if (!d || !(d.point > 0))
    return {
      points: 0,
      correct: false,
      given: 'timed out',
      answer: fmt(T),
      note: truth,
      how: `Reference ${fmt(T)} ${s.q.unit}. ${s.q.how}`,
      tags: { logErr: 0, hit: false },
    }
  const logErr = round(Math.log10(d.point / T), 3)
  // 100 at |logErr| <= 0.08 (about 20 percent), 0 at a factor of ten.
  const points = Math.round(100 * Math.max(0, 1 - Math.max(0, Math.abs(logErr) - 0.08) / 0.92))
  let hit: boolean | null = null
  let widthLog: number | null = null
  if (c.interval && d.low !== undefined && d.high !== undefined && d.low > 0 && d.high >= d.low) {
    hit = d.low <= T && T <= d.high
    widthLog = round(Math.log10(d.high / d.low), 3)
  }
  const ratio = d.point / T
  const closeness =
    Math.abs(logErr) <= 0.08 ? 'within 20%' : Math.abs(logErr) <= 0.3 ? 'within 2x' : Math.abs(logErr) <= 1 ? 'within 10x' : 'over 10x off'
  return {
    points,
    correct: Math.abs(logErr) <= 0.3,
    given: `${fmt(d.point)}${hit !== null ? ` [${fmt(d.low!)} to ${fmt(d.high!)}]` : ''}`,
    answer: fmt(T),
    note: `${ratio > 1 ? `${round(ratio, 1)}x high` : `${round(1 / ratio, 1)}x low`}${hit !== null ? (hit ? ', interval caught it' : ', interval missed') : ''}. ${truth}`,
    how: `Reference ${fmt(T)} ${s.q.unit}, you said ${fmt(d.point)} (${ratio > 1 ? `${round(ratio, 1)}x high` : `${round(1 / ratio, 1)}x low`}). ${s.q.how}${hit === false ? ` Your interval ${fmt(d.low!)} to ${fmt(d.high!)} missed it; a 90% interval should miss about one time in ten, so if it misses often, widen it.` : ''}`,
    tags: {
      logErr,
      lean: logErr > 0.08 ? 'high' : logErr < -0.08 ? 'low' : 'close',
      closeness,
      hit: hit ?? false,
      hasInterval: hit !== null,
      widthLog: widthLog ?? 0,
    },
  }
}

function Scene({ scenario }: { scenario: FermiScenario }) {
  return (
    <div className="market">
      <p className="market__question">{scenario.q.q}</p>
      <p className="muted">in {scenario.q.unit}</p>
    </div>
  )
}

function Decide({
  cfg,
  onDecide,
  disabled,
}: {
  scenario: FermiScenario
  cfg: FermiConfig
  onDecide: (d: FermiDecision) => void
  disabled: boolean
}) {
  const [point, setPoint] = useState('')
  const [low, setLow] = useState('')
  const [high, setHigh] = useState('')
  const pRef = useRef<HTMLInputElement>(null)
  const lRef = useRef<HTMLInputElement>(null)
  const hRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!disabled) {
      setPoint('')
      setLow('')
      setHigh('')
      pRef.current?.focus()
    }
  }, [disabled])
  const clean = (v: string) => v.replace(/[^\d.]/g, '')
  const submit = () => {
    const p = Number(point)
    if (!(p > 0)) return
    if (cfg.interval) {
      const l = Number(low)
      const h = Number(high)
      if (!(l > 0) || !(h > 0)) return
      onDecide({ point: p, low: Math.min(l, h), high: Math.max(l, h) })
    } else onDecide({ point: p })
  }
  const onKey = (e: React.KeyboardEvent, nextRef?: React.RefObject<HTMLInputElement | null>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (nextRef && cfg.interval && (nextRef.current?.value ?? '') === '') nextRef.current?.focus()
    else submit()
  }
  return (
    <div className="fermi">
      <label className="quote__side">
        <span className="quote__label">Estimate</span>
        <input
          ref={pRef}
          className="run__input tnum"
          inputMode="decimal"
          value={point}
          disabled={disabled}
          onChange={(e) => setPoint(clean(e.target.value))}
          onKeyDown={(e) => onKey(e, lRef)}
          aria-label="Estimate"
        />
      </label>
      {cfg.interval && (
        <div className="quote">
          <label className="quote__side">
            <span className="quote__label">90% low</span>
            <input
              ref={lRef}
              className="run__input run__input--small tnum"
              inputMode="decimal"
              value={low}
              disabled={disabled}
              onChange={(e) => setLow(clean(e.target.value))}
              onKeyDown={(e) => onKey(e, hRef)}
              aria-label="Low"
            />
          </label>
          <span className="quote__at">to</span>
          <label className="quote__side">
            <span className="quote__label">90% high</span>
            <input
              ref={hRef}
              className="run__input run__input--small tnum"
              inputMode="decimal"
              value={high}
              disabled={disabled}
              onChange={(e) => setHigh(clean(e.target.value))}
              onKeyDown={(e) => onKey(e)}
              aria-label="High"
            />
          </label>
        </div>
      )}
    </div>
  )
}

function Summary({ attempt }: { attempt: Attempt<FermiConfig> }) {
  const withInt = attempt.answers.filter((l) => l.tags?.hasInterval)
  const decided = attempt.answers.filter((l) => l.given !== null)
  if (decided.length === 0) return null
  const errs = decided.map((l) => Number(l.tags?.logErr ?? 0))
  const meanAbs = errs.reduce((a, b) => a + Math.abs(b), 0) / errs.length
  const bias = errs.reduce((a, b) => a + b, 0) / errs.length
  const hits = withInt.filter((l) => l.tags?.hit).length
  return (
    <section className="result__section">
      <h2>Calibration</h2>
      <p className="muted">
        Typical miss {round(10 ** meanAbs, 2)}x. Lean{' '}
        {Math.abs(bias) < 0.05 ? 'none' : bias > 0 ? `high by ${round(10 ** bias, 2)}x` : `low by ${round(10 ** -bias, 2)}x`} on average.
        {withInt.length > 0
          ? ` Intervals caught ${hits} of ${withInt.length}; at 90 percent they should catch about ${Math.round(withInt.length * 0.9)}.`
          : ''}
      </p>
    </section>
  )
}

function Settings({ cfg, setCfg }: { cfg: FermiConfig; setCfg: (f: (c: FermiConfig) => FermiConfig) => void }) {
  return (
    <>
      <Setting title="Questions">
        <Seg options={[5, 10, 20] as const} value={cfg.rounds} onChange={(r) => setCfg((c) => ({ ...c, rounds: r }))} label="Questions" />
      </Setting>
      <Setting title="Time per question">
        <Seg
          options={[0, 60, 30] as const}
          value={cfg.perRoundSec}
          onChange={(t) => setCfg((c) => ({ ...c, perRoundSec: t }))}
          label="Time"
          format={(t) => (t === 0 ? 'No limit' : `${t}s`)}
        />
      </Setting>
      <Setting
        title="Interval"
        note="With an interval, you also give a range you are 90 percent sure of. Over many questions the ranges should catch the reference nine times in ten."
      >
        <Seg
          options={[true, false] as const}
          value={cfg.interval}
          onChange={(v) => setCfg((c) => ({ ...c, interval: v }))}
          label="Interval"
          format={(v) => (v ? 'Estimate and 90% range' : 'Estimate only')}
        />
      </Setting>
      <Setting title="Topics">
        <Chips
          options={ALL_TOPICS}
          value={cfg.topics}
          onToggle={(t) => setCfg((c) => ({ ...c, topics: toggleIn(c.topics, t) }))}
          labels={TOPIC_LABEL}
        />
      </Setting>
    </>
  )
}

export const fermiSpec: RoundsSpec<FermiConfig, FermiScenario, FermiDecision> = {
  id: 'fermi',
  title: 'Fermi',
  blurb:
    'Order-of-magnitude estimates. Within 20 percent scores 100, a factor of ten off scores 0. Every answer comes with the decomposition.',
  defaults: { rounds: 10, perRoundSec: 0, topics: [...ALL_TOPICS], interval: true },
  configKey: (c) =>
    `fermi:r${c.rounds}:t${c.perRoundSec}:${c.interval ? 'int' : 'pt'}:${ALL_TOPICS.filter((t) => c.topics.includes(t)).join(',')}`,
  describe: (c) =>
    `${c.rounds} questions${c.perRoundSec ? `, ${c.perRoundSec}s each` : ''}, ${c.interval ? 'with intervals' : 'estimates only'}`,
  Settings,
  rounds: (c) => c.rounds,
  perRoundSec: (c) => c.perRoundSec,
  next,
  Scene,
  Decide,
  resolve,
  Summary,
  pointsLabel: 'closeness on a log scale, 100 a question at most',
  places: 0,
  unit: ' pts',
  hint: 'Enter moves to the next field and submits. Esc to stop',
  breakdowns: [
    {
      title: 'By topic',
      key: (e) => TOPIC_LABEL[(e.tags?.topic as FermiTopic) ?? 'people'] ?? null,
      order: ALL_TOPICS.map((t) => TOPIC_LABEL[t]),
    },
    {
      title: 'By closeness',
      key: (e) => (e.given === null ? null : String(e.tags?.closeness ?? '')),
      order: ['within 20%', 'within 2x', 'within 10x', 'over 10x off'],
    },
    {
      title: 'By lean',
      key: (e) => (e.given === null ? null : e.tags?.lean === 'high' ? 'Guessed high' : e.tags?.lean === 'low' ? 'Guessed low' : 'Close'),
      order: ['Guessed low', 'Close', 'Guessed high'],
    },
  ],
}
