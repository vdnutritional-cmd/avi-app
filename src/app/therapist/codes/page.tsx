'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Code {
  code: string
  used: boolean
  created_at: string
}

interface SlotInfo {
  used: number
  total: number | null   // null = sin suscripción (acceso beta libre)
  hasAccess: boolean
}

export default function CodesPage() {
  const [codes, setCodes] = useState<Code[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [slots, setSlots] = useState<SlotInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadSlotInfo()
  }, [])

  async function loadSlotInfo() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Pacientes activos
    const { count: usedCount } = await supabase
      .from('therapist_patients')
      .select('*', { count: 'exact', head: true })
      .eq('therapist_id', user.id)
      .eq('is_active', true)

    // Suscripción
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('patient_slots, status')
      .eq('therapist_id', user.id)
      .single()

    const hasAccess = !sub || ['active', 'free_approved', 'trialing'].includes(sub?.status ?? '')

    setSlots({
      used: usedCount ?? 0,
      total: sub?.patient_slots ?? null,
      hasAccess,
    })
  }

  async function loadCodes() {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('authorization_codes')
      .select('code, is_active, created_at')
      .order('created_at', { ascending: false })
      .limit(50)
    setCodes(data?.map(d => ({ ...d, used: !d.is_active })) ?? [])
    setLoaded(true)
    setLoading(false)
  }

  async function generateCode() {
    setError(null)

    // Verificar límite de pacientes
    if (slots?.total !== null && slots !== null && slots.used >= (slots.total ?? 0)) {
      setError(`Has alcanzado tu límite de ${slots.total} pacientes. Actualiza tu plan para agregar más.`)
      return
    }

    setGenerating(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setGenerating(false); return }

    const { data: newCode, error: rpcError } = await supabase.rpc('generate_auth_code')
    if (rpcError || !newCode) { setGenerating(false); return }

    const { error: insertError } = await supabase
      .from('authorization_codes')
      .insert({ code: newCode, therapist_id: user.id })

    if (!insertError) {
      setCodes(prev => [{ code: newCode, used: false, created_at: new Date().toISOString() }, ...prev])
      if (!loaded) setLoaded(true)
    }
    setGenerating(false)
  }

  async function copyCode(code: string) {
    await navigator.clipboard.writeText(code)
    setCopied(code)
    setTimeout(() => setCopied(null), 2000)
  }

  const slotsExhausted = slots?.total !== null && slots !== null && (slots.used >= (slots.total ?? 0))

  return (
    <div className="p-6 max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-800">Códigos de acceso</h1>
        <p className="text-sm text-gray-500 mt-1">
          Genera un código y dáselo a tu paciente para que se registre en Recupérate.
        </p>
      </div>

      {/* Indicador de slots */}
      {slots && slots.total !== null && (
        <div className="bg-purple-50 rounded-xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-purple-800">
              Pacientes activos: {slots.used} / {slots.total}
            </p>
            <div className="mt-1.5 h-1.5 bg-purple-100 rounded-full w-48">
              <div
                className={`h-1.5 rounded-full transition-all ${
                  slotsExhausted ? 'bg-red-400' : 'bg-purple-500'
                }`}
                style={{ width: `${Math.min(100, (slots.used / slots.total!) * 100)}%` }}
              />
            </div>
          </div>
          {slotsExhausted && (
            <Link
              href="/pricing"
              className="text-xs bg-purple-700 text-white px-3 py-1.5 rounded-lg hover:bg-purple-800 transition-colors"
            >
              Ampliar plan
            </Link>
          )}
        </div>
      )}

      {/* Error de slots */}
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700">
          {error}{' '}
          <Link href="/pricing" className="underline font-medium">Ver planes</Link>
        </div>
      )}

      {/* Botones principales */}
      <div className="flex gap-3">
        <button
          onClick={generateCode}
          disabled={generating || !!slotsExhausted}
          className="flex-1 bg-purple-700 hover:bg-purple-800 text-white rounded-xl py-3 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? 'Generando...' : '+ Generar código nuevo'}
        </button>
        {!loaded && (
          <button
            onClick={loadCodes}
            disabled={loading}
            className="px-4 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Ver todos
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-gray-400 text-center">Cargando...</p>}

      {loaded && codes.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-400 text-sm">
          No hay códigos todavía. Genera el primero arriba.
        </div>
      )}

      <div className="space-y-2">
        {codes.map((c) => (
          <div
            key={c.code}
            className={`flex items-center justify-between px-4 py-3 rounded-xl border ${
              c.used ? 'bg-gray-50 border-gray-100 opacity-60' : 'bg-white border-gray-200'
            }`}
          >
            <div>
              <p className={`font-mono text-lg font-semibold tracking-widest ${
                c.used ? 'text-gray-400' : 'text-gray-800'
              }`}>
                {c.code}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {c.used ? 'Usado' : 'Disponible'} ·{' '}
                {new Date(c.created_at).toLocaleDateString('es-MX', {
                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                })}
              </p>
            </div>
            {!c.used && (
              <button
                onClick={() => copyCode(c.code)}
                className="text-xs text-purple-600 hover:text-purple-700 border border-purple-200 hover:bg-purple-50 px-3 py-1.5 rounded-lg transition-colors"
              >
                {copied === c.code ? '✓ Copiado' : 'Copiar'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
