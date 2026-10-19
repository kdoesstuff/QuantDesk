import { useEffect, useState } from 'react'
import type { DrillId } from './types'

/** Per-drill settings persisted in the browser, so a drill opens where you left it. */
export function loadDrillConfig<C extends object>(id: DrillId, defaults: C): C {
  try {
    const raw = localStorage.getItem(`qd.cfg.${id}`)
    if (raw) return { ...defaults, ...(JSON.parse(raw) as Partial<C>) }
  } catch {
    /* fall through */
  }
  return defaults
}

export function saveDrillConfig<C extends object>(id: DrillId, c: C) {
  try {
    localStorage.setItem(`qd.cfg.${id}`, JSON.stringify(c))
  } catch {
    /* ignore */
  }
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
