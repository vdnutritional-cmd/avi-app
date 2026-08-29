'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ──────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────
interface Props {
  patientId:   string
  therapistId: string
}

interface McMasterValores {
  vd1: string; vd2: string; vd3: string
  vd4: string; vd5: string; vd6: string
}

// ──────────────────────────────────────────────────────────
// Configuración de Apartados (extensible en el futuro)
// ──────────────────────────────────────────────────────────
const TODOS_APARTADOS = [
  { id: 'genograma', label: 'Genograma',         icon: '🌳' },
  { id: 'mcmaster',  label: 'Análisis McMaster',  icon: '📊' },
  { id: 'foda',      label: 'Análisis FODA',      icon: '🔍' },
]

// ──────────────────────────────────────────────────────────
// McMaster — Factores y cálculos
// ──────────────────────────────────────────────────────────
const FACTORES = [
  { id: 1, label: 'Factor 1. Involucramiento afectivo funcional',    vmin: 17, vmax: 85, invertido: false },
  { id: 2, label: 'Factor 2. Involucramiento afectivo disfuncional', vmin: 11, vmax: 55, invertido: true  },
  { id: 3, label: 'Factor 3. Patrones de comunicación disfuncional', vmin:  4, vmax: 20, invertido: true  },
  { id: 4, label: 'Factor 4. Patrones de comunicación funcional',    vmin:  3, vmax: 15, invertido: false },
  { id: 5, label: 'Factor 5. Resolución de problemas',              vmin:  3, vmax: 15, invertido: false },
  { id: 6, label: 'Factor 6. Patrones de control de conducta',      vmin:  2, vmax: 10, invertido: false },
]

function rd1(n: number) { return Math.round(n * 10) / 10 }

function calcFactor(vdStr: string, vmin: number, vmax: number, invertido: boolean) {
  const vd = parseFloat(vdStr)
  if (isNaN(vd) || vd < vmin || vd > vmax) return null
  const base      = rd1((vd - vmin) / (vmax - vmin) * 100)
  const funcional = invertido ? rd1(100 - base) : base
  return { funcional, disfuncional: rd1(100 - funcional) }
}

function calcMcMaster(vals: McMasterValores) {
  const rows = FACTORES.map((f, i) =>
    calcFactor(vals[`vd${i + 1}` as keyof McMasterValores], f.vmin, f.vmax, f.invertido)
  )
  const valid = rows.filter(Boolean) as { funcional: number; disfuncional: number }[]
  if (valid.length === 0) return { rows, rf: null, rd: null, eff: null, conclusion: null }
  const rf  = rd1(valid.reduce((s, r) => s + r.funcional,    0) / valid.length)
  const rd  = rd1(valid.reduce((s, r) => s + r.disfuncional, 0) / valid.length)
  const eff = rd1((rf + rd) / 2)
  return { rows, rf, rd, eff, conclusion: eff >= 60 ? 'Funcional' : 'Disfuncional' }
}

// ──────────────────────────────────────────────────────────
// Helpers UI
// ──────────────────────────────────────────────────────────
const AVI = '#b243d5'

function Chip({ label, color = 'gray' }: { label: string; color?: 'gray' | 'green' | 'red' | 'purple' }) {
  const cls = {
    gray:   'bg-gray-100 text-gray-500',
    green:  'bg-emerald-50 text-emerald-600 border border-emerald-200',
    red:    'bg-red-50 text-red-600 border border-red-200',
    purple: 'bg-purple-50 text-purple-600 border border-purple-200',
  }[color]
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>
}

function SaveBtn({ onClick, loading, saved, disabled }: {
  onClick: () => void; loading: boolean; saved: boolean; disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className="px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-colors
                 disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ background: loading || disabled ? '#ccc' : AVI }}
    >
      {loading ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar'}
    </button>
  )
}

// Tarjeta colapsable de apartado
function ApartadoCard({
  id, icon, label, hasData, children,
}: {
  id: string; icon: string; label: string; hasData: boolean; children: React.ReactNode
}) {
  const [open, setOpen] = useState(hasData)
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{icon}</span>
          <span className="text-sm font-semibold text-gray-800">{label}</span>
          {hasData && <Chip label="Con datos" color="purple" />}
        </div>
        <span className="text-gray-400 text-xs">{open ? '▲ Contraer' : '▼ Expandir'}</span>
      </button>
      {open && <div className="border-t border-gray-100 px-6 py-5 space-y-4">{children}</div>}
    </div>
  )
}

// Zona de carga de imagen
function ImageUpload({
  url, onUpload, uploading, accept = 'image/png,image/jpeg,image/webp',
  label = 'Arrastra o haz clic para subir imagen (PNG / JPG)',
}: {
  url: string | null
  onUpload: (file: File) => void
  uploading: boolean
  accept?: string
  label?: string
}) {
  const ref = useRef<HTMLInputElement>(null)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) onUpload(file)
  }

  return (
    <div className="space-y-3">
      {url ? (
        <div className="relative rounded-xl overflow-hidden border border-gray-200">
          {url.toLowerCase().endsWith('.pdf') ? (
            <iframe src={url} className="w-full" style={{ height: 500 }} title="Archivo" />
          ) : (
            <img src={url} alt="Imagen" className="w-full max-h-[500px] object-contain bg-gray-50" />
          )}
          <button
            onClick={() => ref.current?.click()}
            className="absolute top-2 right-2 bg-white border border-gray-200 text-gray-600 text-xs
                       px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            ↻ Cambiar
          </button>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => ref.current?.click()}
          className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center
                     cursor-pointer hover:border-purple-300 hover:bg-purple-50/30 transition-colors"
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2 text-gray-400">
              <span className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">Subiendo…</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <span className="text-3xl">📎</span>
              <p className="text-xs text-gray-400">{label}</p>
              <p className="text-xs text-gray-300">Recomendado: PNG o JPG (1 página)</p>
            </div>
          )}
        </div>
      )}
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f) }}
      />
    </div>
  )
}

// Textarea editable con label
function InterpretacionArea({
  value, onChange, placeholder, rows = 6,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
        Interpretación del Terapeuta
      </label>
      <textarea
        rows={rows}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? 'Escribe aquí tu interpretación…'}
        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800
                   focus:outline-none focus:ring-2 resize-y leading-relaxed"
        style={{ '--tw-ring-color': AVI } as React.CSSProperties}
      />
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// Componente principal
// ──────────────────────────────────────────────────────────
export default function AnalisisClanicosTab({ patientId, therapistId }: Props) {
  const [loading,        setLoading]        = useState(true)
  const [indexOpen,      setIndexOpen]      = useState(false)

  // Índice de visibilidad
  const [visibles,       setVisibles]       = useState<string[]>(['genograma', 'mcmaster', 'foda'])
  const [savingIndex,    setSavingIndex]    = useState(false)

  // Conclusiones
  const [conclusiones,      setConclusiones]      = useState('')
  const [generandoConc,     setGenerandoConc]     = useState(false)
  const [savingConc,        setSavingConc]        = useState(false)
  const [savedConc,         setSavedConc]         = useState(false)
  const [errorConc,         setErrorConc]         = useState<string | null>(null)

  // Genograma
  const [genogramaUrl,   setGenogramaUrl]   = useState<string | null>(null)
  const [genogramaInterp,setGenogramaInterp]= useState('')
  const [upGenograma,    setUpGenograma]    = useState(false)
  const [savingGeno,     setSavingGeno]     = useState(false)
  const [savedGeno,      setSavedGeno]      = useState(false)

  // McMaster
  const [mc1Url,         setMc1Url]         = useState<string | null>(null)
  const [mc2Url,         setMc2Url]         = useState<string | null>(null)
  const [upMc1,          setUpMc1]          = useState(false)
  const [upMc2,          setUpMc2]          = useState(false)
  const [mcValores,      setMcValores]      = useState<McMasterValores>({
    vd1:'', vd2:'', vd3:'', vd4:'', vd5:'', vd6:''
  })
  const [mcInterp,       setMcInterp]       = useState('')
  const [generandoMc,    setGenerandoMc]    = useState(false)
  const [savingMc,       setSavingMc]       = useState(false)
  const [savedMc,        setSavedMc]        = useState(false)

  // FODA
  const [fodaUrl,        setFodaUrl]        = useState<string | null>(null)
  const [fodaInterp,     setFodaInterp]     = useState('')
  const [upFoda,         setUpFoda]         = useState(false)
  const [savingFoda,     setSavingFoda]     = useState(false)
  const [savedFoda,      setSavedFoda]      = useState(false)

  // Carga inicial
  useEffect(() => { load() }, [patientId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('patient_expediente')
        .select(`ac_apartados_visibles,
                 ac_genograma_url, ac_genograma_interpretacion,
                 ac_mcmaster_archivo1_url, ac_mcmaster_archivo2_url,
                 ac_mcmaster_valores, ac_mcmaster_interpretacion,
                 ac_foda_url, ac_foda_interpretacion,
                 ac_conclusiones`)
        .eq('therapist_id', therapistId)
        .eq('patient_id', patientId)
        .maybeSingle()

      if (data) {
        if (data.ac_apartados_visibles?.length) setVisibles(data.ac_apartados_visibles)
        setGenogramaUrl(data.ac_genograma_url ?? null)
        setGenogramaInterp(data.ac_genograma_interpretacion ?? '')
        setMc1Url(data.ac_mcmaster_archivo1_url ?? null)
        setMc2Url(data.ac_mcmaster_archivo2_url ?? null)
        const vals = data.ac_mcmaster_valores as Record<string, number> | null
        if (vals) setMcValores({
          vd1: vals.vd1?.toString() ?? '',
          vd2: vals.vd2?.toString() ?? '',
          vd3: vals.vd3?.toString() ?? '',
          vd4: vals.vd4?.toString() ?? '',
          vd5: vals.vd5?.toString() ?? '',
          vd6: vals.vd6?.toString() ?? '',
        })
        setMcInterp(data.ac_mcmaster_interpretacion ?? '')
        setFodaUrl(data.ac_foda_url ?? null)
        setFodaInterp(data.ac_foda_interpretacion ?? '')
        setConclusiones((data as Record<string, unknown>).ac_conclusiones as string ?? '')
      }
    } finally {
      setLoading(false)
    }
  }

  // ── Upload a Supabase Storage ──────────────────────────
  async function uploadFile(file: File, tipo: string): Promise<string> {
    const supabase = createClient()
    const ext  = file.name.split('.').pop() ?? 'bin'
    const path = `${therapistId}/${patientId}/${tipo}/${Date.now()}.${ext}`
    const { error } = await supabase.storage
      .from('analisis-clinicos')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (error) throw new Error(error.message)
    const { data: { publicUrl } } = supabase.storage
      .from('analisis-clinicos')
      .getPublicUrl(path)
    return publicUrl
  }

  // ── Guardar campos en DB ───────────────────────────────
  async function upsert(fields: Record<string, unknown>) {
    const supabase = createClient()
    const { error } = await supabase
      .from('patient_expediente')
      .upsert({
        therapist_id: therapistId,
        patient_id: patientId,
        updated_at: new Date().toISOString(),
        ...fields,
      }, { onConflict: 'therapist_id,patient_id' })
    if (error) throw new Error(error.message)
  }

  // ── Índice — toggle visibilidad ────────────────────────
  async function toggleVisible(id: string) {
    const next = visibles.includes(id)
      ? visibles.filter(v => v !== id)
      : [...visibles, id]
    setVisibles(next)
    setSavingIndex(true)
    try { await upsert({ ac_apartados_visibles: next }) }
    catch (e) { alert(`Error: ${(e as Error).message}`) }
    finally { setSavingIndex(false) }
  }

  // ── Genograma ──────────────────────────────────────────
  async function uploadGenograma(file: File) {
    setUpGenograma(true)
    try {
      const url = await uploadFile(file, 'genograma')
      setGenogramaUrl(url)
      await upsert({ ac_genograma_url: url })
    } catch (e) { alert(`Error al subir imagen: ${(e as Error).message}`) }
    finally { setUpGenograma(false) }
  }

  async function saveGenograma() {
    setSavingGeno(true)
    try {
      await upsert({ ac_genograma_interpretacion: genogramaInterp })
      setSavedGeno(true); setTimeout(() => setSavedGeno(false), 3000)
    } catch (e) { alert(`Error: ${(e as Error).message}`) }
    finally { setSavingGeno(false) }
  }

  // ── McMaster — archivos ────────────────────────────────
  async function uploadMc1(file: File) {
    setUpMc1(true)
    try {
      const url = await uploadFile(file, 'mcmaster-1')
      setMc1Url(url)
      await upsert({ ac_mcmaster_archivo1_url: url })
    } catch (e) { alert(`Error al subir archivo: ${(e as Error).message}`) }
    finally { setUpMc1(false) }
  }

  async function uploadMc2(file: File) {
    setUpMc2(true)
    try {
      const url = await uploadFile(file, 'mcmaster-2')
      setMc2Url(url)
      await upsert({ ac_mcmaster_archivo2_url: url })
    } catch (e) { alert(`Error al subir archivo: ${(e as Error).message}`) }
    finally { setUpMc2(false) }
  }

  // ── McMaster — generar interpretación IA ──────────────
  const calc = calcMcMaster(mcValores)

  async function generarInterpretacionMc() {
    if (!calc.rf) { alert('Completa al menos un factor para generar la interpretación.'); return }
    setGenerandoMc(true)
    try {
      const res = await fetch('/api/analisis-clinicos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId, therapistId,
          type: 'mcmaster_interpretacion',
          valores: mcValores,
          resultados: {
            rows: calc.rows,
            rf: calc.rf, rd: calc.rd, eff: calc.eff, conclusion: calc.conclusion,
          },
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { alert(json.error ?? 'Error al generar'); return }
      setMcInterp(json.interpretacion)
    } catch { alert('Error de conexión.') }
    finally { setGenerandoMc(false) }
  }

  async function saveMcMaster() {
    setSavingMc(true)
    try {
      const valores = {
        vd1: parseFloat(mcValores.vd1) || null,
        vd2: parseFloat(mcValores.vd2) || null,
        vd3: parseFloat(mcValores.vd3) || null,
        vd4: parseFloat(mcValores.vd4) || null,
        vd5: parseFloat(mcValores.vd5) || null,
        vd6: parseFloat(mcValores.vd6) || null,
      }
      await upsert({
        ac_mcmaster_valores: valores,
        ac_mcmaster_interpretacion: mcInterp,
      })
      setSavedMc(true); setTimeout(() => setSavedMc(false), 3000)
    } catch (e) { alert(`Error: ${(e as Error).message}`) }
    finally { setSavingMc(false) }
  }

  // ── FODA ───────────────────────────────────────────────
  async function uploadFoda(file: File) {
    setUpFoda(true)
    try {
      const url = await uploadFile(file, 'foda')
      setFodaUrl(url)
      await upsert({ ac_foda_url: url })
    } catch (e) { alert(`Error al subir imagen: ${(e as Error).message}`) }
    finally { setUpFoda(false) }
  }

  async function saveFoda() {
    setSavingFoda(true)
    try {
      await upsert({ ac_foda_interpretacion: fodaInterp })
      setSavedFoda(true); setTimeout(() => setSavedFoda(false), 3000)
    } catch (e) { alert(`Error: ${(e as Error).message}`) }
    finally { setSavingFoda(false) }
  }

  // ── Conclusiones ───────────────────────────────────────
  async function generarConclusiones() {
    setGenerandoConc(true); setErrorConc(null)
    try {
      const res = await fetch('/api/analisis-clinicos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, therapistId, type: 'conclusiones' }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setErrorConc(json.error ?? 'Error al generar'); return }
      setConclusiones(json.conclusiones)
    } catch { setErrorConc('Error de conexión.') }
    finally { setGenerandoConc(false) }
  }

  async function saveConclusiones() {
    setSavingConc(true)
    try {
      await upsert({ ac_conclusiones: conclusiones })
      setSavedConc(true); setTimeout(() => setSavedConc(false), 3000)
    } catch (e) { alert(`Error: ${(e as Error).message}`) }
    finally { setSavingConc(false) }
  }

  // ──────────────────────────────────────────────────────
  if (loading) {
    return <div className="flex justify-center py-16 text-gray-400 text-sm">Cargando…</div>
  }

  return (
    <div className="space-y-4">

      {/* ══ PANEL DE ÍNDICE ══════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <button
          onClick={() => setIndexOpen(o => !o)}
          className="w-full flex items-center justify-between px-6 py-3 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">📋 Índice de Análisis</span>
            <span className="text-xs text-gray-400">— selecciona los análisis que deseas ver</span>
            {savingIndex && <span className="text-xs text-gray-400 animate-pulse">Guardando…</span>}
          </div>
          <span className="text-xs text-gray-400">{indexOpen ? '▲' : '▼'}</span>
        </button>

        {indexOpen && (
          <div className="border-t border-gray-100 px-6 py-4">
            <p className="text-xs text-gray-400 mb-3">
              Marca los análisis que quieres mostrar en esta sección. En el futuro podrás agregar más.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {TODOS_APARTADOS.map(ap => (
                <label
                  key={ap.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-gray-100
                             hover:border-purple-200 hover:bg-purple-50/30 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={visibles.includes(ap.id)}
                    onChange={() => toggleVisible(ap.id)}
                    className="accent-purple-600 w-4 h-4 rounded"
                  />
                  <span className="text-sm">{ap.icon} {ap.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ══ APARTADO: GENOGRAMA ══════════════════════════ */}
      {visibles.includes('genograma') && (
        <ApartadoCard id="genograma" icon="🌳" label="Genograma" hasData={!!genogramaUrl || !!genogramaInterp}>
          <p className="text-xs text-gray-400">
            Sube la imagen del genograma familiar (PNG o JPG recomendado — más ligero que PDF para la PWA).
          </p>
          <ImageUpload
            url={genogramaUrl}
            onUpload={uploadGenograma}
            uploading={upGenograma}
            label="Sube aquí la imagen del Genograma (PNG / JPG)"
          />
          <InterpretacionArea
            value={genogramaInterp}
            onChange={setGenogramaInterp}
            placeholder="Describe tu interpretación del genograma: estructura familiar, patrones relacionales, vínculos significativos…"
            rows={7}
          />
          <div className="flex justify-end pt-2">
            <SaveBtn onClick={saveGenograma} loading={savingGeno} saved={savedGeno} />
          </div>
        </ApartadoCard>
      )}

      {/* ══ APARTADO: ANÁLISIS McMASTER ══════════════════ */}
      {visibles.includes('mcmaster') && (
        <ApartadoCard id="mcmaster" icon="📊" label="Análisis McMaster" hasData={!!mc1Url || !!mcValores.vd1 || !!mcInterp}>

          {/* Archivos de evaluación */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Archivo 1 — Evaluación</p>
              <ImageUpload
                url={mc1Url}
                onUpload={uploadMc1}
                uploading={upMc1}
                accept="image/png,image/jpeg,image/webp,application/pdf"
                label="Sube el primer archivo de evaluación McMaster"
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Archivo 2 — Evaluación</p>
              <ImageUpload
                url={mc2Url}
                onUpload={uploadMc2}
                uploading={upMc2}
                accept="image/png,image/jpeg,image/webp,application/pdf"
                label="Sube el segundo archivo de evaluación McMaster"
              />
            </div>
          </div>

          {/* Tabla de factores */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Evaluación de la Funcionalidad Familiar
            </p>
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Factor</th>
                    <th className="text-center text-xs font-semibold text-gray-500 px-3 py-3 w-28">
                      VD <span className="text-gray-400 font-normal">(##.#)</span>
                    </th>
                    <th className="text-center text-xs font-semibold text-emerald-600 px-3 py-3 w-28">Funcional %</th>
                    <th className="text-center text-xs font-semibold text-red-500 px-3 py-3 w-28">Disfuncional %</th>
                  </tr>
                </thead>
                <tbody>
                  {FACTORES.map((f, i) => {
                    const key  = `vd${i + 1}` as keyof McMasterValores
                    const row  = calc.rows[i]
                    return (
                      <tr key={f.id} className="border-b border-gray-50 last:border-0">
                        <td className="px-4 py-3 text-xs text-gray-700">{f.label}</td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            step="0.1"
                            min={f.vmin}
                            max={f.vmax}
                            value={mcValores[key]}
                            onChange={e => setMcValores(prev => ({ ...prev, [key]: e.target.value }))}
                            placeholder={`${f.vmin}–${f.vmax}`}
                            className="w-24 text-center px-2 py-1.5 rounded-lg border border-gray-200 text-sm
                                       focus:outline-none focus:ring-2 focus:ring-purple-300"
                          />
                        </td>
                        <td className="px-3 py-3 text-center">
                          {row ? (
                            <span className="font-semibold text-emerald-600">{row.funcional}%</span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {row ? (
                            <span className="font-semibold text-red-500">{row.disfuncional}%</span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>

                {/* Resultados globales */}
                {calc.rf !== null && (
                  <>
                    <tfoot>
                      <tr className="bg-gray-50 border-t border-gray-200">
                        <td className="px-4 py-3 text-xs font-semibold text-gray-600">
                          Resultados por evaluación funcional
                        </td>
                        <td />
                        <td className="px-3 py-3 text-center font-bold text-emerald-700">{calc.rf}%</td>
                        <td className="px-3 py-3 text-center font-bold text-red-600">{calc.rd}%</td>
                      </tr>
                      <tr className="bg-purple-50 border-t border-purple-100">
                        <td colSpan={2} className="px-4 py-3 text-xs font-semibold text-gray-700">
                          Evaluación de la Funcionalidad Familiar
                          <span className="text-gray-400 font-normal ml-1">= (RF% + RD%) / 2</span>
                        </td>
                        <td colSpan={2} className="px-3 py-3 text-center">
                          <span
                            className="inline-flex items-center gap-2 text-sm font-bold px-4 py-1.5 rounded-full"
                            style={{
                              background: calc.conclusion === 'Funcional' ? '#d1fae5' : '#fee2e2',
                              color:      calc.conclusion === 'Funcional' ? '#065f46' : '#991b1b',
                            }}
                          >
                            {calc.eff}% — {calc.conclusion}
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </>
                )}
              </table>
            </div>
          </div>

          {/* Interpretación IA */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Interpretación Clínica
              </p>
              <button
                onClick={generarInterpretacionMc}
                disabled={generandoMc || !calc.rf}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium border
                           border-purple-200 text-purple-700 hover:bg-purple-50 transition-colors
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {generandoMc ? (
                  <><span className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />Generando…</>
                ) : '✦ Generar interpretación editable'}
              </button>
            </div>
            <InterpretacionArea
              value={mcInterp}
              onChange={setMcInterp}
              placeholder="La interpretación clínica aparecerá aquí tras generar con IA. Puedes editarla antes de guardar."
              rows={8}
            />
          </div>

          <div className="flex justify-end pt-2 border-t border-gray-100">
            <SaveBtn onClick={saveMcMaster} loading={savingMc} saved={savedMc} />
          </div>
        </ApartadoCard>
      )}

      {/* ══ APARTADO: ANÁLISIS FODA ══════════════════════ */}
      {visibles.includes('foda') && (
        <ApartadoCard id="foda" icon="🔍" label="Análisis FODA" hasData={!!fodaUrl || !!fodaInterp}>
          <p className="text-xs text-gray-400">
            Sube la imagen del análisis FODA (PNG o JPG recomendado — más ligero que PDF para la PWA).
          </p>
          <ImageUpload
            url={fodaUrl}
            onUpload={uploadFoda}
            uploading={upFoda}
            label="Sube aquí la imagen del Análisis FODA (PNG / JPG)"
          />
          <InterpretacionArea
            value={fodaInterp}
            onChange={setFodaInterp}
            placeholder="Describe tu interpretación del FODA: fortalezas, oportunidades, debilidades y amenazas identificadas en el caso…"
            rows={7}
          />
          <div className="flex justify-end pt-2">
            <SaveBtn onClick={saveFoda} loading={savingFoda} saved={savedFoda} />
          </div>
        </ApartadoCard>
      )}

      {/* Sin apartados visibles */}
      {visibles.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-sm font-medium text-gray-500">Sin análisis seleccionados</p>
          <p className="text-xs text-gray-400 mt-1">
            Abre el Índice de Análisis y selecciona los que deseas usar.
          </p>
          <button
            onClick={() => setIndexOpen(true)}
            className="mt-4 text-xs text-purple-600 underline hover:text-purple-800"
          >
            Abrir índice
          </button>
        </div>
      )}

      {/* ══ CONCLUSIONES ═════════════════════════════════════ */}
      {visibles.length > 0 && (
        <ApartadoCard id="conclusiones" icon="🔬" label="Resultados generales (cuantitativos y cualitativos)" hasData={!!conclusiones}>
          {/* Botón generar */}
          <div className="flex items-center justify-between flex-wrap gap-3 -mt-1">
            <p className="text-xs text-gray-400">
              Análisis activos: {visibles.map(id => ({ genograma: 'Genograma', mcmaster: 'McMaster', foda: 'FODA' }[id] ?? id)).join(', ')}
            </p>
            <button
              onClick={generarConclusiones}
              disabled={generandoConc}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white
                         transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: generandoConc ? '#ccc' : AVI }}
            >
              {generandoConc ? (
                <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Generando Conclusiones…</>
              ) : (
                '✦ Conclusiones'
              )}
            </button>
          </div>

          {/* Body */}
          <div className="space-y-4">
            {errorConc && (
              <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{errorConc}</p>
            )}

            {!conclusiones && !generandoConc && (
              <p className="text-xs text-gray-400 italic text-center py-6">
                Presiona <strong>✦ Conclusiones</strong> para generar la evaluación cuantitativa y cualitativa integrando todos los análisis activos.
              </p>
            )}

            {generandoConc && (
              <div className="flex items-center gap-3 py-8 justify-center text-sm text-gray-400">
                <span className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                Analizando datos y consultando fuentes clínicas…
              </div>
            )}

            {conclusiones && !generandoConc && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Texto generado — edita antes de guardar
                  </label>
                  <textarea
                    rows={20}
                    value={conclusiones}
                    onChange={e => setConclusiones(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800
                               focus:outline-none focus:ring-2 resize-y leading-relaxed font-mono"
                    style={{ '--tw-ring-color': AVI } as React.CSSProperties}
                  />
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <p className="text-xs text-gray-400">
                    Al presionar Conclusiones de nuevo se reescribirá el texto anterior.
                  </p>
                  <SaveBtn onClick={saveConclusiones} loading={savingConc} saved={savedConc} />
                </div>
              </>
            )}
          </div>
        </ApartadoCard>
      )}

    </div>
  )
}
