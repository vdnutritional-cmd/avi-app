'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Code {
  code: string
  used: boolean
  created_at: string
  patient_email?: string
}

export default function CodesPage() {
  const [codes, setCodes] = useState<Code[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

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
    setGenerating(true)
    const supabase = createClient()

    // Obtener el therapist_id del usuario actual
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setGenerating(false); return }

    // Generar código único
    const { data: newCode, error: rpcError } = await supabase.rpc('generate_auth_code')
    if (rpcError || !newCode) { setGenerating(false); return }

    // Insertar en la tabla
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

  if (!loaded) {
    return (
      <div className="p-6 max-w-lg mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Códigos de acceso</h1>
          <p className="text-sm text-gray-500 mt-1">
            Genera un código de 8 caracteres y dáselo a tu paciente para que se registre.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={generateCode}
            disabled={generating}
            className="flex-1 bg-primary-600 hover:bg-primary-700 text-white rounded-xl py-3 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {generating ? 'Generando...' : '+ Generar código nuevo'}
          </button>
          <button
            onClick={loadCodes}
            disabled={loading}
            className="px-4 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Ver todos
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-800">Códigos de acceso</h1>
        <p className="text-sm text-gray-500 mt-1">
          Genera un código y dáselo a tu paciente para que se registre en Recupérate.
        </p>
      </div>

      <button
        onClick={generateCode}
        disabled={generating}
        className="w-full bg-primary-600 hover:bg-primary-700 text-white rounded-xl py-3 text-sm font-medium transition-colors disabled:opacity-50"
      >
        {generating ? 'Generando...' : '+ Generar código nuevo'}
      </button>

      {loading && (
        <p className="text-sm text-gray-400 text-center">Cargando...</p>
      )}

      {codes.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-400 text-sm">
          No hay códigos todavía. Genera el primero arriba.
        </div>
      )}

      <div className="space-y-2">
        {codes.map((c) => (
          <div
            key={c.code}
            className={`flex items-center justify-between px-4 py-3 rounded-xl border ${
              c.used
                ? 'bg-gray-50 border-gray-100 opacity-60'
                : 'bg-white border-gray-200'
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
                className="text-xs text-primary-600 hover:text-primary-700 border border-primary-200
                           hover:bg-primary-50 px-3 py-1.5 rounded-lg transition-colors"
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
