'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DIMENSIONES } from './print-utils'

// ──────────────────────────────────────────────────────────
// Constantes
// ──────────────────────────────────────────────────────────
const CONTEXTOS = ['Laboral', 'Escolar', 'Familiar', 'Reaccional o social', 'Recreativo']

// ──────────────────────────────────────────────────────────
// Tipos
// ──────────────────────────────────────────────────────────
interface IndividualData {
  dimensiones:    string[]
  contexto:       string
  antecedentes:   string
  sintomatologia: string
}

const vacio = (): IndividualData => ({
  dimensiones:    [],
  contexto:       '',
  antecedentes:   '',
  sintomatologia: '',
})

// ──────────────────────────────────────────────────────────
// Sub-componentes UI
// ──────────────────────────────────────────────────────────
function SectionCard({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="flex items-baseline gap-2 border-b border-gray-100 pb-3 mb-5">
        <span className="text-xs font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">{num}</span>
        <h4 className="text-sm font-semibold text-gray-700">{title}</h4>
      </div>
      {children}
    </div>
  )
}

function AnalysisButton({
  onClick, loading, hasResult, label = 'Ejecutar análisis',
}: {
  onClick: () => void
  loading: boolean
  hasResult: boolean
  label?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-colors
                 bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading
        ? <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Analizando...</>
        : hasResult
          ? '↺ Volver a analizar'
          : label
      }
    </button>
  )
}

function ResultTextarea({
  value, onChange, rows = 4, placeholder,
}: {
  value: string
  onChange: (v: string) => void
  rows?: number
  placeholder?: string
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder ?? 'El análisis aparecerá aquí…'}
      className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-700
                 focus:outline-none focus:ring-2 focus:ring-primary-300 leading-relaxed resize-none"
    />
  )
}

// ──────────────────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────────────────
interface Props {
  patientId: string
  therapistId: string
  patientName: string | null
}

// ──────────────────────────────────────────────────────────
// Componente principal
// ──────────────────────────────────────────────────────────
export default function IndividualTab({ patientId, therapistId, patientName: _patientName }: Props) {
  const [data, setData] = useState<IndividualData>(vacio())
  const [saved, setSaved] = useState<IndividualData>(vacio())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveOk, setSaveOk] = useState(false)

  // Estados de análisis
  const [loadingAnt,  setLoadingAnt]  = useState(false)
  const [loadingSint, setLoadingSint] = useState(false)

  useEffect(() => { load() }, [patientId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: row } = await supabase
        .from('patient_expediente')
        .select(`
          individual_dimensiones, individual_contexto,
          individual_antecedentes, individual_sintomatologia
        `)
        .eq('therapist_id', therapistId)
        .eq('patient_id', patientId)
        .maybeSingle()

      if (row) {
        const parsed: IndividualData = {
          dimensiones:    Array.isArray(row.individual_dimensiones) ? row.individual_dimensiones : [],
          contexto:       row.individual_contexto       ?? '',
          antecedentes:   row.individual_antecedentes   ?? '',
          sintomatologia: row.individual_sintomatologia ?? '',
        }
        setData(parsed)
        setSaved(parsed)
      }
    } finally {
      setLoading(false)
    }
  }

  function set<K extends keyof IndividualData>(key: K, value: IndividualData[K]) {
    setData(prev => ({ ...prev, [key]: value }))
  }

  function toggleDimension(id: string) {
    setData(prev => {
      const dims = prev.dimensiones.includes(id)
        ? prev.dimensiones.filter(d => d !== id)
        : [...prev.dimensiones, id]
      return { ...prev, dimensiones: dims }
    })
  }

  // ── Helper de fetch para análisis cortos ─────────────────
  async function fetchAnalysis(tipo: string, extra?: Record<string, unknown>): Promise<string | null> {
    const res = await fetch('/api/expediente-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: tipo, patientId, ...extra }),
    })
    let json: Record<string, unknown> = {}
    try { json = await res.json() } catch { throw new Error('Respuesta del servidor no válida') }

    if (!res.ok || json.error) {
      throw new Error((json.error as string) ?? `Error ${res.status}`)
    }
    if (typeof json.result === 'string' && json.result.trim().length > 0) {
      return json.result.trim()
    }
    throw new Error('El análisis no devolvió contenido. Verifica que la Nota Inicial esté completa.')
  }

  // ── Análisis: Antecedentes ────────────────────────────────
  async function analizar_antecedentes() {
    setLoadingAnt(true)
    try {
      const text = await fetchAnalysis('antecedentes')
      if (text) {
        set('antecedentes', text)
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al analizar antecedentes')
    } finally {
      setLoadingAnt(false)
    }
  }

  // ── Análisis: Sintomatología ──────────────────────────────
  async function analizar_sintomatologia() {
    setLoadingSint(true)
    try {
      const text = await fetchAnalysis('sintomatologia')
      if (text) {
        set('sintomatologia', text)
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al analizar sintomatología')
    } finally {
      setLoadingSint(false)
    }
  }

  async function save() {
    setSaving(true)
    try {
      const supabase = createClient()

      const { error } = await supabase.from('patient_expediente').upsert({
        therapist_id:              therapistId,
        patient_id:                patientId,
        individual_dimensiones:    data.dimensiones,
        individual_contexto:       data.contexto       || null,
        individual_antecedentes:   data.antecedentes   || null,
        individual_sintomatologia: data.sintomatologia || null,
        updated_at:                new Date().toISOString(),
      }, { onConflict: 'therapist_id,patient_id' })

      if (error) { alert(`Error al guardar: ${error.message}`); return }

      setSaved({ ...data })
      setSaveOk(true)
      setTimeout(() => setSaveOk(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  const changed = JSON.stringify(data) !== JSON.stringify(saved)

  if (loading) {
    return <div className="flex justify-center py-16 text-gray-400 text-sm">Cargando…</div>
  }

  return (
    <div className="space-y-5">

      {/* ── Apartado 1: Dimensiones evolutivas ── */}
      <SectionCard num="1" title="Dimensiones evolutivas (áreas de desarrollo)">
        <p className="text-xs text-gray-400 mb-4">
          Selecciona todas las dimensiones que aplican al caso.
        </p>
        <div className="space-y-3">
          {DIMENSIONES.map(d => {
            const active = data.dimensiones.includes(d.id)
            return (
              <label key={d.id} className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => toggleDimension(d.id)}
                  className="mt-0.5 w-4 h-4 rounded accent-primary-600 flex-shrink-0"
                />
                <div>
                  <span className={`text-sm font-medium transition-colors ${active ? 'text-primary-700' : 'text-gray-700 group-hover:text-primary-700'}`}>
                    {d.label}
                  </span>
                  <p className={`text-xs mt-0.5 transition-colors ${active ? 'text-gray-800' : 'text-gray-400 group-hover:text-gray-800'}`}>
                    {d.desc}
                  </p>
                </div>
              </label>
            )
          })}
        </div>
      </SectionCard>

      {/* ── Apartado 2: Contexto ── */}
      <SectionCard num="2" title="Contexto">
        <select
          value={data.contexto}
          onChange={e => set('contexto', e.target.value)}
          className="w-full max-w-xs px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700
                     focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
        >
          <option value="">Selecciona el contexto…</option>
          {CONTEXTOS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </SectionCard>

      {/* ── Apartado 3: Antecedentes ── */}
      <SectionCard num="3" title="Antecedentes de relevancia">
        <p className="text-xs text-gray-400 mb-3">
          Análisis AVI — Dos bloques: (1) Antecedentes de relevancia — historia familiar, eventos y contexto de vida (máx. 200 palabras);
          (2) Contexto del motivo de consulta — síntesis del motivo, motivo subyacente y premisas clínicas (máx. 200 palabras).
          Puedes editar el resultado directamente.
        </p>
        <div className="space-y-3">
          <AnalysisButton
            onClick={analizar_antecedentes}
            loading={loadingAnt}
            hasResult={!!data.antecedentes}
          />
          <ResultTextarea
            value={data.antecedentes}
            onChange={v => set('antecedentes', v)}
            rows={10}
            placeholder={loadingAnt ? 'Analizando…' : 'El análisis aparecerá aquí en dos bloques. También puedes escribir o editar directamente.'}
          />
        </div>
      </SectionCard>

      {/* ── Apartado 4: Sintomatología ── */}
      <SectionCard num="4" title="Sintomatología observada">
        <p className="text-xs text-gray-400 mb-3">
          Análisis AVI — Sintomatología que presenta el paciente (máx. 100 palabras), basado en la Nota Inicial.
          Puedes editar el resultado directamente.
        </p>
        <div className="space-y-3">
          <AnalysisButton
            onClick={analizar_sintomatologia}
            loading={loadingSint}
            hasResult={!!data.sintomatologia}
          />
          <ResultTextarea
            value={data.sintomatologia}
            onChange={v => set('sintomatologia', v)}
            rows={5}
            placeholder={loadingAnt ? 'Analizando…' : 'El análisis aparecerá aquí. También puedes escribir o editar directamente.'}
          />
        </div>
      </SectionCard>

      {/* ── Botones inferiores ── */}
      <div className="flex items-center justify-between pt-1 pb-4">
        <p className="text-xs text-gray-400">
          Para imprimir, visita la sección <strong className="text-gray-500">Impresiones</strong>.
        </p>
        <button
          onClick={save}
          disabled={saving || !changed}
          className="px-6 py-3 bg-primary-600 text-white rounded-xl text-sm font-semibold
                     hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? 'Guardando…' : saveOk ? '✓ Guardado' : 'Guardar'}
        </button>
      </div>

    </div>
  )
}
