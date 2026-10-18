import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { sections } from './sections'
import { useTheme } from '../lib/theme'
import './shell.css'

function Mark() {
  // Four pips: two cobalt, two marigold. The site's only logo.
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="10" cy="10" r="4.2" fill="var(--cobalt)" />
      <circle cx="22" cy="22" r="4.2" fill="var(--cobalt)" />
      <circle cx="22" cy="10" r="4.2" fill="var(--marigold)" />
      <circle cx="10" cy="22" r="4.2" fill="var(--marigold)" />
    </svg>
  )
}

export default function Shell() {
  const [theme, setTheme] = useTheme()
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  const focus = loc.pathname.endsWith('/run')

  // Close the drawer on navigation (mobile).
  useEffect(() => setOpen(false), [loc.pathname])

  return (
    <div className={'shell' + (focus ? ' shell--focus' : '')}>
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

      <aside className={'rail' + (open ? ' rail--open' : '')}>
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
            <span className={'rail__sun' + (theme === 'dark' ? ' is-moon' : '')} />
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
