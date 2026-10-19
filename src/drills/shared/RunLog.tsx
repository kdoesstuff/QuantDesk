import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { scaleLinear, scalePoint, line as d3line, curveMonotoneX, timeFormat } from 'd3'
import type { Attempt, DrillId } from '../../lib/types'
import { store } from '../../lib/storage'
import { readString, writeString } from '../../lib/persist'
import { drillMeta } from '../registry'

const SIZES = [10, 15, 20, 25] as const
const fmtDay = timeFormat('%-d %b')
const fmtFull = timeFormat('%-d %b %Y, %H:%M')

function fmtScore(x: number, unit?: string) {
  return (Number.isInteger(x) ? String(x) : x.toFixed(1)) + (unit ?? '')
}

/** The last N runs plotted oldest to newest. Runs with the current settings are yellow, others blue. */
function LogChart({
  runs,
  currentKey,
  unit,
  higherIsBetter,
}: {
  runs: Attempt[]
  currentKey: string
  unit?: string
  higherIsBetter: boolean
}) {
  const W = 680
  const H = 200
  const padL = 40
  const padR = 14
  const padT = 14
  const padB = 28
  const pts = [...runs].sort((a, b) => a.ts - b.ts)
  const x = scalePoint<number>()
    .domain(pts.map((_, i) => i))
    .range([padL, W - padR])
  const scores = pts.map((p) => p.score)
  const lo = Math.min(0, ...scores)
  const hi = Math.max(1, ...scores)
  const y = scaleLinear()
    .domain([lo, hi])
    .range([H - padB, padT])
    .nice()
  const path = d3line<Attempt>()
    .x((_, i) => x(i)!)
    .y((p) => y(p.score))
    .curve(curveMonotoneX)(pts)!
  const best = higherIsBetter ? Math.max(...scores) : Math.min(...scores)
  // Label every k-th date so they never overlap.
  const every = Math.max(1, Math.ceil(pts.length / 6))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Score of the last runs, oldest to newest">
      {y.ticks(4).map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--ground-3)" />
          <text x={padL - 8} y={y(t)} dy="0.35em" textAnchor="end" fontSize="11" fill="var(--ink-3)">
            {t}
          </text>
        </g>
      ))}
      {pts.map((p, i) =>
        i % every === 0 || i === pts.length - 1 ? (
          <text
            key={p.id}
            x={x(i)}
            y={H - 8}
            textAnchor={i === pts.length - 1 ? 'end' : i === 0 ? 'start' : 'middle'}
            fontSize="11"
            fill="var(--ink-3)"
          >
            {fmtDay(new Date(p.ts))}
          </text>
        ) : null,
      )}
      <path d={path} fill="none" stroke="var(--ground-4)" strokeWidth="1.5" />
      {pts.map((p, i) => (
        <circle
          key={p.id}
          cx={x(i)}
          cy={y(p.score)}
          r={p.score === best ? 5 : 3.5}
          fill={p.configKey === currentKey ? 'var(--yellow)' : 'var(--blue-2)'}
          stroke={p.score === best ? 'var(--ink)' : 'none'}
          strokeWidth="1.5"
        >
          <title>
            {fmtFull(new Date(p.ts))}: {fmtScore(p.score, unit)}, {drillMeta(p.drill).describe(p.config)}
          </title>
        </circle>
      ))}
    </svg>
  )
}

export default function RunLog({ drill, currentKey }: { drill: DrillId; currentKey: string }) {
  const meta = drillMeta(drill)
  const [all, setAll] = useState<Attempt[] | null>(null)
  const [open, setOpen] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(`qd.log.${drill}`) === '1'
    } catch {
      return false
    }
  })
  const [size, setSize] = useState<(typeof SIZES)[number]>(() => {
    const v = Number(readString('qd.log.size'))
    return (SIZES as readonly number[]).includes(v) ? (v as (typeof SIZES)[number]) : 15
  })

  useEffect(() => {
    store.listAttempts({ drill }).then(setAll)
  }, [drill, currentKey])
  useEffect(() => {
    try {
      sessionStorage.setItem(`qd.log.${drill}`, open ? '1' : '0')
    } catch {
      /* ignore */
    }
    writeString('qd.log.size', String(size))
  }, [open, size, drill])

  const runs = useMemo(() => (all ?? []).slice(0, size), [all, size])
  if (!all || all.length === 0) return null
  const higher = meta.higherIsBetter !== false
  const scores = runs.map((r) => r.score)
  const best = higher ? Math.max(...scores) : Math.min(...scores)

  return (
    <section className="runlog">
      <div className="runlog__head">
        <button className="btn btn-ghost btn-small" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? 'Hide log' : `Show log (${all.length} ${all.length === 1 ? 'run' : 'runs'})`}
        </button>
        {open && (
          <div className="seg seg--small" role="group" aria-label="How many runs">
            {SIZES.map((s) => (
              <button key={s} aria-pressed={size === s} onClick={() => setSize(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
      {open && (
        <div className="runlog__body">
          {runs.length > 1 && <LogChart runs={runs} currentKey={currentKey} unit={meta.unit} higherIsBetter={higher} />}
          <p className="faint">
            Last {runs.length} of {all.length}. Yellow points are runs with the current settings, blue are other settings. The ringed point
            is the best of these.
          </p>
          <table className="optable tnum runlog__table">
            <thead>
              <tr>
                <th>When</th>
                <th>Settings</th>
                <th>Score</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className={r.configKey === currentKey ? 'is-current' : ''}>
                  <td>{fmtFull(new Date(r.ts))}</td>
                  <td className="muted">{meta.describe(r.config)}</td>
                  <td>
                    {fmtScore(r.score, meta.unit)}
                    {r.score === best && runs.length > 1 ? <span className="runlog__best"> best</span> : null}
                  </td>
                  <td>
                    <Link to={`/drill/${drill}/result/${r.id}`}>Open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
