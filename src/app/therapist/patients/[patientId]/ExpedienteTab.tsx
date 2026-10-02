'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import IndividualTab from './IndividualTab'
import ImpresionesTab from './ImpresionesTab'
import FamiliarTab from './FamiliarTab'
import ParejaTab from './ParejaTab'
import PrediagnosticoTab from './PrediagnosticoTab'
import AnalisisClanicosTab from './AnalisisClanicosTab'
import CuestionariosTab from './CuestionariosTab'

// ──────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────
type ClinicSubTab = 'individual' | 'familiar' | 'pareja' | 'prediagnostico' | 'analisis-clinicos' | 'impresiones' | 'cuestionarios'

interface Props {
  patientId: string
  therapistId: string
  patientEmail: string | null
  patientName: string | null
  /** Cuando se pasa desde el sidebar EHR, sobreescribe el subTab interno y oculta la sub-nav */
  controlledSubTab?: ClinicSubTab
}

// ──────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────
export default function ExpedienteTab({ patientId, therapistId, patientEmail: _patientEmail, patientName, controlledSubTab }: Props) {
  const [tipoCaso, setTipoCaso] = useState('')
  const [loading, setLoading] = useState(true)
  const [subTab, setSubTab] = useState<ClinicSubTab>('prediagnostico')

  // Cuando el sidebar controla el sub-tab, usamos ese valor
  const activeSubTab: ClinicSubTab = controlledSubTab ?? subTab

  // Cargar expediente al montar
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId])

  async function load() {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: row } = await supabase
        .from('patient_expediente')
        .select('tipo_caso')
        .eq('therapist_id', therapistId)
        .eq('patient_id', patientId)
        .maybeSingle()

      if (row) {
        setTipoCaso(row.tipo_caso ?? '')
      }
    } finally {
      setLoading(false)
    }
  }

  // Tabs bloqueados según el tipo de caso seleccionado
  const tabBloqueado = (id: string) => {
    if (id === 'individual' || id === 'familiar' || id === 'pareja') {
      if (!tipoCaso) return true          // sin selección → los 3 bloqueados
      if (id === 'individual') return tipoCaso !== 'Individual'
      if (id === 'familiar')   return tipoCaso !== 'Familiar'
      if (id === 'pareja')     return tipoCaso !== 'Pareja'
    }
    return false
  }

  // Si el sub-tab activo queda bloqueado al cambiar tipo_caso, volver a Prediagnóstico
  useEffect(() => {
    if (tabBloqueado(subTab)) setSubTab('prediagnostico')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoCaso])

  const SUB_TABS = [
    { id: 'individual',       label: 'Individual',         ready: !tabBloqueado('individual') },
    { id: 'familiar',         label: 'Familiar',           ready: !tabBloqueado('familiar') },
    { id: 'pareja',           label: 'Pareja',             ready: !tabBloqueado('pareja') },
    { id: 'prediagnostico',   label: 'Prediagnóstico',     ready: true },
    { id: 'analisis-clinicos', label: 'Análisis Clínicos', ready: true },
    { id: 'cuestionarios',    label: 'Cuestionarios',      ready: true },
    { id: 'impresiones',      label: 'Impresiones',        ready: true },
  ]

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-gray-400 text-sm">
        Cargando expediente…
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* Sub-navegación — solo visible cuando NO hay sidebar controlando */}
      {!controlledSubTab && (
        <div className="flex gap-2 border-b border-gray-200 pb-3 overflow-x-auto">
          {SUB_TABS.map(tab => (
            <button
              key={tab.id}
              disabled={!tab.ready}
              onClick={() => tab.ready && setSubTab(tab.id as ClinicSubTab)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap
                ${activeSubTab === tab.id && tab.ready
                  ? 'bg-primary-600 text-white'
                  : tab.ready
                    ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    : 'bg-gray-50 text-gray-300 cursor-not-allowed'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Individual ── */}
      {activeSubTab === 'individual' && (
        <IndividualTab
          patientId={patientId}
          therapistId={therapistId}
          patientName={patientName}
        />
      )}

      {/* ── Impresiones ── */}
      {activeSubTab === 'impresiones' && (
        <ImpresionesTab
          patientId={patientId}
          therapistId={therapistId}
          patientName={patientName}
        />
      )}

      {/* ── Familiar ── */}
      {activeSubTab === 'familiar' && (
        <FamiliarTab
          patientId={patientId}
          therapistId={therapistId}
        />
      )}

      {/* ── Prediagnóstico ── */}
      {activeSubTab === 'prediagnostico' && (
        <PrediagnosticoTab
          patientId={patientId}
          therapistId={therapistId}
        />
      )}

      {/* ── Análisis Clínicos ── */}
      {activeSubTab === 'analisis-clinicos' && (
        <AnalisisClanicosTab
          patientId={patientId}
          therapistId={therapistId}
        />
      )}

      {/* ── Pareja ── */}
      {activeSubTab === 'pareja' && (
        <ParejaTab
          patientId={patientId}
          therapistId={therapistId}
        />
      )}

      {/* ── Cuestionarios ── */}
      {activeSubTab === 'cuestionarios' && (
        <CuestionariosTab
          patientId={patientId}
          therapistId={therapistId}
        />
      )}
    </div>
  )
}
