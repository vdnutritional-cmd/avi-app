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
interface PrediagOriginal {
  impresion:   string
  diagnostico: string
  areas:       string
  tipo:        string
  detonadores: string
  guia:        string
}

interface IndividualData {
  dimensiones: string[]
  contexto: string
  antecedentes: string
  sintomatologia: string
  prediag_impresion: string
  prediag_diagnostico: string
  prediag_areas: string
  prediag_tipo: string
  prediag_detonadores: string
  prediag_guia: string
  vias_accion: string
}

const vacio = (): IndividualData => ({
  dimensiones: [],
  contexto: '',
  antecedentes: '',
  sintomatologia: '',
  prediag_impresion: '',
  prediag_diagnostico: '',
  prediag_areas: '',
  prediag_tipo: '',
  prediag_detonadores: '',
  prediag_guia: '',
  vias_accion: '',
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

  // Estados de análisis individuales
  const [loadingAnt, setLoadingAnt]   = useState(false)
  const [loadingSint, setLoadingSint] = useState(false)
  const [loadingPre, setLoadingPre]   = useState(false)
  const [loadingVias, setLoadingVias] = useState(false)
  const [viasStream, setViasStream]   = useState('')

  // Versiones originales (IA, primera generación — nunca se sobreescriben)
  const [prediagOriginal, setPrediagOriginal] = useState<PrediagOriginal | null>(null)
  const [viasOriginal,    setViasOriginal]    = useState<string>('')

  // Control de bloqueo para análisis de alto costo / integridad clínica
  const [unlockedPre,   setUnlockedPre]   = useState(false)
  const [unlockedVias,  setUnlockedVias]  = useState(false)
  const [confirmingPre, setConfirmingPre] = useState(false)
  const [confirmingVias, setConfirmingVias] = useState(false)

  // Bloqueado si ya hay algo guardado en DB y no fue desbloqueado explícitamente
  const preLocked  = !!(saved.prediag_impresion || saved.prediag_diagnostico) && !unlockedPre
  const viasLocked = !!saved.vias_accion && !unlockedVias

  useEffect(() => { load() }, [patientId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: row } = await supabase
        .from('patient_expediente')
        .select(`
          individual_dimensiones, individual_contexto,
          individual_antecedentes, individual_sintomatologia,
          individual_prediag_impresion, individual_prediag_diagnostico,
          individual_prediag_areas, individual_prediag_tipo,
          individual_prediag_detonadores, individual_prediag_guia,
          individual_vias_accion,
          individual_prediag_original, individual_vias_original
        `)
        .eq('therapist_id', therapistId)
        .eq('patient_id', patientId)
        .maybeSingle()

      if (row) {
        const parsed: IndividualData = {
          dimensiones:       Array.isArray(row.individual_dimensiones) ? row.individual_dimensiones : [],
          contexto:          row.individual_contexto ?? '',
          antecedentes:      row.individual_antecedentes ?? '',
          sintomatologia:    row.individual_sintomatologia ?? '',
          prediag_impresion: row.individual_prediag_impresion ?? '',
          prediag_diagnostico: row.individual_prediag_diagnostico ?? '',
          prediag_areas:     row.individual_prediag_areas ?? '',
          prediag_tipo:      row.individual_prediag_tipo ?? '',
          prediag_detonadores: row.individual_prediag_detonadores ?? '',
          prediag_guia:      row.individual_prediag_guia ?? '',
          vias_accion:       row.individual_vias_accion ?? '',
        }
        setData(parsed)
        setSaved(parsed)
        if (row.individual_prediag_original) {
          setPrediagOriginal(row.individual_prediag_original as PrediagOriginal)
        }
        setViasOriginal(row.individual_vias_original ?? '')
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

  // ── Análisis: Prediagnóstico ──────────────────────────────
  async function analizar_prediagnostico() {
    setLoadingPre(true)
    try {
      const res = await fetch('/api/expediente-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'prediagnostico',
          patientId,
          dimensiones: data.dimensiones,
          contexto: data.contexto,
          antecedentes: data.antecedentes,
          sintomatologia: data.sintomatologia,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        alert(json.error ?? `Error ${res.status} al analizar prediagnóstico`)
        return
      }
      if (json.result && typeof json.result === 'object') {
        const r = json.result
        setData(prev => ({
          ...prev,
          prediag_impresion:   String(r.impresion        ?? prev.prediag_impresion),
          prediag_diagnostico: String(r.diagnostico      ?? prev.prediag_diagnostico),
          prediag_areas:       String(r.areas_conflicto  ?? prev.prediag_areas),
          prediag_tipo:        String(r.tipo_problema     ?? prev.prediag_tipo),
          prediag_detonadores: String(r.detonadores       ?? prev.prediag_detonadores),
          prediag_guia:        String(r.guia_accion       ?? prev.prediag_guia),
        }))
        setUnlockedPre(false)
      } else {
        alert('La respuesta no tuvo el formato esperado. Intenta de nuevo.')
      }
    } catch { alert('Error de red al analizar prediagnóstico') }
    finally { setLoadingPre(false) }
  }

  // ── Análisis: Vías de Acción (streaming) ─────────────────
  async function analizar_vias_accion() {
    setLoadingVias(true)
    setViasStream('')
    let fullText = ''

    try {
      const res = await fetch('/api/expediente-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'vias-accion',
          patientId,
          dimensiones: data.dimensiones,
          contexto: data.contexto,
          antecedentes: data.antecedentes,
          sintomatologia: data.sintomatologia,
          prediagnostico: {
            impresion:       data.prediag_impresion,
            diagnostico:     data.prediag_diagnostico,
            areas_conflicto: data.prediag_areas,
            tipo_problema:   data.prediag_tipo,
            detonadores:     data.prediag_detonadores,
            guia_accion:     data.prediag_guia,
          },
        }),
      })

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const d = JSON.parse(line.slice(6))
            if (d.error) throw new Error(d.error)
            if (d.text) { fullText += d.text; setViasStream(fullText) }
            if (d.done) {
              set('vias_accion', fullText)
              setUnlockedVias(false)
            }
          } catch (e) {
            if (e instanceof Error) alert(e.message)
          }
        }
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al analizar vías de acción')
    } finally {
      setLoadingVias(false)
    }
  }

  async function save() {
    setSaving(true)
    try {
      const supabase = createClient()

      // Versión original: se fija en el PRIMER guardado del terapeuta (no antes).
      // El terapeuta revisa y edita el análisis de la IA, y al guardar por primera vez
      // esa versión queda sellada como referencia permanente.
      const esNuevoPrediag = !prediagOriginal && !!(data.prediag_impresion || data.prediag_diagnostico)
      const esNuevasVias   = !viasOriginal    && !!data.vias_accion

      const origPrediag: PrediagOriginal | null = esNuevoPrediag ? {
        impresion:   data.prediag_impresion,
        diagnostico: data.prediag_diagnostico,
        areas:       data.prediag_areas,
        tipo:        data.prediag_tipo,
        detonadores: data.prediag_detonadores,
        guia:        data.prediag_guia,
      } : null

      const { error } = await supabase.from('patient_expediente').upsert({
        therapist_id: therapistId,
        patient_id:   patientId,
        individual_dimensiones:       data.dimensiones,
        individual_contexto:          data.contexto          || null,
        individual_antecedentes:      data.antecedentes      || null,
        individual_sintomatologia:    data.sintomatologia    || null,
        individual_prediag_impresion:   data.prediag_impresion   || null,
        individual_prediag_diagnostico: data.prediag_diagnostico || null,
        individual_prediag_areas:       data.prediag_areas       || null,
        individual_prediag_tipo:        data.prediag_tipo        || null,
        individual_prediag_detonadores: data.prediag_detonadores || null,
        individual_prediag_guia:        data.prediag_guia        || null,
        individual_vias_accion:         data.vias_accion         || null,
        // Originales: solo se escriben si aún no existían (primer guardado)
        ...(origPrediag   ? { individual_prediag_original: origPrediag }     : {}),
        ...(esNuevasVias  ? { individual_vias_original:    data.vias_accion } : {}),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'therapist_id,patient_id' })

      if (error) { alert(`Error al guardar: ${error.message}`); return }

      // Actualizar estado local de originales
      if (origPrediag)  setPrediagOriginal(origPrediag)
      if (esNuevasVias) setViasOriginal(data.vias_accion)

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

      {/* ── Apartado 5: Prediagnóstico ── */}
      <SectionCard num="5" title="Prediagnóstico">
        <p className="text-xs text-gray-400 mb-4">
          Análisis AVI — basado en la Nota Inicial y en la información de los apartados anteriores. Máx. 75 palabras por inciso.
          Puedes editar cada inciso directamente.
        </p>
        <div className="mb-5">
          {preLocked ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                🔒 Prediagnóstico registrado — edita el texto directamente si necesitas ajustes
              </span>
              {!confirmingPre ? (
                <button
                  onClick={() => setConfirmingPre(true)}
                  className="text-xs text-gray-400 hover:text-gray-500 underline underline-offset-2"
                >
                  Desbloquear para regenerar
                </button>
              ) : (
                <span className="flex items-center gap-2 text-xs">
                  <span className="text-amber-700 font-medium">¿Confirmas? Esto sobrescribirá el análisis guardado.</span>
                  <button
                    onClick={() => { setUnlockedPre(true); setConfirmingPre(false) }}
                    className="text-red-600 hover:text-red-700 font-semibold"
                  >Sí, regenerar</button>
                  <button
                    onClick={() => setConfirmingPre(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >Cancelar</button>
                </span>
              )}
            </div>
          ) : (
            <AnalysisButton
              onClick={analizar_prediagnostico}
              loading={loadingPre}
              hasResult={!!(data.prediag_impresion || data.prediag_diagnostico || data.prediag_areas)}
            />
          )}
        </div>
        <div className="space-y-4">
          {[
            { key: 'prediag_impresion',   label: 'Impresión del sujeto de evaluación' },
            { key: 'prediag_diagnostico', label: 'Diagnóstico presuntivo' },
            { key: 'prediag_areas',       label: 'Áreas de conflicto (áreas afectadas)' },
            { key: 'prediag_tipo',        label: 'Tipo de problema (individual, familiar, de pareja, parental)' },
            { key: 'prediag_detonadores', label: 'Detonadores' },
            { key: 'prediag_guia',        label: 'Guía de acción o trabajo' },
          ].map(item => (
            <div key={item.key}>
              <label className="text-xs font-medium text-gray-500 block mb-1">{item.label}</label>
              <ResultTextarea
                value={data[item.key as keyof IndividualData] as string}
                onChange={v => set(item.key as keyof IndividualData, v)}
                rows={3}
                placeholder={loadingPre ? 'Analizando…' : 'El análisis aparecerá aquí. También puedes escribir o editar directamente.'}
              />
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ── Apartado 6: Vías de Acción ── */}
      <SectionCard num="6" title="Vías de acción — Plan de 10 sesiones">
        <p className="text-xs text-gray-400 mb-4">
          Análisis AVI con RAG ConsultoriaFuentes — elabora un plan clínico de 10 sesiones basado en toda la información del caso.
        </p>
        <div className="space-y-3">
          {viasLocked ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                🔒 Plan de sesiones registrado — edita el texto directamente si necesitas ajustes
              </span>
              {!confirmingVias ? (
                <button
                  onClick={() => setConfirmingVias(true)}
                  className="text-xs text-gray-400 hover:text-gray-500 underline underline-offset-2"
                >
                  Desbloquear para regenerar
                </button>
              ) : (
                <span className="flex items-center gap-2 text-xs">
                  <span className="text-amber-700 font-medium">¿Confirmas? Esto sobrescribirá el plan guardado.</span>
                  <button
                    onClick={() => { setUnlockedVias(true); setConfirmingVias(false) }}
                    className="text-red-600 hover:text-red-700 font-semibold"
                  >Sí, regenerar</button>
                  <button
                    onClick={() => setConfirmingVias(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >Cancelar</button>
                </span>
              )}
            </div>
          ) : (
            <AnalysisButton
              onClick={analizar_vias_accion}
              loading={loadingVias}
              hasResult={!!data.vias_accion}
              label="Ejecutar análisis"
            />
          )}

          {/* Stream en progreso */}
          {loadingVias && viasStream && (
            <div className="bg-primary-50 border border-primary-100 rounded-xl p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap
                            max-h-96 overflow-y-auto"
              dangerouslySetInnerHTML={{ __html: viasStream.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
            />
          )}

          {/* Resultado editable */}
          {!loadingVias && data.vias_accion && (
            <textarea
              value={data.vias_accion}
              onChange={e => set('vias_accion', e.target.value)}
              rows={22}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-700
                         focus:outline-none focus:ring-2 focus:ring-primary-300 leading-relaxed resize-none"
            />
          )}
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
