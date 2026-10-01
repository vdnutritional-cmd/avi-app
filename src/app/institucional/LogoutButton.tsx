'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function InstitucionalLogoutButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleLogout() {
    setLoading(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
    >
      {loading ? 'Cerrando…' : 'Cerrar sesión'}
    </button>
  )
}
