import React from 'react'

export function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">
        {label}{required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {children}
    </div>
  )
}

const base = "w-full px-3 py-2 rounded-lg text-white text-sm transition-colors"
const style = { background: '#252535', border: '1px solid #2E2E42' }
const focusStyle = 'focus:border-blue-500'

export function Input({ ...props }) {
  return <input className={`${base} ${focusStyle}`} style={style} {...props} />
}

export function Select({ children, ...props }) {
  return (
    <select className={`${base} ${focusStyle}`} style={{...style, background:'#252535'}} {...props}>
      {children}
    </select>
  )
}

export function Textarea({ ...props }) {
  return <textarea className={`${base} ${focusStyle} resize-none`} style={style} rows={3} {...props} />
}
