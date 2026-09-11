'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { checkPassword } from '@/lib/password-strength'
import PasswordStrengthBar from '@/components/PasswordStrengthBar'

function RegistroConsultorioForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('t') ?? ''

  const [therapistName, setTherapistName] = useState<string | null>(null)
  const [tokenInvalido, setTokenInvalido] = useState(false)
  const [form, setForm] = useState({ fullName: '', email: '', whatsapp: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [registrado, setRegistrado] = useState(false)

  // Validar token al cargar y obtener nombre del terapeuta
  useEffect(() => {
    if (!token) { setTokenInvalido(true); return }

    fetch(`/api/auth/registro-consultorio?t=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setTokenInvalido(true)
        else setTherapistName(data.therapistName)
      })
      .catch(() => setTokenInvalido(true))
  }, [token])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Validaciones básicas
    if (!form.fullName.trim() || form.fullName.trim().length < 3) {
      setError('Ingresa tu nombre completo'); return
    }
    if (!form.email.includes('@')) {
      setError('Ingresa un correo válido'); return
    }
    if (form.whatsapp && !/^\d{10}$/.test(form.whatsapp)) {
      setError('El número de WhatsApp debe tener 10 dígitos'); return
    }

    const pwCheck = checkPassword(form.password)
    if (!pwCheck.valid) {
      setError('La contraseña no cumple los requisitos de seguridad: ' + pwCheck.errors.join(', '))
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/registro-consultorio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          fullName: form.fullName.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          whatsapp: form.whatsapp.trim() || null,
        }),
      })

      const body = await res.json()

      if (!res.ok) {
        setError(body.error ?? 'Error al crear la cuenta')
        setLoading(false)
        return
      }

      if (body.autoLogin) {
        // Sesión iniciada — ir directo a AVI
        router.push('/patient/chat')
        router.refresh()
      } else {
        // Cuenta creada pero sin auto-login (poco frecuente)
        setRegistrado(true)
      }
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
      setLoading(false)
    }
  }

  // ── Token inválido ───────────────────────────────────────────────────────
  if (tokenInvalido) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-calm-50 px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="text-5xl">🔗</div>
          <h2 className="text-xl font-bold text-gray-800">Código no válido</h2>
          <p className="text-gray-500 text-sm leading-relaxed">
            Este código de registro no existe o ya no está disponible.
            Pide a tu terapeuta que te comparta el código correcto.
          </p>
          <Link href="/auth/login" className="text-primary-600 text-sm hover:underline">
            Iniciar sesión
          </Link>
        </div>
      </div>
    )
  }

  // ── Cargando token ───────────────────────────────────────────────────────
  if (therapistName === null && !tokenInvalido) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400 text-sm">Verificando código…</p>
      </div>
    )
  }

  // ── Registro completado (sin auto-login) ─────────────────────────────────
  if (registrado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-calm-50 px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="text-5xl">✅</div>
          <h2 className="text-xl font-bold text-gray-800">¡Cuenta creada!</h2>
          <p className="text-gray-500 text-sm leading-relaxed">
            Tu cuenta quedó vinculada con <strong>{therapistName}</strong>.
            Ahora inicia sesión para comenzar.
          </p>
          <Link
            href="/auth/login"
            className="block w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-2xl transition-colors text-sm"
          >
            Iniciar sesión
          </Link>
        </div>
      </div>
    )
  }

  // ── Formulario de registro ───────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-calm-50 px-4 py-8">
      <div className="w-full max-w-sm">

        {/* Encabezado */}
        <div className="text-center mb-6">
          <Link href="/" className="text-3xl font-bold text-primary-700">AVI</Link>
          <p className="text-gray-500 mt-1 text-sm">Registro de paciente</p>
          {therapistName && (
            <div className="mt-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2">
              <p className="text-sm text-indigo-700">
                Te estás registrando con <strong>{therapistName}</strong>
              </p>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-sm border border-gray-100 p-7 space-y-4">

          {/* Nombre */}
          <div className="space-y-1">
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
              Nombre completo
            </label>
            <input
              id="fullName" name="fullName" type="text"
              value={form.fullName} onChange={handleChange}
              placeholder="María González" required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none
                         focus:ring-2 focus:ring-primary-300 focus:border-primary-400 transition text-sm"
            />
          </div>

          {/* Email */}
          <div className="space-y-1">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Correo electrónico
            </label>
            <input
              id="email" name="email" type="email"
              value={form.email} onChange={handleChange}
              placeholder="tu@correo.com" required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none
                         focus:ring-2 focus:ring-primary-300 focus:border-primary-400 transition text-sm"
            />
          </div>

          {/* WhatsApp (opcional) */}
          <div className="space-y-1">
            <label htmlFor="whatsapp" className="block text-sm font-medium text-gray-700">
              WhatsApp <span className="text-gray-400 font-normal text-xs">(opcional, 10 dígitos)</span>
            </label>
            <input
              id="whatsapp" name="whatsapp" type="tel"
              value={form.whatsapp} onChange={handleChange}
              placeholder="3312345678"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none
                         focus:ring-2 focus:ring-primary-300 focus:border-primary-400 transition text-sm"
            />
          </div>

          {/* Contraseña */}
          <div className="space-y-1">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Contraseña
            </label>
            <div className="relative">
              <input
                id="password" name="password"
                type={showPassword ? 'text' : 'password'}
                value={form.password} onChange={handleChange}
                placeholder="••••••••" required
                className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-200 focus:outline-none
                           focus:ring-2 focus:ring-primary-300 focus:border-primary-400 transition text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
              >
                {showPassword ? '🙈' : '👁'}
              </button>
            </div>
            <PasswordStrengthBar password={form.password} />
          </div>

          {error && (
            <p className="text-red-500 text-sm bg-red-50 px-4 py-3 rounded-xl">{error}</p>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full py-3 bg-primary-600 text-white rounded-xl font-semibold text-sm
                       hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creando tu cuenta…' : 'Crear cuenta y entrar a AVI'}
          </button>

          <p className="text-xs text-gray-400 text-center leading-relaxed">
            Al registrarte aceptas los términos de uso de AVI. Tu información es confidencial.
          </p>
        </form>

        <p className="text-center text-sm text-gray-400 mt-4">
          ¿Ya tienes cuenta?{' '}
          <Link href="/auth/login" className="text-primary-600 hover:underline">Inicia sesión</Link>
        </p>
      </div>
    </div>
  )
}

export default function RegistroConsultorioPage() {
  return (
    <Suspense>
      <RegistroConsultorioForm />
    </Suspense>
  )
}
