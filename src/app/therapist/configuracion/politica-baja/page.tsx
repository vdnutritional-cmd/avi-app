'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function PoliticaBajaPage() {
  const [politicaBaja, setPoliticaBaja] = useState<'auto' | 'off'>('auto')
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [guardado, setGuardado] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('profiles')
        .select('politica_baja')
        .eq('id', user.id)
        .single()

      if (data) {
        setPoliticaBaja((data.politica_baja === 'off') ? 'off' : 'auto')
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave() {
    setSaving(true)
    setGuardado(false)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    await supabase
      .from('profiles')
      .update({ politica_baja: politicaBaja })
      .eq('id', user.id)

    setSaving(false)
    setGuardado(true)
    setTimeout(() => setGuardado(false), 2500)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-sm text-gray-400">Cargando configuración…</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
      {/* Encabezado */}
      <div>
        <h1 className="text-xl font-bold text-gray-800">Política de baja de un paciente</h1>
        <p className="text-sm text-gray-400 mt-1">
          Configura cómo AVI gestiona el bloqueo de pacientes inactivos.
        </p>
      </div>

      {/* Toggle bloqueo automático */}
      <div className="bg-white border border-gray-100 rounded-2xl px-5 py-5 space-y-4 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-800">Bloqueo automático por inactividad</p>
            <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
              Cuando está activado, AVI bloquea automáticamente a los pacientes que no
              han tenido actividad según la frecuencia de sesiones configurada en su Nota Inicial.
            </p>
          </div>
          {/* Toggle switch */}
          <button
            type="button"
            onClick={() => setPoliticaBaja(prev => prev === 'auto' ? 'off' : 'auto')}
            className={`flex-shrink-0 relative inline-flex h-6 w-11 items-center rounded-full
                        transition-colors focus:outline-none
                        ${politicaBaja === 'auto' ? 'bg-primary-600' : 'bg-gray-200'}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow
                          transition-transform
                          ${politicaBaja === 'auto' ? 'translate-x-6' : 'translate-x-1'}`}
            />
          </button>
        </div>

        {/* Tabla de límites */}
        {politicaBaja === 'auto' && (
          <div className="bg-primary-50 border border-primary-100 rounded-xl px-4 py-3 space-y-2">
            <p className="text-xs font-semibold text-primary-700 uppercase tracking-wide">
              Días de inactividad antes del bloqueo
            </p>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Sesiones semanales</span>
                <span className="font-semibold text-primary-700">15 días</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Sesiones cada 2 semanas</span>
                <span className="font-semibold text-primary-700">30 días</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Sesiones mensuales</span>
                <span className="font-semibold text-primary-700">45 días</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Sin frecuencia definida</span>
                <span className="font-semibold text-primary-700">45 días</span>
              </div>
            </div>
            <p className="text-xs text-primary-500 pt-1 leading-relaxed">
              La frecuencia se configura en la <strong>Nota Inicial</strong> de cada paciente.
              El cron revisa diariamente a las 03:00 CDMX.
            </p>
          </div>
        )}

        {politicaBaja === 'off' && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-500 leading-relaxed">
              El bloqueo automático está <strong>desactivado</strong>. Tus pacientes no serán
              bloqueados por inactividad. Puedes bloquearlos manualmente desde la lista de pacientes
              con el botón <strong>🚫 Bloquear</strong>.
            </p>
          </div>
        )}
      </div>

      {/* Nota: bloqueo manual */}
      <div className="bg-white border border-gray-100 rounded-2xl px-5 py-4 shadow-sm space-y-1">
        <p className="text-sm font-semibold text-gray-800">🚫 Bloqueo manual</p>
        <p className="text-xs text-gray-400 leading-relaxed">
          Independientemente de esta configuración, siempre puedes bloquear o reactivar
          a cualquier paciente desde <strong>Mis pacientes</strong> usando el botón correspondiente
          en la tarjeta del paciente.
        </p>
      </div>

      {/* Botón guardar */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 rounded-2xl bg-primary-600 hover:bg-primary-700 text-white
                   text-sm font-semibold transition-colors disabled:opacity-50"
      >
        {saving ? 'Guardando…' : guardado ? '✅ Guardado' : 'Guardar configuración'}
      </button>
    </div>
  )
}
