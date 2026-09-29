'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  patientId: string
  therapistId: string
}

interface DerivacionesCierresData {
  derivacion_tipos:            string[]
  caso_riesgo:                 string
  asistencia_seguimiento:      string
  atencion_especializada:      string
  atencion_especializada_cual: string
  percepcion_alivio:           string
  sensacion_paciente_final:    string
  cambio_funcionamiento:       string
  abandono:                    boolean
}

const DEFAULT_DATA: DerivacionesCierresData = {
  derivacion_tipos:            [],
  caso_riesgo:                 'No aplica',
  asistencia_seguimiento:      'No aplica',
  atencion_especializada:      'No aplica',
  atencion_especializada_cual: '',
  percepcion_alivio:           'NO',
  sensacion_paciente_final:    'n/a',
  cambio_funcionamiento:       'NO',
  abandono:                    false,
}

const TIPOS_DERIVACION = [
  { key: 'Psicólogo',                  desc: 'Apoyo en salud mental, terapia individual o de grupo.' },
  { key: 'Psiquiatra',                 desc: 'Evaluación clínica y tratamiento farmacológico.' },
  { key: 'Especialista en Adicciones', desc: 'Tratamiento especializado de dependencias o conductas adictivas.' },
  { key: 'Ginecólogo',                 desc: 'Atención en salud reproductiva y sexual femenina.' },
  { key: 'Urólogo',                    desc: 'Atención en salud reproductiva y sexual masculina.' },
  { key: 'Otro Médico de la salud',    desc: 'Cualquier otro especialista médico no listado.' },
]

// Selector de opciones en pills
function PillSelector({
  options,
  value,
  onChange,
  colorActive = 'blue',
}: {
  options: string[]
  value: string
  onChange: (v: string) => void
  colorActive?: 'blue' | 'red' | 'teal'
}) {
  const activeClass = {
    blue: 'bg-blue-600 border-blue-600 text-white font-semibold',
    red:  'bg-red-500  border-red-500  text-white font-semibold',
    teal: 'bg-teal-600 border-teal-600 text-white font-semibold',
  }[colorActive]

  return (
    <div className="flex gap-2 flex-wrap mt-1">
      {options.map(op => (
        <button
          key={op}
          type="button"
          onClick={() => onChange(op)}
          className={`px-4 py-1.5 rounded-full border text-sm transition-all
            ${value === op
              ? activeClass
              : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700'
            }`}
        >
          {op}
        </button>
      ))}
    </div>
  )
}

// Pregunta en bloque destacado
function Pregunta({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-gray-600 leading-relaxed italic bg-gray-50 rounded-xl px-4 py-2.5 border-l-4 border-gray-200">
      {children}
    </p>
  )
}

// Etiqueta de campo
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
      {children}
    </p>
  )
}

export default function DerivacionesCierresTab({ patientId, therapistId }: Props) {
  const [data, setData]                     = useState<DerivacionesCierresData>(DEFAULT_DATA)
  const [loading, setLoading]               = useState(true)
  const [saving, setSaving]                 = useState(false)
  const [saved, setSaved]                   = useState(false)
  const [enviandoCuest, setEnviandoCuest]   = useState(false)
  const [cuestionarioPendiente, setCuestionarioPendiente] = useState(false)

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

    // Verificar cuestionario sensacion_final pendiente
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

  function toggleTipo(key: string) {
    setData(prev => ({
      ...prev,
      derivacion_tipos: prev.derivacion_tipos.includes(key)
        ? prev.derivacion_tipos.filter(t => t !== key)
        : [...prev.derivacion_tipos, key],
    }))
  }

  async function handleGuardar() {
    setSaving(true)
    const supabase = createClient()

    const { error } = await supabase
      .from('patient_derivaciones_cierres')
      .upsert({
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
      }, { onConflict: 'therapist_id,patient_id' })

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

      {/* ══════════════════════════════════════════════
          SECCIÓN 1 — DERIVACIONES
      ══════════════════════════════════════════════ */}
      <section className="space-y-6">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100 pb-2">
          Derivaciones
        </h3>

        {/* Tipos de derivación */}
        <div className="space-y-2">
          <FieldLabel>Tipo de profesional al que se deriva</FieldLabel>
          <div className="space-y-3 mt-2">
            {TIPOS_DERIVACION.map(t => (
              <label key={t.key} className="flex items-start gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={data.derivacion_tipos.includes(t.key)}
                  onChange={() => toggleTipo(t.key)}
                  className="w-4 h-4 rounded mt-0.5 flex-shrink-0"
                  style={{ accentColor: '#2563eb' }}
                />
                <div>
                  <p className="text-sm font-medium text-gray-700 leading-snug group-hover:text-gray-900">
                    {t.key}
                  </p>
                  <p className="text-xs text-gray-400 leading-snug mt-0.5">{t.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* caso_riesgo */}
        <div className="space-y-2">
          <FieldLabel>Caso de riesgo</FieldLabel>
          <Pregunta>
            ¿Consideras que es un <strong>CASO DE RIESGO</strong> porque te ha manifestado que tiene una ideación
            suicida, o experimenta violencia o peligro de agresión en la que peligre su seguridad o su vida?
          </Pregunta>
          <PillSelector
            options={['No aplica', 'SI', 'NO']}
            value={data.caso_riesgo}
            onChange={v => setData(prev => ({ ...prev, caso_riesgo: v }))}
            colorActive="red"
          />
        </div>

        {/* asistencia_seguimiento */}
        <div className="space-y-2">
          <FieldLabel>Asistencia al seguimiento</FieldLabel>
          <Pregunta>
            En caso de Derivación ¿consideras que se requiere una <strong>ASISTENCIA AL SEGUIMIENTO</strong>?
            esto es, darle seguimiento como acompañamiento terapéutico al caso durante la derivación y/o después de ella.
          </Pregunta>
          <PillSelector
            options={['No aplica', 'SI', 'NO']}
            value={data.asistencia_seguimiento}
            onChange={v => setData(prev => ({ ...prev, asistencia_seguimiento: v }))}
            colorActive="blue"
          />
        </div>

        {/* atencion_especializada */}
        <div className="space-y-2">
          <FieldLabel>Atención especializada</FieldLabel>
          <PillSelector
            options={['No aplica', 'SI', 'NO']}
            value={data.atencion_especializada}
            onChange={v => setData(prev => ({
              ...prev,
              atencion_especializada: v,
              atencion_especializada_cual: v !== 'SI' ? '' : prev.atencion_especializada_cual,
            }))}
            colorActive="blue"
          />
          {data.atencion_especializada === 'SI' && (
            <div className="mt-3">
              <label className="text-xs font-medium text-gray-500 block mb-1">
                ¿Cuál atención especializada?
              </label>
              <textarea
                value={data.atencion_especializada_cual}
                onChange={e => setData(prev => ({ ...prev, atencion_especializada_cual: e.target.value }))}
                rows={2}
                placeholder="Describe la atención especializada requerida..."
                className="w-full text-sm rounded-xl border border-gray-200 px-3 py-2.5
                           focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none placeholder-gray-300"
              />
            </div>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          SECCIÓN 2 — CIERRES
      ══════════════════════════════════════════════ */}
      <section className="space-y-6">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100 pb-2">
          Cierres
        </h3>

        {/* percepcion_alivio */}
        <div className="space-y-2">
          <FieldLabel>Percepción de alivio</FieldLabel>
          <Pregunta>
            ¿Consideras que a tu asesorado o paciente ya lo puedes dar de alta para seguir solo con las
            herramientas que le has dado?
          </Pregunta>
          <PillSelector
            options={['NO', 'SI']}
            value={data.percepcion_alivio}
            onChange={v => setData(prev => ({ ...prev, percepcion_alivio: v }))}
            colorActive="teal"
          />
        </div>

        {/* sensacion_paciente_final — solo cuando percepcion_alivio = SI */}
        {data.percepcion_alivio === 'SI' && (
          <div className="bg-teal-50 border border-teal-200 rounded-2xl px-5 py-5 space-y-4">
            <FieldLabel>Sensación del paciente al cierre</FieldLabel>
            <Pregunta>
              <em>
                "Considerando que ya te ves mucho mejor que cuando iniciaste tu proceso de Acompañamiento
                Terapéutico, por favor responde: Del 1 al 10 me puedes indicar por favor ¿Cómo te sientes en
                este momento?, donde 1 es pésimo (muy muy mal), y 10 es excelente."
              </em>
            </Pregunta>

            {/* Valor actual */}
            <div className="flex items-center gap-3 pt-1">
              <span className={`text-4xl font-bold ${
                sensacionNum === null ? 'text-gray-300'
                  : sensacionNum >= 8 ? 'text-teal-600'
                  : sensacionNum >= 5 ? 'text-amber-500'
                  : 'text-red-500'
              }`}>
                {sensacionNum === null ? '—' : sensacionNum}
              </span>
              {sensacionNum !== null && <span className="text-sm text-gray-400">/ 10</span>}
              {sensacionNum !== null && (
                <span className={`text-xs font-medium px-2 py-1 rounded-full ml-1 ${
                  sensacionNum >= 8 ? 'bg-teal-100 text-teal-700'
                    : sensacionNum >= 5 ? 'bg-amber-100 text-amber-700'
                    : 'bg-red-100 text-red-600'
                }`}>
                  {sensacionNum >= 8 ? 'Excelente' : sensacionNum >= 5 ? 'Regular' : 'Bajo'}
                </span>
              )}
            </div>

            {sensacionNum === null && (
              cuestionarioPendiente ? (
                <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50
                                border border-amber-200 rounded-xl px-4 py-2.5">
                  <span>⏳</span>
                  <span>Cuestionario enviado — esperando respuesta del paciente</span>
                </div>
              ) : (
                <button
                  onClick={handleEnviarCuestionario}
                  disabled={enviandoCuest}
                  className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-700 text-white text-sm
                             font-semibold rounded-xl transition-colors disabled:opacity-50"
                >
                  {enviandoCuest ? 'Enviando...' : '📩 Enviar cuestionario al paciente'}
                </button>
              )
            )}
          </div>
        )}

        {/* cambio_funcionamiento */}
        <div className="space-y-2">
          <FieldLabel>Cambio de funcionamiento</FieldLabel>
          <Pregunta>
            ¿Consideras que ya no está funcionando tu acompañamiento y debes modificar las herramientas
            que funcionen mejor para el asesorado o paciente?
          </Pregunta>
          <PillSelector
            options={['NO', 'SI']}
            value={data.cambio_funcionamiento}
            onChange={v => setData(prev => ({ ...prev, cambio_funcionamiento: v }))}
            colorActive="teal"
          />
        </div>

        {/* abandono */}
        <div className="space-y-2">
          <FieldLabel>Abandono del proceso</FieldLabel>
          <label className="flex items-start gap-2.5 cursor-pointer group">
            <input
              type="checkbox"
              checked={data.abandono}
              onChange={e => setData(prev => ({ ...prev, abandono: e.target.checked }))}
              className="w-4 h-4 rounded mt-0.5 flex-shrink-0"
              style={{ accentColor: '#ef4444' }}
            />
            <div>
              <p className="text-sm font-medium text-gray-700 leading-snug group-hover:text-gray-900">
                Marcar como abandono
              </p>
              <p className="text-xs text-gray-400 leading-snug mt-0.5">
                Se activa automáticamente cuando el paciente pierde acceso a AVI por inactividad.
                También puedes activarlo manualmente.
              </p>
            </div>
          </label>
          {data.abandono && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50
                            border border-red-200 rounded-xl px-4 py-2.5 mt-1">
              <span>⚠️</span>
              <span>Este paciente está marcado como abandono del proceso.</span>
            </div>
          )}
        </div>
      </section>

      {/* Botón guardar */}
      <div className="flex items-center justify-end gap-3 pb-6">
        {saved && (
          <span className="text-sm text-green-600 font-medium">✓ Guardado</span>
        )}
        <button
          onClick={handleGuardar}
          disabled={saving}
          className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm
                     font-semibold rounded-xl transition-colors disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>

    </div>
  )
}
