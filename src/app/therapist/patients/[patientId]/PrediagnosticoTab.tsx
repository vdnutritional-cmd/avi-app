'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

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

interface PrediagData {
  // Leídos de Individual (solo contexto para el análisis — no se editan aquí)
  dimensiones:    string[]
  contexto:       string
  antecedentes:   string
  sintomatologia: string
  // Propios del Prediagnóstico
  prediag_fecha:       string
  prediag_impresion:   string
  prediag_diagnostico: string
  prediag_areas:       string
  prediag_tipo:        string
  prediag_detonadores: string
  prediag_guia:        string
  vias_accion:         string
}

const vacio = (): PrediagData => ({
  dimensiones:         [],
  contexto:            '',
  antecedentes:        '',
  sintomatologia:      '',
  prediag_fecha:       '',
  prediag_impresion:   '',
  prediag_diagnostico: '',
  prediag_areas:       '',
  prediag_tipo:        '',
  prediag_detonadores: '',
  prediag_guia:        '',
  vias_accion:         '',
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
  value, onChange, rows = 4, placeholder, maxWords,
}: {
  value: string
  onChange: (v: string) => void
  rows?: number
  placeholder?: string
  maxWords?: number
}) {
  const wordCount = value.trim() === '' ? 0 : value.trim().split(/\s+/).length
  const overLimit = maxWords !== undefined && wordCount > maxWords

  return (
    <div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder ?? 'El análisis aparecerá aquí…'}
        className={`w-full px-4 py-3 rounded-xl border text-sm text-gray-700
                   focus:outline-none focus:ring-2 focus:ring-primary-300 leading-relaxed resize-none
                   ${overLimit ? 'border-red-300 focus:ring-red-300' : 'border-gray-200'}`}
      />
      {maxWords !== undefined && (
        <p className={`text-xs mt-1 text-right ${overLimit ? 'text-red-500' : 'text-gray-400'}`}>
          {wordCount} / {maxWords} palabras
        </p>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────────────────
interface Props {
  patientId:   string
  therapistId: string
}

// ──────────────────────────────────────────────────────────
// Componente principal
// ──────────────────────────────────────────────────────────
export default function PrediagnosticoTab({ patientId, therapistId }: Props) {
  const [data, setData]   = useState<PrediagData>(vacio())
  const [saved, setSaved] = useState<PrediagData>(vacio())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saveOk, setSaveOk]   = useState(false)

  // Sesiones presenciales que el terapeuta quiere incluir (máx. primeras 3)
  const [sesiones, setSesiones] = useState({ s1: false, s2: false, s3: false })

  const [loadingPre,  setLoadingPre]  = useState(false)
  const [loadingVias, setLoadingVias] = useState(false)
  const [viasStream,  setViasStream]  = useState('')

  const [prediagOriginal, setPrediagOriginal] = useState<PrediagOriginal | null>(null)
  const [viasOriginal,    setViasOriginal]    = useState<string>('')

  const [unlockedPre,    setUnlockedPre]    = useState(false)
  const [unlockedVias,   setUnlockedVias]   = useState(false)
  const [confirmingPre,  setConfirmingPre]  = useState(false)
  const [confirmingVias, setConfirmingVias] = useState(false)

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
          prediag_fecha,
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
        const parsed: PrediagData = {
          dimensiones:         Array.isArray(row.individual_dimensiones) ? row.individual_dimensiones : [],
          contexto:            row.individual_contexto       ?? '',
          antecedentes:        row.individual_antecedentes   ?? '',
          sintomatologia:      row.individual_sintomatologia ?? '',
          prediag_fecha:       row.prediag_fecha             ?? '',
          prediag_impresion:   row.individual_prediag_impresion   ?? '',
          prediag_diagnostico: row.individual_prediag_diagnostico ?? '',
          prediag_areas:       row.individual_prediag_areas       ?? '',
          prediag_tipo:        row.individual_prediag_tipo        ?? '',
          prediag_detonadores: row.individual_prediag_detonadores ?? '',
          prediag_guia:        row.individual_prediag_guia        ?? '',
          vias_accion:         row.individual_vias_accion         ?? '',
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

  function set<K extends keyof PrediagData>(key: K, value: PrediagData[K]) {
    setData(prev => ({ ...prev, [key]: value }))
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
          sesiones_incluidas: [
            sesiones.s1 ? 1 : null,
            sesiones.s2 ? 2 : null,
            sesiones.s3 ? 3 : null,
          ].filter(Boolean),
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
          sesiones_incluidas: [
            sesiones.s1 ? 1 : null,
            sesiones.s2 ? 2 : null,
            sesiones.s3 ? 3 : null,
          ].filter(Boolean),
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
        prediag_fecha:                  data.prediag_fecha       || null,
        individual_prediag_impresion:   data.prediag_impresion   || null,
        individual_prediag_diagnostico: data.prediag_diagnostico || null,
        individual_prediag_areas:       data.prediag_areas       || null,
        individual_prediag_tipo:        data.prediag_tipo        || null,
        individual_prediag_detonadores: data.prediag_detonadores || null,
        individual_prediag_guia:        data.prediag_guia        || null,
        individual_vias_accion:         data.vias_accion         || null,
        ...(origPrediag  ? { individual_prediag_original: origPrediag }     : {}),
        ...(esNuevasVias ? { individual_vias_original:    data.vias_accion } : {}),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'therapist_id,patient_id' })

      if (error) { alert(`Error al guardar: ${error.message}`); return }

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

      {/* Banner de sección */}
      <div className="bg-primary-50 border border-primary-100 rounded-2xl px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-primary-800">Prediagnóstico y Plan de Sesiones</h3>
          <p className="text-xs text-primary-600 mt-0.5">
            Análisis clínico basado en la información registrada en los apartados previos del expediente.
          </p>
        </div>
        <div className="shrink-0">
          <label className="text-xs font-medium text-primary-700 block mb-1">Fecha del prediagnóstico</label>
          <input
            type="date"
            value={data.prediag_fecha}
            onChange={e => set('prediag_fecha', e.target.value)}
            className="border border-primary-200 bg-white rounded-lg px-3 py-1.5 text-sm text-gray-700
                       focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
        </div>
      </div>

      {/* ── Selector de sesiones presenciales ── */}
      <div className="bg-white rounded-2xl border border-gray-100 px-6 py-5">
        <p className="text-sm font-medium text-gray-700 mb-4">
          El presente Prediagnóstico tomará como base de análisis:
        </p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <span className="text-sm text-gray-500 font-medium">Nota inicial</span>
          <span className="text-gray-300 font-light">+</span>
          {([1, 2, 3] as const).map(n => {
            const key = `s${n}` as 's1' | 's2' | 's3'
            return (
              <label key={n} className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={sesiones[key]}
                  onChange={() => setSesiones(prev => ({ ...prev, [key]: !prev[key] }))}
                  className="w-4 h-4 rounded accent-primary-600 flex-shrink-0"
                />
                <span className="text-sm text-gray-600 group-hover:text-gray-800">
                  Sesión presencial {n}
                </span>
              </label>
            )
          })}
        </div>
      </div>

      {/* ── Apartado 1: Prediagnóstico ── */}
      <SectionCard num="1" title="Prediagnóstico">
        <p className="text-xs text-gray-400 mb-4">
          {(() => {
            const nums = ([sesiones.s1 ? 1 : null, sesiones.s2 ? 2 : null, sesiones.s3 ? 3 : null] as (number | null)[])
              .filter((n): n is number => n !== null)
            const fmt = nums.length === 0
              ? ''
              : nums.length === 1
                ? ` y en la Sesión presencial ${nums[0]}`
                : ` y en las Sesiones presenciales ${nums.slice(0, -1).join(', ')} y ${nums[nums.length - 1]}`
            return `Análisis AVI — basado en la Nota Inicial${fmt}. Puedes editar cada inciso directamente.`
          })()}
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
                value={data[item.key as keyof PrediagData] as string}
                onChange={v => set(item.key as keyof PrediagData, v)}
                rows={3}
                maxWords={150}
                placeholder={loadingPre ? 'Analizando…' : 'El análisis aparecerá aquí. También puedes escribir o editar directamente.'}
              />
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ── Apartado 2: Vías de Acción ── */}
      <SectionCard num="2" title="Plan de Intervención — Plan de 10 a 12 sesiones">
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

      {/* ── Botón guardar ── */}
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
