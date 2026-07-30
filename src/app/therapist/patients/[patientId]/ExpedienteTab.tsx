'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import IndividualTab from './IndividualTab'
import ImpresionesTab from './ImpresionesTab'

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
interface Hijo {
  nombre: string
  edad: string
  ocupacion: string
  vive_en_casa: string
}

interface ExpedienteData {
  tipo_caso: string
  // Datos del Asesorado
  asesorado_nombre: string
  asesorado_sexo: string
  asesorado_edad: string
  asesorado_fecha_nacimiento: string
  asesorado_lugar_nacimiento: string
  asesorado_estado_civil: string
  asesorado_escolaridad: string
  asesorado_ocupacion: string
  asesorado_religion: string
  asesorado_parroquia: string
  // Datos de Contacto
  contacto_telefono: string
  contacto_domicilio: string
  // Datos de la Pareja
  pareja_nombre: string
  pareja_sexo: string
  pareja_edad: string
  pareja_fecha_nacimiento: string
  // Hijos (6 fijos)
  hijos: Hijo[]
  // Salud
  salud_padece_enfermedad: string
  salud_ayuda_psicologica: string
  salud_ayuda_tiempo: string
  salud_medicamentos: string
  salud_medicamentos_cual: string
}

const hijoVacio = (): Hijo => ({ nombre: '', edad: '', ocupacion: '', vive_en_casa: '' })

const expedienteVacio = (): ExpedienteData => ({
  tipo_caso: '',
  asesorado_nombre: '',
  asesorado_sexo: '',
  asesorado_edad: '',
  asesorado_fecha_nacimiento: '',
  asesorado_lugar_nacimiento: '',
  asesorado_estado_civil: '',
  asesorado_escolaridad: '',
  asesorado_ocupacion: '',
  asesorado_religion: '',
  asesorado_parroquia: '',
  contacto_telefono: '',
  contacto_domicilio: '',
  pareja_nombre: '',
  pareja_sexo: '',
  pareja_edad: '',
  pareja_fecha_nacimiento: '',
  hijos: Array(6).fill(null).map(hijoVacio),
  salud_padece_enfermedad: '',
  salud_ayuda_psicologica: '',
  salud_ayuda_tiempo: '',
  salud_medicamentos: '',
  salud_medicamentos_cual: '',
})

// ──────────────────────────────────────────────
// Helper components
// ──────────────────────────────────────────────
function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-semibold block mb-1" style={{ color: '#b243d5' }}>{children}</label>
  )
}

function TextInput({
  value, onChange, maxLength, placeholder, type = 'text',
}: {
  value: string
  onChange: (v: string) => void
  maxLength?: number
  placeholder?: string
  type?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      maxLength={maxLength}
      placeholder={placeholder}
      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700
                 focus:outline-none focus:ring-2 focus:ring-primary-300 transition"
    />
  )
}

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

function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="date"
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700
                 focus:outline-none focus:ring-2 focus:ring-primary-300 transition"
    />
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
// Props
// ──────────────────────────────────────────────
interface Props {
  patientId: string
  therapistId: string
  patientEmail: string | null
  patientName: string | null
}

// ──────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────
export default function ExpedienteTab({ patientId, therapistId, patientEmail, patientName }: Props) {
  const [data, setData] = useState<ExpedienteData>(expedienteVacio())
  const [saved, setSaved] = useState<ExpedienteData>(expedienteVacio())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveOk, setSaveOk] = useState(false)
  const [subTab, setSubTab] = useState<'datos-generales' | 'individual' | 'impresiones'>('datos-generales')

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
        .select('*')
        .eq('therapist_id', therapistId)
        .eq('patient_id', patientId)
        .maybeSingle()

      if (row) {
        // Normalizar los hijos: asegurar que siempre haya 6 slots
        const rawHijos: Hijo[] = Array.isArray(row.hijos) ? row.hijos : []
        const hijos: Hijo[] = Array(6).fill(null).map((_, i) => ({
          nombre: rawHijos[i]?.nombre ?? '',
          edad: rawHijos[i]?.edad ?? '',
          ocupacion: rawHijos[i]?.ocupacion ?? '',
          vive_en_casa: rawHijos[i]?.vive_en_casa ?? '',
        }))

        const parsed: ExpedienteData = {
          tipo_caso: row.tipo_caso ?? '',
          asesorado_nombre: row.asesorado_nombre ?? '',
          asesorado_sexo: row.asesorado_sexo ?? '',
          asesorado_edad: row.asesorado_edad ?? '',
          asesorado_fecha_nacimiento: row.asesorado_fecha_nacimiento ?? '',
          asesorado_lugar_nacimiento: row.asesorado_lugar_nacimiento ?? '',
          asesorado_estado_civil: row.asesorado_estado_civil ?? '',
          asesorado_escolaridad: row.asesorado_escolaridad ?? '',
          asesorado_ocupacion: row.asesorado_ocupacion ?? '',
          asesorado_religion: row.asesorado_religion ?? '',
          asesorado_parroquia: row.asesorado_parroquia ?? '',
          contacto_telefono: row.contacto_telefono ?? '',
          contacto_domicilio: row.contacto_domicilio ?? '',
          pareja_nombre: row.pareja_nombre ?? '',
          pareja_sexo: row.pareja_sexo ?? '',
          pareja_edad: row.pareja_edad ?? '',
          pareja_fecha_nacimiento: row.pareja_fecha_nacimiento ?? '',
          hijos,
          salud_padece_enfermedad: row.salud_padece_enfermedad ?? '',
          salud_ayuda_psicologica: row.salud_ayuda_psicologica ?? '',
          salud_ayuda_tiempo: row.salud_ayuda_tiempo ?? '',
          salud_medicamentos: row.salud_medicamentos ?? '',
          salud_medicamentos_cual: row.salud_medicamentos_cual ?? '',
        }
        setData(parsed)
        setSaved(parsed)
      }
    } finally {
      setLoading(false)
    }
  }

  function set<K extends keyof ExpedienteData>(key: K, value: ExpedienteData[K]) {
    setData(prev => ({ ...prev, [key]: value }))
  }

  function setHijo(index: number, field: keyof Hijo, value: string) {
    setData(prev => {
      const newHijos = prev.hijos.map((h, i) =>
        i === index ? { ...h, [field]: value } : h
      )
      return { ...prev, hijos: newHijos }
    })
  }

  async function save() {
    setSaving(true)
    try {
      const supabase = createClient()
      const cleanDate = (d: string) => d || null

      const payload = {
        therapist_id: therapistId,
        patient_id: patientId,
        tipo_caso: data.tipo_caso || null,
        asesorado_nombre: data.asesorado_nombre || null,
        asesorado_sexo: data.asesorado_sexo || null,
        asesorado_edad: data.asesorado_edad || null,
        asesorado_fecha_nacimiento: cleanDate(data.asesorado_fecha_nacimiento),
        asesorado_lugar_nacimiento: data.asesorado_lugar_nacimiento || null,
        asesorado_estado_civil: data.asesorado_estado_civil || null,
        asesorado_escolaridad: data.asesorado_escolaridad || null,
        asesorado_ocupacion: data.asesorado_ocupacion || null,
        asesorado_religion: data.asesorado_religion || null,
        asesorado_parroquia: data.asesorado_parroquia || null,
        contacto_telefono: data.contacto_telefono || null,
        contacto_domicilio: data.contacto_domicilio || null,
        pareja_nombre: data.pareja_nombre || null,
        pareja_sexo: data.pareja_sexo || null,
        pareja_edad: data.pareja_edad || null,
        pareja_fecha_nacimiento: cleanDate(data.pareja_fecha_nacimiento),
        hijos: data.hijos,
        salud_padece_enfermedad: data.salud_padece_enfermedad || null,
        salud_ayuda_psicologica: data.salud_ayuda_psicologica || null,
        salud_ayuda_tiempo: data.salud_ayuda_tiempo || null,
        salud_medicamentos: data.salud_medicamentos || null,
        salud_medicamentos_cual: data.salud_medicamentos_cual || null,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from('patient_expediente')
        .upsert(payload, { onConflict: 'therapist_id,patient_id' })

      if (error) {
        alert(`Error al guardar el expediente: ${error.message}`)
        return
      }

      setSaved({ ...data })
      setSaveOk(true)
      setTimeout(() => setSaveOk(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  const changed = JSON.stringify(data) !== JSON.stringify(saved)

  const SUB_TABS = [
    { id: 'datos-generales', label: 'Datos generales', ready: true },
    { id: 'individual',      label: 'Individual',      ready: true },
    { id: 'impresiones',     label: 'Impresiones',     ready: true },
    { id: 'pendiente-3',     label: 'Por definir',     ready: false },
    { id: 'pendiente-4',     label: 'Por definir',     ready: false },
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
            onClick={() => tab.ready && setSubTab(tab.id as 'datos-generales' | 'individual' | 'impresiones')}
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

      {/* ── Datos generales ── */}
      {subTab === 'datos-generales' && (
        <div className="space-y-5">

          {/* Tipo de caso */}
          <SectionCard title="Tipo de caso">
            <div className="max-w-xs">
              <SelectInput
                value={data.tipo_caso}
                onChange={v => set('tipo_caso', v)}
                options={['Individual', 'Familiar', 'Pareja']}
                placeholder="Selecciona el tipo de caso…"
              />
            </div>
          </SectionCard>

          {/* Datos del Asesorado */}
          <SectionCard title="Datos del Asesorado">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Nombre completo</Label>
                <TextInput
                  value={data.asesorado_nombre}
                  onChange={v => set('asesorado_nombre', v)}
                  maxLength={80}
                  placeholder="Nombre completo del asesorado"
                />
              </div>
              <div>
                <Label>Sexo</Label>
                <SelectInput
                  value={data.asesorado_sexo}
                  onChange={v => set('asesorado_sexo', v)}
                  options={['Masculino', 'Femenino', 'Prefiero no decir']}
                />
              </div>
              <div>
                <Label>Edad</Label>
                <TextInput
                  value={data.asesorado_edad}
                  onChange={v => set('asesorado_edad', v.replace(/\D/g, '').slice(0, 3))}
                  maxLength={3}
                  placeholder="Ej. 35"
                />
              </div>
              <div>
                <Label>Fecha de nacimiento</Label>
                <DateInput
                  value={data.asesorado_fecha_nacimiento}
                  onChange={v => set('asesorado_fecha_nacimiento', v)}
                />
              </div>
              <div>
                <Label>Lugar de nacimiento</Label>
                <TextInput
                  value={data.asesorado_lugar_nacimiento}
                  onChange={v => set('asesorado_lugar_nacimiento', v)}
                  maxLength={60}
                  placeholder="Ciudad, Estado"
                />
              </div>
              <div>
                <Label>Estado civil</Label>
                <SelectInput
                  value={data.asesorado_estado_civil}
                  onChange={v => set('asesorado_estado_civil', v)}
                  options={['Soltero/a', 'Casado/a', 'Separado/a', 'Divorciado/a', 'Viudo/a', 'Unión libre']}
                />
              </div>
              <div>
                <Label>Escolaridad máxima</Label>
                <SelectInput
                  value={data.asesorado_escolaridad}
                  onChange={v => set('asesorado_escolaridad', v)}
                  options={['Sin estudios', 'Primaria', 'Secundaria', 'Preparatoria / Bachillerato', 'Universidad / Licenciatura', 'Maestría', 'Doctorado']}
                />
              </div>
              <div>
                <Label>Ocupación</Label>
                <TextInput
                  value={data.asesorado_ocupacion}
                  onChange={v => set('asesorado_ocupacion', v)}
                  maxLength={40}
                  placeholder="Ej. Médico, Comerciante, Ama de casa…"
                />
              </div>
              <div>
                <Label>Religión</Label>
                <SelectInput
                  value={data.asesorado_religion}
                  onChange={v => set('asesorado_religion', v)}
                  options={['Católica', 'Judía', 'Protestante (cualquier denominación)', 'Musulmana', 'Agnóstico/a', 'Ateo/a', 'Otra']}
                />
              </div>
              <div>
                <Label>Parroquia a la que pertenece</Label>
                <TextInput
                  value={data.asesorado_parroquia}
                  onChange={v => set('asesorado_parroquia', v)}
                  maxLength={100}
                  placeholder="Nombre de la parroquia"
                />
              </div>
            </div>
          </SectionCard>

          {/* Datos de Contacto */}
          <SectionCard title="Datos de contacto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Teléfono</Label>
                <TextInput
                  value={data.contacto_telefono}
                  onChange={v => set('contacto_telefono', v)}
                  maxLength={20}
                  placeholder="Ej. 33 1234 5678"
                />
              </div>
              <div>
                <Label>Correo electrónico</Label>
                <input
                  type="email"
                  value={patientEmail ?? ''}
                  disabled
                  className="w-full px-3 py-2 rounded-xl border border-gray-100 text-sm
                             text-gray-400 bg-gray-50 cursor-not-allowed"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Domicilio</Label>
                <TextInput
                  value={data.contacto_domicilio}
                  onChange={v => set('contacto_domicilio', v)}
                  maxLength={200}
                  placeholder="Calle, número, colonia, ciudad"
                />
              </div>
            </div>
          </SectionCard>

          {/* Datos de la Pareja */}
          <SectionCard title="Datos de la pareja">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Nombre completo</Label>
                <TextInput
                  value={data.pareja_nombre}
                  onChange={v => set('pareja_nombre', v)}
                  maxLength={80}
                  placeholder="Nombre completo de la pareja"
                />
              </div>
              <div>
                <Label>Sexo</Label>
                <SelectInput
                  value={data.pareja_sexo}
                  onChange={v => set('pareja_sexo', v)}
                  options={['Masculino', 'Femenino', 'Prefiero no decir']}
                />
              </div>
              <div>
                <Label>Edad</Label>
                <TextInput
                  value={data.pareja_edad}
                  onChange={v => set('pareja_edad', v.replace(/\D/g, '').slice(0, 3))}
                  maxLength={3}
                  placeholder="Ej. 34"
                />
              </div>
              <div>
                <Label>Fecha de nacimiento</Label>
                <DateInput
                  value={data.pareja_fecha_nacimiento}
                  onChange={v => set('pareja_fecha_nacimiento', v)}
                />
              </div>
            </div>
          </SectionCard>

          {/* Datos de los hijos */}
          <SectionCard title="Datos de los hijos">
            <div className="overflow-x-auto -mx-1">
              <table className="w-full min-w-[540px] text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-xs font-semibold text-left pb-3 pr-2 w-6" style={{ color: '#b243d5' }}>#</th>
                    <th className="text-xs font-semibold text-left pb-3 pr-2" style={{ color: '#b243d5' }}>Nombre</th>
                    <th className="text-xs font-semibold text-left pb-3 pr-2 w-20" style={{ color: '#b243d5' }}>Edad</th>
                    <th className="text-xs font-semibold text-left pb-3 pr-2" style={{ color: '#b243d5' }}>Ocupación</th>
                    <th className="text-xs font-semibold text-left pb-3 w-32" style={{ color: '#b243d5' }}>Viven en casa</th>
                  </tr>
                </thead>
                <tbody>
                  {data.hijos.map((hijo, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-2 pr-2 text-xs text-gray-400 font-medium align-middle">{i + 1}</td>
                      <td className="py-2 pr-2">
                        <TextInput
                          value={hijo.nombre}
                          onChange={v => setHijo(i, 'nombre', v)}
                          maxLength={60}
                          placeholder="Nombre"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <TextInput
                          value={hijo.edad}
                          onChange={v => setHijo(i, 'edad', v.replace(/\D/g, '').slice(0, 3))}
                          maxLength={3}
                          placeholder="Edad"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <TextInput
                          value={hijo.ocupacion}
                          onChange={v => setHijo(i, 'ocupacion', v)}
                          maxLength={40}
                          placeholder="Ej. Estudiante"
                        />
                      </td>
                      <td className="py-2">
                        <SelectInput
                          value={hijo.vive_en_casa}
                          onChange={v => setHijo(i, 'vive_en_casa', v)}
                          options={['Sí', 'No']}
                          placeholder="—"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* Salud */}
          <SectionCard title="Salud">
            <div className="space-y-4">

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>¿Padece alguna enfermedad?</Label>
                  <SelectInput
                    value={data.salud_padece_enfermedad}
                    onChange={v => set('salud_padece_enfermedad', v)}
                    options={['Sí', 'No']}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>¿Ha recibido ayuda psicológica o psiquiátrica?</Label>
                  <SelectInput
                    value={data.salud_ayuda_psicologica}
                    onChange={v => {
                      set('salud_ayuda_psicologica', v)
                      if (v === 'No') set('salud_ayuda_tiempo', '')
                    }}
                    options={['Sí', 'No']}
                  />
                </div>
                {data.salud_ayuda_psicologica === 'Sí' && (
                  <div>
                    <Label>¿Hace cuánto tiempo?</Label>
                    <SelectInput
                      value={data.salud_ayuda_tiempo}
                      onChange={v => set('salud_ayuda_tiempo', v)}
                      options={[
                        'Menos de 1 año',
                        '1 año',
                        '2 años',
                        '3 años',
                        '4 años',
                        '5 años',
                        'Más de 5 años',
                      ]}
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>¿Toma medicamentos actualmente?</Label>
                  <SelectInput
                    value={data.salud_medicamentos}
                    onChange={v => {
                      set('salud_medicamentos', v)
                      if (v === 'No') set('salud_medicamentos_cual', '')
                    }}
                    options={['Sí', 'No']}
                  />
                </div>
                {data.salud_medicamentos === 'Sí' && (
                  <div>
                    <Label>¿Cuál(es)?</Label>
                    <TextInput
                      value={data.salud_medicamentos_cual}
                      onChange={v => set('salud_medicamentos_cual', v)}
                      maxLength={100}
                      placeholder="Nombre del medicamento"
                    />
                  </div>
                )}
              </div>

            </div>
          </SectionCard>

          {/* Botón guardar */}
          <div className="flex justify-end pt-1 pb-4">
            <button
              onClick={save}
              disabled={saving || !changed}
              className="px-6 py-3 bg-primary-600 text-white rounded-xl text-sm font-semibold
                         hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? 'Guardando…' : saveOk ? '✓ Guardado' : 'Guardar expediente'}
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

      {/* Placeholders para sub-tabs pendientes */}
      {(subTab as string).startsWith('pendiente') && (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <p className="text-gray-400 text-sm">Esta sección estará disponible próximamente.</p>
        </div>
      )}
    </div>
  )
}
