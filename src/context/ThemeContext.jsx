import React, { createContext, useContext, useState, useEffect, useRef } from 'react'

const ThemeCtx = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() =>
    localStorage.getItem('vanderbus_theme') || 'dark'
  )
  const timerRef = useRef(null)

  useEffect(() => {
    const attr = theme === 'light' ? 'light' : ''
    document.documentElement.setAttribute('data-theme', attr)
  }, [theme])

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem('vanderbus_theme', next)
    setTheme(next)
    document.documentElement.classList.add('theme-transitioning')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(
      () => document.documentElement.classList.remove('theme-transitioning'),
      260
    )
  }

  return (
    <ThemeCtx.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeCtx.Provider>
  )
}

export const useTheme = () => useContext(ThemeCtx)
