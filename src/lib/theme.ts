import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

function readTheme(): Theme {
  const t = document.documentElement.dataset.theme
  return t === 'dark' ? 'dark' : 'light'
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(readTheme)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('qd.theme', theme)
    } catch {
      /* ignore */
    }
  }, [theme])
  return [theme, setThemeState]
}
