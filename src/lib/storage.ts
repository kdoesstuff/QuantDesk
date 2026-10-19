import type { Attempt, DrillId, EventLog } from './types'
import { readJSON, writeJSON, removeKey, ownKeys } from './persist'

/**
 * Storage boundary. The UI only talks to this interface, so swapping the
 * browser store for Supabase (or anything else) is a one-file change.
 */
export interface Store {
  saveAttempt(a: Attempt): Promise<void>
  listAttempts(opts?: { drill?: DrillId; configKey?: string; limit?: number }): Promise<Attempt[]>
  clearAll(): Promise<void>
}

const KEY = 'qd.attempts.v1'

/** Hard ceiling on stored runs. Oldest go first when it is reached. */
export const MAX_ATTEMPTS = 4000
/** Hard ceiling on events kept per run, so one runaway run cannot fill the quota. */
export const MAX_EVENTS = 2000

export const DRILL_IDS: readonly DrillId[] = [
  'speed-arithmetic',
  'eighty-in-eight',
  'sequences',
  'fractions',
  'percentages',
  'dice-market',
  'cards-market',
  'make-a-market',
  'betting-board',
  'kelly',
  'etf-arb',
  'event-contracts',
  'fermi',
  'memory-grid',
  'task-switch',
  'intercept',
  'balloon',
  'race',
  'evidence',
  'event-maker',
  'dutch-book',
]
const DRILL_SET = new Set<string>(DRILL_IDS)

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isStr = (v: unknown): v is string => typeof v === 'string'

function validEvent(v: unknown): v is EventLog {
  if (!isObj(v)) return false
  if (!isNum(v.ms) || !isNum(v.misses) || typeof v.correct !== 'boolean') return false
  if (!(v.given === null || isNum(v.given) || isStr(v.given))) return false
  if (v.tags !== undefined && !isObj(v.tags)) return false
  return true
}

/**
 * A stored run is kept only if every field the dashboard and the analysis
 * read is present and of the right type. Anything else was written by a bug,
 * an old version, or by hand in the dev tools, and is dropped rather than
 * allowed to crash a page later.
 */
export function validAttempt(v: unknown): v is Attempt {
  if (!isObj(v)) return false
  if (!isStr(v.id) || v.id.length === 0 || v.id.length > 64) return false
  if (!isNum(v.ts) || !isStr(v.drill) || !DRILL_SET.has(v.drill)) return false
  if (!isStr(v.configKey) || !isNum(v.score) || !isNum(v.correct) || !isNum(v.wrong) || !isNum(v.durationSec)) return false
  if (!Array.isArray(v.answers)) return false
  if (v.meta !== undefined && !isObj(v.meta)) return false
  if (v.focus !== undefined && !isStr(v.focus)) return false
  return true
}

/** A run with its malformed events removed, or null when the run itself is unusable. */
export function normaliseAttempt(v: unknown): Attempt | null {
  if (!validAttempt(v)) return null
  const answers = v.answers.filter(validEvent).slice(0, MAX_EVENTS)
  return answers.length === v.answers.length ? v : { ...v, answers }
}

class LocalStore implements Store {
  private cache: Attempt[] | null = null

  constructor() {
    // Another tab wrote: drop the cache so this tab reads the new list next time.
    try {
      window.addEventListener('storage', (e) => {
        if (e.key === KEY || e.key === null) this.cache = null
      })
    } catch {
      /* no window */
    }
  }

  private read(): Attempt[] {
    if (this.cache) return this.cache
    const raw = readJSON(KEY)
    const list: Attempt[] = []
    if (Array.isArray(raw)) {
      for (const v of raw) {
        const a = normaliseAttempt(v)
        if (a) list.push(a)
      }
    }
    this.cache = list
    return list
  }

  private write(list: Attempt[]) {
    // On a full quota, drop the oldest quarter and try again until it fits.
    // The newest run is the one being saved, so it is the last to go.
    while (list.length) {
      this.cache = list
      if (writeJSON(KEY, list)) return
      list = list.slice(Math.ceil(list.length / 4))
    }
    this.cache = []
  }

  async saveAttempt(a: Attempt) {
    const trimmed = normaliseAttempt(a)
    if (!trimmed) return
    let list = this.read().filter((x) => x.id !== trimmed.id)
    list = [...list, trimmed]
    if (list.length > MAX_ATTEMPTS) list = list.slice(list.length - MAX_ATTEMPTS)
    this.write(list)
  }

  async listAttempts(opts: { drill?: DrillId; configKey?: string; limit?: number } = {}) {
    let list = this.read()
    if (opts.drill) list = list.filter((a) => a.drill === opts.drill)
    if (opts.configKey) list = list.filter((a) => a.configKey === opts.configKey)
    list = [...list].sort((x, y) => y.ts - x.ts)
    if (opts.limit) list = list.slice(0, opts.limit)
    return list
  }

  async clearAll() {
    this.cache = []
    removeKey(KEY)
  }
}

export const store: Store = new LocalStore()

/** Wipes everything this site has saved in this browser: runs, settings, focus blocks. The theme stays. */
export function clearEverything() {
  for (const k of ownKeys()) if (k !== 'qd.theme') removeKey(k)
  try {
    sessionStorage.clear()
  } catch {
    /* ignore */
  }
}

export function uid() {
  const bytes = new Uint8Array(8)
  try {
    crypto.getRandomValues(bytes)
  } catch {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('') + Date.now().toString(36)
}
