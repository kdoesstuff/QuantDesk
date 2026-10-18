import { useEffect, useState } from 'react'

export const THEMES = [
  { id: 'ink', label: 'Ink', ground: '#0e1117', spot: '#faed26', action: '#2b4dff' },
  { id: 'periwinkle', label: 'Periwinkle', ground: '#ede8f5', spot: '#4f6ad9', action: '#3d52a0' },
  { id: 'blush', label: 'Blush', ground: '#f3eef0', spot: '#8dbd4f', action: '#e7717d' },
  { id: 'charcoal', label: 'Charcoal', ground: '#222629', spot: '#86c232', action: '#61892f' },
  { id: 'plum', label: 'Plum', ground: '#46344e', spot: '#faed26', action: '#9b786f' },
  { id: 'sky', label: 'Sky', ground: '#f7f9fb', spot: '#31708e', action: '#5085a5' },
] as const

export type ThemeId = (typeof THEMES)[number]['id']

const KEY = 'qd.theme'

export function readTheme(): ThemeId {
  const t = document.documentElement.dataset.theme
  return (THEMES.some((x) => x.id === t) ? t : 'ink') as ThemeId
}

export function applyTheme(id: ThemeId) {
  const root = document.documentElement
  // Cross-fade: every colour transitions for the duration of the switch.
  root.classList.add('theme-switching')
  root.dataset.theme = id
  try {
    localStorage.setItem(KEY, id)
  } catch {
    /* ignore */
  }
  window.setTimeout(() => root.classList.remove('theme-switching'), 760)
}

export function useTheme(): [ThemeId, (t: ThemeId) => void] {
  const [theme, setThemeState] = useState<ThemeId>(readTheme)
  useEffect(() => {
    if (readTheme() !== theme) applyTheme(theme)
  }, [theme])
  return [theme, setThemeState]
}
