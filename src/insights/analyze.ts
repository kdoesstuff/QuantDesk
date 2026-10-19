import type { Attempt, DrillId } from '../lib/types'
import { drillMeta } from '../drills/registry'
import { featurize, OUTCOME_DIMS, TIME_MATTERS, type Row } from './features'
import { mean, median, medianRatioCI, pct, secs, signZ, trend, twoPropZ, wilson } from './stats'

/**
 * The analyzer. It reads a drill's history as rows and looks for things
 * that are both large and well supported: a category you are reliably
 * slower or less accurate on, a drop-off late in runs, errors that come
 * with rushing, a lean in your markets, a calibration gap. Every finding
 * carries the sample it rests on, and nothing is reported below the
 * minimum samples set here.
 */
/** Category tests are many, so they use stricter cutoffs than the single tests. */
export const CUT = {
  /** z for a category accuracy gap (about 1 percent one-sided). */
  catZ: 2.33,
  /** z for a single test like fade or rushing (about 5 percent one-sided). */
  oneZ: 1.645,
  /** Bootstrap interval level for category time ratios. */
  catLevel: 0.95,
  oneLevel: 0.9,
}

export const MIN = {
  /** Rows in a category, and outside it, before a time comparison. */
  timeCell: 15,
  /** Rows before an accuracy comparison. */
  accCell: 20,
  /** Rows per third before a fatigue check. */
  fatigue: 30,
  /** Decisions with a direction before a bias check. */
  bias: 12,
  /** Runs with one config before a trend. */
  trendRuns: 6,
  /** Fermi intervals before a calibration check. */
  calibration: 10,
}

export type FindingKind = 'slow' | 'inaccurate' | 'strength' | 'fatigue' | 'rush' | 'gap' | 'trend' | 'bias' | 'calibration' | 'today' | 'pumps'

export interface Finding {
  id: string
  kind: FindingKind
  drill: DrillId
  /** For category findings: which dimension and value. */
  dim?: string
  value?: string
  headline: string
  detail: string
  n: number
  /** Ranking weight. */
  severity: number
  /** A focus block can be built on it. */
  focusable: boolean
  /** Baseline numbers for a focus block. */
  baseline?: { medMs?: number; acc?: number }
}

export interface Analysis {
  drill: DrillId
  rows: number
  runs: number
  scope: 'config' | 'all'
  findings: Finding[]
}

function byDim(rows: Row[]) {
  const m = new Map<string, Map<string, Row[]>>()
  for (const r of rows) {
    for (const [d, v] of Object.entries(r.dims)) {
      if (!m.has(d)) m.set(d, new Map())
      const vm = m.get(d)!
      if (!vm.has(v)) vm.set(v, [])
      vm.get(v)!.push(r)
    }
  }
  return m
}

function categoryFindings(drill: DrillId, rows: Row[], timeMatters: boolean, scopeNote: string): Finding[] {
  const out: Finding[] = []
  const dims = byDim(rows)
  for (const [dim, values] of dims) {
    if (dim === 'Part of run' || OUTCOME_DIMS.has(dim)) continue
    if (values.size < 2) continue
    for (const [value, cell] of values) {
      const rest = rows.filter((r) => r.dims[dim] !== undefined && r.dims[dim] !== value)
      // Time
      if (timeMatters && cell.length >= MIN.timeCell && rest.length >= MIN.timeCell) {
        const { ratio, lo, hi } = medianRatioCI(
          cell.map((r) => r.ms),
          rest.map((r) => r.ms),
          7,
          undefined,
          CUT.catLevel,
        )
        if (lo > 1.1 && ratio >= 1.2) {
          const medCell = median(cell.map((r) => r.ms))
          const medRest = median(rest.map((r) => r.ms))
          out.push({
            id: `${drill}|${dim}|${value}|slow`,
            kind: 'slow',
            drill,
            dim,
            value,
            headline: `${value}: ${Math.round((ratio - 1) * 100)}% slower than the rest`,
            detail: `${secs(medCell)} a problem against ${secs(medRest)} elsewhere, over ${cell.length} of them${scopeNote}. The gap holds in 95% of resamples (${Math.round((lo - 1) * 100)}% to ${Math.round((hi - 1) * 100)}% slower).`,
            n: cell.length,
            severity: Math.log(ratio) * Math.sqrt(Math.min(cell.length, 60)),
            focusable: true,
            baseline: { medMs: medCell, acc: mean(cell.map((r) => r.correct)) },
          })
        } else if (hi < 0.9 && ratio <= 0.8 && cell.length >= MIN.timeCell * 2) {
          out.push({
            id: `${drill}|${dim}|${value}|strength`,
            kind: 'strength',
            drill,
            dim,
            value,
            headline: `${value}: ${Math.round((1 - ratio) * 100)}% faster than the rest`,
            detail: `${secs(median(cell.map((r) => r.ms)))} a problem over ${cell.length}${scopeNote}. A strength, not a place to spend time.`,
            n: cell.length,
            severity: Math.log(1 / ratio) * Math.sqrt(Math.min(cell.length, 60)) * 0.3,
            focusable: false,
          })
        }
      }
      // Accuracy
      if (cell.length >= MIN.accCell && rest.length >= MIN.accCell) {
        const k1 = cell.reduce((s, r) => s + r.correct, 0)
        const k2 = rest.reduce((s, r) => s + r.correct, 0)
        const { diff, z } = twoPropZ(k1, cell.length, k2, rest.length)
        if (diff <= -0.08 && z <= -CUT.catZ) {
          out.push({
            id: `${drill}|${dim}|${value}|inaccurate`,
            kind: 'inaccurate',
            drill,
            dim,
            value,
            headline: `${value}: ${pct(k1 / cell.length)} right against ${pct(k2 / rest.length)} elsewhere`,
            detail: `${cell.length} answered${scopeNote}. A gap of ${Math.round(-diff * 100)} points, unlikely to be noise (z = ${z.toFixed(1)}).`,
            n: cell.length,
            severity: -diff * 3 * Math.sqrt(Math.min(cell.length, 60)),
            focusable: true,
            baseline: { acc: k1 / cell.length, medMs: median(cell.map((r) => r.ms)) },
          })
        }
      }
    }
  }
  return out
}

function fatigueFinding(drill: DrillId, rows: Row[], timeMatters: boolean): Finding[] {
  const first = rows.filter((r) => r.dims['Part of run'] === 'First third')
  const last = rows.filter((r) => r.dims['Part of run'] === 'Last third')
  if (first.length < MIN.fatigue || last.length < MIN.fatigue) return []
  const out: Finding[] = []
  if (timeMatters) {
    const { ratio, lo } = medianRatioCI(
      last.map((r) => r.ms),
      first.map((r) => r.ms),
      11,
      undefined,
      CUT.oneLevel,
    )
    if (lo > 1.05 && ratio >= 1.12) {
      out.push({
        id: `${drill}|fatigue|time`,
        kind: 'fatigue',
        drill,
        headline: `You slow down ${Math.round((ratio - 1) * 100)}% in the last third of a run`,
        detail: `${secs(median(last.map((r) => r.ms)))} a problem late against ${secs(median(first.map((r) => r.ms)))} early, over ${last.length} late problems. Shorter runs, or a deliberate push at the two-thirds mark, are the fixes.`,
        n: last.length,
        severity: Math.log(ratio) * Math.sqrt(last.length) * 0.8,
        focusable: false,
      })
    }
  }
  const k1 = last.reduce((s, r) => s + r.correct, 0)
  const k2 = first.reduce((s, r) => s + r.correct, 0)
  const { diff, z } = twoPropZ(k1, last.length, k2, first.length)
  if (diff <= -0.06 && z <= -CUT.oneZ) {
    out.push({
      id: `${drill}|fatigue|acc`,
      kind: 'fatigue',
      drill,
      headline: `Accuracy drops ${Math.round(-diff * 100)} points in the last third of a run`,
      detail: `${pct(k1 / last.length)} right late against ${pct(k2 / first.length)} early (z = ${z.toFixed(1)}). Late errors are usually attention, not knowledge.`,
      n: last.length,
      severity: -diff * 3 * Math.sqrt(last.length) * 0.8,
      focusable: false,
    })
  }
  return out
}

function rushFinding(drill: DrillId, rows: Row[]): Finding[] {
  if (rows.length < 60) return []
  const med = median(rows.map((r) => r.ms))
  const fast = rows.filter((r) => r.ms < med)
  const slow = rows.filter((r) => r.ms >= med)
  const kf = fast.reduce((s, r) => s + r.correct, 0)
  const ks = slow.reduce((s, r) => s + r.correct, 0)
  const { diff, z } = twoPropZ(kf, fast.length, ks, slow.length)
  if (diff <= -0.08 && z <= -CUT.oneZ) {
    return [
      {
        id: `${drill}|rush`,
        kind: 'rush',
        drill,
        headline: 'Your fast answers are the wrong ones',
        detail: `Answers under ${secs(med)} are right ${pct(kf / fast.length)} of the time; slower ones ${pct(ks / slow.length)}. That is rushing. A beat of checking before the last digit costs less than a slip.`,
        n: rows.length,
        severity: -diff * 3 * Math.sqrt(rows.length) * 0.7,
        focusable: false,
      },
    ]
  }
  if (diff >= 0.1 && z >= CUT.oneZ) {
    return [
      {
        id: `${drill}|gap`,
        kind: 'gap',
        drill,
        headline: 'When you are slow, you are also wrong',
        detail: `Answers over ${secs(med)} are right only ${pct(ks / slow.length)} of the time, against ${pct(kf / fast.length)} for quick ones. Those are the problems you do not have a method for yet; the category findings above say which.`,
        n: rows.length,
        severity: diff * 2 * Math.sqrt(rows.length) * 0.6,
        focusable: false,
      },
    ]
  }
  return []
}

function trendFinding(drill: DrillId, attempts: Attempt[], configKey: string): Finding[] {
  const same = attempts.filter((a) => a.configKey === configKey).sort((a, b) => a.ts - b.ts)
  if (same.length < MIN.trendRuns) return []
  const meta = drillMeta(drill)
  const scores = same.map((a) => a.score)
  const last = scores.slice(-3)
  const prev = scores.slice(-6, -3)
  const { slope, r2 } = trend(scores.slice(-10))
  const dir = meta.higherIsBetter === false ? -1 : 1
  const better = (median(last) - median(prev)) * dir
  const base = Math.abs(median(prev)) || 1
  const relPct = Math.round((better / base) * 100)
  const unit = meta.unit ?? ''
  if (relPct >= 8 && slope * dir > 0) {
    return [
      {
        id: `${drill}|trend|up`,
        kind: 'trend',
        drill,
        headline: `Up ${relPct}% over your last six runs`,
        detail: `Last three runs median ${fmtScore(median(last))}${unit}, the three before ${fmtScore(median(prev))}${unit}. A straight line explains ${pct(r2)} of the run-to-run variation${r2 >= 0.5 ? ', so this is more than noise' : ', so keep it in perspective'}.`,
        n: same.length,
        severity: 0.5,
        focusable: false,
      },
    ]
  }
  if (Math.abs(relPct) < 5 && same.length >= 8 && r2 < 0.2) {
    return [
      {
        id: `${drill}|trend|flat`,
        kind: 'trend',
        drill,
        headline: `Flat for ${same.length} runs with these settings`,
        detail: `Median ${fmtScore(median(scores.slice(-8)))}${unit} with no trend. A plateau is the signal to change something: a focus block on a weak category, or harder settings.`,
        n: same.length,
        severity: 0.8,
        focusable: false,
      },
    ]
  }
  if (relPct <= -8) {
    return [
      {
        id: `${drill}|trend|down`,
        kind: 'trend',
        drill,
        headline: `Down ${-relPct}% over your last six runs`,
        detail: `Last three runs median ${fmtScore(median(last))}${unit}, the three before ${fmtScore(median(prev))}${unit}. Tiredness, time of day, or a settings change usually explains a dip; three more runs will tell.`,
        n: same.length,
        severity: 0.6,
        focusable: false,
      },
    ]
  }
  return []
}

function fmtScore(x: number) {
  return Number.isInteger(x) ? String(x) : x.toFixed(1)
}

function biasFindings(drill: DrillId, rows: Row[]): Finding[] {
  const out: Finding[] = []
  const checks: { dim: string; high: string; low: string; what: string; fix: [string, string] }[] = [
    { dim: 'Your mid', high: 'Mid above fair', low: 'Mid below fair', what: 'your quotes', fix: ['You are overvaluing the hidden part. Count the expected value of what you cannot see before you anchor on what you can.', 'You are undervaluing the hidden part. Three and a half a die, and a card averages what is left in the deck.'] },
    { dim: 'Lean', high: 'Quoted high', low: 'Quoted low', what: 'your estimates', fix: ['Shade the first number that comes to mind down by a third before you quote.', 'Shade the first number that comes to mind up by a third before you quote.'] },
    { dim: 'Lean', high: 'Guessed high', low: 'Guessed low', what: 'your estimates', fix: ['Your decompositions multiply too many generous factors. Round each factor down.', 'Your decompositions leave factors out. Write the chain before the number.'] },
    { dim: 'Timing', high: 'Fired late', low: 'Fired early', what: 'your shots', fix: ['Fire when the target is one travel time away, not when it looks close.', 'You are anticipating too much. Hold a beat longer.'] },
  ]
  for (const c of checks) {
    const hi = rows.filter((r) => r.dims[c.dim] === c.high).length
    const lo = rows.filter((r) => r.dims[c.dim] === c.low).length
    const n = hi + lo
    if (n < MIN.bias) continue
    const z = signZ(hi, n)
    if (Math.abs(z) >= 1.96) {
      const highSide = z > 0
      out.push({
        id: `${drill}|bias|${c.dim}`,
        kind: 'bias',
        drill,
        dim: c.dim,
        value: highSide ? c.high : c.low,
        headline: `${highSide ? c.high : c.low} in ${pct(Math.max(hi, lo) / n)} of ${c.what}`,
        detail: `${Math.max(hi, lo)} of ${n} with a clear lean went the same way (z = ${z.toFixed(1)}). ${highSide ? c.fix[0] : c.fix[1]}`,
        n,
        severity: Math.abs(z) * 0.5,
        focusable: false,
      })
    }
  }
  return out
}

function calibrationFinding(drill: DrillId, attempts: Attempt[]): Finding[] {
  if (drill !== 'fermi') return []
  const withInt = attempts.flatMap((a) => a.answers.filter((l) => l.tags?.hasInterval))
  if (withInt.length < MIN.calibration) return []
  const hits = withInt.filter((l) => l.tags?.hit).length
  const { p, lo, hi } = wilson(hits, withInt.length)
  if (hi < 0.9) {
    return [
      {
        id: `${drill}|calibration|over`,
        kind: 'calibration',
        drill,
        headline: `Your 90% intervals catch the answer ${pct(p)} of the time`,
        detail: `${hits} of ${withInt.length}. Even allowing for luck the rate is under 90% (interval ${pct(lo)} to ${pct(hi)}). Widen the range: a factor of three each way is normal for a Fermi question.`,
        n: withInt.length,
        severity: (0.9 - p) * 4 * Math.sqrt(withInt.length) * 0.3,
        focusable: false,
      },
    ]
  }
  const widths = withInt.map((l) => Number(l.tags?.widthLog ?? 0))
  if (p >= 0.97 && withInt.length >= 20 && median(widths) > 1.5) {
    return [
      {
        id: `${drill}|calibration|under`,
        kind: 'calibration',
        drill,
        headline: `Your intervals are wider than they need to be`,
        detail: `${hits} of ${withInt.length} caught, with a median width of ${Math.round(10 ** median(widths))}x. At 90% you should miss one in ten; you are missing almost none. Tighten.`,
        n: withInt.length,
        severity: 0.5,
        focusable: false,
      },
    ]
  }
  return []
}

function pumpsFindings(drill: DrillId, attempts: Attempt[]): Finding[] {
  if (drill !== 'balloon') return []
  const out: Finding[] = []
  for (const colour of ['blue', 'yellow', 'red']) {
    const rows = attempts.flatMap((a) => a.answers.filter((l) => l.tags?.colour === colour))
    if (rows.length < 8) continue
    const banked = rows.filter((l) => !l.tags?.popped)
    const optimal = Number(rows[0].tags?.optimal)
    const adj = banked.length ? mean(banked.map((l) => Number(l.tags?.pumps))) : 0
    const pops = rows.length - banked.length
    const cap = colour.charAt(0).toUpperCase() + colour.slice(1)
    if (banked.length >= 5 && adj < optimal * 0.6) {
      out.push({ id: `${drill}|pumps|${colour}|under`, kind: 'pumps', drill, headline: `${cap}: you stop at ${adj.toFixed(0)} pumps, the sweet spot is ${optimal}`, detail: `${banked.length} banked, ${pops} popped. You are leaving money on ${colour} balloons: expected value keeps rising until about half the limit.`, n: rows.length, severity: 0.6, focusable: false })
    } else if (pops / rows.length > 0.5 && rows.length >= 10) {
      out.push({ id: `${drill}|pumps|${colour}|over`, kind: 'pumps', drill, headline: `${cap}: ${pct(pops / rows.length)} of them pop`, detail: `${pops} of ${rows.length}. The sweet spot is ${optimal} pumps; past it each pump risks more than it adds.`, n: rows.length, severity: 0.7, focusable: false })
    }
  }
  return out
}

/** How this run compares with the same settings, and which categories were off today. */
function todayFindings(drill: DrillId, attempt: Attempt, rows: Row[], timeMatters: boolean): Finding[] {
  const out: Finding[] = []
  if (!timeMatters) return out
  const today = rows.filter((r) => r.attemptId === attempt.id)
  const before = rows.filter((r) => r.attemptId !== attempt.id)
  if (today.length < 10 || before.length < 60) return out
  const dims = byDim(today)
  let best: Finding | null = null
  for (const [dim, values] of dims) {
    if (dim === 'Part of run' || OUTCOME_DIMS.has(dim)) continue
    for (const [value, cell] of values) {
      if (cell.length < 6) continue
      const hist = before.filter((r) => r.dims[dim] === value)
      if (hist.length < MIN.timeCell) continue
      const { ratio, lo } = medianRatioCI(
        cell.map((r) => r.ms),
        hist.map((r) => r.ms),
        3,
      )
      if (lo > 1.1 && ratio >= 1.25) {
        const f: Finding = {
          id: `${drill}|today|${dim}|${value}`,
          kind: 'today',
          drill,
          dim,
          value,
          headline: `Today ${value.toLowerCase()} ran ${Math.round((ratio - 1) * 100)}% slower than your usual`,
          detail: `${secs(median(cell.map((r) => r.ms)))} this run against ${secs(median(hist.map((r) => r.ms)))} over ${hist.length} earlier problems.`,
          n: cell.length,
          severity: Math.log(ratio) * Math.sqrt(cell.length) * 0.5,
          focusable: false,
        }
        if (!best || f.severity > best.severity) best = f
      }
    }
  }
  if (best) out.push(best)
  return out
}

export function analyze(drill: DrillId, attempts: Attempt[], latest?: Attempt): Analysis {
  const all = attempts.filter((a) => a.drill === drill)
  const timeMatters = TIME_MATTERS[drill] !== false
  const configKey = latest?.configKey ?? all[0]?.configKey ?? ''
  const sameCfg = all.filter((a) => a.configKey === configKey)
  // Prefer same-settings history for category comparisons when there is enough of it.
  const rowsSame = featurize(drill, sameCfg)
  const rowsAll = featurize(drill, all)
  const useSame = sameCfg.length >= 3 && rowsSame.length >= 120
  const rows = useSame ? rowsSame : rowsAll
  const scopeNote = useSame ? ` in ${sameCfg.length} runs with these settings` : ` across ${all.length} runs`
  const findings: Finding[] = [
    ...categoryFindings(drill, rows, timeMatters, scopeNote),
    ...fatigueFinding(drill, rows, timeMatters),
    ...(timeMatters ? rushFinding(drill, rows) : []),
    ...trendFinding(drill, all, configKey),
    ...biasFindings(drill, rowsAll),
    ...calibrationFinding(drill, all),
    ...pumpsFindings(drill, all),
    ...(latest ? todayFindings(drill, latest, rowsAll, timeMatters) : []),
  ]
  // Keep one finding per category value (the stronger of slow and inaccurate) and rank.
  const seen = new Map<string, Finding>()
  for (const f of findings) {
    const key = f.dim && f.value && (f.kind === 'slow' || f.kind === 'inaccurate') ? `${f.dim}|${f.value}` : f.id
    const cur = seen.get(key)
    if (!cur || f.severity > cur.severity) seen.set(key, f)
  }
  const ranked = [...seen.values()].sort((a, b) => b.severity - a.severity)
  return { drill, rows: rows.length, runs: all.length, scope: useSame ? 'config' : 'all', findings: ranked }
}

/** Percentile of this run's score among runs with the same settings. */
export function percentile(attempt: Attempt, peers: Attempt[]): number | null {
  const same = peers.filter((a) => a.configKey === attempt.configKey && a.id !== attempt.id)
  if (same.length < 3) return null
  const dir = drillMeta(attempt.drill).higherIsBetter === false ? -1 : 1
  const beaten = same.filter((a) => (attempt.score - a.score) * dir > 0).length
  return beaten / same.length
}
