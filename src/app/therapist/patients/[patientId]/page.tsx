'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const MAX_SESIONES_PRESENCIALES = 12

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
  notes: string
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
  const [savingNote, setSavingNote] = useState(false)
  const [noteSaved, setNoteSaved] = useState(false)

  // Nueva sesión presencial
  const [newSessionDate, setNewSessionDate] = useState(new Date().toISOString().split('T')[0])
  const [newSessionNotes, setNewSessionNotes] = useState('')
  const [savingSession, setSavingSession] = useState(false)
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)

  const [analyzing, setAnalyzing] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [analysisError, setAnalysisError] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<'sesiones' | 'presenciales' | 'analisis' | 'nota'>('sesiones')
  const streamRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    load()
  }, [patientId])

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const [profileRes, patternsRes, analysesRes, relationRes, sessionNotesRes] = await Promise.all([
      supabase.from('profiles').select('full_name, email').eq('id', patientId).single(),
      supabase.from('patterns').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }),
      supabase.from('analyses').select('*').eq('patient_id', patientId).eq('therapist_id', user?.id ?? '').order('created_at', { ascending: false }),
      supabase.from('therapist_patients').select('initial_note').eq('patient_id', patientId).eq('therapist_id', user?.id ?? '').single(),
      supabase.from('therapist_session_notes').select('*').eq('patient_id', patientId).order('session_number', { ascending: true }),
    ])

    if (profileRes.data) setProfile(profileRes.data)
    if (patternsRes.data) setPatterns(patternsRes.data)
    if (analysesRes.data) setAnalyses(analysesRes.data)
    if (sessionNotesRes.data) setSessionNotes(sessionNotesRes.data)
    if (relationRes.data?.initial_note) {
      setInitialNote(relationRes.data.initial_note)
      setSavedNote(relationRes.data.initial_note)
    }
  }

  useEffect(() => {
    streamRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [streamText])

  async function saveNote() {
    setSavingNote(true)
    try {
      const res = await fetch('/api/analysis', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, initialNote }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(`Error al guardar la nota: ${err.error ?? res.status}`)
        return
      }
      setSavedNote(initialNote)
      setNoteSaved(true)
      setTimeout(() => setNoteSaved(false), 3000)
    } catch {
      alert('Error de red al guardar la nota. Intenta de nuevo.')
    } finally {
      setSavingNote(false)
    }
  }

  async function saveSessionNote() {
    if (!newSessionNotes.trim()) return
    setSavingSession(true)
    try {
      const supabase = createClient()
      const nextNumber = editingSessionId
        ? sessionNotes.find(s => s.id === editingSessionId)?.session_number ?? 1
        : (sessionNotes.length > 0 ? Math.max(...sessionNotes.map(s => s.session_number)) + 1 : 1)

      if (editingSessionId) {
        await supabase
          .from('therapist_session_notes')
          .update({ notes: newSessionNotes, session_date: newSessionDate, updated_at: new Date().toISOString() })
          .eq('id', editingSessionId)
      } else {
        await supabase
          .from('therapist_session_notes')
          .insert({ patient_id: patientId, session_number: nextNumber, session_date: newSessionDate, notes: newSessionNotes })
      }

      setNewSessionNotes('')
      setNewSessionDate(new Date().toISOString().split('T')[0])
      setEditingSessionId(null)
      await load()
    } finally {
      setSavingSession(false)
    }
  }

  function startEdit(session: SessionNote) {
    setEditingSessionId(session.id)
    setNewSessionDate(session.session_date)
    setNewSessionNotes(session.notes)
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

  const noteChanged = initialNote !== savedNote
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
          <h1 className="text-2xl font-bold text-gray-800">{profile?.full_name ?? '...'}</h1>
          <p className="text-sm text-gray-400">{profile?.email}</p>
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
          { id: 'sesiones',     label: `Sesiones AVI (${patterns.length})` },
          { id: 'presenciales', label: `Sesiones presenciales (${sessionNotes.length}/${MAX_SESIONES_PRESENCIALES})` },
          { id: 'analisis',     label: `Análisis (${analyses.length})` },
          { id: 'nota',         label: 'Nota inicial' + (savedNote ? ' ✓' : ' ⚠️') },
        ].map(tab => (
          <button key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

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

              <div className="flex gap-4 flex-wrap">
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
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500">
                  Resumen y observaciones de la sesión
                </label>
                <textarea
                  value={newSessionNotes}
                  onChange={e => setNewSessionNotes(e.target.value)}
                  placeholder="Describe lo que ocurrió en la sesión: temas trabajados, reacciones del paciente, avances observados, dificultades, técnicas aplicadas, observaciones clínicas relevantes..."
                  rows={8}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-700
                             focus:outline-none focus:ring-2 focus:ring-primary-300 leading-relaxed resize-none"
                />
              </div>

              <div className="flex gap-3 justify-end">
                {editingSessionId && (
                  <button
                    onClick={() => { setEditingSessionId(null); setNewSessionNotes(''); setNewSessionDate(new Date().toISOString().split('T')[0]) }}
                    className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  onClick={saveSessionNote}
                  disabled={savingSession || !newSessionNotes.trim()}
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
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold bg-primary-100 text-primary-700 px-3 py-1 rounded-full">
                        Sesión {s.session_number}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(s.session_date).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                    <button
                      onClick={() => startEdit(s)}
                      className="text-xs text-primary-600 hover:text-primary-800 transition-colors"
                    >
                      Editar
                    </button>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{s.notes}</p>
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
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <div>
            <h3 className="font-semibold text-gray-800 mb-1">Nota inicial del caso</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Describe los datos generales del paciente, el motivo de consulta y el objetivo terapéutico.
              Esta nota es la base de todos los análisis clínicos de Consultame.
            </p>
          </div>

          <textarea
            value={initialNote}
            onChange={e => setInitialNote(e.target.value)}
            placeholder={`Ejemplo:
Nombre: María García, 38 años, casada, 2 hijos.
Motivo de consulta: dificultades en la relación conyugal, comunicación deteriorada con el esposo.
Contexto familiar: familia nuclear con tensiones por la crianza. El esposo trabaja largas jornadas.
Objetivo terapéutico: mejorar la comunicación de pareja y sanar heridas de abandono emocional.
Observaciones clínicas iniciales: patrón de apego ansioso, baja autoestima, dificultad para pedir ayuda.`}
            rows={14}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-700
                       focus:outline-none focus:ring-2 focus:ring-primary-300 leading-relaxed resize-none"
          />

          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">
              {savedNote.trim() ? '✓ Nota guardada — disponible para el análisis' : '⚠️ Sin nota — el análisis no puede generarse'}
            </p>
            <button
              onClick={saveNote}
              disabled={savingNote || !noteChanged || !initialNote.trim()}
              className="px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold
                         hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {savingNote ? 'Guardando...' : noteSaved ? '✓ Guardado' : 'Guardar nota'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
