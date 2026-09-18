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
interface Props {
  patientId: string
  therapistId: string
  patientEmail: string | null
  patientName: string | null
}

// ──────────────────────────────────────────────
// Helper components
// ──────────────────────────────────────────────
function SelectInput({
  value, onChange, options, placeholder,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder?: string
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700
                 focus:outline-none focus:ring-2 focus:ring-primary-300 transition bg-white"
    >
      <option value="">{placeholder ?? 'Selecciona…'}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

function SectionCard({
  title, children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="border-b border-gray-100 pb-2 mb-5">
        <h4 className="text-sm font-semibold text-gray-700">{title}</h4>
      </div>
      {children}
    </div>
  )
}

// ──────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────
export default function ExpedienteTab({ patientId, therapistId, patientEmail: _patientEmail, patientName }: Props) {
  const [tipoCaso, setTipoCaso] = useState('')
  const [savedTipoCaso, setSavedTipoCaso] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveOk, setSaveOk] = useState(false)
  const [subTab, setSubTab] = useState<'tipo-caso' | 'individual' | 'familiar' | 'pareja' | 'prediagnostico' | 'analisis-clinicos' | 'impresiones' | 'cuestionarios'>('tipo-caso')

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
        setSavedTipoCaso(row.tipo_caso ?? '')
      }
    } finally {
      setLoading(false)
    }
  }

  async function save() {
    setSaving(true)
    try {
      const supabase = createClient()
      // NOTE: Only tipo_caso is managed here. Datos generales fields are managed by DatosGeneralesTab.
      const { error } = await supabase
        .from('patient_expediente')
        .upsert({
          therapist_id: therapistId,
          patient_id: patientId,
          tipo_caso: tipoCaso || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'therapist_id,patient_id' })

      if (error) {
        alert(`Error al guardar el tipo de caso: ${error.message}`)
        return
      }

      setSavedTipoCaso(tipoCaso)
      setSaveOk(true)
      setTimeout(() => setSaveOk(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  const changed = tipoCaso !== savedTipoCaso

  // Tabs bloqueados según el tipo de caso seleccionado
  const tabBloqueado = (id: string) => {
    if (!tipoCaso) return false
    if (id === 'individual') return tipoCaso !== 'Individual'
    if (id === 'familiar')   return tipoCaso !== 'Familiar'
    if (id === 'pareja')     return tipoCaso !== 'Pareja'
    return false
  }

  // Si el sub-tab activo queda bloqueado al cambiar tipo_caso, volver a Tipo de caso
  useEffect(() => {
    if (tabBloqueado(subTab)) setSubTab('tipo-caso')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoCaso])

  const SUB_TABS = [
    { id: 'tipo-caso',        label: 'Tipo de caso',       ready: true },
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

      {/* Sub-navegación */}
      <div className="flex gap-2 border-b border-gray-200 pb-3 overflow-x-auto">
        {SUB_TABS.map(tab => (
          <button
            key={tab.id}
            disabled={!tab.ready}
            onClick={() => tab.ready && setSubTab(tab.id as typeof subTab)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap
              ${subTab === tab.id && tab.ready
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

      {/* ── Tipo de caso ── */}
      {subTab === 'tipo-caso' && (
        <div className="space-y-5">
          <SectionCard title="Tipo de caso">
            <div className="max-w-xs">
              <SelectInput
                value={tipoCaso}
                onChange={v => setTipoCaso(v)}
                options={['Individual', 'Familiar', 'Pareja']}
                placeholder="Selecciona el tipo de caso…"
              />
            </div>
            <p className="mt-3 text-xs text-gray-400">
              El tipo de caso determina qué secciones del expediente están disponibles
              (Individual, Familiar o Pareja).
            </p>
          </SectionCard>

          {/* Botón guardar */}
          <div className="flex justify-end pt-1 pb-4">
            <button
              onClick={save}
              disabled={saving || !changed}
              className="px-6 py-3 bg-primary-600 text-white rounded-xl text-sm font-semibold
                         hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? 'Guardando…' : saveOk ? '✓ Guardado' : 'Guardar tipo de caso'}
            </button>
          </div>
        </div>
      )}

      {/* ── Individual ── */}
      {subTab === 'individual' && (
        <IndividualTab
          patientId={patientId}
          therapistId={therapistId}
          patientName={patientName}
        />
      )}

      {/* ── Impresiones ── */}
      {subTab === 'impresiones' && (
        <ImpresionesTab
          patientId={patientId}
          therapistId={therapistId}
          patientName={patientName}
        />
      )}

      {/* ── Familiar ── */}
      {subTab === 'familiar' && (
        <FamiliarTab
          patientId={patientId}
          therapistId={therapistId}
        />
      )}

      {/* ── Prediagnóstico ── */}
      {subTab === 'prediagnostico' && (
        <PrediagnosticoTab
          patientId={patientId}
          therapistId={therapistId}
        />
      )}

      {/* ── Análisis Clínicos ── */}
      {subTab === 'analisis-clinicos' && (
        <AnalisisClanicosTab
          patientId={patientId}
          therapistId={therapistId}
        />
      )}

      {/* ── Pareja ── */}
      {subTab === 'pareja' && (
        <ParejaTab
          patientId={patientId}
          therapistId={therapistId}
        />
      )}

      {/* ── Cuestionarios ── */}
      {subTab === 'cuestionarios' && (
        <CuestionariosTab
          patientId={patientId}
          therapistId={therapistId}
        />
      )}
    </div>
  )
}
