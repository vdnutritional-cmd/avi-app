'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  patientId: string
  therapistId: string
}

interface DerivacionesCierresData {
  id?: string
  derivacion_tipos: string[]
  caso_riesgo: string
  asistencia_seguimiento: string
  atencion_especializada: string
  atencion_especializada_cual: string
  percepcion_alivio: string
  sensacion_paciente_final: string
  cambio_funcionamiento: string
  abandono: boolean
}

const DEFAULT_DATA: DerivacionesCierresData = {
  derivacion_tipos:           [],
  caso_riesgo:                'No aplica',
  asistencia_seguimiento:     'No aplica',
  atencion_especializada:     'No aplica',
  atencion_especializada_cual: '',
  percepcion_alivio:          'NO',
  sensacion_paciente_final:   'n/a',
  cambio_funcionamiento:      'NO',
  abandono:                   false,
}

const TIPOS_DERIVACION = [
  'Psicólogo',
  'Psiquiatra',
  'Especialista en Adicciones',
  'Ginecólogo',
  'Urólogo',
  'Otro Médico de la salud',
]

export default function DerivacionesCierresTab({ patientId, therapistId }: Props) {
  const [data, setData]           = useState<DerivacionesCierresData>(DEFAULT_DATA)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [enviandoCuest, setEnviandoCuest] = useState(false)
  const [cuestionarioPendiente, setCuestionarioPendiente] = useState(false)
  const [saved, setSaved]         = useState(false)

  async function fetchData() {
    const supabase = createClient()

    const { data: row } = await supabase
      .from('patient_derivaciones_cierres')
      .select('*')
      .eq('therapist_id', therapistId)
      .eq('patient_id', patientId)
      .maybeSingle()

    if (row) {
      setData({
        id:                          row.id,
        derivacion_tipos:            Array.isArray(row.derivacion_tipos) ? row.derivacion_tipos : [],
        caso_riesgo:                 row.caso_riesgo                 ?? 'No aplica',
        asistencia_seguimiento:      row.asistencia_seguimiento      ?? 'No aplica',
        atencion_especializada:      row.atencion_especializada      ?? 'No aplica',
        atencion_especializada_cual: row.atencion_especializada_cual ?? '',
        percepcion_alivio:           row.percepcion_alivio           ?? 'NO',
        sensacion_paciente_final:    row.sensacion_paciente_final    ?? 'n/a',
        cambio_funcionamiento:       row.cambio_funcionamiento       ?? 'NO',
        abandono:                    row.abandono                    ?? false,
      })
    }

    // Verificar si hay un cuestionario sensacion_final pendiente
    const { data: quests } = await supabase
      .from('patient_questionnaires')
      .select('id, status')
      .eq('patient_id', patientId)
      .eq('therapist_id', therapistId)
      .eq('questionnaire_type', 'sensacion_final')
      .order('assigned_at', { ascending: false })
      .limit(1)

    if (quests && quests.length > 0 && quests[0].status === 'pending') {
      setCuestionarioPendiente(true)
    }

    setLoading(false)
  }

  useEffect(() => { fetchData() }, [patientId, therapistId])

  function toggleTipo(tipo: string) {
    setData(prev => {
      const tipos = prev.derivacion_tipos.includes(tipo)
        ? prev.derivacion_tipos.filter(t => t !== tipo)
        : [...prev.derivacion_tipos, tipo]
      return { ...prev, derivacion_tipos: tipos }
    })
  }

  async function handleGuardar() {
    setSaving(true)
    const supabase = createClient()

    const payload = {
      therapist_id:                therapistId,
      patient_id:                  patientId,
      derivacion_tipos:            data.derivacion_tipos,
      caso_riesgo:                 data.caso_riesgo,
      asistencia_seguimiento:      data.asistencia_seguimiento,
      atencion_especializada:      data.atencion_especializada,
      atencion_especializada_cual: data.atencion_especializada === 'SI'
                                     ? data.atencion_especializada_cual
                                     : null,
      percepcion_alivio:           data.percepcion_alivio,
      cambio_funcionamiento:       data.cambio_funcionamiento,
      abandono:                    data.abandono,
    }

    const { error } = await supabase
      .from('patient_derivaciones_cierres')
      .upsert(payload, { onConflict: 'therapist_id,patient_id' })

    if (error) {
      alert('Error al guardar: ' + error.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      await fetchData()
    }

    setSaving(false)
  }

  async function handleEnviarCuestionario() {
    setEnviandoCuest(true)
    const supabase = createClient()

    const { error } = await supabase
      .from('patient_questionnaires')
      .insert({
        patient_id:         patientId,
        therapist_id:       therapistId,
        questionnaire_type: 'sensacion_final',
        title:              'Sensación Final',
        status:             'pending',
      })

    if (error) {
      alert('Error al enviar el cuestionario: ' + error.message)
    } else {
      setCuestionarioPendiente(true)
    }

    setEnviandoCuest(false)
  }

  if (loading) {
    return <div className="py-12 text-center text-gray-400 text-sm">Cargando...</div>
  }

  const sensacionNum = data.sensacion_paciente_final === 'n/a'
    ? null
    : parseInt(data.sensacion_paciente_final, 10)

  return (
    <div className="space-y-8">

      {/* ═══════════════════════════════════════════════
          SECCIÓN 1: DERIVACIONES
      ═══════════════════════════════════════════════ */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
        <h3 className="font-semibold text-gray-800 text-base border-b border-gray-100 pb-3">
          Derivaciones
        </h3>

        {/* derivacion_tipos — checkboxes */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Tipo de profesional al que se deriva
          </label>
          <div className="grid grid-cols-1 gap-2 mt-2">
            {TIPOS_DERIVACION.map(tipo => (
              <label
                key={tipo}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200
                           hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-colors select-none"
              >
                <input
                  type="checkbox"
                  checked={data.derivacion_tipos.includes(tipo)}
                  onChange={() => toggleTipo(tipo)}
                  className="w-4 h-4 rounded accent-blue-600"
                />
                <span className="text-sm text-gray-700">{tipo}</span>
              </label>
            ))}
          </div>
        </div>

        {/* caso_riesgo */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block">
            Caso de riesgo
          </label>
          <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
            ¿Consideras que es un <strong>CASO DE RIESGO</strong> porque te ha manifestado que tiene una ideación
            suicida, o experimenta violencia o peligro de agresión en la que peligre su seguridad o su vida?
          </p>
          <select
            value={data.caso_riesgo}
            onChange={e => setData(prev => ({ ...prev, caso_riesgo: e.target.value }))}
            className="w-full text-sm rounded-xl border border-gray-200 bg-white px-3 py-2.5
                       focus:outline-none focus:ring-2 focus:ring-blue-300 text-gray-700"
          >
            <option value="No aplica">No aplica</option>
            <option value="SI">SI</option>
            <option value="NO">NO</option>
          </select>
        </div>

        {/* asistencia_seguimiento */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block">
            Asistencia al seguimiento
          </label>
          <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
            En caso de Derivación ¿consideras que se requiere una <strong>ASISTENCIA AL SEGUIMIENTO</strong>? esto es,
            darle seguimiento como acompañamiento terapéutico al caso durante la derivación y/o después de ella.
          </p>
          <select
            value={data.asistencia_seguimiento}
            onChange={e => setData(prev => ({ ...prev, asistencia_seguimiento: e.target.value }))}
            className="w-full text-sm rounded-xl border border-gray-200 bg-white px-3 py-2.5
                       focus:outline-none focus:ring-2 focus:ring-blue-300 text-gray-700"
          >
            <option value="No aplica">No aplica</option>
            <option value="SI">SI</option>
            <option value="NO">NO</option>
          </select>
        </div>

        {/* atencion_especializada */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block">
            Atención especializada
          </label>
          <select
            value={data.atencion_especializada}
            onChange={e => setData(prev => ({
              ...prev,
              atencion_especializada: e.target.value,
              atencion_especializada_cual: e.target.value !== 'SI' ? '' : prev.atencion_especializada_cual,
            }))}
            className="w-full text-sm rounded-xl border border-gray-200 bg-white px-3 py-2.5
                       focus:outline-none focus:ring-2 focus:ring-blue-300 text-gray-700"
          >
            <option value="No aplica">No aplica</option>
            <option value="SI">SI</option>
            <option value="NO">NO</option>
          </select>

          {/* atencion_especializada_cual — solo cuando SI */}
          {data.atencion_especializada === 'SI' && (
            <div className="mt-2">
              <label className="text-xs font-medium text-gray-500 block mb-1">
                ¿Cuál atención especializada?
              </label>
              <textarea
                value={data.atencion_especializada_cual}
                onChange={e => setData(prev => ({ ...prev, atencion_especializada_cual: e.target.value }))}
                rows={2}
                placeholder="Describe la atención especializada requerida..."
                className="w-full text-sm rounded-xl border border-gray-200 px-3 py-2.5
                           focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none placeholder-gray-400"
              />
            </div>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          SECCIÓN 2: CIERRES
      ═══════════════════════════════════════════════ */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
        <h3 className="font-semibold text-gray-800 text-base border-b border-gray-100 pb-3">
          Cierres
        </h3>

        {/* percepcion_alivio */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block">
            Percepción de alivio
          </label>
          <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
            ¿Consideras que a tu asesorado o paciente ya lo puedes dar de alta para seguir solo con las herramientas
            que le has dado?
          </p>
          <select
            value={data.percepcion_alivio}
            onChange={e => setData(prev => ({ ...prev, percepcion_alivio: e.target.value }))}
            className="w-full text-sm rounded-xl border border-gray-200 bg-white px-3 py-2.5
                       focus:outline-none focus:ring-2 focus:ring-teal-300 text-gray-700"
          >
            <option value="NO">NO</option>
            <option value="SI">SI</option>
          </select>
        </div>

        {/* sensacion_paciente_final — solo visible cuando percepcion_alivio = SI */}
        {data.percepcion_alivio === 'SI' && (
          <div className="space-y-3 bg-teal-50 border border-teal-200 rounded-2xl px-5 py-4">
            <label className="text-xs font-semibold text-teal-700 uppercase tracking-wide block">
              Sensación del paciente al cierre
            </label>
            <p className="text-xs text-teal-600 leading-relaxed">
              Cuestionario enviado al paciente: <em>"Considerando que ya te ves mucho mejor que cuando iniciaste tu
              proceso de Acompañamiento Terapéutico, por favor responde: Del 1 al 10 me puedes indicar por favor
              ¿Cómo te sientes en este momento?, donde 1 es pésimo (muy muy mal), y 10 es excelente."</em>
            </p>

            {/* Valor actual */}
            <div className="flex items-center gap-3">
              <div className={`text-3xl font-bold ${
                sensacionNum === null
                  ? 'text-gray-400'
                  : sensacionNum >= 7
                    ? 'text-teal-600'
                    : sensacionNum >= 4
                      ? 'text-amber-600'
                      : 'text-red-500'
              }`}>
                {sensacionNum === null ? 'n/a' : sensacionNum}
              </div>
              {sensacionNum !== null && (
                <span className="text-sm text-gray-500">/ 10</span>
              )}
            </div>

            {/* Botón enviar cuestionario al paciente */}
            {sensacionNum === null && (
              cuestionarioPendiente ? (
                <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                  <span className="text-base">⏳</span>
                  <span>Cuestionario enviado, esperando respuesta del paciente</span>
                </div>
              ) : (
                <button
                  onClick={handleEnviarCuestionario}
                  disabled={enviandoCuest}
                  className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold
                             rounded-xl transition-colors disabled:opacity-50"
                >
                  {enviandoCuest ? 'Enviando...' : '📩 Enviar cuestionario al paciente'}
                </button>
              )
            )}
          </div>
        )}

        {/* cambio_funcionamiento */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block">
            Cambio de funcionamiento
          </label>
          <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
            ¿Consideras que ya no está funcionando tu acompañamiento y debes modificar las herramientas que
            funcionen mejor para el asesorado o paciente?
          </p>
          <select
            value={data.cambio_funcionamiento}
            onChange={e => setData(prev => ({ ...prev, cambio_funcionamiento: e.target.value }))}
            className="w-full text-sm rounded-xl border border-gray-200 bg-white px-3 py-2.5
                       focus:outline-none focus:ring-2 focus:ring-teal-300 text-gray-700"
          >
            <option value="NO">NO</option>
            <option value="SI">SI</option>
          </select>
        </div>

        {/* abandono */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block">
            Abandono del proceso
          </label>
          <label className="flex items-start gap-3 px-4 py-3 rounded-xl border border-gray-200
                            hover:border-red-300 hover:bg-red-50 cursor-pointer transition-colors select-none">
            <input
              type="checkbox"
              checked={data.abandono}
              onChange={e => setData(prev => ({ ...prev, abandono: e.target.checked }))}
              className="w-4 h-4 mt-0.5 rounded accent-red-600"
            />
            <div>
              <span className="text-sm text-gray-700 font-medium">Marcar como abandono</span>
              <p className="text-xs text-gray-400 mt-0.5">
                Se activa automáticamente cuando el paciente pierde acceso a AVI por inactividad.
                También puedes activarlo manualmente.
              </p>
            </div>
          </label>
          {data.abandono && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
              <span>⚠️</span>
              <span>Este paciente está marcado como abandono del proceso.</span>
            </div>
          )}
        </div>
      </section>

      {/* Botón guardar */}
      <div className="flex items-center justify-end gap-3 pb-4">
        {saved && (
          <span className="text-sm text-green-600 font-medium">✓ Guardado correctamente</span>
        )}
        <button
          onClick={handleGuardar}
          disabled={saving}
          className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold
                     rounded-xl transition-colors disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>

    </div>
  )
}
