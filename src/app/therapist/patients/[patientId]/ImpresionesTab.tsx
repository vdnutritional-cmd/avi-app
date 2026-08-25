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
// Secciones de la Historia Clínica V2
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
// Sub-componentes UI
// ──────────────────────────────────────────────────────────
function PrintCard({
  title, description, children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="border-b border-gray-100 pb-3 mb-5">
        <h4 className="text-sm font-semibold text-gray-700">{title}</h4>
        {description && (
          <p className="text-xs text-gray-400 mt-1">{description}</p>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        {children}
      </div>
    </div>
  )
}

function ActionButton({
  onClick, disabled, loading, label, variant = 'default',
}: {
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  label: string
  variant?: 'default' | 'purple' | 'blue' | 'green'
}) {
  const styles: Record<string, string> = {
    default: 'border-gray-300 text-gray-700 hover:bg-gray-50',
    purple:  'border-purple-200 text-purple-700 hover:bg-purple-50',
    blue:    'border-blue-300 text-blue-700 hover:bg-blue-50',
    green:   'border-emerald-300 text-emerald-700 hover:bg-emerald-50',
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`flex items-center gap-2 px-5 py-3 border rounded-xl text-sm font-medium
                  transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${styles[variant]}`}
    >
      {loading ? (
        <><span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />Generando…</>
      ) : label}
    </button>
  )
}

// ──────────────────────────────────────────────────────────
// Componente principal
// ──────────────────────────────────────────────────────────
export default function ImpresionesTab({ patientId, therapistId, patientName }: Props) {
  const [loadingData, setLoadingData] = useState(true)
  const [printing,    setPrinting]    = useState<string | null>(null)

  // Historia Clínica V2
  const [hcv2Data,     setHcv2Data]    = useState<HistoriaClinicaV2 | null>(null)
  const [hcEdits,      setHcEdits]     = useState<Partial<HistoriaClinicaV2>>({})
  const [generatingHC, setGeneratingHC] = useState(false)
  const [hcError,      setHcError]     = useState<string | null>(null)

  // Nota Inicial
  const [notaInicial, setNotaInicial] = useState<NotaInicialPrint | null>(null)

  // Sesiones presenciales
  const [sesiones, setSesiones] = useState<SessionPresencialPrint[]>([])

  useEffect(() => { loadData() }, [patientId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    setLoadingData(true)
    try {
      const supabase = createClient()

      const [notaRes, sesionesRes] = await Promise.all([
        supabase
          .from('therapist_patients')
          .select('initial_note, initial_note_date, initial_note_motivo, initial_note_subyacente, initial_note_premisas, initial_note_pro_bono, initial_note_virtual')
          .eq('therapist_id', therapistId)
          .eq('patient_id', patientId)
          .single(),

        supabase
          .from('therapist_session_notes')
          .select('session_number, session_date, session_objetivo, session_desarrollo, notes, is_pro_bono, is_virtual')
          .eq('therapist_id', therapistId)
          .eq('patient_id', patientId)
          .order('session_number', { ascending: true }),
      ])

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

  // ── Generar Historia Clínica V2 ──────────────────────────
  async function generateHistoriaClinica() {
    setGeneratingHC(true)
    setHcError(null)
    setHcv2Data(null)
    setHcEdits({})
    try {
      const res = await fetch('/api/historia-clinica', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        setHcError(json.error ?? 'Error al generar la Historia Clínica.')
        return
      }
      setHcv2Data(json.sections as HistoriaClinicaV2)
    } catch {
      setHcError('Error de conexión. Intenta de nuevo.')
    } finally {
      setGeneratingHC(false)
    }
  }

  // ── Edición de secciones ─────────────────────────────────
  function handleHcEdit(key: keyof HistoriaClinicaV2, value: string) {
    setHcEdits(prev => ({ ...prev, [key]: value }))
  }

  function mergedHC(): HistoriaClinicaV2 | null {
    if (!hcv2Data) return null
    return { ...hcv2Data, ...hcEdits }
  }

  // ── Impresión Historia Clínica V2 ─────────────────────────
  async function printHistoriaClinicaV2() {
    const data = mergedHC()
    if (!data) return
    setPrinting('hcv2')
    try { await imprimirHistoriaClinicaV2(patientId, therapistId, patientName, data) }
    finally { setPrinting(null) }
  }

  // ── Impresión: Nota Inicial ───────────────────────────────
  async function printNotaInicial() {
    if (!notaInicial) return
    setPrinting('nota')
    try { await imprimirNotaInicial(therapistId, patientName, notaInicial) }
    finally { setPrinting(null) }
  }

  // ── Impresión: Bitácora ───────────────────────────────────
  async function printBitacora() {
    if (sesiones.length === 0) return
    setPrinting('bitacora')
    try { await imprimirBitacoraSesiones(therapistId, patientName, sesiones) }
    finally { setPrinting(null) }
  }

  const hasNota     = !!(notaInicial?.initial_note?.trim())
  const hasSesiones = sesiones.length > 0

  if (loadingData) {
    return <div className="flex justify-center py-16 text-gray-400 text-sm">Cargando…</div>
  }

  return (
    <div className="space-y-5">

      {/* ── Historia Clínica V2 ────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="border-b border-gray-100 pb-3 mb-5">
          <h4 className="text-sm font-semibold text-gray-700">Historia Clínica</h4>
          <p className="text-xs text-gray-400 mt-1">
            Modelo Personalista Bio-Psico-Social — 10 secciones clínicas generadas por IA.
          </p>
        </div>

        {/* Estado: sin generar */}
        {!hcv2Data && !generatingHC && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              Genera la Historia Clínica a partir de la Nota Inicial, el Expediente, las sesiones AVI y el Prediagnóstico.
              Podrás revisar y editar cada sección antes de imprimir.
            </p>
            <ActionButton
              onClick={generateHistoriaClinica}
              label="✦ Generar Historia Clínica"
              variant="blue"
            />
            {hcError && (
              <p className="text-xs text-red-500 mt-2">{hcError}</p>
            )}
          </div>
        )}

        {/* Estado: generando */}
        {generatingHC && (
          <div className="flex items-center gap-3 py-6 text-sm text-gray-500">
            <span className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            Generando Historia Clínica… esto puede tardar un momento.
          </div>
        )}

        {/* Estado: generado — secciones editables */}
        {hcv2Data && !generatingHC && (
          <div className="space-y-5">
            {HC_SECTIONS.map(({ key, label, rows }) => {
              const val = hcEdits[key] ?? hcv2Data[key] ?? ''
              return (
                <div key={key}>
                  <label className="block text-xs font-semibold text-blue-700 mb-1 uppercase tracking-wide">
                    {label}
                  </label>
                  <textarea
                    rows={rows}
                    value={val}
                    onChange={e => handleHcEdit(key, e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800
                               focus:outline-none focus:ring-2 focus:ring-blue-300 resize-y leading-relaxed"
                  />
                </div>
              )
            })}

            {/* Botones de acción */}
            <div className="flex flex-wrap gap-3 pt-3 border-t border-gray-100">
              <ActionButton
                onClick={printHistoriaClinicaV2}
                disabled={printing !== null}
                loading={printing === 'hcv2'}
                label="🖨 Imprimir Historia Clínica"
                variant="green"
              />
              <ActionButton
                onClick={generateHistoriaClinica}
                disabled={printing !== null || generatingHC}
                label="↺ Regenerar"
                variant="default"
              />
            </div>

            {hcError && (
              <p className="text-xs text-red-500">{hcError}</p>
            )}
          </div>
        )}
      </div>

      {/* ── Entrevista Inicial ─────────────────────────────── */}
      <PrintCard
        title="Entrevista Inicial (Nota inicial)"
        description="Imprime los 4 apartados de la Nota Inicial del caso."
      >
        <div className="w-full">
          {hasNota ? (
            <ActionButton
              onClick={printNotaInicial}
              disabled={printing !== null}
              loading={printing === 'nota'}
              label="🖨 Entrevista Inicial (Nota inicial)"
            />
          ) : (
            <p className="text-xs text-gray-400 italic">
              Aún no hay nota inicial registrada. Completa la pestaña &quot;Nota inicial&quot; para habilitar esta impresión.
            </p>
          )}
        </div>
      </PrintCard>

      {/* ── Bitácora de Sesiones ───────────────────────────── */}
      <PrintCard
        title="Bitácora de Asesoría (Sesiones presenciales)"
        description={hasSesiones
          ? `Imprime las ${sesiones.length} sesiones presenciales registradas con sus 3 apartados.`
          : 'No hay sesiones presenciales registradas aún.'
        }
      >
        <div className="w-full">
          {hasSesiones ? (
            <ActionButton
              onClick={printBitacora}
              disabled={printing !== null}
              loading={printing === 'bitacora'}
              label={`🖨 Bitácora de Asesoría (${sesiones.length} sesión${sesiones.length !== 1 ? 'es' : ''})`}
            />
          ) : (
            <p className="text-xs text-gray-400 italic">
              Registra al menos una sesión presencial para habilitar esta impresión.
            </p>
          )}
        </div>
      </PrintCard>

    </div>
  )
}
