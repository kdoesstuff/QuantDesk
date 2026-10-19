import { scaleLinear, scaleBand, line as d3line, curveMonotoneX, median } from 'd3'

/** Seconds per item across a run, bars coloured by category, with a smoothed trend and the median. */
export default function PaceChart({
  ms,
  colours,
  label = 'Seconds per problem across the run',
}: {
  ms: number[]
  colours?: string[]
  label?: string
}) {
  const W = 640
  const H = 160
  const padL = 36
  const padB = 22
  const padT = 10
  if (ms.length === 0) return null
  const x = scaleBand<number>()
    .domain(ms.map((_, i) => i))
    .range([padL, W - 8])
    .padding(ms.length > 80 ? 0.1 : 0.25)
  const maxS = Math.max(2, ...ms.map((m) => m / 1000))
  const y = scaleLinear()
    .domain([0, maxS])
    .range([H - padB, padT])
    .nice()
  const med = median(ms)! / 1000

  const trend = ms.map((_, i) => {
    const w = ms.slice(Math.max(0, i - 2), i + 3)
    return w.reduce((a, b) => a + b, 0) / w.length / 1000
  })
  const trendPath = d3line<number>()
    .x((_, i) => x(i)! + x.bandwidth() / 2)
    .y((v) => y(v))
    .curve(curveMonotoneX)(trend)!

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label}>
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
          fill={colours?.[i] ?? 'var(--blue-2)'}
          opacity={0.55}
          rx={Math.min(2, x.bandwidth() / 2)}
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
