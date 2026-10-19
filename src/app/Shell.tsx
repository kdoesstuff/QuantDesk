import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useCallback, useEffect, useRef, useState } from 'react'
import Lenis from 'lenis'
import { sections } from './sections'
import { useTheme } from '../lib/theme'
import ThemePicker from '../components/ThemePicker'
import './shell.css'

function Mark() {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="10" cy="10" r="4.4" fill="var(--yellow)" />
      <circle cx="22" cy="22" r="4.4" fill="var(--yellow)" />
      <circle cx="22" cy="10" r="4.4" fill="var(--blue-2)" />
      <circle cx="10" cy="22" r="4.4" fill="var(--blue-2)" />
    </svg>
  )
}

/** Soft light that follows the pointer. Fine pointers only. */
function useSpotlight() {
  useEffect(() => {
    if (!matchMedia('(pointer: fine)').matches) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const root = document.documentElement
    let x = -999
    let y = -999
    let raf = 0
    const apply = () => {
      raf = 0
      root.style.setProperty('--mx', `${x}px`)
      root.style.setProperty('--my', `${y}px`)
    }
    const onMove = (e: PointerEvent) => {
      x = e.clientX
      y = e.clientY
      if (!raf) raf = requestAnimationFrame(apply)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [])
}

/**
 * Smooth scrolling for the page on devices with a wheel. Phones keep native
 * scrolling, which is already smooth and plays better with the keyboard
 * and the address bar. Respects reduced motion. Nested scroll areas (the
 * sidebar) opt out with data-lenis-prevent.
 */
function useSmoothScroll(pathname: string, paused: boolean) {
  const lenis = useRef<Lenis | null>(null)
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!matchMedia('(pointer: fine)').matches) return
    const l = new Lenis({ autoRaf: true, lerp: 0.11, wheelMultiplier: 1 })
    lenis.current = l
    return () => {
      l.destroy()
      lenis.current = null
    }
  }, [])
  useEffect(() => {
    if (lenis.current) lenis.current.scrollTo(0, { immediate: true })
    else window.scrollTo(0, 0)
  }, [pathname])
  useEffect(() => {
    const l = lenis.current
    if (!l) return
    if (paused) l.stop()
    else l.start()
  }, [paused])
}

/** While the drawer is open the page behind it must not scroll, and Escape closes it. */
function useDrawer(open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, close])
}

/** Tracks a media query, so the drawer knows whether it is a drawer right now. */
function useMedia(query: string) {
  const [match, setMatch] = useState(() => typeof matchMedia === 'function' && matchMedia(query).matches)
  useEffect(() => {
    const m = matchMedia(query)
    const on = () => setMatch(m.matches)
    on()
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [query])
  return match
}

export default function Shell() {
  const [theme, setTheme] = useTheme()
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  const focus = loc.pathname.endsWith('/run')

  const narrow = useMedia('(max-width: 860px)')
  const close = useCallback(() => setOpen(false), [])
  useSpotlight()
  useSmoothScroll(loc.pathname, open && narrow)
  useDrawer(open, close)
  useEffect(() => setOpen(false), [loc.pathname])

  return (
    <div className={'shell' + (focus ? ' shell--focus' : '')}>
      <div className="spot" aria-hidden="true" />

      <header className="topbar">
        <button
          className={'topbar__menu' + (open ? ' is-open' : '')}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="rail"
          onClick={() => setOpen((o) => !o)}
        >
          <span />
          <span />
        </button>
        <NavLink to="/" className="brand">
          <Mark />
          <span>Quant Desk</span>
        </NavLink>
      </header>

      <aside id="rail" className={'rail no-scrollbar' + (open ? ' rail--open' : '')} data-lenis-prevent inert={narrow && !open}>
        <div className="rail__head">
          <NavLink to="/" className="brand rail__brand">
            <Mark />
            <span>Quant Desk</span>
          </NavLink>
          <div className="rail__tools">
            <ThemePicker value={theme} onChange={setTheme} />
            <button className="rail__close" aria-label="Close menu" onClick={close}>
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <nav className="rail__nav" aria-label="Sections">
          <NavLink to="/" end className="rail__top">
            Today
          </NavLink>
          <NavLink to="/progress" className="rail__top">
            Progress
          </NavLink>

          {sections.map((g) => (
            <div className="rail__group" key={g.title}>
              <div className="rail__title">{g.title}</div>
              {g.links.map((l) =>
                l.status === 'live' ? (
                  <NavLink key={l.to} to={l.to} className="rail__link">
                    {l.label}
                  </NavLink>
                ) : (
                  <span key={l.to} className="rail__link rail__link--soon" title="Coming in the next build">
                    {l.label}
                  </span>
                ),
              )}
            </div>
          ))}
        </nav>
      </aside>

      <button className={'scrim' + (open ? ' is-open' : '')} aria-label="Close menu" tabIndex={open ? 0 : -1} onClick={close} />

      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
