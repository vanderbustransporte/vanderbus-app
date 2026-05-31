import { useTheme } from '../context/ThemeContext'

export function useChartTheme() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  return {
    tickColor:  isDark ? '#94a3b8' : '#64748b',
    gridColor:  isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    cursorFill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
    tooltip: {
      contentStyle: {
        background:   isDark ? '#27272a' : '#ffffff',
        border:       `1px solid ${isDark ? 'rgba(255,255,255,0.13)' : 'rgba(0,0,0,0.10)'}`,
        borderRadius: 8,
        color:        isDark ? '#f1f5f9' : '#0f172a',
        fontSize:     12,
        boxShadow:    isDark ? '0 8px 32px rgba(0,0,0,0.60)' : '0 8px 32px rgba(0,0,0,0.12)',
      },
      labelStyle: {
        color:    isDark ? '#94a3b8' : '#64748b',
        fontSize: 10,
      },
    },
  }
}
