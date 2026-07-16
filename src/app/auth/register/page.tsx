'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { z } from 'zod'

const registerSchema = z.object({
  fullName: z.string().min(2, 'Ingresa tu nombre completo'),
  email: z.string().email('Correo inválido'),
  whatsapp: z.string().min(10, 'Ingresa tu número de WhatsApp (10 dígitos)').regex(/^\d+$/, 'Solo números, sin espacios ni guiones'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
})

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
    </svg>
  )
}

export default function RegisterPage() {
  const [form, setForm] = useState({ fullName: '', email: '', whatsapp: '', password: '', confirmPassword: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const parsed = registerSchema.safeParse(form)
    if (!parsed.success) {
      setError(parsed.error.errors[0].message)
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { full_name: form.fullName, role: 'therapist', whatsapp_phone: form.whatsapp },
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-calm-50 px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="text-5xl">✉️</div>
          <h2 className="text-xl font-bold text-gray-800">Revisa tu correo</h2>
          <p className="text-gray-500 text-sm">
            Enviamos un enlace de confirmación a <strong>{form.email}</strong>.
            Haz clic en el enlace para activar tu cuenta.
          </p>
          <Link href="/auth/login" className="block text-primary-600 font-medium hover:underline text-sm">
            Volver al inicio de sesión
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
          <p className="text-gray-500 mt-2">Registro de terapeuta</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 space-y-5">
          {/* Nombre */}
          <div className="space-y-1">
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">Nombre completo</label>
            <input
              id="fullName" name="fullName" type="text"
              value={form.fullName} onChange={handleChange}
              placeholder="Dra. María López" required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none
                         focus:ring-2 focus:ring-primary-300 focus:border-primary-400 transition"
            />
          </div>

          {/* Email */}
          <div className="space-y-1">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Correo electrónico</label>
            <input
              id="email" name="email" type="email"
              value={form.email} onChange={handleChange}
              placeholder="tu@correo.com" required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none
                         focus:ring-2 focus:ring-primary-300 focus:border-primary-400 transition"
            />
          </div>

          {/* WhatsApp */}
          <div className="space-y-1">
            <label htmlFor="whatsapp" className="block text-sm font-medium text-gray-700">
              Número de WhatsApp
              <span className="text-xs text-gray-400 font-normal ml-1">(10 dígitos, sin espacios)</span>
            </label>
            <input
              id="whatsapp" name="whatsapp" type="tel"
              value={form.whatsapp} onChange={handleChange}
              placeholder="3312345678" required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none
                         focus:ring-2 focus:ring-primary-300 focus:border-primary-400 transition"
            />
          </div>

          {/* Contraseña */}
          <div className="space-y-1">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">Contraseña</label>
            <div className="relative">
              <input
                id="password" name="password"
                type={showPassword ? 'text' : 'password'}
                value={form.password} onChange={handleChange}
                placeholder="••••••••" required
                className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-200 focus:outline-none
                           focus:ring-2 focus:ring-primary-300 focus:border-primary-400 transition"
              />
              <button type="button" onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </div>

          {/* Confirmar contraseña */}
          <div className="space-y-1">
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">Confirmar contraseña</label>
            <div className="relative">
              <input
                id="confirmPassword" name="confirmPassword"
                type={showConfirm ? 'text' : 'password'}
                value={form.confirmPassword} onChange={handleChange}
                placeholder="••••••••" required
                className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-200 focus:outline-none
                           focus:ring-2 focus:ring-primary-300 focus:border-primary-400 transition"
              />
              <button type="button" onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <EyeIcon open={showConfirm} />
              </button>
            </div>
          </div>

          {error && <p className="text-red-500 text-sm bg-red-50 px-4 py-3 rounded-xl">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full py-3 bg-primary-600 text-white rounded-xl font-semibold
                       hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? 'Creando cuenta…' : 'Crear cuenta de terapeuta'}
          </button>

          <p className="text-xs text-gray-400 text-center">Al registrarte, aceptas los términos de uso de AVI.</p>
        </form>

        <div className="mt-6 text-center text-sm">
          <p className="text-gray-500">
            ¿Ya tienes cuenta?{' '}
            <Link href="/auth/login" className="text-primary-600 font-medium hover:underline">Inicia sesión</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
