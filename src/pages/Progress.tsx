import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { scaleLinear, scaleTime, line as d3line, curveMonotoneX, extent, timeFormat } from 'd3'
import { store, clearEverything } from '../lib/storage'
import type { Attempt } from '../lib/types'
import { drillMeta } from '../drills/registry'
import { analyze, type Finding } from '../insights/analyze'
import { listFocus, progress as focusProgress } from '../insights/focus'
import { FindingCard } from '../insights/InsightsPanel'
import { pct, secs } from '../insights/stats'
import './progress.css'
import '../insights/insights.css'

function dayKey(ts: number) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

/** Sixteen weeks of days, Monday-first, one cell per day. */
function ActivityCalendar({ attempts }: { attempts: Attempt[] }) {
  const weeks = 16
  const counts = new Map<string, number>()
  for (const a of attempts) counts.set(dayKey(a.ts), (counts.get(dayKey(a.ts)) ?? 0) + 1)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dow = (today.getDay() + 6) % 7 // Monday = 0
  const start = new Date(today)
  start.setDate(today.getDate() - dow - (weeks - 1) * 7)

  const cells: { date: Date; n: number }[] = []
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    cells.push({ date: d, n: d > today ? -1 : (counts.get(dayKey(d.getTime())) ?? 0) })
  }
  const max = Math.max(1, ...cells.map((c) => c.n))
  const cell = 14
  const gap = 3
  const W = weeks * (cell + gap)
  const H = 7 * (cell + gap)
  const fmt = timeFormat('%b')
  const months: { x: number; label: string }[] = []
  let lastMonth = -1
  let lastLabelWeek = -10
  for (let w = 0; w < weeks; w++) {
    const d = cells[w * 7].date
    if (d.getMonth() !== lastMonth) {
      // Skip a label when the previous one is too close to read.
      if (w - lastLabelWeek >= 3) {
        months.push({ x: w * (cell + gap), label: fmt(d) })
        lastLabelWeek = w
      }
      lastMonth = d.getMonth()
    }
  }

  return (
    <svg
      viewBox={`0 -18 ${W} ${H + 18}`}
      width="100%"
      style={{ maxWidth: W * 1.6 }}
      role="img"
      aria-label="Sessions per day, last sixteen weeks"
    >
      {months.map((m) => (
        <text key={m.label + m.x} x={m.x} y={-6} fontSize="10" fill="var(--ink-3)">
          {m.label}
        </text>
      ))}
      {cells.map((c, i) => {
        const w = Math.floor(i / 7)
        const d = i % 7
        const t = c.n <= 0 ? 0 : 0.25 + 0.75 * (c.n / max)
        return (
          <rect
            key={i}
            x={w * (cell + gap)}
            y={d * (cell + gap)}
            width={cell}
            height={cell}
            rx={3}
            fill={c.n === -1 ? 'transparent' : c.n === 0 ? 'var(--ground-3)' : 'var(--blue-2)'}
            opacity={c.n > 0 ? t : 1}
          >
            <title>
              {c.date.toDateString()}: {c.n < 0 ? '' : `${c.n} ${c.n === 1 ? 'session' : 'sessions'}`}
            </title>
          </rect>
        )
      })}
    </svg>
  )
}

function ScoreChart({ attempts }: { attempts: Attempt[] }) {
  const W = 680
  const H = 220
  const padL = 36
  const padR = 12
  const padT = 12
  const padB = 26
  const pts = [...attempts].sort((a, b) => a.ts - b.ts)
  if (pts.length < 2) return <p className="muted">Two or more runs with the same settings draw a line here.</p>
  const x = scaleTime()
    .domain(extent(pts, (p) => new Date(p.ts)) as [Date, Date])
    .range([padL, W - padR])
  const y = scaleLinear()
    .domain([0, Math.max(5, ...pts.map((p) => p.score))])
    .range([H - padB, padT])
    .nice()
  const path = d3line<Attempt>()
    .x((p) => x(new Date(p.ts)))
    .y((p) => y(p.score))
    .curve(curveMonotoneX)(pts)!
  const best = Math.max(...pts.map((p) => p.score))
  const fmt = timeFormat('%-d %b')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Score over time">
      {y.ticks(4).map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--ground-3)" />
          <text x={padL - 8} y={y(t)} dy="0.35em" textAnchor="end" fontSize="11" fill="var(--ink-3)">
            {t}
          </text>
        </g>
      ))}
      {x.ticks(5).map((t, i) => (
        <text key={i} x={x(t)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--ink-3)">
          {fmt(t)}
        </text>
      ))}
      <path d={path} fill="none" stroke="var(--blue-2)" strokeWidth="2" />
      {pts.map((p) => (
        <circle
          key={p.id}
          cx={x(new Date(p.ts))}
          cy={y(p.score)}
          r={p.score === best ? 4.5 : 3}
          fill={p.score === best ? 'var(--yellow)' : 'var(--blue-2)'}
        >
          <title>
            {new Date(p.ts).toLocaleString()}: {p.score}
          </title>
        </circle>
      ))}
    </svg>
  )
}

function describe(a: Attempt) {
  return drillMeta(a.drill).describe(a.config)
}
function groupKey(a: Attempt) {
  return `${a.drill}|${a.configKey}`
}

export default function Progress() {
  const [attempts, setAttempts] = useState<Attempt[] | null>(null)
  const [configKey, setConfigKey] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  useEffect(() => {
    store.listAttempts().then(setAttempts)
  }, [])

  const groups = useMemo(() => {
    const m = new Map<string, Attempt[]>()
    for (const a of attempts ?? []) {
      const k = groupKey(a)
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(a)
    }
    return [...m.entries()].sort((x, y) => y[1].length - x[1].length)
  }, [attempts])

  useEffect(() => {
    if (!configKey && groups.length) setConfigKey(groups[0][0])
  }, [groups, configKey])

  // One finding per drill, the strongest, for the work list.
  const work = useMemo(() => {
    const out: Finding[] = []
    const byDrill = new Map<string, Attempt[]>()
    for (const a of attempts ?? []) {
      if (!byDrill.has(a.drill)) byDrill.set(a.drill, [])
      byDrill.get(a.drill)!.push(a)
    }
    for (const list of byDrill.values()) {
      const top = analyze(list[0].drill, list, list[0]).findings.find((f) => f.kind !== 'strength' && f.kind !== 'today')
      if (top) out.push(top)
    }
    return out.sort((x, y) => y.severity - x.severity)
  }, [attempts])
  const blocks = useMemo(() => listFocus().filter((b) => b.status === 'active'), [])

  if (attempts === null) return null

  if (attempts.length === 0) {
    return (
      <div className="page progress">
        <h1 className="display progress__title">Progress</h1>
        <p className="muted">No runs yet.</p>
        <Link to="/drill/speed-arithmetic" className="btn btn-primary">
          Start speed arithmetic
        </Link>
      </div>
    )
  }

  const selected = groups.find((g) => g[0] === configKey)?.[1] ?? []
  const totalProblems = attempts.reduce((s, a) => s + a.correct, 0)
  const days = new Set(attempts.map((a) => dayKey(a.ts))).size
  const minutes = Math.round(attempts.reduce((s, a) => s + a.durationSec, 0) / 60)

  const clear = async () => {
    await store.clearAll()
    clearEverything()
    setAttempts([])
    setConfirmClear(false)
  }

  return (
    <div className="page progress">
      <header className="progress__head">
        <h1 className="display progress__title">Progress</h1>
        <p className="muted">
          {attempts.length} {attempts.length === 1 ? 'run' : 'runs'} on {days} {days === 1 ? 'day' : 'days'},{' '}
          {totalProblems.toLocaleString()} right answers, about {minutes} {minutes === 1 ? 'minute' : 'minutes'} on the clock.
        </p>
      </header>

      {(blocks.length > 0 || work.length > 0) && (
        <section className="progress__section">
          <h2>What to work on</h2>
          {blocks.length > 0 && (
            <ul className="worklist">
              {blocks.map((b) => {
                const p = focusProgress(b, attempts)
                const isSpeed = b.kind === 'slow'
                return (
                  <li key={b.id}>
                    <span className="worklist__drill">Focus block, {drillMeta(b.drill).label}</span>
                    <span className="worklist__headline">{b.label}</span>
                    <span className="muted tnum">
                      {b.runIds.length} {b.runIds.length === 1 ? 'run' : 'runs'}
                      {p.current !== null
                        ? `, last three ${isSpeed ? secs(p.current) : pct(p.current)} against a target of ${isSpeed ? secs(b.target.medMs!) : pct(b.target.acc!)}`
                        : ''}
                      .
                    </span>
                    <Link to={`/drill/${b.drill}`}>Open</Link>
                  </li>
                )
              })}
            </ul>
          )}
          {work.length > 0 && (
            <div className="findings">
              {work.slice(0, 5).map((f) => (
                <div key={f.id} className="worklist__item">
                  <span className="worklist__drill">
                    <Link to={`/drill/${f.drill}`}>{drillMeta(f.drill).label}</Link>
                  </span>
                  <ul className="findings">
                    <FindingCard f={f} />
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="progress__section">
        <h2>Days</h2>
        <ActivityCalendar attempts={attempts} />
      </section>

      <section className="progress__section">
        <div className="progress__row">
          <h2>Score over time</h2>
          {groups.length > 1 && (
            <select className="input progress__select" value={configKey ?? ''} onChange={(e) => setConfigKey(e.target.value)}>
              {groups.map(([k, list]) => (
                <option key={k} value={k}>
                  {drillMeta(list[0].drill).label}: {describe(list[0])} ({list.length})
                </option>
              ))}
            </select>
          )}
        </div>
        {groups.length === 1 && (
          <p className="muted">
            {drillMeta(groups[0][1][0].drill).label}, {describe(groups[0][1][0])}
          </p>
        )}
        <ScoreChart attempts={selected} />
      </section>

      <section className="progress__section">
        <h2>Bests</h2>
        <table className="bests tnum">
          <thead>
            <tr>
              <th>Drill</th>
              <th>Settings</th>
              <th>Runs</th>
              <th>Best</th>
              <th>Latest</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(([k, list]) => {
              const meta = drillMeta(list[0].drill)
              const scores = list.map((a) => a.score)
              const best = meta.higherIsBetter === false ? Math.min(...scores) : Math.max(...scores)
              const latest = list[0]
              const f = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1)) + (meta.unit ?? '')
              return (
                <tr key={k}>
                  <td>{meta.label}</td>
                  <td className="muted">{describe(list[0])}</td>
                  <td>{list.length}</td>
                  <td>{f(best)}</td>
                  <td>
                    <Link to={`/drill/${latest.drill}/result/${latest.id}`}>{f(latest.score)}</Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section className="progress__section progress__danger">
        <p className="faint">
          Everything here lives in this browser only. Nothing is sent anywhere, and clearing your browser data clears it too.
        </p>
        {confirmClear ? (
          <div className="progress__confirm">
            <span>Delete every run, setting and focus block saved in this browser?</span>
            <button className="btn btn-quiet" onClick={clear}>
              Delete all
            </button>
            <button className="btn btn-ghost" onClick={() => setConfirmClear(false)}>
              Keep
            </button>
          </div>
        ) : (
          <button className="btn btn-ghost" onClick={() => setConfirmClear(true)}>
            Clear all data
          </button>
        )}
      </section>
    </div>
  )
}
