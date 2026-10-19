import { useCallback, useEffect, useRef, useState } from 'react'

/** Enter anywhere on the page (not inside a text field) runs `fn`. */
export function useEnter(fn: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const typing = t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement
      if (e.key === 'Enter' && !typing) fn()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fn, enabled])
}

/** Escape runs `fn` (leave a run). */
export function useEscape(fn: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fn()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fn])
}

export type RunPhase = 'countdown' | 'running' | 'done'

/**
 * The 3-2-1 countdown and the run clock. `onEnd` fires once when the clock
 * hits zero. `durationSec` of 0 means no clock (the run ends when the game
 * says so, via `stop`).
 */
export function useRunClock(durationSec: number, onEnd: () => void) {
  const [phase, setPhase] = useState<RunPhase>('countdown')
  const [count, setCount] = useState(3)
  const [remaining, setRemaining] = useState(durationSec)
  const [elapsed, setElapsed] = useState(0)
  const endAt = useRef(0)
  const startAt = useRef(0)
  const ended = useRef(false)
  const onEndRef = useRef(onEnd)
  onEndRef.current = onEnd

  useEffect(() => {
    if (phase !== 'countdown') return
    if (count === 0) {
      setPhase('running')
      startAt.current = performance.now()
      endAt.current = startAt.current + durationSec * 1000
      return
    }
    const t = setTimeout(() => setCount((c) => c - 1), 650)
    return () => clearTimeout(t)
  }, [phase, count, durationSec])

  const stop = useCallback(() => {
    if (ended.current) return
    ended.current = true
    setPhase('done')
    onEndRef.current()
  }, [])

  useEffect(() => {
    if (phase !== 'running') return
    let raf = 0
    const tick = () => {
      const now = performance.now()
      setElapsed((now - startAt.current) / 1000)
      if (durationSec > 0) {
        const left = Math.max(0, endAt.current - now)
        setRemaining(left / 1000)
        if (left <= 0) {
          stop()
          return
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase, durationSec, stop])

  return { phase, count, remaining, elapsed, stop, startAt }
}
