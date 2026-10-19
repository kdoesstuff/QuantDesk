import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { Attempt, DrillId } from '../../lib/types'
import { store } from '../../lib/storage'
import Sparkline from '../../components/Sparkline'
import { useEnter } from './hooks'
import './drill.css'

/* Config ------------------------------------------------------------------- */

/** Best and recent runs with the current settings. Hidden until there is history. */
export function Standing({
  drill,
  configKey,
  unit,
  higherIsBetter = true,
}: {
  drill: DrillId
  configKey: string
  unit?: string
  higherIsBetter?: boolean
}) {
  const [history, setHistory] = useState<Attempt[]>([])
  useEffect(() => {
    store.listAttempts({ drill, configKey, limit: 30 }).then(setHistory)
  }, [drill, configKey])
  if (history.length === 0) return null
  const scores = history.map((a) => a.score)
  const best = higherIsBetter ? Math.max(...scores) : Math.min(...scores)
  const series = [...history].reverse().map((a) => a.score)
  return (
    <aside className="standing">
      <h3>With these settings</h3>
      <p className="standing__best">
        <span className="tnum">
          {Number.isInteger(best) ? best : best.toFixed(1)}
          {unit ? <small>{unit}</small> : null}
        </span>
        <span className="muted">best of {history.length}</span>
      </p>
      {series.length > 1 && (
        <>
          <Sparkline values={series} height={56} />
          <p className="faint">Last {Math.min(30, history.length)} runs, oldest to newest.</p>
        </>
      )}
    </aside>
  )
}

export function ConfigFrame({
  title,
  blurb,
  children,
  aside,
  below,
  howTo,
  onStart,
  valid = true,
  startLabel = 'Start',
}: {
  title: string
  blurb: ReactNode
  children: ReactNode
  aside?: ReactNode
  /** Numbered steps shown under the blurb. */
  howTo?: string[]
  /** Rendered under the settings grid, full width. */
  below?: ReactNode
  onStart: () => void
  valid?: boolean
  startLabel?: string
}) {
  useEnter(onStart, valid)
  return (
    <div className="page drill-config">
      <header className="drill-head">
        <h1 className="display">{title}</h1>
        <p className="muted">{blurb}</p>
        {howTo && howTo.length > 0 && (
          <details className="howto" open>
            <summary>How to play</summary>
            <ol>
              {howTo.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ol>
          </details>
        )}
      </header>
      <div className="drill-config__grid">
        <section className="settings">
          {children}
          <div className="setting setting--start">
            <button className="btn btn-primary" onClick={onStart} disabled={!valid}>
              {startLabel}
            </button>
            <span className="faint key-hint">Enter</span>
          </div>
        </section>
        {aside}
      </div>
      {below}
    </div>
  )
}

export function Setting({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <div className="setting">
      <h3>{title}</h3>
      {children}
      {note ? <p className="faint setting__note">{note}</p> : null}
    </div>
  )
}

export function Seg<T extends string | number | boolean>({
  options,
  value,
  onChange,
  label,
  format,
}: {
  options: readonly T[]
  value: T
  onChange: (v: T) => void
  label: string
  format?: (v: T) => string
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o)} aria-pressed={value === o} onClick={() => onChange(o)}>
          {format ? format(o) : String(o)}
        </button>
      ))}
    </div>
  )
}

export function Chips<T extends string>({
  options,
  value,
  onToggle,
  labels,
}: {
  options: readonly T[]
  value: readonly T[]
  onToggle: (v: T) => void
  labels: Record<T, string>
}) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button key={o} className="chip" aria-pressed={value.includes(o)} onClick={() => onToggle(o)}>
          {labels[o]}
        </button>
      ))}
    </div>
  )
}

/** Toggle a value in a list, never emptying it. */
export function toggleIn<T>(list: T[], v: T): T[] {
  const has = list.includes(v)
  if (has && list.length === 1) return list
  return has ? list.filter((x) => x !== v) : [...list, v]
}

export function Range({
  label,
  min,
  max,
  onChange,
  step = 1,
}: {
  label: string
  min: number
  max: number
  onChange: (min: number, max: number) => void
  step?: number
}) {
  return (
    <div className="range">
      <span>{label}</span>
      <input
        className="input tnum"
        type="number"
        inputMode="numeric"
        step={step}
        value={min}
        onChange={(e) => onChange(Number(e.target.value), max)}
        aria-label={`${label} minimum`}
      />
      <span className="range__to">to</span>
      <input
        className="input tnum"
        type="number"
        inputMode="numeric"
        step={step}
        value={max}
        onChange={(e) => onChange(min, Number(e.target.value))}
        aria-label={`${label} maximum`}
      />
    </div>
  )
}

/* Run ---------------------------------------------------------------------- */

/** Back to the settings page. Esc does the same on a keyboard; this is for phones. */
function StopButton() {
  const loc = useLocation()
  const to = loc.pathname.replace(/\/run\/?$/, '') || '/'
  return (
    <Link to={to} className="run__stop" aria-label="Stop and go back to settings">
      Stop
    </Link>
  )
}

export function RunFrame({
  pct,
  left,
  right,
  children,
  hint = 'Esc to stop',
  countdown,
  wide,
}: {
  /** Clock bar fill, 0 to 100. */
  pct: number
  left: ReactNode
  right: ReactNode
  children: ReactNode
  hint?: ReactNode
  /** When set, shows the 3-2-1 instead of children. 0 shows "Go". */
  countdown?: number | null
  wide?: boolean
}) {
  return (
    <div className={'run' + (wide ? ' run--wide' : '')}>
      <div className="run__clock" aria-hidden="true">
        <div className="run__clock-bar" style={{ width: `${pct}%` }} />
      </div>
      <div className="run__meta">
        <span className="tnum run__time">{left}</span>
        <StopButton />
        <span className="tnum run__score">{right}</span>
      </div>
      {countdown !== null && countdown !== undefined ? (
        <div className="run__center">
          <div className="run__count tnum" key={countdown}>
            {countdown === 0 ? 'Go' : countdown}
          </div>
        </div>
      ) : (
        <div className="run__center">{children}</div>
      )}
      <p className="run__hint faint">{hint}</p>
    </div>
  )
}

/* Result ------------------------------------------------------------------- */

export function ResultFrame({
  drill,
  attempt,
  subtitle,
  scoreText,
  line,
  children,
  unit,
  higherIsBetter = true,
}: {
  drill: DrillId
  attempt: Attempt
  subtitle: string
  /** Big number. Defaults to the score. */
  scoreText?: string
  /** Line under the score. */
  line?: ReactNode
  children?: ReactNode
  unit?: string
  higherIsBetter?: boolean
}) {
  const nav = useNavigate()
  const [peers, setPeers] = useState<Attempt[] | null>(null)
  useEffect(() => {
    store.listAttempts({ drill, configKey: attempt.configKey }).then((all) => setPeers(all.filter((x) => x.id !== attempt.id)))
  }, [drill, attempt])
  const again = () => nav(`/drill/${drill}/run`)
  useEnter(again)

  let verdict = ''
  if (peers) {
    if (peers.length === 0) verdict = 'First run with these settings.'
    else {
      const scores = peers.map((a) => a.score)
      const prevBest = higherIsBetter ? Math.max(...scores) : Math.min(...scores)
      const f = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1)) + (unit ?? '')
      const better = higherIsBetter ? attempt.score > prevBest : attempt.score < prevBest
      verdict = better
        ? `New best, from ${f(prevBest)}.`
        : attempt.score === prevBest
          ? `Ties your best of ${f(prevBest)}.`
          : `Best with these settings is ${f(prevBest)}.`
    }
  }

  return (
    <div className="page result">
      <header className="result__head">
        <p className="muted">{subtitle}</p>
        <div className="result__score">
          <span className="tnum">
            {scoreText ?? (Number.isInteger(attempt.score) ? attempt.score : attempt.score.toFixed(1))}
            {unit ? <small>{unit}</small> : null}
          </span>
          <span className="result__verdict">{verdict}</span>
        </div>
        {line ? <p className="muted tnum">{line}</p> : null}
      </header>
      <div className="result__actions">
        <button className="btn btn-primary" onClick={again}>
          Again
        </button>
        <span className="faint key-hint">Enter</span>
        <Link to={`/drill/${drill}`} className="btn btn-ghost">
          Change settings
        </Link>
      </div>
      {children}
    </div>
  )
}

export function Missing({ drill }: { drill: DrillId }) {
  return (
    <div className="page">
      <p className="muted">That run isn't here. It may have been cleared.</p>
      <Link to={`/drill/${drill}`} className="btn btn-quiet">
        Back to settings
      </Link>
    </div>
  )
}

/** Hook: load one attempt by id for a drill. */
export function useAttempt<C>(drill: DrillId, id: string | undefined) {
  const [attempt, setAttempt] = useState<Attempt<C> | null | undefined>(undefined)
  useEffect(() => {
    store.listAttempts({ drill }).then((all) => setAttempt((all.find((x) => x.id === id) as Attempt<C> | undefined) ?? null))
  }, [drill, id])
  return attempt
}

/** A simple category table used by most result pages. */
export function CategoryTable({
  rows,
  head = ['', 'Answered', 'First try', 'Median'],
}: {
  rows: { label: ReactNode; n: number; firstTry: number; medMs: number }[]
  head?: string[]
}) {
  return (
    <table className="optable tnum">
      <thead>
        <tr>
          {head.map((h, i) => (
            <th key={i}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td>{r.label}</td>
            <td>{r.n}</td>
            <td>{r.n ? `${Math.round((r.firstTry / r.n) * 100)}%` : 'none'}</td>
            <td>{r.n ? `${(r.medMs / 1000).toFixed(1)}s` : 'none'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
