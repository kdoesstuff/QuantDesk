import type { Attempt, DrillId } from './types'

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

class LocalStore implements Store {
  private read(): Attempt[] {
    try {
      const raw = localStorage.getItem(KEY)
      return raw ? (JSON.parse(raw) as Attempt[]) : []
    } catch {
      return []
    }
  }
  private write(list: Attempt[]) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list))
    } catch {
      /* storage unavailable — the session still runs, it just won't persist */
    }
  }
  async saveAttempt(a: Attempt) {
    const list = this.read()
    list.push(a)
    this.write(list)
  }
  async listAttempts(opts: { drill?: DrillId; configKey?: string; limit?: number } = {}) {
    let list = this.read()
    if (opts.drill) list = list.filter((a) => a.drill === opts.drill)
    if (opts.configKey) list = list.filter((a) => a.configKey === opts.configKey)
    list.sort((x, y) => y.ts - x.ts)
    if (opts.limit) list = list.slice(0, opts.limit)
    return list
  }
  async clearAll() {
    try {
      localStorage.removeItem(KEY)
    } catch {
      /* ignore */
    }
  }
}

export const store: Store = new LocalStore()

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}
