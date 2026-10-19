import { useCallback, useEffect, useRef, useState } from 'react'
import { median } from 'd3'
import type { Attempt, EventLog } from '../../lib/types'
import { chance, pick } from '../../lib/random'
import { RunFrame, Seg, Setting } from '../shared/Frames'
import { useEscape } from '../shared/hooks'
import type { CognitiveSpec, Finished } from './spec'

/**
 * Cued task switching, the Rogers and Monsell paradigm. One digit, two
 * rules. A blue frame asks odd or even; a yellow frame asks under or over
 * five. F is odd or under, J is even or over. The rule changes without
 * warning. The score is the switch cost: how much slower a switch trial is
 * than a repeat trial, in milliseconds, lower is better.
 */
export interface SwitchConfig {
  trials: 48 | 96 | 144
  /** Chance that the rule changes from one trial to the next. */
  switchRate: 0.3 | 0.5
  /** Gap between a response and the next stimulus. */
  gapMs: 300 | 800
}

type Task = 'parity' | 'magnitude'
const DIGITS = [1, 2, 3, 4, 6, 7, 8, 9]

function answerFor(task: Task, d: number): 'f' | 'j' {
  return task === 'parity' ? (d % 2 === 1 ? 'f' : 'j') : d < 5 ? 'f' : 'j'
}

function Run({ cfg, onDone, onQuit }: { cfg: SwitchConfig; onDone: (f: Finished) => void; onQuit: () => void }) {
  const [phase, setPhase] = useState<'countdown' | 'gap' | 'stim' | 'done'>('countdown')
  const [count, setCount] = useState(3)
  const [task, setTask] = useState<Task>('parity')
  const [digit, setDigit] = useState(3)
  const [n, setN] = useState(0)
  const [flash, setFlash] = useState<'right' | 'wrong' | null>(null)
  const logs = useRef<EventLog[]>([])
  const startAt = useRef(0)
  const shownAt = useRef(0)
  const prevTask = useRef<Task | null>(null)
  const taskRef = useRef<Task>('parity')
  const digitRef = useRef(3)
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  useEscape(onQuit)

  const nextTrial = useCallback(() => {
    const t: Task = prevTask.current === null ? pick(['parity', 'magnitude']) : chance(cfg.switchRate) ? (prevTask.current === 'parity' ? 'magnitude' : 'parity') : prevTask.current
    let d = pick(DIGITS)
    if (d === digitRef.current) d = pick(DIGITS.filter((x) => x !== d))
    taskRef.current = t
    digitRef.current = d
    setTask(t)
    setDigit(d)
    setPhase('gap')
    setTimeout(() => {
      setPhase('stim')
      shownAt.current = performance.now()
    }, cfg.gapMs)
  }, [cfg.gapMs, cfg.switchRate])

  useEffect(() => {
    if (phase !== 'countdown') return
    if (count === 0) {
      startAt.current = performance.now()
      nextTrial()
      return
    }
    const t = setTimeout(() => setCount((c) => c - 1), 650)
    return () => clearTimeout(t)
  }, [phase, count, nextTrial])

  const finish = useCallback(() => {
    setPhase('done')
    const ok = logs.current.filter((l) => l.correct)
    const sw = ok.filter((l) => l.tags?.kind === 'switch').map((l) => l.ms)
    const rp = ok.filter((l) => l.tags?.kind === 'repeat').map((l) => l.ms)
    const cost = sw.length && rp.length ? Math.round(median(sw)! - median(rp)!) : 0
    const acc = logs.current.length ? ok.length / logs.current.length : 0
    onDone({
      logs: logs.current,
      score: cost,
      correct: ok.length,
      wrong: logs.current.length - ok.length,
      durationSec: Math.round((performance.now() - startAt.current) / 1000),
      meta: { switchCost: cost, accuracy: Math.round(acc * 100), medianSwitch: sw.length ? Math.round(median(sw)!) : 0, medianRepeat: rp.length ? Math.round(median(rp)!) : 0 },
    })
  }, [onDone])

  const respond = useCallback(
    (key: 'f' | 'j') => {
      if (phaseRef.current !== 'stim') return
      const t = taskRef.current
      const d = digitRef.current
      const right = answerFor(t, d)
      const ms = performance.now() - shownAt.current
      const kind = prevTask.current === null ? 'first' : prevTask.current === t ? 'repeat' : 'switch'
      const congruent = answerFor('parity', d) === answerFor('magnitude', d)
      const correct = key === right
      logs.current.push({
        kind,
        prompt: `${d} ${t === 'parity' ? 'odd or even' : 'under or over 5'}`,
        answer: right.toUpperCase(),
        given: key.toUpperCase(),
        ms,
        misses: correct ? 0 : 1,
        correct,
        tags: { kind, task: t, congruent, digit: d, fast: ms < 250 },
      })
      prevTask.current = t
      setFlash(correct ? 'right' : 'wrong')
      setTimeout(() => setFlash(null), 160)
      const done = logs.current.length
      setN(done)
      if (done >= cfg.trials) finish()
      else nextTrial()
    },
    [cfg.trials, finish, nextTrial],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === 'f' || k === 'j') {
        e.preventDefault()
        respond(k)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [respond])

  return (
    <RunFrame
      pct={((cfg.trials - n) / cfg.trials) * 100}
      left={
        <>
          {n}/{cfg.trials}
        </>
      }
      right={logs.current.filter((l) => l.correct).length}
      countdown={phase === 'countdown' ? count : null}
      hint="F is odd or under 5. J is even or over 5. Blue frame asks odd or even, yellow asks under or over. Esc to stop"
    >
      <div className={'switch' + (flash ? ` is-${flash}` : '')}>
        <div className={`switch__stim switch__stim--${task}` + (phase === 'stim' ? ' is-on' : '')}>
          <span className="switch__cue">{task === 'parity' ? 'odd or even' : 'under or over 5'}</span>
          <span className="switch__digit tnum">{phase === 'stim' ? digit : ''}</span>
        </div>
        <div className="switch__keys">
          <button className="choice" onClick={() => respond('f')}>
            <span className="choice__key">F</span>
            <span>{task === 'parity' ? 'odd' : 'under 5'}</span>
          </button>
          <button className="choice" onClick={() => respond('j')}>
            <span className="choice__key">J</span>
            <span>{task === 'parity' ? 'even' : 'over 5'}</span>
          </button>
        </div>
      </div>
    </RunFrame>
  )
}

function Summary({ attempt }: { attempt: Attempt<SwitchConfig> }) {
  const m = attempt.meta ?? {}
  const acc = Number(m.accuracy ?? 0)
  return (
    <section className="result__section">
      <h2>Switch cost</h2>
      <p className="muted">
        Repeat trials {m.medianRepeat} ms, switch trials {m.medianSwitch} ms, so a switch costs {m.switchCost} ms. Accuracy {acc}%.
        {acc < 85 ? ' Below 85 percent the cost is not reliable: slow down a little.' : ' Typical adult costs run 100 to 300 ms and fall with practice.'}
      </p>
    </section>
  )
}

function Settings({ cfg, setCfg }: { cfg: SwitchConfig; setCfg: (f: (c: SwitchConfig) => SwitchConfig) => void }) {
  return (
    <>
      <Setting title="Trials">
        <Seg options={[48, 96, 144] as const} value={cfg.trials} onChange={(t) => setCfg((c) => ({ ...c, trials: t }))} label="Trials" />
      </Setting>
      <Setting title="Switch rate" note="How often the rule changes. Half is the standard paradigm.">
        <Seg options={[0.3, 0.5] as const} value={cfg.switchRate} onChange={(r) => setCfg((c) => ({ ...c, switchRate: r }))} label="Switch rate" format={(r) => `${r * 100}%`} />
      </Setting>
      <Setting title="Gap before the next digit" note="A short gap gives less time to prepare for a switch, so the cost is larger.">
        <Seg options={[300, 800] as const} value={cfg.gapMs} onChange={(g) => setCfg((c) => ({ ...c, gapMs: g }))} label="Gap" format={(g) => `${g} ms`} />
      </Setting>
    </>
  )
}

export const taskSwitchSpec: CognitiveSpec<SwitchConfig> = {
  id: 'task-switch',
  title: 'Task switch',
  blurb: 'One digit, two rules, no warning when the rule changes. The score is how much a switch slows you down, in milliseconds. Lower is better.',
  defaults: { trials: 96, switchRate: 0.5, gapMs: 300 },
  configKey: (c) => `ts:n${c.trials}:s${c.switchRate}:g${c.gapMs}`,
  describe: (c) => `${c.trials} trials, ${c.switchRate * 100}% switches, ${c.gapMs} ms gap`,
  Settings,
  Run,
  Summary,
  pointsLabel: 'the switch cost in milliseconds, lower is better',
  unit: ' ms',
  higherIsBetter: false,
  pace: true,
  paceLabel: 'Reaction time per trial, in order. Blue is right, red is wrong.',
  breakdowns: [
    { title: 'By trial type', key: (e) => (e.tags?.kind === 'switch' ? 'Switch' : e.tags?.kind === 'repeat' ? 'Repeat' : null), order: ['Repeat', 'Switch'] },
    { title: 'By rule', key: (e) => (e.tags?.task === 'parity' ? 'Odd or even' : 'Under or over 5'), order: ['Odd or even', 'Under or over 5'] },
    { title: 'By congruence', key: (e) => (e.tags?.congruent ? 'Both rules agree' : 'Rules disagree'), order: ['Both rules agree', 'Rules disagree'] },
  ],
}
