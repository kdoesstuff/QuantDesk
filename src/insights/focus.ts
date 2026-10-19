import type { Attempt, DrillId } from '../lib/types'
import { featurize } from './features'
import { median } from './stats'
import type { Finding } from './analyze'
import { recommend } from './recommend'

/**
 * Focus blocks. A block pins the settings that isolate a weak category,
 * records a baseline, and clears itself once the last few runs under those
 * settings beat the target. The target is a real improvement held over a
 * window, not a single good run: 15 percent faster, or 8 points more
 * accurate, over the last three runs with at least 20 problems between
 * them.
 */
export interface FocusBlock {
  id: string
  drill: DrillId
  dim: string
  value: string
  kind: 'slow' | 'inaccurate'
  label: string
  advice: string
  patch: Record<string, unknown>
  /** Settings before the block, to restore afterwards. */
  prevConfig?: Record<string, unknown>
  baseline: { medMs?: number; acc?: number }
  target: { medMs?: number; acc?: number }
  startedAt: number
  runIds: string[]
  status: 'active' | 'cleared' | 'stopped'
  clearedAt?: number
}

const KEY = 'qd.focus.v1'
export const WINDOW = 3
export const MIN_ROWS = 20
export const SPEED_GAIN = 0.15
export const ACC_GAIN = 0.08

export function listFocus(): FocusBlock[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as FocusBlock[]) : []
  } catch {
    return []
  }
}

function save(list: FocusBlock[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* ignore */
  }
}

export function activeFocus(drill: DrillId): FocusBlock | null {
  return listFocus().find((b) => b.drill === drill && b.status === 'active') ?? null
}

export function startFocus(f: Finding, prevConfig?: Record<string, unknown>): FocusBlock | null {
  if (!f.dim || !f.value || (f.kind !== 'slow' && f.kind !== 'inaccurate')) return null
  const rec = recommend(f)
  if (!rec || !rec.patch) return null
  const list = listFocus().map((b) => (b.drill === f.drill && b.status === 'active' ? { ...b, status: 'stopped' as const } : b))
  const block: FocusBlock = {
    id: `${f.drill}|${f.dim}|${f.value}|${Date.now().toString(36)}`,
    drill: f.drill,
    dim: f.dim,
    value: f.value,
    kind: f.kind,
    label: rec.label,
    advice: rec.advice,
    patch: rec.patch,
    prevConfig,
    baseline: f.baseline ?? {},
    target: {
      medMs: f.kind === 'slow' && f.baseline?.medMs ? Math.round(f.baseline.medMs * (1 - SPEED_GAIN)) : undefined,
      acc: f.kind === 'inaccurate' && f.baseline?.acc !== undefined ? Math.min(0.98, f.baseline.acc + ACC_GAIN) : undefined,
    },
    startedAt: Date.now(),
    runIds: [],
    status: 'active',
  }
  list.push(block)
  save(list)
  return block
}

export function stopFocus(id: string) {
  save(listFocus().map((b) => (b.id === id ? { ...b, status: 'stopped' as const } : b)))
}

/** Does this attempt's config honour the block's patch. */
export function matchesPatch(config: unknown, patch: Record<string, unknown>) {
  const c = config as Record<string, unknown>
  return Object.entries(patch).every(([k, v]) => JSON.stringify(c?.[k]) === JSON.stringify(v))
}

export interface FocusProgress {
  block: FocusBlock
  /** One number per counted run: median ms or accuracy of the focus category. */
  perRun: number[]
  /** The window metric, if there are enough rows. */
  current: number | null
  rowsInWindow: number
  met: boolean
}

/** Record a finished run against the active block, and clear the block if the target is met. */
export function noteRun(attempt: Attempt, history: Attempt[]): FocusProgress | null {
  const list = listFocus()
  const idx = list.findIndex((b) => b.drill === attempt.drill && b.status === 'active')
  if (idx < 0) return null
  const block = list[idx]
  if (!matchesPatch(attempt.config, block.patch)) return progress(block, history)
  if (!block.runIds.includes(attempt.id)) block.runIds.push(attempt.id)
  const p = progress(block, [...history.filter((a) => a.id !== attempt.id), attempt])
  if (p.met) {
    block.status = 'cleared'
    block.clearedAt = Date.now()
  }
  list[idx] = block
  save(list)
  return { ...p, block }
}

export function progress(block: FocusBlock, history: Attempt[]): FocusProgress {
  const runs = block.runIds.map((id) => history.find((a) => a.id === id)).filter((a): a is Attempt => !!a)
  const perRun = runs.map((a) => {
    const rows = featurize(block.drill, [a]).filter((r) => r.dims[block.dim] === block.value)
    if (rows.length === 0) return NaN
    return block.kind === 'slow' ? median(rows.map((r) => r.ms)) : rows.reduce((s, r) => s + r.correct, 0) / rows.length
  })
  const windowRuns = runs.slice(-WINDOW)
  const rows = featurize(block.drill, windowRuns).filter((r) => r.dims[block.dim] === block.value)
  const current = rows.length >= MIN_ROWS && windowRuns.length >= WINDOW ? (block.kind === 'slow' ? median(rows.map((r) => r.ms)) : rows.reduce((s, r) => s + r.correct, 0) / rows.length) : null
  const met =
    current !== null &&
    (block.kind === 'slow'
      ? block.target.medMs !== undefined && current <= block.target.medMs && (block.baseline.acc === undefined || rows.reduce((s, r) => s + r.correct, 0) / rows.length >= block.baseline.acc - 0.03)
      : block.target.acc !== undefined && current >= block.target.acc)
  return { block, perRun, current, rowsInWindow: rows.length, met }
}
