import { line as d3line, scaleLinear, curveMonotoneX } from 'd3'

/** A small, quiet line of a series. Dots only on the last point. */
export default function Sparkline({
  values,
  height = 48,
  width = 240,
}: {
  values: number[]
  height?: number
  width?: number
}) {
  if (values.length === 0) return null
  const pad = 6
  const x = scaleLinear()
    .domain([0, Math.max(1, values.length - 1)])
    .range([pad, width - pad])
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const y = scaleLinear()
    .domain([lo === hi ? lo - 1 : lo, lo === hi ? hi + 1 : hi])
    .range([height - pad, pad])
  const path = d3line<number>()
    .x((_, i) => x(i))
    .y((v) => y(v))
    .curve(curveMonotoneX)(values)!
  const last = values[values.length - 1]
  const best = Math.max(...values)
  const bestIdx = values.indexOf(best)

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      role="img"
      aria-label={`${values.length} runs, best ${best}, latest ${last}`}
    >
      <path d={path} fill="none" stroke="var(--cobalt)" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
      <circle cx={x(bestIdx)} cy={y(best)} r="3.2" fill="var(--marigold)" />
      <circle cx={x(values.length - 1)} cy={y(last)} r="3.2" fill="var(--cobalt)" />
    </svg>
  )
}
