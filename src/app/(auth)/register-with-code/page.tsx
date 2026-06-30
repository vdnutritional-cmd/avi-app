'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { z } from 'zod'
import { isValidAuthCode } from '@/lib/utils'

const schema = z.object({
  code: z.string().length(8, 'El código tiene 8 caracteres'),
  fullName: z.string().min(2, 'Ingresa tu nombre'),
  email: z.string().email('Correo inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
})

type Step = 'code' | 'register' | 'success'

/**
 * Registro para CONSULTANTES (pacientes).
 * Flujo en 2 pasos:
 *   1. Validar el código de autorización del terapeuta
 *   2. Crear cuenta con role='patient' y vincular con el terapeuta
 */
export default function RegisterWithCodePage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('code')
  const [code, setCode] = useState('')
  const [therapistId, setTherapistId] = useState<string | null>(null)
  const [codeId, setCodeId] = useState<string | null>(null)
  const [form, setForm] = useState({ fullName: '', email: '', password: '' })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // ── Paso 1: validar código ──────────────────────────────────────────────────
  async function handleValidateCode(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const upperCode = code.toUpperCase().trim()
    if (!isValidAuthCode(upperCode)) {
      setError('El código debe tener 8 caracteres (solo letras y números)')
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { data, error: dbError } = await supabase
      .from('authorization_codes')
      .select('id, therapist_id, is_active, used_by, expires_at')
      .eq('code', upperCode)
      .single()

    if (dbError || !data) {
      setError('Código no encontrado. Verifica que lo escribiste correctamente.')
      setLoading(false)
      return
    }

    if (!data.is_active) {
      setError('Este código ya no está activo. Pide uno nuevo a tu terapeuta.')
      setLoading(false)
      return
    }

    if (data.used_by) {
      setError('Este código ya fue utilizado. Pide un nuevo código a tu terapeuta.')
      setLoading(false)
      return
    }

    if (new Date(data.expires_at) < new Date()) {
      setError('Este código ha expirado. Pide un nuevo código a tu terapeuta.')
      setLoading(false)
      return
    }

    setTherapistId(data.therapist_id)
    setCodeId(data.id)
    setLoading(false)
    setStep('register')
  }

  // ── Paso 2: crear cuenta ────────────────────────────────────────────────────
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const parsed = schema.safeParse({ code, ...form })
    if (!parsed.success) {
      setError(parsed.error.errors[0].message)
      return
    }

    setLoading(true)
    const supabase = createClient()

    // 1. Crear cuenta en Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { full_name: form.fullName, role: 'patient' },
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    })

    if (authError || !authData.user) {
      setError(authError?.message ?? 'Error al crear la cuenta')
      setLoading(false)
      return
    }

    const patientId = authData.user.id

    // 2. Marcar el código como usado
    await supabase
      .from('authorization_codes')
      .update({ used_by: patientId, used_at: new Date().toISOString(), is_active: false })
      .eq('id', codeId)

    // 3. Crear relación terapeuta–paciente
    await supabase
      .from('therapist_patients')
      .insert({ therapist_id: therapistId, patient_id: patientId, authorization_code_id: codeId })

    setLoading(false)
    setStep('success')
  }

  // ── Vista: éxito ────────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-calm-50 px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="text-5xl">✉️</div>
          <h2 className="text-xl font-bold text-gray-800">¡Ya casi!</h2>
          <p className="text-gray-500 text-sm">
            Enviamos un enlace de confirmación a <strong>{form.email}</strong>.
            Confírmalo para empezar a usar Recupérate.
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
          <p className="text-gray-500 mt-2">Acceso con código</p>
        </div>

        {/* Paso 1: código */}
        {step === 'code' && (
          <form onSubmit={handleValidateCode} className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 space-y-5">
            <div className="text-center space-y-2">
              <p className="text-2xl">🔑</p>
              <p className="text-gray-600 text-sm">
                Tu terapeuta te proporcionó un código de 8 caracteres para acceder a AVI.
              </p>
            </div>

            <div className="space-y-1">
              <label htmlFor="code" className="block text-sm font-medium text-gray-700">
                Código de acceso
              </label>
              <input
                id="code"
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="XXXXXXXX"
                maxLength={8}
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none
                           focus:ring-2 focus:ring-primary-300 text-center text-xl font-mono
                           tracking-widest uppercase"
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm bg-red-50 px-4 py-3 rounded-xl">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary-600 text-white rounded-xl font-semibold
                         hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Verificando…' : 'Validar código'}
            </button>
          </form>
        )}

        {/* Paso 2: registro */}
        {step === 'register' && (
          <form onSubmit={handleRegister} className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 space-y-5">
            <div className="text-center space-y-1">
              <p className="text-green-600 text-sm font-medium">✓ Código válido</p>
              <p className="text-gray-600 text-sm">Completa tus datos para crear tu cuenta</p>
            </div>

            {[
              { id: 'fullName', label: 'Tu nombre', type: 'text', placeholder: 'María García' },
              { id: 'email', label: 'Correo electrónico', type: 'email', placeholder: 'tu@correo.com' },
              { id: 'password', label: 'Contraseña', type: 'password', placeholder: '••••••••' },
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
                  onChange={e => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))}
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
                         hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Creando cuenta…' : 'Crear mi cuenta'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center text-sm">
          <Link href="/auth/login" className="text-gray-500 hover:text-gray-700">
            ← Volver al inicio de sesión
          </Link>
        </div>
      </div>
    </div>
  )
}
