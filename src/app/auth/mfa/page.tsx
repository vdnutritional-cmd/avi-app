'use client'

export const dynamic = 'force-dynamic'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function MfaPage() {
  const router = useRouter()

  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => { inputs.current[0]?.focus() }, [])

  function handleChange(value: string, index: number) {
    if (!/^\d?$/.test(value)) return
    const next = [...code]
    next[index] = value
    setCode(next)
    if (value && index < 5) inputs.current[index + 1]?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus()
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      setCode(pasted.split(''))
      inputs.current[5]?.focus()
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    const totpCode = code.join('')
    if (totpCode.length !== 6) { setError('Ingresa los 6 dígitos'); return }

    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      // Verificar nivel de autenticación actual
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

      if (aalData?.currentLevel === 'aal2') {
        // Ya verificado — redirigir
        router.push('/therapist/dashboard')
        return
      }

      const { data: factors } = await supabase.auth.mfa.listFactors()
      const totpFactor = factors?.totp?.[0]
      if (!totpFactor) {
        setError('No tienes 2FA configurado.')
        setLoading(false)
        return
      }

      // Crear challenge
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: totpFactor.id,
      })
      if (challengeError || !challenge) {
        setError('Error al crear el desafío MFA. Intenta de nuevo.')
        setLoading(false)
        return
      }

      // Verificar código
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challenge.id,
        code: totpCode,
      })

      if (verifyError) {
        setError('Código incorrecto. Verifica tu app de autenticación.')
        setCode(['', '', '', '', '', ''])
        inputs.current[0]?.focus()
        setLoading(false)
        return
      }

      // MFA verificado — obtener rol y redirigir
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user!.id)
        .single()

      const destination = profile?.role === 'therapist' ? '/therapist/dashboard' : '/patient/chat'
      router.push(destination)
      router.refresh()
    } catch (err) {
      console.error('[mfa] Error:', err)
      setError('Error al verificar. Intenta de nuevo.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-calm-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-bold text-primary-700">AVI</Link>
          <p className="text-gray-500 mt-2">Verificación en dos pasos</p>
        </div>

        <form onSubmit={handleVerify} className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 space-y-6">
          <div className="text-center">
            <div className="text-4xl mb-3">🔐</div>
            <p className="text-sm text-gray-600">
              Ingresa el código de 6 dígitos de tu app de autenticación (Google Authenticator, Authy, etc.)
            </p>
          </div>

          {/* Inputs de 6 dígitos */}
          <div className="flex gap-2 justify-center" onPaste={handlePaste}>
            {code.map((digit, i) => (
              <input
                key={i}
                ref={el => { inputs.current[i] = el }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleChange(e.target.value, i)}
                onKeyDown={e => handleKeyDown(e, i)}
                className="w-11 h-14 text-center text-xl font-bold border-2 rounded-xl
                           border-gray-200 focus:border-primary-400 focus:ring-2
                           focus:ring-primary-200 focus:outline-none transition"
              />
            ))}
          </div>

          {error && (
            <p className="text-red-600 text-sm text-center bg-red-50 border border-red-200 rounded-xl px-4 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || code.join('').length !== 6}
            className="w-full py-3 rounded-xl bg-primary-600 text-white font-semibold
                       hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? 'Verificando...' : 'Verificar'}
          </button>

          <p className="text-center text-xs text-gray-400">
            ¿Problemas con tu código?{' '}
            <Link href="/auth/login" className="text-primary-600 hover:underline">
              Volver al inicio de sesión
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
