import React from 'react'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      onClick={toggleTheme}
      title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 28, height: 28, borderRadius: 6,
        background: 'none', border: '1px solid transparent',
        cursor: 'pointer', color: 'var(--text-2)',
        transition: 'color 120ms ease-out, background 120ms ease-out',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'var(--hover-tint-md)'
        e.currentTarget.style.color = 'var(--text-1)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'none'
        e.currentTarget.style.color = 'var(--text-2)'
      }}
    >
      {isDark ? <Sun size={14} /> : <Moon size={14} />}
    </button>
  )
}
