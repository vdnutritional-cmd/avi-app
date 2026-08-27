'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  imprimirHistoriaClinicaV2,
  imprimirNotaInicial,
  imprimirBitacoraSesiones,
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
// Secciones editables de la HC
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
// UI atoms
// ──────────────────────────────────────────────────────────
function PrintCard({ title, description, children }: {
  title: string; description?: string; children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="border-b border-gray-100 pb-3 mb-5">
        <h4 className="text-sm font-semibold text-gray-700">{title}</h4>
        {description && <p className="text-xs text-gray-400 mt-1">{description}</p>}
      </div>
      <div className="flex flex-wrap gap-3">{children}</div>
    </div>
  )
}

function Btn({ onClick, disabled, loading, label, variant = 'default' }: {
  onClick: () => void; disabled?: boolean; loading?: boolean; label: string
  variant?: 'default' | 'blue' | 'green' | 'purple' | 'amber'
}) {
  const styles: Record<string, string> = {
    default: 'border-gray-300 text-gray-700 hover:bg-gray-50',
    blue:    'border-blue-300 text-blue-700 hover:bg-blue-50',
    green:   'border-emerald-300 text-emerald-700 hover:bg-emerald-50',
    purple:  'border-purple-200 text-purple-700 hover:bg-purple-50',
    amber:   'border-amber-300 text-amber-700 hover:bg-amber-50',
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`flex items-center gap-2 px-5 py-3 border rounded-xl text-sm font-medium
                  transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${styles[variant]}`}
    >
      {loading
        ? <><span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"/>Generando…</>
        : label}
    </button>
  )
}

// ──────────────────────────────────────────────────────────
// Componente principal
// ──────────────────────────────────────────────────────────
export default function ImpresionesTab({ patientId, therapistId, patientName }: Props) {
  const [loadingData, setLoadingData] = useState(true)
  const [printing,    setPrinting]    = useState<string | null>(null)

  // HC Original (inmutable una vez confirmada)
  const [hcOriginalSaved,   setHcOriginalSaved]   = useState<HistoriaClinicaV2 | null>(null)
  const [hcOriginalPreview, setHcOriginalPreview] = useState<HistoriaClinicaV2 | null>(null)
  const [hcOrigEdits,       setHcOrigEdits]       = useState<Partial<HistoriaClinicaV2>>({})
  const [generatingOrig,    setGeneratingOrig]    = useState(false)
  const [confirmingOrig,    setConfirmingOrig]    = useState(false)
  const [errorOrig,         setErrorOrig]         = useState<string | null>(null)

  // HC Actualizada (regenerable, editable)
  const [hcActData,     setHcActData]    = useState<HistoriaClinicaV2 | null>(null)
  const [hcActEdits,    setHcActEdits]   = useState<Partial<HistoriaClinicaV2>>({})
  const [generatingAct, setGeneratingAct] = useState(false)
  const [errorAct,      setErrorAct]     = useState<string | null>(null)

  // Nota Inicial + Sesiones
  const [notaInicial, setNotaInicial] = useState<NotaInicialPrint | null>(null)
  const [sesiones,    setSesiones]    = useState<SessionPresencialPrint[]>([])

  useEffect(() => { loadData() }, [patientId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    setLoadingData(true)
    try {
      const supabase = createClient()
      const [expedienteRes, notaRes, sesionesRes] = await Promise.all([
        supabase
          .from('patient_expediente')
          .select('hc_original, hc_actualizada')
          .eq('therapist_id', therapistId).eq('patient_id', patientId).maybeSingle(),
        supabase
          .from('therapist_patients')
          .select('initial_note, initial_note_date, initial_note_motivo, initial_note_subyacente, initial_note_premisas, initial_note_pro_bono, initial_note_virtual')
          .eq('therapist_id', therapistId).eq('patient_id', patientId).single(),
        supabase
          .from('therapist_session_notes')
          .select('session_number, session_date, session_objetivo, session_desarrollo, notes, is_pro_bono, is_virtual')
          .eq('therapist_id', therapistId).eq('patient_id', patientId)
          .order('session_number', { ascending: true }),
      ])

      if (expedienteRes.data?.hc_original) {
        setHcOriginalSaved(expedienteRes.data.hc_original as HistoriaClinicaV2)
      }
      if (expedienteRes.data?.hc_actualizada) {
        setHcActData(expedienteRes.data.hc_actualizada as HistoriaClinicaV2)
        setHcActEdits({})
      }
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
    } finally {
      setLoadingData(false)
    }
  }

  // ── Generar HC (POST — no guarda) ────────────────────────
  async function generateHC(type: 'original' | 'actualizada') {
    if (type === 'original') { setGeneratingOrig(true); setErrorOrig(null); setHcOriginalPreview(null) }
    else                     { setGeneratingAct(true);  setErrorAct(null) }

    try {
      const res  = await fetch('/api/historia-clinica', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, type }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        if (type === 'original') setErrorOrig(json.error ?? 'Error al generar')
        else                     setErrorAct(json.error  ?? 'Error al generar')
        return
      }
      if (type === 'original') {
        setHcOriginalPreview(json.sections as HistoriaClinicaV2)
        setHcOrigEdits({})
      } else {
        setHcActData(json.sections as HistoriaClinicaV2)
        setHcActEdits({})
      }
    } catch {
      if (type === 'original') setErrorOrig('Error de conexión.')
      else                     setErrorAct('Error de conexión.')
    } finally {
      if (type === 'original') setGeneratingOrig(false)
      else                     setGeneratingAct(false)
    }
  }

  // ── Confirmar HC Original (PATCH — guarda inmutable) ────
  async function confirmarOriginal() {
    if (!hcOriginalPreview) return
    setConfirmingOrig(true)
    const finalSections = { ...hcOriginalPreview, ...hcOrigEdits }
    try {
      const res  = await fetch('/api/historia-clinica', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, type: 'original', sections: finalSections }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setErrorOrig(json.error ?? 'Error al guardar'); return }
      setHcOriginalSaved(finalSections as HistoriaClinicaV2)
      setHcOriginalPreview(null)
      setHcOrigEdits({})
    } catch { setErrorOrig('Error de conexión.') }
    finally  { setConfirmingOrig(false) }
  }

  // ── Guardar + Imprimir HC Actualizada ────────────────────
  async function imprimirActualizada() {
    const data = mergedAct()
    if (!data) return
    setPrinting('act')
    try {
      // Guardar en DB (sobrescribe)
      await fetch('/api/historia-clinica', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
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

  const hasNota     = !!(notaInicial?.initial_note?.trim())
  const hasSesiones = sesiones.length > 0
  const anyBusy     = printing !== null || generatingOrig || generatingAct || confirmingOrig

  if (loadingData) return <div className="flex justify-center py-16 text-gray-400 text-sm">Cargando…</div>

  return (
    <div className="space-y-5">

      {/* ══ HISTORIA CLÍNICA ORIGINAL ══════════════════════ */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="border-b border-gray-100 pb-3 mb-5">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-gray-700">Historia Clínica Original</h4>
            <span className="text-xs bg-purple-50 text-purple-600 border border-purple-100 px-2 py-0.5 rounded-full font-medium">
              Inamovible
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Se genera una sola vez con el Prediagnóstico Original y las sesiones presenciales del prediagnóstico.
            Una vez confirmada, no puede modificarse.
          </p>
        </div>

        {/* Estado A: ya guardada → solo imprimir */}
        {hcOriginalSaved && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-xl">
              🔒 Historia Clínica Original registrada
            </span>
            <Btn
              onClick={imprimirOriginal}
              disabled={anyBusy}
              loading={printing === 'orig'}
              label="🖨 Imprimir Historia Clínica Original"
              variant="purple"
            />
          </div>
        )}

        {/* Estado B: preview generado — revisar y confirmar */}
        {!hcOriginalSaved && hcOriginalPreview && (
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-amber-700 text-xs font-medium">
                Revisa y edita el contenido. Una vez que confirmes, la Historia Clínica Original quedará guardada de forma permanente y no podrá modificarse.
              </p>
            </div>

            {HC_SECTIONS.map(({ key, label, rows }) => {
              const val = hcOrigEdits[key] ?? hcOriginalPreview[key] ?? ''
              return (
                <div key={key}>
                  <label className="block text-xs font-semibold text-purple-700 uppercase tracking-wide mb-1">
                    {label}
                  </label>
                  <textarea
                    rows={rows}
                    value={val}
                    onChange={e => setHcOrigEdits(prev => ({ ...prev, [key]: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800
                               focus:outline-none focus:ring-2 focus:ring-purple-300 resize-y leading-relaxed"
                  />
                </div>
              )
            })}

            <div className="flex flex-wrap gap-3 pt-3 border-t border-gray-100">
              <Btn
                onClick={confirmarOriginal}
                disabled={anyBusy}
                loading={confirmingOrig}
                label="✓ Confirmar y guardar como Original"
                variant="purple"
              />
              <Btn
                onClick={() => setHcOriginalPreview(null)}
                disabled={anyBusy}
                label="✕ Cancelar"
                variant="default"
              />
            </div>
            {errorOrig && <p className="text-xs text-red-500">{errorOrig}</p>}
          </div>
        )}

        {/* Estado C: sin generar */}
        {!hcOriginalSaved && !hcOriginalPreview && (
          <div className="space-y-3">
            {generatingOrig ? (
              <div className="flex items-center gap-3 py-4 text-sm text-gray-500">
                <span className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"/>
                Generando Historia Clínica Original…
              </div>
            ) : (
              <>
                <p className="text-xs text-gray-500">
                  Requiere tener el Prediagnóstico Original guardado en el Expediente.
                </p>
                <Btn
                  onClick={() => generateHC('original')}
                  disabled={anyBusy}
                  label="✦ Generar Historia Clínica Original"
                  variant="purple"
                />
                {errorOrig && <p className="text-xs text-red-500">{errorOrig}</p>}
              </>
            )}
          </div>
        )}
      </div>

      {/* ══ HISTORIA CLÍNICA ACTUALIZADA ═══════════════════ */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="border-b border-gray-100 pb-3 mb-5">
          <h4 className="text-sm font-semibold text-gray-700">Historia Clínica Actualizada</h4>
          <p className="text-xs text-gray-400 mt-1">
            Usa el Prediagnóstico o Análisis Caso más reciente y todas las sesiones presenciales.
            Puede regenerarse en cualquier momento — cada nueva versión reemplaza la anterior.
          </p>
        </div>

        {generatingAct ? (
          <div className="flex items-center gap-3 py-4 text-sm text-gray-500">
            <span className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"/>
            Generando Historia Clínica Actualizada…
          </div>
        ) : hcActData ? (
          <div className="space-y-5">
            {HC_SECTIONS.map(({ key, label, rows }) => {
              const val = hcActEdits[key] ?? hcActData[key] ?? ''
              return (
                <div key={key}>
                  <label className="block text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">
                    {label}
                  </label>
                  <textarea
                    rows={rows}
                    value={val}
                    onChange={e => setHcActEdits(prev => ({ ...prev, [key]: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800
                               focus:outline-none focus:ring-2 focus:ring-blue-300 resize-y leading-relaxed"
                  />
                </div>
              )
            })}

            <div className="flex flex-wrap gap-3 pt-3 border-t border-gray-100">
              <Btn
                onClick={imprimirActualizada}
                disabled={anyBusy}
                loading={printing === 'act'}
                label="🖨 Imprimir Historia Clínica Actualizada"
                variant="green"
              />
              <Btn
                onClick={() => generateHC('actualizada')}
                disabled={anyBusy}
                label="↺ Regenerar"
                variant="default"
              />
            </div>
            {errorAct && <p className="text-xs text-red-500">{errorAct}</p>}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              Genera la Historia Clínica actualizada a partir de toda la información disponible a la fecha.
            </p>
            <Btn
              onClick={() => generateHC('actualizada')}
              disabled={anyBusy}
              label="✦ Generar Historia Clínica Actualizada"
              variant="blue"
            />
            {errorAct && <p className="text-xs text-red-500">{errorAct}</p>}
          </div>
        )}
      </div>

      {/* ══ ENTREVISTA INICIAL ══════════════════════════════ */}
      <PrintCard
        title="Entrevista Inicial (Nota inicial)"
        description="Imprime los 4 apartados de la Nota Inicial del caso."
      >
        {hasNota ? (
          <Btn onClick={printNotaInicial} disabled={anyBusy} loading={printing === 'nota'}
               label="🖨 Entrevista Inicial (Nota inicial)" />
        ) : (
          <p className="text-xs text-gray-400 italic">
            Aún no hay nota inicial registrada. Completa la pestaña &quot;Nota inicial&quot; para habilitar esta impresión.
          </p>
        )}
      </PrintCard>

      {/* ══ BITÁCORA DE SESIONES ════════════════════════════ */}
      <PrintCard
        title="Bitácora de Asesoría (Sesiones presenciales)"
        description={hasSesiones
          ? `Imprime las ${sesiones.length} sesiones presenciales registradas.`
          : 'No hay sesiones presenciales registradas aún.'}
      >
        {hasSesiones ? (
          <Btn onClick={printBitacora} disabled={anyBusy} loading={printing === 'bitacora'}
               label={`🖨 Bitácora de Asesoría (${sesiones.length} sesión${sesiones.length !== 1 ? 'es' : ''})`} />
        ) : (
          <p className="text-xs text-gray-400 italic">
            Registra al menos una sesión presencial para habilitar esta impresión.
          </p>
        )}
      </PrintCard>

    </div>
  )
}
