import { useEffect, useRef, useState } from 'react'
import { THEMES, type ThemeId } from '../lib/theme'
import './themePicker.css'

function Swatch({ ground, spot, action }: { ground: string; spot: string; action: string }) {
  return (
    <span className="swatch" aria-hidden="true" style={{ background: ground }}>
      <span style={{ background: action }} />
      <span style={{ background: spot }} />
    </span>
  )
}

export default function ThemePicker({ value, onChange }: { value: ThemeId; onChange: (t: ThemeId) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = THEMES.find((t) => t.id === value) ?? THEMES[0]

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="tp" ref={ref}>
      <button
        className="tp__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Theme: ${current.label}`}
        title="Theme"
        onClick={() => setOpen((o) => !o)}
      >
        <Swatch ground={current.ground} spot={current.spot} action={current.action} />
      </button>

      <div className={'tp__menu' + (open ? ' is-open' : '')} role="listbox" aria-label="Theme">
        {THEMES.map((t) => (
          <button
            key={t.id}
            role="option"
            aria-selected={t.id === value}
            className="tp__item"
            onClick={() => {
              onChange(t.id)
              setOpen(false)
            }}
          >
            <Swatch ground={t.ground} spot={t.spot} action={t.action} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
