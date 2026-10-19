/** Small, dependency-free statistics for the insights engine. */

export function median(xs: ArrayLike<number>): number {
  if (xs.length === 0) return NaN
  const s = Float64Array.from(xs).sort()
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN
}

export function quantile(xs: number[], q: number): number {
  if (xs.length === 0) return NaN
  const s = [...xs].sort((a, b) => a - b)
  const i = (s.length - 1) * q
  const lo = Math.floor(i)
  const hi = Math.ceil(i)
  return s[lo] + (s[hi] - s[lo]) * (i - lo)
}

/** Deterministic PRNG so the same history gives the same intervals. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return (s >>> 0) / 4294967296
  }
}

function resample(xs: number[], r: () => number): Float64Array {
  const out = new Float64Array(xs.length)
  for (let i = 0; i < xs.length; i++) out[i] = xs[(r() * xs.length) | 0]
  return out
}

/**
 * Bootstrap interval for the ratio of medians, cell over rest. Returns the
 * point ratio and a 95 percent interval by default. 200 resamples is plenty for a
 * decision, and it runs in a few milliseconds at these sizes.
 */
export const BOOT = 200
export function medianRatioCI(cell: number[], rest: number[], seed = 7, B = BOOT, level = 0.95): { ratio: number; lo: number; hi: number } {
  const ratio = median(cell) / median(rest)
  const r = rng(seed + cell.length * 31 + rest.length)
  const rs: number[] = []
  for (let b = 0; b < B; b++) rs.push(median(resample(cell, r)) / median(resample(rest, r)))
  const a = (1 - level) / 2
  return { ratio, lo: quantile(rs, a), hi: quantile(rs, 1 - a) }
}

/** Wilson score interval for a proportion. */
export function wilson(k: number, n: number, z = 1.645): { p: number; lo: number; hi: number } {
  if (n === 0) return { p: NaN, lo: NaN, hi: NaN }
  const p = k / n
  const d = 1 + (z * z) / n
  const c = (p + (z * z) / (2 * n)) / d
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d
  return { p, lo: c - h, hi: c + h }
}

/** Two-proportion z statistic, p1 minus p2. */
export function twoPropZ(k1: number, n1: number, k2: number, n2: number): { diff: number; z: number } {
  if (n1 === 0 || n2 === 0) return { diff: NaN, z: 0 }
  const p1 = k1 / n1
  const p2 = k2 / n2
  const p = (k1 + k2) / (n1 + n2)
  const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2))
  return { diff: p1 - p2, z: se > 0 ? (p1 - p2) / se : 0 }
}

/** Least-squares slope of y on index, with the fraction of variance explained. */
export function trend(ys: number[]): { slope: number; r2: number } {
  const n = ys.length
  if (n < 3) return { slope: 0, r2: 0 }
  const xm = (n - 1) / 2
  const ym = mean(ys)
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < n; i++) {
    sxy += (i - xm) * (ys[i] - ym)
    sxx += (i - xm) ** 2
    syy += (ys[i] - ym) ** 2
  }
  const slope = sxx ? sxy / sxx : 0
  const r2 = syy ? (sxy * sxy) / (sxx * syy) : 0
  return { slope, r2 }
}

/** Binomial sign test: z for k successes in n against one half. */
export function signZ(k: number, n: number) {
  return n ? (k - n / 2) / Math.sqrt(n / 4) : 0
}

export function pct(x: number) {
  return `${Math.round(x * 100)}%`
}

export function secs(ms: number) {
  return `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)}s`
}
