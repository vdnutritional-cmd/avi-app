'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LogoutButton() {
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

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-xl
                 text-sm text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors
                 disabled:opacity-50"
    >
      <span>🚪</span>
      <span>{loading ? 'Cerrando…' : 'Cerrar sesión'}</span>
    </button>
  )
}
