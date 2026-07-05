import { useTheme } from '../context/ThemeContext'

export function useChartTheme() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  return {
    tickColor:  isDark ? '#94a3b8' : '#64748b',
    gridColor:  isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    cursorFill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
    // Colores theme-aware para series (semánticos = significado)
    accent:   isDark ? '#3B82F6' : '#2563EB',
    positive: isDark ? '#34D399' : '#059669',
    danger:   isDark ? '#F87171' : '#DC2626',
    warning:  isDark ? '#FBBF24' : '#B45309',
    // Escala azul→slate coherente para categorías (no arcoíris)
    categorical: isDark
      ? ['#3B82F6', '#60A5FA', '#93C5FD', '#94A3B8', '#818CF8', '#22D3EE']
      : ['#2563EB', '#3B82F6', '#60A5FA', '#94A3B8', '#6366F1', '#0EA5E9'],
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
