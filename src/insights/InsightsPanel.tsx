import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Attempt, DrillId } from '../lib/types'
import { store } from '../lib/storage'
import { readRawDrillConfig, saveDrillConfig } from '../lib/config'
import { analyze, INSIGHTS_AFTER, percentile, type Finding } from './analyze'
import { noteRun, startFocus, type FocusProgress } from './focus'
import { recommend } from './recommend'
import { secs, pct } from './stats'
import './insights.css'

export const KIND_LABEL: Record<Finding['kind'], string> = {
  slow: 'Slow spot',
  inaccurate: 'Error spot',
  strength: 'Strength',
  fatigue: 'Fade',
  rush: 'Rushing',
  gap: 'Method gap',
  trend: 'Trend',
  bias: 'Lean',
  calibration: 'Calibration',
  today: 'Today',
  pumps: 'Risk',
}

export function FindingCard({ f, onFocus }: { f: Finding; onFocus?: (f: Finding) => void }) {
  const rec = f.focusable ? recommend(f) : null
  return (
    <li className={`finding finding--${f.kind}`}>
      <div className="finding__head">
        <span className="finding__kind">{KIND_LABEL[f.kind]}</span>
        <span className="finding__n faint tnum">n = {f.n}</span>
      </div>
      <p className="finding__headline">{f.headline}</p>
      <p className="finding__detail muted">{f.detail}</p>
      {rec && rec.patch && onFocus ? (
        <div className="finding__actions">
          <button className="btn btn-yellow btn-small" onClick={() => onFocus(f)}>
            Focus on this
          </button>
          <span className="faint">{rec.advice}</span>
        </div>
      ) : rec ? (
        <p className="faint">{rec.advice}</p>
      ) : null}
    </li>
  )
}

export function FocusStrip({ p }: { p: FocusProgress }) {
  const b = p.block
  const isSpeed = b.kind === 'slow'
  const fmt = (x: number) => (isSpeed ? secs(x) : pct(x))
  const target = isSpeed ? b.target.medMs : b.target.acc
  const base = isSpeed ? b.baseline.medMs : b.baseline.acc
  return (
    <div className={'focus-strip' + (b.status === 'cleared' ? ' is-cleared' : '')}>
      <div className="focus-strip__head">
        <span className="finding__kind">{b.status === 'cleared' ? 'Focus cleared' : 'Focus block'}</span>
        <strong>{b.label}</strong>
      </div>
      <p className="muted">
        {base !== undefined ? `Baseline ${fmt(base)}, target ${fmt(target!)}.` : ''}{' '}
        {p.current !== null
          ? `Last ${Math.min(b.runIds.length, 3)} runs: ${fmt(p.current)} over ${p.rowsInWindow} problems.`
          : `${b.runIds.length} of 3 runs in the window so far${p.rowsInWindow ? `, ${p.rowsInWindow} problems` : ''}.`}
        {b.status === 'cleared' ? ' Target met over three runs. Mixed practice again, and the next weak spot when it shows.' : ''}
      </p>
      {p.perRun.length > 0 && (
        <ul className="focus-strip__runs tnum">
          {p.perRun.map((v, i) => (
            <li key={i} className={target !== undefined && !Number.isNaN(v) && (isSpeed ? v <= target : v >= target) ? 'is-hit' : ''}>
              {Number.isNaN(v) ? 'none' : fmt(v)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function InsightsPanel({ drill, attempt }: { drill: DrillId; attempt: Attempt }) {
  const nav = useNavigate()
  const [history, setHistory] = useState<Attempt[] | null>(null)
  const [focus, setFocus] = useState<FocusProgress | null>(null)

  useEffect(() => {
    store.listAttempts({ drill }).then((all) => {
      setHistory(all)
      setFocus(noteRun(attempt, all))
    })
  }, [drill, attempt])

  const analysis = useMemo(() => (history ? analyze(drill, history, attempt) : null), [history, drill, attempt])
  const pc = useMemo(() => (history ? percentile(attempt, history) : null), [history, attempt])

  if (!history || !analysis) return null

  const onFocus = (f: Finding) => {
    const cfg = readRawDrillConfig(drill)
    const block = startFocus(f, cfg)
    if (!block) return
    saveDrillConfig(drill, { ...cfg, ...block.patch })
    nav(`/drill/${drill}`)
  }

  const shown = analysis.findings
    .filter((f) => !(focus && focus.block.status === 'active' && f.dim === focus.block.dim && f.value === focus.block.value))
    .slice(0, 4)
  const total = history.reduce((s, a) => s + a.answers.length, 0)

  return (
    <section className="result__section insights">
      <div className="insights__head">
        <h2>Insights</h2>
        <Link to="/method" className="faint">
          How these are computed
        </Link>
      </div>
      {pc !== null && (
        <p className="muted">
          {pc >= 0.5
            ? `Better than ${pct(pc)} of your ${history.length - 1} other runs with these settings.`
            : `${pct(1 - pc)} of your ${history.length - 1} other runs with these settings scored higher.`}
        </p>
      )}
      {focus && <FocusStrip p={focus} />}
      {shown.length > 0 ? (
        <ul className="findings">
          {shown.map((f) => (
            <FindingCard key={f.id} f={f} onFocus={onFocus} />
          ))}
        </ul>
      ) : (
        <p className="muted">
          {total < INSIGHTS_AFTER
            ? `Insights start once there is enough to be sure of: ${INSIGHTS_AFTER} problems, ${total} so far.`
            : 'Nothing stands out yet. Categories are within noise of each other, no fade, no lean. Keep the sample growing.'}
        </p>
      )}
    </section>
  )
}
