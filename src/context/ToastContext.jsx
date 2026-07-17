// src/context/ToastContext.jsx
import React, { createContext, useCallback, useContext, useRef, useState } from 'react'
import ToastContainer from '../components/ToastContainer'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef    = useRef(0)
  const timersRef = useRef({})   // { [id]: { autoTimer?, removeTimer? } }

  const removeToast = useCallback((id) => {
    // Cancelar auto-dismiss si aún está pendiente
    clearTimeout(timersRef.current[id]?.autoTimer)
    // Marcar como "saliendo" para disparar la animación de salida
    setToasts(prev => prev.map(t => t.id === id ? { ...t, removing: true } : t))
    // Esperar que termine la animación (150ms) antes de sacar del array
    const removeTimer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
      delete timersRef.current[id]
    }, 150)
    timersRef.current[id] = { ...(timersRef.current[id] ?? {}), removeTimer }
  }, [])

  // `action` (opcional): { label, onClick } — botón dentro del toast (ej. el
  // "Deshacer" de un borrado). Al clickearlo corre onClick y el toast se cierra.
  // `duration` (opcional): los toasts con acción conviene darles más aire que
  // los 3.5s informativos.
  const addToast = useCallback(({ message, Icon, color, action, duration = 3500 }) => {
    const id = ++idRef.current
    setToasts(prev => [...prev, { id, message, Icon, color, action, removing: false }])
    const autoTimer = setTimeout(() => removeToast(id), duration)
    timersRef.current[id] = { autoTimer }
  }, [removeToast])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
