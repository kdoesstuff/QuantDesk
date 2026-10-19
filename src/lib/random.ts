/** Small random helpers shared by every generator. */

export function rint(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1))
}

export function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)]
}

/** Pick with weights (same length as list). */
export function pickWeighted<T>(list: readonly T[], weights: readonly number[]): T {
  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < list.length; i++) {
    r -= weights[i]
    if (r <= 0) return list[i]
  }
  return list[list.length - 1]
}

export function chance(p: number) {
  return Math.random() < p
}

export function shuffle<T>(list: readonly T[]): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Standard normal via Box-Muller. */
export function gauss() {
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

/** Round to n decimal places, avoiding float dust. */
export function round(x: number, places = 0) {
  const f = 10 ** places
  return Math.round((x + Number.EPSILON) * f) / f
}

/** Format a number for display: thousands separators, up to `places` decimals, no trailing zeros. */
export function fmt(x: number, places = 2) {
  const r = round(x, places)
  return r.toLocaleString('en-US', { maximumFractionDigits: places })
}

/** Greatest common divisor. */
export function gcd(a: number, b: number): number {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b) [a, b] = [b, a % b]
  return a
}
