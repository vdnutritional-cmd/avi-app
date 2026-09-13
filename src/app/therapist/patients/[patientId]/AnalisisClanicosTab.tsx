'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  FAD_ITEMS,
  FAD_DIMENSION_LABELS,
  FAD_DIMENSION_ORDER,
  calcularResultadoFAD,
  type FADDimension,
  type FADResult,
} from '@/lib/questionnaires/mcmaster-fad'

// ──────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────
interface Props {
  patientId:   string
  therapistId: string
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
// McMaster — etiquetas cortas de respuesta
// ──────────────────────────────────────────────────────────
const RESP_BADGE: Record<number, { label: string; cls: string }> = {
  1: { label: 'TA', cls: 'bg-green-100 text-green-700' },
  2: { label: 'A',  cls: 'bg-emerald-50 text-emerald-600' },
  3: { label: 'N',  cls: 'bg-gray-100 text-gray-500' },
  4: { label: 'D',  cls: 'bg-orange-100 text-orange-600' },
  5: { label: 'TD', cls: 'bg-red-100 text-red-600' },
}

// Leyenda: TA=Totalmente de acuerdo, A=De acuerdo, N=Neutro, D=En desacuerdo, TD=Totalmente en desacuerdo

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
  const [open, setOpen] = useState(false)
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

  // Proceso Psicológico
  const [procesoPsic,       setProcesoPsic]       = useState('')
  const [generandoProc,     setGenerandoProc]     = useState(false)
  const [savingProc,        setSavingProc]        = useState(false)
  const [savedProc,         setSavedProc]         = useState(false)
  const [errorProc,         setErrorProc]         = useState<string | null>(null)

  const [infoInteres,    setInfoInteres]    = useState('')
  const [savingInfo,     setSavingInfo]     = useState(false)
  const [savedInfo,      setSavedInfo]      = useState(false)

  // Diagnóstico Integrado
  const [diagIntegrado,     setDiagIntegrado]     = useState('')
  const [generandoDiag,     setGenerandoDiag]     = useState(false)
  const [savingDiag,        setSavingDiag]        = useState(false)
  const [savedDiag,         setSavedDiag]         = useState(false)
  const [errorDiag,         setErrorDiag]         = useState<string | null>(null)
  const [tipoCaso,          setTipoCaso]          = useState<string>('Individual')

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
  const [generandoDescGeno, setGenerandoDescGeno] = useState(false)

  // McMaster — cuestionario del paciente
  const [mcQuest,        setMcQuest]        = useState<{ id: string; responses: Record<string,number>; score: FADResult; completed_at: string } | null>(null)
  const [mcResult,       setMcResult]       = useState<FADResult | null>(null)
  const [mcInterp,       setMcInterp]       = useState('')
  const [mcLoadError,    setMcLoadError]    = useState<string | null>(null)
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

      // Expediente
      const { data } = await supabase
        .from('patient_expediente')
        .select(`tipo_caso, ac_proceso_psicologico, ac_apartados_visibles,
                 ac_genograma_url, ac_genograma_interpretacion,
                 ac_mcmaster_interpretacion,
                 ac_foda_url, ac_foda_interpretacion,
                 ac_diagnostico_integrado, ac_conclusiones, ac_informacion_interes`)
        .eq('therapist_id', therapistId)
        .eq('patient_id', patientId)
        .maybeSingle()

      if (data) {
        if (data.tipo_caso) setTipoCaso(data.tipo_caso as string)
        setProcesoPsic((data as Record<string, unknown>).ac_proceso_psicologico as string ?? '')
        if (data.ac_apartados_visibles?.length) setVisibles(data.ac_apartados_visibles)
        setGenogramaUrl(data.ac_genograma_url ?? null)
        setGenogramaInterp(data.ac_genograma_interpretacion ?? '')
        setMcInterp(data.ac_mcmaster_interpretacion ?? '')
        setFodaUrl(data.ac_foda_url ?? null)
        setFodaInterp(data.ac_foda_interpretacion ?? '')
        setDiagIntegrado((data as Record<string, unknown>).ac_diagnostico_integrado as string ?? '')
        setConclusiones((data as Record<string, unknown>).ac_conclusiones as string ?? '')
        setInfoInteres((data as Record<string, unknown>).ac_informacion_interes as string ?? '')
      }

      // Cuestionario McMaster más reciente completado
      const { data: qData, error: qErr } = await supabase
        .from('patient_questionnaires')
        .select('id, responses, score, completed_at')
        .eq('patient_id', patientId)
        .eq('questionnaire_type', 'mcmaster_fad')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (qErr) {
        setMcLoadError('Error al cargar el cuestionario McMaster.')
      } else if (qData) {
        const quest = qData as { id: string; responses: Record<string,number>; score: FADResult; completed_at: string }
        setMcQuest(quest)
        // Recalcular para validar
        const recalc = calcularResultadoFAD(quest.responses)
        setMcResult(recalc)
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

  async function generarDescripcionGenograma() {
    setGenerandoDescGeno(true)
    try {
      const res = await fetch('/api/analisis-clinicos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, therapistId, type: 'genograma_descripcion' }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { alert(json.error ?? 'Error al generar'); return }
      setGenogramaInterp(json.descripcion)
    } catch { alert('Error de conexión.') }
    finally { setGenerandoDescGeno(false) }
  }

  async function saveGenograma() {
    setSavingGeno(true)
    try {
      await upsert({ ac_genograma_interpretacion: genogramaInterp })
      setSavedGeno(true); setTimeout(() => setSavedGeno(false), 3000)
    } catch (e) { alert(`Error: ${(e as Error).message}`) }
    finally { setSavingGeno(false) }
  }

  // ── McMaster — generar interpretación IA ──────────────
  async function generarInterpretacionMc() {
    if (!mcResult) { alert('No hay resultados McMaster del paciente para interpretar.'); return }
    setGenerandoMc(true)
    try {
      const res = await fetch('/api/analisis-clinicos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId, therapistId,
          type: 'mcmaster_interpretacion',
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
      await upsert({ ac_mcmaster_interpretacion: mcInterp })
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

  // ── Proceso Psicológico ────────────────────────────────
  async function generarProcesoPsicologico() {
    setGenerandoProc(true); setErrorProc(null)
    try {
      const res = await fetch('/api/analisis-clinicos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, therapistId, type: 'proceso_psicologico' }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setErrorProc(json.error ?? 'Error al generar'); return }
      setProcesoPsic(json.proceso)
    } catch { setErrorProc('Error de conexión.') }
    finally { setGenerandoProc(false) }
  }

  async function saveProcesoPsicologico() {
    setSavingProc(true)
    try {
      await upsert({ ac_proceso_psicologico: procesoPsic })
      setSavedProc(true); setTimeout(() => setSavedProc(false), 3000)
    } catch (e) { alert(`Error: ${(e as Error).message}`) }
    finally { setSavingProc(false) }
  }

  // ── Diagnóstico Integrado ──────────────────────────────
  async function generarDiagnosticoIntegrado() {
    setGenerandoDiag(true); setErrorDiag(null)
    try {
      const res = await fetch('/api/analisis-clinicos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, therapistId, type: 'diagnostico_integrado' }),
      })
      const json = await res.json()
      if (!res.ok || json.error) { setErrorDiag(json.error ?? 'Error al generar'); return }
      setDiagIntegrado(json.diagnostico)
    } catch { setErrorDiag('Error de conexión.') }
    finally { setGenerandoDiag(false) }
  }

  async function saveDiagnosticoIntegrado() {
    setSavingDiag(true)
    try {
      await upsert({ ac_diagnostico_integrado: diagIntegrado })
      setSavedDiag(true); setTimeout(() => setSavedDiag(false), 3000)
    } catch (e) { alert(`Error: ${(e as Error).message}`) }
    finally { setSavingDiag(false) }
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

  async function saveInfoInteres() {
    setSavingInfo(true)
    try {
      await upsert({ ac_informacion_interes: infoInteres })
      setSavedInfo(true); setTimeout(() => setSavedInfo(false), 3000)
    } catch (e) { alert(`Error: ${(e as Error).message}`) }
    finally { setSavingInfo(false) }
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
              Marca los análisis que quieres mostrar en esta sección.
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
          {/* Botón generar descripción */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Descripción / Interpretación del Terapeuta
            </label>
            <button
              onClick={generarDescripcionGenograma}
              disabled={generandoDescGeno}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium border
                         border-purple-200 text-purple-700 hover:bg-purple-50 transition-colors
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {generandoDescGeno ? (
                <><span className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />Generando…</>
              ) : '✦ Generar descripción desde Sesión inicial'}
            </button>
          </div>
          <InterpretacionArea
            value={genogramaInterp}
            onChange={setGenogramaInterp}
            placeholder="Presiona 'Generar descripción' para obtener una guía de las relaciones familiares basada en la Sesión inicial, o escribe tu interpretación directamente…"
            rows={7}
          />
          <div className="flex justify-end pt-2">
            <SaveBtn onClick={saveGenograma} loading={savingGeno} saved={savedGeno} />
          </div>
        </ApartadoCard>
      )}

      {/* ══ APARTADO: ANÁLISIS McMASTER ══════════════════ */}
      {visibles.includes('mcmaster') && (
        <ApartadoCard id="mcmaster" icon="📊" label="Análisis McMaster" hasData={!!mcResult || !!mcInterp}>

          {/* Sin cuestionario completado */}
          {mcLoadError && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{mcLoadError}</p>
          )}

          {!mcQuest && !mcLoadError && (
            <div className="text-center py-8 space-y-2">
              <p className="text-3xl">📋</p>
              <p className="text-sm text-gray-500 font-medium">Sin cuestionario completado</p>
              <p className="text-xs text-gray-400">
                El paciente aún no ha completado el cuestionario FAD McMaster.<br />
                Asígnalo desde la pestaña <strong>Cuestionarios</strong>.
              </p>
            </div>
          )}

          {/* Respuestas por dimensión — 6 bloques (3 columnas × 2 filas) */}
          {mcQuest && mcResult && (
            <>
              {/* Encabezado del cuestionario */}
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>Completado:</span>
                <span className="font-medium text-gray-600">
                  {new Date(mcQuest.completed_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>

              {/* Leyenda de respuestas */}
              <div className="flex flex-wrap gap-1.5 text-xs">
                <span className="text-gray-400 mr-1">Respuestas:</span>
                {[
                  { v: 1, label: 'TA = Totalmente de acuerdo' },
                  { v: 2, label: 'A = De acuerdo' },
                  { v: 3, label: 'N = Neutro' },
                  { v: 4, label: 'D = En desacuerdo' },
                  { v: 5, label: 'TD = Totalmente en desacuerdo' },
                ].map(({ v, label }) => (
                  <span key={v} className={`px-1.5 py-0.5 rounded ${RESP_BADGE[v].cls}`}>{label}</span>
                ))}
              </div>

              {/* Grid 3×2 de dimensiones */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {FAD_DIMENSION_ORDER.map(dim => {
                  const itemsDim = FAD_ITEMS.filter(i => i.dimension === dim)
                  return (
                    <div key={dim} className="bg-gray-50 rounded-xl p-2.5 space-y-1">
                      <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-wide mb-1.5">
                        {FAD_DIMENSION_LABELS[dim]}
                      </p>
                      {itemsDim.map(item => {
                        const resp = mcQuest.responses[String(item.id)]
                        const badge = resp ? RESP_BADGE[resp] : null
                        return (
                          <div key={item.id} className="flex items-start gap-1.5">
                            <span className="text-[9px] text-gray-400 mt-0.5 w-4 shrink-0">{item.id}.</span>
                            <span className="text-[9px] text-gray-600 leading-snug flex-1">{item.text}</span>
                            {badge ? (
                              <span className={`text-[8px] font-bold px-1 py-0.5 rounded shrink-0 ${badge.cls}`}>{badge.label}</span>
                            ) : (
                              <span className="text-[8px] text-gray-300 shrink-0">—</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>

              {/* Tabla FAD — sin barras */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Evaluación de Funcionalidad Familiar — FAD McMaster
                </p>
                <FADReporteSimple score={mcResult} />
              </div>

              {/* Interpretación IA */}
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Generación interpretación editable
                  </p>
                  <button
                    onClick={generarInterpretacionMc}
                    disabled={generandoMc}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium border
                               border-purple-200 text-purple-700 hover:bg-purple-50 transition-colors
                               disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {generandoMc ? (
                      <><span className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />Generando…</>
                    ) : '✦ Generar interpretación editable'}
                  </button>
                </div>
                {generandoMc && (
                  <div className="flex items-center gap-3 py-4 text-xs text-gray-400">
                    <span className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                    Analizando resultados y consultando fuentes clínicas…
                  </div>
                )}
                <InterpretacionArea
                  value={mcInterp}
                  onChange={setMcInterp}
                  placeholder="La interpretación clínica del FAD McMaster aparecerá aquí. Puedes editarla antes de guardar."
                  rows={8}
                />
              </div>

              <div className="flex justify-end pt-2 border-t border-gray-100">
                <SaveBtn onClick={saveMcMaster} loading={savingMc} saved={savedMc} />
              </div>
            </>
          )}
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
        <ApartadoCard id="conclusiones" icon="🔬" label="Resultados generales de los análisis técnicos (cuantitativos y cualitativos)" hasData={!!conclusiones}>
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
                    Resumen del Terapeuta — edita antes de guardar
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

      {/* ══ DIAGNÓSTICO INTEGRADO ════════════════════════════ */}
      <ApartadoCard
        id="diagnostico_integrado"
        icon="🧬"
        label={`Diagnóstico Integrado — ${tipoCaso}`}
        hasData={!!diagIntegrado}
      >
        <div className="flex items-center justify-between flex-wrap gap-3 -mt-1">
          <p className="text-xs text-gray-400">
            Genera una exposición clínica y resumen del caso a partir de los datos {tipoCaso}.
          </p>
          <button
            onClick={generarDiagnosticoIntegrado}
            disabled={generandoDiag}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white
                       transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: generandoDiag ? '#ccc' : AVI }}
          >
            {generandoDiag ? (
              <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Generando…</>
            ) : (
              '✦ Diagnóstico Integrado'
            )}
          </button>
        </div>

        <div className="space-y-4">
          {errorDiag && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{errorDiag}</p>
          )}

          {!diagIntegrado && !generandoDiag && (
            <p className="text-xs text-gray-400 italic text-center py-6">
              Presiona <strong>✦ Diagnóstico Integrado</strong> para generar la exposición clínica y el resumen del caso.
            </p>
          )}

          {generandoDiag && (
            <div className="flex items-center gap-3 py-8 justify-center text-sm text-gray-400">
              <span className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
              Elaborando diagnóstico integrado y consultando fuentes clínicas…
            </div>
          )}

          {diagIntegrado && !generandoDiag && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Diagnóstico del Terapeuta — edita antes de guardar
                </label>
                <textarea
                  rows={22}
                  value={diagIntegrado}
                  onChange={e => setDiagIntegrado(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800
                             focus:outline-none focus:ring-2 resize-y leading-relaxed font-mono"
                  style={{ '--tw-ring-color': AVI } as React.CSSProperties}
                />
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-400">
                  Al presionar el botón de nuevo se reescribirá el texto anterior.
                </p>
                <SaveBtn onClick={saveDiagnosticoIntegrado} loading={savingDiag} saved={savedDiag} />
              </div>
            </>
          )}
        </div>
      </ApartadoCard>

      {/* ══ INFORMACIÓN DEL PROCESO PSICOLÓGICO ═════════════ */}
      <ApartadoCard
        id="proceso_psicologico"
        icon="📋"
        label="Información del proceso psicológico"
        hasData={!!procesoPsic}
      >
        <div className="flex items-center justify-between flex-wrap gap-3 -mt-1">
          <p className="text-xs text-gray-400">
            Informe integrado del proceso: asistencia, síntomas, cuadro comparativo de sesiones y conclusiones.
          </p>
          <button
            onClick={generarProcesoPsicologico}
            disabled={generandoProc}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white
                       transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: generandoProc ? '#ccc' : AVI }}
          >
            {generandoProc ? (
              <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Generando…</>
            ) : (
              '✦ Generar Informe'
            )}
          </button>
        </div>

        <div className="space-y-4">
          {errorProc && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{errorProc}</p>
          )}

          {!procesoPsic && !generandoProc && (
            <p className="text-xs text-gray-400 italic text-center py-6">
              Presiona <strong>✦ Generar Informe</strong> para crear el informe del proceso psicológico.
            </p>
          )}

          {generandoProc && (
            <div className="flex items-center gap-3 py-8 justify-center text-sm text-gray-400">
              <span className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
              Analizando proceso, sesiones y consultando fuentes clínicas…
            </div>
          )}

          {procesoPsic && !generandoProc && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Informe del Terapeuta — edita antes de guardar
                </label>
                <textarea
                  rows={28}
                  value={procesoPsic}
                  onChange={e => setProcesoPsic(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800
                             focus:outline-none focus:ring-2 resize-y leading-relaxed font-mono"
                  style={{ '--tw-ring-color': AVI } as React.CSSProperties}
                />
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-400">
                  Al generar de nuevo se reescribirá el texto anterior.
                </p>
                <SaveBtn onClick={saveProcesoPsicologico} loading={savingProc} saved={savedProc} />
              </div>
            </>
          )}
        </div>
      </ApartadoCard>

      {/* Información de interés */}
      <ApartadoCard
        id="informacion_interes"
        icon="📌"
        label="Información de interés"
        hasData={!!infoInteres}
      >
        <div className="space-y-3">
          <p className="text-xs text-gray-400">
            Espacio libre para añadir cualquier información relevante que el terapeuta considere pertinente.
          </p>
          <textarea
            rows={8}
            value={infoInteres}
            onChange={e => setInfoInteres(e.target.value)}
            placeholder="Escribe aquí la información adicional de interés…"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800
                       focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-y leading-relaxed"
          />
          <div className="flex justify-end">
            <SaveBtn onClick={saveInfoInteres} loading={savingInfo} saved={savedInfo} />
          </div>
        </div>
      </ApartadoCard>

    </div>
  )
}

// ── FAD Reporte (sin barras) ─────────────────────────────────────────────────
function FADReporteSimple({ score }: { score: FADResult }) {
  const { dimensions, global } = score
  const esFuncional = global.evaluacion === 'FUNCIONAL'
  const valorMax    = Math.max(global.pctREF, global.pctRED)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <th className="text-left px-3 py-2 font-semibold rounded-tl-xl">Dimensión</th>
            <th className="text-center px-3 py-2 font-semibold">VD</th>
            <th className="text-center px-3 py-2 font-semibold text-green-700">% Funcional</th>
            <th className="text-center px-3 py-2 font-semibold text-red-600 rounded-tr-xl">% Disfuncional</th>
          </tr>
        </thead>
        <tbody>
          {FAD_DIMENSION_ORDER.map((dim, idx) => {
            const d = dimensions[dim]
            if (!d) return null
            const esDis = d.pctDD > d.pctFD
            return (
              <tr key={dim} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                <td className="px-3 py-2.5 text-gray-700 font-medium text-xs">{FAD_DIMENSION_LABELS[dim]}</td>
                <td className="px-3 py-2.5 text-center text-gray-500 text-xs">{d.VD}</td>
                <td className="px-3 py-2.5 text-center">
                  <span className={`font-semibold text-xs ${esDis ? 'text-gray-500' : 'text-green-600'}`}>{d.pctFD}%</span>
                </td>
                <td className="px-3 py-2.5 text-center">
                  <span className={`font-semibold text-xs ${esDis ? 'text-red-600' : 'text-gray-400'}`}>{d.pctDD}%</span>
                </td>
              </tr>
            )
          })}

          {/* Fila 7 — Resultado por Evaluación Funcional */}
          <tr className="bg-indigo-50 border-t-2 border-indigo-200">
            <td className="px-3 py-2.5 text-indigo-800 font-semibold text-xs" colSpan={2}>
              Resultado por Evaluación Funcional
            </td>
            <td className="px-3 py-2.5 text-center font-bold text-green-700 text-xs">{global.pctREF}%</td>
            <td className="px-3 py-2.5 text-center font-bold text-red-600 text-xs">{global.pctRED}%</td>
          </tr>

          {/* Fila 8 — Evaluación final */}
          <tr className={`border-t-2 ${esFuncional ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <td className="px-3 py-3 text-xs font-semibold text-gray-600" colSpan={2}>
              Evaluación de la Funcionalidad Familiar
            </td>
            <td className="px-3 py-3 text-center font-bold text-base" colSpan={2}>
              <span className={esFuncional ? 'text-green-700' : 'text-red-700'}>
                {valorMax}% — {global.evaluacion}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
