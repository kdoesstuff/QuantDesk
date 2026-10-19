/**
 * The one place that touches localStorage. Everything else goes through
 * readJSON and writeJSON, which never throw: a browser with storage blocked
 * (private windows on some phones, strict settings, a full quota) falls back
 * to an in-memory map for the session, so every page still works and the
 * run still scores. Values are parsed with JSON and nothing else; callers
 * validate the shape before trusting it.
 */
const memory = new Map<string, string>()
let backend: Storage | null | undefined

function storage(): Storage | null {
  if (backend !== undefined) return backend
  try {
    const s = window.localStorage
    const probe = '__qd_probe__'
    s.setItem(probe, '1')
    s.removeItem(probe)
    backend = s
  } catch {
    backend = null
  }
  return backend
}

export function storageAvailable() {
  return storage() !== null
}

export function readString(key: string): string | null {
  const s = storage()
  if (!s) return memory.get(key) ?? null
  try {
    return s.getItem(key)
  } catch {
    return memory.get(key) ?? null
  }
}

/** Returns false when the write failed because the quota is full. */
export function writeString(key: string, value: string): boolean {
  const s = storage()
  memory.set(key, value)
  if (!s) return true
  try {
    s.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function removeKey(key: string) {
  memory.delete(key)
  const s = storage()
  if (!s) return
  try {
    s.removeItem(key)
  } catch {
    /* nothing to do */
  }
}

export function readJSON(key: string): unknown {
  const raw = readString(key)
  if (raw === null) return undefined
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return undefined
  }
}

export function writeJSON(key: string, value: unknown): boolean {
  try {
    return writeString(key, JSON.stringify(value))
  } catch {
    return false
  }
}

/** Every key this site owns, for the clear-everything action. */
export function ownKeys(): string[] {
  const s = storage()
  const out = new Set<string>(memory.keys())
  if (s) {
    try {
      for (let i = 0; i < s.length; i++) {
        const k = s.key(i)
        if (k && k.startsWith('qd.')) out.add(k)
      }
    } catch {
      /* ignore */
    }
  }
  return [...out].filter((k) => k.startsWith('qd.'))
}
