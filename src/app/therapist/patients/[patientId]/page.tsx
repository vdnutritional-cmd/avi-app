'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ExpedienteTab from './ExpedienteTab'
import DatosGeneralesTab from './DatosGeneralesTab'
import TipoCasoTab from './TipoCasoTab'

const MAX_SESIONES_PRESENCIALES = 12

// Fecha de hoy en horario de la Ciudad de México (YYYY-MM-DD)
function hoyMX(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' })
}

interface Pattern {
  id: string
  summary: string
  emotional_patterns: string[]
  predominant_emotions: string[]
  reformulation: string
  crisis_detected: boolean
  created_at: string
}

interface Analysis {
  id: string
  content: string
  created_at: string
}

interface SessionNote {
  id: string
  session_number: number
  session_date: string
  session_objetivo: string | null
  session_desarrollo: string | null
  notes: string             // Observaciones particulares
  is_pro_bono: boolean
  is_virtual: boolean
}

interface PatientProfile {
  full_name: string
  email: string
}

export default function PatientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const patientId = params.patientId as string

  const [profile, setProfile] = useState<PatientProfile | null>(null)
  const [patterns, setPatterns] = useState<Pattern[]>([])
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [sessionNotes, setSessionNotes] = useState<SessionNote[]>([])
  const [initialNote, setInitialNote] = useState('')
  const [savedNote, setSavedNote] = useState('')
  const [initialNoteDate, setInitialNoteDate] = useState(hoyMX())
  const [savedNoteDate, setSavedNoteDate] = useState(hoyMX())
  const [initialNoteProBono, setInitialNoteProBono] = useState(false)
  const [savedNoteProBono, setSavedNoteProBono] = useState(false)
  const [initialNoteVirtual, setInitialNoteVirtual] = useState(false)
  const [savedNoteVirtual, setSavedNoteVirtual] = useState(false)
  const [initialNoteMotivo, setInitialNoteMotivo] = useState('')
  const [savedNoteMotivo, setSavedNoteMotivo] = useState('')
  const [initialNoteSubyacente, setInitialNoteSubyacente] = useState('')
  const [savedNoteSubyacente, setSavedNoteSubyacente] = useState('')
  const [initialNotePremisas, setInitialNotePremisas] = useState('')
  const [savedNotePremisas, setSavedNotePremisas] = useState('')
  // Sprint 4 — VIII + IX
  const [sensacionPaciente, setSensacionPaciente] = useState('0')
  const [savedSensacionPaciente, setSavedSensacionPaciente] = useState('0')
  const [factoresRiesgo, setFactoresRiesgo] = useState<{ individual: string[]; familiar: string[] }>({ individual: [], familiar: [] })
  const [savedFactoresRiesgo, setSavedFactoresRiesgo] = useState<{ individual: string[]; familiar: string[] }>({ individual: [], familiar: [] })
  const [factoresProteccion, setFactoresProteccion] = useState<{ individual: string[]; familiar: string[] }>({ individual: [], familiar: [] })
  const [savedFactoresProteccion, setSavedFactoresProteccion] = useState<{ individual: string[]; familiar: string[] }>({ individual: [], familiar: [] })
  const [frecuenciaConfig, setFrecuenciaConfig] = useState('')
  const [savedFrecuenciaConfig, setSavedFrecuenciaConfig] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [noteSaved, setNoteSaved] = useState(false)

  // Nueva sesión presencial
  const [newSessionDate, setNewSessionDate] = useState(hoyMX())
  const [newSessionObjetivo, setNewSessionObjetivo] = useState('')
  const [newSessionDesarrollo, setNewSessionDesarrollo] = useState('')
  const [newSessionNotes, setNewSessionNotes] = useState('')  // Observaciones particulares
  const [newSessionProBono, setNewSessionProBono] = useState(false)
  const [newSessionIsVirtual, setNewSessionIsVirtual] = useState(false)
  const [savingSession, setSavingSession] = useState(false)
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)

  // Edición de nombre
  const [isEditingName, setIsEditingName] = useState(false)
  const [editingName, setEditingName] = useState('')
  const [savingName, setSavingName] = useState(false)

  const [empresaNombre, setEmpresaNombre] = useState<string | null>(null)
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [editingEmpresa, setEditingEmpresa] = useState(false)
  const [empresasList, setEmpresasList] = useState<{ id: string; nombre: string }[]>([])
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>('')
  const [savingEmpresa, setSavingEmpresa] = useState(false)

  const [analyzing, setAnalyzing] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [analysisError, setAnalysisError] = useState<string | null>(null)

  // Datos generales del asesorado (pre-cargados para evitar problemas de timing)
  // undefined = aún no cargado; null = cargado pero sin fila; object = datos disponibles
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [expedienteRow, setExpedienteRow] = useState<Record<string, any> | null | undefined>(undefined)

  const [activeTab, setActiveTab] = useState<'datos-generales' | 'tipo-caso' | 'sesiones' | 'presenciales' | 'analisis' | 'nota' | 'expediente'>('datos-generales')
  const [therapistId, setTherapistId] = useState<string | null>(null)
  const [tier, setTier] = useState<'esencial' | 'clinico'>('esencial')
  const streamRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    load()
  }, [patientId])

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.id) setTherapistId(user.id)

    // Obtener tier de suscripción del terapeuta
    if (user?.id) {
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('tier')
        .eq('therapist_id', user.id)
        .maybeSingle()
      if (sub?.tier === 'clinico') setTier('clinico')
    }

    const [profileRes, patternsRes, analysesRes, relationRes, sessionNotesRes, expedienteRes] = await Promise.all([
      supabase.from('profiles').select('full_name, email').eq('id', patientId).single(),
      supabase.from('patterns').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }),
      supabase.from('analyses').select('*').eq('patient_id', patientId).eq('therapist_id', user?.id ?? '').order('created_at', { ascending: false }),
      supabase.from('therapist_patients').select('initial_note, initial_note_date, initial_note_pro_bono, initial_note_virtual, initial_note_motivo, initial_note_subyacente, initial_note_premisas, sensacion_paciente_inicial, factores_riesgo_sel, factores_proteccion_sel, frecuencia_config, empresa_id, convenio_empresas(nombre)').eq('patient_id', patientId).eq('therapist_id', user?.id ?? '').single(),
      supabase.from('therapist_session_notes').select('*').eq('patient_id', patientId).order('session_number', { ascending: true }),
      supabase.from('patient_expediente').select('*').eq('therapist_id', user?.id ?? '').eq('patient_id', patientId).maybeSingle(),
    ])

    if (profileRes.data) setProfile(profileRes.data)
    if (patternsRes.data) setPatterns(patternsRes.data)
    if (analysesRes.data) setAnalyses(analysesRes.data)
    if (sessionNotesRes.data) setSessionNotes(sessionNotesRes.data)
    // Siempre actualizar (null si no hay fila) para que DatosGeneralesTab sepa que ya terminó la carga
    setExpedienteRow(expedienteRes.data ?? null)

    // Empresa CONVENIO del paciente (si tiene)
    const empresaRaw = relationRes.data?.convenio_empresas as unknown
    const empresaObj = Array.isArray(empresaRaw) ? empresaRaw[0] : empresaRaw
    const nombreEmpresa = (empresaObj as { nombre?: string } | null)?.nombre ?? null
    const idEmpresa = (relationRes.data as { empresa_id?: string | null } | null)?.empresa_id ?? null
    setEmpresaNombre(nombreEmpresa)
    setEmpresaId(idEmpresa)
    setSelectedEmpresaId(idEmpresa ?? '')

    // Cargar lista de empresas para el editor
    try {
      const empRes = await fetch('/api/convenio-empresas')
      if (empRes.ok) {
        const empData = await empRes.json()
        setEmpresasList(empData.empresas ?? [])
      }
    } catch { /* sin empresas disponibles */ }

    if (relationRes.data?.initial_note) {
      setInitialNote(relationRes.data.initial_note)
      setSavedNote(relationRes.data.initial_note)
    }
    const noteDate = relationRes.data?.initial_note_date ?? hoyMX()
    setInitialNoteDate(noteDate)
    setSavedNoteDate(noteDate)
    const notePb = relationRes.data?.initial_note_pro_bono ?? false
    setInitialNoteProBono(notePb)
    setSavedNoteProBono(notePb)
    const noteVirtual = relationRes.data?.initial_note_virtual ?? false
    setInitialNoteVirtual(noteVirtual)
    setSavedNoteVirtual(noteVirtual)
    const noteMotivo = relationRes.data?.initial_note_motivo ?? ''
    setInitialNoteMotivo(noteMotivo)
    setSavedNoteMotivo(noteMotivo)
    const noteSubyacente = relationRes.data?.initial_note_subyacente ?? ''
    setInitialNoteSubyacente(noteSubyacente)
    setSavedNoteSubyacente(noteSubyacente)
    const notePremisas = relationRes.data?.initial_note_premisas ?? ''
    setInitialNotePremisas(notePremisas)
    setSavedNotePremisas(notePremisas)

    // Sprint 4 — VIII: sensación inicial ('n/a' o vacío → '0')
    const rawSensacion = relationRes.data?.sensacion_paciente_inicial ?? '0'
    const sensacion = (rawSensacion === 'n/a' || !rawSensacion) ? '0' : rawSensacion
    setSensacionPaciente(sensacion)
    setSavedSensacionPaciente(sensacion)

    // Sprint 4 — VIII: factores de riesgo (jsonb: objeto {individual, familiar})
    const emptyFactores = { individual: [] as string[], familiar: [] as string[] }
    const rawRiesgo = relationRes.data?.factores_riesgo_sel
    const factRiesgo = (rawRiesgo && typeof rawRiesgo === 'object' && !Array.isArray(rawRiesgo))
      ? { individual: rawRiesgo.individual ?? [], familiar: rawRiesgo.familiar ?? [] }
      : emptyFactores
    setFactoresRiesgo(factRiesgo)
    setSavedFactoresRiesgo(factRiesgo)

    // Sprint 4 — VIII: factores de protección
    const rawProteccion = relationRes.data?.factores_proteccion_sel
    const factProteccion = (rawProteccion && typeof rawProteccion === 'object' && !Array.isArray(rawProteccion))
      ? { individual: rawProteccion.individual ?? [], familiar: rawProteccion.familiar ?? [] }
      : emptyFactores
    setFactoresProteccion(factProteccion)
    setSavedFactoresProteccion(factProteccion)

    // Sprint 4 — IX: frecuencia configurada
    const freqConf = relationRes.data?.frecuencia_config ?? ''
    setFrecuenciaConfig(freqConf)
    setSavedFrecuenciaConfig(freqConf)
  }

  useEffect(() => {
    streamRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [streamText])

  async function saveEmpresa() {
    setSavingEmpresa(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSavingEmpresa(false); return }

    const nuevoId = selectedEmpresaId || null
    await supabase
      .from('therapist_patients')
      .update({ empresa_id: nuevoId })
      .eq('therapist_id', user.id)
      .eq('patient_id', patientId)

    setEmpresaId(nuevoId)
    setEmpresaNombre(empresasList.find(e => e.id === nuevoId)?.nombre ?? null)
    setEditingEmpresa(false)
    setSavingEmpresa(false)
  }

  async function saveName() {
    if (!editingName.trim()) return
    setSavingName(true)
    try {
      const res = await fetch('/api/patients/rename', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, fullName: editingName }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(`Error al guardar nombre: ${err.error ?? res.status}`)
        return
      }
      setProfile(prev => prev ? { ...prev, full_name: editingName.trim() } : prev)
      setIsEditingName(false)
    } catch {
      alert('Error de red al guardar el nombre.')
    } finally {
      setSavingName(false)
    }
  }

  async function saveNote() {
    setSavingNote(true)
    try {
      const res = await fetch('/api/analysis', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId, initialNote, initialNoteDate, initialNoteProBono, initialNoteVirtual,
          initialNoteMotivo, initialNoteSubyacente, initialNotePremisas,
          sensacionPaciente, factoresRiesgo, factoresProteccion, frecuenciaConfig,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(`Error al guardar la nota: ${err.error ?? res.status}`)
        return
      }
      setSavedNote(initialNote)
      setSavedNoteDate(initialNoteDate)
      setSavedNoteProBono(initialNoteProBono)
      setSavedNoteVirtual(initialNoteVirtual)
      setSavedNoteMotivo(initialNoteMotivo)
      setSavedNoteSubyacente(initialNoteSubyacente)
      setSavedNotePremisas(initialNotePremisas)
      setSavedSensacionPaciente(sensacionPaciente)
      setSavedFactoresRiesgo(factoresRiesgo)
      setSavedFactoresProteccion(factoresProteccion)
      setSavedFrecuenciaConfig(frecuenciaConfig)
      setNoteSaved(true)
      setTimeout(() => setNoteSaved(false), 3000)
    } catch {
      alert('Error de red al guardar la nota. Intenta de nuevo.')
    } finally {
      setSavingNote(false)
    }
  }

  async function saveSessionNote() {
    const hayContenido = newSessionObjetivo.trim() || newSessionDesarrollo.trim() || newSessionNotes.trim()
    if (!hayContenido) return
    if (!therapistId) { alert('Error: sesión de terapeuta no encontrada. Recarga la página.'); return }
    setSavingSession(true)
    try {
      const supabase = createClient()
      const nextNumber = editingSessionId
        ? sessionNotes.find(s => s.id === editingSessionId)?.session_number ?? 1
        : (sessionNotes.length > 0 ? Math.max(...sessionNotes.map(s => s.session_number)) + 1 : 1)

      const payload = {
        session_date:      newSessionDate,
        session_objetivo:  newSessionObjetivo  || null,
        session_desarrollo: newSessionDesarrollo || null,
        notes:             newSessionNotes     || null,   // Observaciones particulares
        is_pro_bono:       newSessionProBono,
        is_virtual:        newSessionIsVirtual,
      }

      if (editingSessionId) {
        const { error } = await supabase
          .from('therapist_session_notes')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editingSessionId)
          .eq('therapist_id', therapistId)
        if (error) { alert(`Error al actualizar la sesión: ${error.message}`); return }
      } else {
        const { error } = await supabase
          .from('therapist_session_notes')
          .insert({ therapist_id: therapistId, patient_id: patientId, session_number: nextNumber, ...payload })
        if (error) { alert(`Error al guardar la sesión: ${error.message}`); return }
      }

      setNewSessionObjetivo('')
      setNewSessionDesarrollo('')
      setNewSessionNotes('')
      setNewSessionDate(hoyMX())
      setNewSessionProBono(false)
      setNewSessionIsVirtual(false)
      setEditingSessionId(null)
      await load()
    } finally {
      setSavingSession(false)
    }
  }

  function startEdit(session: SessionNote) {
    setEditingSessionId(session.id)
    setNewSessionDate(session.session_date)
    setNewSessionObjetivo(session.session_objetivo ?? '')
    setNewSessionDesarrollo(session.session_desarrollo ?? '')
    setNewSessionNotes(session.notes ?? '')
    setNewSessionProBono(session.is_pro_bono ?? false)
    setNewSessionIsVirtual(session.is_virtual ?? false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function requestAnalysis() {
    if (analyzing) return
    setAnalyzing(true)
    setStreamText('')
    setAnalysisError(null)
    setActiveTab('analisis')

    try {
      const response = await fetch('/api/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error ?? `Error ${response.status}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          let data: Record<string, unknown>
          try {
            data = JSON.parse(line.slice(6))
          } catch {
            continue // línea malformada, ignorar
          }
          if (data.error) throw new Error(data.error as string)
          if (data.text) {
            fullText += data.text as string
            setStreamText(fullText)
          }
          if (data.done) {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            const { data: newAnalyses } = await supabase
              .from('analyses').select('*')
              .eq('patient_id', patientId)
              .eq('therapist_id', user?.id ?? '')
              .order('created_at', { ascending: false })
            if (newAnalyses) setAnalyses(newAnalyses)
          }
        }
      }

      if (!fullText) throw new Error('No se recibió contenido del análisis')

    } catch (e) {
      setAnalysisError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setAnalyzing(false)
    }
  }

  const noteChanged =
    initialNote !== savedNote ||
    initialNoteDate !== savedNoteDate ||
    initialNoteProBono !== savedNoteProBono ||
    initialNoteVirtual !== savedNoteVirtual ||
    initialNoteMotivo !== savedNoteMotivo ||
    initialNoteSubyacente !== savedNoteSubyacente ||
    initialNotePremisas !== savedNotePremisas ||
    sensacionPaciente !== savedSensacionPaciente ||
    JSON.stringify(factoresRiesgo) !== JSON.stringify(savedFactoresRiesgo) ||
    JSON.stringify(factoresProteccion) !== JSON.stringify(savedFactoresProteccion) ||
    frecuenciaConfig !== savedFrecuenciaConfig
  const hayContenidoNuevaSesion = !!(newSessionObjetivo.trim() || newSessionDesarrollo.trim() || newSessionNotes.trim())
  const puedeAgregarSesion = sessionNotes.length < MAX_SESIONES_PRESENCIALES || editingSessionId !== null

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <button onClick={() => router.push('/therapist/patients')}
            className="text-sm text-gray-400 hover:text-gray-600 mb-2 flex items-center gap-1">
            ← Mis pacientes
          </button>

          {/* Nombre editable */}
          {isEditingName ? (
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={editingName}
                onChange={e => setEditingName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setIsEditingName(false) }}
                autoFocus
                className="text-2xl font-bold text-gray-800 border-b-2 border-primary-400 outline-none bg-transparent w-64"
              />
              <button
                onClick={saveName}
                disabled={savingName || !editingName.trim()}
                className="text-sm px-3 py-1 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-40"
              >
                {savingName ? 'Guardando…' : 'Guardar'}
              </button>
              <button
                onClick={() => setIsEditingName(false)}
                className="text-sm px-3 py-1 border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-800">{profile?.full_name ?? '...'}</h1>
              {profile && (
                <button
                  onClick={() => { setEditingName(profile.full_name ?? ''); setIsEditingName(true) }}
                  title="Editar nombre"
                  className="text-gray-300 hover:text-primary-500 transition-colors text-base leading-none"
                >
                  ✏️
                </button>
              )}
            </div>
          )}

          <p className="text-sm text-gray-400">{profile?.email}</p>
          {/* Empresa CONVENIO — editable */}
          {editingEmpresa ? (
            <div className="flex items-center gap-2 mt-1">
              <select
                value={selectedEmpresaId}
                onChange={e => setSelectedEmpresaId(e.target.value)}
                className="text-xs border border-purple-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white text-gray-700"
              >
                <option value="">Sin empresa</option>
                {empresasList.map(e => (
                  <option key={e.id} value={e.id}>{e.nombre}</option>
                ))}
              </select>
              <button
                onClick={saveEmpresa}
                disabled={savingEmpresa}
                className="text-xs px-2.5 py-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {savingEmpresa ? '…' : 'Guardar'}
              </button>
              <button
                onClick={() => { setEditingEmpresa(false); setSelectedEmpresaId(empresaId ?? '') }}
                className="text-xs px-2.5 py-1 border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 mt-1">
              {empresaNombre ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-100 rounded-full px-2.5 py-0.5">
                  🏢 {empresaNombre}
                </span>
              ) : null}
              <button
                onClick={() => setEditingEmpresa(true)}
                title={empresaNombre ? 'Cambiar empresa' : 'Asignar empresa'}
                className="text-gray-300 hover:text-purple-500 transition-colors text-xs leading-none"
              >
                {empresaNombre ? '✏️' : '＋ empresa'}
              </button>
            </div>
          )}
        </div>

        <button
          onClick={requestAnalysis}
          disabled={analyzing || !savedNote.trim()}
          title={!savedNote.trim() ? 'Primero agrega una nota inicial' : ''}
          className="flex items-center gap-2 px-5 py-3 bg-primary-600 text-white rounded-xl
                     font-semibold text-sm hover:bg-primary-700 transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {analyzing
            ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Analizando...</>
            : '🔍 Analizar caso'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 overflow-x-auto">
        {[
          { id: 'datos-generales', label: 'Datos Generales',                                   locked: false },
          { id: 'tipo-caso',       label: 'Tipo de caso',                                      locked: false },
          { id: 'sesiones',        label: `Sesiones AVI (${patterns.length})`,                 locked: false },
          { id: 'nota',            label: 'Nota inicial' + (savedNote ? ' ✓' : ' ⚠️'),        locked: false },
          { id: 'presenciales',    label: `Sesiones presenciales (${sessionNotes.length}/${MAX_SESIONES_PRESENCIALES})`, locked: false },
          { id: 'analisis',        label: `Análisis (${analyses.length})`,                     locked: false },
          { id: 'expediente',      label: tier === 'clinico' ? 'AVI-CLÍNICO' : '🔒 AVI-CLÍNICO', locked: tier !== 'clinico' },
        ].map(tab => (
          <button key={tab.id}
            onClick={() => {
              if (tab.locked) {
                alert('AVI-CLÍNICO está disponible en AVI Clínico. Actualiza tu plan en Planes y precios.')
                return
              }
              setActiveTab(tab.id as typeof activeTab)
            }}
            title={tab.locked ? 'Disponible en AVI Clínico' : undefined}
            className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              tab.locked
                ? 'border-transparent text-gray-300 cursor-not-allowed'
                : activeTab === tab.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Datos Generales ── */}
      {activeTab === 'datos-generales' && therapistId && (
        <DatosGeneralesTab
          patientId={patientId}
          therapistId={therapistId}
          patientEmail={profile?.email ?? null}
          initialData={expedienteRow}
        />
      )}

      {/* ── TAB: Tipo de caso ── */}
      {activeTab === 'tipo-caso' && therapistId && (
        <TipoCasoTab
          patientId={patientId}
          therapistId={therapistId}
        />
      )}

      {/* ── TAB: Sesiones AVI ── */}
      {activeTab === 'sesiones' && (
        <div className="space-y-4">
          {patterns.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">💬</p>
              <p>Este paciente aún no tiene sesiones registradas con AVI.</p>
            </div>
          ) : patterns.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {new Date(p.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
                {p.crisis_detected && (
                  <span className="text-xs bg-red-100 text-red-600 px-3 py-1 rounded-full font-medium">⚠️ Crisis detectada</span>
                )}
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{p.summary}</p>
              {p.predominant_emotions?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {p.predominant_emotions.map((e, i) => (
                    <span key={i} className="text-xs bg-calm-50 text-calm-700 px-3 py-1 rounded-full">{e}</span>
                  ))}
                </div>
              )}
              {p.emotional_patterns?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {p.emotional_patterns.map((e, i) => (
                    <span key={i} className="text-xs bg-primary-50 text-primary-700 px-3 py-1 rounded-full">{e}</span>
                  ))}
                </div>
              )}
              {p.reformulation && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                  <p className="text-xs text-amber-600 font-medium mb-1">Reformulación AVI</p>
                  <p className="text-sm text-amber-800 italic">"{p.reformulation}"</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── TAB: Sesiones Presenciales ── */}
      {activeTab === 'presenciales' && (
        <div className="space-y-6">

          {/* Formulario nueva sesión / edición */}
          {puedeAgregarSesion && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
              <h3 className="font-semibold text-gray-800">
                {editingSessionId
                  ? `Editando Sesión ${sessionNotes.find(s => s.id === editingSessionId)?.session_number}`
                  : `Nueva Sesión Presencial ${sessionNotes.length + 1}`}
              </h3>

              <div className="flex gap-4 flex-wrap items-end">
                <div className="space-y-1 flex-1 min-w-[160px]">
                  <label className="text-xs font-medium text-gray-500">Fecha de la sesión</label>
                  <input
                    type="date"
                    value={newSessionDate}
                    onChange={e => setNewSessionDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm
                               focus:outline-none focus:ring-2 focus:ring-primary-300"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer pb-2 select-none">
                  <input
                    type="checkbox"
                    checked={newSessionProBono}
                    onChange={e => setNewSessionProBono(e.target.checked)}
                    className="w-4 h-4 rounded accent-primary-600"
                  />
                  <span className="text-sm text-gray-600">Pro-bono</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer pb-2 select-none">
                  <input
                    type="checkbox"
                    checked={newSessionIsVirtual}
                    onChange={e => setNewSessionIsVirtual(e.target.checked)}
                    className="w-4 h-4 rounded accent-primary-600"
                  />
                  <span className="text-sm text-gray-600">Virtual</span>
                </label>
              </div>

              {/* 1. Objetivo */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">
                  1. Objetivo de la sesión / Seguimiento
                </label>
                <textarea
                  value={newSessionObjetivo}
                  onChange={e => setNewSessionObjetivo(e.target.value)}
                  placeholder="¿Qué se busca lograr en esta sesión? (máx. ~30 palabras)"
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-700
                             focus:outline-none focus:ring-2 focus:ring-primary-300 leading-relaxed resize-none"
                />
              </div>

              {/* 2. Desarrollo */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">
                  2. Desarrollo de la sesión / Intervención realizada
                </label>
                <textarea
                  value={newSessionDesarrollo}
                  onChange={e => setNewSessionDesarrollo(e.target.value)}
                  placeholder="Describe el desarrollo de la sesión: temas abordados, dinámica, técnicas aplicadas, reacciones del paciente..."
                  rows={6}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-700
                             focus:outline-none focus:ring-2 focus:ring-primary-300 leading-relaxed resize-none"
                />
              </div>

              {/* 3. Observaciones particulares */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">
                  3. Observaciones particulares / Acuerdos / Tareas
                </label>
                <textarea
                  value={newSessionNotes}
                  onChange={e => setNewSessionNotes(e.target.value)}
                  placeholder="Este apartado no puede quedar en blanco; es importante que contenga información para que pueda ser guardada la sesión"
                  rows={6}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-700
                             focus:outline-none focus:ring-2 focus:ring-primary-300 leading-relaxed resize-none"
                />
              </div>

              <div className="flex gap-3 justify-end">
                {editingSessionId && (
                  <button
                    onClick={() => { setEditingSessionId(null); setNewSessionNotes(''); setNewSessionDate(hoyMX()) }}
                    className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  onClick={saveSessionNote}
                  disabled={savingSession || !hayContenidoNuevaSesion}
                  className="px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold
                             hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {savingSession ? 'Guardando...' : editingSessionId ? 'Actualizar sesión' : 'Guardar sesión'}
                </button>
              </div>
            </div>
          )}

          {/* Límite alcanzado */}
          {sessionNotes.length >= MAX_SESIONES_PRESENCIALES && !editingSessionId && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 text-sm text-amber-700">
              Has alcanzado el límite de {MAX_SESIONES_PRESENCIALES} sesiones presenciales. Para continuar el seguimiento, considera generar un nuevo análisis de caso.
            </div>
          )}

          {/* Listado de sesiones */}
          {sessionNotes.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-3">📋</p>
              <p>Aún no hay sesiones presenciales registradas.</p>
              <p className="text-sm mt-1">Agrega las notas de cada sesión que tengas con el paciente.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessionNotes.map(s => (
                <div key={s.id} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-xs font-bold bg-primary-100 text-primary-700 px-3 py-1 rounded-full">
                        Sesión {s.session_number}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(s.session_date).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}
                      </span>
                      {s.is_pro_bono && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Pro-bono</span>
                      )}
                      {s.is_virtual && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Virtual</span>
                      )}
                    </div>
                    <button
                      onClick={() => startEdit(s)}
                      className="text-xs text-primary-600 hover:text-primary-800 transition-colors"
                    >
                      Editar
                    </button>
                  </div>
                  <div className="space-y-4">
                    {s.session_objetivo && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Objetivo de la sesión / Seguimiento</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{s.session_objetivo}</p>
                      </div>
                    )}
                    {s.session_desarrollo && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Desarrollo de la sesión / Intervención realizada</p>
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{s.session_desarrollo}</p>
                      </div>
                    )}
                    {s.notes && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Observaciones particulares / Acuerdos / Tareas</p>
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{s.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Análisis ── */}
      {activeTab === 'analisis' && (
        <div className="space-y-4">
          {analysisError && (
            <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 text-sm text-red-700 flex justify-between items-start gap-2">
              <span>⚠️ {analysisError}</span>
              <button onClick={() => setAnalysisError(null)} className="text-red-400 hover:text-red-600">✕</button>
            </div>
          )}

          {(analyzing || streamText) && (
            <div className="bg-white rounded-2xl border border-primary-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                {analyzing && <span className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />}
                <h3 className="font-semibold text-primary-700">
                  {analyzing ? 'Generando análisis clínico... (puede tardar 1-2 minutos)' : '✓ Análisis completado'}
                </h3>
              </div>
              <div
                className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: streamText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
              />
              <div ref={streamRef} />
            </div>
          )}

          {analyses.length === 0 && !streamText && (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">🔍</p>
              <p className="mb-2">No hay análisis generados aún.</p>
              <p className="text-sm">
                {!savedNote.trim()
                  ? 'Primero agrega una nota inicial en la pestaña "Nota inicial".'
                  : 'Presiona "Analizar caso" para generar el análisis clínico completo.'}
              </p>
            </div>
          )}

          {analyses.length > 0 && !streamText && analyses.map((a, i) => (
            <details key={a.id} open={i === 0}>
              <summary className="cursor-pointer bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between hover:border-primary-200 transition-colors list-none">
                <div>
                  <span className="font-medium text-gray-800">
                    🔍 Análisis clínico
                  </span>
                  <span className="text-xs text-gray-400 ml-3">
                    {new Date(a.created_at).toLocaleDateString('es-MX', {
                      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                </div>
                <span className="text-gray-400">▾</span>
              </summary>
              <div className="bg-white border border-t-0 border-gray-100 rounded-b-2xl p-6">
                <div
                  className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ __html: a.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
                />
              </div>
            </details>
          ))}
        </div>
      )}

      {/* ── TAB: Nota inicial ── */}
      {activeTab === 'nota' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-6">
          <div>
            <h3 className="font-semibold text-gray-800 mb-1">Nota inicial integrada</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Completa los cuatro apartados de la Nota Inicial. Toda la información aquí registrada
              se usa como base del análisis clínico de Consúltame.
            </p>
          </div>

          {/* Fecha + Pro-bono + Virtual */}
          <div className="flex gap-4 flex-wrap items-end">
            <div className="space-y-1 flex-1 min-w-[160px]">
              <label className="text-xs font-medium text-gray-500">Fecha de la consulta inicial</label>
              <input
                type="date"
                value={initialNoteDate}
                onChange={e => setInitialNoteDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm
                           focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer pb-2 select-none">
              <input
                type="checkbox"
                checked={initialNoteProBono}
                onChange={e => setInitialNoteProBono(e.target.checked)}
                className="w-4 h-4 rounded accent-primary-600"
              />
              <span className="text-sm text-gray-600">Pro-bono</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer pb-2 select-none">
              <input
                type="checkbox"
                checked={initialNoteVirtual}
                onChange={e => setInitialNoteVirtual(e.target.checked)}
                className="w-4 h-4 rounded accent-primary-600"
              />
              <span className="text-sm text-gray-600">Virtual</span>
            </label>
          </div>

          {/* ── Sprint 4 IX — Frecuencia de las sesiones ── */}
          <div className="space-y-2">
            <div>
              <p className="text-sm font-semibold text-gray-700">Frecuencia de las sesiones</p>
              <p className="text-xs text-gray-400 mt-0.5">Cadencia acordada con el asesorado o paciente.</p>
            </div>
            <select
              value={frecuenciaConfig}
              onChange={e => setFrecuenciaConfig(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700
                         focus:outline-none focus:ring-2 focus:ring-primary-300 transition bg-white"
            >
              <option value="">— Sin definir</option>
              <option value="semanal">Semanal</option>
              <option value="cada_2_semanas">Cada 2 semanas</option>
              <option value="mensual">Mensual</option>
            </select>
          </div>

          {/* ── Sprint 4 VIII — Sensación inicial del paciente ── */}
          <div className="space-y-2">
            <div>
              <p className="text-sm font-semibold text-gray-700">Sensación inicial del paciente</p>
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                Al comenzar la Sesión Inicial pregúntale a tu asesorado o paciente: <em>"Del 1 al 10 me puedes decir por favor ¿Cómo te sientes en este momento?, donde 1 es pésimo (muy muy mal), y 10 es excelente."</em>
              </p>
            </div>
            <select
              value={sensacionPaciente}
              onChange={e => setSensacionPaciente(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700
                         focus:outline-none focus:ring-2 focus:ring-primary-300 transition bg-white"
            >
              <option value="0">— (n/a)</option>
              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                <option key={n} value={String(n)}>{n}</option>
              ))}
            </select>
          </div>

          {/* 1. Desarrollo del caso */}
          <div className="space-y-2">
            <div>
              <p className="text-sm font-semibold text-gray-700">
                1. Desarrollo del caso
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Resumen de lo que nos platica el paciente: datos generales, contexto familiar, historia relevante.
              </p>
            </div>
            <textarea
              value={initialNote}
              onChange={e => setInitialNote(e.target.value)}
              placeholder="Nombre, edad, estado civil, ocupación, composición familiar. Resumen de lo que el paciente relató en la primera consulta..."
              rows={6}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-700
                         focus:outline-none focus:ring-2 focus:ring-primary-300 leading-relaxed resize-none"
            />
          </div>

          {/* 2. Motivo de consulta del paciente */}
          <div className="space-y-2">
            <div>
              <p className="text-sm font-semibold text-gray-700">
                2. Motivo de consulta del paciente
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Lo que el paciente dice que lo trajo a consulta, en sus propias palabras o parafraseado.
              </p>
            </div>
            <textarea
              value={initialNoteMotivo}
              onChange={e => setInitialNoteMotivo(e.target.value)}
              placeholder="&quot;Vine porque...&quot; — el problema o situación que el paciente identifica como la razón de buscar ayuda."
              rows={4}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-700
                         focus:outline-none focus:ring-2 focus:ring-primary-300 leading-relaxed resize-none"
            />
          </div>

          {/* 3. Motivo de consulta subyacente */}
          <div className="space-y-2">
            <div>
              <p className="text-sm font-semibold text-gray-700">
                3. Motivo de consulta subyacente
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Lo que como Asesor o Terapeuta observas que realmente está ocurriendo — más allá de lo que el paciente presenta.
              </p>
            </div>
            <textarea
              value={initialNoteSubyacente}
              onChange={e => setInitialNoteSubyacente(e.target.value)}
              placeholder="Observación clínica: el problema real que subyace al motivo declarado por el paciente (herida de apego, patrón relacional, dinámica familiar, etc.)."
              rows={4}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-700
                         focus:outline-none focus:ring-2 focus:ring-primary-300 leading-relaxed resize-none"
            />
          </div>

          {/* 4. Premisas ante el motivo de consulta */}
          <div className="space-y-2">
            <div>
              <p className="text-sm font-semibold text-gray-700">
                4. Premisas ante el motivo de consulta
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                ¿Por qué consideras que se da el problema subyacente? Preferentemente define 3 premisas.
              </p>
            </div>
            <textarea
              value={initialNotePremisas}
              onChange={e => setInitialNotePremisas(e.target.value)}
              placeholder="Premisa 1: ...&#10;Premisa 2: ...&#10;Premisa 3: ..."
              rows={5}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-700
                         focus:outline-none focus:ring-2 focus:ring-primary-300 leading-relaxed resize-none"
            />
          </div>

          {/* ── Sprint 4 VIII — Factores de Riesgo y Protección (formato FamiliarTab) ── */}
          {(() => {
            const IND_RIESGO = [
              { key: 'posicion_rigida',          titulo: 'Posición rígida en el sistema',     desc: 'Chivo expiatorio, héroe, cuidador parental.' },
              { key: 'corte_emocional',          titulo: 'Corte emocional',                    desc: 'Ruptura significativa con la familia de origen.' },
              { key: 'patron_transgeneracional', titulo: 'Patrón transgeneracional repetido',  desc: 'Lealtad a un guion familiar disfuncional.' },
              { key: 'aislamiento_relacional',   titulo: 'Aislamiento relacional',             desc: 'Ausencia de red de apoyo significativa.' },
              { key: 'indiferenciacion',         titulo: 'Indiferenciación de sí mismo',       desc: 'Incapacidad de tener pensamientos, sentimientos, valores y decisiones propias, distintas de las de su familia o pareja.' },
              { key: 'homeostasis_individual',   titulo: 'Homeostasis individual',             desc: 'El síntoma protege al sistema de un cambio mayor.' },
            ]
            const IND_PROTECCION = [
              { key: 'claridad_limites',         titulo: 'Claridad de límites',                desc: 'Capacidad de mantener distancia emocional adecuada sin fusionarse ni aislarse.' },
              { key: 'diferenciacion_self',      titulo: 'Diferenciación de mí mismo (del self)', desc: 'Distinguir los propios pensamientos y emociones de los de los demás.' },
              { key: 'capacidad_introspeccion',  titulo: 'Capacidad de introspección',         desc: 'Reflexionar sobre sí mismo y evaluarse de forma honesta para mejorar.' },
              { key: 'autonomia',                titulo: 'Autonomía',                           desc: 'Mantener distancia emocional y física de las fuentes de estrés sin aislarse.' },
              { key: 'habilidad_relacionarse',   titulo: 'Habilidad para relacionarse',        desc: 'Establecer vínculos íntimos equilibrando las propias necesidades con las del otro.' },
            ]
            const FAM_RIESGO = [
              { key: 'limites_difusos',           titulo: 'Límites difusos o rígidos',              desc: 'Familias aglutinadas (donde no hay individualidad ni privacidad) o familias desligadas (donde hay desapego extremo y falta de apoyo).' },
              { key: 'triangulacion',             titulo: 'Triangulación',                           desc: 'Involucrar a un tercero (frecuentemente un hijo) para desviar el conflicto entre dos miembros (generalmente la pareja).' },
              { key: 'parentificacion',           titulo: 'Parentificación',                         desc: 'Inversión de roles donde un hijo asume responsabilidades parentales, emocionales o económicas que no corresponden a su edad.' },
              { key: 'comunicacion_patologica',   titulo: 'Comunicación patológica',                 desc: 'Presencia de dobles mensajes (mensajes contradictorios), descalificaciones continuas o secretos familiares disfuncionales.' },
              { key: 'rigidez_homeostatica',      titulo: 'Rigidez homeostática',                    desc: 'Incapacidad del sistema para cambiar y adaptarse a las nuevas etapas del ciclo vital (ej. tratar a un adolescente como si fuera un niño pequeño).' },
              { key: 'alianzas_destructivas',     titulo: 'Alianzas e interacciones destructivas',   desc: 'Coaliciones (unión de dos miembros contra un tercero) que rompen las jerarquías naturales de la familia.' },
              { key: 'ciclo_vital_no_resuelto',   titulo: 'Ciclo vital no resuelto',                 desc: 'Dificultades para transitar etapas evolutivas (nido vacío, adolescencia, jubilación).' },
              { key: 'lealtades_invisibles',      titulo: 'Lealtades invisibles',                    desc: 'Mandatos transgeneracionales no cuestionados.' },
              { key: 'delegacion_sintoma',        titulo: 'Delegación del síntoma',                  desc: 'Un miembro (identificado como paciente) porta el conflicto de todo el sistema.' },
            ]
            const FAM_PROTECCION = [
              { key: 'limites_claros',            titulo: 'Límites claros y flexibles',              desc: 'Reglas comprensibles que definen los roles de cada uno, permitiendo la cercanía emocional sin perder la autonomía individual.' },
              { key: 'cohesion_familiar',         titulo: 'Cohesión familiar',                       desc: 'Sentimiento de pertenencia, afecto mutuo y apoyo emocional disponible entre los miembros del grupo.' },
              { key: 'comunicacion_asertiva',     titulo: 'Comunicación asertiva y abierta',         desc: 'Capacidad para expresar emociones, resolver conflictos de forma directa y validar los puntos de vista de los demás.' },
              { key: 'flexibilidad',              titulo: 'Flexibilidad y adaptabilidad',             desc: 'Capacidad del sistema para reorganizar sus reglas, roles y jerarquías ante crisis o cambios del entorno.' },
              { key: 'jerarquia_parental',        titulo: 'Jerarquía parental clara',                desc: 'Figuras de autoridad (padres/cuidadores) coordinadas, que actúan de mutuo acuerdo y ejercen un liderazgo nutridor.' },
              { key: 'redes_apoyo',               titulo: 'Redes de apoyo externas',                 desc: 'Conexiones saludables con la familia extensa, la escuela, amigos o la comunidad que sostienen al sistema familiar.' },
            ]

            function toggleInd(
              setter: React.Dispatch<React.SetStateAction<{ individual: string[]; familiar: string[] }>>,
              key: string
            ) {
              setter(prev => ({
                ...prev,
                individual: prev.individual.includes(key)
                  ? prev.individual.filter(x => x !== key)
                  : [...prev.individual, key],
              }))
            }
            function toggleFam(
              setter: React.Dispatch<React.SetStateAction<{ individual: string[]; familiar: string[] }>>,
              key: string
            ) {
              setter(prev => ({
                ...prev,
                familiar: prev.familiar.includes(key)
                  ? prev.familiar.filter(x => x !== key)
                  : [...prev.familiar, key],
              }))
            }

            return (
              <div className="space-y-5">
                {/* Header */}
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100 pb-1">
                  Terapia Familiar Sistémica
                </p>

                {/* ── INDIVIDUAL ── */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">Individual</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Riesgo Individual */}
                    <div>
                      <p className="text-xs font-semibold mb-3 text-red-500">Factores de Riesgo</p>
                      <div className="space-y-3">
                        {IND_RIESGO.map(f => (
                          <label key={f.key} className="flex items-start gap-2.5 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={factoresRiesgo.individual.includes(f.key)}
                              onChange={() => toggleInd(setFactoresRiesgo, f.key)}
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
                    {/* Protección Individual */}
                    <div>
                      <p className="text-xs font-semibold mb-3 text-emerald-600">Factores de Protección</p>
                      <div className="space-y-3">
                        {IND_PROTECCION.map(f => (
                          <label key={f.key} className="flex items-start gap-2.5 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={factoresProteccion.individual.includes(f.key)}
                              onChange={() => toggleInd(setFactoresProteccion, f.key)}
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
                </div>

                {/* ── FAMILIAR ── */}
                <div className="space-y-3 pt-4 border-t border-gray-100">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">Familiar</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Riesgo Familiar */}
                    <div>
                      <p className="text-xs font-semibold mb-3 text-red-500">Factores de Riesgo</p>
                      <div className="space-y-3">
                        {FAM_RIESGO.map(f => (
                          <label key={f.key} className="flex items-start gap-2.5 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={factoresRiesgo.familiar.includes(f.key)}
                              onChange={() => toggleFam(setFactoresRiesgo, f.key)}
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
                    {/* Protección Familiar */}
                    <div>
                      <p className="text-xs font-semibold mb-3 text-emerald-600">Factores de Protección</p>
                      <div className="space-y-3">
                        {FAM_PROTECCION.map(f => (
                          <label key={f.key} className="flex items-start gap-2.5 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={factoresProteccion.familiar.includes(f.key)}
                              onChange={() => toggleFam(setFactoresProteccion, f.key)}
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
                </div>
              </div>
            )
          })()}

          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              {savedNote.trim() ? '✓ Nota guardada — disponible para el análisis' : '⚠️ Sin nota — el análisis no puede generarse'}
            </p>
            <button
              onClick={saveNote}
              disabled={savingNote || !noteChanged}
              className="px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold
                         hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {savingNote ? 'Guardando...' : noteSaved ? '✓ Guardado' : 'Guardar nota'}
            </button>
          </div>
        </div>
      )}

      {/* ── TAB: Expediente ── */}
      {activeTab === 'expediente' && therapistId && (
        <ExpedienteTab
          patientId={patientId}
          therapistId={therapistId}
          patientEmail={profile?.email ?? null}
          patientName={profile?.full_name ?? null}
        />
      )}
    </div>
  )
}
