'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { resolveFactores, SCHEMA_LABELS, FactorGroup } from './factores-nota-inicial'

// ── Datos clínicos ────────────────────────────────────────────────────────────

const EROS_OPTS = [
  'Atracción sexual y seducción.',
  'Enamoramiento, cortejo, idealización.',
  'Proyección Narcisista (proyecto en ti para satisfacer mis necesidades).',
  'Relación posesiva.',
]

const PHILIA_OPTS = [
  'Reconocimiento, respeto y aceptación del otro.',
  'Comunicación afectiva, empatía, conocimiento mutuo.',
  'Compartir ideales, afección, gustos.',
  'Enriquecimiento mutuo.',
]

const AGAPE_OPTS = [
  'Cuidar desinteresadamente.',
  'Amor incondicional.',
  'Postura oblativa (me puedo ajustar porque me dono).',
]

const TIPOS_AMOR = [
  { label: 'Enamoramiento',       desc: 'Basado predominantemente en la experiencia personal.',                                                                                                      tag: 'funcional'    },
  { label: 'Amistad',             desc: 'Compuesto de intimidad sin compromiso ni pasión.',                                                                                                          tag: 'disfuncional' },
  { label: 'Amor vacío',          desc: 'Caracterizado por un compromiso sin pasión ni intimidad (mantener las apariencias o por el bien de los hijos).',                                            tag: 'disfuncional' },
  { label: 'Amor de compañeros',  desc: 'Construido en base a la intimidad y compromiso, pero sin pasión (típico de parejas que llevan juntas mucho tiempo y conviven armoniosamente).',             tag: 'ambiguo'      },
  { label: 'Amor ilusorio',       desc: 'Mezcla de pasión y compromiso, pero sin ninguna intimidad ni conocimiento mutuo.',                                                                          tag: 'disfuncional' },
  { label: 'Amor romántico',      desc: 'Compuesto de pasión e intimidad, en ausencia de compromiso.',                                                                                               tag: 'ambiguo'      },
  { label: 'Amor consumado',      desc: 'Combinación de los 3 componentes: pasión, intimidad y compromiso.',                                                                                         tag: 'funcional'    },
]

const ESTRUCTURA_FUNCIONAL = [
  { label: 'Autónoma', desc: 'Equilibrio entre la unión afectiva de sus miembros y la independencia individual de sus miembros.' },
  { label: 'Nutricia',  desc: 'Entorno de crecimiento, salud mental y soporte emocional. Las relaciones se basan en el amor, el respeto y la confianza mutua.' },
]

const ESTRUCTURA_DISFUNCIONAL = [
  { label: 'Simbiótica',    desc: 'Los límites entre sus miembros no existen, perdiendo los miembros su identidad individual: familia muégano. No se respetan los límites y la afectividad puede ser muy exacerbada.' },
  { label: 'Dependiente',   desc: 'Dependencia absoluta de uno o varios miembros, ya sea física, emocional, económica o adicción: fármacos, trabajo, deporte, etc.' },
  { label: 'Doble vínculo', desc: 'Comunicación o conductas ambivalentes, entre lo que dicen y lo que hacen o lo que piensan. Presencia de patrones de mensajes contradictorios que no se pueden resolver: Incongruencia.' },
  { label: 'Reactiva',      desc: 'Reacciona de forma desadaptada en respuesta directa a un evento estresante: Familia impulsiva, agresiva o generalizaciones: minimizaciones o maximizaciones.' },
]

// ── Helper components ─────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
      <div className="border-b border-gray-100 pb-2">
        <h4 className="text-sm font-semibold text-gray-700">{title}</h4>
      </div>
      {children}
    </div>
  )
}

function Instruccion({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-gray-400 italic">{children}</p>
}

function AreaTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold uppercase tracking-wide mt-4 mb-2" style={{ color: '#b243d5' }}>
      {children}
    </p>
  )
}

function CheckItem({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-2 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-gray-300 cursor-pointer"
        style={{ accentColor: '#b243d5' }}
      />
      <span className="text-sm text-gray-600 group-hover:text-gray-800 transition-colors leading-snug">{label}</span>
    </label>
  )
}

function TagBadge({ tag }: { tag: string }) {
  const styles: Record<string, string> = {
    funcional:    'bg-green-50 text-green-700 border border-green-200',
    disfuncional: 'bg-red-50 text-red-600 border border-red-200',
    ambiguo:      'bg-yellow-50 text-yellow-700 border border-yellow-200',
  }
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${styles[tag] ?? ''}`}>
      {tag}
    </span>
  )
}

function RadioCard({ label, desc, tag, checked, onChange }: {
  label: string; desc: string; tag?: string; checked: boolean; onChange: () => void
}) {
  return (
    <label className={`flex items-start gap-3 cursor-pointer rounded-xl border p-3 transition-colors
      ${checked ? 'border-purple-300 bg-purple-50' : 'border-gray-100 bg-white hover:border-gray-200'}`}>
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        className="mt-0.5 h-4 w-4 cursor-pointer"
        style={{ accentColor: '#b243d5' }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          {tag && <TagBadge tag={tag} />}
        </div>
        <p className="text-xs text-gray-500 mt-0.5 leading-snug">{desc}</p>
      </div>
    </label>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props { patientId: string; therapistId: string }

// ── Main component ────────────────────────────────────────────────────────────

export default function ParejaTab({ patientId, therapistId }: Props) {
  const [eros,       setEros]       = useState<string[]>([])
  const [philia,     setPhilia]     = useState<string[]>([])
  const [agape,      setAgape]      = useState<string[]>([])
  const [tipoAmor,   setTipoAmor]   = useState('')
  const [estructura, setEstructura] = useState('')
  const [conclusion, setConclusion] = useState('')

  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [saveOk,      setSaveOk]      = useState(false)
  const [generating,  setGenerating]  = useState(false)
  const [genError,    setGenError]    = useState('')
  const [loadingNota, setLoadingNota] = useState(false)

  // Factores desde Nota Inicial (read-only, agrupados por esquema)
  const [notaFactores, setNotaFactores] = useState<{
    riesgo: FactorGroup[]
    proteccion: FactorGroup[]
  }>({ riesgo: [], proteccion: [] })

  const [saved, setSaved] = useState({
    eros: [] as string[], philia: [] as string[], agape: [] as string[],
    tipoAmor: '', estructura: '', conclusion: '',
  })

  useEffect(() => {
    load()
    cargarDesdeNota()
  }, [patientId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: row } = await supabase
        .from('patient_expediente')
        .select('par_eros, par_philia, par_agape, par_tipo_amor, par_estructura, par_conclusion')
        .eq('therapist_id', therapistId)
        .eq('patient_id', patientId)
        .maybeSingle()

      if (row) {
        const e = Array.isArray(row.par_eros)   ? row.par_eros   : []
        const p = Array.isArray(row.par_philia) ? row.par_philia : []
        const a = Array.isArray(row.par_agape)  ? row.par_agape  : []
        const t = row.par_tipo_amor   ?? ''
        const s = row.par_estructura  ?? ''
        const c = row.par_conclusion  ?? ''
        setEros(e); setPhilia(p); setAgape(a); setTipoAmor(t); setEstructura(s); setConclusion(c)
        setSaved({ eros: e, philia: p, agape: a, tipoAmor: t, estructura: s, conclusion: c })
      }
    } finally {
      setLoading(false)
    }
  }

  function toggleCheck(list: string[], setList: (v: string[]) => void, val: string) {
    setList(list.includes(val) ? list.filter(x => x !== val) : [...list, val])
  }

  // ── Cargar Factores desde Nota Inicial ───────────────────────────────────
  async function cargarDesdeNota() {
    setLoadingNota(true)
    try {
      const supabase = createClient()
      const [{ data: tp }, { data: profile }] = await Promise.all([
        supabase
          .from('therapist_patients')
          .select('factores_riesgo_sel, factores_proteccion_sel, factores_riesgo_trec, factores_proteccion_trec, factores_riesgo_tcc, factores_proteccion_tcc')
          .eq('therapist_id', therapistId)
          .eq('patient_id', patientId)
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('therapy_profile')
          .eq('id', therapistId)
          .maybeSingle(),
      ])

      const schemas = (profile?.therapy_profile ?? '').split('_').filter(Boolean)

      const COL_RIESGO: Record<string, string> = {
        famsis: 'factores_riesgo_sel',
        trec:   'factores_riesgo_trec',
        cc:     'factores_riesgo_tcc',
      }
      const COL_PROT: Record<string, string> = {
        famsis: 'factores_proteccion_sel',
        trec:   'factores_proteccion_trec',
        cc:     'factores_proteccion_tcc',
      }

      const riesgoGroups: FactorGroup[]     = []
      const proteccionGroups: FactorGroup[] = []

      for (const schema of schemas) {
        const rColName = COL_RIESGO[schema]
        const pColName = COL_PROT[schema]
        if (!rColName || !pColName) continue

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tpRow = tp as Record<string, any> | null
        const rKeys: string[] = (tpRow?.[rColName] as { pareja?: string[] } | null)?.pareja ?? []
        const pKeys: string[] = (tpRow?.[pColName] as { pareja?: string[] } | null)?.pareja ?? []

        const rItems = resolveFactores(schema, 'pareja', 'riesgo', rKeys)
        const pItems = resolveFactores(schema, 'pareja', 'proteccion', pKeys)

        if (rItems.length > 0) {
          riesgoGroups.push({ schema, schemaLabel: SCHEMA_LABELS[schema] ?? schema, items: rItems })
        }
        if (pItems.length > 0) {
          proteccionGroups.push({ schema, schemaLabel: SCHEMA_LABELS[schema] ?? schema, items: pItems })
        }
      }

      setNotaFactores({ riesgo: riesgoGroups, proteccion: proteccionGroups })
    } finally {
      setLoadingNota(false)
    }
  }

  async function generarAnalisis() {
    const total = eros.length + philia.length + agape.length
    if (total === 0) {
      setGenError('Selecciona al menos un síntoma antes de generar el análisis.')
      return
    }
    setGenError('')
    setGenerating(true)
    try {
      const res = await fetch('/api/analisis-clinicos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'pareja_areas', patientId, eros, philia, agape, tipoAmor, estructura }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        setGenError(json.error ?? 'Error al generar el análisis.')
      } else {
        setConclusion(json.conclusion ?? '')
      }
    } catch {
      setGenError('Error de red al generar el análisis.')
    } finally {
      setGenerating(false)
    }
  }

  async function save() {
    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('patient_expediente')
        .upsert({
          therapist_id:   therapistId,
          patient_id:     patientId,
          par_eros:       eros,
          par_philia:     philia,
          par_agape:      agape,
          par_tipo_amor:  tipoAmor   || null,
          par_estructura: estructura || null,
          par_conclusion: conclusion || null,
          updated_at:     new Date().toISOString(),
        }, { onConflict: 'therapist_id,patient_id' })

      if (error) { alert(`Error al guardar: ${error.message}`); return }
      setSaved({ eros, philia, agape, tipoAmor, estructura, conclusion })
      setSaveOk(true)
      setTimeout(() => setSaveOk(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  const changed =
    JSON.stringify(eros)   !== JSON.stringify(saved.eros)   ||
    JSON.stringify(philia) !== JSON.stringify(saved.philia) ||
    JSON.stringify(agape)  !== JSON.stringify(saved.agape)  ||
    tipoAmor   !== saved.tipoAmor   ||
    estructura !== saved.estructura ||
    conclusion !== saved.conclusion

  if (loading) {
    return <div className="flex justify-center py-16 text-gray-400 text-sm">Cargando…</div>
  }

  return (
    <div className="space-y-5">

      {/* ── Apartado 1: Áreas funcionales y disfuncionales ── */}
      <SectionCard title="Áreas funcionales y disfuncionales de la pareja">
        <Instruccion>
          De las 3 áreas EROS, PHILIA y ÁGAPE, selecciona los diferentes síntomas que vive la pareja; si es el caso.
        </Instruccion>

        <div>
          <AreaTitle>EROS (fusión)</AreaTitle>
          <div className="space-y-2 pl-1">
            {EROS_OPTS.map(opt => (
              <CheckItem key={opt} label={opt} checked={eros.includes(opt)}
                onChange={() => toggleCheck(eros, setEros, opt)} />
            ))}
          </div>
        </div>

        <div>
          <AreaTitle>PHILIA (intimidad)</AreaTitle>
          <div className="space-y-2 pl-1">
            {PHILIA_OPTS.map(opt => (
              <CheckItem key={opt} label={opt} checked={philia.includes(opt)}
                onChange={() => toggleCheck(philia, setPhilia, opt)} />
            ))}
          </div>
        </div>

        <div>
          <AreaTitle>ÁGAPE (compromiso auténtico)</AreaTitle>
          <div className="space-y-2 pl-1">
            {AGAPE_OPTS.map(opt => (
              <CheckItem key={opt} label={opt} checked={agape.includes(opt)}
                onChange={() => toggleCheck(agape, setAgape, opt)} />
            ))}
          </div>
        </div>

      </SectionCard>

      {/* ── Apartado 2: Tipos de AMOR ── */}
      <SectionCard title="Tipos de AMOR">
        <Instruccion>
          Selecciona el Tipo de AMOR en el cual hoy experimenta la pareja.
        </Instruccion>
        <div className="space-y-2 mt-1">
          {TIPOS_AMOR.map(opt => (
            <RadioCard
              key={opt.label}
              label={opt.label}
              desc={opt.desc}
              tag={opt.tag}
              checked={tipoAmor === opt.label}
              onChange={() => setTipoAmor(opt.label)}
            />
          ))}
        </div>
      </SectionCard>

      {/* ── Apartado 3: Estructura de la pareja ── */}
      <SectionCard title="ESTRUCTURA de la pareja">
        <Instruccion>
          Selecciona el Tipo de ESTRUCTURA que viven como pareja.
        </Instruccion>

        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-green-700 mb-2">Funcional</p>
          <div className="space-y-2">
            {ESTRUCTURA_FUNCIONAL.map(opt => (
              <RadioCard
                key={opt.label}
                label={opt.label}
                desc={opt.desc}
                tag="funcional"
                checked={estructura === opt.label}
                onChange={() => setEstructura(opt.label)}
              />
            ))}
          </div>
        </div>

        <div className="mt-2">
          <p className="text-xs font-bold uppercase tracking-wide text-red-600 mb-2">Disfuncional</p>
          <div className="space-y-2">
            {ESTRUCTURA_DISFUNCIONAL.map(opt => (
              <RadioCard
                key={opt.label}
                label={opt.label}
                desc={opt.desc}
                tag="disfuncional"
                checked={estructura === opt.label}
                onChange={() => setEstructura(opt.label)}
              />
            ))}
          </div>
        </div>
      </SectionCard>

      {/* ── Factores de riesgo y protección (desde Nota Inicial) ── */}
      <SectionCard title="Factores de riesgo y protección">
        {/* Botón sincronizar */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-gray-400">
            Factores activos desde la Nota Inicial para el Tipo de Caso Pareja.
          </p>
          <button
            onClick={cargarDesdeNota}
            disabled={loadingNota}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl
                       border border-primary-200 text-primary-700 bg-primary-50
                       hover:bg-primary-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingNota ? (
              <>
                <span className="w-3 h-3 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                Actualizando…
              </>
            ) : (
              <>↺ Actualizar desde Nota Inicial</>
            )}
          </button>
        </div>

        {loadingNota ? (
          <div className="flex justify-center py-8 text-gray-400 text-sm">Cargando factores…</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

            {/* Factores de Riesgo */}
            <div>
              <p className="text-xs font-semibold mb-3 text-red-500">Factores de Riesgo</p>
              {notaFactores.riesgo.length === 0 ? (
                <p className="text-xs text-gray-400 italic">
                  Sin factores de riesgo registrados en la Nota Inicial para este tipo de caso.
                </p>
              ) : (
                <div className="space-y-4">
                  {notaFactores.riesgo.map(group => (
                    <div key={group.schema}>
                      <p className="text-xs font-semibold text-gray-500 mb-2">{group.schemaLabel}</p>
                      <ul className="space-y-2">
                        {group.items.map(item => (
                          <li key={item.key} className="flex items-start gap-2">
                            <span className="mt-1.5 w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-gray-700 leading-snug">{item.titulo}</p>
                              <p className="text-xs text-gray-400 leading-snug mt-0.5">{item.desc}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Factores de Protección */}
            <div>
              <p className="text-xs font-semibold mb-3 text-emerald-600">Factores de Protección</p>
              {notaFactores.proteccion.length === 0 ? (
                <p className="text-xs text-gray-400 italic">
                  Sin factores de protección registrados en la Nota Inicial para este tipo de caso.
                </p>
              ) : (
                <div className="space-y-4">
                  {notaFactores.proteccion.map(group => (
                    <div key={group.schema}>
                      <p className="text-xs font-semibold text-gray-500 mb-2">{group.schemaLabel}</p>
                      <ul className="space-y-2">
                        {group.items.map(item => (
                          <li key={item.key} className="flex items-start gap-2">
                            <span className="mt-1.5 w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-gray-700 leading-snug">{item.titulo}</p>
                              <p className="text-xs text-gray-400 leading-snug mt-0.5">{item.desc}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </SectionCard>

      {/* ── Conclusión clínica ── */}
      <SectionCard title="Conclusión clínica">
        <Instruccion>
          Una vez seleccionadas las opciones de los tres apartados, genera el análisis. Puedes editar el resultado antes de guardar.
        </Instruccion>
        <div className="space-y-3 pt-1">
          <div className="flex items-center gap-3">
            <button
              onClick={generarAnalisis}
              disabled={generating}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#b243d5' }}
            >
              {generating ? 'Generando análisis…' : '✦ Generar análisis'}
            </button>
            {generating && (
              <span className="text-xs text-gray-400 animate-pulse">Consultando fuentes clínicas…</span>
            )}
          </div>
          {genError && <p className="text-xs text-red-500">{genError}</p>}
          <div className="space-y-1">
            <textarea
              value={conclusion}
              onChange={e => setConclusion(e.target.value)}
              rows={6}
              disabled={generating}
              placeholder="El análisis aparecerá aquí. Puedes editarlo antes de guardar."
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700
                         focus:outline-none focus:ring-2 focus:ring-purple-300 transition resize-y
                         disabled:opacity-60"
            />
          </div>
        </div>
      </SectionCard>

      {/* ── Botón guardar ── */}
      <div className="flex justify-end pb-4">
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
