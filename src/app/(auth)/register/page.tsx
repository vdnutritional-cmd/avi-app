'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { z } from 'zod'

const registerSchema = z.object({
  fullName: z.string().min(2, 'Ingresa tu nombre completo'),
  email: z.string().email('Correo inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
})

/**
 * Registro para TERAPEUTAS.
 * Crea la cuenta con role='therapist' en los metadatos.
 * Después se redirige a una página de suscripción (Sprint 5).
 */
export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirmPassword: '' })
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
        data: {
          full_name: form.fullName,
          role: 'therapist',           // El trigger de Supabase lee esto para crear el profile
        },
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
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-bold text-primary-700">AVI</Link>
          <p className="text-gray-500 mt-2">Registro de terapeuta</p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 space-y-5">
          {[
            { id: 'fullName', label: 'Nombre completo', type: 'text', placeholder: 'Dra. María López' },
            { id: 'email', label: 'Correo electrónico', type: 'email', placeholder: 'tu@correo.com' },
            { id: 'password', label: 'Contraseña', type: 'password', placeholder: '••••••••' },
            { id: 'confirmPassword', label: 'Confirmar contraseña', type: 'password', placeholder: '••••••••' },
          ].map(field => (
            <div key={field.id} className="space-y-1">
              <label htmlFor={field.id} className="block text-sm font-medium text-gray-700">
                {field.label}
              </label>
              <input
                id={field.id}
                name={field.id}
                type={field.type}
                value={form[field.id as keyof typeof form]}
                onChange={handleChange}
                placeholder={field.placeholder}
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none
                           focus:ring-2 focus:ring-primary-300 focus:border-primary-400 transition"
              />
            </div>
          ))}

          {error && (
            <p className="text-red-500 text-sm bg-red-50 px-4 py-3 rounded-xl">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary-600 text-white rounded-xl font-semibold
                       hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creando cuenta…' : 'Crear cuenta de terapeuta'}
          </button>

          <p className="text-xs text-gray-400 text-center">
            Al registrarte, aceptas los términos de uso de AVI.
          </p>
        </form>

        <div className="mt-6 text-center text-sm">
          <p className="text-gray-500">
            ¿Ya tienes cuenta?{' '}
            <Link href="/auth/login" className="text-primary-600 font-medium hover:underline">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
