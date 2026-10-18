import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { scaleLinear, scaleBand, line as d3line, curveMonotoneX, median } from 'd3'
import type { Attempt, Operation, SpeedArithmeticConfig } from '../../lib/types'
import { store } from '../../lib/storage'
import { OP_LABEL, OP_SIGN } from './generator'
import './drill.css'

function PaceChart({ ms, ops }: { ms: number[]; ops: Operation[] }) {
  const W = 640
  const H = 160
  const padL = 36
  const padB = 22
  const padT = 10
  if (ms.length === 0) return null
  const x = scaleBand<number>()
    .domain(ms.map((_, i) => i))
    .range([padL, W - 8])
    .padding(0.25)
  const maxS = Math.max(2, ...ms.map((m) => m / 1000))
  const y = scaleLinear().domain([0, maxS]).range([H - padB, padT]).nice()
  const med = median(ms)! / 1000

  const colour: Record<Operation, string> = {
    add: 'var(--blue-2)',
    sub: 'var(--blue-2)',
    mul: 'var(--yellow)',
    div: 'var(--yellow)',
  }

  // Smoothed trend (moving average of 5)
  const trend = ms.map((_, i) => {
    const w = ms.slice(Math.max(0, i - 2), i + 3)
    return w.reduce((a, b) => a + b, 0) / w.length / 1000
  })
  const trendPath = d3line<number>()
    .x((_, i) => x(i)! + x.bandwidth() / 2)
    .y((v) => y(v))
    .curve(curveMonotoneX)(trend)!

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Seconds per problem across the run">
      {y.ticks(3).map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - 8} y1={y(t)} y2={y(t)} stroke="var(--ground-3)" />
          <text x={padL - 8} y={y(t)} dy="0.35em" textAnchor="end" fontSize="11" fill="var(--ink-3)">
            {t}s
          </text>
        </g>
      ))}
      {ms.map((m, i) => (
        <rect
          key={i}
          x={x(i)}
          y={y(m / 1000)}
          width={x.bandwidth()}
          height={H - padB - y(m / 1000)}
          fill={colour[ops[i]]}
          opacity={0.55}
        />
      ))}
      <path d={trendPath} fill="none" stroke="var(--ink)" strokeWidth="1.6" />
      <line x1={padL} x2={W - 8} y1={y(med)} y2={y(med)} stroke="var(--ink-2)" strokeDasharray="3 4" />
      <line x1={W - 96} x2={W - 76} y1={padT + 2} y2={padT + 2} stroke="var(--ink-2)" strokeDasharray="3 4" />
      <text x={W - 70} y={padT + 6} fontSize="11" fill="var(--ink-2)">
        median {med.toFixed(1)}s
      </text>
      <text x={padL} y={H - 6} fontSize="11" fill="var(--ink-3)">
        first
      </text>
      <text x={W - 8} y={H - 6} fontSize="11" fill="var(--ink-3)" textAnchor="end">
        last
      </text>
    </svg>
  )
}

export default function SpeedArithmeticResult() {
  const { id } = useParams()
  const nav = useNavigate()
  const [attempt, setAttempt] = useState<Attempt<SpeedArithmeticConfig> | null>(null)
  const [peers, setPeers] = useState<Attempt[]>([])

  useEffect(() => {
    store.listAttempts({ drill: 'speed-arithmetic' }).then((all) => {
      const a = all.find((x) => x.id === id) as Attempt<SpeedArithmeticConfig> | undefined
      if (!a) return
      setAttempt(a)
      setPeers(all.filter((x) => x.configKey === a.configKey && x.id !== a.id))
    })
  }, [id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') nav('/drill/speed-arithmetic/run')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [nav])

  const stats = useMemo(() => {
    if (!attempt) return null
    const answered = attempt.answers.filter((l) => l.given !== null)
    const byOp = (['add', 'sub', 'mul', 'div'] as Operation[])
      .filter((op) => attempt.config.ops.includes(op))
      .map((op) => {
        const rows = answered.filter((l) => l.op === op)
        const firstTry = rows.filter((l) => l.misses === 0).length
        return {
          op,
          n: rows.length,
          firstTry,
          medMs: rows.length ? median(rows.map((r) => r.ms))! : 0,
        }
      })
    const slips = attempt.answers.filter((l) => l.misses > 0)
    return { answered, byOp, slips }
  }, [attempt])

  if (!attempt || !stats) {
    return (
      <div className="page">
        <p className="muted">That run isn't here. It may have been cleared.</p>
        <Link to="/drill/speed-arithmetic" className="btn btn-quiet">
          Back to settings
        </Link>
      </div>
    )
  }

  const prevBest = peers.reduce((m, a) => Math.max(m, a.score), 0)
  const isBest = peers.length > 0 && attempt.score > prevBest
  const perMin = (attempt.score / attempt.durationSec) * 60

  return (
    <div className="page result">
      <header className="result__head">
        <p className="muted">Speed arithmetic, {attempt.durationSec < 60 ? `${attempt.durationSec}s` : `${attempt.durationSec / 60} min`}</p>
        <div className="result__score">
          <span className="tnum">{attempt.score}</span>
          <span className="result__verdict">
            {peers.length === 0
              ? 'First run with these settings.'
              : isBest
                ? `New best, up from ${prevBest}.`
                : attempt.score === prevBest
                  ? `Ties your best of ${prevBest}.`
                  : `Best with these settings is ${prevBest}.`}
          </span>
        </div>
        <p className="muted tnum">
          {Math.round(perMin)} a minute, {attempt.wrong === 0 ? 'no slips.' : `${attempt.wrong} ${attempt.wrong === 1 ? 'slip.' : 'slips.'}`}
        </p>
      </header>

      <div className="result__actions">
        <button className="btn btn-primary" onClick={() => nav('/drill/speed-arithmetic/run')}>
          Again
        </button>
        <span className="faint">Enter</span>
        <Link to="/drill/speed-arithmetic" className="btn btn-ghost">
          Change settings
        </Link>
      </div>

      <section className="result__section">
        <h2>Pace</h2>
        <p className="muted">Seconds per problem, in order. Blue is add and subtract, yellow is multiply and divide.</p>
        <PaceChart ms={stats.answered.map((l) => l.ms)} ops={stats.answered.map((l) => l.op)} />
      </section>

      <section className="result__section">
        <h2>By operation</h2>
        <table className="optable tnum">
          <thead>
            <tr>
              <th></th>
              <th>Answered</th>
              <th>First try</th>
              <th>Median</th>
            </tr>
          </thead>
          <tbody>
            {stats.byOp.map((r) => (
              <tr key={r.op}>
                <td>
                  <span className="optable__sign">{OP_SIGN[r.op]}</span> {OP_LABEL[r.op]}
                </td>
                <td>{r.n}</td>
                <td>{r.n ? `${Math.round((r.firstTry / r.n) * 100)}%` : 'none'}</td>
                <td>{r.n ? `${(r.medMs / 1000).toFixed(1)}s` : 'none'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {stats.slips.length > 0 && (
        <section className="result__section">
          <h2>Where it slipped</h2>
          <ul className="slips tnum">
            {stats.slips.map((l, i) => (
              <li key={i}>
                <span>
                  {l.a} {OP_SIGN[l.op]} {l.b} = {l.answer}
                </span>
                <span className="muted">
                  {l.misses} wrong {l.misses === 1 ? 'try' : 'tries'}
                  {l.given === null ? ', then time' : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
