'use client'

// ─────────────────────────────────────────────────────────────
// /admin/convenio — Gestión de Códigos CONVENIO
// Solo accesible por el administrador de AVI.
// Permite generar, copiar y desactivar códigos de acceso
// para los planes en CONVENIO (precio especial).
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'

interface ConvenioCode {
  id: string
  code: string
  plan_id: string | null
  used_by: string | null
  used_by_name: string | null
  used_by_email: string | null
  used_at: string | null
  expires_at: string | null
  is_active: boolean
  created_at: string
}

const PLAN_OPTIONS = [
  { value: '', label: 'Cualquier plan CONVENIO' },
  { value: 'esencial_valora10', label: 'CONVENIO Esencial 10' },
  { value: 'esencial_valora20', label: 'CONVENIO Esencial 20' },
  { value: 'clinico_valora10',  label: 'CONVENIO Clínico 10' },
  { value: 'clinico_valora20',  label: 'CONVENIO Clínico 20' },
]

export default function ConvenioPage() {
  const [codes, setCodes] = useState<ConvenioCode[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Opciones para nuevo código
  const [selectedPlan, setSelectedPlan] = useState('')
  const [expiresAt, setExpiresAt] = useState('')

  const fetchCodes = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/convenio-codes')
    const data = await res.json()
    setCodes(data.codes ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchCodes() }, [fetchCodes])

  async function generateCode() {
    setGenerating(true)
    const res = await fetch('/api/admin/convenio-codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId: selectedPlan || undefined,
        expiresAt: expiresAt || undefined,
      }),
    })
    const data = await res.json()
    if (data.code) {
      await fetchCodes()
      await copyToClipboard(data.code.code, data.code.id)
    }
    setGenerating(false)
  }

  async function toggleActive(id: string, is_active: boolean) {
    await fetch('/api/admin/convenio-codes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active }),
    })
    await fetchCodes()
  }

  async function copyToClipboard(code: string, id: string) {
    await navigator.clipboard.writeText(code)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const activeCodes   = codes.filter(c => c.is_active && !c.used_by)
  const usedCodes     = codes.filter(c => c.used_by)
  const inactiveCodes = codes.filter(c => !c.is_active && !c.used_by)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Códigos CONVENIO</h1>
        <p className="text-sm text-gray-500 mt-1">
          Genera y gestiona códigos de acceso para planes en CONVENIO.
          Cada código es de un solo uso.
        </p>
      </div>

      {/* ── Generador ── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-800">Generar nuevo código para Plan con Descuento</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Plan (opcional)</label>
            <select
              value={selectedPlan}
              onChange={e => setSelectedPlan(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
            >
              {PLAN_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Fecha de expiración (opcional)
            </label>
            <input
              type="date"
              value={expiresAt}
              onChange={e => setExpiresAt(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>
        </div>
        <button
          onClick={generateCode}
          disabled={generating}
          className="inline-flex items-center gap-2 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
        >
          {generating ? 'Generando…' : '+ Generar código'}
        </button>
        <p className="text-xs text-gray-400">
          El código se copiará automáticamente al portapapeles al generarse.
        </p>
      </div>

      {/* ── Códigos activos (sin usar) ── */}
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-3">
          Activos — sin usar ({activeCodes.length})
        </h2>
        {loading ? (
          <p className="text-sm text-gray-400">Cargando…</p>
        ) : activeCodes.length === 0 ? (
          <p className="text-sm text-gray-400">No hay códigos activos disponibles.</p>
        ) : (
          <div className="space-y-2">
            {activeCodes.map(c => (
              <CodeRow
                key={c.id}
                code={c}
                copied={copiedId === c.id}
                onCopy={() => copyToClipboard(c.code, c.id)}
                onDeactivate={() => toggleActive(c.id, false)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Códigos usados ── */}
      {usedCodes.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-800 mb-3">
            Usados ({usedCodes.length})
          </h2>
          <div className="space-y-2">
            {usedCodes.map(c => (
              <CodeRow key={c.id} code={c} copied={false} onCopy={() => copyToClipboard(c.code, c.id)} />
            ))}
          </div>
        </div>
      )}

      {/* ── Códigos inactivos ── */}
      {inactiveCodes.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-800 mb-3">
            Desactivados ({inactiveCodes.length})
          </h2>
          <div className="space-y-2">
            {inactiveCodes.map(c => (
              <CodeRow
                key={c.id}
                code={c}
                copied={false}
                onCopy={() => copyToClipboard(c.code, c.id)}
                onActivate={() => toggleActive(c.id, true)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Fila de código ────────────────────────────────────────────
function CodeRow({
  code,
  copied,
  onCopy,
  onDeactivate,
  onActivate,
}: {
  code: ConvenioCode
  copied: boolean
  onCopy: () => void
  onDeactivate?: () => void
  onActivate?: () => void
}) {
  const planLabel = PLAN_OPTIONS.find(o => o.value === (code.plan_id ?? ''))?.label ?? 'Cualquier plan CONVENIO'

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center gap-3 bg-white border rounded-xl px-4 py-3 ${
      code.used_by ? 'border-gray-100 opacity-70' : code.is_active ? 'border-purple-100' : 'border-gray-100 opacity-60'
    }`}>
      {/* Código */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span className="font-mono text-sm font-bold text-purple-700 tracking-widest">{code.code}</span>
        <button
          onClick={onCopy}
          className="text-xs text-gray-400 hover:text-purple-600 transition-colors whitespace-nowrap"
        >
          {copied ? '✓ Copiado' : 'Copiar'}
        </button>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-2 text-xs text-gray-500">
        <span className="bg-gray-100 rounded-lg px-2 py-0.5">{planLabel}</span>
        {code.expires_at && (
          <span className="bg-yellow-50 text-yellow-700 rounded-lg px-2 py-0.5">
            Vence {new Date(code.expires_at).toLocaleDateString('es-MX')}
          </span>
        )}
        {code.used_by && (
          <span className="bg-green-50 text-green-700 rounded-lg px-2 py-0.5">
            Usado por {code.used_by_name ?? code.used_by_email ?? code.used_by}
          </span>
        )}
        {!code.is_active && !code.used_by && (
          <span className="bg-red-50 text-red-600 rounded-lg px-2 py-0.5">Desactivado</span>
        )}
      </div>

      {/* Acciones */}
      <div className="flex gap-2">
        {onDeactivate && (
          <button
            onClick={onDeactivate}
            className="text-xs text-red-400 hover:text-red-600 transition-colors whitespace-nowrap"
          >
            Desactivar
          </button>
        )}
        {onActivate && (
          <button
            onClick={onActivate}
            className="text-xs text-purple-500 hover:text-purple-700 transition-colors whitespace-nowrap"
          >
            Reactivar
          </button>
        )}
      </div>
    </div>
  )
}
