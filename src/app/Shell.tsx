import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import Lenis from 'lenis'
import { sections } from './sections'
import { useTheme } from '../lib/theme'
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

/** Smooth scrolling for the whole page. Respects reduced motion. */
function useSmoothScroll(pathname: string) {
  const lenis = useRef<Lenis | null>(null)
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
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
}

export default function Shell() {
  const [theme, setTheme] = useTheme()
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  const focus = loc.pathname.endsWith('/run')

  useSpotlight()
  useSmoothScroll(loc.pathname)
  useEffect(() => setOpen(false), [loc.pathname])

  return (
    <div className={'shell' + (focus ? ' shell--focus' : '')}>
      <div className="spot" aria-hidden="true" />

      <header className="topbar">
        <button
          className="topbar__menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
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

      <aside className={'rail no-scrollbar' + (open ? ' rail--open' : '')}>
        <div className="rail__head">
          <NavLink to="/" className="brand rail__brand">
            <Mark />
            <span>Quant Desk</span>
          </NavLink>
          <button
            className="rail__theme"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
            title={theme === 'dark' ? 'Light' : 'Dark'}
          >
            <span className={'rail__orb' + (theme === 'dark' ? ' is-dark' : '')} />
          </button>
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

      {open && <button className="scrim" aria-label="Close menu" onClick={() => setOpen(false)} />}

      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
