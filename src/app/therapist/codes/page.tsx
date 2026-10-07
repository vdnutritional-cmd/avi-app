'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { getAccesoTerapeuta } from '@/lib/acceso-paciente'

interface Code {
  code: string
  used: boolean
  created_at: string
}

interface SlotInfo {
  used: number
  total: number | null   // null = sin suscripción (acceso beta libre)
  hasAccess: boolean
  isCompanion: boolean   // true = límite viene de bundle companion (pacientes independientes)
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

    // Regla "la empresa paga": solo los pacientes independientes cuentan contra el cupo.
    // El contador es informativo — generar códigos y registrar pacientes nunca se bloquea;
    // los independientes fuera de cupo quedan bloqueados después, en su expediente.
    const acceso = await getAccesoTerapeuta(supabase, user.id)
    setSlots({
      used: acceso.indepCount,
      total: acceso.tienePlan ? acceso.indepSlots : 0,
      hasAccess: acceso.tienePlan || acceso.tieneEmpresa,
      isCompanion: false,
    })
  }

  async function loadCodes() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await supabase
      .from('authorization_codes')
      .select('code, is_active, created_at')
      .eq('therapist_id', user.id)
      .eq('is_active', true)
      .is('used_by', null)
      .order('created_at', { ascending: false })
      .limit(50)
    setCodes(data?.map(d => ({ ...d, used: !d.is_active })) ?? [])
    setLoaded(true)
    setLoading(false)
  }

  async function generateCode() {
    setError(null)
    // Sin bloqueo por cupo: todo paciente debe poder registrarse (el límite se aplica después)
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
        <div className={`rounded-xl px-4 py-3 flex items-center justify-between ${
          slots.isCompanion ? 'bg-emerald-50' : 'bg-purple-50'
        }`}>
          <div>
            <p className={`text-sm font-medium ${
              slots.isCompanion ? 'text-emerald-800' : 'text-purple-800'
            }`}>
              {`Pacientes independientes: ${slots.used} / ${slots.total}`}
            </p>
            <p className="text-xs text-purple-600 mt-0.5">
              Los pacientes de empresas en CONVENIO no cuentan en este límite.
            </p>
            <div className={`mt-1.5 h-1.5 rounded-full w-48 ${
              slots.isCompanion ? 'bg-emerald-100' : 'bg-purple-100'
            }`}>
              <div
                className={`h-1.5 rounded-full transition-all ${
                  slotsExhausted
                    ? 'bg-red-400'
                    : slots.isCompanion ? 'bg-emerald-500' : 'bg-purple-500'
                }`}
                style={{ width: `${Math.min(100, (slots.used / slots.total!) * 100)}%` }}
              />
            </div>
          </div>
          {slotsExhausted && (
            <Link
              href="/pricing"
              className={`text-xs text-white px-3 py-1.5 rounded-lg transition-colors ${
                slots.isCompanion
                  ? 'bg-emerald-700 hover:bg-emerald-800'
                  : 'bg-purple-700 hover:bg-purple-800'
              }`}
            >
              {slots.isCompanion ? 'Ver planes' : 'Ampliar plan'}
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
          disabled={generating}
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
            Ver disponibles
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
