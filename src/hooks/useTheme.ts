import { useState, useEffect } from 'react'
import { themeManager, ThemeMode } from '../core/ThemeManager'

/**
 * Hook to access and control theme
 */
export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(themeManager.getTheme())

  useEffect(() => {
    const unsubscribe = themeManager.subscribe((newTheme) => {
      setTheme(newTheme)
    })

    return unsubscribe
  }, [])

  const toggleTheme = () => {
    themeManager.toggleTheme()
  }

  const setThemeMode = (mode: ThemeMode) => {
    themeManager.setTheme(mode)
  }

  return {
    theme,
    toggleTheme,
    setTheme: setThemeMode,
    isDark: theme === 'dark',
  }
}
