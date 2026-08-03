'use client'

// ─────────────────────────────────────────────────────────────
// /admin/convenio-empresas — Gestión de Empresas en CONVENIO
// El admin registra las empresas que aparecen en el dropdown
// de la sección "Paquetes en CONVENIO" de /pricing
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'

interface Empresa {
  id: string
  nombre: string
  is_active: boolean
  created_at: string
}

export default function ConvenioEmpresasPage() {
  const [empresas, setEmpresas]   = useState<Empresa[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [nombre, setNombre]       = useState('')
  const [error, setError]         = useState('')

  const fetchEmpresas = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/convenio-empresas')
    const data = await res.json()
    setEmpresas(data.empresas ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchEmpresas() }, [fetchEmpresas])

  async function addEmpresa() {
    if (!nombre.trim()) return
    setSaving(true)
    setError('')
    const res = await fetch('/api/admin/convenio-empresas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre }),
    })
    const data = await res.json()
    if (data.error) {
      setError(data.error)
    } else {
      setNombre('')
      await fetchEmpresas()
    }
    setSaving(false)
  }

  async function toggleActive(id: string, is_active: boolean) {
    await fetch('/api/admin/convenio-empresas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active }),
    })
    await fetchEmpresas()
  }

  const activas    = empresas.filter(e => e.is_active)
  const inactivas  = empresas.filter(e => !e.is_active)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Empresas en CONVENIO</h1>
        <p className="text-sm text-gray-500 mt-1">
          Las empresas activas aparecen en el dropdown de "Paquetes en CONVENIO" en la página de precios.
        </p>
      </div>

      {/* ── Agregar empresa ── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-3">
        <h2 className="text-base font-semibold text-gray-800">Agregar empresa</h2>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Nombre de la empresa"
            value={nombre}
            onChange={e => { setNombre(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && addEmpresa()}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
          <button
            onClick={addEmpresa}
            disabled={saving || !nombre.trim()}
            className="bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors"
          >
            {saving ? 'Guardando…' : '+ Agregar'}
          </button>
        </div>
        {error && <p className="text-red-500 text-xs">{error}</p>}
      </div>

      {/* ── Empresas activas ── */}
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-3">
          Activas ({activas.length})
        </h2>
        {loading ? (
          <p className="text-sm text-gray-400">Cargando…</p>
        ) : activas.length === 0 ? (
          <p className="text-sm text-gray-400">Sin empresas registradas aún.</p>
        ) : (
          <div className="space-y-2">
            {activas.map(e => (
              <div key={e.id} className="flex items-center justify-between bg-white border border-purple-100 rounded-xl px-4 py-3">
                <span className="text-sm font-medium text-gray-800">{e.nombre}</span>
                <button
                  onClick={() => toggleActive(e.id, false)}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors"
                >
                  Desactivar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Empresas inactivas ── */}
      {inactivas.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-800 mb-3">
            Inactivas ({inactivas.length})
          </h2>
          <div className="space-y-2">
            {inactivas.map(e => (
              <div key={e.id} className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-4 py-3 opacity-60">
                <span className="text-sm text-gray-500">{e.nombre}</span>
                <button
                  onClick={() => toggleActive(e.id, true)}
                  className="text-xs text-purple-500 hover:text-purple-700 transition-colors"
                >
                  Reactivar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
