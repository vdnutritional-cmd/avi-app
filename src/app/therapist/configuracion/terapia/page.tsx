'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { ENFOQUES_CATALOGO, MAX_ENFOQUES, enfoquesDePerfil, nombrePerfil, perfilDeEnfoques, type EnfoqueId } from '@/lib/enfoques'

// Solo se muestran los enfoques permitidos (27 oct 2026): con plan pagado personal o sin empresa, todos;
// si no, los que autorizaron sus empresas activas en Configuración Admin. Regla: src/lib/enfoques-permitidos.ts
type Motivo = 'plan_personal' | 'gracia' | 'empresas' | 'sin_empresa'

export default function TerapiaConfigPage() {
  const [seleccion, setSeleccion] = useState<EnfoqueId[]>([])
  const [permitidos, setPermitidos] = useState<EnfoqueId[]>([])
  const [motivo, setMotivo] = useState<Motivo>('sin_empresa')
  const [empresas, setEmpresas] = useState<{ nombre: string; enfoques: EnfoqueId[] }[]>([])
  const [graciaHasta, setGraciaHasta] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    cargarPerfil()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function cargarPerfil() {
    setLoading(true)
    try {
      const res = await fetch('/api/therapist/enfoque')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const perm: EnfoqueId[] = data.permitidos ?? []
      setPermitidos(perm)
      setMotivo(data.motivo)
      setEmpresas(data.empresas ?? [])
      setGraciaHasta(data.graciaHasta ?? null)
      setSeleccion(enfoquesDePerfil(data.perfil).filter(id => perm.includes(id)))
    } catch {
      setError('No se pudo cargar tu configuración. Recarga la página.')
    }
    setLoading(false)
  }

  function toggleTerapia(id: EnfoqueId) {
    setSeleccion(prev => {
      if (prev.includes(id)) {
        return prev.filter(t => t !== id)
      }
      if (prev.length >= MAX_ENFOQUES) {
        setError('Máximo 2 enfoques terapéuticos. Deselecciona uno para elegir otro.')
        return prev
      }
      setError(null)
      return [...prev, id]
    })
    setSaved(false)
  }

  async function guardar() {
    if (seleccion.length === 0) {
      setError('Selecciona al menos un enfoque terapéutico.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/therapist/enfoque', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enfoques: seleccion }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Error al guardar. Intenta de nuevo.')
    }
    setSaving(false)
  }

  const terapias = ENFOQUES_CATALOGO.filter(t => permitidos.includes(t.id))
  const perfilPreview = seleccion.length > 0
    ? nombrePerfil(perfilDeEnfoques(seleccion))
    : 'Selecciona al menos un enfoque'

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
      {/* Encabezado */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Enfoque terapéutico</h1>
        <p className="mt-1 text-sm text-gray-500">
          Selecciona los enfoques que usas en tus análisis. AVI consultará únicamente
          la bibliografía de los enfoques que elijas.
        </p>
      </div>

      {/* De dónde salen los enfoques que se muestran */}
      {motivo === 'empresas' && (
        <div className="rounded-xl bg-primary-50 border border-primary-100 px-4 py-3 text-xs text-primary-800 leading-relaxed">
          Enfoques autorizados por {empresas.length === 1 ? 'tu empresa' : 'tus empresas'}:{' '}
          <strong>{empresas.map(e => e.nombre).join(', ')}</strong>.
        </div>
      )}

      {motivo === 'gracia' && graciaHasta && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800 leading-relaxed">
          Tu plan pagado venció. Conservas todos los enfoques hasta el{' '}
          <strong>{new Date(graciaHasta).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>;
          después solo podrás usar los que autoricen tus empresas. Si renuevas tu plan antes, no cambia nada.
        </div>
      )}

      {/* Selector de enfoques */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-700">
          {terapias.length > 1 ? 'Elige hasta 2 enfoques terapéuticos:' : 'Enfoque terapéutico:'}
        </p>
        {terapias.map(t => {
          const activa = seleccion.includes(t.id)
          return (
            <button
              key={t.id}
              onClick={() => toggleTerapia(t.id)}
              className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                activa
                  ? 'border-primary-600 bg-primary-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                  activa ? 'border-primary-600 bg-primary-600' : 'border-gray-300 bg-white'
                }`}>
                  {activa && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className={`font-semibold text-sm ${activa ? 'text-primary-800' : 'text-gray-800'}`}>
                    {t.icon} {t.label}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{t.descripcion}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      {/* Vista previa del perfil */}
      <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
          Enfoque que se activará
        </p>
        <p className="text-sm font-semibold text-gray-800">{perfilPreview}</p>
      </div>

      {/* Botón guardar */}
      <button
        onClick={guardar}
        disabled={saving || seleccion.length === 0}
        className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
          saved
            ? 'bg-green-600 text-white'
            : 'bg-primary-700 hover:bg-primary-800 text-white disabled:opacity-50 disabled:cursor-not-allowed'
        }`}
      >
        {saving ? 'Guardando...' : saved ? '✓ Guardado correctamente' : 'Guardar configuración'}
      </button>
    </div>
  )
}
