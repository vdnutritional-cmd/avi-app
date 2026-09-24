'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

// Perfiles válidos según las combinaciones acordadas
const TERAPIAS = [
  {
    id: 'famsis',
    label: 'Familiar Sistémica',
    descripcion: 'Terapia sistémica, estructural y relacional. Incluye Minuchin, Satir, Gottman y Ciclo Vital.',
    icon: '🏠',
  },
  {
    id: 'trec',
    label: 'TREC — Racional Emotivo-Conductual',
    descripcion: 'Terapia Racional Emotivo-Conductual de Albert Ellis. Reestructuración cognitiva y creencias irracionales.',
    icon: '🧠',
  },
  {
    id: 'cc',
    label: 'Cognitivo-Conductual',
    descripcion: 'Modelo cognitivo de Aaron T. Beck. Triada cognitiva, errores cognitivos y depresión.',
    icon: '💡',
  },
] as const

type TerapiaId = 'famsis' | 'trec' | 'cc'

// Calcula el perfil compuesto según las terapias seleccionadas
function calcularPerfil(seleccion: TerapiaId[]): string {
  const sorted = [...seleccion].sort()
  if (sorted.length === 0) return 'famsis'          // default: Familiar Sistémica
  if (sorted.length === 1) return sorted[0]
  // 2 terapias — ordenar alfabéticamente para obtener la clave compuesta
  return sorted.join('_')
}

// Extrae las terapias individuales desde un perfil compuesto guardado en DB
function perfilASeleccion(perfil: string): TerapiaId[] {
  const partes = perfil.split('_') as TerapiaId[]
  return partes.filter((p): p is TerapiaId => ['famsis', 'trec', 'cc'].includes(p))
}

const PERFIL_LABELS: Record<string, string> = {
  famsis:      'Familiar Sistémica',
  trec:        'TREC — Racional Emotivo-Conductual',
  cc:          'Cognitivo-Conductual',
  famsis_trec: 'Familiar Sistémica + TREC',
  famsis_cc:   'Familiar Sistémica + Cognitivo-Conductual',
  trec_cc:     'TREC + Cognitivo-Conductual',
}

export default function TerapiaConfigPage() {
  const [seleccion, setSeleccion] = useState<TerapiaId[]>([])
  const [perfilActual, setPerfilActual] = useState<string>('famsis')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    cargarPerfil()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function cargarPerfil() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data } = await supabase
      .from('profiles')
      .select('therapy_profile')
      .eq('id', user.id)
      .single()

    const perfil = data?.therapy_profile ?? null
    setPerfilActual(perfil ?? '')
    setSeleccion(perfil ? perfilASeleccion(perfil) : [])
    setLoading(false)
  }

  function toggleTerapia(id: TerapiaId) {
    setSeleccion(prev => {
      if (prev.includes(id)) {
        return prev.filter(t => t !== id)
      }
      if (prev.length >= 2) {
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
    const nuevoPerfil = calcularPerfil(seleccion)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ therapy_profile: nuevoPerfil })
      .eq('id', user.id)

    if (updateError) {
      setError('Error al guardar. Intenta de nuevo.')
    } else {
      setPerfilActual(nuevoPerfil)
      setSaved(true)
    }
    setSaving(false)
  }

  const perfilPreview = seleccion.length > 0
    ? PERFIL_LABELS[calcularPerfil(seleccion)] ?? calcularPerfil(seleccion)
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

      {/* Selector de enfoques */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-700">
          Elige hasta 2 enfoques terapéuticos adicionales:
        </p>
        {TERAPIAS.map(t => {
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
