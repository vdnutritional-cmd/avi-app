'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  imprimirHistoriaClinicaV2,
  imprimirNotaInicial,
  imprimirBitacoraSesiones,
  imprimirReporteValorativo,
  imprimirReporteProceso,
  imprimirIntegracionPlan,
  type HistoriaClinicaV2,
  type NotaInicialPrint,
  type SessionPresencialPrint,
} from './print-utils'

// ──────────────────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────────────────
interface Props {
  patientId:   string
  therapistId: string
  patientName: string | null
}

// ──────────────────────────────────────────────────────────
// Secciones HC
// ──────────────────────────────────────────────────────────
const HC_SECTIONS: { key: keyof HistoriaClinicaV2; label: string; rows: number }[] = [
  { key: 'motivos_consulta',         label: 'I. Motivos de Consulta',                             rows: 5  },
  { key: 'motivos_subyacente',       label: 'II. Motivo de Consulta Subyacente',                  rows: 5  },
  { key: 'premisas',                 label: 'III. Premisas ante el Motivo de Consulta (NOM-004)', rows: 6  },
  { key: 'generalidades',            label: 'IV. Generalidades del Caso',                          rows: 5  },
  { key: 'contexto',                 label: 'V. Contexto',                                         rows: 6  },
  { key: 'antecedentes',             label: 'VI. Antecedentes de Relevancia',                      rows: 5  },
  { key: 'referentes_estructurales', label: 'VII. Referentes Estructurales',                       rows: 8  },
  { key: 'dinamica_relacional',      label: 'VIII. Dinámica Relacional',                           rows: 6  },
  { key: 'sintomatologia',           label: 'IX. Sintomatología Observada',                        rows: 8  },
  { key: 'plan_intervencion',        label: 'X. Plan de Intervención — Plan de 10 a 12 sesiones', rows: 14 },
]

// ──────────────────────────────────────────────────────────
// Tarjeta del índice
// ──────────────────────────────────────────────────────────
type CardColor = 'amber' | 'purple' | 'blue' | 'green' | 'gray'

function IndexCard({
  icon, title, desc, color, status, onPrint, onGenerate, onEdit,
  loading, generating, disabled, unavailableMsg,
}: {
  icon: string
  title: string
  desc: string
  color: CardColor
  status: 'ready' | 'pending' | 'unavailable' | 'locked'
  onPrint?:    () => void
  onGenerate?: () => void
  onEdit?:     () => void
  loading?:    boolean
  generating?: boolean
  disabled?:   boolean
  unavailableMsg?: string
}) {
  const border: Record<CardColor, string> = {
    amber:  'border-amber-100  hover:border-amber-200',
    purple: 'border-purple-100 hover:border-purple-200',
    blue:   'border-blue-100   hover:border-blue-200',
    green:  'border-emerald-100 hover:border-emerald-200',
    gray:   'border-gray-100   hover:border-gray-200',
  }
  const btnFill: Record<CardColor, string> = {
    amber:  'bg-amber-500  hover:bg-amber-600  text-white',
    purple: 'bg-purple-500 hover:bg-purple-600 text-white',
    blue:   'bg-blue-500   hover:bg-blue-600   text-white',
    green:  'bg-emerald-500 hover:bg-emerald-600 text-white',
    gray:   'bg-gray-600   hover:bg-gray-700   text-white',
  }
  const btnOut: Record<CardColor, string> = {
    amber:  'border-amber-300  text-amber-700  hover:bg-amber-50',
    purple: 'border-purple-300 text-purple-700 hover:bg-purple-50',
    blue:   'border-blue-300   text-blue-700   hover:bg-blue-50',
    green:  'border-emerald-300 text-emerald-700 hover:bg-emerald-50',
    gray:   'border-gray-300   text-gray-700   hover:bg-gray-50',
  }
  const statusMap = {
    ready:       <span className="flex items-center gap-1 text-xs text-emerald-600"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"/>Disponible</span>,
    pending:     <span className="flex items-center gap-1 text-xs text-amber-600"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block"/>Sin generar</span>,
    unavailable: <span className="flex items-center gap-1 text-xs text-gray-400"><span className="w-1.5 h-1.5 rounded-full bg-gray-300 inline-block"/>No disponible</span>,
    locked:      <span className="flex items-center gap-1 text-xs text-purple-600"><span className="text-purple-400">🔒</span>Guardada</span>,
  }

  return (
    <div className={`bg-white rounded-2xl border p-4 flex flex-col gap-3 transition-colors ${border[color]}`}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none mt-0.5">{icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800 leading-tight">{title}</p>
          <p className="text-xs text-gray-400 mt-0.5 leading-snug">{desc}</p>
        </div>
      </div>

      {/* Status + actions */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-50">
        <div>{statusMap[status]}</div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Edit link (HC Actualizada) */}
          {onEdit && status === 'ready' && (
            <button
              onClick={onEdit}
              disabled={disabled}
              className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 disabled:opacity-40"
            >
              Editar
            </button>
          )}

          {/* Generate button */}
          {onGenerate && status === 'pending' && (
            <button
              onClick={onGenerate}
              disabled={disabled || generating}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors
                          disabled:opacity-40 disabled:cursor-not-allowed ${btnOut[color]}`}
            >
              {generating
                ? <><span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"/>Generando…</>
                : '✦ Generar'}
            </button>
          )}

          {/* Print button */}
          {onPrint && (status === 'ready' || status === 'locked') && (
            <button
              onClick={onPrint}
              disabled={disabled || loading}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
                          disabled:opacity-40 disabled:cursor-not-allowed ${btnFill[color]}`}
            >
              {loading
                ? <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"/>Imprimiendo…</>
                : '🖨 Imprimir'}
            </button>
          )}

          {/* Regenerate for act (when ready) */}
          {onGenerate && status === 'ready' && (
            <button
              onClick={onGenerate}
              disabled={disabled || generating}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors
                          disabled:opacity-40 disabled:cursor-not-allowed ${btnOut[color]}`}
            >
              {generating ? <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"/> : '↺'}
            </button>
          )}
        </div>
      </div>

      {/* Mensaje cuando no está disponible */}
      {status === 'unavailable' && unavailableMsg && (
        <p className="text-xs text-gray-400 italic -mt-1">{unavailableMsg}</p>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// Componente principal
// ──────────────────────────────────────────────────────────
export default function ImpresionesTab({ patientId, therapistId, patientName }: Props) {
  const [loadingData, setLoadingData] = useState(true)
  const [printing,    setPrinting]    = useState<string | null>(null)

  // HC Original
  const [hcOriginalSaved,   setHcOriginalSaved]   = useState<HistoriaClinicaV2 | null>(null)
  const [hcOriginalPreview, setHcOriginalPreview] = useState<HistoriaClinicaV2 | null>(null)
  const [hcOrigEdits,       setHcOrigEdits]       = useState<Partial<HistoriaClinicaV2>>({})
  const [generatingOrig,    setGeneratingOrig]    = useState(false)
  const [confirmingOrig,    setConfirmingOrig]    = useState(false)
  const [errorOrig,         setErrorOrig]         = useState<string | null>(null)

  // HC Actualizada
  const [hcActData,     setHcActData]    = useState<HistoriaClinicaV2 | null>(null)
  const [hcActEdits,    setHcActEdits]   = useState<Partial<HistoriaClinicaV2>>({})
  const [generatingAct, setGeneratingAct] = useState(false)
  const [errorAct,      setErrorAct]     = useState<string | null>(null)
  const [showActEditor, setShowActEditor] = useState(false)

  // Otros datos
  const [notaInicial, setNotaInicial] = useState<NotaInicialPrint | null>(null)
  const [sesiones,    setSesiones]    = useState<SessionPresencialPrint[]>([])

  useEffect(() => { loadData() }, [patientId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    setLoadingData(true)
    try {
      const supabase = createClient()
      const [expedienteRes, notaRes, sesionesRes] = await Promise.all([
        supabase.from('patient_expediente')
          .select('hc_original, hc_actualizada')
          .eq('therapist_id', therapistId).eq('patient_id', patientId).maybeSingle(),
        supabase.from('therapist_patients')
          .select('initial_note, initial_note_date, initial_note_motivo, initial_note_subyacente, initial_note_premisas, initial_note_pro_bono, initial_note_virtual')
          .eq('therapist_id', therapistId).eq('patient_id', patientId).single(),
        supabase.from('therapist_session_notes')
          .select('session_number, session_date, session_objetivo, session_desarrollo, notes, is_pro_bono, is_virtual')
          .eq('therapist_id', therapistId).eq('patient_id', patientId)
          .order('session_number', { ascending: true }),
      ])
      if (expedienteRes.data?.hc_original)    setHcOriginalSaved(expedienteRes.data.hc_original as HistoriaClinicaV2)
      if (expedienteRes.data?.hc_actualizada) { setHcActData(expedienteRes.data.hc_actualizada as HistoriaClinicaV2); setHcActEdits({}) }
      if (notaRes.data) {
        setNotaInicial({
          initial_note:            notaRes.data.initial_note            ?? '',
          initial_note_date:       notaRes.data.initial_note_date       ?? null,
          initial_note_motivo:     notaRes.data.initial_note_motivo     ?? '',
          initial_note_subyacente: notaRes.data.initial_note_subyacente ?? '',
          initial_note_premisas:   notaRes.data.initial_note_premisas   ?? '',
          initial_note_pro_bono:   notaRes.data.initial_note_pro_bono   ?? false,
          initial_note_virtual:    notaRes.data.initial_note_virtual    ?? false,
        })
      }
      setSesiones((sesionesRes.data ?? []).map(s => ({
        session_number:     s.session_number,
        session_date:       s.session_date,
        session_objetivo:   s.session_objetivo   ?? null,
        session_desarrollo: s.session_desarrollo ?? null,
        notes:              s.notes              ?? null,
        is_pro_bono:        s.is_pro_bono        ?? false,
        is_virtual:         s.is_virtual         ?? false,
      })))
    } finally { setLoadingData(false) }
  }

  // ── Generar HC ───────────────────────────────────────────
  async function generateHC(type: 'original' | 'actualizada') {
    if (type === 'original') { setGeneratingOrig(true); setErrorOrig(null); setHcOriginalPreview(null) }
    else                     { setGeneratingAct(true);  setErrorAct(null);  setShowActEditor(true) }
    try {
      const res  = await fetch('/api/historia-clinica', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, type }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        if (type === 'original') setErrorOrig(json.error ?? 'Error al generar')
        else                     setErrorAct(json.error  ?? 'Error al generar')
        return
      }
      if (type === 'original') { setHcOriginalPreview(json.sections as HistoriaClinicaV2); setHcOrigEdits({}) }
      else                     { setHcActData(json.sections as HistoriaClinicaV2);          setHcActEdits({}) }
    } catch {
      if (type === 'original') setErrorOrig('Error de conexión.')
      else                     setErrorAct('Error de conexión.')
    } finally {
      if (type === 'original') setGeneratingOrig(false)
      else                     setGeneratingAct(false)
    }
  }

  // ── Confirmar HC Original ────────────────────────────────
  async function confirmarOriginal() {
    if (!hcOriginalPreview) return
    setConfirmingOrig(true)
    const finalSections = { ...hcOriginalPreview, ...hcOrigEdits }
    try {
      const res  = await fetch('/api/historia-clinica', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, type: 'original', sections: finalSections }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setErrorOrig(json.error ?? 'Error al guardar'); return }
      setHcOriginalSaved(finalSections as HistoriaClinicaV2)
      setHcOriginalPreview(null); setHcOrigEdits({})
    } catch { setErrorOrig('Error de conexión.') }
    finally  { setConfirmingOrig(false) }
  }

  // ── Imprimir HC Actualizada ──────────────────────────────
  async function imprimirActualizada() {
    const data = mergedAct()
    if (!data) return
    setPrinting('act')
    try {
      await fetch('/api/historia-clinica', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, type: 'actualizada', sections: data }),
      })
      await imprimirHistoriaClinicaV2(patientId, therapistId, patientName, data, false)
    } finally { setPrinting(null) }
  }

  function mergedAct(): HistoriaClinicaV2 | null {
    if (!hcActData) return null
    return { ...hcActData, ...hcActEdits }
  }

  // ── Imprimir HC Original ─────────────────────────────────
  async function imprimirOriginal() {
    if (!hcOriginalSaved) return
    setPrinting('orig')
    try { await imprimirHistoriaClinicaV2(patientId, therapistId, patientName, hcOriginalSaved, true) }
    finally { setPrinting(null) }
  }

  // ── Nota Inicial ─────────────────────────────────────────
  async function printNotaInicial() {
    if (!notaInicial) return
    setPrinting('nota')
    try { await imprimirNotaInicial(therapistId, patientName, notaInicial) }
    finally { setPrinting(null) }
  }

  // ── Bitácora ─────────────────────────────────────────────
  async function printBitacora() {
    if (!sesiones.length) return
    setPrinting('bitacora')
    try { await imprimirBitacoraSesiones(therapistId, patientName, sesiones) }
    finally { setPrinting(null) }
  }

  // ── Reporte Valorativo ───────────────────────────────────
  async function printReporteValorativo() {
    setPrinting('valorativo')
    try { await imprimirReporteValorativo(patientId, therapistId, patientName) }
    finally { setPrinting(null) }
  }

  // ── Reporte de Proceso ───────────────────────────────────
  async function printReporteProceso() {
    setPrinting('proceso')
    try { await imprimirReporteProceso(patientId, therapistId, patientName) }
    finally { setPrinting(null) }
  }

  // ── Integración y Plan de Tratamiento ───────────────────
  async function printIntegracionPlan() {
    setPrinting('integracion')
    try { await imprimirIntegracionPlan(patientId, therapistId, patientName) }
    finally { setPrinting(null) }
  }

  const hasNota     = !!(notaInicial?.initial_note?.trim())
  const hasSesiones = sesiones.length > 0
  const anyBusy     = printing !== null || generatingOrig || generatingAct || confirmingOrig

  if (loadingData) return <div className="flex justify-center py-16 text-gray-400 text-sm">Cargando…</div>

  return (
    <div className="space-y-5">

      {/* ══ ÍNDICE DE IMPRESIONES ══════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
          Índice de Impresiones
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">

          {/* Reporte Valorativo */}
          <IndexCard
            icon="📋" title="Reporte Valorativo" color="amber" status="ready"
            desc="Datos Generales, Prediagnóstico, Motivo de Consulta y Análisis Clínicos"
            onPrint={printReporteValorativo}
            loading={printing === 'valorativo'} disabled={anyBusy}
          />

          {/* Integración y Plan de Intervención */}
          <IndexCard
            icon="🗂" title="Integración y Plan de Intervención" color="blue" status="ready"
            desc="Datos generales, diagnóstico integrado, propuesta técnica y objetivos de trabajo"
            onPrint={printIntegracionPlan}
            loading={printing === 'integracion'} disabled={anyBusy}
          />

          {/* HC Original */}
          <IndexCard
            icon="🔒" title="Historia Clínica Original" color="purple"
            status={hcOriginalSaved ? 'locked' : 'pending'}
            desc="Prediagnóstico original + sesiones iniciales. Inamovible."
            onPrint={hcOriginalSaved ? imprimirOriginal : undefined}
            onGenerate={!hcOriginalSaved ? () => generateHC('original') : undefined}
            generating={generatingOrig} loading={printing === 'orig'} disabled={anyBusy}
          />

          {/* HC Actualizada */}
          <IndexCard
            icon="📄" title="Historia Clínica Actualizada" color="blue"
            status={hcActData ? 'ready' : 'pending'}
            desc="Toda la información disponible a la fecha. Regenerable."
            onPrint={hcActData ? imprimirActualizada : undefined}
            onGenerate={() => generateHC('actualizada')}
            onEdit={hcActData ? () => setShowActEditor(v => !v) : undefined}
            generating={generatingAct} loading={printing === 'act'} disabled={anyBusy}
          />

          {/* Entrevista Inicial */}
          <IndexCard
            icon="📝" title="Entrevista Inicial" color="gray"
            status={hasNota ? 'ready' : 'unavailable'}
            desc="Nota inicial del caso (4 apartados)"
            onPrint={hasNota ? printNotaInicial : undefined}
            loading={printing === 'nota'} disabled={anyBusy}
            unavailableMsg="Completa la Nota Inicial para habilitar."
          />

          {/* Bitácora */}
          <IndexCard
            icon="📅" title="Bitácora de Asesoría" color="green"
            status={hasSesiones ? 'ready' : 'unavailable'}
            desc={hasSesiones
              ? `${sesiones.length} sesión${sesiones.length !== 1 ? 'es' : ''} presencial${sesiones.length !== 1 ? 'es' : ''} registrada${sesiones.length !== 1 ? 's' : ''}`
              : 'Sesiones presenciales'}
            onPrint={hasSesiones ? printBitacora : undefined}
            loading={printing === 'bitacora'} disabled={anyBusy}
            unavailableMsg="Registra sesiones presenciales para habilitar."
          />

          {/* Reporte de Proceso */}
          <IndexCard
            icon="📋" title="Reporte de Proceso" color="green" status="ready"
            desc="Datos generales, motivos, información de interés e información del proceso psicológico"
            onPrint={printReporteProceso}
            loading={printing === 'proceso'} disabled={anyBusy}
          />


        </div>
      </div>

      {/* ══ PANEL: HC ORIGINAL (preview/edición) ═══════════════ */}
      {(generatingOrig || hcOriginalPreview) && (
        <div className="bg-white rounded-2xl border border-purple-100 p-6">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-purple-700">Historia Clínica Original</span>
            <span className="text-xs bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full">
              Revisa antes de confirmar
            </span>
          </div>

          {generatingOrig ? (
            <div className="flex items-center gap-3 py-6 text-sm text-gray-500">
              <span className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"/>
              Generando Historia Clínica Original…
            </div>
          ) : hcOriginalPreview && (
            <div className="space-y-4">
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                Revisa y edita el contenido. Al confirmar quedará guardada de forma permanente y no podrá modificarse.
              </p>
              {HC_SECTIONS.map(({ key, label, rows }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-purple-700 uppercase tracking-wide mb-1">{label}</label>
                  <textarea
                    rows={rows}
                    value={hcOrigEdits[key] ?? hcOriginalPreview[key] ?? ''}
                    onChange={e => setHcOrigEdits(prev => ({ ...prev, [key]: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800
                               focus:outline-none focus:ring-2 focus:ring-purple-300 resize-y leading-relaxed"
                  />
                </div>
              ))}
              <div className="flex flex-wrap gap-3 pt-3 border-t border-gray-100">
                <button
                  onClick={confirmarOriginal}
                  disabled={anyBusy}
                  className="flex items-center gap-2 px-5 py-2.5 bg-purple-500 hover:bg-purple-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-40"
                >
                  {confirmingOrig
                    ? <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/>Guardando…</>
                    : '✓ Confirmar y guardar como Original'}
                </button>
                <button
                  onClick={() => setHcOriginalPreview(null)}
                  disabled={anyBusy}
                  className="px-4 py-2.5 border border-gray-300 text-gray-600 rounded-xl text-sm hover:bg-gray-50 disabled:opacity-40"
                >
                  ✕ Cancelar
                </button>
              </div>
              {errorOrig && <p className="text-xs text-red-500">{errorOrig}</p>}
            </div>
          )}
        </div>
      )}

      {/* ══ PANEL: HC ACTUALIZADA (edición) ════════════════════ */}
      {showActEditor && (generatingAct || hcActData) && (
        <div className="bg-white rounded-2xl border border-blue-100 p-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-blue-700">Historia Clínica Actualizada — Editor</span>
            <button
              onClick={() => setShowActEditor(false)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              ✕ Cerrar
            </button>
          </div>

          {generatingAct ? (
            <div className="flex items-center gap-3 py-6 text-sm text-gray-500">
              <span className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"/>
              Generando Historia Clínica Actualizada…
            </div>
          ) : hcActData && (
            <div className="space-y-4">
              {HC_SECTIONS.map(({ key, label, rows }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">{label}</label>
                  <textarea
                    rows={rows}
                    value={hcActEdits[key] ?? hcActData[key] ?? ''}
                    onChange={e => setHcActEdits(prev => ({ ...prev, [key]: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800
                               focus:outline-none focus:ring-2 focus:ring-blue-300 resize-y leading-relaxed"
                  />
                </div>
              ))}
              <div className="flex flex-wrap gap-3 pt-3 border-t border-gray-100">
                <button
                  onClick={imprimirActualizada}
                  disabled={anyBusy}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-40"
                >
                  {printing === 'act'
                    ? <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/>Imprimiendo…</>
                    : '🖨 Guardar e Imprimir'}
                </button>
              </div>
              {errorAct && <p className="text-xs text-red-500">{errorAct}</p>}
            </div>
          )}
        </div>
      )}

    </div>
  )
}
