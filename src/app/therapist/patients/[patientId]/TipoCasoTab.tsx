'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── Opciones ─────────────────────────────────────────────────────────────────

const TIPO_CASO_OPTIONS = ['Individual', 'Familiar', 'Pareja']

const PROBLEMATICA_OPTIONS = [
  'Ansiedad',
  'Depresión',
  'Duelo',
  'Trauma / TEPT',
  'Relaciones de pareja',
  'Conflictos familiares',
  'Crianza y parentalidad',
  'Trastornos alimentarios',
  'Adicciones',
  'Autoestima y desarrollo personal',
  'Manejo del estrés',
  'Orientación vocacional / vida laboral',
  'Problemas de conducta en niños',
  'Habilidades sociales',
  'Identidad y etapa de vida',
  'Sexualidad',
  'Fobias y TOC',
  'Otro',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder?: string
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700
                   focus:outline-none focus:ring-2 focus:ring-primary-300 transition bg-white"
      >
        <option value="">{placeholder ?? 'Selecciona…'}</option>
        {options.map(o => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  patientId: string
  therapistId: string
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function TipoCasoTab({ patientId, therapistId }: Props) {
  const [tipoCaso,    setTipoCaso]    = useState('')
  const [problematica, setProblematica] = useState('')

  const [savedTipoCaso,    setSavedTipoCaso]    = useState('')
  const [savedProblematica, setSavedProblematica] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saveOk,  setSaveOk]  = useState(false)

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId])

  async function load() {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('patient_expediente')
        .select('tipo_caso, problematica')
        .eq('therapist_id', therapistId)
        .eq('patient_id', patientId)
        .maybeSingle()

      if (data) {
        setTipoCaso(data.tipo_caso ?? '')
        setSavedTipoCaso(data.tipo_caso ?? '')
        setProblematica(data.problematica ?? '')
        setSavedProblematica(data.problematica ?? '')
      }
    } finally {
      setLoading(false)
    }
  }

  async function save() {
    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('patient_expediente')
        .upsert({
          therapist_id: therapistId,
          patient_id:   patientId,
          tipo_caso:    tipoCaso    || null,
          problematica: problematica || null,
          updated_at:   new Date().toISOString(),
        }, { onConflict: 'therapist_id,patient_id' })

      if (error) {
        alert(`Error al guardar: ${error.message}`)
        return
      }

      setSavedTipoCaso(tipoCaso)
      setSavedProblematica(problematica)
      setSaveOk(true)
      setTimeout(() => setSaveOk(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  const changed = tipoCaso !== savedTipoCaso || problematica !== savedProblematica

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-gray-400 text-sm">
        Cargando…
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-lg">

      {/* Card */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">

        <SelectField
          label="Tipo de caso"
          value={tipoCaso}
          onChange={v => setTipoCaso(v)}
          options={TIPO_CASO_OPTIONS}
          placeholder="Selecciona el tipo de caso…"
        />

        <p className="text-xs text-gray-400 -mt-2">
          El tipo de caso determina qué secciones del AVI-CLÍNICO están disponibles
          (Individual, Familiar o Pareja).
        </p>

        <SelectField
          label="Problemática principal"
          value={problematica}
          onChange={v => setProblematica(v)}
          options={PROBLEMATICA_OPTIONS}
          placeholder="Selecciona la problemática…"
        />

      </div>

      {/* Botón guardar */}
      <div className="flex justify-end">
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
