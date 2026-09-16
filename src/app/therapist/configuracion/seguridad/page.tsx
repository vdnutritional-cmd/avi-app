'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

type Step = 'idle' | 'qr' | 'verify' | 'done' | 'disable-confirm'

export default function SeguridadPage() {
  const supabase = createClient()

  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [step, setStep] = useState<Step>('idle')
  const [qrUri, setQrUri] = useState('')
  const [secret, setSecret] = useState('')
  const [factorId, setFactorId] = useState('')
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => { checkMfaStatus() }, [])

  async function checkMfaStatus() {
    setLoadingStatus(true)
    const { data } = await supabase.auth.mfa.listFactors()
    const active = data?.totp?.some(f => f.status === 'verified') ?? false
    setMfaEnabled(active)
    setLoadingStatus(false)
  }

  // ── Enrolamiento ─────────────────────────────────────────────
  async function startEnroll() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', issuer: 'AVI', friendlyName: 'AVI Authenticator' })
    if (error || !data) {
      setError('Error al iniciar el enrolamiento. Intenta de nuevo.')
      setLoading(false)
      return
    }
    setQrUri(data.totp.qr_code)
    setSecret(data.totp.secret)
    setFactorId(data.id)
    setStep('qr')
    setLoading(false)
  }

  async function verifyEnroll() {
    const totpCode = code.join('')
    if (totpCode.length !== 6) { setError('Ingresa los 6 dígitos'); return }
    setLoading(true)
    setError(null)

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
    if (challengeError) { setError('Error al crear challenge.'); setLoading(false); return }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
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

    setMfaEnabled(true)
    setStep('done')
    setLoading(false)
  }

  // ── Desactivar MFA ───────────────────────────────────────────
  async function disableMfa() {
    setLoading(true)
    setError(null)
    const { data } = await supabase.auth.mfa.listFactors()
    const factors = data?.totp ?? []
    await Promise.all(factors.map(f => supabase.auth.mfa.unenroll({ factorId: f.id })))
    setMfaEnabled(false)
    setStep('idle')
    setLoading(false)
  }

  // ── Inputs de código ─────────────────────────────────────────
  function handleChange(value: string, index: number) {
    if (!/^\d?$/.test(value)) return
    const next = [...code]
    next[index] = value
    setCode(next)
    if (value && index < 5) inputs.current[index + 1]?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key === 'Backspace' && !code[index] && index > 0) inputs.current[index - 1]?.focus()
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) { setCode(pasted.split('')); inputs.current[5]?.focus() }
  }

  if (loadingStatus) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Seguridad de la cuenta</h1>
        <p className="text-gray-500 text-sm mt-1">Gestiona la autenticación en dos pasos (2FA/MFA)</p>
      </div>

      {/* Estado actual */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-800">Autenticación en dos pasos</p>
            <p className="text-sm text-gray-500 mt-0.5">
              Protege tu cuenta con un código adicional al iniciar sesión
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
            mfaEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}>
            {mfaEnabled ? '✓ Activo' : 'Inactivo'}
          </span>
        </div>

        {/* Acciones según estado */}
        {step === 'idle' && !mfaEnabled && (
          <button
            onClick={startEnroll}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-700 disabled:opacity-50 transition"
          >
            {loading ? 'Iniciando...' : 'Activar autenticación en dos pasos'}
          </button>
        )}

        {step === 'idle' && mfaEnabled && (
          <button
            onClick={() => setStep('disable-confirm')}
            className="w-full py-3 rounded-xl border border-red-200 text-red-600 font-semibold hover:bg-red-50 transition"
          >
            Desactivar 2FA
          </button>
        )}

        {/* Confirmación desactivar */}
        {step === 'disable-confirm' && (
          <div className="space-y-3">
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              ⚠️ Al desactivar el 2FA tu cuenta quedará menos protegida. ¿Estás seguro?
            </p>
            <div className="flex gap-2">
              <button onClick={() => setStep('idle')} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition">
                Cancelar
              </button>
              <button onClick={disableMfa} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50 transition">
                {loading ? 'Desactivando...' : 'Sí, desactivar'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Paso 1: QR */}
      {step === 'qr' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">1. Escanea el código QR</h2>
          <p className="text-sm text-gray-500">
            Abre <strong>Google Authenticator</strong>, <strong>Authy</strong> u otra app de autenticación y escanea este código.
          </p>

          {qrUri && (
            <div className="flex justify-center">
              {/* El QR viene como SVG en base64 desde Supabase */}
              <img src={qrUri} alt="QR MFA" className="w-48 h-48 border border-gray-200 rounded-xl p-2" />
            </div>
          )}

          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-500 mb-1">¿No puedes escanear? Ingresa este código manualmente:</p>
            <p className="font-mono text-sm text-gray-800 break-all select-all">{secret}</p>
          </div>

          <button
            onClick={() => { setStep('verify'); setError(null); setTimeout(() => inputs.current[0]?.focus(), 100) }}
            className="w-full py-3 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-700 transition"
          >
            Ya lo escaneé →
          </button>
        </div>
      )}

      {/* Paso 2: Verificar */}
      {step === 'verify' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">2. Ingresa el código de verificación</h2>
          <p className="text-sm text-gray-500">
            Abre tu app de autenticación e ingresa el código de 6 dígitos que muestra.
          </p>

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
                className="w-11 h-14 text-center text-xl font-bold border-2 rounded-xl border-gray-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-200 focus:outline-none transition"
              />
            ))}
          </div>

          {error && (
            <p className="text-red-600 text-sm text-center bg-red-50 border border-red-200 rounded-xl px-4 py-2">{error}</p>
          )}

          <div className="flex gap-2">
            <button onClick={() => setStep('qr')} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition">
              ← Atrás
            </button>
            <button
              onClick={verifyEnroll}
              disabled={loading || code.join('').length !== 6}
              className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-700 disabled:opacity-50 transition"
            >
              {loading ? 'Verificando...' : 'Activar 2FA'}
            </button>
          </div>
        </div>
      )}

      {/* Éxito */}
      {step === 'done' && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center space-y-2">
          <div className="text-4xl">🎉</div>
          <p className="font-semibold text-green-800">¡2FA activado correctamente!</p>
          <p className="text-sm text-green-700">
            A partir de ahora necesitarás tu app de autenticación cada vez que inicies sesión.
          </p>
        </div>
      )}

      {error && step === 'idle' && (
        <p className="text-red-600 text-sm text-center">{error}</p>
      )}
    </div>
  )
}
