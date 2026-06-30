'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })

    if (resetError) {
      setError('No pudimos enviar el correo. Verifica la dirección e intenta de nuevo.')
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-calm-50 px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="text-5xl">📬</div>
          <h2 className="text-xl font-bold text-gray-800">Revisa tu correo</h2>
          <p className="text-gray-500 text-sm">
            Enviamos un enlace a <strong>{email}</strong> para que puedas crear una nueva contraseña.
          </p>
          <p className="text-xs text-gray-400">
            Si no lo ves en unos minutos, revisa tu carpeta de spam.
          </p>
          <Link href="/auth/login" className="block text-primary-600 font-medium hover:underline text-sm">
            ← Volver al inicio de sesión
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-calm-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-bold text-primary-700">AVI</Link>
          <p className="text-gray-500 mt-2">Recuperar contraseña</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 space-y-5">
          <p className="text-sm text-gray-500 text-center">
            Escribe tu correo y te enviamos un enlace para crear una nueva contraseña.
          </p>

          <div className="space-y-1">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none
                         focus:ring-2 focus:ring-primary-300 focus:border-primary-400 transition"
            />
          </div>

          {error && <p className="text-red-500 text-sm bg-red-50 px-4 py-3 rounded-xl">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary-600 text-white rounded-xl font-semibold
                       hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Enviando…' : 'Enviar enlace de recuperación'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          <Link href="/auth/login" className="text-gray-500 hover:text-gray-700">
            ← Volver al inicio de sesión
          </Link>
        </div>
      </div>
    </div>
  )
}
