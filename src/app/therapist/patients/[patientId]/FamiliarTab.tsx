'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── Constantes ────────────────────────────────────────────────────────────────
const FUNCIONES_FAMILIARES = [
  { key: 'necesidades_fisicas',        label: 'Satisfacer necesidades físicas y afectivas.' },
  { key: 'socializacion',              label: 'Socialización de los miembros.' },
  { key: 'reproduccion',               label: 'Reproducción, incorporación y liberación de sus miembros.' },
  { key: 'distribucion_recursos',      label: 'Distribución de recursos y División del trabajo.' },
  { key: 'desarrollo_individual',      label: 'Favorecer el desarrollo individual de sus miembros.' },
  { key: 'conservacion_orden',         label: 'Conservación del orden (respeto por los límites).' },
  { key: 'integracion_social',         label: 'Integración en el núcleo social.' },
  { key: 'supervivencia_hijos',        label: 'Asegurar la supervivencia de sus hijos.' },
  { key: 'construccion_adultos',       label: 'Construcción de personas adultas con autoestima y sentido de sí mismos, en un clima de bienestar psicológico.' },
  { key: 'afrontar_retos',             label: 'Aprender a afrontar retos como asumir responsabilidades y compromisos que orientan a la dimensión productiva.' },
  { key: 'encuentro_intergeneracional',label: 'Encuentro intergeneracional.' },
  { key: 'red_apoyo',                  label: 'Red de apoyo social.' },
]

const MATERNAJE_OPTS = ['Sincronía', 'Mutualidad', 'Apoyo emocional', 'Afecto']

const PATERNAJE_OPTS = [
  'Ausencia de conductas paternas',
  'Aversión',
  'Queja de los hijos',
  'Respuestas violentas o agresivas',
  'Refuerzo de conductas',
  'Respuesta reactiva (acting out)',
  'Respuesta aversiva',
]

const DISFUNC_FUNCIONAL_OPTS = [
  'Autónoma (equilibrio entre la unión afectiva de sus miembros y la independencia individual de sus miembros)',
  'Nutricia (entorno de crecimiento, salud mental y soporte emocional. Las relaciones se basan en el amor, el respeto y la confianza mutua)',
]

const DISFUNC_DISFUNCIONAL_OPTS = [
  'Simbiótica (los límites entre sus miembros no existen, perdiendo los miembros su identidad individual: familia muégano)',
  'Dependiente (dependencia absoluta de uno o varios miembros, ya sea física, emocional, económica o adicción: fármacos, trabajo, deporte, etc.)',
  'Doble vínculo (presencia de patrones de mensajes contradictorios que no se pueden resolver: Incongruencia)',
  'Reactiva (reacciona de forma desadaptada en respuesta directa a un evento estresante: Familia impulsiva o agresiva)',
]

const TIPO_DISFUNC_OPTS = [
  'Conducta: reactividad, impulsividad, agresividad.',
  'Socialización: aprendizajes sociales, eventos traumáticos.',
  'Expresión o comunicación: agresividad, superficial, fragmentada, doble vínculo, barreras comunicacionales, no congruencia, maximización, minimización, aprehensión, racionalización.',
  'Límites: vulnerabilidad, dependencia, manipulación, resolución de conflictos.',
  'Afectividad: evitación, inseguridad, desorganización, ambivalencia, somatización, autoestima.',
  'Dinámica traumática: congelamiento, pelea, fenómenos contextuales.',
]

const FACTORES_RIESGO = [
  { key: 'limites_difusos',         titulo: 'Límites difusos o rígidos',              desc: 'Familias aglutinadas (donde no hay individualidad ni privacidad) o familias desligadas (donde hay desapego extremo y falta de apoyo).' },
  { key: 'triangulacion',           titulo: 'Triangulación',                           desc: 'Involucrar a un tercero (frecuentemente un hijo) para desviar el conflicto entre dos miembros (generalmente la pareja).' },
  { key: 'parentificacion',         titulo: 'Parentificación',                         desc: 'Inversión de roles donde un hijo asume responsabilidades parentales, emocionales o económicas que no corresponden a su edad.' },
  { key: 'comunicacion_patologica', titulo: 'Comunicación patológica',                 desc: 'Presencia de dobles mensajes (mensajes contradictorios), descalificaciones continuas o secretos familiares disfuncionales.' },
  { key: 'rigidez_homeostatica',    titulo: 'Rigidez homeostática',                    desc: 'Incapacidad del sistema para cambiar y adaptarse a las nuevas etapas del ciclo vital (ej. tratar a un adolescente como si fuera un niño pequeño).' },
  { key: 'alianzas_destructivas',   titulo: 'Alianzas e interacciones destructivas',   desc: 'Coaliciones (unión de dos miembros contra un tercero) que rompen las jerarquías naturales de la familia.' },
]

const FACTORES_PROTECCION = [
  { key: 'limites_claros',          titulo: 'Límites claros y flexibles',              desc: 'Reglas comprensibles que definen los roles de cada uno, permitiendo la cercanía emocional sin perder la autonomía individual.' },
  { key: 'cohesion_familiar',       titulo: 'Cohesión familiar',                       desc: 'Sentimiento de pertenencia, afecto mutuo y apoyo emocional disponible entre los miembros del grupo.' },
  { key: 'comunicacion_asertiva',   titulo: 'Comunicación asertiva y abierta',         desc: 'Capacidad para expresar emociones, resolver conflictos de forma directa y validar los puntos de vista de los demás.' },
  { key: 'flexibilidad',            titulo: 'Flexibilidad y adaptabilidad',             desc: 'Capacidad del sistema para reorganizar sus reglas, roles y jerarquías ante crisis o cambios del entorno.' },
  { key: 'jerarquia_parental',      titulo: 'Jerarquía parental clara',                desc: 'Figuras de autoridad (padres/cuidadores) coordinadas, que actúan de mutuo acuerdo y ejercen un liderazgo nutridor.' },
  { key: 'redes_apoyo',             titulo: 'Redes de apoyo externas',                 desc: 'Conexiones saludables con la familia extensa, la escuela, amigos o la comunidad que sostienen al sistema familiar.' },
]

const CICLO_VITAL_OPTS = [
  'Desprendimiento',
  'El encuentro',
  'Los hijos',
  'La adolescencia',
  'El reencuentro',
  'Vejez',
]

// ── Tipos ─────────────────────────────────────────────────────────────────────
type FuncionesMap = Record<string, string>

interface FamiliarData {
  sintomas: string
  detonadores: string
  riesgo_items: string[]
  proteccion_items: string[]
  funciones: FuncionesMap
  maternaje: string[]
  paternaje: string[]
  disfunc_tipo: string
  disfunc_opciones: string[]
  tipo_disfunc: string[]
  ciclo_vital: string
  ciclo_vital_analisis: string
  procesos_analisis: string
}

const vacio = (): FamiliarData => ({
  sintomas: '',
  detonadores: '',
  riesgo_items: [],
  proteccion_items: [],
  funciones: {},
  maternaje: [],
  paternaje: [],
  disfunc_tipo: '',
  disfunc_opciones: [],
  tipo_disfunc: [],
  ciclo_vital: '',
  ciclo_vital_analisis: '',
  procesos_analisis: '',
})

// ── Helpers ──────────────────────────────────────────────────────────────────
function countWords(text: string): number {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length
}

// ── Sub-componentes ───────────────────────────────────────────────────────────
function SectionCard({ num, title, note, desc, children }: { num: string; title: string; note?: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="flex items-baseline gap-2 border-b border-gray-100 pb-3 mb-5">
        <span className="text-xs font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">{num}</span>
        <h4 className="text-sm font-semibold text-gray-700">
          {title}
          {note && <span className="ml-2 text-xs font-normal text-gray-400">{note}</span>}
        </h4>
      </div>
      {desc && <p className="text-xs text-gray-400 mb-4">{desc}</p>}
      {children}
    </div>
  )
}

function WordLimitTextarea({
  value, onChange, maxWords = 100, rows = 4, placeholder,
}: {
  value: string
  onChange: (v: string) => void
  maxWords?: number
  rows?: number
  placeholder?: string
}) {
  const words = countWords(value)
  const over = words > maxWords
  return (
    <div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className={`w-full px-4 py-3 rounded-xl border text-sm text-gray-700
                   focus:outline-none focus:ring-2 leading-relaxed resize-none transition
                   ${over ? 'border-red-300 focus:ring-red-300' : 'border-gray-200 focus:ring-primary-300'}`}
      />
      <p className={`text-xs mt-1 text-right ${over ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
        {words} / {maxWords} palabras{over ? ' — excede el límite' : ''}
      </p>
    </div>
  )
}

function AnalysisButton({
  onClick, loading, hasResult, label = 'Ejecutar análisis',
}: {
  onClick: () => void
  loading: boolean
  hasResult: boolean
  label?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-colors
                 bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <>
          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          Analizando…
        </>
      ) : hasResult ? '↺ Volver a analizar' : label}
    </button>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  patientId: string
  therapistId: string
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function FamiliarTab({ patientId, therapistId }: Props) {
  const [data, setData]     = useState<FamiliarData>(vacio())
  const [saved, setSaved]   = useState<FamiliarData>(vacio())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saveOk, setSaveOk]   = useState(false)

  const [loadingCiclo,    setLoadingCiclo]    = useState(false)
  const [loadingProcesos, setLoadingProcesos] = useState(false)

  // Locks de análisis
  const [unlockedCiclo,     setUnlockedCiclo]     = useState(false)
  const [unlockedProcesos,  setUnlockedProcesos]  = useState(false)
  const [confirmingCiclo,   setConfirmingCiclo]   = useState(false)
  const [confirmingProcesos,setConfirmingProcesos]= useState(false)

  const cicloLocked    = !!saved.ciclo_vital_analisis && !unlockedCiclo
  const procesosLocked = !!saved.procesos_analisis    && !unlockedProcesos

  useEffect(() => { load() }, [patientId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: row } = await supabase
        .from('patient_expediente')
        .select(`
          fam_sintomas, fam_detonadores,
          fam_riesgo_items, fam_proteccion_items,
          fam_funciones, fam_maternaje, fam_paternaje,
          fam_disfunc_tipo, fam_disfunc_opciones, fam_tipo_disfunc,
          fam_ciclo_vital, fam_ciclo_vital_analisis, fam_procesos_analisis
        `)
        .eq('therapist_id', therapistId)
        .eq('patient_id', patientId)
        .maybeSingle()

      if (row) {
        const parsed: FamiliarData = {
          sintomas:            row.fam_sintomas          ?? '',
          detonadores:         row.fam_detonadores       ?? '',
          riesgo_items:        Array.isArray(row.fam_riesgo_items)      ? row.fam_riesgo_items      : [],
          proteccion_items:    Array.isArray(row.fam_proteccion_items)  ? row.fam_proteccion_items  : [],
          funciones:           (row.fam_funciones && typeof row.fam_funciones === 'object' && !Array.isArray(row.fam_funciones))
                                 ? (row.fam_funciones as FuncionesMap) : {},
          maternaje:           Array.isArray(row.fam_maternaje)       ? row.fam_maternaje       : [],
          paternaje:           Array.isArray(row.fam_paternaje)       ? row.fam_paternaje       : [],
          disfunc_tipo:        row.fam_disfunc_tipo      ?? '',
          disfunc_opciones:    Array.isArray(row.fam_disfunc_opciones) ? row.fam_disfunc_opciones : [],
          tipo_disfunc:        Array.isArray(row.fam_tipo_disfunc)    ? row.fam_tipo_disfunc    : [],
          ciclo_vital:         row.fam_ciclo_vital       ?? '',
          ciclo_vital_analisis:row.fam_ciclo_vital_analisis ?? '',
          procesos_analisis:   row.fam_procesos_analisis ?? '',
        }
        setData(parsed)
        setSaved(parsed)
      }
    } finally {
      setLoading(false)
    }
  }

  function set<K extends keyof FamiliarData>(key: K, value: FamiliarData[K]) {
    setData(prev => ({ ...prev, [key]: value }))
  }

  function toggleArray(key: 'maternaje' | 'paternaje' | 'disfunc_opciones' | 'tipo_disfunc' | 'riesgo_items' | 'proteccion_items', val: string) {
    setData(prev => {
      const arr = prev[key] as string[]
      const next = arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]
      return { ...prev, [key]: next }
    })
  }

  function setFuncion(key: string, value: string) {
    setData(prev => ({ ...prev, funciones: { ...prev.funciones, [key]: value } }))
  }

  function buildFamiliarContext() {
    // Serializa todos los apartados 1-8 para enviarlo al API
    const funcionesTexto = FUNCIONES_FAMILIARES
      .map(f => `  - ${f.label}: ${data.funciones[f.key] ?? 'Sin seleccionar'}`)
      .join('\n')

    const riesgoTexto     = data.riesgo_items.map(k => FACTORES_RIESGO.find(f => f.key === k)?.titulo ?? k).join(', ')
    const proteccionTexto = data.proteccion_items.map(k => FACTORES_PROTECCION.find(f => f.key === k)?.titulo ?? k).join(', ')

    return {
      sintomas:         data.sintomas,
      detonadores:      data.detonadores,
      factores_riesgo:  riesgoTexto     || 'Ninguno seleccionado',
      factores_proteccion: proteccionTexto || 'Ninguno seleccionado',
      funciones_texto:  funcionesTexto,
      maternaje:      data.maternaje,
      paternaje:      data.paternaje,
      disfunc_tipo:   data.disfunc_tipo,
      disfunc_opciones:data.disfunc_opciones,
      tipo_disfunc:   data.tipo_disfunc,
      ciclo_vital:    data.ciclo_vital,
    }
  }

  // ── Análisis: Ciclo Vital ─────────────────────────────────────────────────
  async function analizarCicloVital() {
    setLoadingCiclo(true)
    try {
      const res = await fetch('/api/expediente-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'ciclo_vital', patientId, familiar: buildFamiliarContext() }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { alert(json.error ?? `Error ${res.status}`); return }
      if (typeof json.result === 'string') {
        set('ciclo_vital_analisis', json.result)
        setUnlockedCiclo(false)
      }
    } catch { alert('Error de red al analizar Ciclo Vital') }
    finally { setLoadingCiclo(false) }
  }

  // ── Análisis: Procesos Familiares ─────────────────────────────────────────
  async function analizarProcesos() {
    setLoadingProcesos(true)
    try {
      const res = await fetch('/api/expediente-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'procesos_familiares', patientId, familiar: buildFamiliarContext() }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { alert(json.error ?? `Error ${res.status}`); return }
      if (typeof json.result === 'string') {
        set('procesos_analisis', json.result)
        setUnlockedProcesos(false)
      }
    } catch { alert('Error de red al analizar Procesos Familiares') }
    finally { setLoadingProcesos(false) }
  }

  // ── Guardar ──────────────────────────────────────────────────────────────
  async function save() {
    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('patient_expediente').upsert({
        therapist_id:            therapistId,
        patient_id:              patientId,
        fam_sintomas:            data.sintomas              || null,
        fam_detonadores:         data.detonadores           || null,
        fam_riesgo_items:        data.riesgo_items.length   > 0 ? data.riesgo_items    : null,
        fam_proteccion_items:    data.proteccion_items.length > 0 ? data.proteccion_items : null,
        fam_funciones:           Object.keys(data.funciones).length > 0 ? data.funciones : null,
        fam_maternaje:           data.maternaje.length  > 0 ? data.maternaje  : null,
        fam_paternaje:           data.paternaje.length  > 0 ? data.paternaje  : null,
        fam_disfunc_tipo:        data.disfunc_tipo      || null,
        fam_disfunc_opciones:    data.disfunc_opciones.length > 0 ? data.disfunc_opciones : null,
        fam_tipo_disfunc:        data.tipo_disfunc.length > 0     ? data.tipo_disfunc     : null,
        fam_ciclo_vital:         data.ciclo_vital       || null,
        fam_ciclo_vital_analisis:data.ciclo_vital_analisis || null,
        fam_procesos_analisis:   data.procesos_analisis || null,
        updated_at:              new Date().toISOString(),
      }, { onConflict: 'therapist_id,patient_id' })

      if (error) { alert(`Error al guardar: ${error.message}`); return }

      setSaved({ ...data })
      setSaveOk(true)
      setTimeout(() => setSaveOk(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  const changed = JSON.stringify(data) !== JSON.stringify(saved)

  if (loading) {
    return <div className="flex justify-center py-16 text-gray-400 text-sm">Cargando…</div>
  }

  const disfuncOpts = data.disfunc_tipo === 'Funcional'
    ? DISFUNC_FUNCIONAL_OPTS
    : data.disfunc_tipo === 'Disfuncional'
      ? DISFUNC_DISFUNCIONAL_OPTS
      : []

  return (
    <div className="space-y-5">

      {/* Banner de sección */}
      <div className="bg-primary-50 border border-primary-100 rounded-2xl px-6 py-4">
        <h3 className="text-sm font-semibold text-primary-800">Desarrollo Familiar</h3>
        <p className="text-xs text-primary-600 mt-0.5">
          Incluir datos significativos que procedan de los antecedentes de relevancia de la familia.
        </p>
      </div>

      {/* ── Apartado 1: Síntomas ── */}
      <SectionCard num="1" title="Síntomas" desc="Las observaciones que expresa el paciente o asesorado de uno o varios conflictos.">
        <WordLimitTextarea
          value={data.sintomas}
          onChange={v => set('sintomas', v)}
          placeholder="Describe los síntomas observados en la familia…"
        />
      </SectionCard>

      {/* ── Apartado 2: Detonadores ── */}
      <SectionCard num="2" title="Detonadores" desc="Estímulos específicos que activan un patrón de comportamiento automático, repetitivo y disfuncional dentro de un sistema familiar.">
        <WordLimitTextarea
          value={data.detonadores}
          onChange={v => set('detonadores', v)}
          placeholder="Describe los detonadores identificados…"
        />
      </SectionCard>

      {/* ── Apartado 3: Factores de riesgo y de protección ── */}
      <SectionCard num="3" title="Factores de riesgo y de protección" desc="Selecciona los factores de riesgo y protección que actualmente vive o ha desarrollado la familia.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

          {/* Factores de Riesgo */}
          <div>
            <p className="text-xs font-semibold mb-3 text-red-500">Factores de Riesgo</p>
            <div className="space-y-3">
              {FACTORES_RIESGO.map(f => (
                <label key={f.key} className="flex items-start gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={data.riesgo_items.includes(f.key)}
                    onChange={() => toggleArray('riesgo_items', f.key)}
                    className="w-4 h-4 rounded mt-0.5 flex-shrink-0"
                    style={{ accentColor: '#ef4444' }}
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-700 leading-snug group-hover:text-gray-900">{f.titulo}</p>
                    <p className="text-xs text-gray-400 leading-snug mt-0.5">{f.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Factores de Protección */}
          <div>
            <p className="text-xs font-semibold mb-3 text-emerald-600">Factores de Protección</p>
            <div className="space-y-3">
              {FACTORES_PROTECCION.map(f => (
                <label key={f.key} className="flex items-start gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={data.proteccion_items.includes(f.key)}
                    onChange={() => toggleArray('proteccion_items', f.key)}
                    className="w-4 h-4 rounded mt-0.5 flex-shrink-0"
                    style={{ accentColor: '#059669' }}
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-700 leading-snug group-hover:text-gray-900">{f.titulo}</p>
                    <p className="text-xs text-gray-400 leading-snug mt-0.5">{f.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

        </div>
      </SectionCard>

      {/* ── Apartado 4: Funciones familiares ── */}
      <SectionCard num="4" title="Funciones familiares presentes y no presentes dentro de la familia">
        <div className="space-y-3">
          {FUNCIONES_FAMILIARES.map(f => (
            <div key={f.key} className="flex items-start gap-3">
              <span className="text-sm text-gray-600 flex-1 pt-1.5 leading-snug">{f.label}</span>
              <select
                value={data.funciones[f.key] ?? ''}
                onChange={e => setFuncion(f.key, e.target.value)}
                className="w-40 flex-shrink-0 px-2 py-1.5 rounded-xl border border-gray-200 text-xs text-gray-700
                           focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
              >
                <option value="">— —</option>
                <option value="Presente">Presente</option>
                <option value="No presente">No presente</option>
              </select>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ── Apartado 5: Maternaje y Paternaje ── */}
      <SectionCard num="5" title="Características maternas y paternas (Tipo de vinculación afectiva)">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Maternaje */}
          <div>
            <p className="text-xs font-semibold mb-3" style={{ color: '#b243d5' }}>
              Características de maternaje
            </p>
            <div className="space-y-2.5">
              {MATERNAJE_OPTS.map(opt => (
                <label key={opt} className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={data.maternaje.includes(opt)}
                    onChange={() => toggleArray('maternaje', opt)}
                    className="w-4 h-4 rounded accent-primary-600 flex-shrink-0"
                  />
                  <span className="text-sm text-gray-600 group-hover:text-gray-800">{opt}</span>
                </label>
              ))}
            </div>
          </div>
          {/* Paternaje */}
          <div>
            <p className="text-xs font-semibold mb-3" style={{ color: '#b243d5' }}>
              Características de paternaje
            </p>
            <div className="space-y-2.5">
              {PATERNAJE_OPTS.map(opt => (
                <label key={opt} className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={data.paternaje.includes(opt)}
                    onChange={() => toggleArray('paternaje', opt)}
                    className="w-4 h-4 rounded accent-primary-600 flex-shrink-0"
                  />
                  <span className="text-sm text-gray-600 group-hover:text-gray-800">{opt}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── Apartado 6: Referentes de Disfuncionalidad ── */}
      <SectionCard num="6" title="Referentes de Disfuncionalidad" note="Base: Análisis McMaster">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">Tipo de familia</label>
            <select
              value={data.disfunc_tipo}
              onChange={e => {
                set('disfunc_tipo', e.target.value)
                set('disfunc_opciones', [])
              }}
              className="w-44 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700
                         focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
            >
              <option value="">— Selecciona —</option>
              <option value="Funcional">Funcional</option>
              <option value="Disfuncional">Disfuncional</option>
            </select>
          </div>

          {/* Multiple choice condicional */}
          {data.disfunc_tipo && disfuncOpts.length > 0 && (
            <div className={`rounded-xl p-4 border space-y-3 ${
              data.disfunc_tipo === 'Funcional'
                ? 'bg-green-50 border-green-100'
                : 'bg-amber-50 border-amber-100'
            }`}>
              <p className={`text-xs font-semibold ${
                data.disfunc_tipo === 'Funcional' ? 'text-green-700' : 'text-amber-700'
              }`}>
                {data.disfunc_tipo === 'Funcional' ? '✓ Características funcionales' : '⚠️ Características disfuncionales'}
              </p>
              {disfuncOpts.map(opt => (
                <label key={opt} className="flex items-start gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={data.disfunc_opciones.includes(opt)}
                    onChange={() => toggleArray('disfunc_opciones', opt)}
                    className="w-4 h-4 rounded mt-0.5 flex-shrink-0"
                    style={{
                      accentColor: data.disfunc_tipo === 'Funcional' ? '#16a34a' : '#d97706',
                    }}
                  />
                  <span className="text-sm text-gray-700 leading-snug">{opt}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── Apartado 7: Tipo de Disfuncionalidad Observada ── */}
      <SectionCard num="7" title="Tipo de Disfuncionalidad Observada">
        <div className="space-y-3">
          {TIPO_DISFUNC_OPTS.map(opt => (
            <label key={opt} className="flex items-start gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={data.tipo_disfunc.includes(opt)}
                onChange={() => toggleArray('tipo_disfunc', opt)}
                className="w-4 h-4 rounded mt-0.5 accent-primary-600 flex-shrink-0"
              />
              <span className="text-sm text-gray-600 leading-snug group-hover:text-gray-800">{opt}</span>
            </label>
          ))}
        </div>
      </SectionCard>

      {/* ── Apartado 8: Etapa del Ciclo Vital ── */}
      <SectionCard num="8" title="Etapa del Ciclo Vital de la familia">
        <div className="space-y-5">
          {/* Dropdown */}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">Etapa actual</label>
            <select
              value={data.ciclo_vital}
              onChange={e => set('ciclo_vital', e.target.value)}
              className="w-56 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700
                         focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
            >
              <option value="">— Selecciona —</option>
              {CICLO_VITAL_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {/* Análisis AVI */}
          <div>
            <p className="text-xs text-gray-400 mb-3">
              Análisis AVI — Basado en la etapa del ciclo vital, los datos de los 7 apartados previos,
              la Nota Inicial y las sesiones presenciales. Fuente: <em>El Ciclo Vital de La Familia</em>. Máx. 250 palabras.
            </p>
            {cicloLocked ? (
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                  🔒 Análisis registrado — edita el texto directamente si necesitas ajustes
                </span>
                {!confirmingCiclo ? (
                  <button
                    onClick={() => setConfirmingCiclo(true)}
                    className="text-xs text-gray-400 hover:text-gray-500 underline underline-offset-2"
                  >
                    Desbloquear para regenerar
                  </button>
                ) : (
                  <span className="flex items-center gap-2 text-xs">
                    <span className="text-amber-700 font-medium">¿Confirmas? Sobrescribirá el análisis guardado.</span>
                    <button
                      onClick={() => { setUnlockedCiclo(true); setConfirmingCiclo(false) }}
                      className="text-red-600 hover:text-red-700 font-semibold"
                    >Sí, regenerar</button>
                    <button onClick={() => setConfirmingCiclo(false)} className="text-gray-400 hover:text-gray-600">
                      Cancelar
                    </button>
                  </span>
                )}
              </div>
            ) : (
              <div className="mb-3">
                <AnalysisButton
                  onClick={analizarCicloVital}
                  loading={loadingCiclo}
                  hasResult={!!data.ciclo_vital_analisis}
                />
              </div>
            )}
            <textarea
              value={data.ciclo_vital_analisis}
              onChange={e => set('ciclo_vital_analisis', e.target.value)}
              rows={7}
              placeholder={loadingCiclo ? 'Analizando…' : 'El análisis del ciclo vital aparecerá aquí. También puedes escribir o editar directamente.'}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-700
                         focus:outline-none focus:ring-2 focus:ring-primary-300 leading-relaxed resize-none"
            />
          </div>
        </div>
      </SectionCard>

      {/* ── Apartado 9: Procesos Familiares ── */}
      <SectionCard num="9" title="Procesos Familiares">
        <div className="space-y-4">
          <p className="text-xs text-gray-400">
            Análisis AVI sobre <strong className="font-medium text-gray-500">Límites, Poder, Comunicación y Afecto</strong>,
            basado en la Nota Inicial y los apartados 1–8 de esta sección.
            Fuentes: <em>Virginia Satir</em> y <em>Minuchin</em>. Máx. 250 palabras.
          </p>

          {procesosLocked ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                🔒 Análisis registrado — edita el texto directamente si necesitas ajustes
              </span>
              {!confirmingProcesos ? (
                <button
                  onClick={() => setConfirmingProcesos(true)}
                  className="text-xs text-gray-400 hover:text-gray-500 underline underline-offset-2"
                >
                  Desbloquear para regenerar
                </button>
              ) : (
                <span className="flex items-center gap-2 text-xs">
                  <span className="text-amber-700 font-medium">¿Confirmas? Sobrescribirá el análisis guardado.</span>
                  <button
                    onClick={() => { setUnlockedProcesos(true); setConfirmingProcesos(false) }}
                    className="text-red-600 hover:text-red-700 font-semibold"
                  >Sí, regenerar</button>
                  <button onClick={() => setConfirmingProcesos(false)} className="text-gray-400 hover:text-gray-600">
                    Cancelar
                  </button>
                </span>
              )}
            </div>
          ) : (
            <AnalysisButton
              onClick={analizarProcesos}
              loading={loadingProcesos}
              hasResult={!!data.procesos_analisis}
            />
          )}

          <textarea
            value={data.procesos_analisis}
            onChange={e => set('procesos_analisis', e.target.value)}
            rows={7}
            placeholder={loadingProcesos ? 'Analizando…' : 'El análisis de procesos familiares aparecerá aquí. También puedes escribir o editar directamente.'}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-700
                       focus:outline-none focus:ring-2 focus:ring-primary-300 leading-relaxed resize-none"
          />
        </div>
      </SectionCard>

      {/* ── Botón guardar ── */}
      <div className="flex justify-end pt-1 pb-4">
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
