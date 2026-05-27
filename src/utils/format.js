export function formatARS(n) {
  const num = Number(n) || 0
  return '$ ' + num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatDate(str) {
  if (!str) return '-'

  // ISO YYYY-MM-DD (formato normal de la app)
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`

  // Formato con barras: detectar DD/MM/YYYY vs M/D/YYYY
  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slashMatch) {
    const [, a, b, y] = slashMatch
    if (parseInt(a) > 12) return `${a.padStart(2,'0')}/${b.padStart(2,'0')}/${y}` // DD/MM/YYYY
    if (parseInt(b) > 12) return `${b.padStart(2,'0')}/${a.padStart(2,'0')}/${y}` // M/D/YYYY → DD/MM/YYYY
    return `${a.padStart(2,'0')}/${b.padStart(2,'0')}/${y}`
  }

  return str
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export function daysDiff(dateStr) {
  if (!dateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  return Math.round((target - today) / 86400000)
}

export function expiryColor(dateStr) {
  const d = daysDiff(dateStr)
  if (d === null) return 'text-gray-400'
  if (d < 0) return 'text-red-400'
  if (d <= 30) return 'text-yellow-400'
  return 'text-green-400'
}

export function expiryBg(dateStr) {
  const d = daysDiff(dateStr)
  if (d === null) return 'bg-gray-500/20 text-gray-400'
  if (d < 0) return 'bg-red-500/20 text-red-400'
  if (d <= 30) return 'bg-yellow-500/20 text-yellow-400'
  return 'bg-green-500/20 text-green-400'
}

export function expiryLabel(dateStr) {
  const d = daysDiff(dateStr)
  if (d === null) return 'Sin fecha'
  if (d < 0) return `Vencido hace ${Math.abs(d)} días`
  if (d === 0) return 'Vence hoy'
  return `Vence en ${d} días`
}

export function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export function monthName(monthIndex) {
  const names = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  return names[monthIndex]
}
