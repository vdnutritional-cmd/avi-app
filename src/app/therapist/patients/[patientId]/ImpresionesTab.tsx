'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  imprimirHistoriaClinica,
  imprimirNotaInicial,
  imprimirBitacoraSesiones,
  type PrintableData,
  type NotaInicialPrint,
  type SessionPresencialPrint,
} from './print-utils'

// ──────────────────────────────────────────────────────────
// Tipos locales
// ──────────────────────────────────────────────────────────
interface PrediagOriginal {
  impresion:   string
  diagnostico: string
  areas:       string
  tipo:        string
  detonadores: string
  guia:        string
}

// ──────────────────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────────────────
interface Props {
  patientId:   string
  therapistId: string
  patientName: string | null
}

// ──────────────────────────────────────────────────────────
// Sub-componente: tarjeta de impresión
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

function PrintButton({
  onClick, disabled, label, variant = 'default',
}: {
  onClick: () => void
  disabled?: boolean
  label: string
  variant?: 'default' | 'purple'
}) {
  const styles = variant === 'purple'
    ? 'border-purple-200 text-purple-700 hover:bg-purple-50'
    : 'border-gray-300 text-gray-700 hover:bg-gray-50'

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 px-5 py-3 border rounded-xl text-sm font-medium
                  transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${styles}`}
    >
      {disabled ? (
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
  const [printing, setPrinting]       = useState<string | null>(null)

  // Historia Clínica y Prediagnóstico
  const [current, setCurrent]         = useState<PrintableData | null>(null)
  const [prediagOrig, setPrediagOrig] = useState<PrediagOriginal | null>(null)
  const [viasOrig,    setViasOrig]    = useState<string>('')

  // Nota Inicial
  const [notaInicial, setNotaInicial] = useState<NotaInicialPrint | null>(null)

  // Sesiones presenciales
  const [sesiones, setSesiones]       = useState<SessionPresencialPrint[]>([])

  useEffect(() => { loadData() }, [patientId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    setLoadingData(true)
    try {
      const supabase = createClient()

      const [expedienteRes, notaRes, sesionesRes] = await Promise.all([
        // Historia Clínica + Prediagnóstico
        supabase
          .from('patient_expediente')
          .select(`
            individual_dimensiones,
            individual_contexto,
            individual_antecedentes,
            individual_sintomatologia,
            individual_prediag_impresion,
            individual_prediag_diagnostico,
            individual_prediag_areas,
            individual_prediag_tipo,
            individual_prediag_detonadores,
            individual_prediag_guia,
            individual_vias_accion,
            individual_prediag_original,
            individual_vias_original
          `)
          .eq('therapist_id', therapistId)
          .eq('patient_id', patientId)
          .maybeSingle(),

        // Nota Inicial (de therapist_patients)
        supabase
          .from('therapist_patients')
          .select(`
            initial_note,
            initial_note_date,
            initial_note_motivo,
            initial_note_subyacente,
            initial_note_premisas,
            initial_note_pro_bono,
            initial_note_virtual
          `)
          .eq('therapist_id', therapistId)
          .eq('patient_id', patientId)
          .single(),

        // Sesiones presenciales
        supabase
          .from('therapist_session_notes')
          .select('session_number, session_date, session_objetivo, session_desarrollo, notes, is_pro_bono, is_virtual')
          .eq('therapist_id', therapistId)
          .eq('patient_id', patientId)
          .order('session_number', { ascending: true }),
      ])

      // Historia Clínica
      const row = expedienteRes.data
      if (row) {
        setCurrent({
          dimensiones:         Array.isArray(row.individual_dimensiones) ? row.individual_dimensiones : [],
          contexto:            row.individual_contexto       ?? '',
          antecedentes:        row.individual_antecedentes   ?? '',
          sintomatologia:      row.individual_sintomatologia  ?? '',
          prediag_impresion:   row.individual_prediag_impresion   ?? '',
          prediag_diagnostico: row.individual_prediag_diagnostico ?? '',
          prediag_areas:       row.individual_prediag_areas       ?? '',
          prediag_tipo:        row.individual_prediag_tipo        ?? '',
          prediag_detonadores: row.individual_prediag_detonadores ?? '',
          prediag_guia:        row.individual_prediag_guia        ?? '',
          vias_accion:         row.individual_vias_accion  ?? '',
        })
        if (row.individual_prediag_original) setPrediagOrig(row.individual_prediag_original as PrediagOriginal)
        setViasOrig(row.individual_vias_original ?? '')
      }

      // Nota Inicial
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

      // Sesiones presenciales
      setSesiones((sesionesRes.data ?? []).map(s => ({
        session_number:    s.session_number,
        session_date:      s.session_date,
        session_objetivo:  s.session_objetivo  ?? null,
        session_desarrollo: s.session_desarrollo ?? null,
        notes:             s.notes             ?? null,
        is_pro_bono:       s.is_pro_bono       ?? false,
        is_virtual:        s.is_virtual        ?? false,
      })))

    } finally {
      setLoadingData(false)
    }
  }

  // ── Impresiones: Historia Clínica ─────────────────────────
  async function printActual() {
    if (!current) return
    setPrinting('actual')
    try { await imprimirHistoriaClinica(patientId, therapistId, patientName, current, false) }
    finally { setPrinting(null) }
  }

  async function printOriginal() {
    if (!current) return
    setPrinting('original')
    try {
      const originalData: PrintableData = {
        ...current,
        prediag_impresion:   prediagOrig?.impresion    ?? current.prediag_impresion,
        prediag_diagnostico: prediagOrig?.diagnostico  ?? current.prediag_diagnostico,
        prediag_areas:       prediagOrig?.areas        ?? current.prediag_areas,
        prediag_tipo:        prediagOrig?.tipo          ?? current.prediag_tipo,
        prediag_detonadores: prediagOrig?.detonadores   ?? current.prediag_detonadores,
        prediag_guia:        prediagOrig?.guia          ?? current.prediag_guia,
        vias_accion:         viasOrig                   || current.vias_accion,
      }
      await imprimirHistoriaClinica(patientId, therapistId, patientName, originalData, true)
    } finally { setPrinting(null) }
  }

  // ── Impresión: Nota Inicial ───────────────────────────────
  async function printNotaInicial() {
    if (!notaInicial) return
    setPrinting('nota')
    try { await imprimirNotaInicial(therapistId, patientName, notaInicial) }
    finally { setPrinting(null) }
  }

  // ── Impresión: Bitácora de Sesiones ──────────────────────
  async function printBitacora() {
    if (sesiones.length === 0) return
    setPrinting('bitacora')
    try { await imprimirBitacoraSesiones(therapistId, patientName, sesiones) }
    finally { setPrinting(null) }
  }

  // ── Flags de disponibilidad ───────────────────────────────
  const hasIndividual = !!(current?.prediag_impresion || current?.prediag_diagnostico)
  const hasOriginal   = !!(prediagOrig || viasOrig)
  const hasNota       = !!(notaInicial?.initial_note?.trim())
  const hasSesiones   = sesiones.length > 0

  if (loadingData) {
    return <div className="flex justify-center py-16 text-gray-400 text-sm">Cargando…</div>
  }

  return (
    <div className="space-y-5">

      {/* ── Sección: Historia Clínica ── */}
      <PrintCard
        title="Historia Clínica inicial y Prediagnóstico"
        description="Incluye datos generales, sección Individual completa y Plan de 10 sesiones."
      >
        <div className="w-full">
          <p className="text-xs font-medium text-gray-500 mb-2">Versión actual (con tus ediciones)</p>
          {hasIndividual ? (
            <PrintButton
              onClick={printActual}
              disabled={printing !== null}
              label="🖨 Historia Clínica y Prediagnóstico — Actual"
            />
          ) : (
            <p className="text-xs text-gray-400 italic">
              Aún no hay prediagnóstico registrado. Completa la sección Individual para habilitar esta impresión.
            </p>
          )}
        </div>

        <div className="w-full border-t border-gray-50 pt-4 mt-1">
          <p className="text-xs font-medium text-gray-500 mb-2">Versión original AVI (generada automáticamente, nunca modificada)</p>
          {hasOriginal ? (
            <PrintButton
              onClick={printOriginal}
              disabled={printing !== null}
              label="🖨 Historia Clínica y Prediagnóstico — Original AVI"
              variant="purple"
            />
          ) : (
            <p className="text-xs text-gray-400 italic">
              Aún no se ha ejecutado el análisis AVI. La versión original se registra automáticamente en el primer análisis.
            </p>
          )}
        </div>
      </PrintCard>

      {/* ── Sección: Nota Inicial ── */}
      <PrintCard
        title="Entrevista Inicial (Nota inicial)"
        description="Imprime los 4 apartados de la Nota Inicial del caso."
      >
        <div className="w-full">
          {hasNota ? (
            <PrintButton
              onClick={printNotaInicial}
              disabled={printing !== null}
              label="🖨 Entrevista Inicial (Nota inicial)"
            />
          ) : (
            <p className="text-xs text-gray-400 italic">
              Aún no hay nota inicial registrada. Completa la pestaña &quot;Nota inicial&quot; para habilitar esta impresión.
            </p>
          )}
        </div>
      </PrintCard>

      {/* ── Sección: Bitácora de Sesiones ── */}
      <PrintCard
        title="Bitácora de Asesoría (Sesiones presenciales)"
        description={hasSesiones
          ? `Imprime las ${sesiones.length} sesiones presenciales registradas con sus 3 apartados.`
          : 'No hay sesiones presenciales registradas aún.'
        }
      >
        <div className="w-full">
          {hasSesiones ? (
            <PrintButton
              onClick={printBitacora}
              disabled={printing !== null}
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
