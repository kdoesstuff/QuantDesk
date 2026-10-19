import { useEffect, useState } from 'react'
import type { DrillId } from './types'
import { readJSON, writeJSON, removeKey } from './persist'

const key = (id: DrillId) => `qd.cfg.${id}`

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** A saved value is accepted only if it has the same shape as the default. */
function sameShape(d: unknown, v: unknown) {
  if (Array.isArray(d)) return Array.isArray(v)
  if (d === null || v === null) return d === v
  if (typeof d === 'number') return typeof v === 'number' && Number.isFinite(v)
  return typeof d === typeof v
}

/**
 * Saved settings are checked field by field against the drill's defaults, so
 * settings written by an older version of the site, or by a different drill,
 * can never put a field of the wrong type in front of a generator. Unknown
 * fields are dropped.
 */
export function sanitiseConfig<C extends object>(defaults: C, saved: unknown): C {
  const out = { ...defaults } as Record<string, unknown>
  if (!isPlainObject(saved)) return out as C
  for (const k of Object.keys(defaults)) {
    if (k in saved && sameShape((defaults as Record<string, unknown>)[k], saved[k])) out[k] = saved[k]
  }
  return out as C
}

/** Per-drill settings persisted in the browser, so a drill opens where you left it. */
export function loadDrillConfig<C extends object>(id: DrillId, defaults: C): C {
  return sanitiseConfig(defaults, readJSON(key(id)))
}

/** The saved settings as they are, for comparing against a focus block. Empty when nothing is saved. */
export function readRawDrillConfig(id: DrillId): Record<string, unknown> {
  const v = readJSON(key(id))
  return isPlainObject(v) ? v : {}
}

export function saveDrillConfig<C extends object>(id: DrillId, c: C) {
  writeJSON(key(id), c)
}

export function resetDrillConfig(id: DrillId) {
  removeKey(key(id))
}

export function useDrillConfig<C extends object>(id: DrillId, defaults: C) {
  const [cfg, setCfg] = useState<C>(() => loadDrillConfig(id, defaults))
  useEffect(() => saveDrillConfig(id, cfg), [id, cfg])
  return [cfg, setCfg] as const
}

export function durationLabel(sec: number) {
  if (sec < 60) return `${sec}s`
  const m = sec / 60
  return Number.isInteger(m) ? `${m} min` : `${Math.floor(m)}:${String(sec % 60).padStart(2, '0')}`
}
