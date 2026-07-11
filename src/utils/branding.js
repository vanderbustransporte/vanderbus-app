// Branding por empresa (Fase 2, punto 10): aplica el color primario de la org
// (org_settings.color_primario) como acento del design system, pisando las
// variables de index.css con inline style en <html> — gana sobre :root y
// [data-theme="dark"], así el acento es el mismo en ambos temas.
export const COLOR_HEX_RE = /^#[0-9a-fA-F]{6}$/

const VARS = ['--accent', '--accent-dim', '--accent-glow', '--sb-bar']

export function aplicarColorPrimario(color) {
  const root = document.documentElement
  if (color && COLOR_HEX_RE.test(color)) {
    const r = parseInt(color.slice(1, 3), 16)
    const g = parseInt(color.slice(3, 5), 16)
    const b = parseInt(color.slice(5, 7), 16)
    root.style.setProperty('--accent', color)
    root.style.setProperty('--accent-dim', `rgba(${r}, ${g}, ${b}, 0.12)`)
    root.style.setProperty('--accent-glow', `rgba(${r}, ${g}, ${b}, 0.06)`)
    root.style.setProperty('--sb-bar', color)
  } else {
    // Sin color (o inválido): volver a los acentos default del design system.
    for (const v of VARS) root.style.removeProperty(v)
  }
}
