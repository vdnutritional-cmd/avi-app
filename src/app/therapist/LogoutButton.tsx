'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// variante: 'menu' (sidebar del terapeuta, con 🚪) · 'paciente' (encabezado del paciente)
//           · 'nav' (barra de abajo del paciente: "Salir")
export default function LogoutButton({ variante = 'menu' }: { variante?: 'menu' | 'paciente' | 'nav' }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleLogout() {
    setLoading(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      // Redirigir al inicio independientemente del resultado —
      // las cookies de sesión inválidas hacen que el layout redirija a login.
      router.push('/')
      router.refresh()
    }
  }

  if (variante === 'nav') {
    return (
      <button
        onClick={handleLogout}
        disabled={loading}
        className="flex flex-col items-center gap-1 text-xs text-gray-500 hover:text-primary-600 transition-colors disabled:opacity-50"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
        </svg>
        <span>{loading ? 'Saliendo…' : 'Salir'}</span>
      </button>
    )
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-xl
                 text-sm ${variante === 'paciente' ? 'text-gray-600' : 'text-gray-400'} hover:text-red-500 hover:bg-red-50 transition-colors
                 disabled:opacity-50`}
    >
      {variante === 'menu' && <span>🚪</span>}
      <span>{loading ? 'Cerrando…' : 'Cerrar sesión'}</span>
    </button>
  )
}
