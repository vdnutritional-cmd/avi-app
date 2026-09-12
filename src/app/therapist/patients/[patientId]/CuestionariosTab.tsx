'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  FAD_DIMENSION_LABELS,
  FAD_DIMENSION_ORDER,
  type FADResult,
} from '@/lib/questionnaires/mcmaster-fad'

interface Props {
  patientId: string
  therapistId: string
}

interface Cuestionario {
  id: string
  title: string
  questionnaire_type: string
  status: string
  assigned_at: string
  completed_at: string | null
  score: FADResult | null
  interpretation: string | null
}

const TIPOS_DISPONIBLES = [
  { value: 'mcmaster_fad', label: 'FAD McMaster — Evaluación Familiar (60 ítems)' },
]

export default function CuestionariosTab({ patientId, therapistId }: Props) {
  const [cuestionarios, setCuestionarios] = useState<Cuestionario[]>([])
  const [loading, setLoading]             = useState(true)
  const [asignando, setAsignando]         = useState(false)
  const [tipoSeleccionado, setTipoSeleccionado] = useState('mcmaster_fad')
  const [expandido, setExpandido]         = useState<string | null>(null)

  async function fetchCuestionarios() {
    const supabase = createClient()
    const { data } = await supabase
      .from('patient_questionnaires')
      .select('id, title, questionnaire_type, status, assigned_at, completed_at, score, interpretation')
      .eq('patient_id', patientId)
      .eq('therapist_id', therapistId)
      .order('assigned_at', { ascending: false })

    setCuestionarios((data ?? []) as Cuestionario[])
    setLoading(false)
  }

  useEffect(() => { fetchCuestionarios() }, [patientId, therapistId])

  async function handleAsignar() {
    const tipo = TIPOS_DISPONIBLES.find(t => t.value === tipoSeleccionado)
    if (!tipo) return
    setAsignando(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('patient_questionnaires')
      .insert({
        patient_id:         patientId,
        therapist_id:       therapistId,
        questionnaire_type: tipo.value,
        title:              tipo.label.split(' — ')[0],
        status:             'pending',
      })
    if (error) alert('Error al asignar el cuestionario: ' + error.message)
    else await fetchCuestionarios()
    setAsignando(false)
  }

  if (loading) {
    return <div className="py-12 text-center text-gray-400 text-sm">Cargando cuestionarios…</div>
  }

  const pendientes  = cuestionarios.filter(c => c.status === 'pending')
  const completados = cuestionarios.filter(c => c.status === 'completed')

  return (
    <div className="space-y-6">

      {/* ── Asignar ── */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-2xl px-5 py-4">
        <p className="text-sm font-semibold text-indigo-800 mb-3">Asignar cuestionario al paciente</p>
        <div className="flex gap-3">
          <select
            value={tipoSeleccionado}
            onChange={e => setTipoSeleccionado(e.target.value)}
            className="flex-1 text-sm rounded-xl border border-indigo-300 bg-white px-3 py-2.5
                       focus:outline-none focus:ring-2 focus:ring-indigo-300 text-gray-700"
          >
            {TIPOS_DISPONIBLES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <button
            onClick={handleAsignar}
            disabled={asignando}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold
                       rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {asignando ? 'Asignando…' : '+ Asignar'}
          </button>
        </div>
        <p className="text-xs text-indigo-500 mt-2">
          El paciente verá el cuestionario pendiente en su pantalla principal de AVI.
        </p>
      </div>

      {/* ── Pendientes ── */}
      {pendientes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pendientes</p>
          {pendientes.map(c => (
            <div key={c.id}
              className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-800">{c.title}</p>
                <p className="text-xs text-amber-500 mt-0.5">
                  Asignado {new Date(c.assigned_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
              <span className="text-xs bg-amber-200 text-amber-800 px-2 py-1 rounded-lg font-medium">Pendiente</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Completados ── */}
      {completados.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Resultados</p>
          {completados.map(c => (
            <div key={c.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">

              {/* Acordeón header */}
              <button
                onClick={() => setExpandido(expandido === c.id ? null : c.id)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-800">{c.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Completado {new Date(c.completed_at!).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg font-medium">Completado</span>
                  <span className="text-gray-400 text-sm">{expandido === c.id ? '▲' : '▼'}</span>
                </div>
              </button>

              {/* Resultados expandidos */}
              {expandido === c.id && c.score && c.questionnaire_type === 'mcmaster_fad' && (
                <FADReporte score={c.score} />
              )}
            </div>
          ))}
        </div>
      )}

      {cuestionarios.length === 0 && (
        <p className="text-center text-sm text-gray-400 py-8">
          Aún no has asignado cuestionarios a este paciente.
        </p>
      )}
    </div>
  )
}

// ── Componente de reporte FAD ─────────────────────────────────────────────────
function FADReporte({ score }: { score: FADResult }) {
  const { dimensions, global } = score
  const esFuncional = global.evaluacion === 'FUNCIONAL'
  const valorMax    = Math.max(global.pctREF, global.pctRED)

  return (
    <div className="border-t border-gray-100 px-4 py-5 space-y-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        Evaluación de Funcionalidad Familiar — FAD McMaster
      </p>

      {/* Tabla de resultados */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <th className="text-left px-3 py-2 font-semibold rounded-tl-xl">Dimensión</th>
              <th className="text-center px-3 py-2 font-semibold">VD</th>
              <th className="text-center px-3 py-2 font-semibold text-green-700">% Funcional</th>
              <th className="text-center px-3 py-2 font-semibold text-red-600 rounded-tr-xl">% Disfuncional</th>
            </tr>
          </thead>
          <tbody>
            {FAD_DIMENSION_ORDER.map((dim, idx) => {
              const d = dimensions[dim]
              if (!d) return null
              const esDis = d.pctDD > d.pctFD
              return (
                <tr key={dim} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="px-3 py-2.5 text-gray-700 font-medium">{FAD_DIMENSION_LABELS[dim]}</td>
                  <td className="px-3 py-2.5 text-center text-gray-500">{d.VD}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`font-semibold ${esDis ? 'text-gray-500' : 'text-green-600'}`}>{d.pctFD}%</span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`font-semibold ${esDis ? 'text-red-600' : 'text-gray-400'}`}>{d.pctDD}%</span>
                  </td>
                </tr>
              )
            })}

            {/* Fila 7 — Resultado por Evaluación Funcional */}
            <tr className="bg-indigo-50 border-t-2 border-indigo-200">
              <td className="px-3 py-2.5 text-indigo-800 font-semibold text-xs" colSpan={2}>
                Resultado por Evaluación Funcional
              </td>
              <td className="px-3 py-2.5 text-center font-bold text-green-700">{global.pctREF}%</td>
              <td className="px-3 py-2.5 text-center font-bold text-red-600">{global.pctRED}%</td>
            </tr>

            {/* Fila 8 — Evaluación final */}
            <tr className={`border-t-2 ${esFuncional ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <td className="px-3 py-3 text-xs font-semibold text-gray-600" colSpan={2}>
                Evaluación de la Funcionalidad Familiar
              </td>
              <td className="px-3 py-3 text-center font-bold text-lg" colSpan={2}>
                <span className={esFuncional ? 'text-green-700' : 'text-red-700'}>
                  {valorMax}% — {global.evaluacion}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Barras visuales por dimensión */}
      <div className="space-y-2 pt-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Funcionalidad por dimensión</p>
        {FAD_DIMENSION_ORDER.map(dim => {
          const d = dimensions[dim]
          if (!d) return null
          const esDis = d.pctDD > d.pctFD
          return (
            <div key={dim} className="space-y-0.5">
              <div className="flex justify-between text-xs text-gray-500">
                <span>{FAD_DIMENSION_LABELS[dim]}</span>
                <span className={esDis ? 'text-red-500 font-medium' : 'text-green-600 font-medium'}>
                  {esDis ? `${d.pctDD}% disfuncional` : `${d.pctFD}% funcional`}
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${esDis ? 'bg-red-400' : 'bg-green-400'}`}
                  style={{ width: `${d.pctFD}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
